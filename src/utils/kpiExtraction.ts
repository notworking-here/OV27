import { Proposal, KPIType, getCanonicalKpiType, KPI_OPTIONS } from '../types';

export interface ExtractedKpiTarget {
  value: number | null;
  formatted: string;
  raw: string;
  source: 'target_goal' | 'metric_details' | 'none';
  unitLabel: string;
  shortUnit: string;
  confidence: 'high' | 'medium' | 'none';
}

export interface KpiProposalItem {
  id: string;
  title: string;
  union: string;
  status: string;
  extractedValue: number;
  rawInput: string;
  source: 'target_goal' | 'metric_details' | 'none';
  kpiType: KPIType;
}

export interface KpiMetricBreakdown {
  kpiType: KPIType;
  title: string;
  kpiNumber: number;
  unitLabel: string;
  shortUnit: string;
  totalTarget: number;
  approvedTarget: number;
  pendingTarget: number;
  totalProposalsCount: number;
  quantifiedProposalsCount: number;
  proposals: KpiProposalItem[];
}

export interface TerritoryKpiExtractionSummary {
  grandTotalTarget: number;
  approvedGrandTotalTarget: number;
  pendingGrandTotalTarget: number;
  totalProposalsCount: number;
  totalQuantifiedProposals: number;
  kpiBreakdowns: Record<KPIType, KpiMetricBreakdown>;
}

export const KPI_METRIC_META: Record<
  KPIType,
  {
    title: string;
    number: number;
    unitLabel: string;
    shortUnit: string;
    color: string;
    badgeBg: string;
    textColor: string;
    borderColor: string;
  }
