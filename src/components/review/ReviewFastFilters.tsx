import React from 'react';
import {
  Search,
  Layers,
  ArrowUpDown,
  Send,
  Clock,
  CheckCircle2,
  FileText,
  RotateCcw,
} from 'lucide-react';
import {
  PillarFilterKey,
  PILLAR_FILTER_OPTIONS,
} from '../../types';

interface ReviewFastFiltersProps {
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  statusCounts: {
    all: number;
    submitted: number;
    under_review: number;
    approved: number;
    draft: number;
  };
  selectedUnion: string;
  onUnionChange: (union: string) => void;
  selectedPillar: PillarFilterKey;
  onPillarChange: (pillar: PillarFilterKey) => void;
  isSuperAdmin: boolean;
  userUnion: string;
  isLiaison?: boolean;
  userAssignedUnions?: string[];
  sortBy: 'budget_desc' | 'budget_asc' | 'date_desc' | 'title_asc' | 'completion_desc' | 'completion_asc';
  onSortChange: (sort: 'budget_desc' | 'budget_asc' | 'date_desc' | 'title_asc' | 'completion_desc' | 'completion_asc') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export function ReviewFastFilters({
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  selectedPillar,
  onPillarChange,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  onResetFilters,
  hasActiveFilters,
}: ReviewFastFiltersProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-2.5">
      {/* Row 1: Compact Status Pipeline Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-2 border-b border-slate-100">
        <button
          type="button"
          onClick={() => onStatusFilterChange('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <span>All</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFilter === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {statusCounts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange('submitted')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
            statusFilter === 'submitted'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-blue-50/70 hover:bg-blue-100 text-blue-900'
          }`}
        >
          <Send className="w-3 h-3 shrink-0" />
          <span>Submitted</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFilter === 'submitted'
                ? 'bg-white/25 text-white'
                : 'bg-blue-200/80 text-blue-900'
            }`}
          >
            {statusCounts.submitted}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange('under_review')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
            statusFilter === 'under_review'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'bg-amber-50/70 hover:bg-amber-100 text-amber-900'
          }`}
        >
          <Clock className="w-3 h-3 shrink-0" />
          <span>Review</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFilter === 'under_review'
                ? 'bg-white/25 text-white'
                : 'bg-amber-200/80 text-amber-900'
            }`}
          >
            {statusCounts.under_review}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange('approved')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
            statusFilter === 'approved'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900'
          }`}
        >
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>Approved</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFilter === 'approved'
                ? 'bg-white/25 text-white'
                : 'bg-emerald-200/80 text-emerald-900'
            }`}
          >
            {statusCounts.approved}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange('draft')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 tabular-nums ${
            statusFilter === 'draft'
              ? 'bg-slate-700 text-white shadow-2xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <FileText className="w-3 h-3 shrink-0 text-slate-400" />
          <span>Drafts</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFilter === 'draft'
                ? 'bg-white/25 text-white'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {statusCounts.draft}
          </span>
        </button>
      </div>

      {/* Row 2: Unified Search, Pillar & Compact Sort Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search title, POC, Lead, Union code, pillar, or Action #..."
            className="w-full pl-9 pr-14 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c398e]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Strategic Pillar Dropdown (kept as-is per preference) */}
          <div
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs border transition ${
              selectedPillar !== 'all'
                ? 'bg-blue-50/80 border-blue-300 text-[#1c398e]'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <Layers
              className={`w-3.5 h-3.5 shrink-0 ${
                selectedPillar !== 'all' ? 'text-[#1c398e]' : 'text-slate-400'
              }`}
            />
            <select
              value={selectedPillar}
              onChange={(e) => onPillarChange(e.target.value as PillarFilterKey)}
              title="Filter proposals by Strategic Pillar"
              className="bg-transparent border-none text-xs font-bold focus:outline-none cursor-pointer max-w-[165px] truncate"
            >
              <option value="all">All Pillars</option>
              {PILLAR_FILTER_OPTIONS.map((p) => (
                <option key={p.key} value={p.key} title={p.fullTitle}>
                  {p.shortLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Compact Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any)}
              title="Sort proposals"
              className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="date_desc">Recent</option>
              <option value="completion_desc">Form %: High → Low</option>
              <option value="completion_asc">Form %: Low → High</option>
              <option value="budget_desc">Budget: High → Low</option>
              <option value="budget_asc">Budget: Low → High</option>
              <option value="title_asc">Title A–Z</option>
            </select>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer shrink-0 transition"
              title="Reset all search and filter settings to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
