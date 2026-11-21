import React, { useState, useEffect, useMemo } from 'react';
import {
  Proposal,
  UserAccount,
  UserRole,
  ProposalReviewNote,
  UnionCommitteeApproval,
  DivisionTreasuryAuthorization,
  LiaisonVote,
  ReviewReadinessRating,
  ReviewCriterionKey,
  REVIEW_READINESS_LABELS,
  UNION_ACRONYMS,
  UNION_CATEGORIES,
  getCanonicalUnion,
  getUserAllUnions,
  getUserVotingUnions,
  isUserLiaisonEligible,
  isUserInviteeForUnion,
  getProposalStepStatus,
  getProposalReviewNotes,
  getProposalActivityLog,
  isDivisionLevelTreasurerOrAdmin,
  canUserManageUnionApproval,
  canUserReopenApprovedProposal,
  canUserVoteStep4Liaison,
  canUserPostProposalNote,
} from '../../types';
import {
  fetchDivisionLiaisons,
  subscribeToLiaisonDirectoryChanges,
} from '../../services/proposalService';
import { auth } from '../../lib/firebase';
import { formatCurrency } from '../../utils/userUtils';
import { validateProposalForSubmission, ValidationError } from '../../utils/validation';
import {
  evaluateProposalReviewFramework,
  buildLiaisonCoachingSummary,
  buildLiaisonActionItems,
  computeReadinessFromDeficientKeys,
  resolveQuestionTargetForInstruction,
  REVIEW_FRAMEWORK_PDF_URL,
} from '../../utils/projectReviewFramework';
import { UnionApprovalModal } from '../UnionApprovalModal';
import { DivisionAuthorizationModal } from '../DivisionAuthorizationModal';
import { ProposalPlausibilityCard } from './ProposalPlausibilityCard';
import { LiaisonReviewController } from './useLiaisonReviewState';
import { LiaisonVoteConfirmModal } from './LiaisonVoteConfirmModal';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  Printer,
  Link2,
  Check,
  Building2,
  Users,
  FileText,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  RotateCcw,
  ArrowRightLeft,
  AlertTriangle,
  AlertCircle,
  Lock,
  LogIn,
  History,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  ClipboardCheck,
  HelpCircle,
  ArrowRight,
  X,
} from 'lucide-react';

export interface ApprovedProposalSidePanelProps {
  proposal: Proposal;
  currentUser: UserAccount;
  onUpdateProposal: (proposalId: string, updates: Partial<Proposal>) => Promise<void> | void;
  onOpenAuth?: () => void;
  onOpenPrint?: () => void;
  onCopyDirectLink?: () => void;
  copiedLink?: boolean;
  onOpenTransferOwnership?: () => void;
  onShowValidation?: (errors: ValidationError[], completionPercentage: number) => void;
  onSubmitProposal?: () => void;
  focusNotes?: boolean;
  onClearFocusNotes?: () => void;
  // Navigation & Switcher props
  backTargetLabel?: string | null;
  onBack?: () => void;
  navigableProposals?: Proposal[];
  onSelectProposal?: (proposalId: string) => void;
  /** Shared liaison review controller (keeps inline alignment flag links, sidebar Step 4 voting, and floating notes chat live-synced) */
  liaisonReview?: LiaisonReviewController;
  onOpenNotesChat?: () => void;
  onOpenLiaisonGuide?: () => void;
}

