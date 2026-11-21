import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, getDocFromServer } from '../lib/firebase';
import {
  UnionAnalyticsItem,
  TerritoryTotals,
  computeUnionAnalytics,
  computeTerritoryTotals,
  getProposalBudgetBreakdown,
  getPillarIndex,
} from '../utils/monitorAnalytics';
import {
  UNION_CATEGORIES,
  UNION_ACRONYMS,
  Proposal,
  UserAccount,
  getCanonicalUnion,
  isSuperAdminEmail,
} from '../types';
import {
  fetchBudgetAllocationDetails,
  fetchLeadershipOfficers,
  PRIVATE_SETTINGS_COLLECTION,
} from './proposalService';
import {
  aggregateKpiMetrics,
  TerritoryKpiExtractionSummary,
  parseKpiTargetNumber,
} from '../utils/kpiExtraction';
import { calculateAudienceInvestment, AudienceInvestmentAnalysis } from '../utils/audienceInvestment';
import { getUnionIntelligence } from '../data/unionIntelligence';
import { detectProposalUpgSignals } from '../utils/impactPlausibilityEngine';

export const PUBLIC_MONITOR_COLLECTION = 'public_monitor';
export const PUBLIC_MONITOR_DOC = 'division_summary';
export const PUBLIC_MONITOR_CONFIG_DOC = 'public_monitor_config';
export const PUBLIC_MONITOR_STORAGE_KEY = 'onevoice27_public_monitor_cache';

let cachedShareToken: string | null = null;

export function isValidPublicMonitorToken(token?: string | null): token is string {
  if (!token) return false;
  const trimmed = token.trim();
  return (
    trimmed !== PUBLIC_MONITOR_DOC &&
    trimmed.length >= 24 &&
    trimmed.length <= 160 &&
    /^[a-zA-Z0-9_.\-]+$/.test(trimmed)
  );
}

export function generatePublicMonitorToken(): string {
  const bytes = new Uint8Array(18);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `ov27_mon_${hex}`;
}

export interface PublicProjectSummary {
  id: string;
  title: string;
  union: string;
  acronym: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved';
  strategicFocus: string;
  divisionProject: string;
  pillarIndex: number;
  totalBudget: number;
  divisionGrant: number;
  localMatch: number;
  kpiType: string;
  formattedTarget?: string;
  targetNumericValue?: number;
  budgetLineCount?: number;
  budgetActivities?: string[];
  targetAudiences?: string[];
  hasNamedUpgFocus?: boolean;
}

export interface PublicMonitorSnapshot {
  territories: UnionAnalyticsItem[];
  territoryTotals: TerritoryTotals;
  impactMetrics?: TerritoryKpiExtractionSummary;
  audienceInvestment?: AudienceInvestmentAnalysis;
  projectSummaries?: PublicProjectSummary[];
  updatedAt: string;
  syncedBy?: string;
}

export function buildPublicProjectSummaries(proposals: Proposal[]): PublicProjectSummary[] {
  if (!proposals || proposals.length === 0) return [];
  return proposals
    .filter((p) => {
      const isApproved = p.status === 'approved' || Boolean(p.unionApproval?.actionNumber);
      // Strictly exclude unpublished 'draft' proposals from shared monitor snapshots
      return isApproved || p.status === 'submitted' || p.status === 'under_review';
    })
    .map((p) => {
      const canonUnion = getCanonicalUnion(p.union);
      const acronym = UNION_ACRONYMS[p.union] || UNION_ACRONYMS[canonUnion] || 'SSD';
      const { divisionFunding, localFunding, totalCost } = getProposalBudgetBreakdown(p);
      const pillarIndex = getPillarIndex(p);
      const parsedTarget = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);
      const isApproved = p.status === 'approved' || Boolean(p.unionApproval?.actionNumber);
      const validActivities = isApproved
        ? (p.budgetItems || [])
            .filter((it) => (it.activity || '').trim().length > 2)
            .map((it) => (it.activity || '').trim())
            .slice(0, 8)
        : [];
      const uProfile = getUnionIntelligence(canonUnion || p.union);
      const upgSignals = detectProposalUpgSignals(p, uProfile);
      const hasNamedUpgFocus =
        upgSignals.length > 0 || (p.audienceEDetails || '').trim().length >= 20;

      return {
        id: p.id,
        title: (p.title || '').trim() || 'Untitled Proposal',
        union: canonUnion || p.union || '',
        acronym,
        status: isApproved ? 'approved' : p.status || 'submitted',
        strategicFocus: p.strategicFocus || '',
        divisionProject: p.divisionProject || '',
        pillarIndex,
        totalBudget: totalCost,
        divisionGrant: divisionFunding,
        localMatch: localFunding,
        kpiType: p.kpiType || '',
        ...(parsedTarget.value !== null
          ? { formattedTarget: parsedTarget.formatted, targetNumericValue: parsedTarget.value }
          : {}),
        budgetLineCount: (p.budgetItems || []).length,
        ...(validActivities.length > 0 ? { budgetActivities: validActivities } : {}),
        ...(p.targetAudiences && p.targetAudiences.length > 0
          ? { targetAudiences: p.targetAudiences }
          : {}),
        ...(hasNamedUpgFocus ? { hasNamedUpgFocus: true } : {}),
      };
    });
}

