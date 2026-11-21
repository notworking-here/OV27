import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  Proposal,
  UserProfile,
  UserAccount,
  UserRole,
  UNION_ACRONYMS,
  isHubRole,
  isSuperAdminEmail,
  getUserAllUnions,
  getCanonicalUnion,
} from './types';
import { Header } from './components/Header';
import { StakeholderHeader } from './components/monitor/StakeholderHeader';
import { Sidebar } from './components/Sidebar';
import { ProposalFocusTarget } from './components/ProposalForm';
import {
  ValidationError,
  validateProposalForSubmission,
  hasMeaningfulProposalData,
  isZeroDataProposal,
} from './utils/validation';

// Statically imported core views to ensure rock-solid stability and zero dynamic import fetch failures
import { AdminDashboard } from './components/AdminDashboard';
import { ReviewHub } from './components/ReviewHub';
import { ApprovedProposals } from './components/ApprovedProposals';
import { MonitorDashboard } from './components/MonitorDashboard';
import { PlaybookFaqPage, PLAYBOOK_PAGE_STATE_STORAGE_KEY } from './components/PlaybookFaqPage';
import { ProposalReviewWorkspace } from './components/proposal/ProposalReviewWorkspace';
import { LoginLandingPage } from './components/LoginLandingPage';
import { setEmailRolePreviewActive } from './services/emailNotificationService';

// Resilient lazy loader for auxiliary modals that retries on intermittent network/bundle hiccups
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | { [key: string]: any }>,
  retries = 2,
  interval = 800
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then((mod: any) => resolve(mod.default ? mod : { default: mod }))
          .catch((err) => {
            if (remaining <= 0) {
              reject(err);
              return;
            }
            setTimeout(() => attempt(remaining - 1), interval);
          });
      };
      attempt(retries);
    })
  );
}

// Error Boundary to catch any transient view rendering or network load errors gracefully
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ViewErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ViewErrorBoundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-3xl mx-auto my-12 p-8 bg-white border border-red-200 rounded-3xl shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center font-bold text-lg">
            !
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {this.props.fallbackTitle || 'Unable to display view'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {this.state.error?.message || 'A temporary module or rendering error occurred. Please try reloading this section.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1c398e] hover:bg-[#152c70] rounded-xl transition cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ViewLoadingSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-32 bg-slate-200 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="h-3 w-24 bg-slate-100 rounded" />
            <div className="h-7 w-32 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="h-64 bg-white border border-slate-200 rounded-2xl p-6" />
    </div>
  );
}

// Lazy-loaded auxiliary modals with resilient retries
const WelcomeModal = lazyWithRetry(() =>
  import('./components/WelcomeModal').then((m) => ({ default: m.WelcomeModal }))
);
const PrintProposalModal = lazyWithRetry(() =>
  import('./components/PrintProposalModal').then((m) => ({ default: m.PrintProposalModal }))
);
const LiaisonWalkthroughGuideModal = lazyWithRetry(() =>
  import('./components/LiaisonWalkthroughGuideModal').then((m) => ({
    default: m.LiaisonWalkthroughGuideModal,
  }))
);
const FAQModal = lazyWithRetry(() =>
  import('./components/FAQModal').then((m) => ({ default: m.FAQModal }))
);
const AuthModal = lazyWithRetry(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const AdminSettingsModal = lazyWithRetry(() =>
  import('./components/AdminSettingsModal').then((m) => ({ default: m.AdminSettingsModal }))
);
const ValidationModal = lazyWithRetry(() =>
  import('./components/ValidationModal').then((m) => ({ default: m.ValidationModal }))
);
const DeleteProposalModal = lazyWithRetry(() =>
  import('./components/DeleteProposalModal').then((m) => ({ default: m.DeleteProposalModal }))
);
import { TransferOwnershipModal } from './components/admin/TransferOwnershipModal';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  syncUserProfile,
  testFirestoreConnection,
  signOutUser,
  isQuotaExceededError,
} from './lib/firebase';
import {
  subscribeToProposals,
  fetchProposals,
  fetchProposalById,
  subscribeToProposal,
  saveProposalToFirestore,
  patchProposalToFirestore,
  deleteProposalFromFirestore,
  clearProposalServiceMemoryCache,
  safePersistProposalsToLocalStorage,
  safeSetStorageItem,
  allocateNextProjectId,
  buildLockedStep5ProjectCode,
  syncGcApiExportSnapshot,
} from './services/proposalService';
import {
  resolveProposalProjectCode,
  formatCompositeProjectCode,
} from './utils/externalProposalCodec';
import {
  syncSnapshotFromFullProposals,
  fetchPublicMonitorSnapshot,
  clearPublicMonitorCache,
  fetchPublicMonitorShareToken,
  isValidPublicMonitorToken,
} from './services/publicMonitorService';
import { clearAppCaches } from './lib/firebase';
import { notifyProposalEvent } from './services/notificationService';
import { appendActivityToProposal, recordActivityLog } from './services/activityLogService';
import {
  Shield,
  Layers,
  ChevronDown,
  Plus,
} from 'lucide-react';

const USER_PROFILE_STORAGE_KEY = 'onevoice27_user_profile_v3';
const PROPOSALS_STORAGE_KEY = 'onevoice27_proposals_v3';
const ACTIVE_PROPOSAL_ID_STORAGE_KEY = 'onevoice27_active_proposal_id_v1';
const ACTIVE_ACCOUNT_STORAGE_KEY = 'onevoice27_account_v3';
const SESSION_VIEW_STORAGE_KEY = 'onevoice27_active_view';
const SESSION_LAST_ACTIVE_STORAGE_KEY = 'onevoice27_last_active_time';
const SHARED_UNION_FILTER_STORAGE_KEY = 'onevoice27_shared_union_filter_v1';
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1-hour session timeout for default landing reset

