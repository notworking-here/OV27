import {
  Proposal,
  KPIType,
  UNIONS,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getCanonicalKpiType,
  getCanonicalDivisionProject,
  getProposalPillarKey,
} from '../types';
import {
  getUnionIntelligence,
  UNION_INTELLIGENCE_PROFILES,
  SSD_DIVISION_YEARBOOK_TOTALS,
  UnionIntelligenceProfile,
} from '../data/unionIntelligence';
import { parseKpiTargetNumber, formatMetricCount } from './kpiExtraction';
import { formatCurrency } from './userUtils';

export type PlausibilityVerdict = 'plausible' | 'verify_economics' | 'mismatch';

export type UpgReachTier =
  | 'named_upg'
  | 'group_e_general'
  | 'christian_seeker_cd'
  | 'internal_ab';

export interface StageCostBand {
  kpiType: Exclude<KPIType, ''>;
  stageNumber: 1 | 2 | 3 | 4 | 5;
  shortStageLabel: string;
  unitSingular: string;
  unitPlural: string;
  minExpectedUsd: number;
  maxExpectedUsd: number;
  hardHighOutlierUsd: number;
  bandDisplayLabel: string;
}

export const STAGE_COST_BANDS: Record<Exclude<KPIType, ''>, StageCostBand> = {
  reach_exposure: {
    kpiType: 'reach_exposure',
    stageNumber: 1,
    shortStageLabel: 'Stage 1 · Reach',
    unitSingular: 'person reached',
    unitPlural: 'people reached',
    minExpectedUsd: 0.005,
    maxExpectedUsd: 3.5,
    hardHighOutlierUsd: 18,
    bandDisplayLabel: '$0.01–$3.50 / reach',
  },
  engagement_participation: {
    kpiType: 'engagement_participation',
    stageNumber: 2,
    shortStageLabel: 'Stage 2 · Engage',
    unitSingular: 'engaged contact',
    unitPlural: 'engaged contacts',
    minExpectedUsd: 0.5,
    maxExpectedUsd: 40,
    hardHighOutlierUsd: 140,
    bandDisplayLabel: '$1–$40 / contact',
  },
  connection_next_steps: {
    kpiType: 'connection_next_steps',
    stageNumber: 3,
    shortStageLabel: 'Stage 3 · Connect',
    unitSingular: 'bridged guest',
    unitPlural: 'bridged guests',
    minExpectedUsd: 3,
    maxExpectedUsd: 180,
    hardHighOutlierUsd: 550,
    bandDisplayLabel: '$8–$180 / guest',
  },
  retention_nurturing: {
    kpiType: 'retention_nurturing',
    stageNumber: 4,
    shortStageLabel: 'Stage 4 · Disciple',
    unitSingular: 'disciple / study',
    unitPlural: 'disciples / studies',
    minExpectedUsd: 10,
    maxExpectedUsd: 450,
    hardHighOutlierUsd: 1200,
    bandDisplayLabel: '$20–$450 / person',
  },
  implementation_capability: {
    kpiType: 'implementation_capability',
    stageNumber: 5,
    shortStageLabel: 'Stage 5 · Multiply',
    unitSingular: 'equipped leader',
    unitPlural: 'equipped leaders',
    minExpectedUsd: 15,
    maxExpectedUsd: 750,
    hardHighOutlierUsd: 2500,
    bandDisplayLabel: '$25–$750 / leader',
  },
};

export const UPG_TIER_META: Record<
  UpgReachTier,
  {
    shortLabel: string;
    fullLabel: string;
    description: string;
    badgeClass: string;
    barClass: string;
  }
> = {
  named_upg: {
    shortLabel: 'Named UPG Focus',
    fullLabel: 'Named Unreached People Group / Local Language',
    description: 'Directly reaches an Unreached People Group, world religion, or local minority language in this Union',
    badgeClass: 'bg-teal-50 text-teal-900 border-teal-300',
    barClass: 'bg-teal-600',
  },
  group_e_general: {
    shortLabel: 'Group E (World Religions)',
    fullLabel: 'Group E · Non-Christian & Secular Neighbors (General)',
    description: 'Reaches Audience E (world religions or secular people), but does not name a specific local group or language',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-300',
    barClass: 'bg-sky-500',
  },
  christian_seeker_cd: {
    shortLabel: 'Christian / Seeker (C–D)',
    fullLabel: 'Groups C–D · Interested Seekers & Other Christians',
    description: 'Reaches interested seekers or non-Adventist Christians, without reaching non-Christian UPGs (Group E)',
    badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    barClass: 'bg-indigo-500',
  },
  internal_ab: {
    shortLabel: 'Church Members (A–B)',
    fullLabel: 'Groups A–B · Church Members, Youth & Leaders',
    description: 'Trains Adventist church members and leaders; does not directly reach outside unreached groups',
    badgeClass: 'bg-purple-50 text-purple-900 border-purple-200',
    barClass: 'bg-purple-500',
  },
};