/**
 * Converts sanitized PublicProjectSummary items (strictly `status === 'approved'`)
 * into read-only Proposal-shaped objects so Dashboard analytics & cards can display
 * Union/Division Approved context without querying private proposal documents.
 */
export function snapshotToApprovedProposals(
  snapshot: PublicMonitorSnapshot | null | undefined
): Proposal[] {
  if (!snapshot?.projectSummaries || snapshot.projectSummaries.length === 0) {
    return [];
  }

  return snapshot.projectSummaries
    .filter((s) => s.status === 'approved')
    .map((s) => {
      const targetStr =
        s.targetNumericValue !== undefined && s.targetNumericValue !== null
          ? String(s.targetNumericValue)
          : s.formattedTarget || '';
      return {
        id: s.id,
        createdAt: snapshot.updatedAt || '',
        updatedAt: snapshot.updatedAt || '',
        userId: '',
        userName: '',
        userEmail: '',
        union: s.union || '',
        status: 'approved',
        title: s.title || 'Untitled Proposal',
        overview: '',
        goal: '',
        outcomes: '',
        strategicFocus: s.strategicFocus || '',
        divisionProject: s.divisionProject || '',
        kpiType: (s.kpiType || '') as Proposal['kpiType'],
        kpiNumber: targetStr,
        kpiDescription: '',
        kpiRationale: '',
        hadSimilarProject2Years: '',
        deliverables: '',
        targetAudiences: (s.targetAudiences || []) as string[],
        audienceEDetails: '',
        pointsOfIntegration: '',
        pointOfContact: { name: '', email: '', phone: '' },
        divisionLeadContact: { name: '', email: '', phone: '' },
        gcLiaison: { name: '', email: '', phone: '' },
        budgetItems: [
          {
            id: `snap_budget_${s.id}`,
            activity:
              (s.budgetActivities && s.budgetActivities[0]) ||
              s.title ||
              'Approved Budget',
            divisionFunding: Number(s.divisionGrant) || 0,
            gcFunding: Number(s.divisionGrant) || 0,
            localFunding: Number(s.localMatch) || 0,
          },
        ],
        ...(s.hasNamedUpgFocus ? ({ hasNamedUpgFocus: true } as Record<string, any>) : {}),
      };
    });
}

