import { Proposal, UNIONS, UNION_ACRONYMS, getCanonicalUnion } from '../types';

export interface OfficialUnionAppropriation {
  distributionPct: number; // Base distribution % (sums to 100%)
  ssd: number;             // SSD Appropriation ($2,000,000 total)
  gc: number;              // GC Appropriation ($1,100,000 total)
  baseTotal: number;       // SSD + GC ($3,100,000 total)
  spd: number;             // SPD Contribution ($125,000 total)
  grandTotal: number;      // SSD + GC + SPD ($3,225,000 total)
}

/**
 * Official OneVoice27 Spreadsheet Breakdown by Canonical Union
 * Matches the official distribution table row-for-row:
 * - SSD Appropriation: $2,000,000
 * - GC Appropriation:  $1,100,000
 * - Base Total:        $3,100,000
 * - SPD Contribution:    $125,000
 * - Grand Total:       $3,225,000
 */
export const OFFICIAL_UNION_APPROPRIATION_BREAKDOWN: Record<string, OfficialUnionAppropriation> = {
  // CPUC - ECPUC 50/50 (6.00%)
  'East Central Philippine Union Conference': {
    distributionPct: 6,
    ssd: 120000,
    gc: 66000,
    baseTotal: 186000,
    spd: 0,
    grandTotal: 186000,
  },
  // CPUC - WCPUM 50/50 (6.00%)
  'West Central Philippine Union Mission': {
    distributionPct: 6,
    ssd: 120000,
    gc: 66000,
    baseTotal: 186000,
    spd: 0,
    grandTotal: 186000,
  },
  // EIUC (9.00% + $25k SPD)
  'East Indonesia Union Conference': {
    distributionPct: 9,
    ssd: 180000,
    gc: 99000,
    baseTotal: 279000,
    spd: 25000,
    grandTotal: 304000,
  },
  // MAUM (9.00% + $25k SPD)
  'Malaysia Union Mission': {
    distributionPct: 9,
    ssd: 180000,
    gc: 99000,
    baseTotal: 279000,
    spd: 25000,
    grandTotal: 304000,
  },
  // MYUM (9.00%)
  'Myanmar Union Mission': {
    distributionPct: 9,
    ssd: 180000,
    gc: 99000,
    baseTotal: 279000,
    spd: 0,
    grandTotal: 279000,
  },
  // NLPUM (NPUC) (6.00%)
  'Northern Luzon Philippine Union Mission': {
    distributionPct: 6,
    ssd: 120000,
    gc: 66000,
    baseTotal: 186000,
    spd: 0,
    grandTotal: 186000,
  },
  // SLPUM (NPUC) (6.00%)
  'Southern Luzon Philippine Union Mission': {
    distributionPct: 6,
    ssd: 120000,
    gc: 66000,
    baseTotal: 186000,
    spd: 0,
    grandTotal: 186000,
  },
  // SAC (5.00%)
  'Singapore Conference': {
    distributionPct: 5,
    ssd: 100000,
    gc: 55000,
    baseTotal: 155000,
    spd: 0,
    grandTotal: 155000,
  },
  // SEPUM (6.00%)
  'Southeastern Philippine Union Mission': {
    distributionPct: 6,
    ssd: 120000,
    gc: 66000,
    baseTotal: 186000,
    spd: 0,
    grandTotal: 186000,
  },
  // SEUM (11.00% + $25k SPD)
  'Southeastern Asia Union Mission': {
    distributionPct: 11,
    ssd: 220000,
    gc: 121000,
    baseTotal: 341000,
    spd: 25000,
    grandTotal: 366000,
  },
  'Southeastern Asia Union Mission (Oversees and Brunei)': {
    distributionPct: 11,
    ssd: 220000,
    gc: 121000,
    baseTotal: 341000,
    spd: 25000,
    grandTotal: 366000,
  },
  // SWPUC (6.00%)
  'Southwestern Philippine Union Conference': {
    distributionPct: 6,
    ssd: 120000,
    gc: 66000,
    baseTotal: 186000,
    spd: 0,
    grandTotal: 186000,
  },
  // TLM (5.00%)
  'Timor-Leste Mission': {
    distributionPct: 5,
    ssd: 100000,
    gc: 55000,
    baseTotal: 155000,
    spd: 0,
    grandTotal: 155000,
  },
  // WIUM - CIUM 50/50 (8.00% + $25k SPD)
  'Central Indonesia Union Mission': {
    distributionPct: 8,
    ssd: 160000,
    gc: 88000,
    baseTotal: 248000,
    spd: 25000,
    grandTotal: 273000,
  },
  // WIUM - WIUM 50/50 (8.00% + $25k SPD)
  'West Indonesia Union Mission': {
    distributionPct: 8,
    ssd: 160000,
    gc: 88000,
    baseTotal: 248000,
    spd: 25000,
    grandTotal: 273000,
  },
};