export interface ProposalPlausibilityEvaluation {
  proposalId: string;
  unionName: string;
  unionAcronym: string;
  profile: UnionIntelligenceProfile | null;
  totalBudgetUsd: number;
  divisionBudgetUsd: number;
  localBudgetUsd: number;
  canonicalKpi: KPIType;
  stageBand: StageCostBand | null;
  targetValue: number | null;
  targetFormatted: string;
  costPerOutcomeUsd: number | null;
  costPerOutcomeFormatted: string;
  costPerChurchUsd: number | null;
  isAssetOrEnabling: boolean;
  assetSharePct: number;
  verdict: PlausibilityVerdict;
  verdictLabel: string;
  verdictShortBadge: string;
  territoryScaleRatioLabel: string;
  territoryScaleDetail: string;
  upgTier: UpgReachTier;
  upgTierMeta: (typeof UPG_TIER_META)[UpgReachTier];
  matchedUpgSignals: string[];
  isOfflineChannelIncluded: boolean;
  hasOfflineTerritoryMismatch: boolean;
  questionsToAsk: string[];
}

const ASSET_GEAR_REGEX =
  /\b(camera|lens|laptop|computer|workstation|server|mic|microphone|light|lighting|tripod|led|projector|equipment|gear|drone|hardware|studio|acoustic|switcher|gimbal|transmitter|tower|solar|generator|kit|kits|translation|dubb|subtitl|curriculum|app\s+dev|platform|website)\b/i;

const OFFLINE_TOUCHPOINT_REGEX =
  /\b(radio|awr|shortwave|fm\b|sd\s*card|microsd|usb|print|book|booklet|tract|literature|proclamation\s+kit|medical|clinic|health\s+expo|dental|water|literacy|livelihood|in-person|small\s+group|house\s+church|community\s+center|compassion|adra)\b/i;

const GENERIC_UPG_WORLD_RELIGION_REGEX =
  /\b(unreached|least-reached|least\s+reached|upg|upgs|frontier\s+people|10\/40|buddhist|buddhism|muslim|islam|islamic|mosque|temple|hindu|hinduism|animis\w*|tribal|indigenous|ethnic\s+minorit\w*|folk\s+religion|secular|non-christian|world\s+religion|amr\b|adventist\s+muslim|center\s+for\s+east\s+asian|buddhist\s+study)\b/i;

export function formatUnitCostCompact(cost: number | null): string {
  if (cost === null || !isFinite(cost) || cost <= 0) return '—';
  if (cost < 0.01) return '<$0.01';
  if (cost < 1) return `$${cost.toFixed(2)}`;
  if (cost < 10) return `$${cost.toFixed(2)}`;
  if (cost < 100) return `$${cost.toFixed(1).replace(/\.0$/, '')}`;
  return `$${Math.round(cost).toLocaleString()}`;
}

export function getProposalBudgets(proposal: Proposal): {
  divisionBudgetUsd: number;
  localBudgetUsd: number;
  totalBudgetUsd: number;
} {
  let divisionBudgetUsd = 0;
  let localBudgetUsd = 0;
  for (const item of proposal.budgetItems || []) {
    divisionBudgetUsd += Number(item.divisionFunding ?? item.gcFunding) || 0;
    localBudgetUsd += Number(item.localFunding) || 0;
  }
  if (divisionBudgetUsd === 0 && localBudgetUsd === 0) {
    const raw = proposal as Record<string, any>;
    divisionBudgetUsd = Number(raw.approvedBudget || raw.requestedBudget || raw.totalBudget) || 0;
  }
  return {
    divisionBudgetUsd,
    localBudgetUsd,
    totalBudgetUsd: divisionBudgetUsd + localBudgetUsd,
  };
}

/**
 * Checks whether a proposal explicitly names UPGs, world-religion bridge contexts,
 * or Union-specific unreached people group names / non-English minority languages.
 */
export function detectProposalUpgSignals(
  proposal: Proposal,
  profile: UnionIntelligenceProfile | null
): string[] {
  const signals = new Set<string>();

  // Check optional precomputed snapshot flag if narrative was stripped
  const rawAny = proposal as Record<string, any>;
  if (rawAny.hasNamedUpgFocus === true) {
    signals.add('Named UPG / Frontier Focus');
  }

  const fullText = [
    proposal.title,
    proposal.overview,
    proposal.goal,
    proposal.outcomes,
    proposal.deliverables,
    proposal.audienceEDetails,
    proposal.pointsOfIntegration,
    proposal.kpiDescription,
    ...(proposal.budgetItems || []).map((b) => b.activity),
  ]
    .filter(Boolean)
    .join(' ');

  if (!fullText.trim()) {
    return Array.from(signals);
  }

  // 1. Match against the Union's specific Joshua Project keyPeopleGroups & languages
  if (profile) {
    for (const pg of profile.keyPeopleGroups) {
      // Extract distinctive tokens >= 4 chars from the people group name (excluding generic words)
      const tokens = pg.name
        .split(/[\s,/()&-]+/)
        .map((t) => t.trim())
        .filter(
          (t) =>
            t.length >= 4 &&
            !/^(people|groups?|communities|youth|urban|rural|ethnic|tribal|majority|minority|chinese|indian|speakers|speaking|clusters?|muslim|buddhist)$/i.test(
              t
            )
        );
      for (const tok of tokens) {
        const escaped = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(fullText)) {
          signals.add(tok);
        }
      }
    }

    // Match primary local languages (excluding English)
    const langs = profile.primaryLanguagesSummary
      .split(/[,/&]+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 4 && !/^english$/i.test(l));
    for (const lang of langs) {
      const escaped = lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(fullText)) {
        signals.add(`${lang} language`);
      }
    }
  }

  // 2. Match explicit UPG / World-Religion bridge terms
  const genericMatches = fullText.match(GENERIC_UPG_WORLD_RELIGION_REGEX);
  if (genericMatches && genericMatches[0]) {
    signals.add(genericMatches[0]);
  }

  return Array.from(signals).slice(0, 4);
}

