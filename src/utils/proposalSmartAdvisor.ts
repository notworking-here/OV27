import {
  Proposal,
  KPIType,
  getCanonicalDivisionProject,
  getCanonicalKpiType,
  getProposalPillarKey,
  getAllowedKPIsForObjective,
  isKpiAlignedWithObjective,
  KPI_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from '../types';
import {
  PLAYBOOK_INTEGRATION_PARTNERS,
  PLAYBOOK_DELIVERABLE_PROMPTS,
  PLAYBOOK_PATHWAY_BY_KPI,
  PLAYBOOK_SENSITIVE_AREA_GUIDE,
  PlaybookIntegrationPartner,
  PlaybookDeliverablePrompt,
  PlaybookPathwayStage,
} from '../data/oneVoice27Playbook';
import { evaluateProposalUnionIntelligence } from '../data/unionIntelligence';
import {
  detectBridgingProposalContext,
  getBridgingGuidanceForUnion,
} from '../data/bridgingEventsGuide';
import { evaluateProposalReviewFramework } from './projectReviewFramework';
import { analyzeUnionMissionPathway } from './unionPathwayAlignment';

export {
  PLAYBOOK_INTEGRATION_PARTNERS,
  PLAYBOOK_DELIVERABLE_PROMPTS,
  PLAYBOOK_PATHWAY_BY_KPI,
  PLAYBOOK_SENSITIVE_AREA_GUIDE,
};
export type {
  PlaybookIntegrationPartner,
  PlaybookDeliverablePrompt,
  PlaybookPathwayStage,
};

export interface SmartAdvisoryItem {
  id: string;
  sectionId: string;
  sectionLabel?: string;
  severity: 'contradiction' | 'treasurer' | 'clarity' | 'playbook' | 'suggestion';
  title: string;
  message: string;
  whyItMatters?: string;
  pointers?: string[];
  exampleTemplate?: string;
  quickActionLabel?: string;
  onQuickActionType?:
    | 'add_audience'
    | 'apply_calculated_kpi'
    | 'clean_kpi_number'
    | 'switch_kpi'
    | 'switch_objective_and_kpi'
    | 'add_budget_item'
    | 'append_integration'
    | 'append_deliverable'
    | 'append_outcomes';
  payload?: {
    audienceIds?: string[];
    newKpiNumber?: string;
    appendKpiDescription?: string;
    newKpiType?: KPIType;
    newStrategicFocus?: string;
    newDivisionProject?: string;
    budgetActivity?: string;
    integrationSnippet?: string;
    deliverableSnippet?: string;
    outcomesSnippet?: string;
  };
}

export interface AudienceContradictionAnalysis {
  hasContradiction: boolean;
  type: 'outreach_internal_only' | 'upg_missing_e' | 'training_external_only' | null;
  title: string;
  explanation: string;
  suggestedAudienceIds: string[];
  matchedKeywords: string[];
}

export interface TargetGoalClarityAnalysis {
  hasWarning: boolean;
  warningType:
    | 'formula_multiplier'
    | 'wordy_multi_number'
    | 'kpi_unit_mismatch'
    | 'missing_number'
    | null;
  title: string;
  message: string;
  suggestedTotalNumber?: string;
  suggestedDetailMove?: string;
  suggestedKpiSwitch?: KPIType;
  suggestedKpiSwitchTitle?: string;
}

export interface BudgetSuggestionTag {
  id: string;
  label: string;
  category: 'production' | 'logistics' | 'digital' | 'materials' | 'personnel' | 'research';
  reason?: string;
  isFromDeliverables?: boolean;
}

export interface SmartBudgetAnalysis {
  isSingleItem: boolean;
  isLumpSumHeavy: boolean;
  validItemCount: number;
  totalRequested: number;
  treasurerWarningTitle: string | null;
  treasurerWarningMessage: string | null;
  missingDeliverableCategories: {
    deliverableKeyword: string;
    suggestedItem: string;
    matchedPhrase?: string;
  }[];
  suggestedTags: BudgetSuggestionTag[];
}

export interface PlaybookEcosystemAnalysis {
  handoffMode: 'pillar1_training' | 'community_event_rsvp' | 'media_content_cta';
  missingGoldenRuleHandoff: boolean;
  goldenRuleTitle: string;
  goldenRuleMessage: string;
  goldenRuleSnippet: string;
  missingLocalChurchReceiver: boolean;
  localReceiverTitle: string;
  localReceiverMessage: string;
  localReceiverSnippet: string;
  missingRepositoryMention: boolean;
  repositoryTitle: string;
  repositoryMessage: string;
  repositorySnippet: string;
}

export interface NarrativeDepthAnalysis {
  overviewSentences: number;
  goalSentences: number;
  outcomesSentences: number;
  isGoalOutcomeDuplicate: boolean;
  isIntegrationTooVague: boolean;
}

/**
 * Counts approximate sentences in a narrative block.
 */
export function countSentences(text?: string): number {
  if (!text || !text.trim()) return 0;
  const cleaned = text.trim();
  const matches = cleaned
    .split(/(?:[.!?]+(?:\s|$)|\n+)/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  return matches.length;
}

/**
 * 1. Analyzes contradictions between Narrative / Global Objective / KPI and Target Audience (Section 7).
 */
export function analyzeAudienceContradictions(proposal: Proposal): AudienceContradictionAnalysis {
  const audiences = proposal.targetAudiences || [];
  const canonicalObjective = getCanonicalDivisionProject(proposal.divisionProject);
  const canonicalKpi = getCanonicalKpiType(proposal.kpiType);
  const pillarKey = getProposalPillarKey(proposal);

  const combinedText = [
    proposal.title,
    proposal.overview,
    proposal.goal,
    proposal.outcomes,
    proposal.deliverables,
    proposal.kpiDescription,
    proposal.kpiRationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Check which audience groups are selected
  const hasGroupA = audiences.some((a) => a.startsWith('A'));
  const hasGroupB = audiences.includes('B');
  const hasGroupC = audiences.includes('C');
  const hasGroupD = audiences.includes('D');
  const hasGroupE = audiences.includes('E') || audiences.includes('group_e');
  const hasExternalAudience = hasGroupC || hasGroupD || hasGroupE;
  const hasOnlyInternalAdventist =
    audiences.length > 0 && (hasGroupA || hasGroupB) && !hasExternalAudience;

  // Identify Pillar 1 / Training & Mobilization projects whose direct funded audience is church members/leaders
  const isTrainingObjective =
    canonicalObjective === 'Regional Media Evangelism & Creators Conferences';
  const isMobilizationKpi = canonicalKpi === 'implementation_capability';
  const isInternalTrainingProject =
    pillarKey === 'inspiration' || isTrainingObjective || isMobilizationKpi;

  // Detect UPG / Non-Christian / World Religion cues
  const upgKeywords = [
    'unreached',
    'upg',
    'non-christian',
    'non christian',
    'world religion',
    'buddhist',
    'muslim',
    'islam',
    'hindu',
    'secular',
    'no religion',
    'non-religious',
    'people group',
    '10/40 window',
  ];
  const matchedUpg = upgKeywords.filter((kw) => combinedText.includes(kw));

  const isUpgObjective =
    canonicalObjective === 'Mission Intelligence: Reaching Unreached People Groups';

  if (
    audiences.length > 0 &&
    !hasGroupE &&
    (isUpgObjective || (!isInternalTrainingProject && matchedUpg.length > 0))
  ) {
    return {
      hasContradiction: true,
      type: 'upg_missing_e',
      title: 'Target Audience Contradiction: Unreached / Non-Religious Group Missing',
      explanation: isUpgObjective
        ? `Your Global Objective is "${canonicalObjective}", which specifically targets non-religious groups or other world religions (Playbook p. 8), but Group E is not selected in Section 7.`
        : `Your project narrative mentions "${matchedUpg.slice(0, 2).join(', ')}", which points to non-Christian or unreached populations (Playbook p. 8), yet Group E is not selected in your Target Audience.`,
      suggestedAudienceIds: ['E'],
      matchedKeywords: matchedUpg,
    };
  }

  // Strip training-for-evangelism phrasing before checking direct public outreach keywords
  const outreachScanText = combinedText.replace(
    /\b(?:train(?:ing|ed)?|equip(?:ping|ped)?|empower(?:ing|ed)?|mobiliz(?:ing|ed)?|prepar(?:ing|ed)?|workshop|conference|seminar|bootcamp)\b[^.!?\n]{0,65}\b(?:evangelism|evangelistic)\b/gi,
    ' '
  );

  // Detect Baptism / Evangelism / Public Outreach cues
  const outreachKeywords = [
    'baptism',
    'baptize',
    'baptised',
    'evangelism',
    'evangelistic',
    'public campaign',
    'reaping',
    'harvesting',
    'crusade',
    'seeker',
    'seekers',
    'non-adventist',
    'non adventist',
    'general public',
    'community outreach',
    'public outreach',
    'new believers',
    'bible study interest',
    'prospects',
  ];
  const matchedOutreach = outreachKeywords.filter((kw) => outreachScanText.includes(kw));

  const isOutreachObjective =
    canonicalObjective === 'Proclamation & Harvesting Initiatives' ||
    canonicalObjective === 'Global Marketing Campaign';
  const isBridgingOrDiscipleshipKpi =
    canonicalKpi === 'connection_next_steps' || canonicalKpi === 'retention_nurturing';

  if (
    hasOnlyInternalAdventist &&
    !isInternalTrainingProject &&
    (matchedOutreach.length > 0 || isOutreachObjective || isBridgingOrDiscipleshipKpi)
  ) {
    const reasons: string[] = [];
    if (matchedOutreach.length > 0) {
      reasons.push(`your narrative mentions "${matchedOutreach.slice(0, 3).join(', ')}"`);
    }
    if (isOutreachObjective) {
      reasons.push(`your Global Objective is "${canonicalObjective}"`);
    }
    if (canonicalKpi === 'retention_nurturing' && matchedOutreach.includes('baptism')) {
      reasons.push('your KPI focuses on Baptisms & Discipleship');
    }

    return {
      hasContradiction: true,
      type: 'outreach_internal_only',
      title: 'Audience Contradiction: Outreach / Baptism Narrative vs. All-Adventist Audience',
      explanation: `Because ${reasons.join(' and ')}, selecting only internal Adventist segments (${audiences.join(', ')}) creates a strategic contradiction. External seekers and public audiences belong to Groups C, D, or E (Playbook p. 29).`,
      suggestedAudienceIds: ['C', 'D', 'E'],
      matchedKeywords: matchedOutreach,
    };
  }

  // Detect Internal Training / Creators Mobilization with ONLY external D/E selected
  const hasOnlyExternal =
    audiences.length > 0 && !hasGroupA && !hasGroupB && (hasGroupD || hasGroupE);

  if (isInternalTrainingProject && hasOnlyExternal) {
    return {
      hasContradiction: true,
      type: 'training_external_only',
      title: 'Audience Check: Training & Mobilization vs. External-Only Selection',
      explanation:
        'Your proposal focuses on equipping and mobilizing church leaders, youth, or content creators (KPI 5: Multiply / Creators Conference, Playbook p. 15), but your Target Audience only lists non-Adventist groups (D/E). Consider including the church members or leaders being trained (A1, A2, A3, or B).',
      suggestedAudienceIds: ['A1', 'A2', 'A3', 'B'],
      matchedKeywords: ['training', 'mobilization'],
    };
  }

  return {
    hasContradiction: false,
    type: null,
    title: '',
    explanation: '',
    suggestedAudienceIds: [],
    matchedKeywords: [],
  };
}

/**
 * 2. Analyzes Section 5 Target Goal (`kpiNumber`) for wordiness, math formulas, or KPI unit mismatches.
 */
export function analyzeTargetGoalClarity(proposal: Proposal): TargetGoalClarityAnalysis {
  const raw = (proposal.kpiNumber || '').trim();
  const canonicalKpi = getCanonicalKpiType(proposal.kpiType);

  if (!raw) {
    return {
      hasWarning: false,
      warningType: null,
      title: '',
      message: '',
    };
  }

  const lower = raw.toLowerCase();
  const words = raw.split(/\s+/).filter(Boolean);

  // Check for explicit math formulas or periodic rates:
  const periodicKeywords =
    /\b(per\s+month|monthly|per\s+week|weekly|per\s+day|daily|per\s+year|annually|per\s+quarter|per\s+church|per\s+event|per\s+episode|per\s+district|each\s+month|every\s+month)\b/i;
  const multiplicationPattern =
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:x|\*|×|times|multiplied\s+by)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i;
  const rateByDurationPattern =
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:[a-z\s]{1,20}?)\s*(?:per|each|every|a)\s*(month|week|church|episode|event|district|quarter|day)[a-z\s]*?(?:for|across|in|over)\s*(\d+(?:,\d{3})*)/i;

  const multMatch = raw.match(multiplicationPattern);
  const rateDurationMatch = raw.match(rateByDurationPattern);
  const hasPeriodicWord = periodicKeywords.test(lower);

  if (multMatch || rateDurationMatch || hasPeriodicWord) {
    let calculatedTotal: number | null = null;
    if (multMatch) {
      const a = parseFloat(multMatch[1].replace(/,/g, ''));
      const b = parseFloat(multMatch[2].replace(/,/g, ''));
      if (!isNaN(a) && !isNaN(b) && a > 0 && b > 0) {
        calculatedTotal = Math.round(a * b);
      }
    } else if (rateDurationMatch) {
      const a = parseFloat(rateDurationMatch[1].replace(/,/g, ''));
      const b = parseFloat(rateDurationMatch[3].replace(/,/g, ''));
      if (!isNaN(a) && !isNaN(b) && a > 0 && b > 0) {
        calculatedTotal = Math.round(a * b);
      }
    } else if (hasPeriodicWord) {
      const allNums = Array.from(raw.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d+)\b/g)).map((m) =>
        parseFloat(m[1].replace(/,/g, ''))
      );
      if (allNums.length === 2 && allNums[0] > 0 && allNums[1] > 0) {
        calculatedTotal = Math.round(allNums[0] * allNums[1]);
      } else if (
        allNums.length === 1 &&
        allNums[0] > 0 &&
        /\b(per\s+month|monthly|each\s+month)\b/i.test(lower)
      ) {
        calculatedTotal = Math.round(allNums[0] * 12);
      }
    }

    return {
      hasWarning: true,
      warningType: 'formula_multiplier',
      title: 'Use Cumulative Project Total (Not a Formula or Monthly Rate)',
      message: calculatedTotal
        ? `Target Goal contains a rate or formula ("${raw}"). Please enter the single cumulative total for the entire project (e.g., ${calculatedTotal.toLocaleString()}) so the Division Dashboard can accurately aggregate your target, and put the breakdown math in Metric Details.`
        : `Target Goal includes a periodic rate or multiplier ("${raw}"). Please enter the final cumulative total number for the entire project, and move your monthly/per-unit calculation into Metric Details below.`,
      suggestedTotalNumber: calculatedTotal ? calculatedTotal.toLocaleString() : undefined,
      suggestedDetailMove: `Calculation breakdown: ${raw}`,
    };
  }

  // Check for multiple competing numbers or excessive wordiness
  const cleanedForNumCheck = raw
    .replace(/\b20(?:2[4-9]|3[0-5])\b/g, ' ')
    .replace(/(?:-\s*\d+|\bto\s+\d+)/gi, ' ');
  const distinctNumbers = Array.from(
    cleanedForNumCheck.matchAll(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|million|thousand)?)\b/gi)
  ).map((m) => m[1].trim());

  if (distinctNumbers.length >= 2 || words.length > 7) {
    let largestVal = 0;
    let largestStr = distinctNumbers[0] || '';
    for (const numStr of distinctNumbers) {
      const m = numStr.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m|million|thousand)?/i);
      if (m) {
        let v = parseFloat(m[1].replace(/,/g, ''));
        const unit = (m[2] || '').toLowerCase();
        if (unit.startsWith('m')) v *= 1_000_000;
        else if (unit.startsWith('k') || unit.startsWith('thous')) v *= 1_000;
        if (v > largestVal) {
          largestVal = v;
          largestStr = Math.round(v).toLocaleString();
        }
      }
    }

    return {
      hasWarning: true,
      warningType: 'wordy_multi_number',
      title: 'Keep Target Goal Concise (Single Primary Number)',
      message:
        distinctNumbers.length >= 2
          ? `You entered multiple numbers (${distinctNumbers.join(', ')}) in Target Goal. The Division Dashboard can only track one primary target number for your selected KPI. Keep only the main total number here and move the rest to Metric Details.`
          : `Target Goal is too wordy (${words.length} words). Please state just the quantifiable total for the entire project (e.g., "${largestStr || '5,000'}") and place the narrative explanation inside Metric Details below.`,
      suggestedTotalNumber: largestStr || undefined,
      suggestedDetailMove: raw,
    };
  }

  // Check for KPI Unit Mismatch
  if (canonicalKpi) {
    const allowedKpis = getAllowedKPIsForObjective(proposal.divisionProject);

    if (
      canonicalKpi === 'reach_exposure' &&
      /\b(baptism|baptisms|baptized|bible\s+stud(?:y|ies)|small\s+group)\b/i.test(lower)
    ) {
      const canSwitchTo4 = allowedKpis.includes('retention_nurturing');
      return {
        hasWarning: true,
        warningType: 'kpi_unit_mismatch',
        title: 'Target Unit Mismatch with Primary KPI (Playbook p. 42)',
        message: `You selected "1. Reach & Exposure" (which counts views, listeners, or impressions), but your Target Goal specifies "${raw}" (which belongs to Discipleship & Retention on the Playbook pathway).`,
        suggestedKpiSwitch: canSwitchTo4 ? 'retention_nurturing' : undefined,
        suggestedKpiSwitchTitle: canSwitchTo4 ? '4. Discipleship & Retention' : undefined,
      };
    }

    if (
      (canonicalKpi === 'retention_nurturing' || canonicalKpi === 'implementation_capability') &&
      /\b(views|impressions|listeners|downloads|reach)\b/i.test(lower)
    ) {
      const canSwitchTo1 = allowedKpis.includes('reach_exposure');
      const kpiObj = KPI_OPTIONS.find((k) => k.id === canonicalKpi);
      return {
        hasWarning: true,
        warningType: 'kpi_unit_mismatch',
        title: 'Target Unit Mismatch with Primary KPI (Playbook p. 42)',
        message: `You selected "${kpiObj?.number}. ${kpiObj?.title}" (which counts people nurtured or mobilized), but your Target Goal counts passive "${raw}" (which belongs to Reach & Exposure).`,
        suggestedKpiSwitch: canSwitchTo1 ? 'reach_exposure' : undefined,
        suggestedKpiSwitchTitle: canSwitchTo1 ? '1. Reach & Exposure' : undefined,
      };
    }

    // Deep KPI Description & Rationale scan (catches plain numbers like "10,000" paired with active-participant measurement notes)
    const kpiDetailsText = `${proposal.kpiDescription || ''} ${proposal.kpiRationale || ''}`
      .trim()
      .toLowerCase();

    if (kpiDetailsText.length >= 20) {
      const hasPassiveReachTerms =
        /\b(views|video\s+views|impressions|listeners|downloads|unique\s+reach|watch\s+time|reel\s+plays|broadcast\s+reach|click-?through)\b/i.test(
          kpiDetailsText
        );
      const activeParticipantMatches = kpiDetailsText.match(
        /\b(discipleship|enrollment|enrolled|attendance|attendees|small[\s-]+group|mentoring|member\s+visitation|restored\s+membership|bible\s+stud(?:y|ies)|baptism|baptized|sabbath\s+school|counseling|1-on-1|direct\s+message|inquiries|prayer\s+requests|participants|trained\s+(?:leaders|creators|members)|bridging\s+event|rsvp|referrals)\b/gi
      );

      if (
        canonicalKpi === 'reach_exposure' &&
        !hasPassiveReachTerms &&
        activeParticipantMatches &&
        activeParticipantMatches.length >= 2
      ) {
        const hasDiscipleCues =
          /\b(discipleship|small[\s-]+group|mentoring|member\s+visitation|restored\s+membership|bible\s+stud(?:y|ies)|baptism|baptized|nurturing)\b/i.test(
            kpiDetailsText
          );
        const hasConnectCues =
          /\b(bridging\s+event|rsvp|referrals|attendees|health\s+expo|seminar)\b/i.test(
            kpiDetailsText
          );

        let preferredKpi: KPIType | undefined;
        if (hasDiscipleCues && allowedKpis.includes('retention_nurturing')) {
          preferredKpi = 'retention_nurturing';
        } else if (hasConnectCues && allowedKpis.includes('connection_next_steps')) {
          preferredKpi = 'connection_next_steps';
        } else if (allowedKpis.includes('engagement_participation')) {
          preferredKpi = 'engagement_participation';
        }

        const preferredObj = preferredKpi
          ? KPI_OPTIONS.find((k) => k.id === preferredKpi)
          : undefined;
        const uniqueCueSample = Array.from(
          new Set(activeParticipantMatches.map((m) => m.toLowerCase()))
        )
          .slice(0, 3)
          .join(', ');

        return {
          hasWarning: true,
          warningType: 'kpi_unit_mismatch',
          title: 'Primary KPI Choice May Not Match Your Measurement Plan (Sec 5)',
          message: `You chose "1. Reach & Exposure" (for passive views, listeners, or impressions), but your measurement notes track active human engagement (${uniqueCueSample}). ${
            preferredObj
              ? `"${preferredObj.number}. ${preferredObj.title}" fits your "${raw}" target much more accurately.`
              : 'Consider choosing an Engagement, Connection, or Discipleship KPI—or aligning your measurement notes with passive reach.'
          }`,
          suggestedKpiSwitch: preferredKpi,
          suggestedKpiSwitchTitle: preferredObj
            ? `${preferredObj.number}. ${preferredObj.title}`
            : undefined,
        };
      }
    }
  }

  return {
    hasWarning: false,
    warningType: null,
    title: '',
    message: '',
  };
}

