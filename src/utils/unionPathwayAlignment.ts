import {
  Proposal,
  KPIType,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getCanonicalDivisionProject,
  getCanonicalKpiType,
  getProposalPillarKey,
} from '../types';
import { PLAYBOOK_PATHWAY_BY_KPI } from '../data/oneVoice27Playbook';
import {
  PUBLIC_MONITOR_STORAGE_KEY,
  PublicMonitorSnapshot,
} from '../services/publicMonitorService';
import { parseKpiTargetNumber } from './kpiExtraction';
import { getProposalBudgetBreakdown, getPillarIndex } from './monitorAnalytics';

export type PathwayStageNumber = 1 | 2 | 3 | 4 | 5;

export interface UnionPathwayPeerProposal {
  id: string;
  title: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved';
  pillarIndex: 1 | 2 | 3 | 0;
  strategicFocus: string;
  divisionProject: string;
  kpiType: Exclude<KPIType, ''> | '';
  stageNumber: PathwayStageNumber | 0;
  stageName: 'Reach' | 'Engage' | 'Connect' | 'Disciple' | 'Multiply' | 'Unassigned';
  targetNumericValue: number | null;
  formattedTarget: string;
  totalBudget: number;
  targetAudiences: string[];
  source: 'live' | 'monitor_snapshot';
  isCurrentProposal: boolean;
}

export interface UnionPathwayStageBucket {
  stageNumber: PathwayStageNumber;
  kpiId: Exclude<KPIType, ''>;
  stageName: 'Reach' | 'Engage' | 'Connect' | 'Disciple' | 'Multiply';
  purpose: string;
  whatGetsPassedForward: string;
  otherProposals: UnionPathwayPeerProposal[];
  allProposalsInStage: UnionPathwayPeerProposal[];
  includesCurrentProposal: boolean;
  totalCount: number;
  approvedCount: number;
  activeReviewCount: number;
  draftCount: number;
  totalBudgetUsd: number;
  isGapAfterUpstream: boolean;
}

export type UnionPathwayDiagnosisType =
  | 'no_union'
  | 'no_kpi_selected'
  | 'no_peers_yet'
  | 'missing_downstream_stage'
  | 'missing_middle_gap'
  | 'same_objective_cluster'
  | 'connected_chain';

export interface UnionPathwayAnalysis {
  hasUnion: boolean;
  canonicalUnion: string;
  unionAcronym: string;
  totalUnionProposals: number;
  otherUnionProposalsCount: number;
  currentStageNumber: PathwayStageNumber | 0;
  currentStageName: string;
  currentPillarIndex: 1 | 2 | 3 | 0;
  currentObjective: string;
  stages: UnionPathwayStageBucket[];
  unassignedOtherCount: number;
  upstreamFeeders: UnionPathwayPeerProposal[];
  downstreamReceivers: UnionPathwayPeerProposal[];
  pillar1EnablingPeers: UnionPathwayPeerProposal[];
  sameStagePeers: UnionPathwayPeerProposal[];
  sameObjectivePeers: UnionPathwayPeerProposal[];
  pathwayDiagnosisType: UnionPathwayDiagnosisType;
  headlineSummary: string;
  fitExplanation: string;
  contextNote: string;
  actionStep: string;
  liaisonCheck: string;
  actionSectionId: string;
  actionSectionLabel: string;
  missingNextStageLabel: string | null;
  suggestedSec8Snippet: string;
  suggestedSec8ActionLabel: string;
}

const ORDERED_STAGE_KPIS: Exclude<KPIType, ''>[] = [
  'reach_exposure',
  'engagement_participation',
  'connection_next_steps',
  'retention_nurturing',
  'implementation_capability',
];

const STATUS_PRIORITY: Record<UnionPathwayPeerProposal['status'], number> = {
  approved: 0,
  under_review: 1,
  submitted: 2,
  draft: 3,
};

function toNormalizedPillarIndex(rawIndex: number, focusText?: string, objective?: string): 1 | 2 | 3 | 0 {
  if (rawIndex === 1 || rawIndex === 2 || rawIndex === 3) return rawIndex;
  const f = (focusText || '').toLowerCase();
  if (f.includes('1') || f.includes('inspiration')) return 1;
  if (f.includes('2') || f.includes('bold')) return 2;
  if (f.includes('3') || f.includes('proclamation')) return 3;
  const o = getCanonicalDivisionProject(objective);
  if (o === 'Regional Media Evangelism & Creators Conferences') return 1;
  if (
    o === 'Proclamation & Harvesting Initiatives' ||
    o === 'Global Marketing Campaign'
  ) {
    return 3;
  }
  if (o) return 2;
  return 0;
}

