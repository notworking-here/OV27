import React, { useMemo } from 'react';
import {
  Compass,
  Building2,
  Globe,
  UserCheck,
  Target,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  Proposal,
  UserAccount,
  UNIONS,
  UNION_ACRONYMS,
  ALL_STRATEGIC_KPIS,
  STRATEGIC_PILLARS_CONFIG,
  StrategicKpiCaps,
  getCanonicalUnion,
  getUserAllUnions,
} from '../../types';
import { formatCurrency } from '../../utils/userUtils';
import { matchProposalToStrategicKpi } from '../../utils/strategicKpiMatching';
import { calculateAudienceInvestment } from '../../utils/audienceInvestment';

export type DashboardContextMode = 'live' | 'union_context' | 'division_context';

interface StrategicContextCardProps {
  currentUser: UserAccount;
  liveProposals: Proposal[];
  divisionApprovedProposals: Proposal[];
  allocations: Record<string, number>;
  matchingPledges: Record<string, number>;
  kpiCaps: StrategicKpiCaps;
  contextMode: DashboardContextMode;
  onContextModeChange: (mode: DashboardContextMode) => void;
  selectedUnionScope?: string;
  snapshotUpdatedAt?: string;
  onSelectProposal?: (proposalId: string) => void;
}

const AUDIENCE_LABELS: Record<string, string> = {
  A1: 'A1 Missional Members',
  A2: 'A2 Pastors & Leaders',
  A3: 'A3 Youth & Students',
  A4: 'A4 Entities & Teams',
  B: 'B Inactive Members',
  C: 'C Interested Seekers',
  D: 'D Non-SDA Christians',
  E: 'E World Religions / Secular',
};

const PILLAR_SHORT_LABELS: Record<string, string> = {
  pillar_1: 'P1 · Training & Inspiration',
  pillar_2: 'P2 · Bold Tools & Media',
  pillar_3: 'P3 · Proclamation & Harvesting',
};

const KPI_SHORT_LABELS: Record<string, string> = {
  kpi_1: 'Obj 1 · Creators Conferences',
  kpi_2: 'Obj 2 · Proclamation Kits',
  kpi_3: 'Obj 3 · Global Media Production',
  kpi_4: 'Obj 4 · Short-Form Content',
  kpi_5: 'Obj 5 · Unreached Groups (UPG)',
  kpi_6: 'Obj 6 · Proclamation & Harvesting',
  kpi_7: 'Obj 7 · Global Marketing',
};

