import React, { useEffect, useState, useMemo } from 'react';
import {
  Proposal,
  UserProfile,
  UserAccount,
  KPI_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  UNION_ACRONYMS,
  REVIEW_READINESS_LABELS,
  ReviewCriterionKey,
  LiaisonActionItem,
  getCanonicalUnion,
  getCanonicalDivisionProject,
  getCanonicalKpiType,
  getProposalReviewNotes,
  getProposalPillarShortLabel,
  getProposalStepStatus,
  getUserAllUnions,
  getUserVotingUnions,
  isUserLiaisonEligible,
  isUserInviteeForUnion,
  isKpiAlignedWithObjective,
} from '../types';
import {
  Printer,
  X,
  FileCheck,
  MessageSquare,
  Flag,
  ClipboardCheck,
  FileSpreadsheet,
  Wrench,
  MapPin,
  DollarSign,
} from 'lucide-react';
import {
  computeAllProposalsFundingAttribution,
  formatAttributionPct,
  getProposalApprovedBudget,
} from '../utils/fundingAttribution';
import { getAllProposalSmartAdvisories } from '../utils/proposalSmartAdvisor';
import { FormattedNarrativeText } from '../utils/narrativeFormatter';
import {
  fetchBudgetAllocationDetails,
  fetchDivisionLiaisons,
  subscribeToLiaisonDirectoryChanges,
} from '../services/proposalService';
import { evaluateProposalReviewFramework } from '../utils/projectReviewFramework';
import { parseKpiTargetNumber } from '../utils/kpiExtraction';
import { getUnionIntelligence } from '../data/unionIntelligence';
import { resolveProposalProjectCode } from '../utils/externalProposalCodec';

export type PrintPresetMode = 'committee_packet' | 'governance_dossier' | 'revision_sheet';

interface PrintProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal;
  userProfile: UserProfile | null;
  allProposals?: Proposal[];
  currentUser?: UserAccount | null;
}

interface RevisionWorksheetItem {
  id: string;
  criterionKey?: ReviewCriterionKey;
  questionNumber?: number;
  shortTitle: string;
  sectionId: string;
  sectionLabel: string;
  instruction: string;
  sourceLabel: string;
  currentExcerpt: string;
}

function resolveApprovingBodyLabel(
  actionNumber?: string,
  committeeType?: string,
  otherType?: string
): string {
  const actUpper = (actionNumber || '').toUpperCase();
  if (actUpper.includes('ADCOM')) return 'Administrative Committee (ADCOM)';
  if (actUpper.includes('EXCOM')) return 'Executive Committee (EXCOM)';
  if (actUpper.includes('OFFICER')) return 'Officers Committee';
  if (otherType && otherType.trim()) return otherType.trim();
  if (committeeType === 'ADCOM') return 'Administrative Committee (ADCOM)';
  if (committeeType === 'Officers') return 'Officers Committee';
  if (committeeType === 'EXCOM' && !actUpper) return 'Union Executive Committee';
  return 'Official Union / Mission Committee';
}

