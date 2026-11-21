import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';
import {
  Proposal,
  ProposalProjectCode,
  UserAccount,
  UserRole,
  StrategicKpiCaps,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getUserAllUnions,
  getUnionQueryVariants,
  isSuperAdminEmail,
  isUserLiaisonEligible,
} from '../types';
import { db, auth, handleFirestoreError, isQuotaExceededError, OperationType, getDocsFromServer } from '../lib/firebase';
import {
  resolveExternalFocusId,
  resolveExternalStrategicProjectId,
  resolveProposalProjectCode,
  formatCompositeProjectCode,
  getUnionProjectAcronym,
  synthesizeProjectId,
  isProposalApprovedForApi,
  toExternalProposalJson,
  buildCollisionFreeUnionSequenceMap,
  ExternalProposalApiListItem,
  ExternalProposalEnvelope,
} from '../utils/externalProposalCodec';
import { computeAllProposalsFundingAttribution } from '../utils/fundingAttribution';
import { appendActivityToProposal } from './activityLogService';

const PROPOSALS_COLLECTION = 'proposals';
const USERS_COLLECTION = 'users';

// Build query scoped strictly by User Role & Union
export function buildProposalsQuery(user: UserAccount) {
  const fbUser = auth.currentUser;
  const isSuperAdmin =
    user.role === 'super_admin' ||
    isSuperAdminEmail(user.email) ||
    isSuperAdminEmail(fbUser?.email);

  const allUnions = getUserAllUnions(user);
  const hasMultipleUnions = allUnions.length > 1;

  const isLiaisonOrCoordinator =
    user.role === 'coordinator' ||
    user.role === 'treasurer' ||
    user.role === 'division_liaison';

  if (isSuperAdmin) {
    // Super Admin sees ALL proposals across all unions
    return collection(db, PROPOSALS_COLLECTION);
  } else if (user.inviteeAllUnions || allUnions.length >= 12) {
    // Division-wide Invitee or HQ Officer covering >=12 territories
    return collection(db, PROPOSALS_COLLECTION);
  } else if (allUnions.length > 0 && (isLiaisonOrCoordinator || hasMultipleUnions)) {
    // Multi-union user, Coordinator, Treasurer, or Division Liaison with assigned/invitee territories:
    const allVariants = Array.from(
      new Set(allUnions.flatMap((u) => getUnionQueryVariants(u)))
    ).slice(0, 30);

    if (allVariants.length > 1) {
      return query(
        collection(db, PROPOSALS_COLLECTION),
        where('union', 'in', allVariants)
      );
    } else if (allVariants.length === 1) {
      return query(
        collection(db, PROPOSALS_COLLECTION),
        where('union', '==', allVariants[0])
      );
    } else {
      const authorUid = user.uid || fbUser?.uid || '';
      return query(
        collection(db, PROPOSALS_COLLECTION),
        where('userId', '==', authorUid)
      );
    }
  } else {
    // Standard single-union author sees strictly their own proposals (prevents cross-author draft reads & saves quota)
    const authorUid = user.uid || fbUser?.uid || '__unauthenticated__';
    return query(
      collection(db, PROPOSALS_COLLECTION),
      where('userId', '==', authorUid)
    );
  }
}

export const PROPOSALS_STORAGE_KEY = 'onevoice27_proposals_v3';

const LEGACY_PROPOSAL_STORAGE_KEYS = [
  'onevoice27_proposals',
  'onevoice27_proposals_v1',
  'onevoice27_proposals_v2',
  'onevoice27_proposals_cache',
];

const EVICTABLE_STORAGE_KEYS = [
  'onevoice27_public_monitor_cache',
  'onevoice27_activity_logs_cache',
  'onevoice27_activity_logs_v1',
  'onevoice27_activity_logs',
  'onevoice27_notifications_cache',
  'onevoice27_notifications_v1',
  'onevoice27_notifications',
];

/**
 * Compacts an array of proposals so its serialized JSON stays well within browser storage limits.
 */
function compactProposalsPayload(proposals: Proposal[], maxLogs = 8, maxNotes = 20): Proposal[] {
  return proposals.map((p) => ({
    ...p,
    activityLog: Array.isArray(p.activityLog) ? p.activityLog.slice(-maxLogs) : undefined,
    reviewNotes: Array.isArray(p.reviewNotes) ? p.reviewNotes.slice(-maxNotes) : p.reviewNotes,
  }));
}

/**
 * Proactively frees up localStorage headroom on app boot so a previously full 5MB storage
 * never blocks initial session writes or proposal cache updates.
 */
export function ensureLocalStorageHeadroom(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    // 1. Purge obsolete legacy keys
    for (const legacyKey of LEGACY_PROPOSAL_STORAGE_KEYS) {
      try {
        localStorage.removeItem(legacyKey);
      } catch {
        // ignore
      }
    }

    // 2. Measure current localStorage footprint
    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const v = localStorage.getItem(k) || '';
        totalChars += k.length + v.length;
      }
    }

    // If total usage is over ~2.2M chars (~4.4MB UTF-16), evict secondary caches & compact proposals
    const rawProposals = localStorage.getItem(PROPOSALS_STORAGE_KEY);
    if (totalChars > 2_200_000 || (rawProposals && rawProposals.length > 1_600_000)) {
      for (const evictKey of EVICTABLE_STORAGE_KEYS) {
        try {
          localStorage.removeItem(evictKey);
        } catch {
          // ignore
        }
      }
      if (rawProposals) {
        try {
          const parsed = JSON.parse(rawProposals);
          if (Array.isArray(parsed)) {
            const compacted = compactProposalsPayload(parsed, 5, 15);
            localStorage.removeItem(PROPOSALS_STORAGE_KEY);
            localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(compacted));
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Safely writes a key/value to localStorage, automatically evicting obsolete/secondary caches
 * if the browser's 5MB localStorage quota is reached so it never throws QuotaExceededError.
 */
export function safeSetStorageItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
  try {
    // Remove legacy keys first
    for (const legacyKey of LEGACY_PROPOSAL_STORAGE_KEYS) {
      if (legacyKey !== key) {
        try {
          localStorage.removeItem(legacyKey);
        } catch {
          // ignore
        }
      }
    }
    // Remove target key before setting so browser doesn't count oldSize + newSize against 5MB limit
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Evict secondary caches and retry
    try {
      for (const evictKey of EVICTABLE_STORAGE_KEYS) {
        if (evictKey !== key) {
          localStorage.removeItem(evictKey);
        }
      }
      // If writing a key other than PROPOSALS_STORAGE_KEY and storage is still full, compact PROPOSALS_STORAGE_KEY
      if (key !== PROPOSALS_STORAGE_KEY) {
        const rawProps = localStorage.getItem(PROPOSALS_STORAGE_KEY);
        if (rawProps && rawProps.length > 500_000) {
          try {
            const parsed = JSON.parse(rawProps);
            if (Array.isArray(parsed)) {
              const compacted = compactProposalsPayload(parsed, 3, 10);
              localStorage.removeItem(PROPOSALS_STORAGE_KEY);
              localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(compacted));
            }
          } catch {
            localStorage.removeItem(PROPOSALS_STORAGE_KEY);
          }
        }
      }
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Safely persists the proposals catalog to localStorage with automatic compaction fallback
 * if the full catalog exceeds browser storage limits.
 */
export function safePersistProposalsToLocalStorage(proposals: Proposal[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    // Always keep per-proposal activityLog bounded in localStorage cache so it doesn't balloon over time
    const bounded = compactProposalsPayload(proposals, 12, 25);
    const json = JSON.stringify(bounded);
    if (safeSetStorageItem(PROPOSALS_STORAGE_KEY, json)) {
      return;
    }
    // Fallback: compact further if 5MB limit is still exceeded
    const tighter = compactProposalsPayload(proposals, 3, 10);
    safeSetStorageItem(PROPOSALS_STORAGE_KEY, JSON.stringify(tighter));
  } catch {
    // Never throw QuotaExceededError to callers
  }
}


// Helper to execute a query with optional forceServer bypass
async function runProposalQuery(q: ReturnType<typeof buildProposalsQuery>, forceServer: boolean) {
  if (forceServer) {
    try {
      return await getDocsFromServer(q);
    } catch (serverErr) {
      console.warn('Direct server getDocs failed, falling back to standard read:', serverErr);
      return await getDocs(q);
    }
  }
  return await getDocs(q);
}

// Fetch proposals once on catalog load for Review Hub & Monitor (avoids open streaming on 130+ docs)
export async function fetchProposals(user: UserAccount, forceServer: boolean = false): Promise<Proposal[]> {
  // Wait for Firebase Auth initialization on page refresh before checking auth.currentUser
  try {
    if (typeof (auth as unknown as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
      await (auth as unknown as { authStateReady: () => Promise<void> }).authStateReady();
    }
  } catch {
    // ignore
  }

  if (!auth.currentUser) {
    try {
      const raw = localStorage.getItem(PROPOSALS_STORAGE_KEY) || localStorage.getItem('onevoice27_proposals_cache');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  try {
    const proposalsMap = new Map<string, Proposal>();
    const primaryQuery = buildProposalsQuery(user);
    const primarySnapshot = await runProposalQuery(primaryQuery, forceServer);

    primarySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Proposal;
      if (data && (data.id || docSnap.id)) {
        proposalsMap.set(data.id || docSnap.id, { ...data, id: data.id || docSnap.id });
      }
    });

    // For non-super-admin users, also run fast parallel queries by UID and email
    // so proposals transferred to their email or created under an earlier UID are always included.
    const fbUser = auth.currentUser;
    const isSuperAdmin =
      user.role === 'super_admin' ||
      isSuperAdminEmail(user.email) ||
      isSuperAdminEmail(fbUser?.email);

    // If a multi-union officer/liaison has 8–11 unions whose variant aliases exceed 30 items
    // (without division-wide scope), fetch the remaining >30 variant chunk so zero territories are missed.
    const allUnionsForVariants = getUserAllUnions(user);
    if (!isSuperAdmin && !user.inviteeAllUnions && allUnionsForVariants.length > 0 && allUnionsForVariants.length < 12) {
      const fullVariants = Array.from(
        new Set(allUnionsForVariants.flatMap((u) => getUnionQueryVariants(u)))
      );
      if (fullVariants.length > 30) {
        const overflowVariants = fullVariants.slice(30, 60);
        const overflowSnap = await runProposalQuery(
          query(collection(db, PROPOSALS_COLLECTION), where('union', 'in', overflowVariants)),
          forceServer
        ).catch(() => null);
        if (overflowSnap) {
          overflowSnap.forEach((docSnap) => {
            const data = docSnap.data() as Proposal;
            const id = data.id || docSnap.id;
            if (id && !proposalsMap.has(id)) {
              proposalsMap.set(id, { ...data, id });
            }
          });
        }
      }
    }

    // Division Liaisons do not author proposals; skip extra author queries to cut catalog query count by 66%
    if (!isSuperAdmin && user.role !== 'division_liaison') {
      const authorUid = user.uid || fbUser?.uid || '';
      const emailLower = (user.email || fbUser?.email || '').trim().toLowerCase();
      const extraQueries: Array<ReturnType<typeof buildProposalsQuery>> = [];
      const allUnions = getUserAllUnions(user);
      const primaryWasUnionQuery =
        allUnions.length > 0 &&
        (user.role === 'coordinator' || user.role === 'treasurer' || allUnions.length > 1);

      // Only run userId query if primary query was union-based (avoids running identical userId query twice)
      if (authorUid && primaryWasUnionQuery) {
        extraQueries.push(
          query(collection(db, PROPOSALS_COLLECTION), where('userId', '==', authorUid))
        );
      }
      if (emailLower) {
        extraQueries.push(
          query(collection(db, PROPOSALS_COLLECTION), where('userEmail', '==', emailLower))
        );
      }

      if (extraQueries.length > 0) {
        const extraSnapshots = await Promise.allSettled(
          extraQueries.map((eq) => runProposalQuery(eq, forceServer))
        );
        for (const res of extraSnapshots) {
          if (res.status === 'fulfilled') {
            res.value.forEach((docSnap) => {
              const data = docSnap.data() as Proposal;
              const id = data.id || docSnap.id;
              if (id && !proposalsMap.has(id)) {
                proposalsMap.set(id, { ...data, id });
              }
            });
          }
        }
      }

      // Auto-heal synthetic userId (e.g. user_173...) to the user's real Firebase Auth UID
      if (fbUser?.uid && emailLower && !fbUser.uid.startsWith('user_')) {
        for (const p of proposalsMap.values()) {
          const pEmail = (p.userEmail || p.pointOfContact?.email || '').trim().toLowerCase();
          if (pEmail === emailLower && p.userId && p.userId.startsWith('user_') && p.userId !== fbUser.uid) {
            p.userId = fbUser.uid;
            updateDoc(doc(db, PROPOSALS_COLLECTION, p.id), { userId: fbUser.uid }).catch(() => {});
          }
        }
      }
    }

    const list = Array.from(proposalsMap.values());
    list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    safePersistProposalsToLocalStorage(list);
    return list;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn('fetchProposals notice: Firestore daily quota reached. Using local cache.');
    } else {
      console.warn('fetchProposals error:', error);
    }
    try {
      const raw = localStorage.getItem(PROPOSALS_STORAGE_KEY) || localStorage.getItem('onevoice27_proposals_cache');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

// Fetch a single proposal directly by ID from Firestore (for deep-linking from notifications)
export async function fetchProposalById(proposalId: string): Promise<Proposal | null> {
  if (!proposalId) return null;
  if (!auth.currentUser) {
    try {
      const raw = localStorage.getItem(PROPOSALS_STORAGE_KEY) || localStorage.getItem('onevoice27_proposals_cache');
      if (raw) {
        const list: Proposal[] = JSON.parse(raw);
        return list.find((p) => p.id === proposalId) || null;
      }
    } catch {
      return null;
    }
  }

  try {
    const docRef = doc(db, PROPOSALS_COLLECTION, proposalId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Proposal;
    }
  } catch (err) {
    console.warn(`Notice fetching single proposal ${proposalId}:`, err);
  }
  return null;
}

// Real-time listener scoped specifically to the ACTIVE proposal being viewed/edited
export function subscribeToProposal(
  proposalId: string,
  onUpdate: (proposal: Proposal) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!auth.currentUser || !proposalId) {
    return () => {};
  }

  try {
    const docRef = doc(db, PROPOSALS_COLLECTION, proposalId);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as Proposal);
        }
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          console.warn(`Proposal ${proposalId} subscription: daily quota limit reached.`);
          if (onError) onError(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        console.warn(`Proposal ${proposalId} live listener notice:`, error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn(`Error setting up listener for proposal ${proposalId}:`, err);
    return () => {};
  }
}

// Real-time listener for proposals scoped strictly by User Role & Union
export function subscribeToProposals(
  user: UserAccount,
  onUpdate: (proposals: Proposal[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  // Only connect to Firestore if user has authenticated with Firebase
  if (!auth.currentUser) {
    return () => {};
  }

  try {
    const q = buildProposalsQuery(user);

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Proposal[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Proposal);
        });
        // Sort by updatedAt descending
        list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        onUpdate(list);
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          console.warn('Proposals subscription notice: Firestore daily read quota reached. Operating in local offline cache mode.');
          if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)));
          }
          return;
        }

        console.error('Proposals subscription error:', error);
        if (onError) {
          onError(error);
        }
        try {
          handleFirestoreError(error, OperationType.LIST, PROPOSALS_COLLECTION);
        } catch (e) {
          console.warn('Handled Firestore permission notice:', e);
        }
      }
    );
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, PROPOSALS_COLLECTION);
    } catch (e) {
      console.warn('Handled Firestore list error:', e);
    }
    return () => {};
  }
}

