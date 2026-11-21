import React, { useMemo, useState, useEffect } from 'react';
import {
  Proposal,
  UserAccount,
  KPI_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  STRATEGIC_PILLARS_CONFIG,
  getCanonicalUnion,
  getUserVotingUnions,
  isUserLiaisonEligible,
  getCanonicalDivisionProject,
  getCanonicalKpiType,
  getProposalStepStatus,
} from '../../types';
import {
  fetchDivisionLiaisons,
  subscribeToLiaisonDirectoryChanges,
} from '../../services/proposalService';
import { parseKpiTargetNumber } from '../../utils/kpiExtraction';
import { FormattedNarrativeText } from '../../utils/narrativeFormatter';
import { formatCurrency } from '../../utils/userUtils';
import { resolveProposalProjectCode } from '../../utils/externalProposalCodec';
import { getSectionAlignmentAdvisories, SmartAdvisoryItem } from '../../utils/proposalSmartAdvisor';
import { ProposalShareBreakdownCard } from './ProposalShareBreakdownCard';
import { SectionAlignmentCallout } from './SectionAlignmentCallout';
import { LiaisonReviewController } from './useLiaisonReviewState';
import {
  Radio,
  MessageSquare,
  MapPin,
  HeartHandshake,
  Wrench,
  Target,
  Users,
  CheckCircle2,
  Layers,
  Compass,
  Flag,
  PackageCheck,
  Network,
  DollarSign,
  History,
  FileText,
  Clock,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

const KPI_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  reach_exposure: Radio,
  engagement_participation: MessageSquare,
  connection_next_steps: MapPin,
  retention_nurturing: HeartHandshake,
  implementation_capability: Wrench,
};

const KPI_THEME: Record<
  string,
  {
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    accentText: string;
  }
> = {
  reach_exposure: {
    bg: 'bg-sky-50/40',
    border: 'border-sky-200/90',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-900',
    iconBg: 'bg-sky-600 text-white',
    accentText: 'text-sky-950',
  },
  engagement_participation: {
    bg: 'bg-indigo-50/40',
    border: 'border-indigo-200/90',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-900',
    iconBg: 'bg-indigo-600 text-white',
    accentText: 'text-indigo-950',
  },
  connection_next_steps: {
    bg: 'bg-purple-50/40',
    border: 'border-purple-200/90',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    iconBg: 'bg-purple-600 text-white',
    accentText: 'text-purple-950',
  },
  retention_nurturing: {
    bg: 'bg-emerald-50/40',
    border: 'border-emerald-200/90',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    iconBg: 'bg-emerald-600 text-white',
    accentText: 'text-emerald-950',
  },
  implementation_capability: {
    bg: 'bg-amber-50/40',
    border: 'border-amber-200/90',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-900',
    iconBg: 'bg-amber-600 text-white',
    accentText: 'text-amber-950',
  },
};

export interface ApprovedProposalEditorialViewProps {
  proposal: Proposal;
  allProposals?: Proposal[];
  assignedLiaisons?: UserAccount[];
  topContextSlot?: React.ReactNode;
  onOpenProgressTab?: () => void;
  liaisonReview?: LiaisonReviewController;
}

