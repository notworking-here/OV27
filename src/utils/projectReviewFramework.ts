import {
  Proposal,
  ReviewReadinessRating,
  ReviewCriterionKey,
  LiaisonActionItem,
  REVIEW_READINESS_LABELS,
  TARGET_AUDIENCE_OPTIONS,
  getCanonicalDivisionProject,
  getCanonicalKpiType,
  getProposalPillarKey,
  getProposalReviewNotes,
  isKpiAlignedWithObjective,
  KPI_OPTIONS,
} from '../types';
import {
  detectBridgingProposalContext,
  getBridgingGuidanceForUnion,
} from '../data/bridgingEventsGuide';

export const REVIEW_FRAMEWORK_PDF_URL =
  '/assets/aistudio/OneVoice27_Project_Review_Framework_d174d4d8.pdf';

export type PillarSubType =
  | 'p1_enabling'
  | 'p2_tools_intelligence'
  | 'p2_community_service'
  | 'p3_proclamation_discipleship'
  | 'unclassified';

export const PILLAR_SUBTYPE_LABELS: Record<
  PillarSubType,
  { shortLabel: string; fullLabel: string; pillarNumber: 1 | 2 | 3 | 0 }
> = {
  p1_enabling: {
    shortLabel: 'P1 · Enabling & Training',
    fullLabel: 'Pillar 1 · Prayer, Training & Inspiration (Enabling Capability)',
    pillarNumber: 1,
  },
  p2_tools_intelligence: {
    shortLabel: 'P2A · Intelligence & Tools',
    fullLabel: 'Pillar 2A · Mission Intelligence, Media & Shared Tools',
    pillarNumber: 2,
  },
  p2_community_service: {
    shortLabel: 'P2B · Needs-Based Service',
    fullLabel: 'Pillar 2B · Needs-Based Community Service (Health/Compassion)',
    pillarNumber: 2,
  },
  p3_proclamation_discipleship: {
    shortLabel: 'P3 · Proclamation & Harvest',
    fullLabel: 'Pillar 3 · Proclamation, Harvesting & Disciple Making',
    pillarNumber: 3,
  },
  unclassified: {
    shortLabel: 'Unclassified',
    fullLabel: 'Unclassified Pillar',
    pillarNumber: 0,
  },
};

export interface PillarBudgetConcordance {
  isAligned: boolean;
  mismatchType: 'p3_tool_heavy_no_proclamation' | 'p1_ad_or_gear_heavy_no_training' | null;
  summaryLabel: string;
  explanation: string;
  productionAndGearSharePct: number;
  proclamationAndFollowupSharePct: number;
  trainingSharePct: number;
  totalBudgetUsd: number;
}

export interface CommunityServiceSafeguardCheck {
  isCommunityServiceDetected: boolean;
  matchedServiceKeywords: string[];
  hasUnconditionalAndConsentSafeguard: boolean;
  status: 'not_applicable' | 'documented' | 'missing_safeguard';
  guidanceTitle: string;
  guidanceMessage: string;
  suggestedIntegrationSnippet: string;
}

export interface ReviewPresetFixChip {
  id: string;
  label: string;
  targetSectionId: string;
  targetSectionLabel: string;
  shortSectionBadge: string;
  whyItMatters: string;
  pointers: string[];
  exampleTemplate: string;
  instruction: string;
  isRelevantGap?: boolean;
}

export interface ReviewGapStatusItem {
  label: string;
  ok: boolean;
}

export interface ReviewQuestionEvaluation {
  key: ReviewCriterionKey;
  number: number;
  shortTitle: string;
  questionPrompt: string;
  whyAsked: string;
  trackExpectation: string;
  status: 'adequate' | 'needs_work';
  evidenceOrGapNote: string;
  extractedEvidence: string;
  gapBreakdown?: ReviewGapStatusItem[];
  relatedSectionId: string;
  sectionLabel: string;
  shortSectionBadge: string;
  defaultFixInstruction: string;
  presetFixChips: ReviewPresetFixChip[];
}

export interface ProposalReviewFrameworkEvaluation {
  pillarTrack: 'pillar_1_2' | 'pillar_3';
  subType: PillarSubType;
  subTypeMeta: {
    shortLabel: string;
    fullLabel: string;
    pillarNumber: 1 | 2 | 3 | 0;
  };
  principalStageKey:
    | 'enabling'
    | 'reach_exposure'
    | 'engagement_participation'
    | 'connection_next_steps'
    | 'retention_nurturing'
    | 'implementation_capability';
  principalStageLabel: string;
  questions: ReviewQuestionEvaluation[];
  adequateCount: number;
  deficientKeys: ReviewCriterionKey[];
  budgetConcordance: PillarBudgetConcordance;
  serviceSafeguard: CommunityServiceSafeguardCheck;
  hasPassiveOnlyStageMetric: boolean;
  passiveMetricGuidance: string | null;
  autoEvaluatedRating: ReviewReadinessRating;
  effectiveRating: ReviewReadinessRating;
  effectiveRatingLabel: string;
  ratingSource: 'liaison_certified' | 'governance_certified' | 'auto_evaluated';
  hasSplitLiaisonVerdict: boolean;
}

const COMMUNITY_SERVICE_REGEX =
  /\b(medical\s+mission\w*|health\s+clinic\w*|dental\s+clinic\w*|health\s+expo\w*|clean\s+water|water\s+well\w*|sanitation|literacy\s+(?:class\w*|program\w*|project\w*)|livelihood\s+(?:training|program\w*|project\w*|support)|food\s+(?:distribution|relief|pantry|assistance)|disaster\s+relief|humanitarian|adra\b|community\s+service\s+project\w*|welfare\s+assistance|compassion\s+(?:ministry|ministries|service\w*|outreach)|free\s+(?:clinic\w*|medical|check-?up\w*))\b/i;

const SAFEGUARD_UNCONDITIONAL_AND_CONSENT_REGEX =
  /\b(unconditional\w*|not\s+conditioned|never\s+conditioned|without\s+(?:religious\s+)?condition\w*|regardless\s+of\s+(?:religious\s+)?response|no\s+religious\s+(?:condition|obligation|requirement)|voluntary\s+consent|consented\s+referral\w*|consenting\s+(?:participant\w*|beneficiar\w*|seeker\w*|referral\w*)|with\s+(?:explicit\s+|voluntary\s+|informed\s+)?consent|opt-in\s+consent)\b/i;

function compactSnippet(raw: string | undefined | null, maxLen = 110): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

function findMatchingSentence(text: string, regex: RegExp, maxLen = 115): string {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    if (regex.test(s)) {
      return compactSnippet(s, maxLen);
    }
  }
  return '';
}

function classifyLineForConcordance(activityText: string):
  | 'gear_production'
  | 'proclamation_followup'
  | 'training'
  | 'research_service'
  | 'general' {
  const t = activityText.toLowerCase();
  if (
    /\b(camera|lens|laptop|computer|mic|microphone|light|tripod|led|projector|equipment|gear|drone|hardware|studio|switcher|gimbal|video\s+edit|post-production|post\s+production|film|animat|dubb|subtitl|software\s+license|adobe)\b/.test(
      t
    )
  ) {
    return 'gear_production';
  }
  if (
    /\b(train|seminar|workshop|bootcamp|conference|summit|facilitator|speaker|delegate|syllabus|creator\s+conference)\b/.test(
      t
    )
  ) {
    return 'training';
  }
  if (
    /\b(survey|research|mapping|demographic|focus\s+group|medical|clinic|health|water|literacy|livelihood|relief|compassion)\b/.test(
      t
    )
  ) {
    return 'research_service';
  }
  if (
    /\b(follow-up|follow\s+up|bible\s+worker|bible\s+study|hope\s+care|small\s+group|care\s+group|reap|crusade|evangelis|baptism|visitation|interest\s+coordinator|bridging|ad\s+spend|boosting|facebook\s+ad|meta|paid\s+media|hopestartshere|airtime|broadcast|literature|tract)\b/.test(
      t
    )
  ) {
    return 'proclamation_followup';
  }
  return 'general';
}

/**
 * Classifies a proposal into the SSD Three-Pillar Review Framework sub-types:
 * - Pillar 1: Enabling & Training
 * - Pillar 2A: Mission Intelligence, Media & Shared Tools
 * - Pillar 2B: Needs-Based Community Service (Health, Water, Education, Livelihood, Compassion)
 * - Pillar 3: Proclamation, Harvesting & Disciple Making
 */
export function classifyProposalSubType(proposal: Proposal): PillarSubType {
  const pillarKey = getProposalPillarKey(proposal);
  const combinedNarrative = [
    proposal.title,
    proposal.overview,
    proposal.goal,
    proposal.outcomes,
    proposal.deliverables,
  ]
    .filter(Boolean)
    .join(' ');

  if (pillarKey === 'inspiration') {
    return 'p1_enabling';
  }

  if (pillarKey === 'bold_initiatives') {
    if (COMMUNITY_SERVICE_REGEX.test(combinedNarrative)) {
      return 'p2_community_service';
    }
    return 'p2_tools_intelligence';
  }

  if (pillarKey === 'proclamation') {
    return 'p3_proclamation_discipleship';
  }

  return 'unclassified';
}

/**
 * Evaluates whether the proposal's actual budget use matches its declared Primary Pillar
 * ("Tool Maker = Pillar 2 vs. Tool User for Proclamation = Pillar 3").
 */
export function analyzePillarBudgetConcordance(proposal: Proposal): PillarBudgetConcordance {
  const pillarKey = getProposalPillarKey(proposal);
  const items = proposal.budgetItems || [];

  let total = 0;
  let gearProd = 0;
  let procFollowup = 0;
  let training = 0;

  for (const item of items) {
    const amt =
      (Number(item.divisionFunding ?? item.gcFunding) || 0) + (Number(item.localFunding) || 0);
    if (amt <= 0) continue;
    total += amt;
    const cat = classifyLineForConcordance(item.activity || '');
    if (cat === 'gear_production') gearProd += amt;
    else if (cat === 'proclamation_followup') procFollowup += amt;
    else if (cat === 'training') training += amt;
  }

  const productionAndGearSharePct = total > 0 ? Math.round((gearProd / total) * 100) : 0;
  const proclamationAndFollowupSharePct = total > 0 ? Math.round((procFollowup / total) * 100) : 0;
  const trainingSharePct = total > 0 ? Math.round((training / total) * 100) : 0;

  if (
    pillarKey === 'proclamation' &&
    total >= 1500 &&
    productionAndGearSharePct >= 75 &&
    proclamationAndFollowupSharePct === 0
  ) {
    return {
      isAligned: false,
      mismatchType: 'p3_tool_heavy_no_proclamation',
      summaryLabel: 'Pillar 3 vs. Tool/Gear Spend Mismatch',
      explanation: `${productionAndGearSharePct}% of budgeted funds go to production/studio equipment with US$0 itemized for public proclamation, ad distribution, bridging, or local church follow-up. Under the SSD Review Framework, projects whose principal purpose and budget build shared media/tools belong in Pillar 2 ("Tool Maker"), whereas Pillar 3 ("Tool User") must fund active proclamation and seeker follow-up.`,
      productionAndGearSharePct,
      proclamationAndFollowupSharePct,
      trainingSharePct,
      totalBudgetUsd: total,
    };
  }

  if (
    pillarKey === 'inspiration' &&
    total >= 1500 &&
    productionAndGearSharePct >= 80 &&
    trainingSharePct === 0
  ) {
    return {
      isAligned: false,
      mismatchType: 'p1_ad_or_gear_heavy_no_training',
      summaryLabel: 'Pillar 1 vs. Gear-Only Spend Mismatch',
      explanation: `${productionAndGearSharePct}% of budgeted funds go to production/hardware with US$0 itemized for training, equipping, or mobilizing workers. Pillar 1 proposals must center budget use on worker/member preparation or reclassify tool production under Pillar 2.`,
      productionAndGearSharePct,
      proclamationAndFollowupSharePct,
      trainingSharePct,
      totalBudgetUsd: total,
    };
  }

  return {
    isAligned: true,
    mismatchType: null,
    summaryLabel: 'Budget Use Aligned with Primary Pillar',
    explanation: 'Budget line items reflect the principal purpose of the selected Strategic Pillar.',
    productionAndGearSharePct,
    proclamationAndFollowupSharePct,
    trainingSharePct,
    totalBudgetUsd: total,
  };
}