function createEmptyImpactMetrics(territoryTotals?: TerritoryTotals): TerritoryKpiExtractionSummary {
  const totalProjects = territoryTotals?.totalProjectsCount || 0;
  return {
    grandTotalTarget: 0,
    approvedGrandTotalTarget: 0,
    pendingGrandTotalTarget: 0,
    totalProposalsCount: totalProjects,
    totalQuantifiedProposals: 0,
    kpiBreakdowns: {
      reach_exposure: {
        kpiType: 'reach_exposure',
        title: 'Reach & Exposure',
        kpiNumber: 1,
        unitLabel: 'Public Reach (Views, Listeners, Impressions)',
        shortUnit: 'reach & views',
        totalTarget: 0,
        approvedTarget: 0,
        pendingTarget: 0,
        totalProposalsCount: 0,
        quantifiedProposalsCount: 0,
        proposals: [],
      },
      engagement_participation: {
        kpiType: 'engagement_participation',
        title: 'Engagement & Digital Connection',
        kpiNumber: 2,
        unitLabel: 'Direct Engagements (Inquiries, Comments, Conversations)',
        shortUnit: 'engagements & contacts',
        totalTarget: 0,
        approvedTarget: 0,
        pendingTarget: 0,
        totalProposalsCount: 0,
        quantifiedProposalsCount: 0,
        proposals: [],
      },
      connection_next_steps: {
        kpiType: 'connection_next_steps',
        title: 'Connection & Bridging Handoff',
        kpiNumber: 3,
        unitLabel: 'Bridging Attendees (Seminar Sign-ups, In-Person Guests)',
        shortUnit: 'attendees & sign-ups',
        totalTarget: 0,
        approvedTarget: 0,
        pendingTarget: 0,
        totalProposalsCount: 0,
        quantifiedProposalsCount: 0,
        proposals: [],
      },
      retention_nurturing: {
        kpiType: 'retention_nurturing',
        title: 'Discipleship & Retention',
        kpiNumber: 4,
        unitLabel: 'Discipleship (Active Bible Studies, Baptisms)',
        shortUnit: 'disciples & studies',
        totalTarget: 0,
        approvedTarget: 0,
        pendingTarget: 0,
        totalProposalsCount: 0,
        quantifiedProposalsCount: 0,
        proposals: [],
      },
      implementation_capability: {
        kpiType: 'implementation_capability',
        title: 'Mobilization & Capability Building',
        kpiNumber: 5,
        unitLabel: 'Mobilized Personnel (Trained Leaders, Creators, Units)',
        shortUnit: 'trained & mobilized',
        totalTarget: 0,
        approvedTarget: 0,
        pendingTarget: 0,
        totalProposalsCount: 0,
        quantifiedProposalsCount: 0,
        proposals: [],
      },
      '': {
        kpiType: '',
        title: 'Unassigned Metric',
        kpiNumber: 0,
        unitLabel: 'Measurable Target',
        shortUnit: 'target',
        totalTarget: 0,
        approvedTarget: 0,
        pendingTarget: 0,
        totalProposalsCount: 0,
        quantifiedProposalsCount: 0,
        proposals: [],
      },
    },
  };
}

function createEmptyAudienceInvestment(territoryTotals?: TerritoryTotals): AudienceInvestmentAnalysis {
  const approvedBudget = territoryTotals?.totalApprovedBudget || 0;
  const pendingBudget = territoryTotals?.totalPendingBudget || 0;
  const totalBudget = approvedBudget + pendingBudget;
  const totalProjects = territoryTotals?.totalProjectsCount || 0;

  return {
    internalBeneficiaries: {
      approvedBudget: 0,
      pipelineBudget: 0,
      totalBudget: 0,
      approvedTargetCount: 0,
      pipelineTargetCount: 0,
      totalTargetCount: 0,
      proposalCount: 0,
      approvedCostPerPerson: null,
      totalCostPerPerson: null,
      sharePct: 50,
    },
    outreachAudience: {
      approvedBudget: 0,
      pipelineBudget: 0,
      totalBudget: 0,
      approvedTargetCount: 0,
      pipelineTargetCount: 0,
      totalTargetCount: 0,
      proposalCount: 0,
      approvedCostPerPerson: null,
      totalCostPerPerson: null,
      sharePct: 50,
    },
    grandTotalApprovedBudget: approvedBudget,
    grandTotalProjectedBudget: totalBudget,
    grandTotalProposals: totalProjects,
    quantifiedProposalsCount: 0,
    breakdownByAudience: [],
  };
}

