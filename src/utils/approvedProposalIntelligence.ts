import {
  Proposal,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getCanonicalDivisionProject,
  KPI_OPTIONS,
} from '../types';
import { parseKpiTargetNumber } from './kpiExtraction';
import { PUBLIC_MONITOR_STORAGE_KEY, PublicMonitorSnapshot } from '../services/publicMonitorService';

export interface ProvenBudgetCategory {
  id: string;
  label: string;
  frequency: number;
  avgAmount: number | null;
  sampleUnions: string[];
  isObjectiveMatch: boolean;
}

export interface KpiPeerBenchmark {
  kpiType: string;
  kpiLabel: string;
  approvedCount: number;
  medianTarget: number | null;
  avgTarget: number | null;
  minTarget: number | null;
  maxTarget: number | null;
  avgGrantForKpi: number | null;
  currentTargetValue: number | null;
  comparisonStatus: 'aligned' | 'above_typical' | 'below_typical' | 'insufficient_data';
  comparisonMessage: string;
}

export interface AudiencePeerPattern {
  audienceId: string;
  count: number;
  percentage: number;
}

export interface ApprovedExemplarSummary {
  id: string;
  title: string;
  unionAcronym: string;
  divisionProject: string;
  kpiType: string;
  kpiShortLabel: string;
  formattedTarget: string;
  totalGrant: number;
  budgetLineCount: number;
  budgetActivities: string[];
  targetAudiences: string[];
}

export interface ApprovedProposalIntelligence {
  totalSsdApprovedCount: number;
  matchingObjectiveApprovedCount: number;
  isObjectiveSpecific: boolean;
  scopeLabel: string;
  avgBudgetLineCount: number;
  avgApprovedGrant: number;
  minApprovedGrant: number;
  maxApprovedGrant: number;
  provenBudgetCategories: ProvenBudgetCategory[];
  kpiBenchmark: KpiPeerBenchmark | null;
  audiencePatterns: AudiencePeerPattern[];
  recommendedPeerAudience: {
    audienceId: string;
    percentage: number;
    reason: string;
  } | null;
  exemplars: ApprovedExemplarSummary[];
}

interface NormalizedApprovedRecord {
  id: string;
  title: string;
  unionAcronym: string;
  canonObjective: string;
  rawObjective: string;
  strategicFocus: string;
  kpiType: string;
  targetValue: number | null;
  formattedTarget: string;
  totalGrant: number;
  budgetLineCount: number;
  budgetLines: { activity: string; amount: number }[];
  targetAudiences: string[];
}

const GENERIC_LUMP_SUM_STOPWORDS = new Set([
  'budget',
  'project budget',
  'total budget',
  'total',
  'grant',
  'division funding',
  'funding',
  'all activities',
  'general',
  'miscellaneous',
  'others',
  'other',
  'n/a',
  'tbd',
  'none',
]);

function isMeaningfulBudgetActivity(raw: string): boolean {
  const clean = (raw || '').trim();
  if (clean.length < 4 || clean.length > 95) return false;
  const lower = clean.toLowerCase();
  if (GENERIC_LUMP_SUM_STOPWORDS.has(lower)) return false;
  // Exclude pure numbers
  if (/^\d+$/.test(clean)) return false;
  return true;
}

/**
 * Canonicalizes a raw budget activity string into a clean, reusable category key
 * while preserving the best human-readable label.
 */
