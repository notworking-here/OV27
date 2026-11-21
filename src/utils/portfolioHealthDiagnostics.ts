import {
  Proposal,
  UserRole,
  StrategicKpiCaps,
  STRATEGIC_PILLARS_CONFIG,
  ALL_STRATEGIC_KPIS,
  getCanonicalKpiType,
} from '../types';
import { matchProposalToStrategicKpi } from './strategicKpiMatching';
import { evaluateProposalReviewFramework } from './projectReviewFramework';
import { parseKpiTargetNumber } from './kpiExtraction';
import { formatCurrency } from './userUtils';
import { PLAYBOOK_GOLDEN_RULE } from '../data/oneVoice27Playbook';

export type HealthSeverity = 'healthy' | 'attention' | 'critical';

export interface HealthSubCheck {
  id: 'pillar_balance' | 'objective_coverage' | 'pathway_continuity';
  title: string;
  status: HealthSeverity;
  badgeText: string;
  summary: string;
}

export interface PathwayStageMetric {
  key:
    | 'enabling'
    | 'reach_exposure'
    | 'engagement_participation'
    | 'connection_next_steps'
    | 'retention_nurturing'
    | 'implementation_capability';
  shortLabel: string;
  stageNumberLabel: string;
  count: number;
  budget: number;
  sharePct: number;
  isGap: boolean;
}

export interface HealthObservation {
  id: string;
  severity: 'critical' | 'warning' | 'positive' | 'info';
  title: string;
  detail: string;
  actionStep?: string;
}

export interface PlaybookReminder {
  id: string;
  tag: string;
  text: string;
  actionStep?: string;
  pageRef?: string;
}

export interface PortfolioHealthReport {
  overallStatus: HealthSeverity;
  overallLabel: string;
  overallHeadline: string;
  totalApprovedCount: number;
  totalApprovedBudget: number;
  subChecks: {
    pillarBalance: HealthSubCheck;
    objectiveCoverage: HealthSubCheck;
    pathwayContinuity: HealthSubCheck;
  };
  pathwayStages: PathwayStageMetric[];
  observations: HealthObservation[];
  reminders: PlaybookReminder[];
  goldenRule: typeof PLAYBOOK_GOLDEN_RULE;
}

