import React, { useState, useMemo } from 'react';
import {
  Radio,
  MessageSquare,
  MapPin,
  HeartHandshake,
  Wrench,
  ChevronDown,
  ChevronUp,
  Target,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Proposal, KPIType, UNION_ACRONYMS } from '../../types';
import {
  aggregateKpiMetrics,
  formatMetricCount,
  KPI_METRIC_META,
  KpiMetricBreakdown,
  TerritoryKpiExtractionSummary,
} from '../../utils/kpiExtraction';
import {
  getUnionIntelligence,
  UNION_INTELLIGENCE_PROFILES,
  SSD_DIVISION_YEARBOOK_TOTALS,
} from '../../data/unionIntelligence';

interface MonitorImpactMetricsProps {
  proposals?: Proposal[];
  precomputedSummary?: TerritoryKpiExtractionSummary;
  selectedUnion?: string;
  approvedOnly?: boolean;
  onSelectProposal?: (proposalId: string) => void;
  canOpenProposal?: (proposalId: string) => boolean;
  onNavigateToReviewHub?: (unionFilter?: string) => void;
}

const KPI_ICONS: Record<KPIType, React.ComponentType<{ className?: string }>> = {
  reach_exposure: Radio,
  engagement_participation: MessageSquare,
  connection_next_steps: MapPin,
  retention_nurturing: HeartHandshake,
  implementation_capability: Wrench,
  '': Target,
};

const KPI_THEME: Record<
  KPIType,
  {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    numColor: string;
    progressBg: string;
  }
> = {
  reach_exposure: {
    bg: 'bg-white',
    border: 'border-slate-200/90 hover:border-slate-300',
    iconBg: 'bg-emerald-50 text-emerald-800',
    iconColor: 'text-emerald-700',
    numColor: 'text-emerald-700',
    progressBg: 'bg-emerald-600',
  },
  engagement_participation: {
    bg: 'bg-white',
    border: 'border-slate-200/90 hover:border-slate-300',
    iconBg: 'bg-blue-50 text-blue-800',
    iconColor: 'text-blue-700',
    numColor: 'text-blue-700',
    progressBg: 'bg-blue-600',
  },
  connection_next_steps: {
    bg: 'bg-white',
    border: 'border-slate-200/90 hover:border-slate-300',
    iconBg: 'bg-purple-50 text-purple-800',
    iconColor: 'text-purple-700',
    numColor: 'text-purple-700',
    progressBg: 'bg-purple-600',
  },
  retention_nurturing: {
    bg: 'bg-white',
    border: 'border-slate-200/90 hover:border-slate-300',
    iconBg: 'bg-indigo-50 text-indigo-800',
    iconColor: 'text-indigo-700',
    numColor: 'text-indigo-700',
    progressBg: 'bg-indigo-600',
  },
  implementation_capability: {
    bg: 'bg-white',
    border: 'border-slate-200/90 hover:border-slate-300',
    iconBg: 'bg-amber-50 text-amber-800',
    iconColor: 'text-amber-700',
    numColor: 'text-amber-800',
    progressBg: 'bg-amber-600',
  },
  '': {
    bg: 'bg-white',
    border: 'border-slate-200 hover:border-slate-300',
    iconBg: 'bg-slate-100 text-slate-800',
    iconColor: 'text-slate-700',
    numColor: 'text-slate-800',
    progressBg: 'bg-slate-600',
  },
};

