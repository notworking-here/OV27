import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Settings,
  ShieldCheck,
  Search,
  RefreshCw,
  Check,
  DollarSign,
  Building2,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  HelpCircle,
  Save,
  Filter,
  BarChart3,
  UserPlus,
  Shield,
  User,
  Mail,
  Handshake,
  Edit2,
  Trash2,
  Briefcase,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Globe,
  Eye,
} from 'lucide-react';
import { ActivityLogStream } from './admin/ActivityLogStream';
import { GcApiInstructionsPanel } from './admin/GcApiInstructionsPanel';
import { EmailNotificationsPanel } from './admin/EmailNotificationsPanel';
import {
  UserAccount,
  UserRole,
  Proposal,
  UNION_CATEGORIES,
  ALL_INSTITUTION_CATEGORIES,
  UNIONS,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getAllTerritorialUnions,
  getUserVotingUnions,
  getUserInviteeUnions,
  getUserAllUnions,
} from '../types';
import {
  fetchAllUsers,
  updateUserRoleAndUnion,
  updateUserAccountDetails,
  deleteUserAccount,
  provisionNewUserAccount,
  bulkProvisionUserAccounts,
  fetchBudgetAllocationDetails,
  saveBudgetAllocations,
  deleteProposalFromFirestore,
} from '../services/proposalService';
import { parseBulkUserInput, formatCurrency } from '../utils/userUtils';
import { isZeroDataProposal } from '../utils/validation';
import {
  getUnionPoolFormula,
  computeAllProposalsFundingAttribution,
  formatAttributionPct,
  OFFICIAL_GRAND_TOTAL_BY_UNION,
} from '../utils/fundingAttribution';

export interface AdminSettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  currentAdminUid: string;
  currentAdminEmail?: string;
  currentAdminName?: string;
  proposals?: Proposal[];
  initialTab?: 'budget' | 'roles' | 'logs' | 'api' | 'email';
  onSelectProposal?: (proposalId: string) => void;
  onProposalsBatchUpdated?: (updatedProposals: Proposal[]) => void;
  isFullPageView?: boolean;
}