export type StrategicIntentLane =
  | 'p1_creators_training'
  | 'p2_media_production'
  | 'p2_upg_intelligence'
  | 'p3_harvest_discipleship'
  | 'p3_marketing_campaign';

export interface MajorityIntentAnalysis {
  type: 'objective_mismatch' | 'hybrid_framing' | null;
  currentLane: StrategicIntentLane | null;
  suggestedLane: StrategicIntentLane | null;
  suggestedStrategicFocus?: string;
  suggestedDivisionProject?: string;
  suggestedObjectiveLabel?: string;
  suggestedKpiType?: KPIType;
  suggestedKpiLabel?: string;
  corroboratingRegions: string[];
  title: string;
  message: string;
  whyItMatters: string;
  pointers: string[];
  exampleTemplate: string;
}

function getStrategicLaneForObjective(canonicalObjective: string): StrategicIntentLane | null {
  switch (canonicalObjective) {
    case 'Regional Media Evangelism & Creators Conferences':
      return 'p1_creators_training';
    case 'Proclamation Kits & Contextualized Evangelistic Materials':
    case 'Global Contextualized Media Production':
    case 'Short-Form Content':
      return 'p2_media_production';
    case 'Mission Intelligence: Reaching Unreached People Groups':
      return 'p2_upg_intelligence';
    case 'Proclamation & Harvesting Initiatives':
      return 'p3_harvest_discipleship';
    case 'Global Marketing Campaign':
      return 'p3_marketing_campaign';
    default:
      return null;
  }
}

const LANE_SIGNAL_RULES: Record<
  StrategicIntentLane,
  {
    strongRegex: RegExp;
    objective: string;
    focus: string;
    objectiveShort: string;
    defaultKpi: KPIType;
  }
> = {
  p1_creators_training: {
    strongRegex:
      /\b(creators?\s+conference|media\s+(?:evangelism\s+)?(?:conference|bootcamp|summit|workshop|training)|content\s+creator\s+training|train(?:ing)?\s+(?:digital\s+missionar\w*|creators|influencers)|equip(?:ping)?\s+creators)\b/gi,
    focus: 'Prayer, Training, and Inspiration',
    objective: 'Regional Media Evangelism & Creators Conferences',
    objectiveShort: 'Pillar 1 · Objective 1 (Creators Conferences & Training)',
    defaultKpi: 'implementation_capability',
  },
  p2_media_production: {
    strongRegex:
      /\b(short[\s-]+form|vertical\s+video|reels\b|tiktok|youtube\s+shorts|video\s+series|episodes?|podcast|documentary|film\s+production|media\s+production|studio\s+production|proclamation\s+kit|evangelistic\s+(?:booklet|tract|material)|dubb(?:ing)?|subtitl(?:e|ing)|content\s+repository|views\b|impressions)\b/gi,
    focus: 'Bold Initiatives, Materials, and Tools',
    objective: 'Short-Form Content',
    objectiveShort: 'Pillar 2 · Media, Kits & Content Production',
    defaultKpi: 'reach_exposure',
  },
  p2_upg_intelligence: {
    strongRegex:
      /\b(mission\s+intelligence|people\s+group\s+(?:research|mapping|assessment)|unreached\s+people|upg\b|upgs\b|10\/40\s+window|buddhist|muslim|islam\w*|hindu\w*|animis\w*|world\s+religion)\b/gi,
    focus: 'Bold Initiatives, Materials, and Tools',
    objective: 'Mission Intelligence: Reaching Unreached People Groups',
    objectiveShort: 'Pillar 2 · Objective 5 (Mission Intelligence: UPGs)',
    defaultKpi: 'engagement_participation',
  },
  p3_harvest_discipleship: {
    strongRegex:
      /\b(discipleship|member\s+retention|restored\s+membership|spiritual\s+nurtur\w*|nurtur(?:e|ing)\s+(?:believers|members)|small[\s-]+group|member\s+visitation|bible\s+stud(?:y|ies)|baptism\w*|reaping\s+campaign|public\s+evangelis\w*|evangelistic\s+campaign|church\s+plant\w*|new\s+preaching\s+point|bridging\s+event|health\s+expo|sabbath\s+school\s+(?:growth|retention)|mentoring\s+completion)\b/gi,
    focus: 'Proclamation, Harvesting, and Disciple Making',
    objective: 'Proclamation & Harvesting Initiatives',
    objectiveShort: 'Pillar 3 · Objective 6 (Proclamation & Harvesting)',
    defaultKpi: 'retention_nurturing',
  },
  p3_marketing_campaign: {
    strongRegex:
      /\b(global\s+marketing\s+campaign|paid\s+(?:social|digital)\s+ads|meta\s+ads|google\s+ads|billboard|outdoor\s+advertising|ad\s+spend|media\s+buying|brand\s+awareness\s+campaign)\b/gi,
    focus: 'Proclamation, Harvesting, and Disciple Making',
    objective: 'Global Marketing Campaign',
    objectiveShort: 'Pillar 3 · Objective 7 (Global Marketing Campaign)',
    defaultKpi: 'reach_exposure',
  },
};

function countLaneMatches(text: string, regex: RegExp): number {
  if (!text) return 0;
  const matches = text.match(new RegExp(regex.source, 'gi'));
  return matches ? matches.length : 0;
}

/**
 * 2b. Bottom-up "Majority-Intent" analyzer: compares what the proposal body, deliverables,
 * and KPI details actually describe against the selected Pillar/Global Objective.
 * Designed strictly for high-confidence cross-lane mismatches without nagging multi-stage projects.
 */
