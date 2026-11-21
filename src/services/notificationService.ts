import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import {
  AppNotification,
  UserAccount,
  UserRole,
  Proposal,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getUserAllUnions,
  isDivisionLevelTreasurerOrAdmin,
} from '../types';

export const NOTIFICATIONS_COLLECTION = 'notifications';
export const NOTIFICATIONS_STORAGE_KEY = 'onevoice27_notifications_cache';
const LOCAL_EVENT_NAME = 'onevoice27_notifications_updated';

// Helper to get local notifications
export function getLocalNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error reading local notifications cache:', err);
    return [];
  }
}

// Helper to save local notifications
export function saveLocalNotifications(notifications: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME, { detail: notifications }));
  } catch (err) {
    console.warn('Error saving local notifications cache:', err);
  }
}

/**
 * Filter notifications to only those relevant to the given user account.
 */
export function filterNotificationsForUser(
  notifications: AppNotification[],
  user: UserAccount | null
): AppNotification[] {
  if (!user || !user.email) return [];

  const userEmail = user.email.toLowerCase().trim();
  const userUid = user.uid || '';
  const userRole = user.role;
  const authorizedCanonicalUnions = getUserAllUnions(user).map(getCanonicalUnion);
  const isDivisionOfficer = isDivisionLevelTreasurerOrAdmin(user);

  return notifications.filter((notif) => {
    // Hide notifications explicitly dismissed by this user
    if (
      notif.dismissedBy &&
      (notif.dismissedBy.includes(userEmail) || (userUid && notif.dismissedBy.includes(userUid)))
    ) {
      return false;
    }

    // Never notify a user of an action they just performed themselves
    if (notif.createdBy?.email && notif.createdBy.email.toLowerCase().trim() === userEmail) {
      return false;
    }

    // 1. Direct recipient match by user ID or user email
    if (notif.targetUserId && userUid && notif.targetUserId === userUid) {
      return true;
    }
    if (notif.targetUserEmail && notif.targetUserEmail.toLowerCase().trim() === userEmail) {
      return true;
    }

    // 2. Super Admin & Division-level Treasurer receive administrative notifications across SSD
    if (userRole === 'super_admin' || isDivisionOfficer) {
      return true;
    }

    // 3. Union Treasurer, Union Coordinator & Division Liaison receive notifications for their assigned Union(s)
    if (
      userRole === 'treasurer' ||
      userRole === 'coordinator' ||
      userRole === 'division_liaison'
    ) {
      if (notif.targetRoles && notif.targetRoles.includes(userRole)) {
        if (!notif.union) return true;
        const notifCanonUnion = getCanonicalUnion(notif.union);
        return authorizedCanonicalUnions.includes(notifCanonUnion);
      }
    }

    // 4. Regular Director (user role)
    if (userRole === 'user' && notif.targetRoles?.includes('user')) {
      if (notif.targetUserEmail && notif.targetUserEmail.toLowerCase().trim() === userEmail) {
        return true;
      }
      if (notif.targetUserId && userUid && notif.targetUserId === userUid) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Builds deterministic audience tokens stored on a notification document
 * so non-admin clients only subscribe to notifications addressed to them or their Union role.
 */
function buildNotificationAudienceTokens(
  data: Omit<AppNotification, 'id' | 'createdAt' | 'readBy'>
): string[] {
  const tokens = new Set<string>(['ADMIN']);

  if (data.targetUserId) {
    tokens.add(`UID:${data.targetUserId}`);
  }
  if (data.targetUserEmail) {
    tokens.add(`EMAIL:${data.targetUserEmail.trim().toLowerCase()}`);
  }

  const canonUnion = getCanonicalUnion(data.union || '');
  const acronym = UNION_ACRONYMS[canonUnion] || UNION_ACRONYMS[data.union || ''] || '';

  if (data.targetRoles && data.targetRoles.length > 0) {
    for (const r of data.targetRoles) {
      if (r === 'treasurer' || r === 'coordinator' || r === 'division_liaison') {
        if (acronym) {
          tokens.add(`UNION_ROLE:${acronym}:${r}`);
        } else {
          tokens.add(`ROLE:${r}`);
        }
      }
    }
  }

  return Array.from(tokens).slice(0, 25);
}

/**
 * Computes the query tokens (max 30 for Firestore array-contains-any) for a signed-in user.
 */
function getUserNotificationQueryTokens(user: UserAccount): string[] {
  const tokens = new Set<string>();
  const authUid = auth.currentUser?.uid || user.uid;
  const authEmailLower = (auth.currentUser?.email || user.email || '').trim().toLowerCase();

  if (authUid) tokens.add(`UID:${authUid}`);
  if (authEmailLower) tokens.add(`EMAIL:${authEmailLower}`);

  if (
    user.role === 'treasurer' ||
    user.role === 'coordinator' ||
    user.role === 'division_liaison'
  ) {
    tokens.add(`ROLE:${user.role}`);
    const unions = getUserAllUnions(user);
    for (const u of unions) {
      const canon = getCanonicalUnion(u);
      const acronym = UNION_ACRONYMS[canon] || UNION_ACRONYMS[u];
      if (acronym) {
        tokens.add(`UNION_ROLE:${acronym}:${user.role}`);
      }
    }
  }

  return Array.from(tokens).slice(0, 30);
}

/**
 * Subscribe to notifications with real-time updates from Firestore,
 * scoped to the user's role/territory to avoid division-wide read amplification.
 */
export function subscribeToNotifications(
  currentUser: UserAccount | null,
  callback: (notifications: AppNotification[]) => void
): () => void {
  let isUnsubscribed = false;
  let activeFirestoreUnsubscribe: (() => void) | null = null;

  const emitFiltered = (rawList: AppNotification[]) => {
    if (isUnsubscribed) return;
    const filtered = filterNotificationsForUser(rawList, currentUser);
    callback(filtered);
  };

  // 1. Emit local cache immediately
  const initialLocal = getLocalNotifications();
  emitFiltered(initialLocal);

  // 2. Listen to custom window events for instant local updates across components
  const handleLocalEvent = () => {
    emitFiltered(getLocalNotifications());
  };
  window.addEventListener(LOCAL_EVENT_NAME, handleLocalEvent);
  window.addEventListener('storage', handleLocalEvent);

  // 3. Connect to Firestore real-time onSnapshot ONLY when user has an authenticated session
  if (currentUser && currentUser.email && auth.currentUser) {
    try {
      const notifsRef = collection(db, NOTIFICATIONS_COLLECTION);
      const isDivisionWideOfficer =
        currentUser.role === 'super_admin' ||
        isDivisionLevelTreasurerOrAdmin(currentUser) ||
        getUserAllUnions(currentUser).length >= 10;

      const userTokens = getUserNotificationQueryTokens(currentUser);
      const q =
        isDivisionWideOfficer || userTokens.length === 0
          ? query(notifsRef, orderBy('createdAt', 'desc'), limit(25))
          : query(notifsRef, where('targetAudience', 'array-contains-any', userTokens), limit(30));

      activeFirestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const firestoreList: AppNotification[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as AppNotification;
            firestoreList.push({
              ...data,
              id: docSnap.id,
            });
          });

          // Merge Firestore list with local cache to preserve any uncommitted local state
          const localList = getLocalNotifications();
          const mergedMap = new Map<string, AppNotification>();

          localList.forEach((n) => mergedMap.set(n.id, n));
          firestoreList.forEach((n) => mergedMap.set(n.id, n));

          const merged = Array.from(mergedMap.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 60);

          saveLocalNotifications(merged);
          emitFiltered(merged);
        },
        (error) => {
          console.warn('Firestore notifications subscription notice:', error);
          emitFiltered(getLocalNotifications());
        }
      );
    } catch (err) {
      console.warn('Unable to initialize Firestore notifications listener:', err);
    }
  }

  // Cleanup function
  return () => {
    isUnsubscribed = true;
    window.removeEventListener(LOCAL_EVENT_NAME, handleLocalEvent);
    window.removeEventListener('storage', handleLocalEvent);
    if (activeFirestoreUnsubscribe) {
      activeFirestoreUnsubscribe();
    }
  };
}

/**
 * Create and publish a new notification.
 */
export async function createNotification(
  data: Omit<AppNotification, 'id' | 'createdAt' | 'readBy'>
): Promise<AppNotification> {
  const newId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const targetAudience = buildNotificationAudienceTokens(data);

  const safeTitle =
    typeof data.title === 'string' && data.title.length > 390
      ? `${data.title.slice(0, 387)}...`
      : data.title || 'OneVoice27 Notification';
  const safeMessage =
    typeof data.message === 'string' && data.message.length > 1480
      ? `${data.message.slice(0, 1477)}...`
      : data.message || '';

  const newNotification: AppNotification = {
    ...data,
    title: safeTitle,
    message: safeMessage,
    id: newId,
    targetAudience,
    createdAt: now,
    readBy: [],
    dismissedBy: [],
  };

  // 1. Immediately update local storage
  const current = getLocalNotifications();
  const updated = [newNotification, ...current.filter((n) => n.id !== newId)].slice(0, 60);
  saveLocalNotifications(updated);

  // 2. Persist to Firestore if online / authenticated
  if (auth.currentUser) {
    try {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, newId);
      const cleanPayload = Object.fromEntries(
        Object.entries(newNotification).filter(([, v]) => v !== undefined)
      );
      await setDoc(docRef, cleanPayload);
    } catch (err) {
      console.warn('Could not persist notification to Firestore:', err);
    }
  }

  return newNotification;
}

