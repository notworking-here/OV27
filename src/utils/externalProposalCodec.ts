import {
  Proposal,
  ProposalProjectCode,
  ContactInfo,
  KPIType,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getCanonicalDivisionProject,
  getCanonicalKpiType,
  getProposalPillarKey,
} from '../types';
import { parseKpiTargetNumber } from './kpiExtraction';
import type { ProposalFundingAttribution } from './fundingAttribution';

export interface ExternalBudgetLine {
  activity: string;
  localAmount: number;
  requestedAmount?: number;
  gcAmount: number;
  ssdAmount?: number;
  spdAmount?: number;
  position: number;
  [unionAmountKey: string]: string | number | undefined;
}

export interface ExternalProposalFundingAttribution {
  totalRequestedAmount: number;
  gcAmount: number;
  ssdAmount: number;
  spdAmount: number;
  gcPct: number;
  ssdPct: number;
  spdPct: number;
  poolCoveredAmount: number;
  overPoolDeficitAmount: number;
  poolStatus: 'within_pool' | 'partial_deficit' | 'pool_depleted';
  [unionMetricKey: string]: string | number;
}

export interface ExternalProposalPayload {
  title: string;
  focusId: number | null;
  answers: [string, string, string, string];
  keyMetricCategory: string;
  keyMetricValue: number;
  keyMetricRationale: string;
  priorSimilarProject: boolean;
  priorProjectMetric: string;
  projectDeliverables: string;
  targetAudience: string[];
  targetAudienceOther: string;
  pointsOfIntegration: string;
  budgetLines: ExternalBudgetLine[];
  fundingAttribution?: ExternalProposalFundingAttribution;
  strategicProjectId: number | null;
  customProjectName: string | null;
  strategicObjectiveId: number | null;
  strategicActivityId: number | null;
  proposalContact: ContactInfo;
  divisionLeadContact: ContactInfo;
  gcLiaisonContact: ContactInfo;
}

export interface ExternalProposalEnvelope {
  proposal: ExternalProposalPayload;
  projectCode: ProposalProjectCode;
}

export interface ExternalProposalApiListItem extends ExternalProposalEnvelope {
  id: string;
  union: string;
  unionAcronym: string;
  status: 'approved';
  actionNumber: string | null;
  approvedAt: string | null;
  divisionAuthorizedAt?: string | null;
  authorizationRef?: string | null;
  updatedAt: string;
}

/**
 * Bidirectional Audience Code Mapping:
 * Internal SSD Codes (A1-A4, B, C, D, E) <-> GC External JSON Slugs
 */
export const INTERNAL_TO_EXTERNAL_AUDIENCE: Record<string, string> = {
  A1: 'a_missional',
  A2: 'a_leadership',
  A3: 'a_youth',
  A4: 'a_governance',
  B: 'b_members',
  C: 'c_aware',
  D: 'd_unaware',
  E: 'e_other',
};

export const EXTERNAL_TO_INTERNAL_AUDIENCE: Record<string, string> = {
  a_missional: 'A1',
  a_leadership: 'A2',
  a_youth: 'A3',
  a_governance: 'A4',
  b_members: 'B',
  c_aware: 'C',
  d_unaware: 'D',
  e_other: 'E',
};

/**
 * Bidirectional Primary KPI Category Mapping:
 * Internal KPIType <-> GC External keyMetricCategory
 */
export const INTERNAL_TO_EXTERNAL_KPI: Record<string, string> = {
  reach_exposure: 'reach',
  engagement_participation: 'engagement',
  connection_next_steps: 'connection',
  retention_nurturing: 'retention',
  implementation_capability: 'capability',
};

export const EXTERNAL_TO_INTERNAL_KPI: Record<string, KPIType> = {
  reach: 'reach_exposure',
  exposure: 'reach_exposure',
  engagement: 'engagement_participation',
  connection: 'connection_next_steps',
  bridging: 'connection_next_steps',
  retention: 'retention_nurturing',
  discipleship: 'retention_nurturing',
  capability: 'implementation_capability',
  implementation: 'implementation_capability',
  mobilization: 'implementation_capability',
};