export function ApprovedProposalSidePanel({
  proposal,
  currentUser,
  onUpdateProposal,
  onOpenAuth,
  onOpenPrint,
  onCopyDirectLink,
  copiedLink = false,
  onOpenTransferOwnership,
  onShowValidation,
  onSubmitProposal,
  focusNotes = false,
  onClearFocusNotes,
  backTargetLabel,
  onBack,
  navigableProposals = [],
  onSelectProposal,
  liaisonReview,
  onOpenNotesChat,
  onOpenLiaisonGuide,
}: ApprovedProposalSidePanelProps) {
  const [directoryUsers, setDirectoryUsers] = useState<UserAccount[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showFullMinutes, setShowFullMinutes] = useState(false);
  const [showGovernanceHistory, setShowGovernanceHistory] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDivisionAuthModalOpen, setIsDivisionAuthModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

  // Step 4 Liaison Vote composer state
  const [liaisonRecommendationText, setLiaisonRecommendationText] = useState('');
  const [isSubmittingLiaisonVote, setIsSubmittingLiaisonVote] = useState(false);
  const [liaisonVoteError, setLiaisonVoteError] = useState<string | null>(null);
  const [isEditingMyVote, setIsEditingMyVote] = useState(false);
  const [showStep4Guide, setShowStep4Guide] = useState(false);
  const [justSavedVoteBanner, setJustSavedVoteBanner] = useState<
    'recommended' | 'revision_requested' | null
  >(null);
  const [expandedRubricDetailKeys, setExpandedRubricDetailKeys] = useState<ReviewCriterionKey[]>(
    []
  );
  const [expandedTipKeys, setExpandedTipKeys] = useState<ReviewCriterionKey[]>([]);
  const [expandedTemplateKeys, setExpandedTemplateKeys] = useState<ReviewCriterionKey[]>([]);
  const [pendingLiaisonConfirmDecision, setPendingLiaisonConfirmDecision] = useState<
    'recommended' | 'revision_requested' | null
  >(null);

  useEffect(() => {
    setPendingLiaisonConfirmDecision(null);
  }, [proposal.id]);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isLiaison = currentUser?.role === 'division_liaison';
  const isProposalApproved =
    proposal.status === 'approved' || Boolean(proposal.unionApproval?.actionNumber);
  const isDivisionAuthorized = Boolean(proposal.divisionApproval?.authorized);
  const canAuthorizeDivision = isDivisionLevelTreasurerOrAdmin(currentUser);
  const canManageStep3 = canUserManageUnionApproval(proposal, currentUser);
  const canReopen = canUserReopenApprovedProposal(proposal, currentUser);
  const canVoteStep4 =
    isProposalApproved &&
    !isDivisionAuthorized &&
    canUserVoteStep4Liaison(proposal, currentUser);
  const canPostNote = canUserPostProposalNote(proposal, currentUser);

  const assignedUnion =
    proposal.union || currentUser?.union || 'East Central Philippine Union Conference';
  const canonicalProposalUnion = getCanonicalUnion(assignedUnion);
  const unionAcronym = UNION_ACRONYMS[canonicalProposalUnion] || assignedUnion || 'SSD';

  const canManageStep2Review = useMemo(() => {
    if (!currentUser?.email) return false;
    if (isDivisionLevelTreasurerOrAdmin(currentUser)) return true;
    if (currentUser.role !== 'treasurer' && currentUser.role !== 'coordinator') return false;
    if (!canonicalProposalUnion) return true;
    return getUserAllUnions(currentUser).map(getCanonicalUnion).includes(canonicalProposalUnion);
  }, [currentUser, canonicalProposalUnion]);

  const validationResult = useMemo(
    () => validateProposalForSubmission(proposal),
    [proposal]
  );

  const isInviteeLiaison = isUserInviteeForUnion(assignedUnion, currentUser);

  // Prev / Next proposal switcher calculation
  const currentIndex = useMemo(
    () => navigableProposals.findIndex((p) => p.id === proposal.id),
    [navigableProposals, proposal.id]
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < navigableProposals.length - 1;

  // Next unvoted Step 4 proposal in the current queue (for one-click liaison flow after voting)
  const nextUnvotedProposal = useMemo(() => {
    if (!navigableProposals.length || !currentUser?.email) return null;
    const emailLower = currentUser.email.trim().toLowerCase();
    const isUnvotedForMe = (p: Proposal) => {
      if (p.id === proposal.id) return false;
      const approved = p.status === 'approved' || Boolean(p.unionApproval?.actionNumber);
      if (!approved || p.divisionApproval?.authorized) return false;
      if (!canUserVoteStep4Liaison(p, currentUser)) return false;
      const existing = (p.liaisonVotes || []).find(
        (v) =>
          (currentUser.uid && v.liaisonUid === currentUser.uid) ||
          (v.liaisonEmail || '').trim().toLowerCase() === emailLower
      );
      return !existing || existing.vote !== 'recommended';
    };
    const start = currentIndex >= 0 ? currentIndex + 1 : 0;
    for (let i = start; i < navigableProposals.length; i++) {
      if (isUnvotedForMe(navigableProposals[i])) return navigableProposals[i];
    }
    for (let i = 0; i < Math.min(start, navigableProposals.length); i++) {
      if (isUnvotedForMe(navigableProposals[i])) return navigableProposals[i];
    }
    return null;
  }, [navigableProposals, currentIndex, proposal.id, currentUser]);

  useEffect(() => {
    if (liaisonReview) return;
    let mounted = true;
    const loadLiaisons = (forceRefresh = false) => {
      fetchDivisionLiaisons(forceRefresh)
        .then((users) => {
          if (mounted && Array.isArray(users)) {
            setDirectoryUsers(users);
          }
        })
        .catch(() => {
          // Ignore directory lookup error if offline
        });
    };
    loadLiaisons(false);
    const unsub = subscribeToLiaisonDirectoryChanges(() => {
      loadLiaisons(true);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [liaisonReview, currentUser?.uid]);

  // Resolve assigned Voting Division Liaisons for this proposal's Union (excludes Invitees)
  const assignedDivisionLiaisons = useMemo(() => {
    if (liaisonReview) return liaisonReview.assignedDivisionLiaisons;
    if (!canonicalProposalUnion) return [];
    return directoryUsers.filter((u) => {
      if (!isUserLiaisonEligible(u)) return false;
      return getUserVotingUnions(u).includes(canonicalProposalUnion);
    });
  }, [liaisonReview, directoryUsers, canonicalProposalUnion]);

  // Compute unified 5-Step status
  const stepStatus = useMemo(
    () =>
      liaisonReview
        ? liaisonReview.stepStatus
        : getProposalStepStatus(proposal, assignedDivisionLiaisons),
    [liaisonReview, proposal, assignedDivisionLiaisons]
  );

  const frameworkEval = useMemo(
    () => evaluateProposalReviewFramework(proposal),
    [proposal]
  );

  // Current user's existing Liaison vote on this proposal (if any)
  const myExistingVote = useMemo(() => {
    if (!currentUser?.email && !currentUser?.uid) return null;
    const emailLower = (currentUser.email || '').trim().toLowerCase();
    return (
      (proposal.liaisonVotes || []).find(
        (v) =>
          (currentUser.uid && v.liaisonUid === currentUser.uid) ||
          (emailLower && (v.liaisonEmail || '').trim().toLowerCase() === emailLower)
      ) || null
    );
  }, [proposal.liaisonVotes, currentUser]);

  const [isRubricExpanded, setIsRubricExpanded] = useState(false);
  const [selectedDeficientCriteria, setSelectedDeficientCriteria] = useState<ReviewCriterionKey[]>(
    () => (myExistingVote ? myExistingVote.deficientCriteria || [] : frameworkEval.deficientKeys)
  );
  const [criterionInstructions, setCriterionInstructions] = useState<
    Partial<Record<ReviewCriterionKey, string>>
  >(() => {
    const initial: Partial<Record<ReviewCriterionKey, string>> = {};
    for (const q of frameworkEval.questions) {
      initial[q.key] = q.status !== 'adequate' ? q.defaultFixInstruction : '';
    }
    for (const item of myExistingVote?.actionItems || []) {
      if (item.criterionKey && item.instruction) {
        initial[item.criterionKey] = item.instruction;
      }
    }
    return initial;
  });
  const [forceNotFittingPathways, setForceNotFittingPathways] = useState<boolean>(
    myExistingVote?.readinessRating === 'not_fitting_pathways'
  );
  const [minorCoachingOnlyRecommend, setMinorCoachingOnlyRecommend] = useState<boolean>(
    Boolean(
      myExistingVote?.vote === 'recommended' &&
        (myExistingVote?.deficientCriteria?.length || 0) > 0
    )
  );
  const [attachRubricToNextNote, setAttachRubricToNextNote] = useState(false);

  const selectedReadinessRating: ReviewReadinessRating = useMemo(
    () =>
      computeReadinessFromDeficientKeys(selectedDeficientCriteria, forceNotFittingPathways),
    [selectedDeficientCriteria, forceNotFittingPathways]
  );

  useEffect(() => {
    const existingRec = myExistingVote?.recommendation || '';
    const isAutoGeneratedSummary =
      existingRec.startsWith('SSD Review Framework ·') &&
      Boolean(myExistingVote?.actionItems?.length);
    setLiaisonRecommendationText(isAutoGeneratedSummary ? '' : existingRec);
    const initialDeficient = myExistingVote
      ? myExistingVote.deficientCriteria || []
      : frameworkEval.deficientKeys;
    setSelectedDeficientCriteria(initialDeficient);

    const nextInstructions: Partial<Record<ReviewCriterionKey, string>> = {};
    for (const q of frameworkEval.questions) {
      nextInstructions[q.key] = q.status !== 'adequate' ? q.defaultFixInstruction : '';
    }
    for (const item of myExistingVote?.actionItems || []) {
      if (item.criterionKey && item.instruction) {
        nextInstructions[item.criterionKey] = item.instruction;
      }
    }
    setCriterionInstructions(nextInstructions);
    setForceNotFittingPathways(myExistingVote?.readinessRating === 'not_fitting_pathways');
    setMinorCoachingOnlyRecommend(
      Boolean(
        myExistingVote?.vote === 'recommended' &&
          (myExistingVote?.deficientCriteria?.length || 0) > 0
      )
    );
    setAttachRubricToNextNote(false);
    setIsRubricExpanded(false);
    setIsEditingMyVote(false);
    setLiaisonVoteError(null);
  }, [
    proposal.id,
    myExistingVote?.vote,
    myExistingVote?.recommendation,
    myExistingVote?.readinessRating,
    canVoteStep4,
    frameworkEval.autoEvaluatedRating,
  ]);

  useEffect(() => {
    setJustSavedVoteBanner(null);
    setExpandedRubricDetailKeys([]);
    setExpandedTipKeys([]);
    setExpandedTemplateKeys([]);
  }, [proposal.id]);

  const handleScrollToProposalSection = (sectionId: string) => {
    const el =
      document.getElementById(sectionId) ||
      (sectionId === 'section-strategic-focus' ? document.getElementById('section-title') : null);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
      }, 2200);
    }
  };

  const handleToggleCriterionStatus = (key: ReviewCriterionKey) => {
    setSelectedDeficientCriteria((prev) => {
      const isCurrentlyDeficient = prev.includes(key);
      const next = isCurrentlyDeficient ? prev.filter((k) => k !== key) : [...prev, key];
      if (!isCurrentlyDeficient) {
        const matchedQ = frameworkEval.questions.find((q) => q.key === key);
        if (matchedQ && matchedQ.status !== 'adequate' && !criterionInstructions[key]?.trim()) {
          setCriterionInstructions((curr) => ({
            ...curr,
            [key]: matchedQ.defaultFixInstruction,
          }));
        }
      }
      if (next.length === 0) {
        setForceNotFittingPathways(false);
        setMinorCoachingOnlyRecommend(false);
      }
      return next;
    });
    setLiaisonVoteError(null);
  };

  const handleUpdateCriterionInstruction = (key: ReviewCriterionKey, value: string) => {
    setCriterionInstructions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearAllRubricFlags = () => {
    setSelectedDeficientCriteria([]);
    setForceNotFittingPathways(false);
    setMinorCoachingOnlyRecommend(false);
    setLiaisonVoteError(null);
  };

  const handleToggleRubricDetail = (key: ReviewCriterionKey) => {
    setExpandedRubricDetailKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleTipKey = (key: ReviewCriterionKey) => {
    setExpandedTipKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleTemplateKey = (key: ReviewCriterionKey) => {
    setExpandedTemplateKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleDraftCoachingToNoteBox = () => {
    const summary = buildLiaisonCoachingSummary(
      frameworkEval,
      selectedDeficientCriteria,
      selectedReadinessRating,
      criterionInstructions
    );
    setNoteText(summary);
    setAttachRubricToNextNote(selectedDeficientCriteria.length > 0);
    const el = document.getElementById('proposal-review-notes');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Resolve Union Coordinator / Union Treasurer from directory as helpful context if Union Lead is blank
  const registeredUnionLeads = useMemo(() => {
    if (!canonicalProposalUnion) return [];
    return directoryUsers.filter((u) => {
      if (u.role !== 'coordinator' && u.role !== 'treasurer') return false;
      const userUnions = getUserAllUnions(u).map(getCanonicalUnion);
      return userUnions.includes(canonicalProposalUnion);
    });
  }, [directoryUsers, canonicalProposalUnion]);

  const totalFunding = useMemo(
    () =>
      (proposal.budgetItems || []).reduce(
        (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
        0
      ),
    [proposal.budgetItems]
  );

  // Point of Contact values (with fallback to author profile)
  const pocName =
    proposal.pointOfContact?.name?.trim() || proposal.userName?.trim() || 'Not specified';
  const pocEmail = proposal.pointOfContact?.email?.trim() || proposal.userEmail?.trim() || '';
  const pocPhone = proposal.pointOfContact?.phone?.trim() || '';

  // Union Lead values
  const unionLeadName = proposal.divisionLeadContact?.name?.trim() || '';
  const unionLeadEmail = proposal.divisionLeadContact?.email?.trim() || '';
  const unionLeadPhone = proposal.divisionLeadContact?.phone?.trim() || '';

  // Proposal-specific Liaison contact (if manually entered on proposal)
  const proposalLiaisonName = proposal.gcLiaison?.name?.trim() || '';
  const proposalLiaisonEmail = proposal.gcLiaison?.email?.trim() || '';
  const proposalLiaisonPhone = proposal.gcLiaison?.phone?.trim() || '';

  const actionNumber = proposal.unionApproval?.actionNumber?.trim() || 'Approved';
  const approvalDate = proposal.unionApproval?.timestamp;
  const approvedByName = proposal.unionApproval?.approvedBy || proposal.reviewedBy;
  const minutesExcerpt = proposal.unionApproval?.minutesExcerpt?.trim() || '';

  const reviewNotes = useMemo(() => getProposalReviewNotes(proposal), [proposal]);
  const activityHistory = useMemo(() => getProposalActivityLog(proposal), [proposal]);

  // Automatically mark unread reviewNotes as read when an authorized signed-in user opens the Approved Proposal Page
  useEffect(() => {
    if (liaisonReview) return;
    if (!auth.currentUser || !canPostNote || !proposal.reviewNotes || proposal.reviewNotes.length === 0) return;
    const userKey = currentUser.uid || currentUser.email;
    if (!userKey) return;
    const emailLower = (currentUser.email || '').trim().toLowerCase();
    const needsReadUpdate = proposal.reviewNotes.some(
      (n) =>
        (n.authorEmail || '').trim().toLowerCase() !== emailLower &&
        (!n.readBy || !n.readBy.includes(userKey))
    );
    if (needsReadUpdate) {
      const updatedNotes = proposal.reviewNotes.map((n) => {
        if (
          (n.authorEmail || '').trim().toLowerCase() !== emailLower &&
          (!n.readBy || !n.readBy.includes(userKey))
        ) {
          return { ...n, readBy: [...(n.readBy || []), userKey] };
        }
        return n;
      });
      Promise.resolve(onUpdateProposal(proposal.id, { reviewNotes: updatedNotes })).catch(() => {
        // non-blocking read receipt
      });
    }
  }, [
    liaisonReview,
    canPostNote,
    proposal.id,
    proposal.reviewNotes,
    currentUser.uid,
    currentUser.email,
    onUpdateProposal,
  ]);

  useEffect(() => {
    if (liaisonReview || !focusNotes) return;
    const timer = setTimeout(() => {
      const el = document.getElementById('proposal-review-notes');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-amber-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 2000);
      }
      onClearFocusNotes?.();
    }, 80);
    return () => clearTimeout(timer);
  }, [liaisonReview, focusNotes, proposal.id, onClearFocusNotes]);

  const handlePreApprovalStatusChange = async (newStatus: 'draft' | 'submitted' | 'under_review') => {
    if (newStatus === 'submitted' && !validationResult.isValid) {
      onShowValidation?.(validationResult.errors, validationResult.completionPercentage);
      return;
    }
    try {
      await onUpdateProposal(proposal.id, {
        status: newStatus,
        reviewedBy: currentUser?.displayName || currentUser?.email,
        reviewedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Notice updating proposal workflow status:', err);
    }
  };

  const handleOpenStep3VoteModal = () => {
    if (!validationResult.isValid) {
      onShowValidation?.(validationResult.errors, validationResult.completionPercentage);
      return;
    }
    setIsApprovalModalOpen(true);
  };

  const handleConfirmUnionApproval = async (
    proposalId: string,
    approvalData: UnionCommitteeApproval,
    shouldSetStatusApproved: boolean = true
  ) => {
    await onUpdateProposal(proposalId, {
      unionApproval: approvalData,
      status: shouldSetStatusApproved ? 'approved' : proposal.status,
      reviewedBy: approvalData.approvedBy,
      reviewedAt: approvalData.timestamp,
    });
    setIsApprovalModalOpen(false);
  };

  const handleConfirmDivisionAuthorization = async (
    proposalId: string,
    authorizationData: DivisionTreasuryAuthorization | null
  ) => {
    await onUpdateProposal(proposalId, {
      divisionApproval: authorizationData,
    });
    setIsDivisionAuthModalOpen(false);
  };

  const handleConfirmReopenReview = async () => {
    setIsReopenModalOpen(false);
    try {
      await onUpdateProposal(proposal.id, {
        status: 'under_review',
        reviewedBy: currentUser?.displayName || currentUser?.email,
        reviewedAt: new Date().toISOString(),
        ...(isDivisionAuthorized ? { divisionApproval: null } : {}),
        unionApproval: proposal.unionApproval
          ? {
              ...proposal.unionApproval,
              actionNumber: '',
              minutesExcerpt: `${proposal.unionApproval.minutesExcerpt || ''} [Review reopened on ${new Date().toLocaleDateString()}]`.trim(),
            }
          : undefined,
      });
    } catch (err) {
      console.warn('Notice reopening proposal review:', err);
    }
  };

  const handleCastLiaisonVote = async (voteDecision: 'recommended' | 'revision_requested') => {
    if (!currentUser?.email || isSubmittingLiaisonVote) return;

    const manualRecText = liaisonRecommendationText.trim();
    if (
      voteDecision === 'revision_requested' &&
      selectedDeficientCriteria.length === 0 &&
      !manualRecText
    ) {
      setLiaisonVoteError(
        'To request a revision without being vague, flag at least one section in the Rubric above or write the specific change needed.'
      );
      setIsRubricExpanded(true);
      return;
    }

    setIsSubmittingLiaisonVote(true);
    setLiaisonVoteError(null);

    const now = new Date().toISOString();
    const liaisonName = currentUser.displayName || currentUser.email.split('@')[0];
    const emailLower = currentUser.email.trim().toLowerCase();

    const effectiveVoteRating: ReviewReadinessRating =
      voteDecision === 'revision_requested' && selectedReadinessRating === 'meeting_requirement'
        ? 'needs_improvement'
        : selectedReadinessRating;

    const actionItems =
      selectedDeficientCriteria.length > 0
        ? buildLiaisonActionItems(
            frameworkEval,
            selectedDeficientCriteria,
            criterionInstructions
          )
        : [];

    // Auto-populate concrete section-by-section summary if Liaison flagged items and left text blank
    const recText =
      manualRecText ||
      (actionItems.length > 0
        ? buildLiaisonCoachingSummary(
            frameworkEval,
            selectedDeficientCriteria,
            effectiveVoteRating,
            criterionInstructions
          )
        : '');

    const newVote: LiaisonVote = {
      liaisonUid: currentUser.uid || emailLower,
      liaisonName,
      liaisonEmail: currentUser.email,
      vote: voteDecision,
      readinessRating: effectiveVoteRating,
      deficientCriteria: selectedDeficientCriteria,
      ...(actionItems.length > 0 ? { actionItems } : {}),
      ...(recText ? { recommendation: recText } : {}),
      timestamp: now,
    };

    const existingVotes = proposal.liaisonVotes || [];
    const filteredOtherVotes = existingVotes.filter(
      (v) =>
        !(
          (currentUser.uid && v.liaisonUid === currentUser.uid) ||
          (v.liaisonEmail || '').trim().toLowerCase() === emailLower
        )
    );
    const updatedVotes = [...filteredOtherVotes, newVote];

    // Also append a formal note to reviewNotes (including structured actionItems) so Proposal Makers get section jump-links
    let updatedNotes = reviewNotes;
    let latestNoteText = proposal.reviewerNotes;
    if (recText && (recText !== myExistingVote?.recommendation || actionItems.length > 0)) {
      const votePrefix =
        voteDecision === 'recommended'
          ? '[Step 4 · Liaison Vote & Recommendation ✓]'
          : '[Step 4 · Liaison Revision Request]';
      const autoNote: ProposalReviewNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        text: `${votePrefix} ${recText}`,
        authorName: liaisonName,
        authorEmail: currentUser.email,
        authorRole: currentUser.role || 'division_liaison',
        readinessRating: effectiveVoteRating,
        ...(actionItems.length > 0 ? { actionItems } : {}),
        createdAt: now,
      };
      updatedNotes = [...reviewNotes, autoNote];
      latestNoteText = autoNote.text;
    }

    try {
      await onUpdateProposal(proposal.id, {
        liaisonVotes: updatedVotes,
        reviewNotes: updatedNotes,
        ...(latestNoteText ? { reviewerNotes: latestNoteText } : {}),
      });
      setIsEditingMyVote(false);
      setIsRubricExpanded(false);
      setJustSavedVoteBanner(voteDecision);
    } catch (err: any) {
      console.warn('Notice recording Division Liaison vote:', err);
      setLiaisonVoteError(
        'Unable to record Liaison vote in cloud right now. Please verify your assigned voting permissions or connection and try again.'
      );
    } finally {
      setIsSubmittingLiaisonVote(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !currentUser?.email || isSavingNote) return;

    setIsSavingNote(true);
    setNoteError(null);
    const trimmedMessage = noteText.trim();
    const now = new Date().toISOString();
    const authorRole: UserRole = currentUser.role || 'user';

    const noteActionItems =
      (isLiaison || isSuperAdmin) &&
      (attachRubricToNextNote || selectedDeficientCriteria.length > 0) &&
      trimmedMessage.includes('SSD Review Framework')
        ? buildLiaisonActionItems(
            frameworkEval,
            selectedDeficientCriteria,
            criterionInstructions
          )
        : [];

    const newNote: ProposalReviewNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: trimmedMessage,
      authorName: currentUser.displayName || currentUser.email.split('@')[0],
      authorEmail: currentUser.email,
      authorRole,
      ...(isInviteeLiaison ? { isInvitee: true } : {}),
      ...(noteActionItems.length > 0
        ? {
            readinessRating: selectedReadinessRating,
            actionItems: noteActionItems,
          }
        : {}),
      createdAt: now,
    };

    const updatedNotes = [...reviewNotes, newNote];

    try {
      if (isLiaison) {
        await onUpdateProposal(proposal.id, {
          reviewNotes: updatedNotes,
          reviewerNotes: newNote.text,
        });
      } else {
        await onUpdateProposal(proposal.id, {
          reviewNotes: updatedNotes,
          reviewerNotes: newNote.text,
          reviewedBy: newNote.authorName,
          reviewedAt: now,
        });
      }
      setNoteText('');
      setAttachRubricToNextNote(false);
    } catch (err: any) {
      console.warn('Notice saving review note from side panel:', err);
      setNoteError('Unable to save note right now. Please check your connection and try again.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const renderEvidenceRubricPanel = (mode: 'step4_vote' | 'advisory_note') => {
    const canEditRubric =
      mode === 'step4_vote'
        ? (canVoteStep4 && (!myExistingVote || isEditingMyVote)) || isInviteeLiaison
        : isLiaison || isSuperAdmin;

    const flaggedCount = selectedDeficientCriteria.length;

    return (
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5 text-[11px]">
        {/* Header Metadata Strip: Sub-type, Stage, Verdict & 1-Click Clear */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-slate-600 pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-slate-800 truncate">
              {frameworkEval.subTypeMeta.shortLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums font-semibold shrink-0">
              {frameworkEval.principalStageLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`font-extrabold ${
                selectedReadinessRating === 'meeting_requirement'
                  ? 'text-emerald-700'
                  : selectedReadinessRating === 'needs_improvement'
                  ? 'text-amber-800'
                  : 'text-rose-700'
              }`}
            >
              {REVIEW_READINESS_LABELS[selectedReadinessRating]}
            </span>
            {canEditRubric && flaggedCount > 0 && (
              <button
                type="button"
                onClick={handleClearAllRubricFlags}
                className="px-2 py-0.5 rounded-md bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 font-bold text-[10px] transition cursor-pointer whitespace-nowrap"
                title="Clear all flagged items and mark all 7 checks ready to recommend"
              >
                Mark 7/7 OK
              </button>
            )}
          </div>
        </div>

        <p className="text-[10px] text-slate-500 leading-snug">
          {canEditRubric
            ? 'Passed checks stay compact. Click Details to inspect extracted text, or Flag Fix to attach a section instruction.'
            : 'Live proposal evidence mapped against the 7 SSD Review Framework questions.'}
        </p>

        {/* 7 Compact Evidence-Backed Questions List */}
        <div className="space-y-1.5">
          {frameworkEval.questions.map((q) => {
            const isDeficient = selectedDeficientCriteria.includes(q.key);
            const isDetailOpen = expandedRubricDetailKeys.includes(q.key);
            const isTipOpen = expandedTipKeys.includes(q.key);
            const activeInstruction =
              criterionInstructions[q.key] ?? q.defaultFixInstruction;
            const targetInfo = resolveQuestionTargetForInstruction(q, activeInstruction);
            const activeChip = targetInfo.matchedChip;

            return (
              <div
                key={q.key}
                className={`p-2 rounded-lg border transition space-y-2 ${
                  isDeficient
                    ? 'bg-amber-50/80 border-amber-300'
                    : 'bg-white border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isDeficient ? 'bg-amber-600' : 'bg-emerald-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-bold text-slate-900 leading-snug">
                        Q{q.number}. {q.shortTitle}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleScrollToProposalSection(targetInfo.sectionId)}
                        className="text-[10px] font-semibold text-[#1c398e] hover:underline cursor-pointer whitespace-nowrap"
                        title={`Scroll directly to ${targetInfo.sectionLabel}`}
                      >
                        {targetInfo.shortSectionBadge} ↗
                      </button>
                      {!isDeficient && (
                        <button
                          type="button"
                          onClick={() => handleToggleRubricDetail(q.key)}
                          className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 cursor-pointer whitespace-nowrap"
                        >
                          {isDetailOpen ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </div>

                    {/* Show evidence & breakdown automatically when flagged, or on demand when passed */}
                    {(isDeficient || isDetailOpen) && (
                      <div className="space-y-1 pt-0.5">
                        <p className="text-[10px] text-slate-600 leading-snug">
                          {q.whyAsked}
                        </p>

                        {q.gapBreakdown && q.gapBreakdown.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums">
                            {q.gapBreakdown.map((item, idx) => (
                              <span
                                key={`${q.key}_gap_${idx}`}
                                className={`font-semibold ${
                                  item.ok ? 'text-emerald-700' : 'text-amber-800'
                                }`}
                              >
                                {item.ok ? 'OK' : 'Missing'}: {item.label}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-[10px] text-slate-500 leading-relaxed tabular-nums break-words">
                          {q.extractedEvidence}
                        </p>
                      </div>
                    )}
                  </div>

                  {canEditRubric ? (
                    <button
                      type="button"
                      onClick={() => handleToggleCriterionStatus(q.key)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold border shrink-0 whitespace-nowrap transition cursor-pointer ${
                        isDeficient
                          ? 'bg-amber-700 text-white border-amber-800 hover:bg-amber-800'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300'
                      }`}
                      title={
                        isDeficient
                          ? 'Click to mark Adequate and remove this fix request'
                          : 'Click to flag a specific fix in this section'
                      }
                    >
                      {isDeficient ? 'Needs Work' : 'Flag Fix'}
                    </button>
                  ) : (
                    <span
                      className={`text-[10px] font-bold shrink-0 whitespace-nowrap ${
                        isDeficient ? 'text-amber-800' : 'text-emerald-700'
                      }`}
                    >
                      {isDeficient ? 'Needs Work' : 'Verified'}
                    </span>
                  )}
                </div>

                {/* Specific Section Prescription Drawer (Only shown when Needs Work) */}
                {isDeficient && (
                  <div className="pt-2 border-t border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-amber-950">
                        Edit in {targetInfo.sectionLabel}:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleScrollToProposalSection(targetInfo.sectionId)}
                        className="text-[10px] font-semibold text-[#1c398e] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        Go to {targetInfo.shortSectionBadge} ↗
                      </button>
                    </div>

                    {canEditRubric ? (
                      <>
                        {/* 1-Click Concrete Fix Presets */}
                        {q.presetFixChips.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {q.presetFixChips.map((chip) => {
                              const isSelectedChip =
                                activeInstruction.trim() === chip.instruction.trim() ||
                                activeInstruction.trim().startsWith(chip.instruction.trim());
                              return (
                                <button
                                  key={chip.id}
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCriterionInstruction(q.key, chip.instruction)
                                  }
                                  className={`px-2 py-1 rounded text-[10px] font-semibold border text-left transition cursor-pointer ${
                                    isSelectedChip
                                      ? 'bg-amber-200/90 text-amber-950 border-amber-500'
                                      : chip.isRelevantGap
                                      ? 'bg-white hover:bg-amber-100/70 text-amber-950 border-amber-300'
                                      : 'bg-slate-50/80 hover:bg-amber-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {chip.isRelevantGap ? 'Suggested: ' : ''}
                                  {chip.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <textarea
                          rows={2}
                          value={activeInstruction}
                          onChange={(e) =>
                            handleUpdateCriterionInstruction(q.key, e.target.value)
                          }
                          placeholder={`Write simple, clear steps for ${targetInfo.sectionLabel}...`}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-[11px] text-slate-800 placeholder-slate-400 focus:border-amber-600 outline-none resize-y leading-snug"
                        />

                        {/* Collapsible Coaching Tips & Example Sentence */}
                        {activeChip && (
                          <div>
                            <button
                              type="button"
                              onClick={() => handleToggleTipKey(q.key)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 hover:underline cursor-pointer"
                            >
                              <span>
                                {isTipOpen
                                  ? 'Hide coaching tips & example'
                                  : 'Show coaching tips & example sentence'}
                              </span>
                              {isTipOpen ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            {isTipOpen && (
                              <div className="mt-1.5 p-2 rounded-lg bg-white/90 border border-amber-200/90 space-y-1.5 text-[10px]">
                                <p className="text-slate-700 leading-snug">
                                  <span className="font-bold text-slate-900">Why it matters: </span>
                                  {activeChip.whyItMatters}
                                </p>
                                {activeChip.pointers.length > 0 && (
                                  <ul className="list-disc pl-4 space-y-0.5 text-slate-700 leading-snug">
                                    {activeChip.pointers.map((pt, idx) => (
                                      <li key={`${activeChip.id}_pt_${idx}`}>{pt}</li>
                                    ))}
                                  </ul>
                                )}
                                <div className="pt-1 border-t border-slate-100 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-slate-800">
                                      Example sentence:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateCriterionInstruction(
                                          q.key,
                                          `${activeChip.instruction}\n\nExample to copy & fill in:\n"${activeChip.exampleTemplate}"`
                                        )
                                      }
                                      className="text-[10px] font-bold text-[#1c398e] hover:underline cursor-pointer whitespace-nowrap"
                                    >
                                      + Include Example in Note
                                    </button>
                                  </div>
                                  <p className="text-slate-600 italic leading-snug">
                                    &ldquo;{activeChip.exampleTemplate}&rdquo;
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-1.5 bg-white/90 p-2 rounded border border-amber-200 text-[10px]">
                        <p className="text-amber-950 font-medium leading-relaxed whitespace-pre-wrap">
                          {activeInstruction}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Auto-Derived Verdict Controls & 1-Click Action List Insertion */}
        {canEditRubric && (
          <div className="pt-2 border-t border-slate-200/80 space-y-2">
            {flaggedCount > 0 && flaggedCount < 5 && (
              <label className="flex items-center gap-2 text-[10px] text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceNotFittingPathways}
                  onChange={(e) => setForceNotFittingPathways(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>
                  Fundamental mismatch — classify as <strong>Not Fitting Pathways</strong>
                </span>
              </label>
            )}

            {mode === 'step4_vote' && canVoteStep4 ? (
              <p className="text-[10px] font-semibold text-slate-600 leading-snug">
                {flaggedCount > 0
                  ? `${flaggedCount} section ${
                      flaggedCount === 1 ? 'fix' : 'fixes'
                    } above will attach automatically to your Step 4 decision below.`
                  : 'All 7 framework checks verified — ready to Vote & Recommend below.'}
              </p>
            ) : canPostNote ? (
              <button
                type="button"
                onClick={handleDraftCoachingToNoteBox}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-[11px] transition cursor-pointer whitespace-nowrap"
              >
                <span>
                  {flaggedCount > 0
                    ? `Insert ${flaggedCount}-Section Fix List into Review Note`
                    : 'Insert Rubric Note into Review Notes'}
                </span>
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const renderCompactSidebarStep4Summary = () => {
    if (!liaisonReview) return null;
    if (!isProposalApproved && !isLiaison) return null;

    const {
      frameworkEval: sharedEval,
      systemAlignmentFlags: sharedSystemFlags,
      alignmentFlaggedCriteria: sharedAlignmentCriteria,
      selectedDeficientCriteria: sharedDeficient,
      verifiedOkCriteria: sharedVerifiedOk,
      reviewedRubricCount: sharedReviewedCount,
      unreviewedRubricCount: sharedUnreviewedCount,
      criterionInstructions: sharedInstructions,
      forceNotFittingPathways: sharedForceNotFitting,
      setForceNotFittingPathways: setSharedForceNotFitting,
      minorCoachingOnlyRecommend: sharedMinorCoaching,
      setMinorCoachingOnlyRecommend: setSharedMinorCoaching,
      liaisonRecommendationText: sharedRecText,
      setLiaisonRecommendationText: setSharedRecText,
      isSubmittingLiaisonVote: sharedSubmitting,
      liaisonVoteError: sharedVoteError,
      isEditingMyVote: sharedEditing,
      setIsEditingMyVote: setSharedEditing,
      justSavedVoteBanner: sharedSavedBanner,
      setJustSavedVoteBanner: setSharedSavedBanner,
      myExistingVote: sharedMyVote,
      canVoteStep4: sharedCanVote,
      isInviteeLiaison: sharedIsInvitee,
      canEditRubric: sharedCanEditRubric,
      canPostNote: sharedCanPostNote,
      nextUnvotedProposal: sharedNextUnvoted,
      toggleCriterionOk: sharedToggleOk,
      toggleCriterionFlag: sharedToggleFlag,
      updateCriterionInstruction: sharedUpdateInstruction,
      verifyAllRubricOk: sharedVerifyAllOk,
      draftCoachingToNoteBox: sharedDraftCoaching,
      scrollToElement: sharedScrollTo,
    } = liaisonReview;

    const flaggedCount = sharedDeficient.length;
    const systemFlagCount = sharedSystemFlags.length;
    const passedCount = 7 - flaggedCount;
    const allSevenReviewed = sharedUnreviewedCount === 0;
    const nextAcronym = sharedNextUnvoted
      ? UNION_ACRONYMS[getCanonicalUnion(sharedNextUnvoted.union)] ||
        sharedNextUnvoted.union ||
        'SSD'
      : '';
    const assignedLiaisonNames = assignedDivisionLiaisons
      .map((l) => l.displayName || l.email)
      .filter(Boolean)
      .join(', ');

    return (
      <div
        id="sidebar-step4-card"
        className="scroll-mt-24 bg-white rounded-2xl border border-indigo-200/90 p-4 shadow-2xs space-y-3"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-indigo-100 pb-2">
          <h3 className="text-xs font-extrabold text-slate-900">
            {isProposalApproved ? 'Step 4 · Division Liaison Vote' : 'Step 4 · Liaison Advisory'}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {isProposalApproved && (
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  stepStatus.step4Complete
                    ? 'text-emerald-700'
                    : stepStatus.liaisonSummary.hasRevisionRequested
                    ? 'text-amber-700'
                    : 'text-indigo-800'
                }`}
              >
                {stepStatus.liaisonSummary.progressLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowStep4Guide((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer whitespace-nowrap ${
                showStep4Guide
                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-200'
              }`}
              title="How Step 4 Liaison Review & Voting works"
            >
              <HelpCircle className="w-3 h-3 shrink-0" />
              <span>Guide</span>
            </button>
          </div>
        </div>

        {/* Built-In Collapsible Quick Guide */}
        {showStep4Guide && (
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/90 text-[11px] text-slate-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-indigo-950">How Step 4 Works</span>
              <button
                type="button"
                onClick={() => setShowStep4Guide(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close guide"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <ol className="list-decimal pl-4 space-y-1 leading-snug text-[10.5px]">
              <li>
                Review the proposal &amp; verify each item in the <strong>7-Question Rubric</strong>{' '}
                below—smart hints guide you while you tap <strong>OK</strong> or{' '}
                <strong>Flag</strong> (or <strong>Confirm All 7 OK</strong> after reading).
              </li>
              <li>
                Use the floating <strong>Review Notes</strong> box in the lower-right corner anytime
                while reading to take notes or paste quotes.
              </li>
              <li>
                Click <strong>Vote &amp; Recommend to OV27</strong> (or{' '}
                <strong>Request Revision</strong>) and confirm in the popup that you reviewed and
                assisted the Union—plus note the reason if any flagged suggestions remain.
              </li>
              <li>
                You can click <strong>Edit Vote</strong> anytime before Step 5 authorization. After
                a Revision Request, the <strong>Union Treasurer</strong> clicks{' '}
                <strong>Reopen Review</strong> to unlock the form.
              </li>
            </ol>
            {onOpenLiaisonGuide && (
              <div className="pt-1.5 border-t border-indigo-200/80">
                <button
                  type="button"
                  onClick={onOpenLiaisonGuide}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-[10.5px] transition cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-3 h-3 shrink-0" />
                  <span>Open 4-Page Printable Guide (PDF)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Post-Vote Confirmation Banner */}
        {sharedSavedBanner && (
          <div
            className={`flex items-start justify-between gap-2 p-2.5 rounded-xl border text-[11px] leading-snug ${
              sharedSavedBanner === 'recommended'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0">
              {sharedSavedBanner === 'recommended' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              )}
              <span>
                {sharedSavedBanner === 'recommended'
                  ? 'Step 4 vote saved. Recommended to SSD OV27 Committee (Step 5).'
                  : 'Revision request saved. The Union Treasurer can now click Reopen Review to unlock the form.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSharedSavedBanner(null)}
              className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
              aria-label="Dismiss confirmation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Compact Liaison Roster Status */}
        {isProposalApproved &&
          (assignedDivisionLiaisons.length > 0 || (proposal.liaisonVotes || []).length > 0 ? (
            <div className="space-y-1.5">
              {assignedDivisionLiaisons.map((liaison) => {
                const lEmail = (liaison.email || '').trim().toLowerCase();
                const recordedVote = (proposal.liaisonVotes || []).find(
                  (v) =>
                    (liaison.uid && v.liaisonUid === liaison.uid) ||
                    (lEmail && (v.liaisonEmail || '').trim().toLowerCase() === lEmail)
                );
                return (
                  <div
                    key={liaison.uid || liaison.email}
                    className={`px-2.5 py-2 rounded-xl border text-xs space-y-1 ${
                      recordedVote?.vote === 'recommended'
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : recordedVote?.vote === 'revision_requested'
                        ? 'bg-amber-50/70 border-amber-200'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate text-[11px]">
                        {liaison.displayName || liaison.email}
                      </span>
                      {recordedVote?.vote === 'recommended' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 shrink-0 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Voted ✓</span>
                        </span>
                      ) : recordedVote?.vote === 'revision_requested' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 shrink-0 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Revision</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 shrink-0 whitespace-nowrap">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                    {recordedVote?.confirmedReviewedAndAssisted && (
                      <p className="text-[9.5px] font-semibold text-slate-500">
                        Confirmed reviewed &amp; assisted Union ✓
                      </p>
                    )}
                    {recordedVote?.remainingFlagsOverrideReason && (
                      <p className="text-[10px] text-amber-950 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2 py-1 leading-snug">
                        <span className="font-bold">Flagged items note: </span>
                        {recordedVote.remainingFlagsOverrideReason}
                      </p>
                    )}
                    {recordedVote?.actionItems && recordedVote.actionItems.length > 0 && (
                      <div className="space-y-0.5 bg-white/90 p-1.5 rounded-lg border border-amber-200/80 text-[10px]">
                        {recordedVote.actionItems.map((item) => (
                          <div key={item.criterionKey} className="text-slate-700 leading-snug">
                            <button
                              type="button"
                              onClick={() => sharedScrollTo(item.sectionId)}
                              className="font-bold text-[#1c398e] hover:underline cursor-pointer"
                            >
                              {item.sectionLabel} ↗
                            </button>
                            <span>: {item.instruction}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {(proposal.liaisonVotes || [])
                .filter((v) => {
                  const vEmail = (v.liaisonEmail || '').trim().toLowerCase();
                  return !assignedDivisionLiaisons.some(
                    (l) =>
                      (l.uid && v.liaisonUid === l.uid) ||
                      (vEmail && (l.email || '').trim().toLowerCase() === vEmail)
                  );
                })
                .map((recordedVote) => (
                  <div
                    key={recordedVote.liaisonUid || recordedVote.liaisonEmail}
                    className={`px-2.5 py-2 rounded-xl border text-xs space-y-1 ${
                      recordedVote.vote === 'recommended'
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-amber-50/70 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate text-[11px]">
                        {recordedVote.liaisonName || recordedVote.liaisonEmail}
                      </span>
                      {recordedVote.vote === 'recommended' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 shrink-0 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Voted ✓</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-800 shrink-0 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Revision</span>
                        </span>
                      )}
                    </div>
                    {recordedVote.confirmedReviewedAndAssisted && (
                      <p className="text-[9.5px] font-semibold text-slate-500">
                        Confirmed reviewed &amp; assisted Union ✓
                      </p>
                    )}
                    {recordedVote.remainingFlagsOverrideReason && (
                      <p className="text-[10px] text-amber-950 bg-amber-50/90 border border-amber-200/80 rounded-lg px-2 py-1 leading-snug">
                        <span className="font-bold">Flagged items note: </span>
                        {recordedVote.remainingFlagsOverrideReason}
                      </p>
                    )}
                    {recordedVote.actionItems && recordedVote.actionItems.length > 0 && (
                      <div className="space-y-0.5 bg-white/90 p-1.5 rounded-lg border border-amber-200/80 text-[10px]">
                        {recordedVote.actionItems.map((item) => (
                          <div key={item.criterionKey} className="text-slate-700 leading-snug">
                            <button
                              type="button"
                              onClick={() => sharedScrollTo(item.sectionId)}
                              className="font-bold text-[#1c398e] hover:underline cursor-pointer"
                            >
                              {item.sectionLabel} ↗
                            </button>
                            <span>: {item.instruction}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-indigo-50/40 border border-dashed border-indigo-200 text-[11px] text-slate-600 leading-snug">
              No Division Liaison is registered for <strong>{unionAcronym}</strong> yet.
            </div>
          ))}

        {/* Always-Visible Compact 7-Question Rubric Checklist */}
        <div className="pt-2 border-t border-indigo-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
              <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-extrabold text-slate-900 truncate">7-Question Rubric</span>
              {sharedCanEditRubric ? (
                <span
                  className={`font-extrabold tabular-nums shrink-0 ${
                    !allSevenReviewed
                      ? 'text-indigo-700'
                      : flaggedCount === 0
                      ? 'text-emerald-700'
                      : 'text-amber-800'
                  }`}
                >
                  (Reviewed {sharedReviewedCount}/7)
                </span>
              ) : (
                <span
                  className={`font-extrabold tabular-nums shrink-0 ${
                    flaggedCount === 0 ? 'text-emerald-700' : 'text-amber-800'
                  }`}
                >
                  ({passedCount}/7)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {sharedCanEditRubric && (sharedUnreviewedCount > 0 || flaggedCount > 0) && (
                <button
                  type="button"
                  onClick={sharedVerifyAllOk}
                  className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-bold text-emerald-800 cursor-pointer whitespace-nowrap"
                  title="Confirm all 7 rubric questions passed your review"
                >
                  {flaggedCount > 0 ? 'Mark 7/7 OK' : 'Confirm All 7 OK'}
                </button>
              )}
              <a
                href={REVIEW_FRAMEWORK_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-700 hover:underline whitespace-nowrap"
                title="Open official SSD Project Review Framework PDF"
              >
                <span>PDF</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          {sharedCanEditRubric && !allSevenReviewed && (
            <p className="text-[10px] text-slate-600 leading-snug">
              Smart hints are shown below — tap <strong>OK</strong> or <strong>Flag</strong> as you
              review each question (click any title to inspect evidence).
            </p>
          )}

          {sharedEval.hasSplitLiaisonVerdict && (
            <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-950">
              <strong>Split Verdicts:</strong> Liaisons recorded differing ratings; summary reflects
              the more cautious rating.
            </div>
          )}

          {/* 7 Compact Rows — Never Hidden */}
          <div className="rounded-xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden bg-white">
            {sharedEval.questions.map((q) => {
              const isDeficient = sharedDeficient.includes(q.key);
              const isVerifiedOk = !isDeficient && sharedVerifiedOk.includes(q.key);
              const isAutoPassing = q.status === 'adequate';
              const hasAlignmentWarning = sharedAlignmentCriteria.includes(q.key);
              const hasSystemGap = hasAlignmentWarning || !isAutoPassing;
              const needsAttention =
                isDeficient || (sharedCanEditRubric && !isVerifiedOk && hasSystemGap);
              const isDetailOpen = expandedRubricDetailKeys.includes(q.key);
              const isTipOpen = expandedTipKeys.includes(q.key);
              const rawInstruction = sharedInstructions[q.key];
              const activeInstruction =
                rawInstruction !== undefined
                  ? rawInstruction
                  : hasSystemGap
                  ? q.defaultFixInstruction
                  : '';
              const targetInfo = resolveQuestionTargetForInstruction(q, activeInstruction);
              const activeChip = targetInfo.matchedChip;

              return (
                <div
                  key={q.key}
                  className={`px-2.5 py-2 transition space-y-1.5 text-[11px] ${
                    isDeficient
                      ? 'bg-amber-50/95'
                      : needsAttention
                      ? 'bg-amber-50/65'
                      : sharedCanEditRubric && isVerifiedOk
                      ? 'bg-emerald-50/35'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {needsAttention ? (
                        <AlertCircle
                          className="w-3.5 h-3.5 text-amber-600 fill-amber-100 shrink-0"
                          aria-label="Needs attention"
                        />
                      ) : !sharedCanEditRubric || isVerifiedOk ? (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <span
                          className="w-2 h-2 rounded-full border-2 border-indigo-300 bg-white shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleRubricDetail(q.key)}
                            className="font-bold text-slate-800 hover:text-[#1c398e] truncate text-left cursor-pointer"
                            title={`Click to view check details for Q${q.number}: ${q.shortTitle}`}
                          >
                            Q{q.number}. {q.shortTitle}
                          </button>
                          <button
                            type="button"
                            onClick={() => sharedScrollTo(targetInfo.sectionId)}
                            className="text-[9.5px] font-semibold text-slate-400 hover:text-[#1c398e] shrink-0 cursor-pointer whitespace-nowrap"
                            title={`Scroll to ${targetInfo.sectionLabel}`}
                          >
                            ↗
                          </button>
                        </div>
                        {sharedCanEditRubric && !isVerifiedOk && (
                          <span
                            className={`block text-[9px] font-semibold leading-tight mt-0.5 ${
                              isDeficient || hasSystemGap
                                ? 'text-amber-800'
                                : 'text-emerald-700/80'
                            }`}
                          >
                            {isDeficient
                              ? hasSystemGap
                                ? 'Flagged · System check also alerted'
                                : 'Flagged by you (manual coaching note)'
                              : hasAlignmentWarning
                              ? 'Auto-hint: Alignment check'
                              : !isAutoPassing
                              ? 'Auto-hint: Needs check'
                              : 'Auto-hint: OK'}
                          </span>
                        )}
                      </div>
                    </div>

                    {sharedCanEditRubric ? (
                      <div className="inline-flex items-center rounded-md border border-slate-200/90 bg-slate-50/90 p-0.5 gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => sharedToggleOk(q.key)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer whitespace-nowrap ${
                            isVerifiedOk
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                              : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-300/90'
                          }`}
                          title={
                            isVerifiedOk
                              ? `Click to uncheck Q${q.number}`
                              : `Mark Q${q.number} as verified OK`
                          }
                        >
                          {isVerifiedOk ? '✓ OK' : 'OK'}
                        </button>
                        <button
                          type="button"
                          onClick={() => sharedToggleFlag(q.key)}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer whitespace-nowrap ${
                            isDeficient
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                              : hasSystemGap
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400'
                              : 'bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-300 hover:border-amber-400'
                          }`}
                          title={
                            isDeficient
                              ? `Click to unflag Q${q.number}`
                              : `Flag Q${q.number} for revision or coaching`
                          }
                        >
                          {(isDeficient || hasSystemGap) && (
                            <AlertCircle
                              className={`w-2.5 h-2.5 shrink-0 ${
                                isDeficient ? 'text-amber-100' : 'text-amber-600'
                              }`}
                            />
                          )}
                          <span>{isDeficient ? 'Flagged' : 'Flag'}</span>
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-[10px] font-bold shrink-0 whitespace-nowrap ${
                          isDeficient ? 'text-amber-800' : 'text-emerald-700'
                        }`}
                      >
                        {isDeficient ? 'Flagged' : 'OK'}
                      </span>
                    )}
                  </div>

                  {/* On-demand brief check criteria & evidence */}
                  {isDetailOpen && (
                    <div className="pl-3 space-y-1 text-[10px] text-slate-600 leading-snug">
                      <p>{q.whyAsked}</p>
                      {q.gapBreakdown && q.gapBreakdown.length > 0 && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 tabular-nums">
                          {q.gapBreakdown.map((item, idx) => (
                            <span
                              key={`${q.key}_sb_gap_${idx}`}
                              className={`font-semibold ${
                                item.ok ? 'text-emerald-700' : 'text-amber-800'
                              }`}
                            >
                              {item.ok ? 'OK' : 'Missing'}: {item.label}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-slate-500 tabular-nums">{q.extractedEvidence}</p>
                    </div>
                  )}

                  {/* Compact Flagged Instruction Drawer */}
                  {isDeficient && (
                    <div className="pt-1.5 border-t border-amber-200/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className="font-bold text-amber-950 truncate">
                          {hasSystemGap || activeInstruction.trim().length > 0
                            ? `Fix in ${targetInfo.shortSectionBadge}:`
                            : `Coaching note (${targetInfo.shortSectionBadge}):`}
                        </span>
                        <button
                          type="button"
                          onClick={() => sharedScrollTo(targetInfo.sectionId)}
                          className="font-semibold text-[#1c398e] hover:underline shrink-0 cursor-pointer"
                        >
                          Inspect ↗
                        </button>
                      </div>

                      {sharedCanEditRubric ? (
                        <>
                          {hasSystemGap && q.presetFixChips.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {q.presetFixChips.map((chip) => {
                                const trimmedActive = activeInstruction.trim();
                                const isSelected =
                                  trimmedActive.length > 0 &&
                                  (trimmedActive === chip.instruction.trim() ||
                                    trimmedActive.startsWith(chip.instruction.trim()));
                                return (
                                  <button
                                    key={chip.id}
                                    type="button"
                                    onClick={() => sharedUpdateInstruction(q.key, chip.instruction)}
                                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border text-left transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-amber-200 text-amber-950 border-amber-500'
                                        : chip.isRelevantGap
                                        ? 'bg-white hover:bg-amber-100/70 text-amber-950 border-amber-300'
                                        : 'bg-white hover:bg-amber-50 text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {chip.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {!hasSystemGap && (
                            <p className="text-[10px] text-slate-600 leading-snug">
                              Auto-check found no missing items here. Write your own coaching note
                              below if you want the Union to refine this section.
                            </p>
                          )}

                          <textarea
                            rows={2}
                            value={activeInstruction}
                            onChange={(e) => sharedUpdateInstruction(q.key, e.target.value)}
                            placeholder={
                              hasSystemGap
                                ? `Specific fix for ${targetInfo.sectionLabel}...`
                                : `Write your coaching feedback for ${targetInfo.sectionLabel}...`
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-white border border-amber-300 text-[10.5px] text-slate-800 placeholder-slate-400 focus:border-amber-600 outline-none resize-y leading-snug"
                          />

                          {!hasSystemGap && q.presetFixChips.length > 0 && (
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => handleToggleTemplateKey(q.key)}
                                className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                <span>
                                  {expandedTemplateKeys.includes(q.key)
                                    ? 'Hide optional coaching templates'
                                    : '+ Insert optional coaching template'}
                                </span>
                                {expandedTemplateKeys.includes(q.key) ? (
                                  <ChevronUp className="w-2.5 h-2.5" />
                                ) : (
                                  <ChevronDown className="w-2.5 h-2.5" />
                                )}
                              </button>
                              {expandedTemplateKeys.includes(q.key) && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {q.presetFixChips.map((chip) => {
                                    const trimmedActive = activeInstruction.trim();
                                    const isSelected =
                                      trimmedActive.length > 0 &&
                                      (trimmedActive === chip.instruction.trim() ||
                                        trimmedActive.startsWith(chip.instruction.trim()));
                                    return (
                                      <button
                                        key={chip.id}
                                        type="button"
                                        onClick={() =>
                                          sharedUpdateInstruction(q.key, chip.instruction)
                                        }
                                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border text-left transition cursor-pointer ${
                                          isSelected
                                            ? 'bg-amber-200 text-amber-950 border-amber-500'
                                            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                      >
                                        {chip.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {activeChip && (
                            <div>
                              <button
                                type="button"
                                onClick={() => handleToggleTipKey(q.key)}
                                className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-900 hover:underline cursor-pointer"
                              >
                                <span>{isTipOpen ? 'Hide tips' : 'Tips & example'}</span>
                                {isTipOpen ? (
                                  <ChevronUp className="w-2.5 h-2.5" />
                                ) : (
                                  <ChevronDown className="w-2.5 h-2.5" />
                                )}
                              </button>
                              {isTipOpen && (
                                <div className="mt-1 p-2 rounded-lg bg-white border border-amber-200 text-[10px] space-y-1">
                                  <p className="text-slate-700 leading-snug">
                                    <strong>Why: </strong>
                                    {activeChip.whyItMatters}
                                  </p>
                                  <p className="text-slate-600 italic leading-snug">
                                    &ldquo;{activeChip.exampleTemplate}&rdquo;
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sharedUpdateInstruction(
                                        q.key,
                                        `${activeChip.instruction}\n\nExample:\n"${activeChip.exampleTemplate}"`
                                      )
                                    }
                                    className="text-[10px] font-bold text-[#1c398e] hover:underline cursor-pointer"
                                  >
                                    + Add example to fix note
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-amber-950 bg-white/90 p-1.5 rounded border border-amber-200 leading-snug">
                          {activeInstruction}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sharedCanEditRubric && flaggedCount > 0 && flaggedCount < 5 && (
            <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sharedForceNotFitting}
                onChange={(e) => setSharedForceNotFitting(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <span>
                Fundamental mismatch — classify as <strong>Not Fitting Pathways</strong>
              </span>
            </label>
          )}
        </div>

        {/* Option B Connected Step 4 Vote Box */}
        {isProposalApproved ? (
          sharedCanVote ? (
            <div className="pt-2 border-t border-indigo-100 space-y-2">
              {sharedMyVote && !sharedEditing ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-950 font-bold min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                      <span className="truncate">
                        Your Vote:{' '}
                        {sharedMyVote.vote === 'recommended'
                          ? 'Recommended ✓'
                          : 'Revision Requested'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSharedEditing(true);
                        setSharedSavedBanner(null);
                      }}
                      className="text-[11px] font-bold text-[#1c398e] hover:underline shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      Edit Vote
                    </button>
                  </div>

                  {onSelectProposal && sharedNextUnvoted ? (
                    <button
                      type="button"
                      onClick={() => onSelectProposal(sharedNextUnvoted.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white transition cursor-pointer shadow-2xs"
                    >
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-bold leading-tight">Next Unvoted Proposal</p>
                        <p className="text-[10px] text-blue-100 truncate">
                          [{nextAcronym}] {sharedNextUnvoted.title || 'Untitled proposal'}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  ) : onSelectProposal && hasNext ? (
                    <button
                      type="button"
                      onClick={() => onSelectProposal(navigableProposals[currentIndex + 1].id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                    >
                      <span>Next Proposal in List</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  ) : onBack && backTargetLabel ? (
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>All Caught Up · Back to {backTargetLabel}</span>
                    </button>
                  ) : null}
                </div>
              ) : flaggedCount > 0 ? (
                <div
                  className={`space-y-2 p-3 rounded-xl border transition ${
                    sharedMinorCoaching
                      ? 'bg-indigo-50/50 border-indigo-200/90'
                      : 'bg-amber-50/75 border-amber-300'
                  }`}
                >
                  <p
                    className={`text-[11px] font-extrabold tabular-nums ${
                      sharedMinorCoaching ? 'text-indigo-950' : 'text-amber-950'
                    }`}
                  >
                    {sharedMinorCoaching
                      ? `Recommend with Coaching (${flaggedCount})`
                      : `Request Revision (${flaggedCount} Flagged)`}
                  </p>

                  <textarea
                    rows={2}
                    value={sharedRecText}
                    onChange={(e) => setSharedRecText(e.target.value)}
                    placeholder="Optional overall note (flagged Q# instructions attach automatically)..."
                    className={`w-full px-2.5 py-1.5 rounded-lg bg-white border text-xs text-slate-800 placeholder-slate-400 outline-none resize-none ${
                      sharedMinorCoaching
                        ? 'border-indigo-200 focus:border-indigo-600'
                        : 'border-amber-300 focus:border-amber-600'
                    }`}
                  />

                  <label className="flex items-center gap-2 text-[10px] text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sharedMinorCoaching}
                      onChange={(e) => setSharedMinorCoaching(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>
                      Minor coaching only — still <strong>Vote &amp; Recommend</strong>
                    </span>
                  </label>

                  {sharedVoteError && (
                    <p className="text-[11px] text-rose-600 font-medium">{sharedVoteError}</p>
                  )}

                  {sharedMinorCoaching ? (
                    <>
                      {!allSevenReviewed && (
                        <p className="text-[10px] font-semibold text-indigo-900 bg-white border border-indigo-200 rounded-lg px-2 py-1.5 leading-snug">
                          Tap <strong>OK</strong> on the remaining {sharedUnreviewedCount}{' '}
                          unreviewed {sharedUnreviewedCount === 1 ? 'question' : 'questions'} above
                          to unlock Recommend.
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={sharedSubmitting || !allSevenReviewed}
                        onClick={() => setPendingLiaisonConfirmDecision('recommended')}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {sharedSubmitting
                            ? 'Recording Vote...'
                            : 'Vote & Recommend (with Coaching)'}
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={sharedSubmitting}
                      onClick={() => setPendingLiaisonConfirmDecision('revision_requested')}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap tabular-nums"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {sharedSubmitting
                          ? 'Sending Revision Request...'
                          : `Request Revision (${flaggedCount} ${
                              flaggedCount === 1 ? 'Section' : 'Sections'
                            })`}
                      </span>
                    </button>
                  )}

                  {sharedEditing && (
                    <button
                      type="button"
                      onClick={() => setSharedEditing(false)}
                      className="w-full text-center text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 p-3 rounded-xl bg-indigo-50/45 border border-indigo-200/90">
                  <p className="text-[11px] font-extrabold text-indigo-950 tabular-nums">
                    {!allSevenReviewed
                      ? `Step 4 Decision · Verify Rubric (${sharedReviewedCount}/7)`
                      : sharedMyVote
                      ? 'Update Vote · Ready to Recommend (7/7)'
                      : 'Step 4 Decision · Ready to Recommend (7/7)'}
                  </p>

                  {!allSevenReviewed && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-indigo-200 text-[10px] text-slate-700 leading-snug">
                      <span>
                        Tap <strong>OK</strong> or <strong>Flag</strong> on {sharedUnreviewedCount}{' '}
                        remaining {sharedUnreviewedCount === 1 ? 'question' : 'questions'} above to
                        recommend.
                      </span>
                      <button
                        type="button"
                        onClick={sharedVerifyAllOk}
                        className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-extrabold text-emerald-800 shrink-0 cursor-pointer whitespace-nowrap"
                      >
                        Confirm All 7 OK
                      </button>
                    </div>
                  )}

                  <textarea
                    rows={2}
                    value={sharedRecText}
                    onChange={(e) => setSharedRecText(e.target.value)}
                    placeholder="Optional committee remark or encouragement..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-600 outline-none resize-none"
                  />

                  {systemFlagCount > 0 && (
                    <p className="text-[10px] font-semibold text-amber-900 bg-amber-50/90 border border-amber-200 rounded-lg px-2 py-1.5 leading-snug">
                      {systemFlagCount} system alignment{' '}
                      {systemFlagCount === 1 ? 'suggestion remains' : 'suggestions remain'} —
                      you&rsquo;ll confirm a brief reason in the next step.
                    </p>
                  )}

                  {sharedVoteError && (
                    <p className="text-[11px] text-rose-600 font-medium">{sharedVoteError}</p>
                  )}

                  <button
                    type="button"
                    disabled={sharedSubmitting || !allSevenReviewed}
                    onClick={() => setPendingLiaisonConfirmDecision('recommended')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {sharedSubmitting
                        ? 'Recording Vote...'
                        : allSevenReviewed
                        ? 'Vote & Recommend to OV27'
                        : `Verify Rubric First (${sharedReviewedCount}/7)`}
                    </span>
                  </button>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={sharedSubmitting}
                      onClick={() => setPendingLiaisonConfirmDecision('revision_requested')}
                      className="text-[10.5px] font-bold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer"
                    >
                      Request Revision instead
                    </button>
                    {sharedEditing && (
                      <button
                        type="button"
                        onClick={() => setSharedEditing(false)}
                        className="text-[10.5px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : sharedIsInvitee ? (
            <div className="pt-2 border-t border-indigo-100 space-y-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Invitee Access · View &amp; Comment Only</span>
                </div>
                <p className="leading-snug">
                  Formal voting for <strong>{unionAcronym}</strong> is assigned to{' '}
                  {assignedLiaisonNames || 'Voting Liaisons'}.
                </p>
              </div>
              {sharedCanPostNote && (
                <button
                  type="button"
                  onClick={sharedDraftCoaching}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-[11px] transition cursor-pointer whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {flaggedCount > 0
                      ? `Send ${flaggedCount} Flagged Notes to Chat`
                      : 'Send Rubric Summary to Chat'}
                  </span>
                </button>
              )}
            </div>
          ) : isDivisionAuthorized && canUserVoteStep4Liaison(proposal, currentUser) ? (
            <div className="pt-2 border-t border-indigo-100">
              <p className="p-2.5 rounded-xl bg-emerald-50/75 border border-emerald-200/90 text-[10.5px] text-emerald-950 leading-snug">
                <strong>Step 4 Locked:</strong> Authorized in Step 5 by SSD OV27 Committee. Step 4
                votes can no longer be edited unless reopened.
              </p>
            </div>
          ) : isLiaison ? (
            <div className="pt-2 border-t border-indigo-100">
              <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[10.5px] text-slate-600 leading-snug">
                <strong>View-only for {unionAcronym}:</strong> Voting is assigned to{' '}
                <strong>{assignedLiaisonNames || 'assigned Voting Liaisons'}</strong>. Switch to one
                of your assigned Voting Unions to vote.
              </p>
            </div>
          ) : null
        ) : (
          sharedCanPostNote && (
            <button
              type="button"
              onClick={sharedDraftCoaching}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-[11px] transition cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>
                {flaggedCount > 0
                  ? `Send ${flaggedCount} Coaching Items to Notes`
                  : 'Open Review Notes Chat'}
              </span>
            </button>
          )
        )}

        {/* Quick Floating Review Notes Launcher inside Card Footer */}
        {onOpenNotesChat && (
          <button
            type="button"
            onClick={onOpenNotesChat}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-[11px] transition cursor-pointer whitespace-nowrap tabular-nums"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Open Floating Review Notes ({liaisonReview.reviewNotes.length})</span>
          </button>
        )}
      </div>
    );
  };

  const renderStep4LiaisonCard = () => {
    if (liaisonReview) {
      return renderCompactSidebarStep4Summary();
    }
    if (isProposalApproved) {
      const nextUnvotedAcronym = nextUnvotedProposal
        ? UNION_ACRONYMS[getCanonicalUnion(nextUnvotedProposal.union)] ||
          nextUnvotedProposal.union ||
          'SSD'
        : '';

      return (
        <div className="bg-white rounded-2xl border border-indigo-200/90 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-indigo-100 pb-2">
            <h3 className="text-xs font-extrabold text-slate-900">
              Step 4 · Division Liaison Vote
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  stepStatus.step4Complete
                    ? 'text-emerald-700'
                    : stepStatus.liaisonSummary.hasRevisionRequested
                    ? 'text-amber-700'
                    : 'text-indigo-800'
                }`}
              >
                {stepStatus.liaisonSummary.progressLabel}
              </span>
              <button
                type="button"
                onClick={() => setShowStep4Guide((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer whitespace-nowrap ${
                  showStep4Guide
                    ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-200'
                }`}
                title="How Step 4 Liaison Review & Voting works"
              >
                <HelpCircle className="w-3 h-3 shrink-0" />
                <span>Guide</span>
              </button>
            </div>
          </div>

          {/* Built-In Collapsible Quick Guide for Liaisons */}
          {showStep4Guide && (
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/90 text-[11px] text-slate-700 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-indigo-950">How Step 4 Works</span>
                <button
                  type="button"
                  onClick={() => setShowStep4Guide(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Close Step 4 guide"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <ol className="list-decimal pl-4 space-y-1 leading-snug text-[10.5px]">
                <li>
                  Read the proposal and expand the <strong>7-Question Rubric</strong> to verify
                  details or click <strong>Flag Fix</strong> on any missing section.
                </li>
                <li>
                  Click <strong>Vote &amp; Recommend to OV27</strong> when ready, or{' '}
                  <strong>Request Revision</strong> to hold it for changes.
                </li>
                <li>
                  You can click <strong>Edit Vote</strong> anytime before Step 5 authorization.
                </li>
                <li>
                  Your vote advances this proposal to <strong>Step 5 (SSD OV27 Committee)</strong>{' '}
                  — it is not final approval. After a Revision Request, the{' '}
                  <strong>Union Treasurer</strong> clicks <strong>Reopen Review</strong> to unlock
                  the form for edits.
                </li>
              </ol>
            </div>
          )}

          {/* Post-Vote Confirmation Banner */}
          {justSavedVoteBanner && (
            <div
              className={`flex items-start justify-between gap-2 p-2.5 rounded-xl border text-[11px] leading-snug ${
                justSavedVoteBanner === 'recommended'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {justSavedVoteBanner === 'recommended' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                )}
                <span>
                  {justSavedVoteBanner === 'recommended'
                    ? 'Step 4 vote saved. Proposal is recommended to the SSD OV27 Committee (Step 5).'
                    : 'Revision request saved. The Union Treasurer has been notified and can click Reopen Review to unlock the form.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setJustSavedVoteBanner(null)}
                className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
                aria-label="Dismiss confirmation"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Assigned Liaisons & Recorded Votes Roster */}
          {assignedDivisionLiaisons.length > 0 || (proposal.liaisonVotes || []).length > 0 ? (
            <div className="space-y-2">
              {assignedDivisionLiaisons.map((liaison) => {
                const lEmail = (liaison.email || '').trim().toLowerCase();
                const recordedVote = (proposal.liaisonVotes || []).find(
                  (v) =>
                    (liaison.uid && v.liaisonUid === liaison.uid) ||
                    (lEmail && (v.liaisonEmail || '').trim().toLowerCase() === lEmail)
                );
                return (
                  <div
                    key={liaison.uid || liaison.email}
                    className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                      recordedVote?.vote === 'recommended'
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : recordedVote?.vote === 'revision_requested'
                        ? 'bg-amber-50/70 border-amber-200'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {liaison.displayName || liaison.email}
                        </p>
                        {liaison.email && (
                          <p className="text-[10px] text-slate-500 truncate">{liaison.email}</p>
                        )}
                      </div>
                      {recordedVote?.vote === 'recommended' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Voted ✓</span>
                        </span>
                      ) : recordedVote?.vote === 'revision_requested' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Revision</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white text-slate-500 border border-slate-200 shrink-0">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          <span>Pending Vote</span>
                        </span>
                      )}
                    </div>
                    {recordedVote?.readinessRating && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="text-slate-500">SSD Rubric:</span>
                        <span
                          className={
                            recordedVote.readinessRating === 'meeting_requirement'
                              ? 'text-emerald-800'
                              : recordedVote.readinessRating === 'needs_improvement'
                              ? 'text-amber-800'
                              : 'text-rose-800'
                          }
                        >
                          {REVIEW_READINESS_LABELS[recordedVote.readinessRating]}
                        </span>
                      </div>
                    )}
                    {recordedVote?.actionItems && recordedVote.actionItems.length > 0 && (
                      <div className="space-y-1 bg-white/90 p-2 rounded-lg border border-amber-200/90">
                        <p className="text-[10px] font-bold text-amber-950">
                          Section Changes Requested ({recordedVote.actionItems.length}):
                        </p>
                        {recordedVote.actionItems.map((item) => (
                          <div
                            key={item.criterionKey}
                            className="text-[10px] text-slate-700 leading-snug"
                          >
                            <button
                              type="button"
                              onClick={() => handleScrollToProposalSection(item.sectionId)}
                              className="font-bold text-[#1c398e] hover:underline cursor-pointer"
                            >
                              {item.sectionLabel} ↗
                            </button>
                            <span>: {item.instruction}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {recordedVote?.recommendation &&
                      (!recordedVote?.actionItems?.length ||
                        !recordedVote.recommendation.includes('Specific Changes Requested:')) && (
                        <p className="text-[11px] text-slate-700 italic bg-white/80 p-2 rounded-lg border border-slate-200/70 leading-relaxed whitespace-pre-wrap">
                          "{recordedVote.recommendation}"
                        </p>
                      )}
                  </div>
                );
              })}

              {/* Also render any votes cast by Liaisons/Admins not in the Union's assigned roster */}
              {(proposal.liaisonVotes || [])
                .filter((v) => {
                  const vEmail = (v.liaisonEmail || '').trim().toLowerCase();
                  return !assignedDivisionLiaisons.some(
                    (l) =>
                      (l.uid && l.uid === v.liaisonUid) ||
                      (vEmail && (l.email || '').trim().toLowerCase() === vEmail)
                  );
                })
                .map((recordedVote, idx) => (
                  <div
                    key={recordedVote.liaisonUid || recordedVote.liaisonEmail || idx}
                    className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                      recordedVote.vote === 'recommended'
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-amber-50/70 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {recordedVote.liaisonName}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {recordedVote.liaisonEmail}
                        </p>
                      </div>
                      {recordedVote.vote === 'recommended' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Voted ✓</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Revision</span>
                        </span>
                      )}
                    </div>
                    {recordedVote.readinessRating && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="text-slate-500">SSD Rubric:</span>
                        <span
                          className={
                            recordedVote.readinessRating === 'meeting_requirement'
                              ? 'text-emerald-800'
                              : recordedVote.readinessRating === 'needs_improvement'
                              ? 'text-amber-800'
                              : 'text-rose-800'
                          }
                        >
                          {REVIEW_READINESS_LABELS[recordedVote.readinessRating]}
                        </span>
                      </div>
                    )}
                    {recordedVote.actionItems && recordedVote.actionItems.length > 0 && (
                      <div className="space-y-1 bg-white/90 p-2 rounded-lg border border-amber-200/90">
                        <p className="text-[10px] font-bold text-amber-950">
                          Section Changes Requested ({recordedVote.actionItems.length}):
                        </p>
                        {recordedVote.actionItems.map((item) => (
                          <div
                            key={item.criterionKey}
                            className="text-[10px] text-slate-700 leading-snug"
                          >
                            <button
                              type="button"
                              onClick={() => handleScrollToProposalSection(item.sectionId)}
                              className="font-bold text-[#1c398e] hover:underline cursor-pointer"
                            >
                              {item.sectionLabel} ↗
                            </button>
                            <span>: {item.instruction}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {recordedVote.recommendation &&
                      (!recordedVote.actionItems?.length ||
                        !recordedVote.recommendation.includes('Specific Changes Requested:')) && (
                        <p className="text-[11px] text-slate-700 italic bg-white/80 p-2 rounded-lg border border-slate-200/70 leading-relaxed whitespace-pre-wrap">
                          "{recordedVote.recommendation}"
                        </p>
                      )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-indigo-50/40 border border-dashed border-indigo-200 text-[11px] text-slate-600 leading-relaxed">
              No Division Liaison is registered for <strong>{unionAcronym}</strong> yet. Assigned
              Liaisons will appear here automatically once they sign in.
            </div>
          )}

          {/* Collapsible SSD 7-Question Review Framework Rubric */}
          <div className="pt-2 border-t border-indigo-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsRubricExpanded((prev) => !prev)}
                className="flex-1 flex items-center justify-between gap-2 text-left py-1 text-[11px] font-bold text-slate-800 hover:text-[#1c398e] transition cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">7-Question Rubric</span>
                  <span
                    className={`font-bold tabular-nums shrink-0 ${
                      selectedDeficientCriteria.length === 0
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    ({7 - selectedDeficientCriteria.length}/7 OK
                    {selectedDeficientCriteria.length > 0
                      ? ` · ${selectedDeficientCriteria.length} flagged`
                      : ''}
                    )
                  </span>
                </span>
                {isRubricExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </button>
              <a
                href={REVIEW_FRAMEWORK_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:underline shrink-0"
                title="Open official Southern Asia-Pacific Division OneVoice27 Project Review Framework PDF"
              >
                <span>PDF</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            {frameworkEval.hasSplitLiaisonVerdict && (
              <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-950 font-medium">
                <strong>Split Liaison Verdicts:</strong> Assigned Liaisons recorded differing
                rubric ratings above; portfolio summary reflects the more cautious rating until
                aligned.
              </div>
            )}

            {isRubricExpanded && renderEvidenceRubricPanel('step4_vote')}
          </div>

          {/* Interactive Step 4 Liaison Vote & Recommendation Box */}
          {canVoteStep4 ? (
            <div className="pt-2 border-t border-indigo-100 space-y-2">
              {myExistingVote && !isEditingMyVote ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-950 font-bold min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                      <span className="truncate">
                        Your Vote:{' '}
                        {myExistingVote.vote === 'recommended'
                          ? 'Recommended ✓'
                          : 'Revision Requested'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingMyVote(true);
                        setJustSavedVoteBanner(null);
                      }}
                      className="text-[11px] font-bold text-[#1c398e] hover:underline shrink-0 cursor-pointer whitespace-nowrap"
                    >
                      Edit Vote
                    </button>
                  </div>

                  {/* Next Unvoted Proposal CTA after voting */}
                  {onSelectProposal && nextUnvotedProposal ? (
                    <button
                      type="button"
                      onClick={() => onSelectProposal(nextUnvotedProposal.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white transition cursor-pointer shadow-2xs"
                    >
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-bold leading-tight">Next Unvoted Proposal</p>
                        <p className="text-[10px] text-blue-100 truncate">
                          [{nextUnvotedAcronym}] {nextUnvotedProposal.title || 'Untitled proposal'}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  ) : onSelectProposal && hasNext ? (
                    <button
                      type="button"
                      onClick={() => onSelectProposal(navigableProposals[currentIndex + 1].id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                    >
                      <span>Next Proposal in List</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  ) : onBack && backTargetLabel ? (
                    <button
                      type="button"
                      onClick={onBack}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold text-xs transition cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>All Caught Up · Back to {backTargetLabel}</span>
                    </button>
                  ) : null}
                </div>
              ) : selectedDeficientCriteria.length > 0 ? (
                <div
                  className={`space-y-2.5 p-3 rounded-xl border transition ${
                    minorCoachingOnlyRecommend
                      ? 'bg-indigo-50/50 border-indigo-200/90'
                      : 'bg-amber-50/70 border-amber-300'
                  }`}
                >
                  <div className="space-y-1">
                    <label
                      className={`block text-[11px] font-extrabold tabular-nums ${
                        minorCoachingOnlyRecommend ? 'text-indigo-950' : 'text-amber-950'
                      }`}
                    >
                      {minorCoachingOnlyRecommend
                        ? `Step 4 Decision · Recommend with Coaching (${selectedDeficientCriteria.length})`
                        : `Step 4 Decision · Request Revision (${selectedDeficientCriteria.length} ${
                            selectedDeficientCriteria.length === 1 ? 'Section' : 'Sections'
                          } Flagged)`}
                    </label>
                    <p className="text-[10px] text-slate-600 leading-snug">
                      Flagged:{' '}
                      <strong className="text-slate-800">
                        {selectedDeficientCriteria
                          .map((k) => {
                            const q = frameworkEval.questions.find((item) => item.key === k);
                            return q ? `Q${q.number}` : k;
                          })
                          .join(', ')}
                      </strong>
                      .{' '}
                      <button
                        type="button"
                        onClick={() => setIsRubricExpanded((prev) => !prev)}
                        className="font-bold text-[#1c398e] hover:underline cursor-pointer"
                      >
                        {isRubricExpanded ? 'Hide rubric' : 'Review flags'}
                      </button>
                      {' · '}
                      <button
                        type="button"
                        onClick={handleClearAllRubricFlags}
                        className="font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        Clear flags (7/7 ready)
                      </button>
                    </p>
                  </div>

                  <textarea
                    rows={2}
                    value={liaisonRecommendationText}
                    onChange={(e) => setLiaisonRecommendationText(e.target.value)}
                    placeholder="Optional: Add an overall note for the author and Union Treasurer (flagged items attach automatically)..."
                    className={`w-full px-3 py-2 rounded-xl bg-white border text-xs text-slate-800 placeholder-slate-400 outline-none transition resize-none ${
                      minorCoachingOnlyRecommend
                        ? 'border-indigo-200 focus:border-indigo-600'
                        : 'border-amber-300 focus:border-amber-600'
                    }`}
                  />

                  {liaisonVoteError && (
                    <p className="text-[11px] text-rose-600 font-medium">{liaisonVoteError}</p>
                  )}

                  {minorCoachingOnlyRecommend ? (
                    <button
                      type="button"
                      disabled={isSubmittingLiaisonVote}
                      onClick={() => handleCastLiaisonVote('recommended')}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isSubmittingLiaisonVote
                          ? 'Recording Vote...'
                          : 'Vote & Recommend (with Coaching Note)'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmittingLiaisonVote}
                      onClick={() => handleCastLiaisonVote('revision_requested')}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap tabular-nums"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isSubmittingLiaisonVote
                          ? 'Sending Revision Request...'
                          : `Request Revision (${selectedDeficientCriteria.length} ${
                              selectedDeficientCriteria.length === 1 ? 'Section' : 'Sections'
                            })`}
                      </span>
                    </button>
                  )}

                  <label className="flex items-center gap-2 text-[10px] text-slate-600 cursor-pointer select-none pt-0.5">
                    <input
                      type="checkbox"
                      checked={minorCoachingOnlyRecommend}
                      onChange={(e) => setMinorCoachingOnlyRecommend(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>
                      Minor coaching note only — still <strong>Vote &amp; Recommend to OV27</strong>
                    </span>
                  </label>
                </div>
              ) : (
                <div className="space-y-2 bg-indigo-50/40 p-3 rounded-xl border border-indigo-200/80">
                  <label className="block text-[11px] font-extrabold text-indigo-950 tabular-nums">
                    {myExistingVote
                      ? 'Update Step 4 Decision · Ready to Recommend (7/7)'
                      : 'Step 4 Decision · Ready to Recommend (7/7)'}
                  </label>
                  <textarea
                    rows={2}
                    value={liaisonRecommendationText}
                    onChange={(e) => setLiaisonRecommendationText(e.target.value)}
                    placeholder="Optional: Add an encouraging note or committee remark..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-600 outline-none transition resize-none"
                  />
                  {liaisonVoteError && (
                    <p className="text-[11px] text-rose-600 font-medium">{liaisonVoteError}</p>
                  )}
                  <button
                    type="button"
                    disabled={isSubmittingLiaisonVote}
                    onClick={() => handleCastLiaisonVote('recommended')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isSubmittingLiaisonVote
                        ? 'Recording Vote...'
                        : 'Vote & Recommend to OV27'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRubricExpanded(true)}
                    className="w-full text-center text-[10px] font-semibold text-slate-500 hover:text-[#1c398e] transition cursor-pointer"
                  >
                    Need changes first? Open the 7-Question Rubric ↑
                  </button>
                </div>
              )}
            </div>
          ) : isInviteeLiaison ? (
            <div className="pt-2 border-t border-indigo-100">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Invitee Access · View &amp; Comment Only</span>
                </div>
                <p className="leading-relaxed">
                  Formal Step 4 voting for <strong>{unionAcronym}</strong> is reserved for assigned
                  Voting Liaisons. Expand the <strong>7-Question Rubric</strong> above to draft
                  advisory coaching into <strong>Review Notes</strong> below.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (isLiaison) {
      return (
        <div className="bg-white rounded-2xl border border-indigo-200/90 p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-slate-900">
              Step 4 · Division Liaison Advisory
            </h3>
            <a
              href={REVIEW_FRAMEWORK_PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:underline shrink-0"
              title="Open official SSD OneVoice27 Project Review Framework PDF"
            >
              <span>Review Framework PDF</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Step 4 formal Liaison voting unlocks once <strong>{unionAcronym}</strong> records its
            Step 3 Union Committee vote. You can evaluate the 7-Question Rubric now and post early
            coaching in <strong>Review Notes</strong> below.
          </p>

          <button
            type="button"
            onClick={() => setIsRubricExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-indigo-50/60 hover:bg-indigo-100/70 border border-indigo-200/80 text-[11px] font-bold text-indigo-950 transition cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
              <span>
                SSD 7-Question Coaching Rubric ({7 - selectedDeficientCriteria.length}/7 OK)
              </span>
            </span>
            {isRubricExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            )}
          </button>

          {isRubricExpanded && renderEvidenceRubricPanel('advisory_note')}
        </div>
      );
    }

    return null;
  };

  return (
    <aside className="w-full lg:w-88 xl:w-96 shrink-0 space-y-4 self-start">
      {/* Card 0: Navigation & Proposal Switcher (Housed directly in Sidebar) */}
      {(onBack || (navigableProposals.length > 1 && onSelectProposal)) && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs space-y-2.5">
          {onBack && backTargetLabel && (
            <button
              type="button"
              onClick={onBack}
              className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/90 text-slate-800 font-bold text-xs transition cursor-pointer active:scale-98"
            >
              <span className="inline-flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>Back to {backTargetLabel}</span>
              </span>
              {currentIndex >= 0 && navigableProposals.length > 1 && (
                <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                  {currentIndex + 1} of {navigableProposals.length}
                </span>
              )}
            </button>
          )}

          {navigableProposals.length > 1 && onSelectProposal && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/90 rounded-xl p-1">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => {
                  if (hasPrev) {
                    onSelectProposal(navigableProposals[currentIndex - 1].id);
                  }
                }}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 transition cursor-pointer shrink-0"
                title="Previous proposal"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <select
                value={proposal.id}
                onChange={(e) => onSelectProposal(e.target.value)}
                aria-label="Switch active proposal"
                className="flex-1 min-w-0 bg-transparent text-xs font-bold text-slate-800 px-1.5 py-1 outline-none truncate cursor-pointer"
              >
                {navigableProposals.map((p, idx) => {
                  const acr = UNION_ACRONYMS[p.union] || p.union || 'SSD';
                  const label = p.title?.trim() || 'Untitled proposal';
                  return (
                    <option key={p.id} value={p.id}>
                      {idx + 1}/{navigableProposals.length} · [{acr}] {label}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                disabled={!hasNext}
                onClick={() => {
                  if (hasNext) {
                    onSelectProposal(navigableProposals[currentIndex + 1].id);
                  }
                }}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-35 transition cursor-pointer shrink-0"
                title="Next proposal"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* For Division Liaisons, promote Step 4 Review & Vote directly above Governance Dossier */}
      {isLiaison && renderStep4LiaisonCard()}

      {/* Card 1: Governance Dossier & 5-Step Status (Adapts cleanly for Pre-Approval & Approved) */}
      <div
        className={`bg-white rounded-2xl border shadow-2xs overflow-hidden ${
          isProposalApproved
            ? 'border-emerald-200/90'
            : proposal.status === 'under_review'
            ? 'border-amber-200/90'
            : 'border-slate-200/90'
        }`}
      >
        <div
          className={`px-4 py-3.5 text-white ${
            isProposalApproved
              ? 'bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900'
              : proposal.status === 'under_review'
              ? 'bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900'
              : proposal.status === 'submitted'
              ? 'bg-gradient-to-r from-[#1c398e] via-blue-900 to-slate-900'
              : 'bg-slate-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                isProposalApproved
                  ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/30'
                  : proposal.status === 'under_review'
                  ? 'bg-amber-400/20 text-amber-100 border-amber-300/30'
                  : 'bg-white/15 text-white border-white/20'
              }`}
              title={stepStatus.currentStepDescription}
            >
              {isProposalApproved ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-300" />
              ) : proposal.status === 'under_review' ? (
                <Clock className="w-3 h-3 text-amber-300" />
              ) : (
                <Send className="w-3 h-3 text-blue-200" />
              )}
              <span>
                {isProposalApproved
                  ? stepStatus.currentStepShortBadge
                  : proposal.status === 'under_review'
                  ? 'Step 2 · Union Review'
                  : proposal.status === 'submitted'
                  ? 'Step 1 · Submitted'
                  : 'Draft · Pre-Step 1'}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-white/15 text-white tracking-wide">
              {unionAcronym}
            </span>
          </div>

          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/80 font-semibold">
                {isProposalApproved ? 'Approved Grant Request' : 'Requested Grant'}
              </p>
              <p className="text-xl font-black tracking-tight tabular-nums text-white">
                ${formatCurrency(totalFunding)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/80 font-semibold">
                {isProposalApproved ? 'Union Action #' : 'Form Readiness'}
              </p>
              {isProposalApproved ? (
                <p
                  className="text-xs font-extrabold text-emerald-100 truncate max-w-[160px]"
                  title={actionNumber}
                >
                  #{actionNumber}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!validationResult.isValid) {
                      onShowValidation?.(
                        validationResult.errors,
                        validationResult.completionPercentage
                      );
                    }
                  }}
                  className={`text-xs font-extrabold tabular-nums ${
                    validationResult.isValid
                      ? 'text-emerald-200'
                      : 'text-amber-200 underline cursor-pointer'
                  }`}
                  title={
                    validationResult.isValid
                      ? 'All required fields completed'
                      : `Missing ${validationResult.errors.length} required fields — click to inspect`
                  }
                >
                  {validationResult.completionPercentage}% Complete
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Union Territory & Governance Steps */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Union Territory</span>
              {isSuperAdmin ? (
                <select
                  value={assignedUnion}
                  onChange={(e) => onUpdateProposal(proposal.id, { union: e.target.value })}
                  className="text-[11px] font-bold text-slate-800 bg-amber-50/70 border border-amber-300 rounded-lg px-2 py-1 outline-none focus:border-amber-500 cursor-pointer max-w-[190px] truncate"
                  title="Super Admin: Reassign proposal to another Union"
                >
                  {UNION_CATEGORIES.map((cat) => (
                    <optgroup key={cat.category} label={cat.category}>
                      {cat.unions.map((u) => (
                        <option key={u} value={u}>
                          {UNION_ACRONYMS[u] ? `[${UNION_ACRONYMS[u]}] ` : ''}
                          {u}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <span
                  className="font-bold text-slate-800 truncate max-w-[190px]"
                  title={assignedUnion}
                >
                  [{unionAcronym}] {assignedUnion}
                </span>
              )}
            </div>

            {isProposalApproved ? (
              <>
                {/* Step 3: Union Committee Vote */}
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Step 3 · Union Vote</span>
                  <span className="font-bold text-emerald-800 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Voted #{actionNumber}</span>
                  </span>
                </div>

                {approvalDate && (
                  <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Committee Date</span>
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {new Date(approvalDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {approvedByName && (
                  <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Recorded By</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                      {approvedByName}
                    </span>
                  </div>
                )}

                {/* Step 4: Division Liaison Review & Vote */}
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Step 4 · Liaison Vote</span>
                  {stepStatus.step4Complete ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      <span>{stepStatus.liaisonSummary.progressLabel}</span>
                    </span>
                  ) : stepStatus.liaisonSummary.hasRevisionRequested ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <AlertTriangle className="w-3 h-3 text-amber-700" />
                      <span>Revision Requested</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      <Clock className="w-3 h-3 text-indigo-600" />
                      <span>{stepStatus.liaisonSummary.progressLabel}</span>
                    </span>
                  )}
                </div>

                {/* Step 5: SSD OV27 Committee Authorization */}
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-500 font-medium">Step 5 · SSD OV27 Committee</span>
                  {isDivisionAuthorized ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (canAuthorizeDivision) setIsDivisionAuthModalOpen(true);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 ${
                        canAuthorizeDivision
                          ? 'hover:bg-emerald-200 cursor-pointer'
                          : 'cursor-default'
                      }`}
                      title={
                        canAuthorizeDivision
                          ? 'Click to manage Step 5 SSD OV27 Committee authorization'
                          : 'Authorized by SSD OV27 Committee'
                      }
                    >
                      <ShieldCheck className="w-3 h-3 text-emerald-700" />
                      <span>{proposal.divisionApproval?.referenceNumber || 'Authorized ✓'}</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>
                        {stepStatus.liaisonSummary.allLiaisonsVoted
                          ? 'Ready for OV27 Vote'
                          : 'Pending OV27 Auth'}
                      </span>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Step 1 · Submission</span>
                  <span className="font-semibold text-slate-800">
                    {proposal.status === 'draft' ? 'In Draft' : 'Submitted ✓'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Step 2 · Union Review</span>
                  <span className="font-semibold text-slate-800">
                    {proposal.status === 'under_review' ? 'Under Active Review' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="text-slate-500 font-medium">Step 3 · Union Vote</span>
                  <span className="font-semibold text-slate-500">Awaiting Committee Vote</span>
                </div>
              </>
            )}
          </div>

          {/* Committee Minutes Excerpt (if recorded) */}
          {isProposalApproved && minutesExcerpt && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 inline-flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-500" />
                  <span>Committee Minutes</span>
                </span>
                {minutesExcerpt.length > 140 && (
                  <button
                    type="button"
                    onClick={() => setShowFullMinutes((prev) => !prev)}
                    className="text-[10px] font-bold text-[#1c398e] hover:underline cursor-pointer"
                  >
                    {showFullMinutes ? 'Show less' : 'Read full'}
                  </button>
                )}
              </div>
              <p className="italic leading-relaxed text-slate-600">
                "
                {showFullMinutes || minutesExcerpt.length <= 140
                  ? minutesExcerpt
                  : `${minutesExcerpt.slice(0, 140)}...`}
                "
              </p>
            </div>
          )}

          {/* Consolidated Action Buttons */}
          <div className="pt-1 space-y-2">
            {isProposalApproved ? (
              <>
                {/* Prominent Step 4 Liaison Revision Unlock Callout (Option 1 Governance Handoff) */}
                {!isDivisionAuthorized &&
                  stepStatus.liaisonSummary.hasRevisionRequested &&
                  !isLiaison &&
                  (canReopen ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-extrabold text-amber-950">
                            Action Needed · Liaison Requested Revisions
                          </p>
                          <p className="text-[11px] text-amber-900 leading-relaxed">
                            Division Liaison flagged section updates in Step 4. Unlock this
                            proposal so the author can edit and resubmit while preserving Action #
                            {actionNumber} in history.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReopenModalOpen(true)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>Reopen Review for Author Revisions</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-extrabold text-amber-950">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Step 4 Revisions Requested · Locked</span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        Review the flagged sections in the Step 4 card below. Ask your{' '}
                        <strong>Union Treasurer</strong> to click <strong>Reopen Review</strong> so
                        you can edit the form.
                      </p>
                    </div>
                  ))}

                {/* Step 5 Direct Authorize Button for SSD OV27 Committee / Super Admins */}
                {canAuthorizeDivision &&
                  !isDivisionAuthorized &&
                  (stepStatus.liaisonSummary.allLiaisonsVoted ? (
                    <button
                      type="button"
                      onClick={() => setIsDivisionAuthModalOpen(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer active:scale-98"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Step 5: Authorize (SSD OV27 Committee)</span>
                    </button>
                  ) : isSuperAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsDivisionAuthModalOpen(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 font-bold text-xs shadow-2xs transition cursor-pointer active:scale-98"
                      title="Step 4 Liaison vote not recorded yet. Click to open Step 5 with Super Admin Override checkbox."
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Step 5: Authorize (Admin Override)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 font-semibold text-xs cursor-not-allowed"
                      title="Locked: All assigned Division Liaisons must vote in Step 4 before Step 5 authorization."
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Step 5 Locked · Awaiting Step 4 Liaison Vote</span>
                    </button>
                  ))}

                {/* Governance Actions for Authorized Treasurers & Super Admins (Edit Action / Reopen Review) */}
                {!isLiaison &&
                  canManageStep3 &&
                  (canReopen ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsApprovalModalOpen(true)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition cursor-pointer"
                        title="Edit Step 3 voted committee action number, date, or minutes excerpt"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>Edit Step 3 Vote</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsReopenModalOpen(true)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-amber-50 border border-slate-200/90 hover:border-amber-300 text-slate-700 hover:text-amber-900 text-xs font-bold transition cursor-pointer"
                        title="Reopen review to unlock this proposal for edits"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Reopen Review</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold"
                      title="Authorized in Step 5 by SSD OV27 Committee. Contact SSD Division Treasury if this proposal needs to be reopened."
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Locked · Step 5 OV27 Authorized</span>
                    </div>
                  ))}
              </>
            ) : !isLiaison ? (
              <div className="space-y-2">
                {(proposal.status === 'submitted' || proposal.status === 'under_review') &&
                  canManageStep3 && (
                    <button
                      type="button"
                      onClick={handleOpenStep3VoteModal}
                      className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer active:scale-98"
                      title="Record official Step 3 Union Committee Action Number & approve proposal"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Step 3: Record Union Vote</span>
                    </button>
                  )}

                {proposal.status === 'submitted' && canManageStep2Review && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreApprovalStatusChange('under_review')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white text-xs font-bold transition cursor-pointer"
                      title="Move proposal into Step 2 active Union review"
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Start Review</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreApprovalStatusChange('draft')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      title="Return proposal to author as Draft for revisions"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Return to Draft</span>
                    </button>
                  </div>
                )}

                {proposal.status === 'under_review' && canManageStep2Review && (
                  <button
                    type="button"
                    onClick={() => handlePreApprovalStatusChange('draft')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                    title="Return proposal to author as Draft for revisions"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Return to Draft</span>
                  </button>
                )}

                {proposal.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSubmitProposal) {
                        onSubmitProposal();
                      } else {
                        handlePreApprovalStatusChange('submitted');
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-xs shadow-2xs transition cursor-pointer active:scale-98"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Step 1: Submit Proposal</span>
                  </button>
                )}
              </div>
            ) : null}

            {/* Utility Actions (Copy Direct Link / Print PDF) */}
            <div className="grid grid-cols-2 gap-2">
              {onCopyDirectLink && (
                <button
                  type="button"
                  onClick={onCopyDirectLink}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200/90 text-slate-700'
                  }`}
                  title="Copy direct URL to this proposal"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              )}

              {onOpenPrint && (
                <button
                  type="button"
                  onClick={onOpenPrint}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 text-xs font-bold transition cursor-pointer"
                  title="Print or export PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print / PDF</span>
                </button>
              )}
            </div>

            {/* Collapsible Governance History Timeline (Visible to all roles) */}
            {activityHistory.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGovernanceHistory((prev) => !prev)}
                  className="w-full flex items-center justify-between text-[11px] font-bold text-slate-600 hover:text-slate-900 py-1 transition cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>Governance History ({activityHistory.length})</span>
                  </span>
                  {showGovernanceHistory ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
                {showGovernanceHistory && (
                  <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                    {[...activityHistory].reverse().map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-800 truncate">{ev.actorName}</span>
                          <span className="text-[9px] text-slate-400 shrink-0 tabular-nums">
                            {new Date(ev.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-600 leading-snug">{ev.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card 1A: Impact Plausibility, Territory Scale & UPG Relevance Check */}
      <ProposalPlausibilityCard proposal={proposal} variant="sidebar" />

      {/* Card 1B: Step 4 · Division Liaison Review & Vote Card (shown here for non-liaison roles) */}
      {!isLiaison && renderStep4LiaisonCard()}

      {/* Card 2: Proposal Contacts (Point of Contact / Owner, Union Lead, & Liaisons) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-50 border border-blue-200/70 text-[#1c398e] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">
                Proposal Leadership &amp; Contacts
              </h3>
              <p className="text-[10px] text-slate-500">
                Point of Contact, Union Lead &amp; Liaisons
              </p>
            </div>
          </div>
        </div>

        {/* 1. Point of Contact / Proposal Owner */}
        <div className="p-3 rounded-xl bg-[#f8fafc] border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e]">
              Point of Contact
            </span>
            {isSuperAdmin && onOpenTransferOwnership ? (
              <button
                type="button"
                onClick={onOpenTransferOwnership}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold transition cursor-pointer"
                title="Super Admin: Reassign ownership of this proposal to another user"
              >
                <ArrowRightLeft className="w-2.5 h-2.5 text-amber-700" />
                <span>Transfer</span>
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-slate-500">Project Director</span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{pocName}</span>
          </p>
          {pocEmail && (
            <a
              href={`mailto:${pocEmail}`}
              className="text-[11px] text-blue-700 hover:underline flex items-center gap-1.5 truncate"
              title={pocEmail}
            >
              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{pocEmail}</span>
            </a>
          )}
          {pocPhone && (
            <a
              href={`tel:${pocPhone}`}
              className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{pocPhone}</span>
            </a>
          )}
        </div>

        {/* 2. Union Lead */}
        <div className="p-3 rounded-xl bg-[#f8fafc] border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
              Union Lead
            </span>
            <span className="text-[10px] font-semibold text-slate-500">{unionAcronym}</span>
          </div>

          {unionLeadName || unionLeadEmail || unionLeadPhone ? (
            <>
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{unionLeadName || 'Union Lead'}</span>
              </p>
              {unionLeadEmail && (
                <a
                  href={`mailto:${unionLeadEmail}`}
                  className="text-[11px] text-blue-700 hover:underline flex items-center gap-1.5 truncate"
                  title={unionLeadEmail}
                >
                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{unionLeadEmail}</span>
                </a>
              )}
              {unionLeadPhone && (
                <a
                  href={`tel:${unionLeadPhone}`}
                  className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                >
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{unionLeadPhone}</span>
                </a>
              )}
            </>
          ) : registeredUnionLeads.length > 0 ? (
            <div className="space-y-2 pt-0.5">
              {registeredUnionLeads.map((lead) => (
                <div key={lead.uid || lead.email} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {lead.displayName || lead.email}
                    </p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                      {lead.role === 'treasurer' ? 'Treasurer' : 'Coordinator'}
                    </span>
                  </div>
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-[11px] text-blue-700 hover:underline flex items-center gap-1.5 truncate"
                    >
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{lead.email}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              No Union Lead contact listed on form
            </p>
          )}
        </div>

        {/* 3. Division Liaisons & Advisors */}
        <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">
              Division Liaison(s)
            </span>
            <span className="text-[10px] font-semibold text-indigo-700">SSD Advisory</span>
          </div>

          {proposalLiaisonName || proposalLiaisonEmail || proposalLiaisonPhone ? (
            <div className="space-y-1 pb-1.5 border-b border-indigo-100">
              <p className="text-xs font-bold text-slate-900">
                {proposalLiaisonName || 'Assigned Liaison'}
              </p>
              {proposalLiaisonEmail && (
                <a
                  href={`mailto:${proposalLiaisonEmail}`}
                  className="text-[11px] text-indigo-700 hover:underline flex items-center gap-1.5 truncate"
                >
                  <Mail className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{proposalLiaisonEmail}</span>
                </a>
              )}
              {proposalLiaisonPhone && (
                <a
                  href={`tel:${proposalLiaisonPhone}`}
                  className="text-[11px] text-slate-600 flex items-center gap-1.5"
                >
                  <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>{proposalLiaisonPhone}</span>
                </a>
              )}
            </div>
          ) : null}

          {assignedDivisionLiaisons.length > 0 ? (
            <div className="space-y-2">
              {assignedDivisionLiaisons.map((liaison) => (
                <div key={liaison.uid || liaison.email} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-xs font-bold text-indigo-950 truncate">
                      {liaison.displayName || liaison.email}
                    </p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200/60 shrink-0">
                      Liaison
                    </span>
                  </div>
                  {liaison.email && (
                    <a
                      href={`mailto:${liaison.email}`}
                      className="text-[11px] text-indigo-700 hover:underline flex items-center gap-1.5 truncate"
                      title={liaison.email}
                    >
                      <Mail className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="truncate">{liaison.email}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : !proposalLiaisonName && !proposalLiaisonEmail ? (
            <p className="text-[11px] text-slate-500 italic">
              No Division Liaison assigned to {unionAcronym} yet.
            </p>
          ) : null}
        </div>
      </div>

      {/* Card 3: Inline Review Notes & Liaison Advisory Board (Only rendered in sidebar when bottom review section is NOT mounted) */}
      {!liaisonReview && (
      <div
        id="proposal-review-notes"
        className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3 transition-all"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900">Review Notes &amp; Remarks</h3>
              <p className="text-[10px] text-slate-500">
                Direct notes between Liaisons, Treasurers &amp; POC
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {reviewNotes.length}
          </span>
        </div>

        {/* Notes Thread */}
        {reviewNotes.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {reviewNotes.map((note) => {
              const matchedLiaison =
                note.authorRole === 'division_liaison' && note.authorEmail
                  ? directoryUsers.find(
                      (u) => u.email.toLowerCase() === note.authorEmail.toLowerCase()
                    )
                  : undefined;
              const isNoteFromInvitee =
                note.authorRole === 'division_liaison' &&
                (Boolean(note.isInvitee) ||
                  (matchedLiaison ? isUserInviteeForUnion(assignedUnion, matchedLiaison) : false));

              const roleBadge =
                note.authorRole === 'division_liaison'
                  ? isNoteFromInvitee
                    ? 'Liaison · Invitee'
                    : 'Liaison · Voting'
                  : note.authorRole === 'treasurer'
                  ? 'Treasurer'
                  : note.authorRole === 'super_admin'
                  ? 'Division'
                  : note.authorRole === 'coordinator'
                  ? 'Coordinator'
                  : 'Author';
              return (
                <div
                  key={note.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-slate-900 truncate text-[11px]">
                      {note.authorName}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                      {roleBadge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                    {note.text}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {new Date(note.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic py-2 text-center">
            No review notes recorded on this proposal yet.
          </p>
        )}

        {/* Quick Note Composer (Role & Jurisdiction Guarded) */}
        {!currentUser?.email ? (
          onOpenAuth ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-[#1c398e]" />
              <span>Sign in to post a review note</span>
            </button>
          ) : null
        ) : canPostNote ? (
          <form onSubmit={handleAddNote} className="space-y-2 pt-1">
            <textarea
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a review note, reply, or liaison remark..."
              className="w-full px-3 py-2 rounded-xl bg-[#f8fafc] border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1c398e] outline-none transition resize-none"
            />
            {noteError && <p className="text-[11px] text-red-600 font-medium">{noteError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!noteText.trim() || isSavingNote}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] disabled:opacity-50 text-white font-bold text-[11px] transition cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{isSavingNote ? 'Saving...' : 'Post Note'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 text-center">
            Read-only view · Posting notes is restricted to the proposal team and assigned{' '}
            <strong>{unionAcronym}</strong> officers.
          </div>
        )}
      </div>
      )}

      {/* Step 3: Union Committee Approval Modal */}
      {isApprovalModalOpen && currentUser && (
        <UnionApprovalModal
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          proposal={proposal}
          currentUser={currentUser}
          onConfirmApproval={handleConfirmUnionApproval}
        />
      )}

      {/* Step 4: Division Liaison Vote / Revision Confirmation Modal */}
      {liaisonReview && pendingLiaisonConfirmDecision && (
        <LiaisonVoteConfirmModal
          isOpen={Boolean(pendingLiaisonConfirmDecision)}
          initialDecision={pendingLiaisonConfirmDecision}
          proposal={proposal}
          currentUser={currentUser}
          frameworkEval={liaisonReview.frameworkEval}
          selectedDeficientCriteria={liaisonReview.selectedDeficientCriteria}
          criterionInstructions={liaisonReview.criterionInstructions}
          systemAlignmentFlags={liaisonReview.systemAlignmentFlags}
          overallRemark={liaisonReview.liaisonRecommendationText}
          onChangeOverallRemark={liaisonReview.setLiaisonRecommendationText}
          initialOverrideReason={liaisonReview.myExistingVote?.remainingFlagsOverrideReason || ''}
          isSubmitting={liaisonReview.isSubmittingLiaisonVote}
          externalError={liaisonReview.liaisonVoteError}
          onClose={() => setPendingLiaisonConfirmDecision(null)}
          onConfirm={liaisonReview.castLiaisonVote}
        />
      )}

      {/* Step 5: SSD OV27 Committee Authorization Modal */}
      {isDivisionAuthModalOpen && currentUser && (
        <DivisionAuthorizationModal
          isOpen={isDivisionAuthModalOpen}
          onClose={() => setIsDivisionAuthModalOpen(false)}
          proposal={proposal}
          currentUser={currentUser}
          assignedLiaisons={assignedDivisionLiaisons}
          onConfirmAuthorization={handleConfirmDivisionAuthorization}
        />
      )}

      {/* Reopen Review Confirmation Modal */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reopen Proposal Review?</h3>
                <p className="text-xs text-slate-500">Official Committee Action is on record</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This proposal was approved under{' '}
              <strong>Action #{proposal.unionApproval?.actionNumber || 'Voted'}</strong>
              {isDivisionAuthorized ? (
                <>
                  {' '}
                  and <strong>authorized in Step 5 by the SSD OV27 Committee</strong>
                </>
              ) : null}
              . Reopening review will{isDivisionAuthorized ? ' clear Step 5 authorization and ' : ' '}
              return this proposal to <em>Step 2: Union Review</em> status so directors or
              coordinators can adjust budget figures or narratives.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Keep Approved
              </button>
              <button
                type="button"
                onClick={handleConfirmReopenReview}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-2xs cursor-pointer active:scale-95"
              >
                Confirm Reopen Review
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
