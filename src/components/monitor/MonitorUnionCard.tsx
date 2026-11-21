import React, { useState } from 'react';
import { AlertTriangle, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Clock } from 'lucide-react';
import {
  PILLAR_META,
  UnionAnalyticsItem,
  calculatePillarCaps,
} from '../../utils/monitorAnalytics';
import { PublicProjectSummary } from '../../services/publicMonitorService';
import { getUnionIntelligence } from '../../data/unionIntelligence';

interface MonitorUnionCardProps {
  item: UnionAnalyticsItem;
  pillarPercentages: [number, number, number];
  onNavigateToReviewHub: (unionName: string) => void;
  isStakeholderView?: boolean;
  projects?: PublicProjectSummary[];
}

export const MonitorUnionCard: React.FC<MonitorUnionCardProps> = React.memo(
  ({ item, pillarPercentages, onNavigateToReviewHub, isStakeholderView = false, projects = [] }) => {
    const [showProjects, setShowProjects] = useState(false);
    const [showIntelDetails, setShowIntelDetails] = useState(false);
    const capUtilization = Math.min(item.utilizationPct, 100);
    const pillarCaps = calculatePillarCaps(item.totalCap, pillarPercentages);
    const [p1Cap, p2Cap, p3Cap] = pillarCaps;
    const unionProfile = getUnionIntelligence(item.union);

    const visibleProjects = projects.filter(
      (p) => p.status === 'approved' || p.status === 'under_review' || p.status === 'submitted'
    );

    return (
      <div
        className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-2xs flex flex-col justify-between transition-all duration-150 hover:shadow-md ${
          item.isOverAllocated
            ? 'border-amber-300 ring-1 ring-amber-300/60'
            : 'border-slate-200/90'
        }`}
      >
        <div>
          {/* Tile Header: Acronym, Category, and Name */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                {item.acronym && (
                  <>
                    <span className="font-extrabold uppercase tracking-wider text-[#1c398e]">
                      {item.acronym}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                  </>
                )}
                <span className="truncate">{item.category}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 truncate" title={item.union}>
                {item.union}
              </h3>
            </div>

            {/* Utilization Readout */}
            <span
              className={`text-xs font-extrabold shrink-0 tabular-nums ${
                item.isApprovedExceeded
                  ? 'text-rose-700'
                  : item.utilizationPct >= 80
                  ? 'text-amber-700'
                  : item.utilizationPct > 0
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              {item.utilizationPct.toFixed(0)}% utilized
            </span>
          </div>

          {/* Compact 1-Line Territory Baseline + On-Demand Field Intel */}
          {unionProfile && (
            <div className="mb-3 px-2.5 py-1.5 rounded-xl bg-slate-50/90 border border-slate-200/70 text-[11px]">
              <div
                className="flex items-center justify-between gap-2 tabular-nums text-slate-600"
                title={`${unionProfile.membership.toLocaleString()} Members · ${(unionProfile.population / 1_000_000).toFixed(1)}M Population · ${unionProfile.avgInternetPenetrationPct}% Online · ${unionProfile.sensitivityLevel}`}
              >
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span>
                    <strong className="text-slate-900">{unionProfile.churches.toLocaleString()}</strong> Churches
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="font-semibold text-[#1c398e]">
                    1:{unionProfile.memberToPopRatio.toLocaleString()}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span>{unionProfile.avgInternetPenetrationPct}% Online</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIntelDetails((prev) => !prev)}
                  className="text-[10px] font-bold text-[#1c398e] hover:underline cursor-pointer shrink-0"
                >
                  {showIntelDetails ? 'Hide Intel' : 'Field Intel'}
                </button>
              </div>

              {showIntelDetails && (
                <div className="pt-2 mt-1.5 border-t border-slate-200/80 space-y-1 text-[10px] text-slate-600">
                  <div className="flex items-center gap-1.5 flex-wrap tabular-nums text-slate-700 font-medium">
                    <span>{unionProfile.membership.toLocaleString()} Members</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span>{(unionProfile.population / 1_000_000).toFixed(1)}M Pop</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className={unionProfile.isSensitiveTerritory ? 'text-amber-800 font-semibold' : 'text-emerald-800'}>
                      {unionProfile.sensitivityLevel}
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-800">Countries &amp; Offline Gap: </strong>
                    <span>
                      {unionProfile.countries.join(', ')} ({unionProfile.offlinePopulationSummary})
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-800">Top Channels: </strong>
                    <span>
                      {unionProfile.topPlatformsSummary
                        .slice(0, 3)
                        .map((p) => `${p.platform} (${p.reach})`)
                        .join(' · ')}
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-800">
                      People Groups &amp; Languages ({unionProfile.livingLanguagesCount.toLocaleString()}+):{' '}
                    </strong>
                    <span>
                      {unionProfile.totalPeopleGroupsCount.toLocaleString()} groups ({unionProfile.leastReachedGroupsCount.toLocaleString()} unreached) · {unionProfile.primaryLanguagesSummary}
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-800">
                      Fields ({unionProfile.constituentFields.length}):{' '}
                    </strong>
                    <span>{unionProfile.constituentFields.join(', ')}</span>
                  </div>
                  {unionProfile.keyPeopleGroups.length > 0 && (
                    <div>
                      <strong className="text-slate-800">Priority Groups: </strong>
                      <span>
                        {unionProfile.keyPeopleGroups
                          .slice(0, 3)
                          .map(
                            (pg) =>
                              `${pg.name.split('(')[0].trim()} (${(pg.population / 1_000_000).toFixed(1)}M · ${pg.primaryReligion})`
                          )
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="text-slate-400 truncate" title={unionProfile.streetAddress}>
                    <strong className="text-slate-600">HQ: </strong>
                    {unionProfile.streetAddress}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Over-allocation Alert Indicator */}
          {item.isOverAllocated && (
            <div className="mb-3 p-2 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold leading-tight">
                Pipeline exceeds cap by US${item.overAllocationAmount.toLocaleString()} if approved.
              </span>
            </div>
          )}

          {/* Total Budget & Remaining Budget */}
          <div
            className="p-3 bg-slate-50/90 rounded-xl border border-slate-100 space-y-1.5 mb-3 text-xs"
            title={
              unionProfile && unionProfile.churches > 0 && item.totalCap > 0
                ? `SSD Grant: US$${item.divisionAlloc.toLocaleString()} + Union Match: US$${item.matchingPledge.toLocaleString()} (~US$${Math.round(item.totalCap / unionProfile.churches).toLocaleString()}/church)`
                : `SSD Grant: US$${item.divisionAlloc.toLocaleString()} + Union Match: US$${item.matchingPledge.toLocaleString()}`
            }
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-700 font-bold text-xs">
                Total Budget Cap
              </span>
              <span className="font-black text-slate-900 text-sm tabular-nums">
                US${item.totalCap.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 tabular-nums">
              <span>
                Grant ${item.divisionAlloc.toLocaleString()} · Match ${item.matchingPledge.toLocaleString()}
              </span>
              <span
                className={`font-bold ${
                  item.remainingBudget >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                Rem: US${item.remainingBudget.toLocaleString()}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  item.isApprovedExceeded
                    ? 'bg-rose-500'
                    : item.utilizationPct >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${capUtilization}%` }}
              />
            </div>
          </div>

          {/* Territory Leadership & Proposal Contributors */}
          <div className="px-2.5 py-2 bg-slate-50/90 rounded-xl border border-slate-100/90 mb-3 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Coordinator
              </span>
              <span
                className="text-[11px] font-semibold text-slate-800 truncate text-right max-w-[65%]"
                title={item.treasurerName || 'Unassigned'}
              >
                {item.treasurerName || 'Unassigned'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Liaison
              </span>
              <span
                className="text-[11px] font-semibold text-slate-800 truncate text-right max-w-[65%]"
                title={item.liaisonName || 'Unassigned'}
              >
                {item.liaisonName || 'Unassigned'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[10px] text-slate-500 tabular-nums">
              <span>Contributors</span>
              <span className="font-semibold text-slate-700">
                {item.proposalMakersCount} {item.proposalMakersCount === 1 ? 'Maker' : 'Makers'}
              </span>
            </div>
          </div>

          {/* Approved vs Pending Proposal Counts & Amounts */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Approved
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 tabular-nums">
                  ({item.approvedCount})
                </span>
              </div>
              <div className="text-sm font-black text-emerald-900 tabular-nums mt-0.5">
                US${item.approvedBudget.toLocaleString()}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Pending
                </span>
                <span className="text-[10px] font-semibold text-amber-700 tabular-nums">
                  ({item.pendingCount})
                </span>
              </div>
              <div className="text-sm font-black text-amber-900 tabular-nums mt-0.5">
                US${item.pendingBudget.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Strategic Pillar Distribution: Approved vs Pending */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div
              className="flex items-center justify-between gap-1 w-full text-[10px]"
              title={`Benchmark Caps — P1 (${pillarPercentages[0]}%): US$${p1Cap.toLocaleString()} · P2 (${pillarPercentages[1]}%): US$${p2Cap.toLocaleString()} · P3 (${pillarPercentages[2]}%): US$${p3Cap.toLocaleString()}`}
            >
              <span className="font-bold uppercase tracking-wider text-slate-500">
                Pillar Split
              </span>
              <span className="text-slate-400 tabular-nums">
                Caps: ${p1Cap.toLocaleString()} / ${p2Cap.toLocaleString()} / ${p3Cap.toLocaleString()}
              </span>
            </div>

            {/* Approved Distribution Row with Distinct Emerald Background */}
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs gap-1 flex-wrap">
                <span className="font-bold text-emerald-800 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Approved
                </span>
                <div className="flex items-center gap-1 text-[10px] tabular-nums font-semibold flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold border ${
                      item.totalCap > 0 && item.approvedPillars[0] > p1Cap
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-blue-50 text-blue-800 border-blue-200/90'
                    }`}
                    title={`Pillar 1 (Prayer & Training) - Approved: US$${item.approvedPillars[0].toLocaleString()} / Cap: US$${p1Cap.toLocaleString()}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    P1: ${item.approvedPillars[0].toLocaleString()}
                    {item.totalCap > 0 && item.approvedPillars[0] > p1Cap && (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-rose-700 bg-rose-100 px-1 rounded ml-0.5">
                        &gt; Cap
                      </span>
                    )}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold border ${
                      item.totalCap > 0 && item.approvedPillars[1] > p2Cap
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-purple-50 text-purple-800 border-purple-200/90'
                    }`}
                    title={`Pillar 2 (Bold Media & Tools) - Approved: US$${item.approvedPillars[1].toLocaleString()} / Cap: US$${p2Cap.toLocaleString()}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    P2: ${item.approvedPillars[1].toLocaleString()}
                    {item.totalCap > 0 && item.approvedPillars[1] > p2Cap && (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-rose-700 bg-rose-100 px-1 rounded ml-0.5">
                        &gt; Cap
                      </span>
                    )}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold border ${
                      item.totalCap > 0 && item.approvedPillars[2] > p3Cap
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                    }`}
                    title={`Pillar 3 (Proclamation & Harvesting) - Approved: US$${item.approvedPillars[2].toLocaleString()} / Cap: US$${p3Cap.toLocaleString()}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    P3: ${item.approvedPillars[2].toLocaleString()}
                    {item.totalCap > 0 && item.approvedPillars[2] > p3Cap && (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-rose-700 bg-rose-100 px-1 rounded ml-0.5">
                        &gt; Cap
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {/* Color-Coded Mini Stacked Bar for Approved */}
              <div className="h-2 w-full bg-white/80 rounded-full flex overflow-hidden shadow-inner border border-emerald-200/40">
                {item.approvedBudget > 0 ? (
                  <>
                    {item.approvedPillars[0] > 0 && (
                      <div
                        style={{
                          width: `${(item.approvedPillars[0] / item.approvedBudget) * 100}%`,
                          backgroundColor: PILLAR_META[0].color,
                        }}
                        className="h-full border-r border-white/80 transition-all"
                        title={`Approved Pillar 1: US$${item.approvedPillars[0].toLocaleString()}`}
                      />
                    )}
                    {item.approvedPillars[1] > 0 && (
                      <div
                        style={{
                          width: `${(item.approvedPillars[1] / item.approvedBudget) * 100}%`,
                          backgroundColor: PILLAR_META[1].color,
                        }}
                        className="h-full border-r border-white/80 transition-all"
                        title={`Approved Pillar 2: US$${item.approvedPillars[1].toLocaleString()}`}
                      />
                    )}
                    {item.approvedPillars[2] > 0 && (
                      <div
                        style={{
                          width: `${(item.approvedPillars[2] / item.approvedBudget) * 100}%`,
                          backgroundColor: PILLAR_META[2].color,
                        }}
                        className="h-full transition-all"
                        title={`Approved Pillar 3: US$${item.approvedPillars[2].toLocaleString()}`}
                      />
                    )}
                  </>
                ) : (
                  <div className="h-full w-full bg-slate-200/50" />
                )}
              </div>
            </div>

            {/* Pending Distribution Row with Distinct Amber Background */}
            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100/90 space-y-1.5">
              <div className="flex items-center justify-between text-xs gap-1 flex-wrap">
                <span className="font-bold text-amber-800 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Pending
                </span>
                <div className="flex items-center gap-1 text-[10px] tabular-nums font-semibold flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                      item.totalCap > 0 && item.approvedPillars[0] + item.pendingPillars[0] > p1Cap
                        ? 'bg-rose-50/90 text-rose-800 border-rose-300 font-bold'
                        : 'bg-blue-50/70 text-blue-700 border-blue-200/60'
                    }`}
                    title={`Pending Pillar 1: US$${item.pendingPillars[0].toLocaleString()} (Total with Approved: US$${(
                      item.approvedPillars[0] + item.pendingPillars[0]
                    ).toLocaleString()} vs Cap US$${p1Cap.toLocaleString()})`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    P1: ${item.pendingPillars[0].toLocaleString()}
                    {item.totalCap > 0 &&
                      item.approvedPillars[0] + item.pendingPillars[0] > p1Cap && (
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-rose-700 bg-rose-100 px-1 rounded ml-0.5">
                          &gt; Cap
                        </span>
                      )}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                      item.totalCap > 0 && item.approvedPillars[1] + item.pendingPillars[1] > p2Cap
                        ? 'bg-rose-50/90 text-rose-800 border-rose-300 font-bold'
                        : 'bg-purple-50/70 text-purple-700 border-purple-200/60'
                    }`}
                    title={`Pending Pillar 2: US$${item.pendingPillars[1].toLocaleString()} (Total with Approved: US$${(
                      item.approvedPillars[1] + item.pendingPillars[1]
                    ).toLocaleString()} vs Cap US$${p2Cap.toLocaleString()})`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    P2: ${item.pendingPillars[1].toLocaleString()}
                    {item.totalCap > 0 &&
                      item.approvedPillars[1] + item.pendingPillars[1] > p2Cap && (
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-rose-700 bg-rose-100 px-1 rounded ml-0.5">
                          &gt; Cap
                        </span>
                      )}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                      item.totalCap > 0 && item.approvedPillars[2] + item.pendingPillars[2] > p3Cap
                        ? 'bg-rose-50/90 text-rose-800 border-rose-300 font-bold'
                        : 'bg-emerald-50/70 text-emerald-700 border-emerald-200/60'
                    }`}
                    title={`Pending Pillar 3: US$${item.pendingPillars[2].toLocaleString()} (Total with Approved: US$${(
                      item.approvedPillars[2] + item.pendingPillars[2]
                    ).toLocaleString()} vs Cap US$${p3Cap.toLocaleString()})`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    P3: ${item.pendingPillars[2].toLocaleString()}
                    {item.totalCap > 0 &&
                      item.approvedPillars[2] + item.pendingPillars[2] > p3Cap && (
                        <span className="text-[8px] uppercase tracking-wider font-extrabold text-rose-700 bg-rose-100 px-1 rounded ml-0.5">
                          &gt; Cap
                        </span>
                      )}
                  </span>
                </div>
              </div>
              {/* Color-Coded Mini Stacked Bar for Pending */}
              <div className="h-2 w-full bg-white/80 rounded-full flex overflow-hidden shadow-inner border border-amber-200/40">
                {item.pendingBudget > 0 ? (
                  <>
                    {item.pendingPillars[0] > 0 && (
                      <div
                        style={{
                          width: `${(item.pendingPillars[0] / item.pendingBudget) * 100}%`,
                          backgroundColor: PILLAR_META[0].softColor,
                        }}
                        className="h-full border-r border-white/80 transition-all opacity-90"
                        title={`Pending Pillar 1: US$${item.pendingPillars[0].toLocaleString()}`}
                      />
                    )}
                    {item.pendingPillars[1] > 0 && (
                      <div
                        style={{
                          width: `${(item.pendingPillars[1] / item.pendingBudget) * 100}%`,
                          backgroundColor: PILLAR_META[1].softColor,
                        }}
                        className="h-full border-r border-white/80 transition-all opacity-90"
                        title={`Pending Pillar 2: US$${item.pendingPillars[1].toLocaleString()}`}
                      />
                    )}
                    {item.pendingPillars[2] > 0 && (
                      <div
                        style={{
                          width: `${(item.pendingPillars[2] / item.pendingBudget) * 100}%`,
                          backgroundColor: PILLAR_META[2].softColor,
                        }}
                        className="h-full transition-all opacity-90"
                        title={`Pending Pillar 3: US$${item.pendingPillars[2].toLocaleString()}`}
                      />
                    )}
                  </>
                ) : (
                  <div className="h-full w-full bg-slate-200/50" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Territory Projects Summary (Available to Stakeholders & Staff) */}
        {(visibleProjects.length > 0 || !isStakeholderView) && (
          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2">
              {visibleProjects.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowProjects((prev) => !prev)}
                  className="flex-1 py-2 px-3 text-xs font-bold text-[#1c398e] bg-blue-50/70 hover:bg-blue-100/80 border border-blue-200/70 rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>
                    {showProjects ? 'Hide' : 'View'} {visibleProjects.length}{' '}
                    {visibleProjects.length === 1 ? 'Project' : 'Projects'}
                  </span>
                  {showProjects ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#1c398e]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#1c398e]" />
                  )}
                </button>
              )}

              {!isStakeholderView && (
                <button
                  type="button"
                  onClick={() => onNavigateToReviewHub(item.union)}
                  className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 rounded-xl transition-all flex items-center justify-between group cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-hidden"
                >
                  <span>Review {item.acronym || item.union}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}
            </div>

            {showProjects && visibleProjects.length > 0 && (
              <div className="divide-y divide-slate-100 bg-slate-50/80 rounded-xl border border-slate-200/80 overflow-hidden max-h-60 overflow-y-auto">
                {visibleProjects.map((proj) => (
                  <div key={proj.id} className="p-2.5 text-xs flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {proj.status === 'approved' ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                            In Review
                          </span>
                        )}
                        {proj.formattedTarget && (
                          <span className="text-[10px] font-bold text-emerald-700 tabular-nums">
                            Target: {proj.formattedTarget}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-800 mt-1 leading-snug line-clamp-2">
                        {proj.title}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-900 tabular-nums text-xs">
                        US${proj.totalBudget.toLocaleString()}
                      </span>
                      <span className="block text-[9px] text-slate-400 font-semibold">
                        P{proj.pillarIndex + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
