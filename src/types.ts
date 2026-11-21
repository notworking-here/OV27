export interface UserProfile {
  name: string;
  email: string;
  division: string; // Union / Division
  union?: string;
  department: string;
  institution: string;
}

export interface UnionCategory {
  category: string;
  unions: string[];
}

export const UNION_CATEGORIES: UnionCategory[] = [
  {
    category: 'Union Conferences',
    unions: [
      'East Central Philippine Union Conference',
      'East Indonesia Union Conference',
      'Southwestern Philippine Union Conference',
    ],
  },
  {
    category: 'Union Missions',
    unions: [
      'Central Indonesia Union Mission',
      'Malaysia Union Mission',
      'Myanmar Union Mission',
      'Northern Luzon Philippine Union Mission',
      'Southeastern Asia Union Mission',
      'Southeastern Philippine Union Mission',
      'Southern Luzon Philippine Union Mission',
      'West Central Philippine Union Mission',
      'West Indonesia Union Mission',
    ],
  },
  {
    category: 'Attached Fields',
    unions: [
      'Singapore Conference',
      'Timor-Leste Mission',
    ],
  },
];

export const UNIONS: string[] = UNION_CATEGORIES.flatMap((c) => c.unions);

// Full categories including Division Headquarters & Other (for User Profiles, Roles, and Staff Directory)
export const ALL_INSTITUTION_CATEGORIES: UnionCategory[] = [
  ...UNION_CATEGORIES,
  {
    category: 'Division & Other',
    unions: [
      'Southern Asia-Pacific Division (SSD Headquarters)',
      'Other Union / Attached Field',
    ],
  },
];

export const ALL_INSTITUTION_UNIONS: string[] = ALL_INSTITUTION_CATEGORIES.flatMap((c) => c.unions);

export const UNION_ACRONYMS: Record<string, string> = {
  'East Central Philippine Union Conference': 'ECPUC',
  'East Indonesia Union Conference': 'EIUC',
  'Southwestern Philippine Union Conference': 'SWPUC',
  'Central Indonesia Union Mission': 'CIUM',
  'Malaysia Union Mission': 'MAUM',
  'Myanmar Union Mission': 'MYUM',
  'Northern Luzon Philippine Union Mission': 'NLPUM',
  'NLPUM': 'NLPUM',
  'NLUM': 'NLPUM',
  'Southeastern Asia Union Mission': 'SEUM',
  'Southeastern Asia Union Mission (Oversees and Brunei)': 'SEUM',
  'Southeastern Asia Union Mission (Overseas and Brunei)': 'SEUM',
  'Southeastern Philippine Union Mission': 'SePUM',
  'Southern Luzon Philippine Union Mission': 'SLPUM',
  'SLPUM': 'SLPUM',
  'SLUM': 'SLPUM',
  'West Central Philippine Union Mission': 'WCPUM',
  'West Indonesia Union Mission': 'WIUM',
  'Singapore Conference': 'SAC',
  'SAC': 'SAC',
  'Timor-Leste Mission': 'TLM',
  'TLM': 'TLM',
  'Southern Asia-Pacific Division (SSD Headquarters)': 'SSD',
  'Southern Asia-Pacific Division': 'SSD',
  'SSD - Southern Asia-Pacific Division': 'SSD',
  'SSD': 'SSD',
  'SAUM': 'SEUM',
};

/**
 * Resolves any union name, alias, or acronym to the exact canonical UNIONS string.
 * Prevents fuzzy cross-matching bugs between similar union names (e.g. East vs Central Indonesia).
 */
export function getCanonicalUnion(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // 1. Direct match in UNIONS
  const exact = UNIONS.find((u) => u.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  // 2. Acronym match (e.g. "ECPUC", "SLPUM", "SLUM", "SAUM")
  const upper = trimmed.toUpperCase();
  const acronymMap: Record<string, string> = {
    ECPUC: 'East Central Philippine Union Conference',
    EIUC: 'East Indonesia Union Conference',
    SWPUC: 'Southwestern Philippine Union Conference',
    CIUM: 'Central Indonesia Union Mission',
    MAUM: 'Malaysia Union Mission',
    MYUM: 'Myanmar Union Mission',
    NLPUM: 'Northern Luzon Philippine Union Mission',
    NLUM: 'Northern Luzon Philippine Union Mission',
    SEUM: 'Southeastern Asia Union Mission',
    SAUM: 'Southeastern Asia Union Mission',
    SEPUM: 'Southeastern Philippine Union Mission',
    SLPUM: 'Southern Luzon Philippine Union Mission',
    SLUM: 'Southern Luzon Philippine Union Mission',
    WCPUM: 'West Central Philippine Union Mission',
    WIUM: 'West Indonesia Union Mission',
    SAC: 'Singapore Conference',
    TLM: 'Timor-Leste Mission',
    SSD: 'Southern Asia-Pacific Division (SSD Headquarters)',
  };
  if (acronymMap[upper]) {
    return acronymMap[upper];
  }

  // 3. Known aliases
  if (trimmed.toLowerCase().includes('singapore')) return 'Singapore Conference';
  if (trimmed.toLowerCase().includes('timor')) return 'Timor-Leste Mission';
  if (trimmed.toLowerCase().includes('malaysia')) return 'Malaysia Union Mission';
  if (trimmed.toLowerCase().includes('myanmar')) return 'Myanmar Union Mission';
  if (
    trimmed.toLowerCase().includes('southeastern asia') ||
    trimmed.toLowerCase().includes('southeast asia') ||
    trimmed.toLowerCase().includes('brunei') ||
    trimmed.toLowerCase().includes('oversees') ||
    trimmed.toLowerCase().includes('overseas')
  ) {
    return 'Southeastern Asia Union Mission';
  }
  if (trimmed.toLowerCase().includes('east central')) return 'East Central Philippine Union Conference';
  if (trimmed.toLowerCase().includes('southwestern')) return 'Southwestern Philippine Union Conference';
  if (trimmed.toLowerCase().includes('southeastern philippine')) return 'Southeastern Philippine Union Mission';
  if (trimmed.toLowerCase().includes('southern luzon')) return 'Southern Luzon Philippine Union Mission';
  if (trimmed.toLowerCase().includes('northern luzon')) return 'Northern Luzon Philippine Union Mission';
  if (trimmed.toLowerCase().includes('west central')) return 'West Central Philippine Union Mission';
  if (trimmed.toLowerCase().includes('east indonesia')) return 'East Indonesia Union Conference';
  if (trimmed.toLowerCase().includes('central indonesia')) return 'Central Indonesia Union Mission';
  if (trimmed.toLowerCase().includes('west indonesia')) return 'West Indonesia Union Mission';
  if (trimmed.toLowerCase().includes('division') || trimmed.toLowerCase().includes('headquarters')) {
    return 'Southern Asia-Pacific Division (SSD Headquarters)';
  }

  return trimmed;
}

/**
 * Returns all common database aliases and acronym variants for a given union.
 * Used for Firestore queries with 'in' operator to ensure documents saved with either
 * acronyms or full titles are returned.
 */
export function getUnionQueryVariants(unionInput?: string): string[] {
  if (!unionInput) return [];
  const canon = getCanonicalUnion(unionInput);
  const variants = new Set<string>();
  if (canon) variants.add(canon);
  variants.add(unionInput.trim());

  const acronym = UNION_ACRONYMS[canon] || UNION_ACRONYMS[unionInput];
  if (acronym) variants.add(acronym);

  for (const [key, val] of Object.entries(UNION_ACRONYMS)) {
    if (val === acronym || getCanonicalUnion(key) === canon) {
      variants.add(key);
    }
  }

  return Array.from(variants).filter(Boolean).slice(0, 30);
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
}

export type KPIType =
  | 'reach_exposure'
  | 'engagement_participation'
  | 'connection_next_steps'
  | 'retention_nurturing'
  | 'implementation_capability'
  | '';

export interface BudgetItem {
  id: string;
  activity: string;
  divisionFunding: number;
  localFunding?: number;
  gcFunding?: number;
}

export type UserRole = 'super_admin' | 'coordinator' | 'treasurer' | 'division_liaison' | 'user';

export function isHubRole(role?: string): boolean {
  return role === 'super_admin' || role === 'coordinator' || role === 'treasurer' || role === 'division_liaison';
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return (
    e === 'astanyer@adventist.asia' ||
    e === 'adpsalms272017@gmail.com'
  );
}

/**
 * Identifies whether the user is a Division-level Treasurer (based at SSD HQ or with division-wide scope)
 * or a Division Super Administrator authorized to grant final Division Treasury project authorization.
 */
export function isDivisionLevelTreasurerOrAdmin(user?: UserAccount | null): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || isSuperAdminEmail(user.email)) return true;
  if (user.role === 'treasurer') {
    const u = (user.union || '').trim().toLowerCase();
    return !u || u === 'ssd' || u.includes('division') || u.includes('headquarters');
  }
  return false;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  union: string;
  assignedUnions?: string[]; // Official Step 4 Voting Unions for Division Liaisons, and multi-entity unions for other roles
  inviteeUnions?: string[]; // Specific Unions where a Division Liaison has Invitee (View & Comment Only) access
  inviteeAllUnions?: boolean; // 1-Click Division-Wide Invitee toggle: View & Comment across all other SSD Unions without voting power
  isLiaison?: boolean; // Allows a Division Admin (super_admin) to also act as a Division Liaison with Step 4 Voting Power
  liaisonVotingUnions?: string[]; // Official Step 4 Voting Unions for a Division Admin acting as a Liaison
  title?: string; // Official office title (e.g. Communication Director, Union Treasurer, Hope Channel Lead)
  department?: string;
  institution?: string;
  unionConfirmed?: boolean;
}