export function analyzeMajorityIntentAlignment(proposal: Proposal): MajorityIntentAnalysis {
  const emptyResult: MajorityIntentAnalysis = {
    type: null,
    currentLane: null,
    suggestedLane: null,
    corroboratingRegions: [],
    title: '',
    message: '',
    whyItMatters: '',
    pointers: [],
    exampleTemplate: '',
  };

  const canonicalObj = getCanonicalDivisionProject(proposal.divisionProject);
  const currentLane = getStrategicLaneForObjective(canonicalObj);
  if (!canonicalObj || !currentLane) return emptyResult;

  const titleOverviewText = `${proposal.title || ''} ${proposal.overview || ''}`.trim();
  const goalOutcomesText = `${proposal.goal || ''} ${proposal.outcomes || ''}`.trim();
  const deliverablesBudgetText = `${proposal.deliverables || ''} ${(proposal.budgetItems || [])
    .map((b) => b.activity || '')
    .join(' ')}`.trim();
  const kpiDetailsText = `${proposal.kpiDescription || ''} ${proposal.kpiRationale || ''} ${
    proposal.kpiNumber || ''
  }`.trim();

  const substantiveLen =
    (proposal.overview || '').trim().length +
    (proposal.goal || '').trim().length +
    (proposal.deliverables || '').trim().length;
  if (substantiveLen < 80) return emptyResult;

  const regions: Array<{ name: string; text: string }> = [
    { name: 'Title & Overview', text: titleOverviewText },
    { name: 'Goal & Outcomes', text: goalOutcomesText },
    { name: 'Deliverables & Budget', text: deliverablesBudgetText },
    { name: 'KPI Measurement & Rationale', text: kpiDetailsText },
  ];

  const lanes = Object.keys(LANE_SIGNAL_RULES) as StrategicIntentLane[];

  const regionBestLane = regions.map((r) => {
    const scores: Record<StrategicIntentLane, number> = {
      p1_creators_training: countLaneMatches(r.text, LANE_SIGNAL_RULES.p1_creators_training.strongRegex),
      p2_media_production: countLaneMatches(r.text, LANE_SIGNAL_RULES.p2_media_production.strongRegex),
      p2_upg_intelligence: countLaneMatches(r.text, LANE_SIGNAL_RULES.p2_upg_intelligence.strongRegex),
      p3_harvest_discipleship: countLaneMatches(r.text, LANE_SIGNAL_RULES.p3_harvest_discipleship.strongRegex),
      p3_marketing_campaign: countLaneMatches(r.text, LANE_SIGNAL_RULES.p3_marketing_campaign.strongRegex),
    };

    let topLane: StrategicIntentLane | null = null;
    let topScore = 0;
    for (const lane of lanes) {
      if (scores[lane] > topScore) {
        topScore = scores[lane];
        topLane = lane;
      }
    }
    return {
      name: r.name,
      scores,
      topLane,
      topScore,
      currentScore: scores[currentLane],
    };
  });

  // Safety check: if Deliverables+Budget strongly support the current Objective, do NOT suggest changing Objective
  const deliverablesRegion = regionBestLane[2];
  const kpiRegion = regionBestLane[3];
  const currentHasStrongFundedSupport = deliverablesRegion.currentScore >= 2;

  // Extra UPG safeguard: keep Obj 5 when Group E + named UPG details exist alongside evangelism words
  const audiences = proposal.targetAudiences || [];
  const hasGroupE = audiences.some((a) => a === 'E' || a === 'group_e');
  const hasUpgEvidenceAnywhere =
    regionBestLane.some((r) => r.scores.p2_upg_intelligence > 0) ||
    (hasGroupE && (proposal.audienceEDetails || '').trim().length >= 15);

  if (!currentHasStrongFundedSupport) {
    // Evaluate candidate alternate lanes
    let bestAltLane: StrategicIntentLane | null = null;
    let bestSupportingRegions: string[] = [];

    for (const candidate of lanes) {
      if (candidate === currentLane) continue;
      // Do not suggest moving an authentic UPG + Group E project out of Obj 5
      if (
        currentLane === 'p2_upg_intelligence' &&
        candidate === 'p3_harvest_discipleship' &&
        hasUpgEvidenceAnywhere
      ) {
        continue;
      }

      const supporting = regionBestLane.filter(
        (r) => r.scores[candidate] >= 1 && r.scores[candidate] > r.currentScore
      );
      const currentSupportTotal = regionBestLane.reduce((s, r) => s + r.currentScore, 0);
      const delivSupportsAlt = deliverablesRegion.scores[candidate] > deliverablesRegion.currentScore;
      const kpiSupportsAlt = kpiRegion.scores[candidate] > kpiRegion.currentScore;

      const qualifiesHighConfidence =
        (supporting.length >= 3 || (supporting.length >= 2 && delivSupportsAlt && kpiSupportsAlt)) &&
        currentSupportTotal <= 1;

      if (qualifiesHighConfidence && supporting.length > bestSupportingRegions.length) {
        bestAltLane = candidate;
        bestSupportingRegions = supporting.map((s) => s.name);
      }
    }

    if (bestAltLane) {
      const targetMeta = LANE_SIGNAL_RULES[bestAltLane];
      let suggestedKpi: KPIType = targetMeta.defaultKpi;

      // Refine KPI inside Objective 6 (Bridging Event vs. Discipleship/Harvest)
      if (bestAltLane === 'p3_harvest_discipleship') {
        const bridgingCues =
          /\b(bridging\s+event|health\s+expo|family\s+seminar|rsvp|opt-?in\s+referral)\b/i.test(
            `${deliverablesBudgetText} ${kpiDetailsText}`
          );
        const discipleCues =
          /\b(discipleship|member\s+retention|restored\s+membership|small[\s-]+group|bible\s+stud(?:y|ies)|baptism|church\s+plant|mentoring)\b/i.test(
            `${titleOverviewText} ${deliverablesBudgetText} ${kpiDetailsText}`
          );
        if (bridgingCues && !discipleCues) {
          suggestedKpi = 'connection_next_steps';
        }
      }

      const kpiOpt = KPI_OPTIONS.find((k) => k.id === suggestedKpi);
      const suggestedKpiLabel = kpiOpt ? `KPI ${kpiOpt.number} · ${kpiOpt.title}` : '';

      return {
        type: 'objective_mismatch',
        currentLane,
        suggestedLane: bestAltLane,
        suggestedStrategicFocus: targetMeta.focus,
        suggestedDivisionProject: targetMeta.objective,
        suggestedObjectiveLabel: targetMeta.objectiveShort,
        suggestedKpiType: suggestedKpi,
        suggestedKpiLabel,
        corroboratingRegions: bestSupportingRegions,
        title: `Classification Tip: Body Reads Like ${targetMeta.objectiveShort}`,
        message: `Your ${bestSupportingRegions.join(', ')} describe a cohesive "${
          targetMeta.objective
        }" initiative, while "${canonicalObj}" is currently selected above. If this grant directly funds these activities rather than ${canonicalObj}, switching your Objective (and Primary KPI to ${suggestedKpiLabel}) aligns your proposal without rewriting your narrative.`,
        whyItMatters:
          'When a strong project is filed under a different Objective, automated Playbook tips, Union Pathway charts, and Division KPI caps mismeasure your work.',
        pointers: [
          `If your funded activity is really ${targetMeta.objective}, use the 1-click button to update Pillar, Global Objective, and Primary KPI together.`,
          `If you intend to keep "${canonicalObj}", clarify in Section 6 (Deliverables) and Section 5 (Measurement) how this budget specifically funds ${canonicalObj}.`,
        ],
        exampleTemplate: `Suggested revision guidance: Your project goals and KPI details are strong and cohesive, and appear to match ${targetMeta.objectiveShort} with ${suggestedKpiLabel}. Please either re-classify the Global Objective & Primary KPI to match your plan, or clarify how the requested budget directly funds ${canonicalObj}.`,
      };
    }
  }

  // Soft Hybrid Framing Tip (Case C): Title/Audience is A-B or discipleship while Deliverables/Outcomes focus on public harvest
  const hasOnlyAbAudience =
    audiences.length > 0 &&
    audiences.every((a) => a.startsWith('A') || a === 'B');
  const titleSoundsInternalDiscipleship =
    /\b(discipleship|member\s+retention|leadership\s+development|equipping\s+members|youth\s+mobilization)\b/i.test(
      proposal.title || ''
    );
  const deliverablesSoundHarvest =
    /\b(baptism|harvest|reaping|public\s+evangelis|evangelistic\s+series|new\s+believers|preaching\s+points)\b/i.test(
      `${proposal.deliverables || ''} ${proposal.outcomes || ''}`
    );

  if (
    currentLane === 'p2_media_production' &&
    (hasOnlyAbAudience || titleSoundsInternalDiscipleship) &&
    deliverablesSoundHarvest
  ) {
    return {
      type: 'hybrid_framing',
      currentLane,
      suggestedLane: null,
      corroboratingRegions: ['Title & Audience', 'Deliverables & Outcomes'],
      title: 'Hybrid Scope Tip: Clarify Which Stage This Budget Funds',
      message: `Your title/audience highlights church member activation (Groups A–B), while your deliverables emphasize harvesting outcomes under "${canonicalObj}". Add one sentence in Section 2 or Section 8 explaining how member-created media hands off to local harvest teams.`,
      whyItMatters:
        'Clarifying the handoff between member mobilization (Stage 5/Pillar 2) and public harvesting (Pillar 3) helps Liaison reviewers immediately see how the pathway connects.',
      pointers: [
        'Keep your Global Objective aligned with what the requested budget directly pays for.',
        'Note the handoff between creators/members and local harvest teams in Section 8 (Points of Integration).',
      ],
      exampleTemplate:
        'Scope clarity note: This grant directly funds [short-form content production by trained A/B members]; downstream seeker responses are handed off to [Local Hope Care Teams / NDR-IEL] for harvesting and discipleship.',
    };
  }

  return emptyResult;
}

/**
 * 3. Generates Smart Budget Breakdown advisories & contextual clickable tags based on the proposal.
 */