/**
 * Evaluates Needs-Based Community Service proposals against the SSD Review Framework ethical rule:
 * "Community assistance must never be conditioned on religious participation or consent to evangelistic contact."
 */
export function analyzeCommunityServiceSafeguard(proposal: Proposal): CommunityServiceSafeguardCheck {
  const combinedNarrative = [
    proposal.title,
    proposal.overview,
    proposal.goal,
    proposal.outcomes,
    proposal.deliverables,
    proposal.pointsOfIntegration,
  ]
    .filter(Boolean)
    .join(' ');

  const matches = Array.from(
    new Set(
      (combinedNarrative.match(new RegExp(COMMUNITY_SERVICE_REGEX.source, 'gi')) || []).map((m) =>
        m.trim().toLowerCase()
      )
    )
  );

  if (matches.length === 0) {
    return {
      isCommunityServiceDetected: false,
      matchedServiceKeywords: [],
      hasUnconditionalAndConsentSafeguard: true,
      status: 'not_applicable',
      guidanceTitle: '',
      guidanceMessage: '',
      suggestedIntegrationSnippet: '',
    };
  }

  const hasSafeguard = SAFEGUARD_UNCONDITIONAL_AND_CONSENT_REGEX.test(combinedNarrative);

  return {
    isCommunityServiceDetected: true,
    matchedServiceKeywords: matches.slice(0, 3),
    hasUnconditionalAndConsentSafeguard: hasSafeguard,
    status: hasSafeguard ? 'documented' : 'missing_safeguard',
    guidanceTitle: 'SSD Review Framework Safeguard: Unconditional Service & Voluntary Consent',
    guidanceMessage: `Your proposal includes needs-based community service (${matches
      .slice(0, 2)
      .join(', ')}). Under the SSD Project Review Framework, community assistance must never be conditioned on religious participation, and spiritual follow-up referrals to local pastors or Hope Care Teams must document voluntary participant consent.`,
    suggestedIntegrationSnippet:
      'Ethical Community Service & Consent Safeguard: Community assistance is provided unconditionally regardless of religious participation; local partners sustain the service, and interested beneficiaries are referred only with voluntary consent to local Hope Care Teams / pastors.',
  };
}

/**
 * Deterministically computes the 3-Tier Readiness Verdict from the flagged (Needs Work) criteria,
 * avoiding redundant manual verdict button clicks unless the Liaison explicitly marks Not Fitting Pathways.
 */
export function computeReadinessFromDeficientKeys(
  deficientKeys: ReviewCriterionKey[],
  forceNotFitting = false
): ReviewReadinessRating {
  if (deficientKeys.length === 0) {
    return 'meeting_requirement';
  }
  if (
    forceNotFitting ||
    deficientKeys.length >= 5 ||
    (deficientKeys.includes('q1_pillar') &&
      deficientKeys.includes('q2_pathway') &&
      deficientKeys.includes('q6_handoff'))
  ) {
    return 'not_fitting_pathways';
  }
  return 'needs_improvement';
}

/**
 * Evaluates a proposal against the 7 Essential Proposal-Review Questions and 3-Tier Readiness Verdicts
 * defined in the Southern Asia-Pacific Division OneVoice27 Project Review Framework, including
 * concrete verbatim evidence excerpts and section-specific fix prescriptions.
 */
