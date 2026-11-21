import { useState, useMemo, useEffect } from 'react';
import {
  Proposal,
  ProposalProjectCode,
  ProposalReviewNote,
  UserAccount,
  BudgetItem,
  getCanonicalDivisionProject,
  isKpiAlignedWithObjective,
  getAllowedKPIsForObjective,
  canUserReopenApprovedProposal,
  getProposalReviewNotes,
  KPI_OPTIONS,
} from '../types';
import { formatCompositeProjectCode } from '../utils/externalProposalCodec';
import { validateProposalForSubmission, ValidationError } from '../utils/validation';
import { getAllProposalSmartAdvisories, SmartAdvisoryItem } from '../utils/proposalSmartAdvisor';
import { getApprovedProposalIntelligence } from '../utils/approvedProposalIntelligence';
import { ProposalScopeBar } from './proposal/ProposalScopeBar';
import { UnionIntelligenceBanner } from './proposal/UnionIntelligenceBanner';
import { UnionMissionPathwayCard } from './proposal/UnionMissionPathwayCard';
import { ProposalTopReviewDropdowns } from './proposal/ProposalTopReviewDropdowns';
import { ProposalContactsSection } from './proposal/ProposalContactsSection';
import { ProposalNarrativeSection } from './proposal/ProposalNarrativeSection';
import { ProposalBudgetSection } from './proposal/ProposalBudgetSection';
import { ProposalSubmissionBar } from './proposal/ProposalSubmissionBar';
import { ApprovedProposalEditorialView } from './proposal/ApprovedProposalEditorialView';
import { ProposalProgressTab } from './proposal/ProposalProgressTab';
import { ProposalPlausibilityCard } from './proposal/ProposalPlausibilityCard';
import { LiaisonReviewController } from './proposal/useLiaisonReviewState';
import {
  AlertTriangle,
  Lock,
  HelpCircle,
  FileEdit,
  LayoutList,
  Newspaper,
  ExternalLink,
  Activity,
} from 'lucide-react';

export type ProposalFocusTarget = 'notes' | 'flags' | 'financials' | 'kpis' | null;

export interface ProposalFormProps {
  proposal: Proposal;
  allProposals?: Proposal[];
  currentUser?: UserAccount | null;
  onChange: (updated: Partial<Proposal>) => void;
  onUpdateProposalImmediate?: (changes: Partial<Proposal>) => Promise<void> | void;
  onOpenFaqTopic?: (topic: string) => void;
  onSubmitProposal?: () => void;
  onShowValidation?: (errors: ValidationError[], completionPercentage: number) => void;
  onOpenAuth?: () => void;
  onOpenPrint?: () => void;
  onOpenTransferProposal?: (proposal: Proposal) => void;
  isDedicatedApprovedPage?: boolean;
  onOpenDedicatedApprovedPage?: () => void;
  focusTarget?: ProposalFocusTarget;
  onClearFocusTarget?: () => void;
  liaisonReview?: LiaisonReviewController;
}