function normalizeActivityCategoryKey(raw: string): string {
  const lower = raw.toLowerCase().trim();

  if (/boost|facebook ad|meta ad|social media ad|paid ad|digital ad|sponsored|promotion/.test(lower)) {
    return 'cat_digital_ad_boosting';
  }
  if (/camera|microphone|lighting|studio|equipment|gear|audio|hardware|led|switcher/.test(lower)) {
    return 'cat_production_equipment';
  }
  if (/software|canva|adobe|capcut|zoom|streamyard|subscription|cloud|hosting|platform|website|app/.test(lower)) {
    return 'cat_software_platforms';
  }
  if (/video|filming|editing|post-production|documentary|short film|reel|podcast|radio|broadcast/.test(lower)) {
    return 'cat_media_production';
  }
  if (/print|book|tract|lesson|bible study guide|pamphlet|literature|publication|collateral/.test(lower)) {
    return 'cat_printed_literature';
  }
  if (/translation|dubbing|subtitl|vernacular|language|localization/.test(lower)) {
    return 'cat_translation_localization';
  }
  if (/venue|hall|auditorium|tent|sound system rental|stage|facility rental/.test(lower)) {
    return 'cat_venue_facility';
  }
  if (/food|catering|meal|refreshment|hospitality|accommodation|lodging|hotel/.test(lower)) {
    return 'cat_meals_hospitality';
  }
  if (/transport|travel|fuel|airfare|bus|logistics|shipping|freight|delivery/.test(lower)) {
    return 'cat_transport_logistics';
  }
  if (/stipend|allowance|honorarium|speaker|bible worker|coordinator|volunteer|incentive/.test(lower)) {
    return 'cat_stipends_allowances';
  }
  if (/training|seminar|workshop|bootcamp|summit|orientation|coaching|curriculum/.test(lower)) {
    return 'cat_training_workshops';
  }
  if (/follow-up|visitation|care group|small group|baptism|nurtur|seeker|counseling/.test(lower)) {
    return 'cat_followup_discipleship';
  }
  if (/medical|health|clinic|dental|screening|community service|relief/.test(lower)) {
    return 'cat_community_bridge';
  }

  // Fallback normalized key based on alphanumeric tokens
  return 'raw_' + lower.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

const STANDARD_CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  cat_digital_ad_boosting: 'Social Media Boosting & Digital Ad Campaigns',
  cat_production_equipment: 'Production Equipment, Audio & Studio Gear',
  cat_software_platforms: 'Digital Tools, Software & Streaming Subscriptions',
  cat_media_production: 'Content Filming, Editing & Media Production',
  cat_printed_literature: 'Bible Study Guides & Printed Outreach Literature',
  cat_translation_localization: 'Translation, Dubbing & Local Language Subtitling',
  cat_venue_facility: 'Venue, Hall & Sound System Rental',
  cat_meals_hospitality: 'Participant Meals, Refreshments & Hospitality',
  cat_transport_logistics: 'Field Transportation, Travel & Distribution Logistics',
  cat_stipends_allowances: 'Digital Missionary / Volunteer Stipends & Honoraria',
  cat_training_workshops: 'Training Workshops, Seminars & Mobilization Kits',
  cat_followup_discipleship: 'Seeker Follow-Up, Care Groups & Baptismal Materials',
  cat_community_bridge: 'Community Bridge Events & Health/Compassion Outreach',
};

function getKpiShortLabel(kpiType: string): string {
  const found = KPI_OPTIONS.find((k) => k.id === kpiType);
  if (!found) return 'Target';
  return found.title.split('&')[0].trim();
}

/**
 * Collects all normalized approved proposal records from both:
 * 1) Full Proposal[] in memory
 * 2) PublicMonitorSnapshot in localStorage (if available, for single-union authors)
 */
function gatherApprovedRecords(
  currentProposalId: string,
  allProposals?: Proposal[]
): NormalizedApprovedRecord[] {
  const byId = new Map<string, NormalizedApprovedRecord>();

  // 1. Process full Proposal objects first (richest data with per-line amounts)
  if (allProposals && allProposals.length > 0) {
    for (const p of allProposals) {
      if (!p || p.id === currentProposalId) continue;
      const isApproved = p.status === 'approved' || Boolean(p.unionApproval?.actionNumber);
      if (!isApproved) continue;

      const canonUnion = getCanonicalUnion(p.union);
      const unionAcronym = UNION_ACRONYMS[p.union] || UNION_ACRONYMS[canonUnion] || 'SSD';
      const canonObjective = getCanonicalDivisionProject(p.divisionProject) || (p.divisionProject || '').trim();
      const parsedTarget = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);

      const budgetLines = (p.budgetItems || [])
        .map((it) => ({
          activity: (it.activity || '').trim(),
          amount: Number(it.divisionFunding ?? it.gcFunding) || 0,
        }))
        .filter((it) => it.activity.length > 0 || it.amount > 0);

      const totalGrant = budgetLines.reduce((sum, it) => sum + it.amount, 0);

      byId.set(p.id, {
        id: p.id,
        title: (p.title || '').trim() || 'Approved Project',
        unionAcronym,
        canonObjective,
        rawObjective: (p.divisionProject || '').trim(),
        strategicFocus: (p.strategicFocus || '').trim(),
        kpiType: p.kpiType || '',
        targetValue: parsedTarget.value,
        formattedTarget: parsedTarget.formatted || (p.kpiNumber || '').trim(),
        totalGrant,
        budgetLineCount: budgetLines.length,
        budgetLines,
        targetAudiences: Array.isArray(p.targetAudiences) ? p.targetAudiences : [],
      });
    }
  }

  // 2. Supplement with public_monitor cache so single-union users also learn from all 14 territories
  try {
    const rawSnapshot = localStorage.getItem(PUBLIC_MONITOR_STORAGE_KEY);
    if (rawSnapshot) {
      const snap = JSON.parse(rawSnapshot) as PublicMonitorSnapshot;
      if (snap && Array.isArray(snap.projectSummaries)) {
        for (const s of snap.projectSummaries) {
          if (!s || s.id === currentProposalId || byId.has(s.id)) continue;
          if (s.status !== 'approved') continue;

          const canonObjective =
            getCanonicalDivisionProject(s.divisionProject) || (s.divisionProject || '').trim();
          const activities = Array.isArray(s.budgetActivities) ? s.budgetActivities : [];
          const lineCount =
            typeof s.budgetLineCount === 'number' ? s.budgetLineCount : activities.length;

          byId.set(s.id, {
            id: s.id,
            title: (s.title || '').trim() || 'Approved Project',
            unionAcronym: s.acronym || UNION_ACRONYMS[s.union] || 'SSD',
            canonObjective,
            rawObjective: (s.divisionProject || '').trim(),
            strategicFocus: (s.strategicFocus || '').trim(),
            kpiType: s.kpiType || '',
            targetValue: typeof s.targetNumericValue === 'number' ? s.targetNumericValue : null,
            formattedTarget: s.formattedTarget || '',
            totalGrant: Number(s.divisionGrant ?? s.totalBudget) || 0,
            budgetLineCount: lineCount,
            budgetLines: activities.map((act) => ({
              activity: act,
              amount: lineCount > 0 ? Math.round((Number(s.divisionGrant) || 0) / lineCount) : 0,
            })),
            targetAudiences: Array.isArray(s.targetAudiences) ? s.targetAudiences : [],
          });
        }
      }
    }
  } catch {
    // ignore storage read issues
  }

  return Array.from(byId.values());
}