export function evaluateProposalReviewFramework(
  proposal: Proposal
): ProposalReviewFrameworkEvaluation {
  const pillarKey = getProposalPillarKey(proposal);
  const pillarTrack: 'pillar_1_2' | 'pillar_3' =
    pillarKey === 'proclamation' ? 'pillar_3' : 'pillar_1_2';
  const subType = classifyProposalSubType(proposal);
  const subTypeMeta = PILLAR_SUBTYPE_LABELS[subType];

  const canonicalObj = getCanonicalDivisionProject(proposal.divisionProject);
  const effectiveObj =
    proposal.divisionProject === 'Other' && proposal.otherDivisionProject
      ? proposal.otherDivisionProject
      : canonicalObj || proposal.divisionProject || 'No Global Objective selected';
  const canonicalKpi = getCanonicalKpiType(proposal.kpiType);
  const kpiOption = KPI_OPTIONS.find((k) => k.id === canonicalKpi);

  const budgetConcordance = analyzePillarBudgetConcordance(proposal);
  const serviceSafeguard = analyzeCommunityServiceSafeguard(proposal);
  const bridgingCtx = detectBridgingProposalContext(proposal);
  const bridgingTerritoryGuidance = getBridgingGuidanceForUnion(proposal.union);

  const overviewText = (proposal.overview || '').trim();
  const goalText = (proposal.goal || '').trim();
  const outcomesText = (proposal.outcomes || '').trim();
  const deliverablesText = (proposal.deliverables || '').trim();
  const integrationText = (proposal.pointsOfIntegration || '').trim();

  // Principal stage resolution per Framework convention
  let principalStageKey: ProposalReviewFrameworkEvaluation['principalStageKey'] = 'enabling';
  let principalStageLabel = 'Enabling Capability';
  if (canonicalKpi) {
    if (
      (subType === 'p1_enabling' || subType === 'p2_tools_intelligence') &&
      canonicalKpi === 'implementation_capability'
    ) {
      principalStageKey = 'enabling';
      principalStageLabel = 'Enabling / Multiply';
    } else {
      principalStageKey = canonicalKpi;
      const stageShortMap: Record<string, string> = {
        reach_exposure: 'REACH',
        engagement_participation: 'ENGAGE',
        connection_next_steps: 'CONNECT',
        retention_nurturing: 'DISCIPLE',
        implementation_capability: 'MULTIPLY',
      };
      principalStageLabel = stageShortMap[canonicalKpi] || kpiOption?.title || 'Pathway Stage';
    }
  }

  const sortChipsByGap = (chips: ReviewPresetFixChip[]): ReviewPresetFixChip[] =>
    [...chips].sort((a, b) => Number(Boolean(b.isRelevantGap)) - Number(Boolean(a.isRelevantGap)));

  // -------------------------------------------------------------------------
  // Q1: Primary Pillar Alignment (Purpose, budget use, principal deliverable)
  // -------------------------------------------------------------------------
  const hasPillarAndObjective = Boolean(pillarKey && (canonicalObj || proposal.divisionProject));
  const hasDeliverable = deliverablesText.length >= 15;
  const q1Adequate = hasPillarAndObjective && hasDeliverable && budgetConcordance.isAligned;

  const q1Note = !hasPillarAndObjective
    ? 'Pick both a Strategic Pillar and Global Objective at the top of the form.'
    : !hasDeliverable
    ? 'Write the main project output in Section 6 (Deliverables).'
    : !budgetConcordance.isAligned
    ? 'Your budget spending does not match the Strategic Pillar you picked.'
    : 'Your Strategic Pillar, Deliverable, and Budget match well.';

  const validBudgetCount = (proposal.budgetItems || []).filter(
    (b) => (Number(b.divisionFunding ?? b.gcFunding) || 0) + (Number(b.localFunding) || 0) > 0
  ).length;

  const q1BudgetBreakdown =
    budgetConcordance.totalBudgetUsd > 0
      ? `US$${budgetConcordance.totalBudgetUsd.toLocaleString()} across ${validBudgetCount} ${
          validBudgetCount === 1 ? 'line' : 'lines'
        } (${budgetConcordance.productionAndGearSharePct}% gear/media · ${
          budgetConcordance.proclamationAndFollowupSharePct
        }% outreach/follow-up · ${budgetConcordance.trainingSharePct}% training)`
      : 'US$0 listed in Section 9 Budget';

  const q1ExtractedEvidence = `${q1BudgetBreakdown}${
    deliverablesText
      ? ` · Sec 6 Deliverable: "${compactSnippet(deliverablesText, 78)}"`
      : ' · Section 6 Deliverables is blank'
  }`;

  const q1RawChips: ReviewPresetFixChip[] =
    pillarTrack === 'pillar_3'
      ? [
          {
            id: 'q1_reclassify_p2',
            label: 'Switch Pillar 3 to Pillar 2 (Making Tools/Media)',
            targetSectionId: 'section-strategic-focus',
            targetSectionLabel: 'Strategy Scope (Top of Form)',
            shortSectionBadge: 'Top · Pillar Scope',
            whyItMatters:
              'Pillar 3 is for reaching people directly. If most money pays for cameras, studio gear, or media tools, it belongs in Pillar 2.',
            pointers: [
              'Open Strategy Scope at the top of this form.',
              'Change Strategic Focus from Pillar 3 (Proclamation) to Pillar 2 (Bold Initiatives / Shared Tools).',
            ],
            exampleTemplate:
              'Strategic Focus: Pillar 2 — Bold Initiatives (Global Objective: [Global Contextualized Media Production / Short-Form Content]).',
            instruction:
              'In Strategy Scope (Top of Form), switch Strategic Focus from Pillar 3 to Pillar 2 because most of your budget pays for media production or equipment rather than direct outreach.',
            isRelevantGap: !hasPillarAndObjective || !budgetConcordance.isAligned,
          },
          {
            id: 'q1_add_followup_budget',
            label: 'Add outreach & follow-up costs in Sec 9',
            targetSectionId: 'section-budget',
            targetSectionLabel: 'Section 9 · Budget Plan',
            shortSectionBadge: 'Sec 9 · Budget',
            whyItMatters:
              'To stay in Pillar 3, your budget needs clear lines paying for public outreach, bridging events, or local church follow-up.',
            pointers: [
              'Go to Section 9 (Budget Plan) and add 1–2 outreach or follow-up cost lines.',
              'List practical costs like ad boosting, bridging hospitality, or Bible worker support.',
            ],
            exampleTemplate:
              'Line item: [Local Church Bridging Event & Hope Care Follow-Up] — US$[amount].',
            instruction:
              'In Section 9 (Budget Plan), add clear budget lines for public outreach, bridging events, or Bible-study follow-up so your spending matches Pillar 3.',
            isRelevantGap: !budgetConcordance.isAligned,
          },
          {
            id: 'q1_clarify_deliverable',
            label: 'Write main deliverable in Sec 6',
            targetSectionId: 'section-deliverables',
            targetSectionLabel: 'Section 6 · Deliverables',
            shortSectionBadge: 'Sec 6 · Deliverables',
            whyItMatters:
              'Reviewers need to see the exact item, event, or service this budget will produce by the end of the project.',
            pointers: [
              'List the concrete items or events your team will deliver.',
              'Include how many (for example: 12 videos, 4 workshops, or 300 study guides).',
            ],
            exampleTemplate:
              'We will deliver [number] [outreach events / Bible study kits / digital campaigns] reaching [city or area] by [month/year].',
            instruction:
              'In Section 6 (Project Deliverables), clearly list the main outreach event, series, or study materials this grant will deliver.',
            isRelevantGap: !hasDeliverable,
          },
        ]
      : [
          {
            id: 'q1_align_p1_training',
            label: 'Show training costs in Sec 9 Budget',
            targetSectionId: 'section-budget',
            targetSectionLabel: 'Section 9 · Budget Plan',
            shortSectionBadge: 'Sec 9 · Budget',
            whyItMatters:
              'Pillar 1 funds training and preparing people. Budget items should pay for workshops, trainers, or training kits—not only studio hardware.',
            pointers: [
              'Go to Section 9 (Budget Plan) and check your largest cost lines.',
              'Add lines for trainer travel, workshop venue, or participant training guides (or switch to Pillar 2 if buying gear).',
            ],
            exampleTemplate:
              'Line item: [Creator & Digital Missionary Training Workshop Venue & Materials] — US$[amount].',
            instruction:
              'In Section 9 (Budget Plan), make sure budget lines fund worker training and equipping (or move tool/equipment production to Pillar 2 in Strategy Scope).',
            isRelevantGap: !budgetConcordance.isAligned,
          },
          {
            id: 'q1_clarify_p2_tool',
            label: 'Write main tool or service output in Sec 6',
            targetSectionId: 'section-deliverables',
            targetSectionLabel: 'Section 6 · Deliverables',
            shortSectionBadge: 'Sec 6 · Deliverables',
            whyItMatters:
              'Reviewers check that your grant produces a clear, usable tool, research report, training, or community service.',
            pointers: [
              'Name the exact output (training sessions, research report, video series, or health clinic).',
              'Add simple numbers showing the size of the deliverable.',
            ],
            exampleTemplate:
              'We will deliver [number] [training workshops / media videos / health clinic days] for [target group] in [location].',
            instruction:
              'In Section 6 (Project Deliverables), clearly state the main training, research report, shared media tool, or community service output funded by this budget.',
            isRelevantGap: !hasDeliverable,
          },
          ...(!hasPillarAndObjective
            ? [
                {
                  id: 'q1_pick_pillar_objective',
                  label: 'Pick Pillar & Global Objective at Top',
                  targetSectionId: 'section-strategic-focus',
                  targetSectionLabel: 'Strategy Scope (Top of Form)',
                  shortSectionBadge: 'Top · Pillar Scope',
                  whyItMatters:
                    'Every proposal must connect to one OneVoice27 Strategic Pillar and Global Objective before review.',
                  pointers: [
                    'Scroll to the Strategy Scope bar at the top.',
                    'Select your Strategic Focus and matching Global Objective.',
                  ],
                  exampleTemplate:
                    'Strategic Focus: [Pillar 1 / 2 / 3] · Global Objective: [Matching OneVoice27 Objective].',
                  instruction:
                    'In Strategy Scope (Top of Form), select both your Strategic Focus (Pillar) and Global Objective.',
                  isRelevantGap: true,
                },
              ]
            : []),
        ];

  const q1PresetChips = sortChipsByGap(q1RawChips);
  const q1DefaultChip = q1PresetChips[0];

  // -------------------------------------------------------------------------
  // Q2: Pathway Contribution
  // -------------------------------------------------------------------------
  const kpiAligned = isKpiAlignedWithObjective(
    canonicalObj || proposal.divisionProject,
    proposal.kpiType
  );
  const isP2ServiceStageValid =
    subType !== 'p2_community_service' ||
    canonicalKpi === 'reach_exposure' ||
    canonicalKpi === 'engagement_participation' ||
    canonicalKpi === 'connection_next_steps';

  const deployingTeamRegex =
    /\b(church\w*|pastor\w*|district\w*|field\w*|mission\w*|conference\w*|hope\s+care|digital\s+missionar\w*|ndr-iel|ministerial|sspm|bible\s+worker\w*|evangelis\w*|youth|team\w*)\b/i;

  const hasNamedDeployingTeamForEnabling =
    pillarTrack === 'pillar_3' ||
    subType === 'p2_community_service' ||
    deployingTeamRegex.test(`${deliverablesText} ${integrationText} ${outcomesText}`);

  const q2Adequate = Boolean(
    canonicalKpi && kpiAligned && isP2ServiceStageValid && hasNamedDeployingTeamForEnabling
  );
  const q2Note = !canonicalKpi
    ? 'Pick 1 Primary KPI stage in Section 5.'
    : !kpiAligned
    ? 'Your Primary KPI does not match the Global Objective selected at the top.'
    : !isP2ServiceStageValid
    ? 'Community service projects should pick REACH, ENGAGE, or CONNECT (not Baptisms/Discipleship).'
    : !hasNamedDeployingTeamForEnabling
    ? 'Name which local church, Mission, or ministry team will use these tools or trained people.'
    : `Clearly focused on ${principalStageLabel} stage.`;

  const q2ExtractedEvidence = `Objective: "${compactSnippet(effectiveObj, 52)}" → Sec 5 KPI: ${
    kpiOption ? `${principalStageLabel} (${kpiOption.title})` : 'None selected'
  }`;

  const q2RawChips: ReviewPresetFixChip[] = [
    {
      id: 'q2_align_kpi',
      label: 'Pick matching KPI stage in Sec 5',
      targetSectionId: 'section-5-kpi',
      targetSectionLabel: 'Section 5 · Primary KPI',
      shortSectionBadge: 'Sec 5 · KPI',
      whyItMatters:
        'Each Global Objective fits specific Mission Pathway steps. Selecting a matching KPI keeps Division tracking accurate.',
      pointers: [
        'Open Section 5 (Primary KPI).',
        `Choose one recommended KPI badge for "${compactSnippet(effectiveObj, 45)}".`,
      ],
      exampleTemplate:
        'Primary KPI: [Choose 1 stage badge in Sec 5 that matches your Global Objective].',
      instruction: `In Section 5 (Primary KPI), select one KPI stage that matches "${effectiveObj}" so your project measures one clear step on the Mission Pathway.`,
      isRelevantGap: !canonicalKpi || !kpiAligned,
    },
    ...(subType === 'p2_community_service'
      ? [
          {
            id: 'q2_service_stage',
            label: 'Set service KPI to REACH, ENGAGE, or CONNECT',
            targetSectionId: 'section-5-kpi',
            targetSectionLabel: 'Section 5 · Primary KPI',
            shortSectionBadge: 'Sec 5 · KPI',
            whyItMatters:
              'Community service (health, water, relief) builds trust and opens doors—so its KPI should measure Reach, Engage, or Connect rather than baptisms.',
            pointers: [
              'Open Section 5 (Primary KPI).',
              'Pick 1. Reach, 2. Engage, or 3. Connect as your single KPI.',
            ],
            exampleTemplate:
              'Primary KPI: [2. Engagement & Participation or 3. Connection & Next Steps] — measuring community service participants who opt in for follow-up.',
            instruction:
              'In Section 5 (Primary KPI), select REACH, ENGAGE, or CONNECT for this community service project (baptism and discipleship belong to Pillar 3).',
            isRelevantGap: !isP2ServiceStageValid,
          },
        ]
      : []),
    ...(pillarTrack === 'pillar_1_2'
      ? [
          {
            id: 'q2_name_deploying_team',
            label: 'Name team that will use this output in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters:
              'Training or media tools only help the mission when a real field or church team agrees to use them.',
            pointers: [
              'Go to Section 8 (Points of Integration).',
              'Write the exact Mission/Conference department or local church team that will apply what you build or train.',
            ],
            exampleTemplate:
              '[Mission/Conference Communication Dept / Local Church Youth Team] will deploy these [trained creators / video tools] across [number] churches starting [month].',
            instruction:
              'In Section 8 (Points of Integration), name the specific Mission/Conference department or local church team that will use these trained workers or tools.',
            isRelevantGap: !hasNamedDeployingTeamForEnabling,
          },
        ]
      : [
          {
            id: 'q2_single_stage_focus',
            label: 'Focus KPI Rationale on 1 step in Sec 5',
            targetSectionId: 'section-5-kpi',
            targetSectionLabel: 'Section 5 · Primary KPI',
            shortSectionBadge: 'Sec 5 · KPI',
            whyItMatters:
              'Trying to measure every step (views + events + baptisms) makes results unclear. Pick one main step.',
            pointers: [
              'Open Section 5 (KPI Rationale).',
              `Explain in 1–2 sentences how your project focuses on ${principalStageLabel}.`,
            ],
            exampleTemplate: `This project focuses primarily on [${principalStageLabel}] by helping [target group] move from [starting point] to [specific next step].`,
            instruction:
              'In Section 5 (KPI Rationale), explain the single main Mission Pathway step this project focuses on instead of trying to cover every step at once.',
            isRelevantGap: false,
          },
        ]),
  ];

  const q2PresetChips = sortChipsByGap(q2RawChips);
  const q2DefaultChip = q2PresetChips[0];

  // -------------------------------------------------------------------------
  // Q3: Input (Baseline evidence, target group, community need, or inquiry source)
  // -------------------------------------------------------------------------
  const hasAudiences = Array.isArray(proposal.targetAudiences) && proposal.targetAudiences.length > 0;
  const hasGroupE = (proposal.targetAudiences || []).some(
    (a) => a === 'E' || a === 'group_e'
  );
  const groupEDocumented = !hasGroupE || (proposal.audienceEDetails || '').trim().length >= 12;
  const hasBaselineOrContextEvidence =
    overviewText.length >= 40 ||
    (proposal.kpiRationale || '').trim().length >= 25 ||
    (proposal.priorProjectMetric || '').trim().length >= 10;

  const q3Adequate = Boolean(hasAudiences && groupEDocumented && hasBaselineOrContextEvidence);
  const q3Note = !hasAudiences
    ? 'Select 1–3 Target Audience groups (A–E) in Section 7.'
    : !groupEDocumented
    ? 'Describe the specific people group, language, and need in Section 7 (Group E Details).'
    : !hasBaselineOrContextEvidence
    ? 'Add starting numbers or local community evidence in Section 2 (Overview).'
    : 'Target audience and starting context are clear.';

  const audienceShortLabels = (proposal.targetAudiences || []).map((rawId) => {
    const norm = rawId.replace(/^group_/i, '').toUpperCase();
    const opt = TARGET_AUDIENCE_OPTIONS.find((o) => o.id.toUpperCase() === norm);
    return opt ? opt.id : norm;
  });

  const q3ContextSnippet = compactSnippet(
    (hasGroupE && proposal.audienceEDetails ? `Group E: ${proposal.audienceEDetails}. ` : '') +
      (proposal.priorProjectMetric ? `Prior numbers: ${proposal.priorProjectMetric}. ` : '') +
      (overviewText || proposal.kpiRationale || ''),
    95
  );

  const q3ExtractedEvidence = `Sec 7 Audiences: ${
    audienceShortLabels.length > 0 ? `Group ${audienceShortLabels.join(', ')}` : 'None selected'
  }${q3ContextSnippet ? ` · "${q3ContextSnippet}"` : ' · No starting numbers written in Section 2'}`;

  const q3RawChips: ReviewPresetFixChip[] = [
    {
      id: 'q3_add_baseline',
      label: 'Add starting numbers / local need in Sec 2',
      targetSectionId: 'section-overview',
      targetSectionLabel: 'Section 2 · Project Overview',
      shortSectionBadge: 'Sec 2 · Overview',
      whyItMatters:
        'Reviewers want to see real local facts (for example, current inquiries, community population, or last year’s results) that show why this project is needed now.',
      pointers: [
        'Write 1–2 simple sentences in Section 2 (Overview) showing the starting situation.',
        'Include real numbers like city population, current online messages per month, or last year’s attendance.',
      ],
      exampleTemplate:
        'Currently, our [territory/city] receives [number] inquiries per month from [target group], and [number] local churches are ready to follow up.',
      instruction:
        'In Section 2 (Project Overview), add real starting numbers (such as local population need, current monthly inquiries, or last year’s results) that show why this project is needed.',
      isRelevantGap: !hasBaselineOrContextEvidence,
    },
    ...(hasGroupE
      ? [
          {
            id: 'q3_detail_group_e',
            label: 'Name Group E people group & language in Sec 7',
            targetSectionId: 'section-audience',
            targetSectionLabel: 'Section 7 · Target Audience',
            shortSectionBadge: 'Sec 7 · Audience',
            whyItMatters:
              'When Group E is checked, reviewers need to know the exact unreached or world-religion group, their language, and their everyday felt need.',
            pointers: [
              'Scroll to Section 7 (Category E Details box).',
              'Name the specific religion/worldview, language spoken, and practical need (e.g., family stress, health, or jobs).',
            ],
            exampleTemplate:
              'People Group: [Name / e.g., Urban Secular Young Adults or Local Malay Community] · Religion/Worldview: [e.g., Secular / Islam / Buddhism] · Language: [Language] · Need: [e.g., mental wellness & family support].',
            instruction:
              'In Section 7 (Group E Details), name the specific unreached or world-religion group, the language they speak, and their everyday need.',
            isRelevantGap: !groupEDocumented,
          },
        ]
      : []),
    {
      id: 'q3_clarify_seeker_source',
      label:
        pillarTrack === 'pillar_3'
          ? 'Explain where new contacts come from in Sec 2'
          : 'Pick & explain Target Audience in Sec 7',
      targetSectionId: pillarTrack === 'pillar_3' ? 'section-overview' : 'section-audience',
      targetSectionLabel:
        pillarTrack === 'pillar_3'
          ? 'Section 2 · Project Overview'
          : 'Section 7 · Target Audience',
      shortSectionBadge: pillarTrack === 'pillar_3' ? 'Sec 2 · Overview' : 'Sec 7 · Audience',
      whyItMatters:
        pillarTrack === 'pillar_3'
          ? 'Reviewers need to know where interested people will come from before your event or follow-up starts.'
          : 'Picking the right audience groups (A–E) ensures your activities match the people you want to reach.',
      pointers:
        pillarTrack === 'pillar_3'
          ? [
              'Go to Section 2 (Project Overview).',
              'State the exact source of contacts (e.g., HopeStartsHere.asia Event RSVP / ads, TikTok messages, or clinic guests).',
            ]
          : [
              'Go to Section 7 (Target Audience).',
              'Select 1–3 audience groups (A–E) that match your proposal story.',
            ],
      exampleTemplate:
        pillarTrack === 'pillar_3'
          ? 'New contacts will enter this project from [HopeStartsHere.asia Community Event RSVP / Facebook & TikTok ads / community health checkups] in [city/region].'
          : 'Primary Audience: [Select 1–3 matching groups in Section 7, e.g. Group C/D/E for community outreach or Group A for member training].',
      instruction:
        pillarTrack === 'pillar_3'
          ? 'In Section 2 (Project Overview), explain clearly where interested seeker contacts will come from (such as HopeStartsHere.asia event RSVPs, social media replies, or community events).'
          : 'In Section 7 (Target Audience), select the 1–3 primary audience groups (A–E) that this project directly serves.',
      isRelevantGap: !hasAudiences || (pillarTrack === 'pillar_3' && !hasBaselineOrContextEvidence),
    },
    ...(bridgingCtx.isBridgingHostProposal || bridgingCtx.usesOnlineLeadHandoff
      ? [
          {
            id: 'q3_bridging_privacy_sensitivity',
            label: 'Add guest privacy & consent check in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters: `Online guests must freely agree ("opt in") before local churches contact them, following ${bridgingTerritoryGuidance.privacyLawsSummary}.`,
            pointers: [
              'Open Section 8 (Points of Integration).',
              `Confirm guests check an opt-in box before sharing contact details${
                bridgingTerritoryGuidance.isRestrictedOrSensitive
                  ? ', and state that names, photos, and locations are never posted publicly'
                  : ''
              }.`,
            ],
            exampleTemplate: `All online signups give explicit opt-in consent under ${bridgingTerritoryGuidance.privacyLawsSummary}; details go only to [Local Bridge Coordinator Name]${
              bridgingTerritoryGuidance.isRestrictedOrSensitive
                ? ', and guest names, photos, or locations are never published publicly'
                : ''
            }.`,
            instruction: `In Section 8 (Points of Integration), confirm that online signups give clear opt-in consent under ${bridgingTerritoryGuidance.privacyLawsSummary}${
              bridgingTerritoryGuidance.isRestrictedOrSensitive
                ? ' and that guest names, photos, or locations are never published publicly'
                : ''
            }.`,
            isRelevantGap: false,
          },
        ]
      : []),
  ];

  const q3PresetChips = sortChipsByGap(q3RawChips);
  const q3DefaultChip = q3PresetChips[0];

  // -------------------------------------------------------------------------
  // Q4: Activity (Core intervention + unconditional service safeguard for P2B)
  // -------------------------------------------------------------------------
  const hasSubstantiveGoal = goalText.length >= 25;
  const hasSubstantiveDeliverableQ4 = deliverablesText.length >= 25;
  const hasSubstantiveActivity = hasSubstantiveGoal && hasSubstantiveDeliverableQ4;
  const serviceSafeguardOk = serviceSafeguard.status !== 'missing_safeguard';
  const q4Adequate = Boolean(hasSubstantiveActivity && serviceSafeguardOk);
  const q4Note = !hasSubstantiveGoal
    ? 'Explain what your team will do step by step in Section 3 (Project Goal).'
    : !hasSubstantiveDeliverableQ4
    ? 'List concrete deliverables and quantities in Section 6 (Deliverables).'
    : !serviceSafeguardOk
    ? 'Confirm community help is free with no religious condition in Section 8.'
    : 'Main activities and safeguards are clearly written.';

  const q4ExtractedEvidence = `${
    goalText ? `Sec 3 Goal: "${compactSnippet(goalText, 78)}"` : 'Section 3 Goal is blank'
  }${
    serviceSafeguard.isCommunityServiceDetected
      ? ` · Service (${serviceSafeguard.matchedServiceKeywords.join(', ')}): ${
          serviceSafeguard.hasUnconditionalAndConsentSafeguard
            ? 'Free & consent rule included'
            : 'Missing free-service / consent rule'
        }`
      : ''
  }`;

  const q4RawChips: ReviewPresetFixChip[] = [
    ...(serviceSafeguard.isCommunityServiceDetected
      ? [
          {
            id: 'q4_unconditional_service',
            label: 'Add free-help & consent rule in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters:
              'SSD policy requires that medical, food, water, or educational help is given freely to everyone—never forcing anyone to attend religious talks.',
            pointers: [
              'Open Section 8 (Points of Integration).',
              'State clearly that help is free for all people, and spiritual follow-up happens only if the person asks or agrees.',
            ],
            exampleTemplate:
              'Community help is given freely to everyone regardless of religion; spiritual follow-up with a local Hope Care Team happens only when the guest gives voluntary consent.',
            instruction:
              'In Section 8 (Points of Integration), state clearly that community help is given freely with no religious condition, and spiritual follow-up happens only with voluntary consent.',
            isRelevantGap: !serviceSafeguardOk,
          },
        ]
      : []),
    {
      id: 'q4_detail_goal_steps',
      label: 'Write clear action steps in Sec 3 Goal',
      targetSectionId: 'section-goal',
      targetSectionLabel: 'Section 3 · Project Goal',
      shortSectionBadge: 'Sec 3 · Goal',
      whyItMatters:
        'Reviewers look for practical action steps (who does what, how often, and where) rather than broad wishes.',
      pointers: [
        'Open Section 3 (Project Goal).',
        'Describe the exact activities your team will run and how often they happen.',
      ],
      exampleTemplate:
        'Our team will run [number] [workshops / short-form videos / community clinics] each [week/month] in [target area], moving people to [next step].',
      instruction:
        'In Section 3 (Project Goal), write the specific step-by-step activities your team will carry out, including how often and where they happen.',
      isRelevantGap: !hasSubstantiveGoal,
    },
    {
      id: 'q4_detail_deliverables_qty',
      label: 'List exact items & quantities in Sec 6',
      targetSectionId: 'section-deliverables',
      targetSectionLabel: 'Section 6 · Deliverables',
      shortSectionBadge: 'Sec 6 · Deliverables',
      whyItMatters:
        'Specific quantities (e.g., "10 training workshops" or "24 videos") make it easy for treasurers and reviewers to see what the budget pays for.',
      pointers: [
        'Open Section 6 (Project Deliverables).',
        'List each concrete output with a clear number.',
      ],
      exampleTemplate:
        '1) [Number] [videos / workshops / events]; 2) [Number] [guides / kits / training hours]; 3) [Number] [follow-up sessions].',
      instruction:
        'In Section 6 (Project Deliverables), list exact deliverable items and quantities (such as number of sessions, videos, kits, or trained volunteers).',
      isRelevantGap: !hasSubstantiveDeliverableQ4,
    },
  ];

  const q4PresetChips = sortChipsByGap(q4RawChips);
  const q4DefaultChip = q4PresetChips[0];

  // -------------------------------------------------------------------------
  // Q5: Output (Verifiable, person-centered or deployed result; anti-vanity check)
  // -------------------------------------------------------------------------
  const hasNumericTarget = /\d/.test(proposal.kpiNumber || '');
  const isDeeperStage =
    canonicalKpi === 'engagement_participation' ||
    canonicalKpi === 'connection_next_steps' ||
    canonicalKpi === 'retention_nurturing';

  const kpiTargetAndDetailLower = `${proposal.kpiNumber || ''} ${
    proposal.kpiDescription || ''
  }`.toLowerCase();
  const mentionsOnlyPassiveViews =
    isDeeperStage &&
    /\b(views|impressions|reach|downloads|footprints|attendance|attendees|listeners)\b/i.test(
      kpiTargetAndDetailLower
    ) &&
    !/\b(inquir\w*|contact\w*|stud\w*|seeker\w*|guest\w*|visitor\w*|baptis\w*|member\w*|group\w*|referral\w*|decision\w*|respon\w*|enroll\w*|complet\w*|hand-?off|person\w*|people\s+connected)\b/i.test(
      `${kpiTargetAndDetailLower} ${outcomesText.toLowerCase()}`
    );

  const hasPassiveOnlyStageMetric = Boolean(mentionsOnlyPassiveViews);
  const passiveMetricGuidance = hasPassiveOnlyStageMetric
    ? `SSD Review Framework (Q5): Views or event headcount alone do not show real connection. Because your KPI is ${principalStageLabel}, count real people taking action (for example: two-way chats, opt-in referrals, or active Bible study participants).`
    : null;

  const hasSubstantiveOutcomes = outcomesText.length >= 25;
  const q5Adequate = Boolean(
    hasNumericTarget && hasSubstantiveOutcomes && !hasPassiveOnlyStageMetric
  );
  const q5Note = !hasNumericTarget
    ? 'Enter one clear total target number in Section 5 (Target Goal).'
    : hasPassiveOnlyStageMetric
    ? 'Count real people responding or joining (not only views or event attendance).'
    : !hasSubstantiveOutcomes
    ? 'Describe the real change in people’s lives in Section 4 (Outcomes).'
    : 'Clear target number and real people-centered outcomes.';

  const q5ExtractedEvidence = `Sec 5 Target: "${
    (proposal.kpiNumber || '').trim() || 'None entered'
  }"${
    proposal.kpiDescription
      ? ` (${compactSnippet(proposal.kpiDescription, 58)})`
      : ''
  }${
    outcomesText ? ` · Sec 4 Outcome: "${compactSnippet(outcomesText, 64)}"` : ' · Section 4 Outcomes is blank'
  }`;

  const q5RawChips: ReviewPresetFixChip[] = [
    {
      id: 'q5_person_centered',
      label: 'Count people responding (not just views) in Sec 5',
      targetSectionId: 'section-5-kpi',
      targetSectionLabel: 'Section 5 · Primary KPI & Target',
      shortSectionBadge: 'Sec 5 · Target',
      whyItMatters:
        'Views and crowd size are easy to inflate. SSD looks for real people who message back, join a group, or take a next step.',
      pointers: [
        'Open Section 5 (Target Goal & Metric Details).',
        'Replace "views/impressions" with a count of real people (e.g., two-way chats, opt-in requests, or Bible study participants).',
      ],
      exampleTemplate:
        'Target Goal: [Number, e.g. 250] · Metric Details: [250] people who reply with an opt-in request and connect with a [Hope Care Team / small group].',
      instruction: `In Section 5 (Target Goal & Metric Details), replace passive views or attendance numbers with a count of real people taking action in ${principalStageLabel} (such as two-way inquiries, opt-in referrals, or Bible study members).`,
      isRelevantGap: !hasNumericTarget || hasPassiveOnlyStageMetric,
    },
    {
      id: 'q5_verify_measurement',
      label: 'Explain how you count the target in Sec 5',
      targetSectionId: 'section-5-kpi',
      targetSectionLabel: 'Section 5 · Primary KPI & Target',
      shortSectionBadge: 'Sec 5 · Target',
      whyItMatters:
        'Reviewers need to trust that your final report number can be counted accurately.',
      pointers: [
        'Open Section 5 (Target Goal & Metric Details).',
        'State the exact single total number and what tool or sign-in sheet records each person.',
      ],
      exampleTemplate:
        pillarKey === 'inspiration'
          ? 'Target Goal: [Single total number] · How counted: Tracked via [Conference/Church workshop registration list & signed training attendance log].'
          : bridgingCtx.isBridgingHostProposal
          ? 'Target Goal: [Single total number] · How counted: Tracked via [HopeStartsHere.asia Event RSVP check-in list & 48h Bridge Coordinator follow-up log].'
          : 'Target Goal: [Single total number] · How counted: Tracked via [HopeStartsHere.asia CRM / WhatsApp opt-in sheet / signed workshop attendance log].',
      instruction:
        'In Section 5 (Target Goal & Metric Details), enter one total target number and explain briefly how each counted person or item will be recorded.',
      isRelevantGap: !hasNumericTarget,
    },
    {
      id: 'q5_strengthen_outcomes',
      label: 'Describe people-level results in Sec 4 Outcomes',
      targetSectionId: 'section-outcomes',
      targetSectionLabel: 'Section 4 · Outcomes',
      shortSectionBadge: 'Sec 4 · Outcomes',
      whyItMatters:
        'Goal (Sec 3) is what your team does; Outcomes (Sec 4) is the change in the people you serve by the end of the project.',
      pointers: [
        'Open Section 4 (Outcomes).',
        'Write 2 sentences showing how participants grow, connect, or take a spiritual next step.',
      ],
      exampleTemplate:
        'By project end, [number] [target audience] will [receive practical help / join a 1:1 conversation / enter a local small group], moving toward [Bible study or baptism].',
      instruction:
        'In Section 4 (Outcomes), describe the real change or next step participants reach by the time this project finishes.',
      isRelevantGap: !hasSubstantiveOutcomes,
    },
    ...(bridgingCtx.isBridgingHostProposal
      ? [
          {
            id: 'q5_bridging_funnel',
            label: 'Track 48h Bridge Friend & 30-day return in Sec 4',
            targetSectionId: 'section-outcomes',
            targetSectionLabel: 'Section 4 · Outcomes',
            shortSectionBadge: 'Sec 4 · Outcomes',
            whyItMatters:
              'A small event where every guest makes a friend is better than a huge crowd with zero follow-up.',
            pointers: [
              'Open Section 4 (Outcomes).',
              'Include tracking % of guests paired with a Bridge Friend in 48 hours and % joining a 2nd activity within 30 days.',
            ],
            exampleTemplate:
              'We will track: [80%] of online guests paired 1:1 with a Bridge Friend within 48 hours, and [40%] attending a 2nd small-group or Sabbath activity within 30 days.',
            instruction:
              'In Section 4 (Outcomes), track two key Bridging results beyond attendance: % of guests paired with a Bridge Friend within 48 hours and % attending a 2nd small-group activity within 30 days.',
            isRelevantGap: bridgingCtx.mentionsVanityHeadcountOnly,
          },
        ]
      : []),
  ];

  const q5PresetChips = sortChipsByGap(q5RawChips);
  const q5DefaultChip = q5PresetChips[0];

  // -------------------------------------------------------------------------
  // Q6: Handoff (Who accepts the intelligence, tool, or consented person/referral)
  // -------------------------------------------------------------------------
  const handoffReceiverRegex =
    pillarTrack === 'pillar_1_2'
      ? /\b(hope\s+care\s+team\w*|ndr-iel|ndr\b|ministerial|local\s+church\w*|pastor\w*|interest\s+coordinator\w*|digital\s+missionar\w*|hopestartshere|content\s+repository|shared\s+repository|field\s+team\w*|union|mission|conference|sspm|bible\s+worker\w*|care\s+group\w*|small\s+group\w*|receiving\s+team\w*|hand-?off|referral\w*)\b/i
      : /\b(hope\s+care\s+team\w*|ndr-iel|ndr\b|ministerial|local\s+church\w*|pastor\w*|elder\w*|interest\s+coordinator\w*|sabbath\s+school|sspm|small\s+group\w*|care\s+group\w*|bible\s+worker\w*|seeker-ready|seeker\s+ready|hand-?off|referral\w*)\b/i;

  const hasNamedReceiver = handoffReceiverRegex.test(`${integrationText} ${outcomesText}`);
  const consentOkForHandoff = serviceSafeguard.status !== 'missing_safeguard';
  const q6Adequate = Boolean(
    integrationText.length >= 20 && hasNamedReceiver && consentOkForHandoff
  );
  const q6Note =
    integrationText.length < 20 || !hasNamedReceiver
      ? pillarTrack === 'pillar_1_2'
        ? 'Name which Mission department or local church team receives this output in Section 8.'
        : 'Name which local church, Pastor, Hope Care Team, or NDR-IEL coordinator receives seekers in Section 8.'
      : !consentOkForHandoff
      ? 'Confirm guests give voluntary consent before sending their details to a pastor.'
      : 'Receiving church or ministry team is clearly named in Section 8.';

  const q6ExtractedEvidence = integrationText
    ? `Sec 8 Integration: "${compactSnippet(integrationText, 105)}"`
    : 'Section 8 (Points of Integration) is currently blank';

  const q6RawChips: ReviewPresetFixChip[] = [
    {
      id: 'q6_name_receiver',
      label:
        pillarTrack === 'pillar_1_2'
          ? 'Name receiving Mission / church team in Sec 8'
          : 'Name Pastor / Hope Care Team / NDR-IEL in Sec 8',
      targetSectionId: 'section-integration',
      targetSectionLabel: 'Section 8 · Points of Integration',
      shortSectionBadge: 'Sec 8 · Integration',
      whyItMatters:
        'The OneVoice27 Golden Rule says: never start an outreach unless someone is ready to welcome and care for the person next.',
      pointers: [
        'Open Section 8 (Points of Integration).',
        pillarTrack === 'pillar_1_2'
          ? 'Name the exact Mission department, Communication team, or local churches that will use your outputs.'
          : 'Name the exact local churches, district pastors, Hope Care Team, or NDR-IEL coordinator receiving referrals.',
      ],
      exampleTemplate:
        pillarTrack === 'pillar_1_2'
          ? 'Completed [tools / trained creators] will be handed over to [Mission/Conference Dept & Name of Local Churches] for immediate ministry use.'
          : 'Opt-in seeker contacts are passed to [Name of Local Church / District Pastor / Hope Care Team / NDR-IEL Coordinator] for personal welcome and care.',
      instruction:
        pillarTrack === 'pillar_1_2'
          ? 'In Section 8 (Points of Integration), name the specific Mission/Conference department or local churches that will receive and use this project’s tools or trained workers.'
          : 'In Section 8 (Points of Integration), name the specific local churches, district pastors, Hope Care Team, or NDR-IEL coordinators who will welcome new seeker contacts.',
      isRelevantGap: integrationText.length < 20 || !hasNamedReceiver,
    },
    {
      id: 'q6_handoff_step',
      label:
        pillarKey === 'inspiration'
          ? 'Explain how trained members deploy after training in Sec 8'
          : bridgingCtx.isBridgingHostProposal
          ? 'List Event/RSVP on HopeStartsHere.asia & 48h handoff in Sec 8'
          : 'Explain how & when handoff happens in Sec 8',
      targetSectionId: 'section-integration',
      targetSectionLabel: 'Section 8 · Points of Integration',
      shortSectionBadge: 'Sec 8 · Integration',
      whyItMatters:
        pillarKey === 'inspiration'
          ? 'Pillar 1 training events are internal to church members (not promoted on HopeStartsHere.asia); impact comes when trainees deploy to Pillar 2 media or Pillar 3 host teams.'
          : bridgingCtx.isBridgingHostProposal
          ? 'Listing community events with opt-in RSVP on HopeStartsHere.asia helps seekers register safely and ensures Local Bridge Coordinators follow up within 48 hours.'
          : 'Fast, clear handoffs prevent interested people from being forgotten after an ad or event.',
      pointers: [
        'Open Section 8 (Points of Integration).',
        pillarKey === 'inspiration'
          ? 'State how members register internally through Conferences/churches and deploy into local media or host teams.'
          : bridgingCtx.isBridgingHostProposal
          ? 'Confirm community event details & opt-in RSVP are listed on HopeStartsHere.asia (Play 7 safe) and routed to your Local Bridge Coordinator within 48 hours.'
          : 'Write how contacts move (e.g., HopeStartsHere -> WhatsApp/LINE -> Local Coordinator) within 48 hours.',
      ],
      exampleTemplate:
        pillarKey === 'inspiration'
          ? 'Deployment steps: Members register internally via [Conference / Local Church], and within [2 weeks] of training join [Union Media / Local Hope Care Team] host rosters.'
          : bridgingCtx.isBridgingHostProposal
          ? 'Event & RSVP steps: Our community event and opt-in RSVP are listed on [HopeStartsHere.asia] (respecting Play 7 privacy); within [48 hours] of signup, our [Local Bridge Coordinator] confirms attendance and pairs each guest with a Bridge Friend.'
          : 'Handoff steps: Within [48 hours], our [Digital Missionary / Interest Coordinator] sends consented leads via [HopeStartsHere / WhatsApp] to the local [Hope Care Team], who confirm contact.',
      instruction:
        pillarKey === 'inspiration'
          ? 'In Section 8 (Points of Integration), state how church members register internally and how trained creators or local church hosts are deployed to outreach teams.'
          : bridgingCtx.isBridgingHostProposal
          ? 'In Section 8 (Points of Integration), explain how your community event & opt-in RSVP are listed on HopeStartsHere.asia (respecting Play 7 sensitivity) and handed off within 48 hours.'
          : 'In Section 8 (Points of Integration), explain step by step how contacts are passed (for example via HopeStartsHere or an interest coordinator within 48 hours) and how receipt is confirmed.',
      isRelevantGap: integrationText.length < 20 || !hasNamedReceiver,
    },
    ...(serviceSafeguard.isCommunityServiceDetected
      ? [
          {
            id: 'q6_voluntary_consent',
            label: 'Require guest consent before referral in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters:
              'Community service guests must never feel pressured; spiritual follow-up only happens when they freely ask for it.',
            pointers: [
              'Open Section 8 (Points of Integration).',
              'Add one sentence confirming referrals require voluntary guest consent.',
            ],
            exampleTemplate:
              'Community guests are referred to local pastors or Hope Care Teams only when they check an opt-in box or give voluntary verbal consent.',
            instruction:
              'In Section 8 (Points of Integration), state that community service guests are referred to pastors or Bible workers only if they give voluntary consent.',
            isRelevantGap: !consentOkForHandoff,
          },
        ]
      : []),
    ...(bridgingCtx.isBridgingHostProposal
      ? [
          {
            id: 'q6_bridging_coordinator_48h',
            label: 'Assign Bridge Coordinator, RSVP & 48h contact in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters:
              'Online guests feel nervous walking into a church alone. Listing opt-in RSVP on HopeStartsHere.asia plus a 48-hour call and 1:1 Bridge Friend makes them feel safe and welcomed.',
            pointers: [
              'Open Section 8 (Points of Integration).',
              'List the community event & opt-in RSVP on HopeStartsHere.asia (keeping sensitive guest info private under Play 7) and name a Local Bridge Coordinator per church to pair guests 1:1 with a Bridge Friend within 48 hours.',
            ],
            exampleTemplate:
              'Community event & opt-in RSVP are listed on HopeStartsHere.asia (respecting Play 7 privacy); each church assigns a Local Bridge Coordinator who calls signups within 48 hours, pairs each guest 1:1 with a Bridge Friend, and follows up within 48 hours after the event.',
            instruction:
              'In Section 8 (Points of Integration), confirm your community event & opt-in RSVP are listed on HopeStartsHere.asia (Play 7 safe) and assign a Local Bridge Coordinator per church to contact signups within 48 hours, pair each guest 1:1 with a Bridge Friend, and follow up within 48 hours after the event.',
            isRelevantGap: !bridgingCtx.hasFollowUpAnd48h || !bridgingCtx.hasBridgeFriendOrCoordinator,
          },
        ]
      : []),
  ];

  const q6PresetChips = sortChipsByGap(q6RawChips);
  const q6DefaultChip = q6PresetChips[0];

  // -------------------------------------------------------------------------
  // Q7: Continuity (How tools, service, or discipleship/nurture are sustained)
  // -------------------------------------------------------------------------
  const continuityRegex =
    /\b(sustain\w*|continuit\w*|ongoing|follow-up|follow\s+up|follow\s+through|mentor\w*|nurtur\w*|retention|weekly|monthly|48-week|48\s+week|integrated\s+calendar|all\s+things\s+new|long-term|long\s+term|aftercare|local\s+partner\w*|local\s+church\w*\s+will|planted|multipl\w*|schedule\w*|curriculum|care\s+group\w*|small\s+group\w*)\b/i;

  const hasContinuityPlan = continuityRegex.test(
    `${outcomesText} ${integrationText} ${deliverablesText}`
  );
  const q7Adequate = Boolean(
    hasContinuityPlan && (outcomesText.length >= 25 || integrationText.length >= 25)
  );
  const q7Note = !q7Adequate
    ? pillarTrack === 'pillar_1_2'
      ? 'Explain in Section 8 how local teams will keep using these skills/tools after the grant ends.'
      : 'Explain in Section 8 how local small groups or pastors will care for people after the event ends.'
    : 'Ongoing follow-up and long-term care plan is clearly written.';

  const matchedContinuitySentence =
    findMatchingSentence(`${integrationText} ${outcomesText} ${deliverablesText}`, continuityRegex, 105);

  const q7ExtractedEvidence = matchedContinuitySentence
    ? `Follow-up found: "${matchedContinuitySentence}"`
    : 'No post-project follow-up or ongoing schedule found in Sec 4 or Sec 8';

  const q7RawChips: ReviewPresetFixChip[] = [
    ...(pillarTrack === 'pillar_1_2'
      ? [
          {
            id: 'q7_scheduled_use',
            label: 'Add ongoing use schedule in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters:
              'Grants should not fund one-time workshops or tools that sit unused. Show the weekly or monthly calendar after the grant ends.',
            pointers: [
              'Open Section 8 (Points of Integration).',
              'Write how often trained teams or local churches will use these outputs (e.g., weekly/monthly on the 48-week calendar).',
            ],
            exampleTemplate:
              'After training ends, [Mission/Church Teams] will publish and deploy content on a [weekly/monthly] schedule for 12 months with monthly mentoring check-ins.',
            instruction:
              'In Section 8 (Points of Integration), state the ongoing weekly or monthly schedule on which trained teams or local churches will use these tools after the grant ends.',
            isRelevantGap: !q7Adequate,
          },
          {
            id: 'q7_partner_sustain',
            label: 'Explain how local partners keep service going in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters:
              'Community service builds long-term trust when local churches or partners keep supporting neighbors after the grant finishes.',
            pointers: [
              'Open Section 8 (Points of Integration).',
              'Name the local church or community partner continuing ongoing care.',
            ],
            exampleTemplate:
              'Local [District Church / Adventist Community Services team] will continue monthly [wellness follow-ups / community classes] funded locally after grant completion.',
            instruction:
              'In Section 8 (Points of Integration), explain how local churches or community partners will keep this service going after the grant period ends.',
            isRelevantGap: !q7Adequate && subType === 'p2_community_service',
          },
        ]
      : [
          {
            id: 'q7_nurture_plan',
            label: 'Add weekly small-group / Bible study care in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters:
              'Events end in a few days, but discipleship takes months. Reviewers check where new friends go the week after your project.',
            pointers: [
              'Open Section 8 (Points of Integration).',
              'Describe the weekly small group, Sabbath School class, or Bible study that continues after the campaign.',
            ],
            exampleTemplate:
              'After the main event, local pastors and Hope Care Teams invite each interested person into a weekly [small group / Sabbath School class / Discovery Bible Study] for ongoing nurture.',
            instruction:
              'In Section 8 (Points of Integration), describe the weekly small group, Sabbath School class, or Bible study care plan that continues after the main event ends.',
            isRelevantGap: !q7Adequate,
          },
          {
            id: 'q7_retention_tracking',
            label: 'Explain 6–12 month new-member follow-up in Sec 8',
            targetSectionId: 'section-integration',
            targetSectionLabel: 'Section 8 · Points of Integration',
            shortSectionBadge: 'Sec 8 · Integration',
            whyItMatters:
              'New believers stay strong when someone mentors them and involves them in church life during their first year.',
            pointers: [
              'Open Section 8 (Points of Integration).',
              'Name who checks on new believers over 6–12 months and helps them serve in church ministry.',
            ],
            exampleTemplate:
              'For 6–12 months post-campaign, [Local Elders & Sabbath School Mentors] track attendance, visit monthly, and mentor new believers into active church ministry.',
            instruction:
              'In Section 8 (Points of Integration), state who mentors and checks on new believers over the next 6–12 months to help them stay rooted in a local church.',
            isRelevantGap: !q7Adequate,
          },
        ]),
    ...(bridgingCtx.shouldCoachGreeterTraining
      ? [
          {
            id: 'q7_bridging_training_next_date',
            label: 'Add 2-hr Greeter training & Next Date in Sec 6',
            targetSectionId: 'section-deliverables',
            targetSectionLabel: 'Section 6 · Deliverables',
            shortSectionBadge: 'Sec 6 · Deliverables',
            whyItMatters:
              'SSD’s Bridging Guide rule is "Train before you invite" and never end an event without inviting guests to a specific Next Date.',
            pointers: [
              'Open Section 6 (Project Deliverables).',
              'Add the 2-hour "Welcoming Online Guests" training before invites launch, and list the pre-scheduled Next Date invite.',
            ],
            exampleTemplate:
              'Deliverables include a 2-hour "Welcoming Online Guests" training for all greeters before ads launch, plus a pre-scheduled Next Date ([Sabbath Friendship Lunch / Small Group]) announced at the event.',
            instruction:
              'In Section 6 (Project Deliverables), include the 2-hour "Welcoming Online Guests" training before invitations go out and list the pre-scheduled Next Date offered at the event.',
            isRelevantGap: !q7Adequate && (!bridgingCtx.hasGreeterTraining || !bridgingCtx.hasPreScheduledNextStep),
          },
        ]
      : []),
  ];

  const q7PresetChips = sortChipsByGap(q7RawChips);
  const q7DefaultChip = q7PresetChips[0];

  const questions: ReviewQuestionEvaluation[] = [
    {
      key: 'q1_pillar',
      number: 1,
      shortTitle: 'Primary Pillar & Budget Use',
      questionPrompt:
        pillarTrack === 'pillar_1_2'
          ? 'Does principal purpose, budget, and deliverable belong to Pillar 1 (prepare workers) or Pillar 2 (intelligence, tools, or community service)?'
          : 'Is principal purpose, budget, and deliverable direct proclamation, harvesting, or discipleship (not primarily tool production)?',
      whyAsked:
        'Checks that your Strategic Pillar, Deliverable, and Budget lines tell the same story.',
      trackExpectation:
        pillarTrack === 'pillar_1_2'
          ? 'Pillar, deliverable & budget match'
          : 'Pillar 3 funds active outreach & follow-up',
      status: q1Adequate ? 'adequate' : 'needs_work',
      evidenceOrGapNote: q1Note,
      extractedEvidence: q1ExtractedEvidence,
      gapBreakdown: [
        { label: 'Top Pillar & Objective', ok: hasPillarAndObjective },
        { label: 'Sec 6 Deliverable', ok: hasDeliverable },
        { label: 'Sec 9 Budget Match', ok: budgetConcordance.isAligned },
      ],
      relatedSectionId: q1DefaultChip.targetSectionId,
      sectionLabel: q1DefaultChip.targetSectionLabel,
      shortSectionBadge: q1DefaultChip.shortSectionBadge,
      defaultFixInstruction: q1DefaultChip.instruction,
      presetFixChips: q1PresetChips,
    },
    {
      key: 'q2_pathway',
      number: 2,
      shortTitle: 'Pathway Stage Contribution',
      questionPrompt:
        pillarTrack === 'pillar_1_2'
          ? 'Which field team uses the enabling output, or (for community service) which ONE principal stage (REACH, ENGAGE, CONNECT) does it deliver?'
          : 'Which ONE principal stage (REACH, ENGAGE, CONNECT, DISCIPLE, MULTIPLY) does this project advance?',
      whyAsked:
        'Checks that your project focuses on one clear Mission Pathway step matching your Global Objective.',
      trackExpectation:
        pillarTrack === 'pillar_1_2'
          ? 'Field team named, or 1 stage (REACH–CONNECT)'
          : 'One clear stage (REACH → MULTIPLY)',
      status: q2Adequate ? 'adequate' : 'needs_work',
      evidenceOrGapNote: q2Note,
      extractedEvidence: q2ExtractedEvidence,
      gapBreakdown: [
        { label: 'Sec 5 KPI Matches Objective', ok: Boolean(canonicalKpi && kpiAligned && isP2ServiceStageValid) },
        ...(pillarTrack === 'pillar_1_2' && subType !== 'p2_community_service'
          ? [{ label: 'Sec 8 Deploying Team', ok: hasNamedDeployingTeamForEnabling }]
          : []),
      ],
      relatedSectionId: q2DefaultChip.targetSectionId,
      sectionLabel: q2DefaultChip.targetSectionLabel,
      shortSectionBadge: q2DefaultChip.shortSectionBadge,
      defaultFixInstruction: q2DefaultChip.instruction,
      presetFixChips: q2PresetChips,
    },
    {
      key: 'q3_input',
      number: 3,
      shortTitle: 'Input & Baseline Context',
      questionPrompt:
        pillarTrack === 'pillar_1_2'
          ? 'What unreached/underserved group, community need, baseline evidence, and prior capability inform this project?'
          : 'What existing contact, inquiry, interest, relationship, or referral enters this stage?',
      whyAsked:
        'Checks who you want to reach and what local numbers or needs show this project is ready.',
      trackExpectation:
        pillarTrack === 'pillar_1_2'
          ? 'Target group, felt need & starting numbers'
          : 'Seeker group & where contacts come from',
      status: q3Adequate ? 'adequate' : 'needs_work',
      evidenceOrGapNote: q3Note,
      extractedEvidence: q3ExtractedEvidence,
      gapBreakdown: [
        { label: 'Sec 7 Audiences', ok: hasAudiences && groupEDocumented },
        { label: 'Sec 2 Starting Context', ok: hasBaselineOrContextEvidence },
      ],
      relatedSectionId: q3DefaultChip.targetSectionId,
      sectionLabel: q3DefaultChip.targetSectionLabel,
      shortSectionBadge: q3DefaultChip.shortSectionBadge,
      defaultFixInstruction: q3DefaultChip.instruction,
      presetFixChips: q3PresetChips,
    },
    {
      key: 'q4_activity',
      number: 4,
      shortTitle: 'Core Activity & Safeguards',
      questionPrompt:
        pillarTrack === 'pillar_1_2'
          ? 'What activities prepare workers, map UPGs, create tools, or serve needs unconditionally?'
          : 'What activities proclaim the gospel, follow up interest, invite decisions, disciple, or multiply?',
      whyAsked:
        'Checks that your planned steps are clear, practical, and follow SSD ethical safeguards.',
      trackExpectation:
        pillarTrack === 'pillar_1_2'
          ? 'Clear steps & unconditional community help'
          : 'Clear outreach, bridging, or discipleship steps',
      status: q4Adequate ? 'adequate' : 'needs_work',
      evidenceOrGapNote: q4Note,
      extractedEvidence: q4ExtractedEvidence,
      gapBreakdown: [
        { label: 'Sec 3 Goal', ok: hasSubstantiveGoal },
        { label: 'Sec 6 Deliverables', ok: hasSubstantiveDeliverableQ4 },
        ...(serviceSafeguard.isCommunityServiceDetected
          ? [{ label: 'Free-Help Safeguard', ok: serviceSafeguardOk }]
          : []),
      ],
      relatedSectionId: q4DefaultChip.targetSectionId,
      sectionLabel: q4DefaultChip.targetSectionLabel,
      shortSectionBadge: q4DefaultChip.shortSectionBadge,
      defaultFixInstruction: q4DefaultChip.instruction,
      presetFixChips: q4PresetChips,
    },
    {
      key: 'q5_output',
      number: 5,
      shortTitle: 'Verifiable Stage Output',
      questionPrompt:
        pillarTrack === 'pillar_1_2'
          ? 'What verifiable intelligence, deployed resource, service beneficiary count, or voluntary connection is produced?'
          : 'What person-centered, stage-specific result is achieved and passed forward (beyond passive impressions/attendance)?',
      whyAsked:
        'Checks that you count real people taking action or real outputs delivered—not just video views.',
      trackExpectation:
        pillarTrack === 'pillar_1_2'
          ? 'Countable tool, training, or people served'
          : 'People taking action (beyond views alone)',
      status: q5Adequate ? 'adequate' : 'needs_work',
      evidenceOrGapNote: q5Note,
      extractedEvidence: q5ExtractedEvidence,
      gapBreakdown: [
        { label: 'Sec 5 Target Number', ok: hasNumericTarget && !hasPassiveOnlyStageMetric },
        { label: 'Sec 4 Outcomes', ok: hasSubstantiveOutcomes },
      ],
      relatedSectionId: q5DefaultChip.targetSectionId,
      sectionLabel: q5DefaultChip.targetSectionLabel,
      shortSectionBadge: q5DefaultChip.shortSectionBadge,
      defaultFixInstruction: q5DefaultChip.instruction,
      presetFixChips: q5PresetChips,
    },
    {
      key: 'q6_handoff',
      number: 6,
      shortTitle: 'Named Onward Handoff',
      questionPrompt:
        pillarTrack === 'pillar_1_2'
          ? 'Who accepts the intelligence, tool, or consenting referral, and how are receiving team & consent documented?'
          : 'Who accepts the person or referral next (Pastor, Hope Care Team, NDR-IEL), and how is the next step agreed?',
      whyAsked:
        'Checks who receives the contacts or tools next so nobody is left without local follow-up.',
      trackExpectation:
        pillarTrack === 'pillar_1_2'
          ? 'Named receiving team & consent rule'
          : 'Named Pastor / Hope Care Team receiver',
      status: q6Adequate ? 'adequate' : 'needs_work',
      evidenceOrGapNote: q6Note,
      extractedEvidence: q6ExtractedEvidence,
      gapBreakdown: [
        { label: 'Sec 8 Receiving Team', ok: integrationText.length >= 20 && hasNamedReceiver },
        ...(serviceSafeguard.isCommunityServiceDetected
          ? [{ label: 'Voluntary Consent', ok: consentOkForHandoff }]
          : []),
      ],
      relatedSectionId: q6DefaultChip.targetSectionId,
      sectionLabel: q6DefaultChip.targetSectionLabel,
      shortSectionBadge: q6DefaultChip.shortSectionBadge,
      defaultFixInstruction: q6DefaultChip.instruction,
      presetFixChips: q6PresetChips,
    },
    {
      key: 'q7_continuity',
      number: 7,
      shortTitle: 'Sustained Continuity',
      questionPrompt:
        pillarTrack === 'pillar_1_2'
          ? 'How are tools used on schedule, community services sustained regardless of response, and consenting referrals followed through?'
          : 'How are follow-up, Bible study, baptismal nurture, church integration, and multiplication sustained?',
      whyAsked:
        'Checks what happens after the grant or event finishes so people and tools keep bearing fruit.',
      trackExpectation:
        pillarTrack === 'pillar_1_2'
          ? 'Ongoing schedule & local partner care'
          : 'Weekly small groups & 6–12 month nurture',
      status: q7Adequate ? 'adequate' : 'needs_work',
      evidenceOrGapNote: q7Note,
      extractedEvidence: q7ExtractedEvidence,
      gapBreakdown: [
        { label: 'Ongoing Plan (Sec 4 / 8)', ok: q7Adequate },
      ],
      relatedSectionId: q7DefaultChip.targetSectionId,
      sectionLabel: q7DefaultChip.targetSectionLabel,
      shortSectionBadge: q7DefaultChip.shortSectionBadge,
      defaultFixInstruction: q7DefaultChip.instruction,
      presetFixChips: q7PresetChips,
    },
  ];

  const deficientKeys = questions
    .filter((q) => q.status === 'needs_work')
    .map((q) => q.key);
  const adequateCount = questions.length - deficientKeys.length;

  // Compute automated 3-Tier verdict
  let autoEvaluatedRating: ReviewReadinessRating = 'meeting_requirement';
  if (
    (!q1Adequate && !q2Adequate && !q6Adequate) ||
    deficientKeys.length >= 5
  ) {
    autoEvaluatedRating = 'not_fitting_pathways';
  } else if (
    deficientKeys.length >= 2 ||
    !q1Adequate ||
    !q6Adequate ||
    serviceSafeguard.status === 'missing_safeguard'
  ) {
    autoEvaluatedRating = 'needs_improvement';
  }

  // Resolve Effective Rating honoring ALL Liaison human rubric votes (using most-cautious consensus when split)
  // AND protecting already-certified proposals
  const votes = Array.isArray(proposal.liaisonVotes) ? proposal.liaisonVotes : [];
  const votesWithExplicitRating = votes.filter((v) => Boolean(v.readinessRating));
  const distinctRatings = new Set(votesWithExplicitRating.map((v) => v.readinessRating!));
  const hasSplitLiaisonVerdict = distinctRatings.size > 1;
  const hasRevisionVote = votes.some((v) => v.vote === 'revision_requested');
  const hasRecommendedVote = votes.some((v) => v.vote === 'recommended');
  const isStep5Authorized = Boolean(proposal.divisionApproval?.authorized);

  let effectiveRating: ReviewReadinessRating = autoEvaluatedRating;
  let ratingSource: ProposalReviewFrameworkEvaluation['ratingSource'] = 'auto_evaluated';

  if (votesWithExplicitRating.length > 0) {
    // Most-cautious rule when multiple Liaisons disagree: Not Fitting > Needs Improvement > Meeting Requirement
    if (distinctRatings.has('not_fitting_pathways')) {
      effectiveRating = 'not_fitting_pathways';
    } else if (distinctRatings.has('needs_improvement')) {
      effectiveRating = 'needs_improvement';
    } else {
      effectiveRating = 'meeting_requirement';
    }
    ratingSource = 'liaison_certified';
  } else if (hasRevisionVote && !hasRecommendedVote) {
    effectiveRating =
      autoEvaluatedRating === 'not_fitting_pathways'
        ? 'not_fitting_pathways'
        : 'needs_improvement';
    ratingSource = 'liaison_certified';
  } else if (isStep5Authorized || (hasRecommendedVote && !hasRevisionVote)) {
    // Safeguard for existing Step 5 Authorized & Step 4 Recommended proposals without a rubric rating
    effectiveRating = 'meeting_requirement';
    ratingSource = 'governance_certified';
  }

  return {
    pillarTrack,
    subType,
    subTypeMeta,
    principalStageKey,
    principalStageLabel,
    questions,
    adequateCount,
    deficientKeys,
    budgetConcordance,
    serviceSafeguard,
    hasPassiveOnlyStageMetric,
    passiveMetricGuidance,
    autoEvaluatedRating,
    effectiveRating,
    effectiveRatingLabel: REVIEW_READINESS_LABELS[effectiveRating],
    ratingSource,
    hasSplitLiaisonVerdict,
  };
}

