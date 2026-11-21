import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  getDocFromServer,
  getDocsFromServer,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, UserRole, Proposal, isSuperAdminEmail } from '../types';

// Initialize Firebase safely (avoids duplicate-app errors in HMR or mixed server/client imports)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Detect whether both IndexedDB and LocalStorage are genuinely accessible (false in Node.js and restricted iframes)
function canUseIndexedDbPersistence(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const ls = window.localStorage;
    const idb = window.indexedDB;
    if (!ls || !idb) {
      return false;
    }
    ls.getItem('__ov27_storage_probe__');
    return true;
  } catch (err) {
    // QuotaExceededError means LocalStorage IS supported on this platform, just full;
    // SecurityError / ReferenceError means LocalStorage is unavailable or blocked.
    return (
      typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    );
  }
}

// Configure Firestore with persistent IndexedDB multi-tab cache when supported (reduces read quota usage),
// falling back cleanly to memoryLocalCache in Node.js or restricted browser/iframe contexts.
export const db = (() => {
  if (canUseIndexedDbPersistence()) {
    try {
      return initializeFirestore(
        app,
        {
          experimentalAutoDetectLongPolling: true,
          ignoreUndefinedProperties: true,
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      try {
        return initializeFirestore(
          app,
          {
            experimentalAutoDetectLongPolling: true,
            ignoreUndefinedProperties: true,
            localCache: persistentLocalCache({
              tabManager: persistentSingleTabManager({ forceOwnership: true }),
            }),
          },
          firebaseConfig.firestoreDatabaseId
        );
      } catch {
        // Fall through to memory cache
      }
    }
  }

  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true,
        localCache: memoryLocalCache(),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
  }
})();

/**
 * Completely purges all client-side cached proposals, user directories, and monitor snapshots.
 * Used for forced re-syncs and sign-out when stale data is detected.
 */
export function clearAppCaches(): void {
  try {
    localStorage.removeItem('onevoice27_proposals_v3');
    localStorage.removeItem('onevoice27_proposals_cache');
    localStorage.removeItem('onevoice27_public_monitor_cache');
    localStorage.removeItem('onevoice27_all_users_cache');
    localStorage.removeItem('onevoice27_caps_cache');
    localStorage.removeItem('onevoice27_allocations_cache');
    localStorage.removeItem('onevoice27_budget_allocations');
    localStorage.removeItem('onevoice27_matching_pledges');
    localStorage.removeItem('onevoice27_kpi_caps');
  } catch (e) {
    console.warn('Notice clearing local storage cache:', e);
  }
}

export { getDocFromServer, getDocsFromServer };

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Operational error handler conformant with skill specifications
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isQuotaExceededError(error)) {
    console.warn('Firestore daily read quota limit reached for this project. Operating in cached offline mode.');
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot conformant with Firebase skill guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('the client is offline') ||
        error.message.includes('unavailable') ||
        error.message.includes('offline mode') ||
        error.message.includes('timed out'))
    ) {
      console.info('Firestore connection notice: Client operating in offline cache mode until connection settles.');
    } else {
      console.warn('Firestore connection check notice:', error);
    }
    return false;
  }
}

export function saveUserToLocalDirectory(account: UserAccount) {
  try {
    const raw = localStorage.getItem('onevoice27_all_users_cache');
    const existing: UserAccount[] = raw ? JSON.parse(raw) : [];
    const index = existing.findIndex(
      (u) =>
        u.uid === account.uid ||
        (u.email && account.email && u.email.toLowerCase() === account.email.toLowerCase())
    );
    if (index >= 0) {
      existing[index] = { ...existing[index], ...account };
    } else {
      existing.push(account);
    }
    localStorage.setItem('onevoice27_all_users_cache', JSON.stringify(existing));
  } catch {
    // ignore
  }
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  super_admin: 5,
  division_liaison: 4,
  treasurer: 3,
  coordinator: 2,
  user: 1,
};

/**
 * Queries both `users/{fbUser.uid}` and `where('email', '==', emailLower)` to reconcile
 * any pre-provisioned or admin-updated user account records (e.g. `users/user_173...`)
 * into the user's canonical `users/{fbUser.uid}` document.
 */