/**
 * Maps Strategic Focus / Pillar to numeric focusId (1, 2, or 3)
 */
export function resolveExternalFocusId(proposal: Partial<Proposal>): number | null {
  if (typeof proposal.focusId === 'number' && proposal.focusId >= 1 && proposal.focusId <= 3) {
    return proposal.focusId;
  }
  const pillarKey = getProposalPillarKey({
    strategicFocus: proposal.strategicFocus || '',
    divisionProject: proposal.divisionProject || '',
  });
  if (pillarKey === 'inspiration') return 1;
  if (pillarKey === 'bold_initiatives') return 2;
  if (pillarKey === 'proclamation') return 3;
  return null;
}

/**
 * Maps numeric focusId (1, 2, 3) back to canonical Strategic Focus title
 */
export function resolveInternalStrategicFocus(focusId?: number | null): string {
  if (focusId === 1) return 'Prayer, Training, and Inspiration';
  if (focusId === 2) return 'Bold Initiatives, Materials, and Tools';
  if (focusId === 3) return 'Proclamation, Harvesting, and Disciple Making';
  return '';
}

/**
 * Maps Division Project / Global Objective to numeric strategicProjectId (1 to 7)
 */
export function resolveExternalStrategicProjectId(proposal: Partial<Proposal>): number | null {
  if (
    typeof proposal.strategicProjectId === 'number' &&
    proposal.strategicProjectId >= 1 &&
    proposal.strategicProjectId <= 7
  ) {
    return proposal.strategicProjectId;
  }
  const canon = getCanonicalDivisionProject(proposal.divisionProject);
  switch (canon) {
    case 'Regional Media Evangelism & Creators Conferences':
      return 1;
    case 'Proclamation Kits & Contextualized Evangelistic Materials':
      return 2;
    case 'Global Contextualized Media Production':
      return 3;
    case 'Short-Form Content':
      return 4;
    case 'Mission Intelligence: Reaching Unreached People Groups':
      return 5;
    case 'Proclamation & Harvesting Initiatives':
      return 6;
    case 'Global Marketing Campaign':
      return 7;
    default:
      return null;
  }
}

/**
 * Maps numeric strategicProjectId (1 to 7) back to canonical Division Project title
 */
export function resolveInternalDivisionProject(strategicProjectId?: number | null): string {
  switch (strategicProjectId) {
    case 1:
      return 'Regional Media Evangelism & Creators Conferences';
    case 2:
      return 'Proclamation Kits & Contextualized Evangelistic Materials';
    case 3:
      return 'Global Contextualized Media Production';
    case 4:
      return 'Short-Form Content';
    case 5:
      return 'Mission Intelligence: Reaching Unreached People Groups';
    case 6:
      return 'Proclamation & Harvesting Initiatives';
    case 7:
      return 'Global Marketing Campaign';
    default:
      return '';
  }
}

/**
 * Converts internal audience array (e.g. ['A1', 'C', 'D']) to external slugs (['a_missional', 'c_aware', 'd_unaware'])
 */
export function toExternalAudienceList(audiences?: string[]): string[] {
  if (!Array.isArray(audiences)) return [];
  const result: string[] = [];
  for (const raw of audiences) {
    if (!raw) continue;
    const trimmed = raw.trim();
    const upper = trimmed.toUpperCase();
    const lower = trimmed.toLowerCase();
    if (INTERNAL_TO_EXTERNAL_AUDIENCE[upper]) {
      result.push(INTERNAL_TO_EXTERNAL_AUDIENCE[upper]);
    } else if (EXTERNAL_TO_INTERNAL_AUDIENCE[lower]) {
      result.push(lower);
    }
  }
  return Array.from(new Set(result));
}

/**
 * Converts external audience slugs (e.g. ['a_missional', 'c_aware']) to internal codes (['A1', 'C'])
 */
