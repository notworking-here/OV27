import React, { useState } from 'react';
import {
  Proposal,
  UserAccount,
  UNION_CATEGORIES,
  UNION_ACRONYMS,
  getUserAllUnions,
  UnionCommitteeApproval,
  getCanonicalDivisionProject,
  isKpiAlignedWithObjective,
  KPI_OPTIONS,
} from '../../types';
import {
  Building,
  Lock,
  ShieldCheck,
  Printer,
  ArrowRightLeft,
  User,
  CheckCircle2,
  Clock,
  Send,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { ValidationResult, ValidationError } from '../../utils/validation';
import { UnionApprovalModal } from '../UnionApprovalModal';

export interface ProposalScopeBarProps {
  proposal: Proposal;
  currentUser?: UserAccount | null;
  onChange: (updated: Partial<Proposal>) => void;
  validationResult?: ValidationResult;
  onShowValidation?: (errors: ValidationError[], completionPercentage: number) => void;
  onSubmitProposal?: () => void;
  onOpenPrint?: () => void;
  onOpenTransferOwnership?: () => void;
}

export function ProposalScopeBar({
  proposal,
  currentUser,
  onChange,
  validationResult,
  onShowValidation,
  onSubmitProposal,
  onOpenPrint,
  onOpenTransferOwnership,
}: ProposalScopeBarProps) {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isTreasurer = currentUser?.role === 'treasurer';
  const isCoordinator = currentUser?.role === 'coordinator';
  const isLiaison = currentUser?.role === 'division_liaison';

  const canReview = isSuperAdmin || isTreasurer || isCoordinator;
  const canApprove = isSuperAdmin || isTreasurer;

  const assignedUnion =
    proposal.union || currentUser?.union || 'East Central Philippine Union Conference';
  const acronym = UNION_ACRONYMS[assignedUnion] ? `[${UNION_ACRONYMS[assignedUnion]}] ` : '';

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

  const canonicalProject = getCanonicalDivisionProject(proposal.divisionProject);
  const isMisaligned = Boolean(
    (canonicalProject || proposal.divisionProject) &&
    proposal.kpiType &&
    !isKpiAlignedWithObjective(canonicalProject || proposal.divisionProject, proposal.kpiType)
  );
  const matchedKpiObj = proposal.kpiType
    ? KPI_OPTIONS.find((k) => k.id === proposal.kpiType)
    : null;

  const handleStatusChange = (newStatus: 'draft' | 'submitted' | 'under_review') => {
    if (newStatus === 'submitted' && validationResult && !validationResult.isValid) {
      if (onShowValidation) {
        onShowValidation(validationResult.errors, validationResult.completionPercentage);
      }
      return;
    }
    onChange({
      status: newStatus,
      reviewedBy: currentUser?.displayName || currentUser?.email,
      reviewedAt: new Date().toISOString(),
    });
  };

  const handleOpenApprovalModal = () => {
    if (validationResult && !validationResult.isValid) {
      if (onShowValidation) {
        onShowValidation(validationResult.errors, validationResult.completionPercentage);
      }
      return;
    }
    setIsApprovalModalOpen(true);
  };

  const handleConfirmUnionApproval = async (
    proposalId: string,
    approvalData: UnionCommitteeApproval,
    shouldSetStatusApproved: boolean = true
  ) => {
    onChange({
      unionApproval: approvalData,
      status: shouldSetStatusApproved ? 'approved' : proposal.status,
      reviewedBy: approvalData.approvedBy,
      reviewedAt: approvalData.timestamp,
    });
    setIsApprovalModalOpen(false);
  };

  const handleConfirmReopenReview = () => {
    setIsReopenModalOpen(false);
    onChange({
      status: 'under_review',
      reviewedBy: currentUser?.displayName || currentUser?.email,
      reviewedAt: new Date().toISOString(),
      unionApproval: proposal.unionApproval
        ? {
            ...proposal.unionApproval,
            actionNumber: '',
            minutesExcerpt: `${proposal.unionApproval.minutesExcerpt || ''} [Review reopened on ${new Date().toLocaleDateString()}]`.trim(),
          }
        : undefined,
    });
  };

  const userUnions = getUserAllUnions(currentUser);
  const isMultiUnion = userUnions.length > 1;

  const currentStatus = proposal.status || 'draft';
  const isApproved = currentStatus === 'approved' || Boolean(proposal.unionApproval?.actionNumber);

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[#f8fafc] border border-slate-200/80 space-y-3 shadow-2xs">
      {/* Row 1: Union Scope (Left) <---> Status Pill & Misaligned Badge (Right) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left: Union Label & Selector */}
        <div className="inline-flex items-center gap-2 flex-wrap">
          <Building className="w-4 h-4 text-[#2a4d9c] shrink-0" />
          <span className="text-xs font-semibold text-slate-600 shrink-0">Union:</span>

          {isSuperAdmin ? (
            <div className="inline-flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <select
                value={assignedUnion}
                onChange={(e) => onChange({ union: e.target.value })}
                className="text-xs font-bold text-slate-800 bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-amber-500 cursor-pointer shadow-2xs hover:border-amber-400 max-w-[240px] sm:max-w-[320px] truncate"
                title="Super Admin: Reassign proposal to another Union"
              >
                {UNION_CATEGORIES.map((cat) => (
                  <optgroup key={cat.category} label={cat.category}>
                    {cat.unions.map((u) => (
                      <option key={u} value={u}>
                        {UNION_ACRONYMS[u] ? `[${UNION_ACRONYMS[u]}] ` : ''}
                        {u}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-lg shrink-0"
                title="Division Admin privilege to reassign proposal union"
              >
                <ShieldCheck className="w-3 h-3 text-amber-700" />
                Reassignable
              </span>
            </div>
          ) : isMultiUnion ? (
            <div className="inline-flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <select
                value={assignedUnion}
                onChange={(e) => onChange({ union: e.target.value })}
                className="text-xs font-bold text-slate-800 bg-white border border-blue-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-500 cursor-pointer shadow-2xs hover:border-blue-400 max-w-[240px] sm:max-w-[320px] truncate"
                title="Select which assigned Union territory this proposal is for"
              >
                {userUnions.map((u) => (
                  <option key={u} value={u}>
                    {UNION_ACRONYMS[u] ? `[${UNION_ACRONYMS[u]}] ` : ''}
                    {u}
                  </option>
                ))}
              </select>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg shrink-0"
                title={`Authorized across ${userUnions.length} assigned Union territories`}
              >
                Multi-Union
              </span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs"
              title="Union is locked to your account affiliation. Contact the Division Admin to reassign."
            >
              <span>
                {acronym}
                {assignedUnion}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md ml-1">
                <Lock className="w-2.5 h-2.5 text-slate-400" />
                Locked
              </span>
            </div>
          )}
        </div>

        {/* Right: Status Pill & Misaligned Badge */}
        <div className="inline-flex items-center gap-1.5 flex-nowrap self-start sm:self-center shrink-0">
          <span className="text-xs font-semibold text-slate-500">Step:</span>

          {/* Clean Status Pill with 5-Step terminology */}
          {isApproved ? (
            <div
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold shadow-2xs whitespace-nowrap"
              title={`Officially Voted Committee Action: #${proposal.unionApproval?.actionNumber || 'Voted'}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {proposal.divisionApproval?.authorized
                  ? 'Step 5 · SSD OV27 Committee ✓'
                  : (proposal.liaisonVotes || []).some((v) => v.vote === 'recommended')
                  ? 'Step 5 · Ready for OV27 Committee'
                  : 'Step 4 · Liaison Review & Vote'}
              </span>
              {proposal.unionApproval?.actionNumber && (
                <span
                  className="text-[10px] font-bold bg-emerald-200/70 px-1.5 py-0.5 rounded text-emerald-950 border border-emerald-300/80 max-w-[170px] truncate block"
                  title={`Step 3 Union Committee Action: ${proposal.unionApproval.actionNumber}`}
                >
                  #{proposal.unionApproval.actionNumber}
                </span>
              )}
            </div>
          ) : currentStatus === 'under_review' ? (
            <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold shadow-2xs whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Step 2 · Union Review</span>
            </div>
          ) : currentStatus === 'submitted' ? (
            <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-blue-50 text-blue-800 border border-blue-300 text-xs font-bold shadow-2xs whitespace-nowrap">
              <Send className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Step 1 · Submitted</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shadow-2xs whitespace-nowrap">
              <span>Draft (Pre-Step 1)</span>
            </div>
          )}

          {/* Misaligned Strategic Alignment Tag */}
          {isMisaligned && (
            <div
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs whitespace-nowrap"
              title={`Strategic Misalignment: Primary KPI does not match ${canonicalProject || proposal.divisionProject}`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Misaligned</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Owner (Left) <---> Action Buttons Group (Right) */}
      <div className="pt-2.5 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left: Proposal Owner Badge & Admin Transfer Action */}
        <div className="inline-flex items-center gap-2 py-0.5">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-600 shrink-0">Owner:</span>
          <span
            className="text-xs font-bold text-slate-800 truncate max-w-[150px] sm:max-w-[240px]"
            title={`Author: ${proposal.userName || 'Unassigned'} (${
              proposal.userEmail || proposal.pointOfContact?.email || 'No email'
            })`}
          >
            {proposal.userName ||
              proposal.pointOfContact?.name ||
              proposal.userEmail ||
              'Unassigned'}
          </span>
          {isSuperAdmin && onOpenTransferOwnership && (
            <button
              type="button"
              onClick={onOpenTransferOwnership}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold transition cursor-pointer shadow-2xs"
              title="Super Admin: Reassign ownership of this proposal to another user"
            >
              <ArrowRightLeft className="w-3 h-3 text-amber-700" />
              <span>Transfer</span>
            </button>
          )}
        </div>

        {/* Right: Action Buttons Group (Edit, Reopen, Print) in one single row */}
        <div className="inline-flex items-center gap-2 flex-wrap self-start sm:self-center shrink-0">
          {/* Contextual Executive Actions for Reviewers & Treasurers */}
          {!isLiaison && canReview && (
            <>
              {/* If Submitted (Step 1): Option to Start Step 2 Review OR Skip directly to Step 3 Union Vote */}
              {currentStatus === 'submitted' && (
                <>
                  {canApprove && (
                    <button
                      type="button"
                      onClick={handleOpenApprovalModal}
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 ring-2 ring-emerald-500/20 whitespace-nowrap"
                      title="Skip Step 2 Review and directly record Step 3 Official Union Committee Action to Approve"
                    >
                      <FileCheck2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                      <span>Step 3: Record Union Vote</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStatusChange('under_review')}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold bg-[#1c398e] hover:bg-[#152c70] text-white transition cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                    title="Optional Step 2: Move proposal into Union review state"
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Step 2: Start Review</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('draft')}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                    title="Return to draft for author edits"
                  >
                    <span>Return to Draft</span>
                  </button>
                </>
              )}

              {/* If Under Review (Step 2): Option to Record Official Committee Action to Approve (Step 3) */}
              {currentStatus === 'under_review' && (
                <>
                  {canApprove && (
                    <button
                      type="button"
                      onClick={handleOpenApprovalModal}
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 ring-2 ring-emerald-500/20 whitespace-nowrap"
                      title="Step 3: Open Official Committee Action dialog to vote and approve this proposal"
                    >
                      <FileCheck2 className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                      <span>Step 3: Record Union Vote</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStatusChange('draft')}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                    title="Send back for revisions"
                  >
                    <span>Return to Draft</span>
                  </button>
                </>
              )}

              {/* If Approved: Allow editing committee action or reopening review */}
              {isApproved && canApprove && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsApprovalModalOpen(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition cursor-pointer shadow-2xs whitespace-nowrap"
                    title="Edit voted committee action number, date, or minutes excerpt"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Edit Action</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsReopenModalOpen(true)}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-300 text-slate-600 hover:text-amber-800 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                    title="Reopen review to allow revisions"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>Reopen Review</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* Print / Save as PDF Button */}
          {onOpenPrint && (
            <button
              type="button"
              onClick={onOpenPrint}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs transition active:scale-98 cursor-pointer shrink-0 whitespace-nowrap"
              title="Print proposal or save as PDF for Treasury submission"
            >
              <Printer className="w-3.5 h-3.5 text-[#1c398e] shrink-0" />
              <span>Print / Save as PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Readiness & Author Submit live exclusively in the sticky bottom ProposalSubmissionBar to avoid duplication */}

      {/* Compact Inline KPI Misalignment Notice */}
      {isMisaligned && (
        <div className="px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">
              <strong>KPI Mismatch:</strong> Primary KPI (
              <span className="font-semibold">{matchedKpiObj?.title || proposal.kpiType}</span>) does
              not match{' '}
              <span className="font-semibold">
                {canonicalProject || proposal.divisionProject}
              </span>
              .
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('section-5-kpi');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="text-xs font-bold text-amber-900 underline hover:text-black cursor-pointer shrink-0 self-start sm:self-center"
          >
            Jump to Section 5 →
          </button>
        </div>
      )}

      {/* Union Committee Approval Modal */}
      {isApprovalModalOpen && currentUser && (
        <UnionApprovalModal
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          proposal={proposal}
          currentUser={currentUser}
          onConfirmApproval={handleConfirmUnionApproval}
        />
      )}

      {/* Reopen Review Confirmation Modal */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reopen Proposal Review?</h3>
                <p className="text-xs text-slate-500">Official Committee Action is on record</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This proposal was approved under{' '}
              <strong>Action #{proposal.unionApproval?.actionNumber || 'Voted'}</strong>. Reopening
              review will return this proposal to <em>Under Review</em> status so directors or
              coordinators can adjust budget figures or narratives.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Keep Approved
              </button>
              <button
                type="button"
                onClick={handleConfirmReopenReview}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-2xs cursor-pointer active:scale-95"
              >
                Confirm Reopen Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