export function getSmartBudgetSuggestions(proposal: Proposal): SmartBudgetAnalysis {
  const items = proposal.budgetItems || [];
  const validItems = items.filter(
    (item) =>
      (item.activity && item.activity.trim().length > 0) ||
      (Number(item.divisionFunding ?? item.gcFunding) || 0) > 0
  );

  const totalRequested = items.reduce(
    (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );

  const existingActivitiesLower = items
    .map((i) => (i.activity || '').toLowerCase().trim())
    .filter(Boolean)
    .join(' | ');

  const canonicalObjective = getCanonicalDivisionProject(proposal.divisionProject);
  const narrativeText = [
    proposal.title,
    proposal.overview,
    proposal.goal,
    proposal.outcomes,
    proposal.deliverables,
    proposal.pointsOfIntegration,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const deliverablesText = (proposal.deliverables || '').toLowerCase();

  const isSingleItem = validItems.length === 1;
  const maxItemAmount = items.reduce(
    (max, item) => Math.max(max, Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );
  const isLumpSumHeavy =
    validItems.length === 2 && totalRequested >= 3000 && maxItemAmount / totalRequested >= 0.85;

  let treasurerWarningTitle: string | null = null;
  let treasurerWarningMessage: string | null = null;

  if (isSingleItem) {
    const singleActivity = validItems[0]?.activity?.trim() || 'your single line item';
    treasurerWarningTitle = 'Treasurer Advisory: Single-Line Budget Detected';
    treasurerWarningMessage = `You currently have only 1 budget item ("${singleActivity}"${
      totalRequested > 0 ? ` — US$${totalRequested.toLocaleString()}` : ''
    }). Union and Division Treasurers require a transparent breakdown of how funds will be spent to achieve your objectives (e.g., logistics, rentals, digital tools, stipends, printing, or services). Click any suggested tag below to itemize your budget.`;
  } else if (isLumpSumHeavy) {
    treasurerWarningTitle = 'Treasurer Tip: Itemize Large Lump-Sum Expenses';
    treasurerWarningMessage = `Over 85% of your requested budget (US$${maxItemAmount.toLocaleString()}) is concentrated in a single line item. Breaking large costs into specific operational categories (e.g., equipment rental, talent stipends, venue, or distribution) speeds up Treasury approval.`;
  }

  const candidatePool: BudgetSuggestionTag[] = [];

  const addCandidate = (
    id: string,
    label: string,
    category: BudgetSuggestionTag['category'],
    checkKeywords: string[],
    reason?: string,
    isFromDeliverables?: boolean
  ) => {
    const alreadyExists = checkKeywords.some((kw) => existingActivitiesLower.includes(kw));
    if (alreadyExists) return;
    if (candidatePool.some((c) => c.id === id)) return;
    candidatePool.push({ id, label, category, reason, isFromDeliverables });
  };

  const missingDeliverableCategories: {
    deliverableKeyword: string;
    suggestedItem: string;
    matchedPhrase?: string;
  }[] = [];

  // ---------------------------------------------------------------------------
  // A. PRINTED MATERIALS / KITS DELIVERABLE CHECK
  // ---------------------------------------------------------------------------
  // Strip negated clauses (e.g. "printed materials are not needed", "no printed booklets", "digital only")
  // and non-print compound words / digital kits before checking for physical print deliverables
  const affirmativePrintDeliverablesText = deliverablesText
    .split(/[\n.;!?]+/)
    .filter((clause) => {
      const c = clause.trim();
      if (!c) return false;
      if (
        /\b(no|not|none|without|zero|neither|never|exclude\w*|excluding|unnecessary|isn't|aren't|won't|don't|doesn't)\b[^,;:]*\b(print\w*|book\w*|tract\w*|brochure\w*|pamphlet\w*|handout\w*|flyer\w*|hardcop\w*|physical\s+material\w*|kit\w*|guide\w*|manual\w*)\b/i.test(
          c
        )
      ) {
        return false;
      }
      if (
        /\b(print\w*|book\w*|tract\w*|brochure\w*|pamphlet\w*|handout\w*|flyer\w*|hardcop\w*|physical\s+material\w*|kit\w*|guide\w*|manual\w*)\b[^,;:]*\b(not\b|no\s+longer|none\b|unnecessary|unneeded|n\/a|digital[\s-]only|100%\s+digital|purely\s+digital|exclusively\s+digital|online[\s-]only|electronic[\s-]only)\b/i.test(
          c
        )
      ) {
        return false;
      }
      return true;
    })
    .join(' ')
    .replace(
      /\b(facebook|macbook\w*|notebook\w*|playbook\w*|audiobook\w*|e-?book\w*|blueprint\w*|footprint\w*|sprint\w*|fingerprint\w*)\b/gi,
      ' '
    )
    .replace(
      /\b(digital|pdf|online|downloadable|electronic|virtual|social\s+media|media|press|brand|branding|pr|production|creator|ui|tool)\s+(?:study\s+|discussion\s+|leader\s+|community\s+)?(guide|guides|kit|kits|book|books|booklet|booklets|manual|manuals|handout|handouts|flyer|flyers|tract|tracts|brochure|brochures|material|materials)\b/gi,
      ' '
    )
    .replace(
      /\b(guide|guides|kit|kits|book|books|booklet|booklets|manual|manuals|handout|handouts|flyer|flyers)\s+(?:in\s+pdf|as\s+pdf|online|for\s+download|digital)\b/gi,
      ' '
    );

  const printDeliverableMatch = affirmativePrintDeliverablesText.match(
    /\b(printed\s+(?:book|books|booklet|booklets|kit|kits|guide|guides|manual|manuals|material|materials|copies|collateral|tracts|flyers|handouts|brochures)|printing|hardcopy|hardcopies|booklet|booklets|tract|tracts|brochure|brochures|pamphlet|pamphlets|handout|handouts|flyer|flyers|print\s+(?:copies|materials|edition|run|production))\b/i
  );

  if (printDeliverableMatch) {
    const matchedPrintPhrase = printDeliverableMatch[0].trim();
    const hasPrintInBudget =
      /\b(print|printing|printed|book|booklet|tract|kit|material|publication|collateral|flyer|brochure|pamphlet|handout|hardcopy|copies|stationery|literature)\b/.test(
        existingActivitiesLower
      );
    if (!hasPrintInBudget) {
      missingDeliverableCategories.push({
        deliverableKeyword: `Printed Materials (${matchedPrintPhrase})`,
        suggestedItem: 'Printing & Evangelistic Materials Production',
        matchedPhrase: matchedPrintPhrase,
      });
    }
    addCandidate(
      'printing_materials',
      'Printing & Evangelistic Materials',
      'materials',
      ['print', 'book', 'tract', 'collateral', 'flyer', 'brochure', 'pamphlet'],
      'Matched from your Deliverables',
      true
    );
  }

  // ---------------------------------------------------------------------------
  // B. WEBSITE / APP / DIGITAL PLATFORM DELIVERABLE CHECK
  // ---------------------------------------------------------------------------
  const affirmativeTechDeliverablesText = deliverablesText
    .split(/[\n.;!?]+/)
    .filter((clause) => {
      const c = clause.trim();
      if (!c) return false;
      if (
        /\b(no|not|none|without|zero|unnecessary|existing)\b[^,;:]*\b(app|website|web\s+page|landing\s+page|portal|software|chatbot|database)\b/i.test(
          c
        )
      ) {
        return false;
      }
      if (
        /\b(app|website|web\s+page|landing\s+page|portal|software|chatbot|database)\b[^,;:]*\b(not\s+(?:needed|required|included)|already\s+exists|already\s+built|unnecessary)\b/i.test(
          c
        )
      ) {
        return false;
      }
      return true;
    })
    .join(' ')
    // Ignore social media / video distribution "platforms"
    .replace(
      /\b(social\s+media|video|streaming|broadcast|distribution|messaging|existing)\s+platform\w*\b/gi,
      ' '
    );

  const techDeliverableMatch = affirmativeTechDeliverablesText.match(
    /\b(mobile\s+app\w*|web\s+app\w*|custom\s+app\w*|website\w*|landing\s+page\w*|web\s+page\w*|registration\s+portal\w*|web\s+portal\w*|chatbot\w*|database\w*)\b/i
  );

  if (techDeliverableMatch) {
    const matchedTechPhrase = techDeliverableMatch[0].trim();
    const hasTechInBudget =
      /\b(app|web|website|landing|portal|qr|hosting|domain|software|subscription|digital|platform|server|cloud|tech|development|design|online|media|campaign)\b/.test(
        existingActivitiesLower
      );
    if (!hasTechInBudget) {
      missingDeliverableCategories.push({
        deliverableKeyword: `Website / Digital Portal (${matchedTechPhrase})`,
        suggestedItem: 'Digital Tools, Hosting & Software Subscriptions',
        matchedPhrase: matchedTechPhrase,
      });
    }
    addCandidate(
      'digital_subscriptions',
      'Digital Tools & Software Subscriptions',
      'digital',
      ['subscription', 'software', 'hosting', 'platform', 'tool', 'landing', 'portal', 'web'],
      'Matched from your Deliverables',
      true
    );
  }

  // ---------------------------------------------------------------------------
  // C. IN-PERSON EVENT / TRAINING / SEMINAR DELIVERABLE CHECK
  // ---------------------------------------------------------------------------
  // Strip negated clauses and digital/web/media phrases where "event", "training", "seminar", or "workshop"
  // refers to a digital registration portal, online webinar, video series, or downloadable kit.
  const affirmativeEventDeliverablesText = deliverablesText
    .split(/[\n.;!?]+/)
    .filter((clause) => {
      const c = clause.trim();
      if (!c) return false;
      if (
        /\b(no|not|none|without|zero|neither|never|exclude\w*|excluding|unnecessary|isn't|aren't|won't|don't|doesn't)\b[^,;:]*\b(event\w*|conference\w*|seminar\w*|camp\w*|summit\w*|workshop\w*|bootcamp\w*|training\w*|festival\w*|crusade\w*|rally|rallies|concert\w*)\b/i.test(
          c
        )
      ) {
        return false;
      }
      if (
        /\b(event\w*|conference\w*|seminar\w*|camp\w*|summit\w*|workshop\w*|bootcamp\w*|training\w*|festival\w*|crusade\w*|rally|rallies|concert\w*)\b[^,;:]*\b(not\b|no\s+longer|none\b|unnecessary|unneeded|n\/a|online[\s-]only|virtual[\s-]only|digital[\s-]only|100%\s+digital)\b/i.test(
          c
        )
      ) {
        return false;
      }
      return true;
    })
    .join(' ')
    // Strip web/digital features like "event registration portals", "event forms", "event calendars", "event pages"
    .replace(
      /\b(event|events|training|seminar|workshop|conference|summit|camp)\s+(registration\w*|portal\w*|page\w*|form\w*|calendar\w*|link\w*|listing\w*|sign-?up\w*|promo\w*|flyer\w*|banner\w*|video\w*|series|episode\w*|reel\w*|short\w*|clip\w*|content|material\w*|manual\w*|guide\w*|kit\w*|template\w*|module\w*|course\w*|app\w*|package\w*|curriculum|outline\w*|preset\w*|resource\w*|download\w*|coverage|recap\w*|highlight\w*)\b/gi,
      ' '
    )
    // Strip online/virtual/digital prefixes before event/training/seminar words
    .replace(
      /\b(online|virtual|digital|web|zoom|livestream\w*|recorded|pre-recorded|video|downloadable|qr-linked|landing\s+page)\s+(?:in-person\s+)?(event\w*|conference\w*|seminar\w*|camp\w*|summit\w*|workshop\w*|bootcamp\w*|training\w*|webinar\w*)\b/gi,
      ' '
    );

  const isMediaProductionObjective =
    canonicalObjective === 'Global Contextualized Media Production' ||
    canonicalObjective === 'Short-Form Content' ||
    canonicalObjective === 'Regional Media Evangelism & Creative Innovation';

  // Require explicit physical/in-person gathering phrases (not bare "event" or bare "training" in a digital project)
  const eventDeliverableRegex = isMediaProductionObjective
    ? /\b(in-person\s+(?:event|events|training|seminar|seminars|workshop|workshops|conference|summit|bootcamp)|onsite\s+(?:event|events|training|seminar|workshop|bootcamp)|evangelistic\s+(?:crusade|crusades|rally|rallies|series|camp)|youth\s+camp\w*|summer\s+camp\w*|camp\s+meeting\w*|public\s+(?:rally|rallies|crusade|festival|concert)|live\s+concert\w*|health\s+expo\w*)\b/i
    : /\b(in-person\s+(?:event|events|training|seminar|seminars|workshop|workshops|conference|summit|bootcamp)|onsite\s+(?:event|events|training|seminar|workshop|bootcamp)|bridging\s+event\w*|community\s+event\w*|outreach\s+event\w*|public\s+event\w*|conference|seminar|seminars|youth\s+camp\w*|camp\s+meeting\w*|summit|workshop|workshops|bootcamp|in-person\s+training|leadership\s+training|field\s+training|festival|crusade|crusades|rally|rallies|concert|concerts|health\s+expo\w*)\b/i;

  const eventDeliverableMatch = affirmativeEventDeliverablesText.match(eventDeliverableRegex);

  if (eventDeliverableMatch) {
    const matchedEventPhrase = eventDeliverableMatch[0].trim();
    const hasEventInBudget =
      /\b(venue|hall|rental|catering|food|meal|refreshment|accommodation|lodging|sound|av\b|equipment|logistics|event|seminar|workshop|training|camp|crusade|rally|concert|expo|hospitality|stage|tent)\b/.test(
        existingActivitiesLower
      );
    if (!hasEventInBudget) {
      missingDeliverableCategories.push({
        deliverableKeyword: `In-Person Event / Gathering (${matchedEventPhrase})`,
        suggestedItem: 'Venue & AV Equipment Rental',
        matchedPhrase: matchedEventPhrase,
      });
    }
    addCandidate(
      'venue_rental',
      'Venue & Audio-Visual Rental',
      'logistics',
      ['venue', 'hall', 'audio', 'av rental'],
      'Matched from your Deliverables',
      true
    );
    addCandidate(
      'hospitality_catering',
      'Participant Meals & Hospitality',
      'logistics',
      ['meal', 'food', 'catering', 'refreshment', 'hospitality'],
      'Matched from your Deliverables',
      true
    );
  }

  // Bridging Event specific budget tags (SSD Bridging Events Guide pp. 9–11)
  const bridgingCtx = detectBridgingProposalContext(proposal);
  if (bridgingCtx.shouldCoachGreeterTraining) {
    addCandidate(
      'bridging_greeter_training',
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'logistics',
      ['welcoming online', 'greeter', 'bridge friend', 'hosting training'],
      'SSD Bridging Guide: Train before you invite'
    );
  }
  if (bridgingCtx.isBridgingHostProposal) {
    addCandidate(
      'bridging_welcome_desk_packs',
      'Welcome Desk Name Tags, Interest Cards & Guest Welcome Packs',
      'materials',
      ['name tag', 'welcome pack', 'interest card', 'welcome desk'],
      'SSD Bridging Guide: Personal welcome & opt-in tracking'
    );
    addCandidate(
      'bridging_next_step_materials',
      'Bridging Event Hospitality & Next-Step Small Group Materials',
      'logistics',
      ['small group material', 'bridging hospitality', 'discovery guide'],
      'SSD Bridging Guide: Next-step continuity'
    );
    if (bridgingCtx.mentionsHealthEvent) {
      addCandidate(
        'bridging_health_passports',
        'Community Health Screening Supplies & Health Passports',
        'materials',
        ['health passport', 'screening', 'medical supply', 'bp monitor'],
        'SSD Bridging Guide: Health & Wellness felt-need event'
      );
    }
  }

  // Objective-specific suggestions
  if (
    canonicalObjective === 'Global Contextualized Media Production' ||
    canonicalObjective === 'Short-Form Content' ||
    /\b(video|videos|film|episode|series|reel|reels|tiktok|short|shorts|podcast|broadcast|studio|documentary)\b/.test(
      narrativeText
    )
  ) {
    addCandidate(
      'prod_equipment',
      'Camera, Lighting & Studio Rental',
      'production',
      ['camera', 'lighting', 'studio', 'equipment']
    );
    addCandidate(
      'post_prod_service',
      'Video Editing & Post-Production Services',
      'personnel',
      ['editing', 'editor', 'post-production', 'post production', 'color', 'sound design']
    );
    addCandidate(
      'creator_stipend',
      'Talent, Host & Crew Stipends',
      'personnel',
      ['stipend', 'talent', 'host', 'crew', 'allowance', 'honorarium']
    );
    addCandidate(
      'translation_subtitling',
      'Contextual Translation, Dubbing & Subtitling',
      'production',
      ['translation', 'dubbing', 'subtitl', 'language']
    );
    addCandidate(
      'editing_subscriptions',
      'Creative Software & Cloud Subscriptions',
      'digital',
      ['subscription', 'adobe', 'cloud', 'software', 'license']
    );
  }

  if (
    canonicalObjective === 'Proclamation & Harvesting Initiatives' ||
    canonicalObjective === 'Proclamation Kits & Contextualized Evangelistic Materials' ||
    /\b(evangelism|harvest|baptism|crusade|small\s+group|bible\s+study|church\s+planting)\b/.test(
      narrativeText
    )
  ) {
    addCandidate(
      'venue_sound_rental',
      'Evangelistic Venue & Sound System Rental',
      'logistics',
      ['venue', 'sound', 'tent', 'chair', 'stage']
    );
    addCandidate(
      'study_guides_kits',
      'Printed Bible Study Guides & Proclamation Kits',
      'materials',
      ['study guide', 'proclamation kit', 'bible', 'lesson', 'print']
    );
    addCandidate(
      'bible_worker_stipend',
      'Bible Worker & Hope Care Team Follow-Up Stipends',
      'personnel',
      ['bible worker', 'stipend', 'volunteer', 'follow-up', 'allowance', 'hope care']
    );
    addCandidate(
      'local_logistics_transport',
      'Local Transport & Field Logistics',
      'logistics',
      ['transport', 'logistics', 'travel', 'fuel', 'freight', 'shipping']
    );
    addCandidate(
      'bridging_hospitality',
      'Bridging Event Hospitality & Refreshments',
      'logistics',
      ['hospitality', 'refreshment', 'food', 'meal', 'catering']
    );
  }

  if (
    canonicalObjective === 'Global Marketing Campaign' ||
    /\b(marketing|ad\s+spend|ads|facebook|meta|youtube|instagram|boost|promotion|billboard|campaign)\b/.test(
      narrativeText
    )
  ) {
    addCandidate(
      'social_ad_spend',
      'Paid Social Media & Digital Ad Boosting (Meta/YouTube/TikTok)',
      'digital',
      ['ad spend', 'boosting', 'meta', 'facebook ad', 'paid media', 'sponsored']
    );
    addCandidate(
      'campaign_landing_crm',
      'HopeStartsHere.asia Landing Page & Referral Routing',
      'digital',
      ['landing page', 'crm', 'whatsapp', 'chatbot', 'automation', 'hopestartshere']
    );
    addCandidate(
      'graphic_creative_services',
      'Campaign Creative Assets & Graphic Design Services',
      'production',
      ['graphic', 'creative', 'banner', 'design']
    );
    addCandidate(
      'digital_missionary_stipend',
      'Digital Missionary & Response Team Support',
      'personnel',
      ['response team', 'digital missionary', 'moderator', 'stipend']
    );
  }

  if (
    canonicalObjective === 'Regional Media Evangelism & Creators Conferences' ||
    /\b(training|conference|creator|workshop|seminar|equip|summit|bootcamp)\b/.test(narrativeText)
  ) {
    addCandidate(
      'conf_venue_av',
      'Conference Venue & AV Technical Setup',
      'logistics',
      ['venue', 'conference', 'av', 'hall']
    );
    addCandidate(
      'speaker_travel',
      'Speaker & Facilitator Travel / Lodging',
      'logistics',
      ['speaker', 'facilitator', 'travel', 'airfare', 'hotel', 'lodging']
    );
    addCandidate(
      'delegate_kits',
      'Participant Training Kits & Playbook Syllabi',
      'materials',
      ['training kit', 'syllabus', 'manual', 'badge', 'lanyard', 'playbook']
    );
    addCandidate(
      'creator_seed_grants',
      'Micro-Production Kits / Creator Seed Tools',
      'production',
      ['microphone', 'tripod', 'seed', 'starter kit']
    );
  }

  if (
    canonicalObjective === 'Mission Intelligence: Reaching Unreached People Groups' ||
    /\b(research|survey|unreached|upg|demographic|assessment|mapping|ethnographic)\b/.test(
      narrativeText
    )
  ) {
    addCandidate(
      'field_survey_logistics',
      'Field Research, Surveys & Focus Group Logistics',
      'research',
      ['survey', 'focus group', 'field research', 'interview']
    );
    addCandidate(
      'data_analytics_tools',
      'Demographic Data & Analytics Subscriptions',
      'digital',
      ['analytics', 'data', 'software', 'mapping']
    );
    addCandidate(
      'cultural_consultant_service',
      'Cultural Contextualization & Research Service Payments',
      'personnel',
      ['consultant', 'researcher', 'service', 'stipend']
    );
  }

  // Universal fallback Treasurer categories
  addCandidate(
    'gen_logistics',
    'Logistics & Local Transportation',
    'logistics',
    ['logistics', 'transport', 'travel']
  );
  addCandidate(
    'gen_rental',
    'Equipment / Facility Rental',
    'logistics',
    ['rental', 'rent', 'venue', 'equipment']
  );
  addCandidate(
    'gen_digital_tools',
    'Digital Tools & Subscriptions',
    'digital',
    ['digital tool', 'subscription', 'software', 'license']
  );
  addCandidate(
    'gen_stipends',
    'Project Stipends & Honoraria',
    'personnel',
    ['stipend', 'honorarium', 'allowance']
  );
  addCandidate(
    'gen_service_payments',
    'Professional & Technical Service Payments',
    'personnel',
    ['service', 'contractor', 'editing', 'production']
  );
  addCandidate(
    'gen_printing_supplies',
    'Printed Materials & Project Supplies',
    'materials',
    ['print', 'supplies', 'materials']
  );

  return {
    isSingleItem,
    isLumpSumHeavy,
    validItemCount: validItems.length,
    totalRequested,
    treasurerWarningTitle,
    treasurerWarningMessage,
    missingDeliverableCategories,
    suggestedTags: candidatePool.slice(0, 8),
  };
}

/**
 * 4. Evaluates OneVoice27 Playbook Golden Rule (Handoff Receiver), Seeker-Ready Churches (NDR-IEL / Hope Care Teams),
 * and Content Repository integration.
 */
export function analyzePlaybookHandoffAndEcosystem(proposal: Proposal): PlaybookEcosystemAnalysis {
  const canonicalObjective = getCanonicalDivisionProject(proposal.divisionProject);
  const canonicalKpi = getCanonicalKpiType(proposal.kpiType);
  const pillarKey = getProposalPillarKey(proposal);
  const bridgingCtx = detectBridgingProposalContext(proposal);

  const combinedDownstreamText = [
    proposal.outcomes,
    proposal.deliverables,
    proposal.pointsOfIntegration,
    proposal.kpiDescription,
    proposal.kpiRationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const hasSubstantiveNarrative =
    (proposal.overview || '').trim().length > 20 ||
    (proposal.outcomes || '').trim().length > 20 ||
    (proposal.deliverables || '').trim().length > 20 ||
    (proposal.pointsOfIntegration || '').trim().length > 10;

  // Distinguish:
  // 1) Pillar 1 internal church member training (NOT promoted on HopeStartsHere.asia)
  // 2) Community in-person outreach / bridging events (Events & opt-in RSVP on HopeStartsHere.asia)
  // 3) Media / kit production & marketing reach (Content Repository + video/ad CTA -> HopeStartsHere.asia)
  const isPillar1Training =
    pillarKey === 'inspiration' ||
    canonicalObjective === 'Regional Media Evangelism & Creators Conferences' ||
    canonicalKpi === 'implementation_capability';

  const isCommunityInPersonEvent =
    !isPillar1Training &&
    (bridgingCtx.isBridgingHostProposal ||
      canonicalKpi === 'connection_next_steps' ||
      canonicalObjective === 'Proclamation & Harvesting Initiatives');

  const handoffMode: PlaybookEcosystemAnalysis['handoffMode'] = isPillar1Training
    ? 'pillar1_training'
    : isCommunityInPersonEvent
    ? 'community_event_rsvp'
    : 'media_content_cta';

  // 1. Playbook Golden Rule Check (pp. 3, 16, 28, 44):
  // - For Community In-Person Events (Pillar 3, KPI 3, or community-service events):
  //   Check for HopeStartsHere.asia Events/RSVP listing OR responder/coordinator handoff.
  // - For Media / Marketing / Reach proposals:
  //   Check for CTA / Digital Missionaries / HopeStartsHere responder route.
  // - Never require public HopeStartsHere.asia event promotion for Pillar 1 training.
  const isMediaOrReachProposal =
    !isPillar1Training &&
    !isCommunityInPersonEvent &&
    (canonicalObjective === 'Global Contextualized Media Production' ||
      canonicalObjective === 'Short-Form Content' ||
      canonicalObjective === 'Proclamation Kits & Contextualized Evangelistic Materials' ||
      canonicalObjective === 'Global Marketing Campaign' ||
      canonicalKpi === 'reach_exposure');

  const hasMediaHandoffKeywords =
    /\b(call\s+to\s+action|cta|responder|response\s+owner|response\s+team|digital\s+missionar|handoff|hand-off|referral|hopestartshere|hope\s+care\s+team|ndr-iel|ndr|local\s+church|follow-up|follow\s+up|bible\s+worker|interest\s+coordinator|bridging)\b/i.test(
      combinedDownstreamText
    );

  const hasCommunityEventRsvpKeywords =
    /\b(hopestartshere|hope\s+starts\s+here)\b/i.test(combinedDownstreamText) &&
    /\b(event|rsvp|register|registration|listing|calendar|bridging|opt-?in|referral|check-?in)\b/i.test(
      combinedDownstreamText
    );

  const hasCommunityResponderKeywords =
    /\b(hopestartshere|rsvp|bridge\s+coordinator|hope\s+care\s+team|ndr-iel|local\s+church|interest\s+coordinator|bible\s+worker)\b/i.test(
      combinedDownstreamText
    );

  const missingGoldenRuleHandoff = Boolean(
    hasSubstantiveNarrative &&
      ((isCommunityInPersonEvent &&
        (!hasCommunityEventRsvpKeywords || !hasCommunityResponderKeywords)) ||
        (isMediaOrReachProposal && !hasMediaHandoffKeywords))
  );

  // 2. Playbook Seeker-Ready Church & NDR-IEL Check (pp. 13–14, 23, 34):
  // For Proclamation & Harvesting or Connect (KPI 3) / Disciple (KPI 4)
  const isHarvestingOrConnectProposal =
    !isPillar1Training &&
    (canonicalObjective === 'Proclamation & Harvesting Initiatives' ||
      canonicalKpi === 'connection_next_steps' ||
      canonicalKpi === 'retention_nurturing' ||
      isCommunityInPersonEvent);

  const hasLocalChurchReceiverKeywords =
    /\b(ndr-iel|ndr|ministerial|hope\s+care\s+team|seeker-ready|seeker\s+ready|interest\s+coordinator|local\s+church|pastor|elder|small\s+group|sabbath\s+school|bible\s+worker|care\s+partner|care\s+team|bridge\s+coordinator)\b/i.test(
      combinedDownstreamText
    );

  const missingLocalChurchReceiver = Boolean(
    hasSubstantiveNarrative &&
      isHarvestingOrConnectProposal &&
      !hasLocalChurchReceiverKeywords &&
      !missingGoldenRuleHandoff
  );

  // 3. Playbook Content Repository Check (pp. 29 & 37):
  // Strictly for Pillar 2 Media/Kit producers — NEVER for in-person community events, KPI 3, or Pillar 1 training.
  const isPillar2ContentProposal =
    !isPillar1Training &&
    !isCommunityInPersonEvent &&
    canonicalKpi !== 'connection_next_steps' &&
    (canonicalObjective === 'Global Contextualized Media Production' ||
      canonicalObjective === 'Short-Form Content' ||
      canonicalObjective === 'Proclamation Kits & Contextualized Evangelistic Materials');

  const hasRepositoryKeywords =
    /\b(content\s+repository|shared\s+repository|onevoice27\s+repository|repository|reusable\s+master|shared\s+hub|all\s+things\s+new|integrated\s+calendar|translation\s+files)\b/i.test(
      `${proposal.deliverables || ''} ${proposal.pointsOfIntegration || ''}`
    );

  const missingRepositoryMention = Boolean(
    isPillar2ContentProposal &&
      (proposal.deliverables || '').trim().length > 20 &&
      !hasRepositoryKeywords
  );

  return {
    handoffMode,
    missingGoldenRuleHandoff,
    goldenRuleTitle: isCommunityInPersonEvent
      ? 'Playbook Events & RSVP Handoff (pp. 9, 13 & 38): List Event on HopeStartsHere.asia'
      : 'Playbook Golden Rule (pp. 3 & 28): Missing Response & Handoff Receiver',
    goldenRuleMessage: isCommunityInPersonEvent
      ? 'For community outreach and in-person bridging events, list the event schedule and opt-in RSVP on HopeStartsHere.asia (respecting Play 7 privacy in sensitive territories) and name the Local Bridge Coordinator, Hope Care Team, or NDR-IEL leader welcoming guests within 48 hours.'
      : 'The OneVoice27 Playbook states: "Never start an activity unless someone is ready to respond and continue the relationship." Because your project creates media or public reach, specify your Call to Action (CTA) and who receives the handoff (e.g., Digital Missionaries, HopeStartsHere.asia, NDR-IEL, or local church Hope Care Teams).',
    goldenRuleSnippet: isCommunityInPersonEvent
      ? 'HopeStartsHere.asia Community Events & RSVP (Playbook pp. 9, 13, 38): Community event details and opt-in RSVP registration are listed on HopeStartsHere.asia (following Play 7 sensitivity safeguards in restricted areas) and routed within 48 hours to named Local Bridge Coordinators and Hope Care Teams.'
      : 'Playbook Handoff Pathway (pp. 3, 28): Every piece of media includes one clear Call to Action routed via HopeStartsHere.asia and Digital Missionaries to named local church receivers (Hope Care Teams / NDR-IEL).',
    missingLocalChurchReceiver,
    localReceiverTitle: 'Playbook Handoff Check (pp. 23 & 34): Name Your Local Receiving Team',
    localReceiverMessage: isCommunityInPersonEvent
      ? 'For Connect, Bridging, and Harvesting events, name the Local Bridge Coordinator, Hope Care Team, Pastor, or NDR-IEL leader receiving consented RSVP referrals from HopeStartsHere.asia.'
      : 'For Connect, Bridging, and Harvesting initiatives, the OneVoice27 Playbook requires preparing Seeker-Ready Churches (Pastor, Interest Coordinator, and Hope Care Team) and coordinating with NDR-IEL / Ministerial to receive referrals.',
    localReceiverSnippet:
      'NDR-IEL, Ministerial & Seeker-Ready Churches (Playbook pp. 23, 34): Naming local church Interest Coordinators and Hope Care Teams to receive consented HopeStartsHere.asia event RSVPs and referrals into small groups and Bible study.',
    missingRepositoryMention,
    repositoryTitle: 'Playbook Content Repository (pp. 29 & 37): Share Reusable Assets',
    repositoryMessage:
      'Playbook Play 6 (p. 37) states that approved media and evangelistic materials should be contributed to the shared OneVoice27 Content Repository (with clear rights and metadata) so local fields across SSD can translate and adapt them.',
    repositorySnippet:
      'Approved master files, translations, and metadata contributed to the shared OneVoice27 Content Repository (Playbook p. 29) and aligned with the "All Things New" 48-week Integrated Calendar.',
  };
}

/**
 * 5. Evaluates Narrative Depth (Sections 2, 3, 4) and Points of Integration (Section 8).
 */
export function analyzeNarrativeDepth(proposal: Proposal): NarrativeDepthAnalysis {
  const overviewSentences = countSentences(proposal.overview);
  const goalSentences = countSentences(proposal.goal);
  const outcomesSentences = countSentences(proposal.outcomes);

  let isGoalOutcomeDuplicate = false;
  const gClean = (proposal.goal || '').trim().toLowerCase();
  const oClean = (proposal.outcomes || '').trim().toLowerCase();
  if (gClean.length > 25 && oClean.length > 25) {
    if (gClean === oClean || gClean.includes(oClean) || oClean.includes(gClean)) {
      isGoalOutcomeDuplicate = true;
    }
  }

  const integrationWords = (proposal.pointsOfIntegration || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const isIntegrationTooVague = integrationWords > 0 && integrationWords < 8;

  return {
    overviewSentences,
    goalSentences,
    outcomesSentences,
    isGoalOutcomeDuplicate,
    isIntegrationTooVague,
  };
}

export interface CategoryEDetailsAnalysis {
  hasUncheckedGroupBMention: boolean;
  uncheckedGroupBTitle: string;
  uncheckedGroupBMessage: string;
  isGenericCategoryE: boolean;
  genericCategoryETitle: string;
  genericCategoryEMessage: string;
}

const WORLD_RELIGION_OR_PEOPLE_GROUP_CUES = [
  'islam',
  'muslim',
  'buddhis',
  'hindu',
  'secular',
  'atheis',
  'agnostic',
  'non-religious',
  'no religion',
  'unaffiliated',
  'animis',
  'indigenous',
  'tribal',
  'traditional religion',
  'folk religion',
  'tao',
  'confucian',
  'sikh',
  'world religion',
  'other religion',
  'people group',
  'frontier',
  'unreached',
  'upg',
  '10/40',
  'language:',
  'primary religion',
  'dialect',
  'malay',
  'javanese',
  'sundanese',
  'balinese',
  'madurese',
  'bugis',
  'minang',
  'acehnese',
  'sasak',
  'banjar',
  'thai',
  'khmer',
  'lao',
  'burmese',
  'bamar',
  'shan',
  'rakhine',
  'mon',
  'vietnamese',
  'kinh',
  'cham',
  'hmong',
  'maranao',
  'maguindanao',
  'tausug',
  'yakans',
  'sama',
  'badjao',
  'sinhala',
  'tamil',
  'urdu',
  'punjabi',
  'pashto',
  'sindhi',
  'baloch',
  'chinese',
  'mandarin',
  'hokkien',
  'cantonese',
];

/**
 * Analyzes Section 7 Category E Details (`audienceEDetails`) for:
 * 1) Mentioning Inactive Adventist Members (Group B) inside the Category E box when Group B is unchecked
 * 2) Pasting a generic A/B/C-E segment list without naming any specific world religion, non-religious group, or cultural/linguistic people group
 */
export function analyzeCategoryEDetails(proposal: Proposal): CategoryEDetailsAnalysis {
  const audiences = proposal.targetAudiences || [];
  const hasGroupE = audiences.includes('E') || audiences.includes('group_e');
  const hasGroupB = audiences.includes('B');
  const rawDetails = (proposal.audienceEDetails || '').trim();
  const lower = rawDetails.toLowerCase();

  if (!hasGroupE || !rawDetails) {
    return {
      hasUncheckedGroupBMention: false,
      uncheckedGroupBTitle: '',
      uncheckedGroupBMessage: '',
      isGenericCategoryE: false,
      genericCategoryETitle: '',
      genericCategoryEMessage: '',
    };
  }

  const mentionsInactiveMembers =
    /\bb\s*[–\-—:]\s*inactive/i.test(rawDetails) ||
    lower.includes('inactive adventist') ||
    lower.includes('inactive church member') ||
    lower.includes('former church member') ||
    lower.includes('former adventist');

  const hasUncheckedGroupBMention = !hasGroupB && mentionsInactiveMembers;

  const hasSpecificCue = WORLD_RELIGION_OR_PEOPLE_GROUP_CUES.some((cue) => lower.includes(cue));
  const looksLikeGenericSegmentTable =
    /\ba\s*[–\-—:]\s*church\s+member/i.test(rawDetails) ||
    (/\bsegment\b/i.test(rawDetails) && /\bselection\b/i.test(rawDetails));

  const isGenericCategoryE = !hasSpecificCue || looksLikeGenericSegmentTable;

  return {
    hasUncheckedGroupBMention,
    uncheckedGroupBTitle: 'Audience Mismatch: Group B (Inactive Members) Listed in Category E Box',
    uncheckedGroupBMessage:
      'Your Category E details describe Inactive Adventist members (Group B), even though Group B is not checked in Section 7. Either check Group B or keep the Category E box focused strictly on non-religious / world-religion people groups.',
    isGenericCategoryE,
    genericCategoryETitle:
      'Category E Specificity Check: Name the World Religion or Non-Religious Group',
    genericCategoryEMessage: looksLikeGenericSegmentTable
      ? 'The Category E box contains a general A–E audience table instead of specific Group E details. Specify which non-religious group or world religion (e.g., Muslim, Buddhist, Hindu, Secular, Traditional), people group, and language this project reaches.'
      : 'Group E is specifically for non-religious groups or other world religions (Playbook p. 8). Please specify the target worldview/religion (e.g., Muslim, Buddhist, Hindu, Secular, Traditional), people group name, and local language.',
  };
}

/**
 * 6. Aggregates all active smart advisories for the top-level Proposal Coach & Review Drawer.
 */
export function getAllProposalSmartAdvisories(
  proposal: Proposal,
  allProposals?: Proposal[]
): SmartAdvisoryItem[] {
  const advisories: SmartAdvisoryItem[] = [];

  // 1. Audience Contradictions
  const audienceCheck = analyzeAudienceContradictions(proposal);
  if (audienceCheck.hasContradiction) {
    const suggestedLabels = audienceCheck.suggestedAudienceIds
      .map((id) => TARGET_AUDIENCE_OPTIONS.find((o) => o.id === id)?.id)
      .filter(Boolean);

    const eslAudienceTitle =
      audienceCheck.type === 'upg_missing_e'
        ? 'Missing Group E in Section 7 (Unreached / World Religions)'
        : audienceCheck.type === 'training_external_only'
        ? 'Audience Mismatch: Pick Church Members Being Trained in Sec 7'
        : 'Audience Mismatch: Pick Public / Non-Adventist Groups in Sec 7';

    const eslAudienceMessage =
      audienceCheck.type === 'upg_missing_e'
        ? 'Your proposal talks about unreached or non-Christian groups, so Group E must be checked in Section 7.'
        : audienceCheck.type === 'training_external_only'
        ? 'Your project trains Adventist leaders or creators, so include Groups A1–A3 or B in Section 7 (not only non-Adventist groups).'
        : 'Your project is about public outreach or seekers, but Section 7 only lists Adventist members. Also select Group C, D, or E.';

    advisories.push({
      id: `aud_${audienceCheck.type}`,
      sectionId: 'section-audience',
      sectionLabel: 'Sec 7 · Audience',
      severity: 'contradiction',
      title: eslAudienceTitle,
      message: eslAudienceMessage,
      whyItMatters:
        'Reviewers compare your story with Section 7 to confirm you selected the actual people your budget serves.',
      pointers:
        audienceCheck.type === 'upg_missing_e'
          ? [
              'Go to Section 7 (Target Audience).',
              'Check Group E and write the specific people group, language, and everyday need.',
            ]
          : audienceCheck.type === 'training_external_only'
          ? [
              'Go to Section 7 (Target Audience).',
              'Check Group A1, A2, A3, or B for the church workers/creators you are training.',
            ]
          : [
              'Go to Section 7 (Target Audience).',
              'Check Group C (Christian neighbors), D (secular/unchurched), or E (other world religions).',
            ],
      exampleTemplate:
        audienceCheck.type === 'upg_missing_e'
          ? 'Group E Details: [People Group Name], Language: [Language], Everyday Need: [e.g., family health & stress relief].'
          : audienceCheck.type === 'training_external_only'
          ? 'Selected Audiences: [A2 · Youth & Young Adults] and [A3 · Ministry Leaders] who will run outreach for [Group D/E].'
          : 'Selected Audiences: [Group D · Secular / Non-Practicing] and [Group C · Other Christians].',
      quickActionLabel:
        suggestedLabels.length === 1
          ? `Add Group ${suggestedLabels[0]}`
          : undefined,
      onQuickActionType: suggestedLabels.length === 1 ? 'add_audience' : undefined,
      payload: {
        audienceIds: audienceCheck.suggestedAudienceIds,
      },
    });
  }

  // 1b. Category E Details Specificity & Unchecked Group B Mismatch
  const catECheck = analyzeCategoryEDetails(proposal);
  if (catECheck.hasUncheckedGroupBMention) {
    advisories.push({
      id: 'aud_cat_e_unchecked_b',
      sectionId: 'section-audience',
      sectionLabel: 'Sec 7 · Audience',
      severity: 'contradiction',
      title: 'Audience Mismatch: Group B Written Inside Group E Box',
      message:
        'You wrote about inactive Adventist members (Group B) inside the Group E box, even though Group B is not checked in Section 7.',
      whyItMatters:
        'Group B is for inactive Adventists; Group E is strictly for unreached or world-religion communities.',
      pointers: [
        'Open Section 7 (Target Audience) and check Group B if you serve inactive members.',
        'Keep the Group E box focused only on non-religious or world-religion people groups.',
      ],
      exampleTemplate:
        'Group E Details: [People Group / Religion, e.g. Local Buddhist Youth], Language: [Language], Need: [Community friendship & English practice].',
      quickActionLabel: 'Add Group B',
      onQuickActionType: 'add_audience',
      payload: {
        audienceIds: ['B'],
      },
    });
  }
  if (catECheck.isGenericCategoryE) {
    advisories.push({
      id: 'aud_cat_e_generic_details',
      sectionId: 'section-audience',
      sectionLabel: 'Sec 7 · Group E Box',
      severity: 'clarity',
      title: 'Add Specific People Group & Language in Group E Box',
      message:
        'You checked Group E, so please name the exact religion/worldview (such as Muslim, Buddhist, Hindu, or Secular), people group, and local language.',
      whyItMatters:
        'Reviewers need clear local details to see how your project fits that specific community safely.',
      pointers: [
        'Scroll to the Group E Details box in Section 7.',
        'Replace any general list with 1 short line naming the people group, religion, language, and need.',
      ],
      exampleTemplate:
        'People Group: [Name] · Worldview: [Muslim / Buddhist / Hindu / Secular] · Language: [Language] · Need: [e.g., parenting & mental peace].',
    });
  }

  // 1c. High-Confidence Majority-Intent Cross-Lane Check (Active/Under-Review proposals only)
  // Safeguard: Skip Step 5 Authorized or Step 4 Recommended proposals so certified records keep clean flag counts.
  const liaisonVotesEarly = Array.isArray(proposal.liaisonVotes) ? proposal.liaisonVotes : [];
  const isAlreadyCertifiedProposal =
    Boolean(proposal.divisionApproval?.authorized) ||
    (liaisonVotesEarly.some((v) => v.vote === 'recommended') &&
      !liaisonVotesEarly.some((v) => v.vote === 'revision_requested'));

  const majorityIntent = !isAlreadyCertifiedProposal
    ? analyzeMajorityIntentAlignment(proposal)
    : {
        type: null,
        currentLane: null,
        suggestedLane: null,
        corroboratingRegions: [],
        title: '',
        message: '',
        whyItMatters: '',
        pointers: [],
        exampleTemplate: '',
      };

  const hasObjectiveReclassSuggestion = majorityIntent.type === 'objective_mismatch';

  if (majorityIntent.type === 'objective_mismatch' && majorityIntent.suggestedDivisionProject) {
    const kpiShortNum = majorityIntent.suggestedKpiLabel
      ? majorityIntent.suggestedKpiLabel.split('·')[0].trim()
      : 'KPI';
    advisories.push({
      id: 'intent_objective_mismatch',
      sectionId: 'section-strategic-focus',
      sectionLabel: 'Sec 1 · Strategic Scope',
      severity: 'clarity',
      title: majorityIntent.title,
      message: majorityIntent.message,
      whyItMatters: majorityIntent.whyItMatters,
      pointers: majorityIntent.pointers,
      exampleTemplate: majorityIntent.exampleTemplate,
      quickActionLabel: `Switch to ${
        majorityIntent.suggestedObjectiveLabel?.includes('Objective 6')
          ? 'Objective 6'
          : majorityIntent.suggestedObjectiveLabel?.includes('Objective 1')
          ? 'Objective 1'
          : majorityIntent.suggestedObjectiveLabel?.includes('Objective 5')
          ? 'Objective 5'
          : majorityIntent.suggestedObjectiveLabel?.includes('Objective 7')
          ? 'Objective 7'
          : 'Suggested Objective'
      } + ${kpiShortNum}`,
      onQuickActionType: 'switch_objective_and_kpi',
      payload: {
        newStrategicFocus: majorityIntent.suggestedStrategicFocus,
        newDivisionProject: majorityIntent.suggestedDivisionProject,
        newKpiType: majorityIntent.suggestedKpiType,
      },
    });
  } else if (majorityIntent.type === 'hybrid_framing') {
    advisories.push({
      id: 'intent_hybrid_framing',
      sectionId: 'section-strategic-focus',
      sectionLabel: 'Sec 1 · Strategic Scope',
      severity: 'suggestion',
      title: majorityIntent.title,
      message: majorityIntent.message,
      whyItMatters: majorityIntent.whyItMatters,
      pointers: majorityIntent.pointers,
      exampleTemplate: majorityIntent.exampleTemplate,
    });
  }

  // 2. Target Goal Clarity
  // (If Majority-Intent already proposes switching both Objective & KPI, suppress duplicate KPI unit nudge to avoid conflicting advice)
  const kpiClarity = analyzeTargetGoalClarity(proposal);
  if (
    kpiClarity.hasWarning &&
    !(hasObjectiveReclassSuggestion && kpiClarity.warningType === 'kpi_unit_mismatch')
  ) {
    const eslKpiTitle =
      kpiClarity.warningType === 'formula_multiplier'
        ? 'Enter One Total Number in Sec 5 Target Goal (Not a Monthly Formula)'
        : kpiClarity.warningType === 'wordy_multi_number'
        ? 'Keep Sec 5 Target Goal Short (1 Total Number Only)'
        : kpiClarity.title || 'Target Goal Does Not Match Selected KPI in Sec 5';

    const eslKpiMessage =
      kpiClarity.warningType === 'formula_multiplier'
        ? `Your Target Goal ("${proposal.kpiNumber}") is written as a rate or formula. Enter just the 1 final total number${
            kpiClarity.suggestedTotalNumber ? ` (${kpiClarity.suggestedTotalNumber})` : ''
          } for the whole project, and explain the breakdown in Metric Details.`
        : kpiClarity.warningType === 'wordy_multi_number'
        ? `Your Target Goal ("${proposal.kpiNumber}") has extra words or multiple numbers. Put just 1 main total number here so the dashboard can add it up cleanly.`
        : kpiClarity.message;

    advisories.push({
      id: `kpi_${kpiClarity.warningType}`,
      sectionId: 'section-5-kpi',
      sectionLabel: 'Sec 5 · Target Goal',
      severity: 'clarity',
      title: eslKpiTitle,
      message: eslKpiMessage,
      whyItMatters:
        kpiClarity.warningType === 'kpi_unit_mismatch'
          ? 'Choosing the KPI that matches what your team actually tracks prevents Division dashboards from mixing passive video views with real people served.'
          : 'The Division Dashboard totals the Target Goal number across all Unions. Words or formulas break the total count.',
      pointers:
        kpiClarity.warningType === 'kpi_unit_mismatch'
          ? [
              'Check your Target Goal number and "How Success is Measured" notes in Section 5.',
              'Make sure the Primary KPI badge matches what those metrics actually measure (views vs. active interactions, events, or discipleship).',
            ]
          : [
              'In Section 5 "Target Goal", type only 1 final number for the whole project.',
              'Move any monthly rates or explanations into the "Metric Details" box right below it.',
            ],
      exampleTemplate: kpiClarity.suggestedTotalNumber
        ? `Target Goal: [${kpiClarity.suggestedTotalNumber}] · Metric Details: [${kpiClarity.suggestedDetailMove || 'Calculated across project months'}].`
        : kpiClarity.warningType === 'kpi_unit_mismatch'
        ? 'Primary KPI: [2. Engagement & Digital Connection or 4. Discipleship & Retention] · Target Goal: [10,000] active participants tracked via enrollment and attendance.'
        : 'Target Goal: [250] · Metric Details: [250 people who opt in and connect with a Hope Care Team].',
      quickActionLabel: kpiClarity.suggestedTotalNumber
        ? `Use "${kpiClarity.suggestedTotalNumber}" as Target Goal`
        : kpiClarity.suggestedKpiSwitchTitle
        ? `Switch to ${kpiClarity.suggestedKpiSwitchTitle}`
        : undefined,
      onQuickActionType: kpiClarity.suggestedTotalNumber
        ? 'apply_calculated_kpi'
        : kpiClarity.suggestedKpiSwitch
        ? 'switch_kpi'
        : undefined,
      payload: {
        newKpiNumber: kpiClarity.suggestedTotalNumber,
        appendKpiDescription: kpiClarity.suggestedDetailMove,
        newKpiType: kpiClarity.suggestedKpiSwitch,
      },
    });
  }

  // 3. Playbook Golden Rule & Handoff Ecosystem Checks
  const playbookCheck = analyzePlaybookHandoffAndEcosystem(proposal);
  if (playbookCheck.missingGoldenRuleHandoff && !hasObjectiveReclassSuggestion) {
    const isEventRsvpMode = playbookCheck.handoffMode === 'community_event_rsvp';
    advisories.push({
      id: 'playbook_golden_rule_handoff',
      sectionId: 'section-integration',
      sectionLabel: 'Sec 8 · Integration',
      severity: 'playbook',
      title: isEventRsvpMode
        ? 'Add HopeStartsHere.asia Events/RSVP & Follow-Up Team in Sec 8'
        : 'Missing Responder: Explain Who Follows Up in Sec 8',
      message: isEventRsvpMode
        ? 'Because your project hosts an in-person community event, explain in Section 8 how guests RSVP on HopeStartsHere.asia (for community outreach, respecting Play 7 safety) and who welcomes them within 48 hours.'
        : 'Your project creates media or public ads, but Section 8 does not say who answers replies or welcomes new contacts.',
      whyItMatters: isEventRsvpMode
        ? 'Listing your community event & opt-in RSVP on HopeStartsHere.asia gives seekers a safe entry door and ensures a named Local Bridge Coordinator contacts every guest within 48 hours.'
        : 'OneVoice27’s Golden Rule: never launch ads or content unless a real team is ready to reply and care for people.',
      pointers: isEventRsvpMode
        ? [
            'Open Section 8 (Points of Integration).',
            'List your community outreach event & opt-in RSVP on HopeStartsHere.asia (never publish guest names or sensitive locations under Play 7).',
            'Name the Local Bridge Coordinator, Hope Care Team, or NDR-IEL pastor receiving signups within 48 hours.',
          ]
        : [
            'Open Section 8 (Points of Integration).',
            'Name your Call to Action (CTA) and who receives contacts (e.g., HopeStartsHere.asia, Digital Missionaries, Hope Care Team).',
          ],
      exampleTemplate: isEventRsvpMode
        ? 'Community event & opt-in RSVP listed on HopeStartsHere.asia (Play 7 safe in sensitive areas); [Local Bridge Coordinator / Hope Care Team] contacts signups within 48h and welcomes them to [church / small group].'
        : 'Every video/ad ends with a CTA to [HopeStartsHere.asia / WhatsApp]; [Digital Missionaries] reply within 48h and pass opt-in contacts to [Local Hope Care Teams].',
      quickActionLabel: isEventRsvpMode
        ? '+ Add Events/RSVP Handoff to Sec 8'
        : '+ Add Playbook Handoff Pathway',
      onQuickActionType: 'append_integration',
      payload: {
        integrationSnippet: playbookCheck.goldenRuleSnippet,
      },
    });
  }

  if (playbookCheck.missingLocalChurchReceiver && !hasObjectiveReclassSuggestion) {
    advisories.push({
      id: 'playbook_local_receiver',
      sectionId: 'section-integration',
      sectionLabel: 'Sec 8 · Integration',
      severity: 'playbook',
      title: 'Name the Local Church Receiving Team in Sec 8',
      message:
        'For bridging or harvesting projects, Section 8 must name the local Pastor, Bridge Coordinator, Hope Care Team, or NDR-IEL leader who receives RSVP referrals.',
      whyItMatters:
        'Interested people stay connected only when a named local church team is ready to welcome them.',
      pointers: [
        'Open Section 8 (Points of Integration).',
        'Name the receiving local churches, Pastors, Hope Care Team, or NDR-IEL coordinator.',
      ],
      exampleTemplate:
        'Consented seeker RSVPs from HopeStartsHere.asia are received by [Name of Local Churches / District Pastor / Hope Care Team / NDR-IEL Coordinator] for personal welcome and Bible study.',
      quickActionLabel: '+ Add NDR-IEL & Hope Care Teams',
      onQuickActionType: 'append_integration',
      payload: {
        integrationSnippet: playbookCheck.localReceiverSnippet,
      },
    });
  }

  if (playbookCheck.missingRepositoryMention && !hasObjectiveReclassSuggestion) {
    advisories.push({
      id: 'playbook_content_repository',
      sectionId: 'section-deliverables',
      sectionLabel: 'Sec 6 · Deliverables',
      severity: 'playbook',
      title: 'Share Reusable Media in the OneVoice27 Library (Sec 6)',
      message:
        'Because this project creates media or study tools, mention in Section 6 that finished master files will be shared in the OneVoice27 Content Repository.',
      whyItMatters:
        'Sharing master files lets other Unions translate and reuse your hard work without paying twice.',
      pointers: [
        'Open Section 6 (Project Deliverables).',
        'Add 1 sentence confirming finished files/templates will be uploaded to the shared Content Repository.',
      ],
      exampleTemplate:
        'Finished [video masters / study guides] with clean translation files will be uploaded to the shared OneVoice27 Content Repository for other Unions to adapt.',
      quickActionLabel: '+ Add Repository to Deliverables',
      onQuickActionType: 'append_deliverable',
      payload: {
        deliverableSnippet: playbookCheck.repositorySnippet,
      },
    });
  }

  // 4. Budget Breakdown Advisories
  const budgetCheck = getSmartBudgetSuggestions(proposal);
  if (budgetCheck.treasurerWarningTitle && budgetCheck.treasurerWarningMessage) {
    advisories.push({
      id: 'budget_single_or_lump',
      sectionId: 'section-budget',
      sectionLabel: 'Sec 9 · Budget',
      severity: 'treasurer',
      title: budgetCheck.isSingleItem
        ? 'Break Down Your 1 Budget Line into Clear Costs in Sec 9'
        : 'Split Large Lump-Sum Budget Line in Sec 9',
      message: budgetCheck.isSingleItem
        ? `You currently have only 1 budget line (${
            budgetCheck.totalRequested > 0 ? `US$${budgetCheck.totalRequested.toLocaleString()}` : 'single item'
          }). Treasurers need to see separate cost lines (for example: venue, materials, travel, ads, or team stipends).`
        : 'Over 85% of your budget is in 1 line item. Split that big amount into 3–4 clear cost lines so Treasurers can review and approve faster.',
      whyItMatters:
        'Union and Division Treasurers cannot approve 1 lump sum—they must see how each part of the grant will be spent.',
      pointers: [
        'Open Section 9 (Budget Plan).',
        'Split the total across 3–5 specific lines (such as venue/AV, printing, digital ads, travel, or trainer stipends).',
      ],
      exampleTemplate:
        '1) [Venue & Sound Rental] — US$[amount] · 2) [Printed Study Guides] — US$[amount] · 3) [Team Travel & Meals] — US$[amount].',
    });
  }

  if (budgetCheck.missingDeliverableCategories.length > 0) {
    const firstMissing = budgetCheck.missingDeliverableCategories[0];
    advisories.push({
      id: 'budget_deliverable_gap',
      sectionId: 'section-budget',
      sectionLabel: 'Sec 9 · Budget',
      severity: 'treasurer',
      title: `Deliverable Not Listed in Budget: ${firstMissing.suggestedItem}`,
      message: firstMissing.matchedPhrase
        ? `Section 6 (Deliverables) promises "${firstMissing.matchedPhrase}", but Section 9 (Budget Plan) has no line paying for it.`
        : `Section 6 (Deliverables) mentions "${firstMissing.deliverableKeyword}", but Section 9 (Budget Plan) has no matching cost line.`,
      whyItMatters:
        'Treasurers check that every promised deliverable in Section 6 has money budgeted in Section 9 (or a note saying it is paid locally).',
      pointers: [
        'Open Section 9 (Budget Plan).',
        `Add a budget line for "${firstMissing.suggestedItem}" (with Division or Local Funding amount).`,
      ],
      exampleTemplate: `Line item: [${firstMissing.suggestedItem}] — Division: US$[amount] / Local: US$[amount].`,
      quickActionLabel: `+ Add "${firstMissing.suggestedItem}"`,
      onQuickActionType: 'add_budget_item',
      payload: {
        budgetActivity: firstMissing.suggestedItem,
      },
    });
  }

  // 5. Narrative Depth / Duplicate Goal vs Outcome
  const narrativeCheck = analyzeNarrativeDepth(proposal);
  if (narrativeCheck.isGoalOutcomeDuplicate) {
    advisories.push({
      id: 'narrative_duplicate_goal_outcome',
      sectionId: 'section-outcomes',
      sectionLabel: 'Sec 4 · Outcomes',
      severity: 'suggestion',
      title: 'Section 3 (Goal) and Section 4 (Outcomes) Say the Same Thing',
      message:
        'Section 3 (Goal) and Section 4 (Outcomes) are almost identical. Section 3 should state what your team will DO; Section 4 should state how PEOPLE change.',
      whyItMatters:
        'Separating activities (Goal) from people-level results (Outcomes) helps reviewers score Q4 and Q5 clearly.',
      pointers: [
        'Open Section 4 (Outcomes).',
        'Rewrite it to describe what participants learn, experience, or join by the end of the project.',
      ],
      exampleTemplate:
        'By project end, [number] [target group] will attend [activity], [number] will pair with a local friend, and [number] will begin weekly Bible studies.',
    });
  }

  // 6. Union Yearbook & Digital/Freedom Territory Intelligence Checks
  const unionIntel = evaluateProposalUnionIntelligence(proposal);
  if (unionIntel) {
    if (
      unionIntel.kpiBenchmark?.status === 'exceeds_capacity' &&
      unionIntel.kpiBenchmark.warningTitle &&
      unionIntel.kpiBenchmark.warningMessage
    ) {
      advisories.push({
        id: 'union_kpi_exceeds_membership',
        sectionId: 'section-5-kpi',
        sectionLabel: 'Sec 5 · Target Goal',
        severity: 'clarity',
        title: `Target Too High for ${unionIntel.profile.acronym} Membership (${unionIntel.profile.membership.toLocaleString()})`,
        message: `You entered a target of trained church members that is larger than ALL ${unionIntel.profile.membership.toLocaleString()} members in ${unionIntel.profile.acronym}. If you meant video views, switch KPI to "1. Reach & Exposure"; otherwise lower the target to a realistic number of trainees (e.g., ${unionIntel.kpiBenchmark.suggestedTarget || '5% of members'}).`,
        whyItMatters:
          'Targets larger than total Union church membership look like a typing mistake or a views-vs-people mix-up.',
        pointers: [
          'Check Section 5 (Primary KPI & Target Goal).',
          'Either switch to KPI 1 (Reach) for public viewers, or set a realistic count of church members you can train.',
        ],
        exampleTemplate: `Target Goal: [${unionIntel.kpiBenchmark.suggestedTarget || '500'}] · Metric Details: Training [number] members across [number] churches in ${unionIntel.profile.acronym}.`,
        quickActionLabel: unionIntel.kpiBenchmark.suggestedTarget
          ? `Set Target to ${unionIntel.kpiBenchmark.suggestedTarget} (5% of Members)`
          : undefined,
        onQuickActionType: unionIntel.kpiBenchmark.suggestedTarget
          ? 'apply_calculated_kpi'
          : undefined,
        payload: {
          newKpiNumber: unionIntel.kpiBenchmark.suggestedTarget,
          appendKpiDescription: `Mobilizing 5% of ${unionIntel.profile.acronym}'s ${unionIntel.profile.membership.toLocaleString()} members across ${unionIntel.profile.churches.toLocaleString()} churches.`,
        },
      });
    }

    if (unionIntel.needsPlay7SafeRouting) {
      advisories.push({
        id: 'union_play7_sensitive_routing',
        sectionId: 'section-integration',
        sectionLabel: 'Sec 8 · Integration',
        severity: 'playbook',
        title: `Safety & Privacy Rule for ${unionIntel.profile.acronym} (Playbook Play 7)`,
        message: `${unionIntel.profile.acronym} includes sensitive territories where public religious promotion carries risk. Explain in Section 8 how contacts are kept private and require clear guest consent.`,
        whyItMatters:
          'Protects local church teams, volunteers, and seekers in sensitive or restricted areas.',
        pointers: [
          'Open Section 8 (Points of Integration).',
          'Explain your gentle felt-need entry (health, family, skills) and confirm contacts move privately 1-on-1 with opt-in consent.',
        ],
        exampleTemplate:
          'Outreach leads with felt needs ([health / family peace / skills]); guests opt in privately via [WhatsApp / Zalo] and meet vetted local Hope Care Teams discreetly.',
        quickActionLabel: '+ Add Play 7 Safe Routing',
        onQuickActionType: 'append_integration',
        payload: {
          integrationSnippet: unionIntel.play7Snippet,
        },
      });
    }

    if (unionIntel.missingLocalPlatformOpportunity) {
      const opp = unionIntel.missingLocalPlatformOpportunity;
      advisories.push({
        id: `union_platform_${opp.countryName.toLowerCase()}`,
        sectionId: 'section-integration',
        sectionLabel: 'Sec 8 · Integration',
        severity: 'suggestion',
        title: `Local App Tip for ${opp.countryName}: Add ${opp.platformName}`,
        message: `In ${opp.countryName}, ${opp.platformName} reaches ${opp.reachLabel}. Adding ${opp.platformName} to Section 8 makes 1-on-1 follow-up much easier for local people.`,
        whyItMatters:
          'Seekers respond much faster when follow-up uses the chat app already on their phone.',
        pointers: [
          'Open Section 8 (Points of Integration).',
          `Add ${opp.platformName} as a 1-on-1 follow-up channel for interested guests.`,
        ],
        exampleTemplate: `Interested contacts connect privately via [${opp.platformName}] with trained Digital Missionaries before meeting a local church friend.`,
        quickActionLabel: `+ Add ${opp.platformName} Pathway`,
        onQuickActionType: 'append_integration',
        payload: {
          integrationSnippet: opp.snippet,
        },
      });
    }
  }

  // 7. SSD Project Review Framework Coaching (Active Drafts, Submitted, Under Review & Step 3 Awaiting Step 4)
  // Safeguard: Skip adding new framework coaching flags to proposals already Step 5 Authorized
  // or already Step 4 Recommended (with no revision requested) so certified records keep clean flag counts.
  const liaisonVotes = Array.isArray(proposal.liaisonVotes) ? proposal.liaisonVotes : [];
  const isAlreadyCertified =
    Boolean(proposal.divisionApproval?.authorized) ||
    (liaisonVotes.some((v) => v.vote === 'recommended') &&
      !liaisonVotes.some((v) => v.vote === 'revision_requested'));

  if (!isAlreadyCertified) {
    const frameworkEval = evaluateProposalReviewFramework(proposal);
    const hasSubstantiveBody =
      (proposal.overview || '').trim().length > 25 ||
      (proposal.outcomes || '').trim().length > 25 ||
      (proposal.deliverables || '').trim().length > 25;

    // 7a. Ethical Community Service & Voluntary Consent Safeguard (Pillar 2B rule)
    if (frameworkEval.serviceSafeguard.status === 'missing_safeguard') {
      advisories.push({
        id: 'framework_service_safeguard',
        sectionId: 'section-integration',
        sectionLabel: 'Sec 8 · Integration',
        severity: 'playbook',
        title: 'Community Service Rule: Free Help & Voluntary Consent in Sec 8',
        message:
          'Your project includes community help (health, food, water, or education). State in Section 8 that help is free for everyone without religious conditions, and spiritual follow-up happens only when guests agree.',
        whyItMatters:
          'SSD policy requires humanitarian help to show genuine love first—never forcing anyone into religious talks.',
        pointers: [
          'Open Section 8 (Points of Integration).',
          'Add 1 sentence confirming free help for all and opt-in consent for pastoral follow-up.',
        ],
        exampleTemplate:
          'All community help is given freely with no religious condition; only guests who give voluntary consent are introduced to a local Hope Care Team or pastor.',
        quickActionLabel: '+ Add Free-Help & Consent Rule',
        onQuickActionType: 'append_integration',
        payload: {
          integrationSnippet: frameworkEval.serviceSafeguard.suggestedIntegrationSnippet,
        },
      });
    }

    // 7b. Primary Pillar vs. Budget Use Concordance ("Tool Maker vs. Tool User")
    if (!frameworkEval.budgetConcordance.isAligned) {
      const isP3Mismatch =
        frameworkEval.budgetConcordance.mismatchType === 'p3_tool_heavy_no_proclamation';
      advisories.push({
        id: 'framework_pillar_budget_concordance',
        sectionId: isP3Mismatch ? 'section-budget' : 'section-strategic-focus',
        sectionLabel: isP3Mismatch ? 'Sec 9 · Budget' : 'Top · Pillar Scope',
        severity: 'treasurer',
        title: isP3Mismatch
          ? 'Pillar 3 Budget Check: Mostly Gear/Media, US$0 for Outreach'
          : 'Pillar 1 Budget Check: Mostly Gear/Media, US$0 for Training',
        message: isP3Mismatch
          ? `${frameworkEval.budgetConcordance.productionAndGearSharePct}% of your budget goes to equipment or media production, with US$0 for public outreach or follow-up. Either add outreach/follow-up costs in Section 9, or switch Strategic Focus at the top to Pillar 2 (Making Tools).`
          : `${frameworkEval.budgetConcordance.productionAndGearSharePct}% of your budget buys gear or production tools with US$0 for worker training. Add training workshop costs in Section 9, or switch to Pillar 2 at the top.`,
        whyItMatters:
          'SSD’s 7-Question Review (Q1) checks whether your money actually pays for the Pillar you chose.',
        pointers: isP3Mismatch
          ? [
              'Option A: Keep Pillar 3 and add budget lines in Section 9 for ads, bridging events, or Bible worker follow-up.',
              'Option B: Scroll to the top and switch Strategic Focus from Pillar 3 to Pillar 2 (Bold Initiatives).',
            ]
          : [
              'Option A: Add training venue, facilitator, or syllabus lines in Section 9.',
              'Option B: Scroll to the top and switch Strategic Focus from Pillar 1 to Pillar 2.',
            ],
        exampleTemplate: isP3Mismatch
          ? 'Section 9 Budget line: [Local Church Bridging Event & Hope Care Follow-Up] — US$[amount].'
          : 'Section 9 Budget line: [Creator & Digital Missionary Training Workshop] — US$[amount].',
        quickActionLabel: isP3Mismatch
          ? '+ Add Outreach Follow-Up Line'
          : undefined,
        onQuickActionType: isP3Mismatch ? 'add_budget_item' : undefined,
        payload: isP3Mismatch
          ? {
              budgetActivity: 'Local Church Bridging & Hope Care Follow-Up Support',
            }
          : undefined,
      });
    }

    // 7c. Verifiable Person-Centered Stage Output vs. Passive Impressions (Q5)
    if (frameworkEval.hasPassiveOnlyStageMetric && frameworkEval.passiveMetricGuidance) {
      advisories.push({
        id: 'framework_passive_output_check',
        sectionId: 'section-outcomes',
        sectionLabel: 'Sec 4 · Outcomes',
        severity: 'clarity',
        title: 'Count Real People Taking Action (Not Just Views or Attendance)',
        message:
          'You chose an Engage/Connect/Disciple KPI, but your target only counts views or event headcount. Add real people outcomes in Section 4 (e.g., two-way chats, opt-in requests, or Bible study participants).',
        whyItMatters:
          'SSD Q5 checks real human connection and next steps—not only passive views.',
        pointers: [
          'Open Section 4 (Outcomes) and Section 5 (Metric Details).',
          'State how many real people respond, get paired with a friend, or join a small group.',
        ],
        exampleTemplate:
          'Outcome: [Number] people message back with an opt-in request and connect 1-on-1 with a local [Hope Care Team / small group].',
        quickActionLabel: '+ Add People-Centered Outcome',
        onQuickActionType: 'append_outcomes',
        payload: {
          outcomesSnippet:
            'Verifiable stage outcome: Tracked two-way seeker responses and consented handoffs into named local church Hope Care Teams / small groups (beyond passive impressions or attendance).',
        },
      });
    }

    // 7d. Post-Project Continuity & Local Sustaining Partner (Q7)
    const q7Item = frameworkEval.questions.find((q) => q.key === 'q7_continuity');
    const alreadyHasHandoffAdvisory = advisories.some(
      (a) => a.id === 'playbook_golden_rule_handoff' || a.id === 'playbook_local_receiver'
    );
    if (
      hasSubstantiveBody &&
      q7Item?.status === 'needs_work' &&
      !alreadyHasHandoffAdvisory
    ) {
      const continuitySnippet =
        frameworkEval.subType === 'p2_community_service'
          ? 'Continuity & Sustainability (Q7): Local church/community partners sustain ongoing wellness service regardless of religious response, while local Hope Care Teams nurture consenting referrals.'
          : frameworkEval.pillarTrack === 'pillar_1_2'
          ? 'Continuity & Scheduled Utilization (Q7): Receiving field/church teams deploy these trained workers and shared tools on the 48-week OneVoice27 schedule with ongoing mentoring.'
          : 'Continuity & Local Nurture (Q7): Local pastors, Sabbath School small groups, and Hope Care Teams sustain weekly Bible study, baptismal nurture, and new-believer multiplication beyond the campaign.';
      advisories.push({
        id: 'framework_continuity_plan',
        sectionId: 'section-integration',
        sectionLabel: 'Sec 8 · Integration',
        severity: 'playbook',
        title: 'Add Ongoing Follow-Up Plan in Sec 8 (What Happens Next)',
        message: q7Item.evidenceOrGapNote,
        whyItMatters:
          'SSD Q7 checks that people and tools keep growing after the funded event or workshop ends.',
        pointers: [
          'Open Section 8 (Points of Integration).',
          frameworkEval.pillarTrack === 'pillar_1_2'
            ? 'Explain the weekly or monthly schedule on which trained teams will keep using these skills/tools.'
            : 'Explain the weekly small group, Sabbath School, or Bible study that cares for people after the event.',
        ],
        exampleTemplate:
          frameworkEval.pillarTrack === 'pillar_1_2'
            ? 'After the grant ends, [Mission/Church Teams] use these tools [weekly/monthly] with quarterly coaching check-ins.'
            : 'After the event, local [Pastors & Hope Care Teams] welcome guests into weekly [small groups / Bible studies] and mentor them for 6–12 months.',
        quickActionLabel: '+ Add Continuity Plan',
        onQuickActionType: 'append_integration',
        payload: {
          integrationSnippet: continuitySnippet,
        },
      });
    }

    // 8. SSD Bridging Events Guide Coaching (48h Follow-Up, 2-hr Greeter Training, Country Sensitivity/Privacy, 8-Metric Funnel)
    const bridgingCtx = detectBridgingProposalContext(proposal);
    const proposalPillarKey = getProposalPillarKey(proposal);
    if (
      hasSubstantiveBody &&
      (bridgingCtx.isBridgingContext || bridgingCtx.supportsBridgingDownstream)
    ) {
      const territoryGuidance = getBridgingGuidanceForUnion(proposal.union);

      // 8a. 48-Hour Follow-Up, 1:1 Bridge Friend & Pre-Scheduled Next Date ("No Dead-End Event")
      // Only fires when THIS proposal itself hosts an in-person bridging/connection event (not Pillar 2 media producers or Pillar 1 trainers).
      if (
        bridgingCtx.isBridgingHostProposal &&
        (!bridgingCtx.hasFollowUpAnd48h ||
          !bridgingCtx.hasBridgeFriendOrCoordinator ||
          !bridgingCtx.hasPreScheduledNextStep)
      ) {
        const missingParts: string[] = [];
        if (!bridgingCtx.hasFollowUpAnd48h) missingParts.push('48-hour call before & after');
        if (!bridgingCtx.hasBridgeFriendOrCoordinator)
          missingParts.push('1:1 Bridge Friend & Local Bridge Coordinator');
        if (!bridgingCtx.hasPreScheduledNextStep)
          missingParts.push('a pre-scheduled "Next Date" invite');

        advisories.push({
          id: 'bridging_48h_followup_pathway',
          sectionId: 'section-integration',
          sectionLabel: 'Sec 8 · Integration',
          severity: 'playbook',
          title: 'Bridging Pathway Needed in Sec 8 (No Dead-End Event)',
          message: `The goal is a real relationship, not just a 1-day event. Add ${missingParts.join(
            ', '
          )} in Section 8 so online guests feel welcomed and have a clear next step.`,
          whyItMatters:
            'Most online guests never return if nobody greets them personally or invites them to a specific next gathering.',
          pointers: [
            'Open Section 8 (Points of Integration).',
            'Include 48-hour follow-up, 1:1 Bridge Friend pairing, and a scheduled Next Date (e.g., Friendship Lunch or Small Group).',
          ],
          exampleTemplate:
            'A Local Bridge Coordinator contacts signups within 48h, pairs each guest 1:1 with a Bridge Friend, follows up within 48h after the event, and invites them to [Next Date small group / Sabbath Friendship Lunch].',
          quickActionLabel: '+ Add 48h Bridge Friend & Next-Step',
          onQuickActionType: 'append_integration',
          payload: {
            integrationSnippet:
              'Bridging Follow-Up System: A named Local Bridge Coordinator oversees contact within 48 hours of online registration and 48 hours post-event, pairing each guest 1:1 with an age/gender/language-matched Bridge Friend and offering a pre-scheduled Next Date (small group, class, or Sabbath Friendship Lunch) on the day.',
          },
        });
      }

      // 8b. "Train Before You Invite" — 2-Hour Welcoming Online Guests Training
      // Belongs in Pillar 1 (Training & Enabling) or Pillar 3 / explicit bridging hosts — NEVER Pillar 2 media/content tool-makers.
      if (bridgingCtx.shouldCoachGreeterTraining && !bridgingCtx.hasGreeterTraining) {
        const isPillar1 = proposalPillarKey === 'inspiration';
        advisories.push({
          id: 'bridging_train_before_invite',
          sectionId: 'section-deliverables',
          sectionLabel: 'Sec 6 · Deliverables',
          severity: 'playbook',
          title: isPillar1
            ? 'Include 2-Hour "Welcoming Online Guests" Training in Sec 6'
            : 'Add 2-Hour "Welcoming Online Guests" Pre-Event Training in Sec 6',
          message: isPillar1
            ? 'Pillar 1 is the primary home for preparing church hosts. Add a 2-hour "Welcoming Online Guests" training module in Section 6 so local church greeters and Bridge Friends are ready before invitations launch.'
            : 'Before launching invitations for your bridging event, confirm church greeters complete a short 2-hour training (or connect with a Pillar 1 training) so first-time online guests feel warmly welcomed.',
          whyItMatters:
            'Unprepared church teams can accidentally overwhelm first-time secular or non-Christian guests.',
          pointers: [
            'Open Section 6 (Project Deliverables).',
            isPillar1
              ? 'Include the 2-hour "Welcoming Online Guests" training module for local church greeters and Bridge Friends.'
              : 'Add the 2-hour "Welcoming Online Guests" readiness session for hosting church greeters before invitations start.',
          ],
          exampleTemplate:
            'Conduct a 2-hour "Welcoming Online Guests" training for [number] church greeters and Bridge Friends before launching online invitations.',
          quickActionLabel: '+ Add 2-Hr Greeter Training',
          onQuickActionType: 'append_deliverable',
          payload: {
            deliverableSnippet:
              'Conduct 2-hour "Welcoming Online Guests" pre-event training equipping local church greeters and 1:1 Bridge Friends before invitations launch.',
          },
        });
      }

      // 8c. Country Legal Sensitivity, Restricted-Access & Data Privacy Opt-In Guardrail
      const needsPrivacyOrSafetyGuard =
        (bridgingCtx.isBridgingContext &&
          territoryGuidance.isRestrictedOrSensitive &&
          (bridgingCtx.hasPublicExposureRiskText || !bridgingCtx.hasPrivacyOptInConsent)) ||
        (bridgingCtx.usesOnlineLeadHandoff && !bridgingCtx.hasPrivacyOptInConsent);

      if (needsPrivacyOrSafetyGuard) {
        const countryLabel =
          territoryGuidance.canonicalUnion && territoryGuidance.countries.length > 0
            ? territoryGuidance.countries.join(', ')
            : 'SSD Territories';
        const restrictedNote = territoryGuidance.isRestrictedOrSensitive
          ? ' Also state that guest names, photos, and locations will never be posted publicly.'
          : '';
        advisories.push({
          id: 'bridging_country_privacy_guardrail',
          sectionId: 'section-integration',
          sectionLabel: 'Sec 8 · Integration',
          severity: 'playbook',
          title: `Guest Privacy & Consent Check (${countryLabel}) in Sec 8`,
          message: `When passing online signups to local churches, confirm guests check an opt-in consent box under ${territoryGuidance.privacyLawsSummary}.${restrictedNote}`,
          whyItMatters:
            'Protects guest privacy laws and keeps local church workers safe when contacting online leads.',
          pointers: [
            'Open Section 8 (Points of Integration).',
            'Write that signups opt in before sharing details only with the Local Bridge Coordinator.',
          ],
          exampleTemplate: `Digital signups give clear opt-in consent under ${territoryGuidance.privacyLawsSummary}; details are shared only with the Local Bridge Coordinator, and guest names or photos are never published.`,
          quickActionLabel: '+ Add Privacy & Consent Rule',
          onQuickActionType: 'append_integration',
          payload: {
            integrationSnippet: `Data Privacy & Safety Safeguard (${countryLabel}): Digital signups use explicit opt-in consent ("I would like to be contacted by a church community near me") under ${territoryGuidance.privacyLawsSummary}; contact data is shared strictly need-to-know with the Local Bridge Coordinator, and guest names, photos, or locations are never published.`,
          },
        });
      }

      // 8d. 8-Metric Bridging Funnel vs. Raw Attendance Headcount
      if (bridgingCtx.isBridgingHostProposal && bridgingCtx.mentionsVanityHeadcountOnly) {
        advisories.push({
          id: 'bridging_funnel_metrics',
          sectionId: 'section-outcomes',
          sectionLabel: 'Sec 4 · Outcomes',
          severity: 'clarity',
          title: 'Track Guest Connection & 30-Day Return in Sec 4 (Not Just Crowd Size)',
          message:
            'Counting only big crowd size does not show relationship impact. Add how many guests get a 1:1 Bridge Friend within 48h and how many return to a 2nd activity within 30 days.',
          whyItMatters:
            '15 guests who each make a church friend matter more than 300 guests who leave without follow-up.',
          pointers: [
            'Open Section 4 (Outcomes).',
            'Add tracking for 48-hour Bridge Friend pairing (%) and 30-day return into a small group (%).',
          ],
          exampleTemplate:
            'Track the Bridging Funnel: [80%] of online guests paired with a Bridge Friend within 48h, and [40%] joining a 2nd small-group activity within 30 days.',
          quickActionLabel: '+ Add 8-Indicator Funnel',
          onQuickActionType: 'append_outcomes',
          payload: {
            outcomesSnippet:
              '8-Indicator Bridging Funnel: Track Reach, Response (% attended), 48-hour 1:1 Bridge Friend Connection (%), 30-day Continuation into a 2nd small-group activity (%), Spiritual Interest, 3- & 6-month Sabbath Belonging, Fruit, and active Bridge Friends mobilized.',
          },
        });
      }
    }

    // 9. Union-Wide 5-Stage Mission Pathway Alignment Coaching
    const unionPathway = analyzeUnionMissionPathway(proposal, allProposals);
    const integrationLower = (proposal.pointsOfIntegration || '').toLowerCase();
    const alreadyHasSec8HandoffFlag = advisories.some(
      (a) =>
        a.id === 'playbook_golden_rule_handoff' ||
        a.id === 'playbook_local_receiver' ||
        a.id === 'bridging_48h_followup_pathway'
    );
    const hasExplicitLocalReceiverInSec8 =
      /\b(hope\s+care\s+team\w*|local\s+church\w*|pastor\w*|ndr-iel|bridge\s+coordinator\w*|small\s+group\w*|sabbath\s+school|digital\s+missionar\w*)\b/i.test(
        integrationLower
      );

    if (
      hasSubstantiveBody &&
      unionPathway.hasUnion &&
      unionPathway.currentStageNumber > 0 &&
      unionPathway.otherUnionProposalsCount > 0
    ) {
      if (
        (unionPathway.pathwayDiagnosisType === 'missing_downstream_stage' ||
          unionPathway.pathwayDiagnosisType === 'missing_middle_gap') &&
        unionPathway.missingNextStageLabel &&
        !alreadyHasSec8HandoffFlag &&
        (!hasExplicitLocalReceiverInSec8 || integrationLower.trim().length < 85)
      ) {
        advisories.push({
          id: 'union_pathway_downstream_gap',
          sectionId: 'section-integration',
          sectionLabel: 'Sec 8 · Integration',
          severity: 'playbook',
          title: `${unionPathway.unionAcronym} Pathway Gap: No ${unionPathway.missingNextStageLabel} Proposals Yet`,
          message: unionPathway.fitExplanation,
          whyItMatters:
            'Because your Union has no separate funded project at the next stage yet, Section 8 must show how your own team or local churches bridge people forward.',
          pointers: [
            'Open Section 8 (Points of Integration).',
            `Name the Digital Missionaries, Hope Care Teams, or local pastors who cover ${unionPathway.missingNextStageLabel} directly.`,
          ],
          exampleTemplate: unionPathway.suggestedSec8Snippet,
          quickActionLabel: unionPathway.suggestedSec8ActionLabel,
          onQuickActionType: 'append_integration',
          payload: {
            integrationSnippet: unionPathway.suggestedSec8Snippet,
          },
        });
      } else if (
        unionPathway.sameObjectivePeers.length >= 2 &&
        integrationLower.trim().length < 140 &&
        !/\b(coordinat\w*|complement\w*|distinct|avoid\s+duplicat\w*|language|region|conference|mission|peer)\b/i.test(
          integrationLower
        )
      ) {
        advisories.push({
          id: 'union_pathway_overlap_coord',
          sectionId: 'section-integration',
          sectionLabel: 'Sec 8 · Integration',
          severity: 'suggestion',
          title: `Coordinate With ${unionPathway.sameObjectivePeers.length} Similar ${unionPathway.unionAcronym} Proposals in Sec 8`,
          message: `${unionPathway.sameObjectivePeers.length} other proposals in ${unionPathway.unionAcronym} also target "${unionPathway.currentObjective}". Briefly note in Section 8 how your languages, territory, or local audiences complement them.`,
          whyItMatters:
            'Reviewers compare proposals inside each Union to make sure funds do not duplicate the same audience or content.',
          pointers: [
            'Check the Union 5-Stage Mission Pathway strip at the top to see peer projects.',
            'Add 1 sentence in Section 8 explaining your distinct area, language, or shared teamwork.',
          ],
          exampleTemplate: unionPathway.suggestedSec8Snippet,
          quickActionLabel: unionPathway.suggestedSec8ActionLabel,
          onQuickActionType: 'append_integration',
          payload: {
            integrationSnippet: unionPathway.suggestedSec8Snippet,
          },
        });
      }
    }
  }

  return advisories;
}

export interface SectionAlignmentSummary {
  allAdvisories: SmartAdvisoryItem[];
  bySection: Record<string, SmartAdvisoryItem[]>;
  isKpiMisaligned: boolean;
  allowedKpiLabels: string[];
  selectedKpiLabel: string;
}

/**
 * 7. Groups all Alignment Flags (including Objective-to-KPI mismatch) by exact sectionId
 * so both the Executive Summary and Standard Form can highlight flagged sections inline.
 */
export function getSectionAlignmentAdvisories(
  proposal: Proposal,
  allProposals?: Proposal[]
): SectionAlignmentSummary {
  const smartAdvisories = getAllProposalSmartAdvisories(proposal, allProposals);
  const canonicalProject = getCanonicalDivisionProject(proposal.divisionProject);
  const objectiveKey = canonicalProject || proposal.divisionProject;

  const isKpiMisaligned = Boolean(
    objectiveKey &&
      proposal.kpiType &&
      !isKpiAlignedWithObjective(objectiveKey, proposal.kpiType)
  );

  const selectedKpiLabel =
    KPI_OPTIONS.find((k) => k.id === proposal.kpiType)?.title || proposal.kpiType || '';
  const allowedIds = objectiveKey ? getAllowedKPIsForObjective(objectiveKey) : [];
  const allowedKpis = KPI_OPTIONS.filter((k) => allowedIds.includes(k.id));
  const allowedKpiLabels = allowedKpis.map((k) => k.title);

  const allAdvisories: SmartAdvisoryItem[] = [];

  if (isKpiMisaligned) {
    allAdvisories.push({
      id: 'kpi_objective_mismatch',
      sectionId: 'section-5-kpi',
      sectionLabel: 'Sec 5 · Primary KPI',
      severity: 'contradiction',
      title: `Primary KPI Does Not Match "${objectiveKey}"`,
      message: `You chose "${selectedKpiLabel}", but "${objectiveKey}" uses: ${
        allowedKpiLabels.join(' or ') || 'an aligned KPI'
      }. Pick the matching KPI card below.`,
      whyItMatters:
        'Your Primary KPI must match the Global Objective selected at the top of the form so Division reports track the right results.',
      pointers: [
        'Look at the Primary KPI cards in Section 5.',
        allowedKpiLabels.length > 0
          ? `Select ${allowedKpiLabels.join(' or ')}.`
          : 'Select the highlighted matching KPI card.',
      ],
      ...(allowedKpis.length === 1
        ? {
            quickActionLabel: `Switch to ${allowedKpis[0].number}. ${allowedKpis[0].title}`,
            onQuickActionType: 'switch_kpi' as const,
            payload: { newKpiType: allowedKpis[0].id },
          }
        : {}),
    });
  }

  for (const adv of smartAdvisories) {
    allAdvisories.push(adv);
  }

  const bySection: Record<string, SmartAdvisoryItem[]> = {};
  for (const adv of allAdvisories) {
    if (!bySection[adv.sectionId]) {
      bySection[adv.sectionId] = [];
    }
    bySection[adv.sectionId].push(adv);
  }

  return {
    allAdvisories,
    bySection,
    isKpiMisaligned,
    allowedKpiLabels,
    selectedKpiLabel,
  };
}