/**
 * Returns true if the account is eligible to hold Step 4 Division Liaison voting power
 * (either a dedicated division_liaison, or a super_admin explicitly enabled as a Liaison).
 */
export function isUserLiaisonEligible(user?: UserAccount | null): boolean {
  if (!user) return false;
  if (user.role === 'division_liaison') return true;
  if (user.role === 'super_admin') {
    return (
      Boolean(user.isLiaison) ||
      (user.isLiaison !== false &&
        Array.isArray(user.liaisonVotingUnions) &&
        user.liaisonVotingUnions.length > 0)
    );
  }
  return Boolean(user.isLiaison);
}

/**
 * Returns all 14 canonical SSD territorial Unions (excluding Division Headquarters and Other).
 */
export function getAllTerritorialUnions(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of UNIONS) {
    const lower = u.toLowerCase();
    if (lower.includes('division') || lower.includes('headquarters') || lower.includes('other')) {
      continue;
    }
    const canon = getCanonicalUnion(u);
    if (canon && canon !== 'Southern Asia-Pacific Division (SSD Headquarters)' && !seen.has(canon)) {
      seen.add(canon);
      result.push(canon);
    }
  }
  return result;
}

function isHeadquartersOrEmptyUnion(unionStr?: string): boolean {
  if (!unionStr) return true;
  const lower = unionStr.trim().toLowerCase();
  return (
    !lower ||
    lower === 'ssd' ||
    lower.includes('division') ||
    lower.includes('headquarters') ||
    lower.includes('other')
  );
}

/**
 * Returns ONLY the canonical Unions where a Division Liaison (or Division Admin acting as Liaison)
 * holds formal Step 4 Voting Power and counts toward the Union's Step 4 quorum.
 * Note: An SSD HQ base union NEVER implicitly grants division-wide voting power.
 */
export function getUserVotingUnions(user?: UserAccount | null): string[] {
  if (!user || !isUserLiaisonEligible(user)) return [];

  let rawList: string[] = [];
  if (user.role === 'super_admin') {
    const explicitLiaisonUnions = (user.liaisonVotingUnions || []).filter(Boolean);
    if (explicitLiaisonUnions.length > 0) {
      rawList = [...explicitLiaisonUnions];
    } else if (user.isLiaison) {
      // Legacy fallback: if a super_admin has isLiaison enabled without populated liaisonVotingUnions,
      // inherit their concrete territorial home union and bounded assignedUnions (< 12) so they are counted.
      if (user.union && !isHeadquartersOrEmptyUnion(user.union)) {
        rawList.push(user.union);
      }
      if (
        Array.isArray(user.assignedUnions) &&
        user.assignedUnions.length > 0 &&
        user.assignedUnions.length < 12
      ) {
        rawList.push(...user.assignedUnions);
      }
    }
  } else {
    rawList = [...(user.assignedUnions || []), ...(user.liaisonVotingUnions || [])];
    if (user.union && !isHeadquartersOrEmptyUnion(user.union)) {
      rawList.push(user.union);
    }
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of rawList) {
    if (!item) continue;
    const canon = getCanonicalUnion(item);
    if (canon === 'Southern Asia-Pacific Division (SSD Headquarters)') continue;
    if (canon && !seen.has(canon)) {
      seen.add(canon);
      result.push(canon);
    }
  }
  return result;
}

/**
 * Returns the canonical Unions where a Division Liaison acts strictly as an Invitee (View & Comment Only),
 * excluding any Union where they already hold formal Step 4 Voting Power.
 */
export function getUserInviteeUnions(user?: UserAccount | null): string[] {
  if (!user || user.role !== 'division_liaison') return [];

  const votingSet = new Set(getUserVotingUnions(user));
  if (user.inviteeAllUnions) {
    return getAllTerritorialUnions().filter((u) => !votingSet.has(u));
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of user.inviteeUnions || []) {
    if (!item) continue;
    const canon = getCanonicalUnion(item);
    if (canon === 'Southern Asia-Pacific Division (SSD Headquarters)') continue;
    if (canon && !votingSet.has(canon) && !seen.has(canon)) {
      seen.add(canon);
      result.push(canon);
    }
  }
  return result;
}

/**
 * Returns true if the user is a Division Liaison accessing the target Union strictly as an Invitee
 * (View & Comment Only, without Step 4 voting power).
 */
export function isUserInviteeForUnion(unionInput?: string, user?: UserAccount | null): boolean {
  if (!user || user.role !== 'division_liaison' || !unionInput) return false;
  const canon = getCanonicalUnion(unionInput);
  if (!canon) return false;
  if (getUserVotingUnions(user).includes(canon)) return false;
  return getUserInviteeUnions(user).includes(canon);
}

/**
 * Returns all union territories authorized for a user account to VIEW and COMMENT on:
 * - For Division Liaisons: combines their explicit Voting Unions + Invitee Unions.
 * - For HQ Coordinators / Treasurers with no sub-territory restrictions: division-wide scope.
 * - For Union Officers / Authors: primary union + assignedUnions.
 */
export function getUserAllUnions(user?: UserAccount | null): string[] {
  if (!user) return [];

  if (user.role === 'division_liaison') {
    const combined = [...getUserVotingUnions(user), ...getUserInviteeUnions(user)];
    return Array.from(new Set(combined));
  }

  let rawList: string[] = [];
  const isHQUnion = isHeadquartersOrEmptyUnion(user.union);

  if (isHQUnion && (user.role === 'coordinator' || user.role === 'treasurer')) {
    if (user.assignedUnions && user.assignedUnions.length > 0) {
      rawList = [...user.assignedUnions];
    } else {
      rawList = getAllTerritorialUnions();
    }
  } else {
    rawList = [user.union, ...(user.assignedUnions || [])].filter(Boolean);
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of rawList) {
    if (!item) continue;
    const canon = getCanonicalUnion(item);
    if (canon === 'Southern Asia-Pacific Division (SSD Headquarters)') continue;
    if (canon && !seen.has(canon)) {
      seen.add(canon);
      result.push(canon);
    }
  }

  return result;
}