/**
 * Mark a specific notification as read by the current user.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userIdentifier: string
): Promise<void> {
  if (!userIdentifier) return;

  // 1. Update local cache immediately
  const list = getLocalNotifications();
  const next = list.map((item) => {
    if (item.id === notificationId) {
      const readSet = new Set(item.readBy || []);
      readSet.add(userIdentifier);
      return { ...item, readBy: Array.from(readSet) };
    }
    return item;
  });
  saveLocalNotifications(next);

  // 2. Update Firestore
  if (auth.currentUser) {
    try {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
      await updateDoc(docRef, {
        readBy: arrayUnion(userIdentifier),
      });
    } catch (err) {
      console.warn('Could not update notification read status in Firestore:', err);
    }
  }
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllNotificationsAsRead(
  notifications: AppNotification[],
  userIdentifier: string
): Promise<void> {
  if (!userIdentifier || notifications.length === 0) return;

  const targetIds = new Set(notifications.map((n) => n.id));

  // 1. Update local cache
  const list = getLocalNotifications();
  const next = list.map((item) => {
    if (targetIds.has(item.id)) {
      const readSet = new Set(item.readBy || []);
      readSet.add(userIdentifier);
      return { ...item, readBy: Array.from(readSet) };
    }
    return item;
  });
  saveLocalNotifications(next);

  // 2. Update Firestore in a single atomic batch
  if (auth.currentUser) {
    const unreadNotifs = notifications.filter((notif) => !notif.readBy?.includes(userIdentifier));
    if (unreadNotifs.length > 0) {
      try {
        const batch = writeBatch(db);
        for (const notif of unreadNotifs) {
          const docRef = doc(db, NOTIFICATIONS_COLLECTION, notif.id);
          batch.update(docRef, {
            readBy: arrayUnion(userIdentifier),
          });
        }
        await batch.commit();
      } catch (err) {
        console.warn('Notice batch-marking notifications as read:', err);
      }
    }
  }
}

/**
 * Dismiss a notification for the current user without deleting it for other Union/Division recipients.
 */