async function reconcileUserRecordsForAuthUser(
  fbUser: FirebaseUser,
  forceServer = false
): Promise<{
  canonicalDoc: UserAccount | null;
  uidDocData: UserAccount | null;
  syntheticDocIdsToDelete: string[];
  roleGrantedFromDocId?: string;
}> {
  const emailLower = (fbUser.email || '').trim().toLowerCase();
  const userRef = doc(db, 'users', fbUser.uid);

  let uidDocData: UserAccount | null = null;
  const emailMatches: Array<{ id: string; data: UserAccount }> = [];

  try {
    const snap = forceServer
      ? await getDocFromServer(userRef).catch(() => getDoc(userRef))
      : await getDoc(userRef);
    if (snap.exists()) {
      uidDocData = snap.data() as UserAccount;
    }
  } catch (e) {
    console.warn('Notice reading users/{uid}:', e);
  }

  if (emailLower) {
    try {
      const emailQuery = query(collection(db, 'users'), where('email', '==', emailLower));
      const emailDocs = forceServer
        ? await getDocsFromServer(emailQuery).catch(() => getDocs(emailQuery))
        : await getDocs(emailQuery);
      emailDocs.forEach((d) => {
        if (d.id !== fbUser.uid) {
          emailMatches.push({ id: d.id, data: d.data() as UserAccount });
        } else if (!uidDocData) {
          uidDocData = d.data() as UserAccount;
        }
      });
    } catch (e) {
      console.warn('Notice querying users by email:', e);
    }
  }

  if (!uidDocData && emailMatches.length === 0) {
    return { canonicalDoc: null, uidDocData: null, syntheticDocIdsToDelete: [] };
  }

  // Merge all records for this user, prioritizing higher role or newer admin updates
  let merged: UserAccount = uidDocData
    ? { ...uidDocData, uid: fbUser.uid }
    : { ...emailMatches[0].data, uid: fbUser.uid };

  let roleGrantedFromDocId: string | undefined =
    !uidDocData && emailMatches.length > 0 ? emailMatches[0].id : undefined;

  const syntheticDocIdsToDelete: string[] = [];

  for (const match of emailMatches) {
    syntheticDocIdsToDelete.push(match.id);
    const candidate = match.data;
    const currentPriority = ROLE_PRIORITY[merged.role || 'user'] || 1;
    const candidatePriority = ROLE_PRIORITY[candidate.role || 'user'] || 1;

    // If the synthetic record has a higher role (e.g. coordinator/treasurer/liaison vs user), adopt its role & union
    if (candidatePriority > currentPriority) {
      merged.role = candidate.role;
      roleGrantedFromDocId = match.id;
      if (candidate.union) merged.union = candidate.union;
    } else if (
      candidate.union &&
      candidate.union !== 'East Central Philippine Union Conference' &&
      merged.union === 'East Central Philippine Union Conference'
    ) {
      merged.union = candidate.union;
      if (!roleGrantedFromDocId) roleGrantedFromDocId = match.id;
    }

    if (
      candidate.assignedUnions &&
      candidate.assignedUnions.length > 0 &&
      (!merged.assignedUnions || merged.assignedUnions.length === 0)
    ) {
      merged.assignedUnions = candidate.assignedUnions;
      if (!roleGrantedFromDocId) roleGrantedFromDocId = match.id;
    }

    if (
      candidate.inviteeUnions &&
      candidate.inviteeUnions.length > 0 &&
      (!merged.inviteeUnions || merged.inviteeUnions.length === 0)
    ) {
      merged.inviteeUnions = candidate.inviteeUnions;
      if (!roleGrantedFromDocId) roleGrantedFromDocId = match.id;
    }

    if (candidate.inviteeAllUnions && !merged.inviteeAllUnions) {
      merged.inviteeAllUnions = true;
      if (!roleGrantedFromDocId) roleGrantedFromDocId = match.id;
    }

    if (candidate.isLiaison && !merged.isLiaison) {
      merged.isLiaison = true;
      if (!roleGrantedFromDocId) roleGrantedFromDocId = match.id;
    }

    if (
      candidate.liaisonVotingUnions &&
      candidate.liaisonVotingUnions.length > 0 &&
      (!merged.liaisonVotingUnions || merged.liaisonVotingUnions.length === 0)
    ) {
      merged.liaisonVotingUnions = candidate.liaisonVotingUnions;
      if (!roleGrantedFromDocId) roleGrantedFromDocId = match.id;
    }

    if (candidate.displayName && (!merged.displayName || merged.displayName === 'Adventist Leader')) {
      merged.displayName = candidate.displayName;
    }
    if (candidate.title && !merged.title) merged.title = candidate.title;
    if (candidate.department && !merged.department) merged.department = candidate.department;
    if (candidate.institution && !merged.institution) merged.institution = candidate.institution;
    if (candidate.unionConfirmed) merged.unionConfirmed = true;
  }

  return { canonicalDoc: merged, uidDocData, syntheticDocIdsToDelete, roleGrantedFromDocId };
}