export const MonitorImpactMetrics: React.FC<MonitorImpactMetricsProps> = React.memo(
  ({
    proposals = [],
    precomputedSummary,
    selectedUnion,
    approvedOnly = false,
    onSelectProposal,
    canOpenProposal,
    onNavigateToReviewHub,
  }) => {
    const [expandedKpi, setExpandedKpi] = useState<KPIType | null>(null);

    const summary = useMemo(() => {
      if (precomputedSummary) return precomputedSummary;
      return aggregateKpiMetrics(proposals);
    }, [precomputedSummary, proposals]);

    // Compute territory baseline (Churches, Members, Online Population) for active scope
    const fieldBaseline = useMemo(() => {
      if (selectedUnion && selectedUnion !== 'all') {
        const prof = getUnionIntelligence(selectedUnion);
        if (prof) {
          return {
            label: prof.acronym,
            churches: prof.churches,
            membership: prof.membership,
            population: prof.population,
            onlinePop: Math.round(
              prof.population * (prof.avgInternetPenetrationPct / 100)
            ),
          };
        }
      }
      const totalOnline = Object.values(UNION_INTELLIGENCE_PROFILES).reduce(
        (sum, p) =>
          sum +
          Math.round(p.population * (p.avgInternetPenetrationPct / 100)),
        0
      );
      return {
        label: 'SSD Total',
        churches: SSD_DIVISION_YEARBOOK_TOTALS.churches,
        membership: SSD_DIVISION_YEARBOOK_TOTALS.membership,
        population: SSD_DIVISION_YEARBOOK_TOTALS.population,
        onlinePop: totalOnline,
      };
    }, [selectedUnion]);

    const canonicalOrder: KPIType[] = [
      'reach_exposure',
      'engagement_participation',
      'connection_next_steps',
      'retention_nurturing',
      'implementation_capability',
    ];

    const toggleExpand = (kpi: KPIType) => {
      setExpandedKpi((prev) => (prev === kpi ? null : kpi));
    };

    return (
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-[#1c398e]" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {approvedOnly
                  ? 'Approved Mission Targets & Impact'
                  : 'Quantified Mission Targets & Projected Impact'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold tabular-nums">
                {fieldBaseline.label} Baseline: {fieldBaseline.churches.toLocaleString()} Churches ·{' '}
                {fieldBaseline.membership.toLocaleString()} Members
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {approvedOnly
                ? 'Aggregated from approved project goals and benchmarked against official Adventist Yearbook & Digital 2026 field capacity.'
                : 'Dynamically aggregated from project goals and normalized against official Adventist Yearbook & Digital 2026 field capacity.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs self-start sm:self-center">
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 text-[11px]">Approved Target Reach: </span>
              <strong className="text-emerald-700 font-black tabular-nums">
                {formatMetricCount(summary.approvedGrandTotalTarget)}
              </strong>
              {!approvedOnly && summary.pendingGrandTotalTarget > 0 && (
                <span className="text-[10px] text-amber-700 font-semibold ml-1.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  +{formatMetricCount(summary.pendingGrandTotalTarget)} in review
                </span>
              )}
              <span className="text-[10px] text-slate-400 ml-1.5">
                ({summary.totalQuantifiedProposals}/{summary.totalProposalsCount} approved quantified)
              </span>
            </div>
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {canonicalOrder.map((kpiKey) => {
            const meta = KPI_METRIC_META[kpiKey];
            const breakdown: KpiMetricBreakdown = summary?.kpiBreakdowns?.[kpiKey] || {
              kpiType: kpiKey,
              title: meta?.title || '',
              kpiNumber: meta?.number || 1,
              unitLabel: meta?.unitLabel || '',
              shortUnit: meta?.shortUnit || '',
              totalTarget: 0,
              approvedTarget: 0,
              pendingTarget: 0,
              totalProposalsCount: 0,
              quantifiedProposalsCount: 0,
              proposals: [],
            };
            const theme = KPI_THEME[kpiKey];
            const Icon = KPI_ICONS[kpiKey];
            const isExpanded = expandedKpi === kpiKey;
            const hasProposals = (breakdown.proposals || []).length > 0;

            const approvedRatio =
              breakdown.totalTarget > 0
                ? Math.round((breakdown.approvedTarget / breakdown.totalTarget) * 100)
                : 0;

            // Compute Field Benchmark based on approved target when approvedOnly, otherwise total projected target
            const refValue = approvedOnly
              ? breakdown.approvedTarget
              : breakdown.totalTarget > 0
              ? breakdown.totalTarget
              : breakdown.approvedTarget;
            let benchmarkText = '';
            let isHighLoad = false;
            if (refValue > 0) {
              if (kpiKey === 'reach_exposure' && fieldBaseline.onlinePop > 0) {
                const pct = (refValue / fieldBaseline.onlinePop) * 100;
                benchmarkText = `${pct < 0.1 ? '<0.1' : pct.toFixed(1)}% of online pop.`;
              } else if (
                (kpiKey === 'engagement_participation' ||
                  kpiKey === 'connection_next_steps' ||
                  kpiKey === 'retention_nurturing') &&
                fieldBaseline.churches > 0
              ) {
                const perChurch = refValue / fieldBaseline.churches;
                benchmarkText = `~${perChurch < 10 ? perChurch.toFixed(1) : Math.round(perChurch).toLocaleString()} / local church`;
                if (kpiKey !== 'engagement_participation' && perChurch > 50) {
                  isHighLoad = true;
                }
              } else if (
                kpiKey === 'implementation_capability' &&
                fieldBaseline.membership > 0
              ) {
                const pctMembers = (refValue / fieldBaseline.membership) * 100;
                benchmarkText = `${pctMembers < 0.1 ? '<0.1' : pctMembers.toFixed(1)}% of members`;
                if (pctMembers > 100) {
                  isHighLoad = true;
                }
              }
            }

            return (
              <div
                key={kpiKey}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${theme.bg} ${theme.border} ${
                  isExpanded ? 'ring-2 ring-blue-500/20 shadow-xs' : ''
                }`}
              >
                <div>
                  {/* Card Header: Step Badge + Field Benchmark Badge */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${theme.iconBg} border border-black/5`}>
                      <Icon className="w-3 h-3 shrink-0" />
                      <span>KPI {meta.number}</span>
                    </span>
                    {benchmarkText && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold tabular-nums border ${
                          isHighLoad
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-slate-50 text-slate-600 border-slate-200/80'
                        }`}
                        title="Target normalized against territory Yearbook Churches, Membership, or Online Population"
                      >
                        {benchmarkText}
                      </span>
                    )}
                  </div>

                  <h3
                    className="text-xs font-bold text-slate-900 leading-snug tracking-tight min-h-[2.5rem] flex items-start mt-2"
                    title={meta.title}
                  >
                    {meta.title}
                  </h3>

                  {/* Big Number - Reflects Approved Value First */}
                  <div className="mt-2.5">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className={`text-2xl font-black tracking-tight tabular-nums ${theme.numColor}`}>
                        {formatMetricCount(breakdown.approvedTarget)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold" title={breakdown.shortUnit || meta.shortUnit}>
                        {breakdown.shortUnit || meta.shortUnit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                      <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Approved Target
                      </span>
                      {!approvedOnly && breakdown.pendingTarget > 0 && (
                        <span className="text-amber-700 font-semibold tabular-nums">
                          +{formatMetricCount(breakdown.pendingTarget)} in review
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress & Breakdown (only shown when not approvedOnly) */}
                  {!approvedOnly && (
                    <div className="mt-3 pt-2 border-t border-slate-200/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Approved:
                        </span>
                        <strong className="text-emerald-800 font-black tabular-nums">
                          {formatMetricCount(breakdown.approvedTarget)}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3 text-amber-500" />
                          In Review:
                        </span>
                        <strong className="text-amber-800 tabular-nums">
                          +{formatMetricCount(breakdown.pendingTarget)}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span>Total Projected:</span>
                        <span className="font-bold text-slate-700 tabular-nums">
                          {formatMetricCount(breakdown.totalTarget)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${theme.progressBg}`}
                          style={{ width: `${approvedRatio}%` }}
                          title={`${approvedRatio}% of target approved (${formatMetricCount(breakdown.approvedTarget)} of ${formatMetricCount(breakdown.totalTarget)})`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer: Expand button */}
                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-semibold">
                    {approvedOnly
                      ? `${breakdown.totalProposalsCount} approved ${breakdown.totalProposalsCount === 1 ? 'project' : 'projects'}`
                      : `${breakdown.quantifiedProposalsCount} / ${breakdown.totalProposalsCount} proposals`}
                  </span>
                  {hasProposals ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(kpiKey)}
                      className="inline-flex items-center gap-0.5 font-bold text-[#1c398e] hover:text-blue-800 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide' : 'Details'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  ) : (
                    <span className="text-slate-400 italic">No targets</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded Proposal Details Drawer */}
        {expandedKpi && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Contributing Proposals for {KPI_METRIC_META[expandedKpi].title}
                </span>
                <span className="text-[10px] font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                  {summary.kpiBreakdowns[expandedKpi].proposals.length} projects
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedKpi(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>

            <div className="divide-y divide-slate-200/80 bg-white rounded-xl border border-slate-200/80 overflow-hidden">
              {summary.kpiBreakdowns[expandedKpi].proposals.map((item) => {
                const unionCode = UNION_ACRONYMS[item.union] || item.union;
                return (
                  <div
                    key={item.id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#1c398e] border border-blue-200">
                          {unionCode}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 truncate max-w-md">
                          {item.title}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {item.status === 'approved' ? 'Approved' : 'In Review'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 italic">
                        Raw text: "{item.rawInput}"
                        <span className="ml-1 text-[10px] text-slate-400 font-normal">
                          (extracted from {item.source === 'target_goal' ? 'Target Goal' : 'Metric Details'})
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 tabular-nums">
                          {item.extractedValue.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {summary.kpiBreakdowns[expandedKpi].shortUnit}
                        </span>
                      </div>

                      {onSelectProposal && (!canOpenProposal || canOpenProposal(item.id)) && (
                        <button
                          type="button"
                          onClick={() => onSelectProposal(item.id)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#1c398e] hover:text-white text-slate-600 transition cursor-pointer"
                          title="Open Proposal"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);