> = {
  reach_exposure: {
    title: 'Reach & Exposure',
    number: 1,
    unitLabel: 'Public Reach (Views, Listeners, Impressions)',
    shortUnit: 'reach & views',
    color: 'emerald',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  engagement_participation: {
    title: 'Engagement & Digital Connection',
    number: 2,
    unitLabel: 'Direct Engagements (Inquiries, Comments, Conversations)',
    shortUnit: 'engagements & contacts',
    color: 'blue',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  connection_next_steps: {
    title: 'Connection & Bridging Handoff',
    number: 3,
    unitLabel: 'Bridging Attendees (Seminar Sign-ups, In-Person Guests)',
    shortUnit: 'attendees & sign-ups',
    color: 'purple',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
  },
  retention_nurturing: {
    title: 'Discipleship & Retention',
    number: 4,
    unitLabel: 'Discipleship (Active Bible Studies, Baptisms)',
    shortUnit: 'disciples & studies',
    color: 'indigo',
    badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
  },
  implementation_capability: {
    title: 'Mobilization & Capability Building',
    number: 5,
    unitLabel: 'Mobilized Personnel (Trained Leaders, Creators, Units)',
    shortUnit: 'trained & mobilized',
    color: 'amber',
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  '': {
    title: 'Unassigned Metric',
    number: 0,
    unitLabel: 'Measurable Target',
    shortUnit: 'target',
    color: 'slate',
    badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
  },
};

/**
 * Format a quantifiable KPI number into clean compact human-readable representation
 * e.g., 1,500,000 -> 1.5M, 50,000 -> 50K, 450 -> 450
 */
export function formatMetricCount(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  if (val === 0) return '0';
  if (val >= 1_000_000) {
    const m = val / 1_000_000;
    return `${Number(m.toFixed(m >= 10 ? 1 : 2))}M`;
  }
  if (val >= 10_000) {
    const k = val / 1_000;
    return `${Number(k.toFixed(k >= 100 ? 0 : 1))}K`;
  }
  return val.toLocaleString();
}

/**
 * Clean and extract a single target number from freeform text string.
 * Filters out:
 *  - Currency amounts ($4,000, US$500, 50,000 PHP, etc.)
 *  - Calendar years (2024 - 2035)
 *  - Numbered list headers (1., 2), Step 1, Objective 3)
 * Handles:
 *  - Range expressions ("150 - 200", "150 to 200") -> returns upper bound
 *  - Multipliers ("50k", "1.5M", "2 million", "500K")
 *  - Comma separated numbers ("50,000", "1,200")
 */
function extractNumberFromText(rawText?: string): { value: number | null; matchedRaw: string } {
  if (!rawText || !rawText.trim()) {
    return { value: null, matchedRaw: '' };
  }

  let text = rawText.trim();

  // 1. Remove currency values so project budgets don't pollute metric counts
  // e.g., "$5,000", "US$ 10,000", "5,000 USD", "₱50,000", "50,000 PHP"
  text = text.replace(
    /(?:\$|US\$|USD|₱|PHP|IDR|MYR|SGD)\s*[\d,]+(?:\.\d+)?/gi,
    ' '
  );
  text = text.replace(
    /[\d,]+(?:\.\d+)?\s*(?:USD|dollars?|pesos?|PHP|IDR|MYR|SGD)\b/gi,
    ' '
  );

  // 2. Remove calendar years (2024 through 2035)
  text = text.replace(/\b20(?:2[4-9]|3[0-5])\b/g, ' ');

  // 3. Remove list indices & structural labels e.g., "1.", "2)", "Step 1", "Objective 2", "Pillar 1", "Touch Point 2"
  text = text.replace(/(?:^|\n|\s)\d+[\.\)]\s*/g, ' ');
  text = text.replace(
    /\b(?:step|objective|kpi|pillar|touch\s*point|class)\s*\d+\b/gi,
    ' '
  );

  // 4. Check for range expressions e.g. "150 - 200", "150 to 200", "10,000 - 15,000"
  // When ranges are given, extract the upper bound as the full target potential
  const rangeRegex =
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m|b|million|thousand|billion)?\b/i;
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    const upperRaw = rangeMatch[2].replace(/,/g, '');
    const multiplierRaw = (rangeMatch[3] || '').toLowerCase();
    let num = parseFloat(upperRaw);
    if (!isNaN(num) && num > 0) {
      if (multiplierRaw.startsWith('m')) num *= 1_000_000;
      else if (multiplierRaw.startsWith('k') || multiplierRaw.startsWith('thous')) num *= 1_000;
      else if (multiplierRaw.startsWith('b')) num *= 1_000_000_000;
      return { value: Math.round(num), matchedRaw: rangeMatch[0].trim() };
    }
  }

  // 5. Look for numbers with multipliers (e.g. "50k", "1.5M", "500K", "2.5 million", "50k+")
  const multiplierRegex =
    /\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*(k|m|b|million|thousand|billion)\+?\b/i;
  const multMatch = text.match(multiplierRegex);
  if (multMatch) {
    const rawDigits = multMatch[1].replace(/,/g, '');
    const unit = multMatch[2].toLowerCase();
    let num = parseFloat(rawDigits);
    if (!isNaN(num) && num > 0) {
      if (unit.startsWith('m')) num *= 1_000_000;
      else if (unit.startsWith('k') || unit.startsWith('thous')) num *= 1_000;
      else if (unit.startsWith('b')) num *= 1_000_000_000;
      return { value: Math.round(num), matchedRaw: multMatch[0].trim() };
    }
  }

  // 6. Look for general positive numbers (with commas or decimals)
  // Prioritize larger numbers or numbers paired with count words (e.g., views, people, youth, listeners, attendees)
  const numbersRegex = /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\b/g;
  const matches = Array.from(text.matchAll(numbersRegex));

  if (matches.length > 0) {
    // If multiple numbers exist, check if any is followed by an impact noun
    const impactKeywords = [
      'people',
      'views',
      'listeners',
      'participants',
      'attendees',
      'youth',
      'visitors',
      'subscribers',
      'inquiries',
      'baptisms',
      'disciples',
      'contacts',
      'leaders',
      'missionaries',
      'churches',
      'episodes',
      'seminars',
    ];

    for (const m of matches) {
      const idx = m.index ?? 0;
      const snippet = text.slice(idx, idx + 40).toLowerCase();
      const hasImpactWord = impactKeywords.some((kw) => snippet.includes(kw));
      if (hasImpactWord) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
          return { value: Math.round(val), matchedRaw: m[1] };
        }
      }
    }

    // Default to the largest valid number if no specific keyword matched
    let bestVal: number | null = null;
    let bestRaw = '';
    for (const m of matches) {
      const parsed = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        if (bestVal === null || parsed > bestVal) {
          bestVal = parsed;
          bestRaw = m[1];
        }
      }
    }

    if (bestVal !== null) {
      return { value: Math.round(bestVal), matchedRaw: bestRaw };
    }
  }

  return { value: null, matchedRaw: '' };
}

/**
 * Parses freeform KPI input fields ("Target Goal" & "Metric Details")
 * and extracts the primary quantifiable target linked to the proposal's KPI.
 */
