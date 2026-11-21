import React, { useMemo, useState } from 'react';
import { BudgetItem, Proposal } from '../../types';
import {
  BRIDGING_EVENT_THEMES,
  BRIDGING_HARVEST_CALENDAR,
  BRIDGING_SUCCESS_INDICATORS,
  BridgingThemeId,
  PrioritizedBridgingEvent,
  detectBridgingProposalContext,
  getBridgingGuidanceForUnion,
  getPrioritizedBridgingEvents,
} from '../../data/bridgingEventsGuide';
import {
  Calendar,
  Check,
  CheckCircle2,
  Compass,
  Info,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

export interface BridgingEventsIdeaBuilderProps {
  proposal: Proposal;
  isFormLocked?: boolean;
  onChange: (updated: Partial<Proposal>) => void;
}

function appendBulletUnique(existing: string | undefined, snippet: string): string {
  const current = (existing || '').trim();
  const checkPrefix = snippet.slice(0, 32).toLowerCase();
  if (current.toLowerCase().includes(checkPrefix)) {
    return current;
  }
  return current ? `${current}\n• ${snippet}` : `• ${snippet}`;
}

export function BridgingEventsIdeaBuilder({
  proposal,
  isFormLocked = false,
  onChange,
}: BridgingEventsIdeaBuilderProps) {
  const [selectedTheme, setSelectedTheme] = useState<BridgingThemeId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyStrongFit, setOnlyStrongFit] = useState(false);
  const [onlyRestrictedSafe, setOnlyRestrictedSafe] = useState(false);
  const [referenceView, setReferenceView] = useState<'none' | 'calendar' | 'metrics'>('none');
  const [lastInsertedEventId, setLastInsertedEventId] = useState<string | null>(null);

  const bridgingCtx = useMemo(() => detectBridgingProposalContext(proposal), [proposal]);
  const territoryGuidance = useMemo(
    () => getBridgingGuidanceForUnion(proposal.union),
    [proposal.union]
  );

  const filteredEvents = useMemo(() => {
    const base = getPrioritizedBridgingEvents(proposal.union, selectedTheme, searchQuery);
    return base.filter((ev) => {
      if (onlyStrongFit && territoryGuidance.canonicalUnion && !ev.isCountryStrongFit) {
        return false;
      }
      if (onlyRestrictedSafe && !ev.restrictedAccessSafe) {
        return false;
      }
      return true;
    });
  }, [
    proposal.union,
    selectedTheme,
    searchQuery,
    onlyStrongFit,
    onlyRestrictedSafe,
    territoryGuidance.canonicalUnion,
  ]);

  const themeLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    BRIDGING_EVENT_THEMES.forEach((t) => {
      map[t.id] = `${t.code}. ${t.label}`;
    });
    return map;
  }, []);

  const handleInsertDeliverableOnly = (ev: PrioritizedBridgingEvent) => {
    if (isFormLocked) return;
    const updatedDeliverables = appendBulletUnique(proposal.deliverables, ev.deliverablesSnippet);
    onChange({ deliverables: updatedDeliverables });
    setLastInsertedEventId(`${ev.id}:deliv`);
  };

  const handleInsertFullBlueprint = (ev: PrioritizedBridgingEvent) => {
    if (isFormLocked) return;

    const updatedDeliverables = appendBulletUnique(proposal.deliverables, ev.deliverablesSnippet);
    const updatedOutcomes = appendBulletUnique(proposal.outcomes, ev.outcomesSnippet);
    const updatedIntegration = appendBulletUnique(
      proposal.pointsOfIntegration,
      ev.integrationSnippet
    );

    // Merge budget items without duplicating existing activity names, reusing any trailing blank row
    const existingItems = [...(proposal.budgetItems || [])];
    const existingLower = existingItems.map((b) => (b.activity || '').trim().toLowerCase());

    for (const activityTitle of ev.budgetItems) {
      const normalized = activityTitle.trim().toLowerCase();
      if (existingLower.some((ex) => ex && (ex === normalized || ex.includes(normalized.slice(0, 20))))) {
        continue;
      }
      const blankIdx = existingItems.findIndex(
        (it) => !it.activity?.trim() && (Number(it.divisionFunding ?? it.gcFunding) || 0) === 0
      );
      if (blankIdx >= 0) {
        existingItems[blankIdx] = { ...existingItems[blankIdx], activity: activityTitle };
      } else {
        existingItems.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
          activity: activityTitle,
          divisionFunding: 0,
        } as BudgetItem);
      }
      existingLower.push(normalized);
    }

    onChange({
      deliverables: updatedDeliverables,
      outcomes: updatedOutcomes,
      pointsOfIntegration: updatedIntegration,
      budgetItems: existingItems,
    });
    setLastInsertedEventId(`${ev.id}:full`);
  };

  const handleInsertFunnelMetrics = () => {
    if (isFormLocked) return;
    const snippet =
      '8-Indicator Bridging Funnel: Track Reach (online invites), Response (% attended), 48h 1:1 Bridge Friend Connection (%), 30-day Continuation into a 2nd small-group activity (%), Spiritual Interest, 3- & 6-month Sabbath Belonging, Fruit, and active Bridge Friends.';
    onChange({
      outcomes: appendBulletUnique(proposal.outcomes, snippet),
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden animate-in fade-in">
      {/* Header Strip */}
      <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#1c398e] shrink-0" />
            <h4 className="text-sm font-bold text-slate-900">
              SSD Bridging Events Idea &amp; Pathway Builder
            </h4>
          </div>
          <p className="text-xs text-slate-600">
            From Clicks to Communities — &ldquo;The goal is not an event; it is a relationship.&rdquo; Select an idea to populate Deliverables, Outcomes, Follow-Up, and Budget.
          </p>
        </div>

        {/* Reference Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start lg:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setReferenceView('none')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
              referenceView === 'none'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Event Ideas
          </button>
          <button
            type="button"
            onClick={() => setReferenceView(referenceView === 'calendar' ? 'none' : 'calendar')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
              referenceView === 'calendar'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Harvest Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => setReferenceView(referenceView === 'metrics' ? 'none' : 'metrics')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
              referenceView === 'metrics'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>8 Funnel Indicators</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Territory Guidance & 3-Test Readiness Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
          {/* Territory & Legal Sensitivity Note */}
          <div
            className={`p-3 rounded-xl border space-y-1.5 ${
              territoryGuidance.isRestrictedOrSensitive
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              {territoryGuidance.isRestrictedOrSensitive ? (
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-[#1c398e] shrink-0" />
              )}
              <span>
                Territory Guidance:{' '}
                {territoryGuidance.canonicalUnion
                  ? `${territoryGuidance.countries.join(', ')}`
                  : 'All 11 SSD Countries'}
              </span>
            </div>
            {territoryGuidance.canonicalUnion ? (
              <div className="space-y-1 text-[11px] leading-relaxed">
                {territoryGuidance.guidanceList.slice(0, 2).map((g) => (
                  <p key={g.country}>
                    <strong>{g.country}:</strong> {g.sensitivitiesAndLegalNote}{' '}
                    <span className="text-slate-600">
                      (Strong fits: {g.strongFits.slice(0, 4).join(', ')})
                    </span>
                  </p>
                ))}
                {territoryGuidance.guidanceList.length > 2 && (
                  <p className="text-slate-600">
                    Covers {territoryGuidance.countries.join(', ')} — verify local country fit and
                    never publish guest names, photos, or locations.
                  </p>
                )}
                <p className="font-medium text-slate-700">
                  Privacy Standard: {territoryGuidance.privacyLawsSummary}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Select your Union at the top of the proposal to auto-prioritize country-fit bridging
                events, legal sensitivity notes, and PDPA/DPA opt-in privacy rules.
              </p>
            )}
          </div>

          {/* 3-Test Pathway Readiness Strip */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
            <span className="font-bold text-slate-900 block">
              SSD 3-Test Bridging Pathway Check
            </span>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-700">
                  1. Pre-event 2-hr &ldquo;Welcoming Online Guests&rdquo; training
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 ${
                    bridgingCtx.hasGreeterTraining
                      ? 'text-emerald-700'
                      : !bridgingCtx.shouldCoachGreeterTraining
                      ? 'text-slate-600'
                      : 'text-amber-800'
                  }`}
                >
                  {bridgingCtx.hasGreeterTraining ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Documented
                    </>
                  ) : !bridgingCtx.shouldCoachGreeterTraining ? (
                    'Via Pillar 1 / Host Church'
                  ) : (
                    'Add to Sec 6'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-700">
                  2. Personal 1:1 Bridge Friend &amp; 48h follow-up SLA
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 ${
                    bridgingCtx.hasBridgeFriendOrCoordinator && bridgingCtx.hasFollowUpAnd48h
                      ? 'text-emerald-700'
                      : 'text-amber-800'
                  }`}
                >
                  {bridgingCtx.hasBridgeFriendOrCoordinator && bridgingCtx.hasFollowUpAnd48h ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Documented
                    </>
                  ) : (
                    'Add to Sec 8'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-700">
                  3. No dead-end event (pre-scheduled Next Date / small group)
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 ${
                    bridgingCtx.hasPreScheduledNextStep ? 'text-emerald-700' : 'text-amber-800'
                  }`}
                >
                  {bridgingCtx.hasPreScheduledNextStep ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Documented
                    </>
                  ) : (
                    'Add to Sec 6/8'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Reference Panel: Harvest Calendar or 8 Success Indicators */}
        {referenceView === 'calendar' && (
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-xs font-bold text-slate-900">
                12-Month Integrated Harvest Calendar (Anchored on September Harvest)
              </h5>
              <span className="text-[11px] text-slate-500">
                Adapt for monsoon/typhoon, school terms, and Ramadan
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {BRIDGING_HARVEST_CALENDAR.map((slot) => (
                <div
                  key={slot.months}
                  className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] space-y-0.5"
                >
                  <div className="font-bold text-slate-900 tabular-nums">
                    {slot.months} · <span className="text-[#1c398e]">{slot.phase}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{slot.bridgingFocus}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {referenceView === 'metrics' && (
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 className="text-xs font-bold text-slate-900">
                  8 Bridging Success Indicators (Measure Connection, Not Just Crowd Size)
                </h5>
                <p className="text-[11px] text-slate-600">
                  15 people who each gain a church friend outperform 300 attendees with zero follow-up.
                </p>
              </div>
              {!isFormLocked && (
                <button
                  type="button"
                  onClick={handleInsertFunnelMetrics}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1c398e] hover:bg-blue-900 text-white text-[11px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert 8-Indicator Funnel to Outcomes</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {BRIDGING_SUCCESS_INDICATORS.map((ind) => (
                <div
                  key={ind.number}
                  className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] space-y-0.5"
                >
                  <div className="font-bold text-slate-900 tabular-nums">
                    {ind.number}. {ind.name}
                  </div>
                  <p className="text-slate-600 leading-snug">{ind.question}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 29 bridging events by felt need, ministry, or country..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {territoryGuidance.canonicalUnion && (
                <button
                  type="button"
                  onClick={() => setOnlyStrongFit((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition whitespace-nowrap shrink-0 cursor-pointer ${
                    onlyStrongFit
                      ? 'bg-[#1c398e] text-white border-[#1c398e]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Strong Fit for Union Only
                </button>
              )}
              <button
                type="button"
                onClick={() => setOnlyRestrictedSafe((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition whitespace-nowrap shrink-0 cursor-pointer ${
                  onlyRestrictedSafe
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Restricted-Access Safe
              </button>
            </div>
          </div>

          {/* Theme Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedTheme('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
                selectedTheme === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({BRIDGING_EVENT_THEMES.length > 0 ? 29 : 0})
            </button>
            {BRIDGING_EVENT_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedTheme(theme.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedTheme === theme.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {theme.code}. {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* Locked notice if form is certified/immutable */}
        {isFormLocked && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              This approved proposal is locked. Reopen review to insert new bridging event blueprints.
            </span>
          </div>
        )}

        {/* Event Cards Grid */}
        {filteredEvents.length === 0 ? (
          <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              No bridging events match your current theme or territory filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedTheme('all');
                setSearchQuery('');
                setOnlyStrongFit(false);
                setOnlyRestrictedSafe(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
            {filteredEvents.map((ev) => {
              const alreadyInDeliverables = (proposal.deliverables || '')
                .toLowerCase()
                .includes(ev.deliverablesSnippet.slice(0, 28).toLowerCase());
              const justInsertedFull = lastInsertedEventId === `${ev.id}:full`;
              const justInsertedDeliv = lastInsertedEventId === `${ev.id}:deliv`;

              return (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-3 hover:border-slate-300 transition"
                >
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-600">
                        {themeLabelMap[ev.theme]}
                      </span>
                      {ev.isCountryStrongFit && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#1c398e]">
                            Strong fit for {ev.matchingCountries.join(', ')}
                          </span>
                        </>
                      )}
                      {ev.restrictedAccessSafe && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-medium">
                            Restricted-access safe
                          </span>
                        </>
                      )}
                    </div>

                    <h5 className="text-sm font-bold text-slate-900 leading-snug tabular-nums">
                      {String(ev.number).padStart(2, '0')}. {ev.title}
                    </h5>

                    <div className="space-y-1 text-xs text-slate-600 leading-relaxed">
                      <p>
                        <strong className="text-slate-800">Felt need:</strong> {ev.feltNeed}
                      </p>
                      <p>
                        <strong className="text-slate-800">Bridge from online:</strong>{' '}
                        {ev.bridgeFromOnline}
                      </p>
                      <p>
                        <strong className="text-slate-800">Next step:</strong> {ev.nextStepFollowUp}
                      </p>
                    </div>
                  </div>

                  {!isFormLocked && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleInsertFullBlueprint(ev)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer active:scale-95 ${
                          alreadyInDeliverables || justInsertedFull
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                            : 'bg-[#1c398e] hover:bg-blue-900 text-white'
                        }`}
                        title="Appends Deliverable, Outcome, 48h Follow-Up Integration, and Suggested Budget Line Items"
                      >
                        {alreadyInDeliverables || justInsertedFull ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Blueprint Added</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Insert Full Event Blueprint</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInsertDeliverableOnly(ev)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {justInsertedDeliv ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-700" />
                            <span>Added to Sec 6</span>
                          </>
                        ) : (
                          <span>+ Deliverable Only</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