function normalizeLiveProposal(
  p: Proposal,
  isCurrentProposal: boolean
): UnionPathwayPeerProposal {
  const canonicalKpi = getCanonicalKpiType(p.kpiType);
  const stageMeta = canonicalKpi ? PLAYBOOK_PATHWAY_BY_KPI[canonicalKpi] : null;
  const { totalCost } = getProposalBudgetBreakdown(p);
  const parsedTarget = parseKpiTargetNumber(p.kpiNumber, p.kpiDescription, p.kpiType);
  const isApproved = p.status === 'approved' || Boolean(p.unionApproval?.actionNumber);
  const pillarKey = getProposalPillarKey(p);
  const pillarIndex: 1 | 2 | 3 | 0 =
    pillarKey === 'inspiration'
      ? 1
      : pillarKey === 'bold_initiatives'
      ? 2
      : pillarKey === 'proclamation'
      ? 3
      : toNormalizedPillarIndex(getPillarIndex(p), p.strategicFocus, p.divisionProject);

  return {
    id: p.id,
    title: (p.title || '').trim() || (isCurrentProposal ? 'Current Proposal (Untitled)' : 'Untitled Proposal'),
    status: isApproved ? 'approved' : p.status || 'draft',
    pillarIndex,
    strategicFocus: (p.strategicFocus || '').trim(),
    divisionProject:
      getCanonicalDivisionProject(p.divisionProject) || (p.divisionProject || '').trim(),
    kpiType: canonicalKpi,
    stageNumber: (stageMeta?.stageNumber as PathwayStageNumber) || 0,
    stageName: stageMeta?.stageName || 'Unassigned',
    targetNumericValue: parsedTarget.value,
    formattedTarget: parsedTarget.formatted || (p.kpiNumber || '').trim(),
    totalBudget: totalCost,
    targetAudiences: Array.isArray(p.targetAudiences) ? p.targetAudiences : [],
    source: 'live',
    isCurrentProposal,
  };
}

function gatherUnionPeers(
  currentProposal: Proposal,
  canonUnion: string,
  allProposals?: Proposal[]
): UnionPathwayPeerProposal[] {
  const byId = new Map<string, UnionPathwayPeerProposal>();

  // Always include the live edited currentProposal first
  byId.set(currentProposal.id, normalizeLiveProposal(currentProposal, true));

  // 1. Add all live in-memory proposals belonging to the same Union
  if (allProposals && allProposals.length > 0) {
    for (const p of allProposals) {
      if (!p || !p.id || p.id === currentProposal.id) continue;
      if (getCanonicalUnion(p.union) !== canonUnion) continue;

      // Skip completely empty untitled stubs
      const hasSubstance =
        Boolean(p.title?.trim()) ||
        Boolean(p.divisionProject?.trim()) ||
        Boolean(p.kpiType?.trim()) ||
        p.status !== 'draft';
      if (!hasSubstance) continue;

      byId.set(p.id, normalizeLiveProposal(p, false));
    }
  }

  // 2. Supplement with public monitor snapshot in localStorage so single-union authors
  // also see submitted, under_review, and approved peers across their Union.
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PUBLIC_MONITOR_STORAGE_KEY);
      if (raw) {
        const snap = JSON.parse(raw) as PublicMonitorSnapshot;
        if (snap && Array.isArray(snap.projectSummaries)) {
          for (const s of snap.projectSummaries) {
            if (!s || !s.id || s.id === currentProposal.id || byId.has(s.id)) continue;
            if (getCanonicalUnion(s.union) !== canonUnion) continue;

            const canonicalKpi = getCanonicalKpiType(s.kpiType);
            const stageMeta = canonicalKpi ? PLAYBOOK_PATHWAY_BY_KPI[canonicalKpi] : null;
            const pillarIndex = toNormalizedPillarIndex(
              s.pillarIndex,
              s.strategicFocus,
              s.divisionProject
            );

            byId.set(s.id, {
              id: s.id,
              title: (s.title || '').trim() || 'Union Proposal',
              status: s.status || 'submitted',
              pillarIndex,
              strategicFocus: s.strategicFocus || '',
              divisionProject:
                getCanonicalDivisionProject(s.divisionProject) || (s.divisionProject || '').trim(),
              kpiType: canonicalKpi,
              stageNumber: (stageMeta?.stageNumber as PathwayStageNumber) || 0,
              stageName: stageMeta?.stageName || 'Unassigned',
              targetNumericValue:
                typeof s.targetNumericValue === 'number' ? s.targetNumericValue : null,
              formattedTarget: s.formattedTarget || '',
              totalBudget: Number(s.totalBudget) || 0,
              targetAudiences: Array.isArray(s.targetAudiences) ? s.targetAudiences : [],
              source: 'monitor_snapshot',
              isCurrentProposal: false,
            });
          }
        }
      }
    }
  } catch {
    // Non-blocking fallback when storage is unavailable
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.isCurrentProposal && !b.isCurrentProposal) return -1;
    if (!a.isCurrentProposal && b.isCurrentProposal) return 1;
    const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;
    return b.totalBudget - a.totalBudget;
  });
}

