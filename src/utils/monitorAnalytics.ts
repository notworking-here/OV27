import {
  Proposal,
  UserAccount,
  UNIONS,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getUserVotingUnions,
  isUserLiaisonEligible,
} from '../types';

export interface PillarMeta {
  number: number;
  code: string;
  name: string;
  fullName: string;
  color: string;
  softColor: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  badge: string;
}

export const PILLAR_META: PillarMeta[] = [
  {
    number: 1,
    code: 'P1',
    name: 'Prayer & Training',
    fullName: 'Prayer, Training, and Inspiration',
    color: '#2563eb', // Solid Blue
    softColor: '#60a5fa',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-600',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    number: 2,
    code: 'P2',
    name: 'Bold Media & Tools',
    fullName: 'Bold Initiatives, Materials, and Tools',
    color: '#7c3aed', // Solid Purple
    softColor: '#c084fc',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    dot: 'bg-purple-600',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    number: 3,
    code: 'P3',
    name: 'Proclamation & Harvesting',
    fullName: 'Proclamation, Harvesting, and Disciple Making',
    color: '#059669', // Solid Emerald
    softColor: '#34d399',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
];

export interface ProposalBudgetBreakdown {
  divisionFunding: number;
  localFunding: number;
  totalCost: number;
}

export function getProposalBudgetBreakdown(p: Proposal): ProposalBudgetBreakdown {
  let divisionFunding = 0;
  let localFunding = 0;

  for (const item of p.budgetItems || []) {
    divisionFunding += Number(item.divisionFunding ?? item.gcFunding) || 0;
    localFunding += Number(item.localFunding) || 0;
  }

  return {
    divisionFunding,
    localFunding,
    totalCost: divisionFunding + localFunding,
  };
}

export function getEntityBudgetConfig(
  unionName: string,
  allocations: Record<string, number>,
  matchingPledges: Record<string, number>
): { divisionAlloc: number; matchingPledge: number; totalCap: number } {
  const canon = getCanonicalUnion(unionName);
  const acronym = UNION_ACRONYMS[unionName] || UNION_ACRONYMS[canon] || '';

  const resolveVal = (rec: Record<string, number>): number => {
    if (!rec) return 0;
    if (rec[unionName] !== undefined) return Number(rec[unionName]) || 0;
    if (rec[canon] !== undefined) return Number(rec[canon]) || 0;
    if (acronym && rec[acronym] !== undefined) return Number(rec[acronym]) || 0;

    const canonLower = canon.toLowerCase();
    for (const [k, v] of Object.entries(rec)) {
      if (getCanonicalUnion(k).toLowerCase() === canonLower) {
        return Number(v) || 0;
      }
    }
    return 0;
  };

  const divisionAlloc = resolveVal(allocations);
  const matchingPledge = resolveVal(matchingPledges);
  const totalCap = divisionAlloc + matchingPledge;
  return { divisionAlloc, matchingPledge, totalCap };
}

export function getPillarIndex(p: Proposal): number {
  const focus = (p.strategicFocus || '').toLowerCase();
  const proj = (p.divisionProject || '').toLowerCase();

  // Pillar 1: Prayer, Training, and Inspiration
  if (
    focus.includes('prayer') ||
    focus.includes('training') ||
    focus.includes('inspiration') ||
    proj.includes('creators') ||
    proj.includes('regional media')
  ) {
    return 0;
  }

  // Pillar 3: Proclamation, Harvesting, and Disciple Making
  if (
    focus.includes('harvesting') ||
    focus.includes('disciple') ||
    proj.includes('harvesting') ||
    proj.includes('marketing campaign')
  ) {
    return 2;
  }

  // Pillar 2 (Default / Broadest): Bold Initiatives, Materials, and Tools
  return 1;
}

export function calculatePillarCaps(
  totalCap: number,
  pillarPercentages: [number, number, number]
): [number, number, number] {
  return [
    Math.round((totalCap * pillarPercentages[0]) / 100),
    Math.round((totalCap * pillarPercentages[1]) / 100),
    Math.round((totalCap * pillarPercentages[2]) / 100),
  ];
}

export interface UnionAnalyticsItem {
  union: string;
  acronym: string;
  category: string;
  divisionAlloc: number;
  matchingPledge: number;
  totalCap: number;
  approvedCount: number;
  approvedBudget: number;
  approvedDivisionGrant: number;
  approvedLocalMatch: number;
  pendingCount: number;
  pendingBudget: number;
  pendingDivisionGrant: number;
  pendingLocalMatch: number;
  draftCount: number;
  totalCount: number;
  totalCommittedAndPending: number;
  remainingBudget: number;
  projectedRemaining: number;
  utilizationPct: number;
  isOverAllocated: boolean;
  overAllocationAmount: number;
  isApprovedExceeded: boolean;
  approvedPillars: [number, number, number];
  pendingPillars: [number, number, number];
  proposalMakersCount: number;
  treasurerName: string;
  liaisonName: string;
}

export interface TerritoryTotals {
  totalDivisionPool: number;
  totalMatchingPool: number;
  totalCapPool: number;
  totalApprovedBudget: number;
  totalApprovedDivisionGrant: number;
  totalApprovedLocalMatch: number;
  totalPendingBudget: number;
  totalPendingDivisionGrant: number;
  totalPendingLocalMatch: number;
  totalApprovedCount: number;
  totalPendingCount: number;
  totalDraftCount: number;
  activeUnionsCount: number;
  totalUnionsCount: number;
  totalProjectsCount: number;
  globalRemainingPool: number;
  globalUtilizationPct: number;
  divisionPillarsApproved: [number, number, number];
  divisionPillarsPending: [number, number, number];
}

function isUnionNameOrAcronym(val?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();

  // Check if it matches an actual Union territory
  if (UNIONS.some((u) => u.toLowerCase() === lower)) return true;

  // Check if it matches a known Union acronym or alias
  if (Object.keys(UNION_ACRONYMS).some((k) => k.toLowerCase() === lower)) return true;
  if (Object.values(UNION_ACRONYMS).some((v) => v.toUpperCase() === upper)) return true;

  return false;
}

export function computeUnionAnalytics(
  visibleUnionCategories: Array<{ category: string; unions: string[] }>,
  allocations: Record<string, number>,
  matchingPledges: Record<string, number>,
  proposals: Proposal[],
  users: UserAccount[] = []
): UnionAnalyticsItem[] {
  const list: UnionAnalyticsItem[] = [];

  for (const cat of visibleUnionCategories) {
    for (const unionName of cat.unions) {
      const canon = getCanonicalUnion(unionName);
      const acronym = UNION_ACRONYMS[unionName] || UNION_ACRONYMS[canon] || '';

      const { divisionAlloc, matchingPledge, totalCap } = getEntityBudgetConfig(
        unionName,
        allocations,
        matchingPledges
      );

      const unionProposals = proposals.filter((p) => {
        const pCanon = getCanonicalUnion(p.union);
        if (pCanon === canon) return true;
        if (acronym && (p.union || '').trim().toUpperCase() === acronym) return true;
        return false;
      });

      let approvedCount = 0;
      let approvedBudget = 0;
      let approvedDivisionGrant = 0;
      let approvedLocalMatch = 0;

      let pendingCount = 0;
      let pendingBudget = 0;
      let pendingDivisionGrant = 0;
      let pendingLocalMatch = 0;

      let draftCount = 0;

      const approvedPillars: [number, number, number] = [0, 0, 0];
      const pendingPillars: [number, number, number] = [0, 0, 0];

      // Count unique proposal makers across this territory
      const makerSet = new Set<string>();

      for (const p of unionProposals) {
        const { divisionFunding, localFunding, totalCost } = getProposalBudgetBreakdown(p);
        const pillarIdx = getPillarIndex(p);

        const makerKey = (
          p.userEmail ||
          p.pointOfContact?.email ||
          p.userId ||
          p.userName ||
          p.pointOfContact?.name ||
          ''
        ).trim().toLowerCase();
        if (makerKey) {
          makerSet.add(makerKey);
        }

        if (p.status === 'approved') {
          approvedCount += 1;
          approvedBudget += totalCost;
          approvedDivisionGrant += divisionFunding;
          approvedLocalMatch += localFunding;
          approvedPillars[pillarIdx] += totalCost;
        } else if (p.status === 'under_review' || p.status === 'submitted') {
          pendingCount += 1;
          pendingBudget += totalCost;
          pendingDivisionGrant += divisionFunding;
          pendingLocalMatch += localFunding;
          pendingPillars[pillarIdx] += totalCost;
        } else {
          draftCount += 1;
        }
      }

      const proposalMakersCount = makerSet.size;

      // Identify Assigned Coor / Treasurers for this Union
      const matchingTreasurers = users.filter((u) => {
        if (u.role !== 'coordinator' && u.role !== 'treasurer') return false;
        const uCanon = getCanonicalUnion(u.union);
        if (uCanon === canon) return true;
        if (acronym && (u.union || '').trim().toUpperCase() === acronym) return true;
        if (
          u.assignedUnions &&
          u.assignedUnions.some(
            (au) =>
              getCanonicalUnion(au) === canon ||
              (acronym && au.trim().toUpperCase() === acronym)
          )
        ) {
          return true;
        }
        return false;
      });

      let treasurerName = '';
      if (matchingTreasurers.length > 0) {
        treasurerName = matchingTreasurers
          .map((u) => u.displayName || u.email)
          .filter((name) => name && !isUnionNameOrAcronym(name))
          .join(', ');
      } else {
        // Fallback: check committee approval officer on proposals
        for (const p of unionProposals) {
          if (p.unionApproval?.approvedBy) {
            const officer = p.unionApproval.approvedBy.trim();
            if (officer && !isUnionNameOrAcronym(officer)) {
              treasurerName = officer;
              break;
            }
          }
        }
      }

      // Identify Official Voting Division Liaisons for this Union (includes Division Admins acting as Liaisons; excludes Invitees)
      const matchingLiaisons = users.filter((u) => {
        if (!isUserLiaisonEligible(u)) return false;
        return getUserVotingUnions(u).includes(canon);
      });

      let liaisonName = '';
      if (matchingLiaisons.length > 0) {
        liaisonName = matchingLiaisons
          .map((u) => u.displayName || u.email)
          .filter((name) => name && !isUnionNameOrAcronym(name))
          .join(', ');
      }

      const effectiveCap = totalCap > 0 ? totalCap : divisionAlloc + matchingPledge;
      const totalCommittedAndPending = approvedBudget + pendingBudget;
      const remainingBudget = effectiveCap > 0 ? effectiveCap - approvedBudget : 0;
      const projectedRemaining = effectiveCap > 0 ? effectiveCap - totalCommittedAndPending : 0;
      const utilizationPct = effectiveCap > 0 ? (approvedBudget / effectiveCap) * 100 : 0;
      const isOverAllocated = effectiveCap > 0 && totalCommittedAndPending > effectiveCap;
      const overAllocationAmount = isOverAllocated ? totalCommittedAndPending - effectiveCap : 0;
      const isApprovedExceeded = effectiveCap > 0 && approvedBudget > effectiveCap;

      list.push({
        union: unionName,
        acronym,
        category: cat.category,
        divisionAlloc,
        matchingPledge,
        totalCap: effectiveCap,
        approvedCount,
        approvedBudget,
        approvedDivisionGrant,
        approvedLocalMatch,
        pendingCount,
        pendingBudget,
        pendingDivisionGrant,
        pendingLocalMatch,
        draftCount,
        totalCount: unionProposals.length,
        totalCommittedAndPending,
        remainingBudget,
        projectedRemaining,
        utilizationPct,
        isOverAllocated,
        overAllocationAmount,
        isApprovedExceeded,
        approvedPillars,
        pendingPillars,
        proposalMakersCount,
        treasurerName,
        liaisonName,
      });
    }
  }

  return list;
}

export function computeTerritoryTotals(
  unionAnalytics: UnionAnalyticsItem[],
  totalUnionsCount: number
): TerritoryTotals {
  let totalDivisionPool = 0;
  let totalMatchingPool = 0;
  let totalCapPool = 0;
  let totalApprovedBudget = 0;
  let totalApprovedDivisionGrant = 0;
  let totalApprovedLocalMatch = 0;
  let totalPendingBudget = 0;
  let totalPendingDivisionGrant = 0;
  let totalPendingLocalMatch = 0;
  let totalApprovedCount = 0;
  let totalPendingCount = 0;
  let totalDraftCount = 0;
  let activeUnionsCount = 0;

  const divisionPillarsApproved: [number, number, number] = [0, 0, 0];
  const divisionPillarsPending: [number, number, number] = [0, 0, 0];

  for (const u of unionAnalytics) {
    totalDivisionPool += u.divisionAlloc;
    totalMatchingPool += u.matchingPledge;
    totalCapPool += u.totalCap;

    totalApprovedBudget += u.approvedBudget;
    totalApprovedDivisionGrant += u.approvedDivisionGrant;
    totalApprovedLocalMatch += u.approvedLocalMatch;

    totalPendingBudget += u.pendingBudget;
    totalPendingDivisionGrant += u.pendingDivisionGrant;
    totalPendingLocalMatch += u.pendingLocalMatch;

    totalApprovedCount += u.approvedCount;
    totalPendingCount += u.pendingCount;
    totalDraftCount += u.draftCount;

    if (u.totalCount > 0) activeUnionsCount += 1;

    divisionPillarsApproved[0] += u.approvedPillars[0];
    divisionPillarsApproved[1] += u.approvedPillars[1];
    divisionPillarsApproved[2] += u.approvedPillars[2];

    divisionPillarsPending[0] += u.pendingPillars[0];
    divisionPillarsPending[1] += u.pendingPillars[1];
    divisionPillarsPending[2] += u.pendingPillars[2];
  }

  const totalProjectsCount = totalApprovedCount + totalPendingCount + totalDraftCount;
  const globalRemainingPool = totalCapPool > 0 ? totalCapPool - totalApprovedBudget : 0;
  const globalUtilizationPct = totalCapPool > 0 ? (totalApprovedBudget / totalCapPool) * 100 : 0;

  return {
    totalDivisionPool,
    totalMatchingPool,
    totalCapPool,
    totalApprovedBudget,
    totalApprovedDivisionGrant,
    totalApprovedLocalMatch,
    totalPendingBudget,
    totalPendingDivisionGrant,
    totalPendingLocalMatch,
    totalApprovedCount,
    totalPendingCount,
    totalDraftCount,
    activeUnionsCount,
    totalUnionsCount,
    totalProjectsCount,
    globalRemainingPool,
    globalUtilizationPct,
    divisionPillarsApproved,
    divisionPillarsPending,
  };
}