/**
 * Classifies a proposal's UPG & Audience Reach Tier.
 */
export function classifyProposalUpgTier(
  proposal: Proposal,
  profile: UnionIntelligenceProfile | null
): { tier: UpgReachTier; matchedSignals: string[] } {
  const rawAud = (proposal.targetAudiences || []).map((a) =>
    a.replace(/^group_/i, '').trim().toUpperCase()
  );
  const hasE = rawAud.includes('E');
  const hasCOrD = rawAud.includes('C') || rawAud.includes('D');
  const hasAB = rawAud.some((a) => a.startsWith('A') || a === 'B');
  const canonProj = getCanonicalDivisionProject(proposal.divisionProject);
  const isObj5Upg =
    canonProj === 'Mission Intelligence: Reaching Unreached People Groups';

  const matchedSignals = detectProposalUpgSignals(proposal, profile);
  const hasExplicitAudienceENarrative =
    (proposal.audienceEDetails || '').trim().length >= 20;

  if (
    (hasE && (matchedSignals.length > 0 || hasExplicitAudienceENarrative)) ||
    (isObj5Upg && (hasE || matchedSignals.length > 0))
  ) {
    return {
      tier: 'named_upg',
      matchedSignals:
        matchedSignals.length > 0
          ? matchedSignals
          : isObj5Upg
          ? ['Obj 5 UPG Intelligence']
          : ['Audience E Pathway'],
    };
  }

  if (hasE || isObj5Upg) {
    return { tier: 'group_e_general', matchedSignals };
  }

  if (hasCOrD) {
    return { tier: 'christian_seeker_cd', matchedSignals };
  }

  if (hasAB) {
    return { tier: 'internal_ab', matchedSignals };
  }

  // Fallback heuristic when targetAudiences is empty (e.g. legacy draft/snapshot)
  const pillarKey = getProposalPillarKey(proposal);
  const canonKpi = getCanonicalKpiType(proposal.kpiType);
  if (matchedSignals.length > 0) {
    return { tier: 'named_upg', matchedSignals };
  }
  if (pillarKey === 'inspiration' || canonKpi === 'implementation_capability') {
    return { tier: 'internal_ab', matchedSignals: [] };
  }
  return { tier: 'christian_seeker_cd', matchedSignals: [] };
}

/**
 * Evaluates a single Proposal's Budget-to-KPI Plausibility, Territory Scale, and UPG Reach Tier.
 */
