import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Download,
  FileText,
  ChevronRight,
  Plus,
  ShieldCheck,
  ArrowRightLeft,
  ArrowRight,
  ArrowDown,
  Filter,
  X,
  Building2,
  Flag,
  HelpCircle,
} from 'lucide-react';
import {
  Proposal,
  UserAccount,
  UNIONS,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getUserAllUnions,
  getUserVotingUnions,
  getUserInviteeUnions,
  getCanonicalDivisionProject,
  isKpiAlignedWithObjective,
  PillarFilterKey,
  getProposalPillarKey,
  getProposalPillarShortLabel,
} from '../types';
import { fetchBudgetAllocationDetails } from '../services/proposalService';
import { validateProposalForSubmission } from '../utils/validation';
import { formatCurrency } from '../utils/userUtils';
import { ReviewMetricsOverview } from './review/ReviewMetricsOverview';
import { ReviewFastFilters } from './review/ReviewFastFilters';
import { ReviewPortfolioBriefing, CoachingFilterCategory } from './review/ReviewPortfolioBriefing';
import { parseKpiTargetNumber } from '../utils/kpiExtraction';
import { getAllProposalSmartAdvisories } from '../utils/proposalSmartAdvisor';
import {
  buildProposalSearchHaystack,
  matchesProposalSearch,
  getProposalContactDisplay,
  ProposalContactDisplay,
} from '../utils/proposalSearch';
import { TransferOwnershipModal } from './admin/TransferOwnershipModal';
import {
  evaluateProposalImpactPlausibility,
  ProposalPlausibilityEvaluation,
} from '../utils/impactPlausibilityEngine';

function getProposalBudget(p: Proposal): number {
  return (p.budgetItems || []).reduce(
    (sum, item) =>
      sum + (Number(item.divisionFunding ?? item.gcFunding) || 0) + (Number(item.localFunding) || 0),
    0
  );
}

interface ReviewHubProps {
  proposals: Proposal[];
  currentUser: UserAccount;
  initialUnionFilter?: string;
  onUnionFilterChange?: (union: string) => void;
  onUpdateProposal: (proposalId: string, updates: Partial<Proposal>) => Promise<void> | void;
  onOpenInEditor: (
    proposalId: string,
    options?: {
      focus?: 'notes' | 'flags' | 'financials' | 'kpis';
      navigableIds?: string[];
    }
  ) => void;
  onOpenPrint: (proposal: Proposal) => void;
  onOpenAdminSettings?: () => void;
  onOpenDashboard?: () => void;
  onNewProposal?: () => void;
}