/**
 * Checks whether the current user has territorial authority to record/edit Step 3 Union Committee votes
 * on the given proposal (Super Admin, Division Treasurer, or a Union Treasurer assigned to that Union).
 */
export function canUserManageUnionApproval(
  proposal: Pick<Proposal, 'union'>,
  user?: UserAccount | null
): boolean {
  if (!user || !user.email) return false;
  if (isDivisionLevelTreasurerOrAdmin(user)) return true;
  if (user.role !== 'treasurer') return false;
  const canonProposalUnion = getCanonicalUnion(proposal.union || '');
  if (!canonProposalUnion) return true;
  return getUserAllUnions(user).map(getCanonicalUnion).includes(canonProposalUnion);
}

/**
 * Checks whether the current user can unlock / reopen an approved proposal:
 * - Once Step 5 (SSD OV27 Committee) is authorized, ONLY Super Admins or Division Treasurers can unlock/reopen.
 * - Prior to Step 5 authorization, Union Treasurers of that Union (plus Division Treasurers & Super Admins) can reopen.
 */
export function canUserReopenApprovedProposal(
  proposal: Pick<Proposal, 'union' | 'divisionApproval'>,
  user?: UserAccount | null
): boolean {
  if (!user || !user.email) return false;
  if (proposal.divisionApproval?.authorized) {
    return isDivisionLevelTreasurerOrAdmin(user);
  }
  return canUserManageUnionApproval(proposal, user);
}

/**
 * Checks whether the current user can cast a Step 4 Liaison Vote on the given proposal
 * (Division Liaison OR Division Admin acting as Liaison, restricted strictly to their assigned Voting Unions).
 * Invitee Liaisons and non-assigned Division Admins cannot cast Step 4 votes (Admins retain Step 5 Override).
 */
export function canUserVoteStep4Liaison(
  proposal: Pick<Proposal, 'union'>,
  user?: UserAccount | null
): boolean {
  if (!user || !user.email) return false;
  if (!isUserLiaisonEligible(user)) return false;
  const canonProposalUnion = getCanonicalUnion(proposal.union || '');
  if (!canonProposalUnion) return false;
  return getUserVotingUnions(user).includes(canonProposalUnion);
}

/**
 * Checks whether the current signed-in user is authorized to post or mark-read Review Notes
 * on the given proposal in Firestore (Author / POC, Union Officer, Assigned Liaison, Division Treasurer, or Super Admin).
 */
export function canUserPostProposalNote(
  proposal: Pick<Proposal, 'union' | 'userId' | 'userEmail' | 'pointOfContact'>,
  user?: UserAccount | null
): boolean {
  if (!user || !user.email) return false;
  if (isDivisionLevelTreasurerOrAdmin(user)) return true;

  const emailLower = user.email.trim().toLowerCase();
  const isOwner =
    Boolean(user.uid && proposal.userId && proposal.userId === user.uid) ||
    Boolean(proposal.userEmail && proposal.userEmail.trim().toLowerCase() === emailLower) ||
    Boolean(
      proposal.pointOfContact?.email &&
        proposal.pointOfContact.email.trim().toLowerCase() === emailLower
    );
  if (isOwner && user.role !== 'division_liaison') return true;

  if (
    user.role === 'treasurer' ||
    user.role === 'coordinator' ||
    user.role === 'division_liaison'
  ) {
    const canonProposalUnion = getCanonicalUnion(proposal.union || '');
    if (!canonProposalUnion) return false;
    return getUserAllUnions(user).map(getCanonicalUnion).includes(canonProposalUnion);
  }

  return false;
}

export interface UnionCommitteeApproval {
  actionNumber: string; // Official Committee Action / Vote Number (flexible format per entity convention)
  actionDate: string; // Date action was voted (YYYY-MM-DD)
  committeeType?: 'EXCOM' | 'ADCOM' | 'Officers' | 'Other' | string;
  otherCommitteeType?: string;
  approvedBy: string; // Name of certifying officer / Union Treasurer (tied to account)
  approvedByEmail: string; // Officer email (tied to account)
  approvedByRole: string; // Officer role / title (tied to account)
  matchingPledgeVoted?: number; // Confirmed matching budget commitment voted (optional, managed in settings)
  minutesExcerpt?: string; // Brief minutes resolution / excerpt / notes
  timestamp: string; // ISO datetime audit timestamp
}

export interface DivisionTreasuryAuthorization {
  authorized: boolean;
  authorizedBy: string; // Name of certifying Division Treasurer / Super Admin
  authorizedByEmail: string;
  authorizedByRole: string; // e.g. 'Division Treasurer' | 'Division Administrator'
  authorizedDate: string; // YYYY-MM-DD
  timestamp: string; // ISO datetime audit timestamp
  referenceNumber?: string; // Optional Division Treasury / Appropriation Ref #
  remarks?: string; // Optional treasury authorization notes
  liaisonOverride?: boolean; // True if Super Admin authorized in Step 5 via explicit Step 4 Liaison override checkbox
  liaisonOverrideReason?: string; // Recorded audit reason for the Step 4 Liaison override
}

export type ReviewReadinessRating =
  | 'meeting_requirement'
  | 'needs_improvement'
  | 'not_fitting_pathways';

export type ReviewCriterionKey =
  | 'q1_pillar'
  | 'q2_pathway'
  | 'q3_input'
  | 'q4_activity'
  | 'q5_output'
  | 'q6_handoff'
  | 'q7_continuity';

export const REVIEW_READINESS_LABELS: Record<ReviewReadinessRating, string> = {
  meeting_requirement: 'Meeting Requirement',
  needs_improvement: 'Needs Improvement',
  not_fitting_pathways: 'Not Fitting Pathways',
};

export interface LiaisonActionItem {
  criterionKey: ReviewCriterionKey;
  questionNumber: number;
  shortTitle: string;
  sectionId: string;
  sectionLabel: string;
  instruction: string;
}

export interface LiaisonVote {
  liaisonUid?: string;
  liaisonName: string;
  liaisonEmail: string;
  vote: 'recommended' | 'revision_requested';
  recommendation?: string;
  readinessRating?: ReviewReadinessRating;
  deficientCriteria?: ReviewCriterionKey[];
  actionItems?: LiaisonActionItem[];
  confirmedReviewedAndAssisted?: boolean;
  remainingFlagsOverrideReason?: string;
  acknowledgedRemainingFlags?: string[];
  timestamp: string;
}

export interface ProposalReviewNote {
  id: string;
  text: string;
  authorName: string;
  authorEmail: string;
  authorRole: UserRole;
  isInvitee?: boolean; // True when posted by a Division Coordinator acting as an Invitee (View & Comment Only)
  readinessRating?: ReviewReadinessRating;
  actionItems?: LiaisonActionItem[];
  createdAt: string;
  readBy?: string[];
}

export const PROJECT_PHASES = [
  'Planning',
  'Implementation',
  'Monitoring',
  'Final Evaluation',
  'Closure',
] as const;

export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const PROJECT_STATUSES = [
  'Active',
  'Closed',
  'On Hold',
] as const;

export type ProjectOperationalStatus = (typeof PROJECT_STATUSES)[number];

export type ActivityEventType =
  | 'created'
  | 'saved'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'liaison_voted'
  | 'division_authorized'
  | 'division_unauthorize'
  | 'project_code_edited'
  | 'project_code_locked'
  | 'phase_changed'
  | 'status_changed'
  | 'reopened'
  | 'returned_to_draft'
  | 'action_edited'
  | 'transferred'
  | 'deleted';