export function evaluateProposalImpactPlausibility(
  proposal: Proposal
): ProposalPlausibilityEvaluation {
  const profile = getUnionIntelligence(proposal.union);
  const canonUnion = getCanonicalUnion(proposal.union || '');
  const unionAcronym =
    profile?.acronym ||
    UNION_ACRONYMS[canonUnion] ||
    UNION_ACRONYMS[proposal.union] ||
    'SSD';

  const { divisionBudgetUsd, localBudgetUsd, totalBudgetUsd } =
    getProposalBudgets(proposal);
  // Use Division Grant as primary benchmark if present, else total
  const effectiveBudget = divisionBudgetUsd > 0 ? divisionBudgetUsd : totalBudgetUsd;

  const canonicalKpi = getCanonicalKpiType(proposal.kpiType);
  const stageBand = canonicalKpi ? STAGE_COST_BANDS[canonicalKpi] : null;
  const parsedKpi = parseKpiTargetNumber(
    proposal.kpiNumber,
    proposal.kpiDescription,
    proposal.kpiType
  );
  const targetValue =
    parsedKpi.value !== null && parsedKpi.value > 0 ? parsedKpi.value : null;

  // Check reusable Asset / Enabling budget share so studio/equipment/training builds aren't misjudged as pure ad reach
  let assetBudgetUsd = 0;
  let allLineBudgetUsd = 0;
  for (const item of proposal.budgetItems || []) {
    const lineAmt =
      (Number(item.divisionFunding ?? item.gcFunding) || 0) +
      (Number(item.localFunding) || 0);
    allLineBudgetUsd += lineAmt;
    if (ASSET_GEAR_REGEX.test(item.activity || '')) {
      assetBudgetUsd += lineAmt;
    }
  }
  const assetSharePct =
    allLineBudgetUsd > 0 ? Math.round((assetBudgetUsd / allLineBudgetUsd) * 100) : 0;
  const pillarKey = getProposalPillarKey(proposal);
  const isAssetOrEnabling =
    assetSharePct >= 45 ||
    pillarKey === 'inspiration' ||
    canonicalKpi === 'implementation_capability';

  const costPerOutcomeUsd =
    targetValue !== null && effectiveBudget > 0 ? effectiveBudget / targetValue : null;
  const costPerOutcomeFormatted = formatUnitCostCompact(costPerOutcomeUsd);
  const costPerChurchUsd =
    profile && profile.churches > 0 && effectiveBudget > 0
      ? effectiveBudget / profile.churches
      : null;

  // Offline touchpoint check for High-Offline territories
  const combinedNarrative = [
    proposal.title,
    proposal.overview,
    proposal.deliverables,
    proposal.outcomes,
    ...(proposal.budgetItems || []).map((b) => b.activity),
  ]
    .filter(Boolean)
    .join(' ');
  const isOfflineChannelIncluded = OFFLINE_TOUCHPOINT_REGEX.test(combinedNarrative);
  const hasOfflineTerritoryMismatch = Boolean(
    profile?.isHighOfflineTerritory &&
      canonicalKpi === 'reach_exposure' &&
      combinedNarrative.trim().length > 30 &&
      !isOfflineChannelIncluded
  );

  // UPG Classification
  const { tier: upgTier, matchedSignals: matchedUpgSignals } = classifyProposalUpgTier(
    proposal,
    profile
  );
  const upgTierMeta = UPG_TIER_META[upgTier];

  // Territory Scale Ratio & Plausibility Verdict
  let territoryScaleRatioLabel = 'Waiting for Union data';
  let territoryScaleDetail = '';
  let verdict: PlausibilityVerdict = 'plausible';
  const questionsToAsk: string[] = [];

  if (targetValue === null) {
    territoryScaleRatioLabel = 'No KPI goal number';
    territoryScaleDetail =
      effectiveBudget > 0
        ? `US$${formatCurrency(effectiveBudget, 0)} requested with no clear goal number.`
        : 'Enter a goal number and budget to check if the cost per person is realistic.';

    if (effectiveBudget >= 5000) {
      verdict = 'mismatch';
      questionsToAsk.push(
        `This proposal asks for US$${formatCurrency(effectiveBudget, 0)} without a clear goal number. Ask the author to write one clear total number before voting.`
      );
    } else {
      verdict = 'verify_economics';
      questionsToAsk.push(
        'Add one clear KPI goal number so reviewers can check the cost per person.'
      );
    }
  } else if (profile && stageBand) {
    // 1. Compute Union Capacity / Scale Ratio
    if (canonicalKpi === 'reach_exposure') {
      const onlinePop = Math.max(
        1,
        Math.round(profile.population * (profile.avgInternetPenetrationPct / 100))
      );
      const basePop = isOfflineChannelIncluded ? profile.population : onlinePop;
      const pctPop = (targetValue / basePop) * 100;
      const popLabel = isOfflineChannelIncluded ? 'total people' : 'online people';
      territoryScaleRatioLabel = `${
        pctPop < 0.05 ? '<0.05' : pctPop < 10 ? pctPop.toFixed(2) : pctPop.toFixed(1)
      }% of ${unionAcronym} ${popLabel}`;
      territoryScaleDetail = `Aims to reach ${formatMetricCount(targetValue)} in a Union of ${(
        profile.population / 1_000_000
      ).toFixed(1)}M people (${profile.avgInternetPenetrationPct}% have internet; 1 Adventist per ${profile.memberToPopRatio.toLocaleString()} people).`;

      if (targetValue > profile.population * 2.5) {
        verdict = 'verify_economics';
        questionsToAsk.push(
          `The goal (${formatMetricCount(targetValue)}) is more than 2.5 times ${unionAcronym}'s whole population. Check if this counts total video views instead of individual people.`
        );
      }
    } else if (canonicalKpi === 'implementation_capability') {
      const pctMembers = (targetValue / Math.max(1, profile.membership)) * 100;
      const perChurch = targetValue / Math.max(1, profile.churches);
      territoryScaleRatioLabel = `${
        pctMembers < 0.1 ? '<0.1' : pctMembers.toFixed(1)
      }% of ${unionAcronym} members (~${
        perChurch < 10 ? perChurch.toFixed(1) : Math.round(perChurch)
      }/church)`;
      territoryScaleDetail = `Trains ${targetValue.toLocaleString()} leaders across ${profile.membership.toLocaleString()} church members and ${profile.churches.toLocaleString()} local churches.`;

      if (targetValue > profile.membership) {
        verdict = 'mismatch';
        questionsToAsk.push(
          `The goal (${targetValue.toLocaleString()}) is bigger than all church members in ${unionAcronym} (${profile.membership.toLocaleString()}). Check if public online views were entered under Stage 5 Multiply by mistake.`
        );
      } else if (pctMembers > 35) {
        verdict = 'verify_economics';
        questionsToAsk.push(
          `Training ${pctMembers.toFixed(0)}% of all church members in ${unionAcronym} is a very big goal. Check how the team will train people across ${profile.churches.toLocaleString()} churches.`
        );
      }
    } else {
      // Stages 2, 3, 4: Engagement, Connection, Discipleship -> benchmark per local church
      const perChurch = targetValue / Math.max(1, profile.churches);
      territoryScaleRatioLabel = `~${
        perChurch < 10 ? perChurch.toFixed(1) : Math.round(perChurch).toLocaleString()
      } ${stageBand.unitPlural.split(' ')[0]} / church (${profile.churches.toLocaleString()} churches)`;
      territoryScaleDetail = `${targetValue.toLocaleString()} ${stageBand.unitPlural} across ${profile.churches.toLocaleString()} ${unionAcronym} churches (${profile.avgMembersPerChurch} members per church on average).`;

      const maxPerChurch = canonicalKpi === 'retention_nurturing' ? 120 : 250;
      if (perChurch > maxPerChurch) {
        verdict = 'verify_economics';
        questionsToAsk.push(
          `This equals ~${Math.round(perChurch).toLocaleString()} ${stageBand.unitPlural} for every local church. Check if local churches have enough care workers, or if general online views were counted by mistake.`
        );
      } else if (
        effectiveBudget >= 30000 &&
        perChurch < 0.25 &&
        !isAssetOrEnabling
      ) {
        verdict = 'verify_economics';
        questionsToAsk.push(
          `US$${formatCurrency(effectiveBudget, 0)} reaches only ${targetValue.toLocaleString()} people (fewer than 1 person for every 4 churches in ${unionAcronym}). Check if long-term tools or equipment explain the high cost.`
        );
      }
    }

    // 2. Evaluate Budget-to-KPI Cost Band
    if (costPerOutcomeUsd !== null && effectiveBudget > 0 && verdict !== 'mismatch') {
      const assetMultiplier = isAssetOrEnabling ? 2.5 : 1.0;
      const effectiveMax = stageBand.maxExpectedUsd * assetMultiplier;
      const effectiveHardOutlier = stageBand.hardHighOutlierUsd * assetMultiplier;

      if (costPerOutcomeUsd > effectiveHardOutlier && effectiveBudget >= 5000) {
        verdict = isAssetOrEnabling ? 'verify_economics' : 'mismatch';
        questionsToAsk.unshift(
          `Cost is ${costPerOutcomeFormatted} per ${stageBand.unitSingular} (typical for ${stageBand.shortStageLabel}: ${stageBand.bandDisplayLabel}). Check if the budget buys multi-year equipment, or if the goal number is too small.`
        );
      } else if (costPerOutcomeUsd > effectiveMax && effectiveBudget >= 3000) {
        if (verdict === 'plausible') verdict = 'verify_economics';
        questionsToAsk.unshift(
          `${costPerOutcomeFormatted} per ${stageBand.unitSingular} is higher than the usual ${stageBand.bandDisplayLabel} range${
            isAssetOrEnabling
              ? ' (partly because it includes equipment or training—check how long churches will reuse these tools).'
              : '—check if costs can be lowered or if more people can be reached.'
          }`
        );
      } else if (
        costPerOutcomeUsd < stageBand.minExpectedUsd &&
        (canonicalKpi === 'connection_next_steps' ||
          canonicalKpi === 'retention_nurturing' ||
          canonicalKpi === 'implementation_capability')
      ) {
        if (verdict === 'plausible') verdict = 'verify_economics';
        questionsToAsk.unshift(
          `${costPerOutcomeFormatted} per ${stageBand.unitSingular} is very low for ${stageBand.shortStageLabel}. Check that the goal (${formatMetricCount(
            targetValue
          )}) counts real ${stageBand.unitPlural}, not general online views.`
        );
      }
    }
  } else if (stageBand && costPerOutcomeUsd !== null) {
    territoryScaleRatioLabel = `${formatMetricCount(targetValue)} ${stageBand.unitPlural}`;
    territoryScaleDetail = `Division-wide project (${costPerOutcomeFormatted} per ${stageBand.unitSingular}).`;
    if (costPerOutcomeUsd > stageBand.hardHighOutlierUsd && !isAssetOrEnabling) {
      verdict = 'verify_economics';
      questionsToAsk.push(
        `Cost of ${costPerOutcomeFormatted} per ${stageBand.unitSingular} is higher than the usual ${stageBand.bandDisplayLabel} range.`
      );
    }
  }

  // 3. Add Territory / UPG Relevance Prompt so voters consider Unreached People Groups
  if (profile) {
    if (
      profile.leastReachedGroupsCount >= 10 &&
      (upgTier === 'internal_ab' || upgTier === 'christian_seeker_cd') &&
      pillarKey === 'proclamation'
    ) {
      questionsToAsk.push(
        `${unionAcronym} has ${profile.leastReachedGroupsCount} Unreached People Groups (1 Adventist per ${profile.memberToPopRatio.toLocaleString()} people), yet this project only reaches ${
          upgTier === 'internal_ab' ? 'Church Members (A–B)' : 'Christians/Seekers (C–D)'
        }. Ask how it can also welcome Group E / unreached neighbors.`
      );
    } else if (upgTier === 'group_e_general' && profile.keyPeopleGroups.length > 0) {
      const sampleGroups = profile.keyPeopleGroups
        .slice(0, 2)
        .map((g) => g.name.split('(')[0].trim())
        .join(' or ');
      questionsToAsk.push(
        `This project selects Audience E in ${unionAcronym}. Ask which specific local group or language (for example, ${sampleGroups}) it is made for.`
      );
    } else if (hasOfflineTerritoryMismatch) {
      questionsToAsk.push(
        `${profile.offlinePopulationSummary} in ${unionAcronym}. Consider adding offline ways to reach them, such as radio, audio SD cards, printed booklets, or community visits.`
      );
    }
  }

  if (questionsToAsk.length === 0) {
    questionsToAsk.push(
      isAssetOrEnabling
        ? `This training/equipment investment (${costPerOutcomeFormatted} per ${
            stageBand?.unitSingular || 'person'
          }${
            costPerChurchUsd ? ` · ~$${Math.round(costPerChurchUsd).toLocaleString()} per church` : ''
          }) fits ${unionAcronym}'s church size well.`
        : `Cost (${costPerOutcomeFormatted} per ${
            stageBand?.unitSingular || 'person'
          }) and goal size (${territoryScaleRatioLabel}) are realistic for ${
            stageBand?.shortStageLabel || 'this stage'
          }.`
    );
  }

  const verdictLabel =
    verdict === 'plausible'
      ? 'Realistic Cost & Goal'
      : verdict === 'verify_economics'
      ? 'Check Cost or Goal'
      : 'Goal / Budget Mismatch';

  const verdictShortBadge =
    verdict === 'plausible'
      ? 'Realistic'
      : verdict === 'verify_economics'
      ? 'Check Cost/Goal'
      : 'Fix Goal';

  return {
    proposalId: proposal.id,
    unionName: canonUnion || proposal.union || 'SSD',
    unionAcronym,
    profile,
    totalBudgetUsd,
    divisionBudgetUsd,
    localBudgetUsd,
    canonicalKpi,
    stageBand,
    targetValue,
    targetFormatted: parsedKpi.formatted,
    costPerOutcomeUsd,
    costPerOutcomeFormatted,
    costPerChurchUsd,
    isAssetOrEnabling,
    assetSharePct,
    verdict,
    verdictLabel,
    verdictShortBadge,
    territoryScaleRatioLabel,
    territoryScaleDetail,
    upgTier,
    upgTierMeta,
    matchedUpgSignals,
    isOfflineChannelIncluded,
    hasOfflineTerritoryMismatch,
    questionsToAsk: questionsToAsk.slice(0, 2),
  };
}

