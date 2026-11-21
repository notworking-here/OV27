import React, { useMemo, useState } from 'react';
import {
  Compass,
  Scale,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Users,
  Church,
  WifiOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Proposal } from '../../types';
import {
  evaluateTerritoryUpgAndImpactCorrelation,
  UpgReachTier,
} from '../../utils/impactPlausibilityEngine';
import { formatMetricCount } from '../../utils/kpiExtraction';
import { formatCurrency } from '../../utils/userUtils';

export interface TerritoryUpgImpactCardProps {
  proposals: Proposal[];
  selectedUnion: string;
  onSelectUnionScope?: (unionName: string) => void;
}

const TIER_ORDER: UpgReachTier[] = [
  'named_upg',
  'group_e_general',
  'christian_seeker_cd',
  'internal_ab',
];

export const TerritoryUpgImpactCard: React.FC<TerritoryUpgImpactCardProps> =
  React.memo(({ proposals, selectedUnion, onSelectUnionScope }) => {
    const summary = useMemo(
      () => evaluateTerritoryUpgAndImpactCorrelation(proposals, selectedUnion),
      [proposals, selectedUnion]
    );

    const [showUnionSpotCheck, setShowUnionSpotCheck] = useState(false);

    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-[#fbfcfd] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Union Population, Unreached Groups &amp; Practical Goal Check
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                {summary.scopeLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Compares {summary.scopeLabel}&rsquo;s unreached groups &amp; local churches with where project money goes and whether goals match budgets
            </p>
          </div>

          {/* Plausibility Health Summary Badges */}
          {summary.proposalCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap shrink-0 tabular-nums text-[11px] font-bold">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200"
                title="Projects with clear goal numbers that fit usual costs and local church size"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{summary.plausibilityCounts.plausible} Realistic</span>
              </span>
              {summary.plausibilityCounts.verify_economics > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200"
                  title="Projects with high or low cost per person, or very large goals per church—check if reusable equipment explains the cost"
                >
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  <span>{summary.plausibilityCounts.verify_economics} Check Cost/Goal</span>
                </span>
              )}
              {summary.plausibilityCounts.mismatch > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200"
                  title="Projects missing a clear KPI goal number or larger than the Union's population/membership"
                >
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>{summary.plausibilityCounts.mismatch} Fix Goal</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Main 2-Column Body */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left (7 cols): Territory Need vs. Funded UPG / Audience Tiers */}
          <div className="lg:col-span-7 space-y-4">
            {/* Territory Need Strip */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  {summary.scopeLabel} People &amp; Churches (Joshua Project &amp; Yearbook)
                </span>
                <span className="text-[11px] font-bold text-teal-800 tabular-nums">
                  {summary.leastReachedGroupsCount.toLocaleString()} Unreached Groups (
                  {summary.leastReachedShareOfGroupsPct}% of {summary.totalPeopleGroupsCount.toLocaleString()})
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-400 block">
                    Adventist Ratio
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    1 : {summary.memberToPopRatio.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {(summary.population / 1_000_000).toFixed(1)}M people
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <Church className="w-3 h-3 text-slate-400" />
                    <span>Local Churches</span>
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {summary.churches.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {summary.membership.toLocaleString()} members
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                    <WifiOff className="w-3 h-3 text-amber-600" />
                    <span>No Internet</span>
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {summary.offlinePct}%
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    ~{(summary.offlinePopulation / 1_000_000).toFixed(1)}M offline
                  </span>
                </div>
              </div>

              {/* Named Key People Groups when viewing a specific Union */}
              {summary.profile && summary.profile.keyPeopleGroups.length > 0 && (
                <div className="pt-2 border-t border-slate-200/70 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-800">
                    Largest Unreached Groups in {summary.profile.acronym}:{' '}
                  </span>
                  <span>
                    {summary.profile.keyPeopleGroups
                      .slice(0, 4)
                      .map(
                        (pg) =>
                          `${pg.name} (${
                            pg.population >= 1_000_000
                              ? `${(pg.population / 1_000_000).toFixed(1)}M`
                              : `${Math.round(pg.population / 1000)}K`
                          }, ${pg.primaryReligion.split('/')[0].trim()})`
                      )
                      .join(' · ')}
                  </span>
                </div>
              )}
            </div>

            {/* 4-Tier Funded Portfolio Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800">
                  Who Project Money Reaches (Audience &amp; UPG Groups)
                </span>
                <span className="text-[11px] font-bold text-teal-800 tabular-nums">
                  Group E / UPG Share: {summary.combinedUpgAndGroupESharePct}% (US$
                  {formatCurrency(summary.combinedUpgAndGroupEBudgetUsd, 0)})
                </span>
              </div>

              {/* Stacked 4-Segment Bar */}
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                {summary.totalBudgetUsd > 0 ? (
                  TIER_ORDER.map((tKey) => {
                    const st = summary.tiers[tKey];
                    if (st.shareOfBudgetPct <= 0) return null;
                    return (
                      <div
                        key={tKey}
                        className={`h-full transition-all duration-300 ${st.meta.barClass}`}
                        style={{ width: `${st.shareOfBudgetPct}%` }}
                        title={`${st.meta.fullLabel}: ${st.shareOfBudgetPct}% (US$${formatCurrency(
                          st.budgetUsd,
                          0
                        )} across ${st.proposalCount} proposals)`}
                      />
                    );
                  })
                ) : (
                  <div className="h-full w-full bg-slate-200" />
                )}
              </div>

              {/* 4 Tier Mini-Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 tabular-nums">
                {TIER_ORDER.map((tKey) => {
                  const st = summary.tiers[tKey];
                  return (
                    <div
                      key={tKey}
                      className="p-2.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between gap-2"
                      title={st.meta.description}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.meta.barClass}`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {st.meta.shortLabel}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {st.proposalCount} {st.proposalCount === 1 ? 'project' : 'projects'}
                            {st.targetSum > 0
                              ? ` · ${formatMetricCount(st.targetSum)} target`
                              : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-slate-900">
                          {st.shareOfBudgetPct}%
                        </div>
                        <div className="text-[10px] text-slate-500">
                          US${formatCurrency(st.budgetUsd, 0)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right (5 cols): Territory Penetration Ratios & Correlation Takeaways */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              {/* Penetration against Regional Capacity */}
              <div className="p-3.5 rounded-2xl bg-[#f8fafc] border border-slate-200/90 space-y-2.5">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#1c398e] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  <span>Expected Reach vs. {summary.scopeLabel} Size</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                  <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                    <div className="text-[10px] font-bold text-slate-400">Public Reach</div>
                    <div className="text-xs font-black text-sky-900 mt-0.5">
                      {summary.penetration.stage1ReachTotal > 0
                        ? `${summary.penetration.stage1PctOfPopulation}%`
                        : '—'}
                    </div>
                    <div className="text-[9.5px] text-slate-500 truncate">
                      {summary.penetration.stage1ReachTotal > 0
                        ? `${formatMetricCount(summary.penetration.stage1ReachTotal)} reached`
                        : 'of people'}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                    <div className="text-[10px] font-bold text-slate-400">Per Church</div>
                    <div className="text-xs font-black text-purple-900 mt-0.5">
                      {summary.penetration.stage2To4SeekersTotal > 0
                        ? `~${summary.penetration.seekersPerChurch}`
                        : '—'}
                    </div>
                    <div className="text-[9.5px] text-slate-500 truncate">
                      {summary.penetration.stage2To4SeekersTotal > 0
                        ? 'visitors/church'
                        : 'Stages 2–4'}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                    <div className="text-[10px] font-bold text-slate-400">Trained</div>
                    <div className="text-xs font-black text-amber-900 mt-0.5">
                      {summary.penetration.stage5EquippedTotal > 0
                        ? `${summary.penetration.equippedPctOfMembership}%`
                        : '—'}
                    </div>
                    <div className="text-[9.5px] text-slate-500 truncate">
                      {summary.penetration.stage5EquippedTotal > 0
                        ? `${formatMetricCount(summary.penetration.stage5EquippedTotal)} members`
                        : 'of members'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Correlation Insights */}
              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-700" />
                  <span>Key Takeaways</span>
                </div>

                {summary.insights.map((ins) => {
                  const boxClass =
                    ins.tone === 'critical'
                      ? 'bg-rose-50/45 border-rose-200/90'
                      : ins.tone === 'warning'
                      ? 'bg-amber-50/45 border-amber-200/90'
                      : ins.tone === 'positive'
                      ? 'bg-emerald-50/45 border-emerald-200/90'
                      : 'bg-blue-50/45 border-blue-200/90';

                  const ToneIcon =
                    ins.tone === 'critical'
                      ? AlertTriangle
                      : ins.tone === 'warning'
                      ? AlertCircle
                      : ins.tone === 'positive'
                      ? CheckCircle2
                      : Info;

                  const iconColor =
                    ins.tone === 'critical'
                      ? 'text-rose-600'
                      : ins.tone === 'warning'
                      ? 'text-amber-600'
                      : ins.tone === 'positive'
                      ? 'text-emerald-600'
                      : 'text-blue-600';

                  return (
                    <div
                      key={ins.id}
                      className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${boxClass}`}
                    >
                      <ToneIcon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900">{ins.title}</div>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">
                          {ins.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Division-Level High-UPG Union Spot-Check Toggle */}
            {!summary.isSingleUnion && summary.highUpgUnionRows.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUnionSpotCheck((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  <span>
                    Unions with Many Unreached Groups ({summary.highUpgUnionRows.filter((r) => r.isBlindSpot).length} have $0 for Group E)
                  </span>
                  {showUnionSpotCheck ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>

                {showUnionSpotCheck && (
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-[11px] tabular-nums">
                    {summary.highUpgUnionRows.map((row) => (
                      <div
                        key={row.acronym}
                        onClick={() => onSelectUnionScope?.(row.unionName)}
                        className={`px-3 py-2 flex items-center justify-between gap-2 ${
                          onSelectUnionScope ? 'hover:bg-slate-50 cursor-pointer' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-extrabold text-[#1c398e]">
                            {row.acronym}
                          </span>
                          <span className="text-slate-500 ml-1.5">
                            {row.leastReachedGroupsCount} UPGs · 1:{row.memberToPopRatio.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {row.approvedCount === 0 ? (
                            <span className="text-slate-400">0 approved</span>
                          ) : row.isBlindSpot ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                              0% Group E ({row.approvedCount} proj)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                              {row.groupEAndUpgSharePct}% Group E/UPG
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  });