export async function deleteNotification(
  notificationId: string,
  userIdentifier?: string
): Promise<void> {
  const effectiveUser =
    userIdentifier || auth.currentUser?.email?.toLowerCase() || auth.currentUser?.uid || '';

  // 1. Update local cache immediately
  const list = getLocalNotifications();
  const next = effectiveUser
    ? list.map((n) => {
        if (n.id === notificationId) {
          const dismissed = new Set(n.dismissedBy || []);
          dismissed.add(effectiveUser);
          return { ...n, dismissedBy: Array.from(dismissed) };
        }
        return n;
      })
    : list.filter((n) => n.id !== notificationId);
  saveLocalNotifications(next);

  // 2. Persist per-user dismissal to Firestore
  if (auth.currentUser && effectiveUser) {
    try {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
      await updateDoc(docRef, {
        dismissedBy: arrayUnion(effectiveUser),
      });
    } catch (err) {
      console.warn('Could not update notification dismissal in Firestore:', err);
    }
  }
}

/**
 * High-level helper to dispatch notifications for proposal events:
 * 1. Proposal submission -> Union Treasurer & Union Coordinator of that Union
 * 2. Proposal approval -> Division / Super Admin
 * 3. Reviewer note added -> Director who created/submitted the proposal
 */
export async function notifyProposalEvent({
  event,
  proposal,
  actor,
  noteExcerpt,
  voteDecision,
}: {
  event: 'submit' | 'approve' | 'liaison_vote' | 'authorize' | 'note';
  proposal: Proposal;
  actor: UserAccount | null;
  noteExcerpt?: string;
  voteDecision?: 'recommended' | 'revision_requested';
}): Promise<AppNotification | null> {
  const actorName = actor?.displayName || actor?.email?.split('@')[0] || 'User';
  const actorRole: UserRole = actor?.role || 'user';
  const actorEmail = actor?.email || '';

  if (event === 'submit') {
    return createNotification({
      type: 'proposal_submitted',
      title: `New Proposal Submitted: ${proposal.title || 'Untitled'}`,
      message: `${actorName} submitted "${proposal.title || 'Untitled'}" for ${proposal.union} Treasury & Coordinator review.`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled',
      union: proposal.union,
      targetRoles: ['treasurer', 'coordinator'],
      createdBy: {
        name: actorName,
        email: actorEmail,
        role: actorRole,
      },
    });
  }

  if (event === 'approve') {
    const directorEmail = proposal.userEmail || proposal.pointOfContact?.email || '';
    const directorId = proposal.userId;
    return createNotification({
      type: 'proposal_approved',
      title: `Step 3 Union Voted: ${proposal.title || 'Untitled'}`,
      message: `${proposal.union} voted "${proposal.title || 'Untitled'}"${
        proposal.unionApproval?.actionNumber ? ` (Action #${proposal.unionApproval.actionNumber})` : ''
      }. Ready for Step 4 Division Liaison vote.`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled',
      union: proposal.union,
      targetUserId: directorId,
      targetUserEmail: directorEmail,
      targetRoles: ['super_admin', 'treasurer', 'coordinator', 'division_liaison', 'user'],
      createdBy: {
        name: actorName,
        email: actorEmail,
        role: actorRole,
      },
    });
  }

  if (event === 'liaison_vote') {
    const directorEmail = proposal.userEmail || proposal.pointOfContact?.email || '';
    const directorId = proposal.userId;
    const isRevision = voteDecision === 'revision_requested';
    const cleanNote = (noteExcerpt || '').trim();
    const noteSummary = cleanNote.length > 110 ? `${cleanNote.slice(0, 110)}...` : cleanNote;

    return createNotification({
      type: 'liaison_voted',
      title: isRevision
        ? `Step 4 Revision Requested: ${proposal.title || 'Untitled'}`
        : `Step 4 Liaison Voted: ${proposal.title || 'Untitled'}`,
      message: isRevision
        ? `${actorName} requested revisions on "${proposal.title || 'Untitled'}"${
            noteSummary ? `: "${noteSummary}"` : '. Union Treasurer can click Reopen Review so the author can update the form.'
          }`
        : `${actorName} voted to recommend "${proposal.title || 'Untitled'}" to the SSD OV27 Committee${
            noteSummary ? `: "${noteSummary}"` : '.'
          }`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled',
      union: proposal.union,
      targetUserId: directorId,
      targetUserEmail: directorEmail,
      targetRoles: ['super_admin', 'treasurer', 'coordinator', 'division_liaison', 'user'],
      createdBy: {
        name: actorName,
        email: actorEmail,
        role: actorRole,
      },
    });
  }

  if (event === 'authorize') {
    const directorEmail = proposal.userEmail || proposal.pointOfContact?.email || '';
    const directorId = proposal.userId;
    return createNotification({
      type: 'proposal_authorized',
      title: `Step 5 Authorized Project: ${proposal.title || 'Untitled'}`,
      message: `SSD OV27 Committee (${actorName}) officially authorized "${proposal.title || 'Untitled'}"${
        proposal.divisionApproval?.referenceNumber
          ? ` (Ref #${proposal.divisionApproval.referenceNumber})`
          : proposal.unionApproval?.actionNumber
          ? ` (Union Action #${proposal.unionApproval.actionNumber})`
          : ''
      }.`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled',
      union: proposal.union,
      targetUserId: directorId,
      targetUserEmail: directorEmail,
      targetRoles: ['user', 'coordinator', 'treasurer', 'division_liaison'],
      createdBy: {
        name: actorName,
        email: actorEmail,
        role: actorRole,
      },
    });
  }

  if (event === 'note') {
    const directorEmail = proposal.userEmail || proposal.pointOfContact?.email || '';
    const directorId = proposal.userId;
    const cleanNote = (noteExcerpt || proposal.reviewerNotes || '').trim();
    const noteSummary = cleanNote.length > 90 ? `${cleanNote.slice(0, 90)}...` : cleanNote;

    return createNotification({
      type: 'note_added',
      title: `Review Note on ${proposal.title || 'Untitled'}`,
      message: `${actorName} posted a note on "${proposal.title || 'Untitled'}": "${noteSummary}"`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled',
      union: proposal.union,
      targetUserId: directorId,
      targetUserEmail: directorEmail,
      targetRoles: ['user', 'treasurer', 'coordinator', 'division_liaison'],
      createdBy: {
        name: actorName,
        email: actorEmail,
        role: actorRole,
      },
    });
  }

  return null;
}
