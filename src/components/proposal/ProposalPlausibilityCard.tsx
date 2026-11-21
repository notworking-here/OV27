import React, { useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Globe,
  Scale,
  Users,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Proposal } from '../../types';
import {
  evaluateProposalImpactPlausibility,
  PlausibilityVerdict,
} from '../../utils/impactPlausibilityEngine';
import { formatCurrency } from '../../utils/userUtils';

export interface ProposalPlausibilityCardProps {
  proposal: Proposal;
  variant?: 'sidebar' | 'inline';
}

const VERDICT_STYLES: Record<
  PlausibilityVerdict,
  {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    cardBorder: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  plausible: {
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    cardBorder: 'border-slate-200/90',
    icon: CheckCircle2,
  },
  verify_economics: {
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-900',
    badgeBorder: 'border-amber-300',
    cardBorder: 'border-amber-200/90',
    icon: AlertCircle,
  },
  mismatch: {
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-300',
    cardBorder: 'border-rose-200/90',
    icon: AlertTriangle,
  },
};

export const ProposalPlausibilityCard: React.FC<ProposalPlausibilityCardProps> =
  React.memo(({ proposal, variant = 'sidebar' }) => {
    const evalData = useMemo(
      () => evaluateProposalImpactPlausibility(proposal),
      [proposal]
    );

    const style = VERDICT_STYLES[evalData.verdict];
    const VerdictIcon = style.icon;
    const isInline = variant === 'inline';

    const effectiveBudget =
      evalData.divisionBudgetUsd > 0
        ? evalData.divisionBudgetUsd
        : evalData.totalBudgetUsd;

    return (
      <div
        className={`bg-white rounded-2xl border shadow-2xs overflow-hidden ${style.cardBorder}`}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[#fbfcfd] border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-indigo-50 text-[#1c398e] border border-indigo-100 flex items-center justify-center shrink-0">
              <Scale className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-extrabold text-slate-900 tracking-tight truncate">
                Practical Budget, Goal &amp; UPG Check
              </h3>
              <p className="text-[10px] text-slate-500 truncate">
                Cost per person vs. {evalData.unionAcronym} church &amp; population size
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
          >
            <VerdictIcon className="w-3 h-3 shrink-0" />
            <span>{evalData.verdictLabel}</span>
          </span>
        </div>

        {/* Body */}
        <div className="p-3.5 space-y-3 text-xs">
          {/* 2-Column or 3-Column Transparent Math Readout */}
          <div
            className={`grid gap-2 ${
              isInline ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'
            }`}
          >
            {/* Metric 1: Stage Unit Cost */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Cost per Person
                </span>
                {evalData.isAssetOrEnabling && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-indigo-700"
                    title="Includes reusable equipment, media tools, or member training"
                  >
                    <Wrench className="w-2.5 h-2.5" />
                    <span>Tools/Training</span>
                  </span>
                )}
              </div>
              <div className="text-sm font-black text-slate-900 tabular-nums">
                {evalData.costPerOutcomeFormatted}
                {evalData.stageBand && evalData.costPerOutcomeUsd !== null && (
                  <span className="text-[10px] font-semibold text-slate-500 ml-1">
                    / {evalData.stageBand.unitSingular.split(' ')[0]}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 leading-tight truncate">
                {evalData.stageBand
                  ? `Usual: ${evalData.stageBand.bandDisplayLabel}`
                  : `Grant: US$${formatCurrency(effectiveBudget, 0)}`}
              </div>
            </div>

            {/* Metric 2: Union Capacity / Population Scale */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Size in {evalData.unionAcronym}
              </span>
              <div
                className="text-xs font-extrabold text-slate-900 tabular-nums leading-snug truncate"
                title={evalData.territoryScaleDetail}
              >
                {evalData.territoryScaleRatioLabel}
              </div>
              <div className="text-[10px] text-slate-500 leading-tight truncate">
                {evalData.profile
                  ? `${evalData.profile.churches.toLocaleString()} churches · 1:${evalData.profile.memberToPopRatio.toLocaleString()} ratio`
                  : 'Division-wide project'}
              </div>
            </div>

            {/* Metric 3: UPG & Audience Tier */}
            <div
              className={`p-2.5 rounded-xl border space-y-1 ${
                isInline ? '' : 'col-span-2'
              } ${evalData.upgTierMeta.badgeClass}`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1">
                  <Globe className="w-3 h-3 shrink-0" />
                  <span>UPG &amp; Audience Reach</span>
                </span>
                {evalData.profile && (
                  <span className="text-[10px] font-bold opacity-85 tabular-nums">
                    {evalData.profile.leastReachedGroupsCount} UPGs in {evalData.unionAcronym}
                  </span>
                )}
              </div>
              <div className="font-bold text-xs leading-snug">
                {evalData.upgTierMeta.fullLabel}
              </div>
              {evalData.matchedUpgSignals.length > 0 ? (
                <div className="text-[10px] opacity-90 truncate">
                  Found in text: <strong>{evalData.matchedUpgSignals.join(', ')}</strong>
                </div>
              ) : (
                <div className="text-[10px] opacity-85 leading-snug">
                  {evalData.upgTierMeta.description}
                </div>
              )}
            </div>
          </div>

          {/* Transparent Judgment Prompts */}
          <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-slate-200/90 space-y-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e] flex items-center gap-1">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Helpful Questions to Check</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-700 leading-relaxed">
              {evalData.questionsToAsk.map((q, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <Users className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  });
