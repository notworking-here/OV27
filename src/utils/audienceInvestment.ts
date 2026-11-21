import { Proposal, getCanonicalKpiType, TARGET_AUDIENCE_OPTIONS } from '../types';
import { parseKpiTargetNumber } from './kpiExtraction';

export interface AudienceGroupMetrics {
  approvedBudget: number;
  pipelineBudget: number;
  totalBudget: number; // approved + pipeline
  approvedTargetCount: number;
  pipelineTargetCount: number;
  totalTargetCount: number;
  proposalCount: number;
  approvedCostPerPerson: number | null;
  totalCostPerPerson: number | null;
  sharePct: number; // percentage of total budget
}

export interface SingleAudienceBreakdown {
  id: string;
  label: string;
  group: 'ABC' | 'DE';
  proposalCount: number;
  approvedBudget: number;
  totalBudget: number;
  targetCount: number;
}

export interface AudienceInvestmentAnalysis {
  internalBeneficiaries: AudienceGroupMetrics; // Groups A, B
  outreachAudience: AudienceGroupMetrics; // Groups C, D, E
  grandTotalApprovedBudget: number;
  grandTotalProjectedBudget: number;
  grandTotalProposals: number;
  quantifiedProposalsCount: number;
  breakdownByAudience: SingleAudienceBreakdown[];
}

/**
 * Categorizes an audience identifier into either:
 * - 'ABC': Internal Church Beneficiaries & Equipping (A1-A4, B)
 * - 'DE': Frontline Public Outreach — Seekers, Non-Adventist Christians & World Religions (C, D, E)
 */
export function categorizeAudienceGroup(audienceId: string): 'ABC' | 'DE' {
  const clean = audienceId.trim().toUpperCase();
  if (clean.startsWith('C') || clean.startsWith('D') || clean.startsWith('E')) {
    return 'DE';
  }
  return 'ABC';
}

/**
 * Computes investment allocation, target numbers, and estimated cost-per-person
 * for internal beneficiaries (A-B) vs frontline outreach (C-D-E).
 * Pure read-time calculation.
 */
