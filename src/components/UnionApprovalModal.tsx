import React, { useState, useEffect } from 'react';
import {
  X,
  FileCheck2,
  Calendar,
  UserCheck,
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Proposal, UserAccount, UnionCommitteeApproval } from '../types';
import { validateProposalForSubmission } from '../utils/validation';
import { evaluateProposalReviewFramework } from '../utils/projectReviewFramework';
import { EmailNotificationToggleCard } from './proposal/EmailNotificationToggleCard';
import {
  EmailRecipient,
  sendStep3ApprovalEmail,
} from '../services/emailNotificationService';

interface UnionApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal;
  currentUser: UserAccount;
  onConfirmApproval: (
    proposalId: string,
    approvalData: UnionCommitteeApproval,
    shouldSetStatusApproved?: boolean
  ) => Promise<void> | void;
}

export function UnionApprovalModal({
  isOpen,
  onClose,
  proposal,
  currentUser,
  onConfirmApproval,
}: UnionApprovalModalProps) {
  const existing = proposal.unionApproval;

  const [actionNumber, setActionNumber] = useState(existing?.actionNumber || '');
  const [actionDate, setActionDate] = useState(
    existing?.actionDate || new Date().toISOString().split('T')[0]
  );
  const [minutesExcerpt, setMinutesExcerpt] = useState(
    existing?.minutesExcerpt || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendEmailAlert, setSendEmailAlert] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);

  // Derive certifying officer details directly from authenticated account
  const accountName = currentUser.displayName || currentUser.email.split('@')[0];
  const accountRole =
    currentUser.role === 'treasurer'
      ? 'Union Treasurer'
      : currentUser.role === 'coordinator'
      ? 'Union Coordinator'
      : currentUser.role === 'super_admin'
      ? 'Division Administrator'
      : 'Union Officer';

  useEffect(() => {
    if (isOpen) {
      if (proposal.unionApproval) {
        setActionNumber(proposal.unionApproval.actionNumber || '');
        setActionDate(
          proposal.unionApproval.actionDate || new Date().toISOString().split('T')[0]
        );
        setMinutesExcerpt(proposal.unionApproval.minutesExcerpt || '');
      } else {
        setActionNumber('');
        setActionDate(new Date().toISOString().split('T')[0]);
        setMinutesExcerpt('');
      }
      setErrorMsg(null);
    }
  }, [isOpen, proposal]);

  if (!isOpen) return null;

  const totalRequested = (proposal.budgetItems || []).reduce(
    (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );

  const isAlreadyApproved = proposal.status === 'approved' || Boolean(existing?.actionNumber);
  const validationResult = validateProposalForSubmission(proposal);
  const isApprovalBlocked = !isAlreadyApproved && !validationResult.isValid;
  const frameworkEval = evaluateProposalReviewFramework(proposal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionNumber.trim()) {
      setErrorMsg('Please enter the Committee Action or Vote Number.');
      return;
    }

    if (isApprovalBlocked) {
      setErrorMsg(
        `Cannot approve proposal: ${validationResult.errors.length} required fields are missing (${validationResult.completionPercentage}% complete).`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const upperAction = actionNumber.trim().toUpperCase();
    const inferredCommitteeType = upperAction.includes('ADCOM')
      ? 'ADCOM'
      : upperAction.includes('EXCOM')
      ? 'EXCOM'
      : existing?.committeeType || 'EXCOM';

    const approvalData: UnionCommitteeApproval = {
      actionNumber: actionNumber.trim(),
      actionDate: actionDate || new Date().toISOString().split('T')[0],
      approvedBy: existing?.approvedBy || accountName,
      approvedByEmail: existing?.approvedByEmail || currentUser.email,
      approvedByRole: existing?.approvedByRole || accountRole,
      minutesExcerpt: minutesExcerpt.trim() || '',
      committeeType: inferredCommitteeType,
      timestamp: new Date().toISOString(),
    };

    try {
      await onConfirmApproval(proposal.id, approvalData, true);
      if (sendEmailAlert && emailRecipients.length > 0) {
        try {
          await sendStep3ApprovalEmail({
            proposal,
            approvalData,
            actor: currentUser,
            recipients: emailRecipients,
          });
        } catch (emailErr) {
          console.warn('Non-blocking Step 3 email dispatch notice:', emailErr);
        }
      }
      onClose();
    } catch (err) {
      console.error('Failed to record committee action:', err);
      setErrorMsg(
        err instanceof Error
          ? `Could not save approval: ${err.message}`
          : 'Failed to record action to cloud database. Please check connection and permissions.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Committee Action</span>
                {existing && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                    Voted
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-300">
                Official union action required to accept and approve proposal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Target Proposal Context */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                {proposal.union}
              </span>
              <h4 className="font-bold text-slate-900 truncate">
                {proposal.title || 'Untitled Proposal'}
              </h4>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Requested
              </span>
              <span className="text-sm font-black text-blue-900 tabular-nums">
                US${totalRequested.toLocaleString()}
              </span>
            </div>
          </div>

          {/* SSD Review Framework & Treasurer Fiscal Alignment Strip */}
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-1.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-extrabold text-slate-800">
                SSD Review Framework ({frameworkEval.adequateCount}/7 Criteria)
              </span>
              <span
                className={`font-extrabold ${
                  frameworkEval.effectiveRating === 'meeting_requirement'
                    ? 'text-emerald-700'
                    : frameworkEval.effectiveRating === 'needs_improvement'
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {frameworkEval.effectiveRatingLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
              <span className="font-semibold text-slate-700">
                {frameworkEval.subTypeMeta.shortLabel}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
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
                      ? 'Unconditional Service Documented'
                      : 'Verify Unconditional Service Safeguard'}
                  </span>
                </>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Number & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Action / Vote No. *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. UC-2026-042 or 26:15"
                value={actionNumber}
                onChange={(e) => setActionNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm font-bold text-slate-900 outline-none transition"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">
                Action Date *
              </label>
              <input
                type="date"
                required
                value={actionDate}
                onChange={(e) => setActionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 focus:border-blue-500 text-xs font-semibold text-slate-800 outline-none transition"
              />
            </div>
          </div>

          {/* Authenticated Account Tie-in (Automatic) */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-xs min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Certifying Official (Tied to Account)
              </span>
              <p className="font-semibold text-slate-800 truncate">
                {accountName} <span className="text-slate-500 font-normal">({accountRole})</span>
              </p>
              <span className="text-[11px] text-slate-500 truncate block">
                {currentUser.email}
              </span>
            </div>
          </div>

          {/* Optional Resolution Notes / Excerpt */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Minutes Excerpt / Notes</span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Voted to recommend project to SSD Division Treasury..."
              value={minutesExcerpt}
              onChange={(e) => setMinutesExcerpt(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 focus:border-blue-500 text-xs text-slate-800 outline-none transition resize-none"
            />
          </div>

          {/* Validation blocker or legacy notice or clean confirmation */}
          {isApprovalBlocked ? (
            <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950">
                <span className="font-bold block">
                  Approval Blocked: Proposal Incomplete ({validationResult.completionPercentage}%)
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                  All 18 required questions and budget lines must be completed before an official committee vote can approve this proposal.
                </p>
                <p className="text-[11px] font-semibold text-amber-900 mt-1">
                  Missing: {validationResult.errors.map((e) => e.label).join(', ')}
                </p>
              </div>
            </div>
          ) : isAlreadyApproved && !validationResult.isValid ? (
            <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950">
                <span className="font-bold block">
                  Approved Record Has Incomplete Fields ({validationResult.completionPercentage}%)
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                  You are editing an existing voted action. Please ensure the missing items ({validationResult.errors.map((e) => e.label).join(', ')}) are completed in the proposal editor.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <span className="font-bold text-slate-900 block">
                  Official Committee Vote & Proposal Approval
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  Saving this action certifies that the vote is recorded in the official minutes and marks the proposal as Approved for SSD Division funding disbursement.
                </p>
              </div>
            </div>
          )}

          {/* Optional Email Notification Toggle & Recipient Preview */}
          <EmailNotificationToggleCard
            isOpen={isOpen && !isApprovalBlocked}
            eventType="step3_approved"
            proposal={proposal}
            actor={currentUser}
            checked={sendEmailAlert}
            onChangeChecked={setSendEmailAlert}
            onRecipientsResolved={(list) => setEmailRecipients(list)}
          />

          {/* Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
              disabled={isSubmitting || !actionNumber.trim() || isApprovalBlocked}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold transition shadow-xs cursor-pointer"
              title={
                isApprovalBlocked
                  ? `Cannot approve: ${validationResult.errors.length} required fields missing`
                  : undefined
              }
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : isApprovalBlocked
                  ? 'Approve Locked (Incomplete)'
                  : isAlreadyApproved
                  ? 'Update Committee Action'
                  : 'Approve Proposal'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