export function toInternalAudienceList(audiences?: string[]): string[] {
  if (!Array.isArray(audiences)) return [];
  const result: string[] = [];
  for (const raw of audiences) {
    if (!raw) continue;
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    const upper = trimmed.toUpperCase();
    if (EXTERNAL_TO_INTERNAL_AUDIENCE[lower]) {
      result.push(EXTERNAL_TO_INTERNAL_AUDIENCE[lower]);
    } else if (INTERNAL_TO_EXTERNAL_AUDIENCE[upper]) {
      result.push(upper);
    }
  }
  return Array.from(new Set(result));
}

/**
 * Formats the composite GC project code:
 * `[OrgID] - [Project ID] - {Phase} - {Status}`
 */
export function formatCompositeProjectCode(
  code?: Partial<ProposalProjectCode> | null,
  defaultOrgId: string = 'AT1111'
): string {
  const orgId = (code?.orgId || defaultOrgId).trim() || defaultOrgId;
  const projectId = (code?.projectId || '').trim() || '—';
  const phase = (code?.phase || '').trim() || '—';
  const status = (code?.status || '').trim() || '—';
  return `${orgId} - ${projectId} - ${phase} - ${status}`;
}

/**
 * Resolves the canonical 3-5 letter Union acronym for project ID synthesis.
 */
export function getUnionProjectAcronym(unionName?: string): string {
  const canonUnion = unionName ? getCanonicalUnion(unionName) : '';
  const rawAcronym =
    (unionName && UNION_ACRONYMS[unionName]) ||
    (canonUnion && UNION_ACRONYMS[canonUnion]) ||
    'SSD';
  return rawAcronym.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SSD';
}

/**
 * Generates an OVSSD<UNION>### project ID (e.g., OVSSDECPUC001).
 */
export function synthesizeProjectId(unionName?: string, sequenceIndex: number = 1): string {
  const acronym = getUnionProjectAcronym(unionName);
  const seqStr = String(Math.max(1, Math.floor(sequenceIndex))).padStart(3, '0');
  return `OVSSD${acronym}${seqStr}`;
}

/**
 * Resolves the camelCase JSON property names for a Union's share amount and percentage
 * (e.g. Singapore Conference -> "sacAmount" / "sacPct", ECPUC -> "ecpucAmount" / "ecpucPct").
 * Falls back to "unionAmount" / "unionPct" only if the acronym is "SSD" (to avoid colliding with ssdAmount).
 */
export function getUnionAmountFieldKey(unionName?: string): string {
  const acronym = getUnionProjectAcronym(unionName).toLowerCase();
  if (!acronym || acronym === 'ssd') {
    return 'unionAmount';
  }
  return `${acronym}Amount`;
}

export function getUnionPctFieldKey(unionName?: string): string {
  const acronym = getUnionProjectAcronym(unionName).toLowerCase();
  if (!acronym || acronym === 'ssd') {
    return 'unionPct';
  }
  return `${acronym}Pct`;
}

