import React, { useState, useMemo } from 'react';
import {
  Proposal,
  KPIType,
  KPI_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  STRATEGIC_FOCUS_OPTIONS,
  DIVISION_PROJECT_OPTIONS,
  DIVISION_PROJECTS_BY_FOCUS,
  getCanonicalDivisionProject,
  getCanonicalKpiType,
  getAllowedKPIsForObjective,
} from '../../types';
import { parseKpiTargetNumber } from '../../utils/kpiExtraction';
import {
  analyzeAudienceContradictions,
  analyzeTargetGoalClarity,
  analyzeNarrativeDepth,
  getSectionAlignmentAdvisories,
  SmartAdvisoryItem,
  PLAYBOOK_INTEGRATION_PARTNERS,
  PLAYBOOK_DELIVERABLE_PROMPTS,
  PLAYBOOK_PATHWAY_BY_KPI,
  PLAYBOOK_SENSITIVE_AREA_GUIDE,
} from '../../utils/proposalSmartAdvisor';
import {
  hasFlattenedPastedTable,
  compactFlattenedTableText,
  FormattedNarrativeText,
} from '../../utils/narrativeFormatter';
import { evaluateProposalUnionIntelligence } from '../../data/unionIntelligence';
import { detectBridgingProposalContext } from '../../data/bridgingEventsGuide';
import { ApprovedProposalIntelligence } from '../../utils/approvedProposalIntelligence';
import { getActiveLiaisonActionItems } from '../../utils/projectReviewFramework';
import { BridgingEventsIdeaBuilder } from './BridgingEventsIdeaBuilder';
import {
  SectionAlignmentCallout,
  getFlaggedSectionClass,
} from './SectionAlignmentCallout';
import {
  Check,
  HelpCircle,
  Radio,
  MessageSquare,
  MapPin,
  HeartHandshake,
  Wrench,
  Target,
  Info,
  AlertTriangle,
  Filter,
  Plus,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
} from 'lucide-react';

const KPI_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  reach_exposure: Radio,
  engagement_participation: MessageSquare,
  connection_next_steps: MapPin,
  retention_nurturing: HeartHandshake,
  implementation_capability: Wrench,
};

const KPI_BADGE_STYLES: Record<string, { badge: string; border: string; selectedBg: string }> = {
  reach_exposure: {
    badge: 'bg-sky-50 text-sky-800 border-sky-200',
    border: 'border-sky-600',
    selectedBg: 'bg-sky-50/50',
  },
  engagement_participation: {
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    border: 'border-indigo-600',
    selectedBg: 'bg-indigo-50/50',
  },
  connection_next_steps: {
    badge: 'bg-purple-50 text-purple-800 border-purple-200',
    border: 'border-purple-600',
    selectedBg: 'bg-purple-50/50',
  },
  retention_nurturing: {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    border: 'border-emerald-600',
    selectedBg: 'bg-emerald-50/50',
  },
  implementation_capability: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    border: 'border-amber-600',
    selectedBg: 'bg-amber-50/50',
  },
};

export interface ProposalNarrativeSectionProps {
  proposal: Proposal;
  allProposals?: Proposal[];
  approvedIntelligence?: ApprovedProposalIntelligence | null;
  isFormLocked?: boolean;
  onChange: (updated: Partial<Proposal>) => void;
  onExecuteQuickAction?: (item: SmartAdvisoryItem) => void;
  onOpenFaqTopic?: (topic: string) => void;
}

