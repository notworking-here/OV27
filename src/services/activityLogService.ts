import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, isQuotaExceededError, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Proposal,
  UserAccount,
  ProposalActivityEvent,
  ActivityEventType,
  getCanonicalUnion,
} from '../types';

export const ACTIVITY_LOGS_COLLECTION = 'activity_logs';
export const ACTIVITY_LOGS_STORAGE_KEY = 'onevoice27_activity_logs_cache';
const MAX_GLOBAL_LOGS = 150;
const MAX_PROPOSAL_LOGS = 50;

/**
 * Loads cached activity logs from localStorage for 0ms offline rendering.
 */
export function getLocalActivityLogs(): ProposalActivityEvent[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Notice reading activity logs cache:', err);
    return [];
  }
}

/**
 * Saves activity logs to localStorage cache.
 */
export function saveLocalActivityLogs(logs: ProposalActivityEvent[]): void {
  try {
    const trimmed = logs.slice(0, MAX_GLOBAL_LOGS);
    localStorage.setItem(ACTIVITY_LOGS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Notice writing activity logs cache:', err);
  }
}

/**
 * Records a new lifecycle activity event into Firestore and local cache.
 */
export async function recordActivityLog(
  eventInput: Omit<ProposalActivityEvent, 'id' | 'timestamp'> & { timestamp?: string }
): Promise<ProposalActivityEvent> {
  const timestamp = eventInput.timestamp || new Date().toISOString();
  const eventId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const safeDetails =
    typeof eventInput.details === 'string' && eventInput.details.length > 1900
      ? `${eventInput.details.slice(0, 1897)}...`
      : eventInput.details || '';

  const event: ProposalActivityEvent = {
    ...eventInput,
    id: eventId,
    timestamp,
    details: safeDetails,
    actorUid: auth.currentUser?.uid || eventInput.actorUid,
    union: getCanonicalUnion(eventInput.union) || eventInput.union,
  };

  // 1. Immediately store in local cache
  const existing = getLocalActivityLogs();
  const updatedCache = [event, ...existing.filter((e) => e.id !== eventId)].slice(0, MAX_GLOBAL_LOGS);
  saveLocalActivityLogs(updatedCache);

  // 2. Persist to Firestore in background if authenticated
  if (auth.currentUser) {
    try {
      const logRef = doc(db, ACTIVITY_LOGS_COLLECTION, eventId);
      const cleanPayload = Object.fromEntries(
        Object.entries(event).filter(([, v]) => v !== undefined)
      );
      await setDoc(logRef, cleanPayload);
    } catch (err) {
      if (!isQuotaExceededError(err)) {
        console.warn('Notice writing activity log to Firestore:', err);
      }
    }
  }

  return event;
}

/**
 * Convenience helper to append an activity event to a proposal and record it centrally.
 * Returns the updated proposal object with the event appended to proposal.activityLog.
 */
export function appendActivityToProposal(
  proposal: Proposal,
  type: ActivityEventType,
  actor: { uid?: string; displayName?: string; email?: string; role?: string; union?: string },
  details: string,
  extra?: {
    fromStatus?: string;
    toStatus?: string;
    prevStatus?: string;
    newStatus?: string;
    actionNumber?: string;
    transferredToEmail?: string;
    transferredToName?: string;
    field?: string;
    previousValue?: string;
    newValue?: string;
  }
): Proposal {
  const actorName = actor.displayName || actor.email?.split('@')[0] || 'User';
  const actorEmail = actor.email || '';
  const actorRole = actor.role || 'user';

  const eventId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const safeDetails =
    typeof details === 'string' && details.length > 1900
      ? `${details.slice(0, 1897)}...`
      : details;

  const event: ProposalActivityEvent = {
    id: eventId,
    proposalId: proposal.id,
    proposalTitle: (proposal.title || 'Untitled Proposal').slice(0, 450),
    union: proposal.union || actor.union || 'Unassigned',
    type,
    timestamp,
    actorUid: actor.uid,
    actorName,
    actorEmail,
    actorRole,
    details: safeDetails,
    fromStatus: extra?.fromStatus || extra?.prevStatus,
    toStatus: extra?.toStatus || extra?.newStatus,
    prevStatus: extra?.prevStatus || extra?.fromStatus,
    newStatus: extra?.newStatus || extra?.toStatus,
    actionNumber: extra?.actionNumber,
    transferredToEmail: extra?.transferredToEmail,
    transferredToName: extra?.transferredToName,
    field: extra?.field,
    previousValue: extra?.previousValue,
    newValue: extra?.newValue,
  };

  // Record to central log stream in background
  recordActivityLog(event).catch(() => {});

  const currentLog = proposal.activityLog || [];
  const updatedLog = [event, ...currentLog].slice(0, MAX_PROPOSAL_LOGS);

  const updatedProposal: Proposal = {
    ...proposal,
    activityLog: updatedLog,
    updatedAt: timestamp,
  };

  return updatedProposal;
}

/**
 * Fetches recent activity logs from Firestore with optional filtering.
 */
export async function fetchGlobalActivityLogs(options?: {
  union?: string;
  type?: string;
  proposalId?: string;
  limitCount?: number;
}): Promise<ProposalActivityEvent[]> {
  const local = getLocalActivityLogs();

  if (!auth.currentUser) {
    return filterLocalLogs(local, options);
  }

  try {
    const count = options?.limitCount || 100;
    const logsRef = collection(db, ACTIVITY_LOGS_COLLECTION);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(count));

    const snap = await getDocs(q);
    const remoteList: ProposalActivityEvent[] = [];
    snap.forEach((d) => {
      remoteList.push(d.data() as ProposalActivityEvent);
    });

    if (remoteList.length > 0) {
      saveLocalActivityLogs(remoteList);
      return filterLocalLogs(remoteList, options);
    }
    return filterLocalLogs(local, options);
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      console.warn('Notice fetching activity logs from cloud:', err);
    }
    return filterLocalLogs(local, options);
  }
}

/**
 * Real-time listener for the central activity log stream.
 */
export function subscribeToGlobalActivityLogs(
  onUpdate: (logs: ProposalActivityEvent[]) => void,
  limitCount = 100
): Unsubscribe {
  if (!auth.currentUser) {
    onUpdate(getLocalActivityLogs());
    return () => {};
  }

  try {
    const logsRef = collection(db, ACTIVITY_LOGS_COLLECTION);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: ProposalActivityEvent[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as ProposalActivityEvent);
        });
        if (list.length > 0) {
          saveLocalActivityLogs(list);
          onUpdate(list);
        }
      },
      (error) => {
        if (!isQuotaExceededError(error)) {
          console.warn('Activity logs subscription notice:', error);
        }
        onUpdate(getLocalActivityLogs());
      }
    );
  } catch {
    onUpdate(getLocalActivityLogs());
    return () => {};
  }
}

function filterLocalLogs(
  logs: ProposalActivityEvent[],
  options?: { union?: string; type?: string; proposalId?: string }
): ProposalActivityEvent[] {
  if (!options) return logs;
  return logs.filter((l) => {
    if (options.union && options.union !== 'all') {
      if (getCanonicalUnion(l.union) !== getCanonicalUnion(options.union)) return false;
    }
    if (options.type && options.type !== 'all' && l.type !== options.type) {
      return false;
    }
    if (options.proposalId && l.proposalId !== options.proposalId) {
      return false;
    }
    return true;
  });
}
