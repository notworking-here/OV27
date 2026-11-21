import React from 'react';
import { X } from 'lucide-react';
import { Proposal, StrategicKpi } from '../../types';
import { UnionIntelligenceBanner } from '../proposal/UnionIntelligenceBanner';

interface UnionMatrixItem {
  unionName: string;
  acronym: string;
  category: string;
  allocated: number;
  matching: number;
  totalPool: number;
  committed: number;
  pipeline?: number;
  remaining: number;
  projectedRemaining?: number;
  utilization: number;
  projectedUtilization?: number;
  projectCount: number;
  approvedCount?: number;
  pipelineCount?: number;
  draftCount?: number;
  status: string;
  proposals: Proposal[];
}

interface KpiAnalyticsItem {
  kpi: StrategicKpi;
  totalBudget: number;
  approvedBudget?: number;
  pipelineBudget?: number;
  projectedBudget?: number;
  projectCount: number;
  approvedCount?: number;
  pipelineCount?: number;
  draftCount?: number;
  proposals: Proposal[];
  actualRatio?: number;
  targetCap?: number;
  isOverCap?: boolean;
  color?: string;
}

interface DrilldownModalsProps {
  activeUnion: UnionMatrixItem | null;
  onCloseUnion: () => void;
  selectedKpi: StrategicKpi | null;
  kpiData: KpiAnalyticsItem | null;
  onCloseKpi: () => void;
  onSelectProposal?: (proposalId: string) => void;
  canOpenProposal?: (proposalId: string) => boolean;
}

export function DrilldownModals({
  activeUnion,
  onCloseUnion,
  selectedKpi,
  kpiData,
  onCloseKpi,
  onSelectProposal,
  canOpenProposal,
}: DrilldownModalsProps) {
  return (
    <>
      {/* Union Drilldown Modal */}
      {activeUnion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#fbfcfd]">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>{activeUnion.unionName}</span>
                  {activeUnion.acronym && (
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-xs font-black">
                      {activeUnion.acronym}
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap tabular-nums">
                  <span>
                    <strong>US${activeUnion.committed.toLocaleString()}</strong> approved ({activeUnion.approvedCount ?? activeUnion.projectCount} projects)
                  </span>
                  <span>•</span>
                  <span>Total Pool: <strong className="text-slate-900">US${activeUnion.totalPool.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>(GC/SSD: <strong>US${activeUnion.allocated.toLocaleString()}</strong> · Union Pledge: <strong className="text-emerald-700">US${activeUnion.matching.toLocaleString()}</strong>)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseUnion}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              <UnionIntelligenceBanner unionName={activeUnion.unionName} compact={true} />
              {activeUnion.proposals.filter((p) => p.status === 'approved').map((prop) => {
                const bSum = (prop.budgetItems || []).reduce(
                  (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
                  0
                );
                return (
                  <div
                    key={prop.id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition bg-white flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {prop.title || 'Untitled Proposal'}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                        <span className="font-semibold text-slate-700">{prop.strategicFocus || 'Strategic Pillar Unassigned'}</span>
                        {Boolean(prop.divisionProject) && (
                          <>
                            <span>•</span>
                            <span className="text-blue-700 font-medium">Goal: {prop.divisionProject}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Approved
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black text-slate-900">
                        US${bSum.toLocaleString()}
                      </span>
                      {onSelectProposal && (!canOpenProposal || canOpenProposal(prop.id)) && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectProposal(prop.id);
                            onCloseUnion();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={onCloseUnion}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Drilldown Modal */}
      {selectedKpi && kpiData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#fbfcfd]">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-xs font-black">
                    Objective {selectedKpi.number}
                  </span>
                  <span>{selectedKpi.title}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  <strong>US${(kpiData.approvedBudget ?? kpiData.totalBudget).toLocaleString()}</strong> approved ({kpiData.approvedCount ?? kpiData.projectCount} projects)
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseKpi}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {kpiData.proposals.filter((p) => p.status === 'approved').map((prop) => {
                const bSum = (prop.budgetItems || []).reduce(
                  (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
                  0
                );
                return (
                  <div
                    key={prop.id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition bg-white flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {prop.title || 'Untitled Proposal'}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                        <span className="font-semibold text-slate-700">{prop.union}</span>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Approved
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black text-slate-900">
                        US${bSum.toLocaleString()}
                      </span>
                      {onSelectProposal && (!canOpenProposal || canOpenProposal(prop.id)) && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectProposal(prop.id);
                            onCloseKpi();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition cursor-pointer"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={onCloseKpi}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