export function ProposalNarrativeSection({
  proposal,
  allProposals,
  approvedIntelligence,
  isFormLocked = false,
  onChange,
  onExecuteQuickAction,
  onOpenFaqTopic,
}: ProposalNarrativeSectionProps) {
  const [showApprovedExemplars, setShowApprovedExemplars] = useState(false);
  const [showDeliverableChips, setShowDeliverableChips] = useState(false);
  const [showBridgingBuilder, setShowBridgingBuilder] = useState(false);
  const [showPartnerChips, setShowPartnerChips] = useState(false);
  const bridgingContext = useMemo(() => detectBridgingProposalContext(proposal), [proposal]);
  // Handle Strategic Focus change and dynamically filter Division Projects
  const handleStrategicFocusChange = (newFocus: string) => {
    if (isFormLocked) return;
    const validProjects = newFocus ? DIVISION_PROJECTS_BY_FOCUS[newFocus] || [] : [];
    const canonicalProj = getCanonicalDivisionProject(proposal.divisionProject);
    const isStillValid =
      validProjects.includes(canonicalProj) || validProjects.includes(proposal.divisionProject);
    onChange({
      strategicFocus: newFocus,
      ...(isStillValid
        ? { divisionProject: canonicalProj }
        : { divisionProject: '', otherDivisionProject: '' }),
    });
  };

  // Division projects filtered by Strategic Focus
  const availableDivisionProjects =
    proposal.strategicFocus && DIVISION_PROJECTS_BY_FOCUS[proposal.strategicFocus]
      ? DIVISION_PROJECTS_BY_FOCUS[proposal.strategicFocus]
      : DIVISION_PROJECT_OPTIONS;

  // KPI selection (Strictly 1 KPI per proposal per Requirement 3)
  const handleSelectKPI = (kpiId: KPIType) => {
    if (isFormLocked) return;
    onChange({
      kpiType: proposal.kpiType === kpiId ? '' : kpiId,
    });
  };

  // Target audience toggle (Max 3 selection per OneVoice27 guidelines)
  const [showAudienceLimitAlert, setShowAudienceLimitAlert] = useState(false);

  const handleToggleAudience = (audienceId: string) => {
    if (isFormLocked) return;
    const exists = proposal.targetAudiences.includes(audienceId);
    let updated: string[];
    if (exists) {
      setShowAudienceLimitAlert(false);
      updated = proposal.targetAudiences.filter((id) => id !== audienceId);
      onChange({ targetAudiences: updated });
    } else {
      if (proposal.targetAudiences.length >= 3) {
        setShowAudienceLimitAlert(true);
        return;
      }
      setShowAudienceLimitAlert(false);
      updated = [...proposal.targetAudiences, audienceId];
      onChange({ targetAudiences: updated });
    }
  };

  // Smart quick-add or swap audience for Contradiction resolution
  const handleSmartIncludeAudience = (audienceId: string) => {
    if (isFormLocked) return;
    if (proposal.targetAudiences.includes(audienceId)) return;
    if (proposal.targetAudiences.length < 3) {
      setShowAudienceLimitAlert(false);
      onChange({ targetAudiences: [...proposal.targetAudiences, audienceId] });
    } else {
      const kept = proposal.targetAudiences.slice(0, 2);
      setShowAudienceLimitAlert(false);
      onChange({ targetAudiences: [...kept, audienceId] });
    }
  };

  const isAudienceESelected =
    proposal.targetAudiences.includes('E') || proposal.targetAudiences.includes('group_e');
  const isLegacyAudienceExceeded = proposal.targetAudiences.length > 3;
  const selectedKpiObj = KPI_OPTIONS.find((k) => k.id === proposal.kpiType);

  // Dynamic KPI filtering based on selected Global Objective (Option B)
  const canonicalProject = getCanonicalDivisionProject(proposal.divisionProject);
  const canonicalKpi = getCanonicalKpiType(proposal.kpiType);
  const allowedKpiIds = getAllowedKPIsForObjective(canonicalProject);
  const hasObjective = Boolean(canonicalProject || proposal.divisionProject);

  // Playbook Stage Guide for the currently selected KPI
  const playbookStageGuide = useMemo(() => {
    if (!canonicalKpi) return null;
    return PLAYBOOK_PATHWAY_BY_KPI[canonicalKpi] || null;
  }, [canonicalKpi]);

  // Safe backward compatibility: check if existing/historical proposal has a mismatched KPI
  const isLegacyMismatch = Boolean(
    hasObjective && proposal.kpiType && !allowedKpiIds.includes(canonicalKpi)
  );

  const parsedKpiTarget = useMemo(() => {
    return parseKpiTargetNumber(proposal.kpiNumber, proposal.kpiDescription, proposal.kpiType);
  }, [proposal.kpiNumber, proposal.kpiDescription, proposal.kpiType]);

  // Smart Advisors
  const audienceContradiction = useMemo(
    () => analyzeAudienceContradictions(proposal),
    [
      proposal.title,
      proposal.overview,
      proposal.goal,
      proposal.outcomes,
      proposal.deliverables,
      proposal.kpiDescription,
      proposal.kpiRationale,
      proposal.divisionProject,
      proposal.kpiType,
      proposal.targetAudiences,
    ]
  );

  const targetGoalClarity = useMemo(
    () => analyzeTargetGoalClarity(proposal),
    [proposal.kpiNumber, proposal.kpiType, proposal.divisionProject]
  );

  const narrativeDepth = useMemo(
    () => analyzeNarrativeDepth(proposal),
    [proposal.overview, proposal.goal, proposal.outcomes, proposal.pointsOfIntegration]
  );

  const sectionAlignment = useMemo(
    () => getSectionAlignmentAdvisories(proposal, allProposals),
    [proposal, allProposals]
  );

  const getSectionFlags = (sectionId: string) => sectionAlignment.bySection[sectionId] || [];

  const renderSectionAlignmentCallout = (sectionId: string) => {
    const flags = getSectionFlags(sectionId);
    if (flags.length === 0) return null;
    return (
      <SectionAlignmentCallout
        items={flags}
        isFormLocked={isFormLocked}
        onQuickAction={onExecuteQuickAction}
      />
    );
  };

  const unionIntel = useMemo(
    () => evaluateProposalUnionIntelligence(proposal),
    [proposal]
  );

  const isPillar1Training =
    canonicalProject === 'Regional Media Evangelism & Creators Conferences' ||
    canonicalKpi === 'implementation_capability';

  const isCommunityInPersonEvent =
    !isPillar1Training &&
    (bridgingContext.isBridgingHostProposal ||
      canonicalKpi === 'connection_next_steps' ||
      canonicalProject === 'Proclamation & Harvesting Initiatives');

  // Filter Deliverable Prompts relevant to current Objective, KPI & Event context
  const relevantDeliverablePrompts = useMemo(() => {
    return PLAYBOOK_DELIVERABLE_PROMPTS.filter((p) => {
      if (
        (proposal.deliverables || '')
          .toLowerCase()
          .includes(p.snippet.slice(0, 22).toLowerCase())
      ) {
        return false;
      }
      if (canonicalProject && p.excludedObjectives?.includes(canonicalProject)) {
        return false;
      }
      if (canonicalKpi && p.excludedKpis?.includes(canonicalKpi)) {
        return false;
      }
      if (isPillar1Training && (p.id === 'community_events_rsvp' || p.id === 'content_repository' || p.id === 'cta_and_response_route')) {
        return false;
      }
      if (isCommunityInPersonEvent && (p.id === 'content_repository' || p.id === 'cta_and_response_route')) {
        return false;
      }
      if (p.id === 'community_events_rsvp') {
        return isCommunityInPersonEvent || Boolean(canonicalProject && p.applicableObjectives.includes(canonicalProject) && !p.applicableKpis);
      }
      if (!canonicalProject) return true;
      return p.applicableObjectives.includes(canonicalProject);
    });
  }, [
    canonicalProject,
    canonicalKpi,
    proposal.deliverables,
    isPillar1Training,
    isCommunityInPersonEvent,
  ]);

  // Filter & sort Integration Partners so mismatched HopeStartsHere modes never appear (e.g. no public website events in Pillar 1, no Content Repository on KPI 3 events)
  const sortedIntegrationPartners = useMemo(() => {
    const visiblePartners = PLAYBOOK_INTEGRATION_PARTNERS.filter((p) => {
      if (canonicalProject && p.excludedObjectives?.includes(canonicalProject)) return false;
      if (canonicalKpi && p.excludedKpis?.includes(canonicalKpi)) return false;
      if (isPillar1Training && (p.id === 'hopestartshere_events_rsvp' || p.id === 'hopestartshere_content_repository')) {
        return false;
      }
      if (isCommunityInPersonEvent && p.id === 'hopestartshere_content_repository') {
        return false;
      }
      if (!isCommunityInPersonEvent && p.id === 'hopestartshere_events_rsvp' && canonicalProject && !p.recommendedObjectives.includes(canonicalProject) && !p.recommendedKpis.includes(canonicalKpi)) {
        return false;
      }
      return true;
    });

    return visiblePartners.sort((a, b) => {
      const aRec =
        (isCommunityInPersonEvent && a.id === 'hopestartshere_events_rsvp') ||
        (canonicalProject && a.recommendedObjectives.includes(canonicalProject)) ||
        (canonicalKpi && a.recommendedKpis.includes(canonicalKpi));
      const bRec =
        (isCommunityInPersonEvent && b.id === 'hopestartshere_events_rsvp') ||
        (canonicalProject && b.recommendedObjectives.includes(canonicalProject)) ||
        (canonicalKpi && b.recommendedKpis.includes(canonicalKpi));
      if (aRec && !bRec) return -1;
      if (!aRec && bRec) return 1;
      return 0;
    });
  }, [canonicalProject, canonicalKpi, isPillar1Training, isCommunityInPersonEvent]);

  // Apply smart KPI target fix (sets single number in Target Goal and moves math/details to Metric Details)
  const handleApplySmartKpiFix = (newTarget: string, detailToMove?: string) => {
    const existingDetails = (proposal.kpiDescription || '').trim();
    const updatedDetails = detailToMove
      ? existingDetails
        ? existingDetails.includes(detailToMove)
          ? existingDetails
          : `${existingDetails}\n${detailToMove}`
        : detailToMove
      : existingDetails;

    onChange({
      kpiNumber: newTarget,
      kpiDescription: updatedDetails,
    });
  };

  // Append Deliverable snippet
  const handleAddDeliverableSnippet = (snippet: string) => {
    const current = (proposal.deliverables || '').trim();
    const updated = current ? `${current}\n• ${snippet}` : `• ${snippet}`;
    onChange({ deliverables: updated });
  };

  // Append Group E Sensitive Area / Contextualization snippet
  const handleAddAudienceESnippet = (text: string) => {
    const current = (proposal.audienceEDetails || '').trim();
    if (current.includes(text.slice(0, 25))) return;
    const updated = current ? `${current}\n\n${text}` : text;
    onChange({ audienceEDetails: updated });
  };

  // Add Integration Partner snippet
  const handleAddIntegrationPartner = (snippet: string) => {
    const current = (proposal.pointsOfIntegration || '').trim();
    const updated = current ? `${current}\n• ${snippet}` : `• ${snippet}`;
    onChange({ pointsOfIntegration: updated });
  };

  // Calculate visible KPIs:
  const visibleKpis = useMemo(() => {
    if (!hasObjective) {
      return KPI_OPTIONS;
    }
    return KPI_OPTIONS.filter((kpi) => {
      if (allowedKpiIds.includes(kpi.id)) return true;
      if (isLegacyMismatch && (proposal.kpiType === kpi.id || canonicalKpi === kpi.id)) return true;
      return false;
    });
  }, [hasObjective, allowedKpiIds, isLegacyMismatch, proposal.kpiType, canonicalKpi]);

  const renderSentenceCounter = (count: number) => {
    if (count === 0) return null;
    const isOptimal = count >= 5 && count <= 11;
    const isShort = count < 3;
    return (
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
          isOptimal
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : isShort
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}
      >
        {count} {count === 1 ? 'sentence' : 'sentences'}
        {isShort ? ' (aim for 7–10 sentences)' : isOptimal ? ' (good depth)' : ''}
      </span>
    );
  };

  const renderReadOnlyNarrativeCard = (value?: string, fallbackText = 'No details provided.') => (
    <div className="w-full px-4 py-3 rounded-xl bg-[#f8fafc] border border-slate-200/90 text-sm text-slate-800 leading-relaxed select-text">
      <FormattedNarrativeText text={value} fallback={fallbackText} />
    </div>
  );

  const activeLiaisonActions = useMemo(
    () => getActiveLiaisonActionItems(proposal),
    [proposal]
  );

  const renderSectionLiaisonCallout = (sectionId: string) => {
    if (!activeLiaisonActions) return null;
    const matching = activeLiaisonActions.items.filter((it) => it.sectionId === sectionId);
    if (matching.length === 0) return null;
    return (
      <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-bold text-amber-950">
            Division Liaison Revision Request ({activeLiaisonActions.authorName})
          </span>
          <span className="text-[11px] font-semibold text-amber-800">
            {matching.map((m) => `Q${m.questionNumber}`).join(', ')}
          </span>
        </div>
        <div className="space-y-1">
          {matching.map((item) => (
            <p key={item.criterionKey} className="text-slate-800 leading-relaxed">
              <strong className="text-slate-900">{item.shortTitle}:</strong> {item.instruction}
            </p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* ========================================================================= */}
      {/* STRATEGIC FOCUS & DIVISION PROJECT DROPDOWNS */}
      {/* ========================================================================= */}
      <div
        id="section-strategic-focus"
        className={getFlaggedSectionClass(
          getSectionFlags('section-strategic-focus').length > 0,
          'space-y-5 pt-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-5 transition-all'
        )}
      >
        {renderSectionAlignmentCallout('section-strategic-focus')}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-2">Strategic Focus</label>
          <select
            disabled={isFormLocked}
            value={proposal.strategicFocus}
            onChange={(e) => handleStrategicFocusChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 text-sm text-slate-800 outline-none transition cursor-pointer disabled:cursor-default disabled:bg-[#f8fafc] disabled:opacity-100"
          >
            <option value="">— Select Strategic Focus —</option>
            {STRATEGIC_FOCUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-900 mb-2">Global Objective</label>
          <select
            disabled={isFormLocked}
            value={getCanonicalDivisionProject(proposal.divisionProject)}
            onChange={(e) => {
              if (isFormLocked) return;
              const val = e.target.value;
              let autoFocus = proposal.strategicFocus;
              if (val) {
                const foundFocus = Object.entries(DIVISION_PROJECTS_BY_FOCUS).find(([_, list]) =>
                  list.includes(val)
                )?.[0];
                if (
                  foundFocus &&
                  (!autoFocus || !DIVISION_PROJECTS_BY_FOCUS[autoFocus]?.includes(val))
                ) {
                  autoFocus = foundFocus;
                }
              }
              onChange({
                divisionProject: val,
                ...(autoFocus !== proposal.strategicFocus ? { strategicFocus: autoFocus } : {}),
                otherDivisionProject: '',
              });
            }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 text-sm text-slate-800 outline-none transition cursor-pointer disabled:cursor-default disabled:bg-[#f8fafc] disabled:opacity-100"
          >
            <option value="">— Select Global Objective —</option>
            {availableDivisionProjects.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Collapsible Approved SSD Exemplars & Peer Benchmark Card */}
        {approvedIntelligence &&
          approvedIntelligence.totalSsdApprovedCount > 0 &&
          approvedIntelligence.exemplars.length > 0 && (
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/50 overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setShowApprovedExemplars((prev) => !prev)}
                className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-emerald-100/50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-xs font-bold text-emerald-950">
                    Approved SSD Peer Benchmarks:{' '}
                    {approvedIntelligence.isObjectiveSpecific
                      ? `${approvedIntelligence.matchingObjectiveApprovedCount} Approved in "${approvedIntelligence.scopeLabel}"`
                      : `${approvedIntelligence.totalSsdApprovedCount} Approved across SSD`}
                  </span>
                  {approvedIntelligence.avgApprovedGrant > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-white text-emerald-900 border border-emerald-200 text-[10px] font-bold">
                      Avg Grant: US${approvedIntelligence.avgApprovedGrant.toLocaleString()} •{' '}
                      {approvedIntelligence.avgBudgetLineCount} Budget Lines
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 shrink-0">
                  <span>{showApprovedExemplars ? 'Hide Exemplars' : 'View Approved Examples'}</span>
                  {showApprovedExemplars ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>

              {showApprovedExemplars && (
                <div className="px-4 pb-3.5 pt-2 border-t border-emerald-200/70 space-y-2">
                  <p className="text-[11px] text-emerald-900">
                    Reference examples from committee-approved proposals in{' '}
                    <strong>{approvedIntelligence.scopeLabel}</strong>:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {approvedIntelligence.exemplars.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-2.5 rounded-xl bg-white border border-emerald-200/80 space-y-1.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px] mr-1.5">
                              {ex.unionAcronym}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">{ex.title}</span>
                          </div>
                          {ex.totalGrant > 0 && (
                            <span className="font-extrabold text-[#1c398e] text-[11px] shrink-0">
                              US${ex.totalGrant.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                            {ex.kpiShortLabel}: {ex.formattedTarget}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                            {ex.budgetLineCount}{' '}
                            {ex.budgetLineCount === 1 ? 'Budget Line' : 'Budget Lines'}
                          </span>
                          {ex.targetAudiences.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 font-semibold text-blue-900">
                              Audience: {ex.targetAudiences.join(', ')}
                            </span>
                          )}
                        </div>
                        {ex.budgetActivities.length > 0 && (
                          <p className="text-[10px] text-slate-500 truncate">
                            <strong>Budget items:</strong> {ex.budgetActivities.join(' • ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

      {/* ========================================================================= */}
      {/* 1. TITLE */}
      {/* ========================================================================= */}
      <div
        id="section-title"
        className={getFlaggedSectionClass(
          getSectionFlags('section-title').length > 0,
          'space-y-2 pt-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-2.5 transition-all'
        )}
      >
        <label className="block text-base font-bold text-slate-900">1. Title</label>
        <p className="text-xs text-slate-500">What are you calling this project?</p>
        {renderSectionAlignmentCallout('section-title')}
        {isFormLocked ? (
          renderReadOnlyNarrativeCard(proposal.title, 'Untitled Proposal')
        ) : (
          <input
            type="text"
            placeholder="Type here..."
            value={proposal.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition"
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. OVERVIEW */}
      {/* ========================================================================= */}
      <div
        id="section-overview"
        className={getFlaggedSectionClass(
          getSectionFlags('section-overview').length > 0,
          'space-y-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-2.5 transition-all'
        )}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="block text-base font-bold text-slate-900">2. Overview</label>
          {renderSentenceCounter(narrativeDepth.overviewSentences)}
        </div>
        <p className="text-xs text-slate-500">
          Summarize the project and why it matters (max 7–10 sentences).
        </p>
        {renderSectionAlignmentCallout('section-overview')}
        {isFormLocked ? (
          renderReadOnlyNarrativeCard(proposal.overview)
        ) : (
          <textarea
            rows={4}
            placeholder="Type here..."
            value={proposal.overview}
            onChange={(e) => onChange({ overview: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition resize-y"
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. GOAL OF THE PROJECT */}
      {/* ========================================================================= */}
      <div
        id="section-goal"
        className={getFlaggedSectionClass(
          getSectionFlags('section-goal').length > 0,
          'space-y-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-2.5 transition-all'
        )}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="block text-base font-bold text-slate-900">3. Project Goal</label>
          {renderSentenceCounter(narrativeDepth.goalSentences)}
        </div>
        <p className="text-xs text-slate-500">
          State what this project aims to execute (max 7–10 sentences).
        </p>
        {renderSectionAlignmentCallout('section-goal')}
        {isFormLocked ? (
          renderReadOnlyNarrativeCard(proposal.goal)
        ) : (
          <textarea
            rows={4}
            placeholder="Type here..."
            value={proposal.goal}
            onChange={(e) => onChange({ goal: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition resize-y"
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. OUTCOMES */}
      {/* ========================================================================= */}
      <div
        id="section-outcomes"
        className={getFlaggedSectionClass(
          getSectionFlags('section-outcomes').length > 0,
          'space-y-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-2.5 transition-all'
        )}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="block text-base font-bold text-slate-900">4. Outcomes</label>
          {renderSentenceCounter(narrativeDepth.outcomesSentences)}
        </div>
        <p className="text-xs text-slate-500">
          Describe the resulting community or spiritual impact (max 7–10 sentences).
        </p>
        {renderSectionAlignmentCallout('section-outcomes')}
        {isFormLocked ? (
          renderReadOnlyNarrativeCard(proposal.outcomes)
        ) : (
          <textarea
            rows={4}
            placeholder="Type here..."
            value={proposal.outcomes}
            onChange={(e) => onChange({ outcomes: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition resize-y"
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. KEY MEASUREMENT OF SUCCESS (Only 1 KPI per proposal) */}
      {/* ========================================================================= */}
      <div
        id="section-5-kpi"
        className={getFlaggedSectionClass(
          getSectionFlags('section-5-kpi').length > 0,
          'space-y-4 pt-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-4 transition-all'
        )}
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-900">5. Primary KPI</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Select 1
              </span>
            </div>

            {hasObjective ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200">
                <Filter className="w-3.5 h-3.5 text-blue-700" />
                <span>
                  Aligned with <strong>{canonicalProject}</strong> ({allowedKpiIds.length}{' '}
                  {allowedKpiIds.length === 1 ? 'Metric' : 'Metrics'})
                </span>
              </span>
            ) : (
              <span className="text-xs text-slate-500 italic">
                Select a Global Objective above to auto-filter aligned KPIs
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Select the primary success metric for this project.{' '}
            <button
              type="button"
              onClick={() => onOpenFaqTopic?.('kpis')}
              className="text-blue-600 underline font-medium hover:text-blue-800 cursor-pointer"
            >
              FAQ 4–7
            </button>
          </p>

          <div className="mt-3 space-y-3">
            {renderSectionLiaisonCallout('section-5-kpi')}
            {renderSectionAlignmentCallout('section-5-kpi')}
          </div>
        </div>

        {/* The Filtered KPI Options Cards */}
        <div className="space-y-3">
          {visibleKpis.map((kpi) => {
            const isSelected = proposal.kpiType === kpi.id;
            const isThisCardLegacyMismatch = isLegacyMismatch && isSelected;
            const Icon = KPI_ICONS[kpi.id as keyof typeof KPI_ICONS] || Target;
            const style = KPI_BADGE_STYLES[kpi.id] || {
              badge: 'bg-slate-100 text-slate-700 border-slate-200',
              border: 'border-slate-800',
              selectedBg: 'bg-slate-50',
            };

            return (
              <div
                key={kpi.id}
                onClick={() => handleSelectKPI(kpi.id)}
                className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                  isThisCardLegacyMismatch
                    ? 'bg-amber-50/60 border-2 border-dashed border-amber-400 shadow-sm'
                    : isSelected
                    ? `${style.selectedBg} border-2 ${style.border} shadow-sm`
                    : 'bg-[#f8fafc] border-slate-200/80 hover:bg-[#f1f5f9] hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-5 h-5 rounded-full mt-0.5 flex items-center justify-center shrink-0 transition ${
                      isThisCardLegacyMismatch
                        ? 'bg-amber-600 text-white shadow-xs'
                        : isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'border-2 border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1 rounded-lg ${
                            isThisCardLegacyMismatch
                              ? 'bg-amber-100 text-amber-800'
                              : isSelected
                              ? 'bg-white shadow-2xs text-slate-900'
                              : 'bg-slate-200/70 text-slate-700'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {kpi.number}. {kpi.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isThisCardLegacyMismatch ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            Misaligned
                          </span>
                        ) : hasObjective && allowedKpiIds.includes(kpi.id) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Aligned with Objective
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isThisCardLegacyMismatch && (
                      <div className="p-3 rounded-xl bg-amber-100/70 border border-amber-300 text-xs text-amber-900 font-medium flex flex-wrap items-center justify-between gap-2">
                        <div className="flex-1">
                          ⚠️ This metric was previously selected on this proposal, but does not
                          align with <strong>{canonicalProject}</strong>.
                        </div>
                        {!isFormLocked && allowedKpiIds.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            {allowedKpiIds.map((id) => {
                              const opt = KPI_OPTIONS.find((k) => k.id === id);
                              if (!opt) return null;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectKPI(id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  Switch to {opt.number}. {opt.title}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-600 leading-normal">
                      <span className="font-semibold text-slate-800">Focus: </span>
                      {kpi.focus}
                    </p>

                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                        isSelected
                          ? 'bg-white/95 border-slate-300/80 shadow-2xs'
                          : 'bg-white/70 border-slate-200/70'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800">Question: </span>
                        <span className="text-slate-700 italic">"{kpi.question}"</span>
                      </div>
                    </div>

                    <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
                        Examples:
                      </span>
                      {kpi.examples.map((ex, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
                            isSelected
                              ? 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                              : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                          }`}
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Context Banner + OneVoice27 Playbook Pathway Guide when a KPI is selected */}
        {selectedKpiObj ? (
          <div className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200 text-xs space-y-3 text-blue-950 mt-1 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <Target className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-blue-950 text-sm">
                    Selected Metric: {selectedKpiObj.number}. {selectedKpiObj.title}
                  </span>
                  {playbookStageGuide && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1c398e] text-white shadow-2xs">
                      <BookOpen className="w-3 h-3" />
                      <span>
                        Playbook Stage {playbookStageGuide.stageNumber}:{' '}
                        {playbookStageGuide.stageName} ({playbookStageGuide.pageRef})
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-blue-900 leading-relaxed">
                  <span className="font-semibold">Goal Question: </span>
                  {selectedKpiObj.question}
                </p>
              </div>
            </div>

            {/* OneVoice27 Playbook Pathway Handoff Guide (pp. 10-15) */}
            {playbookStageGuide && (
              <div className="p-3 rounded-xl bg-white/90 border border-blue-200/90 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="space-y-0.5">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
                    Who Leads &amp; Supports
                  </span>
                  <p className="text-slate-800">
                    <strong>Leads:</strong> {playbookStageGuide.whoLeads}
                  </p>
                  <p className="text-slate-600">
                    <strong>Supports:</strong> {playbookStageGuide.whoSupports}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-blue-700 block">
                    The Pass (Passed Forward)
                  </span>
                  <p className="text-slate-800 font-medium">
                    {playbookStageGuide.whatGetsPassedForward}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-700 block">
                    Playbook Next Action
                  </span>
                  <p className="text-slate-800">{playbookStageGuide.doThisNext}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-800 flex items-center gap-2 mt-1">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Please select 1 measurement from the options above.</span>
          </div>
        )}

        {/* Enter a number & describe it & rationale */}
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">
              Target Goal{' '}
              <span className="text-xs font-normal text-slate-500">
                (Total for Entire Project)
              </span>
            </label>
            <p className="text-xs text-slate-500 mb-1.5">
              {selectedKpiObj
                ? `Enter one cumulative total number for the entire project answering: "${selectedKpiObj.question}"`
                : 'Enter the single cumulative target number of people or items for the entire project.'}
            </p>
            {isFormLocked ? (
              renderReadOnlyNarrativeCard(proposal.kpiNumber)
            ) : (
              <input
                type="text"
                placeholder={
                  selectedKpiObj
                    ? `e.g., 5,000 (Cumulative total for ${selectedKpiObj.title})`
                    : 'e.g., 5,000'
                }
                value={proposal.kpiNumber}
                onChange={(e) => onChange({ kpiNumber: e.target.value })}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border text-sm text-slate-800 placeholder-slate-400 outline-none transition ${
                  targetGoalClarity.hasWarning
                    ? 'border-amber-400 bg-amber-50/30 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-200'
                    : 'border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                }`}
              />
            )}

            {/* Inline Target Goal input border handles warning highlight; detailed pointers & quick fix live at top of Sec 5 */}

            {parsedKpiTarget.value !== null ? (
              <div className="mt-2 flex items-center justify-between gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-1.5 truncate">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    Detected Dashboard Target:{' '}
                    <strong>{parsedKpiTarget.value.toLocaleString()}</strong> (
                    {parsedKpiTarget.shortUnit})
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 font-medium shrink-0">
                  from {parsedKpiTarget.source === 'target_goal' ? 'Target Goal' : 'Metric Details'}
                </span>
              </div>
            ) : proposal.kpiNumber?.trim() ? (
              <p className="mt-1 text-[11px] text-amber-700">
                Tip: Include a quantifiable target number (e.g. 5,000, 50k, 200 attendees) so it
                links and aggregates on the Division Dashboard.
              </p>
            ) : null}

            {/* Live Approved Peer KPI Target Benchmark */}
            {approvedIntelligence?.kpiBenchmark &&
              approvedIntelligence.kpiBenchmark.approvedCount > 0 && (
                <div
                  className={`mt-2 px-3 py-2 rounded-xl border text-xs flex items-start gap-2 ${
                    approvedIntelligence.kpiBenchmark.comparisonStatus === 'aligned'
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      approvedIntelligence.kpiBenchmark.comparisonStatus === 'aligned'
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  />
                  <div className="space-y-0.5 flex-1">
                    <span className="font-bold">
                      Peer Target Benchmark ({approvedIntelligence.kpiBenchmark.approvedCount}{' '}
                      Approved SSD Proposals):{' '}
                    </span>
                    <span>{approvedIntelligence.kpiBenchmark.comparisonMessage}</span>
                  </div>
                </div>
              )}

            {/* Union Yearbook & Digital Capacity Benchmark */}
            {unionIntel?.kpiBenchmark && (
              <div
                className={`mt-2 px-3.5 py-2.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  unionIntel.kpiBenchmark.status === 'exceeds_capacity'
                    ? 'bg-amber-50/95 border-amber-300 text-amber-950'
                    : 'bg-[#f8fafc] border-slate-200/90 text-slate-700'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {unionIntel.kpiBenchmark.status === 'exceeds_capacity' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <Target className="w-3.5 h-3.5 text-[#1c398e] shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-bold text-slate-900">
                      Territory Capacity Benchmark ({unionIntel.profile.acronym}):{' '}
                    </span>
                    <span className="tabular-nums">
                      {unionIntel.kpiBenchmark.status === 'exceeds_capacity'
                        ? unionIntel.kpiBenchmark.warningMessage
                        : `${unionIntel.kpiBenchmark.benchmarkSummary} (${unionIntel.kpiBenchmark.ratioLabel})`}
                    </span>
                  </div>
                </div>

                {!isFormLocked &&
                  unionIntel.kpiBenchmark.status === 'exceeds_capacity' &&
                  unionIntel.kpiBenchmark.suggestedTarget && (
                    <button
                      type="button"
                      onClick={() =>
                        handleApplySmartKpiFix(
                          unionIntel.kpiBenchmark!.suggestedTarget!,
                          `Mobilizing 5% of ${unionIntel.profile.acronym}'s ${unionIntel.profile.membership.toLocaleString()} members across ${unionIntel.profile.churches.toLocaleString()} churches.`
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] shrink-0 transition cursor-pointer active:scale-95"
                    >
                      <Check className="w-3 h-3" />
                      <span>
                        Set to {unionIntel.kpiBenchmark.suggestedTarget} (5% of Members)
                      </span>
                    </button>
                  )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">Metric Details</label>
            <p className="text-xs text-slate-500 mb-1.5">
              {selectedKpiObj
                ? `What specifically will be counted, and how is the total calculated? (e.g., ${selectedKpiObj.examples.slice(0, 2).join(', ')})`
                : 'Detail what this number counts, any monthly/event breakdown math, and how it will be tracked or verified.'}
            </p>
            {isFormLocked ? (
              renderReadOnlyNarrativeCard(proposal.kpiDescription)
            ) : (
              <textarea
                rows={3}
                placeholder={
                  selectedKpiObj
                    ? `Describe what this number counts and any breakdown math (e.g., ${selectedKpiObj.examples.join(', ')})...`
                    : 'Type here...'
                }
                value={proposal.kpiDescription}
                onChange={(e) => onChange({ kpiDescription: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition resize-y"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-1">Rationale</label>
            <p className="text-xs text-slate-500 mb-1.5">
              Why is this measurement an important metric for this project proposal in your local
              territory?
            </p>
            {isFormLocked ? (
              renderReadOnlyNarrativeCard(proposal.kpiRationale)
            ) : (
              <textarea
                rows={3}
                placeholder="Explain why this metric best reflects meaningful progress and mission impact in your field..."
                value={proposal.kpiRationale}
                onChange={(e) => onChange({ kpiRationale: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition resize-y"
              />
            )}
          </div>

          {/* Similar project completed in last 2 years toggle */}
          <div className="pt-2">
            <p className="text-sm font-bold text-slate-900 mb-2">
              Was a similar project completed by your department or institution in the last 2 years
              (2024-2025)?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                disabled={isFormLocked}
                onClick={() => {
                  if (isFormLocked) return;
                  onChange({ hadSimilarProject2Years: 'yes' });
                }}
                className={`py-3 px-6 rounded-2xl font-semibold text-sm transition-all border ${
                  isFormLocked ? 'cursor-default' : 'cursor-pointer'
                } ${
                  proposal.hadSimilarProject2Years === 'yes'
                    ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-xs'
                    : 'bg-[#f5f7fa] text-slate-700 border-slate-200 hover:bg-[#ebf0f7]'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                disabled={isFormLocked}
                onClick={() => {
                  if (isFormLocked) return;
                  onChange({ hadSimilarProject2Years: 'no' });
                }}
                className={`py-3 px-6 rounded-2xl font-semibold text-sm transition-all border ${
                  isFormLocked ? 'cursor-default' : 'cursor-pointer'
                } ${
                  proposal.hadSimilarProject2Years === 'no'
                    ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-xs'
                    : 'bg-[#f5f7fa] text-slate-700 border-slate-200 hover:bg-[#ebf0f7]'
                }`}
              >
                No
              </button>
            </div>

            {proposal.hadSimilarProject2Years === 'yes' && (
              <div className="mt-3 space-y-1.5 animate-in fade-in">
                <label className="block text-xs font-bold text-slate-700">
                  Prior Project Key Metric / Result (2024–2025)
                </label>
                {isFormLocked ? (
                  renderReadOnlyNarrativeCard(proposal.priorProjectMetric)
                ) : (
                  <input
                    type="text"
                    placeholder="Briefly state the measurable result or metric achieved by your prior similar project..."
                    value={proposal.priorProjectMetric || ''}
                    onChange={(e) => onChange({ priorProjectMetric: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. PROJECT DELIVERABLES */}
      {/* ========================================================================= */}
      <div
        id="section-deliverables"
        className={getFlaggedSectionClass(
          getSectionFlags('section-deliverables').length > 0,
          'space-y-2.5 pt-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-3 transition-all'
        )}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="block text-base font-bold text-slate-900">6. Project Deliverables</label>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowBridgingBuilder((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition whitespace-nowrap shrink-0 cursor-pointer ${
                showBridgingBuilder
                  ? 'bg-[#1c398e] text-white border-[#1c398e]'
                  : bridgingContext.isBridgingContext
                  ? 'bg-blue-50 text-[#1c398e] border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>
                {showBridgingBuilder
                  ? 'Hide Bridging Ideas'
                  : bridgingContext.isBridgingContext
                  ? 'Bridging Event Ideas (Recommended · 29)'
                  : 'Bridging Event Ideas (29)'}
              </span>
              {showBridgingBuilder ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {!isFormLocked && relevantDeliverablePrompts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeliverableChips((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1c398e] hover:text-blue-900 cursor-pointer whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>
                  {showDeliverableChips
                    ? 'Hide Playbook Templates'
                    : `Playbook Templates (${relevantDeliverablePrompts.length})`}
                </span>
                {showDeliverableChips ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          List the tangible outputs, events, or digital assets delivered to end users.{' '}
          <button
            type="button"
            onClick={() => onOpenFaqTopic?.('deliverables')}
            className="text-blue-600 underline font-medium hover:text-blue-800 cursor-pointer"
          >
            FAQ 8
          </button>
        </p>
        {renderSectionLiaisonCallout('section-deliverables')}
        {renderSectionAlignmentCallout('section-deliverables')}

        {showBridgingBuilder && (
          <BridgingEventsIdeaBuilder
            proposal={proposal}
            isFormLocked={isFormLocked}
            onChange={onChange}
          />
        )}

        {isFormLocked ? (
          renderReadOnlyNarrativeCard(proposal.deliverables)
        ) : (
          <textarea
            rows={4}
            placeholder="Type here..."
            value={proposal.deliverables}
            onChange={(e) => onChange({ deliverables: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition resize-y"
          />
        )}

        {/* Collapsible Playbook Deliverable Prompts */}
        {!isFormLocked && showDeliverableChips && relevantDeliverablePrompts.length > 0 && (
          <div className="pt-1 flex flex-wrap items-center gap-1.5 animate-in fade-in">
            {relevantDeliverablePrompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                onClick={() => handleAddDeliverableSnippet(prompt.snippet)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#1c398e] border border-slate-200/90 hover:border-blue-200 text-xs font-medium transition cursor-pointer active:scale-95"
                title={`${prompt.pageRef}: "${prompt.snippet}"`}
              >
                <Plus className="w-3 h-3 text-[#1c398e]" />
                <span>{prompt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 7. TARGET AUDIENCE (Select up to 3) */}
      {/* ========================================================================= */}
      <div
        id="section-audience"
        className={getFlaggedSectionClass(
          getSectionFlags('section-audience').length > 0,
          'space-y-3 pt-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-3 transition-all'
        )}
      >
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <label className="block text-base font-bold text-slate-900">
              7. Target Audience{' '}
              <span className="text-sm font-normal text-slate-500">(Select up to 3)</span>
            </label>
            <p className="text-xs text-slate-500 mt-1">
              Select the primary audience segments served by these deliverables.{' '}
              <button
                type="button"
                onClick={() => onOpenFaqTopic?.('audience')}
                className="text-blue-600 underline font-medium hover:text-blue-800 cursor-pointer"
              >
                FAQ 1
              </button>
            </p>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition shrink-0 ${
              proposal.targetAudiences.length === 3
                ? 'bg-blue-100 text-blue-900 border-blue-300'
                : proposal.targetAudiences.length > 3
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : proposal.targetAudiences.length > 0
                ? 'bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            {proposal.targetAudiences.length} of 3 selected
            {proposal.targetAudiences.length === 3 && ' (Limit reached)'}
            {proposal.targetAudiences.length > 3 && ' (Legacy: Exceeds 3)'}
          </span>
        </div>

        {renderSectionLiaisonCallout('section-audience')}
        {renderSectionAlignmentCallout('section-audience')}

        {/* Live Approved Peer Audience Pattern Strip */}
        {approvedIntelligence &&
          approvedIntelligence.audiencePatterns.length > 0 &&
          approvedIntelligence.totalSsdApprovedCount > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap text-emerald-950">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="font-bold">
                  Approved Peer Audience Pattern ({approvedIntelligence.scopeLabel}):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {approvedIntelligence.audiencePatterns.slice(0, 4).map((pat) => (
                    <span
                      key={pat.audienceId}
                      className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-[11px] font-semibold text-emerald-900"
                    >
                      Group {pat.audienceId}: {pat.percentage}%
                    </span>
                  ))}
                </div>
              </div>

              {!isFormLocked && approvedIntelligence.recommendedPeerAudience && (
                <button
                  type="button"
                  onClick={() =>
                    handleSmartIncludeAudience(
                      approvedIntelligence.recommendedPeerAudience!.audienceId
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shrink-0 transition cursor-pointer active:scale-95"
                  title={approvedIntelligence.recommendedPeerAudience.reason}
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>
                    Include Group {approvedIntelligence.recommendedPeerAudience.audienceId} (
                    {approvedIntelligence.recommendedPeerAudience.percentage}% of Peers)
                  </span>
                </button>
              )}
            </div>
          )}

        {/* Legacy notice for older proposals that had > 3 audiences checked */}
        {isLegacyAudienceExceeded && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-2xs animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Legacy Audience Notice:</span>
              <p className="text-amber-800 leading-relaxed">
                This proposal currently has {proposal.targetAudiences.length} audiences selected.
                Under updated OneVoice27 guidelines, projects must focus on a maximum of 3 target
                audiences. Please uncheck options to refine your audience focus before saving.
              </p>
            </div>
          </div>
        )}

        {/* Real-time alert when attempting to select a 4th audience */}
        {showAudienceLimitAlert && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs animate-in fade-in">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Maximum of 3 target audiences reached. To select a different audience, please uncheck
              an existing selection first.
            </span>
          </div>
        )}

        {/* Checkbox list with touch-friendly cards */}
        <div className="grid grid-cols-1 gap-2 pt-1">
          {TARGET_AUDIENCE_OPTIONS.map((option) => {
            const isChecked = proposal.targetAudiences.includes(option.id);
            const isLimitReached = !isChecked && proposal.targetAudiences.length >= 3;
            const isRecommendedByAdvisor =
              !isChecked && audienceContradiction.suggestedAudienceIds.includes(option.id);

            return (
              <label
                key={option.id}
                onClick={() => handleToggleAudience(option.id)}
                className={`flex items-start gap-3 p-3 rounded-xl border transition select-none ${
                  isChecked
                    ? 'bg-blue-50/60 border-blue-200 text-slate-900 shadow-2xs cursor-pointer'
                    : isRecommendedByAdvisor && !isLimitReached
                    ? 'bg-amber-50/50 border-amber-300 hover:bg-amber-50 text-slate-800 cursor-pointer'
                    : isLimitReached
                    ? 'bg-slate-50/80 border-slate-200/70 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center shrink-0 transition ${
                    isChecked
                      ? 'bg-[#1c398e] text-white shadow-2xs'
                      : isLimitReached
                      ? 'border-2 border-slate-200 bg-slate-100'
                      : 'border-2 border-slate-300 bg-white'
                  }`}
                >
                  {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`text-sm leading-snug block ${
                        isChecked
                          ? 'font-semibold text-slate-900'
                          : isLimitReached
                          ? 'text-slate-400'
                          : 'text-slate-700'
                      }`}
                    >
                      {option.label}
                    </span>
                    {isRecommendedByAdvisor && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                        Suggested by Narrative
                      </span>
                    )}
                  </div>
                  {isLimitReached && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Limit reached (3 of 3 selected). Uncheck another option to select this.
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {/* Requirement 4: If Target Audience E is selected, display textbox + Playbook Play 7 Sensitive Context Guide */}
        {isAudienceESelected && (
          <div className="mt-3 pl-4 md:pl-6 border-l-2 border-blue-400 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-sm font-bold text-slate-900">
                  Category E Details: Specify the Non-Religious or World-Religion People Group
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Describe only the <strong>Category E</strong> population (do not paste a general A–D church/member list here).
                </p>
              </div>
              {!isFormLocked && hasFlattenedPastedTable(proposal.audienceEDetails) && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      audienceEDetails: compactFlattenedTableText(proposal.audienceEDetails || ''),
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 transition cursor-pointer shadow-2xs"
                >
                  <span>Clean &amp; Format Pasted Table</span>
                </button>
              )}
            </div>

            {/* 3-Part Guided Structure for Category E */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-extrabold uppercase tracking-wider text-[#1c398e] block text-[10px]">
                  1. People Group / Community
                </span>
                <span className="text-slate-600">
                  Specific ethnic, linguistic, or urban group (e.g., Kikim, Sundanese, Urban Secular Professionals)
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-extrabold uppercase tracking-wider text-[#1c398e] block text-[10px]">
                  2. Religion / Worldview &amp; Language
                </span>
                <span className="text-slate-600">
                  Primary faith or worldview (e.g., Islam, Buddhism, Hinduism, Secular, Traditional) &amp; local dialect
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-extrabold uppercase tracking-wider text-[#1c398e] block text-[10px]">
                  3. Cultural Bridge &amp; Handoff
                </span>
                <span className="text-slate-600">
                  Friendship/felt-needs approach and safe referral pathway to local care teams
                </span>
              </div>
            </div>

            {/* Playbook Play 7 (pp. 8 & 38) Sensitive Context & Contextualization Guide */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/90 text-xs space-y-2.5 text-indigo-950">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-indigo-950">
                    {PLAYBOOK_SENSITIVE_AREA_GUIDE.title}
                    {unionIntel && ` — ${unionIntel.profile.acronym} (${unionIntel.profile.sensitivityLevel})`}
                  </p>
                  <p className="text-indigo-900 leading-relaxed text-[11px]">
                    {unionIntel
                      ? `${unionIntel.profile.sensitivitySummary} ${PLAYBOOK_SENSITIVE_AREA_GUIDE.summary}`
                      : PLAYBOOK_SENSITIVE_AREA_GUIDE.summary}
                  </p>
                </div>
              </div>

              {!isFormLocked && (
                <div className="pl-6 space-y-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PLAYBOOK_SENSITIVE_AREA_GUIDE.snippets.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleAddAudienceESnippet(s.text)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-semibold text-[11px] transition cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <Plus className="w-3 h-3 text-indigo-700" />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Territory-Specific Unreached & Frontier People Groups Quick-Insert */}
                  {unionIntel && unionIntel.profile.keyPeopleGroups.length > 0 && (
                    <div className="pt-1 border-t border-indigo-200/60 space-y-1.5">
                      <span className="text-[11px] font-bold text-indigo-950 block">
                        Priority People Groups in {unionIntel.profile.acronym} (Click to insert into Group E details):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {unionIntel.profile.keyPeopleGroups.map((pg) => (
                          <button
                            key={pg.name}
                            type="button"
                            onClick={() =>
                              handleAddAudienceESnippet(
                                `Target People Group: ${pg.name} (${pg.country}, pop. ${pg.population.toLocaleString()}, primary religion: ${pg.primaryReligion}, language: ${pg.language}${pg.isFrontier ? ', Frontier People Group' : ''}). ${pg.notes || ''}`
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-slate-800 hover:text-[#1c398e] border border-indigo-200/90 font-medium text-[11px] transition cursor-pointer active:scale-95 shadow-2xs tabular-nums"
                            title={`${pg.primaryReligion} · Lang: ${pg.language} · ${pg.notes || ''}`}
                          >
                            <Plus className="w-3 h-3 text-[#1c398e] shrink-0" />
                            <span>
                              {pg.name.split('(')[0].trim()} (
                              {pg.population >= 1_000_000
                                ? `${(pg.population / 1_000_000).toFixed(1)}M`
                                : `${Math.round(pg.population / 1_000)}K`}
                              )
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isFormLocked ? (
              renderReadOnlyNarrativeCard(proposal.audienceEDetails)
            ) : (
              <textarea
                rows={3}
                placeholder="Specify the people group, primary world religion / secular context, language, and culturally sensitive follow-up..."
                value={proposal.audienceEDetails}
                onChange={(e) => onChange({ audienceEDetails: e.target.value })}
                onBlur={() => {
                  if (hasFlattenedPastedTable(proposal.audienceEDetails)) {
                    onChange({
                      audienceEDetails: compactFlattenedTableText(proposal.audienceEDetails || ''),
                    });
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition resize-y"
              />
            )}

          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 8. POINTS OF INTEGRATION */}
      {/* ========================================================================= */}
      <div
        id="section-integration"
        className={getFlaggedSectionClass(
          getSectionFlags('section-integration').length > 0,
          'space-y-3 pt-2 transition-all rounded-xl p-1',
          'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-3 transition-all'
        )}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="block text-base font-bold text-slate-900">8. Points of Integration</label>
          {!isFormLocked && (
            <button
              type="button"
              onClick={() => setShowPartnerChips((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1c398e] hover:text-blue-900 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{showPartnerChips ? 'Hide Partner Templates' : 'Partner Templates'}</span>
              {showPartnerChips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Name collaborating departments, media entities, and local church receiver teams, and explain how handoffs work.
        </p>

        {renderSectionLiaisonCallout('section-integration')}
        {renderSectionAlignmentCallout('section-integration')}

        {isFormLocked ? (
          renderReadOnlyNarrativeCard(proposal.pointsOfIntegration)
        ) : (
          <textarea
            rows={4}
            placeholder="Type here..."
            value={proposal.pointsOfIntegration}
            onChange={(e) => onChange({ pointsOfIntegration: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f5f7fa] border border-slate-200/80 hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition resize-y"
          />
        )}

        {narrativeDepth.isIntegrationTooVague && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
            <strong>Tip:</strong> Name the specific departments/entities and briefly explain how
            they will collaborate on follow-up, production, or warm handoffs.
          </p>
        )}

        {/* Collapsible OneVoice27 Playbook Ecosystem Partner Tags */}
        {!isFormLocked && showPartnerChips && (
          <div className="p-3 rounded-2xl bg-[#f8fafc] border border-slate-200/90 space-y-2 animate-in fade-in">
            <span className="text-[11px] font-medium text-slate-500 block">
              Click any partner to insert its Playbook role &amp; handoff rationale:
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {sortedIntegrationPartners.map((partner) => {
                const integrationLower = (proposal.pointsOfIntegration || '').toLowerCase();
                const checkKey = partner.label.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
                const alreadyAdded =
                  partner.id === 'hopestartshere_events_rsvp'
                    ? /\brsvp\b|community\s+(?:outreach\s+)?events?\s*(?:&|and)?\s*rsvp/i.test(
                        integrationLower
                      )
                    : partner.id === 'hopestartshere_content_repository'
                    ? /\bcontent\s+repository\b/i.test(integrationLower)
                    : checkKey.length >= 3 && integrationLower.includes(checkKey);
                if (alreadyAdded) return null;

                const isRecommended = Boolean(
                  (isCommunityInPersonEvent && partner.id === 'hopestartshere_events_rsvp') ||
                    (canonicalProject && partner.recommendedObjectives.includes(canonicalProject)) ||
                    (canonicalKpi && partner.recommendedKpis.includes(canonicalKpi))
                );

                return (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => handleAddIntegrationPartner(partner.snippet)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer active:scale-95 ${
                      isRecommended
                        ? 'bg-blue-50/90 hover:bg-blue-100/80 text-blue-950 border-blue-300 font-semibold shadow-2xs'
                        : 'bg-white hover:bg-blue-50/60 text-slate-700 hover:text-[#1c398e] border-slate-200/90 hover:border-blue-300 shadow-2xs'
                    }`}
                    title={`${partner.pageRef} — Click to insert: "${partner.snippet}"`}
                  >
                    <Plus className="w-3 h-3 text-[#1c398e] shrink-0" />
                    <span>{partner.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