export interface TierPortfolioStat {
  tier: UpgReachTier;
  meta: (typeof UPG_TIER_META)[UpgReachTier];
  proposalCount: number;
  budgetUsd: number;
  shareOfBudgetPct: number;
  targetSum: number;
}

export interface UnionUpgSpotCheckRow {
  unionName: string;
  acronym: string;
  leastReachedGroupsCount: number;
  memberToPopRatio: number;
  approvedCount: number;
  totalBudgetUsd: number;
  groupEAndUpgBudgetUsd: number;
  groupEAndUpgSharePct: number;
  namedUpgCount: number;
  isBlindSpot: boolean;
}

export interface TerritoryUpgCorrelationSummary {
  scopeLabel: string;
  isSingleUnion: boolean;
  profile: UnionIntelligenceProfile | null;
  population: number;
  onlinePopulation: number;
  offlinePopulation: number;
  offlinePct: number;
  churches: number;
  membership: number;
  memberToPopRatio: number;
  totalPeopleGroupsCount: number;
  leastReachedGroupsCount: number;
  leastReachedShareOfGroupsPct: number;
  proposalCount: number;
  totalBudgetUsd: number;
  tiers: Record<UpgReachTier, TierPortfolioStat>;
  combinedUpgAndGroupESharePct: number;
  combinedUpgAndGroupEBudgetUsd: number;
  combinedUpgAndGroupECount: number;
  plausibilityCounts: {
    plausible: number;
    verify_economics: number;
    mismatch: number;
  };
  penetration: {
    stage1ReachTotal: number;
    stage1PctOfPopulation: number;
    stage2To4SeekersTotal: number;
    seekersPerChurch: number;
    stage5EquippedTotal: number;
    equippedPctOfMembership: number;
  };
  highUpgUnionRows: UnionUpgSpotCheckRow[];
  insights: {
    id: string;
    tone: 'critical' | 'warning' | 'positive' | 'info';
    title: string;
    detail: string;
  }[];
}

