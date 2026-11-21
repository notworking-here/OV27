import React, { useMemo } from 'react';
import {
  Users,
  Globe,
  Tag,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Proposal } from '../../types';
import { calculateAudienceInvestment, SingleAudienceBreakdown } from '../../utils/audienceInvestment';
import { formatMetricCount } from '../../utils/kpiExtraction';
import { formatCurrency } from '../../utils/userUtils';
import {
  getUnionIntelligence,
  UNION_INTELLIGENCE_PROFILES,
  SSD_DIVISION_YEARBOOK_TOTALS,
} from '../../data/unionIntelligence';

interface UnionAudienceTagsBoxProps {
  proposals: Proposal[];
  scopeName?: string;
  selectedUnion?: string;
}

const AUDIENCE_SHORT_NAMES: Record<string, { short: string; desc: string }> = {
  A1: {
    short: 'Missional Adventists',
    desc: 'Active lay members mobilizing for evangelism',
  },
  A2: {
    short: 'Church Leadership & Pastors',
    desc: 'Pastors, elders, and ministry professionals',
  },
  A3: {
    short: 'Children, Youth & Young Adults',
    desc: 'Campuses, schools, academies & young professionals',
  },
  A4: {
    short: 'Entities & Governance',
    desc: 'Division, Union & Conference department teams',
  },
  B: {
    short: 'Baptized Inactive Members',
    desc: 'Church members not actively engaged in mission',
  },
  C: {
    short: 'Interested Seekers & Inquirers',
    desc: 'People actively investigating church teachings',
  },
  D: {
    short: 'Non-SDA Christians',
    desc: 'Believers from other Christian denominations',
  },
  E: {
    short: 'Secular & World Religions',
    desc: 'Non-religious, post-Christian, and other world faiths',
  },
};

