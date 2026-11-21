import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  Building2,
  Sliders,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  RefreshCw,
  Save,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Users,
  Info,
  Shield,
  Download,
  X,
  ExternalLink,
  Target,
  Zap,
  ClipboardCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  Proposal,
  UserAccount,
  UNION_CATEGORIES,
  UNIONS,
  UNION_ACRONYMS,
  STRATEGIC_PILLARS_CONFIG,
  ALL_STRATEGIC_KPIS,
  StrategicPillar,
  StrategicKpi,
  StrategicKpiCaps,
  getCanonicalUnion,
  getCanonicalKpiType,
  getUserAllUnions,
} from '../types';
import {
  fetchBudgetAllocationDetails,
  fetchStrategicKpiCaps,
  saveStrategicKpiCaps,
  DEFAULT_KPI_CAPS,
} from '../services/proposalService';
import {
  fetchPublicMonitorSnapshot,
  snapshotToApprovedProposals,
  PublicMonitorSnapshot,
} from '../services/publicMonitorService';
import { StrategicCapsModal } from './admin/StrategicCapsModal';
import { DrilldownModals } from './admin/DrilldownModals';
import { MonitorImpactMetrics } from './monitor/MonitorImpactMetrics';
import { AudienceInvestmentCard } from './monitor/AudienceInvestmentCard';
import { UnionAudienceTagsBox } from './dashboard/UnionAudienceTagsBox';
import {
  StrategicContextCard,
  DashboardContextMode,
} from './dashboard/StrategicContextCard';
import { PortfolioHealthPanel } from './dashboard/PortfolioHealthPanel';
import { TerritoryUpgImpactCard } from './dashboard/TerritoryUpgImpactCard';
import { parseKpiTargetNumber, formatMetricCount } from '../utils/kpiExtraction';
import {
  evaluateProposalReviewFramework,
  PillarSubType,
  PILLAR_SUBTYPE_LABELS,
  REVIEW_FRAMEWORK_PDF_URL,
} from '../utils/projectReviewFramework';
import { formatCurrency } from '../utils/userUtils';
import { matchProposalToStrategicKpi } from '../utils/strategicKpiMatching';
import {
  getUnionIntelligence,
  UNION_INTELLIGENCE_PROFILES,
  SSD_DIVISION_YEARBOOK_TOTALS,
} from '../data/unionIntelligence';
import { UnionIntelligenceBanner } from './proposal/UnionIntelligenceBanner';

interface AdminDashboardProps {
  proposals: Proposal[];
  currentUser: UserAccount;
  selectedUnionFilter?: string;
  onUnionFilterChange?: (union: string) => void;
  onSelectProposal?: (proposalId: string) => void;
  onOpenBudgetAllocations?: () => void;
  onBackToReviewHub?: () => void;
}

const PILLAR_COLORS = [
  '#3b82f6', // Pillar 1 (Blue)
  '#8b5cf6', // Pillar 2 (Purple)
  '#10b981', // Pillar 3 (Emerald)
];

const KPI_PALETTE = [
  '#2563eb', // KPI 1
  '#7c3aed', // KPI 2
  '#9333ea', // KPI 3
  '#c026d3', // KPI 4
  '#db2777', // KPI 5
  '#059669', // KPI 6
  '#10b981', // KPI 7
  '#f59e0b', // Other
];

const DEFAULT_OBJECTIVE_UNITS: Record<string, string> = {
  kpi_1: 'creators',
  kpi_2: 'contacts',
  kpi_3: 'views',
  kpi_4: 'video views',
  kpi_5: 'UPG contacts',
  kpi_6: 'disciples',
  kpi_7: 'public reach',
};

export { matchProposalToStrategicKpi };