export function ApprovedProposalEditorialView({
  proposal,
  allProposals,
  assignedLiaisons,
  topContextSlot,
  onOpenProgressTab,
  liaisonReview,
}: ApprovedProposalEditorialViewProps) {
  const [directoryUsers, setDirectoryUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    if (assignedLiaisons || liaisonReview) return;
    let mounted = true;
    const loadLiaisons = (forceRefresh = false) => {
      fetchDivisionLiaisons(forceRefresh)
        .then((users) => {
          if (mounted && Array.isArray(users)) {
            setDirectoryUsers(users);
          }
        })
        .catch(() => {
          // non-blocking offline fallback
        });
    };
    loadLiaisons(false);
    const unsub = subscribeToLiaisonDirectoryChanges(() => {
      loadLiaisons(true);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [assignedLiaisons, liaisonReview]);

  const resolvedUnionLiaisons = useMemo(() => {
    if (assignedLiaisons) return assignedLiaisons;
    if (liaisonReview) return liaisonReview.assignedDivisionLiaisons;
    const canonProposalUnion = getCanonicalUnion(proposal.union || '');
    if (!canonProposalUnion) return [];
    return directoryUsers.filter((u) => {
      if (!isUserLiaisonEligible(u)) return false;
      return getUserVotingUnions(u).includes(canonProposalUnion);
    });
  }, [assignedLiaisons, liaisonReview, directoryUsers, proposal.union]);

  const stepStatus = useMemo(
    () =>
      !assignedLiaisons && liaisonReview
        ? liaisonReview.stepStatus
        : getProposalStepStatus(proposal, resolvedUnionLiaisons),
    [assignedLiaisons, liaisonReview, proposal, resolvedUnionLiaisons]
  );
  const canonicalObjective = getCanonicalDivisionProject(proposal.divisionProject);
  const effectiveObjective =
    proposal.divisionProject === 'Other' && proposal.otherDivisionProject
      ? proposal.otherDivisionProject
      : canonicalObjective || proposal.divisionProject || 'General OneVoice27 Initiative';

  // Match Strategic Pillar & Objective number
  const matchedPillarInfo = useMemo(() => {
    for (const pillar of STRATEGIC_PILLARS_CONFIG) {
      if (
        proposal.strategicFocus &&
        pillar.title.toLowerCase() === proposal.strategicFocus.trim().toLowerCase()
      ) {
        const matchedObj = pillar.kpis.find(
          (k) => k.title.toLowerCase() === (canonicalObjective || '').toLowerCase()
        );
        return { pillar, objective: matchedObj };
      }
      const matchedObj = pillar.kpis.find(
        (k) => k.title.toLowerCase() === (canonicalObjective || '').toLowerCase()
      );
      if (matchedObj) {
        return { pillar, objective: matchedObj };
      }
    }
    return null;
  }, [proposal.strategicFocus, canonicalObjective]);

  const canonicalKpiId = getCanonicalKpiType(proposal.kpiType);
  const selectedKpi = useMemo(
    () => KPI_OPTIONS.find((k) => k.id === canonicalKpiId || k.id === proposal.kpiType) || null,
    [canonicalKpiId, proposal.kpiType]
  );

  const parsedKpi = useMemo(
    () => parseKpiTargetNumber(proposal.kpiNumber, proposal.kpiDescription, proposal.kpiType),
    [proposal.kpiNumber, proposal.kpiDescription, proposal.kpiType]
  );

  // Resolve ONLY the selected Target Audiences
  const selectedAudiences = useMemo(() => {
    const rawIds = proposal.targetAudiences || [];
    return rawIds.map((rawId) => {
      const normalized = rawId.replace(/^group_/i, '').toUpperCase();
      const matched = TARGET_AUDIENCE_OPTIONS.find(
        (opt) => opt.id.toUpperCase() === normalized || opt.id.toUpperCase() === rawId.toUpperCase()
      );
      const isFrontline =
        normalized.startsWith('C') || normalized.startsWith('D') || normalized.startsWith('E');
      return {
        id: matched?.id || normalized,
        label: matched ? matched.label.replace(/^[A-E1-4]+\s*-\s*/i, '') : rawId,
        fullLabel: matched?.label || rawId,
        isFrontline,
      };
    });
  }, [proposal.targetAudiences]);

  const validBudgetItems = useMemo(
    () =>
      (proposal.budgetItems || []).filter(
        (b) => (b.activity && b.activity.trim() !== '') || Number(b.divisionFunding ?? b.gcFunding) > 0
      ),
    [proposal.budgetItems]
  );

  const totalBudget = useMemo(
    () =>
      validBudgetItems.reduce(
        (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      ),
    [validBudgetItems]
  );

  const kpiTheme =
    (selectedKpi && KPI_THEME[selectedKpi.id]) || KPI_THEME.reach_exposure;
  const KpiIcon = (selectedKpi && KPI_ICONS[selectedKpi.id]) || Target;

  const sectionAlignment = useMemo(
    () => getSectionAlignmentAdvisories(proposal, allProposals),
    [proposal, allProposals]
  );
  const getSectionFlags = (id: string) => sectionAlignment.bySection[id] || [];
  const headerFlags = [
    ...getSectionFlags('section-strategic-focus'),
    ...getSectionFlags('section-title'),
  ];
  const kpiFlags = getSectionFlags('section-5-kpi');
  const audienceFlags = getSectionFlags('section-audience');
  const overviewFlags = getSectionFlags('section-overview');
  const goalFlags = getSectionFlags('section-goal');
  const outcomesFlags = getSectionFlags('section-outcomes');
  const deliverablesFlags = getSectionFlags('section-deliverables');
  const integrationFlags = getSectionFlags('section-integration');
  const budgetFlags = getSectionFlags('section-budget');

  // When a Liaison or Step 4 reviewer is on the dedicated review page, unify Alignment Notes
  // with inline Q1–Q7 Rubric checks instead of showing passive author-only banners.
  const showUnifiedLiaisonChecks = Boolean(
    liaisonReview && (liaisonReview.isLiaison || liaisonReview.canVoteStep4)
  );
  const [copiedBridgeId, setCopiedBridgeId] = useState<string | null>(null);

  const handleCopyBridgeNote = async (itemId: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedBridgeId(itemId);
        setTimeout(() => {
          setCopiedBridgeId((prev) => (prev === itemId ? null : prev));
        }, 2000);
      }
    } catch {
      // Clipboard unavailable in restricted browser contexts
    }
  };

  const renderCompactLiaisonAlignmentBridge = (
    items: SmartAdvisoryItem[],
    relatedQuestionKey:
      | 'q1_pillar'
      | 'q2_pathway'
      | 'q3_input'
      | 'q4_activity'
      | 'q5_output'
      | 'q6_handoff'
      | 'q7_continuity',
    questionLabel: string
  ) => {
    if (!items.length || !liaisonReview) return null;
    const isAlreadyFlagged = liaisonReview.selectedDeficientCriteria.includes(relatedQuestionKey);
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50/75 px-3.5 py-2.5 text-xs space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-extrabold text-amber-950 text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              System Alignment Check ({items.length}) · {questionLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {liaisonReview.canEditRubric && (
              <button
                type="button"
                onClick={() =>
                  liaisonReview.setCriterionDeficient(relatedQuestionKey, !isAlreadyFlagged)
                }
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer whitespace-nowrap ${
                  isAlreadyFlagged
                    ? 'bg-amber-700 text-white border-amber-800 hover:bg-amber-800'
                    : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-100'
                }`}
              >
                {isAlreadyFlagged ? `${questionLabel} Flagged ✓` : `Flag ${questionLabel} for Fix`}
              </button>
            )}
            <button
              type="button"
              onClick={() => liaisonReview.scrollToElement('sidebar-step4-card')}
              className="text-[10px] font-bold text-[#1c398e] hover:underline cursor-pointer whitespace-nowrap"
            >
              Step 4 Rubric ↑
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          {items.map((item) => {
            const showCopyableCoachingNote =
              Boolean(item.exampleTemplate) &&
              (item.id === 'intent_objective_mismatch' ||
                item.id === 'intent_hybrid_framing' ||
                item.id === 'kpi_kpi_unit_mismatch');
            return (
              <div key={item.id} className="text-[11px] text-amber-950/90 leading-snug space-y-1">
                <p>
                  <strong className="text-slate-900">{item.title}:</strong> {item.message}
                </p>
                {showCopyableCoachingNote && item.exampleTemplate && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 border border-amber-200/80 px-2.5 py-1.5">
                    <span className="text-[10px] text-slate-700 italic flex-1 min-w-0">
                      {item.exampleTemplate}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyBridgeNote(item.id, item.exampleTemplate!)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 font-bold text-[10px] transition cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      {copiedBridgeId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span className="text-emerald-800">Copied Note</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Copy Suggested Note</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <article className="space-y-8">
      {/* =====================================================================
          0. 6-STEP GOVERNANCE JOURNEY STEPPER (CONNECTED HORIZONTAL PIPELINE)
         ===================================================================== */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
        {/* Header Row: Title & Current Step Status Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              6-Step Governance Pipeline
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
              stepStatus.step5Complete
                ? 'bg-emerald-600 text-white border-emerald-700'
                : stepStatus.liaisonSummary.allLiaisonsVoted
                ? 'bg-amber-100 text-amber-950 border-amber-300'
                : stepStatus.liaisonSummary.hasRevisionRequested
                ? 'bg-amber-100 text-amber-950 border-amber-400'
                : 'bg-indigo-50 text-indigo-900 border-indigo-200'
            }`}
          >
            {stepStatus.step5Complete ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : stepStatus.liaisonSummary.hasRevisionRequested ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            <span>
              Current:{' '}
              {stepStatus.liaisonSummary.hasRevisionRequested
                ? 'Step 4 · Revision Requested'
                : stepStatus.currentStepShortBadge}
            </span>
          </span>
        </div>

        {/* Connected Milestone Stepper (Status on Top -> Circle in Middle -> Title Below) */}
        <div className="relative pt-1 pb-1">
          <div className="grid grid-cols-6 gap-2 relative">
            {/* Step 1: Submitted */}
            <div className="flex flex-col items-center text-center relative group">
              <div className="h-6 flex items-center justify-center mb-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    stepStatus.step1Complete
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                      : 'text-slate-600 bg-slate-100 border border-slate-200'
                  }`}
                >
                  {stepStatus.step1Complete ? 'Passed' : 'Draft'}
                </span>
              </div>
              <div
                className={`absolute top-[2.15rem] left-1/2 w-full h-1 z-0 ${
                  stepStatus.step1Complete ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
              {stepStatus.step1Complete ? (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs relative z-10 ring-4 ring-white">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs shadow-xs relative z-10 ring-4 ring-slate-100">
                  <span>1</span>
                </div>
              )}
              <div className="mt-2 space-y-0.5">
                <span className="text-xs font-black text-slate-900 block leading-tight">
                  1. Submitted
                </span>
              </div>
            </div>

            {/* Step 2: Union Review */}
            <div className="flex flex-col items-center text-center relative group">
              <div className="h-6 flex items-center justify-center mb-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    stepStatus.step3Complete || stepStatus.step2Complete
                      ? proposal.status === 'under_review' && !stepStatus.step3Complete
                        ? 'text-amber-900 bg-amber-100 border border-amber-300'
                        : 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                      : proposal.status === 'submitted'
                      ? 'text-blue-800 bg-blue-50 border border-blue-200'
                      : 'text-slate-500 bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {stepStatus.step3Complete
                    ? stepStatus.step2Skipped
                      ? 'Skipped'
                      : 'Passed'
                    : proposal.status === 'under_review'
                    ? 'In Review'
                    : proposal.status === 'submitted'
                    ? 'Ready'
                    : 'Pending'}
                </span>
              </div>
              <div
                className={`absolute top-[2.15rem] left-1/2 w-full h-1 z-0 ${
                  stepStatus.step3Complete
                    ? 'bg-emerald-500'
                    : proposal.status === 'under_review'
                    ? 'bg-amber-400'
                    : 'bg-slate-200'
                }`}
              />
              {stepStatus.step3Complete ? (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs relative z-10 ring-4 ring-white">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : proposal.status === 'under_review' ? (
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md relative z-10 ring-4 ring-amber-100">
                  <Clock className="w-4 h-4" />
                </div>
              ) : proposal.status === 'submitted' ? (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md relative z-10 ring-4 ring-blue-100">
                  <Clock className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-300 flex items-center justify-center font-bold text-xs relative z-10 ring-4 ring-white">
                  <span>2</span>
                </div>
              )}
              <div className="mt-2 space-y-0.5">
                <span className="text-xs font-black text-slate-900 block leading-tight">
                  2. Union Review
                </span>
              </div>
            </div>

            {/* Step 3: Union Voted */}
            <div className="flex flex-col items-center text-center relative group">
              <div className="h-6 flex items-center justify-center mb-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    stepStatus.step3Complete
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                      : proposal.status === 'under_review' || proposal.status === 'submitted'
                      ? 'text-amber-800 bg-amber-50 border border-amber-200'
                      : 'text-slate-500 bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {stepStatus.step3Complete
                    ? 'Approved'
                    : proposal.status === 'under_review'
                    ? 'Awaiting Vote'
                    : 'Pending'}
                </span>
              </div>
              <div
                className={`absolute top-[2.15rem] left-1/2 w-full h-1 z-0 ${
                  stepStatus.step4Complete ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
              {stepStatus.step3Complete ? (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs relative z-10 ring-4 ring-white">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-300 flex items-center justify-center font-bold text-xs relative z-10 ring-4 ring-white">
                  <span>3</span>
                </div>
              )}
              <div className="mt-2 space-y-0.5">
                <span
                  className={`text-xs font-black block leading-tight ${
                    stepStatus.step3Complete ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  3. Union Voted
                </span>
              </div>
            </div>

            {/* Step 4: Liaison Vote */}
            <div className="flex flex-col items-center text-center relative group">
              {/* 1. Status Pill on Top */}
              <div className="h-6 flex items-center justify-center mb-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    !stepStatus.step3Complete
                      ? 'text-slate-500 bg-slate-100 border border-slate-200/60'
                      : stepStatus.step4Complete
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                      : stepStatus.liaisonSummary.hasRevisionRequested
                      ? 'text-amber-900 bg-amber-100 border border-amber-300'
                      : 'text-indigo-800 bg-indigo-50 border border-indigo-200'
                  }`}
                >
                  {!stepStatus.step3Complete
                    ? 'Pending Step 3'
                    : stepStatus.step4Complete
                    ? 'Recommended'
                    : stepStatus.liaisonSummary.hasRevisionRequested
                    ? 'Revision Req.'
                    : stepStatus.liaisonSummary.assignedCount > 0
                    ? `${stepStatus.liaisonSummary.votedAssignedCount}/${stepStatus.liaisonSummary.assignedCount} Voted`
                    : 'Awaiting Vote'}
                </span>
              </div>
              {/* Connecting Line to Step 5 (Green if Step 5 complete, Amber if ready for OV27, else Slate) */}
              <div
                className={`absolute top-[2.15rem] left-1/2 w-full h-1 z-0 ${
                  stepStatus.step5Complete
                    ? 'bg-emerald-500'
                    : stepStatus.liaisonSummary.allLiaisonsVoted
                    ? 'bg-amber-400'
                    : 'bg-slate-200'
                }`}
              />
              {!stepStatus.step3Complete ? (
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-300 flex items-center justify-center font-bold text-xs relative z-10 ring-4 ring-white">
                  <span>4</span>
                </div>
              ) : stepStatus.step4Complete ? (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs relative z-10 ring-4 ring-white">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : stepStatus.liaisonSummary.hasRevisionRequested ? (
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md relative z-10 ring-4 ring-amber-100">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md relative z-10 ring-4 ring-indigo-100">
                  <Clock className="w-4 h-4" />
                </div>
              )}
              <div className="mt-2 space-y-0.5">
                <span
                  className={`text-xs font-black block leading-tight ${
                    !stepStatus.step3Complete
                      ? 'text-slate-500'
                      : stepStatus.step4Complete
                      ? 'text-slate-900'
                      : stepStatus.liaisonSummary.hasRevisionRequested
                      ? 'text-amber-950'
                      : 'text-indigo-950'
                  }`}
                >
                  4. Liaison Vote
                </span>
              </div>
            </div>

            {/* Step 5: SSD OV27 Committee */}
            <div className="flex flex-col items-center text-center relative group">
              {/* 1. Status Pill on Top */}
              <div className="h-6 flex items-center justify-center mb-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                    stepStatus.step5Complete
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                      : stepStatus.liaisonSummary.allLiaisonsVoted
                      ? 'text-amber-800 bg-amber-50 border border-amber-300'
                      : 'text-slate-500 bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {stepStatus.step5Complete
                    ? 'Authorized ✓'
                    : stepStatus.liaisonSummary.allLiaisonsVoted
                    ? 'Ready to Vote'
                    : 'Pending Step 4'}
                </span>
              </div>
              {/* Connecting Line to Step 6 */}
              <div
                className={`absolute top-[2.15rem] left-1/2 w-full h-1 z-0 ${
                  stepStatus.step5Complete ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
              {/* 2. Node Circle in Middle */}
              {stepStatus.step5Complete ? (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs relative z-10 ring-4 ring-white">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              ) : stepStatus.liaisonSummary.allLiaisonsVoted ? (
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md relative z-10 ring-4 ring-amber-100">
                  <Clock className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-300 flex items-center justify-center font-bold text-xs relative z-10 ring-4 ring-white">
                  <span>5</span>
                </div>
              )}
              {/* 3. Step Title Below (2 lines for institutional clarity) */}
              <div className="mt-2 space-y-0.5">
                <span
                  className={`text-xs font-black block leading-tight ${
                    stepStatus.step5Complete
                      ? 'text-slate-900'
                      : stepStatus.liaisonSummary.allLiaisonsVoted
                      ? 'text-amber-950'
                      : 'text-slate-500'
                  }`}
                >
                  5. SSD OV27
                  <span className="block font-bold text-[11px] text-slate-600">Committee</span>
                </span>
              </div>
            </div>

            {/* Step 6: Base Survey & Evaluation (Unlocks upon Step 5 Authorization) */}
            <div
              className={`flex flex-col items-center text-center relative group ${
                stepStatus.step5Complete && onOpenProgressTab ? 'cursor-pointer' : ''
              }`}
              onClick={() => {
                if (stepStatus.step5Complete && onOpenProgressTab) {
                  onOpenProgressTab();
                }
              }}
              title={
                stepStatus.step5Complete
                  ? 'Step 6 Unlocked: Base Survey & Impact Evaluation ready — click to open Progress tab'
                  : 'Step 6: Base Survey & Impact Reporting (Locked until Step 5 SSD OV27 Committee Authorization)'
              }
            >
              {/* 1. Status Pill on Top */}
              <div className="h-6 flex items-center justify-center mb-2">
                {stepStatus.step5Complete ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Unlock className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Base Survey Ready</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                    <span>Locked</span>
                  </span>
                )}
              </div>
              {/* 2. Node Circle in Middle */}
              {stepStatus.step5Complete ? (
                <div className="w-8 h-8 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold text-xs relative z-10 ring-4 ring-white shadow-xs">
                  <Unlock className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-300 flex items-center justify-center font-bold text-xs relative z-10 ring-4 ring-white shadow-2xs">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </div>
              )}
              {/* 3. Step Title Below */}
              <div className="mt-2 space-y-0.5">
                <span
                  className={`text-xs font-black block leading-tight ${
                    stepStatus.step5Complete ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  6. Base Survey
                  <span
                    className={`block font-semibold text-[11px] ${
                      stepStatus.step5Complete ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    &amp; Evaluation
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          1. EDITORIAL MASTHEAD: STRATEGIC FOCUS, GLOBAL OBJECTIVE & HEADLINE
         ===================================================================== */}
      <header
        id="section-title"
        className={
          headerFlags.length > 0
            ? 'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-5 sm:p-6 space-y-4 transition-all'
            : 'scroll-mt-24 border-b-2 border-slate-900/10 pb-6 space-y-4 transition-all'
        }
      >
        {/* Kicker / Eyebrow Metadata Pills */}
        <div id="section-strategic-focus" className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-slate-900 text-white">
            1. Title &amp; Strategic Scope
          </span>

          {/* Strategic Focus Pillar Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
              matchedPillarInfo?.pillar.number === 1
                ? 'bg-blue-50 text-[#1c398e] border-blue-200'
                : matchedPillarInfo?.pillar.number === 2
                ? 'bg-purple-50 text-purple-900 border-purple-200'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>
              {matchedPillarInfo
                ? `Pillar ${matchedPillarInfo.pillar.number} · ${matchedPillarInfo.pillar.title}`
                : proposal.strategicFocus || 'Strategic Pillar'}
            </span>
          </span>

          {/* Global Objective Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/90">
            <Compass className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              {matchedPillarInfo?.objective
                ? `Objective ${matchedPillarInfo.objective.number} · ${effectiveObjective}`
                : effectiveObjective}
            </span>
          </span>

          {/* Continuity Badge */}
          {proposal.hadSimilarProject2Years && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {proposal.hadSimilarProject2Years === 'yes'
                  ? 'Builds on Prior 2-Year Project'
                  : 'New Initiative'}
              </span>
            </span>
          )}
        </div>

        {/* Magazine Headline (Project Title) */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">
          {proposal.title?.trim() || 'Untitled OneVoice27 Proposal'}
        </h1>

        {(() => {
          const resolvedCode = resolveProposalProjectCode(proposal, 1, {
            allowFallbackSequence: false,
          });
          if (!resolvedCode.projectId && !stepStatus.step5Complete) return null;
          return (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 pt-1">
              <span className="font-mono font-bold text-slate-900">
                {resolvedCode.composite}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>
                {stepStatus.step5Complete ? 'Step 5 Authorized · GC API Sync Ready' : 'Pre-Authorization Project ID'}
              </span>
              {resolvedCode.phase && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>Phase: {resolvedCode.phase}</span>
                </>
              )}
              {resolvedCode.status && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>Status: {resolvedCode.status}</span>
                </>
              )}
            </div>
          );
        })()}

        {headerFlags.length > 0 &&
          (showUnifiedLiaisonChecks ? (
            renderCompactLiaisonAlignmentBridge(headerFlags, 'q1_pillar', 'Q1')
          ) : (
            <SectionAlignmentCallout items={headerFlags} readOnly />
          ))}
      </header>

      {/* Optional Compact Territory Intelligence Strip right beneath the Masthead */}
      {topContextSlot && <div>{topContextSlot}</div>}

      {/* =====================================================================
          5. FULL-WIDTH SELECTED PRIMARY KPI & MEASUREMENT PLAN
         ===================================================================== */}
      <section
        id="section-5-kpi"
        className={
          kpiFlags.length > 0
            ? 'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-5 sm:p-6 space-y-5 shadow-2xs transition-all'
            : `scroll-mt-24 rounded-2xl border ${kpiTheme.border} ${kpiTheme.bg} p-5 sm:p-6 space-y-5 shadow-2xs transition-all`
        }
      >
        {/* Top Label Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-900 text-white font-black text-xs">
              5. Primary KPI
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-slate-500" />
              <span>Selected Primary KPI &amp; Target Goal</span>
            </span>
          </div>
          {selectedKpi && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${kpiTheme.badgeBg} ${kpiTheme.badgeText}`}
            >
              <span>KPI {selectedKpi.number}</span>
              <span>·</span>
              <span>{selectedKpi.title}</span>
            </span>
          )}
        </div>

        {kpiFlags.length > 0 &&
          (showUnifiedLiaisonChecks ? (
            renderCompactLiaisonAlignmentBridge(kpiFlags, 'q2_pathway', 'Q2')
          ) : (
            <SectionAlignmentCallout items={kpiFlags} readOnly />
          ))}

        {/* Selected KPI Banner & Big Target Number */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl ${kpiTheme.iconBg} flex items-center justify-center shrink-0 shadow-xs`}
            >
              <KpiIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900">
                {selectedKpi ? selectedKpi.title : 'Primary KPI Not Specified'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                {selectedKpi ? selectedKpi.focus : 'No primary KPI category selected.'}
              </p>
            </div>
          </div>

          {/* Target Goal Callout */}
          <div className="sm:text-right shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Target Goal
            </p>
            <p className={`text-2xl font-black tabular-nums ${kpiTheme.accentText}`}>
              {parsedKpi.value !== null
                ? parsedKpi.value.toLocaleString()
                : proposal.kpiNumber?.trim() || '—'}
            </p>
            {proposal.kpiNumber &&
              parsedKpi.value !== null &&
              proposal.kpiNumber.trim() !== String(parsedKpi.value) && (
                <p
                  className="text-xs text-slate-500 font-medium max-w-[240px] truncate"
                  title={proposal.kpiNumber}
                >
                  {proposal.kpiNumber}
                </p>
              )}
          </div>
        </div>

        {/* Full-Width Stacked Measurement Plan & Rationale */}
        <div className="space-y-4">
          {proposal.kpiDescription?.trim() && (
            <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/80 space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                How Success Is Measured
              </p>
              <FormattedNarrativeText
                text={proposal.kpiDescription}
                className="text-sm text-slate-800 leading-relaxed"
              />
            </div>
          )}

          {proposal.kpiRationale?.trim() && (
            <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200/80 space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Target Rationale &amp; Local Capacity
              </p>
              <FormattedNarrativeText
                text={proposal.kpiRationale}
                className="text-sm text-slate-800 leading-relaxed"
              />
            </div>
          )}

          {/* Prior 2-Year Baseline Metric (if applicable) */}
          {proposal.hadSimilarProject2Years === 'yes' && proposal.priorProjectMetric?.trim() && (
            <div className="p-4 rounded-xl bg-white/90 border border-slate-200/80 flex items-start gap-2.5 text-sm">
              <History className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Prior 2-Year Baseline Result: </span>
                <span className="text-slate-700">{proposal.priorProjectMetric}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          7. FULL-WIDTH SELECTED TARGET AUDIENCE(S)
         ===================================================================== */}
      <section
        id="section-audience"
        className={
          audienceFlags.length > 0
            ? 'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-5 sm:p-6 space-y-4 shadow-2xs transition-all'
            : 'scroll-mt-24 rounded-2xl border border-slate-200/90 bg-[#f8fafc] p-5 sm:p-6 space-y-4 shadow-2xs transition-all'
        }
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-900 text-white font-black text-xs">
              7. Target Audience
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#1c398e]" />
              <span>Selected Target Audience Segments</span>
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200/80 text-slate-800">
            {selectedAudiences.length}{' '}
            {selectedAudiences.length === 1 ? 'Segment Selected' : 'Segments Selected'}
          </span>
        </div>

        {audienceFlags.length > 0 &&
          (showUnifiedLiaisonChecks ? (
            renderCompactLiaisonAlignmentBridge(audienceFlags, 'q3_input', 'Q3')
          ) : (
            <SectionAlignmentCallout items={audienceFlags} readOnly />
          ))}

        {selectedAudiences.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedAudiences.map((aud) => (
              <div
                key={aud.id}
                className={`p-4 rounded-xl border bg-white flex items-start gap-3.5 shadow-2xs ${
                  aud.isFrontline ? 'border-emerald-200/90' : 'border-blue-200/90'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                    aud.isFrontline
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#1c398e] text-white'
                  }`}
                >
                  {aud.id}
                </span>
                <div className="min-w-0 flex-1">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                      aud.isFrontline ? 'text-emerald-700' : 'text-[#1c398e]'
                    }`}
                  >
                    {aud.isFrontline
                      ? 'Frontline Public Outreach (C–D–E)'
                      : 'Church Equipping & Leadership (A–B)'}
                  </span>
                  <p className="text-sm font-bold text-slate-900 leading-snug mt-0.5">
                    {aud.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-400 italic text-center">
            No target audience segments selected.
          </div>
        )}

        {/* Full-Width Audience E / Segment Details */}
        {proposal.audienceEDetails?.trim() && (
          <div className="p-4 sm:p-5 rounded-xl bg-white border border-emerald-200/90 space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-700" />
              <span>Audience Focus &amp; Segment Details</span>
            </p>
            <FormattedNarrativeText
              text={proposal.audienceEDetails}
              className="text-sm text-slate-800 leading-relaxed"
            />
          </div>
        )}
      </section>

      {/* =====================================================================
          NARRATIVE STORY SECTIONS (MATCHING FORM NUMBERS 2, 3, 4, 6, 8)
         ===================================================================== */}
      <section className="space-y-5">
        {/* 2. Overview */}
        <div
          id="section-overview"
          className={
            overviewFlags.length > 0
              ? 'scroll-mt-24 p-6 rounded-2xl bg-amber-50/45 border-2 border-amber-300 shadow-2xs space-y-3 transition-all'
              : 'scroll-mt-24 p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3 transition-all'
          }
        >
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-[#1c398e] font-extrabold text-xs flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
              2. Overview — Project Concept &amp; Context
            </h3>
          </div>
          {overviewFlags.length > 0 &&
            (showUnifiedLiaisonChecks ? (
              renderCompactLiaisonAlignmentBridge(overviewFlags, 'q3_input', 'Q3')
            ) : (
              <SectionAlignmentCallout items={overviewFlags} readOnly />
            ))}
          {proposal.overview?.trim() ? (
            <FormattedNarrativeText
              text={proposal.overview}
              className="text-sm text-slate-800 leading-relaxed"
            />
          ) : (
            <p className="text-xs text-slate-400 italic">No overview provided.</p>
          )}
        </div>

        {/* 3. Project Goal */}
        <div
          id="section-goal"
          className={
            goalFlags.length > 0
              ? 'scroll-mt-24 p-6 rounded-2xl bg-amber-50/45 border-2 border-amber-300 shadow-2xs space-y-3 transition-all'
              : 'scroll-mt-24 p-6 rounded-2xl bg-[#f8fafc] border border-slate-200/90 shadow-2xs space-y-3 transition-all'
          }
        >
          <div className="flex items-center gap-2.5 border-b border-slate-200/70 pb-3">
            <span className="w-7 h-7 rounded-lg bg-[#1c398e] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
              3. Project Goal — Primary Direction
            </h3>
          </div>
          {goalFlags.length > 0 &&
            (showUnifiedLiaisonChecks ? (
              renderCompactLiaisonAlignmentBridge(goalFlags, 'q4_activity', 'Q4')
            ) : (
              <SectionAlignmentCallout items={goalFlags} readOnly />
            ))}
          {proposal.goal?.trim() ? (
            <FormattedNarrativeText
              text={proposal.goal}
              className="text-sm font-medium text-slate-900 leading-relaxed"
            />
          ) : (
            <p className="text-xs text-slate-400 italic">No project goal provided.</p>
          )}
        </div>

        {/* 4. Outcomes */}
        <div
          id="section-outcomes"
          className={
            outcomesFlags.length > 0
              ? 'scroll-mt-24 p-6 rounded-2xl bg-amber-50/45 border-2 border-amber-300 shadow-2xs space-y-3 transition-all'
              : 'scroll-mt-24 p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3 transition-all'
          }
        >
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold text-xs flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
              4. Outcomes — Expected Impact &amp; Change
            </h3>
          </div>
          {outcomesFlags.length > 0 &&
            (showUnifiedLiaisonChecks ? (
              renderCompactLiaisonAlignmentBridge(outcomesFlags, 'q5_output', 'Q5')
            ) : (
              <SectionAlignmentCallout items={outcomesFlags} readOnly />
            ))}
          {proposal.outcomes?.trim() ? (
            <FormattedNarrativeText
              text={proposal.outcomes}
              className="text-sm text-slate-800 leading-relaxed"
            />
          ) : (
            <p className="text-xs text-slate-400 italic">No outcomes listed.</p>
          )}
        </div>

        {/* 6. Project Deliverables */}
        <div
          id="section-deliverables"
          className={
            deliverablesFlags.length > 0
              ? 'scroll-mt-24 p-6 rounded-2xl bg-amber-50/45 border-2 border-amber-300 shadow-2xs space-y-3 transition-all'
              : 'scroll-mt-24 p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3 transition-all'
          }
        >
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-[#1c398e] font-extrabold text-xs flex items-center justify-center shrink-0">
              <PackageCheck className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
              6. Project Deliverables
            </h3>
          </div>
          {deliverablesFlags.length > 0 &&
            (showUnifiedLiaisonChecks ? (
              renderCompactLiaisonAlignmentBridge(deliverablesFlags, 'q4_activity', 'Q4')
            ) : (
              <SectionAlignmentCallout items={deliverablesFlags} readOnly />
            ))}
          {proposal.deliverables?.trim() ? (
            <FormattedNarrativeText
              text={proposal.deliverables}
              className="text-sm text-slate-800 leading-relaxed"
            />
          ) : (
            <p className="text-xs text-slate-400 italic">No deliverables listed.</p>
          )}
        </div>

        {/* 8. Points of Integration */}
        <div
          id="section-integration"
          className={
            integrationFlags.length > 0
              ? 'scroll-mt-24 p-6 rounded-2xl bg-amber-50/45 border-2 border-amber-300 shadow-2xs space-y-3 transition-all'
              : 'scroll-mt-24 p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3 transition-all'
          }
        >
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 font-extrabold text-xs flex items-center justify-center shrink-0">
              <Network className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
              8. Points of Integration &amp; Local Church Handoff
            </h3>
          </div>
          {integrationFlags.length > 0 &&
            (showUnifiedLiaisonChecks ? (
              renderCompactLiaisonAlignmentBridge(integrationFlags, 'q6_handoff', 'Q6')
            ) : (
              <SectionAlignmentCallout items={integrationFlags} readOnly />
            ))}
          {proposal.pointsOfIntegration?.trim() ? (
            <FormattedNarrativeText
              text={proposal.pointsOfIntegration}
              className="text-sm text-slate-800 leading-relaxed"
            />
          ) : (
            <p className="text-xs text-slate-400 italic">No integration details listed.</p>
          )}
        </div>
      </section>

      {/* =====================================================================
          9. APPROVED FINANCIAL SCHEDULE & BUDGET LEDGER
         ===================================================================== */}
      <section
        id="section-budget"
        className={
          budgetFlags.length > 0
            ? 'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/35 overflow-hidden shadow-2xs transition-all'
            : 'scroll-mt-24 rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs transition-all'
        }
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-tight text-white">
                {stepStatus.step3Complete
                  ? '9. Budget Plan — Approved Financial Schedule'
                  : '9. Budget Plan — Requested Financial Schedule'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {validBudgetItems.length}{' '}
                {validBudgetItems.length === 1 ? 'activity line item' : 'activity line items'}
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
              {stepStatus.step3Complete ? 'Total Approved Grant' : 'Total Requested Grant'}
            </span>
            <span className="text-xl font-black tabular-nums text-white">
              ${formatCurrency(totalBudget)}
            </span>
          </div>
        </div>

        {budgetFlags.length > 0 && (
          <div className="p-4 sm:p-5 border-b border-amber-200/80 bg-amber-50/55">
            {showUnifiedLiaisonChecks ? (
              renderCompactLiaisonAlignmentBridge(budgetFlags, 'q1_pillar', 'Q1')
            ) : (
              <SectionAlignmentCallout items={budgetFlags} readOnly />
            )}
          </div>
        )}

        {/* 100% Proposal Share Breakdown · Pool Formula Attribution */}
        {totalBudget > 0 && (
          <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white">
            <ProposalShareBreakdownCard proposal={proposal} allProposals={allProposals} />
          </div>
        )}

        {validBudgetItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/90 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Activity / Budget Item Description</th>
                  <th className="py-3 px-4 w-32 text-right">Share</th>
                  <th className="py-3 px-6 w-40 text-right">Approved Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {validBudgetItems.map((item, idx) => {
                  const amount = Number(item.divisionFunding ?? item.gcFunding) || 0;
                  const sharePct = totalBudget > 0 ? (amount / totalBudget) * 100 : 0;
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400 tabular-nums text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 leading-relaxed">
                        {item.activity || 'Unspecified budget activity'}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums">
                        <div className="inline-flex items-center gap-2 justify-end w-full">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-[#1c398e] rounded-full"
                              style={{ width: `${Math.min(100, sharePct)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-500">
                            {sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-right font-extrabold text-slate-900 tabular-nums">
                        ${formatCurrency(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/60 border-t-2 border-emerald-200/80">
                  <td colSpan={2} className="py-3.5 px-6 text-xs font-extrabold text-emerald-950">
                    Total Approved OneVoice27 Project Grant
                  </td>
                  <td className="py-3.5 px-4 text-right text-xs font-bold text-emerald-800 tabular-nums">
                    100%
                  </td>
                  <td className="py-3.5 px-6 text-right text-sm font-black text-emerald-950 tabular-nums">
                    ${formatCurrency(totalBudget)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 italic">
            No budget line items recorded.
          </div>
        )}
      </section>
    </article>
  );
}