/**
 * Recursively removes any undefined values from an object or array
 * before sending to Firestore to prevent SDK serialization failures.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned as unknown as T;
  }
  return data;
}

function enforceProposalFirestoreBounds<T extends Record<string, unknown>>(payload: T): T {
  const next: Record<string, unknown> = { ...payload };
  if ('title' in next && typeof next.title === 'string' && next.title.length > 500) {
    next.title = next.title.slice(0, 500);
  }
  if ('reviewNotes' in next && Array.isArray(next.reviewNotes) && next.reviewNotes.length > 250) {
    next.reviewNotes = next.reviewNotes.slice(-250);
  }
  if ('activityLog' in next && Array.isArray(next.activityLog) && next.activityLog.length > 100) {
    next.activityLog = next.activityLog.slice(0, 100);
  }
  return next as T;
}

// Save or create a proposal in Firestore
export async function saveProposalToFirestore(proposal: Proposal): Promise<void> {
  // Offline / local storage mode when unauthenticated
  if (!auth.currentUser) {
    return;
  }

  const proposalRef = doc(db, PROPOSALS_COLLECTION, proposal.id);
  try {
    const { projectCode: existingCode, ...restProposal } = proposal;
    const hasExistingCodeData = Boolean(
      existingCode &&
        (existingCode.composite ||
          existingCode.projectId ||
          existingCode.phase ||
          existingCode.status ||
          existingCode.locked)
    );
    const resolvedProjectCode =
      hasExistingCodeData || proposal.divisionApproval?.authorized
        ? resolveProposalProjectCode(proposal, 1, {
            allowFallbackSequence: Boolean(existingCode?.projectId),
          })
        : undefined;

    const rawData = enforceProposalFirestoreBounds({
      ...restProposal,
      focusId: resolveExternalFocusId(proposal),
      strategicProjectId: resolveExternalStrategicProjectId(proposal),
      ...(resolvedProjectCode ? { projectCode: resolvedProjectCode } : {}),
      updatedAt: new Date().toISOString(),
    });
    const cleanData = sanitizeForFirestore(rawData) as Record<string, unknown>;
    await setDoc(proposalRef, cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${PROPOSALS_COLLECTION}/${proposal.id}`);
  }
}

// Granular field-level patch to Firestore (saves bandwidth and prevents full-document overwrites)
export async function patchProposalToFirestore(
  proposalId: string,
  diff: Partial<Proposal>,
  fullProposalFallback?: Proposal
): Promise<void> {
  if (!auth.currentUser) {
    return;
  }

  const proposalRef = doc(db, PROPOSALS_COLLECTION, proposalId);
  try {
    const rawData = enforceProposalFirestoreBounds({
      ...diff,
      updatedAt: new Date().toISOString(),
    });
    const cleanData = sanitizeForFirestore(rawData) as Record<string, unknown>;
    await updateDoc(proposalRef, cleanData);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const errCode = (error as { code?: string })?.code || '';
    const isNotFound =
      errCode === 'not-found' ||
      errMsg.includes('no document to update') ||
      errMsg.includes('not-found');

    if (!isNotFound) {
      handleFirestoreError(error, OperationType.UPDATE, `${PROPOSALS_COLLECTION}/${proposalId}`);
      return;
    }

    // If document doesn't exist yet, fallback to setDoc with merge using full proposal data if provided
    try {
      const payload = enforceProposalFirestoreBounds(
        fullProposalFallback
          ? {
              ...fullProposalFallback,
              ...diff,
              id: proposalId,
              updatedAt: new Date().toISOString(),
            }
          : {
              ...diff,
              id: proposalId,
              updatedAt: new Date().toISOString(),
            }
      );
      const cleanData = sanitizeForFirestore(payload) as Record<string, unknown>;
      await setDoc(proposalRef, cleanData, { merge: true });
    } catch (fallbackErr) {
      handleFirestoreError(fallbackErr, OperationType.WRITE, `${PROPOSALS_COLLECTION}/${proposalId}`);
    }
  }
}

// Delete proposal from Firestore
export async function deleteProposalFromFirestore(proposalId: string): Promise<void> {
  if (!auth.currentUser) {
    return;
  }

  const proposalRef = doc(db, PROPOSALS_COLLECTION, proposalId);
  try {
    await deleteDoc(proposalRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PROPOSALS_COLLECTION}/${proposalId}`);
  }
}

export const ALL_USERS_STORAGE_KEY = 'onevoice27_all_users_cache';

const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute in-memory TTL

let memoryUsersCache: { data: UserAccount[]; timestamp: number; authenticated?: boolean } | null = null;
let inFlightUsersPromise: Promise<UserAccount[]> | null = null;

let memoryLiaisonsCache: { data: UserAccount[]; timestamp: number; authenticated?: boolean } | null = null;
let inFlightLiaisonsPromise: Promise<UserAccount[]> | null = null;

let memoryLeadershipCache: { data: UserAccount[]; timestamp: number; authenticated?: boolean } | null = null;
let inFlightLeadershipPromise: Promise<UserAccount[]> | null = null;

let memoryAllocationsCache: { data: UnionBudgetAllocationDetails; timestamp: number } | null = null;
let inFlightAllocationsPromise: Promise<UnionBudgetAllocationDetails> | null = null;

let memoryKpiCapsCache: { data: StrategicKpiCaps; timestamp: number } | null = null;
let inFlightKpiCapsPromise: Promise<StrategicKpiCaps> | null = null;

const DIRECTORY_UPDATED_EVENT = 'onevoice27:directory-updated';
const directoryChangeListeners = new Set<() => void>();

export function subscribeToLiaisonDirectoryChanges(listener: () => void): () => void {
  directoryChangeListeners.add(listener);
  if (typeof window !== 'undefined') {
    window.addEventListener(DIRECTORY_UPDATED_EVENT, listener);
  }
  return () => {
    directoryChangeListeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener(DIRECTORY_UPDATED_EVENT, listener);
    }
  };
}

export function emitLiaisonDirectoryUpdated(): void {
  directoryChangeListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(DIRECTORY_UPDATED_EVENT));
    } catch {
      // ignore
    }
  }
}

export function clearProposalServiceMemoryCache(): void {
  memoryUsersCache = null;
  memoryLiaisonsCache = null;
  memoryLeadershipCache = null;
  memoryAllocationsCache = null;
  memoryKpiCapsCache = null;
}

const ROLE_MERGE_PRIORITY: Record<UserRole, number> = {
  super_admin: 5,
  division_liaison: 4,
  treasurer: 3,
  coordinator: 2,
  user: 1,
};

function parseRecordTimestampMs(record: Partial<UserAccount> & { updatedAt?: string; createdAt?: string }): number {
  const raw = record.updatedAt || record.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function isSyntheticUid(uid?: string): boolean {
  return !uid || uid.startsWith('user_') || uid.startsWith('admin_');
}

function mergeUniqueStrings(a?: string[], b?: string[]): string[] {
  return Array.from(new Set([...(a || []), ...(b || [])].filter(Boolean)));
}

/**
 * Safely merges duplicate Firestore user docs that share the same normalized email
 * so a stale secondary doc cannot overwrite an admin-configured Step 4 voting power.
 */
