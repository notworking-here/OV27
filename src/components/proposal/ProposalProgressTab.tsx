import { useState, useEffect, useMemo } from 'react';
import {
  Proposal,
  ProposalProjectCode,
  ProjectPhase,
  ProjectOperationalStatus,
  PROJECT_PHASES,
  PROJECT_STATUSES,
  UserAccount,
} from '../../types';
import {
  formatCompositeProjectCode,
  getUnionProjectAcronym,
  resolveProposalProjectCode,
} from '../../utils/externalProposalCodec';
import {
  allocateNextProjectId,
  buildLockedStep5ProjectCode,
} from '../../services/proposalService';
import { ActivityLogStream } from '../admin/ActivityLogStream';
import {
  Lock,
  Unlock,
  Tag,
  Activity,
  CheckCircle2,
  Sparkles,
  Save,
  ShieldCheck,
  Clock,
  Globe,
} from 'lucide-react';

interface ProposalProgressTabProps {
  proposal: Proposal;
  allProposals?: Proposal[];
  currentUser?: UserAccount | null;
  isStep5Authorized: boolean;
  onSaveProjectCode: (nextCode: ProposalProjectCode) => Promise<void> | void;
}

export function ProposalProgressTab({
  proposal,
  allProposals = [],
  currentUser,
  isStep5Authorized,
  onSaveProjectCode,
}: ProposalProgressTabProps) {
  const isDivisionAdmin = currentUser?.role === 'super_admin';

  const resolvedCurrentCode = useMemo(
    () =>
      resolveProposalProjectCode(proposal, 1, {
        allowFallbackSequence: false,
      }),
    [proposal]
  );

  const isCodeLocked = Boolean(proposal.projectCode?.locked || isStep5Authorized);
  const canEditProjectCode = isDivisionAdmin && !isCodeLocked;
  const canEditLifecycle = isDivisionAdmin && isStep5Authorized;

  const [orgIdInput, setOrgIdInput] = useState(resolvedCurrentCode.orgId || 'AT1111');
  const [projectIdInput, setProjectIdInput] = useState(resolvedCurrentCode.projectId || '');
  const [phaseInput, setPhaseInput] = useState<ProjectPhase | ''>(
    (resolvedCurrentCode.phase as ProjectPhase | null) || ''
  );
  const [statusInput, setStatusInput] = useState<ProjectOperationalStatus | ''>(
    (resolvedCurrentCode.status as ProjectOperationalStatus | null) || ''
  );

  const [isAllocating, setIsAllocating] = useState(false);
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [isSavingLifecycle, setIsSavingLifecycle] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    setOrgIdInput(resolvedCurrentCode.orgId || 'AT1111');
    setProjectIdInput(resolvedCurrentCode.projectId || '');
    setPhaseInput((resolvedCurrentCode.phase as ProjectPhase | null) || '');
    setStatusInput((resolvedCurrentCode.status as ProjectOperationalStatus | null) || '');
  }, [
    proposal.id,
    resolvedCurrentCode.orgId,
    resolvedCurrentCode.projectId,
    resolvedCurrentCode.phase,
    resolvedCurrentCode.status,
  ]);

  const previewComposite = formatCompositeProjectCode({
    orgId: orgIdInput.trim() || 'AT1111',
    projectId: projectIdInput.trim() || null,
    phase: phaseInput || null,
    status: statusInput || null,
  });

  const isCodeDirty =
    orgIdInput.trim().toUpperCase() !== (resolvedCurrentCode.orgId || 'AT1111').toUpperCase() ||
    projectIdInput.trim().toUpperCase() !== (resolvedCurrentCode.projectId || '').toUpperCase();

  const isLifecycleDirty =
    (phaseInput || null) !== (resolvedCurrentCode.phase || null) ||
    (statusInput || null) !== (resolvedCurrentCode.status || null);

  const handleAllocateSequentialId = async () => {
    if (!canEditProjectCode || isAllocating) return;
    setIsAllocating(true);
    setFeedbackMsg(null);
    try {
      const alloc = await allocateNextProjectId(proposal.union || '', {
        orgId: orgIdInput.trim().toUpperCase() || 'AT1111',
        existingProposals: allProposals,
      });
      setProjectIdInput(alloc.projectId);
      setFeedbackMsg({
        type: 'success',
        text: `Allocated next sequential Project ID: ${alloc.projectId}. Click Save Project Code to apply.`,
      });
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Could not reserve sequential ID. Please enter a Project ID manually.',
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const handleSaveCoding = async () => {
    if (!canEditProjectCode || isSavingCode) return;
    const cleanOrgId = (orgIdInput.trim() || 'AT1111').toUpperCase();
    const cleanProjectId = projectIdInput.trim().toUpperCase() || null;

    setIsSavingCode(true);
    setFeedbackMsg(null);
    try {
      const nextCode: ProposalProjectCode = {
        ...proposal.projectCode,
        orgId: cleanOrgId,
        projectId: cleanProjectId,
        phase: resolvedCurrentCode.phase ?? null,
        status: resolvedCurrentCode.status ?? null,
        locked: false,
        composite: formatCompositeProjectCode({
          orgId: cleanOrgId,
          projectId: cleanProjectId,
          phase: resolvedCurrentCode.phase ?? null,
          status: resolvedCurrentCode.status ?? null,
        }),
      };
      await onSaveProjectCode(nextCode);
      setFeedbackMsg({
        type: 'success',
        text: cleanProjectId
          ? `Project Code saved (${cleanOrgId} - ${cleanProjectId}) and recorded in audit trail.`
          : 'OrgID saved and recorded in audit trail.',
      });
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Unable to save Project Code changes right now. Please try again.',
      });
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleSaveLifecycle = async () => {
    if (!canEditLifecycle || isSavingLifecycle) return;
    const nextPhase = (phaseInput || 'Planning') as ProjectPhase;
    const nextStatus = (statusInput || 'Active') as ProjectOperationalStatus;
    const cleanOrgId = (resolvedCurrentCode.orgId || 'AT1111').toUpperCase();
    const cleanProjectId = resolvedCurrentCode.projectId || null;

    setIsSavingLifecycle(true);
    setFeedbackMsg(null);
    try {
      const nextCode: ProposalProjectCode = {
        ...proposal.projectCode,
        orgId: cleanOrgId,
        projectId: cleanProjectId,
        phase: nextPhase,
        status: nextStatus,
        locked: Boolean(proposal.projectCode?.locked ?? isStep5Authorized),
        composite: formatCompositeProjectCode({
          orgId: cleanOrgId,
          projectId: cleanProjectId,
          phase: nextPhase,
          status: nextStatus,
        }),
      };
      await onSaveProjectCode(nextCode);
      setFeedbackMsg({
        type: 'success',
        text: `Lifecycle updated to ${nextPhase} · ${nextStatus} and logged in audit trail.`,
      });
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Unable to save lifecycle update right now. Please try again.',
      });
    } finally {
      setIsSavingLifecycle(false);
    }
  };

  const handleAssignLegacyStep5Id = async () => {
    if (!isDivisionAdmin || !isStep5Authorized || resolvedCurrentCode.projectId || isAllocating) {
      return;
    }
    setIsAllocating(true);
    setFeedbackMsg(null);
    try {
      const alloc = await allocateNextProjectId(proposal.union || '', {
        orgId: (resolvedCurrentCode.orgId || 'AT1111').toUpperCase(),
        existingProposals: allProposals,
      });
      const lockedCode = buildLockedStep5ProjectCode(
        proposal,
        {
          displayName: currentUser?.displayName,
          email: currentUser?.email,
        },
        alloc.projectId,
        (resolvedCurrentCode.orgId || 'AT1111').toUpperCase()
      );
      await onSaveProjectCode(lockedCode);
      setProjectIdInput(alloc.projectId);
      setFeedbackMsg({
        type: 'success',
        text: `Assigned & locked sequential Project ID: ${alloc.projectId}.`,
      });
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Could not assign sequential Project ID right now. Please try again.',
      });
    } finally {
      setIsAllocating(false);
    }
  };

  const formattedLockDate = useMemo(() => {
    const raw = proposal.projectCode?.lockedAt || proposal.divisionApproval?.timestamp;
    if (!raw) return null;
    try {
      const d = new Date(raw);
      return isNaN(d.getTime())
        ? raw
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return raw;
    }
  }, [proposal.projectCode?.lockedAt, proposal.divisionApproval?.timestamp]);

  const unionAcronym = useMemo(
    () => getUnionProjectAcronym(proposal.union || ''),
    [proposal.union]
  );
  const samplePlaceholderId = `OVSSD${unionAcronym}### (Auto on Step 5)`;

  return (
    <div className="space-y-6">
      {/* Composite Project Code & GC Readiness Header */}
      <section className="rounded-2xl bg-slate-900 text-white p-5 sm:p-6 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              GC Progress &amp; Lifecycle Identity
            </span>
            <h2 className="font-mono tabular-nums text-lg sm:text-2xl font-black tracking-tight text-white break-all">
              {previewComposite}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border ${
                isStep5Authorized
                  ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {isCodeLocked ? (
                <Lock className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Unlock className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{isCodeLocked ? 'Code Locked at Step 5' : 'Pre-Step-5 Code Draft'}</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border ${
                isStep5Authorized
                  ? 'bg-sky-950/60 border-sky-700/70 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isStep5Authorized ? 'GC API Sync Enabled' : 'Pending Step 5 Sync Gate'}
              </span>
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
          <span>
            OrgID: <strong className="font-mono text-white">{orgIdInput || 'AT1111'}</strong>
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>
            Project ID:{' '}
            <strong className="font-mono text-white">
              {projectIdInput.trim() ||
                (isStep5Authorized ? 'Pending Sequential Assignment' : 'Assigned on Step 5')}
            </strong>
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>
            Phase: <strong className="text-white">{phaseInput || '—'}</strong>
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span>
            Status: <strong className="text-white">{statusInput || '—'}</strong>
          </span>
          {isCodeLocked && (proposal.projectCode?.lockedBy || proposal.divisionApproval?.authorizedBy) && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-slate-400">
                Locked by {proposal.projectCode?.lockedBy || proposal.divisionApproval?.authorizedBy}
                {formattedLockDate ? ` (${formattedLockDate})` : ''}
              </span>
            </>
          )}
        </div>
      </section>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Coding & Lifecycle Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel A: Project Coding */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#1c398e]" />
                <span>GC Project Coding</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Division OrgID and monotonic sequential Union Project ID.
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
              {isCodeLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{isDivisionAdmin ? 'Editable' : 'Admin Only'}</span>
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="progress-org-id"
                className="block text-xs font-bold text-slate-700"
              >
                OrgID
              </label>
              <input
                id="progress-org-id"
                type="text"
                value={orgIdInput}
                disabled={!canEditProjectCode}
                maxLength={16}
                onChange={(e) => setOrgIdInput(e.target.value.toUpperCase())}
                placeholder="AT1111"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-50 disabled:text-slate-600 font-mono text-xs font-bold text-slate-900 outline-none focus:border-[#1c398e] transition"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="progress-project-id"
                className="block text-xs font-bold text-slate-700"
              >
                Project ID
              </label>
              <input
                id="progress-project-id"
                type="text"
                value={projectIdInput}
                disabled={!canEditProjectCode}
                maxLength={24}
                onChange={(e) => setProjectIdInput(e.target.value.toUpperCase())}
                placeholder={samplePlaceholderId}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-50 disabled:text-slate-600 font-mono text-xs font-bold text-slate-900 outline-none focus:border-[#1c398e] transition"
              />
            </div>
          </div>

          {canEditProjectCode ? (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleAllocateSequentialId}
                disabled={isAllocating || isSavingCode}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#1c398e]" />
                <span>{isAllocating ? 'Allocating...' : 'Generate Next ID'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCoding}
                disabled={!isCodeDirty || isSavingCode}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] disabled:opacity-45 text-white text-xs font-bold transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingCode ? 'Saving...' : 'Save Project Code'}</span>
              </button>
            </div>
          ) : isDivisionAdmin && isStep5Authorized && !resolvedCurrentCode.projectId ? (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-amber-800 font-semibold">
                Legacy Step 5 project has no persisted sequential ID yet.
              </span>
              <button
                type="button"
                onClick={handleAssignLegacyStep5Id}
                disabled={isAllocating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAllocating ? 'Assigning...' : 'Assign Next Sequential ID'}</span>
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
              {isCodeLocked
                ? 'OrgID and Project ID are permanently locked following Step 5 SSD OV27 Committee Authorization.'
                : 'Pre-authorization OrgID and Project ID overrides are restricted to SSD Division Administrators. An ID is assigned automatically upon Step 5 Authorization.'}
            </p>
          )}
        </section>

        {/* Panel B: Lifecycle Phase & Operational Status */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-700" />
                <span>Lifecycle Phase &amp; Status</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Execution tracking initialized upon Step 5 Authorization.
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-500 shrink-0">
              {canEditLifecycle
                ? 'Division Admin Editable'
                : isStep5Authorized
                ? 'Division Admin Managed'
                : 'Pending Step 5'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="progress-phase"
                className="block text-xs font-bold text-slate-700"
              >
                Project Phase
              </label>
              <select
                id="progress-phase"
                value={phaseInput}
                disabled={!canEditLifecycle}
                onChange={(e) => setPhaseInput(e.target.value as ProjectPhase | '')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-50 disabled:text-slate-600 text-xs font-bold text-slate-900 outline-none focus:border-[#1c398e] transition cursor-pointer disabled:cursor-not-allowed"
              >
                {!phaseInput && <option value="">— Unassigned</option>}
                {PROJECT_PHASES.map((ph) => (
                  <option key={ph} value={ph}>
                    {ph}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="progress-status"
                className="block text-xs font-bold text-slate-700"
              >
                Operational Status
              </label>
              <select
                id="progress-status"
                value={statusInput}
                disabled={!canEditLifecycle}
                onChange={(e) =>
                  setStatusInput(e.target.value as ProjectOperationalStatus | '')
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white disabled:bg-slate-50 disabled:text-slate-600 text-xs font-bold text-slate-900 outline-none focus:border-[#1c398e] transition cursor-pointer disabled:cursor-not-allowed"
              >
                {!statusInput && <option value="">— Unassigned</option>}
                {PROJECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canEditLifecycle ? (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={handleSaveLifecycle}
                disabled={!isLifecycleDirty || isSavingLifecycle}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 text-white text-xs font-bold transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingLifecycle ? 'Updating...' : 'Save Lifecycle Update'}</span>
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
              {!isStep5Authorized
                ? 'Defaults to Planning · Active automatically when the SSD OV27 Committee authorizes Step 5.'
                : 'Lifecycle Phase and Status transitions are managed by SSD Division Administrators.'}
            </p>
          )}
        </section>
      </div>

      {/* Step 6 Base Survey & Evaluation Readiness Gate */}
      <section
        className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isStep5Authorized
            ? 'border-emerald-200 bg-emerald-50/40'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isStep5Authorized
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {isStep5Authorized ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900">
              {isStep5Authorized
                ? 'Step 6 · Base Survey & Impact Evaluation Unlocked'
                : 'Step 6 · Base Survey & Impact Evaluation Locked'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isStep5Authorized
                ? `This project is officially authorized to sync with GC under code ${previewComposite}. Implementation milestones, Base Survey metrics, and periodic evaluations can now be tracked against this Project ID.`
                : 'Complete Steps 1–5 (including Step 5 SSD OV27 Committee Authorization) to lock the sequential Project ID, enable GC External API sync, and unlock Step 6 Evaluation tracking.'}
            </p>
          </div>
        </div>

        {isStep5Authorized && (
          <div className="text-xs sm:text-right shrink-0 space-y-0.5 tabular-nums">
            <div className="font-bold text-emerald-900">
              Action #{proposal.unionApproval?.actionNumber || '—'}
            </div>
            {proposal.divisionApproval?.referenceNumber && (
              <div className="text-[11px] font-mono text-slate-600">
                OV27 Ref #{proposal.divisionApproval.referenceNumber}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Immutable Proposal Audit Trail */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Governance, Coding &amp; Lifecycle Audit Trail
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable newest-first log of governance actions, Project Code edits, Step 5 locking, and Phase/Status updates.
            </p>
          </div>
        </div>

        <ActivityLogStream
          proposal={proposal}
          currentUser={currentUser || undefined}
          isCompact={true}
        />
      </section>
    </div>
  );
}