function getProposalDivisionBudget(p: Proposal): number {
  return (p.budgetItems || []).reduce(
    (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );
}

function mapSnapshotProposalToStageKey(
  p: Proposal
): PathwayStageMetric['key'] {
  const canonKpi = getCanonicalKpiType(p.kpiType);
  if (canonKpi === 'reach_exposure') return 'reach_exposure';
  if (canonKpi === 'engagement_participation') return 'engagement_participation';
  if (canonKpi === 'connection_next_steps') return 'connection_next_steps';
  if (canonKpi === 'retention_nurturing') return 'retention_nurturing';
  if (canonKpi === 'implementation_capability') {
    const matchedKpi = matchProposalToStrategicKpi(p, ALL_STRATEGIC_KPIS);
    if (matchedKpi?.pillarId === 'pillar_1') return 'enabling';
    return 'implementation_capability';
  }
  const matchedKpi = matchProposalToStrategicKpi(p, ALL_STRATEGIC_KPIS);
  if (matchedKpi?.pillarId === 'pillar_1') return 'enabling';
  if (matchedKpi?.id === 'kpi_3' || matchedKpi?.id === 'kpi_4' || matchedKpi?.id === 'kpi_7') {
    return 'reach_exposure';
  }
  if (matchedKpi?.id === 'kpi_2' || matchedKpi?.id === 'kpi_5') {
    return 'engagement_participation';
  }
  return 'connection_next_steps';
}

export function evaluatePortfolioHealth(params: {
  approvedProposals: Proposal[];
  baseBudgetPool: number;
  kpiCaps: StrategicKpiCaps;
  userRole: UserRole;
  isSnapshotContext: boolean;
  scopeLabel: string;
}): PortfolioHealthReport {
  const {
    approvedProposals,
    baseBudgetPool,
    kpiCaps,
    userRole,
    isSnapshotContext,
    scopeLabel,
  } = params;

  const totalApprovedCount = approvedProposals.length;
  const totalApprovedBudget = approvedProposals.reduce(
    (sum, p) => sum + getProposalDivisionBudget(p),
    0
  );

  // If no approved projects yet, return clean neutral onboarding diagnostics
  if (totalApprovedCount === 0) {
    return {
      overallStatus: 'attention',
      overallLabel: 'No Approved Projects Yet',
      overallHeadline: `There are no approved projects yet in ${scopeLabel}.`,
      totalApprovedCount: 0,
      totalApprovedBudget: 0,
      subChecks: {
        pillarBalance: {
          id: 'pillar_balance',
          title: 'Pillar Balance',
          status: 'attention',
          badgeText: 'No Data',
          summary: 'Waiting for approved projects',
        },
        objectiveCoverage: {
          id: 'objective_coverage',
          title: '7 Global Goals',
          status: 'attention',
          badgeText: '0 / 7 Active',
          summary: 'No goals funded yet',
        },
        pathwayContinuity: {
          id: 'pathway_continuity',
          title: 'Mission Pathway',
          status: 'attention',
          badgeText: 'No Stages',
          summary: 'Waiting for approved projects',
        },
      },
      pathwayStages: [
        { key: 'enabling', shortLabel: 'Enabling', stageNumberLabel: 'P1', count: 0, budget: 0, sharePct: 0, isGap: false },
        { key: 'reach_exposure', shortLabel: 'Reach', stageNumberLabel: '1', count: 0, budget: 0, sharePct: 0, isGap: true },
        { key: 'engagement_participation', shortLabel: 'Engage', stageNumberLabel: '2', count: 0, budget: 0, sharePct: 0, isGap: true },
        { key: 'connection_next_steps', shortLabel: 'Connect', stageNumberLabel: '3', count: 0, budget: 0, sharePct: 0, isGap: true },
        { key: 'retention_nurturing', shortLabel: 'Disciple', stageNumberLabel: '4', count: 0, budget: 0, sharePct: 0, isGap: true },
        { key: 'implementation_capability', shortLabel: 'Multiply', stageNumberLabel: '5', count: 0, budget: 0, sharePct: 0, isGap: true },
      ],
      observations: [
        {
          id: 'empty_baseline',
          severity: 'info',
          title: 'No approved projects in this view yet',
          detail: `No approved proposals are recorded in ${scopeLabel} yet (Playbook targets: 12.5% Pillar 1, 58.5% Pillar 2, 29% Pillar 3).`,
          actionStep: 'Switch to your Union or SSD Division filter above, or draft proposals targeting Pillar 1 & 2 first.',
        },
      ],
      reminders: [
        {
          id: 'empty_playbook',
          tag: 'Connect Every Step',
          text: 'Every media or public outreach activity needs a connected follow-up path.',
          actionStep: 'Name the follow-up responder and welcoming local church in Section 8 of new proposals.',
          pageRef: 'Playbook pp. 10–15',
        },
      ],
      goldenRule: PLAYBOOK_GOLDEN_RULE,
    };
  }

  const effectivePool = baseBudgetPool > 0 ? baseBudgetPool : totalApprovedBudget;

  // 1. Objective breakdown
  const kpiStats = ALL_STRATEGIC_KPIS.map((k) => {
    const matched = approvedProposals.filter(
      (p) => matchProposalToStrategicKpi(p, ALL_STRATEGIC_KPIS)?.id === k.id
    );
    const budget = matched.reduce((sum, p) => sum + getProposalDivisionBudget(p), 0);
    const shareOfCommittedPct =
      totalApprovedBudget > 0 ? (budget / totalApprovedBudget) * 100 : 0;
    const shareOfPoolPct = effectivePool > 0 ? (budget / effectivePool) * 100 : 0;
    const targetCapPct = kpiCaps.kpiCaps[k.id] ?? k.defaultCap;
    const dollarCap = (effectivePool * targetCapPct) / 100;
    const impact = matched.reduce((sum, p) => {
      const parsed = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);
      return sum + (parsed.value || 0);
    }, 0);
    const costPerPerson = impact > 0 && budget > 0 ? budget / impact : null;

    return {
      kpi: k,
      count: matched.length,
      budget,
      shareOfCommittedPct,
      shareOfPoolPct,
      targetCapPct,
      dollarCap,
      overPoolUsd: budget - dollarCap,
      impact,
      costPerPerson,
    };
  });

  // 2. Pillar breakdown
  const pillarStats = STRATEGIC_PILLARS_CONFIG.map((pillar) => {
    const items = kpiStats.filter((s) => s.kpi.pillarId === pillar.id);
    const budget = items.reduce((sum, s) => sum + s.budget, 0);
    const count = items.reduce((sum, s) => sum + s.count, 0);
    const shareOfCommittedPct =
      totalApprovedBudget > 0 ? (budget / totalApprovedBudget) * 100 : 0;
    const shareOfProjectsPct =
      totalApprovedCount > 0 ? (count / totalApprovedCount) * 100 : 0;
    const avgCostPerProject = count > 0 ? budget / count : 0;
    const shareOfPoolPct = effectivePool > 0 ? (budget / effectivePool) * 100 : 0;
    const targetCapPct = kpiCaps.pillarCaps[pillar.id] ?? pillar.defaultCap;
    const dollarCap = (effectivePool * targetCapPct) / 100;
    const overUsd = budget - dollarCap;
    const isOverCap = shareOfPoolPct > targetCapPct + 0.5 && budget > 0;
    const isSeverelySkewed = shareOfCommittedPct > targetCapPct * 1.5 && budget > 0;
    const isSeverelyUnder =
      targetCapPct >= 10 && shareOfCommittedPct < targetCapPct * 0.25;

    return {
      pillar,
      budget,
      count,
      shareOfCommittedPct,
      shareOfProjectsPct,
      avgCostPerProject,
      shareOfPoolPct,
      targetCapPct,
      dollarCap,
      overUsd,
      headroomUsd: Math.max(0, dollarCap - budget),
      isOverCap,
      isSeverelySkewed,
      isSeverelyUnder,
    };
  });

  // 3. Mission Pathway 5-Stage Funnel (+ Enabling)
  const stageTotals: Record<
    PathwayStageMetric['key'],
    { count: number; budget: number }
  > = {
    enabling: { count: 0, budget: 0 },
    reach_exposure: { count: 0, budget: 0 },
    engagement_participation: { count: 0, budget: 0 },
    connection_next_steps: { count: 0, budget: 0 },
    retention_nurturing: { count: 0, budget: 0 },
    implementation_capability: { count: 0, budget: 0 },
  };

  for (const p of approvedProposals) {
    const b = getProposalDivisionBudget(p);
    const stageKey = isSnapshotContext
      ? mapSnapshotProposalToStageKey(p)
      : evaluateProposalReviewFramework(p).principalStageKey;
    stageTotals[stageKey].count += 1;
    stageTotals[stageKey].budget += b;
  }

  const stageMeta: {
    key: PathwayStageMetric['key'];
    shortLabel: string;
    stageNumberLabel: string;
  }[] = [
    { key: 'enabling', shortLabel: 'Enabling', stageNumberLabel: 'P1' },
    { key: 'reach_exposure', shortLabel: 'Reach', stageNumberLabel: '1' },
    { key: 'engagement_participation', shortLabel: 'Engage', stageNumberLabel: '2' },
    { key: 'connection_next_steps', shortLabel: 'Connect', stageNumberLabel: '3' },
    { key: 'retention_nurturing', shortLabel: 'Disciple', stageNumberLabel: '4' },
    { key: 'implementation_capability', shortLabel: 'Multiply', stageNumberLabel: '5' },
  ];

  const pathwayStages: PathwayStageMetric[] = stageMeta.map((m) => {
    const t = stageTotals[m.key];
    const sharePct =
      totalApprovedCount > 0 ? Math.round((t.count / totalApprovedCount) * 100) : 0;
    const isGap = m.key !== 'enabling' && t.count === 0;
    return {
      key: m.key,
      shortLabel: m.shortLabel,
      stageNumberLabel: m.stageNumberLabel,
      count: t.count,
      budget: t.budget,
      sharePct,
      isGap,
    };
  });

  // Evaluate Sub-Checks
  // A. Pillar Balance
  const overCapPillars = pillarStats.filter((p) => p.isOverCap || p.isSeverelySkewed);
  const underPillars = pillarStats.filter((p) => p.isSeverelyUnder);
  const maxOverPillar = [...pillarStats].sort(
    (a, b) => (b.shareOfCommittedPct - b.targetCapPct) - (a.shareOfCommittedPct - a.targetCapPct)
  )[0];

  let pillarStatus: HealthSeverity = 'healthy';
  let pillarBadge = 'Within Limits';
  let pillarSummary = 'All 3 Pillars are within Playbook budget limits';

  if (overCapPillars.some((p) => p.shareOfCommittedPct > p.targetCapPct * 1.5 || p.overUsd > 0)) {
    const worst = overCapPillars[0];
    pillarStatus =
      worst.shareOfCommittedPct >= worst.targetCapPct * 2 || worst.overUsd > effectivePool * 0.1
        ? 'critical'
        : 'attention';
    pillarBadge = `P${worst.pillar.number}: ${worst.shareOfCommittedPct.toFixed(0)}% vs ${worst.targetCapPct}% limit`;
    pillarSummary = `Pillar ${worst.pillar.number} is over its ${worst.targetCapPct}% Playbook limit`;
  } else if (underPillars.length > 0 && totalApprovedCount >= 3) {
    pillarStatus = 'attention';
    pillarBadge = `Low funding in ${underPillars.map((u) => `P${u.pillar.number}`).join(', ')}`;
    pillarSummary = `Budget room left in ${underPillars.map((u) => `Pillar ${u.pillar.number}`).join(' & ')}`;
  }

  // B. Objective Coverage
  const zeroObjectives = kpiStats.filter((s) => s.count === 0);
  const dominantObj = [...kpiStats].sort(
    (a, b) => b.shareOfCommittedPct - a.shareOfCommittedPct
  )[0];
  let objStatus: HealthSeverity = 'healthy';
  let objBadge = `${7 - zeroObjectives.length}/7 Active`;
  let objSummary = 'Projects cover all 7 Global Objectives';

  if (dominantObj && dominantObj.shareOfCommittedPct >= 60 && totalApprovedCount >= 3) {
    objStatus = 'critical';
    objBadge = `Obj ${dominantObj.kpi.number}: ${dominantObj.shareOfCommittedPct.toFixed(0)}% of funds`;
    objSummary = `${zeroObjectives.length} objectives have $0; Obj ${dominantObj.kpi.number} uses most of the budget`;
  } else if (zeroObjectives.length >= 2 && totalApprovedCount >= 4) {
    objStatus = 'attention';
    objBadge = `${zeroObjectives.length} Goals at $0`;
    objSummary = `Obj ${zeroObjectives.map((z) => z.kpi.number).join(', ')} have 0 approved projects`;
  } else if (zeroObjectives.length === 1) {
    objStatus = totalApprovedCount >= 5 ? 'attention' : 'healthy';
    objBadge = `Obj ${zeroObjectives[0].kpi.number} at $0`;
    objSummary = `${7 - zeroObjectives.length} of 7 Global Objectives have projects`;
  }

  // C. Mission Pathway Continuity (Stages 1-5)
  const coreStages = pathwayStages.filter((s) => s.key !== 'enabling');
  const zeroCoreStages = coreStages.filter((s) => s.count === 0);
  const reachCount = stageTotals.reach_exposure.count;
  const engageCount = stageTotals.engagement_participation.count;
  const connectCount = stageTotals.connection_next_steps.count;
  const discipleCount = stageTotals.retention_nurturing.count;
  const multiplyCount = stageTotals.implementation_capability.count;
  const lateStageCount = connectCount + discipleCount;

  let pathwayStatus: HealthSeverity = 'healthy';
  let pathwayBadge = 'All 5 Stages Active';
  let pathwaySummary = 'Good balance from Stage 1 Reach to Stage 5 Multiply';

  if (zeroCoreStages.length >= 2 && totalApprovedCount >= 4) {
    pathwayStatus = 'critical';
    pathwayBadge = `${zeroCoreStages.length} Missing (${zeroCoreStages.map((s) => s.shortLabel).join(', ')})`;
    pathwaySummary = `No projects in ${zeroCoreStages.map((s) => `${s.stageNumberLabel}. ${s.shortLabel}`).join(' & ')}`;
  } else if (
    (zeroCoreStages.length === 1 || (reachCount <= 1 && lateStageCount >= 6)) &&
    totalApprovedCount >= 3
  ) {
    pathwayStatus = 'attention';
    if (zeroCoreStages.length === 1) {
      pathwayBadge = `0 in ${zeroCoreStages[0].stageNumberLabel}. ${zeroCoreStages[0].shortLabel}`;
      pathwaySummary = `No projects in Stage ${zeroCoreStages[0].stageNumberLabel} (${zeroCoreStages[0].shortLabel})`;
    } else {
      pathwayBadge = `Low Reach (${reachCount}) vs ${lateStageCount} Harvest`;
      pathwaySummary = 'Many harvest events, but very few Stage 1 Reach projects';
    }
  }

  // Overall Grade
  const statuses = [pillarStatus, objStatus, pathwayStatus];
  const criticalCount = statuses.filter((s) => s === 'critical').length;
  const attentionCount = statuses.filter((s) => s === 'attention').length;

  let overallStatus: HealthSeverity = 'healthy';
  let overallLabel = 'Healthy & Balanced';
  let overallHeadline = `Approved projects in ${scopeLabel} are well balanced across Pillars and Mission Pathway steps.`;

  if (criticalCount >= 1) {
    overallStatus = 'critical';
    overallLabel = 'Over Limit / Unbalanced';
    overallHeadline = `Spending in ${scopeLabel} is outside Playbook limits or missing key Mission Pathway steps.`;
  } else if (attentionCount >= 1) {
    overallStatus = 'attention';
    overallLabel = 'Needs Attention — Some Gaps';
    overallHeadline = `Some Global Objectives or Mission Pathway steps in ${scopeLabel} have few or no projects.`;
  }

  // Build Data Observations (Max 4 crisp, high-signal observations)
  const observations: HealthObservation[] = [];

  const isProposalMaker = userRole === 'user';

  if (maxOverPillar && (maxOverPillar.isOverCap || maxOverPillar.isSeverelySkewed)) {
    const overText =
      maxOverPillar.overUsd > 0
        ? ` (US$${formatCurrency(Math.round(maxOverPillar.overUsd))} over limit)`
        : '';
    observations.push({
      id: 'obs_pillar_over',
      severity: 'critical',
      title: `Pillar ${maxOverPillar.pillar.number} is over the Playbook budget limit`,
      detail: `${maxOverPillar.shareOfCommittedPct.toFixed(1)}% of approved funds (US$${formatCurrency(Math.round(maxOverPillar.budget))}) sit in Pillar ${maxOverPillar.pillar.number} vs. the ${maxOverPillar.targetCapPct}% ceiling${overText}.`,
      actionStep: isProposalMaker
        ? 'Shift new project drafts toward Pillar 1 (Training) or Pillar 2 (Tools, Media & UPG) with open budget room.'
        : `Hold new Pillar ${maxOverPillar.pillar.number} approvals unless tied directly to an underfunded Stage 1–2 handoff.`,
    });
  }

  // Effort vs. Investment mismatch (Perceived Priority insight)
  const p1Stat = pillarStats.find((s) => s.pillar.number === 1);
  const p2Stat = pillarStats.find((s) => s.pillar.number === 2);
  const p3Stat = pillarStats.find((s) => s.pillar.number === 3);
  const p12Count = (p1Stat?.count || 0) + (p2Stat?.count || 0);
  const p12Budget = (p1Stat?.budget || 0) + (p2Stat?.budget || 0);
  const p12ProjectShare = totalApprovedCount > 0 ? (p12Count / totalApprovedCount) * 100 : 0;
  const p12BudgetShare = totalApprovedBudget > 0 ? (p12Budget / totalApprovedBudget) * 100 : 0;
  const p12AvgProj = p12Count > 0 ? p12Budget / p12Count : 0;
  const p3AvgProj = p3Stat && p3Stat.count > 0 ? p3Stat.budget / p3Stat.count : 0;

  if (
    totalApprovedCount >= 4 &&
    p12Count >= 3 &&
    p12ProjectShare >= 25 &&
    p12BudgetShare <= p12ProjectShare * 0.45 &&
    p3AvgProj >= Math.max(p12AvgProj * 3, 1000)
  ) {
    const fmtCompact = (v: number) =>
      v >= 1000 ? `$${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : `$${Math.round(v)}`;
    observations.push({
      id: 'obs_priority_mismatch',
      severity: 'warning',
      title: 'Many training & tool projects, but very small budgets',
      detail: `${p12Count} of ${totalApprovedCount} projects (${Math.round(p12ProjectShare)}%) are in Pillar 1 & 2, yet receive only ${p12BudgetShare.toFixed(1)}% of funds (~${fmtCompact(p12AvgProj)}/project vs. ~${fmtCompact(p3AvgProj)} in Pillar 3).`,
      actionStep: isProposalMaker
        ? 'Budget adequate equipment, media creation, and member training stipends in Pillar 1–2 proposals rather than tiny side items.'
        : 'Review whether queued Pillar 1–2 proposals are under-resourced compared to large public event grants.',
    });
  } else if (underPillars.length > 0) {
    const p2 = underPillars.find((u) => u.pillar.number === 2) || underPillars[0];
    observations.push({
      id: 'obs_pillar_under',
      severity: 'warning',
      title: `Low funding in Pillar ${p2.pillar.number} (${p2.pillar.title})`,
      detail: `Only ${p2.shareOfCommittedPct.toFixed(1)}% of approved funds are in Pillar ${p2.pillar.number} vs. ${p2.targetCapPct}% target (~US$${formatCurrency(Math.round(p2.headroomUsd), 0)} headroom left).`,
      actionStep: isProposalMaker
        ? `Target Pillar ${p2.pillar.number} objectives in your next proposal to utilize the remaining US$${formatCurrency(Math.round(p2.headroomUsd), 0)} room.`
        : `Prioritize incoming Pillar ${p2.pillar.number} proposals in Step 3 & Step 4 reviews.`,
    });
  }

  if (zeroObjectives.length > 0 && totalApprovedCount >= 3) {
    observations.push({
      id: 'obs_zero_objs',
      severity: zeroObjectives.length >= 2 ? 'warning' : 'info',
      title: `${zeroObjectives.length} Global ${zeroObjectives.length === 1 ? 'Objective has' : 'Objectives have'} $0 approved`,
      detail: `0 approved projects currently cover ${zeroObjectives
        .map((z) => `Obj ${z.kpi.number} (${z.kpi.title})`)
        .join('; ')}.`,
      actionStep: isProposalMaker
        ? `Align upcoming drafts with Obj ${zeroObjectives.map((z) => z.kpi.number).join(' or ')} to close Union coverage gaps.`
        : `Check the pending review queue for proposals covering Obj ${zeroObjectives.map((z) => z.kpi.number).join(', ')}.`,
    });
  }

  // Pathway bottleneck observation
  if (totalApprovedCount >= 3) {
    if (multiplyCount === 0 && lateStageCount >= 3) {
      observations.push({
        id: 'obs_pathway_bottleneck',
        severity: 'warning',
        title: 'Missing Multiply step (0 Multiply · few Reach projects)',
        detail: `${lateStageCount} of ${totalApprovedCount} projects sit in Connect (${connectCount}) and Disciple (${discipleCount}), while Stage 1 Reach has ${reachCount} and Stage 5 Multiply has 0.`,
        actionStep: isProposalMaker
          ? 'Submit a Stage 5 Multiply training project or ensure Section 8 links existing outreach to new believer training.'
          : 'Verify queued Stage 3–4 proposals name concrete Stage 1 feeder channels and Stage 5 local church assimilation plans in Sec 8.',
      });
    } else if (zeroCoreStages.length > 0) {
      observations.push({
        id: 'obs_pathway_gap',
        severity: 'warning',
        title: `Missing Pathway step${zeroCoreStages.length > 1 ? 's' : ''}: ${zeroCoreStages.map((z) => z.shortLabel).join(', ')}`,
        detail: `No approved projects target ${zeroCoreStages.map((z) => `Stage ${z.stageNumberLabel} (${z.shortLabel})`).join(' or ')}, leaving a gap in the seeker journey.`,
        actionStep: isProposalMaker
          ? `Design a proposal targeting ${zeroCoreStages[0].shortLabel} (KPI ${zeroCoreStages[0].stageNumberLabel}), or explain how your team bridges that step in Section 8.`
          : `Confirm active proposals in Sec 8 cover the missing ${zeroCoreStages.map((z) => z.shortLabel).join(' / ')} handoff through local churches.`,
      });
    } else {
      observations.push({
        id: 'obs_pathway_healthy',
        severity: 'positive',
        title: 'All 5 Mission Pathway steps have projects',
        detail: `Reach (${reachCount}) → Engage (${engageCount}) → Connect (${connectCount}) → Disciple (${discipleCount}) → Multiply (${multiplyCount}) all have approved coverage.`,
        actionStep: isProposalMaker
          ? 'Reference the neighboring Union teams from this chain in Section 8 of your proposal.'
          : 'Verify during Step 4 reviews that Section 8 explicitly links approved proposals across adjacent stages.',
      });
    }
  }

  // Unit economics highlight if we have quantified non-dominant efficient objectives
  const efficientObjs = kpiStats
    .filter(
      (s) =>
        s.costPerPerson !== null &&
        s.costPerPerson > 0 &&
        s.count > 0 &&
        s.shareOfCommittedPct < 20
    )
    .sort((a, b) => (a.costPerPerson || 999999) - (b.costPerPerson || 999999));

  if (efficientObjs.length > 0 && observations.length < 4) {
    const best = efficientObjs[0];
    const fmtCost =
      best.costPerPerson! < 1
        ? `$${best.costPerPerson!.toFixed(2)}`
        : `$${best.costPerPerson!.toFixed(1)}`;
    observations.push({
      id: 'obs_efficiency',
      severity: 'positive',
      title: `Low cost per person in Obj ${best.kpi.number}`,
      detail: `Obj ${best.kpi.number} (${best.kpi.title}) reaches ~${Math.round(best.impact).toLocaleString()} people at ~${fmtCost}/person on ${best.shareOfCommittedPct.toFixed(1)}% of funds.`,
      actionStep: `Use Obj ${best.kpi.number} proposals (~${fmtCost}/person) as an efficiency benchmark when comparing itemized line budgets.`,
    });
  }

  // Build Role-Specific Playbook Intentionality Reminders
  const reminders: PlaybookReminder[] = [];

  if (isProposalMaker) {
    if (underPillars.length > 0 || zeroObjectives.length > 0) {
      const targetList =
        zeroObjectives.length > 0
          ? zeroObjectives.slice(0, 3).map((z) => `Obj ${z.kpi.number} (${z.kpi.title})`).join(', ')
          : underPillars.map((u) => `Pillar ${u.pillar.number}`).join(' & ');
      reminders.push({
        id: 'rem_maker_gap',
        tag: 'Best Areas for New Proposals',
        text: `The biggest Union funding gap is currently ${targetList}.`,
        actionStep: `Choose ${targetList} for your next draft to avoid Pillar 3 ceiling delays.`,
        pageRef: 'Playbook pp. 10–15',
      });
    }
    if (multiplyCount === 0 || reachCount <= 1) {
      reminders.push({
        id: 'rem_maker_pathway',
        tag: 'Plan Clear Follow-Up Steps',
        text:
          multiplyCount === 0
            ? 'Stage 5 (Multiply) currently has 0 approved projects in this scope.'
            : 'Every public Reach/Engage campaign needs an active local follow-up bridge.',
        actionStep:
          multiplyCount === 0
            ? 'Train local members, digital creators, or Bible workers—and link them in Section 8.'
            : 'Connect campaigns to HopeStartsHere.asia and name the local person replying within 48 hours.',
        pageRef: 'Playbook pp. 3, 15 & 28',
      });
    }
  } else {
    // Coordinators, Treasurers, Liaisons, Super Admins
    if (maxOverPillar && (maxOverPillar.isOverCap || maxOverPillar.isSeverelySkewed)) {
      reminders.push({
        id: 'rem_leader_rebalance',
        tag: 'Committee Review Tip',
        text: `Pillar ${maxOverPillar.pillar.number} already exceeds its Playbook ceiling in this pool.`,
        actionStep: `Before voting more Pillar ${maxOverPillar.pillar.number} grants, check if queued Pillar 1 or Pillar 2 projects need priority funding.`,
        pageRef: 'Review Framework & Playbook p. 16',
      });
    }
    reminders.push({
      id: 'rem_leader_handoff',
      tag: 'Check Full Mission Pathway',
      text:
        multiplyCount === 0
          ? 'This scope currently shows 0 approved Stage 5 Multiply projects.'
          : 'Seekers drop off if public outreach lacks a named local receiver.',
      actionStep:
        multiplyCount === 0
          ? 'Verify Step 4 recommendations encourage member/leader mobilization so new believers stay discipled.'
          : 'Confirm Section 8 names both the main 48-hour follow-up team and a backup local church before voting funds.',
      pageRef: 'Playbook pp. 13–15 & 34',
    });
  }

  return {
    overallStatus,
    overallLabel,
    overallHeadline,
    totalApprovedCount,
    totalApprovedBudget,
    subChecks: {
      pillarBalance: {
        id: 'pillar_balance',
        title: 'Pillar Balance',
        status: pillarStatus,
        badgeText: pillarBadge,
        summary: pillarSummary,
      },
      objectiveCoverage: {
        id: 'objective_coverage',
        title: '7 Global Goals',
        status: objStatus,
        badgeText: objBadge,
        summary: objSummary,
      },
      pathwayContinuity: {
        id: 'pathway_continuity',
        title: 'Mission Pathway',
        status: pathwayStatus,
        badgeText: pathwayBadge,
        summary: pathwaySummary,
      },
    },
    pathwayStages,
    observations: observations.slice(0, 4),
    reminders,
    goldenRule: PLAYBOOK_GOLDEN_RULE,
  };
}