function getProposalDivisionBudget(p: Proposal): number {
  return (p.budgetItems || []).reduce(
    (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );
}

interface PillarStatRow {
  pillar: (typeof STRATEGIC_PILLARS_CONFIG)[number];
  shortLabel: string;
  budget: number;
  ratioPct: number;
  capPct: number;
  diffPct: number;
  isOver: boolean;
  isNear: boolean;
}

interface KpiStatRow {
  kpi: (typeof ALL_STRATEGIC_KPIS)[number];
  shortLabel: string;
  count: number;
  budget: number;
  ratioPct: number;
  capPct: number;
  isOverCap: boolean;
  isNearCap: boolean;
}

function analyzePortfolioMix(
  approvedList: Proposal[],
  poolBase: number,
  kpiCaps: StrategicKpiCaps
): {
  committedBudget: number;
  kpiStats: KpiStatRow[];
  pillarStats: PillarStatRow[];
  zeroOrLowKpis: KpiStatRow[];
  overCapKpis: KpiStatRow[];
  zeroAudiences: string[];
} {
  const committedBudget = approvedList.reduce((sum, p) => sum + getProposalDivisionBudget(p), 0);
  const denominator = poolBase > 0 ? poolBase : committedBudget;

  const kpiStats: KpiStatRow[] = ALL_STRATEGIC_KPIS.map((k) => {
    const matched = approvedList.filter(
      (p) => matchProposalToStrategicKpi(p, ALL_STRATEGIC_KPIS)?.id === k.id
    );
    const budget = matched.reduce((sum, p) => sum + getProposalDivisionBudget(p), 0);
    const ratioPct = denominator > 0 ? Math.round(((budget / denominator) * 100) * 10) / 10 : 0;
    const capPct = kpiCaps.kpiCaps[k.id] ?? k.defaultCap;
    return {
      kpi: k,
      shortLabel: KPI_SHORT_LABELS[k.id] || `Obj ${k.number} · ${k.title}`,
      count: matched.length,
      budget,
      ratioPct,
      capPct,
      isOverCap: ratioPct > capPct && budget > 0,
      isNearCap: ratioPct >= capPct * 0.85 && ratioPct <= capPct && budget > 0,
    };
  });

  const pillarStats: PillarStatRow[] = STRATEGIC_PILLARS_CONFIG.map((pillar) => {
    const pillarBudget = kpiStats
      .filter((s) => s.kpi.pillarId === pillar.id)
      .reduce((sum, s) => sum + s.budget, 0);
    const ratioPct =
      denominator > 0 ? Math.round(((pillarBudget / denominator) * 100) * 10) / 10 : 0;
    const capPct = kpiCaps.pillarCaps[pillar.id] ?? pillar.defaultCap;
    const diffPct = Math.round((ratioPct - capPct) * 10) / 10;
    return {
      pillar,
      shortLabel: PILLAR_SHORT_LABELS[pillar.id] || `P${pillar.number} · ${pillar.title}`,
      budget: pillarBudget,
      ratioPct,
      capPct,
      diffPct,
      isOver: ratioPct > capPct && pillarBudget > 0,
      isNear: ratioPct >= capPct * 0.85 && ratioPct <= capPct && pillarBudget > 0,
    };
  });

  const zeroOrLowKpis = [...kpiStats]
    .filter((s) => !s.isOverCap)
    .sort((a, b) => a.count - b.count || a.ratioPct - b.ratioPct)
    .slice(0, 3);

  const overCapKpis = kpiStats
    .filter((s) => s.isOverCap)
    .sort((a, b) => b.ratioPct - b.capPct - (a.ratioPct - a.capPct));

  const audienceAnalysis = calculateAudienceInvestment(approvedList);
  const zeroAudiences = audienceAnalysis.breakdownByAudience
    .filter((a) => a.proposalCount === 0)
    .map((a) => AUDIENCE_LABELS[a.id] || a.label || a.id);

  return {
    committedBudget,
    kpiStats,
    pillarStats,
    zeroOrLowKpis,
    overCapKpis,
    zeroAudiences,
  };
}

export function StrategicContextCard({
  currentUser,
  liveProposals,
  divisionApprovedProposals,
  allocations,
  matchingPledges,
  kpiCaps,
  contextMode,
  onContextModeChange,
  selectedUnionScope = 'all',
  snapshotUpdatedAt,
  onSelectProposal,
}: StrategicContextCardProps) {
  const role = currentUser.role || 'user';
  const isSuperAdmin = role === 'super_admin';
  const isLiaison = role === 'division_liaison';
  const isCoordinatorOrTreasurer = role === 'coordinator' || role === 'treasurer';
  const isProposalMaker = !isSuperAdmin && !isLiaison && !isCoordinatorOrTreasurer;

  const userUnion = currentUser.union || '';
  const canonicalUserUnion = getCanonicalUnion(userUnion);
  const hasValidUserUnion = Boolean(
    canonicalUserUnion && UNIONS.some((u) => getCanonicalUnion(u) === canonicalUserUnion)
  );
  const userUnionAcronym =
    UNION_ACRONYMS[userUnion] || UNION_ACRONYMS[canonicalUserUnion] || userUnion || 'Union';

  const liaisonUnions = useMemo(() => getUserAllUnions(currentUser), [currentUser]);

  // Determine the active geographic focus of the dashboard:
  // - Single Union selected (by Super Admin dropdown, Liaison dropdown, Coordinator/Treasurer, or Maker's Union Approved tab)
  // - Multiple Assigned Unions (Liaison viewing "All Assigned")
  // - Whole SSD Division (Super Admin viewing "All Unions" OR anyone viewing "SSD Division (Approved)")
  const isViewingDivisionContext = !isSuperAdmin && contextMode === 'division_context';
  const hasSingleSelectedUnion =
    !isViewingDivisionContext &&
    Boolean(selectedUnionScope && selectedUnionScope !== 'all');
  const activeUnionName = hasSingleSelectedUnion
    ? selectedUnionScope
    : isProposalMaker && hasValidUserUnion
    ? userUnion
    : '';
  const activeUnionAcronym = activeUnionName
    ? UNION_ACRONYMS[activeUnionName] ||
      UNION_ACRONYMS[getCanonicalUnion(activeUnionName)] ||
      activeUnionName
    : userUnionAcronym;

  const isScopedToSingleUnionSnapshot =
    !isViewingDivisionContext &&
    Boolean(selectedUnionScope && selectedUnionScope !== 'all') &&
    (!isProposalMaker || contextMode === 'union_context');

  const isLiaisonAllAssigned =
    isLiaison && !isViewingDivisionContext && selectedUnionScope === 'all' && liaisonUnions.length > 1;

  const isWholeDivisionScope =
    isViewingDivisionContext ||
    (isSuperAdmin && (!selectedUnionScope || selectedUnionScope === 'all'));

  // Live personal/scoped counts
  const liveStats = useMemo(() => {
    const scopeCanon = hasSingleSelectedUnion ? getCanonicalUnion(selectedUnionScope) : '';
    const filteredLive = scopeCanon
      ? liveProposals.filter((p) => p.union && getCanonicalUnion(p.union) === scopeCanon)
      : liveProposals;

    const approved = filteredLive.filter((p) => p.status === 'approved');
    const pipeline = filteredLive.filter(
      (p) => p.status === 'submitted' || p.status === 'under_review'
    );
    const drafts = filteredLive.filter((p) => !p.status || p.status === 'draft');

    const approvedBudget = approved.reduce((sum, p) => sum + getProposalDivisionBudget(p), 0);
    const pipelineBudget = pipeline.reduce((sum, p) => sum + getProposalDivisionBudget(p), 0);

    return {
      totalCount: filteredLive.length,
      approved,
      pipeline,
      drafts,
      approvedBudget,
      pipelineBudget,
    };
  }, [liveProposals, hasSingleSelectedUnion, selectedUnionScope]);

  // Union / Assigned Territory pool & approved committed stats (always strictly Approved)
  const localPoolStats = useMemo(() => {
    let targetUnions: string[] = [];
    if (isScopedToSingleUnionSnapshot && selectedUnionScope !== 'all') {
      targetUnions = [selectedUnionScope];
    } else if (isLiaison && !isViewingDivisionContext) {
      targetUnions =
        selectedUnionScope !== 'all' ? [selectedUnionScope] : liaisonUnions;
    } else if (!isSuperAdmin && !isViewingDivisionContext && hasValidUserUnion) {
      targetUnions = [userUnion];
    }

    const targetCanonicals = new Set(targetUnions.map(getCanonicalUnion));

    const allocated = UNIONS.reduce((sum, u) => {
      return targetCanonicals.has(getCanonicalUnion(u)) ? sum + (Number(allocations[u]) || 0) : sum;
    }, 0);

    const matching = UNIONS.reduce((sum, u) => {
      return targetCanonicals.has(getCanonicalUnion(u))
        ? sum + (Number(matchingPledges[u]) || 0)
        : sum;
    }, 0);

    const pool = allocated + matching;

    const approvedSource =
      isProposalMaker || (isSuperAdmin && targetCanonicals.size > 0)
        ? divisionApprovedProposals.filter(
            (p) => p.status === 'approved' && p.union && targetCanonicals.has(getCanonicalUnion(p.union))
          )
        : liveStats.approved;

    const committedBudget = approvedSource.reduce(
      (sum, p) => sum + getProposalDivisionBudget(p),
      0
    );
    const remaining = pool - committedBudget;
    const utilizationPct = pool > 0 ? Math.round((committedBudget / pool) * 100) : 0;

    return {
      targetCount: targetCanonicals.size,
      pool,
      committedBudget,
      approvedCount: approvedSource.length,
      remaining,
      utilizationPct,
      approvedProposals: approvedSource,
    };
  }, [
    isScopedToSingleUnionSnapshot,
    selectedUnionScope,
    isLiaison,
    isViewingDivisionContext,
    liaisonUnions,
    hasValidUserUnion,
    userUnion,
    allocations,
    matchingPledges,
    isProposalMaker,
    isSuperAdmin,
    divisionApprovedProposals,
    liveStats.approved,
  ]);

  // SSD Division-wide Approved stats & Gap / Cap signals (always benchmarked across all SSD)
  const divisionContext = useMemo(() => {
    const divPool = UNIONS.reduce(
      (sum, u) => sum + (Number(allocations[u]) || 0) + (Number(matchingPledges[u]) || 0),
      0
    );
    const divApproved = divisionApprovedProposals.filter((p) => p.status === 'approved');
    const mix = analyzePortfolioMix(divApproved, divPool, kpiCaps);

    return {
      divPool,
      divApprovedCount: divApproved.length,
      divBudget: mix.committedBudget,
      divUtilizationPct: divPool > 0 ? Math.round((mix.committedBudget / divPool) * 100) : 0,
      ...mix,
    };
  }, [divisionApprovedProposals, allocations, matchingPledges, kpiCaps]);

  // Active-scope mix (when viewing a single Union or Assigned Territories, compute Pillar/Objective/Audience mix for THAT scope!)
  const activeScopeContext = useMemo(() => {
    if (isWholeDivisionScope || localPoolStats.targetCount === 0) {
      return {
        isUnionScoped: false,
        pool: divisionContext.divPool,
        approvedCount: divisionContext.divApprovedCount,
        committedBudget: divisionContext.divBudget,
        utilizationPct: divisionContext.divUtilizationPct,
        pillarStats: divisionContext.pillarStats,
        kpiStats: divisionContext.kpiStats,
        zeroOrLowKpis: divisionContext.zeroOrLowKpis,
        overCapKpis: divisionContext.overCapKpis,
        zeroAudiences: divisionContext.zeroAudiences,
      };
    }

    const mix = analyzePortfolioMix(
      localPoolStats.approvedProposals,
      localPoolStats.pool,
      kpiCaps
    );
    return {
      isUnionScoped: true,
      pool: localPoolStats.pool,
      approvedCount: localPoolStats.approvedCount,
      utilizationPct: localPoolStats.utilizationPct,
      ...mix,
    };
  }, [isWholeDivisionScope, localPoolStats, divisionContext, kpiCaps]);

  const syncedDateLabel = useMemo(() => {
    if (!snapshotUpdatedAt) return null;
    try {
      return new Date(snapshotUpdatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  }, [snapshotUpdatedAt]);

  const scopeShareOfDivisionPct =
    divisionContext.divBudget > 0
      ? Math.round(
          (((isProposalMaker && contextMode === 'live'
            ? liveStats.approvedBudget
            : localPoolStats.committedBudget) /
            divisionContext.divBudget) *
            1000)
        ) / 10
      : 0;

  // Dynamic plain-language guidance line for Pillar Mix card
  const overCeilingPillars = activeScopeContext.pillarStats.filter((p) => p.isOver);
  const nearCeilingPillars = activeScopeContext.pillarStats.filter((p) => p.isNear);
  const underUsedPillars = activeScopeContext.pillarStats.filter(
    (p) => !p.isOver && p.ratioPct < p.capPct * 0.5
  );

  // Heading & Subtitle tailored accurately to what the user is actually looking at
  const scopeTitlePrefix = isScopedToSingleUnionSnapshot
    ? activeUnionAcronym
    : isLiaisonAllAssigned
    ? `Assigned Territories (${liaisonUnions.length})`
    : isWholeDivisionScope
    ? 'SSD Division'
    : activeUnionAcronym;

  const cardHeading =
    isProposalMaker && contextMode === 'live'
      ? 'My Contribution & Strategic Snapshot'
      : isScopedToSingleUnionSnapshot
      ? `${activeUnionAcronym} Strategic Snapshot (Approved)`
      : isLiaisonAllAssigned
      ? `Assigned Territories Strategic Snapshot (${liaisonUnions.length} Unions)`
      : 'SSD Division Strategic Snapshot (Approved)';

  const cardSubtitle =
    isProposalMaker && contextMode === 'live'
      ? `Compare your proposals against ${activeUnionAcronym}’s approved pool and strategic priorities before submitting.`
      : isScopedToSingleUnionSnapshot
      ? `Snapshot of ${activeUnionAcronym}’s approved pool, strategic pillar mix, and missing objectives or audiences — compared against SSD Division ceilings to guide reviews.`
      : isLiaisonAllAssigned
      ? 'Combined snapshot across your assigned Unions showing pool headroom, pillar balance, and unaddressed goals. Use the Union dropdown above to inspect one Union at a time.'
      : 'Division-wide snapshot of approved budget saturation, strategic pillar ceilings, and under-represented objectives or audiences.';

  // Build explicit over-cap summary string for Card 3 (never leave "2 Obj over cap" mysterious)
  const localOverCap = activeScopeContext.overCapKpis;
  const divisionOverCap = divisionContext.overCapKpis;
  const displayOverCap = localOverCap.length > 0 ? localOverCap : divisionOverCap;
  const overCapSourceLabel =
    activeScopeContext.isUnionScoped && localOverCap.length > 0
      ? `${scopeTitlePrefix} over ceiling`
      : 'SSD-wide over ceiling';

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 space-y-4">
      {/* Top Row: Context Title + Scope Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#1c398e] flex items-center justify-center shrink-0">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight">{cardHeading}</h2>
            {!isSuperAdmin && syncedDateLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>SSD benchmark synced {syncedDateLabel}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{cardSubtitle}</p>
        </div>

        {/* Scope Mode Switcher (Non-Super Admin roles) */}
        {!isSuperAdmin && (
          <div
            className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-semibold self-start lg:self-center shrink-0 flex-wrap gap-0.5"
            role="tablist"
            aria-label="Dashboard context view switcher"
          >
            <button
              type="button"
              role="tab"
              aria-selected={contextMode === 'live'}
              onClick={() => onContextModeChange('live')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                contextMode === 'live'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isProposalMaker
                ? `My Proposals (${liveProposals.length})`
                : isScopedToSingleUnionSnapshot
                ? `${activeUnionAcronym} (Live)`
                : isLiaison
                ? `Assigned Unions (Live)`
                : `${userUnionAcronym} (Live)`}
            </button>

            {isProposalMaker && hasValidUserUnion && (
              <button
                type="button"
                role="tab"
                aria-selected={contextMode === 'union_context'}
                onClick={() => onContextModeChange('union_context')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  contextMode === 'union_context'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {userUnionAcronym} (Approved)
              </button>
            )}

            <button
              type="button"
              role="tab"
              aria-selected={contextMode === 'division_context'}
              onClick={() => onContextModeChange('division_context')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                contextMode === 'division_context'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SSD Division (Approved)
            </button>
          </div>
        )}
      </div>

      {/* 3-Column Context Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Card 1: Scoped Pool, Commitments & Incoming Review Queue */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              {isProposalMaker && contextMode === 'live' ? (
                <UserCheck className="w-3.5 h-3.5 text-[#1c398e]" />
              ) : isWholeDivisionScope ? (
                <Globe className="w-3.5 h-3.5 text-[#1c398e]" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-[#1c398e]" />
              )}
              <span>
                {isProposalMaker && contextMode === 'live'
                  ? 'My Proposals'
                  : `${scopeTitlePrefix} Pool Health`}
              </span>
            </span>
            <span
              className={`text-[11px] font-bold tabular-nums ${
                activeScopeContext.utilizationPct > 100
                  ? 'text-rose-700'
                  : 'text-emerald-700'
              }`}
            >
              {isProposalMaker && contextMode === 'live'
                ? `${liveStats.approved.length} approved`
                : `${activeScopeContext.utilizationPct}% utilized`}
            </span>
          </div>

          {isProposalMaker && contextMode === 'live' ? (
            <div className="space-y-2">
              <div className="text-xl font-black text-slate-900 tabular-nums">
                US${formatCurrency(liveStats.approvedBudget)}
              </div>
              <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap tabular-nums">
                <span>
                  <strong className="text-amber-700">{liveStats.pipeline.length}</strong> in review
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  <strong className="text-slate-700">{liveStats.drafts.length}</strong> drafts
                </span>
                {liveProposals.length > 0 && onSelectProposal && (
                  <>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => onSelectProposal(liveProposals[0].id)}
                      className="inline-flex items-center gap-0.5 font-bold text-[#1c398e] hover:underline cursor-pointer"
                    >
                      <span>Open latest</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
              {hasValidUserUnion && (
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/70 tabular-nums">
                  {userUnionAcronym} pool: US${formatCurrency(localPoolStats.pool)} ·{' '}
                  <strong className={localPoolStats.remaining < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                    {localPoolStats.remaining < 0
                      ? `-US$${formatCurrency(Math.abs(localPoolStats.remaining))} deficit`
                      : `US$${formatCurrency(localPoolStats.remaining)} remaining`}
                  </strong>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <div className="text-xl font-black text-slate-900 tabular-nums">
                  US${formatCurrency(activeScopeContext.committedBudget)}
                </div>
                <div className="text-[11.5px] text-slate-600 tabular-nums mt-0.5">
                  <strong>{activeScopeContext.approvedCount}</strong> approved across{' '}
                  <strong>US${formatCurrency(activeScopeContext.pool)}</strong> pool
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/70 space-y-1 text-[11px] text-slate-600 tabular-nums">
                <div className="flex items-center justify-between gap-2">
                  <span>Available Headroom</span>
                  <strong
                    className={
                      activeScopeContext.pool - activeScopeContext.committedBudget < 0
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }
                  >
                    {activeScopeContext.pool - activeScopeContext.committedBudget < 0
                      ? `-US$${formatCurrency(
                          Math.abs(activeScopeContext.pool - activeScopeContext.committedBudget)
                        )} over`
                      : `US$${formatCurrency(
                          activeScopeContext.pool - activeScopeContext.committedBudget
                        )} left`}
                  </strong>
                </div>

                {!isWholeDivisionScope && (
                  <div className="flex items-center justify-between gap-2">
                    <span>In Review Queue (Pending)</span>
                    <span className="font-semibold text-amber-800">
                      {liveStats.pipeline.length} proposals (US$
                      {formatCurrency(liveStats.pipelineBudget)})
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 text-slate-500">
                  <span>{isWholeDivisionScope ? 'SSD Division Benchmark' : 'Share of SSD Approved'}</span>
                  <span className="font-semibold text-slate-700">
                    {isWholeDivisionScope
                      ? `${divisionContext.divApprovedCount} across all Unions`
                      : `${scopeShareOfDivisionPct}% of US$${formatCurrency(divisionContext.divBudget)}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Strategic Pillar Mix vs SSD Target Ceilings (No Truncation + Clear Guidance) */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-700" />
              <span>{scopeTitlePrefix} Pillar Mix vs Ceiling</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
              {overCeilingPillars.length > 0 ? (
                <span className="text-rose-700 font-bold">
                  {overCeilingPillars.length} above ceiling
                </span>
              ) : (
                <span className="text-emerald-700 font-bold">Within ceilings</span>
              )}
            </span>
          </div>

          <div className="space-y-2">
            {activeScopeContext.pillarStats.map((row) => {
              const divRow = divisionContext.pillarStats.find(
                (d) => d.pillar.id === row.pillar.id
              );
              const barPct = Math.min(100, Math.max(row.ratioPct, row.budget > 0 ? 3 : 0));
              return (
                <div key={row.pillar.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                    <span className="font-semibold text-slate-800">{row.shortLabel}</span>
                    <span className="shrink-0">
                      <strong
                        className={
                          row.isOver
                            ? 'text-rose-700'
                            : row.isNear
                            ? 'text-amber-700'
                            : 'text-slate-900'
                        }
                      >
                        {row.ratioPct}%
                      </strong>{' '}
                      <span className="text-slate-500">/ {row.capPct}% max</span>
                      {activeScopeContext.isUnionScoped && divRow && (
                        <span className="text-slate-400"> · SSD {divRow.ratioPct}%</span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        row.isOver
                          ? 'bg-rose-500'
                          : row.isNear
                          ? 'bg-amber-500'
                          : 'bg-[#1c398e]'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-600 leading-snug pt-1 border-t border-slate-200/70">
            {activeScopeContext.approvedCount === 0 ? (
              <span>No approved projects in {scopeTitlePrefix} yet to compare against Pillar caps.</span>
            ) : overCeilingPillars.length > 0 ? (
              <span>
                <strong className="text-rose-700">
                  {overCeilingPillars.map((p) => p.shortLabel).join(', ')}
                </strong>{' '}
                {overCeilingPillars.length === 1 ? 'exceeds' : 'exceed'} the SSD target ceiling
                {underUsedPillars.length > 0
                  ? ` — balance new approvals toward ${underUsedPillars[0].shortLabel}.`
                  : '.'}
              </span>
            ) : nearCeilingPillars.length > 0 ? (
              <span>
                <strong className="text-amber-700">{nearCeilingPillars[0].shortLabel}</strong> is
                approaching its {nearCeilingPillars[0].capPct}% ceiling; leave room for under-funded
                Pillars.
              </span>
            ) : (
              <span className="text-emerald-800 font-medium">
                Balanced distribution — every Pillar in {scopeTitlePrefix} is within its SSD target
                ceiling.
              </span>
            )}
          </p>
        </div>

        {/* Card 3: Explicit Gaps, Over-Cap Objectives & Audience Reach */}
        <div className="p-4 rounded-2xl bg-amber-50/45 border border-amber-200/85 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-amber-700" />
              <span>{scopeTitlePrefix} Strategic Gaps &amp; Focus</span>
            </span>
            {displayOverCap.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700 shrink-0 tabular-nums">
                <AlertTriangle className="w-3 h-3" />
                <span>{displayOverCap.length} Obj over cap</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                <span>All Obj in cap</span>
              </span>
            )}
          </div>

          <div className="space-y-2 text-[11px] text-slate-700 leading-snug">
            {/* Explicitly named low / zero adoption Objectives */}
            <div>
              <span className="font-bold text-slate-900 block">
                Lowest-Adoption Objectives ({scopeTitlePrefix}):
              </span>
              <ul className="mt-0.5 space-y-0.5 text-slate-700 tabular-nums">
                {activeScopeContext.zeroOrLowKpis.map((item) => (
                  <li key={item.kpi.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.shortLabel}</span>
                    <span
                      className={`font-bold shrink-0 ${
                        item.count === 0 ? 'text-amber-800' : 'text-slate-600'
                      }`}
                    >
                      {item.count === 0 ? '0 approved' : `${item.count} approved (${item.ratioPct}%)`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Explicitly named Over-Cap Objectives (replaces mysterious "2 Obj over cap") */}
            {displayOverCap.length > 0 && (
              <div className="pt-1.5 border-t border-amber-200/70">
                <span className="font-bold text-rose-800 block">
                  {overCapSourceLabel} (Check Saturation):
                </span>
                <div className="mt-0.5 space-y-0.5 text-rose-900 tabular-nums">
                  {displayOverCap.slice(0, 2).map((item) => (
                    <div key={item.kpi.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{item.shortLabel}</span>
                      <span className="font-bold shrink-0">
                        {item.ratioPct}% / {item.capPct}% max
                      </span>
                    </div>
                  ))}
                  {displayOverCap.length > 2 && (
                    <div className="text-[10.5px] text-rose-700">
                      +{displayOverCap.length - 2} more Objective(s) above cap
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Audience Gaps strictly for active scope */}
            <div className="pt-1.5 border-t border-amber-200/70">
              {activeScopeContext.zeroAudiences.length > 0 ? (
                <div className="text-slate-700">
                  <strong className="text-slate-900">
                    Unreached Audiences in {scopeTitlePrefix} ({activeScopeContext.zeroAudiences.length}):
                  </strong>{' '}
                  <span>{activeScopeContext.zeroAudiences.join(', ')}</span>
                </div>
              ) : (
                <div className="text-emerald-800 font-medium">
                  All 8 A–E audience groups have approved projects in {scopeTitlePrefix}.
                </div>
              )}
            </div>
          </div>

          <div className="pt-1.5 border-t border-amber-200/70 flex items-start gap-1.5 text-[10.5px] text-slate-600 leading-snug">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Liaison Review Tip:</strong> Give priority to proposals filling{' '}
              <em>0-approved Objectives</em> or <em>unreached A–E audiences</em> before adding to
              over-ceiling categories.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
