import React, { useState, useMemo, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  MessageSquare,
  Printer,
  ChevronRight,
  Download,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Layers,
  Building2,
  RotateCcw,
  Flag,
  Clock,
  ArrowRight,
  User,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import {
  Proposal,
  UserAccount,
  UNIONS,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getCanonicalDivisionProject,
  isKpiAlignedWithObjective,
  getUserAllUnions,
  getUserVotingUnions,
  getUserInviteeUnions,
  isUserLiaisonEligible,
  canUserVoteStep4Liaison,
  PillarFilterKey,
  PILLAR_FILTER_OPTIONS,
  getProposalPillarKey,
  getProposalPillarShortLabel,
  isDivisionLevelTreasurerOrAdmin,
  DivisionTreasuryAuthorization,
  getProposalStepStatus,
  ProposalStepStatus,
} from '../types';
import { formatCurrency } from '../utils/userUtils';
import { getAllProposalSmartAdvisories } from '../utils/proposalSmartAdvisor';
import {
  buildProposalSearchHaystack,
  matchesProposalSearch,
  getProposalContactDisplay,
  ProposalContactDisplay,
} from '../utils/proposalSearch';
import {
  computeAllProposalsFundingAttribution,
  computeScopeFundingAggregate,
  formatAttributionPct,
} from '../utils/fundingAttribution';
import {
  fetchBudgetAllocationDetails,
  fetchDivisionLiaisons,
  subscribeToLiaisonDirectoryChanges,
} from '../services/proposalService';
import { DivisionAuthorizationModal } from './DivisionAuthorizationModal';

interface ApprovedProposalsProps {
  proposals: Proposal[];
  currentUser: UserAccount;
  selectedUnionFilter?: string;
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
  onOpenLiaisonGuide?: () => void;
  allocations?: Record<string, number>;
  matchingPledges?: Record<string, number>;
}

export function ApprovedProposals({
  proposals,
  currentUser,
  selectedUnionFilter,
  onUnionFilterChange,
  onUpdateProposal,
  onOpenInEditor,
  onOpenPrint,
  onOpenLiaisonGuide,
  allocations = {},
  matchingPledges = {},
}: ApprovedProposalsProps) {
  const isDivisionSuperAdmin = isDivisionLevelTreasurerOrAdmin(currentUser);
  const canAuthorizeDivision = isDivisionSuperAdmin;
  const isLiaison = currentUser.role === 'division_liaison';
  const isLiaisonVoter = isUserLiaisonEligible(currentUser);
  const liaisonUnions = useMemo(() => getUserAllUnions(currentUser), [currentUser]);
  const liaisonVotingUnions = useMemo(() => getUserVotingUnions(currentUser), [currentUser]);
  const liaisonInviteeUnions = useMemo(() => getUserInviteeUnions(currentUser), [currentUser]);

  // Authorized unions for the current user (liaison or union-scoped users)
  const authorizedUnions = useMemo(() => {
    if (isDivisionSuperAdmin) return null;
    return getUserAllUnions(currentUser);
  }, [isDivisionSuperAdmin, currentUser]);

  // Load budget allocations, Union matching pledges, & directory users from Firestore / localStorage
  const [loadedAllocations, setLoadedAllocations] = useState<Record<string, number>>({});
  const [loadedMatchingPledges, setLoadedMatchingPledges] = useState<Record<string, number>>({});
  const [directoryUsers, setDirectoryUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadBudgetDetails(forceLiaisonsRefresh = false) {
      try {
        const [{ allocations: fetchedAlloc, matchingPledges: fetchedMatch }, users] =
          await Promise.all([
            fetchBudgetAllocationDetails(),
            fetchDivisionLiaisons(forceLiaisonsRefresh).catch(() => [] as UserAccount[]),
          ]);
        if (isMounted) {
          setLoadedAllocations(fetchedAlloc || {});
          setLoadedMatchingPledges(fetchedMatch || {});
          if (Array.isArray(users)) {
            setDirectoryUsers(users);
          }
        }
      } catch (e) {
        console.error('Failed to load budget allocation details in ApprovedProposals:', e);
      }
    }
    loadBudgetDetails(false);
    const unsub = subscribeToLiaisonDirectoryChanges(() => {
      fetchDivisionLiaisons(true)
        .then((users) => {
          if (isMounted && Array.isArray(users)) {
            setDirectoryUsers(users);
          }
        })
        .catch(() => {});
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser?.uid]);

  // Pre-group registered Voting Division Liaisons by canonical Union (excludes Invitee Liaisons)
  const liaisonsByUnionMap = useMemo(() => {
    const map = new Map<string, UserAccount[]>();
    for (const u of directoryUsers) {
      if (!isUserLiaisonEligible(u)) continue;
      const votingUnions = getUserVotingUnions(u);
      for (const canon of votingUnions) {
        if (!canon) continue;
        const list = map.get(canon) || [];
        list.push(u);
        map.set(canon, list);
      }
    }
    return map;
  }, [directoryUsers]);

  const effectiveAllocations = useMemo(
    () => ({ ...loadedAllocations, ...allocations }),
    [loadedAllocations, allocations]
  );

  const effectiveMatchingPledges = useMemo(
    () => ({ ...loadedMatchingPledges, ...matchingPledges }),
    [loadedMatchingPledges, matchingPledges]
  );

  // State for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnion, setSelectedUnion] = useState<string>(() => {
    if (isDivisionSuperAdmin) {
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
    return currentUser.union || 'all';
  });
  const [selectedPillar, setSelectedPillar] = useState<PillarFilterKey>('all');
  const [notesFilter, setNotesFilter] = useState<
    'all' | 'needs_my_vote' | 'step4_liaison' | 'pending_auth' | 'authorized' | 'unread' | 'flagged'
  >('all');

  const handleUnionChange = (newUnion: string) => {
    setSelectedUnion(newUnion);
    onUnionFilterChange?.(newUnion);
  };

  // Synchronize union scope whenever currentUser or external selectedUnionFilter updates
  useEffect(() => {
    if (isDivisionSuperAdmin) {
      if (selectedUnionFilter && (selectedUnionFilter === 'all' || UNIONS.includes(selectedUnionFilter as any))) {
        setSelectedUnion(selectedUnionFilter);
      } else if (selectedUnion !== 'all' && !UNIONS.includes(selectedUnion as any)) {
        setSelectedUnion('all');
      }
    } else if (isLiaison) {
      if (
        selectedUnionFilter &&
        (selectedUnionFilter === 'all' ||
          liaisonUnions.map(getCanonicalUnion).includes(getCanonicalUnion(selectedUnionFilter)))
      ) {
        setSelectedUnion(selectedUnionFilter);
      } else if (
        selectedUnion !== 'all' &&
        !liaisonUnions.map(getCanonicalUnion).includes(getCanonicalUnion(selectedUnion))
      ) {
        setSelectedUnion(liaisonUnions.length === 1 ? liaisonUnions[0] : 'all');
      }
    } else if (currentUser.union) {
      setSelectedUnion(currentUser.union);
    }
  }, [isDivisionSuperAdmin, isLiaison, currentUser.union, liaisonUnions, selectedUnionFilter]);

  // Division Authorization Modal state
  const [authorizingProposalId, setAuthorizingProposalId] = useState<string | null>(null);

  // 1. Filter only officially Union-approved proposals within user's jurisdictional oversight
  const scopedApprovedProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (p.status !== 'approved') return false;
      if (!isDivisionSuperAdmin && authorizedUnions) {
        const canonicalPropUnion = getCanonicalUnion(p.union);
        if (!authorizedUnions.includes(canonicalPropUnion)) {
          return false;
        }
      }
      return true;
    });
  }, [proposals, isDivisionSuperAdmin, authorizedUnions]);

  // Helper to calculate division funding requested / approved
  const getProposalFunding = (p: Proposal): number => {
    return (p.budgetItems || []).reduce(
      (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
      0
    );
  };

  // Helper to check if a proposal has pending/unread notes for the current user
  const getUnreadNotesCount = (p: Proposal): number => {
    if (!p.reviewNotes || p.reviewNotes.length === 0) return 0;
    const userKey = currentUser.uid || currentUser.email;
    return p.reviewNotes.filter(
      (note) =>
        note.authorEmail !== currentUser.email &&
        (!note.readBy || !note.readBy.includes(userKey))
    ).length;
  };

  // Helper to check if the signed-in liaison still needs to cast a Step 4 recommendation vote on this proposal
  const needsCurrentUserVote = (p: Proposal): boolean => {
    if (!isLiaisonVoter) return false;
    if (p.divisionApproval?.authorized) return false;
    if (!canUserVoteStep4Liaison(p, currentUser)) return false;
    const emailLower = (currentUser.email || '').trim().toLowerCase();
    const myVote = (p.liaisonVotes || []).find(
      (v) =>
        (currentUser.uid && v.liaisonUid === currentUser.uid) ||
        (emailLower && (v.liaisonEmail || '').trim().toLowerCase() === emailLower)
    );
    return !myVote || myVote.vote !== 'recommended';
  };

  // Pre-compute funding, canonical union, canonical objective, pillar, 5-step status, alignment flags, and search haystack once per scopedApprovedProposals update
  const approvedMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        funding: number;
        canonicalUnion: string;
        unionAcronym: string;
        canonicalGoal: string;
        pillarKey: Exclude<PillarFilterKey, 'all'> | '';
        pillarShortLabel: string;
        isMisaligned: boolean;
        alignmentFlagCount: number;
        alignmentTooltip: string;
        primaryFlagTab: 'financials' | 'narrative' | 'kpis';
        isDivisionAuthorized: boolean;
        stepStatus: ProposalStepStatus;
        searchHaystack: string;
        contactDisplay: ProposalContactDisplay;
      }
    >();
    for (const p of scopedApprovedProposals) {
      const funding = getProposalFunding(p);
      const canonicalUnion = getCanonicalUnion(p.union);
      const unionAcronym = UNION_ACRONYMS[canonicalUnion] || UNION_ACRONYMS[p.union] || p.union || 'SSD';
      const canonicalGoal = getCanonicalDivisionProject(p.divisionProject);
      const pillarKey = getProposalPillarKey(p);
      const pillarShortLabel = getProposalPillarShortLabel(p);
      const isMisaligned = Boolean(
        (canonicalGoal || p.divisionProject) &&
          p.kpiType &&
          !isKpiAlignedWithObjective(canonicalGoal || p.divisionProject, p.kpiType)
      );

      const advisories = getAllProposalSmartAdvisories(p);
      const flagItems: { title: string; tab: 'financials' | 'narrative' | 'kpis' }[] = [];

      if (isMisaligned) {
        flagItems.push({
          title: `Strategic Misalignment: Primary KPI does not match ${canonicalGoal || p.divisionProject}`,
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
      const isDivisionAuthorized = Boolean(p.divisionApproval?.authorized);
      const unionLiaisons = liaisonsByUnionMap.get(canonicalUnion) || [];
      const stepStatus = getProposalStepStatus(p, unionLiaisons);
      const searchHaystack = buildProposalSearchHaystack(p);
      const contactDisplay = getProposalContactDisplay(p);

      map.set(p.id, {
        funding,
        canonicalUnion,
        unionAcronym,
        canonicalGoal,
        pillarKey,
        pillarShortLabel,
        isMisaligned,
        alignmentFlagCount,
        alignmentTooltip,
        primaryFlagTab,
        isDivisionAuthorized,
        stepStatus,
        searchHaystack,
        contactDisplay,
      });
    }
    return map;
  }, [scopedApprovedProposals, liaisonsByUnionMap]);

  // Pre-compute approved proposal counts per canonical union for compact code dropdown
  const unionApprovedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of proposals) {
      if (p.status !== 'approved') continue;
      const canon = getCanonicalUnion(p.union);
      if (!canon) continue;
      counts.set(canon, (counts.get(canon) || 0) + 1);
    }
    return counts;
  }, [proposals]);

  // 2. Apply search and fast filters on the scoped approved proposals
  const filteredApproved = useMemo(() => {
    const canonicalSelected = selectedUnion !== 'all' ? getCanonicalUnion(selectedUnion) : '';
    const query = searchQuery.trim();

    return scopedApprovedProposals.filter((p) => {
      const meta = approvedMetaMap.get(p.id);
      const isAuthorized = meta ? meta.isDivisionAuthorized : Boolean(p.divisionApproval?.authorized);
      const stepStatus = meta ? meta.stepStatus : getProposalStepStatus(p);

      // Union filter
      if (selectedUnion !== 'all') {
        const canonicalPropUnion = meta ? meta.canonicalUnion : getCanonicalUnion(p.union);
        if (canonicalPropUnion !== canonicalSelected && p.union !== selectedUnion) {
          return false;
        }
      }

      // Strategic Pillar filter
      if (selectedPillar !== 'all') {
        const pKey = meta ? meta.pillarKey : getProposalPillarKey(p);
        if (pKey !== selectedPillar) {
          return false;
        }
      }

      // Fast status / governance filter
      if (notesFilter === 'needs_my_vote') {
        if (!needsCurrentUserVote(p)) return false;
      } else if (notesFilter === 'step4_liaison') {
        if (isAuthorized || stepStatus.liaisonSummary.allLiaisonsVoted) return false;
      } else if (notesFilter === 'pending_auth') {
        if (isAuthorized) return false;
      } else if (notesFilter === 'authorized') {
        if (!isAuthorized) return false;
      } else if (notesFilter === 'unread') {
        if (getUnreadNotesCount(p) === 0) return false;
      } else if (notesFilter === 'flagged') {
        if ((meta?.alignmentFlagCount || 0) === 0) return false;
      }

      // Unified text search (Title, POC, Project/Division Lead, Submitter, Liaison, Union code, Pillar, Objective, Action #, OV27 Ref #)
      if (
        query &&
        !matchesProposalSearch(p, query, meta?.searchHaystack, meta?.canonicalUnion)
      ) {
        return false;
      }

      return true;
    });
  }, [scopedApprovedProposals, approvedMetaMap, selectedUnion, selectedPillar, notesFilter, searchQuery, currentUser]);

  // Total summary statistics: scoped strictly to user's authorized territory / active Union & Pillar selection
  const activeScopeApproved = useMemo(() => {
    const canonicalSelected = selectedUnion !== 'all' ? getCanonicalUnion(selectedUnion) : '';
    return scopedApprovedProposals.filter((p) => {
      const meta = approvedMetaMap.get(p.id);
      if (selectedUnion !== 'all') {
        const canonicalPropUnion = meta ? meta.canonicalUnion : getCanonicalUnion(p.union);
        if (canonicalPropUnion !== canonicalSelected && p.union !== selectedUnion) {
          return false;
        }
      }
      if (selectedPillar !== 'all') {
        const pKey = meta ? meta.pillarKey : getProposalPillarKey(p);
        if (pKey !== selectedPillar) {
          return false;
        }
      }
      return true;
    });
  }, [scopedApprovedProposals, approvedMetaMap, selectedUnion, selectedPillar]);

  // Auditor Summary Metrics (Step 3 Union-Voted vs Step 4 Liaison Voted vs Step 5 SSD OV27 Committee Authorized)
  const {
    totalApprovedCount,
    totalFundingSum,
    authorizedCount,
    authorizedFundingSum,
    pendingAuthCount,
    pendingAuthFundingSum,
    liaisonVotedCount,
    awaitingLiaisonCount,
    awaitingLiaisonFundingSum,
  } = useMemo(() => {
    let totalSum = 0;
    let authCnt = 0;
    let authSum = 0;
    let pendCnt = 0;
    let pendSum = 0;
    let lVotedCnt = 0;
    let awaitLCnt = 0;
    let awaitLSum = 0;

    for (const p of activeScopeApproved) {
      const f = getProposalFunding(p);
      const meta = approvedMetaMap.get(p.id);
      const st = meta ? meta.stepStatus : getProposalStepStatus(p);
      totalSum += f;
      if (p.divisionApproval?.authorized) {
        authCnt += 1;
        authSum += f;
        lVotedCnt += 1;
      } else {
        pendCnt += 1;
        pendSum += f;
        if (st.liaisonSummary.allLiaisonsVoted) {
          lVotedCnt += 1;
        } else {
          awaitLCnt += 1;
          awaitLSum += f;
        }
      }
    }

    return {
      totalApprovedCount: activeScopeApproved.length,
      totalFundingSum: totalSum,
      authorizedCount: authCnt,
      authorizedFundingSum: authSum,
      pendingAuthCount: pendCnt,
      pendingAuthFundingSum: pendSum,
      liaisonVotedCount: lVotedCnt,
      awaitingLiaisonCount: awaitLCnt,
      awaitingLiaisonFundingSum: awaitLSum,
    };
  }, [activeScopeApproved, approvedMetaMap]);

  const totalUnreadProposalsCount = useMemo(() => {
    return activeScopeApproved.filter((p) => getUnreadNotesCount(p) > 0).length;
  }, [activeScopeApproved, currentUser]);

  const totalFlaggedProposalsCount = useMemo(() => {
    return activeScopeApproved.filter((p) => (approvedMetaMap.get(p.id)?.alignmentFlagCount || 0) > 0).length;
  }, [activeScopeApproved, approvedMetaMap]);

  const myVotingQueueProposals = useMemo(() => {
    if (!isLiaisonVoter) return [];
    return activeScopeApproved.filter((p) => needsCurrentUserVote(p));
  }, [activeScopeApproved, isLiaisonVoter, currentUser]);

  const myVotingQueueIds = useMemo(
    () => myVotingQueueProposals.map((p) => p.id),
    [myVotingQueueProposals]
  );

  // Compute 4-Entity Pool Formula Attribution across all approved proposals
  const fundingAttribution = useMemo(() => {
    return computeAllProposalsFundingAttribution(
      proposals,
      effectiveAllocations,
      effectiveMatchingPledges
    );
  }, [proposals, effectiveAllocations, effectiveMatchingPledges]);

  // Aggregate GC / SSD / SPD / Union shares + Pool & Remaining for currently active scope
  const activeScopeAttribution = useMemo(() => {
    const scopedUnionList =
      selectedUnion !== 'all'
        ? [selectedUnion]
        : authorizedUnions && authorizedUnions.length > 0
        ? authorizedUnions
        : [...UNIONS];
    return computeScopeFundingAggregate(
      activeScopeApproved,
      fundingAttribution.byProposalId,
      fundingAttribution.byUnion,
      scopedUnionList
    );
  }, [
    activeScopeApproved,
    fundingAttribution.byProposalId,
    fundingAttribution.byUnion,
    selectedUnion,
    authorizedUnions,
  ]);

  const selectedUnionSummary = useMemo(() => {
    if (selectedUnion === 'all') return null;
    const canon = getCanonicalUnion(selectedUnion) || selectedUnion;
    return fundingAttribution.byUnion[canon] || null;
  }, [selectedUnion, fundingAttribution.byUnion]);

  const authorizingProposal = useMemo(() => {
    if (!authorizingProposalId) return null;
    return proposals.find((p) => p.id === authorizingProposalId) || null;
  }, [authorizingProposalId, proposals]);

  const navigableIds = useMemo(
    () => filteredApproved.map((p) => p.id),
    [filteredApproved]
  );

  // Open full Proposal Page (optionally deep-linking to Review Notes or Alignment Flags)
  const handleOpenProposal = (
    proposalId: string,
    focus?: 'notes' | 'flags' | 'financials' | 'kpis'
  ) => {
    onOpenInEditor(proposalId, { focus, navigableIds });
  };

  const handleOpenNotes = (proposalId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    handleOpenProposal(proposalId, 'notes');
  };

  // Confirm Division Treasury Authorization
  const handleConfirmAuthorization = async (
    proposalId: string,
    authorizationData: DivisionTreasuryAuthorization | null
  ) => {
    await onUpdateProposal(proposalId, {
      divisionApproval: authorizationData,
    });
  };

  // Export approved proposals to CSV (including Step 3 Union Vote, Step 4 Liaison Vote, & Step 5 SSD OV27 Committee Authorization)
  const handleExportCSV = () => {
    if (filteredApproved.length === 0) return;

    const headers = [
      'Union',
      'Current Governance Step',
      'Composite Project Code',
      'OrgID',
      'Project ID',
      'Lifecycle Phase',
      'Operational Status',
      'Project Code Locked',
      'Project Code Locked At',
      'Proposal Title',
      'Strategic Pillar',
      'Strategic Goal / Objective',
      'Step 3 Union Action Number',
      'Step 3 Union Voted Date',
      'Step 3 Certified By',
      'Step 4 Liaison Vote Status',
      'Step 5 SSD OV27 Committee Status',
      'Step 5 OV27 Ref / Code',
      'Step 5 Authorized Date',
      'Step 5 Authorized By',
      'Approved Budget (100% USD)',
      'GC Share (%)',
      'GC Amount (USD)',
      'SSD Share (%)',
      'SSD Amount (USD)',
      'SPD Share (%)',
      'SPD Amount (USD)',
      'Union Share (%)',
      'Union Amount (USD)',
      'Over-Pool Union Deficit (USD)',
      'Submitter Name',
      'Submitter Email',
    ];

    const rows = filteredApproved.map((p) => {
      const attr = fundingAttribution.byProposalId[p.id];
      const meta = approvedMetaMap.get(p.id);
      const st = meta ? meta.stepStatus : getProposalStepStatus(p);
      const pc = p.projectCode;
      return [
        `"${p.union || ''}"`,
        `"${st.currentStepShortBadge}"`,
        `"${pc?.composite || ''}"`,
        `"${pc?.orgId || 'AT1111'}"`,
        `"${pc?.projectId || ''}"`,
        `"${pc?.phase || ''}"`,
        `"${pc?.status || ''}"`,
        `"${pc?.locked ? 'Yes' : 'No'}"`,
        `"${pc?.lockedAt || ''}"`,
        `"${(p.title || 'Untitled Proposal').replace(/"/g, '""')}"`,
        `"${getProposalPillarShortLabel(p)}"`,
        `"${getCanonicalDivisionProject(p.divisionProject) || ''}"`,
        `"${p.unionApproval?.actionNumber || 'Pending'}"`,
        `"${p.unionApproval?.actionDate || ''}"`,
        `"${p.unionApproval?.approvedBy || ''}"`,
        `"${st.liaisonSummary.progressLabel}"`,
        `"${p.divisionApproval?.authorized ? 'Authorized by SSD OV27 Committee' : 'Pending OV27 Committee'}"`,
        `"${p.divisionApproval?.referenceNumber || ''}"`,
        `"${p.divisionApproval?.authorizedDate || ''}"`,
        `"${p.divisionApproval?.authorizedBy || ''}"`,
        getProposalFunding(p),
        attr ? attr.gcPct.toFixed(2) : '0.00',
        attr ? attr.gcAmount : 0,
        attr ? attr.ssdPct.toFixed(2) : '0.00',
        attr ? attr.ssdAmount : 0,
        attr ? attr.spdPct.toFixed(2) : '0.00',
        attr ? attr.spdAmount : 0,
        attr ? attr.unionPct.toFixed(2) : '0.00',
        attr ? attr.unionAmount : 0,
        attr ? attr.overPoolDeficitAmount : 0,
        `"${p.userName || ''}"`,
        `"${p.userEmail || ''}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `onevoice27_approved_proposals_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 max-w-[1536px] w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5 animate-in fade-in duration-200">
      {/* Compact Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Approved Proposals
          </h1>
          <span
            className="text-slate-400 hover:text-slate-600 cursor-help inline-flex items-center"
            title={
              selectedUnion !== 'all'
                ? `${selectedUnion} post-approval register: Step 3 Union Vote → Step 4 Liaison Review & Vote → Step 5 · SSD OV27 Committee.`
                : 'Official 5-Step governance register: Step 3 Union Vote → Step 4 Division Liaison Review & Vote → Step 5 · SSD OV27 Committee Authorization.'
            }
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Top Action Buttons + Compact Code Union Scope Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDivisionSuperAdmin ? (
            <div
              className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs"
              title={selectedUnion === 'all' ? 'All Unions (Division Total)' : selectedUnion}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedUnion}
                onChange={(e) => handleUnionChange(e.target.value)}
                aria-label="Filter by Union code"
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer tabular-nums"
              >
                <option value="all">All Unions ({scopedApprovedProposals.length})</option>
                {UNIONS.map((u) => {
                  const count = unionApprovedCounts.get(getCanonicalUnion(u)) || 0;
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
                value={selectedUnion}
                onChange={(e) => handleUnionChange(e.target.value)}
                aria-label="Filter by assigned Union code"
                className="bg-transparent border-none text-xs font-bold text-indigo-950 focus:outline-none cursor-pointer tabular-nums"
              >
                <option value="all">All Assigned ({scopedApprovedProposals.length})</option>
                {liaisonVotingUnions.length > 0 && liaisonInviteeUnions.length > 0 ? (
                  <>
                    <optgroup label="Voting Unions (Step 4 Vote)">
                      {liaisonVotingUnions.map((u: string) => {
                        const count = unionApprovedCounts.get(getCanonicalUnion(u)) || 0;
                        return (
                          <option key={u} value={u}>
                            {UNION_ACRONYMS[u] || u} · Voting ({count})
                          </option>
                        );
                      })}
                    </optgroup>
                    <optgroup label="Invitee Unions (View & Comment)">
                      {liaisonInviteeUnions.map((u: string) => {
                        const count = unionApprovedCounts.get(getCanonicalUnion(u)) || 0;
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
                    const count = unionApprovedCounts.get(getCanonicalUnion(u)) || 0;
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
            onClick={handleExportCSV}
            disabled={filteredApproved.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer shadow-2xs disabled:opacity-50"
            title="Download CSV spreadsheet of approved proposals and 5-Step status"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Focused Step 4 Action Bar for Voting Liaisons */}
      {isLiaisonVoter && myVotingQueueProposals.length > 0 && (
        <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-indigo-950 tabular-nums">
                {myVotingQueueProposals.length}{' '}
                {myVotingQueueProposals.length === 1 ? 'proposal awaits' : 'proposals await'} your Step 4 Liaison vote
              </p>
              <p className="text-[11px] text-indigo-900/80">
                Review each proposal with the built-in 7-Question Rubric and step through your queue without returning to the list.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenLiaisonGuide && (
              <button
                type="button"
                onClick={onOpenLiaisonGuide}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold transition cursor-pointer whitespace-nowrap"
                title="Open 4-Page Printable Division Liaison Walkthrough Guide"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Liaison Guide</span>
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setNotesFilter(notesFilter === 'needs_my_vote' ? 'all' : 'needs_my_vote')
              }
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
                notesFilter === 'needs_my_vote'
                  ? 'bg-indigo-900 text-white border-indigo-900'
                  : 'bg-white hover:bg-indigo-50 text-indigo-900 border-indigo-200'
              }`}
            >
              {notesFilter === 'needs_my_vote' ? 'Showing My Queue' : 'Filter Queue'}
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenInEditor(myVotingQueueProposals[0].id, {
                  navigableIds: myVotingQueueIds,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
            >
              <span>Start Reviewing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Governance Pipeline Cards (Click to Filter Step 3 / Step 4 / Step 5) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: Step 3 Union-Voted Total */}
        <button
          type="button"
          onClick={() => setNotesFilter('all')}
          className={`text-left bg-white border rounded-2xl p-4 shadow-2xs transition cursor-pointer ${
            notesFilter === 'all'
              ? 'border-[#1c398e] ring-2 ring-[#1c398e]/15'
              : 'border-slate-200/90 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Step 3 · Union-Voted
            </span>
            <span className="text-sm font-black text-[#1c398e] tabular-nums">
              ${formatCurrency(totalFundingSum)}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
              {totalApprovedCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              total approved proposals
            </span>
          </div>
        </button>

        {/* Card 2: Step 4 Division Liaison Review & Vote */}
        <button
          type="button"
          onClick={() =>
            setNotesFilter(notesFilter === 'step4_liaison' ? 'all' : 'step4_liaison')
          }
          className={`text-left bg-white border rounded-2xl p-4 shadow-2xs transition cursor-pointer ${
            notesFilter === 'step4_liaison'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
              : 'border-slate-200/90 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
              Step 4 · Awaiting Liaison Vote
            </span>
            <span className="text-sm font-black text-indigo-800 tabular-nums">
              ${formatCurrency(awaitingLiaisonFundingSum)}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-700 tracking-tight tabular-nums">
              {awaitingLiaisonCount}
            </span>
            <span className="text-xs text-slate-500 font-medium tabular-nums">
              awaiting vote ({liaisonVotedCount} voted)
            </span>
          </div>
        </button>

        {/* Card 3: Step 5 · SSD OV27 Committee */}
        <button
          type="button"
          onClick={() => setNotesFilter(notesFilter === 'authorized' ? 'all' : 'authorized')}
          className={`text-left bg-white border rounded-2xl p-4 shadow-2xs transition cursor-pointer ${
            notesFilter === 'authorized'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-slate-200/90 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Step 5 · OV27 Authorized
            </span>
            <span className="text-sm font-black text-emerald-700 tabular-nums">
              ${formatCurrency(authorizedFundingSum)}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 tracking-tight tabular-nums">
              {authorizedCount}
            </span>
            <span className="text-xs text-slate-500 font-medium tabular-nums">
              of {totalApprovedCount} authorized ({pendingAuthCount} pending)
            </span>
          </div>
        </button>
      </div>

      {/* Compact 4-Entity Shared Budget Attribution Strip */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold uppercase tracking-wider text-slate-700 text-[11px]">
              Shared Attribution ({selectedUnion !== 'all' ? UNION_ACRONYMS[selectedUnion] || selectedUnion : 'Division Total'})
            </span>
            {selectedUnionSummary && (
              <span className="text-[11px] text-slate-500 tabular-nums">
                · Formula: GC {formatAttributionPct(selectedUnionSummary.formula.gcPoolPct)} / SSD{' '}
                {formatAttributionPct(selectedUnionSummary.formula.ssdPoolPct)}
                {selectedUnionSummary.formula.spdPool > 0
                  ? ` / SPD ${formatAttributionPct(selectedUnionSummary.formula.spdPoolPct)}`
                  : ''}
                {selectedUnionSummary.formula.unionPledgePool > 0
                  ? ` / Union ${formatAttributionPct(selectedUnionSummary.formula.unionPoolPct)}`
                  : ''}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-slate-600">
            <span>
              Pool <strong className="text-slate-900">${formatCurrency(activeScopeAttribution.totalPool)}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>
              Voted <strong className="text-[#1c398e]">${formatCurrency(activeScopeAttribution.totalAmount)}</strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            {activeScopeAttribution.overPoolDeficitAmount > 0 ? (
              <span className="text-rose-700 font-bold">
                Rem ${formatCurrency(activeScopeAttribution.poolRemaining)} · Deficit +${formatCurrency(activeScopeAttribution.overPoolDeficitAmount)}
              </span>
            ) : (
              <span>
                Rem <strong className="text-emerald-700">${formatCurrency(activeScopeAttribution.poolRemaining)}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs tabular-nums">
          {/* 1. GC */}
          <div className="px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-200/80">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                GC Share
              </span>
              <span className="text-[11px] font-bold text-amber-900">
                {formatAttributionPct(activeScopeAttribution.gcPct)}
              </span>
            </div>
            <div className="text-sm font-black text-amber-950 mt-0.5">
              ${formatCurrency(activeScopeAttribution.gcAmount)}
            </div>
            <div className="mt-1 pt-1 border-t border-amber-200/60 flex items-center justify-between text-[10px] text-amber-900/80">
              <span>Pool ${formatCurrency(activeScopeAttribution.gcPool)}</span>
              <span className="font-semibold text-emerald-800">Rem ${formatCurrency(activeScopeAttribution.gcRemaining)}</span>
            </div>
          </div>

          {/* 2. SSD */}
          <div className="px-3 py-2 rounded-xl bg-blue-50/60 border border-blue-200/80">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e]">
                SSD Share
              </span>
              <span className="text-[11px] font-bold text-[#1c398e]">
                {formatAttributionPct(activeScopeAttribution.ssdPct)}
              </span>
            </div>
            <div className="text-sm font-black text-[#1c398e] mt-0.5">
              ${formatCurrency(activeScopeAttribution.ssdAmount)}
            </div>
            <div className="mt-1 pt-1 border-t border-blue-200/60 flex items-center justify-between text-[10px] text-blue-900/80">
              <span>Pool ${formatCurrency(activeScopeAttribution.ssdPool)}</span>
              <span className="font-semibold text-emerald-800">Rem ${formatCurrency(activeScopeAttribution.ssdRemaining)}</span>
            </div>
          </div>

          {/* 3. SPD */}
          <div className="px-3 py-2 rounded-xl bg-purple-50/60 border border-purple-200/80">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900">
                SPD Share
              </span>
              <span className="text-[11px] font-bold text-purple-900">
                {formatAttributionPct(activeScopeAttribution.spdPct)}
              </span>
            </div>
            <div className="text-sm font-black text-purple-950 mt-0.5">
              ${formatCurrency(activeScopeAttribution.spdAmount)}
            </div>
            <div className="mt-1 pt-1 border-t border-purple-200/60 flex items-center justify-between text-[10px] text-purple-900/80">
              <span>Pool ${formatCurrency(activeScopeAttribution.spdPool)}</span>
              <span className="font-semibold text-emerald-800">Rem ${formatCurrency(activeScopeAttribution.spdRemaining)}</span>
            </div>
          </div>

          {/* 4. Union */}
          <div
            className={`px-3 py-2 rounded-xl border ${
              activeScopeAttribution.overPoolDeficitAmount > 0
                ? 'bg-rose-50/80 border-rose-300'
                : 'bg-emerald-50/60 border-emerald-200/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  activeScopeAttribution.overPoolDeficitAmount > 0 ? 'text-rose-900' : 'text-emerald-900'
                }`}
              >
                Union {activeScopeAttribution.overPoolDeficitAmount > 0 ? '(Incl. Deficit)' : 'Share'}
              </span>
              <span
                className={`text-[11px] font-bold ${
                  activeScopeAttribution.overPoolDeficitAmount > 0 ? 'text-rose-900' : 'text-emerald-900'
                }`}
              >
                {formatAttributionPct(activeScopeAttribution.unionPct)}
              </span>
            </div>
            <div
              className={`text-sm font-black mt-0.5 ${
                activeScopeAttribution.overPoolDeficitAmount > 0 ? 'text-rose-950' : 'text-emerald-950'
              }`}
            >
              ${formatCurrency(activeScopeAttribution.unionTotalAmount)}
            </div>
            <div
              className={`mt-1 pt-1 border-t flex items-center justify-between text-[10px] ${
                activeScopeAttribution.overPoolDeficitAmount > 0
                  ? 'border-rose-200/80 text-rose-900'
                  : 'border-emerald-200/60 text-emerald-900/80'
              }`}
            >
              <span>Pool ${formatCurrency(activeScopeAttribution.unionPool)}</span>
              {activeScopeAttribution.overPoolDeficitAmount > 0 ? (
                <span className="font-bold text-rose-800">
                  Deficit +${formatCurrency(activeScopeAttribution.overPoolDeficitAmount)}
                </span>
              ) : (
                <span className="font-semibold text-emerald-800">
                  Rem ${formatCurrency(activeScopeAttribution.unionRemaining)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unified Search, Secondary Quick-Filters & Pillar Toolbar (No Duplicate Step Buttons) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, POC, Lead, Union code, Action #, or OV27 Ref #..."
              className="w-full pl-9 pr-14 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c398e]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Secondary Sub-Filters (Needs My Vote, Pending OV27 Auth, Pending Notes, Flagged) */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {isLiaisonVoter && (
              <button
                type="button"
                onClick={() =>
                  setNotesFilter(notesFilter === 'needs_my_vote' ? 'all' : 'needs_my_vote')
                }
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
                  notesFilter === 'needs_my_vote'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-950 border border-indigo-200'
                }`}
              >
                <span>Needs My Vote</span>
                <span className={notesFilter === 'needs_my_vote' ? 'font-extrabold' : 'text-indigo-700'}>
                  ({myVotingQueueProposals.length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setNotesFilter(notesFilter === 'pending_auth' ? 'all' : 'pending_auth')
              }
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
                notesFilter === 'pending_auth'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
              }`}
            >
              <span>Pending OV27</span>
              <span className={notesFilter === 'pending_auth' ? 'font-extrabold' : 'text-slate-500'}>
                ({pendingAuthCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setNotesFilter(notesFilter === 'unread' ? 'all' : 'unread')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
                notesFilter === 'unread'
                  ? 'bg-[#1c398e] text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
              }`}
            >
              <span>Unread Notes</span>
              <span className={notesFilter === 'unread' ? 'font-extrabold' : 'text-slate-500'}>
                ({totalUnreadProposalsCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setNotesFilter(notesFilter === 'flagged' ? 'all' : 'flagged')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
                notesFilter === 'flagged'
                  ? 'bg-amber-700 text-white shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
              }`}
            >
              <span>Flagged</span>
              <span className={notesFilter === 'flagged' ? 'font-extrabold' : 'text-slate-500'}>
                ({totalFlaggedProposalsCount})
              </span>
            </button>
          </div>

          {/* Strategic Pillar Selector */}
          <div
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs border transition ${
              selectedPillar !== 'all'
                ? 'bg-blue-50/80 border-blue-300 text-[#1c398e]'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <Layers
              className={`w-3.5 h-3.5 shrink-0 ${
                selectedPillar !== 'all' ? 'text-[#1c398e]' : 'text-slate-400'
              }`}
            />
            <select
              value={selectedPillar}
              onChange={(e) => setSelectedPillar(e.target.value as PillarFilterKey)}
              title="Filter approved proposals by Strategic Pillar"
              className="bg-transparent border-none text-xs font-bold focus:outline-none cursor-pointer max-w-[165px] truncate"
            >
              <option value="all">All Pillars</option>
              {PILLAR_FILTER_OPTIONS.map((p) => (
                <option key={p.key} value={p.key} title={p.fullTitle}>
                  {p.shortLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          {(notesFilter !== 'all' ||
            selectedPillar !== 'all' ||
            searchQuery.trim().length > 0) && (
            <button
              type="button"
              onClick={() => {
                setNotesFilter('all');
                setSelectedPillar('all');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer shrink-0 transition"
              title="Reset all search and filter settings to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Approved Proposals List — Three-Step Governance Chain (Step 3 -> Step 4 -> Step 5) */}
      {filteredApproved.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {notesFilter === 'needs_my_vote'
              ? 'All Caught Up on Your Step 4 Votes'
              : notesFilter === 'step4_liaison'
              ? 'No Proposals Awaiting Step 4 Liaison Vote'
              : notesFilter === 'pending_auth'
              ? 'No Proposals Pending Step 5 SSD OV27 Committee Authorization'
              : notesFilter === 'authorized'
              ? 'No Step 5 Authorized Projects Yet'
              : notesFilter === 'unread'
              ? 'No Unread Notes on Approved Proposals'
              : notesFilter === 'flagged'
              ? 'No Flagged Approved Proposals'
              : 'No Approved Proposals Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {notesFilter === 'needs_my_vote'
              ? 'You have already recorded your Step 4 recommendation vote on all approved proposals in your assigned Voting Unions.'
              : notesFilter === 'step4_liaison'
              ? 'All Union-voted proposals in this scope have already received their Division Liaison vote or Step 5 authorization.'
              : notesFilter === 'pending_auth'
              ? 'All Union-voted proposals in this scope have already been authorized at Step 5 by the SSD OV27 Committee.'
              : notesFilter === 'authorized'
              ? 'Once the SSD OV27 Committee authorizes Union-voted proposals at Step 5, they will appear here.'
              : notesFilter === 'unread'
              ? 'You are all caught up! There are currently no pending review remarks or messages to read.'
              : notesFilter === 'flagged'
              ? 'All approved proposals in this scope pass Playbook and KPI alignment checks without flags.'
              : searchQuery
              ? 'No approved proposals match your current search criteria.'
              : selectedPillar !== 'all'
              ? 'No approved proposals match the selected Strategic Pillar.'
              : !isDivisionSuperAdmin
              ? `No approved proposals recorded yet for ${UNION_ACRONYMS[currentUser.union] || currentUser.union || 'your assigned Union'}. Proposals that receive official Step 3 Committee Action votes will appear here.`
              : selectedUnion !== 'all'
              ? `No approved proposals found for ${UNION_ACRONYMS[selectedUnion] || selectedUnion}.`
              : 'Proposals that receive official Step 3 Union Committee Action vote approval will appear here.'}
          </p>
          {(notesFilter !== 'all' ||
            selectedPillar !== 'all' ||
            searchQuery ||
            ((isDivisionSuperAdmin || (isLiaison && liaisonUnions.length > 1)) && selectedUnion !== 'all')) && (
            <button
              onClick={() => {
                setNotesFilter('all');
                setSelectedPillar('all');
                setSearchQuery('');
                setSelectedUnion(isDivisionSuperAdmin || isLiaison ? 'all' : currentUser.union || 'all');
              }}
              className="mt-4 px-4 py-2 text-xs font-bold text-[#1c398e] bg-blue-50 border border-blue-200/60 rounded-xl hover:bg-blue-100/70 transition-colors shadow-2xs cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApproved.map((proposal) => {
            const meta = approvedMetaMap.get(proposal.id);
            const funding = meta ? meta.funding : getProposalFunding(proposal);
            const unreadNotes = getUnreadNotesCount(proposal);
            const totalNotes = proposal.reviewNotes?.length || 0;
            const canonicalGoal = meta ? meta.canonicalGoal : getCanonicalDivisionProject(proposal.divisionProject);
            const pillarShortLabel = meta ? meta.pillarShortLabel : getProposalPillarShortLabel(proposal);
            const unionAcronym = meta ? meta.unionAcronym : (UNION_ACRONYMS[proposal.union] || proposal.union || 'SSD');
            const alignmentFlagCount = meta ? meta.alignmentFlagCount : 0;
            const isDivisionAuthorized = meta ? meta.isDivisionAuthorized : Boolean(proposal.divisionApproval?.authorized);
            const stepStatus = meta ? meta.stepStatus : getProposalStepStatus(proposal);

            return (
              <div
                key={proposal.id}
                onClick={() => handleOpenProposal(proposal.id)}
                className={`group bg-white border rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer ${
                  isDivisionAuthorized
                    ? 'border-emerald-200/90 hover:border-emerald-400'
                    : 'border-slate-200/90 hover:border-blue-300'
                }`}
              >
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  {/* Left Section: Union, Current Step Badge, Pillar, Flags, Notes, Full Title & Objective */}
                  <div className="flex-1 min-w-0 xl:pr-2">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      {/* Union Code */}
                      <span className="text-xs font-extrabold text-[#1c398e] tracking-tight">
                        {unionAcronym}
                      </span>

                      <span className="text-slate-300">·</span>

                      {/* Current Step Pill */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          stepStatus.step5Complete
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : stepStatus.liaisonSummary.allLiaisonsVoted
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                        }`}
                        title={stepStatus.currentStepDescription}
                      >
                        {stepStatus.step5Complete ? (
                          <ShieldCheck className="w-2.5 h-2.5" />
                        ) : (
                          <Clock className="w-2.5 h-2.5" />
                        )}
                        <span>{stepStatus.currentStepShortBadge}</span>
                      </span>

                      {/* Strategic Pillar Short Label */}
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                        title={proposal.strategicFocus || 'Strategic Pillar'}
                      >
                        {pillarShortLabel}
                      </span>

                      {/* Interactive Alignment Flag Badge */}
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

                      {/* Pending / Unread Note Badge */}
                      {unreadNotes > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenNotes(proposal.id, e)}
                          title="Click to view unread review notes"
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3 text-amber-600 fill-amber-500/20" />
                          <span>{unreadNotes} New {unreadNotes === 1 ? 'Note' : 'Notes'} Pending</span>
                        </button>
                      ) : totalNotes > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenNotes(proposal.id, e)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          <span>{totalNotes} {totalNotes === 1 ? 'note' : 'notes'}</span>
                        </button>
                      ) : null}
                    </div>

                    {/* Proposal Title (up to 2 lines so titles are never crushed) */}
                    <div
                      className="font-bold text-slate-900 text-sm sm:text-[15px] group-hover:text-[#1c398e] transition leading-snug line-clamp-2"
                      title={(proposal.title || '').trim() || 'Untitled Proposal'}
                    >
                      {(proposal.title || '').trim() || 'Untitled Proposal'}
                    </div>

                    {/* Strategic Objective, POC & Lead */}
                    {(() => {
                      const contact = meta ? meta.contactDisplay : getProposalContactDisplay(proposal);
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                          {canonicalGoal && (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                              <Layers className="w-3 h-3 text-[#1c398e] shrink-0" />
                              <span className="truncate max-w-[260px] sm:max-w-none">{canonicalGoal}</span>
                            </span>
                          )}
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium"
                            title={contact.tooltip}
                          >
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {contact.primaryName}
                              {contact.hasDistinctLead ? ` · Lead: ${contact.leadName}` : ''}
                            </span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Middle Section: 3-Step Post-Approval Governance Chain (Step 3 -> Step 4 -> Step 5) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">
                    {/* STEP 3: UNION COMMITTEE VOTE — Passed (Green) */}
                    <div className="px-2.5 py-2 rounded-xl bg-emerald-600 text-white border border-emerald-700 min-w-[140px] shadow-2xs">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-100">
                          Step 3 · Passed ✓
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-white">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </span>
                      </div>
                      <div className="mt-0.5 font-black text-xs text-white tabular-nums truncate">
                        {proposal.unionApproval?.actionNumber
                          ? `#${proposal.unionApproval.actionNumber}`
                          : 'Voted'}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-100/90 truncate">
                        {proposal.unionApproval?.actionDate ? (
                          <span className="inline-flex items-center gap-0.5 tabular-nums">
                            <Calendar className="w-2.5 h-2.5 text-emerald-200 shrink-0" />
                            {proposal.unionApproval.actionDate}
                          </span>
                        ) : (
                          <span>Union Committee Voted</span>
                        )}
                      </div>
                    </div>

                    {/* Arrow Connector */}
                    <ArrowRight className="hidden sm:block w-3 h-3 text-slate-300 shrink-0" />

                    {/* STEP 4: DIVISION LIAISON REVIEW & VOTE — Green when Passed, Amber if Revision Requested, Indigo when Awaiting */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProposal(proposal.id);
                      }}
                      title="Click to open Approved Proposal View and review/cast Step 4 Liaison Vote"
                      className={`px-2.5 py-2 rounded-xl border min-w-[145px] transition cursor-pointer shadow-2xs ${
                        stepStatus.step4Complete
                          ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                          : stepStatus.liaisonSummary.hasRevisionRequested
                          ? 'bg-amber-50 border-2 border-amber-400 hover:bg-amber-100/80'
                          : 'bg-indigo-50/70 border-2 border-indigo-300 hover:bg-indigo-100/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`text-[9px] font-extrabold uppercase tracking-wider ${
                            stepStatus.step4Complete
                              ? 'text-emerald-100'
                              : stepStatus.liaisonSummary.hasRevisionRequested
                              ? 'text-amber-900'
                              : 'text-indigo-800'
                          }`}
                        >
                          {stepStatus.step4Complete
                            ? 'Step 4 · Passed ✓'
                            : stepStatus.liaisonSummary.hasRevisionRequested
                            ? 'Step 4 · Revision'
                            : 'Step 4 · Liaison Vote'}
                        </span>
                        {stepStatus.step4Complete ? (
                          <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
                        ) : stepStatus.liaisonSummary.hasRevisionRequested ? (
                          <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                        ) : (
                          <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                        )}
                      </div>
                      <div
                        className={`mt-0.5 font-bold text-xs truncate ${
                          stepStatus.step4Complete
                            ? 'text-white'
                            : stepStatus.liaisonSummary.hasRevisionRequested
                            ? 'text-amber-950'
                            : 'text-indigo-950'
                        }`}
                      >
                        {stepStatus.liaisonSummary.progressLabel}
                      </div>
                      <div
                        className={`mt-0.5 text-[10px] truncate ${
                          stepStatus.step4Complete
                            ? 'text-emerald-100/90'
                            : stepStatus.liaisonSummary.hasRevisionRequested
                            ? 'text-amber-800'
                            : 'text-indigo-700/90'
                        }`}
                      >
                        {stepStatus.liaisonSummary.votes.length > 0
                          ? `By ${stepStatus.liaisonSummary.votes[stepStatus.liaisonSummary.votes.length - 1].liaisonName.split(' ')[0]}`
                          : isLiaison
                          ? 'Click to Vote →'
                          : 'Awaiting Liaison vote'}
                      </div>
                    </div>

                    {/* Arrow Connector */}
                    <ArrowRight className="hidden sm:block w-3 h-3 text-slate-300 shrink-0" />

                    {/* STEP 5: SSD OV27 COMMITTEE AUTHORIZATION — Green when Authorized */}
                    {isDivisionAuthorized ? (
                      <div
                        onClick={(e) => {
                          if (canAuthorizeDivision) {
                            e.stopPropagation();
                            setAuthorizingProposalId(proposal.id);
                          }
                        }}
                        title={
                          canAuthorizeDivision
                            ? 'Click to manage or update Step 5 SSD OV27 Committee authorization'
                            : `Authorized by ${proposal.divisionApproval?.authorizedBy || 'SSD OV27 Committee'} on ${proposal.divisionApproval?.authorizedDate || ''}`
                        }
                        className={`px-2.5 py-2 rounded-xl bg-emerald-600 text-white border border-emerald-700 min-w-[170px] shadow-2xs ${
                          canAuthorizeDivision ? 'hover:bg-emerald-700 cursor-pointer transition' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-100">
                            Step 5 · Passed ✓
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[9px] font-black uppercase">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>OV27</span>
                          </span>
                        </div>
                        <div className="mt-0.5 font-black text-xs text-white flex items-center gap-1 truncate">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                          <span className="truncate">
                            {proposal.divisionApproval?.referenceNumber
                              ? `Ref #${proposal.divisionApproval.referenceNumber}`
                              : 'Authorized ✓'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-100/90 truncate">
                          {proposal.divisionApproval?.authorizedDate && (
                            <span className="tabular-nums">{proposal.divisionApproval.authorizedDate}</span>
                          )}
                          {proposal.divisionApproval?.authorizedBy && (
                            <span className="truncate">
                              · {proposal.divisionApproval.authorizedBy.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`px-2.5 py-2 rounded-xl border min-w-[170px] flex items-center justify-between gap-2 ${
                          stepStatus.liaisonSummary.allLiaisonsVoted
                            ? 'bg-amber-50 border-2 border-amber-400'
                            : 'bg-slate-100/80 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-[9px] font-extrabold uppercase tracking-wider ${
                                stepStatus.liaisonSummary.allLiaisonsVoted
                                  ? 'text-amber-900'
                                  : 'text-slate-500'
                              }`}
                            >
                              Step 5 · SSD OV27 Committee
                            </span>
                          </div>
                          <div
                            className={`mt-0.5 font-bold text-xs flex items-center gap-1 ${
                              stepStatus.liaisonSummary.allLiaisonsVoted
                                ? 'text-amber-950'
                                : 'text-slate-600'
                            }`}
                          >
                            <Clock
                              className={`w-3 h-3 shrink-0 ${
                                stepStatus.liaisonSummary.allLiaisonsVoted
                                  ? 'text-amber-700'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span>
                              {stepStatus.liaisonSummary.allLiaisonsVoted
                                ? 'Ready for OV27'
                                : 'Locked (Step 4)'}
                            </span>
                          </div>
                          <div
                            className={`mt-0.5 text-[10px] truncate ${
                              stepStatus.liaisonSummary.allLiaisonsVoted
                                ? 'text-amber-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {stepStatus.liaisonSummary.allLiaisonsVoted
                              ? 'Liaison vote complete'
                              : 'Awaiting Liaison vote'}
                          </div>
                        </div>

                        {canAuthorizeDivision &&
                          (stepStatus.liaisonSummary.allLiaisonsVoted ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAuthorizingProposalId(proposal.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer shrink-0"
                              title="Step 5: Certify and authorize as an official SSD OV27 Committee Project"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Authorize</span>
                            </button>
                          ) : isDivisionSuperAdmin ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAuthorizingProposalId(proposal.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 font-bold text-[10px] shadow-2xs transition cursor-pointer shrink-0"
                              title="Step 4 Liaison vote not recorded yet. Click to open Step 5 with Super Admin Override checkbox."
                            >
                              <span>Override</span>
                            </button>
                          ) : null)}
                      </div>
                    )}
                  </div>

                  {/* Far Right Section: Proposal Total + Actions on Top Row, Clean Entity Dollar Ledger Underneath */}
                  <div className="flex flex-col items-stretch xl:items-end justify-center gap-2 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">
                    {/* Top Row: Proposal Total & Quick Actions */}
                    <div className="flex items-center justify-between xl:justify-end gap-3">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-bold ${
                            isDivisionAuthorized ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {isDivisionAuthorized ? 'Step 5 Authorized' : 'Step 3 Voted'}
                        </span>
                        <span
                          className={`font-black text-base sm:text-lg tabular-nums ${
                            isDivisionAuthorized ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          ${formatCurrency(funding)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPrint(proposal);
                          }}
                          title="Print / Export PDF Audit Certificate"
                          className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition shadow-2xs cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProposal(proposal.id);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                          title="Open Full Approved Proposal View & Step 4 Liaison Vote"
                        >
                          <span>View Proposal</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Segmented Entity Dollar Ledger (GC $ | SSD $ | SPD $ | Union $) with Cents */}
                    {(() => {
                      const attr = fundingAttribution.byProposalId[proposal.id];
                      if (!attr || funding <= 0) return null;

                      if (attr.poolStatus === 'pool_depleted') {
                        return (
                          <div className="flex xl:justify-end">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px] font-bold tabular-nums"
                              title="Union Total Pool was already 100% depleted by prior approved proposals. GC, SSD, and SPD are $0; Union covers 100% of this deficit."
                            >
                              <span className="text-rose-700 font-semibold">Pool Depleted · Union</span>
                              <span className="font-extrabold">
                                ${formatCurrency(attr.unionAmount)}
                              </span>
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-wrap xl:justify-end">
                          <div className="inline-flex flex-wrap items-center divide-x divide-slate-200/90 rounded-lg border border-slate-200/90 bg-white overflow-hidden shadow-2xs text-[11px] tabular-nums">
                            {/* GC */}
                            <span
                              className="px-2 py-0.5 bg-amber-50/70 text-amber-950"
                              title={`GC Share (${formatAttributionPct(attr.gcPct)}): $${formatCurrency(attr.gcAmount)}`}
                            >
                              <span className="font-bold text-amber-800">GC</span>{' '}
                              <span className="font-extrabold">
                                ${formatCurrency(attr.gcAmount)}
                              </span>
                            </span>

                            {/* SSD */}
                            <span
                              className="px-2 py-0.5 bg-blue-50/70 text-[#1c398e]"
                              title={`SSD Share (${formatAttributionPct(attr.ssdPct)}): $${formatCurrency(attr.ssdAmount)}`}
                            >
                              <span className="font-bold text-blue-700">SSD</span>{' '}
                              <span className="font-extrabold">
                                ${formatCurrency(attr.ssdAmount)}
                              </span>
                            </span>

                            {/* SPD */}
                            {attr.spdAmount > 0 && (
                              <span
                                className="px-2 py-0.5 bg-purple-50/70 text-purple-950"
                                title={`SPD Share (${formatAttributionPct(attr.spdPct)}): $${formatCurrency(attr.spdAmount)}`}
                              >
                                <span className="font-bold text-purple-700">SPD</span>{' '}
                                <span className="font-extrabold">
                                  ${formatCurrency(attr.spdAmount)}
                                </span>
                              </span>
                            )}

                            {/* Union */}
                            {attr.unionAmount > 0 && (
                              <span
                                className={`px-2 py-0.5 ${
                                  attr.overPoolDeficitAmount > 0
                                    ? 'bg-rose-50 text-rose-950'
                                    : 'bg-emerald-50/70 text-emerald-950'
                                }`}
                                title={
                                  attr.overPoolDeficitAmount > 0
                                    ? `Union Share (${formatAttributionPct(attr.unionPct)}, includes $${formatCurrency(attr.overPoolDeficitAmount)} over-pool deficit)`
                                    : `Union Share (${formatAttributionPct(attr.unionPct)}): $${formatCurrency(attr.unionAmount)}`
                                }
                              >
                                <span
                                  className={`font-bold ${
                                    attr.overPoolDeficitAmount > 0 ? 'text-rose-700' : 'text-emerald-700'
                                  }`}
                                >
                                  Union
                                </span>{' '}
                                <span className="font-extrabold">
                                  ${formatCurrency(attr.unionAmount)}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Division Treasury Authorization Modal */}
      {authorizingProposal && (
        <DivisionAuthorizationModal
          isOpen={Boolean(authorizingProposalId)}
          onClose={() => setAuthorizingProposalId(null)}
          proposal={authorizingProposal}
          currentUser={currentUser}
          assignedLiaisons={
            authorizingProposal
              ? liaisonsByUnionMap.get(getCanonicalUnion(authorizingProposal.union)) || []
              : []
          }
          onConfirmAuthorization={handleConfirmAuthorization}
        />
      )}
    </div>
  );
}