export function AdminSettingsModal({
  isOpen = true,
  onClose,
  currentAdminUid,
  currentAdminEmail,
  currentAdminName,
  proposals = [],
  initialTab = 'budget',
  onSelectProposal,
  onProposalsBatchUpdated,
  isFullPageView = false,
}: AdminSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'budget' | 'roles' | 'logs' | 'api' | 'email'>(
    initialTab || 'budget'
  );

  // Budget Allocation State (Division Allocation & Entity Matching Pledge)
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [matchingPledges, setMatchingPledges] = useState<Record<string, number>>({});
  const latestAllocationsRef = React.useRef<Record<string, number>>({});
  const latestMatchingPledgesRef = React.useRef<Record<string, number>>({});
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetSearch, setBudgetSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [budgetSuccessMsg, setBudgetSuccessMsg] = useState<string | null>(null);

  // Abandoned Zero-Data Drafts Cleanup State
  const [isCleaningDrafts, setIsCleaningDrafts] = useState(false);
  const [cleanedDraftsMsg, setCleanedDraftsMsg] = useState<string | null>(null);

  const abandonedDrafts = useMemo(() => {
    return proposals.filter(isZeroDataProposal);
  }, [proposals]);

  const handlePurgeAbandonedDrafts = async () => {
    if (abandonedDrafts.length === 0) {
      setCleanedDraftsMsg('Database is clean: 0 abandoned drafts detected.');
      setTimeout(() => setCleanedDraftsMsg(null), 3000);
      return;
    }
    setIsCleaningDrafts(true);
    try {
      await Promise.all(abandonedDrafts.map((p) => deleteProposalFromFirestore(p.id)));
      setCleanedDraftsMsg(
        `Successfully purged ${abandonedDrafts.length} empty draft${
          abandonedDrafts.length === 1 ? '' : 's'
        } from cloud database.`
      );
      setTimeout(() => setCleanedDraftsMsg(null), 4000);
    } catch (err) {
      console.warn('Notice purging drafts:', err);
    } finally {
      setIsCleaningDrafts(false);
    }
  };

  // User Management State
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesSearch, setRolesSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'coordinator' | 'division_liaison' | 'user'>('all');
  const [rolesUnionFilter, setRolesUnionFilter] = useState<string>('all');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [rolesSuccessMsg, setRolesSuccessMsg] = useState<string | null>(null);
  const [rolesErrorMsg, setRolesErrorMsg] = useState<string | null>(null);

  // User Title Inline Edit State
  const [inlineEditingUid, setInlineEditingUid] = useState<string | null>(null);
  const [inlineTitleValue, setInlineTitleValue] = useState<string>('');

  // Dedicated Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editFormName, setEditFormName] = useState('');
  const [editFormTitle, setEditFormTitle] = useState('');
  const [editFormDept, setEditFormDept] = useState('');
  const [editFormUnion, setEditFormUnion] = useState('');
  const [editFormAssignedUnions, setEditFormAssignedUnions] = useState<string[]>([]);
  const [editFormInviteeUnions, setEditFormInviteeUnions] = useState<string[]>([]);
  const [editFormInviteeAllUnions, setEditFormInviteeAllUnions] = useState<boolean>(false);
  const [editFormIsLiaison, setEditFormIsLiaison] = useState<boolean>(false);
  const [editFormLiaisonVotingUnions, setEditFormLiaisonVotingUnions] = useState<string[]>([]);
  const [editFormRole, setEditFormRole] = useState<UserRole>('user');
  const [isSavingUserEdit, setIsSavingUserEdit] = useState(false);

  // User Deletion Confirmation Modal State
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Add User State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addUserTab, setAddUserTab] = useState<'single' | 'bulk'>('single');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserTitle, setNewUserTitle] = useState('');
  const [newUserUnion, setNewUserUnion] = useState(UNIONS[0]);
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);

  // Bulk Import State
  const [bulkInputText, setBulkInputText] = useState('');
  const [bulkDefaultUnion, setBulkDefaultUnion] = useState(UNIONS[0]);
  const [bulkDefaultRole, setBulkDefaultRole] = useState<UserRole>('user');

  const bulkParsedPreview = useMemo(() => {
    return parseBulkUserInput(bulkInputText, bulkDefaultUnion, bulkDefaultRole);
  }, [bulkInputText, bulkDefaultUnion, bulkDefaultRole]);

  const hasLoadedAllocationsRef = React.useRef(false);
  const hasLoadedUsersRef = React.useRef(false);

  // Sync tab with initialTab when opening
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
    if (!isOpen) {
      hasLoadedAllocationsRef.current = false;
      hasLoadedUsersRef.current = false;
    }
  }, [isOpen, initialTab]);

  // Lazy-load tab-specific Firestore resources only when needed
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'budget' && !hasLoadedAllocationsRef.current) {
      hasLoadedAllocationsRef.current = true;
      loadAllocations();
    } else if (activeTab === 'roles' && !hasLoadedUsersRef.current) {
      hasLoadedUsersRef.current = true;
      loadUsers();
    }
  }, [isOpen, activeTab]);

  // Load Budget Allocations & Matching Pledges
  const loadAllocations = async () => {
    setBudgetLoading(true);
    try {
      const data = await fetchBudgetAllocationDetails();
      const loadedAlloc = data.allocations || {};
      const loadedMatch = data.matchingPledges || {};
      setAllocations(loadedAlloc);
      setMatchingPledges(loadedMatch);
      latestAllocationsRef.current = loadedAlloc;
      latestMatchingPledgesRef.current = loadedMatch;
    } catch (err) {
      console.warn('Could not load budget allocations:', err);
    } finally {
      setBudgetLoading(false);
    }
  };

  // Load Users for Roles tab
  const DEFAULT_ADMIN_USERS: UserAccount[] = [
    {
      uid: 'admin_astanyer',
      displayName: 'Anthony Stanyer',
      email: 'astanyer@adventist.asia',
      role: 'super_admin',
      union: 'Southern Asia-Pacific Division',
      department: 'Communication & Hope Channel',
      institution: 'Southern Asia-Pacific Division (SSD Headquarters)',
    },
  ];

  const loadUsers = async (isManualSync = false) => {
    setRolesLoading(true);
    setRolesErrorMsg(null);
    try {
      const list = await fetchAllUsers(isManualSync);
      if (list && list.length > 0) {
        setUsers(list);
        if (isManualSync) {
          setRolesSuccessMsg(`Directory synchronized: Verified ${list.length} accounts across database, proposals, and local registry.`);
          setTimeout(() => setRolesSuccessMsg(null), 4000);
        }
      } else {
        setUsers(DEFAULT_ADMIN_USERS);
      }
    } catch (e) {
      console.warn('Notice loading users directory:', e);
      setUsers(DEFAULT_ADMIN_USERS);
      setRolesErrorMsg('Notice: Working in resilient directory mode. Accounts remain editable.');
    } finally {
      setRolesLoading(false);
    }
  };

  // Handle Add New User
  const handleAddNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setRolesErrorMsg('Please fill in both full name and email address.');
      return;
    }

    setIsSubmittingNewUser(true);
    setRolesErrorMsg(null);

    try {
      const created = await provisionNewUserAccount({
        displayName: newUserName.trim(),
        email: newUserEmail.trim(),
        union: newUserUnion,
        role: newUserRole,
        title: newUserTitle.trim() || (newUserRole === 'super_admin' ? 'Division Admin' : 'Director'),
      });

      setUsers((prev) => {
        const withoutOld = prev.filter((u) => u.email.toLowerCase() !== created.email.toLowerCase());
        return [created, ...withoutOld];
      });

      setRolesSuccessMsg(`Account for "${created.displayName}" (${created.email}) added to database successfully.`);
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserTitle('');
      setTimeout(() => setRolesSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to provision user:', err);
      setRolesErrorMsg('Could not save user to database. Please verify credentials.');
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  // Bulk import users
  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkParsedPreview.length === 0) {
      setRolesErrorMsg('Please paste at least one valid email address or user line.');
      return;
    }

    setIsSubmittingNewUser(true);
    setRolesErrorMsg(null);

    try {
      const result = await bulkProvisionUserAccounts(bulkParsedPreview);
      await loadUsers();
      setRolesSuccessMsg(
        `Bulk import complete: Provisioned ${result.added} new accounts and updated ${result.updated} accounts.`
      );
      setShowAddUserModal(false);
      setBulkInputText('');
      setTimeout(() => setRolesSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Failed to bulk import users:', err);
      setRolesErrorMsg('Could not complete bulk import. Please check connection and try again.');
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  // Auto-save debounce ref
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Direct Save handler (always saves latest data)
  const handleSaveBudget = async (
    customAllocations?: Record<string, number>,
    customMatching?: Record<string, number>
  ) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setIsSavingBudget(true);
    setBudgetSuccessMsg(null);
    try {
      const targetAlloc = customAllocations || latestAllocationsRef.current || allocations;
      const targetMatch = customMatching || latestMatchingPledgesRef.current || matchingPledges;
      await saveBudgetAllocations(
        targetAlloc,
        currentAdminEmail || currentAdminUid,
        targetMatch
      );
      setBudgetSuccessMsg('Allocations and entity matching pledges saved and synced.');
      setTimeout(() => setBudgetSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Failed to save budget allocations:', err);
    } finally {
      setIsSavingBudget(false);
    }
  };

  const debouncedSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSaveBudget(latestAllocationsRef.current, latestMatchingPledgesRef.current);
    }, 600);
  };

  // Update Division budget allocation for a single union
  const handleUpdateAllocation = (union: string, amount: number) => {
    const cleanAmount = Math.max(0, isNaN(amount) ? 0 : amount);
    const nextAlloc = {
      ...latestAllocationsRef.current,
      ...allocations,
      [union]: cleanAmount,
    };
    latestAllocationsRef.current = nextAlloc;
    setAllocations(nextAlloc);
    debouncedSave();
  };

  // Update Entity matching pledge for a single union
  const handleUpdateMatchingPledge = (union: string, amount: number) => {
    const cleanAmount = Math.max(0, isNaN(amount) ? 0 : amount);
    const nextMatch = {
      ...latestMatchingPledgesRef.current,
      ...matchingPledges,
      [union]: cleanAmount,
    };
    latestMatchingPledgesRef.current = nextMatch;
    setMatchingPledges(nextMatch);
    debouncedSave();
  };

  // Calculate proposals demand per union with canonical mapping
  const unionProposalsStats = useMemo(() => {
    const map: Record<
      string,
      {
        count: number;
        totalRequested: number;
        approved: number;
        pipeline: number;
        draft: number;
      }
    > = {};
    for (const union of UNIONS) {
      map[union] = { count: 0, totalRequested: 0, approved: 0, pipeline: 0, draft: 0 };
    }

    for (const p of proposals) {
      const canonical = getCanonicalUnion(p.union);
      if (!canonical) continue;
      if (!map[canonical]) {
        map[canonical] = { count: 0, totalRequested: 0, approved: 0, pipeline: 0, draft: 0 };
      }
      map[canonical].count += 1;
      const pBudget = (p.budgetItems || []).reduce(
        (acc, item) => acc + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      );
      const status = p.status || 'draft';
      if (status === 'approved') {
        map[canonical].approved += pBudget;
        map[canonical].totalRequested += pBudget;
      } else if (status === 'submitted' || status === 'under_review') {
        map[canonical].pipeline += pBudget;
        map[canonical].totalRequested += pBudget;
      } else {
        map[canonical].draft += pBudget;
        // Drafts are not added to totalRequested
      }
    }

    return map;
  }, [proposals]);

  // Aggregate stats across recognized unions
  const totalAllocatedAcrossAllUnions = useMemo(() => {
    return UNIONS.reduce((sum, u) => sum + (Number(allocations[u]) || 0), 0);
  }, [allocations]);

  const totalMatchingPledgedAcrossAllUnions = useMemo(() => {
    return UNIONS.reduce((sum, u) => sum + (Number(matchingPledges[u]) || 0), 0);
  }, [matchingPledges]);

  const { totalGcPoolAcrossAllUnions, totalSsdPoolAcrossAllUnions, totalSpdPoolAcrossAllUnions } =
    useMemo(() => {
      let gcSum = 0;
      let ssdSum = 0;
      let spdSum = 0;
      for (const u of UNIONS) {
        const f = getUnionPoolFormula(u, allocations, matchingPledges);
        gcSum += f.gcPool;
        ssdSum += f.ssdPool;
        spdSum += f.spdPool;
      }
      return {
        totalGcPoolAcrossAllUnions: gcSum,
        totalSsdPoolAcrossAllUnions: ssdSum,
        totalSpdPoolAcrossAllUnions: spdSum,
      };
    }, [allocations, matchingPledges]);

  const unionFundingAttribution = useMemo(() => {
    return computeAllProposalsFundingAttribution(proposals, allocations, matchingPledges);
  }, [proposals, allocations, matchingPledges]);

  const grandTotalCombinedBudgetPool = totalAllocatedAcrossAllUnions + totalMatchingPledgedAcrossAllUnions;

  const totalRequestedAcrossAllProposals = useMemo(() => {
    return proposals.reduce((sum, p) => {
      const status = p.status || 'draft';
      // Only count active proposals (approved or in review pipeline)
      if (status === 'draft') return sum;
      const pTotal = (p.budgetItems || []).reduce(
        (acc, item) => acc + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      );
      return sum + pTotal;
    }, 0);
  }, [proposals]);

  const allocatedUnionsCount = useMemo(() => {
    return UNIONS.filter((u) => Number(allocations[u]) > 0).length;
  }, [allocations]);

  const matchingUnionsCount = useMemo(() => {
    return UNIONS.filter((u) => Number(matchingPledges[u]) > 0).length;
  }, [matchingPledges]);

  const overallUtilizationPercent = useMemo(() => {
    if (grandTotalCombinedBudgetPool <= 0) return 0;
    return Math.min(
      999,
      Math.round((totalRequestedAcrossAllProposals / grandTotalCombinedBudgetPool) * 100)
    );
  }, [totalRequestedAcrossAllProposals, grandTotalCombinedBudgetPool]);

  // Handle Role Changes
  const handleRoleChange = async (targetUid: string, newRole: UserRole, currentUnion: string) => {
    setUpdatingUid(targetUid);
    setRolesSuccessMsg(null);
    const targetUser = users.find((u) => u.uid === targetUid);
    const extraUpdates: Partial<UserAccount> = {
      ...(targetUser?.email ? { email: targetUser.email } : {}),
    };
    let effectiveUnion = currentUnion;

    if (newRole === 'super_admin' && targetUser?.role === 'division_liaison') {
      const carriedVotingUnions = getUserVotingUnions(targetUser);
      extraUpdates.isLiaison = carriedVotingUnions.length > 0;
      extraUpdates.liaisonVotingUnions = carriedVotingUnions;
    } else if (newRole === 'division_liaison' && targetUser?.role !== 'division_liaison') {
      effectiveUnion = 'Southern Asia-Pacific Division (SSD Headquarters)';
      if (targetUser?.role === 'super_admin' && targetUser.isLiaison) {
        extraUpdates.assignedUnions = getUserVotingUnions(targetUser);
      }
      extraUpdates.isLiaison = false;
      extraUpdates.liaisonVotingUnions = [];
    } else if (newRole !== 'super_admin') {
      extraUpdates.isLiaison = false;
      extraUpdates.liaisonVotingUnions = [];
    }

    try {
      await updateUserRoleAndUnion(targetUid, newRole, effectiveUnion, extraUpdates);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === targetUid ? { ...u, role: newRole, union: effectiveUnion, ...extraUpdates } : u
        )
      );
      setRolesSuccessMsg('User role updated successfully');
      setTimeout(() => setRolesSuccessMsg(null), 3000);
    } catch (e) {
      console.error('Error updating user role:', e);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleUnionChange = async (
    targetUid: string,
    currentRole: UserRole,
    newUnion: string
  ) => {
    setUpdatingUid(targetUid);
    setRolesSuccessMsg(null);
    const targetUser = users.find((u) => u.uid === targetUid);
    try {
      await updateUserRoleAndUnion(
        targetUid,
        currentRole,
        newUnion,
        targetUser?.email ? { email: targetUser.email } : undefined
      );
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, union: newUnion } : u))
      );
      setRolesSuccessMsg('Union assignment updated');
      setTimeout(() => setRolesSuccessMsg(null), 3000);
    } catch (e) {
      console.error('Error updating union:', e);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Inline Title Edit Handlers
  const handleStartInlineEdit = (user: UserAccount) => {
    setInlineEditingUid(user.uid);
    setInlineTitleValue(user.title || 'Director');
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingUid(null);
    setInlineTitleValue('');
  };

  const handleSaveInlineTitle = async (targetUid: string) => {
    if (!inlineTitleValue.trim()) {
      handleCancelInlineEdit();
      return;
    }
    const cleanTitle = inlineTitleValue.trim();
    const targetUser = users.find((u) => u.uid === targetUid);
    setUpdatingUid(targetUid);
    setRolesSuccessMsg(null);
    try {
      await updateUserAccountDetails(targetUid, {
        title: cleanTitle,
        ...(targetUser?.email ? { email: targetUser.email } : {}),
      });
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, title: cleanTitle } : u))
      );
      setRolesSuccessMsg(`Office title updated to "${cleanTitle}".`);
      setInlineEditingUid(null);
      setTimeout(() => setRolesSuccessMsg(null), 3000);
    } catch (e) {
      console.error('Error updating title:', e);
      setRolesErrorMsg('Failed to update office title.');
    } finally {
      setUpdatingUid(null);
    }
  };

  // Dedicated Edit User Modal Handlers
  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setEditFormName(user.displayName);
    setEditFormTitle(user.title || 'Director');
    setEditFormDept(user.department || 'Media & Communication');
    setEditFormUnion(user.union);
    if (user.role === 'division_liaison') {
      setEditFormAssignedUnions(getUserVotingUnions(user));
      setEditFormInviteeUnions(
        Array.from(new Set((user.inviteeUnions || []).map(getCanonicalUnion).filter(Boolean)))
      );
      setEditFormInviteeAllUnions(Boolean(user.inviteeAllUnions));
      setEditFormIsLiaison(false);
      setEditFormLiaisonVotingUnions([]);
    } else if (user.role === 'super_admin') {
      setEditFormAssignedUnions(user.assignedUnions || []);
      setEditFormInviteeUnions([]);
      setEditFormInviteeAllUnions(false);
      setEditFormIsLiaison(Boolean(user.isLiaison));
      setEditFormLiaisonVotingUnions(getUserVotingUnions(user));
    } else {
      setEditFormAssignedUnions(user.assignedUnions || []);
      setEditFormInviteeUnions([]);
      setEditFormInviteeAllUnions(false);
      setEditFormIsLiaison(false);
      setEditFormLiaisonVotingUnions([]);
    }
    setEditFormRole(user.role);
    setRolesErrorMsg(null);
  };

  const handleSaveUserModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editFormName.trim()) {
      setRolesErrorMsg('Full name cannot be blank.');
      return;
    }
    setIsSavingUserEdit(true);
    setRolesErrorMsg(null);
    try {
      let updates: Partial<UserAccount>;
      if (editFormRole === 'division_liaison') {
        const votingUnions = Array.from(
          new Set(editFormAssignedUnions.map(getCanonicalUnion).filter(Boolean))
        );
        const inviteeUnions = Array.from(
          new Set(
            editFormInviteeUnions
              .map(getCanonicalUnion)
              .filter((u) => Boolean(u) && !votingUnions.includes(u))
          )
        );
        updates = {
          displayName: editFormName.trim(),
          title: editFormTitle.trim() || 'Director',
          department: editFormDept.trim() || 'Media & Communication',
          union: 'Southern Asia-Pacific Division (SSD Headquarters)',
          assignedUnions: votingUnions,
          inviteeUnions,
          inviteeAllUnions: editFormInviteeAllUnions,
          isLiaison: false,
          liaisonVotingUnions: [],
          role: editFormRole,
          institution: 'Southern Asia-Pacific Division (SSD Headquarters)',
          unionConfirmed: true,
        };
      } else if (editFormRole === 'super_admin') {
        const cleanAssignedUnions = editFormAssignedUnions.filter(
          (u) => u && u !== editFormUnion
        );
        const cleanLiaisonVotingUnions = editFormIsLiaison
          ? Array.from(
              new Set(editFormLiaisonVotingUnions.map(getCanonicalUnion).filter(Boolean))
            )
          : [];
        if (editFormIsLiaison && cleanLiaisonVotingUnions.length === 0) {
          setRolesErrorMsg(
            'Please select at least one Union under "Assigned Step 4 Voting Unions", or turn off Step 4 Liaison Voting Power.'
          );
          setIsSavingUserEdit(false);
          return;
        }
        updates = {
          email: editingUser.email,
          displayName: editFormName.trim(),
          title: editFormTitle.trim() || 'Director',
          department: editFormDept.trim() || 'Media & Communication',
          union: editFormUnion,
          assignedUnions: cleanAssignedUnions,
          inviteeUnions: [],
          inviteeAllUnions: false,
          isLiaison: editFormIsLiaison,
          liaisonVotingUnions: cleanLiaisonVotingUnions,
          role: editFormRole,
          institution: editFormUnion,
          unionConfirmed: true,
        };
      } else {
        const cleanAssignedUnions = editFormAssignedUnions.filter(
          (u) => u && u !== editFormUnion
        );
        updates = {
          email: editingUser.email,
          displayName: editFormName.trim(),
          title: editFormTitle.trim() || 'Director',
          department: editFormDept.trim() || 'Media & Communication',
          union: editFormUnion,
          assignedUnions: cleanAssignedUnions,
          inviteeUnions: [],
          inviteeAllUnions: false,
          isLiaison: false,
          liaisonVotingUnions: [],
          role: editFormRole,
          institution: editFormUnion,
          unionConfirmed: true,
        };
      }
      if (editFormRole === 'division_liaison') {
        updates.email = editingUser.email;
      }
      await updateUserAccountDetails(editingUser.uid, updates);
      setUsers((prev) =>
        prev.map((u) => (u.uid === editingUser.uid ? { ...u, ...updates } : u))
      );
      setRolesSuccessMsg(`Account for "${updates.displayName}" updated successfully.`);
      setEditingUser(null);
      setTimeout(() => setRolesSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error saving user profile in modal:', err);
      setRolesErrorMsg('Failed to save user updates.');
    } finally {
      setIsSavingUserEdit(false);
    }
  };

  // User Deletion Handlers
  const handlePromptDeleteUser = (user: UserAccount) => {
    setDeletingUser(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    setRolesErrorMsg(null);
    try {
      await deleteUserAccount(deletingUser.uid, deletingUser.email);
      setUsers((prev) =>
        prev.filter(
          (u) =>
            u.uid !== deletingUser.uid &&
            u.email.toLowerCase() !== deletingUser.email.toLowerCase()
        )
      );
      setRolesSuccessMsg(
        `User account "${deletingUser.displayName}" (${deletingUser.email}) has been permanently deleted.`
      );
      setDeletingUser(null);
      if (editingUser?.uid === deletingUser.uid) {
        setEditingUser(null);
      }
      setTimeout(() => setRolesSuccessMsg(null), 4000);
    } catch (err: unknown) {
      console.error('Failed to delete user:', err);
      setRolesErrorMsg(
        err instanceof Error ? err.message : 'Could not delete user account.'
      );
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Filtered Unions
  const filteredUnionCategories = useMemo(() => {
    const q = budgetSearch.toLowerCase().trim();
    return UNION_CATEGORIES.map((cat) => {
      if (categoryFilter !== 'all' && cat.category !== categoryFilter) {
        return { ...cat, unions: [] };
      }
      const matchedUnions = cat.unions.filter((u) => {
        if (!q) return true;
        const acronym = UNION_ACRONYMS[u] || '';
        return (
          u.toLowerCase().includes(q) ||
          acronym.toLowerCase().includes(q) ||
          cat.category.toLowerCase().includes(q)
        );
      });
      return { ...cat, unions: matchedUnions };
    }).filter((cat) => cat.unions.length > 0);
  }, [budgetSearch, categoryFilter]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const q = rolesSearch.toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter !== 'all') {
        const matchesDivisionCoordAndLiaisonAdmin =
          roleFilter === 'division_liaison' && u.role === 'super_admin' && Boolean(u.isLiaison);
        if (u.role !== roleFilter && !matchesDivisionCoordAndLiaisonAdmin) {
          return false;
        }
      }
      if (rolesUnionFilter !== 'all') {
        const canonFilter = getCanonicalUnion(rolesUnionFilter);
        const matchesPrimary = u.union === rolesUnionFilter || getCanonicalUnion(u.union) === canonFilter;
        const matchesAssigned = getUserAllUnions(u).includes(canonFilter);
        const matchesLiaisonVoting = getUserVotingUnions(u).includes(canonFilter);
        if (!matchesPrimary && !matchesAssigned && !matchesLiaisonVoting) {
          return false;
        }
      }
      if (!q) return true;
      const acronym = UNION_ACRONYMS[u.union || ''] || '';
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.title && u.title.toLowerCase().includes(q)) ||
        (u.union || '').toLowerCase().includes(q) ||
        acronym.toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    });
  }, [users, rolesSearch, roleFilter, rolesUnionFilter]);

  if (!isOpen) return null;

  const content = (
    <div
      className={`w-full bg-white rounded-3xl overflow-hidden flex flex-col ${
        isFullPageView
          ? 'border border-slate-200/90 shadow-2xs'
          : 'relative max-w-6xl shadow-2xl border border-slate-100 max-h-[92vh]'
      }`}
    >
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-[#fbfcfd] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shadow-2xs">
            <Settings className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>General Settings</span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                Division Admin
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Configure union budget ceilings, manage user access roles, and audit activity logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          {/* Tabs Selector */}
          <div className="inline-flex items-center gap-2">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('budget')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'budget'
                    ? 'bg-white text-blue-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Budget Allocation</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('roles')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-white text-amber-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Manage Roles</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-white text-indigo-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Audit Trail & Activity</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('api')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'api'
                    ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>GC API &amp; Instructions</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'email'
                    ? 'bg-white text-blue-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Email Alerts</span>
              </button>
            </div>
          </div>

          {/* Close or Exit Button */}
          {onClose && (
            isFullPageView ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                title="Return to Review Hub"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Exit Settings</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Close settings"
              >
                <X className="w-5 h-5" />
              </button>
            )
          )}
        </div>
      </div>

      {/* Tab 1: Budget Allocation */}
      {activeTab === 'budget' && (
        <div className={`flex-1 flex flex-col ${isFullPageView ? '' : 'overflow-y-auto'}`}>
            {/* Prominent Top Summary Card: Total Allocated Across All Unions */}
            <div className="p-6 bg-gradient-to-br from-slate-900 via-[#182747] to-[#1a365d] text-white border-b border-slate-800">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    <span>Total Combined OneVoice27 Budget Pool (100%)</span>
                    <span
                      className="inline-flex items-center text-slate-400 hover:text-white cursor-help"
                      title="Each Union's Total Pool (100%) combines GC + SSD + SPD + Union Contribution. Approved proposals draw down proportionally from that Union's 4-entity pool until depleted; any excess over the pool is 100% Union deficit."
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 mt-1 flex-wrap tabular-nums">
                    <span className="text-3xl md:text-4xl font-black tracking-tight text-white">
                      US${formatCurrency(grandTotalCombinedBudgetPool)}
                    </span>
                    <span className="text-xs text-blue-200 font-medium">
                      SSD US${formatCurrency(totalSsdPoolAcrossAllUnions)} · GC US${formatCurrency(totalGcPoolAcrossAllUnions)} · SPD US${formatCurrency(totalSpdPoolAcrossAllUnions)} · Union US${formatCurrency(totalMatchingPledgedAcrossAllUnions)}
                    </span>
                  </div>
                </div>

                {/* Sub KPI Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                  <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15">
                    <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                      GC Appropriation
                    </div>
                    <div className="text-base font-black text-amber-300 mt-0.5 tabular-nums">
                      US${totalGcPoolAcrossAllUnions.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      {grandTotalCombinedBudgetPool > 0
                        ? formatAttributionPct((totalGcPoolAcrossAllUnions / grandTotalCombinedBudgetPool) * 100)
                        : '0%'}{' '}
                      of total pool
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15">
                    <div className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
                      SSD + SPD Pool
                    </div>
                    <div className="text-base font-black text-blue-300 mt-0.5 tabular-nums">
                      US${(totalSsdPoolAcrossAllUnions + totalSpdPoolAcrossAllUnions).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      SSD ${formatCurrency(totalSsdPoolAcrossAllUnions)} · SPD ${formatCurrency(totalSpdPoolAcrossAllUnions)}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15">
                    <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider flex items-center gap-1">
                      <Handshake className="w-3 h-3 text-emerald-400" />
                      <span>Union Contribution</span>
                    </div>
                    <div className="text-base font-black text-emerald-300 mt-0.5 tabular-nums">
                      US${totalMatchingPledgedAcrossAllUnions.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      {matchingUnionsCount} union pledges
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15">
                    <div className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                      Proposals Demand
                    </div>
                    <div className="text-base font-black text-white mt-0.5 tabular-nums">
                      US${totalRequestedAcrossAllProposals.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      {overallUtilizationPercent}% of pool utilized
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Toolbar */}
            <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center flex-wrap gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter unions by name or acronym (e.g., ECPUC, Indonesia)..."
                    value={budgetSearch}
                    onChange={(e) => setBudgetSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 shadow-2xs"
                  />
                  {budgetSearch && (
                    <button
                      type="button"
                      onClick={() => setBudgetSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg font-medium cursor-pointer transition ${
                      categoryFilter === 'all'
                        ? 'bg-blue-900 text-white font-bold shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    All ({UNIONS.length})
                  </button>
                  {UNION_CATEGORIES.map((cat) => (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setCategoryFilter(cat.category)}
                      className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition ${
                        categoryFilter === cat.category
                          ? 'bg-blue-900 text-white font-bold shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cat.category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status and Manual Save Button */}
              <div className="flex items-center gap-2">
                {budgetSuccessMsg && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold animate-in fade-in">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{budgetSuccessMsg}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveBudget()}
                  disabled={isSavingBudget}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Save className={`w-3.5 h-3.5 ${isSavingBudget ? 'animate-spin' : ''}`} />
                  <span>{isSavingBudget ? 'Saving...' : 'Save Allocations'}</span>
                </button>
              </div>
            </div>

            {/* Union Allocations List */}
            <div className="p-6 space-y-6">
              {budgetLoading ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#2a4d9c]" />
                  <span>Loading union budget allocations...</span>
                </div>
              ) : filteredUnionCategories.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No unions found matching your search.
                </div>
              ) : (
                filteredUnionCategories.map((catGroup) => (
                  <div key={catGroup.category} className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          {catGroup.category}
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-100">
                          {catGroup.unions.length} entities
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                        <span>
                          Division Subtotal:{' '}
                          <strong className="text-slate-900">
                            US$
                            {catGroup.unions
                              .reduce((sum, u) => sum + (allocations[u] || 0), 0)
                              .toLocaleString()}
                          </strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Entity Matching:{' '}
                          <strong className="text-emerald-700">
                            US$
                            {catGroup.unions
                              .reduce((sum, u) => sum + (matchingPledges[u] || 0), 0)
                              .toLocaleString()}
                          </strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Total Pool:{' '}
                          <strong className="text-indigo-900">
                            US$
                            {catGroup.unions
                              .reduce(
                                (sum, u) =>
                                  sum +
                                  (allocations[u] || 0) +
                                  (matchingPledges[u] || 0),
                                0
                              )
                              .toLocaleString()}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {catGroup.unions.map((unionName) => {
                        const allocatedVal = allocations[unionName] || 0;
                        const matchingVal = matchingPledges[unionName] || 0;
                        const poolFormula = getUnionPoolFormula(unionName, allocations, matchingPledges);
                        const unionSummary = unionFundingAttribution.byUnion[unionName];
                        const totalEntityPool = poolFormula.totalPool;
                        const acronym = UNION_ACRONYMS[unionName];
                        const stats = unionProposalsStats[unionName] || {
                          count: 0,
                          totalRequested: 0,
                          approved: 0,
                          pipeline: 0,
                          draft: 0,
                        };
                        const isOverBudget =
                          totalEntityPool > 0 && stats.totalRequested > totalEntityPool;
                        const usageRatio =
                          totalEntityPool > 0
                            ? Math.round((stats.totalRequested / totalEntityPool) * 100)
                            : 0;

                        return (
                          <div
                            key={unionName}
                            className={`p-4 rounded-2xl border transition bg-white shadow-2xs hover:shadow-xs space-y-3 ${
                              isOverBudget
                                ? 'border-rose-200 bg-rose-50/20'
                                : totalEntityPool > 0
                                ? 'border-blue-100 hover:border-blue-200'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              {/* Left Info */}
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {acronym && (
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-extrabold border border-slate-200/80">
                                      {acronym}
                                    </span>
                                  )}
                                  <h5 className="text-sm font-bold text-slate-900 truncate">
                                    {unionName}
                                  </h5>
                                  {poolFormula.distributionPct > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1c398e] border border-blue-200 text-[10px] font-bold">
                                      Base Dist: {poolFormula.distributionPct.toFixed(2)}%
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                  <span>
                                    Proposals: <strong>{stats.count}</strong>
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span>
                                    Approved:{' '}
                                    <strong className="text-emerald-700">
                                      US${(stats.approved || 0).toLocaleString()}
                                    </strong>
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span>
                                    Total Requested:{' '}
                                    <strong
                                      className={
                                        stats.totalRequested > 0
                                          ? 'text-blue-700'
                                          : 'text-slate-600'
                                      }
                                    >
                                      US${stats.totalRequested.toLocaleString()}
                                    </strong>
                                  </span>

                                  {totalEntityPool > 0 && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <span
                                        className={`font-semibold ${
                                          isOverBudget
                                            ? 'text-rose-600'
                                            : usageRatio > 80
                                            ? 'text-amber-600'
                                            : 'text-emerald-700'
                                        }`}
                                      >
                                        {usageRatio}% utilized
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Progress bar if allocated */}
                                {totalEntityPool > 0 && (
                                  <div className="w-full max-w-md bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        isOverBudget
                                          ? 'bg-rose-500'
                                          : usageRatio > 80
                                          ? 'bg-amber-500'
                                          : 'bg-blue-600'
                                      }`}
                                      style={{ width: `${Math.min(100, usageRatio)}%` }}
                                    ></div>
                                  </div>
                                )}
                              </div>

                              {/* Right Allocation & Entity Matching Inputs */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                                {/* Allocated Amount Input Field */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      GC+SSD+SPD Base (USD)
                                    </label>
                                    {allocatedVal !== (OFFICIAL_GRAND_TOTAL_BY_UNION[unionName] || 0) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateAllocation(
                                            unionName,
                                            OFFICIAL_GRAND_TOTAL_BY_UNION[unionName] || 0
                                          )
                                        }
                                        className="text-[10px] text-blue-600 hover:text-blue-800 transition cursor-pointer font-semibold"
                                        title="Restore official spreadsheet base allocation"
                                      >
                                        Restore Default
                                      </button>
                                    )}
                                  </div>
                                  <div className="relative min-w-[155px]">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                                      US$
                                    </div>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1000"
                                      placeholder="0"
                                      value={allocatedVal || ''}
                                      onChange={(e) =>
                                        handleUpdateAllocation(
                                          unionName,
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="w-full pl-10 pr-3.5 py-2 text-right rounded-xl bg-white border-2 border-blue-200 hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-xs font-bold text-slate-800 outline-none transition"
                                    />
                                  </div>
                                </div>

                                {/* Union Pledge Input */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                                      <Handshake className="w-3 h-3 text-emerald-600" />
                                      <span>Union Contribution (USD)</span>
                                    </label>
                                    {matchingVal > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateMatchingPledge(unionName, 0)}
                                        className="text-[10px] text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                        title="Reset Union Contribution to $0"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  <div className="relative min-w-[155px]">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600/70 text-xs font-bold">
                                      US$
                                    </div>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1000"
                                      placeholder="0"
                                      value={matchingVal || ''}
                                      onChange={(e) =>
                                        handleUpdateMatchingPledge(
                                          unionName,
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="w-full pl-10 pr-3.5 py-2 text-right rounded-xl bg-white border-2 border-emerald-200 hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-xs font-bold text-slate-800 outline-none transition"
                                    />
                                  </div>
                                </div>

                                {/* Combined Total Pool for Entity (100%) */}
                                <div className="space-y-1 self-start sm:self-end">
                                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    100% Total Pool
                                  </span>
                                  <div className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-right min-w-[130px]">
                                    <span className="text-xs font-black tabular-nums">
                                      US${totalEntityPool.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 4-Entity Pool Formula Breakdown Bar (GC % + SSD % + SPD % + Union % = 100% Pool) */}
                            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                                  Pool Formula (100%):
                                </span>

                                {/* GC Share */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold tabular-nums">
                                  <span>GC:</span>
                                  <span>${poolFormula.gcPool.toLocaleString()}</span>
                                  <span className="text-amber-700 font-extrabold">
                                    ({formatAttributionPct(poolFormula.gcPoolPct)})
                                  </span>
                                </span>

                                {/* SSD Share */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-[#1c398e] font-bold tabular-nums">
                                  <span>SSD:</span>
                                  <span>${poolFormula.ssdPool.toLocaleString()}</span>
                                  <span className="text-blue-700 font-extrabold">
                                    ({formatAttributionPct(poolFormula.ssdPoolPct)})
                                  </span>
                                </span>

                                {/* SPD Share */}
                                {poolFormula.spdPool > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 font-bold tabular-nums">
                                    <span>SPD:</span>
                                    <span>${poolFormula.spdPool.toLocaleString()}</span>
                                    <span className="text-purple-700 font-extrabold">
                                      ({formatAttributionPct(poolFormula.spdPoolPct)})
                                    </span>
                                  </span>
                                )}

                                {/* Union Share */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold tabular-nums ${
                                    poolFormula.unionPledgePool > 0
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-500'
                                  }`}
                                >
                                  <span>Union:</span>
                                  <span>${poolFormula.unionPledgePool.toLocaleString()}</span>
                                  <span className="font-extrabold">
                                    ({formatAttributionPct(poolFormula.unionPoolPct)})
                                  </span>
                                </span>
                              </div>

                              {/* Pool Depletion / Deficit Status from Approved Proposals */}
                              {unionSummary && unionSummary.approvedCount > 0 && (
                                <div className="flex items-center gap-2 text-[11px] font-semibold">
                                  {unionSummary.isOverPool ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 font-bold tabular-nums">
                                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                                      <span>
                                        Pool Depleted · Union Deficit: +$
                                        {unionSummary.overPoolDeficitAmount.toLocaleString()}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 tabular-nums">
                                      Pool Remaining:{' '}
                                      <strong className="text-emerald-700">
                                        US${unionSummary.poolRemainingAmount.toLocaleString()}
                                      </strong>{' '}
                                      (GC Rem: ${unionSummary.gcRemaining.toLocaleString()})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 mt-auto">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-slate-800">
                  GC/SSD Allocated:{' '}
                  <strong className="text-blue-700">
                    US${totalAllocatedAcrossAllUnions.toLocaleString()}
                  </strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-800">
                  Union Pledged:{' '}
                  <strong className="text-emerald-700">
                    US${totalMatchingPledgedAcrossAllUnions.toLocaleString()}
                  </strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-slate-900">
                  Total Combined Pool:{' '}
                  <strong className="text-indigo-800">
                    US${grandTotalCombinedBudgetPool.toLocaleString()}
                  </strong>
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">Auto-saved to Cloud & Local Cache</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {cleanedDraftsMsg && (
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg animate-in fade-in">
                    {cleanedDraftsMsg}
                  </span>
                )}

                <button
                  type="button"
                  onClick={handlePurgeAbandonedDrafts}
                  disabled={isCleaningDrafts}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Purge ghost drafts that contain zero title, overview, or budget data"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {isCleaningDrafts
                      ? 'Purging...'
                      : abandonedDrafts.length > 0
                      ? `Purge Empty Drafts (${abandonedDrafts.length})`
                      : 'Database Clean (0 Empty Drafts)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-2xs transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Manage Roles */}
        {activeTab === 'roles' && (
          <div className={`flex-1 flex flex-col ${isFullPageView ? '' : 'overflow-y-auto'}`}>
            {/* Roles Toolbar & Search */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, union, or role..."
                    value={rolesSearch}
                    onChange={(e) => setRolesSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#2a4d9c] hover:bg-[#1f3a7a] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add / Register User</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadUsers(true)}
                    disabled={rolesLoading}
                    title="Scan and synchronize Firestore database, proposals, and local accounts"
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${rolesLoading ? 'animate-spin' : ''}`} />
                    <span>Sync Directory</span>
                  </button>
                </div>
              </div>

              {/* Filter Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-slate-400" />
                    Role:
                  </span>
                  {(
                    [
                      { id: 'all', label: `All (${users.length})` },
                      { id: 'super_admin', label: `Division Admin (${users.filter((u) => u.role === 'super_admin').length})` },
                      { id: 'division_liaison', label: `Div Coord (${users.filter((u) => u.role === 'division_liaison').length})` },
                      { id: 'coordinator', label: `Union Coord (${users.filter((u) => u.role === 'coordinator' || u.role === 'treasurer').length})` },
                      { id: 'user', label: `Users (${users.filter((u) => u.role === 'user').length})` },
                    ] as const
                  ).map((rf) => (
                    <button
                      key={rf.id}
                      type="button"
                      onClick={() => setRoleFilter(rf.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                        roleFilter === rf.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      {rf.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-semibold text-slate-500">Union Filter:</span>
                  <select
                    value={rolesUnionFilter}
                    onChange={(e) => setRolesUnionFilter(e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="all">All Union Territories</option>
                    {ALL_INSTITUTION_CATEGORIES.map((cat) => (
                      <optgroup key={cat.category} label={cat.category}>
                        {cat.unions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Helpful Context Guide Banner */}
            <div className="mx-6 mt-4 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs text-blue-950 flex items-start gap-3 shadow-2xs">
              <div className="w-5 h-5 rounded-md bg-[#2a4d9c] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                i
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-blue-900 flex items-center gap-2">
                  <span>How to ensure all signed up accounts appear here</span>
                </div>
                <div className="text-[11px] text-blue-800 leading-relaxed space-y-0.5">
                  <p>• <strong>Automatic Sync:</strong> When any team member logs into the app on their device, their profile automatically registers into this central directory.</p>
                  <p>• <strong>Sync Existing Database:</strong> Click <strong>Sync Directory</strong> to pull from the live Firestore database and auto-import anyone who submitted proposals.</p>
                  <p>• <strong>Instant Provisioning:</strong> Click <strong>Add / Register User</strong> to add single accounts or paste an entire list of emails/names all at once.</p>
                </div>
              </div>
            </div>

            {/* Error and Success alerts */}
            {rolesErrorMsg && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{rolesErrorMsg}</span>
              </div>
            )}

            {rolesSuccessMsg && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{rolesSuccessMsg}</span>
              </div>
            )}

            {/* Modal: Add / Register New User (Single & Bulk) */}
            {showAddUserModal && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
                <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#2a4d9c] flex items-center justify-center font-bold">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Provision User Accounts</h3>
                        <p className="text-[11px] text-slate-500">Add accounts to the live Firestore directory and assign roles</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mode Tabs */}
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAddUserTab('single')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        addUserTab === 'single'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Single Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddUserTab('bulk')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        addUserTab === 'bulk'
                          ? 'bg-white text-[#2a4d9c] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Bulk Import / Paste List</span>
                      {bulkParsedPreview.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-[#2a4d9c] text-[10px] font-bold">
                          {bulkParsedPreview.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {addUserTab === 'single' ? (
                    <form onSubmit={handleAddNewUser} className="space-y-3.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Full Official Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Pastor Samuel Reyes"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Official Adventist or Organization Email *
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. sreyes@adventist.asia"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Official Office Title / Designation
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Communication Director, Union Treasurer, Hope Channel Lead"
                          value={newUserTitle}
                          onChange={(e) => setNewUserTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Assigned Union *
                          </label>
                          <select
                            value={newUserUnion}
                            onChange={(e) => setNewUserUnion(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none focus:border-blue-500 bg-white"
                          >
                            {ALL_INSTITUTION_CATEGORIES.map((cat) => (
                              <optgroup key={cat.category} label={cat.category}>
                                {cat.unions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            System Role *
                          </label>
                          <select
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none focus:border-blue-500 bg-white font-semibold"
                          >
                            <option value="user">User / Author (Proposal Board)</option>
                            <option value="coordinator">Union Coordinator / Treasurer (Review Hub)</option>
                            <option value="division_liaison">Division Coordinator (Review Hub &amp; Oversight)</option>
                            <option value="super_admin">Division Admin (Review Hub &amp; Settings)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddUserModal(false)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingNewUser}
                          className="px-4 py-2 rounded-xl bg-[#2a4d9c] hover:bg-[#1f3a7a] text-white font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          {isSubmittingNewUser ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Provisioning...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Save & Provision Account</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleBulkImport} className="space-y-3.5 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
                        <p className="font-semibold text-slate-800 mb-1">Supported Paste Formats (one per line):</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600 font-mono text-[10px]">
                          <li>email@adventist.asia</li>
                          <li>Full Name, email@adventist.asia</li>
                          <li>email@adventist.asia, Full Name</li>
                          <li>Full Name, email@adventist.asia, Union Name, coordinator</li>
                        </ul>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Default Union (if unspecified in text)
                          </label>
                          <select
                            value={bulkDefaultUnion}
                            onChange={(e) => setBulkDefaultUnion(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-900 outline-none focus:border-blue-500 bg-white text-xs"
                          >
                            {ALL_INSTITUTION_CATEGORIES.map((cat) => (
                              <optgroup key={cat.category} label={cat.category}>
                                {cat.unions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Default Role (if unspecified in text)
                          </label>
                          <select
                            value={bulkDefaultRole}
                            onChange={(e) => setBulkDefaultRole(e.target.value as UserRole)}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-900 outline-none focus:border-blue-500 bg-white font-semibold text-xs"
                          >
                            <option value="user">User / Proposal Author</option>
                            <option value="coordinator">Union Coordinator</option>
                            <option value="division_liaison">Division Coordinator</option>
                            <option value="super_admin">Division Admin</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Paste User List / Emails *
                          </label>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            bulkParsedPreview.length > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {bulkParsedPreview.length} valid account{bulkParsedPreview.length === 1 ? '' : 's'} detected
                          </span>
                        </div>
                        <textarea
                          rows={6}
                          required
                          value={bulkInputText}
                          onChange={(e) => setBulkInputText(e.target.value)}
                          placeholder={"pastor.john@adventist.asia, Pastor John, Central Philippine Union Conference, coordinator\nsarah.lee@adventist.org, Sarah Lee\nmichael@adventist.asia"}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 font-mono text-xs leading-relaxed"
                        />
                      </div>

                      {/* Live Preview of parsed accounts */}
                      {bulkParsedPreview.length > 0 && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                          <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            Ready to Import Preview ({bulkParsedPreview.length})
                          </div>
                          <div className="divide-y divide-slate-100 bg-white">
                            {bulkParsedPreview.map((item, idx) => (
                              <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">{item.displayName}</div>
                                  <div className="text-[11px] text-slate-500 font-mono truncate">{item.email}</div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                    {UNION_ACRONYMS[item.union] || item.union}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                                    item.role === 'super_admin'
                                      ? 'bg-amber-100 text-amber-800'
                                      : item.role === 'coordinator'
                                      ? 'bg-blue-100 text-[#2a4d9c]'
                                      : item.role === 'division_liaison'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {item.role === 'super_admin'
                                      ? 'Division Admin'
                                      : item.role === 'coordinator'
                                      ? 'Coordinator'
                                      : item.role === 'division_liaison'
                                      ? 'Division Coordinator'
                                      : 'User'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddUserModal(false)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingNewUser || bulkParsedPreview.length === 0}
                          className="px-4 py-2 rounded-xl bg-[#2a4d9c] hover:bg-[#1f3a7a] disabled:bg-slate-300 text-white font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          {isSubmittingNewUser ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Importing {bulkParsedPreview.length} Accounts...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Import & Provision {bulkParsedPreview.length} Account{bulkParsedPreview.length === 1 ? '' : 's'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Modal: Dedicated Edit User Profile & Role */}
            {editingUser && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#2a4d9c] flex items-center justify-center font-bold">
                        <Edit2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Edit User Account</h3>
                        <p className="text-[11px] text-slate-500 font-mono">{editingUser.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveUserModal} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFormName}
                        onChange={(e) => setEditFormName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Official Office Title / Designation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Communication Director, Union Treasurer, Hope Channel Lead"
                        value={editFormTitle}
                        onChange={(e) => setEditFormTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Department / Ministry
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Media & Communication"
                        value={editFormDept}
                        onChange={(e) => setEditFormDept(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {editFormRole === 'division_liaison' ? (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Administrative Home
                          </label>
                          <div className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium truncate">
                            Southern Asia-Pacific Division (SSD HQ)
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Assigned Union Territory
                          </label>
                          <select
                            value={editFormUnion}
                            onChange={(e) => setEditFormUnion(e.target.value)}
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none focus:border-blue-500 bg-white"
                          >
                            {ALL_INSTITUTION_CATEGORIES.map((cat) => (
                              <optgroup key={cat.category} label={cat.category}>
                                {cat.unions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          System Role
                        </label>
                        <select
                          value={editFormRole}
                          disabled={
                            editingUser.uid === currentAdminUid ||
                            Boolean(currentAdminEmail && editingUser.email.toLowerCase() === currentAdminEmail.toLowerCase())
                          }
                          onChange={(e) => {
                            const nextRole = e.target.value as UserRole;
                            if (nextRole === 'division_liaison' && editFormRole !== 'division_liaison') {
                              const canonCurrent = getCanonicalUnion(editFormUnion);
                              const seedFromAdminLiaison =
                                editFormRole === 'super_admin' && editFormIsLiaison
                                  ? editFormLiaisonVotingUnions
                                  : [];
                              setEditFormAssignedUnions((prev) =>
                                Array.from(
                                  new Set(
                                    [
                                      ...prev.map(getCanonicalUnion),
                                      ...seedFromAdminLiaison.map(getCanonicalUnion),
                                      ...(canonCurrent && getAllTerritorialUnions().includes(canonCurrent)
                                        ? [canonCurrent]
                                        : []),
                                    ].filter(Boolean)
                                  )
                                )
                              );
                            } else if (nextRole === 'super_admin' && editFormRole === 'division_liaison') {
                              if (editFormAssignedUnions.length > 0) {
                                setEditFormIsLiaison(true);
                                setEditFormLiaisonVotingUnions(
                                  Array.from(
                                    new Set(editFormAssignedUnions.map(getCanonicalUnion).filter(Boolean))
                                  )
                                );
                              }
                            } else if (nextRole !== 'division_liaison' && editFormRole === 'division_liaison') {
                              if (
                                (!editFormUnion || editFormUnion.toLowerCase().includes('division')) &&
                                editFormAssignedUnions.length > 0
                              ) {
                                setEditFormUnion(editFormAssignedUnions[0]);
                              }
                            }
                            setEditFormRole(nextRole);
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-slate-900 outline-none focus:border-blue-500 bg-white font-semibold"
                        >
                          <option value="super_admin">Division Admin</option>
                          <option value="coordinator">Union Coord / Treasurer</option>
                          <option value="division_liaison">Division Coordinator</option>
                          <option value="user">User</option>
                        </select>
                      </div>
                    </div>

                    {/* Territory Matrix: 2-Tier Voting vs Invitee Selector for Division Coordinators, or Multi-Entity Checkboxes for other roles */}
                    {editFormRole === 'division_liaison' ? (
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        {(() => {
                          const allTerritorial = getAllTerritorialUnions();
                          const votingSet = new Set(
                            editFormAssignedUnions.map(getCanonicalUnion).filter(Boolean)
                          );
                          const explicitInviteeSet = new Set(
                            editFormInviteeUnions
                              .map(getCanonicalUnion)
                              .filter((u) => Boolean(u) && !votingSet.has(u))
                          );
                          const effectiveInviteeCount = editFormInviteeAllUnions
                            ? allTerritorial.filter((u) => !votingSet.has(u)).length
                            : explicitInviteeSet.size;

                          const handleSetUnionMode = (
                            unionName: string,
                            mode: 'none' | 'invitee' | 'voting'
                          ) => {
                            const canon = getCanonicalUnion(unionName);
                            if (!canon) return;

                            if (mode === 'voting') {
                              setEditFormAssignedUnions((prev) =>
                                Array.from(new Set([...prev.map(getCanonicalUnion).filter(Boolean), canon]))
                              );
                              setEditFormInviteeUnions((prev) =>
                                prev.map(getCanonicalUnion).filter((item) => item && item !== canon)
                              );
                            } else if (mode === 'invitee') {
                              setEditFormAssignedUnions((prev) =>
                                prev.map(getCanonicalUnion).filter((item) => item && item !== canon)
                              );
                              if (!editFormInviteeAllUnions) {
                                setEditFormInviteeUnions((prev) =>
                                  Array.from(new Set([...prev.map(getCanonicalUnion).filter(Boolean), canon]))
                                );
                              }
                            } else {
                              // mode === 'none'
                              const nextVoting = editFormAssignedUnions
                                .map(getCanonicalUnion)
                                .filter((item) => item && item !== canon);
                              setEditFormAssignedUnions(nextVoting);

                              if (editFormInviteeAllUnions) {
                                // Convert global invitee switch into explicit invitee territories minus this Union
                                const remainingInvitees = allTerritorial.filter(
                                  (u) => u !== canon && !nextVoting.includes(u)
                                );
                                setEditFormInviteeAllUnions(false);
                                setEditFormInviteeUnions(remainingInvitees);
                              } else {
                                setEditFormInviteeUnions((prev) =>
                                  prev.map(getCanonicalUnion).filter((item) => item && item !== canon)
                                );
                              }
                            }
                          };

                          return (
                            <>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-900">
                                    Union Access &amp; Step 4 Voting Power
                                  </label>
                                  <p className="text-[11px] text-slate-500">
                                    Assign formal Step 4 voting territories or read-and-comment Invitee access.
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
                                  <span className="text-indigo-800 font-bold">
                                    {votingSet.size} Voting
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300">
                                    ·
                                  </span>
                                  <span className="text-slate-700">
                                    {effectiveInviteeCount} Invitee
                                  </span>
                                </div>
                              </div>

                              {/* 1-Click Division-Wide Invitee Access Toggle */}
                              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/90">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                    <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                    <span>Division-Wide Invitee Access</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                    View and comment on proposals across all other SSD Unions without Step 4 voting power or quorum impact.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={editFormInviteeAllUnions}
                                  onClick={() => setEditFormInviteeAllUnions((prev) => !prev)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                                    editFormInviteeAllUnions ? 'bg-[#1c398e]' : 'bg-slate-300'
                                  }`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                      editFormInviteeAllUnions ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>

                              {/* Quick Batch Actions for Voting Territories */}
                              <div className="flex items-center justify-between text-[11px] px-0.5">
                                <span className="text-slate-500 font-medium">
                                  Per-Union Access Level (`None` / `Invitee` / `Voting`)
                                </span>
                                <div className="flex items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditFormAssignedUnions(allTerritorial)}
                                    className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                                  >
                                    All Voting
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditFormAssignedUnions([])}
                                    className="text-[10px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                                  >
                                    Clear Voting
                                  </button>
                                </div>
                              </div>

                              {/* Per-Union 3-State Segmented Selector */}
                              <div className="max-h-60 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                                {UNION_CATEGORIES.map((cat) => (
                                  <div key={cat.category} className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 block px-1">
                                      {cat.category}
                                    </span>
                                    <div className="space-y-1">
                                      {cat.unions.map((u) => {
                                        const canonU = getCanonicalUnion(u);
                                        const isVoting = votingSet.has(canonU);
                                        const isInvitee =
                                          !isVoting &&
                                          (editFormInviteeAllUnions || explicitInviteeSet.has(canonU));
                                        const currentMode: 'none' | 'invitee' | 'voting' = isVoting
                                          ? 'voting'
                                          : isInvitee
                                          ? 'invitee'
                                          : 'none';
                                        const acronym = UNION_ACRONYMS[u] || UNION_ACRONYMS[canonU] || '';

                                        return (
                                          <div
                                            key={u}
                                            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition ${
                                              currentMode === 'voting'
                                                ? 'bg-white border-indigo-300 text-slate-900 shadow-2xs'
                                                : currentMode === 'invitee'
                                                ? 'bg-white/90 border-slate-200 text-slate-800'
                                                : 'bg-transparent border-transparent text-slate-500 hover:bg-white/60'
                                            }`}
                                          >
                                            <div className="min-w-0 flex items-center gap-1.5">
                                              {acronym && (
                                                <span className="font-mono text-[10px] font-bold text-slate-500 shrink-0">
                                                  {acronym}
                                                </span>
                                              )}
                                              <span className="truncate text-[11px] font-medium">
                                                {u}
                                              </span>
                                            </div>

                                            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/80 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => handleSetUnionMode(u, 'none')}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                                                  currentMode === 'none'
                                                    ? 'bg-white text-slate-800 shadow-2xs'
                                                    : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                              >
                                                None
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleSetUnionMode(u, 'invitee')}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                                                  currentMode === 'invitee'
                                                    ? 'bg-slate-800 text-white shadow-2xs'
                                                    : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                              >
                                                Invitee
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleSetUnionMode(u, 'voting')}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                                  currentMode === 'voting'
                                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                                    : 'text-slate-500 hover:text-indigo-700'
                                                }`}
                                              >
                                                Voting
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <>
                        {editFormRole === 'super_admin' && (
                          <div className="pt-3 border-t border-slate-100 space-y-3">
                            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/90">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                                  <span>Also Act as Division Liaison (Step 4 Voting Power)</span>
                                </div>
                                <p className="text-[11px] text-indigo-900/80 mt-0.5 leading-relaxed">
                                  Assign specific Unions where this Division Admin holds formal Step 4 Liaison voting power and counts toward quorum (Step 4 voting restricted to selected Unions; Step 5 Admin Override stays division-wide).
                                </p>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={editFormIsLiaison}
                                onClick={() => {
                                  setEditFormIsLiaison((prev) => {
                                    const next = !prev;
                                    if (next && editFormLiaisonVotingUnions.length === 0) {
                                      const canonHome = getCanonicalUnion(editFormUnion);
                                      if (canonHome && getAllTerritorialUnions().includes(canonHome)) {
                                        setEditFormLiaisonVotingUnions([canonHome]);
                                      }
                                    }
                                    return next;
                                  });
                                  setRolesErrorMsg(null);
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                                  editFormIsLiaison ? 'bg-indigo-700' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                    editFormIsLiaison ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {editFormIsLiaison && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-slate-800">
                                    Assigned Step 4 Voting Unions
                                  </span>
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditFormLiaisonVotingUnions(getAllTerritorialUnions())
                                      }
                                      className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                                    >
                                      All Voting
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditFormLiaisonVotingUnions([])}
                                      className="text-[10px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                                    >
                                      Clear
                                    </button>
                                    <span className="text-[10px] text-indigo-800 font-bold tabular-nums">
                                      {editFormLiaisonVotingUnions.length} selected
                                    </span>
                                  </div>
                                </div>

                                <div className="max-h-48 overflow-y-auto p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-2.5">
                                  {UNION_CATEGORIES.map((cat) => (
                                    <div key={cat.category} className="space-y-1">
                                      <span className="text-[10px] font-bold text-slate-500 block px-1">
                                        {cat.category}
                                      </span>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {cat.unions.map((u) => {
                                          const canonU = getCanonicalUnion(u);
                                          const isChecked = editFormLiaisonVotingUnions
                                            .map(getCanonicalUnion)
                                            .includes(canonU);
                                          return (
                                            <label
                                              key={u}
                                              className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition select-none ${
                                                isChecked
                                                  ? 'bg-white border border-indigo-400 text-indigo-950 font-semibold shadow-2xs'
                                                  : 'hover:bg-white text-slate-700 border border-transparent'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setEditFormLiaisonVotingUnions((prev) =>
                                                      Array.from(
                                                        new Set([
                                                          ...prev.map(getCanonicalUnion).filter(Boolean),
                                                          canonU,
                                                        ])
                                                      )
                                                    );
                                                  } else {
                                                    setEditFormLiaisonVotingUnions((prev) =>
                                                      prev
                                                        .map(getCanonicalUnion)
                                                        .filter((item) => item && item !== canonU)
                                                    );
                                                  }
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                              />
                                              <span className="truncate text-[11px]">
                                                {UNION_ACRONYMS[u] ? `[${UNION_ACRONYMS[u]}] ` : ''}
                                                {u}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      {/* Additional Assigned Unions for Production Houses & Multi-Union Entities */}
                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-slate-800">
                            Additional Assigned Unions (Multi-Entity Territories)
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditFormAssignedUnions(getAllTerritorialUnions());
                              }}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                            >
                              Select All (Division-wide)
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditFormAssignedUnions([])}
                              className="text-[10px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                            >
                              Clear
                            </button>
                            <span className="text-[10px] text-blue-700 font-bold tabular-nums">
                              {editFormAssignedUnions.filter((u) => u !== editFormUnion).length} additional
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
                          Assign multiple Union territories to allow this user (e.g. Hope Channel or media production center) to author and monitor proposals across multiple Unions.
                        </p>

                        <div className="max-h-48 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                          {UNION_CATEGORIES.map((cat) => (
                            <div key={cat.category} className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 block px-1">
                                {cat.category}
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {cat.unions.map((u) => {
                                  const isPrimary = u === editFormUnion;
                                  const isChecked = isPrimary || editFormAssignedUnions.includes(u);
                                  return (
                                    <label
                                      key={u}
                                      className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition select-none ${
                                        isPrimary
                                          ? 'bg-blue-100/70 border border-blue-300 text-blue-900 font-bold cursor-not-allowed'
                                          : isChecked
                                          ? 'bg-white border border-blue-400 text-slate-900 font-semibold shadow-2xs'
                                          : 'hover:bg-white text-slate-700 border border-transparent'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={isPrimary}
                                        checked={isChecked}
                                        onChange={(e) => {
                                          if (isPrimary) return;
                                          if (e.target.checked) {
                                            setEditFormAssignedUnions((prev) => [...prev, u]);
                                          } else {
                                            setEditFormAssignedUnions((prev) => prev.filter((item) => item !== u));
                                          }
                                        }}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                      />
                                      <span className="truncate text-[11px]">
                                        {UNION_ACRONYMS[u] ? `[${UNION_ACRONYMS[u]}] ` : ''}
                                        {u}
                                      </span>
                                      {isPrimary && (
                                        <span className="text-[9px] text-blue-700 font-bold ml-auto shrink-0 bg-blue-200/80 px-1.5 py-0.5 rounded">
                                          Primary
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      </>
                    )}

                    {/* Danger Zone: Delete Option in modal */}
                    {!(
                      editingUser.uid === currentAdminUid ||
                      Boolean(currentAdminEmail && editingUser.email.toLowerCase() === currentAdminEmail.toLowerCase()) ||
                      editingUser.email.toLowerCase() === 'astanyer@adventist.asia'
                    ) && (
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Account management</span>
                        <button
                          type="button"
                          onClick={() => {
                            const u = editingUser;
                            setEditingUser(null);
                            handlePromptDeleteUser(u);
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete User...</span>
                        </button>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingUserEdit}
                        className="px-4 py-2 rounded-xl bg-[#2a4d9c] hover:bg-[#1f3a7a] text-white font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        {isSavingUserEdit ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal: Delete User Confirmation */}
            {deletingUser && (
              <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-100 p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Delete User Account?</h3>
                      <p className="text-xs text-slate-500">This action will permanently delete this account.</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold text-[11px]">Name:</span>
                      <span className="font-bold text-slate-900">{deletingUser.displayName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold text-[11px]">Email:</span>
                      <span className="font-mono text-slate-700">{deletingUser.email}</span>
                    </div>
                    {deletingUser.title && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-semibold text-[11px]">Office Title:</span>
                        <span className="font-medium text-slate-800">{deletingUser.title}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold text-[11px]">Union:</span>
                      <span className="font-medium text-slate-800 text-right">{deletingUser.union}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold text-[11px]">Role:</span>
                      <span className="font-semibold text-slate-800 uppercase text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200">
                        {deletingUser.role}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    <p className="font-semibold mb-1">Warning: Irreversible Action</p>
                    <p className="text-[11px] leading-relaxed text-rose-700">
                      This account will be removed from Firestore database records and local directory cache. The user will lose access immediately.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDeletingUser(null)}
                      disabled={isDeletingUser}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteUser}
                      disabled={isDeletingUser}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      {isDeletingUser ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Permanently Delete User</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Users Table Body */}
            <div className="p-6 flex-1">
              <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                <span>
                  Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> registered accounts in database directory
                </span>
                <span className="text-[11px] text-slate-400">
                  Real-time database sync active
                </span>
              </div>

              {rolesLoading && users.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#2a4d9c]" />
                  <span>Loading registered users from directory...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No users found matching your search or filters.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  {filteredUsers.map((u) => {
                    const isSelf = Boolean(
                      u.uid === currentAdminUid ||
                      (currentAdminEmail && u.email.toLowerCase() === currentAdminEmail.toLowerCase())
                    );
                    const isProtected = isSelf || u.email.toLowerCase() === 'astanyer@adventist.asia';
                    const isBusy = updatingUid === u.uid;

                    return (
                      <div
                        key={u.uid}
                        className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white mt-0.5 ${
                            u.role === 'super_admin'
                              ? 'bg-amber-600'
                              : u.role === 'coordinator'
                              ? 'bg-[#2a4d9c]'
                              : u.role === 'division_liaison'
                              ? 'bg-indigo-600'
                              : 'bg-slate-600'
                          }`}>
                            {u.displayName ? u.displayName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {u.displayName}
                              </h4>
                              {isSelf && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-[#2a4d9c]">
                                  Current User
                                </span>
                              )}
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                u.role === 'super_admin'
                                  ? 'bg-amber-100 text-amber-800'
                                  : u.role === 'coordinator'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : u.role === 'division_liaison'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {u.role === 'super_admin'
                                  ? 'Division Admin'
                                  : u.role === 'coordinator'
                                  ? 'Coordinator / Treasurer'
                                  : u.role === 'division_liaison'
                                  ? 'Division Coordinator'
                                  : 'User'}
                              </span>
                              {u.role === 'division_liaison' ? (
                                <span
                                  className="text-[11px] font-medium text-slate-600 tabular-nums"
                                  title={`Voting Unions: ${
                                    getUserVotingUnions(u).map((vu) => UNION_ACRONYMS[vu] || vu).join(', ') || 'None'
                                  } | Invitee Unions: ${
                                    u.inviteeAllUnions
                                      ? 'All other SSD Unions'
                                      : getUserInviteeUnions(u).map((iu) => UNION_ACRONYMS[iu] || iu).join(', ') || 'None'
                                  }`}
                                >
                                  <span className="text-indigo-800 font-bold">
                                    {getUserVotingUnions(u).length} Voting
                                  </span>
                                  <span aria-hidden="true" className="mx-1 text-slate-300">
                                    ·
                                  </span>
                                  <span>
                                    {u.inviteeAllUnions
                                      ? 'Division-Wide Invitee'
                                      : `${getUserInviteeUnions(u).length} Invitee`}
                                  </span>
                                </span>
                              ) : u.role === 'super_admin' && u.isLiaison ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                                    getUserVotingUnions(u).length > 0
                                      ? 'bg-indigo-100 text-indigo-900'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                                  }`}
                                  title={`Liaison Step 4 Voting Unions: ${
                                    getUserVotingUnions(u).map((vu) => UNION_ACRONYMS[vu] || vu).join(', ') || 'None assigned'
                                  }`}
                                >
                                  <span>
                                    {getUserVotingUnions(u).length > 0
                                      ? `Liaison · ${getUserVotingUnions(u).length} Voting`
                                      : 'Liaison · 0 Voting (Assign Union)'}
                                  </span>
                                </span>
                              ) : (
                                u.assignedUnions &&
                                u.assignedUnions.length > 0 && (
                                  <span
                                    className="text-[11px] font-semibold text-blue-800 tabular-nums"
                                    title={`Authorized Territories: ${u.union}, ${u.assignedUnions.join(', ')}`}
                                  >
                                    +{u.assignedUnions.length} Unions
                                  </span>
                                )
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">{u.email}</p>

                            {/* Office Title Display & Inline Quick Edit */}
                            {inlineEditingUid === u.uid ? (
                              <div className="flex items-center gap-1.5 mt-1.5 animate-in fade-in">
                                <div className="relative flex-1 max-w-[260px]">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={inlineTitleValue}
                                    onChange={(e) => setInlineTitleValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveInlineTitle(u.uid);
                                      if (e.key === 'Escape') handleCancelInlineEdit();
                                    }}
                                    placeholder="Official Office Title"
                                    className="w-full text-xs px-2.5 py-1 rounded-lg border border-blue-400 bg-white text-slate-900 outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                  />
                                </div>
                                <button
                                  type="button"
                                  title="Save title"
                                  onClick={() => handleSaveInlineTitle(u.uid)}
                                  className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition shadow-2xs"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Cancel"
                                  onClick={handleCancelInlineEdit}
                                  className="p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartInlineEdit(u)}
                                  title="Click to edit official title"
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-800 text-slate-700 text-[11px] font-medium transition cursor-pointer group border border-slate-200/60"
                                >
                                  <Briefcase className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                                  <span>{u.title || 'Director (Click to set title)'}</span>
                                  <Edit2 className="w-2.5 h-2.5 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-blue-600" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Union Assignment / Territory Configuration */}
                          <div className="min-w-[190px]">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                              {u.role === 'division_liaison' ? (
                                'Voting & Invitee Access'
                              ) : u.role === 'super_admin' && u.isLiaison ? (
                                'Liaison Voting Power'
                              ) : (
                                'Assigned Union Territory'
                              )}
                            </label>
                            {u.role === 'division_liaison' ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleOpenEditModal(u)}
                                className="w-full inline-flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-950 font-semibold transition cursor-pointer"
                              >
                                <span className="truncate tabular-nums">
                                  {getUserVotingUnions(u).length} Voting ·{' '}
                                  {u.inviteeAllUnions
                                    ? 'All Invitee'
                                    : `${getUserInviteeUnions(u).length} Invitee`}
                                </span>
                                <Edit2 className="w-3 h-3 text-indigo-700 shrink-0" />
                              </button>
                            ) : u.role === 'super_admin' && u.isLiaison ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleOpenEditModal(u)}
                                className="w-full inline-flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-950 font-semibold transition cursor-pointer"
                                title={`Step 4 Voting Unions: ${
                                  getUserVotingUnions(u).map((vu) => UNION_ACRONYMS[vu] || vu).join(', ') || 'None'
                                }`}
                              >
                                <span className="truncate tabular-nums">
                                  {getUserVotingUnions(u).length > 0
                                    ? getUserVotingUnions(u)
                                        .map((vu) => UNION_ACRONYMS[vu] || vu)
                                        .join(', ')
                                    : 'Assign Voting Union'}
                                </span>
                                <Edit2 className="w-3 h-3 text-indigo-700 shrink-0" />
                              </button>
                            ) : (
                              <select
                                value={u.union}
                                disabled={isBusy}
                                onChange={(e) => handleUnionChange(u.uid, u.role, e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                              >
                                {ALL_INSTITUTION_CATEGORIES.map((cat) => (
                                  <optgroup key={cat.category} label={cat.category}>
                                    {cat.unions.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Role Selector */}
                          <div className="min-w-[150px]">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                              System Role
                            </label>
                            <select
                              value={u.role}
                              disabled={isBusy || (isSelf && u.role === 'super_admin')}
                              onChange={(e) =>
                                handleRoleChange(u.uid, e.target.value as UserRole, u.union)
                              }
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg font-semibold bg-slate-50 border border-slate-200 text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="super_admin">Division Admin</option>
                              <option value="coordinator">Coord / Treasurer</option>
                              <option value="division_liaison">Division Coordinator</option>
                              <option value="user">User</option>
                            </select>
                          </div>

                          {/* Action Buttons: Edit Modal & Delete */}
                          <div className="flex items-center gap-1.5 pt-3 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(u)}
                              title="Edit user profile and details"
                              className="p-2 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-[#2a4d9c] transition cursor-pointer shrink-0 shadow-2xs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {isProtected ? (
                              <button
                                type="button"
                                disabled
                                title="Protected Administrator (cannot be deleted)"
                                className="p-2 rounded-xl border border-slate-100 text-slate-300 cursor-not-allowed shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePromptDeleteUser(u)}
                                title={`Delete user account ${u.displayName}`}
                                className="p-2 rounded-xl border border-rose-200 hover:border-rose-300 hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition cursor-pointer shrink-0 shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Roles Footer info */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 mt-auto">
              <span>
                <strong>Coordinators</strong> can only review and manage proposals submitted within their
                assigned Union territory.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Division Audit Trail & Activity Logs */}
        {activeTab === 'logs' && (
          <div className={`flex-1 flex flex-col bg-slate-50/50 ${isFullPageView ? '' : 'overflow-y-auto'}`}>
            <div className="p-6">
              <ActivityLogStream
                proposals={proposals}
                onSelectProposal={(id) => {
                  onClose?.();
                  onSelectProposal?.(id);
                }}
              />
            </div>
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 mt-auto">
              <span>
                <strong>Audit Trail</strong> logs all lifecycle mutations (creation, updates, submissions, approvals, reopenings, and deletions) for transparency and diagnosis.
              </span>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer"
                >
                  {isFullPageView ? 'Exit Settings' : 'Close'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: GC External API & Handoff Instructions */}
        {activeTab === 'api' && (
          <div className={`flex-1 flex flex-col bg-slate-50/50 ${isFullPageView ? '' : 'overflow-y-auto'}`}>
            <GcApiInstructionsPanel
              proposals={proposals}
              currentAdminEmail={currentAdminEmail}
              currentAdminUid={currentAdminUid}
              currentAdminName={currentAdminName}
              onProposalsBatchUpdated={onProposalsBatchUpdated}
            />
          </div>
        )}

        {/* Tab 5: Automated Email Notifications */}
        {activeTab === 'email' && (
          <div className={`flex-1 flex flex-col bg-slate-50/50 ${isFullPageView ? '' : 'overflow-y-auto'}`}>
            <EmailNotificationsPanel
              currentAdminEmail={currentAdminEmail}
              currentAdminName={currentAdminName}
            />
          </div>
        )}
      </div>
    );

    if (isFullPageView) {
      return content;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        {content}
      </div>
    );
  }
