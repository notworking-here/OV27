import React, { useState, useMemo } from 'react';
import {
  Globe,
  Users,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Proposal } from '../../types';
import { calculateAudienceInvestment, AudienceInvestmentAnalysis } from '../../utils/audienceInvestment';
import { formatMetricCount } from '../../utils/kpiExtraction';
import { formatCurrency } from '../../utils/userUtils';

interface AudienceInvestmentCardProps {
  proposals?: Proposal[];
  precomputedAnalysis?: AudienceInvestmentAnalysis;
  title?: string;
  subtitle?: string;
  approvedOnly?: boolean;
}

export const AudienceInvestmentCard: React.FC<AudienceInvestmentCardProps> = React.memo(
  ({
    proposals = [],
    precomputedAnalysis,
    title = 'Missional Investment & Cost Efficiency',
    subtitle = 'Strategic capital allocation and estimated cost per person: Frontline Outreach (C–D–E) vs. Church Beneficiaries & Equipping (A–B)',
    approvedOnly = false,
  }) => {
    const [viewMode, setViewMode] = useState<'approved' | 'projected'>('approved');

    const analysis = useMemo(() => {
      if (precomputedAnalysis) return precomputedAnalysis;
      return calculateAudienceInvestment(proposals);
    }, [precomputedAnalysis, proposals]);

    const isApprovedView = approvedOnly || viewMode === 'approved';

    const internalBeneficiaries = analysis?.internalBeneficiaries || {
      approvedBudget: 0,
      pipelineBudget: 0,
      totalBudget: 0,
      approvedTargetCount: 0,
      pipelineTargetCount: 0,
      totalTargetCount: 0,
      proposalCount: 0,
      approvedCostPerPerson: null,
      totalCostPerPerson: null,
      sharePct: 50,
    };

    const outreachAudience = analysis?.outreachAudience || {
      approvedBudget: 0,
      pipelineBudget: 0,
      totalBudget: 0,
      approvedTargetCount: 0,
      pipelineTargetCount: 0,
      totalTargetCount: 0,
      proposalCount: 0,
      approvedCostPerPerson: null,
      totalCostPerPerson: null,
      sharePct: 50,
    };

    // Current metrics based on toggle
    const abcBudget = isApprovedView
      ? internalBeneficiaries.approvedBudget
      : internalBeneficiaries.totalBudget;

    const deBudget = isApprovedView
      ? outreachAudience.approvedBudget
      : outreachAudience.totalBudget;

    const totalBudget = abcBudget + deBudget;

    const abcShare = totalBudget > 0 ? Math.round((abcBudget / totalBudget) * 100) : 50;
    const deShare = 100 - abcShare;

    const abcTargets = isApprovedView
      ? internalBeneficiaries.approvedTargetCount
      : internalBeneficiaries.totalTargetCount;

    const deTargets = isApprovedView
      ? outreachAudience.approvedTargetCount
      : outreachAudience.totalTargetCount;

    const abcCost = isApprovedView
      ? internalBeneficiaries.approvedCostPerPerson
      : internalBeneficiaries.totalCostPerPerson;

    const deCost = isApprovedView
      ? outreachAudience.approvedCostPerPerson
      : outreachAudience.totalCostPerPerson;

    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                <Globe className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{subtitle}</p>
          </div>

          {/* Toggle: Approved vs. Total Projected (hidden when approvedOnly is true) */}
          {!approvedOnly && (
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl text-xs font-semibold self-start sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('approved')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  isApprovedView
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Approved Only</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('projected')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  !isApprovedView
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Approved + Pipeline</span>
              </button>
            </div>
          )}
        </div>

        {/* Visual Allocation Split Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="text-slate-800">
                Frontline Outreach (C–D–E): <strong className="text-blue-700">{deShare}%</strong>
              </span>
              <span className="text-slate-400 font-medium tabular-nums">
                (US${formatCurrency(deBudget)})
              </span>
            </div>

            <div className="flex items-center gap-2 text-right">
              <span className="text-slate-400 font-medium tabular-nums">
                (US${formatCurrency(abcBudget)})
              </span>
              <span className="text-slate-800">
                Church Beneficiaries (A–B): <strong className="text-purple-700">{abcShare}%</strong>
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
            </div>
          </div>

          {/* Segmented Dual Bar */}
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${deShare}%` }}
              title={`Frontline Outreach (C–D–E): ${deShare}% (US$${formatCurrency(deBudget)})`}
            />
            <div
              className="h-full bg-purple-600 transition-all duration-300"
              style={{ width: `${abcShare}%` }}
              title={`Church Beneficiaries (A–B): ${abcShare}% (US$${formatCurrency(abcBudget)})`}
            />
          </div>
        </div>

        {/* 2 Comparative Unit Economics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Frontline Public Outreach (C - D - E) */}
          <div className="p-4 rounded-xl border border-blue-200/90 bg-blue-50/30 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-blue-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Frontline Public Outreach (Groups C, D & E)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Interested Seekers, Non-Adventist Christians, Secular & World Religions
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md tabular-nums">
                  {deShare}% share
                </span>
              </div>

              {/* Cost Per Person Hero Metric */}
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Est. Cost Per Outreach Contact
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-blue-900 tracking-tight tabular-nums">
                    {deCost !== null ? `US$${deCost < 1 ? deCost.toFixed(2) : deCost.toFixed(2)}` : '—'}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">/ person reached</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Seekers, Bible study enrollments, digital impressions, broadcasts & public inquiries
                </p>
              </div>

              {/* Sub-Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Invested</span>
                  <span className="text-sm font-black text-slate-900 tabular-nums">
                    US${formatCurrency(deBudget)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {outreachAudience.proposalCount} proposals tagged
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold">Target Outreach</span>
                  <span className="text-sm font-black text-slate-900 tabular-nums">
                    {formatMetricCount(deTargets)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">people to be reached</span>
                </div>
              </div>
            </div>

            {/* Bottom details note */}
            <div className="pt-2 border-t border-blue-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Audience C (Seekers), D (Christian) & E (Secular / Other)</span>
              <span className="font-semibold text-blue-800">Public Frontline</span>
            </div>
          </div>

          {/* Card 2: Internal Beneficiaries (A - B) */}
          <div className="p-4 rounded-xl border border-purple-200/90 bg-purple-50/30 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-purple-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Church Beneficiaries & Equipping (Groups A & B)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Missional Adventists, Leaders, Youth & Inactive Members
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md tabular-nums">
                  {abcShare}% share
                </span>
              </div>

              {/* Cost Per Person Hero Metric */}
              <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Est. Cost Per Member Equipped / Mobilized
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-purple-900 tracking-tight tabular-nums">
                    {abcCost !== null ? `US$${abcCost.toFixed(2)}` : '—'}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">/ member equipped</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Trained creators, youth disciples, re-engaged members & church leaders
                </p>
              </div>

              {/* Sub-Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Invested</span>
                  <span className="text-sm font-black text-slate-900 tabular-nums">
                    US${formatCurrency(abcBudget)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {internalBeneficiaries.proposalCount} proposals tagged
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <span className="text-[10px] text-slate-400 block font-semibold">Trained & Mobilized</span>
                  <span className="text-sm font-black text-slate-900 tabular-nums">
                    {formatMetricCount(abcTargets)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">leaders & members</span>
                </div>
              </div>
            </div>

            {/* Bottom details note */}
            <div className="pt-2 border-t border-purple-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Audience A1–A4 (Active & Leadership) & B (Inactive Members)</span>
              <span className="font-semibold text-purple-800">Capacity Building</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