export interface ProposalActivityEvent {
  id: string;
  proposalId: string;
  proposalTitle?: string;
  union: string;
  type: ActivityEventType;
  timestamp: string;
  actorUid?: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole | string;
  details: string;
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

export interface ProposalProjectCode {
  composite: string;
  orgId: string;
  projectId: string | null;
  phase: ProjectPhase | string | null;
  status: ProjectOperationalStatus | string | null;
  locked?: boolean;
  lockedAt?: string;
  lockedBy?: string;
  lockedByEmail?: string;
}

export interface Proposal {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Author & Scoping
  userId?: string;
  userEmail?: string;
  userName?: string;
  union: string;
  status?: 'draft' | 'submitted' | 'under_review' | 'approved';
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  // Chronological Message Board Review Notes
  reviewNotes?: ProposalReviewNote[];

  // Immutable Chronological Lifecycle Activity Log & Audit Trail
  activityLog?: ProposalActivityEvent[];

  // Step 3: Union Committee Action Audit Trail
  unionApproval?: UnionCommitteeApproval;

  // Step 4: Division Liaison Review Recommendations & Formal Votes
  liaisonVotes?: LiaisonVote[];

  // Step 5: SSD OV27 Committee Final Project Authorization Audit Trail
  divisionApproval?: DivisionTreasuryAuthorization | null;

  // Ownership Transfer Audit
  transferredAt?: string;
  transferredBy?: string;
  transferredByEmail?: string;
  previousOwnerEmail?: string;
  previousOwnerName?: string;

  // Contacts
  pointOfContact: ContactInfo;
  divisionLeadContact: ContactInfo;
  gcLiaison: ContactInfo;

  // Strategy dropdowns
  strategicFocus: string;
  divisionProject: string;
  otherDivisionProject?: string;
  focusId?: number | null;
  strategicProjectId?: number | null;
  strategicObjectiveId?: number | null;
  strategicActivityId?: number | null;

  // Numbered sections
  title: string; // 1. Title
  overview: string; // 2. Overview
  goal: string; // 3. What is the Goal of the project?
  outcomes: string; // 4. Outcomes

  // 5. Key Measurement of Success
  kpiType: KPIType;
  kpiNumber: string;
  kpiDescription: string;
  kpiRationale: string;
  hadSimilarProject2Years: 'yes' | 'no' | '';
  priorProjectMetric?: string;

  // 6. Project Deliverables
  deliverables: string;

  // 7. Target Audience
  targetAudiences: string[];
  audienceEDetails: string;

  // 8. Points of Integration
  pointsOfIntegration: string;

  // Budget
  budgetItems: BudgetItem[];

