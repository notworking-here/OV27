import React from 'react';
import { UNION_ACRONYMS } from '../../types';
import { formatCurrency } from '../../utils/userUtils';

interface ReviewMetricsOverviewProps {
  totalRequested: number;
  filteredCount: number;
  selectedUnion: string;
  activeUnionCap: number;
  divisionPortion: number;
  matchingPortion: number;
  capUtilizationPct: number;
  isExceedingCap: boolean;
  hasAllocatedCap: boolean;
  remainingCap: number;
  statusCounts: {
    all: number;
    submitted: number;
    under_review: number;
    approved: number;
    draft: number;
  };
  totalApproved: number;
  totalPipeline?: number;
  projectedRemainingCap?: number;
}

export const ReviewMetricsOverview = React.memo(function ReviewMetricsOverview({
  totalRequested,
  filteredCount,
  selectedUnion,
  activeUnionCap,
  divisionPortion,
  matchingPortion,
  capUtilizationPct,
  isExceedingCap,
  hasAllocatedCap,
  remainingCap,
  totalApproved,
  totalPipeline = 0,
  projectedRemainingCap,
}: ReviewMetricsOverviewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1: Total Requested */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Total Requested
        </span>
        <div className="mt-1.5">
          <p className="text-2xl font-black text-[#1c398e] tracking-tight tabular-nums">
            ${formatCurrency(totalRequested)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {filteredCount} active {filteredCount === 1 ? 'proposal' : 'proposals'}
          </p>
        </div>
      </div>

      {/* Card 2: Union Cap & Utilization */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {selectedUnion === 'all'
            ? 'Division Budget Target'
            : `${UNION_ACRONYMS[selectedUnion] || selectedUnion} Budget Cap`}
        </span>
        <div className="mt-1.5">
          <p className="text-2xl font-black text-slate-800 tracking-tight tabular-nums">
            {hasAllocatedCap ? `$${formatCurrency(activeUnionCap)}` : '$0.00'}
          </p>
          {hasAllocatedCap && (matchingPortion > 0 || divisionPortion > 0) && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate tabular-nums">
              Grant ${formatCurrency(divisionPortion)} · Match ${formatCurrency(matchingPortion)}
            </p>
          )}
          <div className="flex items-center justify-between text-[11px] mt-1 text-slate-600 tabular-nums">
            {hasAllocatedCap ? (
              <>
                <span>{capUtilizationPct.toFixed(1)}% utilized</span>
                <span className={isExceedingCap ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'}>
                  {isExceedingCap ? 'Exceeds Cap' : 'Within Cap'}
                </span>
              </>
            ) : (
              <span className="text-slate-400 italic">No budget cap set in Settings</span>
            )}
          </div>
          {hasAllocatedCap && (
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isExceedingCap
                    ? 'bg-rose-500'
                    : capUtilizationPct > 85
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(capUtilizationPct, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Card 3: Remaining Cap Balance */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Remaining Headroom
        </span>
        <div className="mt-1.5">
          <p
            className={`text-2xl font-black tracking-tight tabular-nums ${
              !hasAllocatedCap
                ? 'text-slate-400'
                : remainingCap >= 0
                ? 'text-emerald-700'
                : 'text-rose-600'
            }`}
          >
            {hasAllocatedCap
              ? remainingCap < 0
                ? `-$${formatCurrency(Math.abs(remainingCap))}`
                : `$${formatCurrency(remainingCap)}`
              : '$0.00'}
          </p>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {hasAllocatedCap && totalPipeline > 0 && projectedRemainingCap !== undefined ? (
              <span className="text-amber-700 font-medium">
                After pipeline: {projectedRemainingCap < 0 ? `-$${formatCurrency(Math.abs(projectedRemainingCap))}` : `$${formatCurrency(projectedRemainingCap)}`}
              </span>
            ) : (
              <span>
                {hasAllocatedCap
                  ? remainingCap >= 0
                    ? 'Available cap balance'
                    : 'Over cap ceiling'
                  : 'Configure in Settings'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card 4: Approved vs Incoming Value */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Committed Value
        </span>
        <div className="mt-1.5">
          <p className="text-2xl font-black text-emerald-700 tracking-tight tabular-nums">
            ${formatCurrency(totalApproved)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {totalPipeline > 0 ? (
              <span>
                Approved · <strong className="text-amber-700">${formatCurrency(totalPipeline)}</strong> in review
              </span>
            ) : (
              <span>Officially approved funding</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
});