export const UnionAudienceTagsBox: React.FC<UnionAudienceTagsBoxProps> = React.memo(
  ({ proposals, scopeName, selectedUnion }) => {
    const analysis = useMemo(() => calculateAudienceInvestment(proposals), [proposals]);

    const abcTags = useMemo(
      () => analysis.breakdownByAudience.filter((item) => item.group === 'ABC'),
      [analysis]
    );

    const deTags = useMemo(
      () => analysis.breakdownByAudience.filter((item) => item.group === 'DE'),
      [analysis]
    );

    // Territory Yearbook & People Group Intelligence for active scope
    const territoryIntel = useMemo(() => {
      if (selectedUnion && selectedUnion !== 'all') {
        const prof = getUnionIntelligence(selectedUnion);
        if (prof) {
          return {
            acronym: prof.acronym,
            churches: prof.churches,
            membership: prof.membership,
            population: prof.population,
            ratio: prof.memberToPopRatio,
            leastReachedCount: prof.keyPeopleGroups.filter((g) => g.jpScale <= 2).length,
            priorityGroups: prof.keyPeopleGroups.slice(0, 4),
          };
        }
      }
      // Division-wide top frontier unreached people groups
      const topDivisionGroups = Object.values(UNION_INTELLIGENCE_PROFILES)
        .flatMap((p) => p.keyPeopleGroups)
        .filter((g) => g.isFrontier || g.jpScale <= 2)
        .sort((a, b) => b.population - a.population)
        .slice(0, 5);

      return {
        acronym: 'SSD Total',
        churches: SSD_DIVISION_YEARBOOK_TOTALS.churches,
        membership: SSD_DIVISION_YEARBOOK_TOTALS.membership,
        population: SSD_DIVISION_YEARBOOK_TOTALS.population,
        ratio: SSD_DIVISION_YEARBOOK_TOTALS.memberToPopRatio,
        leastReachedCount: undefined,
        priorityGroups: topDivisionGroups,
      };
    }, [selectedUnion]);

    // Check for demographic gaps (audiences with 0 proposals)
    const unaddressedCount = analysis.breakdownByAudience.filter(
      (item) => item.proposalCount === 0
    ).length;

    const equippedShareOfMembersPct =
      territoryIntel.membership > 0 && analysis.internalBeneficiaries.approvedTargetCount > 0
        ? Math.round(
            (analysis.internalBeneficiaries.approvedTargetCount / territoryIntel.membership) * 1000
          ) / 10
        : null;

    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-5">
        {/* Box Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
                <Tag className="w-3.5 h-3.5 text-[#1c398e]" />
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Audience Tags & Demographic Investment
              </h3>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                {scopeName || 'Territory View'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Stand-alone demographic allocation breakdown across all 8 OneVoice target audience categories (A1–E), benchmarked against Yearbook membership &amp; Joshua Project unreached people groups.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {unaddressedCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>{unaddressedCount} unaddressed demographics</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All 8 demographics engaged</span>
              </span>
            )}
          </div>
        </div>

        {/* Two-Sided Standalone Visual Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Panel: Internal Church Beneficiaries (A1 - A4, B) */}
          <div className="lg:col-span-7 bg-[#fafafa] p-4.5 rounded-2xl border border-purple-200/80 space-y-3.5 flex flex-col justify-between">
            <div>
              {/* Panel Header */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-purple-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Church Beneficiaries & Equipping (Groups A & B)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Member mobilization, leadership training, youth engagement & inactive member reclamation
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-purple-900 block tabular-nums">
                    US${formatCurrency(analysis.internalBeneficiaries.approvedBudget)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {analysis.internalBeneficiaries.sharePct}% of funds
                  </span>
                </div>
              </div>

              {/* 6 Demographic Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
                {abcTags.map((item) => {
                  const meta = AUDIENCE_SHORT_NAMES[item.id] || {
                    short: item.label,
                    desc: item.label,
                  };
                  const hasProjects = item.proposalCount > 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all ${
                        hasProjects
                          ? 'bg-white border-slate-200/90 shadow-2xs hover:border-purple-300'
                          : 'bg-white/60 border-dashed border-slate-200 text-slate-400 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                              hasProjects
                                ? 'bg-purple-100 text-purple-900'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {item.id}
                          </span>
                          <span
                            className={`text-xs font-bold truncate ${
                              hasProjects ? 'text-slate-900' : 'text-slate-500'
                            }`}
                            title={meta.short}
                          >
                            {meta.short}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums ${
                            hasProjects
                              ? 'bg-purple-50 text-purple-800 border border-purple-200'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {item.proposalCount} proj
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1" title={meta.desc}>
                        {meta.desc}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] tabular-nums">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Budget</span>
                          <strong
                            className={hasProjects ? 'text-slate-800 font-extrabold' : 'text-slate-400'}
                          >
                            US${formatCurrency(item.approvedBudget)}
                          </strong>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-semibold">Target</span>
                          <span
                            className={hasProjects ? 'text-blue-900 font-bold' : 'text-slate-400'}
                          >
                            {hasProjects ? formatMetricCount(item.targetCount) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2.5 border-t border-purple-100/70 space-y-1.5">
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>Total Equipped / Mobilized Target:</span>
                <strong className="text-purple-900 font-extrabold tabular-nums">
                  {formatMetricCount(analysis.internalBeneficiaries.approvedTargetCount)} leaders &amp; members
                  {equippedShareOfMembersPct !== null && (
                    <span className="ml-1 text-[10px] text-purple-700 font-bold">
                      ({equippedShareOfMembersPct}% of members)
                    </span>
                  )}
                </strong>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-white border border-purple-200/70 flex items-center justify-between text-[10px] text-slate-600 tabular-nums">
                <span>
                  <strong className="text-slate-800">{territoryIntel.acronym} Yearbook Base:</strong>{' '}
                  {territoryIntel.churches.toLocaleString()} Churches ·{' '}
                  {territoryIntel.membership.toLocaleString()} Members
                </span>
                <span className="font-bold text-purple-800">
                  1:{territoryIntel.ratio.toLocaleString()} Ratio
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel: Frontline Public Outreach (C, D & E) */}
          <div className="lg:col-span-5 bg-[#fafafa] p-4.5 rounded-2xl border border-blue-200/80 space-y-3.5 flex flex-col justify-between">
            <div>
              {/* Panel Header */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-blue-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Frontline Public Outreach (Groups C, D & E)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Interested Seekers, Non-Adventist Christians, Secular & World Religions
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-blue-900 block tabular-nums">
                    US${formatCurrency(analysis.outreachAudience.approvedBudget)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {analysis.outreachAudience.sharePct}% of funds
                  </span>
                </div>
              </div>

              {/* 2 Big Outreach Demographic Cards */}
              <div className="space-y-3 pt-3">
                {deTags.map((item) => {
                  const meta = AUDIENCE_SHORT_NAMES[item.id] || {
                    short: item.label,
                    desc: item.label,
                  };
                  const hasProjects = item.proposalCount > 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        hasProjects
                          ? 'bg-white border-blue-200 shadow-2xs hover:border-blue-300'
                          : 'bg-white/60 border-dashed border-slate-200 text-slate-400 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black shrink-0 ${
                              hasProjects
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {item.id}
                          </span>
                          <div>
                            <span
                              className={`text-xs font-black block leading-snug ${
                                hasProjects ? 'text-slate-900' : 'text-slate-500'
                              }`}
                            >
                              {meta.short}
                            </span>
                            <span className="text-[10px] text-slate-500 block">{meta.desc}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums ${
                            hasProjects
                              ? 'bg-blue-50 text-blue-900 border border-blue-200'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {item.proposalCount} proj
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] tabular-nums">
                        <div className="p-2 rounded-lg bg-slate-50">
                          <span className="text-[10px] text-slate-400 block font-semibold">Committed</span>
                          <strong
                            className={
                              hasProjects ? 'text-slate-900 font-extrabold text-xs' : 'text-slate-400 text-xs'
                            }
                          >
                            US${formatCurrency(item.approvedBudget)}
                          </strong>
                        </div>

                        <div className="p-2 rounded-lg bg-slate-50 text-right">
                          <span className="text-[10px] text-slate-400 block font-semibold">Target Reach</span>
                          <span
                            className={
                              hasProjects ? 'text-blue-900 font-black text-xs' : 'text-slate-400 text-xs'
                            }
                          >
                            {hasProjects ? formatMetricCount(item.targetCount) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Joshua Project Priority Unreached People Groups Strip */}
              {territoryIntel.priorityGroups.length > 0 && (
                <div className="mt-3 p-2.5 rounded-xl bg-white border border-blue-200/80 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-extrabold uppercase tracking-wider text-[#1c398e]">
                      {territoryIntel.acronym} Priority Unreached Groups (Group E)
                    </span>
                    {territoryIntel.leastReachedCount !== undefined && (
                      <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 tabular-nums">
                        {territoryIntel.leastReachedCount} least-reached
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {territoryIntel.priorityGroups.map((pg) => (
                      <span
                        key={`${pg.country}-${pg.name}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[10px] text-slate-700 tabular-nums"
                        title={`${pg.name} (${pg.country}) — ${pg.primaryReligion}, Language: ${pg.language}`}
                      >
                        <strong className="text-slate-900">{pg.name}</strong>
                        <span className="text-slate-500">
                          ({(pg.population / 1_000_000).toFixed(1)}M · {pg.primaryReligion})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-blue-100/70 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Total Public Outreach Reach:</span>
              <strong className="text-blue-900 font-extrabold tabular-nums">
                {formatMetricCount(analysis.outreachAudience.approvedTargetCount)} people
              </strong>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
