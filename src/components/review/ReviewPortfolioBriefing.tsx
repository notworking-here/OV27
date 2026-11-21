import React, { useState, useMemo } from 'react';
import {
  Proposal,
  ReviewCriterionKey,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getCanonicalDivisionProject,
  getCanonicalKpiType,
  isKpiAlignedWithObjective,
} from '../../types';
import { getAllProposalSmartAdvisories } from '../../utils/proposalSmartAdvisor';
import {
  evaluateProposalReviewFramework,
  PillarSubType,
  PILLAR_SUBTYPE_LABELS,
  REVIEW_FRAMEWORK_PDF_URL,
} from '../../utils/projectReviewFramework';
import { parseKpiTargetNumber, formatMetricCount } from '../../utils/kpiExtraction';
import { formatCurrency } from '../../utils/userUtils';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  BookOpen,
  Users,
  Target,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  ArrowRight,
  ArrowDown,
  Layers,
  Globe,
  PieChart,
  TrendingUp,
  Flag,
  ClipboardCheck,
  ExternalLink,
} from 'lucide-react';

import {
  getUnionIntelligence,
  UNION_INTELLIGENCE_PROFILES,
  SSD_DIVISION_YEARBOOK_TOTALS,
  UnionIntelligenceProfile,
} from '../../data/unionIntelligence';
import { UnionIntelligenceBanner } from '../proposal/UnionIntelligenceBanner';

export type CoachingFilterCategory =
  | 'all'
  | 'all_flagged'
  | 'readiness_meeting'
  | 'readiness_needs_improvement'
  | 'readiness_not_fitting'
  | 'gap_q1'
  | 'gap_q2'
  | 'gap_q3'
  | 'gap_q4'
  | 'gap_q5'
  | 'gap_q6'
  | 'gap_q7'
  | 'safeguard_service'
  | 'pillar_budget_mismatch'
  | 'subtype_p1_enabling'
  | 'subtype_p2_tools'
  | 'subtype_p2_service'
  | 'subtype_p3_proclamation'
  | 'frontline_rebalance'
  | 'single_line_budget'
  | 'playbook_handoff'
  | 'sensitive_play7'
  | 'audience_contradiction'
  | 'kpi_clarity'
  | 'stage_1'
  | 'stage_2'
  | 'stage_3'
  | 'stage_4'
  | 'stage_5'
  | 'integration_hopestartshere'
  | 'integration_digital_missionaries'
  | 'integration_hope_care'
  | 'integration_hope_channel'
  | 'integration_awr'
  | 'integration_publishing_comm'
  | 'integration_ndr_ministerial'
  | 'integration_sspm'
  | 'integration_health_adra'
  | 'integration_youth_education'
  | 'integration_amr_mission'
  | 'integration_siloed'
  | 'any_advisory';

export interface ReviewPortfolioBriefingProps {
  proposals: Proposal[];
  selectedUnion: string;
  activeCoachingFilter: CoachingFilterCategory;
  activeCoachingLabel?: string;
  activeMatchingIds?: Set<string>;
  onSelectCoachingFilter: (
    category: CoachingFilterCategory,
    matchingIds: Set<string>,
    label: string,
    options?: { scrollToTable?: boolean }
  ) => void;
  onJumpToTable?: () => void;
  onInspectProposal: (proposalId: string, initialTab?: 'financials' | 'narrative' | 'kpis' | 'notes') => void;
}

function getProposalBudgetTotal(p: Proposal): number {
  return (p.budgetItems || []).reduce(
    (sum, item) =>
      sum + (Number(item.divisionFunding ?? item.gcFunding) || 0) + (Number(item.localFunding) || 0),
    0
  );
}

const STAGE_DEFINITIONS = [
  {
    kpiId: 'reach_exposure',
    filterKey: 'stage_1' as CoachingFilterCategory,
    stageNum: 1,
    shortName: 'Reach',
    unitLabel: 'views/reach',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
    activeRingClass: 'ring-2 ring-sky-600 bg-sky-50/90 border-sky-400',
    barClass: 'bg-sky-500',
  },
  {
    kpiId: 'engagement_participation',
    filterKey: 'stage_2' as CoachingFilterCategory,
    stageNum: 2,
    shortName: 'Engage',
    unitLabel: 'contacts/inquiries',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    activeRingClass: 'ring-2 ring-indigo-600 bg-indigo-50/90 border-indigo-400',
    barClass: 'bg-indigo-500',
  },
  {
    kpiId: 'connection_next_steps',
    filterKey: 'stage_3' as CoachingFilterCategory,
    stageNum: 3,
    shortName: 'Connect',
    unitLabel: 'bridging guests',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    activeRingClass: 'ring-2 ring-purple-600 bg-purple-50/90 border-purple-400',
    barClass: 'bg-purple-500',
  },
  {
    kpiId: 'retention_nurturing',
    filterKey: 'stage_4' as CoachingFilterCategory,
    stageNum: 4,
    shortName: 'Disciple',
    unitLabel: 'studies/baptisms',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    activeRingClass: 'ring-2 ring-emerald-600 bg-emerald-50/90 border-emerald-400',
    barClass: 'bg-emerald-500',
  },
  {
    kpiId: 'implementation_capability',
    filterKey: 'stage_5' as CoachingFilterCategory,
    stageNum: 5,
    shortName: 'Multiply',
    unitLabel: 'leaders equipped',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    activeRingClass: 'ring-2 ring-amber-600 bg-amber-50/90 border-amber-400',
    barClass: 'bg-amber-500',
  },
] as const;

interface IntegrationPartnerDef {
  id: CoachingFilterCategory;
  shortName: string;
  fullName: string;
  roleHint: string;
  layer: 'spine' | 'media' | 'department';
  pattern: RegExp;
  barClass: string;
  activeRingClass: string;
}

const INTEGRATION_PARTNER_DEFINITIONS: IntegrationPartnerDef[] = [
  // Layer 1: Core Playbook Handoff Spine
  {
    id: 'integration_hopestartshere',
    shortName: 'HopeStartsHere.asia Hub (Shared Library & Calendar)',
    fullName: 'HopeStartsHere.asia Hub, Shared Content Library & "All Things New" Calendar',
    roleHint: 'Main SSD link: seeker sign-ups, shared files & 48-week calendar',
    layer: 'spine',
    pattern:
      /\b(hopestartshere|hope\s+starts\s+here|regional\s+hub|unified\s+ssd\s+platform|content\s+repository|shared\s+repository|onevoice27\s+repository|reusable\s+master|shared\s+hub|all\s+things\s+new|integrated\s+calendar|48-week|48\s+week)\b/i,
    barClass: 'bg-blue-600',
    activeRingClass: 'ring-2 ring-blue-600 bg-blue-50/90 border-blue-400',
  },
  {
    id: 'integration_digital_missionaries',
    shortName: 'Digital Missionaries',
    fullName: 'Digital Missionaries & Online Responders',
    roleHint: 'Online chat, prayer & Zalo/LINE/WhatsApp replies',
    layer: 'spine',
    pattern:
      /\b(digital\s+missionar|online\s+responder|response\s+team|chat\s+responder|prayer\s+team|zalo|line\s+official|whatsapp\s+responder)\b/i,
    barClass: 'bg-indigo-600',
    activeRingClass: 'ring-2 ring-indigo-600 bg-indigo-50/90 border-indigo-400',
  },
  {
    id: 'integration_hope_care',
    shortName: 'Hope Care Teams',
    fullName: 'Visitor-Ready Churches & Hope Care Teams',
    roleHint: 'Local church teams who welcome and visit new contacts',
    layer: 'spine',
    pattern:
      /\b(hope\s+care\s+team|seeker-ready|seeker\s+ready|interest\s+coordinator|receiving\s+church|local\s+church\s+receiver|care\s+partner)\b/i,
    barClass: 'bg-emerald-600',
    activeRingClass: 'ring-2 ring-emerald-600 bg-emerald-50/90 border-emerald-400',
  },

  // Layer 2: Media & Broadcast Entities
  {
    id: 'integration_hope_channel',
    shortName: 'Hope Channel',
    fullName: 'Hope Channel & Adventist Media Studios',
    roleHint: 'Video production, TV/online broadcast & Bible message review',
    layer: 'media',
    pattern: /\b(hope\s+channel|hope\s+tv|adventist\s+media\s+center|media\s+ministry)\b/i,
    barClass: 'bg-blue-500',
    activeRingClass: 'ring-2 ring-blue-600 bg-blue-50/90 border-blue-400',
  },
  {
    id: 'integration_awr',
    shortName: 'Adventist World Radio (AWR)',
    fullName: 'Adventist World Radio (AWR) & Local FM',
    roleHint: 'Local-language radio programs for rural & offline areas',
    layer: 'media',
    pattern: /\b(awr\b|adventist\s+world\s+radio|radio\s+broadcast|fm\s+radio|radio\s+ministry)\b/i,
    barClass: 'bg-amber-500',
    activeRingClass: 'ring-2 ring-amber-600 bg-amber-50/90 border-amber-400',
  },
  {
    id: 'integration_publishing_comm',
    shortName: 'Communication & Publishing',
    fullName: 'Communication Dept & Publishing Ministries',
    roleHint: 'News/PR, printed books, tracts & study guides',
    layer: 'media',
    pattern:
      /\b(communication\s+dept|communication\s+department|publishing|literature\s+evangelis|printing\s+house)\b/i,
    barClass: 'bg-slate-600',
    activeRingClass: 'ring-2 ring-slate-700 bg-slate-100 border-slate-400',
  },

  // Layer 3: Church Departments & Bridging Ministries
  {
    id: 'integration_ndr_ministerial',
    shortName: 'NDR-IEL & Pastors',
    fullName: 'NDR-IEL, Ministerial & Local Pastors',
    roleHint: 'Pastors who visit seekers, lead evangelism & baptize',
    layer: 'department',
    pattern:
      /\b(ndr-iel|ndr\b|ministerial|pastoral|pastors|field\s+secretary|evangelism\s+dept)\b/i,
    barClass: 'bg-[#1c398e]',
    activeRingClass: 'ring-2 ring-[#1c398e] bg-blue-50/90 border-blue-400',
  },
  {
    id: 'integration_sspm',
    shortName: 'Sabbath School & Personal Min.',
    fullName: 'Sabbath School & Personal Ministries (SSPM)',
    roleHint: 'Small groups, Bible workers & Bible study lessons',
    layer: 'department',
    pattern:
      /\b(sabbath\s+school|personal\s+ministries|sspm\b|bible\s+worker|lay\s+evangelis|small\s+group\s+leader)\b/i,
    barClass: 'bg-emerald-600',
    activeRingClass: 'ring-2 ring-emerald-600 bg-emerald-50/90 border-emerald-400',
  },
  {
    id: 'integration_health_adra',
    shortName: 'Health, Family & ADRA',
    fullName: 'Health, Family, Women/Children & ADRA',
    roleHint: 'Free health checks, family seminars & community help',
    layer: 'department',
    pattern:
      /\b(health\s+ministr|medical\s+mission|wellness|community\s+service|acs\b|adra\b|bridging\s+event|family\s+ministr|women\w*\s+ministr|children\w*\s+ministr)\b/i,
    barClass: 'bg-teal-600',
    activeRingClass: 'ring-2 ring-teal-600 bg-teal-50/90 border-teal-400',
  },
  {
    id: 'integration_youth_education',
    shortName: 'Youth, Campus & Schools',
    fullName: 'Youth (AYM), Public Campus (PCM) & Adventist Schools',
    roleHint: 'Young people, students & school outreach teams',
    layer: 'department',
    pattern:
      /\b(youth\s+ministr|young\s+adult|campus\s+ministr|pcm\b|pathfinder|adventist\s+education|school|university|college|student)\b/i,
    barClass: 'bg-purple-600',
    activeRingClass: 'ring-2 ring-purple-600 bg-purple-50/90 border-purple-400',
  },
  {
    id: 'integration_amr_mission',
    shortName: 'Adventist Mission / AMR',
    fullName: 'Adventist Mission / AMR & Global Mission (10/40)',
    roleHint: 'Reaching Buddhist/Muslim/Hindu neighbors safely (Play 7)',
    layer: 'department',
    pattern:
      /\b(adventist\s+mission|amr\b|global\s+mission|play\s+7|sensitive-contact|sensitive\s+area\s+mentor|pioneer)\b/i,
    barClass: 'bg-rose-600',
    activeRingClass: 'ring-2 ring-rose-600 bg-rose-50/90 border-rose-400',
  },
];

