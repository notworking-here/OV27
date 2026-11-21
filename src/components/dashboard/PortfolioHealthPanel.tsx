import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Proposal, StrategicKpiCaps, UserRole } from '../../types';
import {
  evaluatePortfolioHealth,
  HealthSeverity,
} from '../../utils/portfolioHealthDiagnostics';

interface PortfolioHealthPanelProps {
  approvedProposals: Proposal[];
  baseBudgetPool: number;
  kpiCaps: StrategicKpiCaps;
  userRole: UserRole;
  isSnapshotContext: boolean;
  scopeLabel: string;
}

const STATUS_STYLE: Record<
  HealthSeverity,
  {
    pillBg: string;
    pillText: string;
    pillBorder: string;
    cardBorder: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  healthy: {
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-800',
    pillBorder: 'border-emerald-200',
    cardBorder: 'border-slate-200/90',
    icon: CheckCircle2,
  },
  attention: {
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-900',
    pillBorder: 'border-amber-200',
    cardBorder: 'border-amber-200/80',
    icon: AlertCircle,
  },
  critical: {
    pillBg: 'bg-rose-50',
    pillText: 'text-rose-800',
    pillBorder: 'border-rose-200',
    cardBorder: 'border-rose-200/80',
    icon: AlertTriangle,
  },
};