/**
 * Correlates a portfolio of proposals against Union / Division Population,
 * Unreached People Groups (UPGs), and Stage Plausibility.
 */
export function evaluateTerritoryUpgAndImpactCorrelation(
  proposals: Proposal[],
  selectedUnion: string = 'all'
): TerritoryUpgCorrelationSummary {
  const isSingleUnion = Boolean(
    selectedUnion &&
      selectedUnion !== 'all' &&
      !selectedUnion.toLowerCase().includes('headquarters')
  );
  const profile = isSingleUnion ? getUnionIntelligence(selectedUnion) : null;

  const population = profile
    ? profile.population
    : SSD_DIVISION_YEARBOOK_TOTALS.population;
  const churches = profile
    ? profile.churches
    : SSD_DIVISION_YEARBOOK_TOTALS.churches;
  const membership = profile
    ? profile.membership
    : SSD_DIVISION_YEARBOOK_TOTALS.membership;
  const memberToPopRatio = profile
    ? profile.memberToPopRatio
    : SSD_DIVISION_YEARBOOK_TOTALS.memberToPopRatio;
  const totalPeopleGroupsCount = profile
    ? profile.totalPeopleGroupsCount
    : SSD_DIVISION_YEARBOOK_TOTALS.totalPeopleGroupsCount;
  const leastReachedGroupsCount = profile
    ? profile.leastReachedGroupsCount
    : SSD_DIVISION_YEARBOOK_TOTALS.leastReachedGroupsCount;

  const avgOnlinePct = profile
    ? profile.avgInternetPenetrationPct
    : Math.round(
        (Object.values(UNION_INTELLIGENCE_PROFILES).reduce(
          (acc, u) => acc + u.population * (u.avgInternetPenetrationPct / 100),
          0
        ) /
          Math.max(1, SSD_DIVISION_YEARBOOK_TOTALS.population)) *
          1000
      ) / 10;

  const onlinePopulation = Math.round(population * (avgOnlinePct / 100));
  const offlinePopulation = Math.max(0, population - onlinePopulation);
  const offlinePct = Math.max(0, Math.round((100 - avgOnlinePct) * 10) / 10);
  const leastReachedShareOfGroupsPct =
    totalPeopleGroupsCount > 0
      ? Math.round((leastReachedGroupsCount / totalPeopleGroupsCount) * 100)
      : 0;

  const tierInit = (tier: UpgReachTier): TierPortfolioStat => ({
    tier,
    meta: UPG_TIER_META[tier],
    proposalCount: 0,
    budgetUsd: 0,
    shareOfBudgetPct: 0,
    targetSum: 0,
  });

  const tiers: Record<UpgReachTier, TierPortfolioStat> = {
    named_upg: tierInit('named_upg'),
    group_e_general: tierInit('group_e_general'),
    christian_seeker_cd: tierInit('christian_seeker_cd'),
    internal_ab: tierInit('internal_ab'),
  };

  const plausibilityCounts = {
    plausible: 0,
    verify_economics: 0,
    mismatch: 0,
  };

  let totalBudgetUsd = 0;
  let stage1ReachTotal = 0;
  let stage2To4SeekersTotal = 0;
  let stage5EquippedTotal = 0;

  const evaluations = proposals.map((p) => evaluateProposalImpactPlausibility(p));

  for (const ev of evaluations) {
    const b = ev.divisionBudgetUsd > 0 ? ev.divisionBudgetUsd : ev.totalBudgetUsd;
    totalBudgetUsd += b;

    tiers[ev.upgTier].proposalCount += 1;
    tiers[ev.upgTier].budgetUsd += b;
    tiers[ev.upgTier].targetSum += ev.targetValue || 0;

    plausibilityCounts[ev.verdict] += 1;

    if (ev.targetValue && ev.targetValue > 0) {
      if (ev.canonicalKpi === 'reach_exposure') {
        stage1ReachTotal += ev.targetValue;
      } else if (ev.canonicalKpi === 'implementation_capability') {
        stage5EquippedTotal += ev.targetValue;
      } else if (ev.canonicalKpi) {
        stage2To4SeekersTotal += ev.targetValue;
      }
    }
  }

  for (const key of Object.keys(tiers) as UpgReachTier[]) {
    tiers[key].shareOfBudgetPct =
      totalBudgetUsd > 0
        ? Math.round((tiers[key].budgetUsd / totalBudgetUsd) * 1000) / 10
        : 0;
  }

  const combinedUpgAndGroupEBudgetUsd =
    tiers.named_upg.budgetUsd + tiers.group_e_general.budgetUsd;
  const combinedUpgAndGroupECount =
    tiers.named_upg.proposalCount + tiers.group_e_general.proposalCount;
  const combinedUpgAndGroupESharePct =
    totalBudgetUsd > 0
      ? Math.round((combinedUpgAndGroupEBudgetUsd / totalBudgetUsd) * 1000) / 10
      : 0;

  const stage1PctOfPopulation =
    population > 0 ? Math.round((stage1ReachTotal / population) * 10000) / 100 : 0;
  const seekersPerChurch =
    churches > 0 ? Math.round((stage2To4SeekersTotal / churches) * 10) / 10 : 0;
  const equippedPctOfMembership =
    membership > 0 ? Math.round((stage5EquippedTotal / membership) * 1000) / 10 : 0;

  // Build Union-by-Union UPG Spot-Check Rows (for multi-union / Division scope)
  const highUpgUnionRows: UnionUpgSpotCheckRow[] = [];
  if (!isSingleUnion) {
    for (const uName of UNIONS) {
      if (uName.toLowerCase().includes('headquarters')) continue;
      const uProf = getUnionIntelligence(uName);
      if (!uProf) continue;
      // Focus on Unions with meaningful UPG challenge (>= 8 UPGs or ratio >= 400)
      if (uProf.leastReachedGroupsCount < 8 && uProf.memberToPopRatio < 400) continue;

      const uEvals = evaluations.filter(
        (e) => getCanonicalUnion(e.unionName) === getCanonicalUnion(uName)
      );
      const uBudget = uEvals.reduce(
        (s, e) => s + (e.divisionBudgetUsd > 0 ? e.divisionBudgetUsd : e.totalBudgetUsd),
        0
      );
      const uGroupEBudget = uEvals
        .filter((e) => e.upgTier === 'named_upg' || e.upgTier === 'group_e_general')
        .reduce(
          (s, e) => s + (e.divisionBudgetUsd > 0 ? e.divisionBudgetUsd : e.totalBudgetUsd),
          0
        );
      const namedCount = uEvals.filter((e) => e.upgTier === 'named_upg').length;
      const share = uBudget > 0 ? Math.round((uGroupEBudget / uBudget) * 100) : 0;

      highUpgUnionRows.push({
        unionName: uName,
        acronym: uProf.acronym,
        leastReachedGroupsCount: uProf.leastReachedGroupsCount,
        memberToPopRatio: uProf.memberToPopRatio,
        approvedCount: uEvals.length,
        totalBudgetUsd: uBudget,
        groupEAndUpgBudgetUsd: uGroupEBudget,
        groupEAndUpgSharePct: share,
        namedUpgCount: namedCount,
        isBlindSpot: uEvals.length > 0 && uGroupEBudget === 0,
      });
    }
    highUpgUnionRows.sort(
      (a, b) => b.leastReachedGroupsCount - a.leastReachedGroupsCount
    );
  }

  // Build Plain-English Correlation Insights
  const scopeLabel = profile ? profile.acronym : 'SSD Division';
  const insights: TerritoryUpgCorrelationSummary['insights'] = [];

  if (proposals.length === 0) {
    insights.push({
      id: 'upg_empty',
      tone: 'info',
      title: `Union population data ready for ${scopeLabel}`,
      detail: `${scopeLabel} has ${leastReachedGroupsCount.toLocaleString()} Unreached People Groups (${leastReachedShareOfGroupsPct}% of ${totalPeopleGroupsCount.toLocaleString()} groups) and 1 Adventist per ${memberToPopRatio.toLocaleString()} people. Once projects are approved, their UPG reach and cost-per-person check will show here.`,
    });
  } else {
    // 1. UPG Coverage Insight
    if (leastReachedGroupsCount >= 10 && combinedUpgAndGroupECount === 0) {
      insights.push({
        id: 'upg_zero_gap',
        tone: 'critical',
        title: `0% of funds in ${scopeLabel} reach Group E / Unreached People Groups`,
        detail: `${scopeLabel} has ${leastReachedGroupsCount.toLocaleString()} Unreached People Groups (1 Adventist per ${memberToPopRatio.toLocaleString()} people), yet 100% of the US$${formatCurrency(
          totalBudgetUsd,
          0
        )} budget goes only to Christians/Seekers (C–D) or Church Members (A–B).`,
      });
    } else if (leastReachedGroupsCount >= 10 && combinedUpgAndGroupESharePct < 15) {
      insights.push({
        id: 'upg_thin_share',
        tone: 'warning',
        title: `Low funding for Unreached Groups (${combinedUpgAndGroupESharePct}% of budget)`,
        detail: `Only US$${formatCurrency(
          combinedUpgAndGroupEBudgetUsd,
          0
        )} (${combinedUpgAndGroupECount} of ${proposals.length} projects) reaches Group E or named Unreached People Groups in ${scopeLabel}, even though ${leastReachedGroupsCount.toLocaleString()} unreached groups live here.`,
      });
    } else if (tiers.named_upg.proposalCount > 0) {
      insights.push({
        id: 'upg_active_named',
        tone: 'positive',
        title: `${tiers.named_upg.proposalCount} ${
          tiers.named_upg.proposalCount === 1 ? 'project reaches' : 'projects reach'
        } named Unreached Groups / local languages`,
        detail: `US$${formatCurrency(
          combinedUpgAndGroupEBudgetUsd,
          0
        )} (${combinedUpgAndGroupESharePct}% of funds) reaches Group E and Unreached People Groups across ${scopeLabel}.`,
      });
    }

    // 2. Plausibility Health Insight
    const flaggedPlausibility =
      plausibilityCounts.verify_economics + plausibilityCounts.mismatch;
    if (flaggedPlausibility > 0) {
      insights.push({
        id: 'plausibility_flags',
        tone: plausibilityCounts.mismatch > 0 ? 'warning' : 'info',
        title: `${flaggedPlausibility} of ${proposals.length} ${
          proposals.length === 1 ? 'project needs' : 'projects need'
        } a cost-to-goal check`,
        detail:
          plausibilityCounts.mismatch > 0
            ? `${plausibilityCounts.mismatch} ${
                plausibilityCounts.mismatch === 1 ? 'is' : 'are'
              } missing a clear KPI goal number or has an unrealistic cost/goal size, and ${
                plausibilityCounts.verify_economics
              } ${
                plausibilityCounts.verify_economics === 1 ? 'has' : 'have'
              } a high or low cost per person.`
            : `${plausibilityCounts.verify_economics} ${
                plausibilityCounts.verify_economics === 1 ? 'project has' : 'projects have'
              } a higher or lower cost per person than usual. Check if long-term equipment or multi-year tools explain the budget.`,
      });
    } else {
      insights.push({
        id: 'plausibility_clean',
        tone: 'positive',
        title: `All ${proposals.length} projects have realistic budgets and goals`,
        detail: `Every project has one clear goal number that fits usual costs and ${scopeLabel}'s church size.`,
      });
    }

    // 3. Church & Territory Absorption Insight
    if (stage2To4SeekersTotal > 0) {
      insights.push({
        id: 'church_absorption',
        tone: seekersPerChurch > 180 ? 'warning' : 'info',
        title: `Visitors per Local Church: ~${seekersPerChurch} contacts/guests per church`,
        detail: `Approved Stages 2–4 projects aim to welcome and care for ${formatMetricCount(
          stage2To4SeekersTotal
        )} people across ${churches.toLocaleString()} local churches in ${scopeLabel}${
          stage5EquippedTotal > 0
            ? `, supported by ${formatMetricCount(stage5EquippedTotal)} trained leaders (${equippedPctOfMembership}% of members).`
            : '—with 0 Stage 5 Multiply leaders trained yet.'
        }`,
      });
    }
  }

  return {
    scopeLabel,
    isSingleUnion,
    profile,
    population,
    onlinePopulation,
    offlinePopulation,
    offlinePct,
    churches,
    membership,
    memberToPopRatio,
    totalPeopleGroupsCount,
    leastReachedGroupsCount,
    leastReachedShareOfGroupsPct,
    proposalCount: proposals.length,
    totalBudgetUsd,
    tiers,
    combinedUpgAndGroupESharePct,
    combinedUpgAndGroupEBudgetUsd,
    combinedUpgAndGroupECount,
    plausibilityCounts,
    penetration: {
      stage1ReachTotal,
      stage1PctOfPopulation,
      stage2To4SeekersTotal,
      seekersPerChurch,
      stage5EquippedTotal,
      equippedPctOfMembership,
    },
    highUpgUnionRows,
    insights: insights.slice(0, 3),
  };
}