export function resolveQuestionTargetForInstruction(
  q: ReviewQuestionEvaluation,
  instructionText?: string
): {
  sectionId: string;
  sectionLabel: string;
  shortSectionBadge: string;
  matchedChip?: ReviewPresetFixChip;
} {
  const cleaned = (instructionText || '').trim();
  if (cleaned) {
    const exactChip = q.presetFixChips.find(
      (c) => c.instruction.trim() === cleaned || cleaned.startsWith(c.instruction.trim())
    );
    if (exactChip) {
      return {
        sectionId: exactChip.targetSectionId,
        sectionLabel: exactChip.targetSectionLabel,
        shortSectionBadge: exactChip.shortSectionBadge,
        matchedChip: exactChip,
      };
    }
    const lower = cleaned.toLowerCase();
    if (/^in section 2\b/i.test(lower)) {
      return { sectionId: 'section-overview', sectionLabel: 'Section 2 · Overview', shortSectionBadge: 'Sec 2 · Overview' };
    }
    if (/^in section 3\b/i.test(lower)) {
      return { sectionId: 'section-goal', sectionLabel: 'Section 3 · Project Goal', shortSectionBadge: 'Sec 3 · Goal' };
    }
    if (/^in section 4\b/i.test(lower)) {
      return { sectionId: 'section-outcomes', sectionLabel: 'Section 4 · Outcomes', shortSectionBadge: 'Sec 4 · Outcomes' };
    }
    if (/^in section 5\b/i.test(lower)) {
      return { sectionId: 'section-5-kpi', sectionLabel: 'Section 5 · Primary KPI', shortSectionBadge: 'Sec 5 · KPI' };
    }
    if (/^in section 6\b/i.test(lower)) {
      return { sectionId: 'section-deliverables', sectionLabel: 'Section 6 · Project Deliverables', shortSectionBadge: 'Sec 6 · Deliverables' };
    }
    if (/^in section 7\b/i.test(lower)) {
      return { sectionId: 'section-audience', sectionLabel: 'Section 7 · Target Audience', shortSectionBadge: 'Sec 7 · Audience' };
    }
    if (/^in section 8\b/i.test(lower)) {
      return { sectionId: 'section-integration', sectionLabel: 'Section 8 · Points of Integration', shortSectionBadge: 'Sec 8 · Integration' };
    }
    if (/^in section 9\b/i.test(lower)) {
      return { sectionId: 'section-budget', sectionLabel: 'Section 9 · Budget Plan', shortSectionBadge: 'Sec 9 · Budget' };
    }
    if (/^in strategy scope\b/i.test(lower)) {
      return { sectionId: 'section-strategic-focus', sectionLabel: 'Strategy Scope (Top of Form)', shortSectionBadge: 'Top · Pillar Scope' };
    }
  }
  return {
    sectionId: q.relatedSectionId,
    sectionLabel: q.sectionLabel,
    shortSectionBadge: q.shortSectionBadge,
  };
}