export const OFFICIAL_GRAND_TOTAL_BY_UNION: Record<string, number> = Object.fromEntries(
  Object.entries(OFFICIAL_UNION_APPROPRIATION_BREAKDOWN).map(([k, v]) => [k, v.grandTotal])
);

export function getOfficialUnionAppropriation(unionName?: string): OfficialUnionAppropriation {
  if (!unionName) {
    return {
      distributionPct: 0,
      ssd: 0,
      gc: 0,
      baseTotal: 0,
      spd: 0,
      grandTotal: 0,
    };
  }
  const canonical = getCanonicalUnion(unionName) || unionName;
  return (
    OFFICIAL_UNION_APPROPRIATION_BREAKDOWN[canonical] ||
    OFFICIAL_UNION_APPROPRIATION_BREAKDOWN[unionName] || {
      distributionPct: 0,
      ssd: 0,
      gc: 0,
      baseTotal: 0,
      spd: 0,
      grandTotal: 0,
    }
  );
}

export interface UnionPoolFormula {
  unionName: string;
  distributionPct: number;
  gcPool: number;
  ssdPool: number;
  spdPool: number;
  baseDivisionPool: number; // GC + SSD + SPD
  unionPledgePool: number;  // Union contribution / matching pledge configured in Settings
  totalPool: number;        // 100% Pool = GC + SSD + SPD + Union Pledge
  gcPoolPct: number;        // GC % of Total Pool (0-100)
  ssdPoolPct: number;       // SSD % of Total Pool (0-100)
  spdPoolPct: number;       // SPD % of Total Pool (0-100)
  unionPoolPct: number;     // Union % of Total Pool (0-100)
}

function resolveUnionMapValue(
  rec: Record<string, number> | undefined,
  unionName: string,
  canonical: string
): number | undefined {
  if (!rec || Object.keys(rec).length === 0) return undefined;
  if (rec[canonical] !== undefined) return Number(rec[canonical]);
  if (rec[unionName] !== undefined) return Number(rec[unionName]);

  const acronym = UNION_ACRONYMS[canonical] || UNION_ACRONYMS[unionName] || '';
  if (acronym && rec[acronym] !== undefined) return Number(rec[acronym]);

  const canonLower = canonical.toLowerCase();
  for (const [k, v] of Object.entries(rec)) {
    if (getCanonicalUnion(k).toLowerCase() === canonLower) {
      return Number(v);
    }
  }
  return undefined;
}

function getCachedBudgetMapsFallback(): {
  allocations: Record<string, number>;
  matchingPledges: Record<string, number>;
} {
  let allocations: Record<string, number> = {};
  let matchingPledges: Record<string, number> = {};
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const rawAlloc = localStorage.getItem('onevoice27_budget_allocations');
      if (rawAlloc) {
        const parsed = JSON.parse(rawAlloc);
        if (parsed && typeof parsed === 'object') allocations = parsed;
      }
      const rawMatch = localStorage.getItem('onevoice27_matching_pledges');
      if (rawMatch) {
        const parsed = JSON.parse(rawMatch);
        if (parsed && typeof parsed === 'object') matchingPledges = parsed;
      }
    } catch {
      // ignore storage errors
    }
  }
  return { allocations, matchingPledges };
}

