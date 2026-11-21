import { auth } from '../lib/firebase';
import {
  Proposal,
  UserAccount,
  UnionCommitteeApproval,
  DivisionTreasuryAuthorization,
  ReviewCriterionKey,
  REVIEW_READINESS_LABELS,
  ReviewReadinessRating,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getUserAllUnions,
  getUserVotingUnions,
  isUserLiaisonEligible,
} from '../types';
import { fetchDivisionLiaisons, fetchLeadershipOfficers } from './proposalService';
import { evaluateProposalReviewFramework, buildLiaisonActionItems } from '../utils/projectReviewFramework';
import { formatCompositeProjectCode } from '../utils/externalProposalCodec';

export type EmailNotificationEventType =
  | 'step3_approved'
  | 'step4_revision'
  | 'step4_recommended'
  | 'step5_authorized'
  | 'test_self';

export interface EmailRecipient {
  email: string;
  name: string;
  roleLabel: string;
}

export interface EmailQuotaStatus {
  dateKey: string;
  resetTimezone: string;
  messagesSentToday: number;
  recipientsSentToday: number;
  usedToday: number;
  dailyLimit: number;
  remainingQuota: number;
  googleRemainingQuota: number | null;
  source: 'google_live' | 'server_tracked';
  quotaExhausted: boolean;
  isLowQuota: boolean;
  essentialOnlyMode: boolean;
  lastError: string | null;
  lastSentAt: string | null;
  lastSyncedAt: string | null;
}

export interface EmailServiceStatus {
  configured: boolean;
  hasWebhookUrl: boolean;
  hasWebhookSecret: boolean;
  quota?: EmailQuotaStatus;
}

export interface EmailDispatchResult {
  ok: boolean;
  sentCount?: number;
  recipients?: string[];
  skippedReason?: string;
  quotaExceeded?: boolean;
  quota?: EmailQuotaStatus;
  error?: string;
}

// Track Role Preview state globally so automated emails NEVER go to real proposal contacts while simulating roles
let rolePreviewActive = false;

export function setEmailRolePreviewActive(active: boolean): void {
  rolePreviewActive = Boolean(active);
}

export function getIsEmailRolePreviewActive(): boolean {
  return rolePreviewActive;
}

const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getProposalAppUrl(proposalId?: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-q2vkpbhx7wtbjjohbrw7bc-633656212863.asia-southeast1.run.app';
  if (!proposalId) return origin;
  return `${origin}/?proposal=${encodeURIComponent(proposalId)}`;
}

