import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  HelpCircle,
  ArrowRight,
  Shield,
} from 'lucide-react';
import {
  Proposal,
  UserAccount,
  UNION_CATEGORIES,
  getCanonicalUnion,
  getUserAllUnions,
} from '../types';
import {
  fetchBudgetAllocationDetails,
  fetchStrategicKpiCaps,
  fetchLeadershipOfficers,
  DEFAULT_KPI_CAPS,
} from '../services/proposalService';
import {
  computeUnionAnalytics,
  computeTerritoryTotals,
  getEntityBudgetConfig,
  UnionAnalyticsItem,
} from '../utils/monitorAnalytics';
import { MonitorKpiSummary } from './monitor/MonitorKpiSummary';
import { MonitorStrategicPillars } from './monitor/MonitorStrategicPillars';
import { MonitorImpactMetrics } from './monitor/MonitorImpactMetrics';
import { AudienceInvestmentCard } from './monitor/AudienceInvestmentCard';
import { MonitorToolbar, MonitorStatusFilter } from './monitor/MonitorToolbar';
import { MonitorUnionCard } from './monitor/MonitorUnionCard';
import { ShareQuickviewModal } from './monitor/ShareQuickviewModal';
import {
  fetchPublicMonitorSnapshot,
  syncPublicMonitorSnapshot,
  clearPublicMonitorCache,
  PublicMonitorSnapshot,
  buildPublicProjectSummaries,
  PublicProjectSummary,
} from '../services/publicMonitorService';
import { aggregateKpiMetrics } from '../utils/kpiExtraction';
import { calculateAudienceInvestment } from '../utils/audienceInvestment';
import { hasMeaningfulProposalData } from '../utils/validation';
import { getUnionIntelligence } from '../data/unionIntelligence';

interface MonitorDashboardProps {
  proposals: Proposal[];
  currentUser: UserAccount;
  onNavigateToReviewHub: (unionFilter?: string) => void;
  onNavigateToDashboard?: () => void;
  onOpenAdminSettings?: () => void;
  onSelectProposal?: (proposalId: string) => void;
  isStakeholderView?: boolean;
  stakeholderKey?: string | null;
  onOpenAuth?: () => void;
  isSimulatedRole?: boolean;
  externalRefreshTrigger?: number;
  onRefreshCatalog?: (forceServer?: boolean) => Promise<void>;
  onSnapshotUpdated?: (snapshot: PublicMonitorSnapshot) => void;
}

