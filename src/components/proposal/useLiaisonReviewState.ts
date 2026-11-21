import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Proposal,
  UserAccount,
  UserRole,
  ProposalReviewNote,
  LiaisonVote,
  ReviewReadinessRating,
  ReviewCriterionKey,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getCanonicalDivisionProject,
  isKpiAlignedWithObjective,
  getUserVotingUnions,
  isUserLiaisonEligible,
  isUserInviteeForUnion,
  getProposalStepStatus,
  getProposalReviewNotes,
  canUserVoteStep4Liaison,
  canUserPostProposalNote,
} from '../../types';
import {
  fetchDivisionLiaisons,
  subscribeToLiaisonDirectoryChanges,
} from '../../services/proposalService';
import { auth } from '../../lib/firebase';
import {
  evaluateProposalReviewFramework,
  buildLiaisonCoachingSummary,
  buildLiaisonActionItems,
  computeReadinessFromDeficientKeys,
  ProposalReviewFrameworkEvaluation,
} from '../../utils/projectReviewFramework';
import { getAllProposalSmartAdvisories } from '../../utils/proposalSmartAdvisor';

export interface SystemAlignmentFlagSummary {
  id: string;
  title: string;
  sectionId?: string;
  sectionLabel?: string;
}

export interface LiaisonVoteConfirmPayload {
  confirmedReviewedAndAssisted: boolean;
  remainingFlagsOverrideReason?: string;
  acknowledgedRemainingFlags?: string[];
}

export interface UseLiaisonReviewStateParams {
  proposal: Proposal;
  currentUser: UserAccount;
  onUpdateProposal: (proposalId: string, updates: Partial<Proposal>) => Promise<void> | void;
  navigableProposals?: Proposal[];
  focusNotes?: boolean;
  onClearFocusNotes?: () => void;
  onOpenNotesChat?: () => void;
}

export interface LiaisonReviewController {
  directoryUsers: UserAccount[];
  assignedDivisionLiaisons: UserAccount[];
  assignedUnion: string;
  canonicalProposalUnion: string;
  unionAcronym: string;
  isSuperAdmin: boolean;
  isLiaison: boolean;
  isProposalApproved: boolean;
  isDivisionAuthorized: boolean;
  canVoteStep4: boolean;
  isInviteeLiaison: boolean;
  canPostNote: boolean;
  canEditRubric: boolean;
  stepStatus: ReturnType<typeof getProposalStepStatus>;
  frameworkEval: ProposalReviewFrameworkEvaluation;
  systemAlignmentFlags: SystemAlignmentFlagSummary[];
  alignmentFlaggedCriteria: ReviewCriterionKey[];
  myExistingVote: LiaisonVote | null;
  selectedDeficientCriteria: ReviewCriterionKey[];
  verifiedOkCriteria: ReviewCriterionKey[];
  reviewedRubricCount: number;
  unreviewedRubricCount: number;
  criterionInstructions: Partial<Record<ReviewCriterionKey, string>>;
  forceNotFittingPathways: boolean;
  setForceNotFittingPathways: React.Dispatch<React.SetStateAction<boolean>>;
  minorCoachingOnlyRecommend: boolean;
  setMinorCoachingOnlyRecommend: React.Dispatch<React.SetStateAction<boolean>>;
  hasConfirmedRubric: boolean;
  setHasConfirmedRubric: React.Dispatch<React.SetStateAction<boolean>>;
  selectedReadinessRating: ReviewReadinessRating;
  liaisonRecommendationText: string;
  setLiaisonRecommendationText: React.Dispatch<React.SetStateAction<string>>;
  isSubmittingLiaisonVote: boolean;
  liaisonVoteError: string | null;
  isEditingMyVote: boolean;
  setIsEditingMyVote: React.Dispatch<React.SetStateAction<boolean>>;
  justSavedVoteBanner: 'recommended' | 'revision_requested' | null;
  setJustSavedVoteBanner: React.Dispatch<
    React.SetStateAction<'recommended' | 'revision_requested' | null>
  >;
  nextUnvotedProposal: Proposal | null;
  currentIndex: number;
  hasNext: boolean;
  reviewNotes: ProposalReviewNote[];
  noteText: string;
  setNoteText: React.Dispatch<React.SetStateAction<string>>;
  isSavingNote: boolean;
  noteError: string | null;
  markCriterionOk: (key: ReviewCriterionKey) => void;
  toggleCriterionOk: (key: ReviewCriterionKey) => void;
  toggleCriterionFlag: (key: ReviewCriterionKey) => void;
  toggleCriterionStatus: (key: ReviewCriterionKey) => void;
  setCriterionDeficient: (key: ReviewCriterionKey, deficient: boolean) => void;
  updateCriterionInstruction: (key: ReviewCriterionKey, value: string) => void;
  clearAllRubricFlags: () => void;
  verifyAllRubricOk: () => void;
  castLiaisonVote: (
    voteDecision: 'recommended' | 'revision_requested',
    confirmPayload?: LiaisonVoteConfirmPayload
  ) => Promise<boolean>;
  addNote: (e: React.FormEvent) => Promise<void>;
  draftCoachingToNoteBox: () => void;
  scrollToElement: (elementId: string) => void;
}