export function calculateAudienceInvestment(proposals: Proposal[]): AudienceInvestmentAnalysis {
  let abcApprovedBudget = 0;
  let abcPipelineBudget = 0;
  let abcApprovedTarget = 0;
  let abcPipelineTarget = 0;
  let abcProposalSet = new Set<string>();

  let deApprovedBudget = 0;
  let dePipelineBudget = 0;
  let deApprovedTarget = 0;
  let dePipelineTarget = 0;
  let deProposalSet = new Set<string>();

  let quantifiedCount = 0;

  // Track breakdown for individual tags A1, A2, A3, A4, B, C, D, E
  const audienceTagMap: Record<
    string,
    {
      proposalIds: Set<string>;
      approvedBudget: number;
      totalBudget: number;
      targetCount: number;
    }
  > = {};

  TARGET_AUDIENCE_OPTIONS.forEach((opt) => {
    audienceTagMap[opt.id] = {
      proposalIds: new Set<string>(),
      approvedBudget: 0,
      totalBudget: 0,
      targetCount: 0,
    };
  });

  for (const proposal of proposals) {
    const statusLower = (proposal.status || '').toLowerCase().trim();
    const isApproved = statusLower === 'approved';
    const isPipeline =
      statusLower === 'submitted' ||
      statusLower === 'under_review' ||
      statusLower === 'under review' ||
      statusLower === 'revision_requested' ||
      statusLower === 'pipeline';

    // Proposal budget from GC/Division funding
    let pBudget = (proposal.budgetItems || []).reduce(
      (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
      0
    );

    // Fallback to top-level budget properties if budgetItems not populated
    if (pBudget === 0) {
      const raw = proposal as Record<string, any>;
      if (isApproved && Number(raw.approvedBudget) > 0) {
        pBudget = Number(raw.approvedBudget);
      } else if (Number(raw.requestedBudget) > 0) {
        pBudget = Number(raw.requestedBudget);
      } else if (Number(raw.totalBudget) > 0) {
        pBudget = Number(raw.totalBudget);
      }
    }

    // Extracted target number
    const canonKpi = getCanonicalKpiType(proposal.kpiType);
    const parsed = parseKpiTargetNumber(proposal.kpiNumber, proposal.kpiDescription, canonKpi);
    const hasTarget = parsed.value !== null && parsed.value > 0;
    const targetValue = hasTarget ? (parsed.value as number) : 0;
    if (hasTarget) quantifiedCount++;

    // Selected audiences
    const rawAudiences = (proposal.targetAudiences || []).filter(Boolean);
    const abcTags = rawAudiences.filter((a) => categorizeAudienceGroup(a) === 'ABC');
    const deTags = rawAudiences.filter((a) => categorizeAudienceGroup(a) === 'DE');

    const totalTagged = abcTags.length + deTags.length;

    let abcWeight = 0.5;
    let deWeight = 0.5;

    if (totalTagged > 0) {
      abcWeight = abcTags.length / totalTagged;
      deWeight = deTags.length / totalTagged;
    } else {
      // Default heuristic based on canonical KPI if no audiences were tagged
      if (canonKpi === 'implementation_capability' || canonKpi === 'retention_nurturing') {
        abcWeight = 1.0;
        deWeight = 0.0;
      } else if (canonKpi === 'reach_exposure') {
        abcWeight = 0.0;
        deWeight = 1.0;
      }
    }

    // Budget attribution
    const pAbcBudget = pBudget * abcWeight;
    const pDeBudget = pBudget * deWeight;

    // Target count attribution
    const pAbcTarget = targetValue * abcWeight;
    const pDeTarget = targetValue * deWeight;

    if (abcWeight > 0) {
      abcProposalSet.add(proposal.id);
      if (isApproved) {
        abcApprovedBudget += pAbcBudget;
        abcApprovedTarget += pAbcTarget;
      } else if (isPipeline) {
        abcPipelineBudget += pAbcBudget;
        abcPipelineTarget += pAbcTarget;
      }
    }

    if (deWeight > 0) {
      deProposalSet.add(proposal.id);
      if (isApproved) {
        deApprovedBudget += pDeBudget;
        deApprovedTarget += pDeTarget;
      } else if (isPipeline) {
        dePipelineBudget += pDeBudget;
        dePipelineTarget += pDeTarget;
      }
    }

    // Track individual audience tags
    if (rawAudiences.length > 0) {
      const perTagBudget = pBudget / rawAudiences.length;
      const perTagTarget = targetValue / rawAudiences.length;

      for (const tag of rawAudiences) {
        if (!audienceTagMap[tag]) {
          audienceTagMap[tag] = {
            proposalIds: new Set<string>(),
            approvedBudget: 0,
            totalBudget: 0,
            targetCount: 0,
          };
        }
        audienceTagMap[tag].proposalIds.add(proposal.id);
        audienceTagMap[tag].totalBudget += perTagBudget;
        if (isApproved) {
          audienceTagMap[tag].approvedBudget += perTagBudget;
        }
        audienceTagMap[tag].targetCount += perTagTarget;
      }
    }
  }

  const abcTotalBudget = abcApprovedBudget + abcPipelineBudget;
  const abcTotalTarget = abcApprovedTarget + abcPipelineTarget;

  const deTotalBudget = deApprovedBudget + dePipelineBudget;
  const deTotalTarget = deApprovedTarget + dePipelineTarget;

  const grandTotalApproved = abcApprovedBudget + deApprovedBudget;
  const grandTotalProjected = abcTotalBudget + deTotalBudget;

  const abcSharePct =
    grandTotalApproved > 0
      ? Math.round((abcApprovedBudget / grandTotalApproved) * 100)
      : grandTotalProjected > 0
      ? Math.round((abcTotalBudget / grandTotalProjected) * 100)
      : 50;
  const deSharePct = 100 - abcSharePct;

  // Calculate Unit Costs (Cost per person)
  // Round to 2 decimal places for low costs (e.g. $0.05), or whole dollar for larger training costs
  const calcUnitCost = (budget: number, people: number): number | null => {
    if (people <= 0 || budget <= 0) return null;
    const cost = budget / people;
    return Number(cost.toFixed(cost < 1 ? 3 : cost < 10 ? 2 : 1));
  };

  const breakdownByAudience: SingleAudienceBreakdown[] = TARGET_AUDIENCE_OPTIONS.map((opt) => {
    const data = audienceTagMap[opt.id];
    return {
      id: opt.id,
      label: opt.label,
      group: categorizeAudienceGroup(opt.id),
      proposalCount: data ? data.proposalIds.size : 0,
      approvedBudget: Math.round(data?.approvedBudget || 0),
      totalBudget: Math.round(data?.totalBudget || 0),
      targetCount: Math.round(data?.targetCount || 0),
    };
  });

  return {
    internalBeneficiaries: {
      approvedBudget: Math.round(abcApprovedBudget),
      pipelineBudget: Math.round(abcPipelineBudget),
      totalBudget: Math.round(abcTotalBudget),
      approvedTargetCount: Math.round(abcApprovedTarget),
      pipelineTargetCount: Math.round(abcPipelineTarget),
      totalTargetCount: Math.round(abcTotalTarget),
      proposalCount: abcProposalSet.size,
      approvedCostPerPerson: calcUnitCost(abcApprovedBudget, abcApprovedTarget),
      totalCostPerPerson: calcUnitCost(abcTotalBudget, abcTotalTarget),
      sharePct: abcSharePct,
    },
    outreachAudience: {
      approvedBudget: Math.round(deApprovedBudget),
      pipelineBudget: Math.round(dePipelineBudget),
      totalBudget: Math.round(deTotalBudget),
      approvedTargetCount: Math.round(deApprovedTarget),
      pipelineTargetCount: Math.round(dePipelineTarget),
      totalTargetCount: Math.round(deTotalTarget),
      proposalCount: deProposalSet.size,
      approvedCostPerPerson: calcUnitCost(deApprovedBudget, deApprovedTarget),
      totalCostPerPerson: calcUnitCost(deTotalBudget, deTotalTarget),
      sharePct: deSharePct,
    },
    grandTotalApprovedBudget: Math.round(grandTotalApproved),
    grandTotalProjectedBudget: Math.round(grandTotalProjected),
    grandTotalProposals: proposals.length,
    quantifiedProposalsCount: quantifiedCount,
    breakdownByAudience,
  };
}