/**
 * Builds structured, section-linked LiaisonActionItem records from the flagged rubric questions
 * and any specific Liaison prescription text.
 */
export function buildLiaisonActionItems(
  evaluation: ProposalReviewFrameworkEvaluation,
  selectedDeficientKeys: ReviewCriterionKey[],
  customInstructions?: Partial<Record<ReviewCriterionKey, string>>
): LiaisonActionItem[] {
  return evaluation.questions
    .filter((q) => selectedDeficientKeys.includes(q.key))
    .map((q) => {
      const custom = (customInstructions?.[q.key] || '').trim();
      const finalInstruction =
        custom ||
        (q.status === 'adequate'
          ? `Please review and strengthen ${q.shortTitle} in ${q.sectionLabel}.`
          : q.defaultFixInstruction);
      const target = resolveQuestionTargetForInstruction(q, finalInstruction);
      return {
        criterionKey: q.key,
        questionNumber: q.number,
        shortTitle: q.shortTitle,
        sectionId: target.sectionId,
        sectionLabel: target.sectionLabel,
        instruction: finalInstruction,
      };
    });
}

/**
 * Builds a concrete, section-referenced coaching note from the 7-Question SSD Review Framework
 * for Division Liaisons to insert into Step 4 Recommendations or Review Notes.
 */
