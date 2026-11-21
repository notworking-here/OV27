import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  RotateCcw,
  Flag,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import {
  Proposal,
  UserAccount,
  DivisionTreasuryAuthorization,
  getCanonicalDivisionProject,
  isKpiAlignedWithObjective,
  getProposalStepStatus,
  isSuperAdminEmail,
  REVIEW_READINESS_LABELS,
} from '../types';
import { getAllProposalSmartAdvisories } from '../utils/proposalSmartAdvisor';
import { evaluateProposalReviewFramework } from '../utils/projectReviewFramework';
import { formatCurrency } from '../utils/userUtils';
import {
  formatCompositeProjectCode,
  getUnionProjectAcronym,
} from '../utils/externalProposalCodec';
import { EmailNotificationToggleCard } from './proposal/EmailNotificationToggleCard';
import {
  EmailRecipient,
  sendStep5AuthorizationEmail,
} from '../services/emailNotificationService';

interface DivisionAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal;
  currentUser: UserAccount;
  assignedLiaisons?: UserAccount[];
  onConfirmAuthorization: (
    proposalId: string,
    authorizationData: DivisionTreasuryAuthorization | null
  ) => Promise<void> | void;
}

export function DivisionAuthorizationModal({
  isOpen,
  onClose,
  proposal,
  currentUser,
  assignedLiaisons = [],
  onConfirmAuthorization,
}: DivisionAuthorizationModalProps) {
  const existing = proposal.divisionApproval;
  const isAlreadyAuthorized = Boolean(existing?.authorized);
  const isSuperAdmin =
    currentUser.role === 'super_admin' || isSuperAdminEmail(currentUser.email);

  const stepStatus = useMemo(
    () => getProposalStepStatus(proposal, assignedLiaisons),
    [proposal, assignedLiaisons]
  );
  const allLiaisonsVoted = stepStatus.liaisonSummary.allLiaisonsVoted;
  const requiresLiaisonOverride = !allLiaisonsVoted;

  const [authorizedDate, setAuthorizedDate] = useState(
    existing?.authorizedDate || new Date().toISOString().split('T')[0]
  );
  const [referenceNumber, setReferenceNumber] = useState(
    existing?.referenceNumber || ''
  );
  const [remarks, setRemarks] = useState(existing?.remarks || '');
  const [liaisonOverrideChecked, setLiaisonOverrideChecked] = useState(
    Boolean(existing?.liaisonOverride)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendEmailAlert, setSendEmailAlert] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);

  const accountName = currentUser.displayName || currentUser.email.split('@')[0];
  const accountRole =
    currentUser.role === 'treasurer'
      ? 'Division Treasurer'
      : isSuperAdmin
      ? 'Division Administrator'
      : 'Division Officer';

  useEffect(() => {
    if (isOpen) {
      if (proposal.divisionApproval) {
        setAuthorizedDate(
          proposal.divisionApproval.authorizedDate ||
            new Date().toISOString().split('T')[0]
        );
        setReferenceNumber(proposal.divisionApproval.referenceNumber || '');
        setRemarks(proposal.divisionApproval.remarks || '');
        setLiaisonOverrideChecked(Boolean(proposal.divisionApproval.liaisonOverride));
      } else {
        setAuthorizedDate(new Date().toISOString().split('T')[0]);
        setReferenceNumber('');
        setRemarks('');
        setLiaisonOverrideChecked(false);
      }
      setErrorMsg(null);
    }
  }, [isOpen, proposal]);

  // Compute any active alignment flags for auditor awareness
  const auditFlags = useMemo(() => {
    const flags: string[] = [];
    const canonicalGoal = getCanonicalDivisionProject(proposal.divisionProject);
    const isMisaligned = Boolean(
      (canonicalGoal || proposal.divisionProject) &&
        proposal.kpiType &&
        !isKpiAlignedWithObjective(canonicalGoal || proposal.divisionProject, proposal.kpiType)
    );
    if (isMisaligned) {
      flags.push(
        `Strategic Misalignment: Primary KPI does not match ${canonicalGoal || proposal.divisionProject}`
      );
    }
    const advisories = getAllProposalSmartAdvisories(proposal);
    for (const adv of advisories) {
      if (isMisaligned && adv.id.startsWith('kpi_misaligned')) continue;
      flags.push(adv.title);
    }
    return flags;
  }, [proposal]);

  const frameworkEval = useMemo(
    () => evaluateProposalReviewFramework(proposal),
    [proposal]
  );

  if (!isOpen) return null;

  const totalRequested = (proposal.budgetItems || []).reduce(
    (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );

  const hasUnionAction = Boolean(proposal.unionApproval?.actionNumber);
  const canProceedWithStep4 =
    allLiaisonsVoted || (isSuperAdmin && liaisonOverrideChecked);

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasUnionAction) {
      setErrorMsg(
        'Cannot authorize project: Step 3 Union Committee Action number must be recorded first.'
      );
      return;
    }
    if (!allLiaisonsVoted) {
      if (!isSuperAdmin) {
        setErrorMsg(
          'Cannot authorize project: All assigned Division Liaisons must vote in Step 4 before Step 5 authorization.'
        );
        return;
      }
      if (!liaisonOverrideChecked) {
        setErrorMsg(
          'Please check the Super Admin Step 4 Override box to record that you are authorizing without a Division Liaison vote.'
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const overrideReasonText =
      stepStatus.liaisonSummary.assignedCount === 0
        ? `No Division Liaison assigned to ${proposal.union} — overridden by ${accountName} (${currentUser.email})`
        : `Step 4 Liaison vote overridden (${stepStatus.liaisonSummary.votedAssignedCount}/${stepStatus.liaisonSummary.assignedCount} voted) by ${accountName} (${currentUser.email})`;

    const authPayload: DivisionTreasuryAuthorization = {
      authorized: true,
      authorizedBy: existing?.authorizedBy || accountName,
      authorizedByEmail: existing?.authorizedByEmail || currentUser.email,
      authorizedByRole: existing?.authorizedByRole || accountRole,
      authorizedDate: authorizedDate || new Date().toISOString().split('T')[0],
      ...(referenceNumber.trim() ? { referenceNumber: referenceNumber.trim() } : {}),
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      ...(requiresLiaisonOverride
        ? {
            liaisonOverride: true,
            liaisonOverrideReason: existing?.liaisonOverrideReason || overrideReasonText,
          }
        : {}),
      timestamp: new Date().toISOString(),
    };

    try {
      await onConfirmAuthorization(proposal.id, authPayload);
      if (sendEmailAlert && emailRecipients.length > 0) {
        try {
          await sendStep5AuthorizationEmail({
            proposal,
            authorizationData: authPayload,
            actor: currentUser,
            recipients: emailRecipients,
          });
        } catch (emailErr) {
          console.warn('Non-blocking Step 5 email dispatch notice:', emailErr);
        }
      }
      onClose();
    } catch (err) {
      console.error('Failed to record Division Treasury authorization:', err);
      setErrorMsg(
        err instanceof Error
          ? `Could not save authorization: ${err.message}`
          : 'Failed to save authorization to cloud database.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirmAuthorization(proposal.id, null);
      onClose();
    } catch (err) {
      console.error('Failed to revoke Division authorization:', err);
      setErrorMsg(
        err instanceof Error
          ? `Could not revoke authorization: ${err.message}`
          : 'Failed to update authorization status.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#182747] to-[#1c398e] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Step 5 · SSD OV27 Committee</span>
                {isAlreadyAuthorized && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                    Authorized ✓
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-blue-200">
                Step 5 of 5: Certify &amp; Authorize as an Official OneVoice27 Division Project
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleAuthorize} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Proposal & Amount Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                {proposal.union}
              </span>
              <h4 className="font-bold text-slate-900 truncate text-sm">
                {proposal.title || 'Untitled Proposal'}
              </h4>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Union-Voted Budget
              </span>
              <span className="text-base font-black text-emerald-700 tabular-nums">
                US${formatCurrency(totalRequested)}
              </span>
            </div>
          </div>

          {/* Step 3 Prerequisite Audit Check: Union Committee Vote */}
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#1c398e] flex items-center justify-center shrink-0 mt-0.5">
                <FileCheck2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e] block">
                  Step 3 Verified · Union Committee Vote
                </span>
                <p className="font-bold text-slate-900 mt-0.5">
                  Action #{proposal.unionApproval?.actionNumber || 'Pending'}{' '}
                  {proposal.unionApproval?.actionDate && (
                    <span className="font-medium text-slate-500">
                      · Voted {proposal.unionApproval.actionDate}
                    </span>
                  )}
                </p>
                {proposal.unionApproval?.approvedBy && (
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Certified by {proposal.unionApproval.approvedBy} (
                    {proposal.unionApproval.approvedByRole || 'Union Officer'})
                  </p>
                )}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-[#1c398e] border border-blue-300 shrink-0">
              Step 3 ✓
            </span>
          </div>

          {/* Step 4 Prerequisite Audit Check: Division Liaison Review & Votes */}
          {(() => {
            const votes = proposal.liaisonVotes || [];
            const { assignedCount, votedAssignedCount, hasRevisionRequested } =
              stepStatus.liaisonSummary;
            return (
              <div
                className={`p-3.5 rounded-xl border flex flex-col gap-2.5 text-xs ${
                  allLiaisonsVoted
                    ? 'bg-indigo-50/70 border-indigo-200/90'
                    : liaisonOverrideChecked
                    ? 'bg-amber-50/90 border-amber-400'
                    : 'bg-rose-50/70 border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-950">
                    Step 4 Prerequisite · Division Liaison Review &amp; Vote
                  </span>
                  {allLiaisonsVoted ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300">
                      {stepStatus.liaisonSummary.progressLabel}
                    </span>
                  ) : liaisonOverrideChecked ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-950 border border-amber-400">
                      Super Admin Override Active
                    </span>
                  ) : hasRevisionRequested ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                      Revision Requested
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300">
                      {assignedCount > 0
                        ? `${votedAssignedCount}/${assignedCount} Liaisons Voted`
                        : 'No Liaison Vote Recorded'}
                    </span>
                  )}
                </div>

                {votes.length > 0 ? (
                  <div className="space-y-1.5 pt-1 border-t border-indigo-200/50">
                    {votes.map((v, idx) => (
                      <div
                        key={v.liaisonUid || v.liaisonEmail || idx}
                        className="text-[11px] text-slate-700"
                      >
                        <span className="font-bold text-slate-900">{v.liaisonName}</span>{' '}
                        <span
                          className={`font-bold ${
                            v.vote === 'recommended' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          ({v.vote === 'recommended' ? 'Voted & Recommended ✓' : 'Revision Requested'})
                        </span>
                        {v.readinessRating && (
                          <span className="text-slate-600 font-semibold">
                            {' '}
                            · {REVIEW_READINESS_LABELS[v.readinessRating]}
                          </span>
                        )}
                        {v.confirmedReviewedAndAssisted && (
                          <span className="text-emerald-700 font-semibold">
                            {' '}
                            · Reviewed &amp; assisted Union ✓
                          </span>
                        )}
                        {v.recommendation && (
                          <p className="italic text-slate-600 mt-0.5">"{v.recommendation}"</p>
                        )}
                        {v.remainingFlagsOverrideReason && (
                          <p className="text-[10.5px] text-amber-950 bg-amber-50/90 border border-amber-200/80 rounded-md px-2 py-1 mt-1">
                            <span className="font-bold">Flagged items rationale: </span>
                            {v.remainingFlagsOverrideReason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-700 leading-snug">
                    {assignedCount > 0
                      ? `This Union has ${assignedCount} assigned Division ${
                          assignedCount === 1 ? 'Liaison' : 'Liaisons'
                        } (${assignedLiaisons
                          .map((u) => u.displayName || u.email)
                          .join(', ')}), and ${votedAssignedCount} of ${assignedCount} have voted so far.`
                      : `No Division Liaison has registered or voted for ${proposal.union} yet.`}
                  </p>
                )}

                {/* Super Admin Override Checkbox when Step 4 is not yet satisfied */}
                {!allLiaisonsVoted && (
                  <div className="pt-2 border-t border-slate-200/80">
                    {isSuperAdmin ? (
                      <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-amber-300 hover:border-amber-400 cursor-pointer transition shadow-2xs">
                        <input
                          type="checkbox"
                          checked={liaisonOverrideChecked}
                          onChange={(e) => {
                            setLiaisonOverrideChecked(e.target.checked);
                            if (e.target.checked) setErrorMsg(null);
                          }}
                          className="mt-0.5 w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                        />
                        <div className="text-[11px] leading-snug">
                          <span className="font-extrabold text-amber-950 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              Super Admin Override: Authorize without Step 4 Liaison Vote
                            </span>
                          </span>
                          <p className="text-slate-600 mt-0.5">
                            Check this box to bypass Step 4 (e.g., when a Union does not have a
                            Liaison signed in yet) and permanently record this override in the
                            proposal's audit trail.
                          </p>
                        </div>
                      </label>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-white border border-rose-200 flex items-start gap-2 text-[11px] text-rose-900">
                        <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Step 5 Locked:</strong> All assigned Division Liaisons must cast
                          their Step 4 vote before SSD OV27 Committee authorization (or a Super Admin
                          must record an explicit Step 4 Override).
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* SSD Review Framework & Fiscal Alignment Summary */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-extrabold text-slate-800">
                SSD Review Framework · {frameworkEval.subTypeMeta.shortLabel}
              </span>
              <span
                className={`font-extrabold tabular-nums ${
                  frameworkEval.effectiveRating === 'meeting_requirement'
                    ? 'text-emerald-700'
                    : frameworkEval.effectiveRating === 'needs_improvement'
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {frameworkEval.effectiveRatingLabel} ({frameworkEval.adequateCount}/7)
                {frameworkEval.hasSplitLiaisonVerdict ? ' · Split Verdict' : ''}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
              <span
                className={
                  frameworkEval.budgetConcordance.isAligned
                    ? 'text-emerald-700 font-semibold'
                    : 'text-amber-800 font-semibold'
                }
              >
                {frameworkEval.budgetConcordance.isAligned
                  ? 'Budget & Pillar Aligned'
                  : frameworkEval.budgetConcordance.summaryLabel}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span>
                Stage: <strong className="text-slate-800">{frameworkEval.principalStageLabel}</strong>
              </span>
              {frameworkEval.serviceSafeguard.isCommunityServiceDetected && (
                <>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span
                    className={
                      frameworkEval.serviceSafeguard.hasUnconditionalAndConsentSafeguard
                        ? 'text-emerald-700 font-semibold'
                        : 'text-amber-800 font-semibold'
                    }
                  >
                    {frameworkEval.serviceSafeguard.hasUnconditionalAndConsentSafeguard
                      ? 'Unconditional Service ✓'
                      : 'Check Unconditional Service Safeguard'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Auditor Flag Notice (if any flags exist) */}
          {auditFlags.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Flag className="w-3.5 h-3.5 text-amber-700 fill-amber-500/30 shrink-0" />
                <span>
                  Auditor Notice: {auditFlags.length}{' '}
                  {auditFlags.length === 1 ? 'Alignment Flag' : 'Alignment Flags'} Detected
                </span>
              </div>
              <ul className="list-disc pl-4 text-[11px] text-amber-800 space-y-0.5">
                {auditFlags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 5 Inputs: Authorization Date & Optional OV27 Committee Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Authorization Date *
              </label>
              <input
                type="date"
                required
                value={authorizedDate}
                onChange={(e) => setAuthorizedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-blue-500 text-xs font-semibold text-slate-800 outline-none transition"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>OV27 Committee Ref / Code</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional</span>
              </label>
              <input
                type="text"
                placeholder="e.g. SSD-OV27-014"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-xs font-bold text-slate-900 outline-none transition"
              />
            </div>
          </div>

          {/* Certifying Division Official (Auto-Tied to Account) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Authorizing SSD OV27 Committee Officer (Tied to Account)
              </span>
              <p className="font-semibold text-slate-800 truncate">
                {existing?.authorizedBy || accountName}{' '}
                <span className="text-slate-500 font-normal">
                  ({existing?.authorizedByRole || accountRole})
                </span>
              </p>
              <span className="text-[11px] text-slate-500 truncate block">
                {existing?.authorizedByEmail || currentUser.email}
              </span>
            </div>
          </div>

          {/* Optional OV27 Committee Remarks */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>SSD OV27 Committee Remarks</span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Authorized by SSD OV27 Committee against Union allocation cap..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 focus:border-blue-500 text-xs text-slate-800 outline-none transition resize-none"
            />
          </div>

          {/* GC Project Code Lock & API Sync Preview */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                GC Project Code &amp; Lifecycle Initialization
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-800">
                {proposal.projectCode?.projectId
                  ? formatCompositeProjectCode({
                      orgId: proposal.projectCode.orgId || 'AT1111',
                      projectId: proposal.projectCode.projectId,
                      phase: proposal.projectCode.phase || 'Planning',
                      status: proposal.projectCode.status || 'Active',
                    })
                  : `${proposal.projectCode?.orgId || 'AT1111'} - OVSSD${getUnionProjectAcronym(proposal.union)}### - ${
                      proposal.projectCode?.phase || 'Planning'
                    } - ${proposal.projectCode?.status || 'Active'}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              {proposal.projectCode?.projectId
                ? `Authorizing locks OrgID (${proposal.projectCode.orgId || 'AT1111'}) and Project ID (${proposal.projectCode.projectId}), initializes Lifecycle to Planning · Active, unlocks Step 6 Evaluation, and enables GC External API sync.`
                : `Authorizing atomically allocates the next sequential OVSSD${getUnionProjectAcronym(
                    proposal.union
                  )}### Project ID, locks the Project Code, sets Phase to Planning and Status to Active, unlocks Step 6 Evaluation, and enables GC External API sync.`}
            </p>
          </div>

          {/* Confirmation Notice */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700">
              <span className="font-bold text-slate-900 block">
                Step 5 · SSD OV27 Committee Authorization
              </span>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                Authorizing this proposal completes <strong>Step 5 of 5</strong>, stamps it as an{' '}
                <strong>SSD OV27 Authorized Project ✓</strong>, unlocks Step 6 Base Survey &amp; GC API sync,
                and notifies the Union Treasurer, Union Coordinator, and Project Author.
              </p>
            </div>
          </div>

          {/* Optional Email Notification Toggle & Recipient Preview */}
          <EmailNotificationToggleCard
            isOpen={isOpen && hasUnionAction && canProceedWithStep4}
            eventType="step5_authorized"
            proposal={proposal}
            actor={currentUser}
            checked={sendEmailAlert}
            onChangeChecked={setSendEmailAlert}
            onRecipientsResolved={(list) => setEmailRecipients(list)}
          />

          {/* Footer Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2.5 flex-wrap">
            {isAlreadyAuthorized ? (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition cursor-pointer"
                title="Return project to Step 4 / Pending OV27 Committee Authorization status"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revoke Authorization</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !hasUnionAction || !canProceedWithStep4}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-xs cursor-pointer"
                title={
                  !canProceedWithStep4
                    ? isSuperAdmin
                      ? 'Check the Super Admin Step 4 Override box above to authorize without Liaison votes'
                      : 'All assigned Division Liaisons must vote in Step 4 before Step 5 authorization'
                    : 'Certify & Authorize Step 5'
                }
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Saving...'
                    : isAlreadyAuthorized
                    ? 'Update Step 5 Auth'
                    : requiresLiaisonOverride && liaisonOverrideChecked
                    ? 'Authorize with Step 4 Override'
                    : 'Authorize (Step 5 · OV27 Committee)'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

