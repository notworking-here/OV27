import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TerritoryTotals } from '../../utils/monitorAnalytics';
import {
  SSD_DIVISION_YEARBOOK_TOTALS,
  UNION_INTELLIGENCE_PROFILES,
} from '../../data/unionIntelligence';

interface MonitorKpiSummaryProps {
  territoryTotals: TerritoryTotals;
}

export const MonitorKpiSummary: React.FC<MonitorKpiSummaryProps> = React.memo(({ territoryTotals }) => {
  const [showBaseline, setShowBaseline] = useState(false);

  const divisionFieldStats = useMemo(() => {
    const profiles = Object.values(UNION_INTELLIGENCE_PROFILES);
    const totalOnline = profiles.reduce(
      (sum, p) => sum + Math.round(p.population * (p.avgInternetPenetrationPct / 100)),
      0
    );
    const onlinePct =
      SSD_DIVISION_YEARBOOK_TOTALS.population > 0
        ? Math.round((totalOnline / SSD_DIVISION_YEARBOOK_TOTALS.population) * 1000) / 10
        : 79.6;
    const offlinePop = Math.max(0, SSD_DIVISION_YEARBOOK_TOTALS.population - totalOnline);
    const approvedPerChurch =
      SSD_DIVISION_YEARBOOK_TOTALS.churches > 0
        ? Math.round(territoryTotals.totalApprovedBudget / SSD_DIVISION_YEARBOOK_TOTALS.churches)
        : 0;
    const capPerChurch =
      SSD_DIVISION_YEARBOOK_TOTALS.churches > 0
        ? Math.round(territoryTotals.totalCapPool / SSD_DIVISION_YEARBOOK_TOTALS.churches)
        : 0;
    const frontierCount = profiles.filter((p) => p.memberToPopRatio >= 1000).length;
    const sensitiveCount = profiles.filter((p) => p.isSensitiveTerritory).length;

    return {
      totalOnline,
      onlinePct,
      offlinePop,
      approvedPerChurch,
      capPerChurch,
      frontierCount,
      sensitiveCount,
    };
  }, [territoryTotals.totalApprovedBudget, territoryTotals.totalCapPool]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Approved Funding */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Approved Allocations
          </span>
          <div className="mt-1.5">
            <p className="text-2xl font-black text-emerald-700 tracking-tight tabular-nums">
              ${territoryTotals.totalApprovedBudget.toLocaleString()}
            </p>
            <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500 tabular-nums">
              <span>{territoryTotals.totalApprovedCount} approved</span>
              <span>~${divisionFieldStats.approvedPerChurch.toLocaleString()}/church</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Territory Cap */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Combined Cap
          </span>
          <div className="mt-1.5">
            <p className="text-2xl font-black text-slate-800 tracking-tight tabular-nums">
              ${territoryTotals.totalCapPool.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate tabular-nums">
              Grant ${territoryTotals.totalDivisionPool.toLocaleString()} · Match ${territoryTotals.totalMatchingPool.toLocaleString()}
            </p>
            <div className="flex items-center justify-between text-[11px] mt-1 text-slate-600 tabular-nums">
              <span>{territoryTotals.globalUtilizationPct.toFixed(1)}% utilized</span>
              <span className={territoryTotals.globalRemainingPool < 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'}>
                {territoryTotals.globalRemainingPool < 0 ? 'Exceeds Cap' : 'Within Cap'}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(territoryTotals.globalUtilizationPct, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Pending Review Pipeline */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Pending Pipeline
          </span>
          <div className="mt-1.5">
            <p className="text-2xl font-black text-amber-700 tracking-tight tabular-nums">
              ${territoryTotals.totalPendingBudget.toLocaleString()}
            </p>
            <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500 tabular-nums">
              <span>{territoryTotals.totalPendingCount} in review</span>
              <span>
                Headroom <strong className="text-slate-800">${territoryTotals.globalRemainingPool.toLocaleString()}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Union Participation */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Union Participation
          </span>
          <div className="mt-1.5">
            <p className="text-2xl font-black text-[#1c398e] tracking-tight tabular-nums">
              {territoryTotals.activeUnionsCount} / {territoryTotals.totalUnionsCount}
            </p>
            <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500 tabular-nums">
              <span>
                {territoryTotals.totalUnionsCount > 0
                  ? Math.round(
                      (territoryTotals.activeUnionsCount / territoryTotals.totalUnionsCount) * 100
                    )
                  : 0}% engaged
              </span>
              <span className="font-semibold text-slate-700">
                {territoryTotals.totalProjectsCount} proposals
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible SSD Division Field Baseline Strip (Collapsed by default) */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex items-center gap-2 flex-wrap text-xs text-slate-600 tabular-nums min-w-0"
            title="Real-world church network, online vs. offline population, people groups, and linguistic diversity across the Southern Asia-Pacific Division (Adventist Yearbook June 2025, Digital 2026 & Joshua Project)"
          >
            <span className="font-bold text-slate-900">SSD Field Baseline</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>{SSD_DIVISION_YEARBOOK_TOTALS.churches.toLocaleString()} Churches</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>{(SSD_DIVISION_YEARBOOK_TOTALS.population / 1_000_000).toFixed(1)}M Pop (1:{SSD_DIVISION_YEARBOOK_TOTALS.memberToPopRatio})</span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">·</span>
            <span className="hidden sm:inline text-emerald-700 font-semibold">{divisionFieldStats.onlinePct}% Online</span>
            <span className="text-slate-300 hidden md:inline" aria-hidden="true">·</span>
            <span className="hidden md:inline">{SSD_DIVISION_YEARBOOK_TOTALS.countriesCount} Countries</span>
          </div>

          <button
            type="button"
            onClick={() => setShowBaseline((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-[11px] font-bold text-slate-700 transition cursor-pointer shrink-0"
          >
            <span>{showBaseline ? 'Hide Baseline' : 'Field Baseline'}</span>
            {showBaseline ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        </div>

        {showBaseline && (
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 w-full pt-3 mt-2.5 border-t border-slate-100">
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Local Churches
              </div>
              <div className="text-sm font-black text-slate-900 tabular-nums mt-0.5">
                {SSD_DIVISION_YEARBOOK_TOTALS.churches.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 font-medium tabular-nums">
                {SSD_DIVISION_YEARBOOK_TOTALS.constituentFieldsCount} Confs &amp; Missions
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Adventist Members
              </div>
              <div className="text-sm font-black text-[#1c398e] tabular-nums mt-0.5">
                {SSD_DIVISION_YEARBOOK_TOTALS.membership.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 font-medium tabular-nums">
                ~{SSD_DIVISION_YEARBOOK_TOTALS.avgMembersPerChurch} / church
              </div>
            </div>

            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Population
              </div>
              <div className="text-sm font-black text-slate-900 tabular-nums mt-0.5">
                {(SSD_DIVISION_YEARBOOK_TOTALS.population / 1_000_000).toFixed(1)}M
              </div>
              <div className="text-[10px] text-slate-500 font-medium tabular-nums">
                1:{SSD_DIVISION_YEARBOOK_TOTALS.memberToPopRatio} Ratio
              </div>
            </div>

            <div
              className="px-3 py-2 rounded-xl bg-emerald-50/50 border border-emerald-200/80"
              title="Estimated internet-connected population reachable via social media, video, and messaging platforms (DataReportal Mid-2026)"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Online Reachable
              </div>
              <div className="text-sm font-black text-emerald-700 tabular-nums mt-0.5">
                {(divisionFieldStats.totalOnline / 1_000_000).toFixed(0)}M Online
              </div>
              <div className="text-[10px] text-emerald-700/90 font-semibold tabular-nums">
                {divisionFieldStats.onlinePct}% Connected
              </div>
            </div>

            <div
              className="px-3 py-2 rounded-xl bg-amber-50/50 border border-amber-200/80"
              title="Population without active internet access requiring hybrid radio, SD-card, print, and in-person community outreach"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                Offline Population
              </div>
              <div className="text-sm font-black text-amber-800 tabular-nums mt-0.5">
                {(divisionFieldStats.offlinePop / 1_000_000).toFixed(0)}M Offline
              </div>
              <div className="text-[10px] text-amber-800/90 font-semibold tabular-nums">
                {(100 - divisionFieldStats.onlinePct).toFixed(1)}% Offline
              </div>
            </div>

            <div
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80"
              title="Total distinct ethno-linguistic people groups and least-reached / unreached groups (Joshua Project Scale 1–2, Target Audience Group E)"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                People Groups
              </div>
              <div className="text-sm font-black text-slate-900 tabular-nums mt-0.5">
                {SSD_DIVISION_YEARBOOK_TOTALS.totalPeopleGroupsCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-indigo-700 font-bold tabular-nums">
                {SSD_DIVISION_YEARBOOK_TOTALS.leastReachedGroupsCount.toLocaleString()} Unreached
              </div>
            </div>

            <div
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 sm:col-span-2 xl:col-span-2"
              title={`Top 5 languages across SSD: ${SSD_DIVISION_YEARBOOK_TOTALS.primaryLanguagesSummary}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Living Languages
              </div>
              <div className="text-sm font-black text-[#1c398e] tabular-nums mt-0.5">
                {SSD_DIVISION_YEARBOOK_TOTALS.livingLanguagesCount.toLocaleString()}+ Languages
              </div>
              <div className="text-[10px] text-slate-600 font-medium leading-tight mt-0.5 truncate">
                <strong className="text-slate-700">Top 5:</strong> {SSD_DIVISION_YEARBOOK_TOTALS.primaryLanguagesSummary}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

