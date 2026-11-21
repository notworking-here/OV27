import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Search,
  X,
  Layers,
  MessageSquare,
} from 'lucide-react';
import { Proposal, UserAccount, UNIONS, UNION_ACRONYMS, getCanonicalUnion, getUserAllUnions } from '../types';
import { validateProposalForSubmission } from '../utils/validation';
import { matchesProposalSearch, getProposalContactDisplay } from '../utils/proposalSearch';

interface SidebarProps {
  proposals: Proposal[];
  activeProposalId: string;
  currentUser: UserAccount | null;
  onSelectProposal: (id: string) => void;
  onNewProposal: () => void;
  onDeleteProposal: (id: string, e: React.MouseEvent) => void;
  onDuplicateProposal: (id: string, e: React.MouseEvent) => void;
  onCloseMobileDrawer?: () => void;
  isMobileDrawer?: boolean;
  onOpenAuth?: () => void;
  selectedUnionFilter?: string;
  onUnionFilterChange?: (union: string) => void;
}

export function Sidebar({
  proposals,
  activeProposalId,
  currentUser,
  onSelectProposal,
  onNewProposal,
  onDeleteProposal,
  onDuplicateProposal,
  onCloseMobileDrawer,
  isMobileDrawer = false,
  onOpenAuth,
  selectedUnionFilter: externalUnionFilter,
  onUnionFilterChange,
}: SidebarProps) {
  const [internalUnionFilter, setInternalUnionFilter] = useState<string>('all');
  const selectedUnionFilter = externalUnionFilter !== undefined ? externalUnionFilter : internalUnionFilter;
  const handleUnionFilterChange = (val: string) => {
    setInternalUnionFilter(val);
    if (onUnionFilterChange) onUnionFilterChange(val);
  };
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isCoordinator = currentUser?.role === 'coordinator' || currentUser?.role === 'treasurer';
  const isLiaison = currentUser?.role === 'division_liaison';
  const isGuest = !currentUser || !currentUser.email;

  const handleSelect = (id: string) => {
    onSelectProposal(id);
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const handleNew = () => {
    if (isGuest && onOpenAuth) {
      onOpenAuth();
      if (onCloseMobileDrawer) onCloseMobileDrawer();
      return;
    }
    onNewProposal();
    if (onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const unionCountsMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of proposals) {
      const canon = getCanonicalUnion(p.union);
      if (!canon) continue;
      counts.set(canon, (counts.get(canon) || 0) + 1);
    }
    return counts;
  }, [proposals]);

  // Filter proposals based on unified search (Title, POC, Lead, Submitter, Union code) and Super Admin union filter
  const filteredProposals = proposals.filter((p) => {
    if (
      isSuperAdmin &&
      selectedUnionFilter !== 'all' &&
      getCanonicalUnion(p.union) !== getCanonicalUnion(selectedUnionFilter)
    ) {
      return false;
    }
    if (searchQuery.trim() && !matchesProposalSearch(p, searchQuery)) {
      return false;
    }
    return true;
  });

  return (
    <aside className={`shrink-0 flex flex-col gap-3.5 no-print ${isMobileDrawer ? 'w-full' : 'w-full lg:w-80'}`}>
      {/* Mobile Drawer Header */}
      {isMobileDrawer && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1c398e]" />
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">Proposals List</h2>
              <p className="text-[11px] text-slate-500">Select, switch, or create a proposal</p>
            </div>
          </div>
          {onCloseMobileDrawer && (
            <button
              type="button"
              onClick={onCloseMobileDrawer}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 active:scale-95 transition"
              aria-label="Close proposals drawer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* New Proposal Button (Hidden for Division Coordinators who review & advise only) */}
      {!isLiaison && (
        <button
          type="button"
          onClick={handleNew}
          className="w-full py-3 px-4 rounded-2xl bg-[#1c398e] hover:bg-[#152c70] active:bg-[#0f2054] text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
          title={isGuest ? 'Sign in to create a new proposal' : 'Create a new proposal'}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New proposal</span>
        </button>
      )}

      {/* Compact Scope & Filter Box */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
        <div
          className="flex items-center justify-between text-xs"
          title={
            isLiaison
              ? `Assigned territories: ${getUserAllUnions(currentUser)
                  .map((u) => UNION_ACRONYMS[u] || u)
                  .join(', ')}`
              : isCoordinator
              ? `Union scope: ${currentUser?.union || ''}`
              : undefined
          }
        >
          <span className="font-bold text-slate-800 truncate">
            {isSuperAdmin
              ? 'Division Proposals'
              : isLiaison
              ? `Assigned Proposals`
              : isCoordinator
              ? `${UNION_ACRONYMS[currentUser?.union || ''] || 'Union'} Proposals`
              : 'My Proposals'}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
            {filteredProposals.length} {filteredProposals.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Super Admin Compact Code Union Filter Selector */}
        {isSuperAdmin && (
          <select
            value={selectedUnionFilter}
            onChange={(e) => handleUnionFilterChange(e.target.value)}
            aria-label="Filter proposals by Union code"
            title={selectedUnionFilter === 'all' ? 'All Unions (Division Total)' : selectedUnionFilter}
            className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-bold outline-none focus:border-blue-500 cursor-pointer tabular-nums"
          >
            <option value="all">All Unions ({proposals.length})</option>
            {UNIONS.map((u) => {
              const count = unionCountsMap.get(getCanonicalUnion(u)) || 0;
              return (
                <option key={u} value={u}>
                  {UNION_ACRONYMS[u] || u} ({count})
                </option>
              );
            })}
          </select>
        )}

        {/* Search filter for fast lookup */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search title, POC, or Lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Proposals List */}
      <div className={`space-y-2.5 overflow-y-auto ${isMobileDrawer ? 'max-h-[60vh]' : 'max-h-[calc(100vh-280px)]'}`}>
        {filteredProposals.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-600">No proposals found</p>
            <p className="text-[11px]">Click &quot;New proposal&quot; above to create one.</p>
          </div>
        ) : (
          filteredProposals.map((proposal) => {
            const isActive = proposal.id === activeProposalId;
            const displayTitle = (proposal.title || '').trim() || 'Untitled proposal';
            const formattedDate = new Date(
              proposal.updatedAt || proposal.createdAt
            ).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            const contact = getProposalContactDisplay(proposal);
            const authorName = contact.primaryName;
            const unionAcronym =
              UNION_ACRONYMS[proposal.union] ||
              (proposal.union
                ? proposal.union.replace(/(Union Conference|Union Mission|Conference|Mission)/g, '').trim()
                : '');

            const canDelete =
              isSuperAdmin ||
              (currentUser && proposal.userId === currentUser.uid) ||
              proposals.length > 1;

            return (
              <div
                key={proposal.id}
                onClick={() => handleSelect(proposal.id)}
                className={`group relative p-3.5 rounded-2xl cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-[#f4f7fb] border-2 border-[#e3b341] shadow-xs'
                    : 'bg-white border border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* Union & POC/Author badge for Admin / Coordinator views */}
                    {(isSuperAdmin || isCoordinator) && (
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        {unionAcronym && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#1c398e]/10 text-[#1c398e]">
                            {unionAcronym}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]" title={contact.tooltip}>
                          {authorName}
                        </span>
                      </div>
                    )}

                    <h3
                      className={`text-sm font-semibold truncate ${
                        isActive ? 'text-[#1c398e]' : 'text-slate-800'
                      }`}
                    >
                      {displayTitle}
                    </h3>

                    {/* Readiness indicator for draft proposals */}
                    {(!proposal.status || proposal.status === 'draft') && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {(() => {
                          const val = validateProposalForSubmission(proposal);
                          return (
                            <>
                              <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    val.isValid
                                      ? 'bg-emerald-500'
                                      : val.completionPercentage >= 70
                                      ? 'bg-emerald-400'
                                      : 'bg-amber-400'
                                  }`}
                                  style={{ width: `${val.completionPercentage}%` }}
                                />
                              </div>
                              <span
                                className={`text-[10px] font-bold ${
                                  val.isValid ? 'text-emerald-700' : 'text-slate-500'
                                }`}
                              >
                                {val.completionPercentage}%
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 mt-1 font-normal flex items-center gap-2">
                      <span>{formattedDate}</span>
                      {proposal.status && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                            proposal.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : proposal.status === 'under_review'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : proposal.status === 'submitted'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {proposal.status === 'under_review'
                            ? 'Under Review'
                            : proposal.status === 'submitted'
                            ? 'Submitted'
                            : proposal.status === 'approved'
                            ? 'Approved'
                            : 'Draft'}
                        </span>
                      )}
                    </p>

                    {/* Reviewer Feedback Indicator */}
                    {proposal.reviewerNotes && proposal.reviewerNotes.trim() && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50/90 px-2 py-0.5 rounded-md border border-blue-200/70 w-fit">
                        <MessageSquare className="w-3 h-3 text-blue-600 shrink-0" />
                        <span>Reviewer Feedback</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons: on mobile touch devices, clearly visible with comfortable tap area */}
                  <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateProposal(proposal.id, e);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 active:scale-95 transition"
                      title="Duplicate proposal"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProposal(proposal.id, e);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition"
                        title="Delete proposal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mini status footer */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                  <span className="truncate max-w-[150px]">
                    {proposal.strategicFocus
                      ? proposal.strategicFocus.slice(0, 22) + '...'
                      : 'No focus selected'}
                  </span>
                  {proposal.budgetItems && proposal.budgetItems.length > 0 && (
                    <span className="font-semibold text-slate-700">
                      US$
                      {proposal.budgetItems
                        .reduce(
                          (sum, item) =>
                            sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
                          0
                        )
                        .toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>
      </aside>
);
}