function roundCents(val: number): number {
  if (!val || isNaN(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Computes how a Union's Total Pool (100%) is composed across GC, SSD, SPD, and Union Pledge.
 * Example (EIUC with $342,319 Union Pledge):
 * - GC: $99,000 (15.32%)
 * - SSD: $180,000 (27.85%)
 * - SPD: $25,000 (3.87%)
 * - Union: $342,319 (52.96%)
 * - Total Pool: $646,319 (100.00%)
 */
export function getUnionPoolFormula(
  unionName: string,
  allocations: Record<string, number> = {},
  matchingPledges: Record<string, number> = {}
): UnionPoolFormula {
  const canonical = getCanonicalUnion(unionName) || unionName;
  const official = getOfficialUnionAppropriation(canonical);

  const hasAllocations = allocations && Object.keys(allocations).length > 0;
  const hasMatching = matchingPledges && Object.keys(matchingPledges).length > 0;
  const cached = !hasAllocations || !hasMatching ? getCachedBudgetMapsFallback() : null;

  const effectiveAllocations = hasAllocations ? allocations : cached?.allocations || {};
  const effectiveMatching = hasMatching ? matchingPledges : cached?.matchingPledges || {};

  const rawAllocated = resolveUnionMapValue(effectiveAllocations, unionName, canonical);
  const allocatedDivisionPool = roundCents(
    rawAllocated !== undefined && !isNaN(rawAllocated) && rawAllocated > 0
      ? rawAllocated
      : official.grandTotal
  );

  let gcPool = official.gc;
  let ssdPool = official.ssd;
  let spdPool = official.spd;

  // If the admin modified the Union's Division Allocation away from the spreadsheet default,
  // scale GC, SSD, and SPD proportionally so gcPool + ssdPool + spdPool === allocatedDivisionPool.
  if (official.grandTotal > 0 && allocatedDivisionPool !== official.grandTotal) {
    const scale = allocatedDivisionPool / official.grandTotal;
    gcPool = roundCents(official.gc * scale);
    spdPool = roundCents(official.spd * scale);
    ssdPool = Math.max(0, roundCents(allocatedDivisionPool - gcPool - spdPool));
  } else if (official.grandTotal === 0 && allocatedDivisionPool > 0) {
    // Fallback 11/31 GC and 20/31 SSD ratio
    gcPool = roundCents(allocatedDivisionPool * (11 / 31));
    spdPool = 0;
    ssdPool = Math.max(0, roundCents(allocatedDivisionPool - gcPool));
  }

  const baseDivisionPool = roundCents(gcPool + ssdPool + spdPool);
  const resolvedMatching = resolveUnionMapValue(effectiveMatching, unionName, canonical);
  const unionPledgePool = Math.max(0, roundCents(Number(resolvedMatching) || 0));
  const totalPool = roundCents(baseDivisionPool + unionPledgePool);

  const gcPoolPct = totalPool > 0 ? (gcPool / totalPool) * 100 : 0;
  const ssdPoolPct = totalPool > 0 ? (ssdPool / totalPool) * 100 : 0;
  const spdPoolPct = totalPool > 0 ? (spdPool / totalPool) * 100 : 0;
  const unionPoolPct = totalPool > 0 ? (unionPledgePool / totalPool) * 100 : 0;

  return {
    unionName: canonical,
    distributionPct: official.distributionPct,
    gcPool,
    ssdPool,
    spdPool,
    baseDivisionPool,
    unionPledgePool,
    totalPool,
    gcPoolPct,
    ssdPoolPct,
    spdPoolPct,
    unionPoolPct,
  };
}

export interface ProposalFundingAttribution {
  proposalId: string;
  union: string;
  proposalTotal: number;          // 100% of this proposal's approved funding
  poolCoveredAmount: number;      // Amount covered by the Union's Total Pool
  overPoolDeficitAmount: number;  // Amount exceeding the Union's Total Pool (100% Union deficit)
  gcAmount: number;               // GC dollar share on this proposal
  ssdAmount: number;              // SSD dollar share on this proposal
  spdAmount: number;              // SPD dollar share on this proposal
  unionFromPoolAmount: number;    // Union share from the Pool formula
  unionAmount: number;            // Total Union share (unionFromPoolAmount + overPoolDeficitAmount)
  gcPct: number;                  // GC % of this proposal (0-100)
  ssdPct: number;                 // SSD % of this proposal (0-100)
  spdPct: number;                 // SPD % of this proposal (0-100)
  unionPct: number;               // Total Union % of this proposal (0-100)
  poolStatus: 'within_pool' | 'partial_deficit' | 'pool_depleted';
  approvalSequenceIndex: number;  // 1-based sequence order among approved proposals in this Union
  poolRemainingAfterProposal: number;
}

export interface UnionFundingSummary {
  unionName: string;
  formula: UnionPoolFormula;
  approvedCount: number;
  totalApprovedAmount: number;
  poolUsedAmount: number;
  overPoolDeficitAmount: number;
  poolRemainingAmount: number;
  gcUsed: number;
  ssdUsed: number;
  spdUsed: number;
  unionFromPoolUsed: number;
  unionTotalUsed: number; // unionFromPoolUsed + overPoolDeficitAmount
  gcRemaining: number;
  ssdRemaining: number;
  spdRemaining: number;
  unionRemaining: number;
  isPoolDepleted: boolean;
  isOverPool: boolean;
}

export function getProposalApprovedBudget(proposal: Proposal): number {
  return roundCents(
    (proposal.budgetItems || []).reduce(
      (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
      0
    )
  );
}

/**
 * Deterministic sort comparator for Union-Approved proposals so adding review notes
 * or editing non-approval fields never changes a proposal's place in the Union pool drawdown.
 */
export function compareApprovedProposalsChronologically(a: Proposal, b: Proposal): number {
  const timeA = a.unionApproval?.timestamp ? Date.parse(a.unionApproval.timestamp) : NaN;
  const timeB = b.unionApproval?.timestamp ? Date.parse(b.unionApproval.timestamp) : NaN;
  if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
    return timeA - timeB;
  }

  const dateA = a.unionApproval?.actionDate || '';
  const dateB = b.unionApproval?.actionDate || '';
  if (dateA && dateB && dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  const actA = a.unionApproval?.actionNumber || '';
  const actB = b.unionApproval?.actionNumber || '';
  if (actA && actB && actA !== actB) {
    return actA.localeCompare(actB, undefined, { numeric: true, sensitivity: 'base' });
  }

  const createdA = a.createdAt ? Date.parse(a.createdAt) : 0;
  const createdB = b.createdAt ? Date.parse(b.createdAt) : 0;
  if (createdA !== createdB) {
    return createdA - createdB;
  }

  return (a.id || '').localeCompare(b.id || '');
}

/**
 * Computes the Pool Formula attribution for all Union-Approved proposals across all Unions.
 * - While a Union's Total Pool is available, each proposal uses the Union's Pool % formula
 *   (GC% + SSD% + SPD% + Union% = 100%) with 2-decimal-place cent precision.
 * - Once the Union's Total Pool is depleted, GC, SSD, and SPD become $0 (0%), and the Union
 *   absorbs 100% of the over-pool deficit.
 */
export function computeAllProposalsFundingAttribution(
  proposals: Proposal[],
  allocations: Record<string, number> = {},
  matchingPledges: Record<string, number> = {}
): {
  byProposalId: Record<string, ProposalFundingAttribution>;
  byUnion: Record<string, UnionFundingSummary>;
} {
  const byProposalId: Record<string, ProposalFundingAttribution> = {};
  const byUnion: Record<string, UnionFundingSummary> = {};

  // Group approved proposals by canonical Union
  const approvedByUnion: Record<string, Proposal[]> = {};
  for (const u of UNIONS) {
    approvedByUnion[u] = [];
  }

  for (const p of proposals) {
    if (p.status !== 'approved') continue;
    const canon = getCanonicalUnion(p.union) || p.union || 'Unassigned';
    if (!approvedByUnion[canon]) {
      approvedByUnion[canon] = [];
    }
    approvedByUnion[canon].push(p);
  }

  for (const [unionName, unionProposals] of Object.entries(approvedByUnion)) {
    const formula = getUnionPoolFormula(unionName, allocations, matchingPledges);
    const sorted = [...unionProposals].sort(compareApprovedProposalsChronologically);

    let remPool = formula.totalPool;
    let remGc = formula.gcPool;
    let remSsd = formula.ssdPool;
    let remSpd = formula.spdPool;
    let remUnionPledge = formula.unionPledgePool;

    let totalApprovedAmount = 0;
    let poolUsedAmount = 0;
    let overPoolDeficitAmount = 0;
    let gcUsed = 0;
    let ssdUsed = 0;
    let spdUsed = 0;
    let unionFromPoolUsed = 0;

    sorted.forEach((proposal, idx) => {
      const proposalTotal = Math.max(0, roundCents(getProposalApprovedBudget(proposal)));
      totalApprovedAmount = roundCents(totalApprovedAmount + proposalTotal);

      const poolCovered = roundCents(Math.min(proposalTotal, remPool));
      const deficit = Math.max(0, roundCents(proposalTotal - poolCovered));

      let gcAmt = 0;
      let ssdAmt = 0;
      let spdAmt = 0;
      let unionPoolAmt = 0;

      if (poolCovered > 0 && formula.totalPool > 0) {
        if (Math.abs(poolCovered - remPool) < 0.005) {
          // Exact depletion of the remaining pool: take exact remaining balances to prevent cent rounding drift
          gcAmt = remGc;
          spdAmt = remSpd;
          unionPoolAmt = remUnionPledge;
          ssdAmt = Math.max(0, roundCents(poolCovered - gcAmt - spdAmt - unionPoolAmt));
        } else {
          gcAmt = Math.min(remGc, roundCents(poolCovered * (formula.gcPool / formula.totalPool)));
          spdAmt = Math.min(remSpd, roundCents(poolCovered * (formula.spdPool / formula.totalPool)));
          unionPoolAmt = Math.min(
            remUnionPledge,
            roundCents(poolCovered * (formula.unionPledgePool / formula.totalPool))
          );
          ssdAmt = Math.max(0, roundCents(poolCovered - gcAmt - spdAmt - unionPoolAmt));

          // Guard if ssdAmt exceeds remSsd due to cent rounding
          if (ssdAmt > remSsd) {
            const diff = roundCents(ssdAmt - remSsd);
            ssdAmt = remSsd;
            if (roundCents(unionPoolAmt + diff) <= remUnionPledge) {
              unionPoolAmt = roundCents(unionPoolAmt + diff);
            } else if (roundCents(gcAmt + diff) <= remGc) {
              gcAmt = roundCents(gcAmt + diff);
            }
          }
        }
      }

      remPool = Math.max(0, roundCents(remPool - poolCovered));
      remGc = Math.max(0, roundCents(remGc - gcAmt));
      remSsd = Math.max(0, roundCents(remSsd - ssdAmt));
      remSpd = Math.max(0, roundCents(remSpd - spdAmt));
      remUnionPledge = Math.max(0, roundCents(remUnionPledge - unionPoolAmt));

      const totalUnionAmt = roundCents(unionPoolAmt + deficit);

      poolUsedAmount = roundCents(poolUsedAmount + poolCovered);
      overPoolDeficitAmount = roundCents(overPoolDeficitAmount + deficit);
      gcUsed = roundCents(gcUsed + gcAmt);
      ssdUsed = roundCents(ssdUsed + ssdAmt);
      spdUsed = roundCents(spdUsed + spdAmt);
      unionFromPoolUsed = roundCents(unionFromPoolUsed + unionPoolAmt);

      // Percentages for this proposal (treating proposalTotal as 100%)
      let gcPct = formula.gcPoolPct;
      let ssdPct = formula.ssdPoolPct;
      let spdPct = formula.spdPoolPct;
      let unionPct = formula.unionPoolPct;

      if (proposalTotal > 0) {
        if (deficit === 0) {
          // 100% covered by the Pool: display the exact Union Pool Formula percentages
          gcPct = formula.gcPoolPct;
          ssdPct = formula.ssdPoolPct;
          spdPct = formula.spdPoolPct;
          unionPct = formula.unionPoolPct;
        } else {
          // Partially or fully in over-pool deficit: reflect actual dollar ratios on this proposal
          gcPct = (gcAmt / proposalTotal) * 100;
          ssdPct = (ssdAmt / proposalTotal) * 100;
          spdPct = (spdAmt / proposalTotal) * 100;
          unionPct = (totalUnionAmt / proposalTotal) * 100;
        }
      }

      const poolStatus: ProposalFundingAttribution['poolStatus'] =
        deficit === 0
          ? 'within_pool'
          : poolCovered > 0
          ? 'partial_deficit'
          : 'pool_depleted';

      byProposalId[proposal.id] = {
        proposalId: proposal.id,
        union: formula.unionName,
        proposalTotal,
        poolCoveredAmount: poolCovered,
        overPoolDeficitAmount: deficit,
        gcAmount: gcAmt,
        ssdAmount: ssdAmt,
        spdAmount: spdAmt,
        unionFromPoolAmount: unionPoolAmt,
        unionAmount: totalUnionAmt,
        gcPct,
        ssdPct,
        spdPct,
        unionPct,
        poolStatus,
        approvalSequenceIndex: idx + 1,
        poolRemainingAfterProposal: remPool,
      };
    });

    byUnion[unionName] = {
      unionName: formula.unionName,
      formula,
      approvedCount: sorted.length,
      totalApprovedAmount,
      poolUsedAmount,
      overPoolDeficitAmount,
      poolRemainingAmount: remPool,
      gcUsed,
      ssdUsed,
      spdUsed,
      unionFromPoolUsed,
      unionTotalUsed: roundCents(unionFromPoolUsed + overPoolDeficitAmount),
      gcRemaining: remGc,
      ssdRemaining: remSsd,
      spdRemaining: remSpd,
      unionRemaining: remUnionPledge,
      isPoolDepleted: remPool === 0 && formula.totalPool > 0,
      isOverPool: overPoolDeficitAmount > 0,
    };
  }

  return { byProposalId, byUnion };
}

export interface ScopeFundingAggregate {
  totalAmount: number;
  gcAmount: number;
  ssdAmount: number;
  spdAmount: number;
  unionFromPoolAmount: number;
  overPoolDeficitAmount: number;
  unionTotalAmount: number;
  gcPct: number;
  ssdPct: number;
  spdPct: number;
  unionPct: number;
  // Pool & Remaining totals across the active scope
  totalPool: number;
  gcPool: number;
  ssdPool: number;
  spdPool: number;
  unionPool: number;
  poolRemaining: number;
  gcRemaining: number;
  ssdRemaining: number;
  spdRemaining: number;
  unionRemaining: number;
}

/**
 * Aggregates the computed funding attribution across a filtered set of approved proposals,
 * plus the corresponding Pool and Remaining balances for the active Union scope.
 */
export function computeScopeFundingAggregate(
  approvedProposals: Proposal[],
  byProposalId: Record<string, ProposalFundingAttribution>,
  byUnion: Record<string, UnionFundingSummary> = {},
  scopedUnions: string[] = [...UNIONS]
): ScopeFundingAggregate {
  let totalAmount = 0;
  let gcAmount = 0;
  let ssdAmount = 0;
  let spdAmount = 0;
  let unionFromPoolAmount = 0;
  let overPoolDeficitAmount = 0;
  let unionTotalAmount = 0;

  for (const p of approvedProposals) {
    const attr = byProposalId[p.id];
    if (!attr) continue;
    totalAmount = roundCents(totalAmount + attr.proposalTotal);
    gcAmount = roundCents(gcAmount + attr.gcAmount);
    ssdAmount = roundCents(ssdAmount + attr.ssdAmount);
    spdAmount = roundCents(spdAmount + attr.spdAmount);
    unionFromPoolAmount = roundCents(unionFromPoolAmount + attr.unionFromPoolAmount);
    overPoolDeficitAmount = roundCents(overPoolDeficitAmount + attr.overPoolDeficitAmount);
    unionTotalAmount = roundCents(unionTotalAmount + attr.unionAmount);
  }

  let totalPool = 0;
  let gcPool = 0;
  let ssdPool = 0;
  let spdPool = 0;
  let unionPool = 0;
  let poolRemaining = 0;
  let gcRemaining = 0;
  let ssdRemaining = 0;
  let spdRemaining = 0;
  let unionRemaining = 0;

  const uniqueUnions = Array.from(
    new Set(scopedUnions.map((u) => getCanonicalUnion(u) || u).filter(Boolean))
  );

  for (const u of uniqueUnions) {
    const summary = byUnion[u];
    if (!summary) continue;
    totalPool = roundCents(totalPool + summary.formula.totalPool);
    gcPool = roundCents(gcPool + summary.formula.gcPool);
    ssdPool = roundCents(ssdPool + summary.formula.ssdPool);
    spdPool = roundCents(spdPool + summary.formula.spdPool);
    unionPool = roundCents(unionPool + summary.formula.unionPledgePool);
    poolRemaining = roundCents(poolRemaining + summary.poolRemainingAmount);
    gcRemaining = roundCents(gcRemaining + summary.gcRemaining);
    ssdRemaining = roundCents(ssdRemaining + summary.ssdRemaining);
    spdRemaining = roundCents(spdRemaining + summary.spdRemaining);
    unionRemaining = roundCents(unionRemaining + summary.unionRemaining);
  }

  return {
    totalAmount,
    gcAmount,
    ssdAmount,
    spdAmount,
    unionFromPoolAmount,
    overPoolDeficitAmount,
    unionTotalAmount,
    gcPct: totalAmount > 0 ? (gcAmount / totalAmount) * 100 : totalPool > 0 ? (gcPool / totalPool) * 100 : 0,
    ssdPct: totalAmount > 0 ? (ssdAmount / totalAmount) * 100 : totalPool > 0 ? (ssdPool / totalPool) * 100 : 0,
    spdPct: totalAmount > 0 ? (spdAmount / totalAmount) * 100 : totalPool > 0 ? (spdPool / totalPool) * 100 : 0,
    unionPct: totalAmount > 0 ? (unionTotalAmount / totalAmount) * 100 : totalPool > 0 ? (unionPool / totalPool) * 100 : 0,
    totalPool,
    gcPool,
    ssdPool,
    spdPool,
    unionPool,
    poolRemaining,
    gcRemaining,
    ssdRemaining,
    spdRemaining,
    unionRemaining,
  };
}

/**
 * Formats a percentage cleanly (e.g., 15.32% or 35.5% or 0%)
 */
export function formatAttributionPct(pct: number, decimals: number = 2): string {
  if (!pct || pct <= 0) return '0%';
  if (Math.abs(pct - 100) < 0.005) return '100%';
  return `${pct.toFixed(decimals)}%`;
}