interface ExpenseBucket {
  id: string;
  label: string;
  shortLabel: string;
  amount: number;
  sharePct: number;
  colorClass: string;
  dotClass: string;
}

function classifyBudgetLineActivity(activityText: string): string {
  const text = activityText.toLowerCase();
  if (
    /camera|lens|laptop|computer|pc|macbook|mic|microphone|light|tripod|led|projector|equipment|gear|drone|hardware|monitor|audio|mixer|gimbal|switcher|battery|hard drive|ssd|sd card/.test(
      text
    )
  ) {
    return 'hardware';
  }
  if (
    /ad\b|ads\b|boost|facebook|meta|youtube|tiktok|social media|marketing|promo|promotion|hosting|website|domain|platform|airtime|radio|broadcast|billboard|sponsor/.test(
      text
    )
  ) {
    return 'distribution';
  }
  if (
    /bible|tract|book|print|literature|pamphlet|study guide|lesson|care group|small group|follow-up|follow up|baptism|reap|crusade|evangelis|health|medical|clinic|expo|community|counsel|visitation|interest/.test(
      text
    )
  ) {
    return 'followup';
  }
  if (
    /train|seminar|workshop|bootcamp|conference|summit|accommodat|hotel|lodging|food|meal|catering|snack|venue|hall|travel|transport|flight|fare|allowance|honorarium|speaker|registration/.test(
      text
    )
  ) {
    return 'training';
  }
  if (
    /video|film|produc|podcast|edit|script|graphic|design|animat|studio|record|translat|dubb|subtitl|content|series|episode|short|reel|music|song|actor|talent/.test(
      text
    )
  ) {
    return 'production';
  }
  return 'general';
}