function getProposalRequestedUsd(proposal: Proposal): number {
  return (proposal.budgetItems || []).reduce(
    (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );
}

async function getFirebaseIdToken(): Promise<string | null> {
  try {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Checks whether the server has EMAIL_WEBHOOK_URL and EMAIL_WEBHOOK_SECRET configured,
 * and retrieves the current daily email counter + remaining quota.
 */
export async function fetchEmailServiceStatus(
  syncGoogleQuota = false
): Promise<EmailServiceStatus> {
  const token = await getFirebaseIdToken();
  if (!token) {
    return { configured: false, hasWebhookUrl: false, hasWebhookSecret: false };
  }

  try {
    const query = syncGoogleQuota ? '?syncGoogleQuota=1' : '';
    const resp = await fetch(`/api/v1/notifications/email-status${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) {
      return { configured: false, hasWebhookUrl: false, hasWebhookSecret: false };
    }
    const data = (await resp.json()) as Partial<EmailServiceStatus>;
    return {
      configured: Boolean(data.configured),
      hasWebhookUrl: Boolean(data.hasWebhookUrl),
      hasWebhookSecret: Boolean(data.hasWebhookSecret),
      quota: data.quota,
    };
  } catch {
    return { configured: false, hasWebhookUrl: false, hasWebhookSecret: false };
  }
}

export async function updateEmailQuotaConfig(config: {
  dailyLimit?: number;
  essentialOnlyMode?: boolean;
}): Promise<{ ok: boolean; quota?: EmailQuotaStatus; error?: string }> {
  const token = await getFirebaseIdToken();
  if (!token) {
    return { ok: false, error: 'You must be signed in to update email quota settings.' };
  }

  try {
    const resp = await fetch('/api/v1/notifications/email-quota-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(config),
    });
    const data = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      quota?: EmailQuotaStatus;
      error?: string;
    } | null;
    if (!resp.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'Could not update email quota settings.' };
    }
    return { ok: true, quota: data.quota };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error updating quota settings.',
    };
  }
}

/**
 * Resolves deduplicated recipient contacts for a given proposal workflow milestone.
 * Excludes the currently acting user (so officers don't email themselves on their own click).
 */
export async function resolveProposalEmailRecipients(
  eventType: Exclude<EmailNotificationEventType, 'test_self'>,
  proposal: Proposal,
  actor?: UserAccount | null
): Promise<EmailRecipient[]> {
  const actorEmailLower = (actor?.email || '').trim().toLowerCase();
  const canonUnion = getCanonicalUnion(proposal.union || '');

  const [liaisons, officers] = await Promise.all([
    fetchDivisionLiaisons().catch(() => [] as UserAccount[]),
    fetchLeadershipOfficers().catch(() => [] as UserAccount[]),
  ]);

  const recipientMap = new Map<string, EmailRecipient>();

  const addRecipient = (email?: string | null, name?: string | null, roleLabel?: string) => {
    const clean = (email || '').trim();
    const lower = clean.toLowerCase();
    if (!clean || !VALID_EMAIL_RE.test(clean)) return;
    if (actorEmailLower && lower === actorEmailLower) return;

    const existing = recipientMap.get(lower);
    if (existing) {
      if (roleLabel && !existing.roleLabel.includes(roleLabel)) {
        existing.roleLabel = `${existing.roleLabel} & ${roleLabel}`;
      }
      if ((!existing.name || existing.name === existing.email) && name?.trim()) {
        existing.name = name.trim();
      }
      return;
    }

    recipientMap.set(lower, {
      email: clean,
      name: name?.trim() || clean.split('@')[0],
      roleLabel: roleLabel || 'Contact',
    });
  };

  const addPocAndOwner = () => {
    addRecipient(
      proposal.pointOfContact?.email,
      proposal.pointOfContact?.name || proposal.userName,
      'Point of Contact'
    );
    addRecipient(
      proposal.userEmail,
      proposal.userName || proposal.pointOfContact?.name,
      'Proposal Owner'
    );
  };

  const addUnionLead = () => {
    addRecipient(
      proposal.divisionLeadContact?.email,
      proposal.divisionLeadContact?.name,
      'Union Lead'
    );
  };

  const addUnionOfficers = () => {
    for (const u of officers) {
      if (u.role !== 'treasurer' && u.role !== 'coordinator') continue;
      const userUnions = getUserAllUnions(u).map(getCanonicalUnion);
      if (canonUnion && !userUnions.includes(canonUnion)) continue;
      addRecipient(
        u.email,
        u.displayName,
        u.role === 'treasurer' ? 'Union Treasurer' : 'Union Coordinator'
      );
    }
  };

  const addAssignedLiaisons = () => {
    addRecipient(proposal.gcLiaison?.email, proposal.gcLiaison?.name, 'Division Liaison');
    for (const u of liaisons) {
      if (!isUserLiaisonEligible(u)) continue;
      const votingUnions = getUserVotingUnions(u).map(getCanonicalUnion);
      if (canonUnion && !votingUnions.includes(canonUnion)) continue;
      addRecipient(u.email, u.displayName, 'Division Liaison');
    }
  };

  if (eventType === 'step3_approved') {
    addAssignedLiaisons();
    addPocAndOwner();
    addUnionLead();
  } else if (eventType === 'step4_revision' || eventType === 'step4_recommended') {
    addPocAndOwner();
    addUnionLead();
    addUnionOfficers();
  } else if (eventType === 'step5_authorized') {
    addPocAndOwner();
    addUnionLead();
    addUnionOfficers();
    addAssignedLiaisons();
  }

  return Array.from(recipientMap.values());
}

function renderBrandedEmailShell({
  accentColor,
  badgeText,
  heading,
  subheading,
  metaRows,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote,
}: {
  accentColor: string;
  badgeText: string;
  heading: string;
  subheading: string;
  metaRows: Array<{ label: string; value: string }>;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote?: string;
}): string {
  const rowsHtml = metaRows
    .map(
      (r) => `
      <tr>
        <td style="padding:7px 0;font-size:12px;font-weight:700;color:#64748b;width:155px;vertical-align:top;">${escapeHtml(r.label)}</td>
        <td style="padding:7px 0;font-size:13px;font-weight:600;color:#0f172a;vertical-align:top;">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#182747 0%,#1c398e 100%);padding:22px 26px;color:#ffffff;">
              <div style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${accentColor};color:#ffffff;font-size:11px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:10px;">
                ${escapeHtml(badgeText)}
              </div>
              <h1 style="margin:0;font-size:19px;line-height:1.3;font-weight:800;color:#ffffff;">
                ${escapeHtml(heading)}
              </h1>
              <p style="margin:6px 0 0 0;font-size:13px;line-height:1.45;color:#cbd5e1;">
                ${escapeHtml(subheading)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 26px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin-bottom:18px;">
                ${rowsHtml}
              </table>
              ${bodyHtml}
              <div style="margin:24px 0 10px 0;">
                <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background-color:#1c398e;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:10px;">
                  ${escapeHtml(ctaLabel)}
                </a>
              </div>
              <p style="margin:12px 0 0 0;font-size:11px;color:#64748b;word-break:break-all;">
                Direct link: <a href="${escapeHtml(ctaUrl)}" style="color:#1c398e;">${escapeHtml(ctaUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 26px;font-size:11px;line-height:1.5;color:#64748b;">
              ${escapeHtml(
                footerNote ||
                  'Sent automatically by SSD OneVoice27 Proposal Portal · Southern Asia-Pacific Division'
              )}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function postEmailDispatch({
  to,
  replyTo,
  subject,
  text,
  html,
  eventType,
  proposalId,
  bypassRolePreviewCheck = false,
}: {
  to: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  eventType: EmailNotificationEventType;
  proposalId?: string;
  bypassRolePreviewCheck?: boolean;
}): Promise<EmailDispatchResult> {
  if (!bypassRolePreviewCheck && rolePreviewActive) {
    return {
      ok: false,
      skippedReason: 'Role Preview is active — live emails to proposal contacts are disabled.',
    };
  }

  if (!to || to.length === 0) {
    return {
      ok: false,
      skippedReason: 'No valid recipient email addresses found.',
    };
  }

  const token = await getFirebaseIdToken();
  if (!token) {
    return {
      ok: false,
      error: 'You must be signed in to send email notifications.',
    };
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 16_000);

    try {
      const resp = await fetch('/api/v1/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          to,
          ...(replyTo && VALID_EMAIL_RE.test(replyTo) ? { replyTo } : {}),
          subject,
          text,
          html,
          senderName: 'SSD OneVoice27',
          eventType,
          proposalId,
        }),
      });

      const rawText = await resp.text();
      const contentType = resp.headers.get('content-type') || 'unknown';

      const isProxyWarmupHtml =
        contentType.includes('text/html') &&
        rawText.toLowerCase().includes('starting server');

      if (isProxyWarmupHtml && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      let data: {
        ok?: boolean;
        code?: string;
        sentCount?: number;
        recipients?: string[];
        quota?: EmailQuotaStatus;
        error?: string;
      } | null = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!resp.ok || !data || !data.ok) {
        const quotaExceeded =
          resp.status === 429 || data?.code === 'DAILY_QUOTA_EXCEEDED';
        if (data?.error) {
          return {
            ok: false,
            quotaExceeded,
            quota: data.quota,
            error: data.error,
          };
        }
        if (isProxyWarmupHtml) {
          return {
            ok: false,
            error:
              'The preview server was restarting ("Starting Server..."). Wait 3 seconds and click Send Test Email again.',
          };
        }
        const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
        const snippet = titleMatch?.[1]?.trim()
          ? `Page title: "${titleMatch[1].trim()}"`
          : rawText.replace(/\s+/g, ' ').trim().slice(0, 180);
        const redirectInfo = resp.redirected ? ` · redirected to ${resp.url}` : '';
        return {
          ok: false,
          quotaExceeded,
          quota: data?.quota,
          error: `Email dispatch failed (HTTP ${resp.status}, ${contentType}${redirectInfo})${
            snippet ? `: ${snippet}` : '.'
          }`,
        };
      }

      return {
        ok: true,
        sentCount: data.sentCount ?? to.length,
        recipients: data.recipients ?? to,
        quota: data.quota,
      };
    } catch (err) {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Network error while dispatching email notification.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    error: 'Email dispatch failed after retrying.',
  };
}

function buildStep3ApprovalEmailContent({
  proposal,
  approvalData,
}: {
  proposal: Proposal;
  approvalData: UnionCommitteeApproval;
}): { subject: string; html: string; text: string } {
  const canonUnion = getCanonicalUnion(proposal.union || '');
  const unionAcronym = UNION_ACRONYMS[canonUnion] || proposal.union || 'SSD';
  const title = proposal.title?.trim() || 'Untitled Proposal';
  const totalRequested = getProposalRequestedUsd(proposal);
  const url = getProposalAppUrl(proposal.id);

  const subject = `[OneVoice27] Step 3 Union Approved: ${title} (${unionAcronym})`;
  const minutesBlock = approvalData.minutesExcerpt?.trim()
    ? `<div style="margin-top:14px;padding:12px 14px;background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;font-size:13px;line-height:1.5;color:#064e3b;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#047857;margin-bottom:4px;">Committee Minutes Excerpt</div>
        ${escapeHtml(approvalData.minutesExcerpt.trim())}
      </div>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 12px 0;font-size:13.5px;line-height:1.55;color:#334155;">
      The Union Committee has officially approved this proposal and recorded Committee Action <strong>#${escapeHtml(
        approvalData.actionNumber
      )}</strong>. It is now ready for <strong>Step 4 · Division Liaison Review &amp; Vote</strong>.
    </p>
    ${minutesBlock}
  `;

  const html = renderBrandedEmailShell({
    accentColor: '#059669',
    badgeText: 'Step 3 · Union Committee Approved',
    heading: title,
    subheading: `${canonUnion || proposal.union} (${unionAcronym})`,
    metaRows: [
      { label: 'Committee Action #', value: approvalData.actionNumber },
      { label: 'Action Date', value: approvalData.actionDate },
      { label: 'Certified By', value: `${approvalData.approvedBy} (${approvalData.approvedByRole || 'Union Officer'})` },
      { label: 'Requested Budget', value: `US$${totalRequested.toLocaleString()}` },
    ],
    bodyHtml,
    ctaLabel: 'Open Proposal in OneVoice27',
    ctaUrl: url,
  });

  const text = [
    `STEP 3 UNION COMMITTEE APPROVED — ${title} (${unionAcronym})`,
    `Committee Action #: ${approvalData.actionNumber}`,
    `Action Date: ${approvalData.actionDate}`,
    `Certified By: ${approvalData.approvedBy}`,
    `Requested Budget: US$${totalRequested.toLocaleString()}`,
    approvalData.minutesExcerpt?.trim()
      ? `Minutes Excerpt: ${approvalData.minutesExcerpt.trim()}`
      : '',
    '',
    `This proposal is now ready for Step 4 · Division Liaison Review & Vote.`,
    `Open proposal: ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export async function sendStep3ApprovalEmail({
  proposal,
  approvalData,
  actor,
  recipients,
}: {
  proposal: Proposal;
  approvalData: UnionCommitteeApproval;
  actor: UserAccount;
  recipients: EmailRecipient[];
}): Promise<EmailDispatchResult> {
  const { subject, html, text } = buildStep3ApprovalEmailContent({
    proposal,
    approvalData,
  });

  return postEmailDispatch({
    to: recipients.map((r) => r.email),
    replyTo: actor.email,
    subject,
    text,
    html,
    eventType: 'step3_approved',
    proposalId: proposal.id,
  });
}

function buildStep4LiaisonEmailContent({
  proposal,
  decision,
  actor,
  selectedDeficientCriteria,
  criterionInstructions,
  overallRemark,
  readinessRating,
  overrideReason,
}: {
  proposal: Proposal;
  decision: 'recommended' | 'revision_requested';
  actor: Pick<UserAccount, 'displayName' | 'email'>;
  selectedDeficientCriteria: ReviewCriterionKey[];
  criterionInstructions: Partial<Record<ReviewCriterionKey, string>>;
  overallRemark?: string;
  readinessRating: ReviewReadinessRating;
  overrideReason?: string;
}): { subject: string; html: string; text: string } {
  const canonUnion = getCanonicalUnion(proposal.union || '');
  const unionAcronym = UNION_ACRONYMS[canonUnion] || proposal.union || 'SSD';
  const title = proposal.title?.trim() || 'Untitled Proposal';
  const totalRequested = getProposalRequestedUsd(proposal);
  const url = getProposalAppUrl(proposal.id);
  const liaisonName = actor.displayName || actor.email.split('@')[0];
  const isRevision = decision === 'revision_requested';

  const frameworkEval = evaluateProposalReviewFramework(proposal);
  const actionItems =
    selectedDeficientCriteria.length > 0
      ? buildLiaisonActionItems(frameworkEval, selectedDeficientCriteria, criterionInstructions)
      : [];

  const subject = isRevision
    ? `[OneVoice27] Revision Requested: ${title} (${unionAcronym})`
    : `[OneVoice27] Step 4 Liaison Recommended: ${title} (${unionAcronym})`;

  const actionItemsHtml =
    actionItems.length > 0
      ? `<div style="margin-top:14px;padding:14px 16px;background-color:#fffbeb;border:1px solid #fcd34d;border-radius:10px;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#92400e;margin-bottom:8px;">
            7-Question SSD Rubric Action Items (${actionItems.length})
          </div>
          <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;color:#1e293b;">
            ${actionItems
              .map(
                (item) =>
                  `<li style="margin-bottom:6px;"><strong>Q${item.questionNumber}. ${escapeHtml(
                    item.sectionLabel
                  )}:</strong> ${escapeHtml(item.instruction)}</li>`
              )
              .join('')}
          </ul>
        </div>`
      : '';

  const remarkHtml = overallRemark?.trim()
    ? `<div style="margin-top:14px;padding:12px 14px;background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;font-size:13px;line-height:1.5;color:#1e293b;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;margin-bottom:4px;">Liaison Remarks</div>
        ${escapeHtml(overallRemark.trim())}
      </div>`
    : '';

  const overrideHtml =
    !isRevision && overrideReason?.trim()
      ? `<div style="margin-top:14px;padding:12px 14px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:12.5px;line-height:1.5;color:#78350f;">
          <strong>Flagged Suggestion Note:</strong> ${escapeHtml(overrideReason.trim())}
        </div>`
      : '';

  const reopenInstructionsHtml = isRevision
    ? `<div style="margin-top:16px;padding:12px 14px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:12.5px;line-height:1.55;color:#1e3a8a;">
        <strong>How to update this proposal:</strong> Because this proposal already has a Step 3 Union Action recorded, your <strong>Union Treasurer</strong> should open the proposal link below and click <strong>Reopen Review</strong> to unlock the form for editing, then re-approve once revised.
      </div>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 12px 0;font-size:13.5px;line-height:1.55;color:#334155;">
      ${
        isRevision
          ? `Division Liaison <strong>${escapeHtml(
              liaisonName
            )}</strong> reviewed this proposal and requested revisions before recommending it to the SSD OV27 Committee.`
          : `Division Liaison <strong>${escapeHtml(
              liaisonName
            )}</strong> completed the Step 4 review and voted to recommend this proposal to the SSD OV27 Committee (Step 5).`
      }
    </p>
    ${actionItemsHtml}
    ${remarkHtml}
    ${overrideHtml}
    ${reopenInstructionsHtml}
  `;

  const html = renderBrandedEmailShell({
    accentColor: isRevision ? '#d97706' : '#4f46e5',
    badgeText: isRevision ? 'Step 4 · Revision Requested' : 'Step 4 · Liaison Recommended',
    heading: title,
    subheading: `${canonUnion || proposal.union} (${unionAcronym})`,
    metaRows: [
      { label: 'Reviewing Liaison', value: `${liaisonName} (${actor.email})` },
      { label: 'Readiness Rating', value: REVIEW_READINESS_LABELS[readinessRating] || readinessRating },
      { label: 'Union Action #', value: proposal.unionApproval?.actionNumber || 'Recorded' },
      { label: 'Requested Budget', value: `US$${totalRequested.toLocaleString()}` },
    ],
    bodyHtml,
    ctaLabel: isRevision ? 'Open Proposal & Review Guidance' : 'Open Proposal in OneVoice27',
    ctaUrl: url,
    footerNote: `Reply directly to this email to reach ${liaisonName} (${actor.email}).`,
  });

  const text = [
    `${isRevision ? 'STEP 4 REVISION REQUESTED' : 'STEP 4 LIAISON RECOMMENDED'} — ${title} (${unionAcronym})`,
    `Reviewing Liaison: ${liaisonName} (${actor.email})`,
    `Readiness Rating: ${REVIEW_READINESS_LABELS[readinessRating] || readinessRating}`,
    `Requested Budget: US$${totalRequested.toLocaleString()}`,
    actionItems.length > 0
      ? `\nRubric Action Items:\n${actionItems
          .map((i) => `- Q${i.questionNumber} (${i.sectionLabel}): ${i.instruction}`)
          .join('\n')}`
      : '',
    overallRemark?.trim() ? `\nRemarks: ${overallRemark.trim()}` : '',
    isRevision
      ? `\nNext Step: Union Treasurer can click "Reopen Review" in the proposal sidebar to unlock the form for revisions.`
      : '',
    `\nOpen proposal: ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export async function sendStep4LiaisonEmail({
  proposal,
  decision,
  actor,
  recipients,
  selectedDeficientCriteria,
  criterionInstructions,
  overallRemark,
  readinessRating,
  overrideReason,
}: {
  proposal: Proposal;
  decision: 'recommended' | 'revision_requested';
  actor: UserAccount;
  recipients: EmailRecipient[];
  selectedDeficientCriteria: ReviewCriterionKey[];
  criterionInstructions: Partial<Record<ReviewCriterionKey, string>>;
  overallRemark?: string;
  readinessRating: ReviewReadinessRating;
  overrideReason?: string;
}): Promise<EmailDispatchResult> {
  const isRevision = decision === 'revision_requested';
  const { subject, html, text } = buildStep4LiaisonEmailContent({
    proposal,
    decision,
    actor,
    selectedDeficientCriteria,
    criterionInstructions,
    overallRemark,
    readinessRating,
    overrideReason,
  });

  return postEmailDispatch({
    to: recipients.map((r) => r.email),
    replyTo: actor.email,
    subject,
    text,
    html,
    eventType: isRevision ? 'step4_revision' : 'step4_recommended',
    proposalId: proposal.id,
  });
}

function buildStep5AuthorizationEmailContent({
  proposal,
  authorizationData,
}: {
  proposal: Proposal;
  authorizationData: DivisionTreasuryAuthorization;
}): { subject: string; html: string; text: string } {
  const canonUnion = getCanonicalUnion(proposal.union || '');
  const unionAcronym = UNION_ACRONYMS[canonUnion] || proposal.union || 'SSD';
  const title = proposal.title?.trim() || 'Untitled Proposal';
  const totalRequested = getProposalRequestedUsd(proposal);
  const url = getProposalAppUrl(proposal.id);
  const compositeCode = proposal.projectCode?.projectId
    ? proposal.projectCode.composite || formatCompositeProjectCode(proposal.projectCode)
    : 'Assigned upon sync';

  const subject = `[OneVoice27] Step 5 OV27 Authorized: ${title} (${
    proposal.projectCode?.projectId || unionAcronym
  })`;

  const remarksHtml = authorizationData.remarks?.trim()
    ? `<div style="margin-top:14px;padding:12px 14px;background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;font-size:13px;line-height:1.5;color:#064e3b;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#047857;margin-bottom:4px;">SSD OV27 Committee Remarks</div>
        ${escapeHtml(authorizationData.remarks.trim())}
      </div>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 12px 0;font-size:13.5px;line-height:1.55;color:#334155;">
      Congratulations! The <strong>SSD OV27 Committee</strong> has officially authorized this project in <strong>Step 5 of 5</strong>. Its GC Project Code is now locked and Step 6 Base Survey &amp; Evaluation tracking is unlocked.
    </p>
    ${remarksHtml}
  `;

  const html = renderBrandedEmailShell({
    accentColor: '#047857',
    badgeText: 'Step 5 · SSD OV27 Committee Authorized',
    heading: title,
    subheading: `${canonUnion || proposal.union} (${unionAcronym})`,
    metaRows: [
      { label: 'GC Project Code', value: compositeCode },
      { label: 'OV27 Committee Ref', value: authorizationData.referenceNumber || 'Authorized' },
      { label: 'Authorization Date', value: authorizationData.authorizedDate },
      { label: 'Step 3 Union Action', value: proposal.unionApproval?.actionNumber || 'Verified' },
      { label: 'Authorized Grant', value: `US$${totalRequested.toLocaleString()}` },
      { label: 'Authorizing Officer', value: `${authorizationData.authorizedBy} (${authorizationData.authorizedByRole})` },
    ],
    bodyHtml,
    ctaLabel: 'Open Authorized Project',
    ctaUrl: url,
  });

  const text = [
    `STEP 5 SSD OV27 COMMITTEE AUTHORIZED — ${title} (${unionAcronym})`,
    `GC Project Code: ${compositeCode}`,
    `OV27 Committee Ref: ${authorizationData.referenceNumber || 'Authorized'}`,
    `Authorization Date: ${authorizationData.authorizedDate}`,
    `Authorized Grant: US$${totalRequested.toLocaleString()}`,
    `Authorizing Officer: ${authorizationData.authorizedBy}`,
    authorizationData.remarks?.trim() ? `Remarks: ${authorizationData.remarks.trim()}` : '',
    '',
    `Step 6 Base Survey & Evaluation tracking is now unlocked.`,
    `Open project: ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export async function sendStep5AuthorizationEmail({
  proposal,
  authorizationData,
  actor,
  recipients,
}: {
  proposal: Proposal;
  authorizationData: DivisionTreasuryAuthorization;
  actor: UserAccount;
  recipients: EmailRecipient[];
}): Promise<EmailDispatchResult> {
  const { subject, html, text } = buildStep5AuthorizationEmailContent({
    proposal,
    authorizationData,
  });

  return postEmailDispatch({
    to: recipients.map((r) => r.email),
    replyTo: actor.email,
    subject,
    text,
    html,
    eventType: 'step5_authorized',
    proposalId: proposal.id,
  });
}

export type EmailTemplatePreviewKey =
  | 'step3_approved'
  | 'step4_revision'
  | 'step4_recommended'
  | 'step5_authorized';

export interface EmailTemplatePreviewData {
  key: EmailTemplatePreviewKey;
  shortLabel: string;
  label: string;
  triggerStep: string;
  defaultChecked: boolean;
  recipientsSummary: string;
  subject: string;
  html: string;
  text: string;
}

export const EMAIL_TEMPLATE_PREVIEW_KEYS: EmailTemplatePreviewKey[] = [
  'step3_approved',
  'step4_revision',
  'step4_recommended',
  'step5_authorized',
];

function createSampleProposalForPreview(): Proposal {
  return {
    id: 'sample-ov27-preview',
    createdAt: '2026-10-12T08:00:00.000Z',
    updatedAt: '2026-11-18T10:30:00.000Z',
    union: 'Southwestern Philippine Union Conference',
    status: 'approved',
    pointOfContact: {
      name: 'Pr. Junifer Colegado',
      email: 'poc.sample@adventist.asia',
      phone: '(907) 162-5081',
    },
    divisionLeadContact: {
      name: 'Pr. Junifer Colegado',
      email: 'unionlead.sample@adventist.asia',
      phone: '(907) 162-5081',
    },
    gcLiaison: {
      name: 'SSD Communication Liaison',
      email: 'liaison.sample@ssd.org',
      phone: '',
    },
    strategicFocus: 'Evangelism & Media Mission',
    divisionProject: 'Urban Center of Influence & Digital Harvest',
    title: 'Mindanao Urban Hope Media & Small Group Center',
    overview:
      'Equipping 18 local church digital evangelism teams with localized Cebuano Bible study series, community health screening clinics, and structured small-group follow-up.',
    goal: 'Establish sustainable digital-to-local-church discipleship hubs across Cagayan de Oro and Davao.',
    outcomes: '360 active Bible study enrollments and 12 community care groups launched in 2027.',
    kpiType: 'connection_next_steps',
    kpiNumber: '120',
    kpiDescription: '120 baptisms and 360 completed Bible discovery series by Q4 2027',
    kpiRationale: 'Grounded in 2025-2026 pilot campaign retention averages across urban centers.',
    hadSimilarProject2Years: 'yes',
    priorProjectMetric: 'Pilot campaign reached 94 baptisms in 2025.',
    deliverables: '18 media kits, 6 regional training workshops, and quarterly tracking reports.',
    targetAudiences: ['Young Adults (18-30)', 'Urban Professionals'],
    audienceEDetails: 'Secular urban residents and university students',
    pointsOfIntegration: 'Synchronized with SWPUC youth ministries and local pastor visitation teams.',
    budgetItems: [
      {
        id: 'b-1',
        activity: 'Regional Training Workshops & Local Follow-Up Teams',
        divisionFunding: 28500,
        localFunding: 5000,
      },
      {
        id: 'b-2',
        activity: 'Studio Audio-Visual Production & Localization',
        divisionFunding: 20000,
        localFunding: 3000,
      },
    ],
    unionApproval: {
      actionNumber: 'SWPUC-EX-2026-104',
      actionDate: '2026-11-12',
      approvedBy: 'Pr. Daniel Reyes',
      approvedByEmail: 'treasurer.sample@adventist.asia',
      approvedByRole: 'Union Treasurer',
      minutesExcerpt:
        'VOTED to endorse the Mindanao Urban Hope Media & Small Group Center to SSD OV27 with US$20,000 matching union commitment.',
      timestamp: '2026-11-12T09:15:00.000Z',
    },
    projectCode: {
      composite: 'SWPUC.2027.0142',
      orgId: 'SWPUC',
      projectId: '0142',
      phase: 'Planning',
      status: 'Active',
      locked: true,
    },
  };
}

export function buildEmailTemplatePreview(
  key: EmailTemplatePreviewKey,
  actorName?: string,
  actorEmail?: string
): EmailTemplatePreviewData {
  const sampleProposal = createSampleProposalForPreview();
  const displayActor = actorName?.trim() || 'Anthony Stanyer';
  const displayEmail = actorEmail?.trim() || 'astanyer@adventist.asia';

  if (key === 'step3_approved') {
    const content = buildStep3ApprovalEmailContent({
      proposal: sampleProposal,
      approvalData: sampleProposal.unionApproval!,
    });
    return {
      key,
      shortLabel: 'Step 3 · Approved',
      label: 'Step 3 · Union Committee Approval',
      triggerStep: 'Triggered when a Union Officer certifies Step 3 Approval',
      defaultChecked: true,
      recipientsSummary: 'Assigned Division Liaisons + Point of Contact / Owner + Union Lead',
      ...content,
    };
  }

  if (key === 'step4_revision') {
    const content = buildStep4LiaisonEmailContent({
      proposal: sampleProposal,
      decision: 'revision_requested',
      actor: { displayName: displayActor, email: displayEmail },
      selectedDeficientCriteria: ['q3_input', 'q5_output'],
      criterionInstructions: {
        q3_input:
          'Clarify how the US$20,000 media equipment line will remain property of the local mission after 2027.',
        q5_output:
          'Break down the 120-baptism target per quarter so Step 6 progress tracking can measure milestones.',
      },
      overallRemark:
        'Strong evangelistic focus overall. Please update the equipment ownership note and quarterly KPI milestones so we can recommend this at the next OV27 docket.',
      readinessRating: 'needs_improvement',
    });
    return {
      key,
      shortLabel: 'Step 4 · Revision',
      label: 'Step 4 · Liaison Request for Revision',
      triggerStep: 'Triggered when a Division Liaison votes Request Revision in Step 4',
      defaultChecked: true,
      recipientsSummary: 'Point of Contact / Owner + Union Lead + Union Treasurers & Coordinators',
      ...content,
    };
  }

  if (key === 'step4_recommended') {
    const content = buildStep4LiaisonEmailContent({
      proposal: sampleProposal,
      decision: 'recommended',
      actor: { displayName: displayActor, email: displayEmail },
      selectedDeficientCriteria: [],
      criterionInstructions: {},
      overallRemark:
        'All 7 review framework criteria verified cleanly. Budget aligns well with Proclamation & Follow-up outcomes.',
      readinessRating: 'meeting_requirement',
    });
    return {
      key,
      shortLabel: 'Step 4 · Recommend',
      label: 'Step 4 · Liaison Recommend Vote (Opt-In)',
      triggerStep: 'Optional toggle when a Division Liaison votes Recommend in Step 4',
      defaultChecked: false,
      recipientsSummary: 'Point of Contact / Owner + Union Lead + Union Treasurers & Coordinators',
      ...content,
    };
  }

  const content = buildStep5AuthorizationEmailContent({
    proposal: sampleProposal,
    authorizationData: {
      authorized: true,
      referenceNumber: 'SSD-OV27-2026-089',
      authorizedDate: '2026-11-19',
      authorizedBy: displayActor,
      authorizedByEmail: displayEmail,
      authorizedByRole: 'SSD OV27 Committee Secretary',
      remarks:
        'Authorized for 2027 funding tranche. Please submit Step 6 Baseline Survey within 30 days of launch.',
      timestamp: '2026-11-19T02:45:00.000Z',
    },
  });

  return {
    key: 'step5_authorized',
    shortLabel: 'Step 5 · Authorized',
    label: 'Step 5 · SSD OV27 Committee Authorization',
    triggerStep: 'Triggered when Super Admin authorizes the project in Step 5',
    defaultChecked: true,
    recipientsSummary:
      'Point of Contact / Owner + Union Lead + Union Officers + Assigned Liaisons',
    ...content,
  };
}

export async function sendSampleTemplateEmail({
  templateKey,
  toEmail,
  actorName,
}: {
  templateKey: EmailTemplatePreviewKey;
  toEmail: string;
  actorName?: string;
}): Promise<EmailDispatchResult> {
  const cleanEmail = (toEmail || '').trim();
  if (!cleanEmail || !VALID_EMAIL_RE.test(cleanEmail)) {
    return { ok: false, error: 'A valid recipient email address is required.' };
  }

  const preview = buildEmailTemplatePreview(templateKey, actorName, cleanEmail);

  return postEmailDispatch({
    to: [cleanEmail],
    replyTo: cleanEmail,
    subject: `[SAMPLE] ${preview.subject}`,
    text: `*** SAMPLE TEMPLATE PREVIEW (sent only to ${cleanEmail}) ***\n\n${preview.text}`,
    html: preview.html,
    eventType: 'test_self',
    bypassRolePreviewCheck: true,
  });
}

export async function sendTestEmailNotification({
  toEmail,
  actorName,
}: {
  toEmail: string;
  actorName?: string;
}): Promise<EmailDispatchResult> {
  const cleanEmail = (toEmail || '').trim();
  if (!cleanEmail || !VALID_EMAIL_RE.test(cleanEmail)) {
    return { ok: false, error: 'A valid recipient email address is required.' };
  }

  const appUrl = getProposalAppUrl();
  const timestamp = new Date().toLocaleString();
  const subject = '[OneVoice27] Test Email Notification — Connection Verified';

  const html = renderBrandedEmailShell({
    accentColor: '#059669',
    badgeText: 'Email Service Verification',
    heading: 'OneVoice27 Email Notifications Ready',
    subheading: 'Google Workspace Apps Script Relay Active',
    metaRows: [
      { label: 'Test Recipient', value: cleanEmail },
      { label: 'Triggered By', value: actorName || cleanEmail },
      { label: 'Verified At', value: timestamp },
    ],
    bodyHtml: `<p style="margin:0;font-size:13.5px;line-height:1.55;color:#334155;">
      Your <strong>SSD OneVoice27 Proposal Portal</strong> is successfully connected to your Google Workspace email sender. Automated notifications for <strong>Step 3 Approvals</strong>, <strong>Step 4 Revision Requests</strong>, and <strong>Step 5 OV27 Authorizations</strong> are ready to use.
    </p>`,
    ctaLabel: 'Return to OneVoice27 Portal',
    ctaUrl: appUrl,
  });

  const text = [
    'OneVoice27 Email Notifications Ready',
    `Test Recipient: ${cleanEmail}`,
    `Triggered By: ${actorName || cleanEmail}`,
    `Verified At: ${timestamp}`,
    '',
    `Portal URL: ${appUrl}`,
  ].join('\n');

  return postEmailDispatch({
    to: [cleanEmail],
    replyTo: cleanEmail,
    subject,
    text,
    html,
    eventType: 'test_self',
    bypassRolePreviewCheck: true,
  });
}