function getRestoredSessionView(
  role: UserRole
): 'form' | 'hub' | 'dashboard' | 'approved' | 'monitor' | 'settings' | 'playbook' | null {
  try {
    const savedView = localStorage.getItem(SESSION_VIEW_STORAGE_KEY) as
      | 'form'
      | 'hub'
      | 'dashboard'
      | 'approved'
      | 'monitor'
      | 'settings'
      | 'playbook'
      | null;
    const lastActiveStr = localStorage.getItem(SESSION_LAST_ACTIVE_STORAGE_KEY);
    if (savedView && lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (!isNaN(lastActive) && Date.now() - lastActive < SESSION_TIMEOUT_MS) {
        const isLeadership = isHubRole(role);
        if (
          savedView === 'form' ||
          savedView === 'playbook' ||
          savedView === 'dashboard' ||
          isLeadership
        ) {
          return savedView;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

const createDefaultProposal = (user: UserAccount): Proposal => {
  const now = new Date().toISOString();
  const availableUnions = getUserAllUnions(user);
  const defaultUnion = user.union || availableUnions[0] || '';
  const newId = crypto.randomUUID ? crypto.randomUUID() : `prop_${Date.now()}`;
  return {
    id: newId,
    createdAt: now,
    updatedAt: now,
    userId: user.uid,
    userName: user.displayName,
    userEmail: user.email,
    union: defaultUnion,
    status: 'draft',
    activityLog: [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : `act_${Date.now()}`,
        proposalId: newId,
        proposalTitle: 'Untitled proposal',
        type: 'created',
        timestamp: now,
        actorUid: user.uid,
        actorName: user.displayName || user.email || 'Author',
        actorEmail: user.email || '',
        actorRole: user.role,
        union: defaultUnion,
        details: 'Initial proposal draft created',
        newStatus: 'draft',
      },
    ],
    pointOfContact: {
      name: user.displayName || '',
      email: user.email || '',
      phone: '',
    },
    divisionLeadContact: {
      name: '',
      email: '',
      phone: '',
    },
    gcLiaison: {
      name: '',
      email: '',
      phone: '',
    },
    strategicFocus: '',
    divisionProject: '',
    title: '',
    overview: '',
    goal: '',
    outcomes: '',
    kpiType: '',
    kpiNumber: '',
    kpiDescription: '',
    kpiRationale: '',
    hadSimilarProject2Years: '',
    deliverables: '',
    targetAudiences: [],
    audienceEDetails: '',
    pointsOfIntegration: '',
    budgetItems: [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : `b_${Date.now()}`,
        activity: '',
        divisionFunding: 0,
      },
    ],
  };
};

function sanitizeProposal(p: Proposal): Proposal {
  const rawDivisionLead =
    p.divisionLeadContact?.name === 'Anthony Stanyer'
      ? { name: '', email: '', phone: '' }
      : p.divisionLeadContact;

  const pointOfContact = {
    name: p.pointOfContact?.name ?? '',
    email: p.pointOfContact?.email ?? '',
    phone: p.pointOfContact?.phone ?? '',
  };

  const divisionLeadContact = {
    name: rawDivisionLead?.name ?? '',
    email: rawDivisionLead?.email ?? '',
    phone: rawDivisionLead?.phone ?? '',
  };

  const gcLiaison = {
    name: p.gcLiaison?.name ?? '',
    email: p.gcLiaison?.email ?? '',
    phone: p.gcLiaison?.phone ?? '',
  };

  const budgetItems = (p.budgetItems || []).map((b) => ({
    id: b.id || (crypto.randomUUID ? crypto.randomUUID() : `b_${Date.now()}`),
    activity: b.activity || '',
    divisionFunding: Number(b.divisionFunding ?? b.gcFunding) || 0,
  }));

  // Invariant: Any proposal with an official Committee Action recorded is officially Approved
  const hasCommitteeAction = Boolean(
    p.unionApproval?.actionNumber && p.unionApproval.actionNumber.trim() !== ''
  );
  const status = hasCommitteeAction ? 'approved' : p.status || 'draft';

  return {
    ...p,
    title: p.title ?? '',
    union: p.union ?? '',
    strategicFocus: p.strategicFocus ?? '',
    divisionProject: p.divisionProject ?? '',
    overview: p.overview ?? '',
    goal: p.goal ?? '',
    outcomes: p.outcomes ?? '',
    kpiType: p.kpiType ?? '',
    kpiNumber: p.kpiNumber != null ? String(p.kpiNumber) : '',
    kpiDescription: p.kpiDescription ?? '',
    kpiRationale: p.kpiRationale ?? '',
    hadSimilarProject2Years: p.hadSimilarProject2Years ?? '',
    deliverables: p.deliverables ?? '',
    audienceEDetails: p.audienceEDetails ?? '',
    pointsOfIntegration: p.pointsOfIntegration ?? '',
    targetAudiences: Array.isArray(p.targetAudiences) ? p.targetAudiences : [],
    status,
    pointOfContact,
    divisionLeadContact,
    gcLiaison,
    budgetItems:
      budgetItems.length > 0
        ? budgetItems
        : [
            {
              id: crypto.randomUUID ? crypto.randomUUID() : `b_${Date.now()}`,
              activity: '',
              divisionFunding: 0,
            },
          ],
    ...(p.projectCode
      ? {
          projectCode: resolveProposalProjectCode(p, 1, {
            allowFallbackSequence: Boolean(p.projectCode.projectId),
          }),
        }
      : {}),
  };
}

const GUEST_ACCOUNT: UserAccount = {
  uid: '',
  email: '',
  displayName: '',
  role: 'user',
  union: '',
  department: '',
  institution: '',
};

function hasStakeholderUrlIntent(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'public-monitor' || params.get('mode') === 'stakeholder';
}

function getStakeholderKeyFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  return key && key.trim() !== '' ? key.trim() : null;
}

function checkIsStakeholderView(): boolean {
  if (!hasStakeholderUrlIntent()) return false;
  return isValidPublicMonitorToken(getStakeholderKeyFromUrl());
}

function getProposalIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('proposal');
  return id && id.trim() !== '' ? id.trim() : null;
}

export default function App() {
  const [isAuthResolved, setIsAuthResolved] = useState<boolean>(() => Boolean(auth.currentUser));

  // 1. User & Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    // Clean default unauthenticated state
    return GUEST_ACCOUNT;
  });

  const [isSimulatedRole, setIsSimulatedRole] = useState(false);

  // 2. User Profile mapping for backward compatibility
  const userProfile: UserProfile = {
    name: currentUser.displayName,
    email: currentUser.email,
    division: currentUser.union,
    union: currentUser.union,
    department: currentUser.department || 'Communication',
    institution: currentUser.institution || currentUser.union,
  };

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    return localStorage.getItem('onevoice27_onboarded') === 'true';
  });

  // 3. Proposals State (Strictly empty until authenticated; never expose cached proposals or dummy drafts while logged out)
  const [proposals, setProposals] = useState<Proposal[]>(() => {
    if (!currentUser.email) {
      return [];
    }
    try {
      const saved = localStorage.getItem(PROPOSALS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => sanitizeProposal(p));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [activeProposalId, setActiveProposalId] = useState<string>(() => {
    if (!currentUser.email) return '';
    const urlProposalId = getProposalIdFromUrl();
    if (urlProposalId) {
      return urlProposalId;
    }
    try {
      const savedId = localStorage.getItem(ACTIVE_PROPOSAL_ID_STORAGE_KEY);
      if (savedId && proposals.some((p) => p.id === savedId)) {
        return savedId;
      }
    } catch {
      // ignore
    }
    return proposals[0]?.id || '';
  });

  // Persist activeProposalId across page reloads so authenticated users never lose the proposal they are editing
  useEffect(() => {
    if (!currentUser.email || !activeProposalId) return;
    try {
      localStorage.setItem(ACTIVE_PROPOSAL_ID_STORAGE_KEY, activeProposalId);
    } catch {
      // ignore
    }
  }, [currentUser.email, activeProposalId]);

  const [stakeholderKey, setStakeholderKey] = useState<string | null>(getStakeholderKeyFromUrl);
  const [isStakeholderView, setIsStakeholderView] = useState<boolean>(checkIsStakeholderView);
  const [hasInvalidStakeholderLink, setHasInvalidStakeholderLink] = useState<boolean>(
    () => hasStakeholderUrlIntent() && !checkIsStakeholderView()
  );
  const [stakeholderSnapshotTime, setStakeholderSnapshotTime] = useState<string | undefined>(undefined);
  const [isStakeholderRefreshing, setIsStakeholderRefreshing] = useState(false);
  const [stakeholderRefreshTrigger, setStakeholderRefreshTrigger] = useState(0);

  const handleStakeholderForceRefresh = useCallback(async () => {
    setIsStakeholderRefreshing(true);
    setStakeholderRefreshTrigger((prev) => prev + 1);
    try {
      clearPublicMonitorCache();
      const fresh = await fetchPublicMonitorSnapshot(true, stakeholderKey || '');
      if (fresh) {
        setStakeholderSnapshotTime(fresh.updatedAt);
      }
    } catch (e) {
      console.warn('Notice force refreshing stakeholder data:', e);
    } finally {
      setIsStakeholderRefreshing(false);
    }
  }, [stakeholderKey]);

  useEffect(() => {
    const handlePopState = () => {
      const key = getStakeholderKeyFromUrl();
      const validStakeholder = checkIsStakeholderView();
      setStakeholderKey(key);
      setIsStakeholderView(validStakeholder);
      setHasInvalidStakeholderLink(hasStakeholderUrlIntent() && !validStakeholder);
      const urlPropId = getProposalIdFromUrl();
      if (urlPropId) {
        setActiveProposalId(urlPropId);
        setReturnFromFormView((prev) => prev || 'approved');
        setCurrentView('form');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Top-Level View: Proposal Form ('form') vs Review Hub ('hub') vs Executive Dashboard ('dashboard') vs Approved Proposals ('approved') vs Executive Monitor ('monitor') vs Playbook & FAQs ('playbook')
  // On manual refresh within 1 hour: restores the user's active page.
  // After 1 hour of inactivity or fresh session: defaults to 'monitor' for leadership, 'form' for proposal authors.
  const [currentView, setCurrentView] = useState<
    'form' | 'hub' | 'dashboard' | 'approved' | 'monitor' | 'settings' | 'playbook'
  >(() => {
    if (checkIsStakeholderView()) return 'monitor';
    if (getProposalIdFromUrl()) return 'form';
    const restored = getRestoredSessionView(currentUser.role);
    if (restored) return restored;
    if (currentUser.role === 'division_liaison') return 'approved';
    return isHubRole(currentUser.role) ? 'monitor' : 'form';
  });

  // Track where the user came from when opening a proposal on the Proposal Page ('form').
  // When null, the user is in the Proposals Workspace (Left Sidebar with drafts stays visible).
  // When set ('approved' | 'hub' | 'dashboard' | 'monitor' | 'settings' | 'builder'), the proposal opens in the Dedicated Proposal Page (with Right-Hand Governance & Review Panel).
  const [returnFromFormView, setReturnFromFormView] = useState<
    'hub' | 'approved' | 'dashboard' | 'monitor' | 'settings' | 'builder' | null
  >(() => (getProposalIdFromUrl() ? 'approved' : null));
  const [proposalFocusTarget, setProposalFocusTarget] = useState<ProposalFocusTarget>(null);
  const [customNavigableIds, setCustomNavigableIds] = useState<string[] | null>(null);
  const [copiedProposalLink, setCopiedProposalLink] = useState(false);

  // Track where the user came from before opening the full-page Playbook & FAQs view
  const [playbookReturnView, setPlaybookReturnView] = useState<
    'form' | 'hub' | 'dashboard' | 'approved' | 'monitor' | 'settings'
  >(() => {
    try {
      const raw = localStorage.getItem(PLAYBOOK_PAGE_STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.returnView && parsed.returnView !== 'playbook') {
          return parsed.returnView;
        }
      }
    } catch {
      // ignore
    }
    return isHubRole(currentUser.role) ? 'hub' : 'form';
  });
  const [playbookReturnSectionId, setPlaybookReturnSectionId] = useState<string | undefined>(() => {
    try {
      const raw = localStorage.getItem(PLAYBOOK_PAGE_STATE_STORAGE_KEY);
      return raw ? JSON.parse(raw)?.returnSectionId : undefined;
    } catch {
      return undefined;
    }
  });
  const [playbookReturnSectionLabel, setPlaybookReturnSectionLabel] = useState<string | undefined>(() => {
    try {
      const raw = localStorage.getItem(PLAYBOOK_PAGE_STATE_STORAGE_KEY);
      return raw ? JSON.parse(raw)?.returnSectionLabel : undefined;
    } catch {
      return undefined;
    }
  });

  const [reviewHubUnionFilter, setReviewHubUnionFilter] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SHARED_UNION_FILTER_STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'all';
  });

  // Persist shared union filter across tabs and page reloads
  useEffect(() => {
    try {
      localStorage.setItem(SHARED_UNION_FILTER_STORAGE_KEY, reviewHubUnionFilter);
    } catch {
      // ignore
    }
  }, [reviewHubUnionFilter]);

  const userCanAccessHub = isHubRole(currentUser.role);
  const userCanAccessDashboard = userCanAccessHub || Boolean(currentUser.email);

  // Synchronize current view into session storage ONLY when authenticated
  useEffect(() => {
    if (!currentUser.email || !isAuthResolved) return;
    try {
      localStorage.setItem(SESSION_VIEW_STORAGE_KEY, currentView);
      localStorage.setItem(SESSION_LAST_ACTIVE_STORAGE_KEY, Date.now().toString());
    } catch {
      // ignore
    }
  }, [currentView, currentUser.email, isAuthResolved]);

  // Synchronize ?proposal=<id> in the browser URL ONLY for authenticated users on the Proposal Form page
  useEffect(() => {
    if (typeof window === 'undefined' || isStakeholderView || !currentUser.email || !isAuthResolved) return;
    try {
      const url = new URL(window.location.href);
      if (currentView === 'form' && activeProposalId) {
        if (url.searchParams.get('proposal') !== activeProposalId) {
          url.searchParams.set('proposal', activeProposalId);
          window.history.replaceState({}, '', url.pathname + url.search);
        }
      } else if (url.searchParams.has('proposal')) {
        url.searchParams.delete('proposal');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    } catch {
      // ignore URL update errors
    }
  }, [currentView, activeProposalId, isStakeholderView, currentUser.email, isAuthResolved]);

  // Access control guard: enforce role boundaries for Hub/Admin workspaces while allowing signed-in authors on Dashboard
  useEffect(() => {
    if (isStakeholderView) {
      if (currentView !== 'monitor') {
        setCurrentView('monitor');
      }
      return;
    }

    if (
      !userCanAccessHub &&
      (currentView === 'hub' ||
        currentView === 'approved' ||
        currentView === 'monitor' ||
        currentView === 'settings')
    ) {
      setCurrentView('form');
    }

    if (!userCanAccessDashboard && currentView === 'dashboard') {
      setCurrentView('form');
    }

    if (currentView === 'settings' && currentUser.role !== 'super_admin') {
      setCurrentView(userCanAccessHub ? 'hub' : 'form');
    }
  }, [userCanAccessHub, userCanAccessDashboard, currentView, isStakeholderView, currentUser.role]);

  // 4. Modals State
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isLiaisonGuideOpen, setIsLiaisonGuideOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [adminSettingsTab, setAdminSettingsTab] = useState<'budget' | 'roles' | 'logs' | 'api' | 'email'>('budget');
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null);
  const [proposalToTransfer, setProposalToTransfer] = useState<Proposal | null>(null);
  const [isDeletingProposal, setIsDeletingProposal] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationCompletion, setValidationCompletion] = useState<number>(0);
  const [faqTopic, setFaqTopic] = useState<string>('general');
  const [lastSavedText, setLastSavedText] = useState(() =>
    auth.currentUser ? 'Cloud Synced' : 'Saved Locally'
  );
  const [isMobileProposalDrawerOpen, setIsMobileProposalDrawerOpen] = useState(false);
  const [isQuotaNoticeVisible, setIsQuotaNoticeVisible] = useState(false);

  const [pendingGoogleAuthUser, setPendingGoogleAuthUser] = useState<FirebaseUser | null>(null);

  // Debounced auto-save ref and pending flush buffer
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localStorageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestProposalsRef = useRef<Proposal[]>(proposals);
  const hasPendingLocalStorageWriteRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<{ id: string; changes: Partial<Proposal>; proposal: Proposal } | null>(null);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);

  // Sync Role Preview state so automated emails never dispatch to real contacts while simulating roles
  useEffect(() => {
    setEmailRolePreviewActive(isSimulatedRole);
  }, [isSimulatedRole]);

  // Keep latestProposalsRef synchronized for zero-loss beforeunload flushing
  useEffect(() => {
    latestProposalsRef.current = proposals;
  }, [proposals]);

  // Guarantee zero data loss if tab is closed or refreshed while a debounced localStorage write is pending
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasPendingLocalStorageWriteRef.current) {
        safePersistProposalsToLocalStorage(latestProposalsRef.current);
        hasPendingLocalStorageWriteRef.current = false;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Initialize Firebase connection check safely
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
  }, []);

  // Intercept browser print shortcut (Ctrl+P / Cmd+P) to always show the clean proposal PDF preview
  useEffect(() => {
    const handlePrintShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsPrintModalOpen(true);
      }
    };
    window.addEventListener('keydown', handlePrintShortcut);
    return () => window.removeEventListener('keydown', handlePrintShortcut);
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    let userDocUnsub: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (fbUser) {
        try {
          const emailLower = (fbUser.email || '').trim().toLowerCase();
          const isSuperAdmin = isSuperAdminEmail(emailLower);

          // Single-pass reconciliation & profile check (eliminates duplicate getDoc/getDocs & artificial delay)
          let syncedCandidate: UserAccount | null = null;
          try {
            syncedCandidate = await syncUserProfile(fbUser, undefined, undefined, false);
          } catch (e) {
            console.warn('Error syncing user profile:', e);
            if (isQuotaExceededError(e)) {
              setIsQuotaNoticeVisible(true);
            }
            try {
              const cached = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
              if (cached) {
                const parsed = JSON.parse(cached) as UserAccount;
                if (parsed && parsed.uid === fbUser.uid) {
                  syncedCandidate = parsed;
                }
              }
            } catch {
              // ignore
            }
          }

          if (
            syncedCandidate &&
            (isSuperAdmin || (syncedCandidate.union && syncedCandidate.unionConfirmed))
          ) {
            const account =
              isSuperAdmin && !syncedCandidate.unionConfirmed
                ? await syncUserProfile(
                    fbUser,
                    emailLower === 'astanyer@adventist.asia'
                      ? 'Southern Asia-Pacific Division'
                      : syncedCandidate.union || 'Southern Luzon Philippine Union Mission',
                    'super_admin',
                    true
                  )
                : syncedCandidate;

            setCurrentUser(account);
            safeSetStorageItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(account));
            setIsSimulatedRole(false);
            setLastSavedText('Cloud Synced');

            // Preserve user's active page on reload if session is active or URL has ?proposal=; otherwise route by role
            const restoredView = getRestoredSessionView(account.role);
            if (getProposalIdFromUrl()) {
              setCurrentView('form');
            } else if (
              restoredView &&
              !(account.role === 'division_liaison' && restoredView === 'form')
            ) {
              setCurrentView(restoredView);
            } else if (account.role === 'division_liaison') {
              setCurrentView('approved');
            } else if (isHubRole(account.role)) {
              setCurrentView('hub');
            } else {
              setCurrentView('form');
            }

            // Real-time listener for user role / assigned unions updates by admin
            userDocUnsub = onSnapshot(
              doc(db, 'users', fbUser.uid),
              (userDocSnap) => {
                if (userDocSnap.exists()) {
                  const liveData = userDocSnap.data() as UserAccount;
                  setCurrentUser((prev) => {
                    if (prev.uid === fbUser.uid) {
                      const merged = { ...prev, ...liveData };
                      safeSetStorageItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(merged));
                      return merged;
                    }
                    return prev;
                  });
                }
              },
              (err) => {
                if (isQuotaExceededError(err)) {
                  console.warn('User profile subscription notice: Firestore daily quota reached. Using local cache.');
                  setIsQuotaNoticeVisible(true);
                  return;
                }
                console.warn('User profile snapshot listener notice:', err);
              }
            );
          } else {
            // First-time or unconfirmed Google registration: prompt to choose union
            const isGoogleProvider = fbUser.providerData.some((p) => p.providerId === 'google.com');
            if (isGoogleProvider) {
              setPendingGoogleAuthUser(fbUser);
              setIsAuthModalOpen(true);
            }
          }
          setIsAuthResolved(true);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
          setIsAuthResolved(true);
        }
      } else {
        // Signed out of Firebase Auth: purge all cached proposals, accounts, and monitor caches so nothing leaks when logged out
        clearAppCaches();
        clearProposalServiceMemoryCache();
        clearPublicMonitorCache();
        try {
          localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
          localStorage.removeItem(ACTIVE_PROPOSAL_ID_STORAGE_KEY);
          localStorage.removeItem(SESSION_VIEW_STORAGE_KEY);
          localStorage.removeItem(SESSION_LAST_ACTIVE_STORAGE_KEY);
        } catch {
          // ignore
        }
        setIsSimulatedRole(false);
        setCurrentUser(GUEST_ACCOUNT);
        setProposals([]);
        setActiveProposalId('');
        if (checkIsStakeholderView()) {
          setCurrentView('monitor');
          setIsStakeholderView(true);
        } else {
          setCurrentView('form');
        }
        setLastSavedText('Saved Locally');
        setIsAuthResolved(true);
      }
    });
    return () => {
      if (userDocUnsub) userDocUnsub();
      unsubscribe();
    };
  }, []);

  // Hybrid Proposal Synchronization (Catalog Cache-First + Single Active Doc Real-time Streaming)
  const loadProposalsCatalog = useCallback(async (user: UserAccount, forceServer: boolean = false) => {
    // Always capture existing local proposals first so unsaved offline drafts are never lost
    let masterList: Proposal[] = [];
    try {
      const raw = localStorage.getItem(PROPOSALS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          masterList = parsed;
        }
      }
    } catch {
      // ignore
    }

    // 1. Instant local render from storage cache (0ms latency, skipped if forceServer requested)
    if (!forceServer) {
      const localFiltered = filterProposalsForRole(masterList, user);
      if (localFiltered.length > 0) {
        const urlPropId = getProposalIdFromUrl();
        const savedId = localStorage.getItem(ACTIVE_PROPOSAL_ID_STORAGE_KEY);
        setProposals(localFiltered);
        setActiveProposalId((prev) => {
          if (urlPropId && localFiltered.some((p) => p.id === urlPropId)) return urlPropId;
          if (savedId && localFiltered.some((p) => p.id === savedId)) return savedId;
          return localFiltered.some((p) => p.id === prev) ? prev : localFiltered[0].id;
        });
      }
    } else {
      // Purge cached proposals & memory caches when force-syncing
      clearProposalServiceMemoryCache();
      clearPublicMonitorCache();
      try {
        localStorage.removeItem(PROPOSALS_STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    // Wait for Firebase Auth initialization on page refresh before checking auth.currentUser
    try {
      if (typeof (auth as unknown as { authStateReady?: () => Promise<void> }).authStateReady === 'function') {
        await (auth as unknown as { authStateReady: () => Promise<void> }).authStateReady();
      }
    } catch {
      // ignore
    }

    if (!user.email || !auth.currentUser) {
      setProposals([]);
      setActiveProposalId('');
      return;
    }

    // 2. Fetch fresh catalog from Firestore (Single query read, with forceServer option bypassing cache)
    setIsRefreshingCatalog(true);
    try {
      // On forced Sync, also re-verify the user's live profile (role, union, assignedUnions) from Firestore server
      let effectiveUser = user;
      if (forceServer && auth.currentUser && !isSimulatedRole) {
        try {
          const freshProfile = await syncUserProfile(
            auth.currentUser,
            user.union,
            user.role,
            true,
            true
          );
          if (freshProfile && freshProfile.email) {
            effectiveUser = freshProfile;
            setCurrentUser(freshProfile);
            safeSetStorageItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(freshProfile));
          }
        } catch (profErr) {
          console.warn('Notice refreshing user profile during sync:', profErr);
        }
      }

      const remote = await fetchProposals(effectiveUser, forceServer);
      if (remote && remote.length > 0) {
        // Memory-only sanitize (zero auto-heal write loops back to Firestore!)
        const sanitized = remote
          .filter((p) => !isZeroDataProposal(p))
          .map((p) => sanitizeProposal(p));

        // Reconcile with any locally created proposals that have substantive content but failed to sync
        const remoteIds = new Set(sanitized.map((p) => p.id));
        const userEmailLower = (effectiveUser.email || '').trim().toLowerCase();
        const pendingLocal = masterList.filter(
          (p) =>
            !remoteIds.has(p.id) &&
            hasMeaningfulProposalData(p) &&
            (p.userId === effectiveUser.uid ||
              !p.userId ||
              (userEmailLower && (p.userEmail || '').trim().toLowerCase() === userEmailLower))
        );

        if (pendingLocal.length > 0) {
          for (const lp of pendingLocal) {
            const fullLocalProposal = {
              ...lp,
              userId: effectiveUser.uid,
              userName: effectiveUser.displayName || lp.userName,
              userEmail: effectiveUser.email || lp.userEmail,
              union: lp.union || effectiveUser.union,
            };
            sanitized.unshift(sanitizeProposal(fullLocalProposal));
            // Auto-persist stranded proposal to Firestore in background
            saveProposalToFirestore(fullLocalProposal).catch((err) => {
              console.warn('Auto-sync stranded proposal notice:', err);
            });
          }
        }

        const roleFiltered = filterProposalsForRole(sanitized, effectiveUser);
        if (roleFiltered.length > 0) {
          const urlPropId = getProposalIdFromUrl();
          const savedId = localStorage.getItem(ACTIVE_PROPOSAL_ID_STORAGE_KEY);
          setProposals(roleFiltered);
          setActiveProposalId((prev) => {
            if (urlPropId && roleFiltered.some((p) => p.id === urlPropId)) return urlPropId;
            if (savedId && roleFiltered.some((p) => p.id === savedId)) return savedId;
            return roleFiltered.some((p) => p.id === prev) ? prev : roleFiltered[0].id;
          });
        } else {
          const fresh = createDefaultProposal(effectiveUser);
          setProposals([fresh]);
          setActiveProposalId(fresh.id);
        }
        safePersistProposalsToLocalStorage(sanitized);
        setLastSavedText(forceServer ? 'Cloud Synced Just Now' : 'Cloud Synced');

        // Automatically publish updated snapshots to cloud ONLY when a verified Division Super Admin loads the full division catalog
        if (
          effectiveUser.role === 'super_admin' &&
          !isSimulatedRole &&
          auth.currentUser &&
          isSuperAdminEmail(auth.currentUser.email) &&
          sanitized.length > 0
        ) {
          syncSnapshotFromFullProposals(sanitized).catch(() => {});
          syncGcApiExportSnapshot(sanitized).catch(() => {});
        }
      } else if (masterList.length === 0) {
        const fresh = createDefaultProposal(effectiveUser);
        setProposals([fresh]);
        setActiveProposalId(fresh.id);
      }
    } catch (err) {
      console.warn('Catalog fetch notice:', err);
      if (isQuotaExceededError(err)) {
        setIsQuotaNoticeVisible(true);
        setLastSavedText('Saved Locally (Daily Quota Reached)');
      }
    } finally {
      setIsRefreshingCatalog(false);
    }
  }, [isSimulatedRole]);

  // Fetch catalog on user/session load ONLY when authenticated
  useEffect(() => {
    if (!currentUser.email || !auth.currentUser) {
      return;
    }
    loadProposalsCatalog(currentUser);
    // Warm up internal division snapshot cache in background ONLY for signed-in users
    fetchPublicMonitorSnapshot(false).catch(() => {});
  }, [currentUser, loadProposalsCatalog]);

  // Real-time listener scoped ONLY to the active proposal being edited or reviewed
  useEffect(() => {
    if (!auth.currentUser || !activeProposalId) return;

    const unsub = subscribeToProposal(
      activeProposalId,
      (remoteProposal) => {
        if (!remoteProposal) return;
        const clean = sanitizeProposal(remoteProposal);
        setProposals((prev) => {
          const idx = prev.findIndex((p) => p.id === clean.id);
          if (idx >= 0) {
            const currentItem = prev[idx];
            // Only update if server proposal is newer or status/action changed
            const isServerNewer =
              new Date(clean.updatedAt || 0).getTime() > new Date(currentItem.updatedAt || 0).getTime();
            const hasNewAction =
              clean.unionApproval?.actionNumber !== currentItem.unionApproval?.actionNumber;
            const hasNewStatus = clean.status !== currentItem.status;

            if (isServerNewer || hasNewAction || hasNewStatus) {
              const next = [...prev];
              next[idx] = clean;
              safePersistProposalsToLocalStorage(next);
              return next;
            }
            return prev;
          }
          return [clean, ...prev];
        });
      },
      (error) => {
        if (isQuotaExceededError(error)) {
          setIsQuotaNoticeVisible(true);
          setLastSavedText('Saved Locally (Daily Quota Reached)');
        }
      }
    );

    return () => unsub();
  }, [activeProposalId]);

  // Local helper to enforce role visibility when offline or before remote sync
  function filterProposalsForRole(items: Proposal[], user: UserAccount): Proposal[] {
    if (!user.email) {
      return [];
    }
    if (user.role === 'super_admin' || isSuperAdminEmail(user.email)) {
      return items;
    }
    const emailLower = (user.email || '').trim().toLowerCase();
    const isOwnedByUser = (p: Proposal) => {
      if (user.uid && p.userId === user.uid) return true;
      if (emailLower) {
        const pEmail = (p.userEmail || '').trim().toLowerCase();
        const pocEmail = (p.pointOfContact?.email || '').trim().toLowerCase();
        if (pEmail === emailLower || pocEmail === emailLower) return true;
      }
      return false;
    };

    if (user.role === 'coordinator' || user.role === 'treasurer' || user.role === 'division_liaison') {
      const allowedUnions = getUserAllUnions(user).map(getCanonicalUnion);
      return items.filter((p) => {
        const canonPropUnion = getCanonicalUnion(p.union || '');
        return allowedUnions.includes(canonPropUnion) || isOwnedByUser(p);
      });
    }
    const userUnions = getUserAllUnions(user);
    if (userUnions.length > 1) {
      // Multi-union user (e.g. Production house operating across territories):
      // sees all proposals matching any of their assigned unions + their own proposals
      return items.filter((p) => {
        const pCanon = getCanonicalUnion(p.union || '');
        return userUnions.some((u) => getCanonicalUnion(u) === pCanon) || isOwnedByUser(p);
      });
    }
    // Standard User sees only their own proposals (by UID or email) or fresh unassigned drafts
    return items.filter(isOwnedByUser);
  }

  // Active Proposal Object
  const activeProposal =
    proposals.find((p) => p.id === activeProposalId) ||
    proposals[0] ||
    createDefaultProposal(currentUser);

  // Update profile from Welcome modal
  const handleSaveProfile = (newProfile: UserProfile) => {
    const updatedAccount: UserAccount = {
      ...currentUser,
      displayName: newProfile.name,
      email: newProfile.email,
      union: newProfile.division,
      department: newProfile.department,
      institution: newProfile.institution,
    };
    setCurrentUser(updatedAccount);
    safeSetStorageItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(updatedAccount));
    safeSetStorageItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
    safeSetStorageItem('onevoice27_onboarded', 'true');
    setHasCompletedOnboarding(true);

    if (activeProposal && !activeProposal.pointOfContact?.name) {
      if (hasMeaningfulProposalData(activeProposal)) {
        handleUpdateActiveProposal({
          pointOfContact: {
            name: newProfile.name,
            email: newProfile.email,
            phone: activeProposal.pointOfContact?.phone || '',
          },
        });
      } else {
        // Keep in local state without writing an empty ghost proposal to Firestore
        setProposals((prev) =>
          prev.map((p) =>
            p.id === activeProposal.id
              ? {
                  ...p,
                  pointOfContact: {
                    ...p.pointOfContact,
                    name: newProfile.name,
                    email: newProfile.email,
                  },
                }
              : p
          )
        );
      }
    }
  };

  // Switch or Simulate Role for testing purposes (strictly restricted to authenticated Super Admins)
  const handleSimulateRole = (newRole: UserRole, targetUnion?: string) => {
    const realAuthUser = auth.currentUser;
    const realAuthEmail = (realAuthUser?.email || '').trim().toLowerCase();
    if (!realAuthUser || !isSuperAdminEmail(realAuthEmail)) {
      console.warn('Blocked role simulation: requires an authenticated Division Super Admin session.');
      return;
    }

    if (newRole === 'super_admin') {
      setIsSimulatedRole(false);
      const restoredAdmin: UserAccount = {
        ...currentUser,
        uid: realAuthUser.uid,
        email: realAuthEmail,
        displayName: realAuthUser.displayName || 'Anthony Stanyer (Admin)',
        role: 'super_admin',
        union:
          realAuthEmail === 'astanyer@adventist.asia'
            ? 'Southern Asia-Pacific Division'
            : 'Southern Luzon Philippine Union Mission',
        unionConfirmed: true,
      };
      setCurrentUser(restoredAdmin);
      safeSetStorageItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(restoredAdmin));
      setReviewHubUnionFilter('all');
      setCurrentView('monitor');
      return;
    }

    setIsSimulatedRole(true);
    let assigned = targetUnion;
    if (!assigned) {
      if (newRole === 'division_liaison') {
        assigned = 'Southeastern Asia Union Mission';
      } else if (newRole === 'coordinator' || newRole === 'treasurer') {
        if (
          !currentUser.union ||
          currentUser.union.toLowerCase().includes('division') ||
          currentUser.union.toLowerCase().includes('headquarters')
        ) {
          assigned = 'Timor-Leste Mission';
        } else {
          assigned = currentUser.union;
        }
      } else {
        assigned = currentUser.union;
      }
    }

    const updated: UserAccount = {
      ...currentUser,
      role: newRole,
      union: assigned,
      assignedUnions: [assigned],
      displayName:
        newRole === 'division_liaison'
          ? `Division Liaison (${UNION_ACRONYMS[assigned] || 'SEUM'})`
          : newRole === 'coordinator'
          ? `Coordinator (${UNION_ACRONYMS[assigned] || 'Union'})`
          : newRole === 'treasurer'
          ? `Treasurer (${UNION_ACRONYMS[assigned] || 'Union'})`
          : 'Maria Santos (User)',
      email:
        newRole === 'division_liaison'
          ? 'liaison@adventist.asia'
          : newRole === 'coordinator'
          ? 'coordinator@adventist.asia'
          : newRole === 'treasurer'
          ? 'treasurer@adventist.asia'
          : 'msantos@ecpuc.adventist.ph',
      uid:
        newRole === 'division_liaison'
          ? 'liaison_ssd_01'
          : newRole === 'coordinator'
          ? 'coord_ecpuc_01'
          : newRole === 'treasurer'
          ? 'treasurer_ecpuc_01'
          : 'user_maria_ecpuc',
    };
    setCurrentUser(updated);
    safeSetStorageItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(updated));

    // Synchronize reviewHubUnionFilter with simulated scope
    if (newRole === 'coordinator' || newRole === 'treasurer' || newRole === 'division_liaison') {
      setReviewHubUnionFilter(assigned);
    } else {
      setReviewHubUnionFilter('all');
    }

    // Route Division Liaisons straight to Approved (Step 4 voting queue), other leadership to Monitor
    if (newRole === 'division_liaison') {
      setCurrentView('approved');
    } else if (isHubRole(newRole)) {
      setCurrentView('monitor');
    } else {
      setCurrentView('form');
    }

    // Update proposals view immediately based on selected role
    let masterList: Proposal[] = proposals;
    try {
      const raw = localStorage.getItem(PROPOSALS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          masterList = parsed;
        }
      }
    } catch {
      // ignore
    }
    const filtered = filterProposalsForRole(masterList, updated);
    if (filtered.length > 0) {
      setProposals(filtered);
      setActiveProposalId(filtered[0].id);
    } else {
      const fresh = createDefaultProposal(updated);
      setProposals([fresh]);
      setActiveProposalId(fresh.id);
    }
  };

  // Sign out completely back to clean guest state
  const handleSignOut = async () => {
    await flushPendingSave();
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Sign-out error:', err);
    }
    clearAppCaches();
    clearProposalServiceMemoryCache();
    localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_PROPOSAL_ID_STORAGE_KEY);
    localStorage.removeItem(SESSION_VIEW_STORAGE_KEY);
    localStorage.removeItem(SESSION_LAST_ACTIVE_STORAGE_KEY);
    setCurrentUser(GUEST_ACCOUNT);
    setIsSimulatedRole(false);
    setLastSavedText('Saved Locally');
    setIsAuthModalOpen(false);
    setCurrentView('form');

    // Clear all proposals and caches back to clean signed-out landing gate
    setProposals([]);
    setActiveProposalId('');
  };

  // Update active proposal
  const handleUpdateActiveProposal = (changes: Partial<Proposal>) => {
    let effectiveChanges = changes;

    // Guard: No proposal can be submitted unless 100% of required details are completed
    if (changes.status === 'submitted') {
      const mergedCandidate = { ...activeProposal, ...changes };
      const validation = validateProposalForSubmission(mergedCandidate);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        setValidationCompletion(validation.completionPercentage);
        setIsValidationModalOpen(true);
        const { status: _, ...safeChanges } = changes;
        effectiveChanges = safeChanges;
      }
    }

    // Guard: No proposal can be approved without an official committee action
    if (changes.status === 'approved' && !changes.unionApproval?.actionNumber && !activeProposal.unionApproval?.actionNumber) {
      console.warn('Blocked setting active proposal status to approved without Committee Action.');
      const { status: _, ...safeChanges } = changes;
      effectiveChanges = safeChanges;
    }

    // Guard: Prevent downgrading an officially approved proposal with a Committee Action
    const hasVotedAction = Boolean(
      (activeProposal.unionApproval?.actionNumber && activeProposal.unionApproval.actionNumber.trim() !== '') ||
      (changes.unionApproval?.actionNumber && changes.unionApproval.actionNumber.trim() !== '')
    );
    if (hasVotedAction && changes.status && changes.status !== 'approved') {
      console.warn('Blocked reverting officially approved proposal with Committee Action.');
      const { status: _, ...safeChanges } = changes;
      effectiveChanges = safeChanges;
    }

    const prevStatus = activeProposal.status;
    const newStatus = effectiveChanges.status;
    const isNewSubmission = newStatus === 'submitted' && prevStatus !== 'submitted';
    const isNewApproval = newStatus === 'approved' && prevStatus !== 'approved';
    const isReopened = (newStatus === 'under_review' || newStatus === 'draft') && prevStatus === 'approved';
    const isReturnedToDraft = newStatus === 'draft' && (prevStatus === 'submitted' || prevStatus === 'under_review');
    const isUnderReview = newStatus === 'under_review' && prevStatus === 'submitted';
    const isNewAction = Boolean(
      effectiveChanges.unionApproval?.actionNumber &&
      effectiveChanges.unionApproval.actionNumber.trim() !== '' &&
      effectiveChanges.unionApproval.actionNumber !== activeProposal.unionApproval?.actionNumber
    );
    const isNewReviewerNote = Boolean(
      (effectiveChanges.reviewNotes &&
        effectiveChanges.reviewNotes.length > (activeProposal.reviewNotes?.length || 0)) ||
      (effectiveChanges.reviewerNotes &&
        effectiveChanges.reviewerNotes.trim() !== '' &&
        effectiveChanges.reviewerNotes.trim() !== (activeProposal.reviewerNotes || '').trim())
    );
    const activeNoteExcerpt =
      (effectiveChanges.reviewNotes && effectiveChanges.reviewNotes[effectiveChanges.reviewNotes.length - 1]?.text) ||
      effectiveChanges.reviewerNotes ||
      '';

    let updated = {
      ...activeProposal,
      ...effectiveChanges,
      updatedAt: new Date().toISOString(),
    };

    if (isNewSubmission) {
      updated = appendActivityToProposal(updated, 'submitted', currentUser, 'Proposal submitted for committee review', {
        prevStatus,
        newStatus: 'submitted',
      });
    } else if (isNewApproval) {
      updated = appendActivityToProposal(
        updated,
        'approved',
        currentUser,
        `Proposal approved by committee with Action #${updated.unionApproval?.actionNumber || ''}`,
        {
          prevStatus,
          newStatus: 'approved',
          actionNumber: updated.unionApproval?.actionNumber,
        }
      );
    } else if (isReopened) {
      updated = appendActivityToProposal(updated, 'reopened', currentUser, 'Proposal review reopened by administrator', {
        prevStatus,
        newStatus: updated.status,
      });
    } else if (isReturnedToDraft) {
      updated = appendActivityToProposal(updated, 'returned_to_draft', currentUser, 'Proposal returned to draft status for revisions', {
        prevStatus,
        newStatus: 'draft',
      });
    } else if (isUnderReview) {
      updated = appendActivityToProposal(updated, 'under_review', currentUser, 'Proposal taken under committee review', {
        prevStatus,
        newStatus: 'under_review',
      });
    } else if (isNewAction) {
      updated = appendActivityToProposal(
        updated,
        'action_edited',
        currentUser,
        `Committee Action voted: #${effectiveChanges.unionApproval?.actionNumber}`,
        { actionNumber: effectiveChanges.unionApproval?.actionNumber }
      );
    }

    setProposals((prev) => {
      const next = prev.map((item) => (item.id === activeProposal.id ? updated : item));
      latestProposalsRef.current = next;
      return next;
    });

    // For critical workflow events, persist to localStorage immediately; for keystrokes, debounce to 600ms to prevent main-thread JSON.stringify lag
    if (isNewSubmission || isNewApproval || isReopened || isReturnedToDraft || isUnderReview || isNewAction) {
      if (localStorageTimeoutRef.current) {
        clearTimeout(localStorageTimeoutRef.current);
        localStorageTimeoutRef.current = null;
      }
      hasPendingLocalStorageWriteRef.current = false;
      safePersistProposalsToLocalStorage(latestProposalsRef.current);
    } else {
      hasPendingLocalStorageWriteRef.current = true;
      if (localStorageTimeoutRef.current) {
        clearTimeout(localStorageTimeoutRef.current);
      }
      localStorageTimeoutRef.current = setTimeout(() => {
        safePersistProposalsToLocalStorage(latestProposalsRef.current);
        hasPendingLocalStorageWriteRef.current = false;
        localStorageTimeoutRef.current = null;
      }, 600);
    }

    // Immediate full-document Firestore persistence for critical workflow events (submission, approval, or reopening)
    if ((isNewSubmission || isNewApproval || isReopened) && auth.currentUser) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      pendingSaveRef.current = null;
      setLastSavedText('Cloud Syncing...');
      saveProposalToFirestore(updated)
        .then(() => setLastSavedText('Cloud Synced'))
        .catch((err) => {
          console.warn('Could not persist critical proposal event to Firestore:', err);
          setLastSavedText('Saved Locally');
        });
    }

    // Automated In-App Notifications
    if (isNewSubmission) {
      notifyProposalEvent({ event: 'submit', proposal: updated, actor: currentUser });
    }
    if (isNewApproval) {
      notifyProposalEvent({ event: 'approve', proposal: updated, actor: currentUser });
    }
    if (isNewReviewerNote) {
      notifyProposalEvent({
        event: 'note',
        proposal: updated,
        actor: currentUser,
        noteExcerpt: activeNoteExcerpt,
      });
    }

    // If already saved immediately for submission/approval/reopen, skip debouncer
    if (isNewSubmission || isNewApproval || isReopened) {
      return;
    }

    // Buffer pending changes for immediate flush on navigation or submission
    pendingSaveRef.current = {
      id: updated.id,
      changes: effectiveChanges,
      proposal: updated,
    };

    // Debounce save to Firestore when authenticated (Smart Debouncing: 3s pause)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setLastSavedText('Saving in 3s...');
    saveTimeoutRef.current = setTimeout(async () => {
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      if (auth.currentUser) {
        // Lazy saving: Do not create empty ghost proposals in Firestore until meaningful data is typed
        if (!hasMeaningfulProposalData(updated)) {
          setLastSavedText('Draft in progress');
          pendingSaveRef.current = null;
          return;
        }

        try {
          await patchProposalToFirestore(updated.id, effectiveChanges, updated);
          pendingSaveRef.current = null;
          setLastSavedText(`Cloud Synced ${timeStr}`);
        } catch (err) {
          console.warn('Could not persist to Firestore directly:', err);
          setLastSavedText(`Saved locally ${timeStr}`);
        }
      } else {
        setLastSavedText(`Saved locally ${timeStr}`);
      }
    }, 3000);
  };

  // Immediate flush of any buffered pending edit before view change or submission
  const flushPendingSave = async () => {
    if (localStorageTimeoutRef.current) {
      clearTimeout(localStorageTimeoutRef.current);
      localStorageTimeoutRef.current = null;
    }
    if (hasPendingLocalStorageWriteRef.current) {
      safePersistProposalsToLocalStorage(latestProposalsRef.current);
      hasPendingLocalStorageWriteRef.current = false;
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingSaveRef.current && auth.currentUser) {
      const { id, changes, proposal } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (hasMeaningfulProposalData(proposal)) {
        try {
          await patchProposalToFirestore(id, changes, proposal);
          setLastSavedText('Cloud Synced');
        } catch (err) {
          console.warn('Flush pending save notice:', err);
        }
      }
    }
  };

  // Update any proposal directly (used by Coordinator & Treasury Review Hub drawer, Side Panel, and Progress Tab)
  const handleUpdateProposal = async (proposalId: string, changes: Partial<Proposal>) => {
    const initialList = latestProposalsRef.current.length > 0 ? latestProposalsRef.current : proposals;
    const originalProposal = initialList.find((p) => p.id === proposalId);
    let changesToApply: Partial<Proposal> = changes;

    const prevStatus = originalProposal?.status;
    const newStatus = changes.status;
    const isNewSubmission = newStatus === 'submitted' && prevStatus !== 'submitted';
    const isNewApproval = newStatus === 'approved' && prevStatus !== 'approved';
    const isReopened = (newStatus === 'under_review' || newStatus === 'draft') && prevStatus === 'approved';
    const isReturnedToDraft = newStatus === 'draft' && (prevStatus === 'submitted' || prevStatus === 'under_review');
    const isUnderReview = newStatus === 'under_review' && prevStatus === 'submitted';
    const isNewAction = Boolean(
      changes.unionApproval?.actionNumber &&
      changes.unionApproval.actionNumber.trim() !== '' &&
      changes.unionApproval.actionNumber !== originalProposal?.unionApproval?.actionNumber
    );
    const isNewDivisionAuth = Boolean(
      changes.divisionApproval?.authorized && !originalProposal?.divisionApproval?.authorized
    );
    const isRevokedDivisionAuth = Boolean(
      (changes.divisionApproval === null || changes.divisionApproval?.authorized === false) &&
        originalProposal?.divisionApproval?.authorized
    );

    const isLegacyStep5MissingId = Boolean(
      !isNewDivisionAuth &&
        !isRevokedDivisionAuth &&
        originalProposal?.divisionApproval?.authorized &&
        !(changes.projectCode?.projectId || originalProposal?.projectCode?.projectId)
    );

    if (isNewDivisionAuth || isLegacyStep5MissingId) {
      const existingPreAuthCode = changes.projectCode || originalProposal?.projectCode;
      if (!existingPreAuthCode?.projectId) {
        const alloc = await allocateNextProjectId(originalProposal?.union || '', {
          orgId: existingPreAuthCode?.orgId || 'AT1111',
          existingProposals: latestProposalsRef.current,
        });
        const lockedCode = buildLockedStep5ProjectCode(
          {
            ...(originalProposal || ({ id: proposalId, union: '' } as Proposal)),
            ...(existingPreAuthCode ? { projectCode: existingPreAuthCode } : {}),
          },
          currentUser,
          alloc.projectId,
          existingPreAuthCode?.orgId || 'AT1111'
        );
        changesToApply = { ...changes, projectCode: lockedCode };
      } else {
        const lockedCode = buildLockedStep5ProjectCode(
          {
            ...(originalProposal || ({ id: proposalId, union: '' } as Proposal)),
            projectCode: existingPreAuthCode,
          },
          currentUser
        );
        changesToApply = { ...changes, projectCode: lockedCode };
      }
    } else if (isRevokedDivisionAuth && originalProposal?.projectCode) {
      const unlockedCode = {
        ...originalProposal.projectCode,
        locked: false,
        composite: formatCompositeProjectCode(originalProposal.projectCode),
      };
      changesToApply = { ...changes, projectCode: unlockedCode };
    }

    // Re-read the freshest list after any await so concurrent updates are preserved
    const currentList = latestProposalsRef.current.length > 0 ? latestProposalsRef.current : proposals;
    const freshOriginal = currentList.find((p) => p.id === proposalId) || originalProposal;

    const prevCode = freshOriginal?.projectCode;
    const nextCode = changesToApply.projectCode;
    const prevOrgId = (prevCode?.orgId || 'AT1111').trim();
    const nextOrgId = (nextCode?.orgId || 'AT1111').trim();
    const prevProjectId = (prevCode?.projectId || '').trim();
    const nextProjectId = (nextCode?.projectId || '').trim();
    const prevPhase = (prevCode?.phase || '').trim();
    const nextPhase = (nextCode?.phase || '').trim();
    const prevLifecycleStatus = (prevCode?.status || '').trim();
    const nextLifecycleStatus = (nextCode?.status || '').trim();

    const orgChanged = Boolean(!isNewDivisionAuth && !isRevokedDivisionAuth && nextCode && prevOrgId !== nextOrgId);
    const projectIdChanged = Boolean(!isNewDivisionAuth && !isRevokedDivisionAuth && nextCode && prevProjectId !== nextProjectId);
    const phaseChanged = Boolean(!isNewDivisionAuth && !isRevokedDivisionAuth && nextCode && prevPhase !== nextPhase);
    const lifecycleStatusChanged = Boolean(
      !isNewDivisionAuth && !isRevokedDivisionAuth && nextCode && prevLifecycleStatus !== nextLifecycleStatus
    );
    const hasProjectCodeOrLifecycleEdit =
      orgChanged || projectIdChanged || phaseChanged || lifecycleStatusChanged;

    const isNewLiaisonVote = Boolean(
      changesToApply.liaisonVotes &&
        changesToApply.liaisonVotes.length > 0 &&
        JSON.stringify(changesToApply.liaisonVotes) !== JSON.stringify(freshOriginal?.liaisonVotes || [])
    );
    const latestLiaisonVote =
      changesToApply.liaisonVotes && changesToApply.liaisonVotes.length > 0
        ? changesToApply.liaisonVotes[changesToApply.liaisonVotes.length - 1]
        : null;
    const isNewReviewerNote = Boolean(
      (changesToApply.reviewNotes &&
        changesToApply.reviewNotes.length > (freshOriginal?.reviewNotes?.length || 0)) ||
      (changesToApply.reviewerNotes &&
        changesToApply.reviewerNotes.trim() !== '' &&
        changesToApply.reviewerNotes.trim() !== (freshOriginal?.reviewerNotes || '').trim())
    );
    const targetNoteExcerpt =
      (changesToApply.reviewNotes && changesToApply.reviewNotes[changesToApply.reviewNotes.length - 1]?.text) ||
      changesToApply.reviewerNotes ||
      '';

    let updatedTarget: Proposal | undefined;
    let sanitizedChanges: Partial<Proposal> = changesToApply;

    const next = currentList.map((p) => {
      if (p.id === proposalId) {
        // Guard: No proposal can be accepted or approved without an official committee action
        let effectiveChanges = changesToApply;
        if (changesToApply.status === 'approved' && !changesToApply.unionApproval?.actionNumber && !p.unionApproval?.actionNumber) {
          console.warn(`Blocked approving proposal ${proposalId}: No Committee Action recorded.`);
          const { status: _, ...safeChanges } = changesToApply;
          effectiveChanges = safeChanges;
        }

        // Guard: Prevent accidental status downgrade on proposals with voted Committee Actions
        const hasVotedAction = Boolean(
          p.unionApproval?.actionNumber && p.unionApproval.actionNumber.trim() !== ''
        );
        if (hasVotedAction && changesToApply.status && changesToApply.status !== 'approved' && changesToApply.unionApproval === undefined) {
          console.warn(`Blocked downgrading proposal ${proposalId}: Committee Action #${p.unionApproval?.actionNumber} recorded.`);
          const { status: _, ...safeChanges } = changesToApply;
          effectiveChanges = safeChanges;
        }

        sanitizedChanges = effectiveChanges;
        let candidate: Proposal = {
          ...p,
          ...effectiveChanges,
          updatedAt: new Date().toISOString(),
        };

        if (isNewSubmission) {
          candidate = appendActivityToProposal(candidate, 'submitted', currentUser, 'Step 1: Proposal submitted for review', {
            prevStatus,
            newStatus: 'submitted',
          });
        } else if (isNewApproval) {
          candidate = appendActivityToProposal(
            candidate,
            'approved',
            currentUser,
            `Step 3: Proposal approved by Union Committee with Action #${candidate.unionApproval?.actionNumber || ''}`,
            {
              prevStatus,
              newStatus: 'approved',
              actionNumber: candidate.unionApproval?.actionNumber,
            }
          );
        } else if (isNewLiaisonVote && latestLiaisonVote) {
          candidate = appendActivityToProposal(
            candidate,
            'liaison_voted',
            currentUser,
            `Step 4: Division Liaison ${
              latestLiaisonVote.vote === 'revision_requested'
                ? 'requested revisions'
                : 'voted & recommended proposal to SSD OV27 Committee'
            }${latestLiaisonVote.recommendation ? ` — "${latestLiaisonVote.recommendation}"` : ''}`,
            {
              actionNumber: candidate.unionApproval?.actionNumber,
            }
          );
        } else if (isNewDivisionAuth) {
          candidate = appendActivityToProposal(
            candidate,
            'division_authorized',
            currentUser,
            `Step 5: Officially authorized by SSD OV27 Committee${
              changesToApply.divisionApproval?.referenceNumber ? ` (Ref #${changesToApply.divisionApproval.referenceNumber})` : ''
            }${changesToApply.divisionApproval?.remarks ? ` — "${changesToApply.divisionApproval.remarks}"` : ''}${
              changesToApply.divisionApproval?.liaisonOverride
                ? ` [Super Admin Step 4 Override Recorded: ${
                    changesToApply.divisionApproval.liaisonOverrideReason || 'No Liaison assigned/voted for this Union'
                  }]`
                : ''
            }`,
            {
              actionNumber: changesToApply.divisionApproval?.referenceNumber || candidate.unionApproval?.actionNumber,
            }
          );
          const prevComposite = formatCompositeProjectCode(p.projectCode);
          const nextComposite =
            candidate.projectCode?.composite || formatCompositeProjectCode(candidate.projectCode);
          candidate = appendActivityToProposal(
            candidate,
            'project_code_locked',
            currentUser,
            `GC Project Code locked upon Step 5 Authorization: ${nextComposite}`,
            {
              actionNumber: changesToApply.divisionApproval?.referenceNumber || candidate.unionApproval?.actionNumber,
              field: 'projectCode',
              previousValue: prevComposite,
              newValue: nextComposite,
            }
          );
        } else if (isRevokedDivisionAuth) {
          candidate = appendActivityToProposal(
            candidate,
            'division_unauthorize',
            currentUser,
            'Step 5: SSD OV27 Committee authorization returned to pending status.'
          );
        } else if (isReopened) {
          candidate = appendActivityToProposal(candidate, 'reopened', currentUser, 'Proposal review reopened by administrator', {
            prevStatus,
            newStatus: candidate.status,
          });
        } else if (isReturnedToDraft) {
          candidate = appendActivityToProposal(candidate, 'returned_to_draft', currentUser, 'Proposal returned to draft status for revisions', {
            prevStatus,
            newStatus: 'draft',
          });
        } else if (isUnderReview) {
          candidate = appendActivityToProposal(candidate, 'under_review', currentUser, 'Step 2: Proposal taken under Union review', {
            prevStatus,
            newStatus: 'under_review',
          });
        } else if (isNewAction) {
          candidate = appendActivityToProposal(
            candidate,
            'action_edited',
            currentUser,
            `Step 3: Union Committee Action voted: #${changesToApply.unionApproval?.actionNumber}`,
            { actionNumber: changesToApply.unionApproval?.actionNumber }
          );
        }

        if (orgChanged) {
          candidate = appendActivityToProposal(
            candidate,
            'project_code_edited',
            currentUser,
            `Updated OrgID from ${prevOrgId || '—'} to ${nextOrgId || '—'}`,
            {
              field: 'orgId',
              previousValue: prevOrgId || '—',
              newValue: nextOrgId || '—',
              actionNumber: candidate.unionApproval?.actionNumber,
            }
          );
        }
        if (projectIdChanged) {
          candidate = appendActivityToProposal(
            candidate,
            'project_code_edited',
            currentUser,
            `Updated Project ID from ${prevProjectId || '—'} to ${nextProjectId || '—'}`,
            {
              field: 'projectId',
              previousValue: prevProjectId || '—',
              newValue: nextProjectId || '—',
              actionNumber: candidate.unionApproval?.actionNumber,
            }
          );
        }
        if (phaseChanged) {
          candidate = appendActivityToProposal(
            candidate,
            'phase_changed',
            currentUser,
            `Updated project Phase from ${prevPhase || '—'} to ${nextPhase || '—'}`,
            {
              field: 'phase',
              previousValue: prevPhase || '—',
              newValue: nextPhase || '—',
              actionNumber: candidate.unionApproval?.actionNumber,
            }
          );
        }
        if (lifecycleStatusChanged) {
          candidate = appendActivityToProposal(
            candidate,
            'status_changed',
            currentUser,
            `Updated operational Status from ${prevLifecycleStatus || '—'} to ${nextLifecycleStatus || '—'}`,
            {
              field: 'status',
              previousValue: prevLifecycleStatus || '—',
              newValue: nextLifecycleStatus || '—',
              actionNumber: candidate.unionApproval?.actionNumber,
            }
          );
        }

        updatedTarget = candidate;
        return updatedTarget;
      }
      return p;
    });

    if (updatedTarget) {
      latestProposalsRef.current = next;
      setProposals(next);

      const isImmediateMilestone =
        isNewSubmission ||
        isNewApproval ||
        isNewLiaisonVote ||
        isNewDivisionAuth ||
        isRevokedDivisionAuth ||
        isReopened ||
        isReturnedToDraft ||
        isUnderReview ||
        isNewAction ||
        hasProjectCodeOrLifecycleEdit;

      if (isImmediateMilestone) {
        if (localStorageTimeoutRef.current) {
          clearTimeout(localStorageTimeoutRef.current);
          localStorageTimeoutRef.current = null;
        }
        hasPendingLocalStorageWriteRef.current = false;
        safePersistProposalsToLocalStorage(next);
      } else {
        hasPendingLocalStorageWriteRef.current = true;
        if (localStorageTimeoutRef.current) {
          clearTimeout(localStorageTimeoutRef.current);
        }
        localStorageTimeoutRef.current = setTimeout(() => {
          safePersistProposalsToLocalStorage(latestProposalsRef.current);
          hasPendingLocalStorageWriteRef.current = false;
        }, 600);
      }

      if (auth.currentUser) {
        try {
          const patchPayload: Partial<Proposal> =
            updatedTarget.activityLog !== freshOriginal?.activityLog
              ? { ...sanitizedChanges, activityLog: updatedTarget.activityLog }
              : sanitizedChanges;
          await patchProposalToFirestore(proposalId, patchPayload, updatedTarget);
          // Automatically publish fresh public snapshot only when authenticated Division Super Admin updates
          if (
            currentUser.role === 'super_admin' &&
            !isSimulatedRole &&
            isSuperAdminEmail(auth.currentUser.email)
          ) {
            syncSnapshotFromFullProposals(latestProposalsRef.current).catch(() => {});
          }
        } catch (err) {
          console.warn('Proposal cloud persistence notice:', err);
          throw err;
        }
      }

      // Automated In-App Notifications dispatched only after successful cloud save
      if (isNewSubmission) {
        notifyProposalEvent({ event: 'submit', proposal: updatedTarget, actor: currentUser });
      }
      if (isNewApproval) {
        notifyProposalEvent({ event: 'approve', proposal: updatedTarget, actor: currentUser });
      }
      if (isNewDivisionAuth) {
        notifyProposalEvent({ event: 'authorize', proposal: updatedTarget, actor: currentUser });
      }
      if (isNewLiaisonVote && latestLiaisonVote) {
        notifyProposalEvent({
          event: 'liaison_vote',
          proposal: updatedTarget,
          actor: currentUser,
          voteDecision: latestLiaisonVote.vote,
          noteExcerpt: latestLiaisonVote.recommendation || targetNoteExcerpt,
        });
      } else if (isNewReviewerNote) {
        notifyProposalEvent({
          event: 'note',
          proposal: updatedTarget,
          actor: currentUser,
          noteExcerpt: targetNoteExcerpt,
        });
      }
    }
  };

  // Create new proposal
  const handleNewProposal = async () => {
    if (!currentUser?.email) {
      setIsAuthModalOpen(true);
      return;
    }
    const newProp = createDefaultProposal(currentUser);
    setProposals((prev) => [newProp, ...prev]);
    setActiveProposalId(newProp.id);
    // Keep in local state: Proposal is only persisted to Firestore when author enters substantive content
  };

  // Delete proposal - opens in-app confirmation modal
  const handleDeleteProposal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = proposals.find((p) => p.id === id);
    if (target) {
      setProposalToDelete(target);
    }
  };

  // Confirm delete proposal from state, local cache, and Firestore
  const handleConfirmDeleteProposal = async () => {
    if (!proposalToDelete) return;
    const id = proposalToDelete.id;
    setIsDeletingProposal(true);

    try {
      const remaining = proposals.filter((p) => p.id !== id);
      if (remaining.length === 0) {
        const fresh = createDefaultProposal(currentUser);
        setProposals([fresh]);
        setActiveProposalId(fresh.id);
        safePersistProposalsToLocalStorage([fresh]);
      } else {
        setProposals(remaining);
        if (activeProposalId === id) {
          setActiveProposalId(remaining[0]?.id || '');
        }
        safePersistProposalsToLocalStorage(remaining);
      }

      await deleteProposalFromFirestore(id);

      // Record deletion event to global activity audit stream
      recordActivityLog({
        proposalId: id,
        proposalTitle: proposalToDelete.title || 'Untitled Proposal',
        type: 'deleted',
        timestamp: new Date().toISOString(),
        actorUid: currentUser.uid,
        actorName: currentUser.displayName || currentUser.email || 'User',
        actorEmail: currentUser.email || '',
        actorRole: currentUser.role,
        union: proposalToDelete.union,
        actionNumber: proposalToDelete.unionApproval?.actionNumber,
        details: `Proposal permanently deleted by ${currentUser.displayName || currentUser.email}`,
        prevStatus: proposalToDelete.status,
      }).catch((err) => console.warn('Could not record delete activity:', err));
    } catch (err) {
      console.warn('Could not delete proposal from Firestore:', err);
    } finally {
      setIsDeletingProposal(false);
      setProposalToDelete(null);
    }
  };

  // Duplicate proposal
  const handleDuplicateProposal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser?.email) {
      setIsAuthModalOpen(true);
      return;
    }
    const target = proposals.find((p) => p.id === id);
    if (!target) return;

    const copyId = crypto.randomUUID ? crypto.randomUUID() : `prop_${Date.now()}`;
    const copyNow = new Date().toISOString();
    const clonedBase = JSON.parse(JSON.stringify(target)) as Record<string, unknown>;
    delete clonedBase.projectCode;
    delete clonedBase.divisionApproval;
    delete clonedBase.unionApproval;
    delete clonedBase.liaisonVotes;
    delete clonedBase.reviewNotes;
    delete clonedBase.reviewerNotes;
    delete clonedBase.reviewedBy;
    delete clonedBase.reviewedAt;

    const copy: Proposal = {
      ...(clonedBase as unknown as Proposal),
      id: copyId,
      title: target.title ? `${target.title} (Copy)` : 'Untitled proposal (Copy)',
      userId: currentUser.uid,
      userName: currentUser.displayName,
      userEmail: currentUser.email,
      union: currentUser.union,
      status: 'draft',
      createdAt: copyNow,
      updatedAt: copyNow,
      activityLog: [
        {
          id: crypto.randomUUID ? crypto.randomUUID() : `act_${Date.now()}`,
          proposalId: copyId,
          type: 'created',
          timestamp: copyNow,
          actorUid: currentUser.uid,
          actorName: currentUser.displayName || currentUser.email || 'User',
          actorEmail: currentUser.email || '',
          actorRole: currentUser.role,
          union: currentUser.union,
          details: `Duplicated from proposal "${target.title || 'Untitled'}"`,
          newStatus: 'draft',
        },
      ],
    };

    setProposals((prev) => [copy, ...prev]);
    setActiveProposalId(copy.id);

    try {
      await saveProposalToFirestore(copy);
    } catch {
      // offline fallback
    }
  };

  const handleOpenFaqTopic = (topic: string) => {
    flushPendingSave();
    const sectionMap: Record<string, { id: string; label: string }> = {
      audience: { id: 'section-audience', label: 'Section 7: Target Audience' },
      deliverables: { id: 'section-deliverables', label: 'Section 6: Key Deliverables' },
      kpis: { id: 'section-5-kpi', label: 'Section 5: Primary KPI' },
      metric: { id: 'section-5-kpi', label: 'Section 5: Target Goal' },
      budget: { id: 'section-budget', label: 'Budget Plan' },
      integration: { id: 'section-integration', label: 'Section 8: Points of Integration' },
    };

    const returnFrom = currentView !== 'playbook' ? currentView : playbookReturnView;
    const mappedSection = sectionMap[topic];

    setFaqTopic(topic);
    setPlaybookReturnView(returnFrom);
    setPlaybookReturnSectionId(mappedSection?.id);
    setPlaybookReturnSectionLabel(mappedSection?.label);

    try {
      const existingRaw = localStorage.getItem(PLAYBOOK_PAGE_STATE_STORAGE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(
        PLAYBOOK_PAGE_STATE_STORAGE_KEY,
        JSON.stringify({
          ...existing,
          returnView: returnFrom,
          returnSectionId: mappedSection?.id,
          returnSectionLabel: mappedSection?.label,
        })
      );
    } catch {
      // ignore
    }

    setCurrentView('playbook');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReturnFromPlaybook = () => {
    const canReturnToSaved =
      playbookReturnView === 'form' ||
      userCanAccessHub ||
      (playbookReturnView === 'dashboard' && userCanAccessDashboard);
    const targetView = !canReturnToSaved ? 'form' : playbookReturnView || 'form';
    setCurrentView(targetView);

    if (targetView === 'form' && playbookReturnSectionId) {
      const secId = playbookReturnSectionId;
      setTimeout(() => {
        const el = document.getElementById(secId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-blue-400');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-blue-400');
          }, 2200);
        }
      }, 120);
    }
  };

  const handleOpenStakeholderMonitor = async () => {
    const token = await fetchPublicMonitorShareToken(true);
    setIsStakeholderView(true);
    setStakeholderKey(token);
    setHasInvalidStakeholderLink(false);
    setCurrentView('monitor');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'public-monitor');
      if (token) {
        url.searchParams.set('key', token);
      }
      window.history.pushState({}, '', url.pathname + url.search);
    } catch {
      // ignore
    }
  };

  const isAuthenticatedPortalUser = Boolean(currentUser.email && (isAuthResolved || auth.currentUser));

  if (!isAuthenticatedPortalUser && !isStakeholderView) {
    return (
      <>
        <LoginLandingPage
          onOpenAuth={() => setIsAuthModalOpen(true)}
          isAuthChecking={!isAuthResolved}
          hasProposalDeepLink={Boolean(getProposalIdFromUrl())}
          hasInvalidStakeholderLink={hasInvalidStakeholderLink}
        />

        {isAuthModalOpen && (
          <React.Suspense fallback={null}>
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={() => {
                setPendingGoogleAuthUser(null);
                setIsAuthModalOpen(false);
              }}
              initialPendingGoogleUser={pendingGoogleAuthUser}
              currentUser={currentUser}
              onUpdateUser={(updated: UserAccount) => {
                setPendingGoogleAuthUser(null);
                setCurrentUser(updated);
                setIsAuthResolved(true);
                safeSetStorageItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(updated));

                if (getProposalIdFromUrl()) {
                  setCurrentView('form');
                } else if (updated.role === 'division_liaison') {
                  setCurrentView('approved');
                } else if (isHubRole(updated.role)) {
                  setCurrentView('monitor');
                } else {
                  setCurrentView('form');
                }
              }}
              onSignOut={handleSignOut}
              onSimulateRole={handleSimulateRole}
              isSimulated={isSimulatedRole}
            />
          </React.Suspense>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-slate-800">
      {/* Top Application Header */}
      {isStakeholderView ? (
        <StakeholderHeader
          onExitQuickview={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('view');
            url.searchParams.delete('mode');
            url.searchParams.delete('key');
            window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
            setIsStakeholderView(false);
            setStakeholderKey(null);
            setHasInvalidStakeholderLink(false);
            setCurrentView(userCanAccessHub ? 'monitor' : 'form');
          }}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onRefreshData={handleStakeholderForceRefresh}
          isRefreshing={isStakeholderRefreshing}
          lastSyncedAt={stakeholderSnapshotTime}
        />
      ) : (
        <Header
          userProfile={userProfile}
          currentUser={currentUser}
          activeProposal={activeProposal}
          currentView={currentView}
          onSwitchView={(view) => {
            flushPendingSave();
            if (view === 'form') {
              setReturnFromFormView(null);
              setCustomNavigableIds(null);
            }
            setProposalFocusTarget(null);
            setCurrentView(view);
          }}
          onUpdateProposalStatus={(status) => handleUpdateActiveProposal({ status })}
          onShowValidationErrors={(errors, completionPercentage) => {
            setValidationErrors(errors);
            setValidationCompletion(completionPercentage);
            setIsValidationModalOpen(true);
          }}
          onOpenProfile={() => setIsWelcomeModalOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenMonitor={handleOpenStakeholderMonitor}
          onOpenAdminDashboard={() => setCurrentView('dashboard')}
          onOpenAdminSettings={() => {
            setAdminSettingsTab('budget');
            setCurrentView('settings');
          }}
          onOpenPrint={() => {
            if (!currentUser?.email) {
              setIsAuthModalOpen(true);
              return;
            }
            setIsPrintModalOpen(true);
          }}
          onOpenFaq={() => handleOpenFaqTopic('general')}
          onOpenMobileProposals={() => {
            if (!currentUser?.email) {
              setIsAuthModalOpen(true);
              return;
            }
            setIsMobileProposalDrawerOpen(true);
          }}
          onSelectProposal={async (proposalId) => {
            flushPendingSave();
            setActiveProposalId(proposalId);

            // If the proposal is not in local memory yet, load it from Firestore
            if (!proposals.some((p) => p.id === proposalId)) {
              try {
                const fetched = await fetchProposalById(proposalId);
                if (fetched) {
                  const sanitized = sanitizeProposal(fetched);
                  setProposals((prev) => [sanitized, ...prev]);
                }
              } catch (e) {
                console.warn('Notice loading selected proposal:', e);
              }
            }

            if (isHubRole(currentUser.role)) {
              const nextReturn =
                currentView === 'hub' ||
                currentView === 'approved' ||
                currentView === 'dashboard' ||
                currentView === 'monitor' ||
                currentView === 'settings'
                  ? currentView
                  : 'hub';
              setReturnFromFormView(nextReturn);
            } else {
              setReturnFromFormView(null);
            }
            setCustomNavigableIds(null);
            setProposalFocusTarget(null);
            setCurrentView('form');
          }}
          proposalsCount={proposals.length}
          lastSavedText={lastSavedText}
          onRefreshCatalog={() => loadProposalsCatalog(currentUser, true)}
          isRefreshingCatalog={isRefreshingCatalog}
        />
      )}

      {/* Firestore Free Tier Quota Exceeded Advisory Banner */}
      {!isStakeholderView && isQuotaNoticeVisible && (
        <div className="bg-amber-50 border-b border-amber-200/90 px-4 py-2 text-xs text-amber-950 flex items-center justify-between gap-3 animate-in fade-in no-print">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                !
              </span>
              <p className="truncate">
                <span className="font-bold">Firestore Daily Free Read Quota Reached:</span> The app is running smoothly using your locally cached proposals. Quota resets daily at midnight PT.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="https://console.firebase.google.com/project/gen-lang-client-0953538219/firestore/databases/ai-studio-ssdonevoice27pro-ceefda5c-f71e-485c-aa6b-d7c004b581c4/data?openUpgradeDialog=true"
                target="_blank"
                rel="noreferrer noopener"
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition"
              >
                Upgrade Database
              </a>
              <button
                type="button"
                onClick={() => setIsQuotaNoticeVisible(false)}
                className="text-amber-800 hover:text-amber-950 p-1 rounded hover:bg-amber-100 transition cursor-pointer"
                title="Dismiss notice"
                aria-label="Dismiss notice"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Preview Banner (Only appears when testing/simulating a role) */}
      {isSimulatedRole && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs flex items-center justify-between gap-3 shadow-inner no-print font-medium">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-900" />
              <span>
                Role Preview Active: Viewing workspace as <strong>{currentUser.displayName}</strong> ({currentUser.role.replace('_', ' ').toUpperCase()}).
              </span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-2.5 py-1 rounded-lg bg-slate-950 text-white font-bold text-[11px] hover:bg-slate-800 transition cursor-pointer"
            >
              Exit Role Preview
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Layout: Playbook & FAQs vs Executive Monitor vs Executive Dashboard vs Approved Proposals vs Review Hub vs Proposal Editor */}
      {!isStakeholderView && currentView === 'playbook' ? (
        <main className="flex-1 w-full">
          <ViewErrorBoundary fallbackTitle="Unable to load OneVoice27 Playbook & FAQs">
            <PlaybookFaqPage
              initialTopic={faqTopic}
              activeProposalTitle={activeProposal?.title?.trim() || undefined}
              returnViewLabel={
                playbookReturnView === 'hub'
                  ? 'Review Hub'
                  : playbookReturnView === 'monitor'
                  ? 'Executive Monitor'
                  : playbookReturnView === 'approved'
                  ? 'Approved Proposals'
                  : playbookReturnView === 'dashboard'
                  ? 'Dashboard'
                  : 'Proposal Editor'
              }
              returnSectionLabel={playbookReturnSectionLabel}
              onReturnToPrevious={handleReturnFromPlaybook}
              onOpenLiaisonGuide={() => setIsLiaisonGuideOpen(true)}
            />
          </ViewErrorBoundary>
        </main>
      ) : (isStakeholderView || (userCanAccessHub && currentView === 'monitor')) ? (
        <main className="flex-1 w-full max-w-[1536px] mx-auto p-3 sm:p-5 lg:p-6 space-y-6">
          <ViewErrorBoundary fallbackTitle="Unable to load Territory Monitor">
            <MonitorDashboard
              proposals={proposals}
              currentUser={currentUser}
              isStakeholderView={isStakeholderView}
              stakeholderKey={stakeholderKey}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              isSimulatedRole={isSimulatedRole}
              externalRefreshTrigger={stakeholderRefreshTrigger}
              onRefreshCatalog={(forceServer) => loadProposalsCatalog(currentUser, forceServer)}
              onSnapshotUpdated={(snap) => setStakeholderSnapshotTime(snap.updatedAt)}
              onNavigateToReviewHub={(unionFilter) => {
                if (isStakeholderView) return;
                if (unionFilter) {
                  setReviewHubUnionFilter(unionFilter);
                }
                setCurrentView('hub');
              }}
              onNavigateToDashboard={isStakeholderView ? undefined : () => setCurrentView('dashboard')}
              onOpenAdminSettings={isStakeholderView ? undefined : () => {
                setAdminSettingsTab('budget');
                setCurrentView('settings');
              }}
              onSelectProposal={isStakeholderView ? undefined : (proposalId) => {
                setReturnFromFormView('monitor');
                setCustomNavigableIds(null);
                setProposalFocusTarget(null);
                setActiveProposalId(proposalId);
                setCurrentView('form');
              }}
            />
          </ViewErrorBoundary>
        </main>
      ) : userCanAccessDashboard && currentView === 'dashboard' ? (
        <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
          <ViewErrorBoundary fallbackTitle="Unable to load Division Executive Dashboard">
            <AdminDashboard
              proposals={proposals}
              currentUser={currentUser}
              selectedUnionFilter={reviewHubUnionFilter}
              onUnionFilterChange={setReviewHubUnionFilter}
              onSelectProposal={(proposalId) => {
                setReturnFromFormView('dashboard');
                setCustomNavigableIds(null);
                setProposalFocusTarget(null);
                setActiveProposalId(proposalId);
                setCurrentView('form');
              }}
              onOpenBudgetAllocations={
                currentUser.role === 'super_admin'
                  ? () => {
                      setAdminSettingsTab('budget');
                      setCurrentView('settings');
                    }
                  : undefined
              }
              onBackToReviewHub={userCanAccessHub ? () => setCurrentView('hub') : undefined}
            />
          </ViewErrorBoundary>
        </main>
      ) : userCanAccessHub && currentView === 'approved' ? (
        <main className="flex-1 w-full">
          <ViewErrorBoundary fallbackTitle="Unable to load Approved Proposals">
            <ApprovedProposals
              proposals={proposals}
              currentUser={currentUser}
              selectedUnionFilter={reviewHubUnionFilter}
              onUnionFilterChange={setReviewHubUnionFilter}
              onUpdateProposal={handleUpdateProposal}
              onOpenInEditor={(proposalId, options) => {
                setReturnFromFormView('approved');
                setCustomNavigableIds(options?.navigableIds || null);
                setProposalFocusTarget(options?.focus || null);
                setActiveProposalId(proposalId);
                setCurrentView('form');
              }}
              onOpenPrint={(proposal) => {
                setActiveProposalId(proposal.id);
                setIsPrintModalOpen(true);
              }}
              onOpenLiaisonGuide={() => setIsLiaisonGuideOpen(true)}
            />
          </ViewErrorBoundary>
        </main>
      ) : userCanAccessHub && currentView === 'hub' ? (
        <main className="flex-1 w-full">
          <ViewErrorBoundary fallbackTitle="Unable to load Review Hub">
            <ReviewHub
              proposals={proposals}
              currentUser={currentUser}
              initialUnionFilter={reviewHubUnionFilter}
              onUnionFilterChange={setReviewHubUnionFilter}
              onUpdateProposal={handleUpdateProposal}
              onOpenInEditor={(proposalId, options) => {
                setReturnFromFormView('hub');
                setCustomNavigableIds(options?.navigableIds || null);
                setProposalFocusTarget(options?.focus || null);
                setActiveProposalId(proposalId);
                setCurrentView('form');
              }}
              onOpenPrint={(proposal) => {
                setActiveProposalId(proposal.id);
                setIsPrintModalOpen(true);
              }}
              onOpenAdminSettings={() => {
                setAdminSettingsTab('budget');
                setCurrentView('settings');
              }}
              onOpenDashboard={() => setCurrentView('dashboard')}
              onNewProposal={() => {
                setReturnFromFormView(null);
                setCustomNavigableIds(null);
                setProposalFocusTarget(null);
                handleNewProposal();
                setCurrentView('form');
              }}
            />
          </ViewErrorBoundary>
        </main>
      ) : userCanAccessHub && currentView === 'settings' ? (
        <main className="flex-1 w-full max-w-[1536px] mx-auto p-3 sm:p-5 lg:p-6 space-y-6">
          <ViewErrorBoundary fallbackTitle="Unable to load Division Administration Settings">
            <React.Suspense fallback={<ViewLoadingSkeleton />}>
              <AdminSettingsModal
                isFullPageView={true}
                isOpen={true}
                currentAdminUid={currentUser.uid}
                currentAdminEmail={currentUser.email}
                currentAdminName={currentUser.displayName}
                proposals={proposals}
                initialTab={adminSettingsTab}
                onClose={() => setCurrentView('hub')}
                onProposalsBatchUpdated={(updatedList: Proposal[]) => {
                  if (!updatedList.length) return;
                  const updatedById = new Map(updatedList.map((u) => [u.id, u]));
                  setProposals((prev) => {
                    const next = prev.map((p) => updatedById.get(p.id) || p);
                    latestProposalsRef.current = next;
                    safePersistProposalsToLocalStorage(next);
                    return next;
                  });
                }}
                onSelectProposal={(id: string) => {
                  setReturnFromFormView('settings');
                  setCustomNavigableIds(null);
                  setProposalFocusTarget(null);
                  setActiveProposalId(id);
                  setCurrentView('form');
                }}
              />
            </React.Suspense>
          </ViewErrorBoundary>
        </main>
      ) : (
        (() => {
          // Dedicated Proposal Page (with Right-Hand Governance & Review Panel and no Left Drafts Sidebar)
          // is shown whenever ANY proposal is opened from Approved Proposals, Review Hub, Dashboard, Monitor,
          // Admin Settings, Notification Bell, a direct URL link, or "Open Full Approved Page" in the Workspace.
          const isDedicatedApprovedPage = returnFromFormView !== null;

          const proposalByIdMap = new Map(proposals.map((p) => [p.id, p]));
          const customOrderedProposals =
            customNavigableIds && customNavigableIds.length > 0
              ? customNavigableIds
                  .map((id) => proposalByIdMap.get(id))
                  .filter((p): p is Proposal => Boolean(p))
              : [];

          const fallbackNavigableProposals =
            returnFromFormView === 'approved' || returnFromFormView === 'builder'
              ? proposals.filter(
                  (p) => p.status === 'approved' || Boolean(p.unionApproval?.actionNumber)
                )
              : proposals;

          const effectiveNavList =
            customOrderedProposals.length > 0
              ? customOrderedProposals
              : fallbackNavigableProposals.length > 0
              ? fallbackNavigableProposals
              : proposals;

          const handleCopyDirectProposalLink = () => {
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('proposal', activeProposal.id);
              navigator.clipboard.writeText(url.toString());
              setCopiedProposalLink(true);
              setTimeout(() => setCopiedProposalLink(false), 2500);
            } catch {
              // ignore clipboard error
            }
          };

          const effectiveBackTarget:
            | 'hub'
            | 'approved'
            | 'dashboard'
            | 'monitor'
            | 'settings'
            | 'builder'
            | null = returnFromFormView;

          const backTargetLabel =
            effectiveBackTarget === 'builder'
              ? 'My Proposals & Drafts'
              : effectiveBackTarget === 'approved'
              ? 'Approved Proposals'
              : effectiveBackTarget === 'dashboard'
              ? 'OneVoice Dashboard'
              : effectiveBackTarget === 'monitor'
              ? 'Executive Monitor'
              : effectiveBackTarget === 'settings'
              ? 'Admin Settings'
              : 'Review Hub';

          const handleSubmitActiveProposal = async () => {
            if (!currentUser?.email) {
              setIsAuthModalOpen(true);
              return;
            }
            const validation = validateProposalForSubmission(activeProposal);
            if (!validation.isValid) {
              setValidationErrors(validation.errors);
              setValidationCompletion(validation.completionPercentage);
              setIsValidationModalOpen(true);
              return;
            }

            // Prepare fully updated submitted proposal with full author metadata and audit event
            const submittedCandidate: Proposal = {
              ...activeProposal,
              userId: activeProposal.userId || currentUser.uid,
              userName: activeProposal.userName || currentUser.displayName,
              userEmail: activeProposal.userEmail || currentUser.email,
              union: activeProposal.union || currentUser.union,
              status: 'submitted',
              updatedAt: new Date().toISOString(),
            };
            const submittedProposal: Proposal = appendActivityToProposal(
              submittedCandidate,
              'submitted',
              currentUser,
              'Proposal submitted for committee review',
              {
                prevStatus: activeProposal.status,
                newStatus: 'submitted',
              }
            );

            // Clear any pending debounced timers
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = null;
            }
            pendingSaveRef.current = null;

            // 1. Immediately update React state and local storage
            setProposals((prev) =>
              prev.map((item) =>
                item.id === submittedProposal.id ? submittedProposal : item
              )
            );
            safePersistProposalsToLocalStorage(
              proposals.map((item) =>
                item.id === submittedProposal.id ? submittedProposal : item
              )
            );

            // 2. Persist the FULL proposal to Firestore FIRST before sending notifications
            setLastSavedText('Submitting...');
            if (auth.currentUser) {
              try {
                await saveProposalToFirestore(submittedProposal);
                setLastSavedText('Cloud Synced');
              } catch (err) {
                console.error(
                  'Error saving proposal to Firestore before notification:',
                  err
                );
                setLastSavedText('Saved Locally');
              }
            }

            // 3. Dispatch in-app notification to Treasurers & Coordinators now that proposal is in Firestore
            await notifyProposalEvent({
              event: 'submit',
              proposal: submittedProposal,
              actor: currentUser,
            });
          };

          return (
            <main className="flex-1 max-w-[1440px] w-full mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
                {/* Left Sidebar (Desktop Docked) — Always stays visible in the Proposals Workspace so creators never lose their list of drafts */}
                {!isDedicatedApprovedPage && (
                  <div className="hidden lg:block shrink-0">
                    <Sidebar
                      proposals={proposals}
                      activeProposalId={activeProposal.id}
                      currentUser={currentUser}
                      onSelectProposal={(id) => setActiveProposalId(id)}
                      onNewProposal={handleNewProposal}
                      onDeleteProposal={handleDeleteProposal}
                      onDuplicateProposal={handleDuplicateProposal}
                      onOpenAuth={() => setIsAuthModalOpen(true)}
                      selectedUnionFilter={reviewHubUnionFilter}
                      onUnionFilterChange={setReviewHubUnionFilter}
                    />
                  </div>
                )}

                {/* Mobile Proposal Quick Bar (< lg: visible on mobile & tablet in the Proposals Workspace) */}
                {!isDedicatedApprovedPage && (
                  <div className="w-full lg:hidden flex flex-col gap-2">
                    <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1c398e] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                            Active Proposal
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                              activeProposal.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : activeProposal.status === 'under_review'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : activeProposal.status === 'submitted'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {activeProposal.status === 'under_review'
                              ? 'Under Review'
                              : activeProposal.status === 'submitted'
                              ? 'Submitted'
                              : activeProposal.status === 'approved'
                              ? 'Approved'
                              : 'Draft'}
                          </span>
                          {activeProposal.union && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              · {UNION_ACRONYMS[activeProposal.union] || activeProposal.union}
                            </span>
                          )}
                        </div>
                        <h2
                          className="text-sm font-bold text-slate-800 truncate"
                          title={activeProposal.title}
                        >
                          {(activeProposal.title || '').trim() || 'Untitled proposal'}
                        </h2>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsMobileProposalDrawerOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition active:scale-95 cursor-pointer"
                          title="Switch proposal"
                        >
                          <Layers className="w-3.5 h-3.5 text-[#1c398e]" />
                          <span className="hidden xs:inline">Switch</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        </button>

                        <button
                          type="button"
                          onClick={handleNewProposal}
                          className="p-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white transition active:scale-95 cursor-pointer"
                          title="Create new proposal"
                          aria-label="Create new proposal"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Proposal Document, Unified Bottom Step 4 Vote & Review Notes, and Compact Right Governance Sidebar */}
                <ProposalReviewWorkspace
                  proposal={activeProposal}
                  allProposals={proposals}
                  currentUser={currentUser}
                  onChangeActiveProposal={handleUpdateActiveProposal}
                  onUpdateProposal={handleUpdateProposal}
                  onOpenFaqTopic={handleOpenFaqTopic}
                  onOpenAuth={() => setIsAuthModalOpen(true)}
                  onOpenPrint={() => {
                    if (!currentUser?.email) {
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setIsPrintModalOpen(true);
                  }}
                  onCopyDirectLink={handleCopyDirectProposalLink}
                  copiedLink={copiedProposalLink}
                  onSubmitProposal={handleSubmitActiveProposal}
                  onShowValidation={(errors, completionPercentage) => {
                    setValidationErrors(errors);
                    setValidationCompletion(completionPercentage);
                    setIsValidationModalOpen(true);
                  }}
                  onOpenTransferProposal={(p) => setProposalToTransfer(p)}
                  isDedicatedApprovedPage={isDedicatedApprovedPage}
                  onOpenDedicatedApprovedPage={() => {
                    setCustomNavigableIds(null);
                    setReturnFromFormView('builder');
                  }}
                  focusTarget={proposalFocusTarget}
                  onClearFocusTarget={() => setProposalFocusTarget(null)}
                  backTargetLabel={
                    effectiveBackTarget === 'builder' ||
                    (effectiveBackTarget &&
                      (userCanAccessHub ||
                        (effectiveBackTarget === 'dashboard' && userCanAccessDashboard)))
                      ? backTargetLabel
                      : null
                  }
                  onBack={
                    effectiveBackTarget === 'builder'
                      ? () => {
                          flushPendingSave();
                          setReturnFromFormView(null);
                          setCustomNavigableIds(null);
                        }
                      : effectiveBackTarget &&
                        (userCanAccessHub ||
                          (effectiveBackTarget === 'dashboard' && userCanAccessDashboard))
                      ? () => {
                          flushPendingSave();
                          setCurrentView(effectiveBackTarget);
                        }
                      : undefined
                  }
                  navigableProposals={effectiveNavList}
                  onSelectProposal={(id) => {
                    flushPendingSave();
                    setActiveProposalId(id);
                  }}
                  onOpenLiaisonGuide={() => setIsLiaisonGuideOpen(true)}
                />
              </div>
            </main>
          );
        })()
      )}

      {/* Mobile Slide-Over Proposals Drawer (< lg) */}
      {isMobileProposalDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-start">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsMobileProposalDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-full max-w-sm sm:max-w-md bg-[#f8f9fa] h-full shadow-2xl z-10 p-4 overflow-y-auto flex flex-col animate-in slide-in-from-left duration-200">
            <Sidebar
              proposals={proposals}
              activeProposalId={activeProposal.id}
              currentUser={currentUser}
              onSelectProposal={(id) => {
                setActiveProposalId(id);
                setIsMobileProposalDrawerOpen(false);
              }}
              onNewProposal={() => {
                handleNewProposal();
                setIsMobileProposalDrawerOpen(false);
              }}
              onDeleteProposal={handleDeleteProposal}
              onDuplicateProposal={handleDuplicateProposal}
              onCloseMobileDrawer={() => setIsMobileProposalDrawerOpen(false)}
              isMobileDrawer={true}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              selectedUnionFilter={reviewHubUnionFilter}
              onUnionFilterChange={setReviewHubUnionFilter}
            />
          </div>
        </div>
      )}

      {/* Welcome / User Profile Modal */}
      {isWelcomeModalOpen && !isStakeholderView && (
        <React.Suspense fallback={null}>
          <WelcomeModal
            isOpen={isWelcomeModalOpen}
            onClose={() => setIsWelcomeModalOpen(false)}
            profile={userProfile}
            onSave={handleSaveProfile}
            canDismiss={hasCompletedOnboarding}
          />
        </React.Suspense>
      )}

      {/* Printable Preview / PDF Export Modal */}
      {isPrintModalOpen && (
        <React.Suspense fallback={null}>
          <PrintProposalModal
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
            proposal={activeProposal}
            userProfile={userProfile}
            allProposals={proposals}
            currentUser={currentUser}
          />
        </React.Suspense>
      )}

      {/* 1-Click Printable 4-Page Division Liaison Walkthrough Guide */}
      {isLiaisonGuideOpen && (
        <React.Suspense fallback={null}>
          <LiaisonWalkthroughGuideModal
            isOpen={isLiaisonGuideOpen}
            onClose={() => setIsLiaisonGuideOpen(false)}
          />
        </React.Suspense>
      )}

      {/* FAQ Guidance Modal */}
      {isFaqModalOpen && (
        <React.Suspense fallback={null}>
          <FAQModal
            isOpen={isFaqModalOpen}
            onClose={() => setIsFaqModalOpen(false)}
            initialTopic={faqTopic}
          />
        </React.Suspense>
      )}

      {/* Auth & Role Switcher Modal */}
      {isAuthModalOpen && (
        <React.Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => {
              setPendingGoogleAuthUser(null);
              setIsAuthModalOpen(false);
            }}
            initialPendingGoogleUser={pendingGoogleAuthUser}
            currentUser={currentUser}
            onUpdateUser={(updated: UserAccount) => {
              setPendingGoogleAuthUser(null);
              setCurrentUser(updated);
              safeSetStorageItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(updated));

              // Route Division Liaisons straight to Approved (Step 4 voting queue), other leadership to Monitor, authors to Proposal Board (unless a ?proposal= link is open)
              if (getProposalIdFromUrl()) {
                setCurrentView('form');
              } else if (updated.role === 'division_liaison') {
                setCurrentView('approved');
              } else if (isHubRole(updated.role)) {
                setCurrentView('monitor');
              } else {
                setCurrentView('form');
              }

              // Update active proposal author & contact info if currently empty or guest
              setProposals((allProposals) => {
                return allProposals.map((p) => {
                  if (p.id === activeProposalId) {
                    const needsContactName = !p.pointOfContact?.name || p.pointOfContact.name === 'Adventist Director';
                    const needsContactEmail = !p.pointOfContact?.email;
                    const needsUnion = !p.union;
                    return {
                      ...p,
                      userId: updated.uid,
                      userName: updated.displayName,
                      userEmail: updated.email,
                      union: needsUnion ? updated.union : p.union,
                      pointOfContact: {
                        name: needsContactName ? updated.displayName : (p.pointOfContact?.name || ''),
                        email: needsContactEmail ? updated.email : (p.pointOfContact?.email || ''),
                        phone: p.pointOfContact?.phone || '',
                      },
                      updatedAt: new Date().toISOString(),
                    };
                  }
                  return p;
                });
              });
            }}
            onSignOut={handleSignOut}
            onSimulateRole={handleSimulateRole}
            isSimulated={isSimulatedRole}
          />
        </React.Suspense>
      )}


      {/* Submission Validation Modal */}
      {isValidationModalOpen && (
        <React.Suspense fallback={null}>
          <ValidationModal
            isOpen={isValidationModalOpen}
            onClose={() => setIsValidationModalOpen(false)}
            errors={validationErrors}
            completionPercentage={validationCompletion}
            onJumpToField={(sectionId: string) => {
              setIsValidationModalOpen(false);
              setTimeout(() => {
                const el = document.getElementById(sectionId);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50/50');
                  setTimeout(() => {
                    el.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/50');
                  }, 2200);
                }
              }, 150);
            }}
          />
        </React.Suspense>
      )}

      {/* In-App Proposal Deletion Confirmation Modal */}
      {proposalToDelete && (
        <React.Suspense fallback={null}>
          <DeleteProposalModal
            isOpen={!!proposalToDelete}
            onClose={() => {
              if (!isDeletingProposal) {
                setProposalToDelete(null);
              }
            }}
            onConfirm={handleConfirmDeleteProposal}
            proposal={proposalToDelete}
            isDeleting={isDeletingProposal}
          />
        </React.Suspense>
      )}

      {/* Super Admin Proposal Ownership Transfer Modal */}
      {proposalToTransfer && (
        <React.Suspense fallback={null}>
          <TransferOwnershipModal
            isOpen={Boolean(proposalToTransfer)}
            onClose={() => setProposalToTransfer(null)}
            proposal={proposalToTransfer}
            currentUser={currentUser}
            onTransferSuccess={(updated: Proposal) => {
              const logged = appendActivityToProposal(
                updated,
                'transferred',
                currentUser,
                `Ownership transferred to ${updated.userName} (${updated.userEmail})`,
                {
                  transferredToEmail: updated.userEmail,
                  transferredToName: updated.userName,
                }
              );
              handleUpdateProposal(logged.id, logged);
              setProposalToTransfer(null);
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
}