// Map or create user account in Firestore
export async function syncUserProfile(
  fbUser: FirebaseUser,
  initialUnion?: string,
  initialRole?: UserRole,
  isConfirmed = false,
  forceServer = false
): Promise<UserAccount> {
  const emailLower = (fbUser.email || '').trim().toLowerCase();
  const isBootstrappedAdmin = isSuperAdminEmail(emailLower);
  const isAnthony = emailLower === 'astanyer@adventist.asia';
  const isAngie = emailLower === 'adpsalms272017@gmail.com';

  const userRef = doc(db, 'users', fbUser.uid);
  try {
    const { canonicalDoc, uidDocData, syntheticDocIdsToDelete, roleGrantedFromDocId } =
      await reconcileUserRecordsForAuthUser(fbUser, forceServer);

    if (canonicalDoc) {
      const data: UserAccount = {
        ...canonicalDoc,
        uid: fbUser.uid,
        email: fbUser.email || canonicalDoc.email || emailLower,
        unionConfirmed: Boolean(canonicalDoc.unionConfirmed || isConfirmed || isBootstrappedAdmin),
      };

      if (isAnthony) {
        data.role = 'super_admin';
        data.displayName = 'Anthony Stanyer';
        data.union = data.union || 'Southern Asia-Pacific Division';
        data.department = data.department || 'Communication & Hope Channel';
        data.institution = data.institution || 'Southern Asia-Pacific Division (SSD Headquarters)';
        data.unionConfirmed = true;
      } else if (isAngie) {
        data.role = 'super_admin';
        data.displayName = data.displayName || 'ANGELINA PAGARIGAN';
        data.union = data.union || 'Southern Luzon Philippine Union Mission';
        data.title = data.title || 'Director';
        data.department = data.department || 'Media & Communication';
        data.institution = data.institution || 'Southern Luzon Philippine Union Mission';
        data.unionConfirmed = true;
      } else if (isBootstrappedAdmin) {
        data.role = 'super_admin';
        data.unionConfirmed = true;
      }

      // Only write to users/{fbUser.uid} when reconciling synthetic docs or when fields actually changed
      const needsProfileWrite =
        !uidDocData ||
        syntheticDocIdsToDelete.length > 0 ||
        uidDocData.uid !== data.uid ||
        uidDocData.role !== data.role ||
        uidDocData.union !== data.union ||
        uidDocData.unionConfirmed !== data.unionConfirmed ||
        uidDocData.displayName !== data.displayName ||
        uidDocData.email !== data.email ||
        Boolean(uidDocData.inviteeAllUnions) !== Boolean(data.inviteeAllUnions) ||
        Boolean(uidDocData.isLiaison) !== Boolean(data.isLiaison) ||
        JSON.stringify(uidDocData.assignedUnions || []) !== JSON.stringify(data.assignedUnions || []) ||
        JSON.stringify(uidDocData.inviteeUnions || []) !== JSON.stringify(data.inviteeUnions || []) ||
        JSON.stringify(uidDocData.liaisonVotingUnions || []) !== JSON.stringify(data.liaisonVotingUnions || []);

      if (needsProfileWrite) {
        try {
          await setDoc(
            userRef,
            {
              ...data,
              ...(roleGrantedFromDocId ? { reconciledFromDocId: roleGrantedFromDocId } : {}),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (writeErr) {
          console.warn('Notice persisting reconciled user profile:', writeErr);
        }
      }

      // Clean up any duplicate synthetic user_... docs now that users/{fbUser.uid} is saved
      for (const synthId of syntheticDocIdsToDelete) {
        if (synthId !== fbUser.uid) {
          deleteDoc(doc(db, 'users', synthId)).catch(() => {});
        }
      }

      // If user has super_admin role and profile needed sync, ensure admin marker exists
      if ((data.role === 'super_admin' || isBootstrappedAdmin) && (needsProfileWrite || forceServer)) {
        try {
          await setDoc(
            doc(db, 'admins', fbUser.uid),
            {
              uid: fbUser.uid,
              email: fbUser.email || emailLower,
            },
            { merge: true }
          );
        } catch {
          // ignore
        }
      }

      saveUserToLocalDirectory(data);
      return data;
    } else {
      // If caller only requested a passive check (isConfirmed === false) for an unprovisioned Google account,
      // return an unconfirmed placeholder without prematurely writing default union to Firestore
      const isGoogleProvider = fbUser.providerData?.some((p) => p.providerId === 'google.com');
      if (!isConfirmed && !isBootstrappedAdmin && isGoogleProvider && !initialUnion) {
        return {
          uid: fbUser.uid,
          email: fbUser.email || emailLower,
          displayName: fbUser.displayName || 'Adventist Leader',
          ...(fbUser.photoURL ? { photoURL: fbUser.photoURL } : {}),
          role: 'user',
          union: '',
          unionConfirmed: false,
        };
      }
      // Check local users directory fallback if no Firestore doc existed yet
      let preProvisionedRole: UserRole | undefined = initialRole;
      let preProvisionedUnion: string | undefined = initialUnion;
      let preProvisionedTitle: string | undefined;
      let preProvisionedDisplayName: string | undefined;
      let preProvisionedDepartment: string | undefined;
      let preProvisionedInstitution: string | undefined;
      let preProvisionedAssignedUnions: string[] | undefined;

      try {
        const cachedRaw = localStorage.getItem('onevoice27_all_users_cache');
        if (cachedRaw) {
          const cachedList: UserAccount[] = JSON.parse(cachedRaw);
          const found = cachedList.find((u) => u.email?.toLowerCase() === emailLower);
          if (found) {
            if (found.role && found.role !== 'user') preProvisionedRole = found.role;
            if (found.union) preProvisionedUnion = found.union;
            if (found.title) preProvisionedTitle = found.title;
            if (found.displayName) preProvisionedDisplayName = found.displayName;
            if (found.department) preProvisionedDepartment = found.department;
            if (found.institution) preProvisionedInstitution = found.institution;
            if (found.assignedUnions) preProvisionedAssignedUnions = found.assignedUnions;
          }
        }
      } catch {
        // ignore
      }

      // Never trust localStorage for elevated roles when creating a brand-new Firestore profile;
      // only verified bootstrapped admins start above 'user' (admin-provisioned roles are reconciled above from Firestore)
      const newRole: UserRole = isBootstrappedAdmin ? 'super_admin' : 'user';

      const assignedUnion = isAnthony
        ? 'Southern Asia-Pacific Division'
        : isAngie
        ? preProvisionedUnion || 'Southern Luzon Philippine Union Mission'
        : preProvisionedUnion || initialUnion || 'East Central Philippine Union Conference';

      const assignedDisplayName = isAnthony
        ? 'Anthony Stanyer'
        : isAngie
        ? preProvisionedDisplayName || fbUser.displayName || 'ANGELINA PAGARIGAN'
        : preProvisionedDisplayName || fbUser.displayName || 'Adventist Leader';

      const assignedTitle = isAnthony
        ? 'Division Admin'
        : isAngie
        ? preProvisionedTitle || 'Director'
        : preProvisionedTitle || (newRole === 'super_admin' ? 'Division Admin' : 'Director');

      const assignedDepartment = isAnthony
        ? 'Communication & Hope Channel'
        : preProvisionedDepartment || 'Media & Communication';

      const assignedInstitution = isAnthony
        ? 'Southern Asia-Pacific Division (SSD Headquarters)'
        : preProvisionedInstitution || assignedUnion;

      const account: UserAccount = {
        uid: fbUser.uid,
        email: fbUser.email || emailLower,
        displayName: assignedDisplayName,
        ...(fbUser.photoURL ? { photoURL: fbUser.photoURL } : {}),
        role: newRole,
        union: assignedUnion,
        ...(preProvisionedAssignedUnions ? { assignedUnions: preProvisionedAssignedUnions } : {}),
        title: assignedTitle,
        department: assignedDepartment,
        institution: assignedInstitution,
        unionConfirmed: isBootstrappedAdmin || isConfirmed || Boolean(preProvisionedUnion),
      };

      const cleanAccountPayload = Object.fromEntries(
        Object.entries({
          ...account,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).filter(([, v]) => v !== undefined)
      );

      await setDoc(userRef, cleanAccountPayload, { merge: true });

      if (newRole === 'super_admin') {
        try {
          await setDoc(
            doc(db, 'admins', fbUser.uid),
            {
              uid: fbUser.uid,
              email: fbUser.email || emailLower,
            },
            { merge: true }
          );
        } catch (e) {
          console.warn('Admin marker creation note:', e);
        }
      }

      saveUserToLocalDirectory(account);
      return account;
    }
  } catch (error) {
    console.warn('Could not sync profile to Firestore:', error);
    const fallbackAccount: UserAccount = {
      uid: fbUser.uid,
      email: fbUser.email || emailLower,
      displayName: isAnthony
        ? 'Anthony Stanyer'
        : isAngie
        ? fbUser.displayName || 'ANGELINA PAGARIGAN'
        : fbUser.displayName || 'Adventist Leader',
      role: isBootstrappedAdmin ? 'super_admin' : initialRole || 'user',
      union: isAnthony
        ? 'Southern Asia-Pacific Division'
        : isAngie
        ? 'Southern Luzon Philippine Union Mission'
        : initialUnion || 'East Central Philippine Union Conference',
      title: isAnthony ? 'Division Admin' : isAngie ? 'Director' : 'Director',
      department: isAnthony ? 'Communication & Hope Channel' : 'Media & Communication',
      institution: isAnthony
        ? 'Southern Asia-Pacific Division (SSD Headquarters)'
        : initialUnion || 'East Central Philippine Union Conference',
      unionConfirmed: isBootstrappedAdmin || isConfirmed,
    };
    saveUserToLocalDirectory(fallbackAccount);
    return fallbackAccount;
  }
}

// Sign in with Google Popup and return raw Firebase User along with existing profile check
export async function signInWithGooglePopup(): Promise<{
  user: FirebaseUser;
  existingAccount: UserAccount | null;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const fbUser = result.user;
  let existingAccount: UserAccount | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', fbUser.uid));
    if (snap.exists()) {
      existingAccount = snap.data() as UserAccount;
    } else {
      // Check pre-provisioned accounts by email
      const emailLower = (fbUser.email || '').trim().toLowerCase();
      if (emailLower) {
        const emailQuery = query(collection(db, 'users'), where('email', '==', emailLower));
        const emailDocs = await getDocs(emailQuery);
        if (!emailDocs.empty) {
          existingAccount = emailDocs.docs[0].data() as UserAccount;
        }
      }
    }
  } catch (err) {
    console.warn('Check existing user note:', err);
  }
  return { user: fbUser, existingAccount };
}

// Complete Google Sign In with explicit Union chosen by user
export async function completeGoogleSignIn(
  fbUser: FirebaseUser,
  union: string,
  title?: string,
  department?: string
): Promise<UserAccount> {
  const emailLower = (fbUser.email || '').trim().toLowerCase();
  const isBootstrappedAdmin = isSuperAdminEmail(emailLower);
  const isAnthony = emailLower === 'astanyer@adventist.asia';
  const isAngie = emailLower === 'adpsalms272017@gmail.com';

  const assignedUnion = isAnthony
    ? 'Southern Asia-Pacific Division'
    : isAngie
    ? (union || 'Southern Luzon Philippine Union Mission')
    : union;
  const assignedTitle = title?.trim() || (isAnthony ? 'Division Admin' : (isAngie ? 'Director' : 'Director'));
  const roleToAssign: UserRole = isBootstrappedAdmin ? 'super_admin' : 'user';
  const account = await syncUserProfile(fbUser, assignedUnion, roleToAssign, true);
  
  // Guarantee union, title and unionConfirmed are explicitly saved in Firestore
  try {
    await updateDoc(doc(db, 'users', fbUser.uid), {
      union: assignedUnion,
      institution: isAnthony ? 'Southern Asia-Pacific Division (SSD Headquarters)' : assignedUnion,
      unionConfirmed: true,
      title: assignedTitle,
      ...(department ? { department } : {}),
      updatedAt: new Date().toISOString(),
    });
    account.union = assignedUnion;
    account.unionConfirmed = true;
    account.title = assignedTitle;
    if (department) account.department = department;
  } catch (err) {
    console.warn('Profile union update notice:', err);
  }

  saveUserToLocalDirectory(account);
  return account;
}

// Sign in with Google Popup (standard direct wrapper)
export async function signInWithGoogle(): Promise<UserAccount> {
  const result = await signInWithPopup(auth, googleProvider);
  return await syncUserProfile(result.user);
}

// Sign in or create user with email/password with full Firebase Auth credentials and Firestore sync
export async function authenticateWithEmailPassword(
  email: string,
  password?: string,
  isRegistering = false,
  displayName?: string,
  union?: string,
  _role: UserRole = 'user',
  title?: string
): Promise<UserAccount> {
  const emailClean = email.trim().toLowerCase();
  if (!emailClean) {
    throw new Error('Please enter a valid email address.');
  }

  if (!password || password.trim().length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const isBootstrappedSuperAdmin = isSuperAdminEmail(emailClean);
  const assignedRole: UserRole = isBootstrappedSuperAdmin ? 'super_admin' : 'user';
  const officialName =
    emailClean === 'astanyer@adventist.asia'
      ? 'Anthony Stanyer'
      : displayName?.trim() ||
        emailClean
          .split('@')[0]
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
  const assignedUnion =
    emailClean === 'astanyer@adventist.asia'
      ? 'Southern Asia-Pacific Division'
      : union || 'East Central Philippine Union Conference';
  const assignedTitle = isBootstrappedSuperAdmin
    ? 'Division Admin'
    : title?.trim() || 'Director';

  let fbUser: FirebaseUser | null = null;

  try {
    if (isRegistering) {
      const res = await createUserWithEmailAndPassword(auth, emailClean, password);
      fbUser = res.user;
      if (officialName) {
        try {
          await updateProfile(fbUser, { displayName: officialName });
        } catch (profileErr) {
          console.warn('Could not update Auth profile displayName:', profileErr);
        }
      }
    } else {
      const res = await signInWithEmailAndPassword(auth, emailClean, password);
      fbUser = res.user;
    }
  } catch (authError: any) {
    const code = authError?.code;
    if (code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Please switch to the Sign In tab.');
    } else if (
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential'
    ) {
      throw new Error('Invalid email or password. Please verify credentials or create an account.');
    } else if (code === 'auth/weak-password') {
      throw new Error('Password should be at least 6 characters long.');
    } else if (code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    } else if (code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please wait a moment or reset your password.');
    }
    throw new Error(authError?.message || 'Authentication failed. Please try again.');
  }

  if (!fbUser) {
    throw new Error('Could not establish an authenticated session. Please try again.');
  }

  // Reconcile with any pre-provisioned or admin-updated user profile by UID or email
  const synced = await syncUserProfile(
    fbUser,
    union || assignedUnion,
    assignedRole,
    true,
    true
  );
  if (isRegistering && assignedTitle && synced.title !== assignedTitle) {
    try {
      await updateDoc(doc(db, 'users', fbUser.uid), {
        title: assignedTitle,
        updatedAt: new Date().toISOString(),
      });
      synced.title = assignedTitle;
      saveUserToLocalDirectory(synced);
    } catch {
      // ignore
    }
  }
  return synced;
}

// Send password reset email
export async function sendUserPasswordReset(email: string): Promise<void> {
  const emailClean = email.trim().toLowerCase();
  if (!emailClean) {
    throw new Error('Please enter your registered email address.');
  }
  await sendPasswordResetEmail(auth, emailClean);
}

// Sign out
export async function signOutUser(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch (e) {
    console.warn('Firebase sign out notice:', e);
  }
}