function summarizePeerTitles(peers: UnionPathwayPeerProposal[], limit = 2): string {
  const named = peers
    .map((p) => p.title.trim())
    .filter((t) => t.length > 0 && t !== 'Untitled Proposal');
  if (named.length === 0) return '';
  if (named.length <= limit) return named.map((t) => `"${t}"`).join(' and ');
  const shown = named.slice(0, limit).map((t) => `"${t}"`).join(', ');
  return `${shown} (+${named.length - limit} more)`;
}

/**
 * Analyzes how a proposal fits into all proposals within its Union along the
 * OneVoice27 5-Stage Mission Pathway (1 Reach -> 2 Engage -> 3 Connect -> 4 Disciple -> 5 Multiply).
 */
export function analyzeUnionMissionPathway(
  proposal: Proposal,
  allProposals?: Proposal[]
): UnionPathwayAnalysis {
  const canonUnion = getCanonicalUnion(proposal.union);
  const unionAcronym =
    UNION_ACRONYMS[proposal.union] || UNION_ACRONYMS[canonUnion] || canonUnion || 'SSD';

  const currentLive = normalizeLiveProposal(proposal, true);

  if (!canonUnion) {
    const emptyStages: UnionPathwayStageBucket[] = ORDERED_STAGE_KPIS.map((kpiId) => {
      const meta = PLAYBOOK_PATHWAY_BY_KPI[kpiId];
      return {
        stageNumber: meta.stageNumber as PathwayStageNumber,
        kpiId,
        stageName: meta.stageName,
        purpose: meta.purpose,
        whatGetsPassedForward: meta.whatGetsPassedForward,
        otherProposals: [],
        allProposalsInStage:
          currentLive.stageNumber === meta.stageNumber ? [currentLive] : [],
        includesCurrentProposal: currentLive.stageNumber === meta.stageNumber,
        totalCount: currentLive.stageNumber === meta.stageNumber ? 1 : 0,
        approvedCount: 0,
        activeReviewCount: 0,
        draftCount: currentLive.stageNumber === meta.stageNumber ? 1 : 0,
        totalBudgetUsd:
          currentLive.stageNumber === meta.stageNumber ? currentLive.totalBudget : 0,
        isGapAfterUpstream: false,
      };
    });

    return {
      hasUnion: false,
      canonicalUnion: '',
      unionAcronym: 'Union',
      totalUnionProposals: 1,
      otherUnionProposalsCount: 0,
      currentStageNumber: currentLive.stageNumber,
      currentStageName: currentLive.stageName,
      currentPillarIndex: currentLive.pillarIndex,
      currentObjective: currentLive.divisionProject,
      stages: emptyStages,
      unassignedOtherCount: 0,
      upstreamFeeders: [],
      downstreamReceivers: [],
      pillar1EnablingPeers: [],
      sameStagePeers: [],
      sameObjectivePeers: [],
      pathwayDiagnosisType: 'no_union',
      headlineSummary: 'Select your Union at the top to map this proposal alongside your Union’s 5-Stage Mission Pathway.',
      fitExplanation: 'Once your Union is selected, this view shows which proposals feed into or receive from your project.',
      contextNote: 'Union selection connects this proposal to peer outreach, training, and church follow-up teams in the same field.',
      actionStep: 'Choose your Union / Mission field at the top of the proposal form.',
      liaisonCheck: 'Confirm the correct submitting Union / Mission is selected at the top of the record.',
      actionSectionId: 'section-title',
      actionSectionLabel: 'Go to Union Header',
      missingNextStageLabel: null,
      suggestedSec8Snippet: '',
      suggestedSec8ActionLabel: '',
    };
  }

  const allUnionPeers = gatherUnionPeers(proposal, canonUnion, allProposals);
  const otherPeers = allUnionPeers.filter((p) => !p.isCurrentProposal);

  // Build Stage 1–5 buckets
  const stages: UnionPathwayStageBucket[] = ORDERED_STAGE_KPIS.map((kpiId) => {
    const meta = PLAYBOOK_PATHWAY_BY_KPI[kpiId];
    const stageNum = meta.stageNumber as PathwayStageNumber;
    const allInStage = allUnionPeers.filter((p) => p.stageNumber === stageNum);
    const othersInStage = allInStage.filter((p) => !p.isCurrentProposal);
    const includesCurrent = currentLive.stageNumber === stageNum;

    return {
      stageNumber: stageNum,
      kpiId,
      stageName: meta.stageName,
      purpose: meta.purpose,
      whatGetsPassedForward: meta.whatGetsPassedForward,
      otherProposals: othersInStage,
      allProposalsInStage: allInStage,
      includesCurrentProposal: includesCurrent,
      totalCount: allInStage.length,
      approvedCount: allInStage.filter((p) => p.status === 'approved').length,
      activeReviewCount: allInStage.filter(
        (p) => p.status === 'under_review' || p.status === 'submitted'
      ).length,
      draftCount: allInStage.filter((p) => p.status === 'draft').length,
      totalBudgetUsd: allInStage.reduce((sum, p) => sum + p.totalBudget, 0),
      isGapAfterUpstream: false,
    };
  });

  // Mark "Gap After Upstream" when an earlier stage (1..N-1) has proposals in the Union, yet stage N has 0
  let hasSeenPopulatedStage = false;
  for (let i = 0; i < stages.length; i++) {
    if (stages[i].totalCount > 0) {
      hasSeenPopulatedStage = true;
    } else if (hasSeenPopulatedStage && i <= 3) {
      // Stages 2, 3, or 4 empty while earlier stages exist
      stages[i].isGapAfterUpstream = true;
    }
  }

  const unassignedOtherCount = otherPeers.filter((p) => p.stageNumber === 0).length;

  const s1 = stages[0];
  const s2 = stages[1];
  const s3 = stages[2];
  const s4 = stages[3];
  const s5 = stages[4];

  const pillar1EnablingPeers = otherPeers.filter((p) => p.pillarIndex === 1);
  const sameStagePeers =
    currentLive.stageNumber > 0
      ? otherPeers.filter((p) => p.stageNumber === currentLive.stageNumber)
      : [];
  const sameObjectivePeers = currentLive.divisionProject
    ? otherPeers.filter((p) => p.divisionProject === currentLive.divisionProject)
    : [];

  // Determine Upstream Feeders and Downstream Receivers relative to this proposal's role
  let upstreamFeeders: UnionPathwayPeerProposal[] = [];
  let downstreamReceivers: UnionPathwayPeerProposal[] = [];

  if (currentLive.pillarIndex === 1) {
    // Pillar 1 enables workers/greeters/creators who deploy into Stages 1–4 across the Union
    upstreamFeeders = [];
    downstreamReceivers = otherPeers.filter((p) => p.stageNumber >= 1 && p.stageNumber <= 4);
  } else if (currentLive.stageNumber === 1) {
    upstreamFeeders = pillar1EnablingPeers;
    downstreamReceivers = [...s2.otherProposals, ...s3.otherProposals, ...s4.otherProposals];
  } else if (currentLive.stageNumber === 2) {
    upstreamFeeders = [...s1.otherProposals, ...pillar1EnablingPeers];
    downstreamReceivers = [...s3.otherProposals, ...s4.otherProposals];
  } else if (currentLive.stageNumber === 3) {
    upstreamFeeders = [...s1.otherProposals, ...s2.otherProposals];
    downstreamReceivers = [...s4.otherProposals];
  } else if (currentLive.stageNumber === 4) {
    upstreamFeeders = [...s2.otherProposals, ...s3.otherProposals, ...s1.otherProposals];
    downstreamReceivers = [...s5.otherProposals];
  } else if (currentLive.stageNumber === 5) {
    upstreamFeeders = [...s4.otherProposals];
    downstreamReceivers = otherPeers.filter((p) => p.stageNumber >= 1 && p.stageNumber <= 4);
  }

  // Diagnose Union-wide pathway fit
  let pathwayDiagnosisType: UnionPathwayDiagnosisType = 'connected_chain';
  let headlineSummary = '';
  let fitExplanation = '';
  let contextNote = '';
  let actionStep = '';
  let liaisonCheck = '';
  let actionSectionId = 'section-integration';
  let actionSectionLabel = 'Go to Sec 8 · Integration';
  let missingNextStageLabel: string | null = null;
  let suggestedSec8Snippet = '';
  let suggestedSec8ActionLabel = '+ Add Union Pathway Link to Sec 8';

  const hasMiddleGap = s1.totalCount > 0 && s4.totalCount > 0 && s2.totalCount === 0 && s3.totalCount === 0;

  if (currentLive.stageNumber === 0) {
    pathwayDiagnosisType = 'no_kpi_selected';
    headlineSummary = `${unionAcronym} has ${otherPeers.length} other proposal${otherPeers.length === 1 ? '' : 's'} across the 5-Stage Mission Pathway.`;
    fitExplanation =
      'Pick 1 Primary KPI in Section 5 (Reach, Engage, Connect, Disciple, or Multiply) to place your proposal on the Union chain and see upstream/downstream partner projects.';
    contextNote = `${unionAcronym} proposals are mapped onto the 5-stage chain by their Primary KPI so reviewers can see handoffs.`;
    actionStep = 'Open Section 5 and pick 1 Primary KPI (Reach, Engage, Connect, Disciple, or Multiply) to place this project on the pathway.';
    liaisonCheck = 'Verify Section 5 selects 1 Primary KPI so this proposal can be placed on the Union 5-stage chain.';
    actionSectionId = 'section-5-kpi';
    actionSectionLabel = 'Go to Sec 5 · KPI';
  } else if (otherPeers.length === 0) {
    pathwayDiagnosisType = 'no_peers_yet';
    headlineSummary = `First visible ${unionAcronym} proposal on the 5-Stage Pathway (Stage ${currentLive.stageNumber} · ${currentLive.stageName}).`;
    fitExplanation = `No other proposals are currently visible in ${unionAcronym} yet. Make sure Section 8 names your own local church receiver, Digital Missionaries, and follow-up plan so contacts do not stop at one stage.`;
    contextNote = `No other ${unionAcronym} proposals appear on the chain yet to receive seekers from this stage.`;
    actionStep = 'In Section 8, name the local church receiver, Digital Missionaries, and follow-up plan handling the next stage.';
    liaisonCheck = 'Check Section 8 for a named local church receiver, Digital Missionaries, and concrete next-stage handoff.';
    suggestedSec8Snippet = `Union Pathway Continuity (${unionAcronym}): Because this project operates at Stage ${currentLive.stageNumber} (${currentLive.stageName}), our team links directly with local Hope Care Teams, Digital Missionaries, and NDR-IEL coordinators to handle the next stage of follow-up.`;
    suggestedSec8ActionLabel = '+ Add Local Pathway Backup in Sec 8';
  } else if (currentLive.pillarIndex === 1) {
    // Pillar 1: Training & Enabling
    const deployTitles = summarizePeerTitles(downstreamReceivers, 2);
    if (downstreamReceivers.length > 0) {
      pathwayDiagnosisType = 'connected_chain';
      headlineSummary = `Stage ${currentLive.stageNumber} (${currentLive.stageName}) · Pillar 1 Training equips ${downstreamReceivers.length} active ${unionAcronym} outreach/media proposal${downstreamReceivers.length === 1 ? '' : 's'}.`;
      fitExplanation = `Your trained creators, responders, or church greeters directly strengthen ${deployTitles}. Name in Section 8 which of those Union teams or local conferences receive your trainees.`;
      contextNote = `Your trained creators, responders, or church greeters directly support ${deployTitles}.`;
      actionStep = `In Section 8, name the specific ${unionAcronym} teams or local conferences/missions receiving your graduates.`;
      liaisonCheck = `Verify Section 8 names which ${unionAcronym} teams or local conferences receive and deploy graduates from this training.`;
      suggestedSec8Snippet = `Union Pathway Deployment (${unionAcronym}): Graduates and church host teams equipped under this Pillar 1 training will serve directly alongside ${deployTitles} across our Union’s 48-week mission pathway.`;
      suggestedSec8ActionLabel = '+ Link Equipped Union Teams in Sec 8';
    } else {
      pathwayDiagnosisType = 'missing_downstream_stage';
      missingNextStageLabel = 'Stages 1–4 Outreach & Follow-Up Projects';
      headlineSummary = `Pillar 1 Training in ${unionAcronym} currently has 0 downstream outreach proposals visible in Stages 1–4.`;
      fitExplanation = `Member training events recruit internally through Conferences and local churches (not the public HopeStartsHere.asia outreach site). Name in Section 8 which Mission/Conference departments and local churches deploy your trained creators or hosts.`;
      contextNote = `Member training events recruit internally through Conferences/Missions rather than the public HopeStartsHere.asia site.`;
      actionStep = 'In Section 8, list the Mission/Conference departments and local churches that will deploy your trained creators or church hosts.';
      liaisonCheck = 'Confirm Section 8 specifies internal member recruitment plus the local Conferences/churches deploying graduates.';
      suggestedSec8Snippet = `Union Pathway Deployment (${unionAcronym}): Member trainees register internally through local Conferences and churches (keeping training separate from public HopeStartsHere.asia outreach), and Communication/Ministerial teams deploy trained creators and church hosts immediately after workshops end.`;
      suggestedSec8ActionLabel = '+ Name Local Deploying Teams in Sec 8';
    }
  } else if (currentLive.stageNumber === 1 && s2.otherProposals.length === 0 && s3.otherProposals.length === 0) {
    pathwayDiagnosisType = hasMiddleGap ? 'missing_middle_gap' : 'missing_downstream_stage';
    missingNextStageLabel = 'Stage 2 (Engage) & Stage 3 (Connect)';
    headlineSummary = `Pathway Gap in ${unionAcronym}: 0 proposals in Stage 2 (Engage) or Stage 3 (Connect) to catch Stage 1 viewers.`;
    fitExplanation = `Your Stage 1 Reach project creates public awareness, but ${unionAcronym} currently has no separate Stage 2 or Stage 3 project catching replies or hosting bridging events. Explain in Section 8 who answers messages and hands opt-in guests to local churches.`;
    contextNote = `${unionAcronym} currently has 0 separate Stage 2 or Stage 3 proposals funded to catch replies or host bridging events.`;
    actionStep = 'In Section 8, name who answers online replies via HopeStartsHere.asia within 48 hours and hands opt-in guests to local churches.';
    liaisonCheck = 'Verify Section 8 names Digital Missionaries/responders and local churches bridging Stage 1 viewers into personal follow-up.';
    suggestedSec8Snippet = `Union Stage 1→2→3 Handoff (${unionAcronym}): Because ${unionAcronym} has no separate Stage 2/3 proposal catching our viewers yet, every piece routes to HopeStartsHere.asia where our trained Digital Missionaries reply within 48 hours and refer opt-in guests directly to local Hope Care Teams and listed bridging events.`;
    suggestedSec8ActionLabel = '+ Cover Stage 2–3 Handoff in Sec 8';
  } else if (currentLive.stageNumber === 2 && s3.otherProposals.length === 0 && s4.otherProposals.length === 0) {
    pathwayDiagnosisType = 'missing_downstream_stage';
    missingNextStageLabel = 'Stage 3 (Connect) & Stage 4 (Disciple)';
    headlineSummary = `Pathway Gap in ${unionAcronym}: 0 proposals in Stage 3 (Connect) or Stage 4 (Disciple) after your Stage 2 Engage work.`;
    fitExplanation = `Explain in Section 8 how your online responders invite consenting seekers to Community Events & RSVP on HopeStartsHere.asia and introduce them to named local church pastors, Bridge Coordinators, or Sabbath School small groups.`;
    contextNote = `No separate Stage 3 (Connect) or Stage 4 (Disciple) proposals exist in ${unionAcronym} yet to receive your responders' contacts.`;
    actionStep = 'In Section 8, explain how responders invite seekers to HopeStartsHere.asia events/RSVP and hand them off to named local pastors or small groups.';
    liaisonCheck = 'Check Section 8 for named local pastors, Bridge Coordinators, or small groups receiving consenting Stage 2 contacts.';
    suggestedSec8Snippet = `Union Stage 2→3→4 Handoff (${unionAcronym}): Consented seekers from our Stage 2 conversations are invited to local community events via HopeStartsHere.asia RSVP and introduced within 48 hours to named local church Bridge Coordinators, NDR-IEL pastors, and Hope Care Teams for fellowship and Bible study.`;
    suggestedSec8ActionLabel = '+ Name Local Church Receivers in Sec 8';
  } else if (currentLive.stageNumber === 3 && s4.otherProposals.length === 0) {
    pathwayDiagnosisType = 'missing_downstream_stage';
    missingNextStageLabel = 'Stage 4 (Disciple)';
    headlineSummary = `Pathway Gap in ${unionAcronym}: 0 Stage 4 (Disciple) proposals visible after your Stage 3 Bridging Events.`;
    fitExplanation = `Because ${unionAcronym} has no separate Stage 4 Discipleship grant yet, publish your Community Event & opt-in RSVP on HopeStartsHere.asia (respecting Play 7 sensitivity) and state in Section 8 how local pastors and Hope Care Teams move bridging guests into weekly small groups.`;
    contextNote = `${unionAcronym} has 0 separate Stage 4 (Disciple) proposals visible to continue nurturing your event attendees.`;
    actionStep = 'In Section 8, specify your HopeStartsHere.asia event/RSVP listing (with Play 7 privacy if needed) and name the local small groups taking guests forward.';
    liaisonCheck = 'Verify Section 8 states how bridging event guests transition into weekly local church small groups or Bible studies.';
    suggestedSec8Snippet = `Union Stage 3→4 Discipleship Continuity (${unionAcronym}): Community outreach events and opt-in RSVPs are listed on HopeStartsHere.asia (respecting Play 7 privacy in sensitive areas); within 48 hours of each gathering, local Bridge Coordinators and Hope Care Teams invite guests into a pre-scheduled weekly small group or Discovery Bible Study.`;
    suggestedSec8ActionLabel = '+ Add Events/RSVP & Stage 4 Plan in Sec 8';
  } else if (hasMiddleGap && (currentLive.stageNumber === 1 || currentLive.stageNumber === 4)) {
    pathwayDiagnosisType = 'missing_middle_gap';
    missingNextStageLabel = 'Stage 2 (Engage) & Stage 3 (Connect)';
    headlineSummary = `Missing Middle in ${unionAcronym}: Proposals exist in Stage 1 (Reach) and Stage 4 (Disciple), but 0 in Stages 2–3.`;
    fitExplanation = `Explain in Section 8 how interested people cross from online Reach into personal Engage replies and local Connect small groups before Stage 4 Bible studies.`;
    contextNote = `${unionAcronym} currently has proposals in Reach and Disciple, leaving an unfunded gap in Stages 2–3 (personal replies & bridging gatherings).`;
    actionStep = 'In Section 8, describe who manages personal replies (Engage) and warm church introductions (Connect) so viewers reach Stage 4 Bible studies.';
    liaisonCheck = 'Check Section 8 for clear Engage/Connect bridging steps between public outreach and pastoral Bible studies.';
    suggestedSec8Snippet = `Bridging the Stage 1→4 Middle (${unionAcronym}): Digital Missionaries answer online comments via HopeStartsHere.asia and coordinate warm 48-hour introductions to local Bridge Coordinators before transitioning consenting guests to Stage 4 pastoral nurture.`;
    suggestedSec8ActionLabel = '+ Bridge Stages 2–3 in Sec 8';
  } else if (sameObjectivePeers.length >= 2 && downstreamReceivers.length === 0) {
    pathwayDiagnosisType = 'same_objective_cluster';
    const peerTitles = summarizePeerTitles(sameObjectivePeers, 2);
    headlineSummary = `Shared Focus in ${unionAcronym}: ${sameObjectivePeers.length} other proposals also target "${currentLive.divisionProject}".`;
    fitExplanation = `Coordinate with ${peerTitles} so your languages, local churches, or media channels complement rather than overlap, and link with downstream follow-up teams in Section 8.`;
    contextNote = `${sameObjectivePeers.length} peer proposals (${peerTitles}) share the same objective in ${unionAcronym}, with no separate downstream stage visible.`;
    actionStep = 'In Section 8, state your distinct territory, language, or local churches to avoid duplication, and name your Hope Care Team follow-up partners.';
    liaisonCheck = 'Confirm Section 8 avoids audience/language overlap with peer projects and identifies downstream local church receivers.';
    suggestedSec8Snippet = `Union Coordination (${unionAcronym}): This project coordinates schedules, shared master files, and distinct geographic/language audiences with ${peerTitles} to avoid duplication and route contacts cleanly to local Hope Care Teams.`;
    suggestedSec8ActionLabel = '+ Add Union Coordination Note in Sec 8';
  } else {
    pathwayDiagnosisType = sameObjectivePeers.length >= 2 ? 'same_objective_cluster' : 'connected_chain';
    const upText =
      upstreamFeeders.length > 0
        ? `Receives from ${upstreamFeeders.length} upstream (${summarizePeerTitles(upstreamFeeders, 1)})`
        : 'Opens the funnel at Stage 1';
    const downText =
      downstreamReceivers.length > 0
        ? `passes forward to ${downstreamReceivers.length} downstream (${summarizePeerTitles(downstreamReceivers, 1)})`
        : 'hands disciples into local church service';
    headlineSummary = `Connected in ${unionAcronym}: Stage ${currentLive.stageNumber} (${currentLive.stageName}) · ${upText} and ${downText}.`;
    fitExplanation =
      sameObjectivePeers.length >= 2
        ? `${sameObjectivePeers.length} other ${unionAcronym} proposals share "${currentLive.divisionProject}" — confirm your distinct audience/territory and name your downstream handoff partners in Section 8.`
        : `Your Stage ${currentLive.stageNumber} project fills a key link in ${unionAcronym}’s 5-Stage Pathway. Reference connected Union teams in Section 8 so handoffs run smoothly.`;
    contextNote =
      sameObjectivePeers.length >= 2
        ? `${sameObjectivePeers.length} other ${unionAcronym} proposals share "${currentLive.divisionProject}".`
        : `This Stage ${currentLive.stageNumber} project links directly with neighboring ${unionAcronym} teams along the 5-stage chain.`;
    actionStep =
      sameObjectivePeers.length >= 2
        ? 'In Section 8, specify your distinct geographic/language audience and name the downstream teams receiving your contacts.'
        : 'In Section 8, name the connected Union teams or local Hope Care Teams handling your upstream/downstream handoffs.';
    liaisonCheck =
      sameObjectivePeers.length >= 2
        ? 'Verify Section 8 clarifies distinct territory/audience from sibling projects and confirms handoff teams.'
        : 'Verify Section 8 names the connected Union outreach or local church teams for smooth handoffs.';
    const partnerRef = downstreamReceivers.length > 0 ? summarizePeerTitles(downstreamReceivers, 2) : summarizePeerTitles(upstreamFeeders, 2);
    suggestedSec8Snippet =
      downstreamReceivers.length > 0
        ? `Union 5-Stage Pathway Link (${unionAcronym}): Contacts and materials from this Stage ${currentLive.stageNumber} (${currentLive.stageName}) project route directly with opt-in consent to ${partnerRef} and local Hope Care Teams for continued nurture.`
        : `Union 5-Stage Pathway Link (${unionAcronym}): This Stage ${currentLive.stageNumber} (${currentLive.stageName}) initiative collaborates with ${partnerRef || `${unionAcronym} outreach teams`} and local pastors to ensure seamless follow-up.`;
    suggestedSec8ActionLabel = '+ Link Union Pathway Peers in Sec 8';
  }

  return {
    hasUnion: true,
    canonicalUnion: canonUnion,
    unionAcronym,
    totalUnionProposals: allUnionPeers.length,
    otherUnionProposalsCount: otherPeers.length,
    currentStageNumber: currentLive.stageNumber,
    currentStageName: currentLive.stageName,
    currentPillarIndex: currentLive.pillarIndex,
    currentObjective: currentLive.divisionProject,
    stages,
    unassignedOtherCount,
    upstreamFeeders,
    downstreamReceivers,
    pillar1EnablingPeers,
    sameStagePeers,
    sameObjectivePeers,
    pathwayDiagnosisType,
    headlineSummary,
    fitExplanation,
    contextNote,
    actionStep,
    liaisonCheck,
    actionSectionId,
    actionSectionLabel,
    missingNextStageLabel,
    suggestedSec8Snippet,
    suggestedSec8ActionLabel,
  };
}
