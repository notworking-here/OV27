import { Proposal } from '../types';

export interface ValidationError {
  sectionId: string;
  field: string;
  label: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  completedCount: number;
  totalRequiredCount: number;
  completionPercentage: number;
}

/**
 * Validates whether all required fields in the proposal are filled before submission.
 */
export function validateProposalForSubmission(proposal: Proposal): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Point of Contact
  if (!proposal.pointOfContact?.name?.trim()) {
    errors.push({
      sectionId: 'section-point-of-contact',
      field: 'pointOfContact.name',
      label: 'Point of Contact Name',
      message: 'Please provide the name of the proposal point of contact.',
    });
  }
  if (!proposal.pointOfContact?.email?.trim()) {
    errors.push({
      sectionId: 'section-point-of-contact',
      field: 'pointOfContact.email',
      label: 'Point of Contact Email',
      message: 'Please provide a valid contact email address.',
    });
  }
  if (!proposal.pointOfContact?.phone?.trim()) {
    errors.push({
      sectionId: 'section-point-of-contact',
      field: 'pointOfContact.phone',
      label: 'Point of Contact Phone',
      message: 'Please provide a contact phone number.',
    });
  }

  // 2. Union OneVoice27 Lead Contact
  if (!proposal.divisionLeadContact?.name?.trim()) {
    errors.push({
      sectionId: 'section-lead-contact',
      field: 'divisionLeadContact.name',
      label: 'Union OneVoice27 Lead Name',
      message: 'Please provide the name of the Union OneVoice27 Lead.',
    });
  }
  if (!proposal.divisionLeadContact?.email?.trim()) {
    errors.push({
      sectionId: 'section-lead-contact',
      field: 'divisionLeadContact.email',
      label: 'Union OneVoice27 Lead Email',
      message: 'Please provide the Union OneVoice27 Lead email address.',
    });
  }

  // 3. Strategic Focus & Global Objective
  if (!proposal.strategicFocus?.trim()) {
    errors.push({
      sectionId: 'section-strategic-focus',
      field: 'strategicFocus',
      label: 'Strategic Focus',
      message: 'Please select a strategic focus for this proposal.',
    });
  }
  if (!proposal.divisionProject?.trim()) {
    errors.push({
      sectionId: 'section-strategic-focus',
      field: 'divisionProject',
      label: 'Global Objective',
      message: 'Please select one of the 7 Global Objectives.',
    });
  }

  // 4. Section 1: Title
  if (!proposal.title?.trim() || proposal.title.trim() === 'Untitled Proposal') {
    errors.push({
      sectionId: 'section-title',
      field: 'title',
      label: '1. Project Title',
      message: 'Please enter a descriptive project title.',
    });
  }

  // 5. Section 2: Overview
  if (!proposal.overview?.trim()) {
    errors.push({
      sectionId: 'section-overview',
      field: 'overview',
      label: '2. Project Overview',
      message: 'Please describe the nature and purpose of this project.',
    });
  }

  // 6. Section 3: Goal
  if (!proposal.goal?.trim()) {
    errors.push({
      sectionId: 'section-goal',
      field: 'goal',
      label: '3. Project Goal',
      message: 'Please state the primary goal and target direction.',
    });
  }

  // 7. Section 4: Outcomes
  if (!proposal.outcomes?.trim()) {
    errors.push({
      sectionId: 'section-outcomes',
      field: 'outcomes',
      label: '4. Outcomes',
      message: 'Please describe the tangible outcomes or community change expected.',
    });
  }

  // 8. Section 5: Key Measurement of Success (KPI)
  if (!proposal.kpiType) {
    errors.push({
      sectionId: 'section-kpi',
      field: 'kpiType',
      label: '5. Key Measurement Metric (KPI)',
      message: 'Please select 1 Key Performance Indicator (KPI) metric.',
    });
  }
  if (!proposal.kpiNumber?.trim()) {
    errors.push({
      sectionId: 'section-kpi',
      field: 'kpiNumber',
      label: '5. KPI Target Number',
      message: 'Please specify the target number for your chosen KPI.',
    });
  }
  if (!proposal.kpiDescription?.trim()) {
    errors.push({
      sectionId: 'section-kpi',
      field: 'kpiDescription',
      label: '5. KPI Metric Description',
      message: 'Please describe what this measurement counts.',
    });
  }
  if (!proposal.kpiRationale?.trim()) {
    errors.push({
      sectionId: 'section-kpi',
      field: 'kpiRationale',
      label: '5. KPI Rationale',
      message: 'Please explain why this metric is meaningful for your field.',
    });
  }
  if (!proposal.hadSimilarProject2Years) {
    errors.push({
      sectionId: 'section-kpi',
      field: 'hadSimilarProject2Years',
      label: '5. Previous Similar Project (2024-2025)',
      message: 'Please indicate Yes or No regarding whether a similar project was run previously.',
    });
  }

  // 9. Section 6: Deliverables
  if (!proposal.deliverables?.trim()) {
    errors.push({
      sectionId: 'section-deliverables',
      field: 'deliverables',
      label: '6. Project Deliverables',
      message: 'Please list the physical, media, or event deliverables provided.',
    });
  }

  // 10. Section 7: Target Audience
  if (!proposal.targetAudiences || proposal.targetAudiences.length === 0) {
    errors.push({
      sectionId: 'section-audience',
      field: 'targetAudiences',
      label: '7. Target Audience',
      message: 'Please select at least one primary target audience segment.',
    });
  } else if (proposal.targetAudiences.length > 3) {
    errors.push({
      sectionId: 'section-audience',
      field: 'targetAudiences',
      label: '7. Target Audience',
      message: `Please select a maximum of 3 target audience segments (currently ${proposal.targetAudiences.length} selected).`,
    });
  } else if (
    (proposal.targetAudiences.includes('E') || proposal.targetAudiences.includes('group_e')) &&
    !proposal.audienceEDetails?.trim()
  ) {
    errors.push({
      sectionId: 'section-audience',
      field: 'audienceEDetails',
      label: '7. Group E Audience Details',
      message: 'Please provide specific details about the non-Christian or world religion group targeted.',
    });
  }

  // 11. Section 8: Points of Integration
  if (!proposal.pointsOfIntegration?.trim()) {
    errors.push({
      sectionId: 'section-integration',
      field: 'pointsOfIntegration',
      label: '8. Points of Integration',
      message: 'Please specify departments or institutions partnering on this project.',
    });
  }

  // 12. Budget items
  const validBudgetItems = (proposal.budgetItems || []).filter(
    (item) =>
      (item.activity?.trim()?.length ?? 0) > 0 &&
      (Number(item.divisionFunding ?? item.gcFunding) || 0) > 0
  );
  if (validBudgetItems.length === 0) {
    errors.push({
      sectionId: 'section-budget',
      field: 'budgetItems',
      label: 'Budget Breakdown',
      message: 'Please add at least one budget activity line with an activity description and funding amount from Southern-Asia Pacific Division.',
    });
  }

  // Calculate completeness score
  const totalRequiredCount = 18;
  const completedCount = Math.max(0, totalRequiredCount - errors.length);
  const completionPercentage = Math.round((completedCount / totalRequiredCount) * 100);

  return {
    isValid: errors.length === 0,
    errors,
    completedCount,
    totalRequiredCount,
    completionPercentage,
  };
}