function formatAuditTimestamp(isoString?: string): string {
  if (!isoString) return 'Verified in SSD Treasury Registry';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncateExcerpt(raw: string | undefined | null, maxChars = 340): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '— Currently blank in proposal —';
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 1).trim()}…`;
}

function getProposalSectionExcerpt(proposal: Proposal, sectionId: string): string {
  const sec = (sectionId || '').toLowerCase();
  const kpiObj = KPI_OPTIONS.find(
    (k) => k.id === getCanonicalKpiType(proposal.kpiType) || k.id === proposal.kpiType
  );

  if (sec.includes('strategy') || sec.includes('pillar') || sec.includes('focus')) {
    const obj =
      proposal.divisionProject === 'Other' && proposal.otherDivisionProject
        ? proposal.otherDivisionProject
        : getCanonicalDivisionProject(proposal.divisionProject) || proposal.divisionProject || 'Unspecified';
    return `Pillar: ${proposal.strategicFocus || 'Unspecified'} · Objective: ${obj}`;
  }

  if (sec.includes('overview')) {
    return truncateExcerpt(proposal.overview);
  }

  if (sec.includes('goal')) {
    return truncateExcerpt(proposal.goal);
  }

  if (sec.includes('outcome')) {
    return truncateExcerpt(proposal.outcomes);
  }

  if (sec.includes('kpi') || sec.includes('5')) {
    const metricTitle = kpiObj ? `${kpiObj.number}. ${kpiObj.title}` : 'No KPI selected';
    const target = proposal.kpiNumber || '0';
    const baseline =
      proposal.hadSimilarProject2Years === 'yes'
        ? `Prior 2024–25: ${proposal.priorProjectMetric || 'Yes (metric not entered)'}`
        : proposal.hadSimilarProject2Years === 'no'
        ? 'New initiative (no 2024–25 baseline)'
        : '2024–25 continuity unspecified';
    const desc = truncateExcerpt(proposal.kpiDescription, 180);
    return `${metricTitle} (Target: ${target}) · ${baseline}. Description: ${desc}`;
  }

  if (sec.includes('deliverable')) {
    return truncateExcerpt(proposal.deliverables);
  }

  if (sec.includes('audience')) {
    const labels = (proposal.targetAudiences || [])
      .map((id) => {
        const norm = id.replace(/^group_/i, '').toUpperCase();
        return (
          TARGET_AUDIENCE_OPTIONS.find(
            (o) => o.id.toUpperCase() === norm || o.id.toUpperCase() === id.toUpperCase()
          )?.label || id
        );
      })
      .filter(Boolean);
    const base = labels.length > 0 ? labels.join('; ') : 'No audience segments selected';
    if ((proposal.targetAudiences || []).includes('E') && proposal.audienceEDetails) {
      return `${base} · Group E Details: ${truncateExcerpt(proposal.audienceEDetails, 150)}`;
    }
    return truncateExcerpt(base);
  }

  if (sec.includes('integration')) {
    return truncateExcerpt(proposal.pointsOfIntegration);
  }

  if (sec.includes('budget')) {
    const items = (proposal.budgetItems || []).filter(
      (b) => (b.activity && b.activity.trim()) || Number(b.divisionFunding ?? b.gcFunding) > 0
    );
    if (items.length === 0) return '— No itemized budget lines entered —';
    const summary = items
      .slice(0, 4)
      .map((it) => {
        const amt = Number(it.divisionFunding ?? it.gcFunding) || 0;
        return `${it.activity || 'Untitled'} (US$${amt.toLocaleString()})`;
      })
      .join('; ');
    return items.length > 4 ? `${summary}; +${items.length - 4} more line(s)` : summary;
  }

  return truncateExcerpt(proposal.overview || proposal.goal);
}

export function PrintProposalModal({
  isOpen,
  onClose,
  proposal,
  userProfile,
  allProposals = [],
  currentUser = null,
}: PrintProposalModalProps) {
  const [directoryUsers, setDirectoryUsers] = useState<UserAccount[]>([]);
  const [loadedAllocations, setLoadedAllocations] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('onevoice27_budget_allocations');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [loadedMatchingPledges, setLoadedMatchingPledges] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('onevoice27_matching_pledges');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [printMode, setPrintMode] = useState<PrintPresetMode>('committee_packet');
  const [includeTerritoryStrip, setIncludeTerritoryStrip] = useState(true);
  const [includeShareBreakdown, setIncludeShareBreakdown] = useState(true);
  const [includeRubricScorecard, setIncludeRubricScorecard] = useState(false);
  const [includeAlignmentFlags, setIncludeAlignmentFlags] = useState(false);
  const [includeReviewNotes, setIncludeReviewNotes] = useState(false);

  const canonicalUnion = useMemo(() => getCanonicalUnion(proposal.union), [proposal.union]);
  const unionCode =
    UNION_ACRONYMS[canonicalUnion] || UNION_ACRONYMS[proposal.union] || proposal.union || 'SSD';

  // Assigned Voting Division Liaisons for this Union
  const assignedDivisionLiaisons = useMemo(() => {
    if (!canonicalUnion) return [];
    return directoryUsers.filter((u) => {
      if (!isUserLiaisonEligible(u)) return false;
      return getUserVotingUnions(u).includes(canonicalUnion);
    });
  }, [directoryUsers, canonicalUnion]);

  // Registered Union Coordinators & Treasurers as fallback when Union Lead is blank
  const registeredUnionLeads = useMemo(() => {
    if (!canonicalUnion) return [];
    return directoryUsers.filter((u) => {
      if (u.role !== 'coordinator' && u.role !== 'treasurer') return false;
      return getUserAllUnions(u).map(getCanonicalUnion).includes(canonicalUnion);
    });
  }, [directoryUsers, canonicalUnion]);

  const stepStatus = useMemo(
    () => getProposalStepStatus(proposal, assignedDivisionLiaisons),
    [proposal, assignedDivisionLiaisons]
  );

  const frameworkEval = useMemo(
    () => evaluateProposalReviewFramework(proposal),
    [proposal]
  );

  const reviewNotes = useMemo(() => getProposalReviewNotes(proposal), [proposal]);
  const hasReviewNotes = reviewNotes.length > 0;

  // Determine whether active revision requests or structured action items exist
  const hasActiveRevisionItems = useMemo(() => {
    if (stepStatus.liaisonSummary.hasRevisionRequested) return true;
    const isEditableCycle = proposal.status === 'draft' || proposal.status === 'under_review';
    if (isEditableCycle) {
      const voteHasActions = (proposal.liaisonVotes || []).some(
        (v) => v.vote === 'revision_requested' || (v.actionItems && v.actionItems.length > 0)
      );
      const noteHasActions = reviewNotes.some((n) => n.actionItems && n.actionItems.length > 0);
      return voteHasActions || noteHasActions;
    }
    return false;
  }, [stepStatus.liaisonSummary.hasRevisionRequested, proposal.status, proposal.liaisonVotes, reviewNotes]);

  const applyPresetMode = (mode: PrintPresetMode) => {
    setPrintMode(mode);
    if (mode === 'committee_packet') {
      setIncludeTerritoryStrip(true);
      setIncludeShareBreakdown(true);
      setIncludeRubricScorecard(false);
      setIncludeAlignmentFlags(false);
      setIncludeReviewNotes(false);
    } else if (mode === 'governance_dossier') {
      setIncludeTerritoryStrip(true);
      setIncludeShareBreakdown(true);
      setIncludeRubricScorecard(true);
      setIncludeAlignmentFlags(true);
      setIncludeReviewNotes(true);
    } else {
      setIncludeAlignmentFlags(true);
      setIncludeReviewNotes(true);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove('print-modal-active');
      return;
    }

    document.body.classList.add('print-modal-active');

    // Auto-select smart default preset when modal opens
    if (hasActiveRevisionItems) {
      applyPresetMode('revision_sheet');
    } else if (
      currentUser?.role === 'division_liaison' ||
      currentUser?.role === 'super_admin' ||
      proposal.status === 'under_review'
    ) {
      applyPresetMode('governance_dossier');
    } else {
      applyPresetMode('committee_packet');
    }

    let mounted = true;
    fetchBudgetAllocationDetails()
      .then(({ allocations, matchingPledges }) => {
        if (!mounted) return;
        setLoadedAllocations(allocations || {});
        setLoadedMatchingPledges(matchingPledges || {});
      })
      .catch(() => {});

    const loadLiaisons = (forceRefresh = false) => {
      fetchDivisionLiaisons(forceRefresh)
        .then((users) => {
          if (mounted && Array.isArray(users)) {
            setDirectoryUsers(users);
          }
        })
        .catch(() => {});
    };
    loadLiaisons(false);
    const unsub = subscribeToLiaisonDirectoryChanges(() => {
      loadLiaisons(true);
    });

    return () => {
      mounted = false;
      unsub();
      document.body.classList.remove('print-modal-active');
    };
  }, [isOpen, proposal.id]);

  const canonicalGoal = useMemo(
    () => getCanonicalDivisionProject(proposal.divisionProject),
    [proposal.divisionProject]
  );

  const effectiveObjective =
    proposal.divisionProject === 'Other' && proposal.otherDivisionProject
      ? proposal.otherDivisionProject
      : canonicalGoal || proposal.divisionProject || '— None Specified —';

  const isKpiMisaligned = useMemo(() => {
    return Boolean(
      (canonicalGoal || proposal.divisionProject) &&
        proposal.kpiType &&
        !isKpiAlignedWithObjective(canonicalGoal || proposal.divisionProject, proposal.kpiType)
    );
  }, [canonicalGoal, proposal.divisionProject, proposal.kpiType]);

  const alignmentFlags = useMemo(() => {
    const advisories = getAllProposalSmartAdvisories(proposal);
    const items: {
      id: string;
      title: string;
      message: string;
      category: 'KPI & Alignment' | 'KPI & Audience' | 'Budget & Treasury' | 'Playbook & Narrative';
    }[] = [];

    if (isKpiMisaligned) {
      const kpiObj = KPI_OPTIONS.find((k) => k.id === proposal.kpiType);
      const objLabel = canonicalGoal || proposal.divisionProject || 'selected Global Objective';
      items.push({
        id: 'strategic_kpi_misalignment',
        title: `Strategic Misalignment: Primary KPI does not match ${objLabel}`,
        message: kpiObj
          ? `Selected metric "${kpiObj.number}. ${kpiObj.title}" is not mapped as an official primary KPI for "${objLabel}".`
          : `The selected Primary KPI is not mapped to "${objLabel}".`,
        category: 'KPI & Alignment',
      });
    }

    for (const adv of advisories) {
      if (isKpiMisaligned && adv.id.startsWith('kpi_misaligned')) continue;
      const category =
        adv.sectionId === 'section-budget'
          ? 'Budget & Treasury'
          : adv.sectionId === 'section-5-kpi' ||
            adv.sectionId === 'section-kpi' ||
            adv.sectionId === 'section-audience'
          ? 'KPI & Audience'
          : 'Playbook & Narrative';
      items.push({
        id: adv.id,
        title: adv.title,
        message: adv.message,
        category,
      });
    }

    return items;
  }, [proposal, isKpiMisaligned, canonicalGoal]);

  // Live Cumulative 100% Share Waterfall Attribution (matches ApprovedProposalEditorialView)
  const isProposalApproved =
    proposal.status === 'approved' || Boolean(proposal.unionApproval?.actionNumber);
  const approvedOrRequestedTotal = getProposalApprovedBudget(proposal);

  const { attribution, unionSummary } = useMemo(() => {
    if (approvedOrRequestedTotal <= 0) {
      return { attribution: undefined, unionSummary: undefined };
    }

    const baseList = allProposals.length > 0 ? allProposals : [proposal];
    const hasCurrent = baseList.some((p) => p.id === proposal.id);
    const normalizedList = hasCurrent
      ? baseList.map((p) => (p.id === proposal.id ? proposal : p))
      : [...baseList, proposal];

    const effectiveList: Proposal[] = isProposalApproved
      ? normalizedList.map((p) =>
          p.id === proposal.id ? { ...proposal, status: 'approved' as const } : p
        )
      : normalizedList.map((p) =>
          p.id === proposal.id
            ? {
                ...proposal,
                status: 'approved' as const,
                unionApproval: {
                  actionNumber: 'PREVIEW',
                  actionDate: '9999-12-31',
                  approvedBy: '',
                  approvedByEmail: '',
                  approvedByRole: 'treasurer',
                  timestamp: '9999-12-31T23:59:59.000Z',
                },
              }
            : p
        );

    const computed = computeAllProposalsFundingAttribution(
      effectiveList,
      loadedAllocations,
      loadedMatchingPledges
    );
    const canon = canonicalUnion || proposal.union;

    return {
      attribution: computed.byProposalId[proposal.id],
      unionSummary: canon ? computed.byUnion[canon] : undefined,
    };
  }, [
    proposal,
    allProposals,
    loadedAllocations,
    loadedMatchingPledges,
    isProposalApproved,
    approvedOrRequestedTotal,
    canonicalUnion,
  ]);

  // Deduplicated Action Items for Mode 3 (Revision Action Sheet) & Rubric Overlay
  const revisionWorksheetItems = useMemo<RevisionWorksheetItem[]>(() => {
    const items: RevisionWorksheetItem[] = [];
    const seenKeys = new Set<string>();

    const pushActionItem = (action: LiaisonActionItem, sourceLabel: string) => {
      const dedupeKey = `${action.criterionKey || action.sectionId}::${action.instruction.trim().toLowerCase()}`;
      if (seenKeys.has(dedupeKey)) return;
      seenKeys.add(dedupeKey);
      items.push({
        id: dedupeKey,
        criterionKey: action.criterionKey,
        questionNumber: action.questionNumber,
        shortTitle: action.shortTitle,
        sectionId: action.sectionId,
        sectionLabel: action.sectionLabel,
        instruction: action.instruction,
        sourceLabel,
        currentExcerpt: getProposalSectionExcerpt(proposal, action.sectionId),
      });
    };

    // 1. Step 4 Liaison Votes (prioritize revision_requested votes, then coaching action items)
    for (const vote of proposal.liaisonVotes || []) {
      const voterTag = `${vote.liaisonName} (Step 4 ${
        vote.vote === 'revision_requested' ? 'Revision Request' : 'Coaching Note'
      })`;
      if (vote.actionItems && vote.actionItems.length > 0) {
        for (const act of vote.actionItems) {
          pushActionItem(act, voterTag);
        }
      } else if (vote.deficientCriteria && vote.deficientCriteria.length > 0) {
        for (const critKey of vote.deficientCriteria) {
          const matchedQ = frameworkEval.questions.find((q) => q.key === critKey);
          if (matchedQ) {
            pushActionItem(
              {
                criterionKey: matchedQ.key,
                questionNumber: matchedQ.number,
                shortTitle: matchedQ.shortTitle,
                sectionId: matchedQ.relatedSectionId,
                sectionLabel: matchedQ.sectionLabel,
                instruction: matchedQ.defaultFixInstruction,
              },
              voterTag
            );
          }
        }
      }
    }

    // 2. Reviewer Notes with structured actionItems
    for (const note of [...reviewNotes].reverse()) {
      if (note.actionItems && note.actionItems.length > 0) {
        const roleLabel =
          note.authorRole === 'division_liaison'
            ? 'Division Liaison Note'
            : note.authorRole === 'treasurer'
            ? 'Treasurer Note'
            : note.authorRole === 'coordinator'
            ? 'Coordinator Note'
            : 'Reviewer Note';
        for (const act of note.actionItems) {
          pushActionItem(act, `${note.authorName} (${roleLabel})`);
        }
      }
    }

    // 3. Fallback to auto-evaluated SSD 7-Question Rubric gaps if no manual items were attached yet
    if (items.length === 0) {
      for (const q of frameworkEval.questions) {
        if (q.status === 'needs_work') {
          pushActionItem(
            {
              criterionKey: q.key,
              questionNumber: q.number,
              shortTitle: q.shortTitle,
              sectionId: q.relatedSectionId,
              sectionLabel: q.sectionLabel,
              instruction: q.defaultFixInstruction,
            },
            'SSD 7-Question Rubric Check'
          );
        }
      }
    }

    return items;
  }, [proposal, reviewNotes, frameworkEval.questions]);

  // Map any Liaison-flagged instructions onto the 7-Question Scorecard rows
  const liaisonInstructionByCriterion = useMemo(() => {
    const map: Partial<Record<ReviewCriterionKey, { instruction: string; by: string }>> = {};
    for (const vote of proposal.liaisonVotes || []) {
      for (const act of vote.actionItems || []) {
        if (act.criterionKey && !map[act.criterionKey]) {
          map[act.criterionKey] = {
            instruction: act.instruction,
            by: vote.liaisonName,
          };
        }
      }
    }
    return map;
  }, [proposal.liaisonVotes]);

  const flaggedCriteriaSet = useMemo(() => {
    const set = new Set<ReviewCriterionKey>(frameworkEval.deficientKeys);
    for (const vote of proposal.liaisonVotes || []) {
      for (const k of vote.deficientCriteria || []) {
        set.add(k);
      }
      for (const act of vote.actionItems || []) {
        if (act.criterionKey) set.add(act.criterionKey);
      }
    }
    return set;
  }, [frameworkEval.deficientKeys, proposal.liaisonVotes]);

  if (!isOpen) return null;

  const territoryProfile = getUnionIntelligence(proposal.union);
  const pillarShort = getProposalPillarShortLabel(proposal);

  const canonicalKpiId = getCanonicalKpiType(proposal.kpiType);
  const selectedKpiObj =
    KPI_OPTIONS.find((k) => k.id === canonicalKpiId || k.id === proposal.kpiType) || null;
  const parsedKpi = parseKpiTargetNumber(
    proposal.kpiNumber,
    proposal.kpiDescription,
    proposal.kpiType
  );

  const selectedAudiences = (proposal.targetAudiences || []).map((rawId) => {
    const normalized = rawId.replace(/^group_/i, '').toUpperCase();
    const matched = TARGET_AUDIENCE_OPTIONS.find(
      (opt) => opt.id.toUpperCase() === normalized || opt.id.toUpperCase() === rawId.toUpperCase()
    );
    const isFrontline =
      normalized.startsWith('C') || normalized.startsWith('D') || normalized.startsWith('E');
    return {
      id: matched?.id || normalized,
      fullLabel: matched?.label || rawId,
      isFrontline,
    };
  });

  const frontlineCount = selectedAudiences.filter((a) => a.isFrontline).length;
  const equippingCount = selectedAudiences.length - frontlineCount;

  const validBudgetItems = (proposal.budgetItems || []).filter(
    (b) => (b.activity && b.activity.trim() !== '') || Number(b.divisionFunding ?? b.gcFunding) > 0
  );

  const grandTotal = validBudgetItems.reduce(
    (acc, item) => acc + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );

  const fmtMoney = (v: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formattedDate = new Date(proposal.updatedAt || proposal.createdAt).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );

  // Resolved Contact Fallbacks
  const pocName = proposal.pointOfContact?.name?.trim() || proposal.userName?.trim() || '—';
  const pocEmail = proposal.pointOfContact?.email?.trim() || proposal.userEmail?.trim() || '';
  const pocPhone = proposal.pointOfContact?.phone?.trim() || '';

  const manualUnionLeadName = proposal.divisionLeadContact?.name?.trim() || '';
  const manualUnionLeadEmail = proposal.divisionLeadContact?.email?.trim() || '';
  const manualUnionLeadPhone = proposal.divisionLeadContact?.phone?.trim() || '';

  const manualLiaisonName = proposal.gcLiaison?.name?.trim() || '';
  const manualLiaisonEmail = proposal.gcLiaison?.email?.trim() || '';
  const manualLiaisonPhone = proposal.gcLiaison?.phone?.trim() || '';

  const handlePrint = () => {
    const originalTitle = document.title;
    const cleanTitle = (proposal.title || 'Proposal')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42);

    const refTag = proposal.projectCode?.composite
      ? proposal.projectCode.composite.replace(/[^a-zA-Z0-9_-]+/g, '-')
      : proposal.unionApproval?.actionNumber
      ? proposal.unionApproval.actionNumber.replace(/[^a-zA-Z0-9_-]+/g, '-')
      : proposal.id.slice(0, 8).toUpperCase();

    const stepTag = stepStatus.step5Complete
      ? 'Step5-Authorized'
      : stepStatus.liaisonSummary.hasRevisionRequested
      ? 'Step4-Revision'
      : stepStatus.step4Complete
      ? 'Step4-Recommended'
      : stepStatus.step3Complete
      ? 'Step3-Voted'
      : proposal.status === 'under_review'
      ? 'Step2-Review'
      : proposal.status === 'submitted'
      ? 'Step1-Submitted'
      : 'Draft';

    const modeTag =
      printMode === 'committee_packet'
        ? 'Committee-Packet'
        : printMode === 'governance_dossier'
        ? 'Governance-Dossier'
        : 'Revision-Sheet';

    document.title = `OV27_${unionCode}_${refTag}_${stepTag}_${modeTag}_${cleanTitle}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 600);
  };

  const governanceSteps = [
    {
      num: 1,
      label: 'Submitted',
      done: stepStatus.step1Complete,
      active: stepStatus.currentStepNumber === 1,
      alert: false,
    },
    {
      num: 2,
      label: stepStatus.step2Skipped ? 'Review (Direct)' : 'Union Review',
      done: stepStatus.step2Complete || stepStatus.step2Skipped,
      active: stepStatus.currentStepNumber === 2,
      alert: false,
    },
    {
      num: 3,
      label: 'Union Voted',
      done: stepStatus.step3Complete,
      active: stepStatus.currentStepNumber === 3 && !stepStatus.step3Complete,
      alert: false,
    },
    {
      num: 4,
      label: 'Liaison Vote',
      done:
        stepStatus.step4Complete ||
        Boolean(stepStatus.step5Complete && proposal.divisionApproval?.liaisonOverride),
      active: stepStatus.step3Complete && !stepStatus.step4Complete && !stepStatus.step5Complete,
      alert: stepStatus.liaisonSummary.hasRevisionRequested,
    },
    {
      num: 5,
      label: 'SSD OV27 Auth',
      done: stepStatus.step5Complete,
      active: stepStatus.step4Complete && !stepStatus.step5Complete,
      alert: false,
    },
    {
      num: 6,
      label: 'Impact & Eval',
      done: false,
      active: stepStatus.step5Complete,
      alert: false,
    },
  ];

  const modeSubtitle =
    printMode === 'committee_packet'
      ? 'Official Committee & Stakeholder Packet'
      : printMode === 'governance_dossier'
      ? 'Full Governance & Liaison Review Dossier'
      : 'Author & Union Revision Action Sheet';

  return (
    <div className="print-modal-backdrop fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:block print:overflow-visible">
      <div className="print-modal-shell relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-3 border border-slate-200 print:border-none print:shadow-none print:my-0 print:p-0 print:rounded-none print:max-w-none print:w-full">
        {/* ===================================================================
            PREVIEW CONTROL BAR (Hidden when printing)
           =================================================================== */}
        <div className="sticky top-0 z-20 bg-slate-900 text-white border-b border-slate-800 px-5 py-3.5 space-y-3 no-print">
          {/* Top Row: Title, 3-Mode Segmented Control, Print & Close */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">
                  Print / Save PDF Preview · {unionCode}
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Choose a layout preset below, customize sections if needed, then click Print / Save as PDF
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Print / Save as PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Second Row: 3 Print Mode Tabs + Granular Section Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-800">
            {/* Segmented Mode Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-800/90 rounded-xl border border-slate-700/80 flex-wrap">
              <button
                type="button"
                onClick={() => applyPresetMode('committee_packet')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  printMode === 'committee_packet'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>Committee Packet</span>
              </button>

              <button
                type="button"
                onClick={() => applyPresetMode('governance_dossier')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  printMode === 'governance_dossier'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Full Governance Dossier</span>
              </button>

              <button
                type="button"
                onClick={() => applyPresetMode('revision_sheet')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                  printMode === 'revision_sheet'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : hasActiveRevisionItems
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Revision Action Sheet
                  {revisionWorksheetItems.length > 0 ? ` (${revisionWorksheetItems.length})` : ''}
                </span>
              </button>
            </div>

            {/* Granular Section Toggles */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {printMode !== 'revision_sheet' && territoryProfile && (
                <button
                  type="button"
                  onClick={() => setIncludeTerritoryStrip((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap ${
                    includeTerritoryStrip
                      ? 'bg-slate-800 border-slate-600 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>Territory Strip</span>
                </button>
              )}

              {printMode !== 'revision_sheet' && attribution && (
                <button
                  type="button"
                  onClick={() => setIncludeShareBreakdown((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap ${
                    includeShareBreakdown
                      ? 'bg-slate-800 border-slate-600 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <DollarSign className="w-3 h-3 shrink-0" />
                  <span>Entity Shares</span>
                </button>
              )}

              {printMode !== 'revision_sheet' && (
                <button
                  type="button"
                  onClick={() => setIncludeRubricScorecard((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap tabular-nums ${
                    includeRubricScorecard
                      ? 'bg-slate-800 border-slate-600 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <ClipboardCheck className="w-3 h-3 shrink-0" />
                  <span>7Q Rubric ({7 - flaggedCriteriaSet.size}/7)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIncludeAlignmentFlags((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap tabular-nums ${
                  includeAlignmentFlags
                    ? alignmentFlags.length > 0
                      ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                      : 'bg-slate-800 border-slate-600 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <Flag className="w-3 h-3 shrink-0" />
                <span>Flags ({alignmentFlags.length})</span>
              </button>

              {hasReviewNotes && (
                <button
                  type="button"
                  onClick={() => setIncludeReviewNotes((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap tabular-nums ${
                    includeReviewNotes
                      ? 'bg-slate-800 border-slate-600 text-sky-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span>Notes ({reviewNotes.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ===================================================================
            PRINTABLE DOCUMENT SURFACE
           =================================================================== */}
        <div
          id="printable-proposal"
          className="p-7 sm:p-10 md:p-11 text-slate-900 space-y-5 print:p-0 print:space-y-4 print:text-black print:w-full"
        >
          {/* SHARED DOCUMENT MASTHEAD */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 break-inside-avoid">
            <div className="flex items-start gap-3.5 min-w-0">
              <img
                src="/adventist-symbol-circle.png"
                alt="Seventh-day Adventist Church"
                className="w-12 h-12 sm:w-13 sm:h-13 object-contain shrink-0 mt-0.5"
              />
              <div className="min-w-0 space-y-1">
                <div className="text-[10px] tracking-widest font-extrabold uppercase text-[#1c398e] print:text-black">
                  Southern Asia-Pacific Division · OneVoice27 Initiative
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-snug break-words">
                  {proposal.title || 'Untitled Project Proposal'}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 font-medium">
                  <span className="font-bold text-slate-800">
                    {proposal.union || userProfile?.division || 'Southern Asia-Pacific Division'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{frameworkEval.subTypeMeta.shortLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Stage: {frameworkEval.principalStageLabel}</span>
                </div>
              </div>
            </div>

            <div className="sm:text-right text-xs space-y-0.5 shrink-0 tabular-nums">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                {modeSubtitle}
              </div>
              {(proposal.projectCode?.projectId || proposal.projectCode?.composite || proposal.divisionApproval?.authorized) && (
                <div className="font-mono font-bold text-slate-900 text-xs">
                  Project Code:{' '}
                  {resolveProposalProjectCode(proposal, 1, {
                    allowFallbackSequence: false,
                  }).composite}
                </div>
              )}
              {proposal.unionApproval?.actionNumber && (
                <div className="font-bold text-slate-900">
                  Union Action #{proposal.unionApproval.actionNumber}
                </div>
              )}
              <div className="text-[11px] text-slate-500">
                Ref: <span className="font-mono">{proposal.id.slice(0, 8).toUpperCase()}</span> · Updated{' '}
                {formattedDate}
              </div>
            </div>
          </div>

          {/* =================================================================
              MODE 3: REVISION ACTION SHEET (1–2 PAGE WORKING HANDOUT)
             ================================================================= */}
          {printMode === 'revision_sheet' ? (
            <div className="space-y-5 print:space-y-4">
              {/* Compact Governance & Revision Status Summary */}
              <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/70 print:bg-white space-y-3 break-inside-avoid text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 print:text-black">
                      Governance Revision &amp; Coaching Brief
                    </div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {stepStatus.currentStepLabel}
                    </div>
                  </div>

                  <div className="text-right tabular-nums">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      SSD Rubric Readiness Verdict
                    </div>
                    <div
                      className={`text-xs font-extrabold mt-0.5 ${
                        frameworkEval.effectiveRating === 'meeting_requirement'
                          ? 'text-emerald-800'
                          : frameworkEval.effectiveRating === 'needs_improvement'
                          ? 'text-amber-800'
                          : 'text-rose-800'
                      } print:text-black`}
                    >
                      {frameworkEval.effectiveRatingLabel} ({7 - flaggedCriteriaSet.size}/7 Adequate)
                    </div>
                  </div>
                </div>

                {/* Key Contacts & Budget Context Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Proposal Point of Contact
                    </span>
                    <span className="font-bold text-slate-900 block">{pocName}</span>
                    {pocEmail && <span className="text-[11px] text-slate-600 block">{pocEmail}</span>}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Union Lead / Treasury ({unionCode})
                    </span>
                    {manualUnionLeadName || manualUnionLeadEmail ? (
                      <>
                        <span className="font-bold text-slate-900 block">
                          {manualUnionLeadName || 'Union Lead'}
                        </span>
                        {manualUnionLeadEmail && (
                          <span className="text-[11px] text-slate-600 block">
                            {manualUnionLeadEmail}
                          </span>
                        )}
                      </>
                    ) : registeredUnionLeads.length > 0 ? (
                      <span className="font-bold text-slate-900 block">
                        {registeredUnionLeads
                          .map((u) => `${u.displayName || u.email} (${u.role === 'treasurer' ? 'Treas.' : 'Coord.'})`)
                          .join(' · ')}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>

                  <div className="sm:text-right tabular-nums">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      {isProposalApproved ? 'Voted Proposal Budget' : 'Requested Proposal Budget'}
                    </span>
                    <span className="text-sm font-black text-slate-900 block">
                      US$ {fmtMoney(grandTotal)}
                    </span>
                    <span className="text-[11px] text-slate-600 block">
                      {revisionWorksheetItems.length}{' '}
                      {revisionWorksheetItems.length === 1
                        ? 'Section Flagged for Update'
                        : 'Sections Flagged for Update'}
                    </span>
                  </div>
                </div>

                {/* Overall Liaison Revision Remarks (if recorded) */}
                {stepStatus.liaisonSummary.votes.some((v) => v.recommendation) && (
                  <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Step 4 Division Liaison Summary Remarks
                    </span>
                    {stepStatus.liaisonSummary.votes
                      .filter((v) => v.recommendation)
                      .map((v, idx) => (
                        <div key={idx} className="text-[11px] text-slate-800 leading-relaxed">
                          <strong>{v.liaisonName}</strong> ({ formatAuditTimestamp(v.timestamp) }):{' '}
                          <span className="whitespace-pre-line">{v.recommendation}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Side-by-Side Section Fix Worksheet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    01. Section-by-Section Revision Checklist
                  </h2>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    Check box as each section is updated
                  </span>
                </div>

                {revisionWorksheetItems.length === 0 ? (
                  <div className="p-4 rounded-xl border border-slate-300 bg-white text-xs text-slate-700 break-inside-avoid">
                    <strong>No Flagged Section Revisions:</strong> All 7 SSD Review Framework criteria
                    currently evaluate as Adequate and no Step 4 Liaison revision requests are active on
                    this proposal.
                  </div>
                ) : (
                  <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                    <div className="grid grid-cols-12 bg-slate-100 font-bold p-2.5 text-slate-800 border-b border-slate-300">
                      <div className="col-span-7 pr-3">Flagged Section &amp; Required Update</div>
                      <div className="col-span-5 pl-3 border-l border-slate-300">
                        Current Proposal Content (To Revise)
                      </div>
                    </div>

                    {revisionWorksheetItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 p-3 border-b last:border-b-0 border-slate-200 items-start break-inside-avoid"
                      >
                        <div className="col-span-7 pr-3 space-y-1.5">
                          <div className="flex items-start gap-2">
                            {/* Print-safe checkbox square (uses span instead of input) */}
                            <span
                              aria-hidden="true"
                              className="inline-block w-3.5 h-3.5 mt-0.5 rounded-xs border border-slate-500 shrink-0 bg-white"
                            />
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900">
                                {idx + 1}. {item.sectionLabel}
                                {item.questionNumber ? ` · Q${item.questionNumber} (${item.shortTitle})` : ''}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                Flagged via {item.sourceLabel}
                              </div>
                            </div>
                          </div>
                          <div className="pl-5 text-slate-900 font-medium leading-relaxed">
                            {item.instruction}
                          </div>
                        </div>

                        <div className="col-span-5 pl-3 border-l border-slate-200 text-[11px] text-slate-600 leading-relaxed break-words">
                          {item.currentExcerpt}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional Alignment Audit Flags (if present & toggled on) */}
              {includeAlignmentFlags && alignmentFlags.length > 0 && (
                <div className="space-y-2 break-inside-avoid">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    02. Additional Playbook &amp; Alignment Flags ({alignmentFlags.length})
                  </h2>
                  <div className="border border-slate-300 rounded-xl divide-y divide-slate-200 text-xs">
                    {alignmentFlags.map((flag, idx) => (
                      <div key={flag.id || idx} className="p-2.5 space-y-0.5 break-inside-avoid">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            {idx + 1}. {flag.title}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {flag.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed">{flag.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviewer Notes Thread (if toggled on & present) */}
              {hasReviewNotes && includeReviewNotes && (
                <div className="space-y-2 break-inside-avoid">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    03. Recorded Reviewer &amp; Liaison Notes ({reviewNotes.length})
                  </h2>
                  <div className="border border-slate-300 rounded-xl divide-y divide-slate-200 text-xs">
                    {reviewNotes.map((note) => {
                      const matchedLiaison =
                        note.authorRole === 'division_liaison' && note.authorEmail
                          ? directoryUsers.find(
                              (u) => u.email.toLowerCase() === note.authorEmail.toLowerCase()
                            )
                          : undefined;
                      const isInvitee =
                        note.authorRole === 'division_liaison' &&
                        (Boolean(note.isInvitee) ||
                          (matchedLiaison ? isUserInviteeForUnion(proposal.union, matchedLiaison) : false));
                      const roleText =
                        note.authorRole === 'division_liaison'
                          ? isInvitee
                            ? 'Division Liaison · Invitee'
                            : 'Division Liaison · Voting'
                          : note.authorRole === 'treasurer'
                          ? 'Union Treasurer'
                          : note.authorRole === 'coordinator'
                          ? 'Union Coordinator'
                          : note.authorRole === 'super_admin'
                          ? 'SSD Division Admin'
                          : 'Proposal Author';
                      return (
                        <div key={note.id} className="p-2.5 space-y-1 break-inside-avoid">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              <strong className="text-slate-900">{note.authorName || 'Reviewer'}</strong> ·{' '}
                              {roleText}
                              {note.readinessRating
                                ? ` · ${REVIEW_READINESS_LABELS[note.readinessRating]}`
                                : ''}
                            </span>
                            <span>
                              {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-line leading-relaxed break-words">
                            {note.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Workflow Resubmission Footer */}
              <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50 print:bg-white text-[11px] text-slate-700 space-y-1 break-inside-avoid">
                <div className="font-extrabold uppercase tracking-wider text-[10px] text-slate-900">
                  How to Complete &amp; Resubmit Revisions in OneVoice27
                </div>
                <p className="leading-relaxed">
                  1. If this proposal is currently locked under a Union Committee Vote, the{' '}
                  <strong>Union Treasurer</strong> clicks{' '}
                  <em>&ldquo;Reopen Review for Author Revisions&rdquo;</em> on the proposal page. · 2. The{' '}
                  <strong>Proposal Author / Director</strong> updates each flagged section above in the
                  online builder. · 3. Once verified by the Union, re-record / confirm the Union Vote so
                  assigned <strong>Division Liaisons</strong> can complete their Step 4 recommendation vote.
                </p>
              </div>
            </div>
          ) : (
            /* =================================================================
               MODE 1 & MODE 2: OFFICIAL COMMITTEE PACKET / GOVERNANCE DOSSIER
               ================================================================= */
            <div className="space-y-5 print:space-y-4">
              {/* 6-Step Governance Pipeline Strip */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 print:bg-white print:border-slate-300 space-y-2.5 break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    6-Step Governance Pipeline
                  </span>
                  <span className="font-bold text-slate-900">
                    {stepStatus.currentStepLabel} ·{' '}
                    <span className="font-normal text-slate-600">
                      {stepStatus.liaisonSummary.progressLabel}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[10px] tabular-nums">
                  {governanceSteps.map((st) => (
                    <div
                      key={st.num}
                      className={`px-2 py-1.5 rounded-lg border ${
                        st.alert
                          ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                          : st.done
                          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-bold print:border-slate-400'
                          : st.active
                          ? 'border-slate-900 bg-white text-slate-900 font-extrabold'
                          : 'border-slate-200 bg-white text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Step {st.num}</span>
                        <span>{st.alert ? '!' : st.done ? '✓' : st.active ? '•' : ''}</span>
                      </div>
                      <div className="truncate mt-0.5">{st.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional 1-Line Union Territory Baseline Strip */}
              {includeTerritoryStrip && territoryProfile && (
                <div className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white print:border-slate-300 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums break-inside-avoid">
                  <strong className="text-slate-900">
                    {territoryProfile.acronym} Territory Baseline:
                  </strong>
                  <span>{territoryProfile.churches.toLocaleString()} Churches</span>
                  <span aria-hidden="true">·</span>
                  <span>{territoryProfile.membership.toLocaleString()} Members</span>
                  <span aria-hidden="true">·</span>
                  <span>Pop. Ratio 1:{territoryProfile.memberToPopRatio.toLocaleString()}</span>
                  <span aria-hidden="true">·</span>
                  <span>{territoryProfile.avgInternetPenetrationPct}% Online</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {territoryProfile.leastReachedGroupsCount.toLocaleString()} Unreached Groups
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-800">
                    {territoryProfile.sensitivityLevel}
                  </span>
                </div>
              )}

              {/* Executive Summary & Leadership Directory */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs print:border-slate-300 break-inside-avoid">
                {/* Top Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 print:divide-slate-300 bg-slate-50/60 print:bg-white">
                  <div className="sm:col-span-5 p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Strategic Pillar ({pillarShort}) &amp; Global Objective
                    </span>
                    <div className="font-bold text-slate-900 leading-snug">
                      {proposal.strategicFocus || '— None Specified —'}
                    </div>
                    <div className="text-slate-600 leading-snug break-words">
                      Objective: <strong className="text-slate-800">{effectiveObjective}</strong>
                    </div>
                  </div>

                  <div className="sm:col-span-4 p-3.5 space-y-1 tabular-nums">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Primary 2027 KPI &amp; Continuity
                    </span>
                    <div className="font-bold text-slate-900 leading-snug">
                      {selectedKpiObj
                        ? `${selectedKpiObj.number}. ${selectedKpiObj.title}`
                        : 'No KPI Selected'}
                    </div>
                    <div className="text-slate-600">
                      2027 Target:{' '}
                      <strong className="text-slate-900">
                        {parsedKpi.formatted || proposal.kpiNumber || '0'}
                      </strong>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      2024–25 Baseline:{' '}
                      <strong className="text-slate-700">
                        {proposal.hadSimilarProject2Years === 'yes'
                          ? proposal.priorProjectMetric?.trim() || 'Yes (metric not entered)'
                          : proposal.hadSimilarProject2Years === 'no'
                          ? 'New Initiative'
                          : 'Unspecified'}
                      </strong>
                    </div>
                  </div>

                  <div className="sm:col-span-3 p-3.5 sm:text-right space-y-1 tabular-nums">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      {isProposalApproved ? 'Approved Budget' : 'Requested Budget'}
                    </span>
                    <div className="text-base font-black text-[#1c398e] print:text-black">
                      US$ {fmtMoney(grandTotal)}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {selectedAudiences.length === 0
                        ? 'No audience selected'
                        : `${frontlineCount} Frontline (C–E) · ${equippingCount} Equipping (A–B)`}
                    </div>
                  </div>
                </div>

                {/* Leadership & Contacts Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 print:divide-slate-300 border-t border-slate-200 print:border-slate-300 bg-white">
                  {/* 1. Point of Contact */}
                  <div className="p-3 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Proposal Point of Contact
                    </span>
                    <div className="font-bold text-slate-900 break-words">{pocName}</div>
                    {pocEmail && (
                      <div className="text-[11px] text-slate-600 break-all">{pocEmail}</div>
                    )}
                    {pocPhone && <div className="text-[11px] text-slate-500">{pocPhone}</div>}
                  </div>

                  {/* 2. Union Lead(s) */}
                  <div className="p-3 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Union OneVoice27 Lead ({unionCode})
                    </span>
                    {manualUnionLeadName || manualUnionLeadEmail || manualUnionLeadPhone ? (
                      <>
                        <div className="font-bold text-slate-900 break-words">
                          {manualUnionLeadName || 'Union Lead'}
                        </div>
                        {manualUnionLeadEmail && (
                          <div className="text-[11px] text-slate-600 break-all">
                            {manualUnionLeadEmail}
                          </div>
                        )}
                        {manualUnionLeadPhone && (
                          <div className="text-[11px] text-slate-500">{manualUnionLeadPhone}</div>
                        )}
                      </>
                    ) : registeredUnionLeads.length > 0 ? (
                      <div className="space-y-1">
                        {registeredUnionLeads.slice(0, 2).map((lead) => (
                          <div key={lead.uid || lead.email} className="leading-snug">
                            <span className="font-bold text-slate-900">
                              {lead.displayName || lead.email}
                            </span>{' '}
                            <span className="text-[10px] text-slate-500">
                              ({lead.role === 'treasurer' ? 'Treasurer' : 'Coordinator'})
                            </span>
                            {lead.email && (
                              <div className="text-[11px] text-slate-600 break-all">
                                {lead.email}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">Not listed</div>
                    )}
                  </div>

                  {/* 3. Division Liaison(s) */}
                  <div className="p-3 space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Assigned Division Liaison(s)
                    </span>
                    {manualLiaisonName || manualLiaisonEmail || manualLiaisonPhone ? (
                      <div className="pb-1">
                        <div className="font-bold text-slate-900 break-words">
                          {manualLiaisonName || 'Division Liaison'}
                        </div>
                        {manualLiaisonEmail && (
                          <div className="text-[11px] text-slate-600 break-all">
                            {manualLiaisonEmail}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {assignedDivisionLiaisons.length > 0 ? (
                      <div className="space-y-1">
                        {assignedDivisionLiaisons.map((liaison) => {
                          const v = (proposal.liaisonVotes || []).find(
                            (vote) =>
                              vote.liaisonEmail.toLowerCase() === liaison.email.toLowerCase()
                          );
                          return (
                            <div key={liaison.uid || liaison.email} className="leading-snug">
                              <span className="font-bold text-slate-900">
                                {liaison.displayName || liaison.email}
                              </span>
                              {v && (
                                <span className="text-[10px] text-slate-600">
                                  {' '}
                                  · {v.vote === 'recommended' ? 'Voted ✓' : 'Revision Req.'}
                                </span>
                              )}
                              {liaison.email && (
                                <div className="text-[11px] text-slate-600 break-all">
                                  {liaison.email}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : !manualLiaisonName && !manualLiaisonEmail ? (
                      <div className="text-slate-400 italic">Pending assignment</div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Core Proposal Narrative Sections (01 - 07) */}
              <div className="space-y-3.5 text-xs">
                {/* 01. Overview */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white print:border-slate-300 break-inside-avoid space-y-1">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    01. Project Overview
                  </h2>
                  <div className="text-slate-800 leading-relaxed">
                    <FormattedNarrativeText
                      text={proposal.overview}
                      fallback="No overview provided."
                    />
                  </div>
                </div>

                {/* 02. Goal */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white print:border-slate-300 break-inside-avoid space-y-1">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    02. Goal of the Project
                  </h2>
                  <div className="text-slate-800 leading-relaxed">
                    <FormattedNarrativeText
                      text={proposal.goal}
                      fallback="No goal statement provided."
                    />
                  </div>
                </div>

                {/* 03. Expected Outcomes */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white print:border-slate-300 break-inside-avoid space-y-1">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    03. Expected Outcomes
                  </h2>
                  <div className="text-slate-800 leading-relaxed">
                    <FormattedNarrativeText
                      text={proposal.outcomes}
                      fallback="No expected outcomes described."
                    />
                  </div>
                </div>

                {/* 04. Key Measurement of Success & Continuity */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white print:border-slate-300 break-inside-avoid space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 print:border-slate-200">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      04. Key Measurement of Success (Primary KPI)
                    </h2>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {selectedKpiObj
                        ? `${selectedKpiObj.number}. ${selectedKpiObj.title}`
                        : 'No metric selected'}{' '}
                      · Target: {parsedKpi.formatted || proposal.kpiNumber || '0'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">
                        Metric Definition &amp; Verification:
                      </span>
                      <div className="text-slate-800 leading-relaxed">
                        <FormattedNarrativeText text={proposal.kpiDescription} fallback="—" />
                      </div>
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">
                        Strategic Rationale:
                      </span>
                      <div className="text-slate-800 leading-relaxed">
                        <FormattedNarrativeText text={proposal.kpiRationale} fallback="—" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 print:border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 tabular-nums">
                    <span>
                      Similar project completed in 2024–2025:{' '}
                      <strong className="uppercase text-slate-900">
                        {proposal.hadSimilarProject2Years || 'Unspecified'}
                      </strong>
                    </span>
                    {proposal.hadSimilarProject2Years === 'yes' && proposal.priorProjectMetric && (
                      <span>
                        Prior 2-Year Baseline Result:{' '}
                        <strong className="text-slate-900">{proposal.priorProjectMetric}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* 05. Project Deliverables */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white print:border-slate-300 break-inside-avoid space-y-1">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    05. Project Deliverables
                  </h2>
                  <div className="text-slate-800 leading-relaxed">
                    <FormattedNarrativeText
                      text={proposal.deliverables}
                      fallback="No deliverables specified."
                    />
                  </div>
                </div>

                {/* 06. Target Audience Segments */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white print:border-slate-300 break-inside-avoid space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      06. Target Audience Segments
                    </h2>
                    {selectedAudiences.length > 0 && (
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {frontlineCount > 0 ? `${frontlineCount} Frontline Outreach (C–D–E)` : ''}
                        {frontlineCount > 0 && equippingCount > 0 ? ' · ' : ''}
                        {equippingCount > 0 ? `${equippingCount} Church Equipping (A–B)` : ''}
                      </span>
                    )}
                  </div>

                  {selectedAudiences.length === 0 ? (
                    <p className="text-slate-500 italic">No target audience selected.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-800">
                      {selectedAudiences.map((aud) => (
                        <li key={aud.id} className="flex items-start gap-2 leading-snug">
                          <span className="font-bold text-slate-500 shrink-0">•</span>
                          <span>
                            <strong className="text-slate-900">{aud.fullLabel}</strong>{' '}
                            <span className="text-[10px] text-slate-500">
                              ({aud.isFrontline ? 'Frontline Outreach' : 'Church Equipping'})
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {(proposal.targetAudiences || []).includes('E') && proposal.audienceEDetails && (
                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                      <span className="font-bold text-slate-900 block">
                        Category E Specific Unreached / People Group Details:
                      </span>
                      <div className="text-slate-800">
                        <FormattedNarrativeText text={proposal.audienceEDetails} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 07. Points of Integration */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white print:border-slate-300 break-inside-avoid space-y-1">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    07. Points of Integration &amp; Local Church Handoff
                  </h2>
                  <div className="text-slate-800 leading-relaxed">
                    <FormattedNarrativeText
                      text={proposal.pointsOfIntegration}
                      fallback="No points of integration specified."
                    />
                  </div>
                </div>
              </div>

              {/* 08. Itemized Budget Ledger & Live 4-Entity Share Breakdown */}
              <div className="space-y-3 break-inside-avoid">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  08. Itemized Budget &amp; Contributing Entity Share Breakdown
                </h2>

                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs print:border-slate-300">
                  <div className="grid grid-cols-12 bg-slate-100 font-bold p-2.5 text-slate-700 border-b border-slate-200 print:border-slate-300 tabular-nums">
                    <div className="col-span-1">#</div>
                    <div className="col-span-7">Activity / Item Description</div>
                    <div className="col-span-2 text-right">% Share</div>
                    <div className="col-span-2 text-right">Amount (USD)</div>
                  </div>

                  {validBudgetItems.length === 0 ? (
                    <div className="p-3 text-slate-500 italic">No budget items entered.</div>
                  ) : (
                    validBudgetItems.map((item, idx) => {
                      const itemAmount = Number(item.divisionFunding ?? item.gcFunding) || 0;
                      const sharePct = grandTotal > 0 ? (itemAmount / grandTotal) * 100 : 0;
                      return (
                        <div
                          key={item.id || idx}
                          className="grid grid-cols-12 p-2.5 border-b border-slate-100 items-center print:border-slate-200 tabular-nums"
                        >
                          <div className="col-span-1 text-slate-400 font-semibold">{idx + 1}</div>
                          <div className="col-span-7 font-medium text-slate-800 break-words pr-2">
                            {item.activity || 'Untitled item'}
                          </div>
                          <div className="col-span-2 text-right text-slate-500">
                            {sharePct.toFixed(1)}%
                          </div>
                          <div className="col-span-2 text-right font-bold text-slate-900">
                            US$ {itemAmount.toLocaleString()}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div className="grid grid-cols-12 p-3 bg-slate-50 font-bold text-xs sm:text-sm border-t-2 border-slate-300 print:bg-slate-100 tabular-nums">
                    <div className="col-span-8 text-slate-900">
                      {isProposalApproved
                        ? 'Total Approved Proposal Budget'
                        : 'Total Requested Proposal Budget'}
                    </div>
                    <div className="col-span-2 text-right text-slate-600">100.0%</div>
                    <div className="col-span-2 text-right text-[#1c398e] font-black print:text-black">
                      US$ {fmtMoney(grandTotal)}
                    </div>
                  </div>
                </div>

                {/* Live Cumulative 4-Entity Share Breakdown */}
                {includeShareBreakdown && attribution && attribution.proposalTotal > 0 && (
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 print:bg-white print:border-slate-300 space-y-2.5 text-xs tabular-nums break-inside-avoid">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                        {isProposalApproved
                          ? `100% Proposal Share Breakdown (US$ ${fmtMoney(attribution.proposalTotal)})`
                          : `Projected Pool Formula Share Preview (US$ ${fmtMoney(attribution.proposalTotal)})`}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">
                        {attribution.poolStatus === 'pool_depleted'
                          ? 'Pool Depleted · 100% Union Over-Pool Responsibility'
                          : attribution.poolStatus === 'partial_deficit'
                          ? `Partial Pool Depletion (+US$ ${fmtMoney(
                              attribution.overPoolDeficitAmount
                            )} Union Over-Pool Responsibility)`
                          : `Within Union Pool${
                              unionSummary
                                ? ` (Pool Remaining: US$ ${fmtMoney(unionSummary.poolRemainingAmount)})`
                                : ''
                            }`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 print:border-slate-300">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          GC Share ({formatAttributionPct(attribution.gcPct)})
                        </span>
                        <strong className="text-slate-900 font-black text-sm">
                          US$ {fmtMoney(attribution.gcAmount)}
                        </strong>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 print:border-slate-300">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          SSD Share ({formatAttributionPct(attribution.ssdPct)})
                        </span>
                        <strong className="text-slate-900 font-black text-sm">
                          US$ {fmtMoney(attribution.ssdAmount)}
                        </strong>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 print:border-slate-300">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          SPD Share ({formatAttributionPct(attribution.spdPct)})
                        </span>
                        <strong className="text-slate-900 font-black text-sm">
                          US$ {fmtMoney(attribution.spdAmount)}
                        </strong>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 print:border-slate-300">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          Union Share ({formatAttributionPct(attribution.unionPct)})
                        </span>
                        <strong className="text-slate-900 font-black text-sm block">
                          US$ {fmtMoney(attribution.unionAmount)}
                        </strong>
                        {attribution.overPoolDeficitAmount > 0 && (
                          <span className="text-[10px] text-rose-800 print:text-black font-semibold">
                            Incl. US$ {fmtMoney(attribution.overPoolDeficitAmount)} over-pool
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Mode 2 Section: SSD 7-Question Review Rubric Scorecard */}
              {includeRubricScorecard && (
                <div className="space-y-2 break-inside-avoid">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      09. SSD 7-Question Project Review Rubric ({7 - flaggedCriteriaSet.size}/7 Adequate)
                    </h2>
                    <span className="text-xs font-bold text-slate-900">
                      Verdict: {frameworkEval.effectiveRatingLabel}
                      <span className="font-normal text-slate-500">
                        {' '}
                        ({frameworkEval.ratingSource === 'liaison_certified'
                          ? 'Liaison Certified'
                          : frameworkEval.ratingSource === 'governance_certified'
                          ? 'Governance Certified'
                          : 'Auto-Evaluated'})
                      </span>
                    </span>
                  </div>

                  {frameworkEval.hasSplitLiaisonVerdict && (
                    <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/70 print:bg-white text-[11px] text-amber-950 print:text-black">
                      <strong>Split Liaison Verdicts Recorded:</strong> Assigned Division Liaisons
                      recorded differing rubric verdicts; summary reflects the more cautious rating
                      until aligned.
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs print:border-slate-300">
                    <div className="grid grid-cols-12 bg-slate-100 font-bold p-2.5 text-slate-700 border-b border-slate-200 print:border-slate-300">
                      <div className="col-span-4 pr-2">Criterion &amp; Section</div>
                      <div className="col-span-6 px-2">Proposal Evidence / Required Action</div>
                      <div className="col-span-2 text-right">Status</div>
                    </div>

                    {frameworkEval.questions.map((q) => {
                      const isFlagged = flaggedCriteriaSet.has(q.key);
                      const customAction = liaisonInstructionByCriterion[q.key];
                      return (
                        <div
                          key={q.key}
                          className="grid grid-cols-12 p-2.5 border-b last:border-b-0 border-slate-100 print:border-slate-200 items-start break-inside-avoid"
                        >
                          <div className="col-span-4 pr-2">
                            <div className="font-bold text-slate-900">
                              Q{q.number}. {q.shortTitle}
                            </div>
                            <div className="text-[10px] text-slate-500">{q.sectionLabel}</div>
                          </div>

                          <div className="col-span-6 px-2 text-[11px] text-slate-700 space-y-1 break-words">
                            <div>{q.extractedEvidence}</div>
                            {isFlagged && (
                              <div className="font-semibold text-amber-950 print:text-black">
                                Action Needed
                                {customAction ? ` (${customAction.by})` : ''}:{' '}
                                {customAction ? customAction.instruction : q.defaultFixInstruction}
                              </div>
                            )}
                          </div>

                          <div className="col-span-2 text-right font-bold text-[11px]">
                            {isFlagged ? (
                              <span className="text-amber-800 print:text-black">Needs Work</span>
                            ) : (
                              <span className="text-emerald-800 print:text-black">Adequate ✓</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Optional Strategic Alignment & Playbook Audit Checklist */}
              {includeAlignmentFlags && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 print:bg-white print:border-slate-300 space-y-2.5 break-inside-avoid text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                    <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
                      Strategic Alignment &amp; Playbook Audit
                    </span>
                    <span className="font-bold text-slate-700 tabular-nums">
                      {alignmentFlags.length === 0
                        ? 'Passed · 0 Flags'
                        : `${alignmentFlags.length} ${
                            alignmentFlags.length === 1 ? 'Flag Identified' : 'Flags Identified'
                          }`}
                    </span>
                  </div>

                  {alignmentFlags.length === 0 ? (
                    <p className="text-slate-700 leading-relaxed">
                      <strong>Verified Alignment:</strong> Selected Primary KPI matches the Global
                      Objective ({effectiveObjective}), and OneVoice27 Playbook, Audience, and
                      Treasury itemization checks pass with zero flags.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {alignmentFlags.map((flag, idx) => (
                        <div
                          key={flag.id || idx}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 print:border-slate-300 space-y-0.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">
                              {idx + 1}. {flag.title}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {flag.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-700 leading-relaxed break-words">
                            {flag.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Optional Role-Badged Reviewer Notes */}
              {hasReviewNotes && includeReviewNotes && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 print:bg-white print:border-slate-300 space-y-2.5 break-inside-avoid text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                    <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
                      Reviewer, Liaison &amp; Treasury Notes
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {reviewNotes.length} {reviewNotes.length === 1 ? 'note' : 'notes'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {reviewNotes.map((note) => {
                      const matchedLiaison =
                        note.authorRole === 'division_liaison' && note.authorEmail
                          ? directoryUsers.find(
                              (u) => u.email.toLowerCase() === note.authorEmail.toLowerCase()
                            )
                          : undefined;
                      const isInvitee =
                        note.authorRole === 'division_liaison' &&
                        (Boolean(note.isInvitee) ||
                          (matchedLiaison ? isUserInviteeForUnion(proposal.union, matchedLiaison) : false));

                      const roleLabel =
                        note.authorRole === 'division_liaison'
                          ? isInvitee
                            ? 'Liaison · Invitee'
                            : 'Liaison · Voting'
                          : note.authorRole === 'treasurer'
                          ? 'Union Treasurer'
                          : note.authorRole === 'coordinator'
                          ? 'Union Coordinator'
                          : note.authorRole === 'super_admin'
                          ? 'SSD Division Admin'
                          : 'Author';

                      return (
                        <div
                          key={note.id}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 print:border-slate-300 space-y-1 break-inside-avoid"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>
                              <strong className="text-slate-900">
                                {note.authorName || 'Reviewer'}
                              </strong>{' '}
                              · {roleLabel}
                              {note.readinessRating
                                ? ` · ${REVIEW_READINESS_LABELS[note.readinessRating]}`
                                : ''}
                            </span>
                            <span>
                              {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-line leading-relaxed break-words">
                            {note.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===============================================================
                  3-TIER DIGITAL GOVERNANCE & AUDIT CERTIFICATE (STEPS 3 · 4 · 5)
                 =============================================================== */}
              <div className="pt-4 border-t-2 border-slate-900 space-y-3 break-inside-avoid">
                <div className="border-2 border-slate-900 rounded-2xl p-5 bg-slate-50/40 print:bg-white space-y-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-2.5">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1c398e] print:text-black block">
                        Southern Asia-Pacific Division · OneVoice27 Digital Governance Record
                      </span>
                      <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                        Certificate of Committee Actions, Liaison Review &amp; Authorization
                      </h3>
                    </div>
                    <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-900">
                      {stepStatus.step5Complete
                        ? 'Step 5 · Fully Authorized ✓'
                        : stepStatus.step4Complete
                        ? 'Step 4 · Liaison Recommended ✓'
                        : stepStatus.liaisonSummary.hasRevisionRequested
                        ? 'Step 4 · Revision Requested'
                        : stepStatus.step3Complete
                        ? 'Step 3 · Union Voted ✓'
                        : 'Pre-Vote Submission'}
                    </span>
                  </div>

                  {/* TIER 1: STEP 3 UNION COMMITTEE ACTION */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                        Step 3 · Union Committee Action &amp; Endorsement
                      </span>
                      <span className="text-[10px] font-bold text-slate-600">
                        {proposal.unionApproval?.actionNumber
                          ? 'Digitally Certified ✓'
                          : 'Awaiting Union Vote'}
                      </span>
                    </div>

                    {proposal.unionApproval?.actionNumber ? (
                      <div className="p-3 rounded-xl bg-white border border-slate-200 print:border-slate-300 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Action / Vote No.
                            </span>
                            <strong className="text-slate-900 text-sm font-black">
                              {proposal.unionApproval.actionNumber}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Action Date
                            </span>
                            <strong className="text-slate-900 font-bold">
                              {proposal.unionApproval.actionDate}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Approving Body
                            </span>
                            <strong className="text-slate-900 font-bold">
                              {resolveApprovingBodyLabel(
                                proposal.unionApproval.actionNumber,
                                proposal.unionApproval.committeeType,
                                proposal.unionApproval.otherCommitteeType
                              )}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Voted Budget
                            </span>
                            <strong className="text-slate-900 font-black">
                              US$ {fmtMoney(grandTotal)}
                            </strong>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 print:border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                          <span>
                            Certified by:{' '}
                            <strong className="text-slate-900">
                              {proposal.unionApproval.approvedBy} ({proposal.unionApproval.approvedByRole})
                            </strong>{' '}
                            · {proposal.unionApproval.approvedByEmail}
                          </span>
                          <span>{formatAuditTimestamp(proposal.unionApproval.timestamp)}</span>
                        </div>

                        {proposal.unionApproval.minutesExcerpt && (
                          <div className="pt-1.5 border-t border-slate-100 print:border-slate-200 italic text-[11px] text-slate-700 break-words">
                            &ldquo;{proposal.unionApproval.minutesExcerpt}&rdquo;
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-white text-[11px] text-slate-600">
                        Pending official Union Executive / Administrative Committee vote recording by
                        the Union Treasurer.
                      </div>
                    )}
                  </div>

                  {/* TIER 2: STEP 4 DIVISION LIAISON REVIEW & VOTES */}
                  <div className="pt-2.5 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                        Step 4 · Division Liaison Review &amp; Recommendation
                      </span>
                      <span className="text-[10px] font-bold text-slate-600">
                        {stepStatus.liaisonSummary.progressLabel}
                      </span>
                    </div>

                    {stepStatus.liaisonSummary.votes.length > 0 ? (
                      <div className="space-y-1.5">
                        {stepStatus.liaisonSummary.votes.map((v, idx) => (
                          <div
                            key={`${v.liaisonEmail}-${idx}`}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 print:border-slate-300 space-y-1"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <strong className="text-slate-900">{v.liaisonName}</strong>{' '}
                                <span className="text-[11px] text-slate-500">
                                  ({v.liaisonEmail})
                                </span>
                              </div>
                              <div className="font-bold text-[11px]">
                                {v.vote === 'recommended'
                                  ? 'Recommended to OV27 ✓'
                                  : 'Revision Requested'}
                                {v.readinessRating
                                  ? ` · ${REVIEW_READINESS_LABELS[v.readinessRating]}`
                                  : ''}
                              </div>
                            </div>
                            {v.recommendation && (
                              <p className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed break-words">
                                {v.recommendation}
                              </p>
                            )}
                            <div className="text-[10px] text-slate-400">
                              Recorded {formatAuditTimestamp(v.timestamp)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : proposal.divisionApproval?.authorized &&
                      proposal.divisionApproval?.liaisonOverride ? (
                      <div className="p-2.5 rounded-xl bg-white border border-slate-300 text-[11px] text-slate-700">
                        <strong>Administrative Step 4 Override Recorded:</strong> Authorized directly
                        by Division Administration without prior Liaison vote
                        {proposal.divisionApproval.liaisonOverrideReason
                          ? ` — Reason: "${proposal.divisionApproval.liaisonOverrideReason}"`
                          : '.'}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-white text-[11px] text-slate-600">
                        {stepStatus.step3Complete
                          ? 'Union Committee Vote recorded. Awaiting assigned Division Liaison Step 4 review and recommendation vote.'
                          : 'Unlocks for formal Division Liaison recommendation vote once Step 3 Union Vote is recorded.'}
                      </div>
                    )}
                  </div>

                  {/* TIER 3: STEP 5 SSD OV27 COMMITTEE AUTHORIZATION */}
                  <div className="pt-2.5 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                        Step 5 · SSD OneVoice27 Committee Final Project Authorization
                      </span>
                      <span className="text-[10px] font-bold text-slate-600">
                        {proposal.divisionApproval?.authorized
                          ? 'Authorized ✓'
                          : 'Pending OV27 Committee'}
                      </span>
                    </div>

                    {proposal.divisionApproval?.authorized ? (
                      <div className="p-3 rounded-xl bg-white border border-slate-300 space-y-2 tabular-nums">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Authorizing Division Officer
                            </span>
                            <strong className="text-slate-900">
                              {proposal.divisionApproval.authorizedBy} (
                              {proposal.divisionApproval.authorizedByRole})
                            </strong>
                            <div className="text-[11px] text-slate-500 break-all">
                              {proposal.divisionApproval.authorizedByEmail}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Authorization Date &amp; Ref
                            </span>
                            <strong className="text-slate-900">
                              {proposal.divisionApproval.authorizedDate}
                              {proposal.divisionApproval.referenceNumber
                                ? ` · Ref #${proposal.divisionApproval.referenceNumber}`
                                : ''}
                            </strong>
                            <div className="text-[10px] text-slate-500">
                              {formatAuditTimestamp(proposal.divisionApproval.timestamp)}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Authorized Appropriation
                            </span>
                            <strong className="text-slate-900 font-black text-sm">
                              US$ {fmtMoney(grandTotal)}
                            </strong>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700">
                          <span>
                            GC Project Code:{' '}
                            <strong className="font-mono text-slate-900">
                              {resolveProposalProjectCode(proposal, 1, {
                                allowFallbackSequence: false,
                              }).composite}
                            </strong>
                          </span>
                          <span>
                            Lifecycle:{' '}
                            <strong className="text-slate-900">
                              {proposal.projectCode?.phase || 'Planning'} · {proposal.projectCode?.status || 'Active'}
                            </strong>
                          </span>
                        </div>

                        {proposal.divisionApproval.remarks && (
                          <div className="pt-1.5 border-t border-slate-100 italic text-[11px] text-slate-700 break-words">
                            &ldquo;{proposal.divisionApproval.remarks}&rdquo;
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-white text-[11px] text-slate-600">
                        Awaiting final SSD OneVoice27 Committee appropriation authorization.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENT FOOTER */}
          <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-slate-200 print:text-slate-600">
            OneVoice27 · Southern Asia-Pacific Division of Seventh-day Adventists · {modeSubtitle} ·
            Authenticated Digital Governance Record
          </div>
        </div>
      </div>
    </div>
  );
}