export function ProposalForm({
  proposal,
  allProposals,
  currentUser,
  onChange,
  onUpdateProposalImmediate,
  onOpenFaqTopic,
  onSubmitProposal,
  onShowValidation,
  onOpenPrint,
  onOpenTransferProposal,
  isDedicatedApprovedPage = false,
  onOpenDedicatedApprovedPage,
  focusTarget,
  onClearFocusTarget,
  liaisonReview,
}: ProposalFormProps) {
  const isLiaison = currentUser?.role === 'division_liaison';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canApproveOrReopen = canUserReopenApprovedProposal(proposal, currentUser);
  const isStep5Authorized = Boolean(proposal.divisionApproval?.authorized);

  const isApproved = proposal.status === 'approved' || Boolean(proposal.unionApproval?.actionNumber);

  // Collapsible dropdown state for Alignment Flags (collapsed cleanly by default in both views unless focused)
  const [isAdvisorExpanded, setIsAdvisorExpanded] = useState(false);
  const [expandedFlagIds, setExpandedFlagIds] = useState<Record<string, boolean>>({});
  const [isReopenConfirmOpen, setIsReopenConfirmOpen] = useState(false);
  // Allows Proposal Makers, Union Treasurers & Admins to switch cleanly between Executive Summary, Edit Form, or Progress
  const [approvedReadViewMode, setApprovedReadViewMode] = useState<'editorial' | 'standard_form' | 'progress'>(
    isApproved || isDedicatedApprovedPage ? 'editorial' : 'standard_form'
  );

  const toggleFlagDetails = (id: string) => {
    setExpandedFlagIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    setApprovedReadViewMode(isApproved || isDedicatedApprovedPage ? 'editorial' : 'standard_form');
    setIsAdvisorExpanded(false);
  }, [proposal.id]);

  // Guard mutations for read-only division liaison role
  const handleSafeChange = (updated: Partial<Proposal>) => {
    if (isLiaison) return;
    onChange(updated);
  };

  const handleSaveProjectCode = async (nextCode: ProposalProjectCode) => {
    if (onUpdateProposalImmediate) {
      await onUpdateProposalImmediate({ projectCode: nextCode });
      return;
    }
    onChange({ projectCode: nextCode });
  };

  // Real-time completeness calculation
  const validationResult = useMemo(() => {
    return validateProposalForSubmission(proposal);
  }, [proposal]);

  // Real-time Smart Proposal Advisories (contradictions, Playbook handoffs, single-line budget, formula in Target Goal, Union 5-stage pathway)
  const smartAdvisories = useMemo(() => {
    return getAllProposalSmartAdvisories(proposal, allProposals);
  }, [proposal, allProposals]);

  // Strategic KPI Misalignment check (matching the Inspect Drawer)
  const canonicalProject = getCanonicalDivisionProject(proposal.divisionProject);
  const objectiveKey = canonicalProject || proposal.divisionProject;
  const isKpiMisaligned = Boolean(
    objectiveKey &&
      proposal.kpiType &&
      !isKpiAlignedWithObjective(objectiveKey, proposal.kpiType)
  );
  const selectedKpiLabel =
    KPI_OPTIONS.find((k) => k.id === proposal.kpiType)?.title || proposal.kpiType;
  const allowedKpiLabels = useMemo(() => {
    if (!objectiveKey) return [];
    const allowedIds = getAllowedKPIsForObjective(objectiveKey);
    return KPI_OPTIONS.filter((k) => allowedIds.includes(k.id)).map((k) => k.title);
  }, [objectiveKey]);

  const totalFlagsCount = smartAdvisories.length + (isKpiMisaligned ? 1 : 0);

  // Live learning from Approved SSD Proposals (budget categories, KPI target benchmarks, audience patterns)
  const approvedIntelligence = useMemo(() => {
    return getApprovedProposalIntelligence(proposal, allProposals);
  }, [proposal, allProposals]);

  const isApprovedAndComplete = isApproved && validationResult.isValid;
  const isFormLocked = isLiaison || isApproved || isApprovedAndComplete;

  // Guard mutations for locked form sections (when approved or liaison)
  const handleLockedSectionChange = (updated: Partial<Proposal>) => {
    if (isFormLocked) return;
    handleSafeChange(updated);
  };

  const handleConfirmReopenFromAdvisor = () => {
    setIsReopenConfirmOpen(false);
    const reopenPayload: Partial<Proposal> = {
      status: 'under_review',
      reviewedBy: currentUser?.displayName || currentUser?.email,
      reviewedAt: new Date().toISOString(),
      ...(isStep5Authorized ? { divisionApproval: null } : {}),
      unionApproval: proposal.unionApproval
        ? {
            ...proposal.unionApproval,
            actionNumber: '',
            minutesExcerpt: `${proposal.unionApproval.minutesExcerpt || ''} [Review reopened on ${new Date().toLocaleDateString()}]`.trim(),
          }
        : undefined,
    };
    if (onUpdateProposalImmediate && !isLiaison) {
      onUpdateProposalImmediate(reopenPayload);
      return;
    }
    handleSafeChange(reopenPayload);
  };

  const handlePostReviewNote = async (text: string) => {
    if (!currentUser?.email || !text.trim()) return;
    const now = new Date().toISOString();
    const existingNotes = getProposalReviewNotes(proposal);
    const newNote: ProposalReviewNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: text.trim(),
      authorName: currentUser.displayName || currentUser.email.split('@')[0],
      authorEmail: currentUser.email,
      authorRole: currentUser.role || 'user',
      createdAt: now,
    };
    const updatedNotes = [...existingNotes, newNote];
    const updatePayload: Partial<Proposal> = {
      reviewNotes: updatedNotes,
      reviewerNotes: newNote.text,
      ...(isLiaison
        ? {}
        : {
            reviewedBy: newNote.authorName,
            reviewedAt: now,
          }),
    };
    if (onUpdateProposalImmediate) {
      await onUpdateProposalImmediate(updatePayload);
      return;
    }
    onChange(updatePayload);
  };

  const handleJumpToSection = (sectionId: string) => {
    const scrollToTarget = () => {
      const el =
        document.getElementById(sectionId) ||
        (sectionId === 'section-strategic-focus' ? document.getElementById('section-title') : null);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-amber-400');
        }, 2200);
      }
    };

    if (showEditorialView || showProgressView) {
      setApprovedReadViewMode('standard_form');
      setTimeout(scrollToTarget, 120);
      return;
    }

    scrollToTarget();
  };

  const handleExecuteQuickAction = (item: SmartAdvisoryItem) => {
    if (isFormLocked) {
      handleJumpToSection(item.sectionId);
      return;
    }

    if (item.onQuickActionType === 'add_audience' && item.payload?.audienceIds?.length) {
      const targetId = item.payload.audienceIds[0];
      const current = proposal.targetAudiences || [];
      if (!current.includes(targetId)) {
        const updated =
          current.length < 3 ? [...current, targetId] : [...current.slice(0, 2), targetId];
        handleSafeChange({ targetAudiences: updated });
      }
      handleJumpToSection(item.sectionId);
      return;
    }

    if (item.onQuickActionType === 'apply_calculated_kpi' && item.payload?.newKpiNumber) {
      const existingDesc = (proposal.kpiDescription || '').trim();
      const detailMove = item.payload.appendKpiDescription || '';
      const updatedDesc = detailMove
        ? existingDesc
          ? existingDesc.includes(detailMove)
            ? existingDesc
            : `${existingDesc}\n${detailMove}`
          : detailMove
        : existingDesc;
      handleSafeChange({
        kpiNumber: item.payload.newKpiNumber,
        kpiDescription: updatedDesc,
      });
      handleJumpToSection(item.sectionId);
      return;
    }

    if (item.onQuickActionType === 'switch_kpi' && item.payload?.newKpiType) {
      handleSafeChange({ kpiType: item.payload.newKpiType });
      handleJumpToSection(item.sectionId);
      return;
    }

    if (
      item.onQuickActionType === 'switch_objective_and_kpi' &&
      item.payload?.newDivisionProject
    ) {
      handleSafeChange({
        ...(item.payload.newStrategicFocus
          ? { strategicFocus: item.payload.newStrategicFocus }
          : {}),
        divisionProject: item.payload.newDivisionProject,
        otherDivisionProject: '',
        ...(item.payload.newKpiType ? { kpiType: item.payload.newKpiType } : {}),
      });
      handleJumpToSection(item.sectionId);
      return;
    }

    if (item.onQuickActionType === 'add_budget_item' && item.payload?.budgetActivity) {
      const existingItems = proposal.budgetItems || [];
      const newItem: BudgetItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
        activity: item.payload.budgetActivity,
        divisionFunding: 0,
      };
      handleSafeChange({ budgetItems: [...existingItems, newItem] });
      handleJumpToSection(item.sectionId);
      return;
    }

    if (item.onQuickActionType === 'append_integration' && item.payload?.integrationSnippet) {
      const current = (proposal.pointsOfIntegration || '').trim();
      const snippet = item.payload.integrationSnippet;
      const updated = current ? `${current}\n• ${snippet}` : `• ${snippet}`;
      handleSafeChange({ pointsOfIntegration: updated });
      handleJumpToSection(item.sectionId);
      return;
    }

    if (item.onQuickActionType === 'append_deliverable' && item.payload?.deliverableSnippet) {
      const current = (proposal.deliverables || '').trim();
      const snippet = item.payload.deliverableSnippet;
      const updated = current ? `${current}\n• ${snippet}` : `• ${snippet}`;
      handleSafeChange({ deliverables: updated });
      handleJumpToSection(item.sectionId);
      return;
    }

    if (item.onQuickActionType === 'append_outcomes' && item.payload?.outcomesSnippet) {
      const current = (proposal.outcomes || '').trim();
      const snippet = item.payload.outcomesSnippet;
      const updated = current ? `${current}\n• ${snippet}` : `• ${snippet}`;
      handleSafeChange({ outcomes: updated });
      handleJumpToSection(item.sectionId);
      return;
    }

    handleJumpToSection(item.sectionId);
  };

  const showEditorialToolbar = true;
  const showEditorialView = showEditorialToolbar && approvedReadViewMode === 'editorial';
  const showProgressView = showEditorialToolbar && approvedReadViewMode === 'progress';

  // Handle deep-link focus requests (e.g. clicking Alignment Flag badge, Budget chip, or KPI metric from Review Hub / Approved Proposals)
  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget === 'flags') {
      setIsAdvisorExpanded(true);
      const timer = setTimeout(() => {
        const el = document.getElementById('proposal-alignment-flags');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-amber-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 2000);
        }
        onClearFocusTarget?.();
      }, 80);
      return () => clearTimeout(timer);
    }
    if (focusTarget === 'financials' || focusTarget === 'kpis') {
      const targetId = focusTarget === 'financials' ? 'section-budget' : 'section-5-kpi';
      const timer = setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-blue-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 2000);
        }
        onClearFocusTarget?.();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [focusTarget, proposal.id, onClearFocusTarget]);

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 p-6 md:p-10 shadow-2xs space-y-8">
      {/* Compact Reading & Review Mode Toolbar (shown when Approved or opened in Dedicated Governance View) */}
      {showEditorialToolbar && (
        <div className="rounded-2xl bg-slate-900 text-white px-3.5 py-2.5 shadow-xs border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: 1-Click Layout Switcher */}
          <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-800 border border-slate-700">
            <button
              type="button"
              onClick={() => setApprovedReadViewMode('editorial')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                approvedReadViewMode === 'editorial'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Clean single-column summary showing Governance Pipeline, KPI, Audience, Narrative, and Share Breakdown"
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Executive Summary</span>
            </button>
            <button
              type="button"
              onClick={() => setApprovedReadViewMode('standard_form')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                approvedReadViewMode === 'standard_form'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title={
                isFormLocked
                  ? 'View in the standard numbered form order (Sections 1–9, read-only)'
                  : 'Switch to standard form fields to edit narrative, KPI, audience, or budget items'
              }
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>{isFormLocked ? 'Standard Form' : 'Edit Form'}</span>
            </button>
            <button
              type="button"
              onClick={() => setApprovedReadViewMode('progress')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                approvedReadViewMode === 'progress'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="GC Project Coding, Phase/Status lifecycle tracking, Step 6 readiness, and Audit Trail"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Progress</span>
            </button>
          </div>

          {/* Right: Status + Hover Context + Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {proposal.projectCode?.projectId && (
              <span
                className="font-mono text-[11px] font-bold text-sky-300 px-2 py-1"
                title="GC Composite Project Code"
              >
                {formatCompositeProjectCode(proposal.projectCode)}
              </span>
            )}
            {isApproved ? (
              <div
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 px-2 py-1"
                title={
                  isStep5Authorized
                    ? 'Locked after Step 5 SSD OV27 Committee Authorization. Contact SSD Division Treasury if this record needs to be reopened.'
                    : canApproveOrReopen && !isLiaison
                    ? 'Locked after Committee Approval so stakeholders can read and print cleanly. Click "Unlock & Edit" to update fields or budget items.'
                    : 'Locked after Committee Approval. Contact your Union Treasurer if this record needs to be reopened.'
                }
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold text-emerald-300">
                  {proposal.unionApproval?.actionNumber
                    ? `Action #${proposal.unionApproval.actionNumber}`
                    : isStep5Authorized
                    ? 'Step 5 Authorized'
                    : 'Approved'}
                </span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className="text-slate-300">Locked</span>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-300 px-2 py-1 tabular-nums">
                <span className="font-semibold text-white">
                  {proposal.status === 'under_review'
                    ? 'Step 2 · Under Review'
                    : proposal.status === 'submitted'
                    ? 'Step 1 · Submitted'
                    : 'Draft'}
                </span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span>Form {validationResult.completionPercentage}% Complete</span>
              </div>
            )}

            {isApproved && !isDedicatedApprovedPage && onOpenDedicatedApprovedPage && (
              <button
                type="button"
                onClick={onOpenDedicatedApprovedPage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-xs active:scale-95"
                title="Open full-screen Official Approved Proposal Page with Liaison & Governance panel"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Full Approved Page</span>
              </button>
            )}

            {isApproved && canApproveOrReopen && !isLiaison && (
              <button
                type="button"
                onClick={() => setIsReopenConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-xs active:scale-95"
              >
                <FileEdit className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Unlock &amp; Edit</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top-Level Separate Dropdown Views for Review Notes, Alignment Flags, and Requests for Revisions */}
      {!showProgressView && (
        <ProposalTopReviewDropdowns
          proposal={proposal}
          currentUser={currentUser}
          isApproved={isApproved}
          isFormLocked={isFormLocked}
          canApproveOrReopen={canApproveOrReopen}
          isLiaison={isLiaison}
          smartAdvisories={smartAdvisories}
          isKpiMisaligned={isKpiMisaligned}
          objectiveKey={objectiveKey}
          selectedKpiLabel={selectedKpiLabel}
          allowedKpiLabels={allowedKpiLabels}
          totalFlagsCount={totalFlagsCount}
          isAdvisorExpanded={isAdvisorExpanded}
          setIsAdvisorExpanded={setIsAdvisorExpanded}
          expandedFlagIds={expandedFlagIds}
          onToggleFlagDetails={toggleFlagDetails}
          onJumpToSection={handleJumpToSection}
          onExecuteQuickAction={handleExecuteQuickAction}
          onOpenReopenConfirm={() => setIsReopenConfirmOpen(true)}
          onPostReviewNote={handlePostReviewNote}
          focusTarget={focusTarget}
        />
      )}

      {/* =====================================================================
          SINGLE-COLUMN EDITORIAL STORY VIEW FOR APPROVED PROPOSALS
          Places Title, Strategic Focus, Global Objective, Selected KPI & Selected Audience in a spacious vertical flow
         ===================================================================== */}
      {showEditorialView && (
        <ApprovedProposalEditorialView
          proposal={proposal}
          allProposals={allProposals}
          liaisonReview={liaisonReview}
          onOpenProgressTab={() => setApprovedReadViewMode('progress')}
          topContextSlot={
            <div className="space-y-4">
              <UnionIntelligenceBanner
                unionName={proposal.union || currentUser?.union || 'East Central Philippine Union Conference'}
              />
              <UnionMissionPathwayCard
                proposal={proposal}
                allProposals={allProposals}
                isFormLocked={isFormLocked}
                onJumpToSection={handleJumpToSection}
              />
            </div>
          }
        />
      )}

      {/* =====================================================================
          PROGRESS TAB: GC PROJECT CODING, PHASE/STATUS & AUDIT TRAIL
         ===================================================================== */}
      {showProgressView && (
        <ProposalProgressTab
          proposal={proposal}
          allProposals={allProposals}
          currentUser={currentUser}
          isStep5Authorized={isStep5Authorized}
          onSaveProjectCode={handleSaveProjectCode}
        />
      )}

      {/* Division Liaison Advisory Notice (Shown only in workspace when right-hand Governance panel is not mounted) */}
      {!showProgressView && isLiaison && !isApproved && !isDedicatedApprovedPage && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              ℹ
            </span>
            <div>
              <p className="font-bold text-indigo-950">Division Liaison Advisory View</p>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                You are viewing this proposal in read-only observation mode. Form editing is locked.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unified Scope, Union Affiliation, Workflow Status & Readiness Control Bar (Housed in Right Sidebar when in Dedicated Page mode) */}
      {!showProgressView && !isApproved && !isDedicatedApprovedPage && (
        <ProposalScopeBar
          proposal={proposal}
          currentUser={currentUser}
          onChange={handleSafeChange}
          validationResult={validationResult}
          onShowValidation={onShowValidation}
          onSubmitProposal={isLiaison ? undefined : onSubmitProposal}
          onOpenPrint={onOpenPrint}
          onOpenTransferOwnership={!isLiaison && onOpenTransferProposal ? () => onOpenTransferProposal(proposal) : undefined}
        />
      )}

      {/* Territory Mission Intelligence Profile & Union 5-Stage Pathway (Rendered here when editing or in Standard Form view) */}
      {!showEditorialView && !showProgressView && (
        <div className="space-y-4">
          <UnionIntelligenceBanner
            unionName={proposal.union || currentUser?.union || 'East Central Philippine Union Conference'}
          />
          <UnionMissionPathwayCard
            proposal={proposal}
            allProposals={allProposals}
            isFormLocked={isFormLocked}
            onJumpToSection={handleJumpToSection}
            onAppendIntegration={(snippet) => {
              if (isFormLocked) return;
              const current = (proposal.pointsOfIntegration || '').trim();
              if (current.toLowerCase().includes(snippet.slice(0, 28).toLowerCase())) return;
              const updated = current ? `${current}\n• ${snippet}` : `• ${snippet}`;
              handleLockedSectionChange({ pointsOfIntegration: updated });
            }}
          />
          {!isDedicatedApprovedPage && (
            <ProposalPlausibilityCard proposal={proposal} variant="inline" />
          )}
        </div>
      )}

      {/* Review Notes, Alignment Flags, and Requests for Revisions are rendered cleanly in their own dropdown views at the top */}

      {/* Standard Form Sections (Rendered when Editing OR when user toggles to Standard Form view) */}
      {!showEditorialView && !showProgressView && (
        <>
          <div>
            <ProposalContactsSection
              proposal={proposal}
              isFormLocked={isFormLocked}
              onChange={handleLockedSectionChange}
            />
          </div>

          <div>
            <ProposalNarrativeSection
              proposal={proposal}
              allProposals={allProposals}
              approvedIntelligence={approvedIntelligence}
              isFormLocked={isFormLocked}
              onChange={handleLockedSectionChange}
              onExecuteQuickAction={handleExecuteQuickAction}
              onOpenFaqTopic={onOpenFaqTopic}
            />
          </div>

          <div>
            <ProposalBudgetSection
              budgetItems={proposal.budgetItems || []}
              proposal={proposal}
              allProposals={allProposals}
              showShareBreakdown={isApproved || isDedicatedApprovedPage}
              approvedIntelligence={approvedIntelligence}
              isFormLocked={isFormLocked}
              onChange={(budgetItems) => handleLockedSectionChange({ budgetItems })}
              onExecuteQuickAction={handleExecuteQuickAction}
              onOpenFaqTopic={onOpenFaqTopic}
            />
          </div>
        </>
      )}

      {/* Floating Bottom Submission & Readiness Bar (Only shown when actively editing form fields) */}
      {!isLiaison && !isApproved && !showEditorialView && !showProgressView && (
        <ProposalSubmissionBar
          validationResult={validationResult}
          proposalStatus={proposal.status}
          actionNumber={proposal.unionApproval?.actionNumber}
          onShowValidation={onShowValidation}
          onSubmitProposal={onSubmitProposal}
        />
      )}

      {/* Reopen Review Confirmation Modal (Triggered from Smart Advisor Banner) */}
      {isReopenConfirmOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reopen Proposal Review?</h3>
                <p className="text-xs text-slate-500">Unlock approved proposal for updates</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This proposal was approved under{' '}
              <strong>Action #{proposal.unionApproval?.actionNumber || 'Voted'}</strong>
              {isStep5Authorized ? (
                <>
                  {' '}
                  and <strong>authorized in Step 5 by the SSD OV27 Committee</strong>
                </>
              ) : null}
              . Reopening review will{isStep5Authorized ? ' clear Step 5 authorization and ' : ' '}
              return this proposal to <em>Under Review</em> status so budget breakdowns, target
              audiences, or KPI targets can be updated.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsReopenConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Keep Approved
              </button>
              <button
                type="button"
                onClick={handleConfirmReopenFromAdvisor}
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
