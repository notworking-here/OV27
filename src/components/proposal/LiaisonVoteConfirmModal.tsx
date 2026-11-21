import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRightLeft,
} from 'lucide-react';
import { Proposal, ReviewCriterionKey, UserAccount, UNION_ACRONYMS, getCanonicalUnion } from '../../types';
import { formatCurrency } from '../../utils/userUtils';
import { ProposalReviewFrameworkEvaluation } from '../../utils/projectReviewFramework';
import { SystemAlignmentFlagSummary, LiaisonVoteConfirmPayload } from './useLiaisonReviewState';
import { EmailNotificationToggleCard } from './EmailNotificationToggleCard';
import {
  EmailRecipient,
  sendStep4LiaisonEmail,
} from '../../services/emailNotificationService';

const QUICK_OVERRIDE_REASONS = [
  'Clarified directly with the Union coordinator — ready to proceed as submitted.',
  'Approved due to local Union context — remaining suggestion is intentionally left as-is.',
  'Automated system suggestion does not apply to this specific proposal.',
];

export interface LiaisonVoteConfirmModalProps {
  isOpen: boolean;
  initialDecision: 'recommended' | 'revision_requested';
  proposal: Proposal;
  currentUser?: UserAccount | null;
  frameworkEval: ProposalReviewFrameworkEvaluation;
  selectedDeficientCriteria: ReviewCriterionKey[];
  criterionInstructions: Partial<Record<ReviewCriterionKey, string>>;
  systemAlignmentFlags: SystemAlignmentFlagSummary[];
  overallRemark: string;
  onChangeOverallRemark: (val: string) => void;
  initialOverrideReason?: string;
  isSubmitting: boolean;
  externalError?: string | null;
  onClose: () => void;
  onConfirm: (
    decision: 'recommended' | 'revision_requested',
    payload: LiaisonVoteConfirmPayload
  ) => Promise<boolean>;
}