/**
 * Determines whether a proposal has actual substantive content entered by the user.
 * Used to avoid creating empty ghost documents in Firestore on new registration or fresh blank forms.
 */
export function hasMeaningfulProposalData(p: Proposal): boolean {
  if (!p) return false;

  // Non-draft proposals (submitted, under_review, approved) always have meaningful business data
  if (p.status && p.status !== 'draft') return true;

  // Title must not be blank or default placeholder
  const cleanTitle = (p.title || '').trim();
  const hasRealTitle =
    cleanTitle.length > 0 && cleanTitle.toLowerCase() !== 'untitled proposal';

  // Substantive text fields
  const hasOverview = Boolean(p.overview && p.overview.trim().length > 0);
  const hasGoal = Boolean(p.goal && p.goal.trim().length > 0);
  const hasOutcomes = Boolean(p.outcomes && p.outcomes.trim().length > 0);
  const hasDeliverables = Boolean(p.deliverables && p.deliverables.trim().length > 0);

  // Substantive budget items
  const hasBudget = Boolean(
    p.budgetItems &&
      p.budgetItems.some(
        (b) =>
          (b.activity && b.activity.trim().length > 0) ||
          (Number(b.divisionFunding ?? b.gcFunding) || 0) > 0 ||
          (Number(b.localFunding) || 0) > 0
      )
  );

  // Committee action or review notes
  const hasCommitteeAction = Boolean(p.unionApproval?.actionNumber?.trim());
  const hasReviewNotes = Boolean(p.reviewNotes && p.reviewNotes.length > 0);

  return (
    hasRealTitle ||
    hasOverview ||
    hasGoal ||
    hasOutcomes ||
    hasDeliverables ||
    hasBudget ||
    hasCommitteeAction ||
    hasReviewNotes
  );
}

/**
 * Checks if a proposal is completely empty with zero real data.
 * Used for automatic cleanup and purge of abandoned ghost proposals.
 */
export function isZeroDataProposal(p: Proposal): boolean {
  // Only drafts can ever be zero-data proposals
  if (p.status && p.status !== 'draft') return false;
  return !hasMeaningfulProposalData(p);
}