  // External GC Project Accounting Code
  projectCode?: ProposalProjectCode;
}

export interface ProposalStepStatus {
  currentStepNumber: 0 | 1 | 2 | 3 | 4 | 5;
  currentStepShortBadge: string;
  currentStepLabel: string;
  currentStepDescription: string;
  step1Complete: boolean;
  step2Complete: boolean;
  step2Skipped: boolean;
  step3Complete: boolean;
  step4Complete: boolean;
  step5Complete: boolean;
  liaisonSummary: {
    votes: LiaisonVote[];
    recommendedVotes: LiaisonVote[];
    revisionVotes: LiaisonVote[];
    assignedCount: number;
    votedAssignedCount: number;
    totalRecommendedCount: number;
    allLiaisonsVoted: boolean;
    hasAnyLiaisonVoted: boolean;
    hasRevisionRequested: boolean;
    progressLabel: string;
  };
}

/**
 * Computes the unified 5-Step workflow status for any proposal:
 * - Step 1: Proposal is submitted
 * - Step 2: Union Treasurer & Coordinators can Review (Skippable)
 * - Step 3: Union Approves the proposal with Voted Action
 * - Step 4: Division Liaison review, make recommendations, and Vote
 * - Step 5: SSD OV27 Committee for Authorization
 */
export function getProposalStepStatus(
  proposal: Proposal,
  assignedLiaisons: UserAccount[] = []
): ProposalStepStatus {
  const isApproved =
    proposal.status === 'approved' || Boolean(proposal.unionApproval?.actionNumber?.trim());
  const isDivisionAuthorized = Boolean(proposal.divisionApproval?.authorized);
  const status = proposal.status || 'draft';

  const votes: LiaisonVote[] = Array.isArray(proposal.liaisonVotes) ? proposal.liaisonVotes : [];
  const recommendedVotes = votes.filter((v) => v.vote === 'recommended');
  const revisionVotes = votes.filter((v) => v.vote === 'revision_requested');

  // Deduplicate assigned liaisons by normalized email (or uid fallback) and match votes by email or uid
  const assignedKeyByEmail = new Map<string, string>();
  const assignedKeyByUid = new Map<string, string>();
  const uniqueAssignedKeys = new Set<string>();

  for (const u of assignedLiaisons) {
    const em = (u.email || '').trim().toLowerCase();
    const uid = (u.uid || '').trim();
    const key = em || uid;
    if (!key) continue;
    uniqueAssignedKeys.add(key);
    if (em) assignedKeyByEmail.set(em, key);
    if (uid) assignedKeyByUid.set(uid, key);
  }
  const assignedCount = uniqueAssignedKeys.size;

  const votedAssignedKeys = new Set<string>();
  for (const v of recommendedVotes) {
    const em = (v.liaisonEmail || '').trim().toLowerCase();
    const uid = (v.liaisonUid || '').trim();
    const matchedKey =
      (em && assignedKeyByEmail.get(em)) || (uid && assignedKeyByUid.get(uid));
    if (matchedKey) {
      votedAssignedKeys.add(matchedKey);
    }
  }

  const votedAssignedCount = votedAssignedKeys.size;
  const totalRecommendedCount = recommendedVotes.length;
  // An unassigned Super Admin vote (legacy) still satisfies Step 4, whereas a Super Admin assigned
  // as a Voting Liaison for this Union counts as 1 individual assigned Liaison toward quorum.
  const hasSuperAdminRecommendedVote = recommendedVotes.some((v) => {
    const em = (v.liaisonEmail || '').trim().toLowerCase();
    const uid = (v.liaisonUid || '').trim();
    const isAssigned =
      (em && assignedKeyByEmail.has(em)) || (uid && assignedKeyByUid.has(uid));
    return Boolean(em) && isSuperAdminEmail(em) && !isAssigned;
  });

  // Step 4 is complete when all assigned Liaisons for this Union have voted 'recommended',
  // when a non-assigned Super Admin recorded a legacy recommendation vote,
  // or (if no Liaison account is registered in the directory yet for this Union) when at least 1 Liaison has voted
  const allLiaisonsVoted =
    assignedCount > 0
      ? votedAssignedCount >= assignedCount || hasSuperAdminRecommendedVote
      : totalRecommendedCount > 0;
  const hasAnyLiaisonVoted = totalRecommendedCount > 0;
  const hasRevisionRequested = revisionVotes.length > 0 && !allLiaisonsVoted;

  let progressLabel = 'Awaiting Liaison Vote';
  if (isDivisionAuthorized && proposal.divisionApproval?.liaisonOverride && !allLiaisonsVoted) {
    progressLabel = 'Admin Override (No Liaison)';
  } else if (assignedCount > 0) {
    if (votedAssignedCount >= assignedCount) {
      progressLabel =
        assignedCount === 1
          ? `1/1 Liaison Voted ✓`
          : `All ${votedAssignedCount}/${assignedCount} Liaisons Voted ✓`;
    } else if (hasSuperAdminRecommendedVote) {
      progressLabel = 'Admin Recommended ✓';
    } else if (votedAssignedCount > 0) {
      progressLabel = `${votedAssignedCount}/${assignedCount} Liaisons Voted`;
    } else if (hasRevisionRequested) {
      progressLabel = `Revision Requested (${revisionVotes.length})`;
    } else {
      progressLabel = `0/${assignedCount} ${assignedCount === 1 ? 'Liaison' : 'Liaisons'} Voted`;
    }
  } else {
    if (totalRecommendedCount > 0) {
      progressLabel = `${totalRecommendedCount} ${
        totalRecommendedCount === 1 ? 'Liaison' : 'Liaisons'
      } Voted ✓`;
    } else if (hasRevisionRequested) {
      progressLabel = 'Liaison Revision Requested';
    } else {
      progressLabel = 'Awaiting Liaison Vote';
    }
  }

  // Determine whether Step 2 (Union Review) occurred or was skipped
  const hadReviewEvent = Boolean(
    proposal.activityLog?.some((ev) => ev.type === 'under_review' || ev.toStatus === 'under_review') ||
      (proposal.reviewNotes &&
        proposal.reviewNotes.some(
          (n) => n.authorRole === 'coordinator' || n.authorRole === 'treasurer'
        ))
  );
  const step1Complete = status !== 'draft' || isApproved;
  const step2Complete = status === 'under_review' || isApproved;
  const step2Skipped = isApproved && !hadReviewEvent;
  const step3Complete = isApproved;
  const step4Complete = isApproved && (allLiaisonsVoted || isDivisionAuthorized);
  const step5Complete = isApproved && isDivisionAuthorized;

  let currentStepNumber: 0 | 1 | 2 | 3 | 4 | 5 = 0;
  let currentStepShortBadge = 'Draft';
  let currentStepLabel = 'Draft Proposal';
  let currentStepDescription = 'Complete all required sections to submit for Step 1.';

  if (!isApproved) {
    if (status === 'submitted') {
      currentStepNumber = 1;
      currentStepShortBadge = 'Step 1 · Submitted';
      currentStepLabel = 'Step 1 · Proposal Submitted';
      currentStepDescription =
        'Submitted. Next: Step 2 Union Review (optional) or Step 3 Union Committee Vote.';
    } else if (status === 'under_review') {
      currentStepNumber = 2;
      currentStepShortBadge = 'Step 2 · Union Review';
      currentStepLabel = 'Step 2 · Union Treasurer & Coordinator Review';
      currentStepDescription = 'Under Union Review. Next: Step 3 Union Committee Voted Action.';
    }
  } else {
    if (isDivisionAuthorized) {
      currentStepNumber = 5;
      currentStepShortBadge = 'Step 5 · SSD OV27 Authorized ✓';
      currentStepLabel = 'Step 5 · SSD OV27 Committee Authorized';
      currentStepDescription =
        'Completed all 5 Steps: Union Voted, Liaison Reviewed, and Authorized by SSD OV27 Committee.';
    } else if (allLiaisonsVoted) {
      currentStepNumber = 5;
      currentStepShortBadge = 'Step 5 · SSD OV27 Committee';
      currentStepLabel = 'Step 5 · Ready for SSD OV27 Committee Authorization';
      currentStepDescription =
        'All assigned Division Liaisons have voted. Ready for Step 5 SSD OV27 Committee authorization.';
    } else {
      currentStepNumber = 4;
      currentStepShortBadge =
        assignedCount > 1 && votedAssignedCount > 0
          ? `Step 4 · Liaison Vote (${votedAssignedCount}/${assignedCount})`
          : 'Step 4 · Liaison Review & Vote';
      currentStepLabel = 'Step 4 · Division Liaison Review & Vote';
      currentStepDescription =
        'Union Committee Action voted (Step 3 ✓). Awaiting Division Liaison recommendation and vote before Step 5 SSD OV27 Committee.';
    }
  }

  return {
    currentStepNumber,
    currentStepShortBadge,
    currentStepLabel,
    currentStepDescription,
    step1Complete,
    step2Complete,
    step2Skipped,
    step3Complete,
    step4Complete,
    step5Complete,
    liaisonSummary: {
      votes,
      recommendedVotes,
      revisionVotes,
      assignedCount,
      votedAssignedCount,
      totalRecommendedCount,
      allLiaisonsVoted,
      hasAnyLiaisonVoted,
      hasRevisionRequested,
      progressLabel,
    },
  };
}

/**
 * Resolves the full list of review notes for a proposal.
 * Automatically synthesizes any legacy single-string `reviewerNotes` into the first note
 * so no historical notes are ever lost.
 */
export function getProposalReviewNotes(proposal: Proposal): ProposalReviewNote[] {
  if (proposal.reviewNotes && proposal.reviewNotes.length > 0) {
    return proposal.reviewNotes;
  }
  if (proposal.reviewerNotes && proposal.reviewerNotes.trim()) {
    return [
      {
        id: `legacy_note_${proposal.id}`,
        text: proposal.reviewerNotes.trim(),
        authorName: proposal.reviewedBy || 'Reviewer',
        authorEmail: '',
        authorRole: 'coordinator',
        createdAt: proposal.reviewedAt || proposal.updatedAt || proposal.createdAt,
      },
    ];
  }
  return [];
}

/**
 * Resolves the full activity log for a proposal, synthesizing baseline events (creation, submission, approval, liaison votes, authorization)
 * if none are recorded yet so legacy proposals display a rich, accurate history timeline.
 */
export function getProposalActivityLog(proposal: Proposal): ProposalActivityEvent[] {
  if (proposal.activityLog && proposal.activityLog.length > 0) {
    return [...proposal.activityLog].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  const events: ProposalActivityEvent[] = [];
  const authorName = proposal.userName || proposal.pointOfContact?.name || 'Project Author';
  const authorEmail = proposal.userEmail || proposal.pointOfContact?.email || '';

  // 1. Initial Creation Event
  events.push({
    id: `ev_create_${proposal.id}`,
    proposalId: proposal.id,
    proposalTitle: proposal.title || 'Untitled Proposal',
    union: proposal.union || 'Unassigned',
    type: 'created',
    timestamp: proposal.createdAt || new Date().toISOString(),
    actorName: authorName,
    actorEmail: authorEmail,
    actorRole: 'user',
    details: 'Proposal draft initialized in OneVoice27.',
    toStatus: 'draft',
  });

  // 2. Step 1: Submission Event (if submitted, under review, or approved)
  if (proposal.status && proposal.status !== 'draft') {
    events.push({
      id: `ev_submit_${proposal.id}`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled Proposal',
      union: proposal.union || 'Unassigned',
      type: 'submitted',
      timestamp: proposal.updatedAt || proposal.createdAt,
      actorName: authorName,
      actorEmail: authorEmail,
      actorRole: 'user',
      details: 'Step 1: Proposal submitted for Union review and committee action.',
      fromStatus: 'draft',
      toStatus: 'submitted',
    });
  }

  // 3. Ownership Transfer Event (if previously transferred)
  if (proposal.transferredAt) {
    events.push({
      id: `ev_transfer_${proposal.id}`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled Proposal',
      union: proposal.union || 'Unassigned',
      type: 'transferred',
      timestamp: proposal.transferredAt,
      actorName: proposal.transferredBy || 'Division Administrator',
      actorEmail: proposal.transferredByEmail || '',
      actorRole: 'super_admin',
      details: `Ownership transferred from ${proposal.previousOwnerName || proposal.previousOwnerEmail || 'previous owner'} to ${authorName}.`,
    });
  }

  // 4. Step 3: Union Committee Approved Event
  if (proposal.unionApproval?.actionNumber || proposal.status === 'approved') {
    events.push({
      id: `ev_approve_${proposal.id}`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled Proposal',
      union: proposal.union || 'Unassigned',
      type: 'approved',
      timestamp: proposal.unionApproval?.timestamp || proposal.reviewedAt || proposal.updatedAt,
      actorName: proposal.unionApproval?.approvedBy || proposal.reviewedBy || 'Union Officer',
      actorEmail: proposal.unionApproval?.approvedByEmail || '',
      actorRole: proposal.unionApproval?.approvedByRole || 'Union Officer',
      details: `Step 3: Union approved proposal with Voted Action #${proposal.unionApproval?.actionNumber || 'Voted'}.`,
      actionNumber: proposal.unionApproval?.actionNumber,
      fromStatus: 'under_review',
      toStatus: 'approved',
    });
  }

  // 5. Step 4: Division Liaison Vote Events
  if (proposal.liaisonVotes && proposal.liaisonVotes.length > 0) {
    proposal.liaisonVotes.forEach((lv, idx) => {
      const ratingBadge = lv.readinessRating
        ? ` [${REVIEW_READINESS_LABELS[lv.readinessRating]}]`
        : '';
      events.push({
        id: `ev_liaison_vote_${proposal.id}_${idx}`,
        proposalId: proposal.id,
        proposalTitle: proposal.title || 'Untitled Proposal',
        union: proposal.union || 'Unassigned',
        type: 'liaison_voted',
        timestamp: lv.timestamp || proposal.updatedAt,
        actorName: lv.liaisonName || 'Division Liaison',
        actorEmail: lv.liaisonEmail || '',
        actorRole: 'division_liaison',
        details:
          lv.vote === 'recommended'
            ? `Step 4: Division Liaison voted to recommend proposal to SSD OV27 Committee${ratingBadge}${
                lv.recommendation ? ` — "${lv.recommendation}"` : ''
              }.`
            : `Step 4: Division Liaison requested revisions${ratingBadge}${
                lv.recommendation ? ` — "${lv.recommendation}"` : ''
              }.`,
      });
    });
  }

  // 6. Step 5: SSD OV27 Committee Authorization Event
  if (proposal.divisionApproval?.authorized) {
    events.push({
      id: `ev_div_auth_${proposal.id}`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled Proposal',
      union: proposal.union || 'Unassigned',
      type: 'division_authorized',
      timestamp: proposal.divisionApproval.timestamp || proposal.updatedAt,
      actorName: proposal.divisionApproval.authorizedBy || 'SSD OV27 Committee',
      actorEmail: proposal.divisionApproval.authorizedByEmail || '',
      actorRole: proposal.divisionApproval.authorizedByRole || 'SSD OV27 Committee',
      details: `Step 5: Officially authorized by SSD OV27 Committee${
        proposal.divisionApproval.referenceNumber ? ` (Ref #${proposal.divisionApproval.referenceNumber})` : ''
      }${
        proposal.divisionApproval.liaisonOverride
          ? ` [Super Admin Step 4 Override Recorded: ${
              proposal.divisionApproval.liaisonOverrideReason || 'Authorized without Liaison vote'
            }]`
          : ''
      }.`,
      actionNumber: proposal.divisionApproval.referenceNumber || proposal.unionApproval?.actionNumber,
      fromStatus: 'approved',
      toStatus: 'approved',
    });
  }

  // 7. Project Code Locked Event (if locked)
  if (proposal.projectCode?.locked && proposal.projectCode.lockedAt) {
    events.push({
      id: `ev_code_lock_${proposal.id}`,
      proposalId: proposal.id,
      proposalTitle: proposal.title || 'Untitled Proposal',
      union: proposal.union || 'Unassigned',
      type: 'project_code_locked',
      timestamp: proposal.projectCode.lockedAt,
      actorName: proposal.projectCode.lockedBy || proposal.divisionApproval?.authorizedBy || 'SSD OV27 Committee',
      actorEmail: proposal.projectCode.lockedByEmail || proposal.divisionApproval?.authorizedByEmail || '',
      actorRole: 'super_admin',
      field: 'projectCode',
      newValue: proposal.projectCode.composite,
      details: `Project Code locked at Step 5 authorization: ${proposal.projectCode.composite}.`,
    });
  }

  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export const DIVISIONS = [
  'SSD - Southern Asia-Pacific Division',
  'ECD - East-Central Africa Division',
  'EUD - Inter-European Division',
  'IAD - Inter-American Division',
  'NAD - North American Division',
  'NSD - Northern Asia-Pacific Division',
  'SAD - South American Division',
  'SID - Southern Africa-Indian Ocean Division',
  'SPD - South Pacific Division',
  'SUD - Southern Asia Division',
  'TED - Trans-European Division',
  'WAD - West-Central Africa Division',
  'MENA - Middle East and North Africa Union Mission',
  'CHUM - Chinese Union Mission',
  'UKR - Ukrainian Union Conference',
  'GC - General Conference of Seventh-day Adventists',
  'Other Institutional Entity'
];

export const STRATEGIC_FOCUS_OPTIONS = [
  'Prayer, Training, and Inspiration',
  'Bold Initiatives, Materials, and Tools',
  'Proclamation, Harvesting, and Disciple Making',
] as const;

export const DIVISION_PROJECTS_BY_FOCUS: Record<string, string[]> = {
  'Prayer, Training, and Inspiration': [
    'Regional Media Evangelism & Creators Conferences',
  ],
  'Bold Initiatives, Materials, and Tools': [
    'Proclamation Kits & Contextualized Evangelistic Materials',
    'Global Contextualized Media Production',
    'Short-Form Content',
    'Mission Intelligence: Reaching Unreached People Groups',
  ],
  'Proclamation, Harvesting, and Disciple Making': [
    'Proclamation & Harvesting Initiatives',
    'Global Marketing Campaign',
  ],
};

export const ALL_DIVISION_PROJECT_OPTIONS = [
  'Regional Media Evangelism & Creators Conferences',
  'Proclamation Kits & Contextualized Evangelistic Materials',
  'Global Contextualized Media Production',
  'Short-Form Content',
  'Mission Intelligence: Reaching Unreached People Groups',
  'Proclamation & Harvesting Initiatives',
  'Global Marketing Campaign',
];

export const LEGACY_DIVISION_PROJECT_ALIASES: Record<string, string> = {
  'Vertical Short-Form Content': 'Short-Form Content',
  'Mission Intelligence for Reaching Unreached People Groups':
    'Mission Intelligence: Reaching Unreached People Groups',
  'Division proclamation and harvesting initiatives':
    'Proclamation & Harvesting Initiatives',
  'Division Proclamation & Harvesting Initiatives':
    'Proclamation & Harvesting Initiatives',
  'Division Proclamation':
    'Proclamation & Harvesting Initiatives',
};

export function getCanonicalDivisionProject(project?: string): string {
  if (!project) return '';
  const trimmed = project.trim();
  if (LEGACY_DIVISION_PROJECT_ALIASES[trimmed]) return LEGACY_DIVISION_PROJECT_ALIASES[trimmed];

  const lower = trimmed.toLowerCase();
  for (const [alias, canonical] of Object.entries(LEGACY_DIVISION_PROJECT_ALIASES)) {
    if (lower === alias.toLowerCase()) return canonical;
  }
  for (const opt of ALL_DIVISION_PROJECT_OPTIONS) {
    if (lower === opt.toLowerCase()) return opt;
    if (lower.includes(opt.toLowerCase())) return opt;
  }
  if (lower.includes('objective 6') || lower.includes('obj 6') || lower.includes('harvesting')) {
    return 'Proclamation & Harvesting Initiatives';
  }
  if (lower.includes('objective 1') || lower.includes('obj 1') || lower.includes('creator')) {
    return 'Regional Media Evangelism & Creators Conferences';
  }
  if (lower.includes('objective 2') || lower.includes('obj 2') || lower.includes('proclamation kit')) {
    return 'Proclamation Kits & Contextualized Evangelistic Materials';
  }
  if (lower.includes('objective 3') || lower.includes('obj 3') || lower.includes('media production')) {
    return 'Global Contextualized Media Production';
  }
  if (lower.includes('objective 4') || lower.includes('obj 4') || lower.includes('short-form') || lower.includes('short form')) {
    return 'Short-Form Content';
  }
  if (lower.includes('objective 5') || lower.includes('obj 5') || lower.includes('mission intelligence') || lower.includes('unreached') || lower.includes('upg')) {
    return 'Mission Intelligence: Reaching Unreached People Groups';
  }
  if (lower.includes('objective 7') || lower.includes('obj 7') || lower.includes('marketing campaign')) {
    return 'Global Marketing Campaign';
  }

  return trimmed;
}

export function getCanonicalKpiType(kpi?: string): KPIType {
  if (!kpi) return '';
  const trimmed = kpi.trim().toLowerCase();
  if (trimmed === 'reach_exposure' || trimmed.includes('reach') || trimmed.includes('exposure')) return 'reach_exposure';
  if (trimmed === 'engagement_participation' || trimmed.includes('engagement') || trimmed.includes('digital connection')) return 'engagement_participation';
  if (trimmed === 'connection_next_steps' || trimmed.includes('bridging') || (trimmed.includes('connection') && !trimmed.includes('digital'))) return 'connection_next_steps';
  if (trimmed === 'retention_nurturing' || trimmed.includes('discipleship') || trimmed.includes('retention')) return 'retention_nurturing';
  if (trimmed === 'implementation_capability' || trimmed.includes('mobilization') || trimmed.includes('capability')) return 'implementation_capability';
  return kpi as KPIType;
}

export const GLOBAL_OBJECTIVE_OPTIONS = ALL_DIVISION_PROJECT_OPTIONS;
export const DIVISION_PROJECT_OPTIONS = ALL_DIVISION_PROJECT_OPTIONS;

export interface KPIOption {
  id: KPIType;
  number: number;
  title: string;
  touchpoint?: string;
  focus: string;
  question: string;
  examples: string[];
  description: string;
}

export const KPI_OPTIONS: KPIOption[] = [
  {
    id: 'reach_exposure',
    number: 1,
    title: 'Reach & Exposure',
    focus: 'Broad public awareness and campaign visibility.',
    question: 'How many total people will see, hear, or encounter your message?',
    examples: [
      'Total video views',
      'Radio/broadcast listeners',
      'Social media impressions',
      'Campaign landing page visits',
    ],
    description: 'How many total people will see, hear, or encounter your message? Focus on broad public awareness and campaign visibility.',
  },
  {
    id: 'engagement_participation',
    number: 2,
    title: 'Engagement & Digital Connection',
    focus: 'Interactive, two-way communication and online relationships.',
    question: 'How many people will actively interact with your content or digital team?',
    examples: [
      'Direct message inquiries',
      'Prayer requests',
      'Comments',
      '1-on-1 conversations facilitated by digital missionaries (Power of 10)',
    ],
    description: 'How many people will actively interact with your content or digital team? Focus on interactive, two-way communication and online relationships.',
  },
  {
    id: 'connection_next_steps',
    number: 3,
    title: 'Connection & Bridging Handoff',
    focus: 'Transitioning people from digital contact into real-world relationships.',
    question: 'How many people will take a direct next step into a physical or hosted environment?',
    examples: [
      'Attendees at Class 1 (local church) or Class 2 (sponsored) bridging events',
      'Sign-ups for health/family seminars',
      'Consented local referrals',
    ],
    description: 'How many people will take a direct next step into a physical or hosted environment? Transitioning people from digital contact into real-world relationships.',
  },
  {
    id: 'retention_nurturing',
    number: 4,
    title: 'Discipleship & Retention',
    focus: 'Long-term spiritual growth, fellowship, and local church belonging.',
    question: 'How many individuals will be nurtured into ongoing discipleship and church community?',
    examples: [
      'Active participants in small groups/Sabbath School',
      'Completed Bible study series',
      'Baptisms',
      'Contacts remaining active 6+ months later',
    ],
    description: 'How many individuals will be nurtured into ongoing discipleship and church community? Focus on long-term spiritual growth, fellowship, and local church belonging.',
  },
  {
    id: 'implementation_capability',
    number: 5,
    title: 'Mobilization & Capability Building',
    focus: 'Equipping, training, and activating local members and creators for ministry.',
    question: 'How many trained leaders, creators, or volunteers will actively put their skills into practice?',
    examples: [
      'Digital missionaries active after 90 days',
      'Local creators publishing monthly content',
      'Local church host teams trained and deployed',
    ],
    description: 'How many trained leaders, creators, or volunteers will actively put their skills into practice? Focus on equipping, training, and activating local members and creators for ministry.',
  },
];

/**
 * Primary KPI alignment matrix by Global Objective.
 * Each of the 7 Global Objectives has dedicated allowed / recommended Primary KPIs.
 */
export const ALLOWED_KPIS_BY_OBJECTIVE: Record<string, KPIType[]> = {
  // Objective 1 (Pillar 1)
  'Regional Media Evangelism & Creators Conferences': [
    'implementation_capability', // KPI 5: Mobilization & Capability Building
    'engagement_participation',  // KPI 2: Engagement & Digital Connection
  ],
  // Objective 2 (Pillar 2)
  'Proclamation Kits & Contextualized Evangelistic Materials': [
    'reach_exposure',           // KPI 1: Reach & Exposure
    'engagement_participation', // KPI 2: Engagement & Digital Connection
    'connection_next_steps',    // KPI 3: Connection & Bridging Handoff
  ],
  // Objective 3 (Pillar 2)
  'Global Contextualized Media Production': [
    'reach_exposure',           // KPI 1: Reach & Exposure
    'engagement_participation', // KPI 2: Engagement & Digital Connection
  ],
  // Objective 4 (Pillar 2)
  'Short-Form Content': [
    'reach_exposure',           // KPI 1: Reach & Exposure
    'engagement_participation', // KPI 2: Engagement & Digital Connection
  ],
  // Objective 5 (Pillar 2)
  'Mission Intelligence: Reaching Unreached People Groups': [
    'reach_exposure',           // KPI 1: Reach & Exposure
    'engagement_participation', // KPI 2: Engagement & Digital Connection
    'connection_next_steps',    // KPI 3: Connection & Bridging Handoff
  ],
  // Objective 6 (Pillar 3) - Crucial: excludes KPI 5, includes KPI 4 (Discipleship & Retention) & KPI 3 (Connection & Bridging)
  'Proclamation & Harvesting Initiatives': [
    'retention_nurturing',      // KPI 4: Discipleship & Retention
    'connection_next_steps',    // KPI 3: Connection & Bridging Handoff
  ],
  // Objective 7 (Pillar 3)
  'Global Marketing Campaign': [
    'reach_exposure',           // KPI 1: Reach & Exposure
    'engagement_participation', // KPI 2: Engagement & Digital Connection
    'retention_nurturing',      // KPI 4: Discipleship & Retention
  ],
};

export const ALL_VALID_KPI_TYPES: KPIType[] = [
  'reach_exposure',
  'engagement_participation',
  'connection_next_steps',
  'retention_nurturing',
  'implementation_capability',
];

/**
 * Returns the list of valid KPI IDs for a given objective.
 * If no objective is selected yet, all KPIs are returned as selectable.
 */
export function getAllowedKPIsForObjective(objective?: string): KPIType[] {
  if (!objective) {
    return ALL_VALID_KPI_TYPES;
  }
  const canonical = getCanonicalDivisionProject(objective);
  return ALLOWED_KPIS_BY_OBJECTIVE[canonical] || ALLOWED_KPIS_BY_OBJECTIVE[objective] || ALL_VALID_KPI_TYPES;
}

/**
 * Checks whether a proposal's selected KPI is aligned with its Global Objective.
 */
export function isKpiAlignedWithObjective(objective?: string, kpiType?: KPIType | string): boolean {
  if (!kpiType) return true;
  if (!objective) return true;
  const canonicalKpi = getCanonicalKpiType(kpiType);
  const allowed = getAllowedKPIsForObjective(objective);
  return allowed.includes(canonicalKpi);
}

export const TARGET_AUDIENCE_OPTIONS = [
  {
    id: 'A1',
    label: 'A - Missional Minded Adventist'
  },
  {
    id: 'A2',
    label: 'A - Church Leadership & Ministry Professionals'
  },
  {
    id: 'A3',
    label: 'A - Children, Youth & Young Adults - (Churches, Schools, Training Centers, Colleges & Universities)'
  },
  {
    id: 'A4',
    label: 'A - Organizational Entities & Governance (Leaders and department staff of Divisions, Unions, Conferences and institutional entities)'
  },
  {
    id: 'B',
    label: 'B - Baptized Members of the Seventh-day Adventist Church, but not fully engaged in mission.'
  },
  {
    id: 'C',
    label: 'C - Individuals interested in the Seventh-day Adventist Church or its beliefs'
  },
  {
    id: 'D',
    label: 'D - Those who consider themselves Christian but not interested in the Seventh-day Adventist Church or its beliefs'
  },
  {
    id: 'E',
    label: 'E - Those from non-religious groups or other world religions'
  }
];

export type UnionBudgetAllocationsMap = Record<string, number>;

export interface UnionBudgetAllocation {
  union: string;
  allocatedAmount: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface StrategicKpi {
  id: string; // 'kpi_1', 'kpi_2', ...
  number: number; // 1 to 7
  title: string;
  pillarId: string; // 'pillar_1', 'pillar_2', 'pillar_3'
  pillarTitle: string;
  defaultCap: number; // default percentage cap
}

export interface StrategicPillar {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  defaultCap: number; // default percentage cap
  kpis: StrategicKpi[];
}

export const STRATEGIC_PILLARS_CONFIG: StrategicPillar[] = [
  {
    id: 'pillar_1',
    number: 1,
    title: 'Prayer, Training, and Inspiration',
    subtitle: 'Mobilizing, equipping, and inspiring creators and digital evangelists before content rollout.',
    defaultCap: 12.5,
    kpis: [
      {
        id: 'kpi_1',
        number: 1,
        title: 'Regional Media Evangelism & Creators Conferences',
        pillarId: 'pillar_1',
        pillarTitle: 'Prayer, Training, and Inspiration',
        defaultCap: 12.5,
      },
    ],
  },
  {
    id: 'pillar_2',
    number: 2,
    title: 'Bold Initiatives, Materials, and Tools',
    subtitle: 'Producing contextualized resources, media series, vertical video assets, and research tools.',
    defaultCap: 58.5,
    kpis: [
      {
        id: 'kpi_2',
        number: 2,
        title: 'Proclamation Kits & Contextualized Evangelistic Materials',
        pillarId: 'pillar_2',
        pillarTitle: 'Bold Initiatives, Materials, and Tools',
        defaultCap: 15.0,
      },
      {
        id: 'kpi_3',
        number: 3,
        title: 'Global Contextualized Media Production',
        pillarId: 'pillar_2',
        pillarTitle: 'Bold Initiatives, Materials, and Tools',
        defaultCap: 20.0,
      },
      {
        id: 'kpi_4',
        number: 4,
        title: 'Short-Form Content',
        pillarId: 'pillar_2',
        pillarTitle: 'Bold Initiatives, Materials, and Tools',
        defaultCap: 13.5,
      },
      {
        id: 'kpi_5',
        number: 5,
        title: 'Mission Intelligence: Reaching Unreached People Groups',
        pillarId: 'pillar_2',
        pillarTitle: 'Bold Initiatives, Materials, and Tools',
        defaultCap: 10.0,
      },
    ],
  },
  {
    id: 'pillar_3',
    number: 3,
    title: 'Proclamation, Harvesting, and Disciple Making',
    subtitle: 'Executing public marketing and local outreach campaigns, guiding responses to local churches.',
    defaultCap: 29.0,
    kpis: [
      {
        id: 'kpi_6',
        number: 6,
        title: 'Proclamation & Harvesting Initiatives',
        pillarId: 'pillar_3',
        pillarTitle: 'Proclamation, Harvesting, and Disciple Making',
        defaultCap: 17.0,
      },
      {
        id: 'kpi_7',
        number: 7,
        title: 'Global Marketing Campaign',
        pillarId: 'pillar_3',
        pillarTitle: 'Proclamation, Harvesting, and Disciple Making',
        defaultCap: 12.0,
      },
    ],
  },
];

export const ALL_STRATEGIC_KPIS = STRATEGIC_PILLARS_CONFIG.flatMap((p) => p.kpis);

export interface StrategicKpiCaps {
  pillarCaps: Record<string, number>;
  kpiCaps: Record<string, number>;
  updatedAt?: string;
  updatedBy?: string;
}

export type NotificationType =
  | 'proposal_submitted'
  | 'proposal_approved'
  | 'liaison_voted'
  | 'proposal_authorized'
  | 'note_added'
  | 'status_changed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  proposalId: string;
  proposalTitle: string;
  union?: string;
  targetRoles?: UserRole[];
  targetUserId?: string;
  targetUserEmail?: string;
  targetAudience?: string[]; // Indexed audience tokens for scoped Firestore queries
  createdBy: {
    name: string;
    email?: string;
    role: UserRole;
  };
  createdAt: string;
  readBy: string[]; // List of user IDs or emails who have marked this notification as read
  dismissedBy?: string[]; // List of user IDs or emails who have dismissed this notification
}

export type PillarFilterKey = 'all' | 'inspiration' | 'bold_initiatives' | 'proclamation';

export const PILLAR_FILTER_OPTIONS: {
  key: Exclude<PillarFilterKey, 'all'>;
  shortLabel: string;
  fullTitle: string;
}[] = [
  {
    key: 'inspiration',
    shortLabel: 'Inspiration',
    fullTitle: 'Prayer, Training, and Inspiration',
  },
  {
    key: 'bold_initiatives',
    shortLabel: 'Bold Initiatives',
    fullTitle: 'Bold Initiatives, Materials, and Tools',
  },
  {
    key: 'proclamation',
    shortLabel: 'Proclamation',
    fullTitle: 'Proclamation, Harvesting, and Disciple Making',
  },
];

/**
 * Resolves a proposal's canonical Strategic Pillar filter key ('inspiration' | 'bold_initiatives' | 'proclamation' | '').
 * Evaluates `strategicFocus` first and falls back to `divisionProject` if needed.
 */
export function getProposalPillarKey(
  proposal: Pick<Proposal, 'strategicFocus' | 'divisionProject'>
): Exclude<PillarFilterKey, 'all'> | '' {
  const focus = (proposal.strategicFocus || '').toLowerCase();
  if (focus.includes('prayer') || focus.includes('training') || focus.includes('inspiration')) {
    return 'inspiration';
  }
  if (focus.includes('bold') || focus.includes('materials') || focus.includes('tools')) {
    return 'bold_initiatives';
  }
  if (focus.includes('proclamation') || focus.includes('harvesting') || focus.includes('disciple')) {
    return 'proclamation';
  }

  // Fallback to canonical divisionProject mapping
  const canonProj = getCanonicalDivisionProject(proposal.divisionProject);
  if (canonProj === 'Regional Media Evangelism & Creators Conferences') {
    return 'inspiration';
  }
  if (
    canonProj === 'Proclamation Kits & Contextualized Evangelistic Materials' ||
    canonProj === 'Global Contextualized Media Production' ||
    canonProj === 'Short-Form Content' ||
    canonProj === 'Mission Intelligence: Reaching Unreached People Groups'
  ) {
    return 'bold_initiatives';
  }
  if (
    canonProj === 'Proclamation & Harvesting Initiatives' ||
    canonProj === 'Global Marketing Campaign'
  ) {
    return 'proclamation';
  }

  return '';
}

/**
 * Returns the clean short display label for a proposal's Strategic Pillar:
 * 'Inspiration', 'Bold Initiatives', 'Proclamation', or 'General Mission'.
 */
export function getProposalPillarShortLabel(
  proposal: Pick<Proposal, 'strategicFocus' | 'divisionProject'>
): string {
  const key = getProposalPillarKey(proposal);
  if (key === 'inspiration') return 'Inspiration';
  if (key === 'bold_initiatives') return 'Bold Initiatives';
  if (key === 'proclamation') return 'Proclamation';
  return proposal.strategicFocus ? proposal.strategicFocus.split(',')[0] : 'General Mission';
}