export function buildLiaisonCoachingSummary(
  evaluation: ProposalReviewFrameworkEvaluation,
  selectedDeficientKeys: ReviewCriterionKey[],
  selectedRating: ReviewReadinessRating,
  customInstructions?: Partial<Record<ReviewCriterionKey, string>>
): string {
  const ratingLabel = REVIEW_READINESS_LABELS[selectedRating];
  const actionItems = buildLiaisonActionItems(
    evaluation,
    selectedDeficientKeys,
    customInstructions
  );

  if (selectedRating === 'meeting_requirement' && actionItems.length === 0) {
    return `SSD Review Framework (${ratingLabel} · ${evaluation.subTypeMeta.shortLabel}): Primary pillar classification, ${evaluation.principalStageLabel} pathway stage, measurable target, and onward local handoff/continuity are verified for OV27 Committee consideration.`;
  }

  if (actionItems.length === 0) {
    return `SSD Review Framework (${ratingLabel} · ${evaluation.subTypeMeta.shortLabel}): Please strengthen pathway stage evidence, named local handoff in Section 8, and post-project continuity before final authorization.`;
  }

  const numberedLines = actionItems.map(
    (item, idx) =>
      `${idx + 1}. ${item.sectionLabel} (Q${item.questionNumber} · ${item.shortTitle}): ${item.instruction}`
  );

  return `SSD Review Framework (${ratingLabel} · ${evaluation.subTypeMeta.shortLabel}) — Specific Changes Requested:\n${numberedLines.join('\n')}`;
}

