import {
  Proposal,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getCanonicalDivisionProject,
  getProposalPillarShortLabel,
  getProposalStepStatus,
} from '../types';

/**
 * Builds a single lowercase searchable haystack containing all proposal metadata,
 * Point of Contact (POC), Project/Division Lead, Submitter, Liaison, and Action codes.
 * Concatenates all fields so `||` short-circuiting never hides POC or Lead names.
 */
export function buildProposalSearchHaystack(p: Proposal): string {
  const canonicalUnion = getCanonicalUnion(p.union);
  const unionAcronym =
    UNION_ACRONYMS[canonicalUnion] || UNION_ACRONYMS[p.union] || '';
  const canonicalGoal = getCanonicalDivisionProject(p.divisionProject);
  const pillarShort = getProposalPillarShortLabel(p);
  const stepBadge = getProposalStepStatus(p).currentStepShortBadge;

  const liaisonText = (p.liaisonVotes || [])
    .map((v) => `${v.liaisonName || ''} ${v.liaisonEmail || ''}`)
    .join(' ');

  return [
    p.title,
    p.overview,
    p.union,
    canonicalUnion,
    unionAcronym,
    p.pointOfContact?.name,
    p.pointOfContact?.email,
    p.pointOfContact?.phone,
    p.divisionLeadContact?.name,
    p.divisionLeadContact?.email,
    p.divisionLeadContact?.phone,
    p.userName,
    p.userEmail,
    p.gcLiaison?.name,
    p.gcLiaison?.email,
    liaisonText,
    p.unionApproval?.actionNumber,
    p.unionApproval?.approvedBy,
    p.divisionApproval?.referenceNumber,
    p.divisionApproval?.authorizedBy,
    p.strategicFocus,
    pillarShort,
    p.divisionProject,
    canonicalGoal,
    stepBadge,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Evaluates whether a proposal (or pre-built haystack) matches a search query.
 * Supports multi-word queries (e.g., "ECPUC Cruz" or "Juan Cruz") and union alias codes.
 */
export function matchesProposalSearch(
  proposal: Proposal,
  rawQuery: string,
  precomputedHaystack?: string,
  precomputedCanonicalUnion?: string
): boolean {
  const trimmed = rawQuery.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack =
    precomputedHaystack !== undefined
      ? precomputedHaystack
      : buildProposalSearchHaystack(proposal);

  if (haystack.includes(trimmed)) return true;

  const canonicalUnionLower = (
    precomputedCanonicalUnion !== undefined
      ? precomputedCanonicalUnion
      : getCanonicalUnion(proposal.union)
  ).toLowerCase();

  // Check if entire query is a known union alias (e.g. "SLUM" -> SLPUM, "SAUM" -> SEUM)
  if (canonicalUnionLower) {
    const resolvedWhole = getCanonicalUnion(trimmed).toLowerCase();
    if (resolvedWhole && resolvedWhole === canonicalUnionLower) {
      return true;
    }
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return false;

  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    if (canonicalUnionLower) {
      const resolvedToken = getCanonicalUnion(token).toLowerCase();
      if (resolvedToken && resolvedToken === canonicalUnionLower) return true;
    }
    return false;
  });
}

export interface ProposalContactDisplay {
  primaryName: string;
  primaryEmail: string;
  leadName: string;
  hasDistinctLead: boolean;
  tooltip: string;
}

/**
 * Standardizes Point of Contact (POC), Project/Division Lead, and Submitter display
 * across Review Hub, Approved Proposals, and Sidebar cards.
 */
export function getProposalContactDisplay(p: Proposal): ProposalContactDisplay {
  const pocName = (p.pointOfContact?.name || '').trim();
  const pocEmail = (p.pointOfContact?.email || '').trim();
  const leadName = (p.divisionLeadContact?.name || '').trim();
  const leadEmail = (p.divisionLeadContact?.email || '').trim();
  const submitterName = (p.userName || '').trim();
  const submitterEmail = (p.userEmail || '').trim();

  const primaryName =
    pocName || submitterName || leadName || submitterEmail || 'Unspecified';
  const primaryEmail = pocEmail || submitterEmail || leadEmail || '';
  const hasDistinctLead = Boolean(
    leadName && leadName.toLowerCase() !== primaryName.toLowerCase()
  );

  const lines: string[] = [];
  if (pocName || pocEmail) {
    lines.push(`POC: ${[pocName, pocEmail ? `<${pocEmail}>` : ''].filter(Boolean).join(' ')}`);
  }
  if (leadName || leadEmail) {
    lines.push(`Lead: ${[leadName, leadEmail ? `<${leadEmail}>` : ''].filter(Boolean).join(' ')}`);
  }
  if (
    (submitterName || submitterEmail) &&
    submitterName.toLowerCase() !== pocName.toLowerCase()
  ) {
    lines.push(
      `Submitted by: ${[submitterName, submitterEmail ? `<${submitterEmail}>` : '']
        .filter(Boolean)
        .join(' ')}`
    );
  }

  return {
    primaryName,
    primaryEmail,
    leadName,
    hasDistinctLead,
    tooltip: lines.join('\n') || primaryName,
  };
}