function roundTwoDecimals(val: number): number {
  if (!val || isNaN(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Splits each budget item's requested division amount into GC, SSD, SPD, and <union> shares
 * using integer-cent proportional allocation so:
 * 1) Each line item's gcAmount + ssdAmount + spdAmount + <union>Amount === requestedAmount
 * 2) Column sums across all budget lines equal the proposal's attribution totals to the cent.
 */
function splitBudgetLinesWithAttribution(
  budgetItems: Proposal['budgetItems'] | undefined,
  attribution: ProposalFundingAttribution,
  unionAmountKey: string
): ExternalBudgetLine[] {
  const items = Array.isArray(budgetItems) ? budgetItems : [];
  const rowCents = items.map((item) =>
    Math.max(0, Math.round((Number(item.divisionFunding ?? item.gcFunding) || 0) * 100))
  );
  const totalCents = rowCents.reduce((sum, c) => sum + c, 0);

  if (items.length === 0 || totalCents <= 0) {
    return items.map((item, idx) => ({
      activity: (item.activity || '').trim(),
      localAmount: Number(item.localFunding) || 0,
      requestedAmount: Number(item.divisionFunding ?? item.gcFunding) || 0,
      gcAmount: 0,
      ssdAmount: 0,
      spdAmount: 0,
      [unionAmountKey]: 0,
      position: idx,
    }));
  }

  let targetGc = Math.max(0, Math.min(totalCents, Math.round(attribution.gcAmount * 100)));
  let targetSsd = Math.max(
    0,
    Math.min(totalCents - targetGc, Math.round(attribution.ssdAmount * 100))
  );
  let targetSpd = Math.max(
    0,
    Math.min(totalCents - targetGc - targetSsd, Math.round(attribution.spdAmount * 100))
  );

  const rowRemaining = [...rowCents];
  const allocateColumn = (targetColCents: number): number[] => {
    const col = new Array<number>(items.length).fill(0);
    if (targetColCents <= 0) return col;

    const exactQuotas = rowCents.map((rc) => (rc * targetColCents) / totalCents);
    let allocated = 0;

    for (let i = 0; i < items.length; i += 1) {
      const base = Math.min(rowRemaining[i], Math.floor(exactQuotas[i]));
      col[i] = base;
      allocated += base;
    }

    let leftover = targetColCents - allocated;
    if (leftover > 0) {
      const order = items
        .map((_, idx) => ({
          idx,
          remainder: exactQuotas[idx] - Math.floor(exactQuotas[idx]),
        }))
        .sort((a, b) => b.remainder - a.remainder || a.idx - b.idx);

      for (const entry of order) {
        if (leftover <= 0) break;
        if (col[entry.idx] < rowRemaining[entry.idx]) {
          col[entry.idx] += 1;
          leftover -= 1;
        }
      }

      // Safety pass if any fractional-tie row still had capacity
      if (leftover > 0) {
        for (let i = 0; i < items.length && leftover > 0; i += 1) {
          const room = rowRemaining[i] - col[i];
          if (room > 0) {
            const take = Math.min(room, leftover);
            col[i] += take;
            leftover -= take;
          }
        }
      }
    }

    for (let i = 0; i < items.length; i += 1) {
      rowRemaining[i] -= col[i];
    }
    return col;
  };

  const gcCents = allocateColumn(targetGc);
  const ssdCents = allocateColumn(targetSsd);
  const spdCents = allocateColumn(targetSpd);
  const unionCents = rowRemaining; // Exact residual guarantees row + column reconciliation

  return items.map((item, idx) => ({
    activity: (item.activity || '').trim(),
    localAmount: Number(item.localFunding) || 0,
    requestedAmount: roundTwoDecimals(rowCents[idx] / 100),
    gcAmount: roundTwoDecimals(gcCents[idx] / 100),
    ssdAmount: roundTwoDecimals(ssdCents[idx] / 100),
    spdAmount: roundTwoDecimals(spdCents[idx] / 100),
    [unionAmountKey]: roundTwoDecimals(unionCents[idx] / 100),
    position: idx,
  }));
}

/**
 * Resolves or synthesizes the GC `projectCode` block for a proposal while
 * preserving persisted `projectId`, `orgId`, `phase`, `status`, and lock state.
 */
export function resolveProposalProjectCode(
  proposal: Partial<Proposal>,
  sequenceIndex: number = 1,
  options?: { allowFallbackSequence?: boolean; defaultOrgId?: string }
): ProposalProjectCode {
  const defaultOrgId = options?.defaultOrgId || 'AT1111';
  const allowFallbackSequence = options?.allowFallbackSequence !== false;
  const existing = proposal.projectCode;
  const isStep5Authorized = Boolean(proposal.divisionApproval?.authorized);

  const orgId = (existing?.orgId || defaultOrgId).trim() || defaultOrgId;
  const projectId =
    existing?.projectId && existing.projectId.trim() !== ''
      ? existing.projectId.trim()
      : allowFallbackSequence
      ? synthesizeProjectId(proposal.union, sequenceIndex)
      : null;

  const phase =
    existing?.phase !== undefined && existing.phase !== null && String(existing.phase).trim() !== ''
      ? existing.phase
      : isStep5Authorized
      ? 'Planning'
      : null;

  const status =
    existing?.status !== undefined && existing.status !== null && String(existing.status).trim() !== ''
      ? existing.status
      : isStep5Authorized
      ? 'Active'
      : null;

  const locked = Boolean(existing?.locked || isStep5Authorized);

  const resolved: ProposalProjectCode = {
    composite: formatCompositeProjectCode({ orgId, projectId, phase, status }, defaultOrgId),
    orgId,
    projectId,
    phase,
    status,
    ...(locked ? { locked: true } : existing?.locked === false ? { locked: false } : {}),
    ...(existing?.lockedAt ? { lockedAt: existing.lockedAt } : {}),
    ...(existing?.lockedBy ? { lockedBy: existing.lockedBy } : {}),
    ...(existing?.lockedByEmail ? { lockedByEmail: existing.lockedByEmail } : {}),
  };

  return resolved;
}

/**
 * Computes deterministic, collision-free per-Union sequence indices for any proposals
 * that do not yet have a persisted `projectCode.projectId`.
 * - Respects all already-persisted sequence numbers in each Union so fallback IDs never collide.
 * - Orders uncoded proposals chronologically oldest-first so sequence IDs remain stable across edits.
 */
export function buildCollisionFreeUnionSequenceMap(
  proposals: Array<Partial<Proposal> & { id?: string }>
): Map<string, number> {
  const result = new Map<string, number>();
  const claimedByAcronym = new Map<string, Set<number>>();
  const uncodedByAcronym = new Map<
    string,
    Array<{ id: string; sortTime: number }>
  >();

  for (const p of proposals) {
    if (!p?.id) continue;
    const acronym = getUnionProjectAcronym(p.union);
    let claimed = claimedByAcronym.get(acronym);
    if (!claimed) {
      claimed = new Set<number>();
      claimedByAcronym.set(acronym, claimed);
    }

    const existingPid = p.projectCode?.projectId?.trim();
    if (existingPid) {
      const match = existingPid.match(new RegExp(`^(?:OVSSD|OVPHC)${acronym}(\\d+)$`, 'i'));
      if (match?.[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > 0) {
          claimed.add(parsed);
          result.set(p.id, parsed);
          continue;
        }
      }
      result.set(p.id, 1);
      continue;
    }

    const rawTime =
      p.divisionApproval?.timestamp ||
      p.divisionApproval?.authorizedDate ||
      p.unionApproval?.timestamp ||
      p.unionApproval?.actionDate ||
      p.createdAt ||
      p.updatedAt ||
      '';
    const parsedTime = rawTime ? new Date(rawTime).getTime() : 0;
    const list = uncodedByAcronym.get(acronym) || [];
    list.push({
      id: p.id,
      sortTime: isNaN(parsedTime) ? 0 : parsedTime,
    });
    uncodedByAcronym.set(acronym, list);
  }

  for (const [acronym, list] of uncodedByAcronym.entries()) {
    const claimed = claimedByAcronym.get(acronym) || new Set<number>();
    list.sort((a, b) => {
      if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime;
      return a.id.localeCompare(b.id);
    });

    let candidate = 1;
    for (const item of list) {
      while (claimed.has(candidate)) {
        candidate += 1;
      }
      claimed.add(candidate);
      result.set(item.id, candidate);
      candidate += 1;
    }
  }

  return result;
}

export interface Step5ProjectCodeAuditResult {
  totalAuthorized: number;
  missingIdProposals: Proposal[];
  duplicateIdProposals: Proposal[];
  needsReconciliationCount: number;
}

/**
 * Inspects all Step 5 authorized proposals to identify any that lack a persisted
 * `projectCode.projectId` or share a duplicate `projectId` within the same Union.
 */
export function findStep5ProjectCodeIssues(proposals: Proposal[]): Step5ProjectCodeAuditResult {
  const authorized = proposals.filter((p) => isProposalApprovedForApi(p));
  const byAcronym = new Map<string, Proposal[]>();

  for (const p of authorized) {
    const acronym = getUnionProjectAcronym(p.union);
    const list = byAcronym.get(acronym) || [];
    list.push(p);
    byAcronym.set(acronym, list);
  }

  const missingIdProposals: Proposal[] = [];
  const duplicateIdProposals: Proposal[] = [];

  for (const list of byAcronym.values()) {
    list.sort((a, b) => {
      const timeA = new Date(
        a.divisionApproval?.timestamp ||
          a.divisionApproval?.authorizedDate ||
          a.unionApproval?.timestamp ||
          a.unionApproval?.actionDate ||
          a.createdAt ||
          a.updatedAt ||
          0
      ).getTime();
      const timeB = new Date(
        b.divisionApproval?.timestamp ||
          b.divisionApproval?.authorizedDate ||
          b.unionApproval?.timestamp ||
          b.unionApproval?.actionDate ||
          b.createdAt ||
          b.updatedAt ||
          0
      ).getTime();
      const safeA = isNaN(timeA) ? 0 : timeA;
      const safeB = isNaN(timeB) ? 0 : timeB;
      if (safeA !== safeB) return safeA - safeB;
      return a.id.localeCompare(b.id);
    });

    const seen = new Set<string>();
    for (const p of list) {
      const pid = p.projectCode?.projectId?.trim().toUpperCase() || '';
      if (!pid) {
        missingIdProposals.push(p);
      } else if (seen.has(pid)) {
        duplicateIdProposals.push(p);
      } else {
        seen.add(pid);
      }
    }
  }

  return {
    totalAuthorized: authorized.length,
    missingIdProposals,
    duplicateIdProposals,
    needsReconciliationCount: missingIdProposals.length + duplicateIdProposals.length,
  };
}

/**
 * Checks whether a proposal is Step 5 SSD OV27 Committee Authorized ("Authorized to send to GC")
 * and therefore eligible for exposure via the external GC API.
 */
export function isProposalApprovedForApi(proposal?: Partial<Proposal> | null): boolean {
  if (!proposal) return false;
  if (!proposal.divisionApproval?.authorized) return false;
  if (proposal.status === 'approved') return true;
  if (
    proposal.unionApproval &&
    typeof proposal.unionApproval.actionNumber === 'string' &&
    proposal.unionApproval.actionNumber.trim().length > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Converts an internal OneVoice27 Proposal into the exact GC External JSON structure
 * matching `proposal-238-onevoice27-one-mission-every-member.json`.
 */
export function toExternalProposalJson(
  proposal: Proposal,
  sequenceIndex: number = 1,
  defaultOrgId: string = 'AT1111',
  attribution?: ProposalFundingAttribution | null
): ExternalProposalEnvelope {
  const focusId = resolveExternalFocusId(proposal);
  const strategicProjectId = resolveExternalStrategicProjectId(proposal);
  const canonKpi = getCanonicalKpiType(proposal.kpiType);
  const keyMetricCategory = INTERNAL_TO_EXTERNAL_KPI[canonKpi] || canonKpi || '';

  const parsedTarget = parseKpiTargetNumber(
    proposal.kpiNumber,
    proposal.kpiDescription,
    canonKpi
  );
  const rawNumeric = Number(String(proposal.kpiNumber || '').replace(/[^0-9.]/g, ''));
  const keyMetricValue =
    parsedTarget.value !== null && parsedTarget.value > 0
      ? Math.round(parsedTarget.value)
      : !isNaN(rawNumeric) && rawNumeric > 0
      ? Math.round(rawNumeric)
      : 0;

  const unionAmountKey = getUnionAmountFieldKey(proposal.union);
  const unionPctKey = getUnionPctFieldKey(proposal.union);

  const budgetLines: ExternalBudgetLine[] = attribution
    ? splitBudgetLinesWithAttribution(proposal.budgetItems, attribution, unionAmountKey)
    : (proposal.budgetItems || []).map((item, idx) => ({
        activity: (item.activity || '').trim(),
        localAmount: Number(item.localFunding) || 0,
        gcAmount: Number(item.divisionFunding ?? item.gcFunding) || 0,
        position: idx,
      }));

  const fundingAttribution: ExternalProposalFundingAttribution | undefined = attribution
    ? {
        totalRequestedAmount: roundTwoDecimals(attribution.proposalTotal),
        gcAmount: roundTwoDecimals(attribution.gcAmount),
        ssdAmount: roundTwoDecimals(attribution.ssdAmount),
        spdAmount: roundTwoDecimals(attribution.spdAmount),
        [unionAmountKey]: roundTwoDecimals(attribution.unionAmount),
        gcPct: roundTwoDecimals(attribution.gcPct),
        ssdPct: roundTwoDecimals(attribution.ssdPct),
        spdPct: roundTwoDecimals(attribution.spdPct),
        [unionPctKey]: roundTwoDecimals(attribution.unionPct),
        poolCoveredAmount: roundTwoDecimals(attribution.poolCoveredAmount),
        overPoolDeficitAmount: roundTwoDecimals(attribution.overPoolDeficitAmount),
        poolStatus: attribution.poolStatus,
      }
    : undefined;

  const safeContact = (c?: ContactInfo): ContactInfo => ({
    name: c?.name || '',
    email: c?.email || '',
    phone: c?.phone || '',
  });

  const resolvedCode = resolveProposalProjectCode(proposal, sequenceIndex, { defaultOrgId });

  return {
    proposal: {
      title: proposal.title || '',
      focusId,
      answers: [
        proposal.overview || '',
        proposal.goal || '',
        proposal.outcomes || '',
        proposal.kpiDescription || '',
      ],
      keyMetricCategory,
      keyMetricValue,
      keyMetricRationale: proposal.kpiRationale || '',
      priorSimilarProject: proposal.hadSimilarProject2Years === 'yes',
      priorProjectMetric:
        proposal.hadSimilarProject2Years === 'yes' ? proposal.priorProjectMetric || '' : '',
      projectDeliverables: proposal.deliverables || '',
      targetAudience: toExternalAudienceList(proposal.targetAudiences),
      targetAudienceOther: proposal.audienceEDetails || '',
      pointsOfIntegration: proposal.pointsOfIntegration || '',
      budgetLines,
      ...(fundingAttribution ? { fundingAttribution } : {}),
      strategicProjectId,
      customProjectName: proposal.otherDivisionProject?.trim() || null,
      strategicObjectiveId: proposal.strategicObjectiveId ?? null,
      strategicActivityId: proposal.strategicActivityId ?? null,
      proposalContact: safeContact(proposal.pointOfContact),
      divisionLeadContact: safeContact(proposal.divisionLeadContact),
      gcLiaisonContact: safeContact(proposal.gcLiaison),
    },
    projectCode: {
      composite: resolvedCode.composite,
      orgId: resolvedCode.orgId,
      projectId: resolvedCode.projectId,
      phase: resolvedCode.phase,
      status: resolvedCode.status,
    },
  };
}

/**
 * Converts an external GC JSON payload (`{ proposal, projectCode }`) into a partial OneVoice27 `Proposal`.
 */
export function fromExternalProposalJson(
  envelope: Partial<ExternalProposalEnvelope>,
  defaultUnion: string = 'Southern Asia-Pacific Division (SSD Headquarters)'
): Partial<Proposal> {
  const ext = envelope.proposal;
  if (!ext) return {};

  const strategicProjectId = ext.strategicProjectId ?? null;
  const divisionProject = resolveInternalDivisionProject(strategicProjectId);
  const focusId = ext.focusId ?? null;
  const strategicFocus =
    resolveInternalStrategicFocus(focusId) ||
    (divisionProject ? resolveInternalStrategicFocus(resolveExternalFocusId({ divisionProject })) : '');

  const rawKpiCat = (ext.keyMetricCategory || '').trim().toLowerCase();
  const kpiType: KPIType =
    EXTERNAL_TO_INTERNAL_KPI[rawKpiCat] || getCanonicalKpiType(rawKpiCat);

  const answers = Array.isArray(ext.answers) ? ext.answers : [];
  const budgetItems = Array.isArray(ext.budgetLines)
    ? [...ext.budgetLines]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((line, i) => {
          const unionKey = getUnionAmountFieldKey(defaultUnion);
          const unionLineVal = Number(line[unionKey] ?? line.unionAmount) || 0;
          const hasSplitFields =
            line.requestedAmount !== undefined ||
            line.ssdAmount !== undefined ||
            line.spdAmount !== undefined ||
            line[unionKey] !== undefined ||
            line.unionAmount !== undefined;
          const totalDivisionAmt =
            line.requestedAmount !== undefined
              ? Number(line.requestedAmount) || 0
              : hasSplitFields
              ? roundTwoDecimals(
                  (Number(line.gcAmount) || 0) +
                    (Number(line.ssdAmount) || 0) +
                    (Number(line.spdAmount) || 0) +
                    unionLineVal
                )
              : Number(line.gcAmount) || 0;

          return {
            id: `item_${Date.now()}_${i}`,
            activity: line.activity || '',
            divisionFunding: totalDivisionAmt,
            localFunding: Number(line.localAmount) || 0,
            gcFunding: totalDivisionAmt,
          };
        })
    : [];

  return {
    title: ext.title || '',
    union: defaultUnion,
    strategicFocus,
    divisionProject,
    otherDivisionProject: ext.customProjectName || undefined,
    focusId,
    strategicProjectId,
    strategicObjectiveId: ext.strategicObjectiveId ?? null,
    strategicActivityId: ext.strategicActivityId ?? null,
    overview: answers[0] || '',
    goal: answers[1] || '',
    outcomes: answers[2] || '',
    kpiDescription: answers[3] || '',
    kpiType,
    kpiNumber: ext.keyMetricValue ? String(ext.keyMetricValue) : '',
    kpiRationale: ext.keyMetricRationale || '',
    hadSimilarProject2Years: ext.priorSimilarProject ? 'yes' : 'no',
    priorProjectMetric: ext.priorProjectMetric || '',
    deliverables: ext.projectDeliverables || '',
    targetAudiences: toInternalAudienceList(ext.targetAudience),
    audienceEDetails: ext.targetAudienceOther || '',
    pointsOfIntegration: ext.pointsOfIntegration || '',
    budgetItems,
    pointOfContact: {
      name: ext.proposalContact?.name || '',
      email: ext.proposalContact?.email || '',
      phone: ext.proposalContact?.phone || '',
    },
    divisionLeadContact: {
      name: ext.divisionLeadContact?.name || '',
      email: ext.divisionLeadContact?.email || '',
      phone: ext.divisionLeadContact?.phone || '',
    },
    gcLiaison: {
      name: ext.gcLiaisonContact?.name || '',
      email: ext.gcLiaisonContact?.email || '',
      phone: ext.gcLiaisonContact?.phone || '',
    },
    projectCode: envelope.projectCode
      ? {
          composite: formatCompositeProjectCode(envelope.projectCode),
          orgId: envelope.projectCode.orgId || 'AT1111',
          projectId: envelope.projectCode.projectId || null,
          phase: envelope.projectCode.phase ?? null,
          status: envelope.projectCode.status ?? null,
          ...(envelope.projectCode.locked !== undefined
            ? { locked: envelope.projectCode.locked }
            : {}),
        }
      : undefined,
  };
}