export function ReviewHub({
  proposals,
  currentUser,
  initialUnionFilter,
  onUnionFilterChange,
  onUpdateProposal,
  onOpenInEditor,
  onOpenPrint: _onOpenPrint,
  onOpenAdminSettings: _onOpenAdminSettings,
  onOpenDashboard: _onOpenDashboard,
  onNewProposal,
}: ReviewHubProps) {
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isLiaison = currentUser.role === 'division_liaison';
  const liaisonUnions = useMemo(() => getUserAllUnions(currentUser), [currentUser]);
  const liaisonVotingUnions = useMemo(() => getUserVotingUnions(currentUser), [currentUser]);
  const liaisonInviteeUnions = useMemo(() => getUserInviteeUnions(currentUser), [currentUser]);

  // Initial union filter computation strictly honoring role boundaries
  const resolvedInitialUnion = useMemo(() => {
    if (isSuperAdmin) {
      return initialUnionFilter || 'all';
    }
    if (isLiaison) {
      if (
        initialUnionFilter &&
        (initialUnionFilter === 'all' ||
          liaisonUnions.map(getCanonicalUnion).includes(getCanonicalUnion(initialUnionFilter)))
      ) {
        return initialUnionFilter;
      }
      return liaisonUnions.length === 1 ? liaisonUnions[0] : 'all';
    }
    // Union Coordinator, Union Treasurer, or any union-scoped role: strictly their union territory
    return currentUser.union || 'all';
  }, [isSuperAdmin, isLiaison, initialUnionFilter, currentUser.union, liaisonUnions]);

  // Filters state
  const [selectedUnion, setSelectedUnion] = useState<string>(resolvedInitialUnion);
  const [selectedPillar, setSelectedPillar] = useState<PillarFilterKey>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<
    'budget_desc' | 'budget_asc' | 'date_desc' | 'title_asc' | 'completion_desc' | 'completion_asc'
  >('date_desc');

  const handleUnionChange = (newUnion: string) => {
    setSelectedUnion(newUnion);
    onUnionFilterChange?.(newUnion);
  };

  // Track previous initialUnionFilter prop so we ONLY sync when the external prop actually changes
  const prevInitialUnionFilterRef = useRef(initialUnionFilter);

  useEffect(() => {
    // Only respond if the parent specifically changed initialUnionFilter (e.g. navigation from Monitor or Dashboard)
    if (initialUnionFilter !== prevInitialUnionFilterRef.current) {
      prevInitialUnionFilterRef.current = initialUnionFilter;

      if (isSuperAdmin) {
        if (initialUnionFilter) {
          setSelectedUnion(initialUnionFilter);
        }
        return;
      }

      if (isLiaison) {
        if (
          initialUnionFilter &&
          (initialUnionFilter === 'all' ||
            liaisonUnions.map(getCanonicalUnion).includes(getCanonicalUnion(initialUnionFilter)))
        ) {
          setSelectedUnion(initialUnionFilter);
          return;
        }
      }
    }

    // Role boundary guard for single-union users (authors, coordinators, treasurers)
    if (!isSuperAdmin && !isLiaison) {
      const target = currentUser.union || 'all';
      if (selectedUnion !== target) {
        setSelectedUnion(target);
      }
    }
  }, [initialUnionFilter, isSuperAdmin, isLiaison, currentUser.union, liaisonUnions, selectedUnion]);

  // Coaching & Alignment Filter state (from Executive Portfolio Briefing)
  const [coachingFilter, setCoachingFilter] = useState<CoachingFilterCategory>('all');
  const [coachingMatchingIds, setCoachingMatchingIds] = useState<Set<string>>(new Set());
  const [coachingFilterLabel, setCoachingFilterLabel] = useState<string>('');
  const [impactLensFilter, setImpactLensFilter] = useState<
    'all' | 'verify_plausibility' | 'upg_focus' | 'no_group_e'
  >('all');

  // Table anchor, viewport visibility & scroll-arrival highlight state
  const proposalsTableRef = useRef<HTMLDivElement | null>(null);
  const [isTableInView, setIsTableInView] = useState<boolean>(true);
  const [isTableHighlighted, setIsTableHighlighted] = useState<boolean>(false);
  const highlightTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const el = proposalsTableRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTableInView(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.05,
        rootMargin: '0px 0px -60px 0px',
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const scrollToProposalsTable = () => {
    proposalsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setIsTableHighlighted(true);
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setIsTableHighlighted(false);
    }, 1800);
  };

  // Reset coaching sub-filter when primary scope filters change
  useEffect(() => {
    setCoachingFilter('all');
    setCoachingMatchingIds(new Set());
    setCoachingFilterLabel('');
    setImpactLensFilter('all');
  }, [selectedUnion, selectedPillar, statusFilter]);

  // Transfer ownership modal state
  const [proposalToTransfer, setProposalToTransfer] = useState<Proposal | null>(null);

  // Union budget allocations & matching pledges
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [matchingPledges, setMatchingPledges] = useState<Record<string, number>>({});

  // Debounce search input to avoid lagging UI on rapid keystrokes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;
    async function loadAllocations() {
      try {
        const { allocations: fetchedAlloc, matchingPledges: fetchedMatch } =
          await fetchBudgetAllocationDetails();
        if (isMounted) {
          setAllocations(fetchedAlloc);
          setMatchingPledges(fetchedMatch);
        }
      } catch (e) {
        console.error('Failed to load budget allocation details in Hub:', e);
      }
    }
    loadAllocations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Pre-compute expensive validation, budget, canonical union/project, and KPI target metrics once per proposals update
  const proposalMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        budget: number;
        validation: ReturnType<typeof validateProposalForSubmission>;
        completionPct: number;
        canonicalUnion: string;
        canonicalUnionLower: string;
        unionAcronym: string;
        unionAcronymLower: string;
        canonicalProj: string;
        pillarKey: Exclude<PillarFilterKey, 'all'> | '';
        pillarShortLabel: string;
        isMisaligned: boolean;
        alignmentFlagCount: number;
        alignmentTooltip: string;
        primaryFlagTab: 'financials' | 'narrative' | 'kpis';
        parsedTarget: ReturnType<typeof parseKpiTargetNumber>;
        plausibility: ProposalPlausibilityEvaluation;
        searchHaystack: string;
        contactDisplay: ProposalContactDisplay;
      }
    >();

    for (const p of proposals) {
      const budget = getProposalBudget(p);
      const validation = validateProposalForSubmission(p);
      const canonicalUnion = getCanonicalUnion(p.union);
      const unionAcronym = UNION_ACRONYMS[canonicalUnion] || UNION_ACRONYMS[p.union] || 'SSD';
      const canonicalProj = getCanonicalDivisionProject(p.divisionProject);
      const pillarKey = getProposalPillarKey(p);
      const pillarShortLabel = getProposalPillarShortLabel(p);
      const isMisaligned = Boolean(
        (canonicalProj || p.divisionProject) &&
          p.kpiType &&
          !isKpiAlignedWithObjective(canonicalProj || p.divisionProject, p.kpiType)
      );
      const advisories = getAllProposalSmartAdvisories(p);
      const flagItems: { title: string; tab: 'financials' | 'narrative' | 'kpis' }[] = [];

      if (isMisaligned) {
        flagItems.push({
          title: `Strategic Misalignment: Primary KPI does not match ${canonicalProj || p.divisionProject}`,
          tab: 'kpis',
        });
      }

      for (const adv of advisories) {
        if (isMisaligned && adv.id.startsWith('kpi_misaligned')) continue;
        const tab: 'financials' | 'narrative' | 'kpis' =
          adv.sectionId === 'section-budget'
            ? 'financials'
            : adv.sectionId === 'section-kpi' || adv.sectionId === 'section-audience'
            ? 'kpis'
            : 'narrative';
        flagItems.push({ title: adv.title, tab });
      }

      const alignmentFlagCount = flagItems.length;
      const alignmentTooltip = flagItems.map((f, idx) => `${idx + 1}. ${f.title}`).join('\n');
      const primaryFlagTab = flagItems[0]?.tab || 'narrative';
      const parsedTarget = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);
      const plausibility = evaluateProposalImpactPlausibility(p);
      const searchHaystack = buildProposalSearchHaystack(p);
      const contactDisplay = getProposalContactDisplay(p);

      map.set(p.id, {
        budget,
        validation,
        completionPct: validation.completionPercentage,
        canonicalUnion,
        canonicalUnionLower: canonicalUnion.toLowerCase(),
        unionAcronym,
        unionAcronymLower: unionAcronym.toLowerCase(),
        canonicalProj,
        pillarKey,
        pillarShortLabel,
        isMisaligned,
        alignmentFlagCount,
        alignmentTooltip,
        primaryFlagTab,
        parsedTarget,
        plausibility,
        searchHaystack,
        contactDisplay,
      });
    }
    return map;
  }, [proposals]);

  // Pre-compute total proposal counts per canonical union for compact code dropdown
  const unionCountsMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of proposals) {
      const meta = proposalMetaMap.get(p.id);
      const canon = meta ? meta.canonicalUnion : getCanonicalUnion(p.union);
      if (!canon) continue;
      counts.set(canon, (counts.get(canon) || 0) + 1);
    }
    return counts;
  }, [proposals, proposalMetaMap]);

  // Filtered and sorted proposals list
  const filteredProposals = useMemo(() => {
    const allowedUnions = !isSuperAdmin ? getUserAllUnions(currentUser).map(getCanonicalUnion) : [];
    const selectedCanonicalUnion = selectedUnion !== 'all' ? getCanonicalUnion(selectedUnion) : '';
    const q = debouncedSearch.trim();

    return proposals
      .filter((p) => {
        const meta = proposalMetaMap.get(p.id);
        const canonicalProposalUnion = meta ? meta.canonicalUnion : getCanonicalUnion(p.union);

        // 1. Union boundary check
        if (!isSuperAdmin) {
          if (!allowedUnions.includes(canonicalProposalUnion)) return false;
          if (selectedUnion !== 'all' && canonicalProposalUnion !== selectedCanonicalUnion) return false;
        } else if (selectedUnion !== 'all') {
          if (canonicalProposalUnion !== selectedCanonicalUnion) return false;
        }

        // 2. Strategic Pillar filter
        if (selectedPillar !== 'all') {
          const pKey = meta ? meta.pillarKey : getProposalPillarKey(p);
          if (pKey !== selectedPillar) return false;
        }

        // 3. Status filter
        if (statusFilter !== 'all' && (p.status || 'draft') !== statusFilter) {
          return false;
        }

        // 4. Unified search query filter (Title, POC, Project/Division Lead, Submitter, Liaison, Union code, Pillar, Action #)
        if (
          q &&
          !matchesProposalSearch(p, q, meta?.searchHaystack, canonicalProposalUnion)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const metaA = proposalMetaMap.get(a.id);
        const metaB = proposalMetaMap.get(b.id);
        const budgetA = metaA ? metaA.budget : getProposalBudget(a);
        const budgetB = metaB ? metaB.budget : getProposalBudget(b);

        if (sortBy === 'completion_desc') {
          const valA = metaA ? metaA.completionPct : validateProposalForSubmission(a).completionPercentage;
          const valB = metaB ? metaB.completionPct : validateProposalForSubmission(b).completionPercentage;
          return valB - valA;
        }
        if (sortBy === 'completion_asc') {
          const valA = metaA ? metaA.completionPct : validateProposalForSubmission(a).completionPercentage;
          const valB = metaB ? metaB.completionPct : validateProposalForSubmission(b).completionPercentage;
          return valA - valB;
        }
        if (sortBy === 'budget_desc') return budgetB - budgetA;
        if (sortBy === 'budget_asc') return budgetA - budgetB;
        if (sortBy === 'title_asc') return (a.title || '').localeCompare(b.title || '');
        // date_desc
        return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
      });
  }, [proposals, proposalMetaMap, isSuperAdmin, currentUser, selectedUnion, selectedPillar, statusFilter, debouncedSearch, sortBy]);

  // Aggregate metrics across active scope
  const {
    totalRequested,
    totalApproved,
    totalUnderReview,
    totalSubmitted,
    totalDrafts,
    activeUnionCap,
    divisionPortion,
    matchingPortion,
  } = useMemo(() => {
    let req = 0;
    let app = 0;
    let rev = 0;
    let sub = 0;
    let dft = 0;

    filteredProposals.forEach((p) => {
      const sum = getProposalBudget(p);
      const status = p.status || 'draft';
      if (status === 'approved') {
        app += sum;
        req += sum;
      } else if (status === 'under_review') {
        rev += sum;
        req += sum;
      } else if (status === 'submitted') {
        sub += sum;
        req += sum;
      } else {
        dft += sum;
        // Drafts are strictly excluded from committed budget and cap deductions
      }
    });

    let cap = 0;
    let divisionPortion = 0;
    let matchingPortion = 0;
    if (selectedUnion !== 'all') {
      const canonicalScopeUnion = getCanonicalUnion(selectedUnion);
      divisionPortion = Number(allocations[canonicalScopeUnion] ?? allocations[selectedUnion]) || 0;
      matchingPortion = Number(matchingPledges[canonicalScopeUnion] ?? matchingPledges[selectedUnion]) || 0;
      cap = divisionPortion + matchingPortion;
    } else if (isLiaison) {
      divisionPortion = liaisonUnions.reduce((sum: number, u: string) => sum + (Number(allocations[u]) || 0), 0);
      matchingPortion = liaisonUnions.reduce((sum: number, u: string) => sum + (Number(matchingPledges[u]) || 0), 0);
      cap = divisionPortion + matchingPortion;
    } else if (!isSuperAdmin) {
      // Non-super-admin fallback: strictly evaluate against user's union territory
      const canonicalScopeUnion = getCanonicalUnion(currentUser.union);
      divisionPortion = Number(allocations[canonicalScopeUnion] ?? allocations[currentUser.union]) || 0;
      matchingPortion = Number(matchingPledges[canonicalScopeUnion] ?? matchingPledges[currentUser.union]) || 0;
      cap = divisionPortion + matchingPortion;
    } else {
      divisionPortion = UNIONS.reduce((sum, u) => sum + (Number(allocations[u]) || 0), 0);
      matchingPortion = UNIONS.reduce((sum, u) => sum + (Number(matchingPledges[u]) || 0), 0);
      cap = divisionPortion + matchingPortion;
    }

    return {
      totalRequested: req,
      totalApproved: app,
      totalUnderReview: rev,
      totalSubmitted: sub,
      totalDrafts: dft,
      activeUnionCap: cap,
      divisionPortion,
      matchingPortion,
    };
  }, [filteredProposals, selectedUnion, allocations, matchingPledges, isLiaison, liaisonUnions, isSuperAdmin, currentUser.union]);

  const totalPipeline = totalUnderReview + totalSubmitted;
  const hasAllocatedCap = activeUnionCap > 0;
  // Official remaining balance evaluated against approved proposals
  const remainingCap = hasAllocatedCap ? activeUnionCap - totalApproved : 0;
  // Projected remaining balance if incoming pipeline proposals are approved
  const projectedRemainingCap = hasAllocatedCap ? activeUnionCap - (totalApproved + totalPipeline) : 0;
  const capUtilizationPct = hasAllocatedCap ? (totalApproved / activeUnionCap) * 100 : 0;
  const isExceedingCap = hasAllocatedCap && totalApproved > activeUnionCap;

  // Quick stats by status (respecting active Union and Pillar filters)
  const statusCounts = useMemo(() => {
    const counts = { all: 0, submitted: 0, under_review: 0, approved: 0, draft: 0 };
    proposals.forEach((p) => {
      const meta = proposalMetaMap.get(p.id);
      const canonicalProposalUnion = meta ? meta.canonicalUnion : getCanonicalUnion(p.union);
      if (!isSuperAdmin) {
        const allowedUnions = getUserAllUnions(currentUser);
        if (!allowedUnions.includes(canonicalProposalUnion)) return;
      }
      if (selectedPillar !== 'all') {
        const pKey = meta ? meta.pillarKey : getProposalPillarKey(p);
        if (pKey !== selectedPillar) return;
      }
      if (selectedUnion === 'all' || canonicalProposalUnion === getCanonicalUnion(selectedUnion)) {
        counts.all += 1;
        const st = (p.status || 'draft') as keyof typeof counts;
        if (counts[st] !== undefined) counts[st] += 1;
      }
    });
    return counts;
  }, [proposals, proposalMetaMap, selectedUnion, selectedPillar, isSuperAdmin, currentUser]);

  // Export proposals to CSV
  const downloadCsvForProposals = (list: Proposal[], filenameSuffix: string) => {
    if (list.length === 0) return;

    const headers = [
      'Union',
      'Proposal Title',
      'Author / Lead',
      'Email',
      'Strategic Pillar',
      'Global Objective',
      'Total Requested ($)',
      'Completion %',
      'Status',
      'Last Updated',
    ];

    const rows = list.map((p) => {
      const budget = getProposalBudget(p);
      const validation = validateProposalForSubmission(p);
      return [
        `"${p.union || ''}"`,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        `"${p.userName || p.pointOfContact?.name || ''}"`,
        `"${p.userEmail || p.pointOfContact?.email || ''}"`,
        `"${p.strategicFocus || ''}"`,
        `"${p.divisionProject || ''}"`,
        budget,
        `"${validation.completionPercentage}%"`,
        `"${p.status || 'draft'}"`,
        `"${new Date(p.updatedAt || p.createdAt).toLocaleDateString()}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `OneVoice27_Proposals_${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const impactLensCounts = useMemo(() => {
    let verifyCount = 0;
    let upgCount = 0;
    let noGroupECount = 0;
    for (const p of filteredProposals) {
      const pl =
        proposalMetaMap.get(p.id)?.plausibility ||
        evaluateProposalImpactPlausibility(p);
      if (pl.verdict !== 'plausible') verifyCount += 1;
      if (pl.upgTier === 'named_upg' || pl.upgTier === 'group_e_general') {
        upgCount += 1;
      } else {
        noGroupECount += 1;
      }
    }
    return { verifyCount, upgCount, noGroupECount };
  }, [filteredProposals, proposalMetaMap]);

  const displayedProposals = useMemo(() => {
    let list =
      coachingFilter === 'all'
        ? filteredProposals
        : filteredProposals.filter((p) => coachingMatchingIds.has(p.id));

    if (impactLensFilter !== 'all') {
      list = list.filter((p) => {
        const pl =
          proposalMetaMap.get(p.id)?.plausibility ||
          evaluateProposalImpactPlausibility(p);
        if (impactLensFilter === 'verify_plausibility') {
          return pl.verdict !== 'plausible';
        }
        if (impactLensFilter === 'upg_focus') {
          return pl.upgTier === 'named_upg' || pl.upgTier === 'group_e_general';
        }
        if (impactLensFilter === 'no_group_e') {
          return pl.upgTier !== 'named_upg' && pl.upgTier !== 'group_e_general';
        }
        return true;
      });
    }

    return list;
  }, [filteredProposals, coachingFilter, coachingMatchingIds, impactLensFilter, proposalMetaMap]);

  const navigableIds = useMemo(
    () => displayedProposals.map((p) => p.id),
    [displayedProposals]
  );

  const handleOpenProposal = (
    proposalId: string,
    focus?: 'notes' | 'flags' | 'financials' | 'kpis'
  ) => {
    onOpenInEditor(proposalId, { focus, navigableIds });
  };

  const handleExportCsv = () => {
    downloadCsvForProposals(
      displayedProposals,
      selectedUnion === 'all' ? 'All_Unions' : UNION_ACRONYMS[selectedUnion] || selectedUnion
    );
  };

  const hasActiveFilters =
    statusFilter !== 'all' ||
    selectedPillar !== 'all' ||
    coachingFilter !== 'all' ||
    impactLensFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setStatusFilter('all');
    setSelectedPillar('all');
    setCoachingFilter('all');
    setCoachingMatchingIds(new Set());
    setCoachingFilterLabel('');
    setImpactLensFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="flex-1 max-w-[1536px] w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5 animate-in fade-in duration-200">
      {/* Compact Top Hub Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Review Hub
          </h1>
          <span
            className="text-slate-400 hover:text-slate-600 cursor-help inline-flex items-center"
            title={
              selectedUnion !== 'all'
                ? `${selectedUnion} territory review, Playbook alignment coaching, and budget allocations.`
                : 'Track, review, and verify proposal approvals and budget allocations across all territories.'
            }
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Top Actions + Compact Code Union Scope Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin ? (
            <div
              className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs"
              title={selectedUnion === 'all' ? 'All Unions (Division Total)' : selectedUnion}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedUnion === 'all' ? 'all' : (getCanonicalUnion(selectedUnion) || selectedUnion)}
                onChange={(e) => handleUnionChange(e.target.value)}
                aria-label="Filter by Union code"
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer tabular-nums"
              >
                <option value="all">All Unions ({proposals.length})</option>
                {UNIONS.map((u) => {
                  const count = unionCountsMap.get(getCanonicalUnion(u)) || 0;
                  return (
                    <option key={u} value={u}>
                      {UNION_ACRONYMS[u] || u} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : isLiaison && liaisonUnions.length > 1 ? (
            <div
              className="flex items-center gap-1.5 bg-indigo-50/80 border border-indigo-200 rounded-xl px-2.5 py-1.5 text-xs"
              title={selectedUnion === 'all' ? `All Assigned Unions (${liaisonUnions.length})` : selectedUnion}
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <select
                value={selectedUnion === 'all' ? 'all' : (getCanonicalUnion(selectedUnion) || selectedUnion)}
                onChange={(e) => handleUnionChange(e.target.value)}
                aria-label="Filter by assigned Union code"
                className="bg-transparent border-none text-xs font-bold text-indigo-950 focus:outline-none cursor-pointer tabular-nums"
              >
                <option value="all">
                  All Assigned (
                  {liaisonUnions.reduce(
                    (sum: number, u: string) => sum + (unionCountsMap.get(getCanonicalUnion(u)) || 0),
                    0
                  )}
                  )
                </option>
                {liaisonVotingUnions.length > 0 && liaisonInviteeUnions.length > 0 ? (
                  <>
                    <optgroup label="Voting Unions (Step 4 Vote)">
                      {liaisonVotingUnions.map((u: string) => {
                        const count = unionCountsMap.get(getCanonicalUnion(u)) || 0;
                        return (
                          <option key={u} value={u}>
                            {UNION_ACRONYMS[u] || u} · Voting ({count})
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="Invitee Unions (View & Comment)">
                      {liaisonInviteeUnions.map((u: string) => {
                        const count = unionCountsMap.get(getCanonicalUnion(u)) || 0;
                        return (
                          <option key={u} value={u}>
                            {UNION_ACRONYMS[u] || u} · Invitee ({count})
                          </option>
                        );
                      })}
                    </optgroup>
                  </>
                ) : (
                  liaisonUnions.map((u: string) => {
                    const count = unionCountsMap.get(getCanonicalUnion(u)) || 0;
                    const suffix = liaisonVotingUnions.includes(u) ? '' : ' · Invitee';
                    return (
                      <option key={u} value={u}>
                        {UNION_ACRONYMS[u] || u}
                        {suffix} ({count})
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          ) : isLiaison && liaisonUnions.length === 1 ? (
            <span className="text-xs font-semibold text-indigo-900 px-2" title={liaisonUnions[0]}>
              {UNION_ACRONYMS[liaisonUnions[0]] || liaisonUnions[0]}
              {liaisonVotingUnions.includes(liaisonUnions[0]) ? ' · Voting' : ' · Invitee'}
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-600 px-2" title={currentUser.union}>
              {(currentUser.union && UNION_ACRONYMS[currentUser.union]) || currentUser.union || 'Union'}
            </span>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredProposals.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
            title="Download CSV spreadsheet of current proposals"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          {!isLiaison && onNewProposal && (
            <button
              type="button"
              onClick={onNewProposal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-semibold text-xs transition cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial & Compliance Overview Cards (Modular Subcomponent) */}
      <ReviewMetricsOverview
        totalRequested={totalRequested}
        filteredCount={filteredProposals.length}
        selectedUnion={selectedUnion}
        activeUnionCap={activeUnionCap}
        divisionPortion={divisionPortion}
        matchingPortion={matchingPortion}
        capUtilizationPct={capUtilizationPct}
        isExceedingCap={isExceedingCap}
        hasAllocatedCap={hasAllocatedCap}
        remainingCap={remainingCap}
        statusCounts={statusCounts}
        totalApproved={totalApproved}
        totalPipeline={totalPipeline}
        projectedRemainingCap={projectedRemainingCap}
      />

      {/* Executive Portfolio Summary & Alignment Advisor (Zero-Credit Live Engine) */}
      <ReviewPortfolioBriefing
        proposals={filteredProposals}
        selectedUnion={selectedUnion}
        activeCoachingFilter={coachingFilter}
        activeCoachingLabel={coachingFilterLabel}
        activeMatchingIds={coachingMatchingIds}
        onSelectCoachingFilter={(category, matchingIds, label, options) => {
          setCoachingFilter(category);
          setCoachingMatchingIds(matchingIds);
          setCoachingFilterLabel(label);
          if (options?.scrollToTable && category !== 'all') {
            window.requestAnimationFrame(() => {
              scrollToProposalsTable();
            });
          }
        }}
        onJumpToTable={scrollToProposalsTable}
        onInspectProposal={(proposalId, initialTab) => {
          const mappedFocus =
            initialTab === 'narrative'
              ? 'flags'
              : initialTab === 'financials' || initialTab === 'kpis' || initialTab === 'notes'
              ? initialTab
              : undefined;
          handleOpenProposal(proposalId, mappedFocus);
        }}
      />

      {/* Fast Filter Bar (Modular Subcomponent) */}
      <ReviewFastFilters
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusCounts={statusCounts}
        selectedUnion={selectedUnion}
        onUnionChange={handleUnionChange}
        selectedPillar={selectedPillar}
        onPillarChange={setSelectedPillar}
        isSuperAdmin={isSuperAdmin}
        userUnion={currentUser.union}
        isLiaison={isLiaison}
        userAssignedUnions={liaisonUnions}
        sortBy={sortBy}
        onSortChange={setSortBy}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Master Proposals Table with Batch Selection */}
      <div
        ref={proposalsTableRef}
        className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 scroll-mt-20 ${
          isTableHighlighted
            ? 'border-[#1c398e] ring-2 ring-[#1c398e]/30 shadow-md'
            : 'border-slate-200 shadow-2xs'
        }`}
      >
        <div
          className={`px-5 py-2.5 border-b flex items-center justify-between flex-wrap gap-2 transition-colors duration-300 ${
            isTableHighlighted
              ? 'bg-blue-50/90 border-blue-200'
              : 'bg-slate-50/80 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Proposals
            </h2>
            <span className="text-xs font-semibold text-slate-500 tabular-nums">
              · {displayedProposals.length} {displayedProposals.length === 1 ? 'item' : 'items'}
            </span>
            {coachingFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#1c398e] text-white shadow-2xs">
                <span>Filter: {coachingFilterLabel || coachingFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCoachingFilter('all');
                    setCoachingMatchingIds(new Set());
                    setCoachingFilterLabel('');
                  }}
                  className="ml-1 px-1.5 py-0.2 rounded bg-white/20 hover:bg-white/30 text-[10px] font-extrabold transition cursor-pointer"
                >
                  Clear
                </button>
              </span>
            )}
          </div>

          {/* 1-Click Plausibility & UPG Triage Filter Chips */}
          {filteredProposals.length > 0 && (
            <div className="inline-flex items-center gap-1 flex-wrap text-[11px] font-semibold">
              <button
                type="button"
                onClick={() =>
                  setImpactLensFilter((prev) =>
                    prev === 'verify_plausibility' ? 'all' : 'verify_plausibility'
                  )
                }
                className={`px-2 py-0.5 rounded-lg border transition cursor-pointer tabular-nums ${
                  impactLensFilter === 'verify_plausibility'
                    ? 'bg-amber-600 text-white border-amber-700 font-bold'
                    : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200'
                }`}
                title="Filter projects whose cost per person or goal size needs a closer check"
              >
                Check Cost/Goal ({impactLensCounts.verifyCount})
              </button>
              <button
                type="button"
                onClick={() =>
                  setImpactLensFilter((prev) =>
                    prev === 'upg_focus' ? 'all' : 'upg_focus'
                  )
                }
                className={`px-2 py-0.5 rounded-lg border transition cursor-pointer tabular-nums ${
                  impactLensFilter === 'upg_focus'
                    ? 'bg-teal-700 text-white border-teal-800 font-bold'
                    : 'bg-white hover:bg-teal-50 text-slate-700 border-slate-200'
                }`}
                title="Filter proposals reaching Group E (World Religions / Secular) or named Unreached People Groups"
              >
                Group E / UPG ({impactLensCounts.upgCount})
              </button>
              <button
                type="button"
                onClick={() =>
                  setImpactLensFilter((prev) =>
                    prev === 'no_group_e' ? 'all' : 'no_group_e'
                  )
                }
                className={`px-2 py-0.5 rounded-lg border transition cursor-pointer tabular-nums ${
                  impactLensFilter === 'no_group_e'
                    ? 'bg-slate-800 text-white border-slate-900 font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="Filter proposals serving only Internal Church (A–B) or Christian/Seeker (C–D) audiences"
              >
                No Group E ({impactLensCounts.noGroupECount})
              </button>
            </div>
          )}
        </div>

        {displayedProposals.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No proposals match your current filters</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting the Union filter, clearing search keywords, or selecting "All" statuses.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List (< md) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {displayedProposals.map((proposal) => {
                const meta = proposalMetaMap.get(proposal.id);
                const budget = meta ? meta.budget : getProposalBudget(proposal);
                const unionCode = meta ? meta.unionAcronym : (UNION_ACRONYMS[proposal.union] || proposal.union || 'SSD');
                const pct = meta ? meta.completionPct : validateProposalForSubmission(proposal).completionPercentage;
                const alignmentFlagCount = meta ? meta.alignmentFlagCount : 0;
                const parsedTarget = meta
                  ? meta.parsedTarget
                  : parseKpiTargetNumber(proposal.kpiNumber, proposal.kpiDescription, proposal.kpiType);

                return (
                  <div
                    key={proposal.id}
                    onClick={() => handleOpenProposal(proposal.id)}
                    className="p-4 space-y-2.5 transition cursor-pointer active:bg-slate-100/80 hover:bg-slate-50/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-extrabold text-[#1c398e] tracking-tight">
                          {unionCode}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            proposal.status === 'approved'
                              ? proposal.divisionApproval?.authorized
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : proposal.status === 'under_review'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : proposal.status === 'submitted'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {proposal.status === 'approved'
                            ? proposal.divisionApproval?.authorized
                              ? 'Authorized ✓'
                              : 'Union Voted'
                            : proposal.status === 'under_review'
                            ? 'Under Review'
                            : proposal.status === 'submitted'
                            ? 'Submitted'
                            : 'Draft'}
                        </span>
                        {alignmentFlagCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProposal(proposal.id, 'flags');
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 tabular-nums transition cursor-pointer"
                            title={`Alignment Flags (${alignmentFlagCount}):\n${meta?.alignmentTooltip || ''}\n\nClick to open proposal & review alignment flags`}
                          >
                            <Flag className="w-2.5 h-2.5 text-amber-700 fill-amber-500/40 shrink-0" />
                            <span>{alignmentFlagCount}</span>
                          </button>
                        )}
                      </div>
                      <span className="text-sm font-black text-slate-900 tabular-nums">
                        US${formatCurrency(budget)}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 line-clamp-2">
                      {(proposal.title || '').trim() || 'Untitled Proposal'}
                    </h3>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span
                        className="truncate max-w-[175px]"
                        title={(meta ? meta.contactDisplay : getProposalContactDisplay(proposal)).tooltip}
                      >
                        {(() => {
                          const c = meta ? meta.contactDisplay : getProposalContactDisplay(proposal);
                          return c.hasDistinctLead
                            ? `${c.primaryName} · Lead: ${c.leadName}`
                            : c.primaryName;
                        })()}
                      </span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {pct}% Complete
                        {parsedTarget.value !== null ? ` · Target: ${parsedTarget.formatted}` : ''}
                      </span>
                    </div>

                    {(() => {
                      const pl =
                        meta?.plausibility || evaluateProposalImpactPlausibility(proposal);
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded border font-bold tabular-nums ${
                              pl.verdict === 'plausible'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : pl.verdict === 'verify_economics'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                          >
                            {pl.verdictShortBadge}
                            {pl.costPerOutcomeFormatted !== '—'
                              ? ` · ${pl.costPerOutcomeFormatted}/p`
                              : ''}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border font-semibold ${pl.upgTierMeta.badgeClass}`}
                          >
                            {pl.upgTierMeta.shortLabel}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-600 font-semibold">
                        {proposal.status === 'under_review'
                          ? 'Next: Committee Action'
                          : proposal.status === 'submitted'
                          ? 'Next: Begin Review'
                          : proposal.status === 'approved'
                          ? 'Voted & Approved'
                          : 'Draft In Progress'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProposal(proposal.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-xl bg-slate-100 hover:bg-[#1c398e] hover:text-white text-slate-700 font-bold text-xs transition cursor-pointer"
                      >
                        <span>Open</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 pl-3 pr-2 text-center w-14">Union</th>
                    <th className="py-2.5 px-3 w-full min-w-[220px]">Proposal Title & Overview</th>
                    <th className="py-2.5 px-2.5 whitespace-nowrap">Project Lead</th>
                    <th className="py-2.5 px-2.5 whitespace-nowrap">Pillar & Target</th>
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Budget</th>
                    <th
                      className="py-2.5 px-2.5 text-center whitespace-nowrap"
                      title="Form data entry completion (100% required before committee review)"
                    >
                      Form %
                    </th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">Status</th>
                    <th className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedProposals.map((proposal) => {
                    const meta = proposalMetaMap.get(proposal.id);
                    const budget = meta ? meta.budget : getProposalBudget(proposal);
                    const unionCode = meta ? meta.unionAcronym : (UNION_ACRONYMS[proposal.union] || proposal.union || 'SSD');
                    const alignmentFlagCount = meta ? meta.alignmentFlagCount : 0;
                    const parsedTarget = meta
                      ? meta.parsedTarget
                      : parseKpiTargetNumber(proposal.kpiNumber, proposal.kpiDescription, proposal.kpiType);

                    return (
                      <tr
                        key={proposal.id}
                        onClick={() => handleOpenProposal(proposal.id)}
                        className="group transition cursor-pointer hover:bg-slate-50/80"
                      >
                        {/* Union Code */}
                        <td className="py-3 pl-3 pr-2 text-center whitespace-nowrap">
                          <span className="text-xs font-extrabold text-[#1c398e] tracking-tight">
                            {unionCode}
                          </span>
                        </td>

                        {/* Title & Excerpt (Flexible width with max-w-0 so it truncates cleanly without pushing table width) */}
                        <td className="py-3 px-3 w-full max-w-0 min-w-[220px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="font-bold text-slate-900 group-hover:text-[#1c398e] transition leading-snug truncate"
                              title={(proposal.title || '').trim() || 'Untitled Proposal'}
                            >
                              {(proposal.title || '').trim() || 'Untitled Proposal'}
                            </span>
                            {alignmentFlagCount > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenProposal(proposal.id, 'flags');
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 shadow-2xs shrink-0 tabular-nums transition cursor-pointer"
                                title={`Alignment Flags (${alignmentFlagCount}):\n${meta?.alignmentTooltip || ''}\n\nClick to open proposal & review alignment flags`}
                              >
                                <Flag className="w-2.5 h-2.5 text-amber-700 fill-amber-500/40 shrink-0" />
                                <span>{alignmentFlagCount}</span>
                              </button>
                            )}
                          </div>
                          {proposal.overview && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {proposal.overview}
                            </p>
                          )}
                          {(proposal.reviewerNotes || (proposal.reviewNotes && proposal.reviewNotes.length > 0)) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProposal(proposal.id, 'notes');
                              }}
                              className="text-[10px] text-blue-700 hover:underline flex items-center gap-1 mt-0.5 font-medium cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
                              <span>Has review notes</span>
                            </button>
                          )}
                        </td>

                        {/* POC & Lead */}
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          {(() => {
                            const c = meta ? meta.contactDisplay : getProposalContactDisplay(proposal);
                            return (
                              <div title={c.tooltip}>
                                <div className="font-medium text-slate-800 max-w-[155px] truncate">
                                  {c.primaryName}
                                </div>
                                <div className="text-[10px] text-slate-400 max-w-[155px] truncate">
                                  {c.hasDistinctLead ? `Lead: ${c.leadName}` : c.primaryEmail}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Pillar, Metric Target & UPG Tier */}
                        <td className="py-3 px-2.5 whitespace-nowrap">
                          {(() => {
                            const pl =
                              meta?.plausibility ||
                              evaluateProposalImpactPlausibility(proposal);
                            return (
                              <div className="space-y-0.5">
                                <div
                                  className="font-semibold text-slate-800 truncate max-w-[140px]"
                                  title={proposal.strategicFocus || 'General Mission'}
                                >
                                  {meta ? meta.pillarShortLabel : getProposalPillarShortLabel(proposal)}
                                </div>
                                {parsedTarget.value !== null ? (
                                  <div
                                    className="text-[11px] text-emerald-700 font-bold tabular-nums"
                                    title={`${pl.territoryScaleDetail}\n• Scale: ${pl.territoryScaleRatioLabel}`}
                                  >
                                    Target: {parsedTarget.formatted}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400">No numeric KPI</div>
                                )}
                                <div
                                  className="text-[10px] font-semibold text-slate-500 truncate max-w-[145px]"
                                  title={`${pl.upgTierMeta.fullLabel}\n${pl.upgTierMeta.description}`}
                                >
                                  {pl.upgTier === 'named_upg' ? (
                                    <span className="text-teal-700 font-bold">
                                      ● Direct UPG Focus
                                    </span>
                                  ) : pl.upgTier === 'group_e_general' ? (
                                    <span className="text-sky-700 font-bold">
                                      ● Group E Reach
                                    </span>
                                  ) : pl.upgTier === 'christian_seeker_cd' ? (
                                    <span>Groups C–D</span>
                                  ) : (
                                    <span>Internal A–B</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Budget & Plausibility */}
                        <td className="py-3 px-2.5 text-right whitespace-nowrap">
                          {(() => {
                            const pl =
                              meta?.plausibility ||
                              evaluateProposalImpactPlausibility(proposal);
                            return (
                              <div
                                className="inline-flex flex-col items-end gap-0.5"
                                title={`${pl.verdictLabel}\n• Cost/Outcome: ${pl.costPerOutcomeFormatted}${
                                  pl.stageBand ? ` (${pl.stageBand.bandDisplayLabel})` : ''
                                }\n• Territory Scale: ${pl.territoryScaleRatioLabel}\n• Review Note: ${
                                  pl.questionsToAsk[0] || ''
                                }`}
                              >
                                <span className="font-black text-slate-900 text-sm tabular-nums">
                                  ${formatCurrency(budget)}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border tabular-nums ${
                                    pl.verdict === 'plausible'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : pl.verdict === 'verify_economics'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : 'bg-rose-50 text-rose-800 border-rose-300'
                                  }`}
                                >
                                  {pl.verdictShortBadge}
                                  {pl.costPerOutcomeFormatted !== '—'
                                    ? ` · ${pl.costPerOutcomeFormatted}/p`
                                    : ''}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Form % Completeness */}
                        <td className="py-3 px-2.5 text-center whitespace-nowrap">
                          {(() => {
                            const val = meta ? meta.validation : validateProposalForSubmission(proposal);
                            const pct = val.completionPercentage;
                            return (
                              <span
                                className={`text-xs font-extrabold tabular-nums cursor-help ${
                                  pct === 100
                                    ? 'text-emerald-700'
                                    : pct >= 75
                                    ? 'text-slate-700'
                                    : pct >= 50
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                                }`}
                                title={
                                  val.isValid
                                    ? 'Form 100% complete — ready for committee review'
                                    : `Form completion: ${pct}% (${val.errors.length} required ${
                                        val.errors.length === 1 ? 'item' : 'items'
                                      } missing: ${val.errors.map((e) => e.label).join(', ')})`
                                }
                              >
                                {pct}%
                              </span>
                            );
                          })()}
                        </td>

                        {/* Status & Next Step */}
                        <td className="py-3 px-2.5 text-center whitespace-nowrap">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                proposal.status === 'approved'
                                  ? proposal.divisionApproval?.authorized
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : proposal.status === 'under_review'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : proposal.status === 'submitted'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {proposal.status === 'approved' ? (
                                proposal.divisionApproval?.authorized ? (
                                  <>
                                    <ShieldCheck className="w-3 h-3 text-white shrink-0" />
                                    <span>Authorized ✓</span>
                                  </>
                                ) : (
                                  <span>Union Voted</span>
                                )
                              ) : proposal.status === 'under_review' ? (
                                'Under Review'
                              ) : proposal.status === 'submitted' ? (
                                'Submitted'
                              ) : (
                                'Draft'
                              )}
                            </span>

                            {/* Clean Secondary Action Cue */}
                            {proposal.status === 'under_review' ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800"
                                title="Treasurer review in progress: click row to open proposal and record official committee action"
                              >
                                <span>Next: Vote</span>
                                <ArrowRight className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                              </span>
                            ) : proposal.status === 'submitted' ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700"
                                title="Proposal submitted by author: click row to open proposal and begin review"
                              >
                                <span>Next: Review</span>
                                <ArrowRight className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                              </span>
                            ) : proposal.status === 'approved' ? (
                              proposal.unionApproval?.actionNumber ? (
                                <span
                                  className="text-[10px] font-bold text-emerald-800 tabular-nums max-w-[125px] truncate"
                                  title={`Union Action #${proposal.unionApproval.actionNumber} (${
                                    proposal.unionApproval.actionDate || 'N/A'
                                  })${
                                    proposal.divisionApproval?.authorized
                                      ? ` · Authorized by SSD Treasury (${proposal.divisionApproval.authorizedBy})`
                                      : ' · Pending Division Treasury Authorization'
                                  }`}
                                >
                                  #{proposal.unionApproval.actionNumber}
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-medium">
                                  Action Logged
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">
                                Author editing
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {currentUser.role === 'super_admin' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProposalToTransfer(proposal);
                                }}
                                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                                title="Transfer proposal ownership to a different user"
                                aria-label="Transfer proposal ownership"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProposal(proposal.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#1c398e] hover:text-white text-slate-700 font-semibold text-xs transition cursor-pointer"
                            >
                              <span>Open</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </>
      )}
      </div>

      {/* Floating Active Filter Bar (only visible when a Briefing/Impact filter is active and Proposals table is scrolled out of view) */}
      {(coachingFilter !== 'all' || impactLensFilter !== 'all') && !isTableInView && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[94vw] sm:max-w-2xl">
          <div className="bg-slate-900 text-white border border-slate-700/90 rounded-xl shadow-lg px-3.5 py-2 flex items-center gap-2.5 sm:gap-3 text-xs">
            <Filter className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-slate-200 truncate max-w-[160px] sm:max-w-[280px]">
                {coachingFilter !== 'all'
                  ? coachingFilterLabel || 'Active Briefing Filter'
                  : impactLensFilter === 'verify_plausibility'
                  ? 'Check Cost / Goal'
                  : impactLensFilter === 'upg_focus'
                  ? 'Group E / UPG Reach'
                  : 'No Group E Reach'}
              </span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="font-bold text-white tabular-nums whitespace-nowrap shrink-0">
                {displayedProposals.length}{' '}
                {displayedProposals.length === 1 ? 'proposal' : 'proposals'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              <button
                type="button"
                onClick={scrollToProposalsTable}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1c398e] hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Jump to Table</span>
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCoachingFilter('all');
                  setCoachingMatchingIds(new Set());
                  setCoachingFilterLabel('');
                  setImpactLensFilter('all');
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                title="Clear active filter"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Proposal Ownership Modal */}
      {proposalToTransfer && (
        <TransferOwnershipModal
          isOpen={Boolean(proposalToTransfer)}
          onClose={() => setProposalToTransfer(null)}
          proposal={proposalToTransfer}
          currentUser={currentUser}
          onTransferSuccess={(updated) => {
            onUpdateProposal(updated.id, updated);
            setProposalToTransfer(null);
          }}
        />
      )}

    </div>
  );
}