/**
 * Computes live intelligence, budget breakdown categories, KPI target benchmarks,
 * and audience patterns from Approved SSD Proposals.
 */
export function getApprovedProposalIntelligence(
  proposal: Proposal,
  allProposals?: Proposal[]
): ApprovedProposalIntelligence {
  const allApproved = gatherApprovedRecords(proposal.id, allProposals);
  const currentCanonObjective =
    getCanonicalDivisionProject(proposal.divisionProject) || (proposal.divisionProject || '').trim();

  const objectivePeers = currentCanonObjective
    ? allApproved.filter(
        (r) =>
          r.canonObjective.toLowerCase() === currentCanonObjective.toLowerCase() ||
          (r.rawObjective &&
            r.rawObjective.toLowerCase() === (proposal.divisionProject || '').trim().toLowerCase())
      )
    : [];

  const isObjectiveSpecific = objectivePeers.length > 0;
  const activePeers = isObjectiveSpecific ? objectivePeers : allApproved;
  const scopeLabel = isObjectiveSpecific
    ? currentCanonObjective
    : 'All Approved SSD Proposals';

  // 1. Budget stats in active peer group
  const peersWithGrant = activePeers.filter((p) => p.totalGrant > 0);
  const avgApprovedGrant =
    peersWithGrant.length > 0
      ? Math.round(peersWithGrant.reduce((sum, p) => sum + p.totalGrant, 0) / peersWithGrant.length)
      : 0;
  const minApprovedGrant =
    peersWithGrant.length > 0 ? Math.min(...peersWithGrant.map((p) => p.totalGrant)) : 0;
  const maxApprovedGrant =
    peersWithGrant.length > 0 ? Math.max(...peersWithGrant.map((p) => p.totalGrant)) : 0;

  const multiLinePeers = activePeers.filter((p) => p.budgetLineCount >= 2);
  const avgBudgetLineCount =
    multiLinePeers.length > 0
      ? Number(
          (
            multiLinePeers.reduce((sum, p) => sum + p.budgetLineCount, 0) / multiLinePeers.length
          ).toFixed(1)
        )
      : activePeers.length > 0
      ? Number(
          (
            activePeers.reduce((sum, p) => sum + Math.max(1, p.budgetLineCount), 0) /
            activePeers.length
          ).toFixed(1)
        )
      : 0;

  // 2. Proven Budget Categories learned from Approved Proposals
  // Check what categories the current proposal already has so we only suggest missing ones
  const existingCategoryKeys = new Set(
    (proposal.budgetItems || [])
      .map((it) => (it.activity || '').trim())
      .filter(Boolean)
      .map((act) => normalizeActivityCategoryKey(act))
  );
  const existingActivitiesLower = (proposal.budgetItems || [])
    .map((it) => (it.activity || '').toLowerCase())
    .join(' | ');

  const categoryMap = new Map<
    string,
    {
      key: string;
      rawLabels: string[];
      frequency: number;
      amounts: number[];
      unions: Set<string>;
      isObjectiveMatch: boolean;
    }
  >();

  // Prioritize objective peers first, then supplement with allApproved if needed
  const poolForCategories =
    objectivePeers.length >= 2 ? objectivePeers : [...objectivePeers, ...allApproved];

  const seenProposalCatPair = new Set<string>();
  for (const peer of poolForCategories) {
    const isObjMatch =
      Boolean(currentCanonObjective) &&
      peer.canonObjective.toLowerCase() === currentCanonObjective.toLowerCase();

    for (const line of peer.budgetLines) {
      if (!isMeaningfulBudgetActivity(line.activity)) continue;
      const catKey = normalizeActivityCategoryKey(line.activity);
      if (existingCategoryKeys.has(catKey)) continue;

      const pairKey = `${peer.id}::${catKey}`;
      if (seenProposalCatPair.has(pairKey)) continue;
      seenProposalCatPair.add(pairKey);

      const existing = categoryMap.get(catKey);
      if (!existing) {
        categoryMap.set(catKey, {
          key: catKey,
          rawLabels: [line.activity],
          frequency: 1,
          amounts: line.amount > 0 ? [line.amount] : [],
          unions: new Set([peer.unionAcronym]),
          isObjectiveMatch: isObjMatch,
        });
      } else {
        existing.frequency += 1;
        existing.rawLabels.push(line.activity);
        if (line.amount > 0) existing.amounts.push(line.amount);
        existing.unions.add(peer.unionAcronym);
        if (isObjMatch) existing.isObjectiveMatch = true;
      }
    }
  }

  const provenBudgetCategories: ProvenBudgetCategory[] = Array.from(categoryMap.values())
    .map((entry) => {
      const displayLabel =
        STANDARD_CATEGORY_DISPLAY_LABELS[entry.key] ||
        entry.rawLabels.sort((a, b) => a.length - b.length)[0];
      const avgAmount =
        entry.amounts.length > 0
          ? Math.round(entry.amounts.reduce((s, v) => s + v, 0) / entry.amounts.length)
          : null;
      return {
        id: entry.key,
        label: displayLabel,
        frequency: entry.frequency,
        avgAmount,
        sampleUnions: Array.from(entry.unions).slice(0, 3),
        isObjectiveMatch: entry.isObjectiveMatch,
      };
    })
    .filter((cat) => {
      const firstWord = cat.label.toLowerCase().split(/\s+/)[0];
      return !existingActivitiesLower.includes(firstWord);
    })
    .sort((a, b) => {
      if (a.isObjectiveMatch !== b.isObjectiveMatch) {
        return a.isObjectiveMatch ? -1 : 1;
      }
      return b.frequency - a.frequency;
    })
    .slice(0, 6);

  // 3. KPI Target Benchmark from Approved Proposals with the same Primary KPI
  let kpiBenchmark: KpiPeerBenchmark | null = null;
  if (proposal.kpiType) {
    const kpiPeers = allApproved.filter(
      (p) => p.kpiType === proposal.kpiType && p.targetValue !== null && p.targetValue > 0
    );
    const kpiOption = KPI_OPTIONS.find((k) => k.id === proposal.kpiType);
    const kpiLabel = kpiOption ? kpiOption.title : proposal.kpiType;

    const currentParsed = parseKpiTargetNumber(
      proposal.kpiNumber,
      proposal.kpiDescription,
      proposal.kpiType
    );
    const currentVal = currentParsed.value;

    if (kpiPeers.length > 0) {
      const sortedTargets = kpiPeers
        .map((p) => p.targetValue as number)
        .sort((a, b) => a - b);
      const mid = Math.floor(sortedTargets.length / 2);
      const medianTarget =
        sortedTargets.length % 2 !== 0
          ? sortedTargets[mid]
          : Math.round((sortedTargets[mid - 1] + sortedTargets[mid]) / 2);
      const avgTarget = Math.round(
        sortedTargets.reduce((s, v) => s + v, 0) / sortedTargets.length
      );
      const minTarget = sortedTargets[0];
      const maxTarget = sortedTargets[sortedTargets.length - 1];
      const avgGrantForKpi = Math.round(
        kpiPeers.reduce((s, p) => s + p.totalGrant, 0) / kpiPeers.length
      );

      let comparisonStatus: KpiPeerBenchmark['comparisonStatus'] = 'aligned';
      let comparisonMessage = `Approved SSD proposals using "${kpiLabel}" typically target around ${medianTarget.toLocaleString()} (range: ${minTarget.toLocaleString()} – ${maxTarget.toLocaleString()}).`;

      if (currentVal !== null && currentVal > 0 && medianTarget > 0) {
        if (currentVal > maxTarget * 2 && currentVal > medianTarget * 5) {
          comparisonStatus = 'above_typical';
          comparisonMessage = `Your target (${currentVal.toLocaleString()}) is significantly higher than approved SSD peers for this KPI (median: ${medianTarget.toLocaleString()}, max: ${maxTarget.toLocaleString()}). Ensure Section 5 Metric Details & Rationale explain how this scale will be achieved.`;
        } else if (currentVal < minTarget * 0.4 && currentVal < medianTarget * 0.25) {
          comparisonStatus = 'below_typical';
          comparisonMessage = `Your target (${currentVal.toLocaleString()}) is lower than typical approved SSD peers for this KPI (median: ${medianTarget.toLocaleString()}). Consider whether your target captures the full project reach/impact.`;
        } else {
          comparisonStatus = 'aligned';
          comparisonMessage = `Your target (${currentVal.toLocaleString()}) is well-aligned with the ${kpiPeers.length} approved SSD proposals using this KPI (median: ${medianTarget.toLocaleString()}).`;
        }
      }

      kpiBenchmark = {
        kpiType: proposal.kpiType,
        kpiLabel,
        approvedCount: kpiPeers.length,
        medianTarget,
        avgTarget,
        minTarget,
        maxTarget,
        avgGrantForKpi,
        currentTargetValue: currentVal,
        comparisonStatus,
        comparisonMessage,
      };
    }
  }

  // 4. Target Audience Patterns from Approved Proposals in Scope
  const peersWithAudiences = activePeers.filter((p) => p.targetAudiences.length > 0);
  const audCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const p of peersWithAudiences) {
    for (const aud of p.targetAudiences) {
      if (audCounts[aud] !== undefined) {
        audCounts[aud] += 1;
      }
    }
  }

  const audiencePatterns: AudiencePeerPattern[] = Object.entries(audCounts)
    .filter(([, count]) => count > 0)
    .map(([audienceId, count]) => ({
      audienceId,
      count,
      percentage:
        peersWithAudiences.length > 0
          ? Math.round((count / peersWithAudiences.length) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const selectedAudiences = new Set(proposal.targetAudiences || []);
  let recommendedPeerAudience: ApprovedProposalIntelligence['recommendedPeerAudience'] = null;
  if (isObjectiveSpecific && peersWithAudiences.length >= 2) {
    const topUnselected = audiencePatterns.find(
      (ap) => !selectedAudiences.has(ap.audienceId) && ap.percentage >= 55
    );
    if (topUnselected) {
      recommendedPeerAudience = {
        audienceId: topUnselected.audienceId,
        percentage: topUnselected.percentage,
        reason: `${topUnselected.percentage}% of approved proposals in "${scopeLabel}" include Group ${topUnselected.audienceId}.`,
      };
    }
  }

  // 5. Exemplar Approved Proposals (Prioritize multi-line budgets + quantified targets)
  const exemplars: ApprovedExemplarSummary[] = [...activePeers]
    .sort((a, b) => {
      const aScore = (a.budgetLineCount >= 2 ? 10 : 0) + (a.targetValue ? 5 : 0) + a.budgetLineCount;
      const bScore = (b.budgetLineCount >= 2 ? 10 : 0) + (b.targetValue ? 5 : 0) + b.budgetLineCount;
      return bScore - aScore;
    })
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      title: p.title,
      unionAcronym: p.unionAcronym,
      divisionProject: p.canonObjective || p.rawObjective,
      kpiType: p.kpiType,
      kpiShortLabel: getKpiShortLabel(p.kpiType),
      formattedTarget: p.formattedTarget || 'Quantified',
      totalGrant: p.totalGrant,
      budgetLineCount: p.budgetLineCount,
      budgetActivities: p.budgetLines
        .map((l) => l.activity)
        .filter((act) => isMeaningfulBudgetActivity(act))
        .slice(0, 4),
      targetAudiences: p.targetAudiences,
    }));

  return {
    totalSsdApprovedCount: allApproved.length,
    matchingObjectiveApprovedCount: objectivePeers.length,
    isObjectiveSpecific,
    scopeLabel,
    avgBudgetLineCount,
    avgApprovedGrant,
    minApprovedGrant,
    maxApprovedGrant,
    provenBudgetCategories,
    kpiBenchmark,
    audiencePatterns,
    recommendedPeerAudience,
    exemplars,
  };
}