export function MonitorDashboard({
  proposals,
  currentUser,
  onNavigateToReviewHub,
  onNavigateToDashboard,
  onOpenAdminSettings,
  onSelectProposal,
  isStakeholderView = false,
  stakeholderKey = null,
  onOpenAuth,
  isSimulatedRole = false,
  externalRefreshTrigger = 0,
  onRefreshCatalog,
  onSnapshotUpdated,
}: MonitorDashboardProps) {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const allowedUnions = useMemo(
    () => getUserAllUnions(currentUser),
    [currentUser]
  );

  const [showShareModal, setShowShareModal] = useState(false);
  const [publicSnapshot, setPublicSnapshot] = useState<PublicMonitorSnapshot | null>(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(isStakeholderView);
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);

  // Allocations and matching pledges state
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [matchingPledges, setMatchingPledges] = useState<Record<string, number>>({});
  const [capsData, setCapsData] = useState(DEFAULT_KPI_CAPS);
  const [users, setUsers] = useState<UserAccount[]>([]);

  // 1-Click force cloud refresh (bypasses local cache and fetches fresh data from server)
  const handleForceRefresh = useCallback(async () => {
    setIsForceRefreshing(true);
    try {
      if (isStakeholderView) {
        clearPublicMonitorCache();
        const [allocRes, capsRes, freshSnapshot] = await Promise.all([
          fetchBudgetAllocationDetails(true),
          fetchStrategicKpiCaps(true),
          fetchPublicMonitorSnapshot(true, stakeholderKey || ''),
        ]);
        if (allocRes) {
          setAllocations(allocRes.allocations || {});
          setMatchingPledges(allocRes.matchingPledges || {});
        }
        if (capsRes) setCapsData(capsRes);
        if (freshSnapshot) {
          setPublicSnapshot(freshSnapshot);
          if (onSnapshotUpdated) onSnapshotUpdated(freshSnapshot);
        }
      } else {
        const [allocRes, capsRes, usersRes] = await Promise.all([
          fetchBudgetAllocationDetails(true),
          fetchStrategicKpiCaps(true),
          fetchLeadershipOfficers(true),
        ]);
        if (allocRes) {
          setAllocations(allocRes.allocations || {});
          setMatchingPledges(allocRes.matchingPledges || {});
        }
        if (capsRes) setCapsData(capsRes);
        if (usersRes && Array.isArray(usersRes)) setUsers(usersRes);

        if (onRefreshCatalog) {
          await onRefreshCatalog(true);
        }
      }
    } catch (err) {
      console.warn('Notice force refreshing monitor data:', err);
    } finally {
      setIsForceRefreshing(false);
    }
  }, [isStakeholderView, stakeholderKey, onRefreshCatalog, onSnapshotUpdated]);

  // Respond to top StakeholderHeader "Sync Latest" button clicks
  useEffect(() => {
    if (externalRefreshTrigger > 0) {
      handleForceRefresh();
    }
  }, [externalRefreshTrigger, handleForceRefresh]);

  // Dynamic Pillar Benchmark Target Percentages
  const pillarPercentages = useMemo<[number, number, number]>(() => {
    return [
      Number(capsData?.pillarCaps?.pillar_1) || 12.5,
      Number(capsData?.pillarCaps?.pillar_2) || 58.5,
      Number(capsData?.pillarCaps?.pillar_3) || 29.0,
    ];
  }, [capsData]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<MonitorStatusFilter>('all');

  // Load backend allocation, cap, and snapshot data (skip protected fetchAllUsers in unauthenticated Stakeholder View)
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [allocRes, capsRes, usersRes, snapshotRes] = await Promise.all([
          fetchBudgetAllocationDetails(),
          fetchStrategicKpiCaps(),
          isStakeholderView ? Promise.resolve([]) : fetchLeadershipOfficers(),
          isStakeholderView ? fetchPublicMonitorSnapshot(false, stakeholderKey || '') : Promise.resolve(null),
        ]);
        if (isMounted) {
          if (allocRes) {
            setAllocations(allocRes.allocations || {});
            setMatchingPledges(allocRes.matchingPledges || {});
          }
          if (capsRes) {
            setCapsData(capsRes);
          }
          if (usersRes && Array.isArray(usersRes)) {
            setUsers(usersRes);
          }
          if (snapshotRes) {
            setPublicSnapshot(snapshotRes);
            if (onSnapshotUpdated) onSnapshotUpdated(snapshotRes);
          }
        }
      } catch (err) {
        console.warn('Notice loading data for monitor dashboard:', err);
      } finally {
        if (isMounted) {
          setIsSnapshotLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [isStakeholderView, stakeholderKey]);

  // Full 14-Territory Division Categories (used for Stakeholder View & Super Admin)
  const allDivisionCategories = useMemo(() => {
    return UNION_CATEGORIES.map((cat) => ({
      ...cat,
      unions: cat.unions.filter(
        (u) =>
          !u.toLowerCase().includes('division') &&
          !u.toLowerCase().includes('headquarters') &&
          !u.toLowerCase().includes('other')
      ),
    })).filter((cat) => cat.unions.length > 0);
  }, []);

  // Filter unions according to user's territorial authority
  const visibleUnionCategories = useMemo(() => {
    if (isSuperAdmin || isStakeholderView) {
      return allDivisionCategories;
    }
    return allDivisionCategories
      .map((cat) => ({
        ...cat,
        unions: cat.unions.filter((u) => {
          const canon = getCanonicalUnion(u);
          return allowedUnions.some((au) => getCanonicalUnion(au) === canon);
        }),
      }))
      .filter((cat) => cat.unions.length > 0);
  }, [isSuperAdmin, isStakeholderView, allDivisionCategories, allowedUnions]);

  // Aggregate metrics per Union from current proposals
  const computedAnalytics = useMemo(() => {
    return computeUnionAnalytics(
      visibleUnionCategories,
      allocations,
      matchingPledges,
      proposals,
      users
    );
  }, [visibleUnionCategories, allocations, matchingPledges, proposals, users]);

  // In Stakeholder View: merge publicSnapshot territories with live allocations/matchingPledges from /settings/budget_allocations
  // And if a snapshot was previously corrupted with < 12 territories, reconstruct the missing territories so all 14 are always shown!
  const unionAnalytics = useMemo(() => {
    if (isStakeholderView && publicSnapshot?.territories && publicSnapshot.territories.length > 0) {
      const snapshotMap = new Map<string, UnionAnalyticsItem>();
      for (const t of publicSnapshot.territories) {
        snapshotMap.set(getCanonicalUnion(t.union), t);
      }

      const hasLiveAllocations =
        Object.keys(allocations).length > 0 || Object.keys(matchingPledges).length > 0;

      const mergedList: UnionAnalyticsItem[] = [];
      for (const cat of allDivisionCategories) {
        for (const unionName of cat.unions) {
          const canon = getCanonicalUnion(unionName);
          const snapItem = snapshotMap.get(canon);
          const liveBudget = getEntityBudgetConfig(unionName, allocations, matchingPledges);

          if (snapItem) {
            const divisionAlloc = hasLiveAllocations ? liveBudget.divisionAlloc : snapItem.divisionAlloc;
            const matchingPledge = hasLiveAllocations ? liveBudget.matchingPledge : snapItem.matchingPledge;
            const effectiveCap =
              divisionAlloc + matchingPledge > 0 ? divisionAlloc + matchingPledge : snapItem.totalCap;
            const totalCommittedAndPending = snapItem.approvedBudget + snapItem.pendingBudget;
            const remainingBudget = effectiveCap > 0 ? effectiveCap - snapItem.approvedBudget : 0;
            const projectedRemaining = effectiveCap > 0 ? effectiveCap - totalCommittedAndPending : 0;
            const utilizationPct = effectiveCap > 0 ? (snapItem.approvedBudget / effectiveCap) * 100 : 0;
            const isOverAllocated = effectiveCap > 0 && totalCommittedAndPending > effectiveCap;
            const overAllocationAmount = isOverAllocated ? totalCommittedAndPending - effectiveCap : 0;
            const isApprovedExceeded = effectiveCap > 0 && snapItem.approvedBudget > effectiveCap;

            mergedList.push({
              ...snapItem,
              union: unionName,
              category: cat.category,
              divisionAlloc,
              matchingPledge,
              totalCap: effectiveCap,
              remainingBudget,
              projectedRemaining,
              utilizationPct,
              isOverAllocated,
              overAllocationAmount,
              isApprovedExceeded,
            });
          } else {
            // Reconstruct any territory that was missing from a partial snapshot
            const fallbackItem = computedAnalytics.find((c) => getCanonicalUnion(c.union) === canon);
            if (fallbackItem) {
              mergedList.push(fallbackItem);
            }
          }
        }
      }
      return mergedList;
    }
    return computedAnalytics;
  }, [isStakeholderView, publicSnapshot, allocations, matchingPledges, allDivisionCategories, computedAnalytics]);

  // Global / Territory-wide Totals (always computed from the active unionAnalytics so caps & totals are 100% consistent)
  const territoryTotals = useMemo(() => {
    return computeTerritoryTotals(unionAnalytics, unionAnalytics.length);
  }, [unionAnalytics]);

  // Pre-calculate division impact metrics and audience investment
  const computedImpactMetrics = useMemo(() => {
    if (isStakeholderView && publicSnapshot?.impactMetrics) {
      return publicSnapshot.impactMetrics;
    }
    if (!isStakeholderView && proposals && proposals.length > 0) {
      return aggregateKpiMetrics(proposals);
    }
    return publicSnapshot?.impactMetrics;
  }, [isStakeholderView, proposals, publicSnapshot]);

  const computedAudienceInvestment = useMemo(() => {
    if (isStakeholderView && publicSnapshot?.audienceInvestment) {
      return publicSnapshot.audienceInvestment;
    }
    if (!isStakeholderView && proposals && proposals.length > 0) {
      return calculateAudienceInvestment(proposals);
    }
    return publicSnapshot?.audienceInvestment;
  }, [isStakeholderView, proposals, publicSnapshot]);

  // Sanitized Project Summaries for Territory Cards
  const projectSummaries = useMemo<PublicProjectSummary[]>(() => {
    if (isStakeholderView && publicSnapshot?.projectSummaries && publicSnapshot.projectSummaries.length > 0) {
      return publicSnapshot.projectSummaries;
    }
    return buildPublicProjectSummaries(proposals);
  }, [isStakeholderView, publicSnapshot, proposals]);

  const projectsByUnion = useMemo(() => {
    const map = new Map<string, PublicProjectSummary[]>();
    for (const proj of projectSummaries) {
      const canon = getCanonicalUnion(proj.union);
      const list = map.get(canon) || [];
      list.push(proj);
      map.set(canon, list);
    }
    return map;
  }, [projectSummaries]);

  // Automatically keep public snapshot updated ONLY when an authentic Super Admin with full division catalog views the monitor
  useEffect(() => {
    const hasLoadedRealCatalog =
      proposals.length > 1 || (proposals.length === 1 && hasMeaningfulProposalData(proposals[0]));

    if (
      !isStakeholderView &&
      isSuperAdmin &&
      !isSimulatedRole &&
      hasLoadedRealCatalog &&
      computedAnalytics.length >= 12
    ) {
      syncPublicMonitorSnapshot(
        computedAnalytics,
        territoryTotals,
        computedImpactMetrics,
        computedAudienceInvestment,
        false,
        projectSummaries
      ).catch(() => {});
    }
  }, [
    isStakeholderView,
    isSuperAdmin,
    isSimulatedRole,
    proposals,
    computedAnalytics,
    territoryTotals,
    computedImpactMetrics,
    computedAudienceInvestment,
    projectSummaries,
  ]);

  // Filtered union list based on search and filters
  const filteredUnions = useMemo(() => {
    return unionAnalytics.filter((item) => {
      const profile = getUnionIntelligence(item.union);

      // 1. Search Query (matches Union, Acronym, Category, Countries, Constituent Fields, or People Groups)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesUnion = item.union.toLowerCase().includes(q);
        const matchesAcronym = item.acronym.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        const matchesCountry =
          profile?.countries.some((c) => c.toLowerCase().includes(q)) || false;
        const matchesField =
          profile?.constituentFields.some((f) => f.toLowerCase().includes(q)) || false;
        const matchesPeopleGroup =
          profile?.keyPeopleGroups.some((pg) => pg.name.toLowerCase().includes(q)) || false;
        const matchesTerritoryDesc =
          profile?.territoryDescription.toLowerCase().includes(q) || false;

        if (
          !matchesUnion &&
          !matchesAcronym &&
          !matchesCategory &&
          !matchesCountry &&
          !matchesField &&
          !matchesPeopleGroup &&
          !matchesTerritoryDesc
        ) {
          return false;
        }
      }

      // 2. Category Filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      // 3. Status & Field Intelligence Filters
      if (statusFilter === 'needs_action' && item.pendingCount === 0) return false;
      if (statusFilter === 'cap_risk' && !item.isOverAllocated && !item.isApprovedExceeded) return false;
      if (
        statusFilter === 'healthy' &&
        (item.isOverAllocated || item.isApprovedExceeded || item.totalCount === 0)
      ) {
        return false;
      }
      if (statusFilter === 'no_submissions' && item.totalCount > 0) return false;
      if (statusFilter === 'frontier_ratio' && (!profile || profile.memberToPopRatio < 1000)) {
        return false;
      }
      if (statusFilter === 'play7_sensitive' && (!profile || !profile.isSensitiveTerritory)) {
        return false;
      }
      if (statusFilter === 'high_offline' && (!profile || !profile.isHighOfflineTerritory)) {
        return false;
      }

      return true;
    });
  }, [unionAnalytics, searchQuery, categoryFilter, statusFilter]);

  // Available categories for filter buttons
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    unionAnalytics.forEach((u) => cats.add(u.category));
    return Array.from(cats);
  }, [unionAnalytics]);

  // Counts for status & field intelligence filters
  const statusCounts = useMemo(() => {
    let needs_action = 0;
    let cap_risk = 0;
    let healthy = 0;
    let no_submissions = 0;
    let frontier_ratio = 0;
    let play7_sensitive = 0;
    let high_offline = 0;

    for (const u of unionAnalytics) {
      const profile = getUnionIntelligence(u.union);
      if (u.pendingCount > 0) needs_action += 1;
      if (u.isOverAllocated || u.isApprovedExceeded) cap_risk += 1;
      if (!u.isOverAllocated && !u.isApprovedExceeded && u.totalCount > 0) healthy += 1;
      if (u.totalCount === 0) no_submissions += 1;
      if (profile && profile.memberToPopRatio >= 1000) frontier_ratio += 1;
      if (profile && profile.isSensitiveTerritory) play7_sensitive += 1;
      if (profile && profile.isHighOfflineTerritory) high_offline += 1;
    }

    return {
      all: unionAnalytics.length,
      needs_action,
      cap_risk,
      healthy,
      no_submissions,
      frontier_ratio,
      play7_sensitive,
      high_offline,
    };
  }, [unionAnalytics]);

  const isFiltered = searchQuery.trim() !== '' || categoryFilter !== 'all' || statusFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  if (isStakeholderView && isSnapshotLoading && !publicSnapshot) {
    return (
      <div className="py-24 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3 animate-in fade-in">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-semibold text-slate-700 text-sm">Loading Executive Monitor Quickview...</p>
        <p className="text-slate-400 text-xs">Synchronizing verified division oversight metrics</p>
      </div>
    );
  }

  if (isStakeholderView && !isSnapshotLoading && !publicSnapshot) {
    return (
      <div className="py-20 max-w-lg mx-auto px-4 text-center animate-in fade-in">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-8 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 mx-auto flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-900">
              Quickview Link Invalid or Revoked
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              This Stakeholder Quickview URL is no longer active or its access key has been
              rotated by Division Administration.
            </p>
          </div>
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 text-xs font-bold bg-[#1c398e] hover:bg-[#152c70] text-white rounded-xl transition-colors cursor-pointer"
            >
              Sign In with Staff Account
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-150">
      {/* 1. Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Executive Monitor
          </h1>
          <span className="text-xs text-slate-400" aria-hidden="true">·</span>
          <span className="text-xs font-medium text-slate-500">
            12 Unions &amp; 2 Attached Fields
          </span>
          <span
            className="text-slate-400 hover:text-slate-600 cursor-help inline-flex items-center"
            title={
              isStakeholderView
                ? 'Read-only division-wide overview tracking budget caps, pipeline progress, and Strategic Pillar distributions across 12 Unions & 2 Attached Fields.'
                : 'Real-time governance overview tracking budget caps, pipeline risks, and Strategic Pillar distributions across 12 Unions & 2 Attached Fields.'
            }
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </span>
        </div>

        {!isStakeholderView && onNavigateToDashboard && (
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1c398e] hover:underline cursor-pointer"
          >
            <span>Impact &amp; Audience Analytics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. Key Global Metrics Overview */}
      <MonitorKpiSummary territoryTotals={territoryTotals} />

      {/* 3. Division-Wide Strategic Pillars Snapshot */}
      <MonitorStrategicPillars
        territoryTotals={territoryTotals}
        pillarPercentages={pillarPercentages}
      />

      {/* 4. Division-Wide Mission Targets & Audience Investment (Rendered here only for external Stakeholder Quickview; staff access these in Dashboard) */}
      {isStakeholderView && (
        <>
          <MonitorImpactMetrics
            proposals={[]}
            precomputedSummary={publicSnapshot?.impactMetrics || computedImpactMetrics}
          />
          <AudienceInvestmentCard
            proposals={[]}
            precomputedAnalysis={publicSnapshot?.audienceInvestment || computedAudienceInvestment}
          />
        </>
      )}

      {/* 5. Filter & Search Controls */}
      <MonitorToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        availableCategories={availableCategories}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusCounts={statusCounts}
        totalFilteredCount={filteredUnions.length}
        totalUnionsCount={unionAnalytics.length}
        onResetFilters={handleResetFilters}
        isFiltered={isFiltered}
        onShareQuickview={() => setShowShareModal(true)}
        isStakeholderView={isStakeholderView}
        onForceRefresh={handleForceRefresh}
        isRefreshing={isForceRefreshing}
      />

      {/* 6. 14 Union Information Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUnions.map((item) => (
          <MonitorUnionCard
            key={item.union}
            item={item}
            pillarPercentages={pillarPercentages}
            onNavigateToReviewHub={onNavigateToReviewHub}
            isStakeholderView={isStakeholderView}
            projects={projectsByUnion.get(getCanonicalUnion(item.union)) || []}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredUnions.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No matching territories found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or clearing the status filter to see all {unionAnalytics.length} territories.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-bold text-[#1c398e] bg-blue-50 hover:bg-blue-100 rounded-xl transition-all cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Stakeholder Share Quickview Modal */}
      <ShareQuickviewModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        territoriesCount={unionAnalytics.length}
        projectsCount={territoryTotals.totalProjectsCount}
        onSyncNow={async (explicitToken) => {
          if (computedAnalytics.length >= 12) {
            return await syncPublicMonitorSnapshot(
              computedAnalytics,
              territoryTotals,
              computedImpactMetrics,
              computedAudienceInvestment,
              true,
              projectSummaries,
              explicitToken
            );
          }
          return false;
        }}
      />
    </div>
  );
}

export default MonitorDashboard;
