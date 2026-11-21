import React from 'react';
import { Search, Filter, RefreshCw, Share2 } from 'lucide-react';

export type MonitorStatusFilter =
  | 'all'
  | 'needs_action'
  | 'cap_risk'
  | 'healthy'
  | 'no_submissions'
  | 'frontier_ratio'
  | 'play7_sensitive'
  | 'high_offline';

interface MonitorToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (cat: string) => void;
  availableCategories: string[];
  statusFilter: MonitorStatusFilter;
  onStatusFilterChange: (status: MonitorStatusFilter) => void;
  statusCounts: {
    all: number;
    needs_action: number;
    cap_risk: number;
    healthy: number;
    no_submissions: number;
    frontier_ratio: number;
    play7_sensitive: number;
    high_offline: number;
  };
  totalFilteredCount: number;
  totalUnionsCount: number;
  onResetFilters: () => void;
  isFiltered: boolean;
  onShareQuickview?: () => void;
  isStakeholderView?: boolean;
  onForceRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export const MonitorToolbar: React.FC<MonitorToolbarProps> = React.memo(
  ({
    searchQuery,
    onSearchChange,
    categoryFilter,
    onCategoryFilterChange,
    availableCategories,
    statusFilter,
    onStatusFilterChange,
    statusCounts,
    totalFilteredCount,
    totalUnionsCount,
    onResetFilters,
    isFiltered,
    onShareQuickview,
    isStakeholderView = false,
  }) => {
    return (
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search union, country, mission, or people group..."
              aria-label="Search unions"
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap justify-between md:justify-end">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => onCategoryFilterChange('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                All Types ({totalUnionsCount})
              </button>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => onCategoryFilterChange(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Share Quickview Button */}
            {!isStakeholderView && onShareQuickview && (
              <button
                onClick={onShareQuickview}
                className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-hidden"
                title="Generate and copy public quickview link for stakeholders"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Quickview</span>
              </button>
            )}
          </div>
        </div>

        {/* Status & Field Intelligence segmented filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>

            <button
              onClick={() => onStatusFilterChange('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({statusCounts.all})
            </button>

            <button
              onClick={() => onStatusFilterChange('needs_action')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'needs_action'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Action Needed ({statusCounts.needs_action})
            </button>

            <button
              onClick={() => onStatusFilterChange('cap_risk')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'cap_risk'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cap Risk ({statusCounts.cap_risk})
            </button>

            <button
              onClick={() => onStatusFilterChange('healthy')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'healthy'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Healthy ({statusCounts.healthy})
            </button>

            <button
              onClick={() => onStatusFilterChange('no_submissions')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'no_submissions'
                  ? 'bg-slate-200 text-slate-800 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              No Proposals ({statusCounts.no_submissions})
            </button>

            <span className="text-slate-300 mx-0.5">|</span>

            <button
              onClick={() => onStatusFilterChange('frontier_ratio')}
              title="Territories where 1 Adventist faces >1,000 people (SEUM, CIUM, MyUM, WiUM)"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'frontier_ratio'
                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-300 font-bold'
                  : 'text-slate-600 hover:text-indigo-800'
              }`}
            >
              Frontier &gt;1:1k ({statusCounts.frontier_ratio})
            </button>

            <button
              onClick={() => onStatusFilterChange('play7_sensitive')}
              title="Territories requiring discrete seeker contact routing (Playbook Play 7)"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'play7_sensitive'
                  ? 'bg-rose-50 text-rose-900 border border-rose-300 font-bold'
                  : 'text-slate-600 hover:text-rose-800'
              }`}
            >
              Play 7 Sensitive ({statusCounts.play7_sensitive})
            </button>

            <button
              onClick={() => onStatusFilterChange('high_offline')}
              title="Territories with significant offline populations requiring hybrid/radio/print outreach"
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'high_offline'
                  ? 'bg-amber-50 text-amber-900 border border-amber-300 font-bold'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
            >
              High Offline ({statusCounts.high_offline})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isFiltered && (
              <button
                onClick={onResetFilters}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            )}
            <span className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{totalFilteredCount}</span> of{' '}
              {totalUnionsCount} territories
            </span>
          </div>
        </div>
      </div>
    );
  }
);
