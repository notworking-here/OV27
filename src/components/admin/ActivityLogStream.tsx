import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  Send,
  RotateCcw,
  Plus,
  ArrowRightLeft,
  Trash2,
  FileCheck2,
  FileText,
  Search,
  Filter,
  User,
  Building2,
  Calendar,
  Layers,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Tag,
  Lock,
  Activity,
} from 'lucide-react';
import {
  ProposalActivityEvent,
  ActivityEventType,
  Proposal,
  UserAccount,
  UNIONS,
  UNION_ACRONYMS,
  getCanonicalUnion,
  getProposalActivityLog,
} from '../../types';
import {
  subscribeToGlobalActivityLogs,
  getLocalActivityLogs,
} from '../../services/activityLogService';
import { matchesProposalSearch } from '../../utils/proposalSearch';

interface ActivityLogStreamProps {
  proposal?: Proposal | null;
  proposalId?: string;
  initialUnionFilter?: string;
  currentUser?: UserAccount;
  proposals?: Proposal[];
  onSelectProposal?: (proposalId: string) => void;
  isCompact?: boolean;
}

const EVENT_CONFIG: Record<
  ActivityEventType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    textClass: string;
    borderClass: string;
    badgeClass: string;
  }
> = {
  approved: {
    label: 'Step 3 · Union Voted',
    icon: CheckCircle2,
    bgClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    textClass: 'text-emerald-900',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  liaison_voted: {
    label: 'Step 4 · Liaison Voted',
    icon: ShieldCheck,
    bgClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
    textClass: 'text-indigo-900',
    borderClass: 'border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  division_authorized: {
    label: 'Step 5 · SSD OV27 Committee',
    icon: ShieldCheck,
    bgClass: 'bg-emerald-600/15 text-emerald-700 border-emerald-600/40',
    textClass: 'text-emerald-950',
    borderClass: 'border-emerald-300',
    badgeClass: 'bg-emerald-600 text-white border-emerald-700',
  },
  division_unauthorize: {
    label: 'Authorization Revoked',
    icon: RotateCcw,
    bgClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    textClass: 'text-amber-900',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  submitted: {
    label: 'Step 1 · Submitted',
    icon: Send,
    bgClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    textClass: 'text-blue-900',
    borderClass: 'border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  under_review: {
    label: 'Step 2 · Union Review',
    icon: Clock,
    bgClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    textClass: 'text-amber-900',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  reopened: {
    label: 'Review Reopened',
    icon: RotateCcw,
    bgClass: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    textClass: 'text-orange-900',
    borderClass: 'border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  returned_to_draft: {
    label: 'Returned to Draft',
    icon: RotateCcw,
    bgClass: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
    textClass: 'text-slate-800',
    borderClass: 'border-slate-200',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  transferred: {
    label: 'Ownership Transferred',
    icon: ArrowRightLeft,
    bgClass: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    textClass: 'text-purple-900',
    borderClass: 'border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  created: {
    label: 'Created',
    icon: Plus,
    bgClass: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
    textClass: 'text-sky-900',
    borderClass: 'border-sky-200',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  action_edited: {
    label: 'Action Edited',
    icon: FileCheck2,
    bgClass: 'bg-teal-500/10 text-teal-600 border-teal-500/30',
    textClass: 'text-teal-900',
    borderClass: 'border-teal-200',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  saved: {
    label: 'Content Saved',
    icon: FileText,
    bgClass: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
    textClass: 'text-slate-800',
    borderClass: 'border-slate-200',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  deleted: {
    label: 'Deleted',
    icon: Trash2,
    bgClass: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
    textClass: 'text-rose-900',
    borderClass: 'border-rose-200',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  project_code_edited: {
    label: 'Project Code Edited',
    icon: Tag,
    bgClass: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
    textClass: 'text-sky-950',
    borderClass: 'border-sky-200',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
  },
  project_code_locked: {
    label: 'Project ID Locked',
    icon: Lock,
    bgClass: 'bg-emerald-600/15 text-emerald-700 border-emerald-600/40',
    textClass: 'text-emerald-950',
    borderClass: 'border-emerald-300',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  phase_changed: {
    label: 'Phase Updated',
    icon: Layers,
    bgClass: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30',
    textClass: 'text-indigo-950',
    borderClass: 'border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  },
  status_changed: {
    label: 'Status Updated',
    icon: Activity,
    bgClass: 'bg-teal-500/10 text-teal-700 border-teal-500/30',
    textClass: 'text-teal-950',
    borderClass: 'border-teal-200',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
  },
};

export function ActivityLogStream({
  proposal,
  proposalId,
  initialUnionFilter = 'all',
  currentUser,
  proposals = [],
  onSelectProposal,
  isCompact = false,
}: ActivityLogStreamProps) {
  const [logs, setLogs] = useState<ProposalActivityEvent[]>(() => getLocalActivityLogs());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUnion, setSelectedUnion] = useState<string>(initialUnionFilter);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const targetProposalId = proposalId || proposal?.id;

  // Real-time live listener (global mode only — single-proposal history uses proposal.activityLog directly)
  useEffect(() => {
    if (targetProposalId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeToGlobalActivityLogs((fresh) => {
      setLogs(fresh);
      setIsLoading(false);
    });

    return () => unsub();
  }, [targetProposalId]);

  // Unified chronological logs: seamlessly aggregates baseline proposal milestones across all loaded proposals
  // and overlays live recorded activity_logs events at 0 KB additional network bandwidth.
  const unifiedLogs = useMemo(() => {
    const map = new Map<string, ProposalActivityEvent>();

    // 1. Synthesize baseline milestone events from proposals in memory
    if (targetProposalId) {
      const foundProp = proposal || proposals.find((p) => p.id === targetProposalId);
      if (foundProp) {
        const events = getProposalActivityLog(foundProp);
        events.forEach((e) => map.set(e.id, e));
      }
    } else {
      // Global mode: aggregate across all loaded proposals
      if (proposals && proposals.length > 0) {
        for (const prop of proposals) {
          const events = getProposalActivityLog(prop);
          events.forEach((e) => map.set(e.id, e));
        }
      } else if (proposal) {
        const events = getProposalActivityLog(proposal);
        events.forEach((e) => map.set(e.id, e));
      }
    }

    // 2. Overlay live / recorded events from central activity_logs collection & local cache (deduped by ID)
    for (const log of logs) {
      if (targetProposalId && log.proposalId !== targetProposalId) {
        continue;
      }
      map.set(log.id, log);
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [targetProposalId, proposal, proposals, logs]);

  const proposalByIdMap = useMemo(
    () => new Map(proposals.map((p) => [p.id, p])),
    [proposals]
  );

  const unionEventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of unifiedLogs) {
      const canon = getCanonicalUnion(l.union);
      if (!canon) continue;
      counts.set(canon, (counts.get(canon) || 0) + 1);
    }
    return counts;
  }, [unifiedLogs]);

  // Filtered logs for display
  const displayLogs = useMemo(() => {
    return unifiedLogs.filter((log) => {
      // 1. Union filter
      if (selectedUnion !== 'all') {
        const canonicalLogUnion = getCanonicalUnion(log.union);
        const canonicalSelectedUnion = getCanonicalUnion(selectedUnion);
        if (canonicalLogUnion !== canonicalSelectedUnion) {
          return false;
        }
      }

      // 2. Type filter
      if (selectedType !== 'all' && log.type !== selectedType) {
        return false;
      }

      // 3. Search query (including linked proposal POC & Lead names)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const canonUnion = getCanonicalUnion(log.union);
        const acronym = (UNION_ACRONYMS[canonUnion] || UNION_ACRONYMS[log.union] || '').toLowerCase();
        const matchTitle = (log.proposalTitle || '').toLowerCase().includes(q);
        const matchActor = (log.actorName || '').toLowerCase().includes(q);
        const matchEmail = (log.actorEmail || '').toLowerCase().includes(q);
        const matchAction = (log.actionNumber || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchUnion = (log.union || '').toLowerCase().includes(q) || acronym.includes(q);
        const linkedProp = log.proposalId ? proposalByIdMap.get(log.proposalId) : undefined;
        const matchLinkedContacts = linkedProp ? matchesProposalSearch(linkedProp, q) : false;

        if (
          !matchTitle &&
          !matchActor &&
          !matchEmail &&
          !matchAction &&
          !matchDetails &&
          !matchUnion &&
          !matchLinkedContacts
        ) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedLogs, selectedUnion, selectedType, searchQuery, proposalByIdMap]);

  // Aggregate event metrics
  const metrics = useMemo(() => {
    let created = 0;
    let submitted = 0;
    let approved = 0;
    let reopened = 0;

    displayLogs.forEach((l) => {
      if (l.type === 'created') created++;
      if (l.type === 'submitted') submitted++;
      if (l.type === 'approved') approved++;
      if (l.type === 'reopened' || l.type === 'returned_to_draft') reopened++;
    });

    return { total: displayLogs.length, created, submitted, approved, reopened };
  }, [displayLogs]);

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const dateStr = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timeStr = d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return `${dateStr} at ${timeStr}`;
    } catch {
      return iso;
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return new Date(iso).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header / Scope Banner (if global view) */}
      {!targetProposalId && (
        <div className="space-y-3">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Events</span>
              <span className="text-xl font-black text-slate-800 tabular-nums">{metrics.total}</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[10px] uppercase font-bold text-blue-800 block">Submissions</span>
              <span className="text-xl font-black text-blue-900 tabular-nums">{metrics.submitted}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Approvals</span>
              <span className="text-xl font-black text-emerald-900 tabular-nums">{metrics.approved}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] uppercase font-bold text-amber-800 block">Reopened / Revisions</span>
              <span className="text-xl font-black text-amber-900 tabular-nums">{metrics.reopened}</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search proposal, POC, Lead, actor, or action #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 text-xs outline-none transition"
              />
            </div>

            {/* Compact Code Union Filter */}
            <div
              className="inline-flex items-center gap-1.5"
              title={selectedUnion === 'all' ? 'All Unions' : selectedUnion}
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedUnion}
                onChange={(e) => setSelectedUnion(e.target.value)}
                aria-label="Filter activity by Union code"
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-bold text-slate-700 outline-none text-xs cursor-pointer tabular-nums"
              >
                <option value="all">All Unions ({unifiedLogs.length})</option>
                {UNIONS.map((u) => {
                  const count = unionEventCounts.get(getCanonicalUnion(u)) || 0;
                  return (
                    <option key={u} value={u}>
                      {UNION_ACRONYMS[u] || u} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Event Type Filter */}
            <div className="inline-flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-semibold text-slate-700 outline-none text-xs cursor-pointer"
              >
                <option value="all">All Events</option>
                <option value="division_authorized">Step 5 Authorizations</option>
                <option value="project_code_locked">Project ID Locked</option>
                <option value="project_code_edited">Project Code Edited</option>
                <option value="phase_changed">Phase Updated</option>
                <option value="status_changed">Status Updated</option>
                <option value="approved">Step 3 Approvals</option>
                <option value="liaison_voted">Step 4 Liaison Votes</option>
                <option value="submitted">Submissions</option>
                <option value="under_review">Under Review</option>
                <option value="reopened">Reopened Reviews</option>
                <option value="returned_to_draft">Returned to Draft</option>
                <option value="transferred">Transfers</option>
                <option value="created">Creations</option>
                <option value="deleted">Deletions</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Stream */}
      {displayLogs.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs space-y-2">
          <Clock className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
          <p className="font-semibold text-slate-600">No activity events recorded yet</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Lifecycle actions (creating, submitting, reviewing, approving, reopening, and transferring proposals) are logged here automatically.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {displayLogs.map((log) => {
            const config = EVENT_CONFIG[log.type] || EVENT_CONFIG.saved;
            const IconComponent = config.icon;
            const relTime = formatRelativeTime(log.timestamp);
            const fullTime = formatTimestamp(log.timestamp);

            return (
              <div
                key={log.id}
                className="relative bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition space-y-2"
              >
                {/* Node icon on timeline spine */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-3.5 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center -translate-x-1/2 shadow-xs ${config.bgClass}`}
                  title={config.label}
                >
                  <IconComponent className="w-3 h-3" />
                </div>

                {/* Top Row: Event Type Badge + Relative Time + Union */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${config.badgeClass}`}
                    >
                      <IconComponent className="w-3 h-3" />
                      <span>{config.label}</span>
                    </span>

                    {log.actionNumber && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase">
                        Action #{log.actionNumber}
                      </span>
                    )}

                    {log.fromStatus && log.toStatus && log.fromStatus !== log.toStatus && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {log.fromStatus.replace('_', ' ')} ➔ {log.toStatus.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                    <span className="font-semibold text-slate-600">{relTime}</span>
                    <span>•</span>
                    <span title={fullTime}>{fullTime}</span>
                  </div>
                </div>

                {/* Proposal Title & Link (if not already viewing a single proposal) */}
                {!targetProposalId && (
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                          {UNION_ACRONYMS[log.union] || log.union}
                        </span>
                        <span className="truncate">{log.union}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 truncate" title={log.proposalTitle}>
                        {log.proposalTitle || 'Untitled Proposal'}
                      </h4>
                    </div>

                    {onSelectProposal && log.proposalId && (
                      <button
                        type="button"
                        onClick={() => onSelectProposal(log.proposalId)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold transition cursor-pointer shrink-0"
                        title="Open proposal page"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Details Narrative */}
                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                  <p>{log.details}</p>
                  {log.field && (log.previousValue || log.newValue) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-200/70">
                      <span className="font-bold text-slate-700">{log.field}:</span>
                      <span className="text-slate-500">{log.previousValue || '—'}</span>
                      <span aria-hidden="true">→</span>
                      <span className="font-bold text-slate-900">{log.newValue || '—'}</span>
                    </div>
                  )}
                </div>

                {/* Actor Footer */}
                <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-800">{log.actorName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                      {log.actorRole.replace('_', ' ')}
                    </span>
                    {log.actorEmail && <span className="text-slate-400 hidden sm:inline">({log.actorEmail})</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {log.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