export function AdminDashboard({
  proposals,
  currentUser,
  selectedUnionFilter,
  onUnionFilterChange,
  onSelectProposal,
  onOpenBudgetAllocations,
  onBackToReviewHub,
}: AdminDashboardProps) {
  // Budget Allocations, Caps & Public Approved Context Snapshot
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [matchingPledges, setMatchingPledges] = useState<Record<string, number>>({});
  const [kpiCaps, setKpiCaps] = useState<StrategicKpiCaps>(DEFAULT_KPI_CAPS);
  const [publicSnapshot, setPublicSnapshot] = useState<PublicMonitorSnapshot | null>(null);
  const [isCapsEditorOpen, setIsCapsEditorOpen] = useState(false);
  const [tempPillarCaps, setTempPillarCaps] = useState<Record<string, number>>(DEFAULT_KPI_CAPS.pillarCaps);
  const [tempKpiCaps, setTempKpiCaps] = useState<Record<string, number>>(DEFAULT_KPI_CAPS.kpiCaps);
  const [isSavingCaps, setIsSavingCaps] = useState(false);
  const [capsSaveSuccess, setCapsSaveSuccess] = useState(false);

  // Filters & State
  const [matrixViewMode, setMatrixViewMode] = useState<'combined' | 'expanded'>('combined');
  const [kpiChartMode, setKpiChartMode] = useState<'budget_count' | 'effort_vs_funds'>('budget_count');
  const [unionSearch, setUnionSearch] = useState('');
  const [unionFilterCategory, setUnionFilterCategory] = useState<string>('all');
  const [selectedDrilldownUnion, setSelectedDrilldownUnion] = useState<string | null>(null);
  const [selectedDrilldownKpi, setSelectedDrilldownKpi] = useState<StrategicKpi | null>(null);
  const [hoveredPillarIndex, setHoveredPillarIndex] = useState<number | null>(null);

  // Permissions & Union Scope
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isLiaison = currentUser.role === 'division_liaison';
  const isCoordinatorOrTreasurer =
    currentUser.role === 'coordinator' || currentUser.role === 'treasurer';
  const isProposalMaker = !isSuperAdmin && !isLiaison && !isCoordinatorOrTreasurer;
  const liaisonUnions = useMemo(() => getUserAllUnions(currentUser), [currentUser]);
  const userUnion = currentUser.union;
  const hasValidUserUnion = Boolean(
    userUnion && UNIONS.some((u) => getCanonicalUnion(u) === getCanonicalUnion(userUnion))
  );

  // Context Mode: Super Admin always live; Hub roles toggle Live vs SSD Division Approved;
  // Proposal Makers toggle My Proposals vs My Union (Approved) vs SSD Division (Approved).
  const [contextMode, setContextMode] = useState<DashboardContextMode>(() => {
    if (isProposalMaker) {
      return hasValidUserUnion ? 'union_context' : 'division_context';
    }
    return 'live';
  });

  useEffect(() => {
    if (isSuperAdmin) {
      setContextMode('live');
    } else if (isProposalMaker) {
      setContextMode((prev) => {
        if (prev === 'union_context' && !hasValidUserUnion) return 'division_context';
        return prev;
      });
    } else {
      setContextMode((prev) => (prev === 'union_context' ? 'live' : prev));
    }
  }, [isSuperAdmin, isProposalMaker, hasValidUserUnion]);

  // Load allocations, caps & public division approved context on mount
  useEffect(() => {
    loadData(false);
  }, [isSuperAdmin]);

  const loadData = async (forceRefresh: boolean = false) => {
    try {
      const [allocDetails, capsData, snapshotData] = await Promise.all([
        fetchBudgetAllocationDetails(forceRefresh),
        fetchStrategicKpiCaps(forceRefresh),
        isSuperAdmin ? Promise.resolve(null) : fetchPublicMonitorSnapshot(forceRefresh),
      ]);
      setAllocations(allocDetails.allocations || {});
      setMatchingPledges(allocDetails.matchingPledges || {});
      if (capsData) {
        setKpiCaps(capsData);
        setTempPillarCaps(capsData.pillarCaps || DEFAULT_KPI_CAPS.pillarCaps);
        setTempKpiCaps(capsData.kpiCaps || DEFAULT_KPI_CAPS.kpiCaps);
      }
      if (snapshotData) {
        setPublicSnapshot(snapshotData);
      }
    } catch (e) {
      console.warn('Error loading dashboard data:', e);
    }
  };

  // Union Scope: locked to userUnion for coordinators/treasurers; selectable for super_admin & multi-union liaison
  const [selectedUnionScope, setSelectedUnionScope] = useState<string>(() => {
    if (isSuperAdmin) {
      return selectedUnionFilter && (selectedUnionFilter === 'all' || UNIONS.includes(selectedUnionFilter as any))
        ? selectedUnionFilter
        : 'all';
    }
    if (isLiaison) {
      if (
        selectedUnionFilter &&
        (selectedUnionFilter === 'all' ||
          liaisonUnions.map(getCanonicalUnion).includes(getCanonicalUnion(selectedUnionFilter)))
      ) {
        return selectedUnionFilter;
      }
      return liaisonUnions.length === 1 ? liaisonUnions[0] : 'all';
    }
    return userUnion || 'all';
  });

  const handleUnionScopeChange = (newUnion: string) => {
    setSelectedUnionScope(newUnion);
    onUnionFilterChange?.(newUnion);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      if (selectedUnionFilter && (selectedUnionFilter === 'all' || UNIONS.includes(selectedUnionFilter as any))) {
        setSelectedUnionScope(selectedUnionFilter);
      }
    } else if (isLiaison) {
      if (
        selectedUnionFilter &&
        (selectedUnionFilter === 'all' ||
          liaisonUnions.map(getCanonicalUnion).includes(getCanonicalUnion(selectedUnionFilter)))
      ) {
        setSelectedUnionScope(selectedUnionFilter);
      } else if (
        selectedUnionScope !== 'all' &&
        !liaisonUnions.map(getCanonicalUnion).includes(getCanonicalUnion(selectedUnionScope))
      ) {
        setSelectedUnionScope(liaisonUnions.length === 1 ? liaisonUnions[0] : 'all');
      }
    } else if (userUnion) {
      setSelectedUnionScope(userUnion);
    }
  }, [isSuperAdmin, isLiaison, userUnion, liaisonUnions, selectedUnionFilter]);

  const snapshotApprovedProposals = useMemo(
    () => snapshotToApprovedProposals(publicSnapshot),
    [publicSnapshot]
  );

  const divisionApprovedProposals = useMemo(() => {
    if (isSuperAdmin) {
      return proposals.filter((p) => p.status === 'approved');
    }
    return snapshotApprovedProposals;
  }, [isSuperAdmin, proposals, snapshotApprovedProposals]);

  const liveProposalIds = useMemo(() => new Set(proposals.map((p) => p.id)), [proposals]);
  const canOpenProposal = useMemo(
    () => (proposalId: string) => isSuperAdmin || liveProposalIds.has(proposalId),
    [isSuperAdmin, liveProposalIds]
  );

  const isContextSnapshotMode = !isSuperAdmin && contextMode !== 'live';

  const effectiveUnionScope = useMemo(() => {
    if (isContextSnapshotMode) {
      if (contextMode === 'union_context' && hasValidUserUnion) {
        return userUnion;
      }
      return 'all';
    }
    if (isProposalMaker) {
      return 'all';
    }
    return selectedUnionScope;
  }, [
    isContextSnapshotMode,
    contextMode,
    hasValidUserUnion,
    userUnion,
    isProposalMaker,
    selectedUnionScope,
  ]);

  const isScopedToSingleUnion = effectiveUnionScope !== 'all';
  const [showBaseline, setShowBaseline] = useState(false);

  const activeSourceProposals = isContextSnapshotMode ? snapshotApprovedProposals : proposals;

  // Filter proposals according to active union scope
  const scopedProposals = useMemo(() => {
    if (!isScopedToSingleUnion) return activeSourceProposals;
    const targetCanonical = getCanonicalUnion(effectiveUnionScope);
    return activeSourceProposals.filter((p) => {
      if (!p.union) return false;
      return getCanonicalUnion(p.union) === targetCanonical;
    });
  }, [activeSourceProposals, isScopedToSingleUnion, effectiveUnionScope]);

  // 1. Overall Project Stats & Status Classification
  const totalProjectsCount = scopedProposals.length;

  const approvedProposals = useMemo(() => {
    return scopedProposals.filter((p) => p.status === 'approved');
  }, [scopedProposals]);

  const pipelineProposals = useMemo(() => {
    return scopedProposals.filter((p) => p.status === 'submitted' || p.status === 'under_review');
  }, [scopedProposals]);

  const draftProposals = useMemo(() => {
    return scopedProposals.filter((p) => !p.status || p.status === 'draft');
  }, [scopedProposals]);

  const statusCounts = useMemo(() => {
    return {
      draft: draftProposals.length,
      submitted: scopedProposals.filter((p) => p.status === 'submitted').length,
      under_review: scopedProposals.filter((p) => p.status === 'under_review').length,
      approved: approvedProposals.length,
      pipeline: pipelineProposals.length,
    };
  }, [scopedProposals, draftProposals.length, approvedProposals.length, pipelineProposals.length]);

  // Officially committed budget: ONLY Approved proposals
  const totalCommittedBudget = useMemo(() => {
    return approvedProposals.reduce((acc, p) => {
      const pBudget = (p.budgetItems || []).reduce(
        (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      );
      return acc + pBudget;
    }, 0);
  }, [approvedProposals]);

  // Incoming pipeline budget: Submitted & Under Review proposals for treasurers to assess incoming demand
  const totalPipelineBudget = useMemo(() => {
    return pipelineProposals.reduce((acc, p) => {
      const pBudget = (p.budgetItems || []).reduce(
        (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      );
      return acc + pBudget;
    }, 0);
  }, [pipelineProposals]);

  // Projected total budget if all incoming proposals are approved
  const totalProjectedBudget = totalCommittedBudget + totalPipelineBudget;

  // Informational draft budget (strictly excluded from commitments and pipeline)
  const totalDraftsBudget = useMemo(() => {
    return draftProposals.reduce((acc, p) => {
      const pBudget = (p.budgetItems || []).reduce(
        (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      );
      return acc + pBudget;
    }, 0);
  }, [draftProposals]);

  const totalAllocatedCeiling = useMemo(() => {
    if (isScopedToSingleUnion) {
      return Number(allocations[effectiveUnionScope]) || 0;
    }
    if (isProposalMaker && !isContextSnapshotMode && hasValidUserUnion) {
      return Number(allocations[userUnion]) || 0;
    }
    if (isLiaison && !isContextSnapshotMode) {
      const assignedCanonicals = new Set(liaisonUnions.map(getCanonicalUnion));
      return UNIONS.reduce(
        (sum, u) =>
          assignedCanonicals.has(getCanonicalUnion(u)) ? sum + (Number(allocations[u]) || 0) : sum,
        0
      );
    }
    return UNIONS.reduce((sum, u) => sum + (Number(allocations[u]) || 0), 0);
  }, [
    allocations,
    isScopedToSingleUnion,
    effectiveUnionScope,
    isProposalMaker,
    isContextSnapshotMode,
    hasValidUserUnion,
    userUnion,
    isLiaison,
    liaisonUnions,
  ]);

  const totalMatchingPledged = useMemo(() => {
    if (isScopedToSingleUnion) {
      return Number(matchingPledges[effectiveUnionScope]) || 0;
    }
    if (isProposalMaker && !isContextSnapshotMode && hasValidUserUnion) {
      return Number(matchingPledges[userUnion]) || 0;
    }
    if (isLiaison && !isContextSnapshotMode) {
      const assignedCanonicals = new Set(liaisonUnions.map(getCanonicalUnion));
      return UNIONS.reduce(
        (sum, u) =>
          assignedCanonicals.has(getCanonicalUnion(u))
            ? sum + (Number(matchingPledges[u]) || 0)
            : sum,
        0
      );
    }
    return UNIONS.reduce((sum, u) => sum + (Number(matchingPledges[u]) || 0), 0);
  }, [
    matchingPledges,
    isScopedToSingleUnion,
    effectiveUnionScope,
    isProposalMaker,
    isContextSnapshotMode,
    hasValidUserUnion,
    userUnion,
    isLiaison,
    liaisonUnions,
  ]);

  const grandTotalCombinedBudgetPool = totalAllocatedCeiling + totalMatchingPledged;

  // Remaining funds evaluated on officially committed (approved) proposals
  const grandRemainingFunds = grandTotalCombinedBudgetPool - totalCommittedBudget;
  // Projected remaining funds if incoming pipeline is approved
  const projectedRemainingFunds = grandTotalCombinedBudgetPool - totalProjectedBudget;

  const overallUtilizationRatio =
    grandTotalCombinedBudgetPool > 0
      ? Math.round((totalCommittedBudget / grandTotalCombinedBudgetPool) * 100)
      : 0;

  const projectedUtilizationRatio =
    grandTotalCombinedBudgetPool > 0
      ? Math.round((totalProjectedBudget / grandTotalCombinedBudgetPool) * 100)
      : 0;

  const averageProjectBudget =
    approvedProposals.length > 0 ? Math.round(totalCommittedBudget / approvedProposals.length) : 0;

  // Active Unions count (based on approved proposals)
  const activeUnionsCount = useMemo(() => {
    const set = new Set<string>();
    approvedProposals.forEach((p) => {
      if (p.union) set.add(p.union);
    });
    return set.size;
  }, [approvedProposals]);

  // 2. Map proposals to 7 KPIs & 3 Pillars (Segregated by Approved vs. Pipeline vs. Draft)
  const kpiAnalytics = useMemo(() => {
    // Initialize map
    const kpiMap: Record<
      string,
      {
        kpi: StrategicKpi;
        projectCount: number; // approved projects count
        totalBudget: number; // approved budget (primary committed)
        approvedBudget: number;
        approvedCount: number;
        pipelineBudget: number;
        pipelineCount: number;
        draftBudget: number;
        draftCount: number;
        projectedBudget: number;
        proposals: Proposal[];
        approvedProposals: Proposal[];
        pipelineProposals: Proposal[];
        draftProposals: Proposal[];
      }
    > = {};

    ALL_STRATEGIC_KPIS.forEach((k) => {
      kpiMap[k.id] = {
        kpi: k,
        projectCount: 0,
        totalBudget: 0,
        approvedBudget: 0,
        approvedCount: 0,
        pipelineBudget: 0,
        pipelineCount: 0,
        draftBudget: 0,
        draftCount: 0,
        projectedBudget: 0,
        proposals: [],
        approvedProposals: [],
        pipelineProposals: [],
        draftProposals: [],
      };
    });

    let otherApprovedBudget = 0;
    let otherApprovedCount = 0;
    let otherPipelineBudget = 0;
    let otherPipelineCount = 0;
    let otherDraftBudget = 0;
    let otherDraftCount = 0;
    const otherProposals: Proposal[] = [];

    // Bucket each proposal according to status
    scopedProposals.forEach((p) => {
      const pBudget = (p.budgetItems || []).reduce(
        (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      );
      const status = p.status || 'draft';
      const isApproved = status === 'approved';
      const isPipeline = status === 'submitted' || status === 'under_review';

      // Match by divisionProject or strategicFocus
      const matchedKpi = matchProposalToStrategicKpi(p, ALL_STRATEGIC_KPIS);

      if (matchedKpi) {
        const target = kpiMap[matchedKpi.id];
        target.proposals.push(p);
        if (isApproved) {
          target.approvedBudget += pBudget;
          target.approvedCount += 1;
          target.approvedProposals.push(p);
        } else if (isPipeline) {
          target.pipelineBudget += pBudget;
          target.pipelineCount += 1;
          target.pipelineProposals.push(p);
        } else {
          target.draftBudget += pBudget;
          target.draftCount += 1;
          target.draftProposals.push(p);
        }
        // Set primary committed fields to approved only
        target.totalBudget = target.approvedBudget;
        target.projectCount = target.approvedCount;
        target.projectedBudget = target.approvedBudget + target.pipelineBudget;
      } else {
        // Fallback: If divisionProject was omitted/blank and only strategicFocus (Pillar) was given
        let handledByPillar = false;
        if (!p.divisionProject && p.strategicFocus) {
          const matchedPillar = STRATEGIC_PILLARS_CONFIG.find((pil) =>
            pil.title.toLowerCase().includes(p.strategicFocus.toLowerCase())
          );
          if (matchedPillar && matchedPillar.kpis.length > 0) {
            const fallbackKpi = matchedPillar.kpis[0];
            const target = kpiMap[fallbackKpi.id];
            target.proposals.push(p);
            if (isApproved) {
              target.approvedBudget += pBudget;
              target.approvedCount += 1;
              target.approvedProposals.push(p);
            } else if (isPipeline) {
              target.pipelineBudget += pBudget;
              target.pipelineCount += 1;
              target.pipelineProposals.push(p);
            } else {
              target.draftBudget += pBudget;
              target.draftCount += 1;
              target.draftProposals.push(p);
            }
            target.totalBudget = target.approvedBudget;
            target.projectCount = target.approvedCount;
            target.projectedBudget = target.approvedBudget + target.pipelineBudget;
            handledByPillar = true;
          }
        }
        if (!handledByPillar) {
          otherProposals.push(p);
          if (isApproved) {
            otherApprovedBudget += pBudget;
            otherApprovedCount += 1;
          } else if (isPipeline) {
            otherPipelineBudget += pBudget;
            otherPipelineCount += 1;
          } else {
            otherDraftBudget += pBudget;
            otherDraftCount += 1;
          }
        }
      }
    });

    return {
      kpiMap,
      otherBudget: otherApprovedBudget,
      otherCount: otherApprovedCount,
      otherPipelineBudget,
      otherPipelineCount,
      otherDraftBudget,
      otherDraftCount,
      otherProposals,
    };
  }, [scopedProposals]);

  // Pillar Aggregates (Evaluated against the total budget pool ceiling)
  const pillarAnalytics = useMemo(() => {
    // Base budget pool to compare caps against (Grand total combined pool, or fallback to totalAllocatedCeiling, or totalCommittedBudget if neither is set)
    const baseBudgetPool =
      grandTotalCombinedBudgetPool > 0
        ? grandTotalCombinedBudgetPool
        : totalAllocatedCeiling > 0
        ? totalAllocatedCeiling
        : totalCommittedBudget;

    return STRATEGIC_PILLARS_CONFIG.map((pillar, idx) => {
      let pillarApprovedBudget = 0;
      let pillarApprovedCount = 0;
      let pillarPipelineBudget = 0;
      let pillarPipelineCount = 0;
      let pillarDraftCount = 0;
      const pillarProposals: Proposal[] = [];

      pillar.kpis.forEach((k) => {
        const item = kpiAnalytics.kpiMap[k.id];
        if (item) {
          pillarApprovedBudget += item.approvedBudget;
          pillarApprovedCount += item.approvedCount;
          pillarPipelineBudget += item.pipelineBudget;
          pillarPipelineCount += item.pipelineCount;
          pillarDraftCount += item.draftCount;
          pillarProposals.push(...item.proposals);
        }
      });

      const pillarProjectedBudget = pillarApprovedBudget + pillarPipelineBudget;
      const targetCap = kpiCaps.pillarCaps[pillar.id] ?? pillar.defaultCap;
      const dollarCap = baseBudgetPool > 0 ? (baseBudgetPool * targetCap) / 100 : 0;

      // Actual ratio of officially approved funds against base budget pool
      const actualRatio =
        baseBudgetPool > 0 ? (pillarApprovedBudget / baseBudgetPool) * 100 : 0;

      // Projected ratio if incoming pipeline proposals are approved
      const projectedRatio =
        baseBudgetPool > 0 ? (pillarProjectedBudget / baseBudgetPool) * 100 : 0;

      // Cap utilization based on approved funds
      const capUtilizationPct =
        dollarCap > 0
          ? (pillarApprovedBudget / dollarCap) * 100
          : targetCap > 0
          ? (actualRatio / targetCap) * 100
          : 0;

      const isExceeded = actualRatio > targetCap && pillarApprovedBudget > 0;
      const difference = actualRatio - targetCap;

      // Flag if approving incoming pipeline proposals would exceed the cap
      const isProjectedToExceed = projectedRatio > targetCap && pillarPipelineBudget > 0;
      const projectedDifference = projectedRatio - targetCap;

      // Proportional share of committed projects (for donut chart distribution)
      const shareOfCommitted =
        totalCommittedBudget > 0 ? (pillarApprovedBudget / totalCommittedBudget) * 100 : 0;

      return {
        pillar,
        color: PILLAR_COLORS[idx % PILLAR_COLORS.length],
        totalBudget: pillarApprovedBudget, // Officially committed budget
        approvedBudget: pillarApprovedBudget,
        pipelineBudget: pillarPipelineBudget, // Incoming proposals awaiting review
        projectedBudget: pillarProjectedBudget, // Approved + Pipeline
        dollarCap: Math.round(dollarCap),
        projectCount: pillarApprovedCount,
        approvedCount: pillarApprovedCount,
        pipelineCount: pillarPipelineCount,
        draftCount: pillarDraftCount,
        actualRatio: Math.round(actualRatio * 100) / 100,
        projectedRatio: Math.round(projectedRatio * 100) / 100,
        capUtilizationPct: Math.round(capUtilizationPct * 10) / 10,
        shareOfCommitted: Math.round(shareOfCommitted * 10) / 10,
        targetCap: Math.round(targetCap * 100) / 100,
        isExceeded,
        difference: Math.round(difference * 100) / 100,
        isProjectedToExceed,
        projectedDifference: Math.round(projectedDifference * 100) / 100,
        proposals: pillarProposals,
      };
    });
  }, [kpiAnalytics, grandTotalCombinedBudgetPool, totalAllocatedCeiling, totalCommittedBudget, kpiCaps]);

  // KPI Chart Data
  const kpiBarChartData = useMemo(() => {
    const baseBudgetPool =
      grandTotalCombinedBudgetPool > 0
        ? grandTotalCombinedBudgetPool
        : totalAllocatedCeiling > 0
        ? totalAllocatedCeiling
        : totalCommittedBudget;

    return ALL_STRATEGIC_KPIS.map((k, idx) => {
      const data = kpiAnalytics.kpiMap[k.id];
      const actualBudget = data?.approvedBudget || 0;
      const pipelineBudget = data?.pipelineBudget || 0;
      const approvedCount = data?.approvedCount || 0;
      const pipelineCount = data?.pipelineCount || 0;
      const draftCount = data?.draftCount || 0;
      const totalProposals = data ? data.proposals.length : approvedCount + pipelineCount + draftCount;
      const avgCostPerProject = approvedCount > 0 ? Math.round(actualBudget / approvedCount) : 0;
      const actualRatio =
        baseBudgetPool > 0 ? (actualBudget / baseBudgetPool) * 100 : 0;
      const projectedRatio =
        baseBudgetPool > 0 ? ((actualBudget + pipelineBudget) / baseBudgetPool) * 100 : 0;
      const targetCap = kpiCaps.kpiCaps[k.id] ?? k.defaultCap;
      const dollarCap = baseBudgetPool > 0 ? (baseBudgetPool * targetCap) / 100 : 0;

      // Extract impact metrics across proposals for this objective
      const approvedProps = data?.approvedProposals || [];
      const pipelineProps = data?.pipelineProposals || [];
      const allProps = data?.proposals || [];

      const approvedImpact = approvedProps.reduce((sum, p) => {
        const ext = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);
        return sum + (ext.value || 0);
      }, 0);

      const pipelineImpact = pipelineProps.reduce((sum, p) => {
        const ext = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);
        return sum + (ext.value || 0);
      }, 0);

      const totalImpact = allProps.reduce((sum, p) => {
        const ext = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);
        return sum + (ext.value || 0);
      }, 0);

      const quantifiedApprovedCount = approvedProps.filter((p) => {
        const ext = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);
        return ext.value !== null && ext.value > 0;
      }).length;

      // Unit Economics: Cost per person (strictly Approved)
      let costPerPerson: number | null = null;
      let costPerPersonFormatted = '—';
      const isEstimatedCost = false;

      if (approvedImpact > 0 && actualBudget > 0) {
        costPerPerson = actualBudget / approvedImpact;
      }

      if (costPerPerson !== null) {
        let formattedVal = '';
        if (costPerPerson < 0.01) {
          formattedVal = '<$0.01';
        } else if (costPerPerson < 1) {
          formattedVal = `$${costPerPerson.toFixed(2)}`;
        } else if (costPerPerson < 10) {
          formattedVal = `$${costPerPerson.toFixed(2)}`;
        } else if (costPerPerson < 100) {
          formattedVal = `$${costPerPerson.toFixed(1)}`;
        } else {
          formattedVal = `$${Math.round(costPerPerson).toLocaleString()}`;
        }
        costPerPersonFormatted = formattedVal;
      }

      const displayImpact = approvedImpact > 0 ? formatMetricCount(approvedImpact) : '0';
      const shareOfCommitted =
        totalCommittedBudget > 0 ? (actualBudget / totalCommittedBudget) * 100 : 0;
      const totalApprovedAcrossKpis = ALL_STRATEGIC_KPIS.reduce(
        (sum, item) => sum + (kpiAnalytics.kpiMap[item.id]?.approvedCount || 0),
        0
      );
      const shareOfProjects =
        totalApprovedAcrossKpis > 0 ? (approvedCount / totalApprovedAcrossKpis) * 100 : 0;
      const avgCostFormatted =
        approvedCount === 0 || avgCostPerProject <= 0
          ? '—'
          : avgCostPerProject >= 1000
          ? `$${(avgCostPerProject / 1000).toFixed(1).replace(/\.0$/, '')}k/p`
          : `$${avgCostPerProject}/p`;
      const roundedRatio = Math.round(actualRatio * 10) / 10;
      const variancePct = Math.round((roundedRatio - targetCap) * 10) / 10;

      return {
        name: `Obj ${k.number}`,
        number: k.number,
        fullName: k.title,
        pillar: k.pillarTitle,
        budget: actualBudget,
        pipelineBudget,
        projectedBudget: actualBudget + pipelineBudget,
        totalProposals: approvedCount,
        approvedCount,
        shareOfProjects: Math.round(shareOfProjects * 10) / 10,
        avgCostFormatted,
        pipelineCount,
        draftCount,
        avgCostPerProject,
        dollarCap: Math.round(dollarCap),
        ratio: roundedRatio,
        shareOfCommitted: Math.round(shareOfCommitted * 10) / 10,
        variancePct,
        projectedRatio: Math.round(projectedRatio * 10) / 10,
        cap: targetCap,
        color: KPI_PALETTE[idx % KPI_PALETTE.length],
        approvedImpact,
        pipelineImpact,
        totalImpact,
        quantifiedApprovedCount,
        displayImpact,
        costPerPerson,
        costPerPersonFormatted,
        isEstimatedCost,
      };
    });
  }, [kpiAnalytics, grandTotalCombinedBudgetPool, totalAllocatedCeiling, totalCommittedBudget, kpiCaps]);

  // Pillar Ratio Donut Data - Proportional share of committed projects
  const pillarDonutData = useMemo(() => {
    return pillarAnalytics.map((p) => ({
      name: `Pillar ${p.pillar.number}`,
      fullName: p.pillar.title,
      value: p.totalBudget,
      ratio: p.shareOfCommitted,
      cap: p.targetCap,
      color: p.color,
    }));
  }, [pillarAnalytics]);

  // 3. Union Financial Matrix (Allocated, Committed, Remaining)
  const unionMatrixSourceProposals =
    isContextSnapshotMode || isProposalMaker ? snapshotApprovedProposals : proposals;

  const unionMatrix = useMemo(() => {
    const list = UNIONS.map((unionName) => {
      const acronym = UNION_ACRONYMS[unionName] || '';
      const allocated = allocations[unionName] || 0;
      const matching = matchingPledges[unionName] || 0;
      const totalPool = allocated + matching;

      // Filter proposals for this union
      const canonicalTarget = getCanonicalUnion(unionName);
      const unionProposals = unionMatrixSourceProposals.filter((p) => {
        if (!p.union) return false;
        return getCanonicalUnion(p.union) === canonicalTarget;
      });

      const unionApprovedProposals = unionProposals.filter((p) => p.status === 'approved');
      const unionPipelineProposals = unionProposals.filter(
        (p) => p.status === 'submitted' || p.status === 'under_review'
      );
      const unionDraftProposals = unionProposals.filter(
        (p) => !p.status || p.status === 'draft'
      );

      // Committed budget is ONLY from approved proposals
      const committed = unionApprovedProposals.reduce((sum, p) => {
        const pBudget = (p.budgetItems || []).reduce(
          (acc, item) => acc + (Number(item.divisionFunding ?? item.gcFunding) || 0),
          0
        );
        return sum + pBudget;
      }, 0);

      // Incoming pipeline budget
      const pipeline = unionPipelineProposals.reduce((sum, p) => {
        const pBudget = (p.budgetItems || []).reduce(
          (acc, item) => acc + (Number(item.divisionFunding ?? item.gcFunding) || 0),
          0
        );
        return sum + pBudget;
      }, 0);

      const remaining = totalPool - committed;
      const projectedRemaining = totalPool - (committed + pipeline);
      const utilization = totalPool > 0 ? Math.round((committed / totalPool) * 100) : 0;
      const projectedUtilization = totalPool > 0 ? Math.round(((committed + pipeline) / totalPool) * 100) : 0;

      let status: 'healthy' | 'near_capacity' | 'over_budget' | 'no_submissions' | 'unallocated';
      if (totalPool <= 0 && allocated <= 0 && committed > 0) {
        status = 'unallocated';
      } else if (totalPool <= 0 && allocated <= 0 && committed === 0) {
        status = 'no_submissions';
      } else if (committed > (totalPool > 0 ? totalPool : allocated)) {
        status = 'over_budget';
      } else if (utilization >= 80) {
        status = 'near_capacity';
      } else if (committed === 0) {
        status = 'no_submissions';
      } else {
        status = 'healthy';
      }

      // Find Category
      const cat = UNION_CATEGORIES.find((c) => c.unions.includes(unionName))?.category || 'Other';

      // Union Intelligence (Adventist Yearbook + Digital 2026 + Freedom House)
      const intel = getUnionIntelligence(unionName);
      const churches = intel?.churches || 0;
      const membership = intel?.membership || 0;
      const population = intel?.population || 0;
      const memberToPopRatio = intel?.memberToPopRatio || 0;
      const onlinePct = intel?.avgInternetPenetrationPct || 0;
      const requiresPlay7 = intel?.isSensitiveTerritory || false;
      const committedPerChurch = churches > 0 && committed > 0 ? Math.round(committed / churches) : 0;
      const poolPerChurch = churches > 0 && totalPool > 0 ? Math.round(totalPool / churches) : 0;

      return {
        unionName,
        acronym,
        category: cat,
        allocated,
        matching,
        totalPool,
        committed,
        pipeline,
        remaining,
        projectedRemaining,
        utilization,
        projectedUtilization,
        status,
        projectCount: unionApprovedProposals.length,
        approvedCount: unionApprovedProposals.length,
        pipelineCount: unionPipelineProposals.length,
        draftCount: unionDraftProposals.length,
        totalProposalsCount: unionProposals.length,
        proposals: unionProposals,
        approvedProposals: unionApprovedProposals,
        pipelineProposals: unionPipelineProposals,
        draftProposals: unionDraftProposals,
        churches,
        membership,
        population,
        memberToPopRatio,
        onlinePct,
        requiresPlay7,
        committedPerChurch,
        poolPerChurch,
      };
    });

    return list;
  }, [allocations, matchingPledges, unionMatrixSourceProposals]);

  // Scope Field Baseline (Single Union or Division-Wide)
  const scopeFieldBaseline = useMemo(() => {
    const baselineUnion = isScopedToSingleUnion
      ? effectiveUnionScope
      : isProposalMaker && !isContextSnapshotMode && hasValidUserUnion
      ? userUnion
      : null;

    if (baselineUnion) {
      const prof = getUnionIntelligence(baselineUnion);
      if (prof) {
        const onlinePop = Math.round(
          prof.population * (prof.avgInternetPenetrationPct / 100)
        );
        const offlinePop = Math.max(0, prof.population - onlinePop);
        const offlinePct = Math.max(0, Math.round((100 - prof.avgInternetPenetrationPct) * 10) / 10);
        return {
          label: `${prof.acronym} Field Baseline`,
          churches: prof.churches,
          constituentFieldsCount: prof.constituentFields.length,
          membership: prof.membership,
          avgMembersPerChurch: prof.avgMembersPerChurch,
          population: prof.population,
          ratio: prof.memberToPopRatio,
          onlinePct: prof.avgInternetPenetrationPct,
          onlinePop,
          offlinePop,
          offlinePct,
          totalPeopleGroupsCount: prof.totalPeopleGroupsCount,
          leastReachedGroupsCount: prof.leastReachedGroupsCount,
          livingLanguagesCount: prof.livingLanguagesCount,
          primaryLanguagesSummary: prof.primaryLanguagesSummary,
          countriesLabel: prof.countries.join(', '),
          committedPerChurch:
            prof.churches > 0 ? Math.round(totalCommittedBudget / prof.churches) : 0,
          projectedPerChurch:
            prof.churches > 0 ? Math.round(totalProjectedBudget / prof.churches) : 0,
          committedPer1kPop:
            prof.population > 0
              ? (totalCommittedBudget / (prof.population / 1000))
              : 0,
        };
      }
    }

    const totalOnline = Object.values(UNION_INTELLIGENCE_PROFILES).reduce(
      (sum, p) =>
        sum + Math.round(p.population * (p.avgInternetPenetrationPct / 100)),
      0
    );
    const weightedOnlinePct =
      SSD_DIVISION_YEARBOOK_TOTALS.population > 0
        ? Math.round((totalOnline / SSD_DIVISION_YEARBOOK_TOTALS.population) * 1000) / 10
        : 79.6;
    const offlinePop = Math.max(0, SSD_DIVISION_YEARBOOK_TOTALS.population - totalOnline);
    const offlinePct = Math.max(0, Math.round((100 - weightedOnlinePct) * 10) / 10);

    return {
      label: 'SSD Field Baseline',
      churches: SSD_DIVISION_YEARBOOK_TOTALS.churches,
      constituentFieldsCount: SSD_DIVISION_YEARBOOK_TOTALS.constituentFieldsCount,
      membership: SSD_DIVISION_YEARBOOK_TOTALS.membership,
      avgMembersPerChurch: SSD_DIVISION_YEARBOOK_TOTALS.avgMembersPerChurch,
      population: SSD_DIVISION_YEARBOOK_TOTALS.population,
      ratio: SSD_DIVISION_YEARBOOK_TOTALS.memberToPopRatio,
      onlinePct: weightedOnlinePct,
      onlinePop: totalOnline,
      offlinePop,
      offlinePct,
      totalPeopleGroupsCount: SSD_DIVISION_YEARBOOK_TOTALS.totalPeopleGroupsCount,
      leastReachedGroupsCount: SSD_DIVISION_YEARBOOK_TOTALS.leastReachedGroupsCount,
      livingLanguagesCount: SSD_DIVISION_YEARBOOK_TOTALS.livingLanguagesCount,
      primaryLanguagesSummary: SSD_DIVISION_YEARBOOK_TOTALS.primaryLanguagesSummary,
      countriesLabel: `${SSD_DIVISION_YEARBOOK_TOTALS.countriesCount} Countries`,
      committedPerChurch:
        SSD_DIVISION_YEARBOOK_TOTALS.churches > 0
          ? Math.round(totalCommittedBudget / SSD_DIVISION_YEARBOOK_TOTALS.churches)
          : 0,
      projectedPerChurch:
        SSD_DIVISION_YEARBOOK_TOTALS.churches > 0
          ? Math.round(totalProjectedBudget / SSD_DIVISION_YEARBOOK_TOTALS.churches)
          : 0,
      committedPer1kPop:
        SSD_DIVISION_YEARBOOK_TOTALS.population > 0
          ? totalCommittedBudget / (SSD_DIVISION_YEARBOOK_TOTALS.population / 1000)
          : 0,
    };
  }, [
    isScopedToSingleUnion,
    effectiveUnionScope,
    isProposalMaker,
    isContextSnapshotMode,
    hasValidUserUnion,
    userUnion,
    totalCommittedBudget,
    totalProjectedBudget,
  ]);

  // Filtered Unions for Table
  const filteredUnionMatrix = useMemo(() => {
    let sourceList = unionMatrix;
    if (isScopedToSingleUnion) {
      const canonScope = getCanonicalUnion(effectiveUnionScope);
      sourceList = unionMatrix.filter(
        (item) => getCanonicalUnion(item.unionName) === canonScope
      );
    } else if (isProposalMaker && !isContextSnapshotMode && hasValidUserUnion) {
      const canonUser = getCanonicalUnion(userUnion);
      sourceList = unionMatrix.filter(
        (item) => getCanonicalUnion(item.unionName) === canonUser
      );
    } else if (isLiaison && !isContextSnapshotMode) {
      const assignedSet = new Set(liaisonUnions.map(getCanonicalUnion));
      sourceList = unionMatrix.filter((item) =>
        assignedSet.has(getCanonicalUnion(item.unionName))
      );
    }

    const q = unionSearch.toLowerCase().trim();
    return sourceList.filter((item) => {
      const matchesSearch =
        !q ||
        item.unionName.toLowerCase().includes(q) ||
        item.acronym.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      const matchesCat =
        unionFilterCategory === 'all'
          ? true
          : unionFilterCategory === 'over_budget'
          ? item.status === 'over_budget'
          : unionFilterCategory === 'frontier_ratio'
          ? item.memberToPopRatio >= 1000
          : unionFilterCategory === 'needs_action'
          ? item.status === 'over_budget' || item.status === 'unallocated'
          : item.category === unionFilterCategory;

      return matchesSearch && matchesCat;
    });
  }, [
    unionMatrix,
    unionSearch,
    unionFilterCategory,
    isScopedToSingleUnion,
    effectiveUnionScope,
    isProposalMaker,
    isContextSnapshotMode,
    hasValidUserUnion,
    userUnion,
    isLiaison,
    liaisonUnions,
  ]);

  // Handle saving strategic percentage caps (Division Super Admin only)
  const handleSaveCaps = async () => {
    if (!isSuperAdmin) return;
    setIsSavingCaps(true);
    setCapsSaveSuccess(false);
    try {
      const payload: StrategicKpiCaps = {
        pillarCaps: tempPillarCaps,
        kpiCaps: tempKpiCaps,
      };
      await saveStrategicKpiCaps(payload, currentUser.email || currentUser.uid);
      setKpiCaps(payload);
      setCapsSaveSuccess(true);
      setTimeout(() => {
        setCapsSaveSuccess(false);
        setIsCapsEditorOpen(false);
      }, 1500);
    } catch (e) {
      console.error('Failed to save KPI caps:', e);
    } finally {
      setIsSavingCaps(false);
    }
  };

  // Reset caps to defaults
  const handleResetCaps = () => {
    setTempPillarCaps(DEFAULT_KPI_CAPS.pillarCaps);
    setTempKpiCaps(DEFAULT_KPI_CAPS.kpiCaps);
  };

  const tempPillarsSum =
    Math.round(Object.values(tempPillarCaps).reduce((a, b) => a + Number(b || 0), 0) * 100) / 100;

  // Drilldown modal proposals
  const activeDrilldownUnionObj = useMemo(() => {
    if (!selectedDrilldownUnion) return null;
    return unionMatrix.find((u) => u.unionName === selectedDrilldownUnion) || null;
  }, [selectedDrilldownUnion, unionMatrix]);

  const activeDrilldownKpiData = useMemo(() => {
    if (!selectedDrilldownKpi) return null;
    return kpiAnalytics.kpiMap[selectedDrilldownKpi.id] || null;
  }, [selectedDrilldownKpi, kpiAnalytics]);

  // SSD Three-Pillar Classification & Mission Pathway Matrix across Approved Proposals
  const frameworkMatrix = useMemo(() => {
    const subTypes: Exclude<PillarSubType, 'unclassified'>[] = [
      'p1_enabling',
      'p2_tools_intelligence',
      'p2_community_service',
      'p3_proclamation_discipleship',
    ];
    const stageKeys = [
      'enabling',
      'reach_exposure',
      'engagement_participation',
      'connection_next_steps',
      'retention_nurturing',
      'implementation_capability',
    ] as const;

    const rowsMap: Record<
      Exclude<PillarSubType, 'unclassified'>,
      {
        count: number;
        budget: number;
        stages: Record<(typeof stageKeys)[number], number>;
      }
    > = {
      p1_enabling: {
        count: 0,
        budget: 0,
        stages: {
          enabling: 0,
          reach_exposure: 0,
          engagement_participation: 0,
          connection_next_steps: 0,
          retention_nurturing: 0,
          implementation_capability: 0,
        },
      },
      p2_tools_intelligence: {
        count: 0,
        budget: 0,
        stages: {
          enabling: 0,
          reach_exposure: 0,
          engagement_participation: 0,
          connection_next_steps: 0,
          retention_nurturing: 0,
          implementation_capability: 0,
        },
      },
      p2_community_service: {
        count: 0,
        budget: 0,
        stages: {
          enabling: 0,
          reach_exposure: 0,
          engagement_participation: 0,
          connection_next_steps: 0,
          retention_nurturing: 0,
          implementation_capability: 0,
        },
      },
      p3_proclamation_discipleship: {
        count: 0,
        budget: 0,
        stages: {
          enabling: 0,
          reach_exposure: 0,
          engagement_participation: 0,
          connection_next_steps: 0,
          retention_nurturing: 0,
          implementation_capability: 0,
        },
      },
    };

    let meetingCount = 0;
    let fiscalAlignedCount = 0;

    for (const p of approvedProposals) {
      const pBudget = (p.budgetItems || []).reduce(
        (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      );
      const ev = evaluateProposalReviewFramework(p);
      if (ev.effectiveRating === 'meeting_requirement') meetingCount += 1;
      if (ev.budgetConcordance.isAligned) fiscalAlignedCount += 1;

      if (ev.subType !== 'unclassified') {
        rowsMap[ev.subType].count += 1;
        rowsMap[ev.subType].budget += pBudget;
        rowsMap[ev.subType].stages[ev.principalStageKey] += 1;
      }
    }

    const total = approvedProposals.length;
    return {
      rows: subTypes.map((st) => ({
        key: st,
        meta: PILLAR_SUBTYPE_LABELS[st],
        ...rowsMap[st],
        budgetSharePct:
          totalCommittedBudget > 0
            ? Math.round((rowsMap[st].budget / totalCommittedBudget) * 100)
            : 0,
      })),
      meetingPct: total > 0 ? Math.round((meetingCount / total) * 100) : 100,
      fiscalAlignedPct: total > 0 ? Math.round((fiscalAlignedCount / total) * 100) : 100,
    };
  }, [approvedProposals, totalCommittedBudget]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* 1. Compact Header and Scope Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            OneVoice Dashboard
          </h1>
          <span
            className="inline-flex items-center text-slate-400 hover:text-slate-600 cursor-help"
            title="Analytics across officially approved proposals: budget pools, target impact, audience unit economics, and Global Objective cap utilization."
          >
            <HelpCircle className="w-4 h-4" />
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-xs font-medium text-slate-500">
            {isContextSnapshotMode
              ? contextMode === 'union_context' && hasValidUserUnion
                ? `${UNION_ACRONYMS[userUnion] || userUnion} Approved Context`
                : 'SSD Division Approved Context'
              : isProposalMaker
              ? 'My Approved Portfolio'
              : isScopedToSingleUnion
              ? `${UNION_ACRONYMS[effectiveUnionScope] || effectiveUnionScope} Approved Analytics`
              : isLiaison
              ? 'Assigned Unions Approved Analytics'
              : 'Division Approved Analytics'}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {isSuperAdmin ? (
            <div
              className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs"
              title={selectedUnionScope === 'all' ? 'All Unions (Division Total)' : selectedUnionScope}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedUnionScope}
                onChange={(e) => handleUnionScopeChange(e.target.value)}
                aria-label="Filter dashboard by Union code"
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer tabular-nums"
              >
                <option value="all">
                  All Unions ({proposals.filter((p) => p.status === 'approved').length})
                </option>
                {UNIONS.map((u) => {
                  const count = proposals.filter(
                    (p) => p.status === 'approved' && getCanonicalUnion(p.union) === getCanonicalUnion(u)
                  ).length;
                  return (
                    <option key={u} value={u}>
                      {UNION_ACRONYMS[u] || u} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : isLiaison && !isContextSnapshotMode && liaisonUnions.length > 1 ? (
            <div
              className="flex items-center gap-1.5 bg-white border border-indigo-300 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs"
              title={selectedUnionScope === 'all' ? `All Assigned Unions (${liaisonUnions.length})` : selectedUnionScope}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <select
                value={selectedUnionScope}
                onChange={(e) => handleUnionScopeChange(e.target.value)}
                aria-label="Filter dashboard by assigned Union code"
                className="bg-transparent border-none text-xs font-bold text-indigo-950 focus:outline-none cursor-pointer tabular-nums"
              >
                <option value="all">
                  All Assigned (
                  {
                    proposals.filter(
                      (p) =>
                        p.status === 'approved' &&
                        liaisonUnions.map(getCanonicalUnion).includes(getCanonicalUnion(p.union))
                    ).length
                  }
                  )
                </option>
                {liaisonUnions.map((u: string) => {
                  const count = proposals.filter(
                    (p) => p.status === 'approved' && getCanonicalUnion(p.union) === getCanonicalUnion(u)
                  ).length;
                  return (
                    <option key={u} value={u}>
                      {UNION_ACRONYMS[u] || u} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <span className="text-xs font-bold text-slate-700" title={effectiveUnionScope}>
              {isContextSnapshotMode
                ? contextMode === 'union_context' && hasValidUserUnion
                  ? UNION_ACRONYMS[userUnion] || userUnion
                  : 'SSD Division'
                : isProposalMaker
                ? currentUser.displayName || 'My Proposals'
                : UNION_ACRONYMS[effectiveUnionScope] || effectiveUnionScope || 'Union'}
            </span>
          )}
        </div>
      </div>

      {/* 1.5 Universal Contribution & Strategic Context Panel (All Roles) */}
      <StrategicContextCard
        currentUser={currentUser}
        liveProposals={proposals}
        divisionApprovedProposals={divisionApprovedProposals}
        allocations={allocations}
        matchingPledges={matchingPledges}
        kpiCaps={kpiCaps}
        contextMode={contextMode}
        onContextModeChange={setContextMode}
        selectedUnionScope={effectiveUnionScope}
        snapshotUpdatedAt={publicSnapshot?.updatedAt}
        onSelectProposal={onSelectProposal}
      />

      {/* 1.75 Portfolio Health Status, Data Observations & Playbook Intentionality Reminders */}
      <PortfolioHealthPanel
        approvedProposals={approvedProposals}
        baseBudgetPool={grandTotalCombinedBudgetPool}
        kpiCaps={kpiCaps}
        userRole={currentUser.role}
        isSnapshotContext={isContextSnapshotMode}
        scopeLabel={
          isContextSnapshotMode
            ? contextMode === 'union_context' && hasValidUserUnion
              ? UNION_ACRONYMS[userUnion] || userUnion
              : 'SSD Division'
            : isProposalMaker
            ? 'My Approved Portfolio'
            : isScopedToSingleUnion
            ? UNION_ACRONYMS[effectiveUnionScope] || effectiveUnionScope
            : isLiaison
            ? 'Assigned Unions'
            : 'SSD Division'
        }
      />

      {/* Empty-state helper if Proposal Maker views "My Proposals" before any are Approved */}
      {isProposalMaker && contextMode === 'live' && statusCounts.approved === 0 && (
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-700">
            <strong className="text-slate-900">No personal proposals approved yet.</strong>{' '}
            Charts below track officially approved commitments ({statusCounts.pipeline} in review,{' '}
            {statusCounts.draft} drafts in your workspace).
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasValidUserUnion && (
              <button
                type="button"
                onClick={() => setContextMode('union_context')}
                className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-[#1c398e] font-bold hover:bg-blue-100/60 transition cursor-pointer"
              >
                View {UNION_ACRONYMS[userUnion] || 'Union'} Approved
              </button>
            )}
            <button
              type="button"
              onClick={() => setContextMode('division_context')}
              className="px-3 py-1.5 rounded-xl bg-[#1c398e] text-white font-bold hover:bg-[#152c70] transition cursor-pointer"
            >
              View SSD Division
            </button>
          </div>
        </div>
      )}

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Approved Projects */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Approved Projects
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums my-1.5">
            {statusCounts.approved}
          </div>
          <div className="text-xs text-emerald-700 font-semibold">
            Committee voted
          </div>
        </div>

        {/* Total Approved Proposal Budgets */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Approved Budgets
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums my-1.5">
            US${formatCurrency(totalCommittedBudget)}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            Avg <strong className="text-slate-800">US${formatCurrency(averageProjectBudget)}</strong> / project
          </div>
        </div>

        {/* Budget Pool Card */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {isScopedToSingleUnion
              ? `${UNION_ACRONYMS[effectiveUnionScope] || 'Union'} Pool`
              : isProposalMaker && !isContextSnapshotMode && hasValidUserUnion
              ? `${UNION_ACRONYMS[userUnion] || 'Union'} Pool`
              : isLiaison && !isContextSnapshotMode
              ? 'Assigned Pool'
              : 'Total Budget Pool'}
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums my-1.5">
            US${formatCurrency(grandTotalCombinedBudgetPool)}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums truncate">
            GC/SSD <strong className="text-slate-800">${formatCurrency(totalAllocatedCeiling)}</strong> · Union{' '}
            <strong className="text-emerald-700">${formatCurrency(totalMatchingPledged)}</strong>
          </div>
        </div>

        {/* Remaining Funds */}
        <div
          className={`p-4 rounded-2xl border shadow-2xs flex flex-col justify-between ${
            grandRemainingFunds < 0
              ? 'bg-rose-50/50 border-rose-200'
              : 'bg-white border-slate-200/90'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {isScopedToSingleUnion ? 'Remaining Union Funds' : 'Remaining Funds'}
          </span>
          <div
            className={`text-2xl font-black tracking-tight tabular-nums my-1.5 ${
              grandRemainingFunds < 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            US${formatCurrency(Math.abs(grandRemainingFunds))}
            {grandRemainingFunds < 0 && ' (Deficit)'}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
            <span>Pool utilized</span>
            <span
              className={`font-bold ${
                overallUtilizationRatio > 100
                  ? 'text-rose-600'
                  : overallUtilizationRatio > 80
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {overallUtilizationRatio}%
            </span>
          </div>
        </div>
      </div>

      {/* 2.1 Territory Intelligence (Single Union) OR Collapsible Division Field Baseline */}
      {isScopedToSingleUnion ? (
        <UnionIntelligenceBanner unionName={effectiveUnionScope} compact={false} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap min-w-0 text-slate-600 tabular-nums">
              <span className="font-extrabold text-slate-900">{scopeFieldBaseline.label}</span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span>{scopeFieldBaseline.churches.toLocaleString()} Churches</span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span>1:{scopeFieldBaseline.ratio.toLocaleString()} Ratio</span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-emerald-700 font-semibold">{scopeFieldBaseline.onlinePct}% Online</span>
              <span className="hidden md:inline text-slate-300" aria-hidden="true">·</span>
              <span className="hidden md:inline text-slate-500">
                {scopeFieldBaseline.leastReachedGroupsCount.toLocaleString()} Unreached Groups
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowBaseline((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer shrink-0"
            >
              <span>{showBaseline ? 'Hide Baseline' : 'Field Baseline'}</span>
              {showBaseline ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {showBaseline && (
            <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>
                  Adventist Yearbook (June 2025), DataReportal Digital 2026 &amp; Joshua Project Benchmarks
                </span>
                <span className="font-semibold text-slate-600 tabular-nums">
                  {scopeFieldBaseline.countriesLabel} · {scopeFieldBaseline.constituentFieldsCount} Conferences &amp; Missions
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 w-full">
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Local Churches
                  </div>
                  <div className="text-sm font-black text-slate-900 tabular-nums mt-0.5">
                    {scopeFieldBaseline.churches.toLocaleString()}
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Adventist Members
                  </div>
                  <div className="text-sm font-black text-[#1c398e] tabular-nums mt-0.5">
                    {scopeFieldBaseline.membership.toLocaleString()}
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Population · Ratio
                  </div>
                  <div className="text-sm font-black text-slate-900 tabular-nums mt-0.5">
                    {(scopeFieldBaseline.population / 1_000_000).toFixed(1)}M · 1:{scopeFieldBaseline.ratio.toLocaleString()}
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-emerald-50/50 border border-emerald-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Online Reachable
                  </div>
                  <div className="text-sm font-black text-emerald-700 tabular-nums mt-0.5">
                    {(scopeFieldBaseline.onlinePop / 1_000_000).toFixed(1)}M ({scopeFieldBaseline.onlinePct}%)
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-amber-50/50 border border-amber-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Offline Population
                  </div>
                  <div className="text-sm font-black text-amber-800 tabular-nums mt-0.5">
                    {(scopeFieldBaseline.offlinePop / 1_000_000).toFixed(1)}M ({scopeFieldBaseline.offlinePct}%)
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    People Groups
                  </div>
                  <div className="text-sm font-black text-slate-900 tabular-nums mt-0.5">
                    {scopeFieldBaseline.totalPeopleGroupsCount.toLocaleString()} ({scopeFieldBaseline.leastReachedGroupsCount.toLocaleString()} UPG)
                  </div>
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 sm:col-span-2 xl:col-span-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {scopeFieldBaseline.livingLanguagesCount.toLocaleString()}+ Living Languages
                  </div>
                  <div className="text-[11px] text-slate-700 font-medium leading-tight mt-0.5 truncate">
                    <strong>Top 5:</strong> {scopeFieldBaseline.primaryLanguagesSummary}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2.5 Quantified Mission Targets & Approved Impact (Scoped to Union Selector) */}
      <MonitorImpactMetrics
        proposals={approvedProposals}
        selectedUnion={effectiveUnionScope}
        onSelectProposal={onSelectProposal}
        canOpenProposal={canOpenProposal}
        onNavigateToReviewHub={onBackToReviewHub ? () => onBackToReviewHub() : undefined}
        approvedOnly={true}
      />

      {/* 2.55 Territory Reality, Unreached People Groups (UPGs) & Budget-to-KPI Plausibility */}
      <TerritoryUpgImpactCard
        proposals={approvedProposals}
        selectedUnion={effectiveUnionScope}
        onSelectUnionScope={isSuperAdmin ? handleUnionScopeChange : undefined}
      />

      {/* 2.6 Strategic Capital Allocation & Unit Economics (A-B-C vs D-E) */}
      <AudienceInvestmentCard proposals={approvedProposals} approvedOnly={true} />

      {/* 2.7 Audience Tags & Demographic Reach (Standalone Box - Option 1) */}
      <UnionAudienceTagsBox
        proposals={approvedProposals}
        selectedUnion={effectiveUnionScope}
        scopeName={
          isScopedToSingleUnion
            ? UNION_ACRONYMS[effectiveUnionScope] || effectiveUnionScope
            : isProposalMaker && !isContextSnapshotMode
            ? 'My Approved Portfolio'
            : 'Division Total'
        }
      />

      {/* 3. Visual Charts: Budget per KPI & Ratio of KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Perceived Priority & Resource Allocation by Global Objective */}
        <div className="lg:col-span-7 min-w-0 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>
                  {kpiChartMode === 'budget_count'
                    ? 'Budget & Proposals by Global Objective'
                    : 'Perceived Priority: % of Projects vs. % of Funding'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {kpiChartMode === 'budget_count'
                  ? 'Approved funding ($) bars vs. proposal count (#) line — shows effort vs. financial commitment'
                  : 'Compare proposal volume share (%) against funding share (%) to spot under-funded priorities'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* View Mode Switcher */}
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setKpiChartMode('budget_count')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    kpiChartMode === 'budget_count'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  $ &amp; Count
                </button>
                <button
                  type="button"
                  onClick={() => setKpiChartMode('effort_vs_funds')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    kpiChartMode === 'effort_vs_funds'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  % Effort vs % Funds
                </button>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600 mb-2 flex-wrap">
            {kpiChartMode === 'budget_count' ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                  <span>Approved Budget ($)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-600 rounded-full relative inline-flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  </span>
                  <span>Approved Proposals (#)</span>
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span>Share of Proposals (%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                  <span>Share of Funding (%)</span>
                </span>
              </>
            )}
          </div>

          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 360, height: 256 }}
            >
              {kpiChartMode === 'budget_count' ? (
                <ComposedChart
                  data={kpiBarChartData}
                  margin={{ top: 14, right: 8, left: 0, bottom: 5 }}
                >
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={(val) =>
                      val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val}`
                    }
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#d97706"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0f172a] text-white p-3.5 rounded-xl shadow-2xl text-xs space-y-2 border border-slate-700 max-w-sm">
                          <div>
                            <div className="font-extrabold text-blue-300">
                              Objective {data.number || (typeof label === 'string' ? label.replace('Obj ', '') : '')}: {data.fullName}
                            </div>
                            <div className="text-[11px] text-slate-300 mt-0.5">
                              <span className="text-slate-400">Pillar:</span> {data.pillar}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-700/80 space-y-1.5">
                            <div className="flex items-center justify-between font-bold text-emerald-400">
                              <span>Approved Budget:</span>
                              <span>
                                US$ {formatCurrency(Number(data.budget) || 0)} ({data.shareOfCommitted}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-bold text-amber-400">
                              <span>Approved Proposals:</span>
                              <span className="text-white bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                                {data.approvedCount} projects ({data.shareOfProjects}%)
                              </span>
                            </div>
                            {data.approvedCount > 0 && (
                              <div className="text-[11px] text-slate-300 flex items-center justify-between">
                                <span className="text-slate-400">Avg / Project:</span>
                                <span className="font-semibold text-white">US$ {formatCurrency(data.avgCostPerProject, 0)}</span>
                              </div>
                            )}

                            {/* Target Impact & Unit Economics */}
                            <div className="pt-1.5 border-t border-slate-700/80 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1.5 text-emerald-300">
                                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Target Impact:</span>
                                </span>
                                <span className="font-bold text-emerald-300">
                                  {data.approvedImpact > 0
                                    ? `${formatMetricCount(data.approvedImpact)} people`
                                    : '—'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="flex items-center gap-1.5 text-blue-300">
                                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Cost / Person:</span>
                                </span>
                                <span className="font-bold text-blue-300">
                                  {data.costPerPersonFormatted !== '—'
                                    ? `${data.costPerPersonFormatted} / person`
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="budget"
                    name="Approved Budget ($)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                  >
                    {kpiBarChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="linear"
                    dataKey="approvedCount"
                    name="Approved Proposals (#)"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    dot={{ r: 4.5, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              ) : (
                <BarChart
                  data={kpiBarChartData}
                  margin={{ top: 14, right: 8, left: 0, bottom: 5 }}
                  barGap={4}
                >
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#0f172a] text-white p-3.5 rounded-xl shadow-2xl text-xs space-y-2 border border-slate-700 max-w-sm">
                          <div>
                            <div className="font-extrabold text-blue-300">
                              Objective {data.number || (typeof label === 'string' ? label.replace('Obj ', '') : '')}: {data.fullName}
                            </div>
                            <div className="text-[11px] text-slate-300 mt-0.5">
                              <span className="text-slate-400">Pillar:</span> {data.pillar}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-700/80 space-y-1.5">
                            <div className="flex items-center justify-between font-bold text-amber-400">
                              <span>Proposal Effort Share:</span>
                              <span>{data.shareOfProjects}% ({data.approvedCount} proj)</span>
                            </div>
                            <div className="flex items-center justify-between font-bold text-emerald-400">
                              <span>Approved Budget Share:</span>
                              <span>{data.shareOfCommitted}% (US$ {formatCurrency(Number(data.budget) || 0, 0)})</span>
                            </div>
                            {data.approvedCount > 0 && (
                              <div className="flex items-center justify-between text-[11px] text-slate-300">
                                <span className="text-slate-400">Avg / Project:</span>
                                <span className="font-semibold text-white">US$ {formatCurrency(data.avgCostPerProject, 0)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="shareOfProjects"
                    name="Share of Proposals (%)"
                    fill="#f59e0b"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="shareOfCommitted"
                    name="Share of Funding (%)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={26}
                  >
                    {kpiBarChartData.map((entry, index) => (
                      <Cell key={`share-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Clean Tabular Summary Row by Objective (Includes Avg $/proj to expose Perceived Priority) */}
          <div className="grid grid-cols-7 gap-1 pt-3 mt-1 border-t border-slate-100 tabular-nums">
            {kpiBarChartData.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center p-1.5 rounded-lg hover:bg-slate-50 transition text-center"
                title={`${item.fullName} (${item.pillar})\n• Approved Budget: US$ ${formatCurrency(item.budget)}\n• Approved Proposals: ${item.approvedCount} projects (${item.shareOfProjects}% of count)\n• Avg per Project: ${item.approvedCount > 0 ? `US$ ${formatCurrency(item.avgCostPerProject, 0)}` : '—'}\n• Target Impact: ${formatMetricCount(item.approvedImpact)} people\n• Cost / Person: ${item.costPerPersonFormatted !== '—' ? `${item.costPerPersonFormatted} / person` : '—'}`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[11px] font-bold text-slate-700 truncate">
                    {item.name}
                  </span>
                </div>
                <div className="text-[11px] font-extrabold text-slate-900 mt-0.5">
                  {item.budget >= 1000 ? `$${(item.budget / 1000).toFixed(0)}k` : `$${item.budget}`}
                </div>
                <div className="text-[10px] text-slate-500">
                  {item.approvedCount} proj
                </div>
                <div className="text-[9.5px] font-semibold text-indigo-700 truncate w-full">
                  {item.avgCostFormatted}
                </div>
                <div className="text-[10px] font-semibold text-emerald-700 truncate w-full mt-0.5 pt-0.5 border-t border-slate-100">
                  {item.displayImpact}
                </div>
                <div className="text-[9.5px] font-medium text-slate-500 truncate w-full">
                  {item.costPerPersonFormatted === '—' ? '—' : `${item.costPerPersonFormatted}/p`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Ratio of KPI & Pillars (Donut Chart) */}
        <div className="lg:col-span-5 min-w-0 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-purple-600" />
                <span>Pillar Distribution</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Proportional share of total committed budget
              </p>
            </div>
          </div>

          <div className="h-64 w-full min-w-0 relative flex items-center justify-center">
            {totalCommittedBudget > 0 ? (
              <>
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={1}
                  minHeight={1}
                  initialDimension={{ width: 320, height: 256 }}
                >
                  <PieChart>
                    <Pie
                      data={pillarDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={92}
                      paddingAngle={3}
                      onMouseEnter={(_, index) => setHoveredPillarIndex(index)}
                      onMouseLeave={() => setHoveredPillarIndex(null)}
                    >
                      {pillarDonutData.map((entry, index) => (
                        <Cell
                          key={`donut-${index}`}
                          fill={entry.color}
                          opacity={hoveredPillarIndex === null || hoveredPillarIndex === index ? 1 : 0.35}
                          stroke={hoveredPillarIndex === index ? '#ffffff' : 'transparent'}
                          strokeWidth={hoveredPillarIndex === index ? 2 : 0}
                          className="transition-all duration-200 cursor-pointer"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Dynamic Center Readout sized to stay cleanly inside the donut inner ring */}
                {(() => {
                  const activePillar = hoveredPillarIndex !== null ? pillarAnalytics[hoveredPillarIndex] : null;
                  if (activePillar) {
                    const headroom = activePillar.dollarCap - activePillar.totalBudget;
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                        <span
                          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mb-0.5 truncate max-w-[114px]"
                          style={{
                            backgroundColor: `${activePillar.color}25`,
                            color: activePillar.color,
                          }}
                        >
                          Pillar {activePillar.pillar.number}
                        </span>
                        <span className="text-[13px] font-black text-slate-900 tabular-nums leading-tight max-w-[118px] truncate">
                          US${formatCurrency(Math.round(activePillar.totalBudget), 0)}
                        </span>
                        <span className="text-[9.5px] font-semibold text-slate-500 mt-0.5 tabular-nums max-w-[118px] truncate">
                          Cap: US${formatCurrency(Math.round(activePillar.dollarCap), 0)}
                        </span>
                        <span
                          className={`text-[9px] font-bold mt-0.5 px-1.5 py-0.5 rounded tabular-nums max-w-[116px] truncate ${
                            headroom >= 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {headroom >= 0
                            ? `US$${formatCurrency(Math.round(headroom), 0)} left`
                            : `US$${formatCurrency(Math.round(Math.abs(headroom)), 0)} over`}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
                        Approved Total
                      </span>
                      <span
                        className={`font-black text-slate-900 tabular-nums max-w-[118px] truncate mt-0.5 ${
                          totalCommittedBudget >= 100000 ? 'text-[13.5px]' : 'text-[15px]'
                        }`}
                      >
                        US${formatCurrency(Math.round(totalCommittedBudget), 0)}
                      </span>
                      <span className="text-[9.5px] font-medium text-slate-400 mt-0.5">
                        Hover slice
                      </span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-center text-xs text-slate-400">
                No project budgets entered yet to calculate ratios.
              </div>
            )}
          </div>

          {/* Upgraded Detailed Legend with Total Dollar Cap & Remaining Headroom */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {pillarAnalytics.map((p, idx) => {
              const headroom = p.dollarCap - p.totalBudget;
              const isHovered = hoveredPillarIndex === idx;

              return (
                <div
                  key={p.pillar.id}
                  onMouseEnter={() => setHoveredPillarIndex(idx)}
                  onMouseLeave={() => setHoveredPillarIndex(null)}
                  className={`p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                    isHovered
                      ? 'bg-slate-50/90 border-slate-300 shadow-2xs ring-1 ring-slate-200'
                      : 'bg-white border-slate-100/90 hover:border-slate-200 hover:bg-slate-50/40'
                  }`}
                >
                  {/* Row 1: Pillar Name, Approved Amount, and Dollar Cap */}
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: p.color }}
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-xs block truncate">
                          Pillar {p.pillar.number}: {p.pillar.title}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          <strong className="text-slate-800">US${formatCurrency(p.totalBudget)}</strong> approved ({p.actualRatio}% of Budget)
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <div className="text-xs font-black text-slate-900">
                        Cap: US${formatCurrency(p.dollarCap)}
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        ({p.targetCap}% limit)
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Actual Pool Share vs. Playbook Cap Limit Marker & Headroom Badge */}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div
                      className="flex-1 min-w-0 relative"
                      title={`Actual: ${p.actualRatio}% of pool vs. Playbook Cap: ${p.targetCap}%`}
                    >
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(Math.max(p.actualRatio, 0), 100)}%`,
                            backgroundColor: p.isExceeded ? '#ef4444' : p.color,
                          }}
                        />
                      </div>
                      {/* Playbook Cap % limit tick mark on the 0–100% pool scale */}
                      <div
                        className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-slate-800 rounded-full pointer-events-none"
                        style={{ left: `${Math.min(Math.max(p.targetCap, 1), 99)}%` }}
                      />
                    </div>
                    <div className="shrink-0">
                      {headroom >= 0 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 tabular-nums">
                          US${formatCurrency(headroom)} room left
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60 tabular-nums">
                          US${formatCurrency(Math.abs(headroom))} over limit
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4.5 SSD Three-Pillar Project Classification & Mission Pathway Matrix (Live full-proposal data only) */}
      {!isContextSnapshotMode && statusCounts.approved > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#1c398e]" />
                <span>SSD Project Types &amp; Mission Pathway Steps</span>
              </h3>
              <p className="text-xs text-slate-500">
                Shows approved projects by project type (Training, Media/UPG Tools, Community Service, and Evangelism) and Mission Pathway step
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2 text-xs tabular-nums">
              <span className="text-slate-600 font-semibold">
                Checklist Ready:{' '}
                <strong className="text-emerald-700">{frameworkMatrix.meetingPct}%</strong>
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-slate-600 font-semibold">
                Budget Matches Pillar:{' '}
                <strong className="text-[#1c398e]">{frameworkMatrix.fiscalAlignedPct}%</strong>
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <a
                href={REVIEW_FRAMEWORK_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-[#1c398e] hover:underline"
              >
                <span>Framework PDF</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#f8fafc] text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">SSD Pillar Sub-Type</th>
                  <th className="py-2.5 px-3 text-right">Approved Budget</th>
                  <th className="py-2.5 px-2.5 text-center">Enabling</th>
                  <th className="py-2.5 px-2.5 text-center">1. Reach</th>
                  <th className="py-2.5 px-2.5 text-center">2. Engage</th>
                  <th className="py-2.5 px-2.5 text-center">3. Connect</th>
                  <th className="py-2.5 px-2.5 text-center">4. Disciple</th>
                  <th className="py-2.5 px-2.5 text-center">5. Multiply</th>
                  <th className="py-2.5 px-4 text-right">Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {frameworkMatrix.rows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      {row.meta.fullLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      US${formatCurrency(row.budget)}{' '}
                      <span className="text-[10px] font-medium text-slate-400">
                        ({row.budgetSharePct}%)
                      </span>
                    </td>
                    {(
                      [
                        'enabling',
                        'reach_exposure',
                        'engagement_participation',
                        'connection_next_steps',
                        'retention_nurturing',
                        'implementation_capability',
                      ] as const
                    ).map((stKey) => {
                      const c = row.stages[stKey];
                      return (
                        <td key={stKey} className="py-2.5 px-2.5 text-center">
                          {c > 0 ? (
                            <span className="inline-block min-w-[22px] px-1.5 py-0.5 rounded bg-blue-50 text-[#1c398e] font-black text-[11px]">
                              {c}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-4 text-right font-black text-slate-900">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/80 border-t border-slate-200 tabular-nums text-[11px]">
                <tr>
                  <td className="py-2.5 px-4 font-extrabold text-slate-700">
                    Stage Totals
                  </td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                    US${formatCurrency(frameworkMatrix.rows.reduce((s, r) => s + r.budget, 0))}
                  </td>
                  {(
                    [
                      'enabling',
                      'reach_exposure',
                      'engagement_participation',
                      'connection_next_steps',
                      'retention_nurturing',
                      'implementation_capability',
                    ] as const
                  ).map((stKey) => {
                    const colTotal = frameworkMatrix.rows.reduce((s, r) => s + r.stages[stKey], 0);
                    const isStageGap = stKey !== 'enabling' && colTotal === 0;
                    return (
                      <td key={stKey} className="py-2.5 px-2.5 text-center">
                        <span
                          className={`inline-block min-w-[22px] px-1.5 py-0.5 rounded font-black text-[11px] ${
                            isStageGap
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : colTotal > 0
                              ? 'bg-slate-200/70 text-slate-800'
                              : 'text-slate-400'
                          }`}
                          title={isStageGap ? '0 approved projects in this Mission Pathway stage' : undefined}
                        >
                          {isStageGap ? '0 · Gap' : colTotal}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-4 text-right font-black text-slate-900">
                    {frameworkMatrix.rows.reduce((s, r) => s + r.count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 5. 7 Global Objectives Detailed Breakdown Table with Percentage Caps */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-[#1c398e]" />
              <span>Global Objectives Inventory</span>
            </h3>
            <p className="text-xs text-slate-500">
              Breakdown of projects, committed funding, and live percentage caps for each of the 7 Global Objectives
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            Approved Projects Aligned: <strong>{statusCounts.approved}</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-[#f8fafc] text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Objective & Title</th>
                <th className="py-3 px-3">Pillar</th>
                <th className="py-3 px-4 min-w-[220px]">Approved Proposals & Share</th>
                <th className="py-3 px-4 text-right">Committed Budget</th>
                <th className="py-3 px-4 text-right">Target Impact & Cost / Person</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ALL_STRATEGIC_KPIS.map((kpi) => {
                const data = kpiAnalytics.kpiMap[kpi.id];
                const budget = data?.approvedBudget || 0;
                const approvedCount = data?.approvedCount || 0;
                const volumeShare =
                  statusCounts.approved > 0
                    ? Math.round((approvedCount / statusCounts.approved) * 100)
                    : 0;

                // Extract and aggregate measurable KPI targets for this objective (Approved only)
                const objApprovedProposals = data ? data.approvedProposals : [];
                let objApprovedTarget = 0;
                let detectedUnit = '';

                for (const p of objApprovedProposals) {
                  const canonKpi = getCanonicalKpiType(p.kpiType);
                  const parsed = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, canonKpi);
                  if (parsed.value !== null && parsed.value > 0) {
                    objApprovedTarget += parsed.value;
                    if (!detectedUnit && parsed.shortUnit) {
                      detectedUnit = parsed.shortUnit;
                    }
                  }
                }

                const fallbackUnit = DEFAULT_OBJECTIVE_UNITS[kpi.id] || 'people';
                const displayUnit = detectedUnit || fallbackUnit;

                const objCostApproved =
                  objApprovedTarget > 0 && budget > 0 ? budget / objApprovedTarget : null;

                const baseBudgetPool =
                  grandTotalCombinedBudgetPool > 0
                    ? grandTotalCombinedBudgetPool
                    : totalAllocatedCeiling > 0
                    ? totalAllocatedCeiling
                    : totalCommittedBudget;
                const ratio =
                  baseBudgetPool > 0
                    ? Math.round((budget / baseBudgetPool) * 1000) / 10
                    : 0;
                const targetCap = kpiCaps.kpiCaps[kpi.id] ?? kpi.defaultCap;
                const isOverCap = ratio > targetCap && budget > 0;

                return (
                  <tr key={kpi.id} className="hover:bg-slate-50/70 transition">
                    {/* Objective Title */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-extrabold flex items-center justify-center text-[10px] shrink-0">
                          {kpi.number}
                        </span>
                        <span className="font-bold">{kpi.title}</span>
                      </div>
                    </td>

                    {/* Strategic Pillar */}
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold whitespace-nowrap">
                        Pillar {kpi.pillarId.replace('pillar_', '')}
                      </span>
                    </td>

                    {/* Approved Proposals & Share */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-emerald-800 text-xs">
                            {approvedCount} approved
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {volumeShare}% share
                          </span>
                        </div>
                        {approvedCount < 10 && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Low Adoption
                          </span>
                        )}
                      </div>

                      {/* Clean single emerald progress bar */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        {volumeShare > 0 && (
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${Math.min(volumeShare, 100)}%` }}
                            title={`${approvedCount} approved (${volumeShare}% of approved portfolio)`}
                          />
                        )}
                      </div>
                    </td>

                    {/* Committed Budget */}
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      <div className="font-black text-slate-900 text-xs">
                        US${formatCurrency(budget)}
                      </div>
                    </td>

                    {/* Target Impact & Estimated Cost per Person */}
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      {objApprovedTarget > 0 ? (
                        <div>
                          <div className="font-black text-blue-900 text-xs flex items-baseline justify-end gap-1">
                            <span>{formatMetricCount(objApprovedTarget)}</span>
                            <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[95px]" title={displayUnit}>
                              {displayUnit}
                            </span>
                          </div>
                          {objCostApproved !== null && (
                            <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                              ~US${objCostApproved < 0.1 ? objCostApproved.toFixed(3) : objCostApproved < 10 ? objCostApproved.toFixed(2) : objCostApproved.toFixed(1)} / person
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isOverCap
                            ? 'bg-rose-100 text-rose-800'
                            : approvedCount < 10 && approvedCount > 0
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : ratio > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isOverCap
                          ? 'Over Cap'
                          : approvedCount < 10 && approvedCount > 0
                          ? 'Low Adoption'
                          : ratio > 0
                          ? 'Active Target'
                          : 'Unallocated'}
                      </span>
                    </td>

                    {/* Inspect Button */}
                    <td className="py-3.5 px-4 text-right">
                      {approvedCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDrilldownKpi(kpi)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#1c398e] hover:text-white text-slate-700 text-[11px] font-bold transition cursor-pointer"
                        >
                          <span>View ({approvedCount})</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Union Remaining Funds Financial Matrix */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>
                {isScopedToSingleUnion
                  ? `${UNION_ACRONYMS[effectiveUnionScope] || effectiveUnionScope} Fund & Balances`
                  : isProposalMaker && !isContextSnapshotMode && hasValidUserUnion
                  ? `${UNION_ACRONYMS[userUnion] || userUnion} Fund & Balances`
                  : 'Union Fund & Balances'}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {isScopedToSingleUnion
                ? `Allocated funding ceiling, committed proposal budgets, and remaining balance for ${effectiveUnionScope}`
                : isProposalMaker && !isContextSnapshotMode && hasValidUserUnion
                ? `Allocated funding ceiling, committed proposal budgets, and remaining balance for ${userUnion}`
                : 'Allocated funding ceiling, committed proposal budgets, and remaining balances per territory'}
            </p>
          </div>

          {/* Quick Filters & View Mode */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search unions or acronyms..."
                value={unionSearch}
                onChange={(e) => setUnionSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            {/* Category filter */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setUnionFilterCategory('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unionFilterCategory === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setUnionFilterCategory('Union Conferences')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unionFilterCategory === 'Union Conferences'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600'
                }`}
              >
                Conferences
              </button>
              <button
                type="button"
                onClick={() => setUnionFilterCategory('Union Missions')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unionFilterCategory === 'Union Missions'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600'
                }`}
              >
                Missions
              </button>
              <button
                type="button"
                onClick={() => setUnionFilterCategory('frontier_ratio')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unionFilterCategory === 'frontier_ratio'
                    ? 'bg-white text-indigo-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-indigo-800'
                }`}
                title="Filter territories where 1 Adventist faces >1,000 population (SEUM, CIUM, MyUM, WiUM)"
              >
                Frontier (&gt;1:1k Ratio)
              </button>
              <button
                type="button"
                onClick={() => setUnionFilterCategory('over_budget')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  unionFilterCategory === 'over_budget'
                    ? 'bg-white text-rose-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                Over Budget
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl text-xs font-semibold ml-auto">
              <button
                type="button"
                onClick={() => setMatrixViewMode('combined')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  matrixViewMode === 'combined'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Unified Combined Pool with original baseline breakdown"
              >
                Combined Pool View
              </button>
              <button
                type="button"
                onClick={() => setMatrixViewMode('expanded')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  matrixViewMode === 'expanded'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Expanded multi-column breakdown"
              >
                Detailed Columns
              </button>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-[#f8fafc] text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
              {matrixViewMode === 'combined' ? (
                <tr>
                  <th className="py-3 px-4">Union Territory</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Projects</th>
                  <th className="py-3 px-4 text-right">
                    <div>Total Union Budget Pool</div>
                    <div className="text-[9px] text-slate-400 font-medium normal-case tracking-normal">
                      GC/SSD + Union Pledge
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Committed (Approved)</th>
                  <th className="py-3 px-4 text-right">Remaining Funds</th>
                  <th className="py-3 px-4 text-center">Utilization</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-3 px-4">Union Territory</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Projects</th>
                  <th className="py-3 px-4 text-right">GC/SSD Allocation</th>
                  <th className="py-3 px-4 text-right">Union Pledge</th>
                  <th className="py-3 px-4 text-right">Combined Pool</th>
                  <th className="py-3 px-4 text-right">Committed (Approved)</th>
                  <th className="py-3 px-4 text-right">Remaining Funds</th>
                  <th className="py-3 px-4 text-center">Utilization</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUnionMatrix.length === 0 ? (
                <tr>
                  <td colSpan={matrixViewMode === 'combined' ? 8 : 10} className="py-8 text-center text-slate-400 text-xs">
                    No unions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUnionMatrix.map((item) => {
                  const isNegative = item.remaining < 0;
                  return (
                    <tr
                      key={item.unionName}
                      className={`hover:bg-slate-50/80 transition ${
                        isNegative ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.acronym && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-black border border-slate-200">
                              {item.acronym}
                            </span>
                          )}
                          <span className="font-bold text-slate-900 truncate">
                            {item.unionName}
                          </span>
                          {item.requiresPlay7 && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[9px] font-bold"
                              title="Playbook Play 7 Sensitive Context — requires discrete contact routing"
                            >
                              Play 7 Sensitive
                            </span>
                          )}
                        </div>
                        {item.churches > 0 && (
                          <div className="text-[10px] text-slate-400 tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{item.churches.toLocaleString()} churches</span>
                            <span>•</span>
                            <span>{(item.membership / 1000).toFixed(1)}K members</span>
                            <span>•</span>
                            <span
                              className={
                                item.memberToPopRatio >= 1000
                                  ? 'text-indigo-700 font-bold'
                                  : 'text-slate-500 font-semibold'
                              }
                            >
                              1:{item.memberToPopRatio.toLocaleString()} ratio
                            </span>
                            <span>•</span>
                            <span>{item.onlinePct}% online</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {item.category}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-800">{item.approvedCount} approved</span>
                      </td>

                      {matrixViewMode === 'combined' ? (
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-black text-slate-900 text-sm tabular-nums">
                            {item.totalPool > 0
                              ? `US$ ${formatCurrency(item.totalPool)}`
                              : 'US$ 0.00'}
                          </div>
                          <div className="text-[10px] text-slate-500 tabular-nums mt-0.5 flex items-center justify-end gap-1.5 flex-wrap">
                            <span>GC/SSD: <strong className="text-slate-700">US$ {formatCurrency(item.allocated)}</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>Union Pledge: <strong className="text-emerald-700">US$ {formatCurrency(item.matching)}</strong></span>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-right font-medium text-slate-700 tabular-nums">
                            {item.allocated > 0
                              ? `US$ ${formatCurrency(item.allocated)}`
                              : 'US$ 0.00'}
                          </td>

                          <td className="py-3 px-4 text-right font-medium text-emerald-700 tabular-nums">
                            {item.matching > 0
                              ? `US$ ${formatCurrency(item.matching)}`
                              : 'US$ 0.00'}
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                            {item.totalPool > 0
                              ? `US$ ${formatCurrency(item.totalPool)}`
                              : 'US$ 0.00'}
                          </td>
                        </>
                      )}

                      <td className="py-3 px-4 text-right tabular-nums">
                        <div className="font-bold text-blue-900">
                          US$ {formatCurrency(item.committed)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-black tabular-nums">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg ${
                            isNegative
                              ? 'bg-rose-100 text-rose-800 font-extrabold'
                              : item.remaining === 0
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {isNegative
                            ? `-US$ ${formatCurrency(Math.abs(item.remaining))}`
                            : `US$ ${formatCurrency(item.remaining)}`}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="w-24 mx-auto space-y-1">
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isNegative
                                  ? 'bg-rose-500'
                                  : item.utilization > 80
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, item.utilization)}%` }}
                            ></div>
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 tabular-nums">
                            {item.utilization}%
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {item.projectCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDrilldownUnion(item.unionName)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                          >
                            Inspect
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Strategic Caps Configuration Modal (Division Super Admin only) */}
      <StrategicCapsModal
        isOpen={isCapsEditorOpen && isSuperAdmin}
        onClose={() => setIsCapsEditorOpen(false)}
        tempPillarCaps={tempPillarCaps}
        onUpdatePillarCap={(pillarId, val) =>
          setTempPillarCaps((prev) => ({ ...prev, [pillarId]: val }))
        }
        onResetCaps={handleResetCaps}
        onSaveCaps={handleSaveCaps}
        isSaving={isSavingCaps}
        saveSuccess={capsSaveSuccess}
        tempPillarsSum={tempPillarsSum}
      />

      {/* 8 & 9. Drilldown Modals for Inspecting Union & KPI Projects */}
      <DrilldownModals
        activeUnion={activeDrilldownUnionObj}
        onCloseUnion={() => setSelectedDrilldownUnion(null)}
        selectedKpi={selectedDrilldownKpi}
        kpiData={activeDrilldownKpiData}
        onCloseKpi={() => setSelectedDrilldownKpi(null)}
        onSelectProposal={onSelectProposal}
        canOpenProposal={canOpenProposal}
      />
    </div>
  );
}
