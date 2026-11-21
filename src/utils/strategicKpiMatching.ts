import {
  Proposal,
  StrategicKpi,
  ALL_STRATEGIC_KPIS,
  getCanonicalDivisionProject,
} from '../types';

/**
 * Accurately and robustly matches a proposal to one of the 7 Strategic KPIs.
 * Handles variations in punctuation, colons, ampersands, prepositions, and legacy database titles.
 */
export function matchProposalToStrategicKpi(
  p: Proposal,
  allKpis: StrategicKpi[] = ALL_STRATEGIC_KPIS
): StrategicKpi | undefined {
  const rawProject = (p.divisionProject || '').trim();
  if (!rawProject) return undefined;

  const canonical = getCanonicalDivisionProject(rawProject);

  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normRaw = clean(rawProject);
  const normCanonical = clean(canonical);

  // 1. Direct title, canonical, or KPI number match
  for (const k of allKpis) {
    const normKpiTitle = clean(k.title);
    if (
      normRaw === normKpiTitle ||
      normCanonical === normKpiTitle ||
      normRaw.includes(normKpiTitle) ||
      normKpiTitle.includes(normRaw) ||
      normCanonical.includes(normKpiTitle) ||
      normKpiTitle.includes(normCanonical) ||
      normRaw.includes(`kpi ${k.number}`) ||
      normRaw.includes(`kpi${k.number}`)
    ) {
      return k;
    }
  }

  // 2. High-confidence distinctive keywords
  if (normRaw.includes('creators') || normRaw.includes('media evangelism')) {
    return allKpis.find((k) => k.id === 'kpi_1');
  }
  if (normRaw.includes('proclamation kit') || normRaw.includes('evangelistic material')) {
    return allKpis.find((k) => k.id === 'kpi_2');
  }
  if (normRaw.includes('contextualized media') || normRaw.includes('media production')) {
    return allKpis.find((k) => k.id === 'kpi_3');
  }
  if (normRaw.includes('vertical') || normRaw.includes('short form')) {
    return allKpis.find((k) => k.id === 'kpi_4');
  }
  if (
    normRaw.includes('mission intelligence') ||
    normRaw.includes('unreached people') ||
    normRaw.includes('unreached')
  ) {
    return allKpis.find((k) => k.id === 'kpi_5');
  }
  if (
    normRaw.includes('harvesting') ||
    (normRaw.includes('proclamation') && !normRaw.includes('kit'))
  ) {
    return allKpis.find((k) => k.id === 'kpi_6');
  }
  if (normRaw.includes('marketing campaign') || normRaw.includes('global marketing')) {
    return allKpis.find((k) => k.id === 'kpi_7');
  }

  return undefined;
}
