import React from 'react';
import { PieChart, AlertCircle } from 'lucide-react';
import { PILLAR_META, TerritoryTotals } from '../../utils/monitorAnalytics';

interface MonitorStrategicPillarsProps {
  territoryTotals: TerritoryTotals;
  pillarPercentages: [number, number, number];
}

export const MonitorStrategicPillars: React.FC<MonitorStrategicPillarsProps> = React.memo(
  ({ territoryTotals, pillarPercentages }) => {
    return (
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-600" />
              <span>Division Strategic Pillars Overview</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified distribution of committed budgets and pending requests against Division benchmark targets.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 self-start sm:self-center">
            Pillars 1 · 2 · 3
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {PILLAR_META.map((meta, idx) => {
            const approvedUsd = territoryTotals.divisionPillarsApproved[idx];
            const pendingUsd = territoryTotals.divisionPillarsPending[idx];
            const targetCapPct = pillarPercentages[idx] ?? (idx === 0 ? 12.5 : idx === 1 ? 58.5 : 29.0);
            const divisionPillarCap = Math.round((territoryTotals.totalCapPool * targetCapPct) / 100);

            const approvedRatio =
              territoryTotals.totalApprovedBudget > 0
                ? (approvedUsd / territoryTotals.totalApprovedBudget) * 100
                : 0;

            const totalPillarRequested = approvedUsd + pendingUsd;
            const isPillarOverCap =
              territoryTotals.totalCapPool > 0 && totalPillarRequested > divisionPillarCap;

            return (
              <div
                key={meta.number}
                className={`p-3.5 rounded-xl border ${meta.border} ${meta.bg}/40 flex flex-col justify-between space-y-2`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <span className="text-xs font-black text-slate-900 truncate">
                        Pillar {meta.number}: {meta.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5" title={meta.fullName}>
                      {meta.fullName}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 tabular-nums ${
                      isPillarOverCap
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-white/90 border-slate-200 text-slate-700'
                    }`}
                    title={`Division Benchmark: ${targetCapPct}% of total pool`}
                  >
                    Cap: {targetCapPct}% · US${divisionPillarCap.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Approved:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      US${approvedUsd.toLocaleString()}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({approvedRatio.toFixed(1)}%)
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Pending:</span>
                    <span className="font-semibold text-amber-800 tabular-nums">
                      US${pendingUsd.toLocaleString()}
                    </span>
                  </div>

                  {/* Progress vs Benchmark */}
                  <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isPillarOverCap ? 'bg-rose-500' : meta.text.replace('text-', 'bg-')
                      }`}
                      style={{
                        width: `${
                          divisionPillarCap > 0
                            ? Math.min((approvedUsd / divisionPillarCap) * 100, 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {isPillarOverCap && (
                  <div className="flex items-center gap-1.5 text-[10px] text-rose-700 font-bold bg-rose-50/90 px-2 py-1 rounded border border-rose-200 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      Approved + pending exceeds {targetCapPct}% cap by US$
                      {(totalPillarRequested - divisionPillarCap).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