export function useLiaisonReviewState({
  proposal,
  currentUser,
  onUpdateProposal,
  navigableProposals = [],
  focusNotes = false,
  onClearFocusNotes,
  onOpenNotesChat,
}: UseLiaisonReviewStateParams): LiaisonReviewController {
  const [directoryUsers, setDirectoryUsers] = useState<UserAccount[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [attachRubricToNextNote, setAttachRubricToNextNote] = useState(false);

  const [liaisonRecommendationText, setLiaisonRecommendationText] = useState('');
  const [isSubmittingLiaisonVote, setIsSubmittingLiaisonVote] = useState(false);
  const [liaisonVoteError, setLiaisonVoteError] = useState<string | null>(null);
  const [isEditingMyVote, setIsEditingMyVote] = useState(false);
  const [justSavedVoteBanner, setJustSavedVoteBanner] = useState<
    'recommended' | 'revision_requested' | null
  >(null);
  const [hasConfirmedRubric, setHasConfirmedRubric] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isLiaison = currentUser?.role === 'division_liaison';
  const isProposalApproved =
    proposal.status === 'approved' || Boolean(proposal.unionApproval?.actionNumber);
  const isDivisionAuthorized = Boolean(proposal.divisionApproval?.authorized);
  const canVoteStep4 =
    isProposalApproved &&
    !isDivisionAuthorized &&
    canUserVoteStep4Liaison(proposal, currentUser);
  const canPostNote = canUserPostProposalNote(proposal, currentUser);

  const assignedUnion =
    proposal.union || currentUser?.union || 'East Central Philippine Union Conference';
  const canonicalProposalUnion = getCanonicalUnion(assignedUnion);
  const unionAcronym = UNION_ACRONYMS[canonicalProposalUnion] || assignedUnion || 'SSD';
  const isInviteeLiaison = isUserInviteeForUnion(assignedUnion, currentUser);

  const currentIndex = useMemo(
    () => navigableProposals.findIndex((p) => p.id === proposal.id),
    [navigableProposals, proposal.id]
  );
  const hasNext = currentIndex >= 0 && currentIndex < navigableProposals.length - 1;

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
  }, [currentUser?.uid]);

  const assignedDivisionLiaisons = useMemo(() => {
    if (!canonicalProposalUnion) return [];
    return directoryUsers.filter((u) => {
      if (!isUserLiaisonEligible(u)) return false;
      return getUserVotingUnions(u).includes(canonicalProposalUnion);
    });
  }, [directoryUsers, canonicalProposalUnion]);

  const stepStatus = useMemo(
    () => getProposalStepStatus(proposal, assignedDivisionLiaisons),
    [proposal, assignedDivisionLiaisons]
  );

  const frameworkEval = useMemo(
    () => evaluateProposalReviewFramework(proposal),
    [proposal]
  );

  const systemAlignmentFlags = useMemo<SystemAlignmentFlagSummary[]>(() => {
    const flags: SystemAlignmentFlagSummary[] = [];
    const canonicalGoal = getCanonicalDivisionProject(proposal.divisionProject);
    const isMisaligned = Boolean(
      (canonicalGoal || proposal.divisionProject) &&
        proposal.kpiType &&
        !isKpiAlignedWithObjective(canonicalGoal || proposal.divisionProject, proposal.kpiType)
    );
    if (isMisaligned) {
      flags.push({
        id: 'kpi_strategic_misalignment',
        title: `Primary KPI does not match ${canonicalGoal || proposal.divisionProject}`,
        sectionId: 'section-5-kpi',
        sectionLabel: 'Primary KPI',
      });
    }
    const advisories = getAllProposalSmartAdvisories(proposal);
    for (const adv of advisories) {
      if (isMisaligned && adv.id.startsWith('kpi_misaligned')) continue;
      flags.push({
        id: adv.id,
        title: adv.title,
        sectionId: adv.sectionId,
        sectionLabel: adv.sectionLabel,
      });
    }
    return flags;
  }, [proposal]);

  const alignmentFlaggedCriteria = useMemo<ReviewCriterionKey[]>(() => {
    const mapped = new Set<ReviewCriterionKey>();
    for (const flag of systemAlignmentFlags) {
      const sec = flag.sectionId || '';
      if (sec === 'section-strategic-focus' || sec === 'section-title' || sec === 'section-budget') {
        mapped.add('q1_pillar');
      } else if (sec === 'section-5-kpi') {
        if (flag.id.startsWith('kpi_')) {
          mapped.add('q2_pathway');
        } else {
          mapped.add('q5_output');
        }
      } else if (sec === 'section-audience' || sec === 'section-overview') {
        mapped.add('q3_input');
      } else if (sec === 'section-goal' || sec === 'section-deliverables') {
        mapped.add('q4_activity');
      } else if (sec === 'section-outcomes') {
        mapped.add('q5_output');
      } else if (sec === 'section-integration') {
        mapped.add('q6_handoff');
      }
    }
    return Array.from(mapped);
  }, [systemAlignmentFlags]);

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

  const canEditRubric = isProposalApproved
    ? (canVoteStep4 && (!myExistingVote || isEditingMyVote)) || isInviteeLiaison
    : isLiaison || isSuperAdmin;

  const allRubricKeys = useMemo(
    () => frameworkEval.questions.map((q) => q.key),
    [frameworkEval.questions]
  );

  const [selectedDeficientCriteria, setSelectedDeficientCriteria] = useState<ReviewCriterionKey[]>(
    () => (myExistingVote ? myExistingVote.deficientCriteria || [] : frameworkEval.deficientKeys)
  );
  const [verifiedOkCriteria, setVerifiedOkCriteria] = useState<ReviewCriterionKey[]>(() => {
    if (!myExistingVote) return [];
    const flagged = myExistingVote.deficientCriteria || [];
    return frameworkEval.questions.map((q) => q.key).filter((k) => !flagged.includes(k));
  });
  const [criterionInstructions, setCriterionInstructions] = useState<
    Partial<Record<ReviewCriterionKey, string>>
  >(() => {
    const initial: Partial<Record<ReviewCriterionKey, string>> = {};
    for (const q of frameworkEval.questions) {
      const hasSystemGap = q.status !== 'adequate' || alignmentFlaggedCriteria.includes(q.key);
      initial[q.key] = hasSystemGap ? q.defaultFixInstruction : '';
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

  const selectedReadinessRating: ReviewReadinessRating = useMemo(
    () => computeReadinessFromDeficientKeys(selectedDeficientCriteria, forceNotFittingPathways),
    [selectedDeficientCriteria, forceNotFittingPathways]
  );

  const lastSyncedVoteKeyRef = useRef<string>('');

  useEffect(() => {
    const syncKey = `${proposal.id}::${myExistingVote?.timestamp || 'none'}::${canVoteStep4}`;
    if (lastSyncedVoteKeyRef.current === syncKey) return;
    lastSyncedVoteKeyRef.current = syncKey;

    const existingRec = myExistingVote?.recommendation || '';
    const isAutoGeneratedSummary =
      existingRec.startsWith('SSD Review Framework ·') &&
      Boolean(myExistingVote?.actionItems?.length);
    setLiaisonRecommendationText(isAutoGeneratedSummary ? '' : existingRec);
    const initialDeficient = myExistingVote
      ? myExistingVote.deficientCriteria || []
      : frameworkEval.deficientKeys;
    setSelectedDeficientCriteria(initialDeficient);
    setVerifiedOkCriteria(
      myExistingVote
        ? frameworkEval.questions.map((q) => q.key).filter((k) => !initialDeficient.includes(k))
        : []
    );

    const nextInstructions: Partial<Record<ReviewCriterionKey, string>> = {};
    for (const q of frameworkEval.questions) {
      const hasSystemGap = q.status !== 'adequate' || alignmentFlaggedCriteria.includes(q.key);
      nextInstructions[q.key] = hasSystemGap ? q.defaultFixInstruction : '';
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
    setIsEditingMyVote(false);
    setHasConfirmedRubric(false);
    setLiaisonVoteError(null);
  }, [
    proposal.id,
    myExistingVote,
    canVoteStep4,
    frameworkEval.deficientKeys,
    frameworkEval.questions,
    alignmentFlaggedCriteria,
  ]);

  useEffect(() => {
    setJustSavedVoteBanner(null);
  }, [proposal.id]);

  const reviewNotes = useMemo(() => getProposalReviewNotes(proposal), [proposal]);

  // Mark unread reviewNotes as read when an authorized signed-in user opens the page
  useEffect(() => {
    if (!auth.currentUser || !canPostNote || !proposal.reviewNotes || proposal.reviewNotes.length === 0)
      return;
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
    canPostNote,
    proposal.id,
    proposal.reviewNotes,
    currentUser.uid,
    currentUser.email,
    onUpdateProposal,
  ]);

  useEffect(() => {
    if (!focusNotes) return;
    if (onOpenNotesChat) {
      onOpenNotesChat();
      onClearFocusNotes?.();
      return;
    }
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
  }, [focusNotes, proposal.id, onClearFocusNotes, onOpenNotesChat]);

  const scrollToElement = useCallback((elementId: string) => {
    const el =
      document.getElementById(elementId) ||
      (elementId === 'section-strategic-focus' ? document.getElementById('section-title') : null);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
      }, 2200);
    }
  }, []);

  const markCriterionOk = useCallback(
    (key: ReviewCriterionKey) => {
      const nextDeficient = selectedDeficientCriteria.filter((k) => k !== key);
      setSelectedDeficientCriteria(nextDeficient);
      if (nextDeficient.length === 0) {
        setForceNotFittingPathways(false);
        setMinorCoachingOnlyRecommend(false);
      }
      setVerifiedOkCriteria((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setLiaisonVoteError(null);
    },
    [selectedDeficientCriteria]
  );

  const toggleCriterionOk = useCallback(
    (key: ReviewCriterionKey) => {
      const nextDeficient = selectedDeficientCriteria.filter((k) => k !== key);
      setSelectedDeficientCriteria(nextDeficient);
      if (nextDeficient.length === 0) {
        setForceNotFittingPathways(false);
        setMinorCoachingOnlyRecommend(false);
      }
      setVerifiedOkCriteria((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
      setLiaisonVoteError(null);
    },
    [selectedDeficientCriteria]
  );

  const setCriterionDeficient = useCallback(
    (key: ReviewCriterionKey, deficient: boolean) => {
      if (!deficient) {
        markCriterionOk(key);
        return;
      }
      setVerifiedOkCriteria((prev) => prev.filter((k) => k !== key));
      if (!selectedDeficientCriteria.includes(key)) {
        const matchedQ = frameworkEval.questions.find((q) => q.key === key);
        const hasSystemGap =
          Boolean(matchedQ && matchedQ.status !== 'adequate') ||
          alignmentFlaggedCriteria.includes(key);
        if (matchedQ && hasSystemGap && !criterionInstructions[key]?.trim()) {
          setCriterionInstructions((curr) => ({
            ...curr,
            [key]: matchedQ.defaultFixInstruction,
          }));
        }
        setSelectedDeficientCriteria([...selectedDeficientCriteria, key]);
      }
      setLiaisonVoteError(null);
    },
    [
      selectedDeficientCriteria,
      frameworkEval.questions,
      alignmentFlaggedCriteria,
      criterionInstructions,
      markCriterionOk,
    ]
  );

  const toggleCriterionFlag = useCallback(
    (key: ReviewCriterionKey) => {
      setVerifiedOkCriteria((prev) => prev.filter((k) => k !== key));
      const isCurrentlyDeficient = selectedDeficientCriteria.includes(key);
      const next = isCurrentlyDeficient
        ? selectedDeficientCriteria.filter((k) => k !== key)
        : [...selectedDeficientCriteria, key];
      if (!isCurrentlyDeficient) {
        const matchedQ = frameworkEval.questions.find((q) => q.key === key);
        const hasSystemGap =
          Boolean(matchedQ && matchedQ.status !== 'adequate') ||
          alignmentFlaggedCriteria.includes(key);
        if (matchedQ && hasSystemGap && !criterionInstructions[key]?.trim()) {
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
      setSelectedDeficientCriteria(next);
      setLiaisonVoteError(null);
    },
    [selectedDeficientCriteria, frameworkEval.questions, alignmentFlaggedCriteria, criterionInstructions]
  );

  const toggleCriterionStatus = useCallback(
    (key: ReviewCriterionKey) => {
      const isCurrentlyDeficient = selectedDeficientCriteria.includes(key);
      if (isCurrentlyDeficient) {
        markCriterionOk(key);
      } else {
        setCriterionDeficient(key, true);
      }
    },
    [selectedDeficientCriteria, markCriterionOk, setCriterionDeficient]
  );

  const updateCriterionInstruction = useCallback((key: ReviewCriterionKey, value: string) => {
    setCriterionInstructions((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const verifyAllRubricOk = useCallback(() => {
    setSelectedDeficientCriteria([]);
    setVerifiedOkCriteria(allRubricKeys);
    setForceNotFittingPathways(false);
    setMinorCoachingOnlyRecommend(false);
    setLiaisonVoteError(null);
  }, [allRubricKeys]);

  const clearAllRubricFlags = useCallback(() => {
    verifyAllRubricOk();
  }, [verifyAllRubricOk]);

  const reviewedRubricCount = useMemo(() => {
    const reviewed = new Set<ReviewCriterionKey>([
      ...verifiedOkCriteria,
      ...selectedDeficientCriteria,
    ]);
    return reviewed.size;
  }, [verifiedOkCriteria, selectedDeficientCriteria]);

  const unreviewedRubricCount = Math.max(0, allRubricKeys.length - reviewedRubricCount);

  const draftCoachingToNoteBox = useCallback(() => {
    const summary = buildLiaisonCoachingSummary(
      frameworkEval,
      selectedDeficientCriteria,
      selectedReadinessRating,
      criterionInstructions
    );
    setNoteText(summary);
    setAttachRubricToNextNote(selectedDeficientCriteria.length > 0);
    if (onOpenNotesChat) {
      onOpenNotesChat();
    } else {
      scrollToElement('proposal-review-notes');
    }
  }, [
    frameworkEval,
    selectedDeficientCriteria,
    selectedReadinessRating,
    criterionInstructions,
    onOpenNotesChat,
    scrollToElement,
  ]);

  const castLiaisonVote = useCallback(
    async (
      voteDecision: 'recommended' | 'revision_requested',
      confirmPayload?: LiaisonVoteConfirmPayload
    ): Promise<boolean> => {
      if (!currentUser?.email || isSubmittingLiaisonVote) return false;

      const manualRecText = liaisonRecommendationText.trim();
      if (
        voteDecision === 'revision_requested' &&
        selectedDeficientCriteria.length === 0 &&
        !manualRecText
      ) {
        setLiaisonVoteError(
          'To request a revision, flag at least one question in the 7-Question Rubric above or describe the specific change needed.'
        );
        return false;
      }

      const confirmedReviewed = confirmPayload
        ? Boolean(confirmPayload.confirmedReviewedAndAssisted)
        : hasConfirmedRubric;

      if (!confirmedReviewed) {
        setLiaisonVoteError(
          'Please confirm that you have reviewed this proposal and assisted the Union before submitting.'
        );
        return false;
      }

      const overrideReason = (confirmPayload?.remainingFlagsOverrideReason || '').trim();
      const acknowledgedFlags = confirmPayload?.acknowledgedRemainingFlags || [];
      const hasAnyRemainingFlags =
        selectedDeficientCriteria.length > 0 || systemAlignmentFlags.length > 0;

      if (voteDecision === 'recommended' && hasAnyRemainingFlags && !overrideReason) {
        setLiaisonVoteError(
          'Please explain why the remaining flagged suggestion(s) were left as-is before recommending.'
        );
        return false;
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
          ? buildLiaisonActionItems(frameworkEval, selectedDeficientCriteria, criterionInstructions)
          : [];

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
        confirmedReviewedAndAssisted: true,
        deficientCriteria: selectedDeficientCriteria,
        ...(actionItems.length > 0 ? { actionItems } : {}),
        ...(recText ? { recommendation: recText } : {}),
        ...(voteDecision === 'recommended' && overrideReason
          ? {
              remainingFlagsOverrideReason: overrideReason,
              ...(acknowledgedFlags.length > 0
                ? { acknowledgedRemainingFlags: acknowledgedFlags }
                : {}),
            }
          : {}),
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

      let updatedNotes = reviewNotes;
      let latestNoteText = proposal.reviewerNotes;
      const shouldAppendVoteNote =
        Boolean(recText && (recText !== myExistingVote?.recommendation || actionItems.length > 0)) ||
        Boolean(
          voteDecision === 'recommended' &&
            overrideReason &&
            overrideReason !== myExistingVote?.remainingFlagsOverrideReason
        );

      if (shouldAppendVoteNote) {
        const votePrefix =
          voteDecision === 'recommended'
            ? '[Step 4 · Liaison Vote & Recommendation ✓]'
            : '[Step 4 · Liaison Revision Request]';
        const noteSegments: string[] = [];
        if (recText) noteSegments.push(recText);
        if (voteDecision === 'recommended' && overrideReason) {
          noteSegments.push(`Remaining flagged suggestion(s) rationale: ${overrideReason}`);
        }
        const autoNote: ProposalReviewNote = {
          id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          text: `${votePrefix} ${noteSegments.join(' · ')}`,
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
        setJustSavedVoteBanner(voteDecision);
        return true;
      } catch (err: any) {
        console.warn('Notice recording Division Liaison vote:', err);
        setLiaisonVoteError(
          'Unable to record Liaison vote in cloud right now. Please verify your assigned voting permissions or connection and try again.'
        );
        return false;
      } finally {
        setIsSubmittingLiaisonVote(false);
      }
    },
    [
      currentUser,
      isSubmittingLiaisonVote,
      liaisonRecommendationText,
      selectedDeficientCriteria,
      hasConfirmedRubric,
      systemAlignmentFlags.length,
      selectedReadinessRating,
      frameworkEval,
      criterionInstructions,
      proposal,
      reviewNotes,
      myExistingVote?.recommendation,
      myExistingVote?.remainingFlagsOverrideReason,
      onUpdateProposal,
    ]
  );

  const addNote = useCallback(
    async (e: React.FormEvent) => {
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
          ? buildLiaisonActionItems(frameworkEval, selectedDeficientCriteria, criterionInstructions)
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
        console.warn('Notice saving review note:', err);
        setNoteError('Unable to save note right now. Please check your connection and try again.');
      } finally {
        setIsSavingNote(false);
      }
    },
    [
      noteText,
      currentUser,
      isSavingNote,
      isLiaison,
      isSuperAdmin,
      attachRubricToNextNote,
      selectedDeficientCriteria,
      frameworkEval,
      criterionInstructions,
      isInviteeLiaison,
      selectedReadinessRating,
      reviewNotes,
      onUpdateProposal,
      proposal.id,
    ]
  );

  return {
    directoryUsers,
    assignedDivisionLiaisons,
    assignedUnion,
    canonicalProposalUnion,
    unionAcronym,
    isSuperAdmin,
    isLiaison,
    isProposalApproved,
    isDivisionAuthorized,
    canVoteStep4,
    isInviteeLiaison,
    canPostNote,
    canEditRubric,
    stepStatus,
    frameworkEval,
    systemAlignmentFlags,
    alignmentFlaggedCriteria,
    myExistingVote,
    selectedDeficientCriteria,
    verifiedOkCriteria,
    reviewedRubricCount,
    unreviewedRubricCount,
    criterionInstructions,
    forceNotFittingPathways,
    setForceNotFittingPathways,
    minorCoachingOnlyRecommend,
    setMinorCoachingOnlyRecommend,
    hasConfirmedRubric,
    setHasConfirmedRubric,
    selectedReadinessRating,
    liaisonRecommendationText,
    setLiaisonRecommendationText,
    isSubmittingLiaisonVote,
    liaisonVoteError,
    isEditingMyVote,
    setIsEditingMyVote,
    justSavedVoteBanner,
    setJustSavedVoteBanner,
    nextUnvotedProposal,
    currentIndex,
    hasNext,
    reviewNotes,
    noteText,
    setNoteText,
    isSavingNote,
    noteError,
    markCriterionOk,
    toggleCriterionOk,
    toggleCriterionFlag,
    toggleCriterionStatus,
    setCriterionDeficient,
    updateCriterionInstruction,
    clearAllRubricFlags,
    verifyAllRubricOk,
    castLiaisonVote,
    addNote,
    draftCoachingToNoteBox,
    scrollToElement,
  };
}
