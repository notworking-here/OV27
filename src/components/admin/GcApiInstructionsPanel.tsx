import React, { useState, useEffect, useMemo } from 'react';
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Globe,
  Code,
  Download,
  ExternalLink,
  CheckCircle2,
  Lock,
  Terminal,
  FileJson,
  BookOpen,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { Proposal, UNION_ACRONYMS, getCanonicalUnion } from '../../types';
import {
  fetchBudgetAllocationDetails,
  fetchGcApiConfig,
  saveGcApiConfig,
  GcApiConfig,
  generateSecureGcApiKey,
  reconcileStep5ProjectCodes,
  syncGcApiExportSnapshot,
  UnionBudgetAllocationDetails,
} from '../../services/proposalService';
import {
  toExternalProposalJson,
  isProposalApprovedForApi,
  buildCollisionFreeUnionSequenceMap,
  findStep5ProjectCodeIssues,
  INTERNAL_TO_EXTERNAL_AUDIENCE,
  INTERNAL_TO_EXTERNAL_KPI,
} from '../../utils/externalProposalCodec';
import { computeAllProposalsFundingAttribution } from '../../utils/fundingAttribution';

export interface GcApiInstructionsPanelProps {
  proposals: Proposal[];
  currentAdminEmail?: string;
  currentAdminUid?: string;
  currentAdminName?: string;
  onProposalsBatchUpdated?: (updatedProposals: Proposal[]) => void;
}