export function ReviewPortfolioBriefing({
  proposals,
  selectedUnion,
  activeCoachingFilter,
  activeCoachingLabel,
  activeMatchingIds,
  onSelectCoachingFilter,
  onJumpToTable,
  onInspectProposal,
}: ReviewPortfolioBriefingProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const briefing = useMemo(() => {
    const totalCount = proposals.length;
    let totalBudget = 0;

    // Objective counts & budgets
    const objectiveMap = new Map<string, { count: number; budget: number }>();

    // Deliverable / activity theme detection
    const themeCounts: Record<string, number> = {
      'Short Videos, Broadcasts & Digital Media': 0,
      'Training Bootcamps & Digital Missionaries': 0,
      'Bible Study Guides & Printed Literature': 0,
      'Community Health & Bridging Events': 0,
      'Local Church Care Groups & Reaping': 0,
      'Translation & Local Language Content': 0,
    };

    // 5-Stage Playbook Pathway stats + proposal IDs per stage
    const stageStats: Record<
      string,
      { count: number; budget: number; targetSum: number; proposalIds: string[] }
    > = {
      reach_exposure: { count: 0, budget: 0, targetSum: 0, proposalIds: [] },
      engagement_participation: { count: 0, budget: 0, targetSum: 0, proposalIds: [] },
      connection_next_steps: { count: 0, budget: 0, targetSum: 0, proposalIds: [] },
      retention_nurturing: { count: 0, budget: 0, targetSum: 0, proposalIds: [] },
      implementation_capability: { count: 0, budget: 0, targetSum: 0, proposalIds: [] },
    };

    // Missional Investment (Where Money Flows: Frontline Public Outreach vs. Internal Church Equipping)
    let frontlineBudget = 0; // Weighted toward public/seekers (D, E, and seeker outreach C)
    let internalBudget = 0; // Weighted toward internal church members/leaders (A, B)
    let strictDeBudget = 0; // Strictly D & E (Non-Adventist Christians, Secular & World Religions)
    let frontlineTargetSum = 0;
    let internalTargetSum = 0;

    // Audience proposal counts
    let outreachProposalCount = 0; // Includes C, D, or E
    let internalOnlyProposalCount = 0; // Only A and/or B
    let groupEProposalCount = 0;
    const internalOnlyProposals: { id: string; title: string; unionCode: string; budget: number }[] = [];

    // Line-item expense category totals
    const expenseTotals: Record<string, number> = {
      followup: 0,
      production: 0,
      distribution: 0,
      training: 0,
      hardware: 0,
      general: 0,
    };

    // Proposal budget ranking for Top 3 Concentration Callout
    const rankedByBudget: { id: string; title: string; unionCode: string; budget: number }[] = [];

    // Coaching / Alignment buckets
    const singleLineBudgetProposals: { id: string; title: string; unionCode: string; budget: number }[] = [];
    const playbookHandoffProposals: { id: string; title: string; unionCode: string; issue: string }[] = [];
    const sensitivePlay7Proposals: { id: string; title: string; unionCode: string; issue: string }[] = [];
    const audienceContradictionProposals: { id: string; title: string; unionCode: string; issue: string }[] = [];
    const kpiClarityProposals: { id: string; title: string; unionCode: string; issue: string }[] = [];
    const serviceSafeguardProposals: { id: string; title: string; unionCode: string; issue: string }[] = [];
    const pillarBudgetMismatchProposals: { id: string; title: string; unionCode: string; budget: number; issue: string }[] = [];
    const allFlaggedIds = new Set<string>();

    // SSD Project Review Framework: Readiness Verdicts, 7-Question Results Chain & 3-Pillar Sub-Types
    const readinessStats: Record<
      'meeting_requirement' | 'needs_improvement' | 'not_fitting_pathways',
      { count: number; budget: number; proposalIds: string[] }
    > = {
      meeting_requirement: { count: 0, budget: 0, proposalIds: [] },
      needs_improvement: { count: 0, budget: 0, proposalIds: [] },
      not_fitting_pathways: { count: 0, budget: 0, proposalIds: [] },
    };

    const questionMetaList: {
      key: ReviewCriterionKey;
      filterCat: CoachingFilterCategory;
      num: number;
      shortTitle: string;
    }[] = [
      { key: 'q1_pillar', filterCat: 'gap_q1', num: 1, shortTitle: 'Right Pillar & Budget' },
      { key: 'q2_pathway', filterCat: 'gap_q2', num: 2, shortTitle: 'Pathway Stage' },
      { key: 'q3_input', filterCat: 'gap_q3', num: 3, shortTitle: 'Starting Need' },
      { key: 'q4_activity', filterCat: 'gap_q4', num: 4, shortTitle: 'Main Activity' },
      { key: 'q5_output', filterCat: 'gap_q5', num: 5, shortTitle: 'Countable Goal' },
      { key: 'q6_handoff', filterCat: 'gap_q6', num: 6, shortTitle: 'Follow-Up Team' },
      { key: 'q7_continuity', filterCat: 'gap_q7', num: 7, shortTitle: 'Next-Step Plan' },
    ];
    const questionStats: Record<
      ReviewCriterionKey,
      { adequateCount: number; deficientIds: string[] }
    > = {
      q1_pillar: { adequateCount: 0, deficientIds: [] },
      q2_pathway: { adequateCount: 0, deficientIds: [] },
      q3_input: { adequateCount: 0, deficientIds: [] },
      q4_activity: { adequateCount: 0, deficientIds: [] },
      q5_output: { adequateCount: 0, deficientIds: [] },
      q6_handoff: { adequateCount: 0, deficientIds: [] },
      q7_continuity: { adequateCount: 0, deficientIds: [] },
    };

    const subTypeStats: Record<
      Exclude<PillarSubType, 'unclassified'>,
      {
        count: number;
        budget: number;
        proposalIds: string[];
        filterCat: CoachingFilterCategory;
        stageCounts: Record<string, number>;
      }
    > = {
      p1_enabling: {
        count: 0,
        budget: 0,
        proposalIds: [],
        filterCat: 'subtype_p1_enabling',
        stageCounts: { enabling: 0, reach_exposure: 0, engagement_participation: 0, connection_next_steps: 0, retention_nurturing: 0, implementation_capability: 0 },
      },
      p2_tools_intelligence: {
        count: 0,
        budget: 0,
        proposalIds: [],
        filterCat: 'subtype_p2_tools',
        stageCounts: { enabling: 0, reach_exposure: 0, engagement_participation: 0, connection_next_steps: 0, retention_nurturing: 0, implementation_capability: 0 },
      },
      p2_community_service: {
        count: 0,
        budget: 0,
        proposalIds: [],
        filterCat: 'subtype_p2_service',
        stageCounts: { enabling: 0, reach_exposure: 0, engagement_participation: 0, connection_next_steps: 0, retention_nurturing: 0, implementation_capability: 0 },
      },
      p3_proclamation_discipleship: {
        count: 0,
        budget: 0,
        proposalIds: [],
        filterCat: 'subtype_p3_proclamation',
        stageCounts: { enabling: 0, reach_exposure: 0, engagement_participation: 0, connection_next_steps: 0, retention_nurturing: 0, implementation_capability: 0 },
      },
    };
    let budgetAlignedCount = 0;

    // Section 8: Points of Integration ecosystem tracking
    const integrationStats: Record<
      string,
      { count: number; budget: number; proposalIds: string[] }
    > = {};
    for (const partner of INTEGRATION_PARTNER_DEFINITIONS) {
      integrationStats[partner.id] = { count: 0, budget: 0, proposalIds: [] };
    }
    let integratedProposalsCount = 0;
    let totalPartnerLinksCount = 0;
    let endToEndHandoffCount = 0; // Proposals connecting Media/Digital Spine + Local Church/Dept Receiver
    const siloedIntegrationProposals: { id: string; title: string; unionCode: string; budget: number }[] = [];

    // Resolve territory intelligence scope (single selected union OR union set across proposals)
    const singleUnionProfile: UnionIntelligenceProfile | null =
      selectedUnion && selectedUnion !== 'all' ? getUnionIntelligence(selectedUnion) : null;

    const scopedUnionProfilesMap = new Map<string, UnionIntelligenceProfile>();
    if (singleUnionProfile) {
      scopedUnionProfilesMap.set(singleUnionProfile.canonicalName, singleUnionProfile);
    } else {
      for (const p of proposals) {
        const prof = getUnionIntelligence(p.union);
        if (prof) {
          scopedUnionProfilesMap.set(prof.canonicalName, prof);
        }
      }
      if (scopedUnionProfilesMap.size === 0) {
        Object.values(UNION_INTELLIGENCE_PROFILES).forEach((prof) =>
          scopedUnionProfilesMap.set(prof.canonicalName, prof)
        );
      }
    }

    const scopedProfiles = Array.from(scopedUnionProfilesMap.values());
    const scopeChurches =
      scopedProfiles.length === 14
        ? SSD_DIVISION_YEARBOOK_TOTALS.churches
        : scopedProfiles.reduce((s, pr) => s + pr.churches, 0);
    const scopeMembership =
      scopedProfiles.length === 14
        ? SSD_DIVISION_YEARBOOK_TOTALS.membership
        : scopedProfiles.reduce((s, pr) => s + pr.membership, 0);
    const scopePopulation =
      scopedProfiles.length === 14
        ? SSD_DIVISION_YEARBOOK_TOTALS.population
        : scopedProfiles.reduce((s, pr) => s + pr.population, 0);
    const scopeRatio =
      scopeMembership > 0 ? Math.round(scopePopulation / scopeMembership) : 427;
    const scopeOnlinePopulation = scopedProfiles.reduce(
      (s, pr) => s + Math.round(pr.population * (pr.avgInternetPenetrationPct / 100)),
      0
    );
    const scopeAvgOnlinePct =
      scopePopulation > 0 ? Math.round((scopeOnlinePopulation / scopePopulation) * 1000) / 10 : 84.0;
    const scopeOfflinePopulation = Math.max(0, scopePopulation - scopeOnlinePopulation);
    const scopeOfflinePct = Math.max(0, Math.round((100 - scopeAvgOnlinePct) * 10) / 10);
    const scopePeopleGroupsCount =
      scopedProfiles.length === 14
        ? SSD_DIVISION_YEARBOOK_TOTALS.totalPeopleGroupsCount
        : scopedProfiles.reduce((s, pr) => s + pr.totalPeopleGroupsCount, 0);
    const scopeUnreachedGroupsCount =
      scopedProfiles.length === 14
        ? SSD_DIVISION_YEARBOOK_TOTALS.leastReachedGroupsCount
        : scopedProfiles.reduce((s, pr) => s + pr.leastReachedGroupsCount, 0);
    const scopeLanguagesCount =
      scopedProfiles.length === 14
        ? SSD_DIVISION_YEARBOOK_TOTALS.livingLanguagesCount
        : scopedProfiles.reduce((s, pr) => s + pr.livingLanguagesCount, 0);
    const scopeLanguagesTop5 = singleUnionProfile
      ? singleUnionProfile.primaryLanguagesSummary
      : scopedProfiles.length === 14
      ? SSD_DIVISION_YEARBOOK_TOTALS.primaryLanguagesSummary
      : Array.from(
          new Set(
            scopedProfiles.flatMap((pr) =>
              pr.primaryLanguagesSummary.split(',').map((l) => l.trim())
            )
          )
        )
          .slice(0, 5)
          .join(', ');

    for (const p of proposals) {
      const budget = getProposalBudgetTotal(p);
      totalBudget += budget;

      const canonUnion = getCanonicalUnion(p.union);
      const unionCode = UNION_ACRONYMS[canonUnion] || UNION_ACRONYMS[p.union] || 'SSD';
      const title = (p.title || '').trim() || 'Untitled Proposal';

      rankedByBudget.push({ id: p.id, title, unionCode, budget });

      // 1. Objective aggregation
      const objName =
        getCanonicalDivisionProject(p.divisionProject) ||
        (p.divisionProject || '').trim() ||
        'Unassigned Objective';
      const prevObj = objectiveMap.get(objName) || { count: 0, budget: 0 };
      objectiveMap.set(objName, {
        count: prevObj.count + 1,
        budget: prevObj.budget + budget,
      });

      // 2. Theme detection from narrative + deliverables
      const combinedText = [p.title, p.overview, p.goal, p.deliverables]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (/video|reel|podcast|radio|broadcast|film|social media|youtube|tiktok/.test(combinedText)) {
        themeCounts['Short Videos, Broadcasts & Digital Media'] += 1;
      }
      if (/train|bootcamp|workshop|seminar|equip|digital missionar|coaching/.test(combinedText)) {
        themeCounts['Training Bootcamps & Digital Missionaries'] += 1;
      }
      if (/book|tract|literature|print|study guide|lesson|magazine|pamphlet/.test(combinedText)) {
        themeCounts['Bible Study Guides & Printed Literature'] += 1;
      }
      if (/health|medical|clinic|expo|community|family|compassion|bridge/.test(combinedText)) {
        themeCounts['Community Health & Bridging Events'] += 1;
      }
      if (/baptis|small group|care group|hope care|church|pastor|reap|crusade/.test(combinedText)) {
        themeCounts['Local Church Care Groups & Reaping'] += 1;
      }
      if (/translat|dubb|subtitl|language|vernacular|dialect/.test(combinedText)) {
        themeCounts['Translation & Local Language Content'] += 1;
      }

      // 3. Stage & KPI aggregation
      const canonKpi = getCanonicalKpiType(p.kpiType);
      const parsedTarget = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, canonKpi || p.kpiType);
      const targetVal = parsedTarget.value !== null && parsedTarget.value > 0 ? parsedTarget.value : 0;

      if (canonKpi && stageStats[canonKpi]) {
        stageStats[canonKpi].count += 1;
        stageStats[canonKpi].budget += budget;
        stageStats[canonKpi].targetSum += targetVal;
        stageStats[canonKpi].proposalIds.push(p.id);
      }

      // 4. Audience & Missional Investment attribution
      const rawAuds = (Array.isArray(p.targetAudiences) ? p.targetAudiences : []).filter(Boolean);
      const normalizedAuds = rawAuds.map((a) => a.trim().toUpperCase());

      const frontlineTags = normalizedAuds.filter(
        (a) => a.startsWith('C') || a.startsWith('D') || a.startsWith('E')
      );
      const strictDeTags = normalizedAuds.filter(
        (a) => a.startsWith('D') || a.startsWith('E')
      );
      const internalTags = normalizedAuds.filter(
        (a) => a.startsWith('A') || a.startsWith('B')
      );

      const hasExternal = frontlineTags.length > 0;
      const hasInternal = internalTags.length > 0;

      if (hasExternal) {
        outreachProposalCount += 1;
      } else if (hasInternal) {
        internalOnlyProposalCount += 1;
        internalOnlyProposals.push({ id: p.id, title, unionCode, budget });
      }

      if (normalizedAuds.some((a) => a.startsWith('E'))) {
        groupEProposalCount += 1;
      }

      // Compute proposal's Frontline Outreach weight vs. Internal Equipping weight
      let frontlineWeight = 0.5;
      const totalAudTags = frontlineTags.length + internalTags.length;
      if (totalAudTags > 0) {
        frontlineWeight = frontlineTags.length / totalAudTags;
      } else {
        // Fallback based on stage if no audience checkboxes selected yet
        if (canonKpi === 'implementation_capability') {
          frontlineWeight = 0.15;
        } else if (
          canonKpi === 'reach_exposure' ||
          canonKpi === 'engagement_participation' ||
          canonKpi === 'connection_next_steps'
        ) {
          frontlineWeight = 0.85;
        }
      }
      const internalWeight = 1 - frontlineWeight;
      const deWeight =
        totalAudTags > 0 ? strictDeTags.length / totalAudTags : frontlineWeight * 0.6;

      frontlineBudget += budget * frontlineWeight;
      internalBudget += budget * internalWeight;
      strictDeBudget += budget * deWeight;

      frontlineTargetSum += targetVal * frontlineWeight;
      internalTargetSum += targetVal * internalWeight;

      // 5. Line-item expense categorization
      const items = p.budgetItems || [];
      for (const item of items) {
        const lineAmount =
          (Number(item.divisionFunding ?? item.gcFunding) || 0) +
          (Number(item.localFunding) || 0);
        if (lineAmount <= 0) continue;
        const bucketKey = classifyBudgetLineActivity(item.activity || '');
        expenseTotals[bucketKey] = (expenseTotals[bucketKey] || 0) + lineAmount;
      }

      // 5B. Section 8: Points of Integration Ecosystem & Ministry Partner Detection
      const rawIntegrationText = (p.pointsOfIntegration || '').trim();
      const integrationScanText = `${rawIntegrationText} ${p.deliverables || ''} ${p.outcomes || ''}`;
      let matchedPartnersForProposal = 0;
      let hasDigitalOrMediaPartner = false;
      let hasLocalReceiverOrDeptPartner = false;

      for (const partner of INTEGRATION_PARTNER_DEFINITIONS) {
        // Primary match in pointsOfIntegration, or explicit named entity in deliverables/outcomes
        if (partner.pattern.test(rawIntegrationText) || partner.pattern.test(integrationScanText)) {
          integrationStats[partner.id].count += 1;
          integrationStats[partner.id].budget += budget;
          integrationStats[partner.id].proposalIds.push(p.id);
          matchedPartnersForProposal += 1;
          totalPartnerLinksCount += 1;

          if (
            partner.id === 'integration_hopestartshere' ||
            partner.id === 'integration_digital_missionaries' ||
            partner.id === 'integration_hope_channel' ||
            partner.id === 'integration_awr'
          ) {
            hasDigitalOrMediaPartner = true;
          }
          if (
            partner.id === 'integration_hope_care' ||
            partner.id === 'integration_ndr_ministerial' ||
            partner.id === 'integration_sspm' ||
            partner.id === 'integration_health_adra'
          ) {
            hasLocalReceiverOrDeptPartner = true;
          }
        }
      }

      const integrationWordCount = rawIntegrationText.split(/\s+/).filter(Boolean).length;
      if (matchedPartnersForProposal > 0) {
        integratedProposalsCount += 1;
      } else if (integrationWordCount < 12) {
        siloedIntegrationProposals.push({ id: p.id, title, unionCode, budget });
      }

      if (hasDigitalOrMediaPartner && hasLocalReceiverOrDeptPartner) {
        endToEndHandoffCount += 1;
      }

      // 6. Evaluate SSD Review Framework & Smart Advisories for Coaching Buckets
      const fwEval = evaluateProposalReviewFramework(p);
      readinessStats[fwEval.effectiveRating].count += 1;
      readinessStats[fwEval.effectiveRating].budget += budget;
      readinessStats[fwEval.effectiveRating].proposalIds.push(p.id);

      if (fwEval.budgetConcordance.isAligned) {
        budgetAlignedCount += 1;
      }

      if (fwEval.subType !== 'unclassified') {
        const stBucket = subTypeStats[fwEval.subType];
        stBucket.count += 1;
        stBucket.budget += budget;
        stBucket.proposalIds.push(p.id);
        stBucket.stageCounts[fwEval.principalStageKey] =
          (stBucket.stageCounts[fwEval.principalStageKey] || 0) + 1;
      }

      const isGovernanceCertified = fwEval.ratingSource === 'governance_certified';
      for (const q of fwEval.questions) {
        if (q.status === 'adequate' || isGovernanceCertified) {
          questionStats[q.key].adequateCount += 1;
        } else {
          questionStats[q.key].deficientIds.push(p.id);
        }
      }

      const advisories = getAllProposalSmartAdvisories(p);
      const isKpiMisaligned = Boolean(
        (p.divisionProject || '').trim() &&
          p.kpiType &&
          !isKpiAlignedWithObjective(
            getCanonicalDivisionProject(p.divisionProject) || p.divisionProject,
            p.kpiType
          )
      );

      let hasSingleLine = false;
      let hasPlaybookGap = false;
      let hasSensitivePlay7Gap = false;
      let hasAudIssue = false;
      let hasKpiIssue = isKpiMisaligned;
      let hasServiceSafeguardGap = false;
      let hasPillarBudgetMismatch = false;
      let kpiIssueText = isKpiMisaligned ? 'Primary KPI misaligned with Global Objective' : '';
      let audIssueText = '';
      let playbookIssueText = '';
      let sensitivePlay7Text = '';

      for (const adv of advisories) {
        allFlaggedIds.add(p.id);
        if (adv.id === 'framework_service_safeguard') {
          hasServiceSafeguardGap = true;
        } else if (adv.id === 'framework_pillar_budget_concordance') {
          hasPillarBudgetMismatch = true;
        } else if (
          adv.id === 'budget_single_or_lump' ||
          adv.id === 'budget_deliverable_gap' ||
          adv.id === 'adv-budget-single' ||
          adv.id.startsWith('adv-budget-missing-')
        ) {
          hasSingleLine = true;
        } else if (
          adv.id === 'union_play7_sensitive_routing' ||
          adv.id.startsWith('union_platform_')
        ) {
          hasSensitivePlay7Gap = true;
          if (!sensitivePlay7Text) sensitivePlay7Text = adv.title;
        } else if (
          adv.id.startsWith('playbook_') ||
          adv.id === 'framework_continuity_plan' ||
          adv.id.startsWith('adv-playbook-')
        ) {
          hasPlaybookGap = true;
          if (!playbookIssueText) playbookIssueText = adv.title;
        } else if (
          adv.id.startsWith('aud_') ||
          adv.id === 'adv-audience-contradiction'
        ) {
          hasAudIssue = true;
          audIssueText = adv.title;
        } else if (
          adv.id.startsWith('kpi_') ||
          adv.id === 'framework_passive_output_check' ||
          adv.id === 'union_kpi_exceeds_membership' ||
          adv.id === 'adv-kpi-clarity'
        ) {
          hasKpiIssue = true;
          kpiIssueText = adv.title;
        }
      }

      if (isKpiMisaligned) allFlaggedIds.add(p.id);

      if (hasServiceSafeguardGap) {
        serviceSafeguardProposals.push({
          id: p.id,
          title,
          unionCode,
          issue: fwEval.serviceSafeguard.guidanceTitle,
        });
      }
      if (hasPillarBudgetMismatch) {
        pillarBudgetMismatchProposals.push({
          id: p.id,
          title,
          unionCode,
          budget,
          issue: fwEval.budgetConcordance.summaryLabel,
        });
      }
      if (hasSingleLine) {
        singleLineBudgetProposals.push({ id: p.id, title, unionCode, budget });
      }
      if (hasPlaybookGap) {
        playbookHandoffProposals.push({
          id: p.id,
          title,
          unionCode,
          issue: playbookIssueText || 'Needs a clear follow-up team in Section 8',
        });
      }
      if (hasSensitivePlay7Gap) {
        sensitivePlay7Proposals.push({
          id: p.id,
          title,
          unionCode,
          issue: sensitivePlay7Text || 'Needs safe, private follow-up (Play 7) or local chat app',
        });
      }
      if (hasAudIssue) {
        audienceContradictionProposals.push({
          id: p.id,
          title,
          unionCode,
          issue: audIssueText || 'Target Audience checkboxes do not match project description',
        });
      }
      if (hasKpiIssue) {
        kpiClarityProposals.push({
          id: p.id,
          title,
          unionCode,
          issue: kpiIssueText || 'Target Goal needs one clear total number',
        });
      }
    }

    // Sort internal-only proposals by largest budget first
    internalOnlyProposals.sort((a, b) => b.budget - a.budget);

    // Top 3 largest proposals concentration
    rankedByBudget.sort((a, b) => b.budget - a.budget);
    const topLargestProposals = rankedByBudget.slice(0, 3);
    const top3BudgetSum = topLargestProposals.reduce((sum, p) => sum + p.budget, 0);
    const top3SharePct = totalBudget > 0 ? Math.round((top3BudgetSum / totalBudget) * 100) : 0;

    // Missional Investment shares & unit costs
    const frontlineSharePct =
      totalBudget > 0 ? Math.round((frontlineBudget / totalBudget) * 100) : 50;
    const internalSharePct = 100 - frontlineSharePct;
    const strictDeSharePct =
      totalBudget > 0 ? Math.round((strictDeBudget / totalBudget) * 100) : 0;

    const frontlineCostPerPerson =
      frontlineTargetSum > 0 && frontlineBudget > 0
        ? frontlineBudget / frontlineTargetSum
        : null;
    const internalCostPerPerson =
      internalTargetSum > 0 && internalBudget > 0
        ? internalBudget / internalTargetSum
        : null;

    // Needs Frontline Rebalance coaching if Frontline share < 60% and there are internal-only proposals
    const needsFrontlineRebalance =
      totalCount >= 2 && frontlineSharePct < 60 && internalOnlyProposals.length > 0;
    if (needsFrontlineRebalance) {
      internalOnlyProposals.forEach((p) => allFlaggedIds.add(p.id));
    }

    // Build sorted Expense Buckets
    const rawBuckets: Omit<ExpenseBucket, 'sharePct'>[] = [
      {
        id: 'followup',
        label: 'Bible Study Guides, Community Care & Follow-Up',
        shortLabel: 'Follow-Up & Books',
        amount: expenseTotals.followup,
        colorClass: 'bg-emerald-500',
        dotClass: 'bg-emerald-500',
      },
      {
        id: 'production',
        label: 'Video, Audio & Media Production',
        shortLabel: 'Media Production',
        amount: expenseTotals.production,
        colorClass: 'bg-blue-600',
        dotClass: 'bg-blue-600',
      },
      {
        id: 'distribution',
        label: 'Online Ads, Radio Airtime & Sharing',
        shortLabel: 'Ads & Airtime',
        amount: expenseTotals.distribution,
        colorClass: 'bg-indigo-500',
        dotClass: 'bg-indigo-500',
      },
      {
        id: 'training',
        label: 'Training Workshops & Events',
        shortLabel: 'Training & Events',
        amount: expenseTotals.training,
        colorClass: 'bg-purple-500',
        dotClass: 'bg-purple-500',
      },
      {
        id: 'hardware',
        label: 'Cameras, Computers & Studio Equipment',
        shortLabel: 'Equipment & Gear',
        amount: expenseTotals.hardware,
        colorClass: 'bg-amber-500',
        dotClass: 'bg-amber-500',
      },
      {
        id: 'general',
        label: 'Other / Single Total Line (Not Broken Down)',
        shortLabel: 'Other / Single Line',
        amount: expenseTotals.general,
        colorClass: 'bg-slate-400',
        dotClass: 'bg-slate-400',
      },
    ];

    const expenseBuckets: ExpenseBucket[] = rawBuckets
      .filter((b) => b.amount > 0)
      .map((b) => ({
        ...b,
        sharePct: totalBudget > 0 ? Math.max(1, Math.round((b.amount / totalBudget) * 100)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const hardwareSharePct =
      totalBudget > 0 ? Math.round((expenseTotals.hardware / totalBudget) * 100) : 0;

    const topObjectives = Array.from(objectiveMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        budget: data.budget,
        sharePct: totalBudget > 0 ? Math.round((data.budget / totalBudget) * 100) : 0,
      }))
      .sort((a, b) => b.budget - a.budget || b.count - a.count);

    const topThemes = Object.entries(themeCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));

    // Portfolio-level plain ESL observations
    const portfolioInsights: { type: 'warning' | 'info'; text: string }[] = [];

    const s1 = stageStats.reach_exposure.count;
    const s2 = stageStats.engagement_participation.count;
    const s3 = stageStats.connection_next_steps.count;
    const s4 = stageStats.retention_nurturing.count;

    if (totalCount >= 3 && s1 > 0 && s4 > 0 && (s2 === 0 || s3 === 0)) {
      const missingStageNames = [
        s2 === 0 ? 'Stage 2 (Engage / Online Reply)' : '',
        s3 === 0 ? 'Stage 3 (Connect / Community Events)' : '',
      ]
        .filter(Boolean)
        .join(' and ');
      portfolioInsights.push({
        type: 'warning',
        text: `Missing Middle Steps: These proposals fund Stage 1 Reach ($${formatCurrency(
          stageStats.reach_exposure.budget
        )}) and Stage 4 Disciple ($${formatCurrency(
          stageStats.retention_nurturing.budget
        )}), but have 0 projects in ${missingStageNames}. Make sure online viewers have an easy way to reply and meet local church friends before Bible study.`,
      });
    } else if (totalCount >= 2 && s1 + s2 >= 2 && s3 + s4 === 0) {
      portfolioInsights.push({
        type: 'warning',
        text: `Missing Local Church Follow-Up: ${
          s1 + s2
        } proposals focus on Stage 1–2 (Reach and Engage), but 0 proposals focus on Stage 3–4 (Connect and Disciple). Ask authors to explain how online contacts will be welcomed by local Hope Care Teams.`,
      });
    }

    if (hardwareSharePct >= 35) {
      portfolioInsights.push({
        type: 'warning',
        text: `High Equipment Spending: ${hardwareSharePct}% (US$${formatCurrency(
          expenseTotals.hardware
        )}) of the budget buys cameras, computers, or studio gear. Please check that teams also budget for sharing content and following up with people.`,
      });
    }

    // Territory-specific intelligence checks in Plain ESL
    const bridgedAndDiscipledTotal =
      stageStats.connection_next_steps.targetSum + stageStats.retention_nurturing.targetSum;
    const seekersPerChurch =
      scopeChurches > 0 ? Math.round((bridgedAndDiscipledTotal / scopeChurches) * 10) / 10 : 0;
    const mobilizedPctOfMembers =
      scopeMembership > 0
        ? Math.round((stageStats.implementation_capability.targetSum / scopeMembership) * 1000) / 10
        : 0;

    if (
      seekersPerChurch >= 25 &&
      stageStats.implementation_capability.count === 0 &&
      scopeChurches > 0
    ) {
      portfolioInsights.push({
        type: 'warning',
        text: `Many New Visitors per Church (~${seekersPerChurch.toLocaleString()} per church): Stage 3–4 proposals aim to bring ${bridgedAndDiscipledTotal.toLocaleString()} new people across ${scopeChurches.toLocaleString()} local churches, but 0 proposals train church members in Stage 5 (Multiply). Make sure local churches and Hope Care Teams are trained and ready to care for visitors.`,
      });
    }

    const followupSpendSharePct =
      totalBudget > 0 ? Math.round((expenseTotals.followup / totalBudget) * 100) : 0;
    if (
      singleUnionProfile?.isHighOfflineTerritory &&
      totalBudget > 0 &&
      followupSpendSharePct < 10
    ) {
      portfolioInsights.push({
        type: 'info',
        text: `Many People Have No Internet (${singleUnionProfile.acronym} — ${singleUnionProfile.offlinePopulationSummary}): Only ${followupSpendSharePct}% of the budget goes to in-person follow-up, community care, or printed/audio lessons. Consider adding radio, SD cards, or printed study guides for rural areas.`,
      });
    }

    if (totalCount >= 2 && groupEProposalCount === 0) {
      const sampleGroups = singleUnionProfile
        ? singleUnionProfile.keyPeopleGroups
            .slice(0, 2)
            .map((g) => g.name.split('(')[0].trim())
            .join(', ')
        : 'non-Christian & unreached neighbors';
      portfolioInsights.push({
        type: 'info',
        text: `Opportunity to Reach Unreached Neighbors (${
          singleUnionProfile
            ? `${singleUnionProfile.acronym} Ratio 1:${singleUnionProfile.memberToPopRatio.toLocaleString()}`
            : `SSD Ratio 1:${scopeRatio.toLocaleString()}`
        }): None of the ${totalCount} proposals select Group E (World Religions / Secular), such as ${sampleGroups}. Consider if any media or community project can also welcome Group E neighbors.`,
      });
    }

    return {
      totalCount,
      totalBudget,
      topObjectives,
      topThemes,
      stageStats,
      frontlineBudget,
      internalBudget,
      strictDeBudget,
      frontlineSharePct,
      internalSharePct,
      strictDeSharePct,
      frontlineTargetSum: Math.round(frontlineTargetSum),
      internalTargetSum: Math.round(internalTargetSum),
      frontlineCostPerPerson,
      internalCostPerPerson,
      needsFrontlineRebalance,
      internalOnlyProposals,
      expenseBuckets,
      hardwareSharePct,
      topLargestProposals,
      top3BudgetSum,
      top3SharePct,
      outreachProposalCount,
      internalOnlyProposalCount,
      groupEProposalCount,
      singleLineBudgetProposals,
      playbookHandoffProposals,
      sensitivePlay7Proposals,
      audienceContradictionProposals,
      kpiClarityProposals,
      serviceSafeguardProposals,
      pillarBudgetMismatchProposals,
      readinessStats,
      readinessMeetingPct:
        totalCount > 0
          ? Math.round((readinessStats.meeting_requirement.count / totalCount) * 100)
          : 0,
      readinessNeedsImpPct:
        totalCount > 0
          ? Math.round((readinessStats.needs_improvement.count / totalCount) * 100)
          : 0,
      readinessNotFittingPct:
        totalCount > 0
          ? Math.round((readinessStats.not_fitting_pathways.count / totalCount) * 100)
          : 0,
      questionCoverage: questionMetaList.map((qm) => {
        const st = questionStats[qm.key];
        return {
          ...qm,
          adequateCount: st.adequateCount,
          deficientIds: st.deficientIds,
          passPct: totalCount > 0 ? Math.round((st.adequateCount / totalCount) * 100) : 100,
        };
      }),
      subTypeRows: (
        [
          'p1_enabling',
          'p2_tools_intelligence',
          'p2_community_service',
          'p3_proclamation_discipleship',
        ] as Exclude<PillarSubType, 'unclassified'>[]
      ).map((stKey) => ({
        key: stKey,
        meta: PILLAR_SUBTYPE_LABELS[stKey],
        ...subTypeStats[stKey],
        sharePct:
          totalBudget > 0 ? Math.round((subTypeStats[stKey].budget / totalBudget) * 100) : 0,
      })),
      budgetAlignedCount,
      budgetAlignedPct: totalCount > 0 ? Math.round((budgetAlignedCount / totalCount) * 100) : 100,
      allFlaggedIds,
      portfolioInsights,
      singleUnionProfile,
      scopeChurches,
      scopeMembership,
      scopePopulation,
      scopeRatio,
      scopeOnlinePopulation,
      scopeAvgOnlinePct,
      scopeOfflinePopulation,
      scopeOfflinePct,
      scopePeopleGroupsCount,
      scopeUnreachedGroupsCount,
      scopeLanguagesCount,
      scopeLanguagesTop5,
      seekersPerChurch,
      mobilizedPctOfMembers,
      integrationPartners: INTEGRATION_PARTNER_DEFINITIONS.map((def) => {
        const stat = integrationStats[def.id];
        return {
          ...def,
          count: stat.count,
          budget: stat.budget,
          proposalIds: stat.proposalIds,
          shareOfProposalsPct:
            totalCount > 0 ? Math.round((stat.count / totalCount) * 100) : 0,
        };
      }),
      integratedProposalsCount,
      integratedProposalsPct:
        totalCount > 0 ? Math.round((integratedProposalsCount / totalCount) * 100) : 0,
      avgPartnersPerProposal:
        totalCount > 0 ? Math.round((totalPartnerLinksCount / totalCount) * 10) / 10 : 0,
      endToEndHandoffCount,
      endToEndHandoffPct:
        totalCount > 0 ? Math.round((endToEndHandoffCount / totalCount) * 100) : 0,
      siloedIntegrationProposals,
    };
  }, [proposals, selectedUnion]);

  if (proposals.length === 0) return null;

  const scopeTitle =
    selectedUnion === 'all'
      ? 'All Active Territories in Scope'
      : `${UNION_ACRONYMS[selectedUnion] || selectedUnion} Territory Portfolio`;

  const topObj1 = briefing.topObjectives[0];
  const topObj2 = briefing.topObjectives[1];

  const handleToggleFilter = (
    cat: CoachingFilterCategory,
    ids: string[],
    label: string,
    scrollToTable = false
  ) => {
    if (activeCoachingFilter === cat) {
      onSelectCoachingFilter('all', new Set(), '', { scrollToTable: false });
    } else {
      onSelectCoachingFilter(cat, new Set(ids), label, { scrollToTable });
    }
  };

  const activeMatchedProposals =
    activeCoachingFilter !== 'all' && activeMatchingIds && activeMatchingIds.size > 0
      ? proposals.filter((p) => activeMatchingIds.has(p.id))
      : [];

  const renderInlineMatchedPreview = (
    showInThisSection: boolean,
    defaultTab?: 'financials' | 'narrative' | 'kpis' | 'notes'
  ) => {
    if (!showInThisSection || activeCoachingFilter === 'all') return null;

    const previewItems = activeMatchedProposals.slice(0, 6);
    const matchedTotalBudget = activeMatchedProposals.reduce(
      (sum, p) => sum + getProposalBudgetTotal(p),
      0
    );

    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/40 overflow-hidden transition-all duration-150">
        <div className="px-3 py-2 bg-blue-50/80 border-b border-blue-200/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap text-xs min-w-0">
            <Filter className="w-3.5 h-3.5 text-[#1c398e] shrink-0" />
            <span className="font-bold text-slate-900 truncate">
              {activeCoachingLabel || 'Filtered Selection'}
            </span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="font-semibold text-[#1c398e] tabular-nums">
              {activeMatchedProposals.length}{' '}
              {activeMatchedProposals.length === 1 ? 'proposal' : 'proposals'}
            </span>
            <span className="text-slate-400" aria-hidden="true">·</span>
            <span className="font-semibold text-slate-700 tabular-nums">
              US${formatCurrency(matchedTotalBudget)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onJumpToTable && (
              <button
                type="button"
                onClick={onJumpToTable}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1c398e] hover:bg-[#152c70] text-white font-semibold text-[11px] transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>Jump to Full Table</span>
                <ArrowDown className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onSelectCoachingFilter('all', new Set(), '', { scrollToTable: false })
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px] transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {previewItems.length > 0 ? (
          <div className="divide-y divide-slate-200/70 bg-white/90">
            {previewItems.map((p) => {
              const canonUnion = getCanonicalUnion(p.union);
              const uCode =
                UNION_ACRONYMS[canonUnion] || UNION_ACRONYMS[p.union] || 'SSD';
              const pBudget = getProposalBudgetTotal(p);
              const statusText =
                p.status === 'approved'
                  ? p.divisionApproval?.authorized
                    ? 'Authorized'
                    : 'Union Voted'
                  : p.status === 'under_review'
                  ? 'Under Review'
                  : p.status === 'submitted'
                  ? 'Submitted'
                  : 'Draft';

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onInspectProposal(p.id, defaultTab)}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50/50 transition flex items-center justify-between gap-3 text-xs cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-extrabold text-[#1c398e] shrink-0">
                      {uCode}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-900 group-hover:text-[#1c398e] truncate">
                      {(p.title || '').trim() || 'Untitled Proposal'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 tabular-nums text-[11px]">
                    <span className="text-slate-500 hidden sm:inline">
                      {statusText}
                    </span>
                    <span className="text-slate-300 hidden sm:inline" aria-hidden="true">·</span>
                    <span className="font-bold text-slate-900">
                      US${formatCurrency(pBudget)}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-semibold text-[#1c398e] pl-1">
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}

            {activeMatchedProposals.length > previewItems.length && onJumpToTable && (
              <button
                type="button"
                onClick={onJumpToTable}
                className="w-full px-3 py-1.5 bg-slate-50/90 hover:bg-blue-50/60 text-center text-[11px] font-semibold text-[#1c398e] transition cursor-pointer flex items-center justify-center gap-1 tabular-nums"
              >
                <span>
                  View all {activeMatchedProposals.length} matching proposals in table
                </span>
                <ArrowDown className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="px-3 py-2.5 text-xs text-slate-500 bg-white/90">
            No proposals in current scope match this selection.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap text-xs min-w-0">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
            Portfolio Briefing
          </h2>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-slate-600 font-semibold tabular-nums">
            {scopeTitle} ({briefing.totalCount})
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span
            className={`font-bold tabular-nums ${
              briefing.frontlineSharePct >= 60 ? 'text-emerald-700' : 'text-amber-700'
            }`}
            title="Playbook goal: at least 60% of funds should reach the public and seekers outside the church (Groups C, D, E)"
          >
            {briefing.frontlineSharePct}% Public Outreach
          </span>
          {briefing.allFlaggedIds.size > 0 && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() =>
                  handleToggleFilter(
                    'all_flagged',
                    Array.from(briefing.allFlaggedIds),
                    'All Proposals with Coaching Suggestions'
                  )
                }
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition cursor-pointer tabular-nums ${
                  activeCoachingFilter === 'all_flagged'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
                title="Click to preview & filter all proposals with yellow coaching flags"
              >
                <Flag className="w-2.5 h-2.5 text-amber-700 fill-amber-500/40 shrink-0" />
                <span>{briefing.allFlaggedIds.size} Flagged</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeCoachingFilter !== 'all' && onJumpToTable && (
            <button
              type="button"
              onClick={onJumpToTable}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-xs transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <span>Jump to Table</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
          {activeCoachingFilter !== 'all' && (
            <button
              type="button"
              onClick={() =>
                onSelectCoachingFilter('all', new Set(), '', { scrollToTable: false })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{isExpanded ? 'Hide Briefing' : 'Expand Briefing'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {activeCoachingFilter === 'all_flagged' && (
        <div className="px-4 pt-3 pb-1">
          {renderInlineMatchedPreview(true, 'narrative')}
        </div>
      )}

      {isExpanded && (
        <div className="p-5 space-y-5">
          {/* ================================================================= */}
          {/* TERRITORY INTELLIGENCE & FIELD CAPACITY BASELINE STRIP            */}
          {/* ================================================================= */}
          <div className="space-y-3">
            {briefing.singleUnionProfile && selectedUnion !== 'all' ? (
              <UnionIntelligenceBanner unionName={selectedUnion} compact={false} />
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 text-xs">
                    <span className="font-extrabold uppercase tracking-wider text-[#1c398e]">
                      Active Scope Field Baseline
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-500 truncate">
                      Adventist Yearbook (June 2025), DataReportal 2026 &amp; Joshua Project
                    </span>
                  </div>
                  {briefing.mobilizedPctOfMembers !== null && (
                    <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                      Stage 5 Target:{' '}
                      <strong className="text-[#1c398e]">{briefing.mobilizedPctOfMembers}% of members</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 w-full">
                <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Local Churches
                  </div>
                  <div className="text-xs font-black text-slate-900 tabular-nums mt-0.5">
                    {briefing.scopeChurches.toLocaleString()}
                  </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Church Members
                  </div>
                  <div className="text-xs font-black text-[#1c398e] tabular-nums mt-0.5">
                    {briefing.scopeMembership.toLocaleString()}
                  </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Population · Ratio
                  </div>
                  <div className="text-xs font-black text-slate-900 tabular-nums mt-0.5">
                    {(briefing.scopePopulation / 1_000_000).toFixed(1)}M · 1:{briefing.scopeRatio.toLocaleString()}
                  </div>
                </div>

                <div
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80"
                  title="Internet-connected population reachable via digital media and social platforms"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Online Reachable
                  </div>
                  <div className="text-xs font-black text-emerald-700 tabular-nums mt-0.5">
                    {(briefing.scopeOnlinePopulation / 1_000_000).toFixed(1)}M ({briefing.scopeAvgOnlinePct}%)
                  </div>
                </div>

                <div
                  className="px-2.5 py-1.5 rounded-xl bg-amber-50/50 border border-amber-200/80"
                  title="Offline population without internet access requiring radio, print, or in-person community bridging"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Offline Population
                  </div>
                  <div className="text-xs font-black text-amber-800 tabular-nums mt-0.5">
                    {(briefing.scopeOfflinePopulation / 1_000_000).toFixed(1)}M ({briefing.scopeOfflinePct}%)
                  </div>
                </div>

                <div
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80"
                  title="Total ethno-linguistic people groups and least-reached / unreached groups (Joshua Project Scale 1–2)"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    People Groups
                  </div>
                  <div className="text-xs font-black text-slate-900 tabular-nums mt-0.5">
                    {briefing.scopePeopleGroupsCount.toLocaleString()} ({briefing.scopeUnreachedGroupsCount.toLocaleString()} UPG)
                  </div>
                </div>

                <div
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/80 sm:col-span-2 xl:col-span-2"
                  title={`Top 5 languages in scope: ${briefing.scopeLanguagesTop5}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Living Languages
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {briefing. scopeLanguagesCount.toLocaleString()}+ Languages
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-800 leading-tight mt-0.5">
                    <span className="text-[#1c398e] font-extrabold">Top 5:</span> {briefing.scopeLanguagesTop5}
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ================================================================= */}
          {/* LEFT COLUMN (7 cols): PORTFOLIO SUMMARY & WHERE MONEY FLOWS       */}
          {/* ================================================================= */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. General Narrative Overview + Top Budget Concentration */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#1c398e] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#1c398e]" />
                  <span>Quick Summary: What These Proposals Do</span>
                </span>
                <span className="text-xs font-black text-slate-900 tabular-nums">
                  Total Budget: US${formatCurrency(briefing.totalBudget)}
                </span>
              </div>

              {/* Plain ESL Narrative Synthesis */}
              <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                There {briefing.totalCount === 1 ? 'is' : 'are'}{' '}
                <strong className="text-slate-900">
                  {briefing.totalCount} {briefing.totalCount === 1 ? 'proposal' : 'proposals'}
                </strong>{' '}
                asking for{' '}
                <strong className="text-[#1c398e]">
                  US${formatCurrency(briefing.totalBudget)}
                </strong>
                {topObj1 ? (
                  <>
                    . Most funding goes to{' '}
                    <strong className="text-slate-900">{topObj1.name}</strong> ({topObj1.count}{' '}
                    {topObj1.count === 1 ? 'project' : 'projects'}, {topObj1.sharePct}% of funds)
                    {topObj2
                      ? ` and ${topObj2.name} (${topObj2.count} ${
                          topObj2.count === 1 ? 'project' : 'projects'
                        }, ${topObj2.sharePct}%)`
                      : ''}
                    .
                  </>
                ) : (
                  '.'
                )}{' '}
                {briefing.topThemes.length > 0 && (
                  <>
                    The main activities are{' '}
                    <strong className="text-slate-900">
                      {briefing.topThemes
                        .map((t) => `${t.label} (${t.count})`)
                        .join(', ')}
                    </strong>
                    .{' '}
                  </>
                )}
                Right now,{' '}
                <strong className="text-blue-800">
                  {briefing.frontlineSharePct}% (US${formatCurrency(briefing.frontlineBudget)})
                </strong>{' '}
                reaches{' '}
                <strong className="text-slate-900">people outside the church</strong> (Groups C, D, E), and{' '}
                <strong className="text-purple-800">
                  {briefing.internalSharePct}% (US${formatCurrency(briefing.internalBudget)})
                </strong>{' '}
                trains{' '}
                <strong className="text-slate-900">church members &amp; leaders</strong> (Groups A &amp; B).
              </p>

              {/* Top Global Objectives Chips */}
              {briefing.topObjectives.length > 0 && (
                <div className="pt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                    Top Objectives:
                  </span>
                  {briefing.topObjectives.slice(0, 4).map((obj) => (
                    <span
                      key={obj.name}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700"
                    >
                      <span className="truncate max-w-[180px]">{obj.name}</span>
                      <span className="text-[#1c398e] font-bold tabular-nums">
                        ({obj.count} · ${formatCurrency(obj.budget)})
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Top 3 Largest Budget Drivers ("Whale Proposals" Callout) */}
              {briefing.topLargestProposals.length > 1 && briefing.totalBudget > 0 && (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <TrendingUp className="w-3.5 h-3.5 text-[#1c398e] shrink-0" />
                    <span>
                      <strong className="text-slate-800">Largest Budgets:</strong> Top{' '}
                      {briefing.topLargestProposals.length} proposals use{' '}
                      <strong className="text-[#1c398e]">{briefing.top3SharePct}%</strong> (US$
                      {formatCurrency(briefing.top3BudgetSum)}) of total funds:
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {briefing.topLargestProposals.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onInspectProposal(p.id, 'financials')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-[#1c398e] border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                        title={`Open ${p.title} (US$${formatCurrency(p.budget)})`}
                      >
                        <span className="font-bold text-[#1c398e]">{p.unionCode}:</span>
                        <span className="truncate max-w-[115px]">{p.title}</span>
                        <span className="font-black text-slate-900 tabular-nums">
                          ${formatCurrency(p.budget)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Missional Investment & Line-Item Money Flow Card (For Treasurers) */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>Who Receives Outreach &amp; What the Money Buys</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    briefing.frontlineSharePct >= 60
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  }`}
                >
                  {briefing.frontlineSharePct >= 60 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Healthy Balance: Most Funds Reach the Public</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>
                        Helpful Tip: Aim for ≥60% Public Outreach (Now {briefing.frontlineSharePct}%)
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Two Side-by-Side Metric Cards + Clean Split Bar */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Left Card: Frontline Public Outreach (C-D-E) */}
                  <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-200/80 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                        <span className="text-[11px] font-extrabold text-slate-900 truncate">
                          Public &amp; Seeker Outreach (Groups C–E)
                        </span>
                      </div>
                      <span className="text-xs font-black text-blue-700 tabular-nums shrink-0">
                        {briefing.frontlineSharePct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 tabular-nums">
                        US${formatCurrency(briefing.frontlineBudget)}
                      </span>
                      {briefing.frontlineCostPerPerson !== null && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-blue-800 border border-blue-200 text-[10px] font-bold tabular-nums">
                          ~${briefing.frontlineCostPerPerson.toFixed(2)}/person ({formatMetricCount(briefing.frontlineTargetSum)} goal)
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-500 leading-snug">
                      Includes <strong className="text-slate-700">{briefing.strictDeSharePct}%</strong> (US${formatCurrency(briefing.strictDeBudget)}) for non-Adventist neighbors &amp; world religions (Groups D–E)
                    </p>
                  </div>

                  {/* Right Card: Internal Church Equipping (A-B) */}
                  <div className="p-3 rounded-xl bg-purple-50/40 border border-purple-200/80 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
                        <span className="text-[11px] font-extrabold text-slate-900 truncate">
                          Church Member Training (Groups A–B)
                        </span>
                      </div>
                      <span className="text-xs font-black text-purple-700 tabular-nums shrink-0">
                        {briefing.internalSharePct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900 tabular-nums">
                        US${formatCurrency(briefing.internalBudget)}
                      </span>
                      {briefing.internalCostPerPerson !== null && (
                        <span className="px-1.5 py-0.5 rounded bg-white text-purple-800 border border-purple-200 text-[10px] font-bold tabular-nums">
                          ~${briefing.internalCostPerPerson.toFixed(2)}/person ({formatMetricCount(briefing.internalTargetSum)} trained)
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-500 leading-snug">
                      Training Adventist members, youth, pastors, and local churches to serve
                    </p>
                  </div>
                </div>

                {/* Clean Solid Visual Split Bar */}
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${briefing.frontlineSharePct}%` }}
                    title={`Public & Seeker Outreach: ${briefing.frontlineSharePct}% (US$${formatCurrency(
                      briefing.frontlineBudget
                    )}) — Groups D & E: ${briefing.strictDeSharePct}%`}
                  />
                  <div
                    className="h-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${briefing.internalSharePct}%` }}
                    title={`Church Member Training: ${briefing.internalSharePct}% (US$${formatCurrency(
                      briefing.internalBudget
                    )})`}
                  />
                </div>
              </div>

              {/* Line-Item Expense Category Breakdown ("What Items They Are Buying") */}
              {briefing.expenseBuckets.length > 0 && (
                <div className="pt-2.5 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <PieChart className="w-3 h-3 text-slate-400" />
                      <span>Budget Items (What Proposals Are Buying)</span>
                    </span>
                    {briefing.hardwareSharePct >= 30 && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Equipment/Gear is {briefing.hardwareSharePct}% of total budget
                      </span>
                    )}
                  </div>

                  {/* Stacked Multi-Segment Expense Bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    {briefing.expenseBuckets.map((b) => (
                      <div
                        key={b.id}
                        className={`h-full ${b.colorClass} transition-all duration-300`}
                        style={{ width: `${b.sharePct}%` }}
                        title={`${b.label}: US$${formatCurrency(b.amount)} (${b.sharePct}%)`}
                      />
                    ))}
                  </div>

                  {/* Expense Category Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                    {briefing.expenseBuckets.map((b) => (
                      <div
                        key={b.id}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between gap-1.5 text-[11px]"
                        title={b.label}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${b.dotClass}`} />
                          <span className="font-semibold text-slate-700 truncate">
                            {b.shortLabel}
                          </span>
                        </div>
                        <span className="font-black text-slate-900 tabular-nums shrink-0">
                          {b.sharePct}%{' '}
                          <span className="font-medium text-slate-400 text-[10px]">
                            (${formatCurrency(b.amount)})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Interactive 5-Stage OneVoice27 Pathway Distribution Matrix */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#1c398e]" />
                  <span>OneVoice27 5-Stage Pathway Coverage (Reach → Multiply)</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Click any stage card to preview &amp; filter matching proposals
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {STAGE_DEFINITIONS.map((st) => {
                  const data = briefing.stageStats[st.kpiId];
                  const isEmpty = data.count === 0;
                  const isSelected = activeCoachingFilter === st.filterKey;
                  return (
                    <button
                      key={st.kpiId}
                      type="button"
                      disabled={isEmpty}
                      onClick={() =>
                        handleToggleFilter(
                          st.filterKey,
                          data.proposalIds,
                          `Stage ${st.stageNum}: ${st.shortName}`
                        )
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs flex flex-col justify-between transition ${
                        isEmpty
                          ? 'bg-rose-50/40 border-dashed border-rose-200 text-slate-400 cursor-default'
                          : isSelected
                          ? `${st.activeRingClass} cursor-pointer shadow-xs`
                          : 'bg-slate-50/90 hover:bg-blue-50/50 border-slate-200/90 hover:border-blue-300 text-slate-800 cursor-pointer'
                      }`}
                      title={
                        isEmpty
                          ? `Stage ${st.stageNum} (${st.shortName}): 0 proposals in this stage`
                          : `Click to filter table to ${data.count} Stage ${st.stageNum} (${st.shortName}) proposals`
                      }
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                              isEmpty
                                ? 'bg-rose-100/70 text-rose-700 border-rose-200'
                                : st.badgeClass
                            }`}
                          >
                            {st.stageNum}. {st.shortName}
                          </span>
                          <span className="font-black text-xs text-slate-900 tabular-nums">
                            {data.count} {data.count === 1 ? 'proj' : 'projs'}
                          </span>
                        </div>
                        <p className="mt-1.5 font-extrabold text-[11px] text-[#1c398e] tabular-nums">
                          ${formatCurrency(data.budget)}
                        </p>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-[10px] text-slate-600 font-semibold truncate tabular-nums">
                          {data.targetSum > 0
                            ? `${data.targetSum.toLocaleString()} ${st.unitLabel}`
                            : isEmpty
                            ? 'Gap: 0 proposals'
                            : 'No number given'}
                        </p>
                        {data.targetSum > 0 && (
                          <p className="text-[9px] text-slate-400 font-medium truncate tabular-nums">
                            {st.stageNum === 1 && briefing.scopeOnlinePopulation > 0
                              ? `${((data.targetSum / briefing.scopeOnlinePopulation) * 100).toFixed(1)}% of online pop.`
                              : (st.stageNum === 2 || st.stageNum === 3 || st.stageNum === 4) &&
                                briefing.scopeChurches > 0
                              ? `~${(data.targetSum / briefing.scopeChurches).toFixed(1)} per church`
                              : st.stageNum === 5 && briefing.scopeMembership > 0
                              ? `${((data.targetSum / briefing.scopeMembership) * 100).toFixed(1)}% of members`
                              : ''}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {renderInlineMatchedPreview(activeCoachingFilter.startsWith('stage_'), 'kpis')}

              {/* Portfolio-Level Strategic Balance & Bottleneck Advisories */}
              {briefing.portfolioInsights.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  {briefing.portfolioInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                        insight.type === 'warning'
                          ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                          : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                      }`}
                    >
                      {insight.type === 'warning' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-indigo-700 shrink-0 mt-0.5" />
                      )}
                      <span>{insight.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3B. SSD Project Review Framework: Readiness Verdict, 7-Question Checklist & 3-Pillar Sub-Type Matrix */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#1c398e] flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5 text-[#1c398e]" />
                    <span>SSD Project Review Checklist &amp; Pillar Match</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Overall readiness, 7 review questions, and project types — click any box to preview proposals
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="text-[11px] font-semibold text-slate-600 tabular-nums"
                    title="Percentage of proposals whose budget items match the chosen Strategic Pillar"
                  >
                    Budget Matches Pillar:{' '}
                    <strong className="text-emerald-700">{briefing.budgetAlignedPct}%</strong>
                  </span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <a
                    href={REVIEW_FRAMEWORK_PDF_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1c398e] hover:underline"
                    title="Open Southern Asia-Pacific Division OneVoice27 Project Review Framework PDF"
                  >
                    <span>Framework PDF</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* A. 3-Tier Readiness Verdict Bar + Interactive Filter Buttons */}
              <div className="space-y-2">
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  {briefing.readinessMeetingPct > 0 && (
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${briefing.readinessMeetingPct}%` }}
                      title={`Ready: ${briefing.readinessStats.meeting_requirement.count} proposals (${briefing.readinessMeetingPct}%)`}
                    />
                  )}
                  {briefing.readinessNeedsImpPct > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${briefing.readinessNeedsImpPct}%` }}
                      title={`Needs Small Fixes: ${briefing.readinessStats.needs_improvement.count} proposals (${briefing.readinessNeedsImpPct}%)`}
                    />
                  )}
                  {briefing.readinessNotFittingPct > 0 && (
                    <div
                      className="h-full bg-rose-600 transition-all duration-300"
                      style={{ width: `${briefing.readinessNotFittingPct}%` }}
                      title={`Needs Major Rework: ${briefing.readinessStats.not_fitting_pathways.count} proposals (${briefing.readinessNotFittingPct}%)`}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      {
                        cat: 'readiness_meeting' as CoachingFilterCategory,
                        label: 'Meeting Requirement',
                        stat: briefing.readinessStats.meeting_requirement,
                        pct: briefing.readinessMeetingPct,
                        dotClass: 'bg-emerald-600',
                        activeClass: 'ring-2 ring-emerald-600 bg-emerald-50/80 border-emerald-400',
                      },
                      {
                        cat: 'readiness_needs_improvement' as CoachingFilterCategory,
                        label: 'Needs Improvement',
                        stat: briefing.readinessStats.needs_improvement,
                        pct: briefing.readinessNeedsImpPct,
                        dotClass: 'bg-amber-500',
                        activeClass: 'ring-2 ring-amber-600 bg-amber-50/80 border-amber-400',
                      },
                      {
                        cat: 'readiness_not_fitting' as CoachingFilterCategory,
                        label: 'Not Fitting Pathways',
                        stat: briefing.readinessStats.not_fitting_pathways,
                        pct: briefing.readinessNotFittingPct,
                        dotClass: 'bg-rose-600',
                        activeClass: 'ring-2 ring-rose-600 bg-rose-50/80 border-rose-400',
                      },
                    ] as const
                  ).map((tier) => {
                    const isEmpty = tier.stat.count === 0;
                    const isSelected = activeCoachingFilter === tier.cat;
                    return (
                      <button
                        key={tier.cat}
                        type="button"
                        disabled={isEmpty}
                        onClick={() =>
                          handleToggleFilter(
                            tier.cat,
                            tier.stat.proposalIds,
                            `Readiness: ${tier.label}`
                          )
                        }
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                          isEmpty
                            ? 'bg-slate-50/50 border-dashed border-slate-200 text-slate-400 cursor-default'
                            : isSelected
                            ? `${tier.activeClass} cursor-pointer`
                            : 'bg-slate-50/90 hover:bg-slate-100 border-slate-200/90 text-slate-800 cursor-pointer'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${tier.dotClass}`} />
                            <span className="text-[11px] font-bold truncate">{tier.label}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 tabular-nums block mt-0.5">
                            US${formatCurrency(tier.stat.budget)} ({tier.pct}%)
                          </span>
                        </div>
                        <span className="text-sm font-black tabular-nums shrink-0">
                          {tier.stat.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {renderInlineMatchedPreview(activeCoachingFilter.startsWith('readiness_'))}
              </div>

              {/* B. 7-Question Review Checklist Bars */}
              <div className="pt-2.5 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>7 Review Questions (How Many Proposals Pass)</span>
                  <span>Click any question with gaps to preview proposals</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {briefing.questionCoverage.map((q) => {
                    const gapCount = q.deficientIds.length;
                    const isSelected = activeCoachingFilter === q.filterCat;
                    return (
                      <button
                        key={q.key}
                        type="button"
                        disabled={gapCount === 0}
                        onClick={() =>
                          handleToggleFilter(
                            q.filterCat,
                            q.deficientIds,
                            `Needs Help on Q${q.num}: ${q.shortTitle}`
                          )
                        }
                        className={`px-2.5 py-2 rounded-xl border text-left transition space-y-1 ${
                          gapCount === 0
                            ? 'bg-slate-50/50 border-slate-200/70 cursor-default'
                            : isSelected
                            ? 'ring-2 ring-amber-600 bg-amber-50/80 border-amber-400 cursor-pointer'
                            : 'bg-white hover:bg-amber-50/40 border-slate-200/90 hover:border-amber-300 cursor-pointer'
                        }`}
                        title={
                          gapCount === 0
                            ? `Q${q.num} ${q.shortTitle}: 100% of proposals pass this check`
                            : `Click to preview ${gapCount} ${gapCount === 1 ? 'proposal' : 'proposals'} needing help on Q${q.num} ${q.shortTitle}`
                        }
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-slate-800 truncate">
                            Q{q.num}. {q.shortTitle}
                          </span>
                          <span className="tabular-nums font-bold shrink-0">
                            <span
                              className={
                                q.passPct >= 85
                                  ? 'text-emerald-700'
                                  : q.passPct >= 65
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }
                            >
                              {q.passPct}%
                            </span>
                            {gapCount > 0 && (
                              <span className="text-[10px] text-amber-800 ml-1">
                                ({gapCount} to fix)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              q.passPct >= 85
                                ? 'bg-emerald-600'
                                : q.passPct >= 65
                                ? 'bg-amber-500'
                                : 'bg-rose-600'
                            }`}
                            style={{ width: `${q.passPct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {renderInlineMatchedPreview(activeCoachingFilter.startsWith('gap_q'), 'narrative')}
              </div>

              {/* C. 4 Project Types */}
              <div className="pt-2.5 border-t border-slate-100 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  4 Project Types (Training vs. Media Tools vs. Community Care vs. Evangelism)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {briefing.subTypeRows.map((row) => {
                    const isEmpty = row.count === 0;
                    const isSelected = activeCoachingFilter === row.filterCat;
                    return (
                      <button
                        key={row.key}
                        type="button"
                        disabled={isEmpty}
                        onClick={() =>
                          handleToggleFilter(
                            row.filterCat,
                            row.proposalIds,
                            row.meta.fullLabel
                          )
                        }
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isEmpty
                            ? 'bg-slate-50/40 border-dashed border-slate-200 text-slate-400 cursor-default'
                            : isSelected
                            ? 'ring-2 ring-[#1c398e] bg-blue-50/80 border-blue-400 cursor-pointer'
                            : 'bg-slate-50/90 hover:bg-blue-50/40 border-slate-200/90 text-slate-800 cursor-pointer'
                        }`}
                        title={row.meta.fullLabel}
                      >
                        <span className="text-[11px] font-extrabold leading-snug">
                          {row.meta.shortLabel}
                        </span>
                        <div className="mt-1.5 flex items-baseline justify-between gap-1 tabular-nums">
                          <span className="text-xs font-black text-[#1c398e]">
                            ${formatCurrency(row.budget)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600">
                            {row.count} ({row.sharePct}%)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {renderInlineMatchedPreview(activeCoachingFilter.startsWith('subtype_'), 'financials')}
              </div>
            </div>

            {/* 4. Option A: Ecosystem & Ministry Integration Matrix (Section 8: Points of Integration) */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#1c398e] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#1c398e]" />
                    <span>Ministry Partners &amp; Local Church Follow-Up (Section 8)</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Shows which Playbook teams, media centers, and church departments work together on these projects
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border tabular-nums ${
                      briefing.integratedProposalsPct >= 75
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                    }`}
                    title="Proposals that name at least one Playbook or church department partner in Section 8"
                  >
                    {briefing.integratedProposalsPct}% Name Partners ({briefing.integratedProposalsCount}/{briefing.totalCount} projs · Avg {briefing.avgPartnersPerProposal})
                  </span>

                  <span
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-[#1c398e] border border-blue-200 tabular-nums"
                    title="Proposals that connect both an online/media team AND a local church team to welcome people"
                  >
                    {briefing.endToEndHandoffCount} Full Media-to-Church Links ({briefing.endToEndHandoffPct}%)
                  </span>

                  {briefing.siloedIntegrationProposals.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleFilter(
                          'integration_siloed',
                          briefing.siloedIntegrationProposals.map((p) => p.id),
                          'Missing Partner Teams in Section 8'
                        )
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer tabular-nums ${
                        activeCoachingFilter === 'integration_siloed'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                      }`}
                      title="Click to preview & filter proposals with missing or unclear partner details in Section 8"
                    >
                      <Filter className="w-2.5 h-2.5" />
                      <span>
                        {briefing.siloedIntegrationProposals.length} Missing Partners
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {renderInlineMatchedPreview(
                activeCoachingFilter === 'integration_siloed',
                'narrative'
              )}

              {/* Top Collaborating Partners Plain ESL Line */}
              {(() => {
                const activePartners = [...briefing.integrationPartners]
                  .filter((p) => p.count > 0)
                  .sort((a, b) => b.count - a.count || b.budget - a.budget);

                if (activePartners.length === 0) {
                  return (
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950">
                      No partner ministries are named in Section 8 yet. Ask authors to write which media team, department, or local church team will work with them.
                    </div>
                  );
                }

                const top3 = activePartners.slice(0, 3);
                return (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-200/70">
                    <strong className="text-slate-900">Most Common Partners:</strong> Proposals work most often with{' '}
                    {top3.map((tp, idx) => (
                      <React.Fragment key={tp.id}>
                        {idx > 0 && (idx === top3.length - 1 ? ', and ' : ', ')}
                        <strong className="text-[#1c398e]">{tp.shortName}</strong> ({tp.count}{' '}
                        {tp.count === 1 ? 'proj' : 'projs'} · US${formatCurrency(tp.budget)})
                      </React.Fragment>
                    ))}
                    . Click any partner card below to preview matching proposals.
                  </p>
                );
              })()}

              {/* 3-Layer Ecosystem Partner Grids */}
              <div className="space-y-3">
                {(
                  [
                    {
                      layerKey: 'spine' as const,
                      title: '1. Main Follow-Up Path (Online Link → Online Responders → Local Church)',
                      gridCols: 'grid-cols-1 sm:grid-cols-3',
                    },
                    {
                      layerKey: 'department' as const,
                      title: '2. Church Departments & Community Ministries',
                      gridCols: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
                    },
                    {
                      layerKey: 'media' as const,
                      title: '3. TV, Radio & Publishing Teams',
                      gridCols: 'grid-cols-1 sm:grid-cols-3',
                    },
                  ] as const
                ).map((group) => {
                  const partnersInLayer = briefing.integrationPartners.filter(
                    (p) => p.layer === group.layerKey
                  );
                  return (
                    <div key={group.layerKey} className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {group.title}
                      </div>
                      <div className={`grid ${group.gridCols} gap-2`}>
                        {partnersInLayer.map((partner) => {
                          const isEmpty = partner.count === 0;
                          const isSelected = activeCoachingFilter === partner.id;
                          return (
                            <button
                              key={partner.id}
                              type="button"
                              disabled={isEmpty}
                              onClick={() =>
                                handleToggleFilter(
                                  partner.id,
                                  partner.proposalIds,
                                  `Partner: ${partner.fullName}`
                                )
                              }
                              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                isEmpty
                                  ? 'bg-slate-50/40 border-dashed border-slate-200 text-slate-400 cursor-default'
                                  : isSelected
                                  ? `${partner.activeRingClass} cursor-pointer shadow-xs`
                                  : 'bg-slate-50/90 hover:bg-blue-50/50 border-slate-200/90 hover:border-blue-300 text-slate-800 cursor-pointer'
                              }`}
                              title={
                                isEmpty
                                  ? `${partner.fullName}: 0 proposals in scope currently mention this partner`
                                  : `${partner.fullName} (${partner.roleHint}) — Click to filter ${partner.count} proposals (US$${formatCurrency(partner.budget)})`
                              }
                            >
                              <div>
                                <div className="flex items-start justify-between gap-1">
                                  <span
                                    className={`text-[11px] font-extrabold leading-tight ${
                                      isEmpty ? 'text-slate-400' : 'text-slate-900'
                                    }`}
                                  >
                                    {partner.shortName}
                                  </span>
                                  <span
                                    className={`text-[10px] font-black tabular-nums shrink-0 px-1.5 py-0.2 rounded ${
                                      isEmpty
                                        ? 'text-slate-400 bg-slate-100'
                                        : 'text-[#1c398e] bg-blue-100/70'
                                    }`}
                                  >
                                    {partner.count}
                                  </span>
                                </div>
                                <p className="text-[9.5px] text-slate-500 leading-snug mt-0.5 line-clamp-1">
                                  {partner.roleHint}
                                </p>
                              </div>

                              <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-between text-[10px] tabular-nums">
                                  <span
                                    className={`font-bold ${
                                      isEmpty ? 'text-slate-400' : 'text-[#1c398e]'
                                    }`}
                                  >
                                    ${formatCurrency(partner.budget)}
                                  </span>
                                  <span className="text-slate-400 font-semibold">
                                    {partner.shareOfProposalsPct}% of projs
                                  </span>
                                </div>
                                <div className="h-1 w-full bg-slate-200/70 rounded-full overflow-hidden">
                                  {partner.shareOfProposalsPct > 0 && (
                                    <div
                                      className={`h-full ${partner.barClass}`}
                                      style={{ width: `${partner.shareOfProposalsPct}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {renderInlineMatchedPreview(
                        partnersInLayer.some((p) => p.id === activeCoachingFilter),
                        'narrative'
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* RIGHT COLUMN (5 cols): ALIGNMENT & COACHING RECOMMENDATIONS       */}
          {/* ================================================================= */}
          <div className="lg:col-span-5 space-y-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-600" />
                    <span>Coaching &amp; Simple Ways to Improve Proposals</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click <strong>Filter Table</strong> to jump to matching proposals, or click a project name to open it
                  </p>
                </div>
              </div>

              {briefing.allFlaggedIds.size === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">All Proposals Look Clear and Ready!</p>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Every proposal has a clear budget list, good public outreach balance, clear goal numbers, and named follow-up teams.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* 0. Rebalance Portfolio Toward Frontline Public Outreach (when Frontline < 60%) */}
                  {briefing.needsFrontlineRebalance && (
                    <div
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        activeCoachingFilter === 'frontline_rebalance'
                          ? 'bg-purple-100/70 border-2 border-purple-600 shadow-2xs'
                          : 'bg-purple-50/50 border-purple-200/90 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Globe className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              Add Public Outreach to Member-Only Projects ({briefing.internalOnlyProposals.length})
                            </p>
                            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              Right now <strong>{briefing.internalSharePct}%</strong> of funds stay inside the church vs. <strong>{briefing.frontlineSharePct}%</strong> reaching the public (Playbook goal is ≥60%). Ask these authors how trained members will also invite or serve non-Adventist neighbors (Groups C–E).
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFilter(
                              'frontline_rebalance',
                              briefing.internalOnlyProposals.map((p) => p.id),
                              'Church-Only Proposals (Add Public Outreach)',
                              true
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                            activeCoachingFilter === 'frontline_rebalance'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white hover:bg-purple-100 text-purple-900 border border-purple-300'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>
                            {activeCoachingFilter === 'frontline_rebalance'
                              ? 'Filtered'
                              : 'Filter Table'}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {briefing.internalOnlyProposals.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onInspectProposal(p.id, 'kpis')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-purple-50 text-slate-800 hover:text-purple-900 border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                            title={`Church-only audience (US$${formatCurrency(p.budget)}) — click to review Target Audience & Goals`}
                          >
                            <span className="font-bold text-purple-800">{p.unionCode}:</span>
                            <span className="truncate max-w-[125px]">{p.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 1. Single-Line / Lump-Sum Budgets for Treasurer */}
                  {briefing.singleLineBudgetProposals.length > 0 && (
                    <div
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        activeCoachingFilter === 'single_line_budget'
                          ? 'bg-amber-100/70 border-2 border-amber-500 shadow-2xs'
                          : 'bg-amber-50/60 border-amber-200/90 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <DollarSign className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              1. Break Down the Budget into Clear Items ({briefing.singleLineBudgetProposals.length})
                            </p>
                            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              These proposals put the whole cost on 1 line, or mention activities without listing their cost. Ask the author to split Section 9 into 3–5 clear cost lines so the Treasurer can review it easily.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFilter(
                              'single_line_budget',
                              briefing.singleLineBudgetProposals.map((p) => p.id),
                              'Needs Clear Budget Breakdown (Section 9)',
                              true
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                            activeCoachingFilter === 'single_line_budget'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>
                            {activeCoachingFilter === 'single_line_budget' ? 'Filtered' : 'Filter Table'}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {briefing.singleLineBudgetProposals.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onInspectProposal(p.id, 'financials')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-slate-800 hover:text-[#1c398e] border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                            title="Open Proposal Budget (Section 9)"
                          >
                            <span className="font-bold text-[#1c398e]">{p.unionCode}:</span>
                            <span className="truncate max-w-[130px]">{p.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Playbook Handoff & Local Church Receiver Gaps */}
                  {briefing.playbookHandoffProposals.length > 0 && (
                    <div
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        activeCoachingFilter === 'playbook_handoff'
                          ? 'bg-blue-100/70 border-2 border-[#1c398e] shadow-2xs'
                          : 'bg-blue-50/50 border-blue-200/90 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <BookOpen className="w-4 h-4 text-[#1c398e] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              2. Name Who Will Follow Up with Interested People ({briefing.playbookHandoffProposals.length})
                            </p>
                            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              Section 8 does not clearly say who replies to seekers or welcomes them to church. Ask the author to name their online reply team (such as HopeStartsHere.asia or Digital Missionaries) and local church care team (such as Hope Care Teams or pastors).
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFilter(
                              'playbook_handoff',
                              briefing.playbookHandoffProposals.map((p) => p.id),
                              'Needs Named Follow-Up Team (Section 8)',
                              true
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                            activeCoachingFilter === 'playbook_handoff'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white hover:bg-blue-100 text-[#1c398e] border border-blue-300'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>
                            {activeCoachingFilter === 'playbook_handoff' ? 'Filtered' : 'Filter Table'}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {briefing.playbookHandoffProposals.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onInspectProposal(p.id, 'narrative')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-slate-800 hover:text-[#1c398e] border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                            title={p.issue}
                          >
                            <span className="font-bold text-[#1c398e]">{p.unionCode}:</span>
                            <span className="truncate max-w-[130px]">{p.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2B. Playbook Play 7 Sensitive Context & Local Platform Fit */}
                  {briefing.sensitivePlay7Proposals.length > 0 && (
                    <div
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        activeCoachingFilter === 'sensitive_play7'
                          ? 'bg-rose-100/70 border-2 border-rose-600 shadow-2xs'
                          : 'bg-rose-50/50 border-rose-200/90 hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              Use Safe Follow-Up &amp; Local Chat Apps in Sensitive Areas ({briefing.sensitivePlay7Proposals.length})
                            </p>
                            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              Projects in sensitive areas need private, safe follow-up (Playbook Play 7), local chat apps people actually use (like Zalo or LINE), and goals that fit local church size.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFilter(
                              'sensitive_play7',
                              briefing.sensitivePlay7Proposals.map((p) => p.id),
                              'Needs Safe Follow-Up (Play 7) or Local App Fit',
                              true
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                            activeCoachingFilter === 'sensitive_play7'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white hover:bg-rose-100 text-rose-900 border border-rose-300'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>
                            {activeCoachingFilter === 'sensitive_play7' ? 'Filtered' : 'Filter Table'}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {briefing.sensitivePlay7Proposals.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onInspectProposal(p.id, 'narrative')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-rose-50 text-slate-800 hover:text-rose-900 border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                            title={p.issue}
                          >
                            <span className="font-bold text-rose-800">{p.unionCode}:</span>
                            <span className="truncate max-w-[130px]">{p.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Target Audience vs. Narrative Contradictions */}
                  {briefing.audienceContradictionProposals.length > 0 && (
                    <div
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        activeCoachingFilter === 'audience_contradiction'
                          ? 'bg-amber-100/70 border-2 border-amber-500 shadow-2xs'
                          : 'bg-amber-50/60 border-amber-200/90 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              3. Match Target Audience Checkboxes to the Story ({briefing.audienceContradictionProposals.length})
                            </p>
                            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              The story talks about reaching the public, baptisms, or unreached people groups, but Section 7 only checked church members (A/B) or forgot Group E. Ask the author to check the matching boxes in Section 7.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFilter(
                              'audience_contradiction',
                              briefing.audienceContradictionProposals.map((p) => p.id),
                              'Target Audience Checkboxes Need Updating (Section 7)',
                              true
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                            activeCoachingFilter === 'audience_contradiction'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>
                            {activeCoachingFilter === 'audience_contradiction' ? 'Filtered' : 'Filter Table'}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {briefing.audienceContradictionProposals.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onInspectProposal(p.id, 'kpis')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-slate-800 hover:text-[#1c398e] border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                            title={p.issue}
                          >
                            <span className="font-bold text-[#1c398e]">{p.unionCode}:</span>
                            <span className="truncate max-w-[130px]">{p.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Target Goal Math & KPI Alignment */}
                  {briefing.kpiClarityProposals.length > 0 && (
                    <div
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        activeCoachingFilter === 'kpi_clarity'
                          ? 'bg-amber-100/70 border-2 border-amber-500 shadow-2xs'
                          : 'bg-slate-50 border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Layers className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              4. Write One Clear Goal Number &amp; Matching KPI ({briefing.kpiClarityProposals.length})
                            </p>
                            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              The Target Goal box has a math formula or long sentence instead of one total number, or the chosen KPI does not match the Global Objective. Ask the author to type one clear total number.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFilter(
                              'kpi_clarity',
                              briefing.kpiClarityProposals.map((p) => p.id),
                              'Needs One Clear Goal Number or Matching KPI',
                              true
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                            activeCoachingFilter === 'kpi_clarity'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>
                            {activeCoachingFilter === 'kpi_clarity' ? 'Filtered' : 'Filter Table'}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {briefing.kpiClarityProposals.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onInspectProposal(p.id, 'kpis')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-slate-800 hover:text-[#1c398e] border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                            title={p.issue}
                          >
                            <span className="font-bold text-[#1c398e]">{p.unionCode}:</span>
                            <span className="truncate max-w-[130px]">{p.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Ethical Community Service & Voluntary Consent Safeguard (Pillar 2B) */}
                  {briefing.serviceSafeguardProposals.length > 0 && (
                    <div
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        activeCoachingFilter === 'safeguard_service'
                          ? 'bg-teal-100/70 border-2 border-teal-600 shadow-2xs'
                          : 'bg-teal-50/50 border-teal-200/90 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <ClipboardCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              State That Community Help Is Free for All ({briefing.serviceSafeguardProposals.length})
                            </p>
                            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              Health and community care projects must clearly write two things: (1) help is given freely to everyone with no religious requirement, and (2) we only invite people to Bible study if they say yes.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFilter(
                              'safeguard_service',
                              briefing.serviceSafeguardProposals.map((p) => p.id),
                              'Add Free Community Help & Voluntary Follow-Up Note',
                              true
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                            activeCoachingFilter === 'safeguard_service'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white hover:bg-teal-100 text-teal-900 border border-teal-300'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>
                            {activeCoachingFilter === 'safeguard_service' ? 'Filtered' : 'Filter Table'}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {briefing.serviceSafeguardProposals.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onInspectProposal(p.id, 'narrative')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-teal-50 text-slate-800 hover:text-teal-900 border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                            title={p.issue}
                          >
                            <span className="font-bold text-teal-800">{p.unionCode}:</span>
                            <span className="truncate max-w-[130px]">{p.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 6. Primary Pillar vs. Budget Use Mismatch ("Tool Maker vs. Tool User") */}
                  {briefing.pillarBudgetMismatchProposals.length > 0 && (
                    <div
                      className={`p-3 rounded-xl border transition space-y-2 ${
                        activeCoachingFilter === 'pillar_budget_mismatch'
                          ? 'bg-amber-100/70 border-2 border-amber-500 shadow-2xs'
                          : 'bg-amber-50/50 border-amber-200/90 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <DollarSign className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              Match Chosen Pillar with What the Budget Buys ({briefing.pillarBudgetMismatchProposals.length})
                            </p>
                            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                              These Pillar 3 (Evangelism) proposals spend 75% or more on studio gear or making videos, with US$0 for public outreach or visitor follow-up. Either add outreach/follow-up costs in Section 9, or move the project to Pillar 2 (Making Tools).
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleFilter(
                              'pillar_budget_mismatch',
                              briefing.pillarBudgetMismatchProposals.map((p) => p.id),
                              'Budget Does Not Match Chosen Pillar',
                              true
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                            activeCoachingFilter === 'pillar_budget_mismatch'
                              ? 'bg-slate-900 text-white'
                              : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          <Filter className="w-3 h-3" />
                          <span>
                            {activeCoachingFilter === 'pillar_budget_mismatch' ? 'Filtered' : 'Filter Table'}
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {briefing.pillarBudgetMismatchProposals.slice(0, 4).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onInspectProposal(p.id, 'financials')}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-amber-50 text-slate-800 hover:text-amber-900 border border-slate-200 text-[10px] font-semibold transition cursor-pointer"
                            title={p.issue}
                          >
                            <span className="font-bold text-amber-800">{p.unionCode}:</span>
                            <span className="truncate max-w-[130px]">{p.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