export function LiaisonVoteConfirmModal({
  isOpen,
  initialDecision,
  proposal,
  currentUser,
  frameworkEval,
  selectedDeficientCriteria,
  criterionInstructions,
  systemAlignmentFlags,
  overallRemark,
  onChangeOverallRemark,
  initialOverrideReason = '',
  isSubmitting,
  externalError,
  onClose,
  onConfirm,
}: LiaisonVoteConfirmModalProps) {
  const [decision, setDecision] = useState<'recommended' | 'revision_requested'>(initialDecision);
  const [confirmedAttestation, setConfirmedAttestation] = useState(false);
  const [overrideReason, setOverrideReason] = useState(initialOverrideReason);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sendEmailAlert, setSendEmailAlert] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDecision(initialDecision);
      setConfirmedAttestation(false);
      setOverrideReason(initialOverrideReason || '');
      setLocalError(null);
    }
  }, [isOpen, initialDecision, initialOverrideReason, proposal.id]);

  if (!isOpen) return null;

  const canonicalUnion = getCanonicalUnion(proposal.union || '');
  const unionAcronym = UNION_ACRONYMS[canonicalUnion] || proposal.union || 'SSD';
  const totalRequested = (proposal.budgetItems || []).reduce(
    (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );

  const flaggedQuestions = frameworkEval.questions.filter((q) =>
    selectedDeficientCriteria.includes(q.key)
  );

  const remainingFlagItems: { id: string; badge: string; label: string }[] = [
    ...flaggedQuestions.map((q) => ({
      id: `rubric_${q.key}`,
      badge: `Rubric Q${q.number}`,
      label: q.shortTitle,
    })),
    ...systemAlignmentFlags.map((flag) => ({
      id: `sys_${flag.id}`,
      badge: flag.sectionLabel ? `Alignment · ${flag.sectionLabel}` : 'System Alignment',
      label: flag.title,
    })),
  ];

  const hasRemainingFlags = remainingFlagItems.length > 0;
  const isRecommend = decision === 'recommended';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!confirmedAttestation) {
      setLocalError(
        'Please check the confirmation box below before submitting your Step 4 decision.'
      );
      return;
    }

    if (isRecommend && hasRemainingFlags && !overrideReason.trim()) {
      setLocalError(
        'Please briefly explain why the remaining flagged suggestion(s) are intentionally left as-is.'
      );
      return;
    }

    if (!isRecommend && flaggedQuestions.length === 0 && !overallRemark.trim()) {
      setLocalError(
        'Please enter a brief revision note describing the specific change needed by the Union.'
      );
      return;
    }

    const ok = await onConfirm(decision, {
      confirmedReviewedAndAssisted: true,
      ...(isRecommend && hasRemainingFlags
        ? {
            remainingFlagsOverrideReason: overrideReason.trim(),
            acknowledgedRemainingFlags: remainingFlagItems.map(
              (item) => `${item.badge}: ${item.label}`
            ),
          }
        : {}),
    });

    if (ok) {
      if (sendEmailAlert && emailRecipients.length > 0 && currentUser?.email) {
        try {
          await sendStep4LiaisonEmail({
            proposal,
            decision,
            actor: currentUser,
            recipients: emailRecipients,
            selectedDeficientCriteria,
            criterionInstructions,
            overallRemark,
            readinessRating: frameworkEval.effectiveRating,
            overrideReason: isRecommend && hasRemainingFlags ? overrideReason.trim() : undefined,
          });
        } catch (emailErr) {
          console.warn('Non-blocking Step 4 email dispatch notice:', emailErr);
        }
      }
      onClose();
    }
  };

  const activeError = localError || externalError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="liaison-vote-confirm-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div
          className={`px-5 py-3.5 text-white flex items-center justify-between ${
            isRecommend
              ? 'bg-gradient-to-r from-[#182747] to-[#1c398e]'
              : 'bg-gradient-to-r from-amber-700 to-amber-600'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                isRecommend
                  ? 'bg-indigo-400/20 border-indigo-300/40 text-indigo-100'
                  : 'bg-amber-950/20 border-amber-200/40 text-amber-100'
              }`}
            >
              {isRecommend ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3
                id="liaison-vote-confirm-title"
                className="text-sm font-bold text-white truncate"
              >
                {isRecommend
                  ? 'Confirm Step 4 Vote & Recommendation'
                  : 'Confirm Step 4 Revision Request'}
              </h3>
              <p
                className={`text-[11px] truncate ${
                  isRecommend ? 'text-blue-200' : 'text-amber-100'
                }`}
              >
                {isRecommend
                  ? 'Certify your Liaison review before recommending to OV27 (Step 5)'
                  : 'Confirm the guidance being sent back to the Union'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Proposal Context Bar */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                {unionAcronym}
              </span>
              <h4 className="font-bold text-slate-900 truncate text-sm">
                {proposal.title || 'Untitled Proposal'}
              </h4>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Requested
              </span>
              <span className="text-sm font-black text-slate-900 tabular-nums">
                US${formatCurrency(totalRequested)}
              </span>
            </div>
          </div>

          {isRecommend ? (
            <>
              {/* Remaining Flagged Suggestions Section */}
              {hasRemainingFlags ? (
                <div className="p-3.5 rounded-xl bg-amber-50/85 border border-amber-300 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-extrabold text-amber-950">
                          {remainingFlagItems.length} Remaining Flagged{' '}
                          {remainingFlagItems.length === 1 ? 'Suggestion' : 'Suggestions'}
                        </p>
                        <p className="text-[11px] text-amber-900/90 leading-snug mt-0.5">
                          Please document why you are recommending this proposal with these item(s)
                          still flagged so co-Liaisons and Division Treasury understand your
                          decision.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* List of Remaining Flags */}
                  <ul className="space-y-1 bg-white/90 rounded-lg border border-amber-200/90 p-2.5 max-h-36 overflow-y-auto">
                    {remainingFlagItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 text-[11px] text-slate-800 leading-snug"
                      >
                        <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                          {item.badge}
                        </span>
                        <span className="pt-0.5">{item.label}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Quick-Fill Chips + Reason Box */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="liaison-override-reason"
                      className="block text-[11px] font-extrabold text-amber-950"
                    >
                      Reason for leaving flagged suggestion(s) as-is{' '}
                      <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_OVERRIDE_REASONS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setOverrideReason(preset);
                            setLocalError(null);
                          }}
                          className="px-2 py-1 rounded-md bg-white hover:bg-amber-100/80 border border-amber-300 text-[10px] font-semibold text-amber-950 text-left transition cursor-pointer"
                        >
                          {idx === 0
                            ? 'Clarified directly with Union'
                            : idx === 1
                            ? 'Approved due to local Union context'
                            : 'System suggestion does not apply'}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id="liaison-override-reason"
                      rows={3}
                      value={overrideReason}
                      onChange={(e) => {
                        setOverrideReason(e.target.value);
                        setLocalError(null);
                      }}
                      placeholder="Explain specifically why the remaining flagged suggestion(s) were left as-is..."
                      className="w-full px-3 py-2 rounded-lg bg-white border border-amber-300 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-600 outline-none resize-y leading-snug"
                    />
                  </div>

                  {/* Escape hatch back to Request Revision */}
                  <div className="pt-1 border-t border-amber-200/80 flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-amber-900">
                      Need the Union to fix these first?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDecision('revision_requested');
                        setConfirmedAttestation(false);
                        setLocalError(null);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 hover:text-amber-700 underline cursor-pointer whitespace-nowrap"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Switch to Request Revision</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">
                    All 7 SSD Rubric checks passed with no remaining system alignment suggestions.
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Revision Requested Summary */
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-amber-50/85 border border-amber-300 space-y-2.5">
                <p className="text-xs font-extrabold text-amber-950">
                  Revision Guidance Being Sent to {unionAcronym}
                </p>

                {flaggedQuestions.length > 0 ? (
                  <ul className="space-y-1.5 bg-white/95 rounded-lg border border-amber-200 p-2.5 max-h-44 overflow-y-auto">
                    {flaggedQuestions.map((q) => {
                      const instruction = (
                        criterionInstructions[q.key] || q.defaultFixInstruction
                      ).trim();
                      return (
                        <li key={q.key} className="text-[11px] text-slate-800 leading-snug">
                          <span className="font-extrabold text-amber-950">
                            Q{q.number}. {q.shortTitle}:
                          </span>{' '}
                          <span>{instruction}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="liaison-revision-remark"
                      className="block text-[11px] font-bold text-amber-950"
                    >
                      Specific revision needed from the Union <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      id="liaison-revision-remark"
                      rows={3}
                      value={overallRemark}
                      onChange={(e) => {
                        onChangeOverallRemark(e.target.value);
                        setLocalError(null);
                      }}
                      placeholder="Describe clearly what the Union should update before you can recommend..."
                      className="w-full px-3 py-2 rounded-lg bg-white border border-amber-300 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-600 outline-none resize-y"
                    />
                  </div>
                )}

                {flaggedQuestions.length > 0 && overallRemark.trim() && (
                  <div className="text-[11px] text-slate-700 bg-white/80 rounded-lg border border-amber-200/80 px-2.5 py-1.5">
                    <span className="font-bold text-slate-900">Additional note: </span>
                    {overallRemark.trim()}
                  </div>
                )}

                <p className="text-[10.5px] text-amber-900/90 leading-snug">
                  The Union Treasurer and proposal team will be notified and can click{' '}
                  <strong>Reopen Review</strong> to unlock and update this proposal.
                </p>
              </div>
            </div>
          )}

          {/* Mandatory Liaison Attestation Checkbox */}
          <label
            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer select-none transition ${
              confirmedAttestation
                ? isRecommend
                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950'
                  : 'bg-amber-50/80 border-amber-400 text-amber-950'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={confirmedAttestation}
              onChange={(e) => {
                setConfirmedAttestation(e.target.checked);
                setLocalError(null);
              }}
              className={`w-4 h-4 mt-0.5 rounded shrink-0 cursor-pointer ${
                isRecommend
                  ? 'border-indigo-300 text-indigo-600 focus:ring-indigo-500'
                  : 'border-amber-400 text-amber-600 focus:ring-amber-500'
              }`}
            />
            <span className="leading-snug font-semibold">
              {isRecommend
                ? hasRemainingFlags
                  ? 'I confirm that I have reviewed this proposal, assisted the Union where needed, and verified that the remaining flagged suggestion(s) above are intentionally left as-is for the specific reason stated.'
                  : 'I confirm that I have reviewed this proposal against the 7-Question SSD Rubric and assisted the Union where needed.'
                : 'I confirm that I have reviewed this proposal and provided clear guidance to assist the Union with the requested revision(s) above.'}
            </span>
          </label>

          {/* Optional Email Notification Toggle & Recipient Preview */}
          <EmailNotificationToggleCard
            isOpen={isOpen}
            eventType={isRecommend ? 'step4_recommended' : 'step4_revision'}
            proposal={proposal}
            actor={currentUser}
            checked={sendEmailAlert}
            onChangeChecked={setSendEmailAlert}
            onRecipientsResolved={(list) => setEmailRecipients(list)}
          />

          {activeError && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {activeError}
            </p>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !confirmedAttestation ||
                (isRecommend && hasRemainingFlags && !overrideReason.trim())
              }
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                isRecommend
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isRecommend ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{isSubmitting ? 'Submitting Vote...' : 'Confirm & Submit Vote'}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isSubmitting ? 'Sending Request...' : 'Confirm & Request Revision'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
