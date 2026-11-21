import React, { useMemo, useState, useEffect } from 'react';
import { Proposal } from '../../types';
import {
  analyzeUnionMissionPathway,
  PathwayStageNumber,
  UnionPathwayPeerProposal,
} from '../../utils/unionPathwayAlignment';
import {
  ArrowRight,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  GitBranch,
  Plus,
} from 'lucide-react';

export interface UnionMissionPathwayCardProps {
  proposal: Proposal;
  allProposals?: Proposal[];
  isFormLocked?: boolean;
  onAppendIntegration?: (snippet: string) => void;
  onJumpToSection?: (sectionId: string) => void;
  defaultExpanded?: boolean;
}

const STATUS_LABELS: Record<UnionPathwayPeerProposal['status'], string> = {
  approved: 'Approved',
  under_review: 'Under Review',
  submitted: 'Submitted',
  draft: 'Draft',
};

export function UnionMissionPathwayCard({
  proposal,
  allProposals,
  isFormLocked = false,
  onAppendIntegration,
  onJumpToSection,
  defaultExpanded = false,
}: UnionMissionPathwayCardProps) {
  const analysis = useMemo(
    () => analyzeUnionMissionPathway(proposal, allProposals),
    [proposal, allProposals]
  );

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedStage, setSelectedStage] = useState<PathwayStageNumber>(
    (analysis.currentStageNumber || 1) as PathwayStageNumber
  );
  const [justInsertedSnippet, setJustInsertedSnippet] = useState(false);

  useEffect(() => {
    if (analysis.currentStageNumber > 0) {
      setSelectedStage(analysis.currentStageNumber as PathwayStageNumber);
    }
  }, [analysis.currentStageNumber, proposal.id]);

  if (!analysis.hasUnion) {
    return null;
  }

  const activeStageBucket =
    analysis.stages.find((s) => s.stageNumber === selectedStage) || analysis.stages[0];

  const alreadyHasSuggestedSnippet = Boolean(
    analysis.suggestedSec8Snippet &&
      (proposal.pointsOfIntegration || '')
        .toLowerCase()
        .includes(analysis.suggestedSec8Snippet.slice(0, 28).toLowerCase())
  );

  const handleInsertPathwayNote = () => {
    if (isFormLocked || !onAppendIntegration || !analysis.suggestedSec8Snippet) return;
    onAppendIntegration(analysis.suggestedSec8Snippet);
    setJustInsertedSnippet(true);
    setTimeout(() => setJustInsertedSnippet(false), 2400);
  };

  const handleStageButtonClick = (stageNumber: PathwayStageNumber) => {
    setSelectedStage(stageNumber);
    setIsExpanded(true);
  };

  return (
    <section
      aria-label={`${analysis.unionAcronym} 5-Stage Mission Pathway`}
      className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden"
    >
      {/* Top Strip: Union Scope + Metadata + Toggle */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <GitBranch className="w-4 h-4 text-[#1c398e] shrink-0" />
          <h3 className="text-xs font-extrabold text-slate-900">
            {analysis.unionAcronym} 5-Stage Mission Pathway
          </h3>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-xs text-slate-600 tabular-nums">
            <strong className="text-slate-900">{analysis.totalUnionProposals}</strong>{' '}
            {analysis.totalUnionProposals === 1 ? 'Proposal' : 'Proposals'} in Union
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-xs text-slate-600 tabular-nums">
            {analysis.currentStageNumber > 0 ? (
              <>
                This project:{' '}
                <strong className="text-[#1c398e]">
                  Stage {analysis.currentStageNumber} ({analysis.currentStageName})
                </strong>
              </>
            ) : (
              <span className="text-amber-800 font-semibold">Pick KPI in Sec 5 to place on pathway</span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0"
        >
          <span>{isExpanded ? 'Hide Stage Details' : 'Compare Union Proposals'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
        </button>
      </div>

      {/* 5-Stage Pathway Interactive Step Track */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {analysis.stages.map((stage) => {
            const isSelected = isExpanded && selectedStage === stage.stageNumber;
            const isCurrent = stage.includesCurrentProposal;
            const isGap = stage.isGapAfterUpstream && !isCurrent;

            return (
              <button
                key={stage.stageNumber}
                type="button"
                onClick={() => handleStageButtonClick(stage.stageNumber)}
                className={`text-left p-2.5 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-1.5 min-w-0 ${
                  isCurrent
                    ? 'border-[#1c398e] bg-blue-50/50'
                    : isSelected
                    ? 'border-slate-400 bg-slate-50'
                    : isGap
                    ? 'border-amber-300 bg-amber-50/45 hover:bg-amber-50/75'
                    : 'border-slate-200/90 bg-white hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <span
                    className={`text-xs font-bold truncate ${
                      isCurrent ? 'text-[#1c398e]' : 'text-slate-900'
                    }`}
                  >
                    0{stage.stageNumber}. {stage.stageName}
                  </span>
                  {stage.stageNumber < 5 && (
                    <ArrowRight className="w-3 h-3 text-slate-300 hidden sm:inline shrink-0" />
                  )}
                </div>

                <div className="text-[11px] leading-snug tabular-nums">
                  {stage.totalCount > 0 ? (
                    <span className="text-slate-700 font-semibold">
                      {stage.totalCount}{' '}
                      {stage.totalCount === 1 ? 'project' : 'projects'}
                    </span>
                  ) : isGap ? (
                    <span className="text-amber-800 font-bold">0 · Gap</span>
                  ) : (
                    <span className="text-slate-400">0 projects</span>
                  )}

                  {isCurrent && (
                    <span className="block text-[10px] font-bold text-[#1c398e] mt-0.5">
                      This proposal
                    </span>
                  )}
                  {!isCurrent && stage.approvedCount > 0 && (
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      {stage.approvedCount} approved
                    </span>
                  )}
                  {!isCurrent && stage.approvedCount === 0 && isGap && (
                    <span className="block text-[10px] text-amber-800 mt-0.5">
                      Cover in Sec 8
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Focused Role & Fit Diagnosis Strip: Context separated from Explicit Action Step */}
        <div
          className={`p-3.5 rounded-xl border space-y-2.5 text-xs ${
            analysis.pathwayDiagnosisType === 'missing_downstream_stage' ||
            analysis.pathwayDiagnosisType === 'missing_middle_gap' ||
            analysis.pathwayDiagnosisType === 'no_kpi_selected'
              ? 'bg-amber-50/55 border-amber-200 text-amber-950'
              : 'bg-slate-50/80 border-slate-200/80 text-slate-800'
          }`}
        >
          {/* Context Header */}
          <div className="space-y-0.5 min-w-0">
            <p className="font-bold text-slate-900 leading-snug">{analysis.headlineSummary}</p>
            <p className="text-[11px] text-slate-600 leading-snug">{analysis.contextNote}</p>
          </div>

          {/* Highlighted Action / Verification Step Box */}
          <div
            className={`p-2.5 sm:p-3 rounded-lg bg-white border border-slate-200/90 border-l-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              analysis.pathwayDiagnosisType === 'missing_downstream_stage' ||
              analysis.pathwayDiagnosisType === 'missing_middle_gap' ||
              analysis.pathwayDiagnosisType === 'no_kpi_selected'
                ? 'border-l-amber-600'
                : 'border-l-[#1c398e]'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0">
              <CheckSquare
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  analysis.pathwayDiagnosisType === 'missing_downstream_stage' ||
                  analysis.pathwayDiagnosisType === 'missing_middle_gap' ||
                  analysis.pathwayDiagnosisType === 'no_kpi_selected'
                    ? 'text-amber-700'
                    : 'text-[#1c398e]'
                }`}
              />
              <div className="min-w-0 space-y-0.5">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                    analysis.pathwayDiagnosisType === 'missing_downstream_stage' ||
                    analysis.pathwayDiagnosisType === 'missing_middle_gap' ||
                    analysis.pathwayDiagnosisType === 'no_kpi_selected'
                      ? 'text-amber-800'
                      : 'text-[#1c398e]'
                  }`}
                >
                  {isFormLocked ? 'Step to Verify' : 'Next Step · What to Do'}
                </span>
                <p className="text-xs font-semibold text-slate-900 leading-snug">
                  {isFormLocked ? analysis.liaisonCheck : analysis.actionStep}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
              {!isFormLocked &&
                onAppendIntegration &&
                analysis.suggestedSec8Snippet &&
                !alreadyHasSuggestedSnippet && (
                  <button
                    type="button"
                    onClick={handleInsertPathwayNote}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1c398e] hover:bg-[#152c70] text-white text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {justInsertedSnippet ? (
                      <>
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Added to Sec 8</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>{analysis.suggestedSec8ActionLabel.replace(/^\+\s*/, '')}</span>
                      </>
                    )}
                  </button>
                )}

              {!isFormLocked && alreadyHasSuggestedSnippet && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 px-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Linked in Sec 8</span>
                </span>
              )}

              {onJumpToSection && analysis.actionSectionId && (
                <button
                  type="button"
                  onClick={() => onJumpToSection(analysis.actionSectionId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>{analysis.actionSectionLabel}</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Stage Details & Upstream/Downstream Peer List */}
        {isExpanded && activeStageBucket && (
          <div className="pt-1 space-y-3">
            {/* Upstream & Downstream Handoff Summary Row */}
            {analysis.currentStageNumber > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Upstream in {analysis.unionAcronym} (Feeds Into This Stage)
                  </span>
                  {analysis.upstreamFeeders.length > 0 ? (
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {analysis.upstreamFeeders
                        .slice(0, 3)
                        .map((p) => `${p.title} (Stage ${p.stageNumber})`)
                        .join(' · ')}
                      {analysis.upstreamFeeders.length > 3 &&
                        ` · +${analysis.upstreamFeeders.length - 3} more`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-600">
                      {analysis.currentStageNumber === 1 || analysis.currentPillarIndex === 1
                        ? 'Entry or equipping role on the Union pathway.'
                        : (
                          <>
                            No earlier-stage Union proposals found yet —{' '}
                            <strong className="text-slate-900">describe your entry source in Sec 2.</strong>
                          </>
                        )}
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Downstream in {analysis.unionAcronym} (Receives Next Step)
                  </span>
                  {analysis.downstreamReceivers.length > 0 ? (
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {analysis.downstreamReceivers
                        .slice(0, 3)
                        .map((p) => `${p.title} (Stage ${p.stageNumber})`)
                        .join(' · ')}
                      {analysis.downstreamReceivers.length > 3 &&
                        ` · +${analysis.downstreamReceivers.length - 3} more`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-900">
                      No downstream Union proposals yet —{' '}
                      <strong className="font-bold">name local churches or Hope Care Teams in Sec 8.</strong>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Selected Stage Proposal Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-slate-900">
                    Stage {activeStageBucket.stageNumber} · {activeStageBucket.stageName}
                  </span>
                  <span className="text-slate-400 mx-1.5" aria-hidden="true">·</span>
                  <span className="text-slate-600">{activeStageBucket.purpose}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                  {activeStageBucket.totalCount}{' '}
                  {activeStageBucket.totalCount === 1 ? 'proposal' : 'proposals'}
                  {activeStageBucket.totalBudgetUsd > 0 &&
                    ` · US$${activeStageBucket.totalBudgetUsd.toLocaleString()}`}
                </span>
              </div>

              {activeStageBucket.allProposalsInStage.length > 0 ? (
                <div className="divide-y divide-slate-100 bg-white">
                  {activeStageBucket.allProposalsInStage.map((peer) => (
                    <div
                      key={peer.id}
                      className={`px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs ${
                        peer.isCurrentProposal ? 'bg-blue-50/35' : ''
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-bold text-slate-900 truncate">
                          {peer.title}
                          {peer.isCurrentProposal && (
                            <span className="text-[#1c398e] font-bold"> · This Proposal</span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {peer.pillarIndex > 0 ? `Pillar ${peer.pillarIndex}` : 'Unassigned Pillar'}
                          {peer.divisionProject ? ` · ${peer.divisionProject}` : ''}
                        </p>
                      </div>

                      <div className="text-[11px] text-slate-600 tabular-nums shrink-0 flex items-center gap-2">
                        <span className="font-semibold text-slate-700">
                          {STATUS_LABELS[peer.status]}
                        </span>
                        {peer.formattedTarget && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span>Target: {peer.formattedTarget}</span>
                          </>
                        )}
                        {peer.totalBudget > 0 && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="font-semibold text-slate-900">
                              US${peer.totalBudget.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3.5 py-4 text-xs text-slate-500 bg-white">
                  No proposals in {analysis.unionAcronym} are currently assigned to Stage{' '}
                  {activeStageBucket.stageNumber} ({activeStageBucket.stageName}). Expected handoff:{' '}
                  {activeStageBucket.whatGetsPassedForward}
                </div>
              )}
            </div>

            {analysis.unassignedOtherCount > 0 && (
              <p className="text-[11px] text-slate-500 tabular-nums">
                Note: {analysis.unassignedOtherCount} other {analysis.unionAcronym}{' '}
                {analysis.unassignedOtherCount === 1 ? 'proposal has' : 'proposals have'} not selected a
                Primary KPI yet.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