function mergeUserAccountRecords(existing: UserAccount | undefined, incoming: UserAccount): UserAccount {
  if (!existing) return incoming;

  const existingTs = parseRecordTimestampMs(existing as UserAccount & { updatedAt?: string; createdAt?: string });
  const incomingTs = parseRecordTimestampMs(incoming as UserAccount & { updatedAt?: string; createdAt?: string });

  const preferredUid =
    !isSyntheticUid(incoming.uid)
      ? incoming.uid
      : !isSyntheticUid(existing.uid)
      ? existing.uid
      : incoming.uid || existing.uid;

  if (existingTs !== incomingTs && (existingTs > 0 || incomingTs > 0)) {
    const primary = incomingTs > existingTs ? incoming : existing;
    const secondary = incomingTs > existingTs ? existing : incoming;
    // Never let a plain auth-login 'user' doc downgrade an admin/liaison/officer doc
    const resolvedRole =
      primary.role === 'user' && secondary.role && secondary.role !== 'user'
        ? secondary.role
        : primary.role || secondary.role || 'user';
    const resolvedIsLiaison =
      primary.isLiaison !== undefined ? primary.isLiaison : secondary.isLiaison;
    const resolvedLiaisonVotingUnions =
      primary.liaisonVotingUnions && primary.liaisonVotingUnions.length > 0
        ? primary.liaisonVotingUnions
        : resolvedIsLiaison === false
        ? []
        : secondary.liaisonVotingUnions && secondary.liaisonVotingUnions.length > 0
        ? secondary.liaisonVotingUnions
        : primary.liaisonVotingUnions;
    const resolvedAssignedUnions =
      primary.assignedUnions && primary.assignedUnions.length > 0
        ? primary.assignedUnions
        : secondary.assignedUnions;

    return {
      ...secondary,
      ...primary,
      uid: preferredUid,
      role: resolvedRole,
      email: primary.email || secondary.email,
      displayName:
        (primary.displayName && primary.displayName !== 'Adventist Leader'
          ? primary.displayName
          : secondary.displayName) || primary.displayName,
      title: primary.title || secondary.title,
      department: primary.department || secondary.department,
      institution: primary.institution || secondary.institution,
      photoURL: primary.photoURL || secondary.photoURL,
      ...(resolvedIsLiaison !== undefined ? { isLiaison: resolvedIsLiaison } : {}),
      ...(resolvedLiaisonVotingUnions !== undefined
        ? { liaisonVotingUnions: resolvedLiaisonVotingUnions }
        : {}),
      ...(resolvedAssignedUnions !== undefined ? { assignedUnions: resolvedAssignedUnions } : {}),
    };
  }

  const existingPrio = ROLE_MERGE_PRIORITY[existing.role || 'user'] || 1;
  const incomingPrio = ROLE_MERGE_PRIORITY[incoming.role || 'user'] || 1;
  const primary = incomingPrio >= existingPrio ? incoming : existing;
  const secondary = incomingPrio >= existingPrio ? existing : incoming;

  const mergedRole = primary.role || secondary.role || 'user';
  const mergedIsLiaison = Boolean(existing.isLiaison || incoming.isLiaison);
  const mergedLiaisonVotingUnions = mergeUniqueStrings(
    existing.liaisonVotingUnions,
    incoming.liaisonVotingUnions
  );
  const mergedAssignedUnions = mergeUniqueStrings(existing.assignedUnions, incoming.assignedUnions);
  const mergedInviteeUnions = mergeUniqueStrings(existing.inviteeUnions, incoming.inviteeUnions);

  return {
    ...secondary,
    ...primary,
    uid: preferredUid,
    role: mergedRole,
    email: primary.email || secondary.email,
    displayName:
      (primary.displayName && primary.displayName !== 'Adventist Leader'
        ? primary.displayName
        : secondary.displayName) || primary.displayName,
    union: primary.union || secondary.union,
    ...(mergedAssignedUnions.length > 0 ? { assignedUnions: mergedAssignedUnions } : {}),
    ...(mergedInviteeUnions.length > 0 ? { inviteeUnions: mergedInviteeUnions } : {}),
    ...(existing.inviteeAllUnions || incoming.inviteeAllUnions ? { inviteeAllUnions: true } : {}),
    ...(mergedIsLiaison ? { isLiaison: true } : {}),
    ...(mergedLiaisonVotingUnions.length > 0 ? { liaisonVotingUnions: mergedLiaisonVotingUnions } : {}),
    unionConfirmed: Boolean(existing.unionConfirmed || incoming.unionConfirmed),
  };
}

/**
 * Lightweight, role-safe query fetching ONLY registered Division Liaisons & Liaison-enabled Division Admins
 * for Step 4 Governance Pipeline vote progress calculation, avoiding full directory downloads.
 */
