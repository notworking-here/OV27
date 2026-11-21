import React, { useState, useEffect, useMemo } from 'react';
import { Proposal, getCanonicalUnion } from '../../types';
import {
  computeAllProposalsFundingAttribution,
  formatAttributionPct,
  getProposalApprovedBudget,
} from '../../utils/fundingAttribution';
import { fetchBudgetAllocationDetails } from '../../services/proposalService';
import { formatCurrency } from '../../utils/userUtils';

export interface ProposalShareBreakdownCardProps {
  proposal: Proposal;
  allProposals?: Proposal[];
}

export function ProposalShareBreakdownCard({
  proposal,
  allProposals = [],
}: ProposalShareBreakdownCardProps) {
  const [allocations, setAllocations] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('onevoice27_budget_allocations');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [matchingPledges, setMatchingPledges] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('onevoice27_matching_pledges');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    let mounted = true;
    fetchBudgetAllocationDetails()
      .then(({ allocations: fetchedAlloc, matchingPledges: fetchedMatch }) => {
        if (!mounted) return;
        setAllocations(fetchedAlloc);
        setMatchingPledges(fetchedMatch);
      })
      .catch(() => {
        // Keep cached pool allocations when offline
      });
    return () => {
      mounted = false;
    };
  }, []);

  const isApproved =
    proposal.status === 'approved' || Boolean(proposal.unionApproval?.actionNumber);
  const proposalTotal = getProposalApprovedBudget(proposal);

  const { attribution, unionSummary } = useMemo(() => {
    if (proposalTotal <= 0) {
      return { attribution: undefined, unionSummary: undefined };
    }

    const baseList = allProposals.length > 0 ? allProposals : [proposal];
    const hasCurrent = baseList.some((p) => p.id === proposal.id);
    const normalizedList = hasCurrent
      ? baseList.map((p) => (p.id === proposal.id ? proposal : p))
      : [...baseList, proposal];

    const effectiveList: Proposal[] = isApproved
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
      allocations,
      matchingPledges
    );
    const canonUnion = getCanonicalUnion(proposal.union) || proposal.union;

    return {
      attribution: computed.byProposalId[proposal.id],
      unionSummary: canonUnion ? computed.byUnion[canonUnion] : undefined,
    };
  }, [proposal, allProposals, allocations, matchingPledges, isApproved, proposalTotal]);

  if (!attribution || attribution.proposalTotal <= 0) {
    return null;
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-extrabold tracking-wide text-[#1c398e] block">
            {isApproved
              ? '100% Proposal Share Breakdown · Pool Formula Attribution'
              : 'Projected Share Breakdown · Pool Formula Preview'}
          </span>
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
            Contributing Entities for US${formatCurrency(attribution.proposalTotal)} (100%)
          </h4>
        </div>

        {attribution.poolStatus === 'pool_depleted' ? (
          <span className="px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-[11px] font-bold whitespace-nowrap shrink-0 self-start sm:self-center">
            Pool Depleted · 100% Union Deficit
          </span>
        ) : attribution.poolStatus === 'partial_deficit' ? (
          <span className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 self-start sm:self-center">
            Partial Pool Depletion (+${formatCurrency(attribution.overPoolDeficitAmount)} Union Deficit)
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 self-start sm:self-center">
            Within Union Pool
            {unionSummary ? ` (Rem: $${formatCurrency(unionSummary.poolRemainingAmount)})` : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* GC Share */}
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-900">
              GC Share
            </span>
            <span className="text-[11px] font-black text-amber-800 tabular-nums">
              {formatAttributionPct(attribution.gcPct)}
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-amber-950 mt-1 tabular-nums">
            ${formatCurrency(attribution.gcAmount)}
          </div>
        </div>

        {/* SSD Share */}
        <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/90">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#1c398e]">
              SSD Share
            </span>
            <span className="text-[11px] font-black text-blue-800 tabular-nums">
              {formatAttributionPct(attribution.ssdPct)}
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-[#1c398e] mt-1 tabular-nums">
            ${formatCurrency(attribution.ssdAmount)}
          </div>
        </div>

        {/* SPD Share */}
        <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200/90">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-purple-900">
              SPD Share
            </span>
            <span className="text-[11px] font-black text-purple-800 tabular-nums">
              {formatAttributionPct(attribution.spdPct)}
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-purple-950 mt-1 tabular-nums">
            ${formatCurrency(attribution.spdAmount)}
          </div>
        </div>

        {/* Union Share */}
        <div
          className={`p-3 rounded-xl border ${
            attribution.overPoolDeficitAmount > 0
              ? 'bg-rose-50 border-rose-300'
              : 'bg-emerald-50/80 border-emerald-200/90'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wide ${
                attribution.overPoolDeficitAmount > 0 ? 'text-rose-900' : 'text-emerald-900'
              }`}
            >
              Union Share
            </span>
            <span
              className={`text-[11px] font-black tabular-nums ${
                attribution.overPoolDeficitAmount > 0 ? 'text-rose-800' : 'text-emerald-800'
              }`}
            >
              {formatAttributionPct(attribution.unionPct)}
            </span>
          </div>
          <div
            className={`text-sm sm:text-base font-black mt-1 tabular-nums ${
              attribution.overPoolDeficitAmount > 0 ? 'text-rose-950' : 'text-emerald-950'
            }`}
          >
            ${formatCurrency(attribution.unionAmount)}
          </div>
          {attribution.overPoolDeficitAmount > 0 && (
            <div className="text-[10px] text-rose-800 font-semibold mt-1 leading-tight tabular-nums">
              Pool: ${formatCurrency(attribution.unionFromPoolAmount)} + Deficit: $
              {formatCurrency(attribution.overPoolDeficitAmount)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
