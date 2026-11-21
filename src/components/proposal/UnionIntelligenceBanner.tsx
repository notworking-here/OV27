import React, { useState } from 'react';
import {
  getUnionIntelligence,
  UnionIntelligenceProfile,
} from '../../data/unionIntelligence';
import {
  ChevronDown,
  ChevronUp,
  Building2,
  Users,
  Wifi,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface UnionIntelligenceBannerProps {
  unionName?: string;
  defaultExpanded?: boolean;
  compact?: boolean;
}

export const UnionIntelligenceBanner: React.FC<UnionIntelligenceBannerProps> = ({
  unionName,
  defaultExpanded = false,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'overview' | 'digital' | 'people_groups'>('overview');

  const profile: UnionIntelligenceProfile | null = getUnionIntelligence(unionName);
  if (!profile) return null;

  const topThreePlatforms = profile.topPlatformsSummary.slice(0, 3);

  return (
    <div className="rounded-2xl bg-[#f8fafc] border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Compact 1-Line Summary Strip — Full Profile Opens on Demand */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div
          className="flex items-center gap-2 flex-wrap min-w-0 text-xs tabular-nums"
          title={`${profile.canonicalName} · ${profile.membership.toLocaleString()} Members · ${(profile.population / 1_000_000).toFixed(1)}M Population · ${profile.totalPeopleGroupsCount.toLocaleString()} People Groups (${profile.leastReachedGroupsCount.toLocaleString()} Unreached) · Top Channels: ${topThreePlatforms.map((p) => `${p.platform} (${p.reach})`).join(', ')}`}
        >
          <span className="font-extrabold text-[#1c398e]">{profile.acronym}</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-slate-600">
            <strong className="text-slate-800">{profile.churches.toLocaleString()}</strong> Churches
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-slate-600">
            Ratio <strong className="text-slate-800">1:{profile.memberToPopRatio.toLocaleString()}</strong>
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">·</span>
          <span className="text-slate-600 hidden sm:inline">
            <strong className="text-slate-800">{profile.avgInternetPenetrationPct}%</strong> Online
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
              profile.sensitivityLevel === 'Sensitive (Play 7 Required)'
                ? 'text-amber-800'
                : profile.sensitivityLevel === 'Moderated'
                ? 'text-slate-700'
                : 'text-emerald-800'
            }`}
          >
            {profile.isSensitiveTerritory ? (
              <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
            ) : (
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
            )}
            <span>{profile.sensitivityLevel}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 text-[11px] font-bold transition cursor-pointer shrink-0"
        >
          <span>{isExpanded ? 'Hide Territory Profile' : 'Territory Profile'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
        </button>
      </div>

      {/* Expanded Intelligence Panel */}
      {isExpanded && (
        <div className="border-t border-slate-200/80 bg-white p-4 space-y-4">
          {/* Interactive Segmented Control Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'overview'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yearbook &amp; Field Capacity
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('digital')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'digital'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Digital 2026 &amp; Freedom Index
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('people_groups')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'people_groups'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unreached &amp; People Groups ({profile.keyPeopleGroups.length})
              </button>
            </div>

            <span className="text-[11px] text-slate-400">
              Sources: Adventist Yearbook (June 2025) · DataReportal (Mid-2026) · Freedom House · Joshua Project
            </span>
          </div>

          {/* TAB 1: Yearbook & Field Capacity */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* 4 Metric Stat Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Local Churches (KPI 3 Receivers)
                  </span>
                  <span className="text-base font-black text-slate-900 tabular-nums mt-0.5 block">
                    {profile.churches.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    Avg {profile.avgMembersPerChurch.toLocaleString()} members/church
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Church Membership (KPI 5 Base)
                  </span>
                  <span className="text-base font-black text-slate-900 tabular-nums mt-0.5 block">
                    {profile.membership.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    5% mobilized = {Math.round(profile.membership * 0.05).toLocaleString()} members
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    Territory Population (KPI 1 Scope)
                  </span>
                  <span className="text-base font-black text-slate-900 tabular-nums mt-0.5 block">
                    {profile.population.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Countries: {profile.countries.join(', ')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
                  <span className="text-[11px] text-blue-900 font-medium block">
                    Adventist-to-Population Ratio
                  </span>
                  <span className="text-base font-black text-[#1c398e] tabular-nums mt-0.5 block">
                    1 : {profile.memberToPopRatio.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-blue-800">
                    {profile.memberToPopRatio > 1000
                      ? 'Frontier mission density'
                      : profile.memberToPopRatio > 200
                      ? 'Moderate church density'
                      : 'High mobilization base'}
                  </span>
                </div>
              </div>

              {/* Constituent Conferences / Missions & Territory Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#1c398e]" />
                      <span>
                        Constituent Conferences, Missions &amp; Regions (
                        {profile.constituentFields.length})
                      </span>
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {profile.constituentFields.join(' · ')}
                  </p>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 leading-relaxed">
                    <strong className="text-slate-700">Geographic Scope:</strong>{' '}
                    {profile.territoryDescription}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#1c398e]" />
                    <span>Union Headquarters &amp; Official Channels</span>
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    <strong className="text-slate-800">Headquarters:</strong>{' '}
                    {profile.streetAddress}
                  </p>
                  {profile.formerName && (
                    <p className="text-[11px] text-slate-500">
                      <strong className="text-slate-700">Note:</strong> Formerly{' '}
                      {profile.formerName} ({profile.organizedHistory})
                    </p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap pt-1 text-[11px]">
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#1c398e] hover:underline"
                      >
                        <span>Official Website</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {profile.socialLinks.youtube && (
                      <a
                        href={profile.socialLinks.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#1c398e] hover:underline"
                      >
                        <span>YouTube / Hope Channel</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {profile.socialLinks.facebook?.[0] && (
                      <a
                        href={profile.socialLinks.facebook[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#1c398e] hover:underline"
                      >
                        <span>Facebook Page</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Digital 2026 & Freedom Index */}
          {activeTab === 'digital' && (
            <div className="space-y-3">
              {/* Strategic Summary Note */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  profile.isSensitiveTerritory
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {profile.isSensitiveTerritory ? (
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <Wifi className="w-4 h-4 text-[#1c398e] shrink-0 mt-0.5" />
                )}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="space-y-0.5">
                    <span className="font-bold block">
                      {profile.acronym} Digital &amp; Regulatory Context ({profile.sensitivityLevel}):
                    </span>
                    <p className="leading-relaxed text-[11px]">{profile.sensitivitySummary}</p>
                  </div>
                  <div
                    className={`p-2 rounded-lg bg-white/90 border border-l-4 text-[11px] leading-snug ${
                      profile.isSensitiveTerritory
                        ? 'border-amber-200 border-l-amber-600 text-amber-950'
                        : 'border-slate-200 border-l-[#1c398e] text-slate-900'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider mr-1.5 ${
                        profile.isSensitiveTerritory ? 'text-amber-800' : 'text-[#1c398e]'
                      }`}
                    >
                      {profile.isSensitiveTerritory ? 'Required Play 7 Action:' : 'Action Step:'}
                    </span>
                    <span className="font-semibold">
                      {profile.isSensitiveTerritory
                        ? 'Omit public street addresses, worker names, and public RSVP links in Sections 2 & 8; route contacts only to vetted local coordinators via private messaging.'
                        : profile.sensitivityLevel === 'Moderated'
                        ? 'Keep public pages value-focused, collect opt-in consent before transferring contacts, and name local Stage 2 responders in Section 8.'
                        : 'Route public outreach to HopeStartsHere.asia and name the local conference/church team managing 48-hour Stage 2 follow-up in Section 8.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Country-by-Country Breakdown Table/Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.countryProfiles.map((cp) => (
                  <div
                    key={cp.country}
                    className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                      <span className="font-bold text-slate-900 text-sm">{cp.country}</span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 tabular-nums">
                        <span>
                          <strong className="text-slate-900">{cp.internetPenetrationPct}%</strong>{' '}
                          Online
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          <strong className="text-slate-900">{cp.offlinePopulationPct}%</strong>{' '}
                          Offline
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Med. Age <strong className="text-slate-900">{cp.medianAge}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Freedom & Speeds Line */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 tabular-nums">
                      <span>
                        Urban: <strong className="text-slate-800">{cp.urbanPct}%</strong>
                      </span>
                      {cp.mobileSpeedMbps && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Mobile:{' '}
                            <strong className="text-slate-800">{cp.mobileSpeedMbps} Mbps</strong>
                          </span>
                        </>
                      )}
                      {cp.religiousFreedomScore !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Religious Freedom:{' '}
                            <strong
                              className={
                                cp.religiousFreedomScore <= 1
                                  ? 'text-amber-800'
                                  : 'text-emerald-800'
                              }
                            >
                              {cp.religiousFreedomScore}/4
                            </strong>
                          </span>
                        </>
                      )}
                      {cp.netFreedomStatus && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Net Status:{' '}
                            <strong className="text-slate-800">
                              {cp.netFreedomStatus}
                              {cp.netFreedomScore ? ` (${cp.netFreedomScore}/100)` : ''}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Top Social & Messaging Platforms */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Top Reach &amp; Messaging Channels:
                      </span>
                      <div className="divide-y divide-slate-200/60 bg-white rounded-lg border border-slate-200/70 px-2.5 py-1">
                        {cp.topPlatforms.map((plat) => (
                          <div
                            key={plat.platform}
                            className="py-1 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <span className="font-semibold text-slate-800">
                              {plat.platform}
                              {plat.notes && (
                                <span className="font-normal text-slate-500"> — {plat.notes}</span>
                              )}
                            </span>
                            <span className="font-bold text-[#1c398e] tabular-nums shrink-0">
                              {plat.reach}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 border-l-2 border-l-[#1c398e] text-[11px] text-slate-700 leading-snug">
                      <span className="font-extrabold text-[#1c398e] mr-1">Channel Step:</span>
                      <span>{cp.digitalStrategicNote}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Unreached & Least-Reached People Groups */}
          {activeTab === 'people_groups' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total People Groups
                  </span>
                  <span className="text-sm font-black text-slate-900 tabular-nums">
                    {profile.totalPeopleGroupsCount.toLocaleString()} Groups in {profile.acronym}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">
                    Least-Reached / Unreached (JP Scale 1–2)
                  </span>
                  <span className="text-sm font-black text-indigo-900 tabular-nums">
                    {profile.leastReachedGroupsCount.toLocaleString()} Unreached Groups (Target Group E)
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Living Languages ({profile.livingLanguagesCount.toLocaleString()}+ Languages)
                  </span>
                  <span className="text-xs font-bold text-slate-800 leading-snug block mt-0.5">
                    <span className="text-[#1c398e] font-extrabold">Top 5:</span> {profile.primaryLanguagesSummary}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-600">
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Users className="w-3.5 h-3.5 text-[#1c398e]" />
                  <span>
                    Largest Priority Unreached &amp; Frontier People Groups in {profile.acronym}:
                  </span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Use these groups when designing Objective 5 (Mission Intelligence) or Group E
                  initiatives
                </span>
              </div>

              <div className="divide-y divide-slate-200/80 rounded-xl border border-slate-200/90 overflow-hidden bg-white">
                {profile.keyPeopleGroups.map((pg) => (
                  <div
                    key={pg.name}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{pg.name}</span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          {pg.primaryReligion}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[11px] text-slate-500">Lang: {pg.language}</span>
                        {pg.isFrontier && (
                          <>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-[11px] font-bold text-amber-800">
                              Frontier People Group (≤0.1% Christian)
                            </span>
                          </>
                        )}
                      </div>
                      {pg.notes && (
                        <p className="text-[11px] text-slate-600 leading-relaxed">{pg.notes}</p>
                      )}
                    </div>

                    <div className="text-left sm:text-right shrink-0 tabular-nums">
                      <span className="text-xs font-black text-slate-900 block">
                        {pg.population.toLocaleString()} pop.
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {pg.country} · JP Scale {pg.jpScale}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