/**
 * Extracts active, structured LiaisonActionItem[] for a proposal (from Step 4 LiaisonVotes or ReviewNotes)
 * so Proposal Makers see an exact section-by-section fix checklist and inline field callouts.
 */
export function getActiveLiaisonActionItems(proposal: Proposal): {
  items: LiaisonActionItem[];
  authorName: string;
  authorRole: string;
  createdAt: string;
  verdictLabel?: string;
} | null {
  const votes = Array.isArray(proposal.liaisonVotes) ? proposal.liaisonVotes : [];

  // 1. Prioritize Step 4 Liaison votes that flagged action items (especially revision_requested)
  const votesWithActions = votes.filter(
    (v) => Array.isArray(v.actionItems) && v.actionItems.length > 0
  );
  if (votesWithActions.length > 0) {
    const revisionVotes = votesWithActions.filter((v) => v.vote === 'revision_requested');
    const targetVotes = revisionVotes.length > 0 ? revisionVotes : votesWithActions;

    // Merge deduplicated by criterionKey so if two Liaisons flagged different sections, the author sees all of them!
    const mergedMap = new Map<string, LiaisonActionItem>();
    for (const v of targetVotes) {
      for (const item of v.actionItems || []) {
        const key = `${item.criterionKey}:${item.instruction}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, item);
        }
      }
    }
    const latest = targetVotes[targetVotes.length - 1];
    const authorNames = Array.from(new Set(targetVotes.map((v) => v.liaisonName).filter(Boolean)));
    return {
      items: Array.from(mergedMap.values()).sort((a, b) => a.questionNumber - b.questionNumber),
      authorName: authorNames.join(', ') || latest.liaisonName || 'Division Liaison',
      authorRole: 'division_liaison',
      createdAt: latest.timestamp,
      verdictLabel: latest.readinessRating
        ? REVIEW_READINESS_LABELS[latest.readinessRating]
        : undefined,
    };
  }

  // 2. Fallback: Check ReviewNotes thread for Liaison coaching notes carrying structured actionItems
  const notes = getProposalReviewNotes(proposal);
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    if (Array.isArray(n.actionItems) && n.actionItems.length > 0) {
      return {
        items: n.actionItems,
        authorName: n.authorName || 'Division Liaison',
        authorRole: n.authorRole || 'division_liaison',
        createdAt: n.createdAt,
        verdictLabel: n.readinessRating ? REVIEW_READINESS_LABELS[n.readinessRating] : undefined,
      };
    }
  }

  return null;
}

/**
 * Returns active LiaisonActionItems targeting a specific form sectionId (e.g., 'section-integration').
 */
export function getSectionLiaisonActionItems(
  proposal: Proposal,
  sectionId: string
): { items: LiaisonActionItem[]; authorName: string } | null {
  const active = getActiveLiaisonActionItems(proposal);
  if (!active) return null;
  const matching = active.items.filter((item) => item.sectionId === sectionId);
  if (matching.length === 0) return null;
  return {
    items: matching,
    authorName: active.authorName,
  };
}