export function parseKpiTargetNumber(
  kpiNumber?: string,
  kpiDescription?: string,
  kpiType?: KPIType | string
): ExtractedKpiTarget {
  const canonicalKpi = getCanonicalKpiType(kpiType);
  const meta = KPI_METRIC_META[canonicalKpi] || KPI_METRIC_META[''];

  // Priority 1: Check Target Goal (kpiNumber)
  if (kpiNumber && kpiNumber.trim()) {
    const fromGoal = extractNumberFromText(kpiNumber);
    if (fromGoal.value !== null && fromGoal.value > 0) {
      return {
        value: fromGoal.value,
        formatted: formatMetricCount(fromGoal.value),
        raw: kpiNumber.trim(),
        source: 'target_goal',
        unitLabel: meta.unitLabel,
        shortUnit: meta.shortUnit,
        confidence: 'high',
      };
    }
  }

  // Priority 2: Fallback to Metric Details (kpiDescription)
  if (kpiDescription && kpiDescription.trim()) {
    const fromDesc = extractNumberFromText(kpiDescription);
    if (fromDesc.value !== null && fromDesc.value > 0) {
      return {
        value: fromDesc.value,
        formatted: formatMetricCount(fromDesc.value),
        raw: fromDesc.matchedRaw || kpiDescription.trim().slice(0, 40),
        source: 'metric_details',
        unitLabel: meta.unitLabel,
        shortUnit: meta.shortUnit,
        confidence: 'medium',
      };
    }
  }

  // No quantifiable number detected
  return {
    value: null,
    formatted: '—',
    raw: (kpiNumber || kpiDescription || '').trim(),
    source: 'none',
    unitLabel: meta.unitLabel,
    shortUnit: meta.shortUnit,
    confidence: 'none',
  };
}

/**
 * Aggregates all extracted KPI targets across proposals, broken down by canonical KPI
 * and submission approval status. Pure read-time calculation.
 */
export function aggregateKpiMetrics(
  proposals: Proposal[]
): TerritoryKpiExtractionSummary {
  const canonicalKpis: KPIType[] = [
    'reach_exposure',
    'engagement_participation',
    'connection_next_steps',
    'retention_nurturing',
    'implementation_capability',
  ];

  const breakdowns: Record<KPIType, KpiMetricBreakdown> = {
    reach_exposure: createEmptyBreakdown('reach_exposure'),
    engagement_participation: createEmptyBreakdown('engagement_participation'),
    connection_next_steps: createEmptyBreakdown('connection_next_steps'),
    retention_nurturing: createEmptyBreakdown('retention_nurturing'),
    implementation_capability: createEmptyBreakdown('implementation_capability'),
  } as Record<KPIType, KpiMetricBreakdown>;

  let grandTotalTarget = 0;
  let approvedGrandTotalTarget = 0;
  let pendingGrandTotalTarget = 0;
  let totalQuantifiedProposals = 0;

  for (const proposal of proposals) {
    const canonKpi = getCanonicalKpiType(proposal.kpiType);
    const targetKpi: KPIType = canonicalKpis.includes(canonKpi) ? canonKpi : 'reach_exposure';
    const breakdown = breakdowns[targetKpi];
    if (!breakdown) continue;

    breakdown.totalProposalsCount += 1;

    const parsed = parseKpiTargetNumber(
      proposal.kpiNumber,
      proposal.kpiDescription,
      canonKpi
    );

    if (parsed.value !== null && parsed.value > 0) {
      totalQuantifiedProposals += 1;
      breakdown.quantifiedProposalsCount += 1;
      breakdown.totalTarget += parsed.value;
      grandTotalTarget += parsed.value;

      const statusLower = (proposal.status || '').toLowerCase().trim();
      const isApproved = statusLower === 'approved';

      if (isApproved) {
        breakdown.approvedTarget += parsed.value;
        approvedGrandTotalTarget += parsed.value;
      } else {
        breakdown.pendingTarget += parsed.value;
        pendingGrandTotalTarget += parsed.value;
      }

      breakdown.proposals.push({
        id: proposal.id,
        title: proposal.title || 'Untitled Proposal',
        union: proposal.union || 'Unassigned',
        status: proposal.status || 'draft',
        extractedValue: parsed.value,
        rawInput: parsed.raw,
        source: parsed.source,
        kpiType: targetKpi,
      });
    }
  }

  // Sort proposals by highest extracted value descending
  for (const kpi of canonicalKpis) {
    breakdowns[kpi].proposals.sort((a, b) => b.extractedValue - a.extractedValue);
  }

  return {
    grandTotalTarget,
    approvedGrandTotalTarget,
    pendingGrandTotalTarget,
    totalProposalsCount: proposals.length,
    totalQuantifiedProposals,
    kpiBreakdowns: breakdowns,
  };
}

function createEmptyBreakdown(kpiType: KPIType): KpiMetricBreakdown {
  const meta = KPI_METRIC_META[kpiType] || KPI_METRIC_META[''];
  return {
    kpiType,
    title: meta.title,
    kpiNumber: meta.number,
    unitLabel: meta.unitLabel,
    shortUnit: meta.shortUnit,
    totalTarget: 0,
    approvedTarget: 0,
    pendingTarget: 0,
    totalProposalsCount: 0,
    quantifiedProposalsCount: 0,
    proposals: [],
  };
}
