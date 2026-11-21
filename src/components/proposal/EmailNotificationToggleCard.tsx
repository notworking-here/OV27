import React, { useEffect, useState } from 'react';
import { Mail, ShieldAlert, Info, Users, Loader2, AlertTriangle } from 'lucide-react';
import { Proposal, UserAccount } from '../../types';
import {
  EmailRecipient,
  EmailServiceStatus,
  fetchEmailServiceStatus,
  getIsEmailRolePreviewActive,
  resolveProposalEmailRecipients,
} from '../../services/emailNotificationService';

export interface EmailNotificationToggleCardProps {
  isOpen: boolean;
  eventType: 'step3_approved' | 'step4_revision' | 'step4_recommended' | 'step5_authorized';
  proposal: Proposal;
  actor: UserAccount | null | undefined;
  checked: boolean;
  onChangeChecked: (next: boolean) => void;
  onRecipientsResolved?: (recipients: EmailRecipient[], status: EmailServiceStatus) => void;
}

export function EmailNotificationToggleCard({
  isOpen,
  eventType,
  proposal,
  actor,
  checked,
  onChangeChecked,
  onRecipientsResolved,
}: EmailNotificationToggleCardProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<EmailServiceStatus>({
    configured: false,
    hasWebhookUrl: false,
    hasWebhookSecret: false,
  });
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const isRolePreview = getIsEmailRolePreviewActive();

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetchEmailServiceStatus(),
      resolveProposalEmailRecipients(eventType, proposal, actor),
    ])
      .then(([svcStatus, resolvedRecipients]) => {
        if (!mounted) return;
        setStatus(svcStatus);
        setRecipients(resolvedRecipients);
        onRecipientsResolved?.(resolvedRecipients, svcStatus);

        const quotaExhausted =
          Boolean(svcStatus.quota?.quotaExhausted) ||
          svcStatus.quota?.remainingQuota === 0;

        if (
          isRolePreview ||
          !svcStatus.configured ||
          resolvedRecipients.length === 0 ||
          quotaExhausted
        ) {
          onChangeChecked(false);
        } else {
          const saverActive =
            Boolean(svcStatus.quota?.essentialOnlyMode) ||
            Boolean(svcStatus.quota?.isLowQuota);
          if (saverActive) {
            // In Quota-Saver or low-quota mode, keep only Step 4 Revision and Step 5 Authorization ON by default
            onChangeChecked(
              eventType === 'step4_revision' || eventType === 'step5_authorized'
            );
          } else {
            // Standard mode: ON for Approvals & Revision Requests; opt-in for routine Step 4 Recommend votes
            onChangeChecked(eventType !== 'step4_recommended');
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, eventType, proposal.id, actor?.email, isRolePreview]);

  if (!isOpen) return null;

  if (isRolePreview) {
    return (
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-[11px] text-amber-900">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Role Preview Active — Email Dispatch Paused</span>
          <p className="text-amber-800 mt-0.5 leading-snug">
            Automated emails to real Union &amp; proposal contacts are disabled while testing roles.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
        <span>Checking email notification recipients &amp; daily quota...</span>
      </div>
    );
  }

  if (!status.configured) {
    return (
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-[11px] text-slate-600">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-700 block">
            Email Notifications Not Active Yet
          </span>
          <p className="text-slate-500 mt-0.5 leading-snug">
            Save <code className="font-mono text-[10px]">EMAIL_WEBHOOK_URL</code> and{' '}
            <code className="font-mono text-[10px]">EMAIL_WEBHOOK_SECRET</code> in AI Studio Secrets
            to enable email alerts (in-app notifications still send normally).
          </p>
        </div>
      </div>
    );
  }

  const quota = status.quota;
  const quotaExhausted =
    Boolean(quota?.quotaExhausted) || quota?.remainingQuota === 0;

  if (quotaExhausted) {
    return (
      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-[11px] text-rose-900">
        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">
            Daily Email Limit Reached (0 of {quota?.dailyLimit.toLocaleString() || '1,500'} left today)
          </span>
          <p className="text-rose-800 mt-0.5 leading-snug">
            Google&apos;s daily sending quota is maxed out for today, so email sending is safely
            paused until Google&apos;s daily reset. Your approval/vote and in-app bell
            notifications still save normally.
          </p>
        </div>
      </div>
    );
  }

  const saverActive = Boolean(quota?.essentialOnlyMode) || Boolean(quota?.isLowQuota);

  return (
    <div
      className={`p-3 rounded-xl border transition space-y-2 ${
        checked
          ? 'bg-blue-50/70 border-blue-200'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          disabled={recipients.length === 0}
          onChange={(e) => onChangeChecked(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500 cursor-pointer shrink-0 disabled:opacity-40"
        />
        <div className="flex-1 min-w-0 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>
                Also send email notification{' '}
                <span className="text-slate-500 font-semibold tabular-nums">
                  ({recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'})
                </span>
              </span>
            </span>
            {quota && recipients.length > 0 && (
              <span
                className={`text-[10px] font-semibold tabular-nums ${
                  quota.isLowQuota ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                uses {recipients.length} of {quota.remainingQuota.toLocaleString()} left today
              </span>
            )}
          </div>
          {recipients.length === 0 && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              No external recipient emails found for this proposal (acting account is excluded).
            </p>
          )}
          {saverActive && recipients.length > 0 && !checked && (
            <p className="text-[10.5px] text-amber-800 mt-0.5">
              Defaulted OFF by {quota?.essentialOnlyMode ? 'Quota-Saver mode' : 'low daily quota'}{' '}
              — check above if you want to send this notice.
            </p>
          )}
        </div>
      </label>

      {recipients.length > 0 && checked && (
        <div className="pl-6 space-y-1">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Users className="w-3 h-3 text-slate-400" />
            <span>Recipients</span>
          </div>
          <ul className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
            {recipients.map((r) => (
              <li
                key={r.email.toLowerCase()}
                className="text-[11px] text-slate-700 flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  <strong className="text-slate-900">{r.name}</strong>{' '}
                  <span className="text-slate-500">({r.email})</span>
                </span>
                <span className="text-[10px] font-semibold text-blue-800 shrink-0">
                  {r.roleLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