export const PortfolioHealthPanel: React.FC<PortfolioHealthPanelProps> = React.memo(
  ({
    approvedProposals,
    baseBudgetPool,
    kpiCaps,
    userRole,
    isSnapshotContext,
    scopeLabel,
  }) => {
    const report = useMemo(
      () =>
        evaluatePortfolioHealth({
          approvedProposals,
          baseBudgetPool,
          kpiCaps,
          userRole,
          isSnapshotContext,
          scopeLabel,
        }),
      [
        approvedProposals,
        baseBudgetPool,
        kpiCaps,
        userRole,
        isSnapshotContext,
        scopeLabel,
      ]
    );

    const [isExpanded, setIsExpanded] = useState<boolean>(true);
    const overallTheme = STATUS_STYLE[report.overallStatus];
    const OverallIcon = overallTheme.icon;

    const subCheckList = [
      report.subChecks.pillarBalance,
      report.subChecks.objectiveCoverage,
      report.subChecks.pathwayContinuity,
    ];

    return (
      <div
        className={`bg-white rounded-3xl border shadow-xs overflow-hidden transition-colors ${overallTheme.cardBorder}`}
      >
        {/* Top Health Summary Header */}
        <div className="px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#fbfcfd] border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 ${overallTheme.pillBg} ${overallTheme.pillBorder} ${overallTheme.pillText}`}
            >
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-slate-900 tracking-tight">
                  Approved Projects Health &amp; Playbook Balance
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${overallTheme.pillBg} ${overallTheme.pillText} ${overallTheme.pillBorder}`}
                >
                  <OverallIcon className="w-3 h-3 shrink-0" />
                  <span>{report.overallLabel}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {report.overallHeadline}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
            {/* 3 Sub-Health Status Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {subCheckList.map((check) => {
                const st = STATUS_STYLE[check.status];
                const SubIcon = st.icon;
                return (
                  <div
                    key={check.id}
                    title={check.summary}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold ${st.pillBg} ${st.pillText} ${st.pillBorder}`}
                  >
                    <SubIcon className="w-3 h-3 shrink-0" />
                    <span className="font-bold">{check.title}:</span>
                    <span className="tabular-nums">{check.badgeText}</span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer shrink-0"
            >
              <span>{isExpanded ? 'Hide Details' : 'View Insights'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Visual 5-Stage Mission Pathway Funnel Strip */}
            <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                <span className="font-extrabold text-slate-800 uppercase tracking-wider">
                  Mission Pathway Steps ({report.totalApprovedCount} approved)
                </span>
                <span className="text-slate-500">
                  Steps: P1 Training → 1. Reach → 2. Engage → 3. Connect → 4. Disciple → 5. Multiply
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {report.pathwayStages.map((stage, idx) => {
                  const isMissing = stage.isGap && report.totalApprovedCount > 0;
                  return (
                    <div
                      key={stage.key}
                      className={`relative px-3 py-2 rounded-xl border flex items-center justify-between gap-2 tabular-nums ${
                        isMissing
                          ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                          : stage.count === 0
                          ? 'bg-white border-slate-200 text-slate-500'
                          : 'bg-white border-slate-200/90 text-slate-900'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {stage.key === 'enabling'
                            ? 'P1 Enabling'
                            : `Stage ${stage.stageNumberLabel}`}
                        </div>
                        <div className="text-xs font-extrabold truncate flex items-center gap-1">
                          <span>{stage.shortLabel}</span>
                          {idx > 0 && idx < report.pathwayStages.length - 1 && (
                            <ArrowRight className="w-2.5 h-2.5 text-slate-300 hidden xl:inline shrink-0" />
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`text-sm font-black ${
                            isMissing
                              ? 'text-rose-700'
                              : stage.count > 0
                              ? 'text-[#1c398e]'
                              : 'text-slate-400'
                          }`}
                        >
                          {stage.count}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {isMissing ? 'Gap' : `${stage.sharePct}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2-Column Insights: Observations (Left) & Playbook Intentionality Reminders (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: Data Observations */}
              <div className="lg:col-span-7 space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1c398e]" />
                  <span>What the Data Shows</span>
                </div>
                <div className="space-y-2">
                  {report.observations.map((obs) => {
                    const accent =
                      obs.severity === 'critical'
                        ? 'bg-rose-50/45 border-rose-200/90'
                        : obs.severity === 'warning'
                        ? 'bg-amber-50/45 border-amber-200/90'
                        : obs.severity === 'positive'
                        ? 'bg-emerald-50/45 border-emerald-200/90'
                        : 'bg-blue-50/45 border-blue-200/90';

                    const ObsIcon =
                      obs.severity === 'critical'
                        ? AlertTriangle
                        : obs.severity === 'warning'
                        ? AlertCircle
                        : obs.severity === 'positive'
                        ? CheckCircle2
                        : Info;

                    const iconColor =
                      obs.severity === 'critical'
                        ? 'text-rose-600'
                        : obs.severity === 'warning'
                        ? 'text-amber-600'
                        : obs.severity === 'positive'
                        ? 'text-emerald-600'
                        : 'text-blue-600';

                    return (
                      <div
                        key={obs.id}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 ${accent}`}
                      >
                        <ObsIcon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                        <div className="min-w-0 flex-1 text-xs space-y-1">
                          <div className="font-bold text-slate-900">{obs.title}</div>
                          <p className="text-slate-600 leading-relaxed">
                            {obs.detail}
                          </p>
                          {obs.actionStep && (
                            <div className="pt-1.5 mt-1 border-t border-slate-200/70 text-[11px] text-slate-800 leading-snug">
                              <span className="font-extrabold uppercase tracking-wider text-[10px] text-[#1c398e] mr-1.5">
                                Action:
                              </span>
                              <span className="font-semibold">{obs.actionStep}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Helpful Playbook Reminders */}
              <div className="lg:col-span-5 space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Helpful Playbook Reminders</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#f4f7fb] border border-blue-200/70 space-y-3">
                  <div className="text-xs text-slate-800 space-y-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e]">
                      Playbook Golden Rule ({report.goldenRule.pageRef})
                    </div>
                    <p className="font-semibold italic text-slate-900 leading-snug">
                      &ldquo;{report.goldenRule.quote}&rdquo;
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-blue-200/60">
                    {report.reminders.map((rem) => (
                      <div key={rem.id} className="text-xs space-y-1 p-2.5 rounded-xl bg-white/80 border border-blue-200/60">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{rem.tag}</span>
                          {rem.pageRef && (
                            <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                              {rem.pageRef}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">{rem.text}</p>
                        {rem.actionStep && (
                          <p className="text-[11px] text-slate-900 font-semibold leading-snug pt-0.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e] mr-1.5">
                              Step:
                            </span>
                            {rem.actionStep}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