export async function fetchDivisionLiaisons(forceRefresh: boolean = false): Promise<UserAccount[]> {
  try {
    await auth.authStateReady();
  } catch {
    // ignore
  }

  const now = Date.now();
  const isSignedIn = Boolean(auth.currentUser);
  if (
    !forceRefresh &&
    memoryLiaisonsCache &&
    (!isSignedIn || memoryLiaisonsCache.authenticated) &&
    now - memoryLiaisonsCache.timestamp < SESSION_CACHE_TTL_MS
  ) {
    return memoryLiaisonsCache.data;
  }
  if (
    !forceRefresh &&
    memoryUsersCache &&
    (!isSignedIn || memoryUsersCache.authenticated) &&
    now - memoryUsersCache.timestamp < SESSION_CACHE_TTL_MS
  ) {
    return memoryUsersCache.data.filter((u) => isUserLiaisonEligible(u));
  }
  if (!forceRefresh && inFlightLiaisonsPromise) {
    return inFlightLiaisonsPromise;
  }

  inFlightLiaisonsPromise = (async () => {
    const mergedByEmail = new Map<string, UserAccount>();
    let fetchedFromFirestore = false;

    if (auth.currentUser) {
      try {
        const qByRole = query(
          collection(db, USERS_COLLECTION),
          where('role', 'in', ['division_liaison', 'super_admin'])
        );
        const qByFlag = query(
          collection(db, USERS_COLLECTION),
          where('isLiaison', '==', true)
        );
        const [roleSnap, flagSnap] = await Promise.all([
          getDocsFromServer(qByRole).catch(() => getDocs(qByRole)),
          getDocsFromServer(qByFlag).catch(() => getDocs(qByFlag).catch(() => null)),
        ]);
        roleSnap.forEach((d) => {
          const u = d.data() as UserAccount;
          if (u) {
            const candidate: UserAccount = { ...u, uid: u.uid || d.id };
            const key = (candidate.email || candidate.uid || d.id).trim().toLowerCase();
            mergedByEmail.set(key, mergeUserAccountRecords(mergedByEmail.get(key), candidate));
          }
        });
        if (flagSnap) {
          flagSnap.forEach((d) => {
            const u = d.data() as UserAccount;
            if (u) {
              const candidate: UserAccount = { ...u, uid: u.uid || d.id };
              const key = (candidate.email || candidate.uid || d.id).trim().toLowerCase();
              mergedByEmail.set(key, mergeUserAccountRecords(mergedByEmail.get(key), candidate));
            }
          });
        }
        fetchedFromFirestore = true;
      } catch (err) {
        console.warn('Notice querying division liaisons:', err);
      }
    }

    if (!fetchedFromFirestore) {
      try {
        const cachedRaw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
        if (cachedRaw) {
          const cachedList: UserAccount[] = JSON.parse(cachedRaw);
          if (Array.isArray(cachedList)) {
            for (const u of cachedList) {
              if (u && (u.email || u.uid)) {
                const key = (u.email || u.uid).trim().toLowerCase();
                mergedByEmail.set(key, mergeUserAccountRecords(mergedByEmail.get(key), u));
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const result = Array.from(mergedByEmail.values()).filter((u) => isUserLiaisonEligible(u));
    if (fetchedFromFirestore) {
      memoryLiaisonsCache = { data: result, timestamp: Date.now(), authenticated: true };
    }
    return result;
  })();

  try {
    return await inFlightLiaisonsPromise;
  } finally {
    inFlightLiaisonsPromise = null;
  }
}

/**
 * Lightweight, role-safe query fetching ONLY Union Coordinators, Treasurers, and Division Liaisons
 * for Executive Monitor territory officer attribution, avoiding downloading regular author profiles.
 */
export async function fetchLeadershipOfficers(forceRefresh: boolean = false): Promise<UserAccount[]> {
  try {
    await auth.authStateReady();
  } catch {
    // ignore
  }

  const now = Date.now();
  const isSignedIn = Boolean(auth.currentUser);
  if (
    !forceRefresh &&
    memoryLeadershipCache &&
    (!isSignedIn || memoryLeadershipCache.authenticated) &&
    now - memoryLeadershipCache.timestamp < SESSION_CACHE_TTL_MS
  ) {
    return memoryLeadershipCache.data;
  }
  if (
    !forceRefresh &&
    memoryUsersCache &&
    (!isSignedIn || memoryUsersCache.authenticated) &&
    now - memoryUsersCache.timestamp < SESSION_CACHE_TTL_MS
  ) {
    return memoryUsersCache.data.filter(
      (u) => u.role === 'coordinator' || u.role === 'treasurer' || isUserLiaisonEligible(u)
    );
  }
  if (!forceRefresh && inFlightLeadershipPromise) {
    return inFlightLeadershipPromise;
  }

  inFlightLeadershipPromise = (async () => {
    const mergedByEmail = new Map<string, UserAccount>();
    let fetchedFromFirestore = false;

    if (auth.currentUser) {
      try {
        const q = query(
          collection(db, USERS_COLLECTION),
          where('role', 'in', ['coordinator', 'treasurer', 'division_liaison', 'super_admin'])
        );
        const snap = forceRefresh
          ? await getDocsFromServer(q).catch(() => getDocs(q))
          : await getDocs(q);
        snap.forEach((d) => {
          const u = d.data() as UserAccount;
          if (u) {
            const candidate: UserAccount = { ...u, uid: u.uid || d.id };
            const key = (candidate.email || candidate.uid || d.id).trim().toLowerCase();
            mergedByEmail.set(key, mergeUserAccountRecords(mergedByEmail.get(key), candidate));
          }
        });
        fetchedFromFirestore = true;
      } catch (err) {
        console.warn('Notice querying leadership officers:', err);
      }
    }

    if (!fetchedFromFirestore) {
      try {
        const cachedRaw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
        if (cachedRaw) {
          const cachedList: UserAccount[] = JSON.parse(cachedRaw);
          if (Array.isArray(cachedList)) {
            for (const u of cachedList) {
              if (u && (u.email || u.uid)) {
                const key = (u.email || u.uid).trim().toLowerCase();
                mergedByEmail.set(key, mergeUserAccountRecords(mergedByEmail.get(key), u));
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const result = Array.from(mergedByEmail.values()).filter(
      (u) => u.role === 'coordinator' || u.role === 'treasurer' || isUserLiaisonEligible(u)
    );
    if (fetchedFromFirestore) {
      memoryLeadershipCache = { data: result, timestamp: Date.now(), authenticated: true };
    }
    return result;
  })();

  try {
    return await inFlightLeadershipPromise;
  } finally {
    inFlightLeadershipPromise = null;
  }
}

// Fetch all registered users with multi-source reconciliation (Firestore users, proposals, and local cache)
export async function fetchAllUsers(forceRefresh: boolean = false): Promise<UserAccount[]> {
  try {
    await auth.authStateReady();
  } catch {
    // ignore
  }

  const now = Date.now();
  const isSignedIn = Boolean(auth.currentUser);
  if (
    !forceRefresh &&
    memoryUsersCache &&
    (!isSignedIn || memoryUsersCache.authenticated) &&
    now - memoryUsersCache.timestamp < SESSION_CACHE_TTL_MS
  ) {
    return memoryUsersCache.data;
  }
  if (!forceRefresh && inFlightUsersPromise) {
    return inFlightUsersPromise;
  }

  inFlightUsersPromise = (async () => {
    const usersMap = new Map<string, UserAccount>();
    let fetchedFromFirestore = false;

    // 1. Fetch from Firestore users collection (when authenticated, always prefer server over stale IndexedDB cache)
    if (auth.currentUser) {
      try {
        const colRef = collection(db, USERS_COLLECTION);
        const snap = await getDocsFromServer(colRef).catch(() => getDocs(colRef));
        snap.forEach((d) => {
          const u = d.data() as UserAccount;
          if (u) {
            const candidate: UserAccount = { ...u, uid: u.uid || d.id };
            const key = (candidate.email || candidate.uid || d.id).trim().toLowerCase();
            usersMap.set(key, mergeUserAccountRecords(usersMap.get(key), candidate));
          }
        });
        fetchedFromFirestore = true;
      } catch (error) {
        console.warn('Notice querying users collection:', error);
      }
    }

    // 2. Fallback to local storage cache only if Firestore did not respond
    if (!fetchedFromFirestore) {
      try {
        const cachedRaw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
        if (cachedRaw) {
          const cachedList: UserAccount[] = JSON.parse(cachedRaw);
          if (Array.isArray(cachedList)) {
            for (const u of cachedList) {
              if (u && (u.email || u.uid)) {
                const key = (u.email || u.uid).trim().toLowerCase();
                usersMap.set(key, mergeUserAccountRecords(usersMap.get(key), u));
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error reading cached users directory:', err);
      }
    }

    // 3. Scan proposals collection in local cache to discover any registered authors whose user profile doc is missing (Super Admin only)
    const isCurrentUserAdmin = isSuperAdminEmail(auth.currentUser?.email);

    if (isCurrentUserAdmin) {
      try {
        let localProps: Proposal[] = [];
        try {
          const raw = localStorage.getItem('onevoice27_proposals_cache');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) localProps = parsed;
          }
        } catch {
          // ignore
        }

        localProps.forEach((p) => {
          const authorEmail = (p.userEmail || p.pointOfContact?.email || '').trim().toLowerCase();
          const authorName = (p.userName || p.pointOfContact?.name || '').trim();
          const authorUnion = p.union || 'East Central Philippine Union Conference';
          const authorUid = p.userId || `user_${authorEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

          if (authorEmail && !usersMap.has(authorEmail)) {
            const discoveredUser: UserAccount = {
              uid: authorUid,
              displayName: authorName || authorEmail.split('@')[0].replace(/[._]/g, ' '),
              email: authorEmail,
              role: 'user',
              union: authorUnion,
              department: 'Media & Communication',
              institution: authorUnion,
            };
            usersMap.set(authorEmail, discoveredUser);
          }
        });
      } catch (error) {
        console.warn('Notice scanning proposals for missing user accounts:', error);
      }
    }

    // 4. Ensure Division Admins (Anthony Stanyer & Angelina Pagarigan) are always present as Super Admin
    const adminEmail = 'astanyer@adventist.asia';
    if (!usersMap.has(adminEmail)) {
      usersMap.set(adminEmail, {
        uid: 'admin_astanyer',
        displayName: 'Anthony Stanyer',
        email: adminEmail,
        role: 'super_admin',
        union: 'Southern Asia-Pacific Division',
        department: 'Communication & Hope Channel',
        institution: 'Southern Asia-Pacific Division (SSD Headquarters)',
        unionConfirmed: true,
      });
    }

    const angieEmail = 'adpsalms272017@gmail.com';
    if (!usersMap.has(angieEmail)) {
      usersMap.set(angieEmail, {
        uid: 'admin_angie',
        displayName: 'ANGELINA PAGARIGAN',
        email: angieEmail,
        role: 'super_admin',
        union: 'Southern Luzon Philippine Union Mission',
        title: 'Director',
        department: 'Media & Communication',
        institution: 'Southern Luzon Philippine Union Mission',
        unionConfirmed: true,
      });
    }

    const result = Array.from(usersMap.values());
    if (fetchedFromFirestore) {
      memoryUsersCache = { data: result, timestamp: Date.now(), authenticated: true };
    }

    // 5. Update local storage cache
    try {
      localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(result));
    } catch {
      // ignore
    }

    return result;
  })();

  try {
    return await inFlightUsersPromise;
  } finally {
    inFlightUsersPromise = null;
  }
}

// Bulk provision multiple user accounts at once (Super Admin)
export async function bulkProvisionUserAccounts(
  accounts: Array<{
    displayName: string;
    email: string;
    union: string;
    role: UserRole;
    department?: string;
    institution?: string;
  }>
): Promise<{ added: number; updated: number; accounts: UserAccount[] }> {
  const raw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
  const existing: UserAccount[] = raw ? JSON.parse(raw) : [];
  const existingMap = new Map<string, UserAccount>();
  for (const u of existing) {
    if (u.email) existingMap.set(u.email.toLowerCase(), u);
  }

  let addedCount = 0;
  let updatedCount = 0;
  const processedAccounts: UserAccount[] = [];

  for (const acc of accounts) {
    const emailClean = acc.email.trim().toLowerCase();
    if (!emailClean) continue;

    const existingAcc = existingMap.get(emailClean);
    const uid = existingAcc
      ? existingAcc.uid
      : `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const finalAccount: UserAccount = {
      uid,
      displayName: acc.displayName.trim() || emailClean.split('@')[0].replace(/[._]/g, ' '),
      email: emailClean,
      role: acc.role || 'user',
      union: acc.union || 'East Central Philippine Union Conference',
      department: acc.department || 'Media & Communication',
      institution: acc.institution || acc.union || 'Adventist Organization',
    };

    if (existingAcc) {
      updatedCount++;
    } else {
      addedCount++;
    }

    existingMap.set(emailClean, finalAccount);
    processedAccounts.push(finalAccount);

    // Save each to Firestore
    if (auth.currentUser) {
      try {
        const userRef = doc(db, USERS_COLLECTION, uid);
        await setDoc(
          userRef,
          {
            ...finalAccount,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        if (finalAccount.role === 'super_admin') {
          const adminRef = doc(db, 'admins', uid);
          await setDoc(adminRef, { uid, email: emailClean }, { merge: true });
        }
      } catch (err) {
        console.warn(`Could not save user ${emailClean} to Firestore:`, err);
      }
    }
  }

  // Update local storage and in-memory cache
  const finalAllUsers = Array.from(existingMap.values());
  memoryUsersCache = { data: finalAllUsers, timestamp: Date.now(), authenticated: Boolean(auth.currentUser) };
  memoryLiaisonsCache = null;
  memoryLeadershipCache = null;
  try {
    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(finalAllUsers));
  } catch {
    // ignore
  }
  emitLiaisonDirectoryUpdated();

  return { added: addedCount, updated: updatedCount, accounts: processedAccounts };
}

// Provision or add a new user account directly (Super Admin)
export async function provisionNewUserAccount(accountData: {
  displayName: string;
  email: string;
  union: string;
  role: UserRole;
  title?: string;
  department?: string;
  institution?: string;
}): Promise<UserAccount> {
  const emailClean = accountData.email.trim().toLowerCase();
  const uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newAccount: UserAccount = {
    uid,
    displayName: accountData.displayName.trim(),
    email: emailClean,
    role: accountData.role,
    union: accountData.union,
    title: accountData.title?.trim() || (accountData.role === 'super_admin' ? 'Division Admin' : 'Director'),
    department: accountData.department?.trim() || 'Media & Communication',
    institution: accountData.institution?.trim() || accountData.union,
  };

  // 1. Always invalidate liaison/leadership caches & update in-memory + local cache
  memoryLiaisonsCache = null;
  memoryLeadershipCache = null;
  if (memoryUsersCache) {
    const filteredMem = memoryUsersCache.data.filter((u) => (u.email || '').toLowerCase() !== emailClean);
    memoryUsersCache = {
      data: [newAccount, ...filteredMem],
      timestamp: Date.now(),
      authenticated: memoryUsersCache.authenticated,
    };
  }
  try {
    const raw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
    const existing: UserAccount[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((u) => (u.email || '').toLowerCase() !== emailClean);
    filtered.push(newAccount);
    if (!memoryUsersCache) {
      memoryUsersCache = { data: filtered, timestamp: Date.now(), authenticated: Boolean(auth.currentUser) };
    }
    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }

  // 2. Persist to Firestore if authenticated
  if (auth.currentUser) {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      await setDoc(
        userRef,
        {
          ...newAccount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (accountData.role === 'super_admin') {
        const adminRef = doc(db, 'admins', uid);
        await setDoc(adminRef, { uid, email: emailClean }, { merge: true });
      }
    } catch (error) {
      console.error('Failed to write new user to Firestore:', error);
      throw error;
    }
  }

  emitLiaisonDirectoryUpdated();
  return newAccount;
}

// Update full user account details (Super Admin)
export async function updateUserAccountDetails(
  targetUid: string,
  updates: Partial<UserAccount>
): Promise<void> {
  // 1. Always invalidate liaison and leadership caches immediately (even if localStorage is missing/full)
  memoryLiaisonsCache = null;
  memoryLeadershipCache = null;

  let resolvedEmail = (updates.email || '').trim().toLowerCase();

  // Check memory cache first for email resolution & update in-memory users cache immediately
  if (memoryUsersCache) {
    const memIdx = memoryUsersCache.data.findIndex(
      (u) => u.uid === targetUid || (resolvedEmail && (u.email || '').trim().toLowerCase() === resolvedEmail)
    );
    if (memIdx >= 0) {
      if (!resolvedEmail) {
        resolvedEmail = (memoryUsersCache.data[memIdx].email || '').trim().toLowerCase();
      }
      const nextList = [...memoryUsersCache.data];
      nextList[memIdx] = { ...nextList[memIdx], ...updates };
      memoryUsersCache = {
        data: nextList,
        timestamp: Date.now(),
        authenticated: memoryUsersCache.authenticated,
      };
    }
  }

  // Update local storage cache as well
  try {
    const raw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
    if (raw) {
      const list: UserAccount[] = JSON.parse(raw);
      const idx = list.findIndex(
        (u) => u.uid === targetUid || (resolvedEmail && (u.email || '').trim().toLowerCase() === resolvedEmail)
      );
      if (idx >= 0) {
        if (!resolvedEmail) {
          resolvedEmail = (list[idx].email || '').trim().toLowerCase();
        }
        list[idx] = { ...list[idx], ...updates };
        if (!memoryUsersCache) {
          memoryUsersCache = { data: list, timestamp: Date.now(), authenticated: Boolean(auth.currentUser) };
        }
        localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch {
    // ignore
  }

  // 2. Persist to Firestore (and sync any sibling user docs sharing the same email)
  if (!auth.currentUser) {
    emitLiaisonDirectoryUpdated();
    return;
  }

  const userRef = doc(db, USERS_COLLECTION, targetUid);
  const nowIso = new Date().toISOString();
  const cleanUpdates = sanitizeForFirestore({
    ...updates,
    updatedAt: nowIso,
  }) as Record<string, unknown>;

  try {
    if (!resolvedEmail) {
      try {
        const currentSnap = await getDoc(userRef);
        if (currentSnap.exists()) {
          const existingData = currentSnap.data() as UserAccount;
          resolvedEmail = (existingData.email || '').trim().toLowerCase();
        }
      } catch {
        // ignore
      }
    }

    await setDoc(userRef, cleanUpdates, { merge: true });

    const syncedDocIds = new Set<string>([targetUid]);

    // Sync any sibling user documents sharing the same email (case-insensitive across pre-provisioned & Auth UID docs)
    if (resolvedEmail) {
      try {
        const emailQuery = query(collection(db, USERS_COLLECTION), where('email', '==', resolvedEmail));
        const [emailDocs, allDocs] = await Promise.all([
          getDocsFromServer(emailQuery).catch(() => getDocs(emailQuery)),
          getDocsFromServer(collection(db, USERS_COLLECTION)).catch(() => null),
        ]);
        const matchingDocs = new Map<string, boolean>();
        emailDocs.forEach((d) => matchingDocs.set(d.id, true));
        if (allDocs) {
          allDocs.forEach((d) => {
            const docEmail = ((d.data() as Partial<UserAccount>)?.email || '').trim().toLowerCase();
            if (docEmail === resolvedEmail) {
              matchingDocs.set(d.id, true);
            }
          });
        }
        for (const docId of matchingDocs.keys()) {
          syncedDocIds.add(docId);
          if (docId !== targetUid) {
            await setDoc(doc(db, USERS_COLLECTION, docId), cleanUpdates, { merge: true });
          }
        }
      } catch {
        // ignore
      }
    }

    // If role was updated to super_admin or changed from super_admin, sync admin registry for all matching docs
    if (updates.role) {
      for (const docId of syncedDocIds) {
        const adminRef = doc(db, 'admins', docId);
        if (updates.role === 'super_admin') {
          await setDoc(adminRef, { uid: docId, email: resolvedEmail || updates.email || '' }, { merge: true });
        } else {
          try {
            await deleteDoc(adminRef);
          } catch {
            // ignore
          }
        }
      }
    }

    emitLiaisonDirectoryUpdated();
  } catch (error) {
    console.error('Error updating user account details in Firestore:', error);
    throw error;
  }
}

// Delete user account from directory and Firestore (Super Admin only)
export async function deleteUserAccount(
  targetUid: string,
  targetEmail?: string
): Promise<void> {
  const cleanEmail = (targetEmail || '').trim().toLowerCase();
  // Protection: Never allow deleting the primary Super Admin account or self
  if (cleanEmail === 'astanyer@adventist.asia') {
    throw new Error('The primary Division Admin account cannot be deleted.');
  }
  if (auth.currentUser && auth.currentUser.uid === targetUid) {
    throw new Error('You cannot delete your own active administrator account.');
  }

  // 1. Always invalidate liaison/leadership caches & remove from memory + local cache
  memoryLiaisonsCache = null;
  memoryLeadershipCache = null;
  if (memoryUsersCache) {
    memoryUsersCache = {
      data: memoryUsersCache.data.filter(
        (u) => u.uid !== targetUid && (!cleanEmail || (u.email || '').toLowerCase() !== cleanEmail)
      ),
      timestamp: Date.now(),
      authenticated: memoryUsersCache.authenticated,
    };
  }
  try {
    const raw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
    if (raw) {
      const list: UserAccount[] = JSON.parse(raw);
      const filtered = list.filter((u) => u.uid !== targetUid && (!cleanEmail || (u.email || '').toLowerCase() !== cleanEmail));
      if (!memoryUsersCache) {
        memoryUsersCache = { data: filtered, timestamp: Date.now(), authenticated: Boolean(auth.currentUser) };
      }
      localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {
    // ignore
  }

  // 2. Delete from Firestore if authenticated
  if (auth.currentUser) {
    try {
      const userRef = doc(db, USERS_COLLECTION, targetUid);
      await deleteDoc(userRef);

      const adminRef = doc(db, 'admins', targetUid);
      await deleteDoc(adminRef);
    } catch (err) {
      console.warn('Notice deleting user account from Firestore:', err);
    }
  }

  emitLiaisonDirectoryUpdated();
}

// Update a user's role and assigned union (Super Admin only)
export async function updateUserRoleAndUnion(
  targetUid: string,
  newRole: UserRole,
  newUnion: string,
  userData?: Partial<UserAccount>
): Promise<void> {
  return updateUserAccountDetails(targetUid, {
    role: newRole,
    union: newUnion,
    unionConfirmed: true,
    ...userData,
  });
}

export const SETTINGS_COLLECTION = 'settings';
export const BUDGET_ALLOCATIONS_DOC = 'budget_allocations';

export const ALLOCATION_SCHEMA_VERSION = 2;

export const DEFAULT_OFFICIAL_UNION_ALLOCATIONS: Record<string, number> = {
  // Union Conferences
  'East Central Philippine Union Conference': 186000,   // 6% ($120k SSD + $66k GC)
  'East Indonesia Union Conference': 304000,            // 9% ($180k SSD + $99k GC + $25k SPD)
  'Southwestern Philippine Union Conference': 186000,   // 6% ($120k SSD + $66k GC)
  // Union Missions
  'Central Indonesia Union Mission': 273000,            // 8% ($160k SSD + $88k GC + $25k SPD)
  'Malaysia Union Mission': 304000,                     // 9% ($180k SSD + $99k GC + $25k SPD)
  'Myanmar Union Mission': 279000,                      // 9% ($180k SSD + $99k GC)
  'Northern Luzon Philippine Union Mission': 186000,    // 6% ($120k SSD + $66k GC)
  'Southeastern Asia Union Mission': 366000,            // 11% ($220k SSD + $121k GC + $25k SPD)
  'Southeastern Asia Union Mission (Oversees and Brunei)': 366000,
  'Southeastern Philippine Union Mission': 186000,      // 6% ($120k SSD + $66k GC)
  'Southern Luzon Philippine Union Mission': 186000,    // 6% ($120k SSD + $66k GC)
  'West Central Philippine Union Mission': 186000,      // 6% ($120k SSD + $66k GC)
  'West Indonesia Union Mission': 273000,               // 8% ($160k SSD + $88k GC + $25k SPD)
  // Attached Fields
  'Singapore Conference': 155000,                       // 5% ($100k SSD + $55k GC)
  'Timor-Leste Mission': 155000,                        // 5% ($100k SSD + $55k GC)
};

/**
 * Detects if a saved allocations map still has the legacy v1 row-shifted defaults
 * (where Singapore Conference was 273,000 and Southeastern Asia Union Mission was 155,000)
 * and upgrades unedited shifted defaults to the v2 official spreadsheet values.
 */
export function reconcileShiftedV1Allocations(
  rawAlloc: Record<string, number>,
  schemaVersion?: number
): { allocations: Record<string, number>; wasUpgraded: boolean } {
  if (schemaVersion && schemaVersion >= ALLOCATION_SCHEMA_VERSION) {
    return {
      allocations: { ...DEFAULT_OFFICIAL_UNION_ALLOCATIONS, ...rawAlloc },
      wasUpgraded: false,
    };
  }

  const isLegacyShifted =
    rawAlloc['Singapore Conference'] === 273000 &&
    rawAlloc['Timor-Leste Mission'] === 273000 &&
    rawAlloc['Southern Luzon Philippine Union Mission'] === 366000;

  if (isLegacyShifted) {
    return {
      allocations: { ...DEFAULT_OFFICIAL_UNION_ALLOCATIONS },
      wasUpgraded: true,
    };
  }

  return {
    allocations:
      Object.keys(rawAlloc).length > 0
        ? { ...DEFAULT_OFFICIAL_UNION_ALLOCATIONS, ...rawAlloc }
        : { ...DEFAULT_OFFICIAL_UNION_ALLOCATIONS },
    wasUpgraded: false,
  };
}

export interface UnionBudgetAllocationDetails {
  allocations: Record<string, number>;
  matchingPledges: Record<string, number>;
}

// Fetch union budget allocations and entity matching pledges
export async function fetchBudgetAllocationDetails(
  forceRefresh: boolean = false
): Promise<UnionBudgetAllocationDetails> {
  const now = Date.now();
  if (!forceRefresh && memoryAllocationsCache && now - memoryAllocationsCache.timestamp < SESSION_CACHE_TTL_MS) {
    return memoryAllocationsCache.data;
  }
  if (!forceRefresh && inFlightAllocationsPromise) {
    return inFlightAllocationsPromise;
  }

  inFlightAllocationsPromise = (async () => {
    const cachedAlloc = localStorage.getItem('onevoice27_budget_allocations');
    const cachedMatch = localStorage.getItem('onevoice27_matching_pledges');
    const cachedVersion = Number(localStorage.getItem('onevoice27_budget_allocations_version')) || 1;
    const fallback: UnionBudgetAllocationDetails = {
      allocations: { ...DEFAULT_OFFICIAL_UNION_ALLOCATIONS },
      matchingPledges: {},
    };

    if (cachedAlloc) {
      try {
        const parsed = JSON.parse(cachedAlloc);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          delete parsed['Southern Asia-Pacific Division (SSD Headquarters)'];
          delete parsed['Other Union / Attached Field'];
          const { allocations: reconciled } = reconcileShiftedV1Allocations(parsed, cachedVersion);
          fallback.allocations = reconciled;
        }
      } catch {
        fallback.allocations = { ...DEFAULT_OFFICIAL_UNION_ALLOCATIONS };
      }
    } else {
      safeSetStorageItem('onevoice27_budget_allocations', JSON.stringify(fallback.allocations));
      safeSetStorageItem('onevoice27_budget_allocations_version', String(ALLOCATION_SCHEMA_VERSION));
    }

    if (cachedMatch) {
      try {
        const parsedMatch = JSON.parse(cachedMatch);
        if (parsedMatch && typeof parsedMatch === 'object') {
          delete parsedMatch['Southern Asia-Pacific Division (SSD Headquarters)'];
          delete parsedMatch['Other Union / Attached Field'];
          fallback.matchingPledges = parsedMatch;
        }
      } catch {
        // ignore
      }
    }

    try {
      const docRef = doc(db, SETTINGS_COLLECTION, BUDGET_ALLOCATIONS_DOC);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const rawAlloc = (data.allocations as Record<string, number>) || {};
        const matchingPledges = (data.matchingPledges as Record<string, number>) || {};
        const docVersion = Number(data.allocationSchemaVersion) || 1;
        delete rawAlloc['Southern Asia-Pacific Division (SSD Headquarters)'];
        delete rawAlloc['Other Union / Attached Field'];
        delete matchingPledges['Southern Asia-Pacific Division (SSD Headquarters)'];
        delete matchingPledges['Other Union / Attached Field'];

        const { allocations, wasUpgraded } = reconcileShiftedV1Allocations(rawAlloc, docVersion);

        safeSetStorageItem('onevoice27_budget_allocations', JSON.stringify(allocations));
        safeSetStorageItem('onevoice27_budget_allocations_version', String(ALLOCATION_SCHEMA_VERSION));
        safeSetStorageItem('onevoice27_matching_pledges', JSON.stringify(matchingPledges));

        if (wasUpgraded && isSuperAdminEmail(auth.currentUser?.email)) {
          saveBudgetAllocations(
            allocations,
            'Spreadsheet V2 Sync ($2.0M SSD + $1.1M GC + $125k SPD)',
            matchingPledges
          ).catch(() => {});
        }

        const resolved = { allocations, matchingPledges };
        memoryAllocationsCache = { data: resolved, timestamp: Date.now() };
        return resolved;
      } else {
        if (isSuperAdminEmail(auth.currentUser?.email)) {
          saveBudgetAllocations(fallback.allocations, 'Initial Master Budget ($3.225M)', fallback.matchingPledges).catch(() => {});
        }
        memoryAllocationsCache = { data: fallback, timestamp: Date.now() };
        return fallback;
      }
    } catch (error) {
      console.warn('Fallback to local budget allocations:', error);
      memoryAllocationsCache = { data: fallback, timestamp: Date.now() };
      return fallback;
    }
  })();

  try {
    return await inFlightAllocationsPromise;
  } finally {
    inFlightAllocationsPromise = null;
  }
}

// Fetch union budget allocations (backward-compatible)
export async function fetchBudgetAllocations(forceRefresh: boolean = false): Promise<Record<string, number>> {
  const details = await fetchBudgetAllocationDetails(forceRefresh);
  return details.allocations;
}

// Save union budget allocations & matching pledges (Super Admin)
export async function saveBudgetAllocations(
  allocations: Record<string, number>,
  updatedBy?: string,
  matchingPledges?: Record<string, number>
): Promise<void> {
  safeSetStorageItem('onevoice27_budget_allocations', JSON.stringify(allocations));
  safeSetStorageItem('onevoice27_budget_allocations_version', String(ALLOCATION_SCHEMA_VERSION));
  if (matchingPledges) {
    safeSetStorageItem('onevoice27_matching_pledges', JSON.stringify(matchingPledges));
  }
  memoryAllocationsCache = {
    data: {
      allocations,
      matchingPledges: matchingPledges ?? memoryAllocationsCache?.data.matchingPledges ?? {},
    },
    timestamp: Date.now(),
  };

  if (!auth.currentUser) {
    return;
  }

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, BUDGET_ALLOCATIONS_DOC);
    await setDoc(
      docRef,
      {
        allocations,
        allocationSchemaVersion: ALLOCATION_SCHEMA_VERSION,
        ...(matchingPledges !== undefined ? { matchingPledges } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || auth.currentUser.email || auth.currentUser.uid,
      },
      { merge: true }
    );
    if (typeof fetch !== 'undefined') {
      fetch('/api/v1/admin/invalidate-cache', { method: 'POST' }).catch(() => {});
    }
  } catch (error) {
    console.warn('Could not persist budget allocations to Firestore:', error);
  }
}

export const KPI_CAPS_DOC = 'kpi_caps';

export const DEFAULT_KPI_CAPS: StrategicKpiCaps = {
  pillarCaps: {
    pillar_1: 12.5,
    pillar_2: 58.5,
    pillar_3: 29.0,
  },
  kpiCaps: {
    kpi_1: 12.5,
    kpi_2: 15.0,
    kpi_3: 20.0,
    kpi_4: 13.5,
    kpi_5: 10.0,
    kpi_6: 17.0,
    kpi_7: 12.0,
  },
};

// Fetch strategic percentage caps
export async function fetchStrategicKpiCaps(forceRefresh: boolean = false): Promise<StrategicKpiCaps> {
  const now = Date.now();
  if (!forceRefresh && memoryKpiCapsCache && now - memoryKpiCapsCache.timestamp < SESSION_CACHE_TTL_MS) {
    return memoryKpiCapsCache.data;
  }
  if (!forceRefresh && inFlightKpiCapsPromise) {
    return inFlightKpiCapsPromise;
  }

  inFlightKpiCapsPromise = (async () => {
    const cached = localStorage.getItem('onevoice27_kpi_caps');
    let fallback: StrategicKpiCaps = DEFAULT_KPI_CAPS;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Upgrade from legacy test defaults if no custom save occurred
        if (!parsed.updatedAt && parsed.pillarCaps?.pillar_1 === 20) {
          fallback = DEFAULT_KPI_CAPS;
        } else {
          fallback = { ...DEFAULT_KPI_CAPS, ...parsed };
        }
      } catch {
        // ignore
      }
    }

    try {
      const docRef = doc(db, SETTINGS_COLLECTION, KPI_CAPS_DOC);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as StrategicKpiCaps;
        const merged = {
          pillarCaps: { ...DEFAULT_KPI_CAPS.pillarCaps, ...(data.pillarCaps || {}) },
          kpiCaps: { ...DEFAULT_KPI_CAPS.kpiCaps, ...(data.kpiCaps || {}) },
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        };
        safeSetStorageItem('onevoice27_kpi_caps', JSON.stringify(merged));
        memoryKpiCapsCache = { data: merged, timestamp: Date.now() };
        return merged;
      }
      memoryKpiCapsCache = { data: fallback, timestamp: Date.now() };
      return fallback;
    } catch (error) {
      console.warn('Fallback to local KPI caps:', error);
      memoryKpiCapsCache = { data: fallback, timestamp: Date.now() };
      return fallback;
    }
  })();

  try {
    return await inFlightKpiCapsPromise;
  } finally {
    inFlightKpiCapsPromise = null;
  }
}

// Save strategic percentage caps (Super Admin)
export async function saveStrategicKpiCaps(
  caps: StrategicKpiCaps,
  updatedBy?: string
): Promise<void> {
  safeSetStorageItem('onevoice27_kpi_caps', JSON.stringify(caps));
  memoryKpiCapsCache = { data: caps, timestamp: Date.now() };

  if (!auth.currentUser) {
    return;
  }

  try {
    const docRef = doc(db, SETTINGS_COLLECTION, KPI_CAPS_DOC);
    await setDoc(
      docRef,
      {
        ...caps,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || auth.currentUser.email || auth.currentUser.uid,
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Could not persist KPI caps to Firestore:', error);
  }
}

export interface TransferOwnershipOptions {
  updatePointOfContact: boolean;
  addAuditNote?: boolean;
  reason?: string;
}

export interface NewOwnerPayload {
  uid?: string;
  email: string;
  displayName: string;
  union?: string;
  phone?: string;
}

/**
 * Transfers proposal ownership to a new user account.
 * Updates userId, userEmail, userName, sets audit metadata,
 * optionally synchronizes pointOfContact, appends a review note,
 * and ensures the recipient is provisioned in the users collection.
 */
export async function transferProposalOwnership(
  proposal: Proposal,
  newOwner: NewOwnerPayload,
  adminUser: UserAccount,
  options: TransferOwnershipOptions
): Promise<Proposal> {
  const cleanEmail = newOwner.email.trim().toLowerCase();
  const cleanName = newOwner.displayName.trim() || cleanEmail;
  const targetUnion = newOwner.union || proposal.union;

  if (!cleanEmail) {
    throw new Error('A valid email address is required for the new owner.');
  }

  // Resolve UID: if provided use it, otherwise match from existing users or create deterministic ID
  let targetUid = newOwner.uid;
  if (!targetUid) {
    try {
      const allUsers = await fetchAllUsers();
      const matched = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (matched) {
        targetUid = matched.uid;
      }
    } catch {
      // fallback
    }
  }
  if (!targetUid) {
    targetUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  // Ensure new owner has a user profile document in Firestore so they are recognized upon sign-in
  if (auth.currentUser) {
    try {
      const userRef = doc(db, USERS_COLLECTION, targetUid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const newUserAccount: UserAccount = {
          uid: targetUid,
          displayName: cleanName,
          email: cleanEmail,
          role: 'user',
          union: targetUnion,
          title: 'Project Lead',
          department: 'Media & Communication',
          institution: targetUnion,
          unionConfirmed: true,
        };
        await setDoc(
          userRef,
          {
            ...newUserAccount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Update local users cache
        try {
          const raw = localStorage.getItem(ALL_USERS_STORAGE_KEY);
          const list: UserAccount[] = raw ? JSON.parse(raw) : [];
          if (!list.some((u) => u.email.toLowerCase() === cleanEmail)) {
            list.push(newUserAccount);
            localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(list));
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Notice ensuring user record for new proposal owner:', err);
    }
  }

  const nowIso = new Date().toISOString();
  const prevOwnerName = proposal.userName || proposal.pointOfContact?.name || proposal.userEmail || 'Previous Owner';
  const prevOwnerEmail = proposal.userEmail || proposal.pointOfContact?.email || '';

  // Prepare note if audit note requested
  const updatedReviewNotes = [...(proposal.reviewNotes || [])];
  if (options.addAuditNote !== false) {
    const auditNoteText = `Proposal ownership transferred from ${prevOwnerName} (${prevOwnerEmail || 'no email'}) to ${cleanName} (${cleanEmail}) by ${adminUser.displayName || adminUser.email}${options.reason ? `. Reason: ${options.reason}` : ''}.`;

    updatedReviewNotes.push({
      id: `note_transfer_${Date.now()}`,
      text: auditNoteText,
      authorName: adminUser.displayName || 'Super Admin',
      authorEmail: adminUser.email,
      authorRole: adminUser.role,
      createdAt: nowIso,
    });
  }

  // Build the updated proposal
  const updatedProposal: Proposal = {
    ...proposal,
    userId: targetUid,
    userName: cleanName,
    userEmail: cleanEmail,
    updatedAt: nowIso,
    transferredAt: nowIso,
    transferredBy: adminUser.displayName || adminUser.email,
    transferredByEmail: adminUser.email,
    previousOwnerEmail: prevOwnerEmail,
    previousOwnerName: prevOwnerName,
    reviewNotes: updatedReviewNotes,
    ...(options.updatePointOfContact
      ? {
          pointOfContact: {
            name: cleanName,
            email: cleanEmail,
            phone: newOwner.phone || proposal.pointOfContact?.phone || '',
          },
        }
      : {}),
  };

  // 1. Update in local storage
  try {
    const rawProposals = localStorage.getItem('onevoice27_proposals_v3');
    if (rawProposals) {
      const list: Proposal[] = JSON.parse(rawProposals);
      const idx = list.findIndex((p) => p.id === proposal.id);
      if (idx >= 0) {
        list[idx] = updatedProposal;
        safePersistProposalsToLocalStorage(list);
      }
    }
  } catch {
    // ignore
  }

  // 2. Persist to Firestore
  if (auth.currentUser) {
    try {
      const proposalRef = doc(db, PROPOSALS_COLLECTION, proposal.id);
      await setDoc(proposalRef, updatedProposal, { merge: true });
    } catch (error) {
      console.error('Failed to write proposal ownership transfer to Firestore:', error);
      handleFirestoreError(error, OperationType.WRITE, `${PROPOSALS_COLLECTION}/${proposal.id}`);
      throw error;
    }
  }

  return updatedProposal;
}

export const PRIVATE_SETTINGS_COLLECTION = 'private_settings';
export const GC_API_PRIVATE_DOC = 'gc_api_config';
export const GC_API_META_DOC = 'api_config_meta';
const LEGACY_GC_API_CONFIG_DOC = 'api_config';

export interface GcApiConfig {
  apiKey: string;
  enabled: boolean;
  orgId: string;
  approvedOnly: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface GcApiPublicMeta {
  apiKeyHash: string;
  enabled: boolean;
  orgId: string;
  approvedOnly: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export function generateSecureGcApiKey(): string {
  const bytes = new Uint8Array(24);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `ov27_ssd_live_${hex}`;
}

async function computeSha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function notifyServerCacheInvalidation(): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    await fetch('/api/v1/admin/invalidate-cache', { method: 'POST' });
  } catch {
    // non-blocking
  }
}

export async function fetchGcApiConfig(): Promise<GcApiConfig> {
  const fallback: GcApiConfig = {
    apiKey: '',
    enabled: true,
    orgId: 'AT1111',
    approvedOnly: true,
  };

  if (!auth.currentUser) {
    return fallback;
  }

  try {
    // 1. Read strictly from admin-protected private_settings/gc_api_config
    const privateRef = doc(db, PRIVATE_SETTINGS_COLLECTION, GC_API_PRIVATE_DOC);
    const privateSnap = await getDoc(privateRef);
    if (privateSnap.exists()) {
      const data = privateSnap.data() as Partial<GcApiConfig>;
      if (data.apiKey) {
        const resolved: GcApiConfig = {
          apiKey: data.apiKey,
          enabled: data.enabled !== false,
          orgId: data.orgId || 'AT1111',
          approvedOnly: true,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        };
        // Ensure public SHA-256 hash metadata is in sync for server verification
        const metaRef = doc(db, SETTINGS_COLLECTION, GC_API_META_DOC);
        const metaSnap = await getDoc(metaRef).catch(() => null);
        const expectedHash = await computeSha256Hex(resolved.apiKey);
        if (!metaSnap || !metaSnap.exists() || (metaSnap.data() as Partial<GcApiPublicMeta>)?.apiKeyHash !== expectedHash) {
          await setDoc(
            metaRef,
            sanitizeForFirestore({
              apiKeyHash: expectedHash,
              enabled: resolved.enabled,
              orgId: resolved.orgId,
              approvedOnly: true,
              updatedAt: resolved.updatedAt || new Date().toISOString(),
              updatedBy: resolved.updatedBy || auth.currentUser.email || 'Super Admin',
            }),
            { merge: true }
          ).catch(() => {});
          notifyServerCacheInvalidation();
        }
        return resolved;
      }
    }

    // 2. One-time migration from legacy settings/api_config (if present) or provision a fresh cryptographic key
    let migratedKey = '';
    let migratedEnabled = true;
    let migratedOrgId = 'AT1111';
    try {
      const legacyRef = doc(db, SETTINGS_COLLECTION, LEGACY_GC_API_CONFIG_DOC);
      const legacySnap = await getDoc(legacyRef);
      if (legacySnap.exists()) {
        const legacyData = legacySnap.data() as Partial<GcApiConfig>;
        if (legacyData.apiKey) migratedKey = legacyData.apiKey;
        if (legacyData.enabled === false) migratedEnabled = false;
        if (legacyData.orgId) migratedOrgId = legacyData.orgId;
        // Purge plaintext secret from legacy /settings document
        await deleteDoc(legacyRef).catch(() => {});
      }
    } catch {
      // ignore
    }

    const initialKey = migratedKey || generateSecureGcApiKey();
    return await saveGcApiConfig(
      {
        apiKey: initialKey,
        enabled: migratedEnabled,
        orgId: migratedOrgId,
      },
      auth.currentUser.email || 'Super Admin'
    );
  } catch (err) {
    console.warn('Notice reading private GC API config:', err);
  }
  return fallback;
}

export async function saveGcApiConfig(
  config: Partial<GcApiConfig>,
  updatedBy?: string
): Promise<GcApiConfig> {
  let baseConfig: GcApiConfig = {
    apiKey: config.apiKey || '',
    enabled: true,
    orgId: 'AT1111',
    approvedOnly: true,
  };

  if (auth.currentUser && (!config.apiKey || config.enabled === undefined)) {
    try {
      const privateSnap = await getDoc(doc(db, PRIVATE_SETTINGS_COLLECTION, GC_API_PRIVATE_DOC));
      if (privateSnap.exists()) {
        const existing = privateSnap.data() as Partial<GcApiConfig>;
        baseConfig = {
          apiKey: existing.apiKey || '',
          enabled: existing.enabled !== false,
          orgId: existing.orgId || 'AT1111',
          approvedOnly: true,
          updatedAt: existing.updatedAt,
          updatedBy: existing.updatedBy,
        };
      }
    } catch {
      // ignore
    }
  }

  const finalApiKey = config.apiKey || baseConfig.apiKey || generateSecureGcApiKey();
  const merged: GcApiConfig = {
    ...baseConfig,
    ...config,
    apiKey: finalApiKey,
    approvedOnly: true,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || auth.currentUser?.email || 'Super Admin',
  };

  if (auth.currentUser) {
    try {
      const apiKeyHash = await computeSha256Hex(merged.apiKey);
      const privateRef = doc(db, PRIVATE_SETTINGS_COLLECTION, GC_API_PRIVATE_DOC);
      const metaRef = doc(db, SETTINGS_COLLECTION, GC_API_META_DOC);

      await Promise.all([
        setDoc(privateRef, sanitizeForFirestore(merged), { merge: true }),
        setDoc(
          metaRef,
          sanitizeForFirestore({
            apiKeyHash,
            enabled: merged.enabled,
            orgId: merged.orgId,
            approvedOnly: true,
            updatedAt: merged.updatedAt,
            updatedBy: merged.updatedBy,
          }),
          { merge: true }
        ),
        deleteDoc(doc(db, SETTINGS_COLLECTION, LEGACY_GC_API_CONFIG_DOC)).catch(() => {}),
      ]);
      await notifyServerCacheInvalidation();
    } catch (err) {
      console.warn('Could not persist GC API config to Firestore:', err);
    }
  }
  return merged;
}

export const PROJECT_ID_COUNTERS_DOC = 'project_id_counters';

/**
 * Scans existing proposals for the highest numeric project ID sequence matching
 * either `OVSSD<ACRONYM>###` or legacy `OVPHC<ACRONYM>###`.
 */
function getMaxExistingSequenceForAcronym(acronym: string, existingProposals: Proposal[] = []): number {
  let maxSeq = 0;
  const regex = new RegExp(`^(?:OVSSD|OVPHC)${acronym}(\\d+)$`, 'i');
  for (const p of existingProposals) {
    const pid = p.projectCode?.projectId?.trim();
    if (!pid) continue;
    const m = pid.match(regex);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }
  return maxSeq;
}

/**
 * Atomically allocates the next sequential `OVSSD<UNION>###` Project ID via Firestore transaction
 * on `/settings/project_id_counters`, ensuring monotonic IDs that never shift when proposals change.
 */
export async function allocateNextProjectId(
  unionName: string,
  options?: { orgId?: string; existingProposals?: Proposal[] }
): Promise<{ projectId: string; sequenceNumber: number; orgId: string; acronym: string }> {
  const acronym = getUnionProjectAcronym(unionName);
  const orgId = options?.orgId || 'AT1111';
  const existingMax = getMaxExistingSequenceForAcronym(acronym, options?.existingProposals);

  if (auth.currentUser) {
    try {
      const counterRef = doc(db, SETTINGS_COLLECTION, PROJECT_ID_COUNTERS_DOC);
      const sequenceNumber = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const data = snap.exists() ? (snap.data() as { counters?: Record<string, number> }) : {};
        const counters = data.counters && typeof data.counters === 'object' ? { ...data.counters } : {};
        const currentVal = typeof counters[acronym] === 'number' && !isNaN(counters[acronym]) ? counters[acronym] : 0;
        const nextVal = Math.max(currentVal, existingMax) + 1;
        counters[acronym] = nextVal;
        tx.set(
          counterRef,
          {
            counters,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        return nextVal;
      });
      return {
        projectId: synthesizeProjectId(unionName, sequenceNumber),
        sequenceNumber,
        orgId,
        acronym,
      };
    } catch (err) {
      console.warn('Notice running project ID counter transaction, using local sequence fallback:', err);
    }
  }

  const fallbackSeq = existingMax + 1;
  return {
    projectId: synthesizeProjectId(unionName, fallbackSeq),
    sequenceNumber: fallbackSeq,
    orgId,
    acronym,
  };
}

/**
 * Builds the locked Step 5 `ProposalProjectCode` payload, initializing `phase = 'Planning'`
 * and `status = 'Active'` when unset and preserving any admin pre-assigned `orgId` or `projectId`.
 */
export function buildLockedStep5ProjectCode(
  proposal: Proposal,
  actor: { displayName?: string; email?: string },
  allocatedProjectId?: string | null,
  defaultOrgId: string = 'AT1111'
): ProposalProjectCode {
  const existing = proposal.projectCode;
  const orgId = (existing?.orgId || defaultOrgId).trim() || defaultOrgId;
  const projectId =
    existing?.projectId && existing.projectId.trim() !== ''
      ? existing.projectId.trim()
      : allocatedProjectId && allocatedProjectId.trim() !== ''
      ? allocatedProjectId.trim()
      : null;

  const phase =
    existing?.phase && String(existing.phase).trim() !== '' ? existing.phase : 'Planning';
  const status =
    existing?.status && String(existing.status).trim() !== '' ? existing.status : 'Active';

  const nowIso = new Date().toISOString();
  const actorName = actor.displayName || actor.email || 'SSD OV27 Committee';
  const actorEmail = actor.email || '';

  return {
    composite: formatCompositeProjectCode({ orgId, projectId, phase, status }, defaultOrgId),
    orgId,
    projectId,
    phase,
    status,
    locked: true,
    lockedAt: existing?.lockedAt || nowIso,
    lockedBy: existing?.lockedBy || actorName,
    lockedByEmail: existing?.lockedByEmail || actorEmail,
  };
}

export interface ReconcileStep5Result {
  updatedProposals: Proposal[];
  assignedCount: number;
  dedupedCount: number;
  normalizedCount: number;
}

/**
 * One-click Division Admin reconciliation for all Step 5 authorized proposals:
 * - Preserves each Union's oldest unique persisted `projectId`.
 * - Atomically assigns unique monotonic `OVSSD<UNION>###` IDs to any proposals
 *   missing a `projectId` or carrying a duplicate `projectId` (e.g. duplicate `001`),
 *   updating `/settings/project_id_counters`, proposal documents, and audit logs.
 */
export async function reconcileStep5ProjectCodes(
  proposals: Proposal[],
  actor: { uid?: string; displayName?: string; email?: string; role?: string; union?: string },
  defaultOrgId: string = 'AT1111'
): Promise<ReconcileStep5Result> {
  const authorized = proposals.filter((p) => isProposalApprovedForApi(p));
  const byAcronym = new Map<string, Proposal[]>();

  for (const p of authorized) {
    const acronym = getUnionProjectAcronym(p.union);
    const list = byAcronym.get(acronym) || [];
    list.push(p);
    byAcronym.set(acronym, list);
  }

  interface PendingAssignment {
    proposal: Proposal;
    acronym: string;
    reason: 'missing' | 'duplicate';
    previousProjectId: string | null;
  }

  const pendingAssignments: PendingAssignment[] = [];
  const claimedSeqsByAcronym = new Map<string, Set<number>>();
  const maxValidSeqByAcronym = new Map<string, number>();
  const toNormalize: Proposal[] = [];

  for (const [acronym, list] of byAcronym.entries()) {
    list.sort((a, b) => {
      const tA = new Date(
        a.divisionApproval?.timestamp ||
          a.divisionApproval?.authorizedDate ||
          a.unionApproval?.timestamp ||
          a.unionApproval?.actionDate ||
          a.createdAt ||
          a.updatedAt ||
          0
      ).getTime();
      const tB = new Date(
        b.divisionApproval?.timestamp ||
          b.divisionApproval?.authorizedDate ||
          b.unionApproval?.timestamp ||
          b.unionApproval?.actionDate ||
          b.createdAt ||
          b.updatedAt ||
          0
      ).getTime();
      const safeA = isNaN(tA) ? 0 : tA;
      const safeB = isNaN(tB) ? 0 : tB;
      if (safeA !== safeB) return safeA - safeB;
      return a.id.localeCompare(b.id);
    });

    const seenUpperIds = new Set<string>();
    const claimedSeqs = new Set<number>();
    let maxSeq = 0;
    const seqRegex = new RegExp(`^(?:OVSSD|OVPHC)${acronym}(\\d+)$`, 'i');

    for (const p of list) {
      const rawPid = p.projectCode?.projectId?.trim() || '';
      const upperPid = rawPid.toUpperCase();
      if (!rawPid) {
        pendingAssignments.push({
          proposal: p,
          acronym,
          reason: 'missing',
          previousProjectId: null,
        });
        continue;
      }
      if (seenUpperIds.has(upperPid)) {
        pendingAssignments.push({
          proposal: p,
          acronym,
          reason: 'duplicate',
          previousProjectId: rawPid,
        });
        continue;
      }

      seenUpperIds.add(upperPid);
      const match = upperPid.match(seqRegex);
      if (match?.[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > 0) {
          claimedSeqs.add(parsed);
          if (parsed > maxSeq) maxSeq = parsed;
        }
      }

      // Check if an already-unique proposal needs locked/phase/status/composite normalization
      const expectedPhase =
        p.projectCode?.phase && String(p.projectCode.phase).trim() !== ''
          ? p.projectCode.phase
          : 'Planning';
      const expectedStatus =
        p.projectCode?.status && String(p.projectCode.status).trim() !== ''
          ? p.projectCode.status
          : 'Active';
      const expectedOrgId = (p.projectCode?.orgId || defaultOrgId).trim() || defaultOrgId;
      const expectedComposite = formatCompositeProjectCode(
        {
          orgId: expectedOrgId,
          projectId: rawPid,
          phase: expectedPhase,
          status: expectedStatus,
        },
        defaultOrgId
      );
      if (
        !p.projectCode?.locked ||
        p.projectCode?.phase !== expectedPhase ||
        p.projectCode?.status !== expectedStatus ||
        p.projectCode?.composite !== expectedComposite
      ) {
        toNormalize.push(p);
      }
    }

    claimedSeqsByAcronym.set(acronym, claimedSeqs);
    maxValidSeqByAcronym.set(acronym, maxSeq);
  }

  const assignedSequenceByProposalId = new Map<string, number>();

  if (pendingAssignments.length > 0) {
    const affectedAcronyms = Array.from(new Set(pendingAssignments.map((item) => item.acronym)));
    const pendingByAcronym = new Map<string, PendingAssignment[]>();
    for (const item of pendingAssignments) {
      const arr = pendingByAcronym.get(item.acronym) || [];
      arr.push(item);
      pendingByAcronym.set(item.acronym, arr);
    }

    const computeNextSequences = (baseCounters: Record<string, number>): Record<string, number> => {
      const nextCounters = { ...baseCounters };
      for (const acronym of affectedAcronyms) {
        const items = pendingByAcronym.get(acronym) || [];
        const claimed = claimedSeqsByAcronym.get(acronym) || new Set<number>();
        const existingCounter =
          typeof nextCounters[acronym] === 'number' && !isNaN(nextCounters[acronym])
            ? nextCounters[acronym]
            : 0;
        let candidate = Math.max(existingCounter, maxValidSeqByAcronym.get(acronym) || 0) + 1;
        let highestAssigned = existingCounter;

        for (const item of items) {
          while (claimed.has(candidate)) {
            candidate += 1;
          }
          claimed.add(candidate);
          assignedSequenceByProposalId.set(item.proposal.id, candidate);
          if (candidate > highestAssigned) highestAssigned = candidate;
          candidate += 1;
        }
        nextCounters[acronym] = Math.max(highestAssigned, maxValidSeqByAcronym.get(acronym) || 0);
      }
      return nextCounters;
    };

    if (auth.currentUser) {
      try {
        const counterRef = doc(db, SETTINGS_COLLECTION, PROJECT_ID_COUNTERS_DOC);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(counterRef);
          const data = snap.exists() ? (snap.data() as { counters?: Record<string, number> }) : {};
          const baseCounters =
            data.counters && typeof data.counters === 'object' ? { ...data.counters } : {};
          const nextCounters = computeNextSequences(baseCounters);
          tx.set(
            counterRef,
            {
              counters: nextCounters,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        });
      } catch (err) {
        console.warn('Notice updating project ID counters during batch reconciliation:', err);
        if (assignedSequenceByProposalId.size === 0) {
          computeNextSequences({});
        }
      }
    } else {
      computeNextSequences({});
    }
  }

  const updatedProposals: Proposal[] = [];
  let assignedCount = 0;
  let dedupedCount = 0;
  let normalizedCount = 0;

  for (const item of pendingAssignments) {
    const seq = assignedSequenceByProposalId.get(item.proposal.id);
    if (!seq) continue;

    const newProjectId = synthesizeProjectId(item.proposal.union, seq);
    const prevComposite = formatCompositeProjectCode(item.proposal.projectCode, defaultOrgId);
    const orgId = (item.proposal.projectCode?.orgId || defaultOrgId).trim() || defaultOrgId;
    const lockedCode = buildLockedStep5ProjectCode(
      {
        ...item.proposal,
        projectCode: {
          ...item.proposal.projectCode,
          orgId,
          projectId: newProjectId,
          phase: item.proposal.projectCode?.phase ?? null,
          status: item.proposal.projectCode?.status ?? null,
          composite: formatCompositeProjectCode(
            {
              orgId,
              projectId: newProjectId,
              phase: item.proposal.projectCode?.phase || 'Planning',
              status: item.proposal.projectCode?.status || 'Active',
            },
            orgId
          ),
        },
      },
      actor,
      newProjectId,
      orgId
    );

    let updatedProposal: Proposal = {
      ...item.proposal,
      projectCode: lockedCode,
      updatedAt: new Date().toISOString(),
    };

    if (item.reason === 'duplicate') {
      dedupedCount += 1;
      updatedProposal = appendActivityToProposal(
        updatedProposal,
        'project_code_edited',
        actor,
        `Re-sequenced duplicate Step 5 Project ID from ${item.previousProjectId || '—'} to ${newProjectId}`,
        {
          actionNumber:
            updatedProposal.divisionApproval?.referenceNumber ||
            updatedProposal.unionApproval?.actionNumber,
          field: 'projectId',
          previousValue: item.previousProjectId || '—',
          newValue: newProjectId,
        }
      );
    } else {
      assignedCount += 1;
      updatedProposal = appendActivityToProposal(
        updatedProposal,
        'project_code_locked',
        actor,
        `Assigned & locked sequential Step 5 Project Code: ${lockedCode.composite}`,
        {
          actionNumber:
            updatedProposal.divisionApproval?.referenceNumber ||
            updatedProposal.unionApproval?.actionNumber,
          field: 'projectCode',
          previousValue: prevComposite,
          newValue: lockedCode.composite,
        }
      );
    }

    await patchProposalToFirestore(
      updatedProposal.id,
      {
        projectCode: updatedProposal.projectCode,
        activityLog: updatedProposal.activityLog,
      },
      updatedProposal
    );
    updatedProposals.push(updatedProposal);
  }

  for (const p of toNormalize) {
    const lockedCode = buildLockedStep5ProjectCode(p, actor, p.projectCode?.projectId, defaultOrgId);
    const updatedProposal: Proposal = {
      ...p,
      projectCode: lockedCode,
      updatedAt: new Date().toISOString(),
    };
    await patchProposalToFirestore(
      updatedProposal.id,
      {
        projectCode: updatedProposal.projectCode,
      },
      updatedProposal
    );
    normalizedCount += 1;
    updatedProposals.push(updatedProposal);
  }

  return {
    updatedProposals,
    assignedCount,
    dedupedCount,
    normalizedCount,
  };
}

export const GC_API_SNAPSHOTS_COLLECTION = 'gc_api_snapshots';

export async function computeGcExportDocId(apiKey: string): Promise<string> {
  return await computeSha256Hex(`${apiKey}:gc_export_v1`);
}

let lastGcExportSignature: string | null = null;

/**
 * Publishes the precomputed, Step-5-only external API export payload to
 * `/gc_api_snapshots/<sha256(apiKey + ':gc_export_v1')>` so server.ts can serve
 * `/api/v1/proposals` without keeping `/proposals` publicly readable.
 */
export async function syncGcApiExportSnapshot(
  proposals: Proposal[],
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
    const privateSnap = await getDoc(doc(db, PRIVATE_SETTINGS_COLLECTION, GC_API_PRIVATE_DOC));
    if (!privateSnap.exists()) return false;
    const cfg = privateSnap.data() as Partial<GcApiConfig>;
    if (!cfg.apiKey) return false;

    const exportDocId = await computeGcExportDocId(cfg.apiKey);
    const defaultOrgId = cfg.orgId || 'AT1111';
    const allUnionApproved = proposals.filter(
      (p) => p.status === 'approved' || Boolean(p.unionApproval?.actionNumber)
    );
    const step5Authorized = allUnionApproved.filter((p) => isProposalApprovedForApi(p));

    const budgetDetails = await fetchBudgetAllocationDetails();
    const { byProposalId: attributionMap } = computeAllProposalsFundingAttribution(
      allUnionApproved,
      budgetDetails.allocations,
      budgetDetails.matchingPledges
    );
    const sequenceMap = buildCollisionFreeUnionSequenceMap(step5Authorized);

    const items: ExternalProposalApiListItem[] = [];
    const envelopesById: Record<string, ExternalProposalEnvelope> = {};

    for (const p of step5Authorized) {
      const canonUnion = getCanonicalUnion(p.union) || p.union || 'SSD';
      const acronym = UNION_ACRONYMS[p.union] || UNION_ACRONYMS[canonUnion] || 'SSD';
      const seqIndex = sequenceMap.get(p.id) || 1;
      const envelope = toExternalProposalJson(p, seqIndex, defaultOrgId, attributionMap[p.id]);

      const listItem: ExternalProposalApiListItem = {
        id: p.id,
        union: canonUnion,
        unionAcronym: acronym,
        status: 'approved',
        actionNumber: p.unionApproval?.actionNumber || null,
        approvedAt: p.unionApproval?.timestamp || p.reviewedAt || p.updatedAt || null,
        divisionAuthorizedAt: p.divisionApproval?.timestamp || p.divisionApproval?.authorizedDate || null,
        authorizationRef: p.divisionApproval?.referenceNumber || null,
        updatedAt: p.updatedAt || p.createdAt,
        proposal: envelope.proposal,
        projectCode: envelope.projectCode,
      };
      items.push(listItem);
      envelopesById[p.id] = envelope;
      if (envelope.projectCode.projectId) {
        envelopesById[envelope.projectCode.projectId.toLowerCase()] = envelope;
      }
    }

    const signature = JSON.stringify({
      docId: exportDocId,
      orgId: defaultOrgId,
      ids: items.map((i) => `${i.id}:${i.updatedAt}:${i.projectCode.composite}`),
    });

    if (!forceWrite && lastGcExportSignature === signature) {
      return true;
    }

    await setDoc(
      doc(db, GC_API_SNAPSHOTS_COLLECTION, exportDocId),
      sanitizeForFirestore({
        updatedAt: new Date().toISOString(),
        orgId: defaultOrgId,
        items,
        envelopesById,
      })
    );
    lastGcExportSignature = signature;
    return true;
  } catch (err) {
    console.warn('Notice syncing GC API export snapshot:', err);
    return false;
  }
}