export function GcApiInstructionsPanel({
  proposals,
  currentAdminEmail,
  currentAdminUid,
  currentAdminName,
  onProposalsBatchUpdated,
}: GcApiInstructionsPanelProps) {
  const [apiConfig, setApiConfig] = useState<GcApiConfig>({
    apiKey: '',
    enabled: true,
    orgId: 'AT1111',
    approvedOnly: true,
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string>('__all__');
  const [liveTestStatus, setLiveTestStatus] = useState<{
    loading: boolean;
    ok?: boolean;
    status?: number;
    count?: number;
    message?: string;
  }>({ loading: false });
  const [isReconcilingIds, setIsReconcilingIds] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [budgetDetails, setBudgetDetails] = useState<UnionBudgetAllocationDetails>({
    allocations: {},
    matchingPledges: {},
  });

  // Resolve base URL (prefer shared production URL or current origin)
  const baseUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'https://ais-pre-q2vkpbhx7wtbjjohbrw7bc-633656212863.asia-southeast1.run.app';
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingConfig(true);
      try {
        const [cfg, details] = await Promise.all([
          fetchGcApiConfig(),
          fetchBudgetAllocationDetails(),
        ]);
        if (mounted) {
          setApiConfig(cfg);
          setBudgetDetails(details);
        }
      } finally {
        if (mounted) {
          setLoadingConfig(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Filter strictly to Approved proposals
  const approvedProposals = useMemo(() => {
    return (proposals || []).filter((p) => isProposalApprovedForApi(p));
  }, [proposals]);

  const nonApprovedCount = useMemo(() => {
    return Math.max(0, (proposals || []).length - approvedProposals.length);
  }, [proposals, approvedProposals]);

  const codeAuditIssues = useMemo(
    () => findStep5ProjectCodeIssues(proposals || []),
    [proposals]
  );

  const handleReconcileProjectIds = async () => {
    if (isReconcilingIds) return;
    setIsReconcilingIds(true);
    setReconcileMessage(null);
    try {
      const result = await reconcileStep5ProjectCodes(
        proposals || [],
        {
          uid: currentAdminUid,
          displayName: currentAdminName || currentAdminEmail || 'Division Admin',
          email: currentAdminEmail,
          role: 'super_admin',
        },
        apiConfig.orgId || 'AT1111'
      );
      if (result.updatedProposals.length > 0) {
        onProposalsBatchUpdated?.(result.updatedProposals);
        const updatedMap = new Map(result.updatedProposals.map((up) => [up.id, up]));
        const mergedProposals = (proposals || []).map((p) => updatedMap.get(p.id) || p);
        syncGcApiExportSnapshot(mergedProposals, true).catch(() => {});
      } else {
        syncGcApiExportSnapshot(proposals || [], true).catch(() => {});
      }
      const parts: string[] = [];
      if (result.assignedCount > 0) {
        parts.push(`${result.assignedCount} missing ID${result.assignedCount === 1 ? '' : 's'} assigned`);
      }
      if (result.dedupedCount > 0) {
        parts.push(`${result.dedupedCount} duplicate ID${result.dedupedCount === 1 ? '' : 's'} re-sequenced`);
      }
      if (result.normalizedCount > 0) {
        parts.push(`${result.normalizedCount} existing code${result.normalizedCount === 1 ? '' : 's'} normalized`);
      }
      setReconcileMessage({
        type: 'success',
        text:
          parts.length > 0
            ? `Reconciliation complete: ${parts.join(', ')}. Every Step 5 proposal now has a unique persisted Project ID.`
            : 'All Step 5 authorized proposals already have unique persisted Project IDs.',
      });
    } catch (err) {
      setReconcileMessage({
        type: 'error',
        text:
          err instanceof Error
            ? `Could not reconcile Project IDs: ${err.message}`
            : 'Could not reconcile Project IDs right now. Please try again.',
      });
    } finally {
      setIsReconcilingIds(false);
    }
  };

  const attributionMap = useMemo(() => {
    return computeAllProposalsFundingAttribution(
      proposals || [],
      budgetDetails.allocations,
      budgetDetails.matchingPledges
    ).byProposalId;
  }, [proposals, budgetDetails]);

  // Build external JSON preview for either all approved proposals or the selected approved proposal
  const previewJsonString = useMemo(() => {
    const sequenceMap = buildCollisionFreeUnionSequenceMap(approvedProposals);
    const mapped = approvedProposals.map((p) => {
      const canonUnion = getCanonicalUnion(p.union) || p.union || 'SSD';
      const acronym = UNION_ACRONYMS[p.union] || UNION_ACRONYMS[canonUnion] || 'SSD';
      const envelope = toExternalProposalJson(
        p,
        sequenceMap.get(p.id) || 1,
        apiConfig.orgId || 'AT1111',
        attributionMap[p.id]
      );
      return {
        id: p.id,
        union: canonUnion,
        unionAcronym: acronym,
        status: 'approved' as const,
        actionNumber: p.unionApproval?.actionNumber || null,
        approvedAt: p.unionApproval?.timestamp || p.reviewedAt || p.updatedAt || null,
        divisionAuthorizedAt: p.divisionApproval?.timestamp || p.divisionApproval?.authorizedDate || null,
        authorizationRef: p.divisionApproval?.referenceNumber || null,
        updatedAt: p.updatedAt || p.createdAt,
        proposal: envelope.proposal,
        projectCode: envelope.projectCode,
        _rawEnvelope: envelope,
      };
    });

    if (selectedProposalId !== '__all__') {
      const found = mapped.find((m) => m.id === selectedProposalId);
      if (found) {
        return JSON.stringify(found._rawEnvelope, null, 2);
      }
    }

    return JSON.stringify(
      {
        organization: 'Southern Asia-Pacific Division (SSD)',
        orgId: apiConfig.orgId || 'AT1111',
        scope: 'approved_only',
        authorizationGate: 'step5_ssd_ov27_committee',
        count: mapped.length,
        exportedAt: new Date().toISOString(),
        proposals: mapped.map(({ _rawEnvelope, ...rest }) => rest),
      },
      null,
      2
    );
  }, [approvedProposals, selectedProposalId, apiConfig.orgId, attributionMap]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleRotateApiKey = async () => {
    setSavingConfig(true);
    try {
      const newKey = generateSecureGcApiKey();
      const updated = await saveGcApiConfig({ apiKey: newKey }, currentAdminEmail);
      setApiConfig(updated);
      await syncGcApiExportSnapshot(proposals || [], true).catch(() => {});
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleEnabled = async () => {
    setSavingConfig(true);
    try {
      const updated = await saveGcApiConfig(
        { enabled: !apiConfig.enabled },
        currentAdminEmail
      );
      setApiConfig(updated);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestLiveEndpoint = async () => {
    setLiveTestStatus({ loading: true });
    try {
      const res = await fetch(`${baseUrl}/api/v1/proposals`, {
        headers: {
          'x-api-key': apiConfig.apiKey,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setLiveTestStatus({
          loading: false,
          ok: true,
          status: res.status,
          count: data.count ?? (Array.isArray(data) ? data.length : 0),
          message: `200 OK — Live API returned ${
            data.count ?? 0
          } Step 5 SSD OV27 authorized proposal(s) in GC schema.`,
        });
      } else {
        setLiveTestStatus({
          loading: false,
          ok: false,
          status: res.status,
          message: `${res.status}: ${data.message || data.error || 'Request failed'}`,
        });
      }
    } catch (err) {
      setLiveTestStatus({
        loading: false,
        ok: false,
        message: err instanceof Error ? err.message : 'Could not reach API endpoint.',
      });
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([previewJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename =
      selectedProposalId === '__all__'
        ? `ssd-onevoice27-authorized-proposals-${new Date().toISOString().slice(0, 10)}.json`
        : `proposal-${selectedProposalId}-gc-export.json`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Complete developer handoff instructions text to send to the GC team
  const gcHandoffInstructionsText = useMemo(() => {
    return [
      `====================================================================`,
      `SSD OneVoice27 — GC Authorized Proposals API Integration Guide`,
      `Organization: Southern Asia-Pacific Division (Org ID: ${apiConfig.orgId || 'AT1111'})`,
      `Access Mode: One-Way Read-Only (Step 5 SSD OV27 Committee Authorized Only)`,
      `====================================================================`,
      ``,
      `1. BASE URL & ENDPOINTS`,
      `   • List All Authorized Proposals:`,
      `     GET ${baseUrl}/api/v1/proposals`,
      ``,
      `   • Get Single Authorized Proposal (Exact { proposal, projectCode } Schema):`,
      `     GET ${baseUrl}/api/v1/proposals/:id`,
      `     (Accepts either the proposal ID or projectCode.projectId, e.g. OVSSDECPUC001)`,
      ``,
      `   • Service Health Check:`,
      `     GET ${baseUrl}/api/v1/health`,
      ``,
      `2. AUTHENTICATION`,
      `   Include the following API Key in your HTTP request headers:`,
      `   • Header Option A:  x-api-key: ${apiConfig.apiKey}`,
      `   • Header Option B:  Authorization: Bearer ${apiConfig.apiKey}`,
      ``,
      `3. OPTIONAL QUERY PARAMETERS (for GET /api/v1/proposals)`,
      `   • ?format=raw_array          -> Returns a pure array of [{ proposal, projectCode }, ...]`,
      `   • ?union=ECPUC               -> Filter by Union acronym or canonical Union name`,
      `   • ?focusId=3                 -> Filter by Strategic Focus Pillar (1, 2, or 3)`,
      `   • ?strategicProjectId=6      -> Filter by Strategic Project / Objective (1 to 7)`,
      `   • ?updatedSince=2026-11-01   -> Incremental sync (ISO date/timestamp)`,
      ``,
      `4. EXAMPLE cURL REQUEST`,
      `   curl -X GET "${baseUrl}/api/v1/proposals" \\`,
      `     -H "x-api-key: ${apiConfig.apiKey}" \\`,
      `     -H "Accept: application/json"`,
      ``,
      `5. DATA SCOPE & SCHEMA GUARANTEES`,
      `   • Only Step 5 SSD OV27 Committee Authorized proposals ("Authorized to send to GC") are returned.`,
      `   • Drafts, Submitted, Under-Review, and Step 3-only proposals pending Division authorization are never exposed.`,
      `   • Payload tags match the GC JSON specification:`,
      `     - proposal.focusId (1..3) & proposal.strategicProjectId (1..7)`,
      `     - proposal.answers ([overview, goal, outcomes, kpiDescription])`,
      `     - proposal.keyMetricCategory ("reach" | "engagement" | "connection" | "retention" | "capability")`,
      `     - proposal.keyMetricValue (integer) & proposal.keyMetricRationale`,
      `     - proposal.targetAudience (["a_missional", "a_leadership", "a_youth", "a_governance", "b_members", "c_aware", "d_unaware", "e_other"])`,
      `     - proposal.budgetLines ([{ activity, localAmount, requestedAmount, gcAmount, ssdAmount, spdAmount, <union>Amount, position }])`,
      `     - proposal.fundingAttribution ({ totalRequestedAmount, gcAmount, ssdAmount, spdAmount, <union>Amount, gcPct, ssdPct, spdPct, <union>Pct, poolCoveredAmount, overPoolDeficitAmount, poolStatus })`,
      `     - projectCode ({ composite, orgId: "AT1111", projectId: "OVSSD<UNION>###", phase, status })`,
    ].join('\n');
  }, [baseUrl, apiConfig.apiKey, apiConfig.orgId]);

  const curlSnippet = `curl -X GET "${baseUrl}/api/v1/proposals" \\\n  -H "x-api-key: ${apiConfig.apiKey}" \\\n  -H "Accept: application/json"`;

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc]">
      {/* Top Banner: What to Send to the GC Team */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-[#182747] to-[#1e3a8a] text-white shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>One-Way Read-Only API · Step 5 SSD OV27 Authorized Only</span>
            </div>
            <h3 className="text-xl font-black tracking-tight text-white">
              GC External API Connection &amp; Handoff Instructions
            </h3>
            <p className="text-xs text-blue-100/90 leading-relaxed">
              Share the connection credentials below with the General Conference (GC) technical team.
              This API automatically exposes proposals authorized in <strong>Step 5 (SSD OV27 Committee)</strong> in the exact GC JSON schema
              (<code className="text-amber-300 font-mono">proposal</code> +{' '}
              <code className="text-amber-300 font-mono">projectCode</code>) while keeping{' '}
              <strong>{nonApprovedCount}</strong> draft, review, and pending-Step-5 proposals strictly private.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleCopy('handoff_all', gcHandoffInstructionsText)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-sm transition cursor-pointer active:scale-95"
            >
              {copiedField === 'handoff_all' ? (
                <>
                  <Check className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  <span>Copied Complete GC Instructions!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-950" />
                  <span>Copy Complete Instructions for GC</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleTestLiveEndpoint}
              disabled={liveTestStatus.loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${liveTestStatus.loading ? 'animate-spin' : ''}`}
              />
              <span>Test Live API</span>
            </button>
          </div>
        </div>

        {liveTestStatus.message && (
          <div
            className={`mt-4 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
              liveTestStatus.ok
                ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40'
                : 'bg-rose-500/20 text-rose-100 border border-rose-400/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{liveTestStatus.message}</span>
            </div>
            <span className="text-[11px] opacity-80 font-mono">GET /api/v1/proposals</span>
          </div>
        )}
      </div>

      {/* Step-by-Step Checklist: What You Need to Give the GC */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Endpoints */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-blue-900">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Step 1 · Endpoint URLs</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
              HTTPS GET
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Give the GC developer these two read-only URLs to pull all Step 5 Authorized proposals or fetch a
            specific proposal by ID:
          </p>

          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  All Step 5 Authorized Proposals
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('url_list', `${baseUrl}/api/v1/proposals`)}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'url_list' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs font-mono text-slate-900 break-all select-all">
                {baseUrl}/api/v1/proposals
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Single Proposal (Exact GC File Format)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('url_single', `${baseUrl}/api/v1/proposals/:id`)}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'url_single' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs font-mono text-slate-900 break-all select-all">
                {baseUrl}/api/v1/proposals/:id
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: API Key & Security */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-900">
              <Key className="w-4 h-4 text-amber-600" />
              <span>Step 2 · API Key Header</span>
            </span>
            <button
              type="button"
              onClick={handleToggleEnabled}
              disabled={savingConfig || loadingConfig}
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                apiConfig.enabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              {apiConfig.enabled ? 'API Active' : 'API Paused'}
            </button>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The GC system must pass this secret key in the{' '}
            <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[11px]">
              x-api-key
            </code>{' '}
            header (or{' '}
            <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[11px]">
              Authorization: Bearer
            </code>
            ):
          </p>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase text-amber-900">
                Active SSD Secret API Key
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy('api_key', apiConfig.apiKey)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold transition cursor-pointer"
                >
                  {copiedField === 'api_key' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Key</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRotateApiKey}
                  disabled={savingConfig}
                  title="Generate a new API key (invalidates previous key)"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${savingConfig ? 'animate-spin' : ''}`} />
                  <span>Rotate</span>
                </button>
              </div>
            </div>
            <p className="text-xs font-mono font-bold text-slate-900 break-all select-all bg-white px-2.5 py-2 rounded-lg border border-amber-200">
              {loadingConfig && !apiConfig.apiKey ? 'Loading active secret key...' : apiConfig.apiKey || 'Key unavailable — click Rotate to generate'}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-600" />
              <span>Step 5 Authorized Filter Enforced</span>
            </span>
            <span className="font-semibold text-slate-700">
              {approvedProposals.length} Ready for GC Sync
            </span>
          </div>
        </div>

        {/* Card 3: Quick cURL & Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-900">
              <Terminal className="w-4 h-4 text-indigo-600" />
              <span>Step 3 · Sample Request &amp; Filters</span>
            </span>
            <button
              type="button"
              onClick={() => handleCopy('curl', curlSnippet)}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedField === 'curl' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700">Copied cURL</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy cURL</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
            {curlSnippet}
          </pre>

          <div className="space-y-1 text-[11px] text-slate-600">
            <p className="font-bold text-slate-800">Optional Query Parameters:</p>
            <ul className="space-y-0.5 font-mono text-[10px] text-slate-600">
              <li>
                • <span className="text-indigo-700 font-semibold">?format=raw_array</span> — Pure{' '}
                <code>[&#123; proposal, projectCode &#125;]</code> array
              </li>
              <li>
                • <span className="text-indigo-700 font-semibold">?union=ECPUC</span> — Filter by
                Union acronym
              </li>
              <li>
                • <span className="text-indigo-700 font-semibold">?focusId=3</span> — Filter by
                Pillar (1, 2, or 3)
              </li>
              <li>
                • <span className="text-indigo-700 font-semibold">?strategicProjectId=6</span> —
                Filter by Objective (1–7)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tag Alignment Reference Table (SSD Internal <-> GC JSON Schema) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-700" />
            <h4 className="text-sm font-bold text-slate-900">
              Automatic Tag &amp; Schema Translation Reference (Option A)
            </h4>
          </div>
          <span className="text-[11px] text-slate-500">
            Zero manual conversion needed — translated automatically on every API call
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <p className="font-bold text-slate-800">Target Audience Codes</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-slate-600">
              {Object.entries(INTERNAL_TO_EXTERNAL_AUDIENCE).map(([internal, external]) => (
                <div key={internal} className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{internal}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-blue-700">{external}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <p className="font-bold text-slate-800">Primary KPI Categories</p>
            <div className="space-y-1 font-mono text-[11px] text-slate-600">
              {Object.entries(INTERNAL_TO_EXTERNAL_KPI).map(([internal, external]) => (
                <div key={internal} className="flex items-center justify-between">
                  <span className="text-slate-700 truncate max-w-[160px]">{internal}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-emerald-700 font-bold">{external}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <p className="font-bold text-slate-800">Narrative &amp; Financial Structure</p>
            <ul className="space-y-1 text-[11px] text-slate-600">
              <li>
                • <code className="font-mono text-slate-800">answers[0..3]</code> ← Overview, Goal,
                Outcomes, KPI Target Details
              </li>
              <li>
                • <code className="font-mono text-slate-800">focusId (1–3)</code> &amp;{' '}
                <code className="font-mono text-slate-800">strategicProjectId (1–7)</code>
              </li>
              <li>
                • <code className="font-mono text-slate-800">budgetLines</code> ←{' '}
                <code>
                  activity, localAmount, requestedAmount, gcAmount (GC share), ssdAmount,
                  spdAmount, &lt;union&gt;Amount (e.g. sacAmount), position
                </code>
              </li>
              <li>
                • <code className="font-mono text-slate-800">fundingAttribution</code> ←{' '}
                <code>
                  totalRequestedAmount, gcAmount/Pct, ssdAmount/Pct, spdAmount/Pct,
                  &lt;union&gt;Amount/Pct, poolStatus
                </code>
              </li>
              <li>
                • <code className="font-mono text-slate-800">projectCode</code> ←{' '}
                <code>AT1111 - OVSSD&lt;UNION&gt;&lt;SEQ&gt; - Phase - Status</code>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Project ID Integrity & Legacy Backfill Card */}
      {(codeAuditIssues.needsReconciliationCount > 0 || reconcileMessage) && (
        <div
          className={`rounded-2xl border p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            codeAuditIssues.needsReconciliationCount > 0
              ? 'bg-amber-50/70 border-amber-300'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                codeAuditIssues.needsReconciliationCount > 0
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {codeAuditIssues.needsReconciliationCount > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <h4 className="text-sm font-extrabold text-slate-900">
                {codeAuditIssues.needsReconciliationCount > 0
                  ? `${codeAuditIssues.needsReconciliationCount} Step 5 Authorized Proposal${
                      codeAuditIssues.needsReconciliationCount === 1 ? '' : 's'
                    } Need Unique Sequential Project IDs`
                  : 'Step 5 Project IDs Reconciled'}
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                {reconcileMessage ? (
                  reconcileMessage.text
                ) : (
                  <>
                    {codeAuditIssues.missingIdProposals.length > 0 && (
                      <span>
                        <strong>{codeAuditIssues.missingIdProposals.length}</strong> legacy Step 5{' '}
                        {codeAuditIssues.missingIdProposals.length === 1 ? 'proposal has' : 'proposals have'} no
                        persisted sequential ID yet
                      </span>
                    )}
                    {codeAuditIssues.missingIdProposals.length > 0 &&
                      codeAuditIssues.duplicateIdProposals.length > 0 && <span> and </span>}
                    {codeAuditIssues.duplicateIdProposals.length > 0 && (
                      <span>
                        <strong>{codeAuditIssues.duplicateIdProposals.length}</strong>{' '}
                        {codeAuditIssues.duplicateIdProposals.length === 1 ? 'proposal shares' : 'proposals share'} a
                        duplicate Project ID within its Union
                      </span>
                    )}
                    . Run one-click reconciliation to permanently assign and lock unique{' '}
                    <code className="font-mono font-bold">OVSSD&lt;UNION&gt;###</code> IDs chronologically in
                    Firestore.
                  </>
                )}
              </p>
            </div>
          </div>

          {codeAuditIssues.needsReconciliationCount > 0 && (
            <button
              type="button"
              onClick={handleReconcileProjectIds}
              disabled={isReconcilingIds}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isReconcilingIds
                  ? 'Assigning Unique IDs...'
                  : `Assign & Deduplicate IDs (${codeAuditIssues.needsReconciliationCount})`}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Live Payload Inspector & JSON Export */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-emerald-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 tabular-nums">
                Live GC API Payload Preview ({approvedProposals.length} Step 5 Authorized Proposal
                {approvedProposals.length === 1 ? '' : 's'})
              </h4>
              <p className="text-xs text-slate-500">
                Inspect the exact JSON returned by the API or download a static <code>.json</code>{' '}
                file
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProposalId}
              onChange={(e) => setSelectedProposalId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
            >
              <option value="__all__">
                All Step 5 Authorized ({approvedProposals.length})
              </option>
              {approvedProposals.map((p) => (
                <option key={p.id} value={p.id}>
                  [{UNION_ACRONYMS[p.union] || 'SSD'}] {p.title || 'Untitled'}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleCopy('json_preview', previewJsonString)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
            >
              {copiedField === 'json_preview' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied JSON</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .JSON</span>
            </button>
          </div>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950 text-emerald-300 text-xs font-mono max-h-96 overflow-y-auto leading-relaxed border border-slate-800">
          {previewJsonString}
        </pre>
      </div>
    </div>
  );
}