function normalizeSnapshot(snapshot: PublicMonitorSnapshot | null): PublicMonitorSnapshot | null {
  if (!snapshot || !snapshot.territories) return snapshot;

  const territories = snapshot.territories.map((t) => {
    if (t.union === 'Southern Luzon Philippine Union Mission' || t.acronym === 'SLUM') {
      return { ...t, acronym: 'SLPUM' };
    }
    return t;
  });

  const impactMetrics = snapshot.impactMetrics || createEmptyImpactMetrics(snapshot.territoryTotals);
  const audienceInvestment =
    snapshot.audienceInvestment || createEmptyAudienceInvestment(snapshot.territoryTotals);

  return {
    ...snapshot,
    territories,
    impactMetrics,
    audienceInvestment,
    projectSummaries: snapshot.projectSummaries || [],
  };
}

/**
 * Completely purges public monitor cache from local browser storage.
 */
export function clearPublicMonitorCache(): void {
  cachedShareToken = null;
  try {
    localStorage.removeItem(PUBLIC_MONITOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Admin-only: retrieves (or provisions) the secret capability token used for the Admin-shared Public Quickview link.
 */
export async function fetchPublicMonitorShareToken(autoProvisionIfMissing = true): Promise<string | null> {
  if (!auth.currentUser) return null;
  if (cachedShareToken && isValidPublicMonitorToken(cachedShareToken)) {
    return cachedShareToken;
  }

  try {
    const configRef = doc(db, PRIVATE_SETTINGS_COLLECTION, PUBLIC_MONITOR_CONFIG_DOC);
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const token = (snap.data() as { token?: string })?.token;
      if (isValidPublicMonitorToken(token)) {
        cachedShareToken = token;
        return token;
      }
    }

    if (autoProvisionIfMissing) {
      const newToken = generatePublicMonitorToken();
      await setDoc(
        configRef,
        {
          token: newToken,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser.email || auth.currentUser.displayName || 'Super Admin',
        },
        { merge: true }
      );
      cachedShareToken = newToken;
      return newToken;
    }
  } catch (err) {
    console.warn('Notice reading public monitor share config:', err);
  }
  return null;
}

/**
 * Admin-only: rotates the Stakeholder Quickview token, deletes the previous snapshot doc,
 * and returns the newly generated secret token.
 */
export async function rotatePublicMonitorShareToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  const previousToken = cachedShareToken || (await fetchPublicMonitorShareToken(false));
  const newToken = generatePublicMonitorToken();

  try {
    const configRef = doc(db, PRIVATE_SETTINGS_COLLECTION, PUBLIC_MONITOR_CONFIG_DOC);
    await setDoc(
      configRef,
      {
        token: newToken,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser.email || auth.currentUser.displayName || 'Super Admin',
      },
      { merge: true }
    );
    cachedShareToken = newToken;

    if (previousToken && isValidPublicMonitorToken(previousToken) && previousToken !== newToken) {
      deleteDoc(doc(db, PUBLIC_MONITOR_COLLECTION, previousToken)).catch(() => {});
    }
    return newToken;
  } catch (err) {
    console.warn('Notice rotating public monitor share token:', err);
    return null;
  }
}

/**
 * Fetches the division-wide monitor snapshot from Firestore.
 * - When `shareToken` is passed (Stakeholder Quickview URL `&key=...`), reads strictly `/public_monitor/<shareToken>`.
 * - When `shareToken` is omitted (internal signed-in Approved Proposal Intelligence), requires authenticated `auth.currentUser`.
 */
export async function fetchPublicMonitorSnapshot(
  forceServer: boolean = false,
  shareToken?: string | null
): Promise<PublicMonitorSnapshot | null> {
  const isTokenMode = shareToken !== undefined;

  if (isTokenMode) {
    if (!isValidPublicMonitorToken(shareToken)) {
      return null;
    }
    try {
      const docRef = doc(db, PUBLIC_MONITOR_COLLECTION, shareToken.trim());
      const snap = forceServer
        ? await getDocFromServer(docRef).catch(() => getDoc(docRef))
        : await getDoc(docRef);
      if (snap && snap.exists()) {
        return normalizeSnapshot(snap.data() as PublicMonitorSnapshot);
      }
    } catch (err) {
      console.warn('Notice fetching tokenized public monitor snapshot:', err);
    }
    return null;
  }

  // Internal mode strictly requires Firebase Auth
  if (!auth.currentUser) {
    return null;
  }

  let cached: PublicMonitorSnapshot | null = null;
  if (!forceServer) {
    try {
      const raw = localStorage.getItem(PUBLIC_MONITOR_STORAGE_KEY);
      if (raw) {
        cached = normalizeSnapshot(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
  }

  try {
    const docRef = doc(db, PUBLIC_MONITOR_COLLECTION, PUBLIC_MONITOR_DOC);
    const snap = forceServer
      ? await getDocFromServer(docRef).catch(() => getDoc(docRef))
      : await getDoc(docRef);

    if (snap && snap.exists()) {
      const data = normalizeSnapshot(snap.data() as PublicMonitorSnapshot);
      if (data) {
        try {
          localStorage.setItem(PUBLIC_MONITOR_STORAGE_KEY, JSON.stringify(data));
        } catch {
          // ignore
        }
        return data;
      }
    }
  } catch (err) {
    console.warn('Notice fetching internal division snapshot from cloud:', err);
  }

  return cached;
}

let lastSyncedMonitorSignature: string | null = null;

function computeMonitorPayloadSignature(
  territories: UnionAnalyticsItem[],
  territoryTotals: TerritoryTotals,
  impactMetrics?: TerritoryKpiExtractionSummary,
  audienceInvestment?: AudienceInvestmentAnalysis,
  projectSummaries?: PublicProjectSummary[]
): string {
  try {
    return JSON.stringify({
      totals: territoryTotals,
      territories: territories.map((t) => ({
        u: t.union,
        a: t.divisionAlloc,
        m: t.matchingPledge,
        app: t.approvedBudget,
        pen: t.pendingBudget,
        ac: t.approvedCount,
        pc: t.pendingCount,
        tc: t.totalCount,
      })),
      impact: impactMetrics
        ? {
            gt: impactMetrics.grandTotalTarget,
            agt: impactMetrics.approvedGrandTotalTarget,
            pgt: impactMetrics.pendingGrandTotalTarget,
          }
        : null,
      audience: audienceInvestment
        ? {
            app: audienceInvestment.grandTotalApprovedBudget,
            proj: audienceInvestment.grandTotalProjectedBudget,
          }
        : null,
      projectsCount: projectSummaries?.length || 0,
    });
  } catch {
    return String(Date.now());
  }
}

/**
 * Publishes sanitized division-wide monitor statistics to Firestore.
 * Guarded so partial single-union views or uninitialized blank states never overwrite
 * the global 14-territory division snapshot.
 */
export async function syncPublicMonitorSnapshot(
  territories: UnionAnalyticsItem[],
  territoryTotals: TerritoryTotals,
  impactMetrics?: TerritoryKpiExtractionSummary,
  audienceInvestment?: AudienceInvestmentAnalysis,
  forceWrite: boolean = false,
  projectSummaries?: PublicProjectSummary[],
  explicitShareToken?: string | null
): Promise<boolean> {
  // Never overwrite the global division snapshot with a single-union subset
  if (!territories || territories.length < 12) {
    return false;
  }

  // Prevent uninitialized 0-project state from wiping out real cloud data unless explicitly forced
  if (!forceWrite && territoryTotals.totalProjectsCount === 0) {
    return false;
  }

  let safeImpactMetrics = impactMetrics;
  if (safeImpactMetrics?.kpiBreakdowns) {
    const cleanBreakdowns: Record<string, any> = {};
    for (const [k, v] of Object.entries(safeImpactMetrics.kpiBreakdowns)) {
      if (k && k.trim()) {
        cleanBreakdowns[k] = v;
      }
    }
    safeImpactMetrics = {
      ...safeImpactMetrics,
      kpiBreakdowns: cleanBreakdowns as any,
    };
  }

  const signature = computeMonitorPayloadSignature(
    territories,
    territoryTotals,
    safeImpactMetrics,
    audienceInvestment,
    projectSummaries
  );

  // If neither forced nor changed from our last cloud sync, skip Firestore write
  if (!forceWrite && !explicitShareToken && lastSyncedMonitorSignature === signature) {
    return true;
  }

  const snapshot: PublicMonitorSnapshot = {
    territories,
    territoryTotals,
    ...(safeImpactMetrics ? { impactMetrics: safeImpactMetrics } : {}),
    ...(audienceInvestment ? { audienceInvestment } : {}),
    ...(projectSummaries ? { projectSummaries } : {}),
    updatedAt: new Date().toISOString(),
    syncedBy: auth.currentUser?.email || auth.currentUser?.displayName || 'Automated Sync',
  };

  // 1. Always update internal local cache for signed-in users
  if (auth.currentUser) {
    try {
      localStorage.setItem(PUBLIC_MONITOR_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore
    }
  }

  // 2. Sync to Firestore if signed in as Super Admin
  if (auth.currentUser) {
    try {
      const shareToken =
        explicitShareToken && isValidPublicMonitorToken(explicitShareToken)
          ? explicitShareToken
          : await fetchPublicMonitorShareToken(true);

      const writes: Promise<void>[] = [
        setDoc(doc(db, PUBLIC_MONITOR_COLLECTION, PUBLIC_MONITOR_DOC), snapshot, { merge: true }),
      ];

      if (shareToken && isValidPublicMonitorToken(shareToken)) {
        writes.push(
          setDoc(doc(db, PUBLIC_MONITOR_COLLECTION, shareToken), snapshot, { merge: true })
        );
      }

      await Promise.all(writes);
      lastSyncedMonitorSignature = signature;
      return true;
    } catch (err) {
      console.warn('Notice publishing public monitor snapshot:', err);
      return false;
    }
  }
  return false;
}

/**
 * Automatically computes and pushes the public monitor snapshot from a full list of proposals.
 * Only executes when a full division catalog is loaded.
 */
export async function syncSnapshotFromFullProposals(
  proposals: Proposal[],
  allocations?: Record<string, number>,
  matchingPledges?: Record<string, number>,
  users?: UserAccount[],
  forceWrite: boolean = false
): Promise<boolean> {
  if (
    !auth.currentUser ||
    !isSuperAdminEmail(auth.currentUser.email) ||
    !proposals ||
    proposals.length === 0
  ) {
    return false;
  }
  try {
    let resolvedAllocations = allocations;
    let resolvedMatching = matchingPledges;
    let resolvedUsers = users;

    if (!resolvedAllocations || Object.keys(resolvedAllocations).length === 0) {
      try {
        const details = await fetchBudgetAllocationDetails();
        resolvedAllocations = details.allocations;
        resolvedMatching = details.matchingPledges;
      } catch (e) {
        console.warn('Notice fetching allocation details for public monitor sync:', e);
      }
    }

    if (!resolvedUsers || resolvedUsers.length === 0) {
      try {
        resolvedUsers = await fetchLeadershipOfficers();
      } catch (e) {
        console.warn('Notice fetching leadership officers for public monitor sync:', e);
      }
    }

    const filteredCategories = UNION_CATEGORIES.map((cat) => ({
      ...cat,
      unions: cat.unions.filter(
        (u) =>
          !u.toLowerCase().includes('division') &&
          !u.toLowerCase().includes('headquarters') &&
          !u.toLowerCase().includes('other')
      ),
    })).filter((cat) => cat.unions.length > 0);

    const territories = computeUnionAnalytics(
      filteredCategories,
      resolvedAllocations || {},
      resolvedMatching || {},
      proposals,
      resolvedUsers || []
    );
    const totals = computeTerritoryTotals(territories, territories.length);
    const impactMetrics = aggregateKpiMetrics(proposals);
    const audienceInvestment = calculateAudienceInvestment(proposals);
    const projectSummaries = buildPublicProjectSummaries(proposals);

    return await syncPublicMonitorSnapshot(
      territories,
      totals,
      impactMetrics,
      audienceInvestment,
      forceWrite,
      projectSummaries
    );
  } catch (err) {
    console.warn('Notice background-syncing public monitor snapshot:', err);
    return false;
  }
}
