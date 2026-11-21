import { useState, useMemo } from 'react';
import { BudgetItem, Proposal, getCanonicalDivisionProject } from '../../types';
import {
  getSmartBudgetSuggestions,
  getSectionAlignmentAdvisories,
  SmartAdvisoryItem,
} from '../../utils/proposalSmartAdvisor';
import { ApprovedProposalIntelligence } from '../../utils/approvedProposalIntelligence';
import { ProposalShareBreakdownCard } from './ProposalShareBreakdownCard';
import {
  SectionAlignmentCallout,
  getFlaggedSectionClass,
} from './SectionAlignmentCallout';
import { getSectionLiaisonActionItems } from '../../utils/projectReviewFramework';
import { Plus, X, AlertTriangle, Tag, Lock, CheckCircle2, Layers, ChevronDown, ChevronUp } from 'lucide-react';

export interface ProposalBudgetSectionProps {
  budgetItems: BudgetItem[];
  proposal?: Proposal;
  allProposals?: Proposal[];
  showShareBreakdown?: boolean;
  approvedIntelligence?: ApprovedProposalIntelligence | null;
  isFormLocked?: boolean;
  onChange: (items: BudgetItem[]) => void;
  onExecuteQuickAction?: (item: SmartAdvisoryItem) => void;
  onOpenFaqTopic?: (topic: string) => void;
}

export function ProposalBudgetSection({
  budgetItems,
  proposal,
  allProposals,
  showShareBreakdown = false,
  approvedIntelligence,
  isFormLocked = false,
  onChange,
  onExecuteQuickAction,
  onOpenFaqTopic,
}: ProposalBudgetSectionProps) {
  const items = budgetItems || [];
  const [showSuggestedBudgetTags, setShowSuggestedBudgetTags] = useState(false);

  const handleAddBudgetItem = (presetActivity: string = '') => {
    if (isFormLocked) return;
    // If there is already a completely blank row at the end and a preset activity was clicked, populate that row
    if (presetActivity && items.length > 0) {
      const lastIdx = items.length - 1;
      const lastItem = items[lastIdx];
      const lastAmount = Number(lastItem.divisionFunding ?? lastItem.gcFunding) || 0;
      if (!lastItem.activity?.trim() && lastAmount === 0) {
        const updated = items.map((it, i) =>
          i === lastIdx ? { ...it, activity: presetActivity } : it
        );
        onChange(updated);
        return;
      }
    }

    const newItem: BudgetItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
      activity: presetActivity,
      divisionFunding: 0,
    };
    onChange([...items, newItem]);
  };

  const handleAddTopApprovedCategories = () => {
    if (isFormLocked || !approvedIntelligence?.provenBudgetCategories.length) return;
    const topCategories = approvedIntelligence.provenBudgetCategories.slice(0, 3);
    const updated = [...items];

    for (const cat of topCategories) {
      // Reuse trailing blank row if present
      const blankIdx = updated.findIndex(
        (it) => !it.activity?.trim() && (Number(it.divisionFunding ?? it.gcFunding) || 0) === 0
      );
      if (blankIdx >= 0) {
        updated[blankIdx] = { ...updated[blankIdx], activity: cat.label };
      } else {
        updated.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
          activity: cat.label,
          divisionFunding: 0,
        });
      }
    }
    onChange(updated);
  };

  const handleUpdateBudgetItem = (
    id: string,
    field: keyof BudgetItem,
    value: string | number
  ) => {
    if (isFormLocked) return;
    const updated = items.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        [field]: value,
      };
    });
    onChange(updated);
  };

  const handleRemoveBudgetItem = (id: string) => {
    if (isFormLocked) return;
    const updated = items.filter((item) => item.id !== id);
    onChange(updated);
  };

  const totalDivisionFunding = items.reduce(
    (sum, item) => sum + (Number(item.divisionFunding ?? item.gcFunding) || 0),
    0
  );
  const grandTotal = totalDivisionFunding;

  const smartBudget = useMemo(() => {
    const fallbackProposal: Proposal = proposal || ({
      id: '',
      createdAt: '',
      updatedAt: '',
      union: '',
      pointOfContact: { name: '', email: '', phone: '' },
      divisionLeadContact: { name: '', email: '', phone: '' },
      gcLiaison: { name: '', email: '', phone: '' },
      strategicFocus: '',
      divisionProject: '',
      title: '',
      overview: '',
      goal: '',
      outcomes: '',
      kpiType: '',
      kpiNumber: '',
      kpiDescription: '',
      kpiRationale: '',
      hadSimilarProject2Years: '',
      deliverables: '',
      targetAudiences: [],
      audienceEDetails: '',
      pointsOfIntegration: '',
      budgetItems: items,
    } as Proposal);
    return getSmartBudgetSuggestions({ ...fallbackProposal, budgetItems: items });
  }, [proposal, items]);

  const budgetFlags = useMemo(() => {
    if (!proposal) return [];
    return getSectionAlignmentAdvisories({ ...proposal, budgetItems: items }, allProposals).bySection[
      'section-budget'
    ] || [];
  }, [proposal, items, allProposals]);

  return (
    <div
      id="section-budget"
      className={getFlaggedSectionClass(
        budgetFlags.length > 0,
        'space-y-3.5 pt-2 transition-all rounded-xl p-1',
        'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 space-y-3.5 transition-all'
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">9. Budget Plan</h3>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {items.length} {items.length === 1 ? 'Line Item' : 'Line Items'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Itemize each planned activity and requested SSD funding in USD.{' '}
            {onOpenFaqTopic && (
              <button
                type="button"
                onClick={() => onOpenFaqTopic('budget')}
                className="text-blue-600 underline font-medium hover:text-blue-800 cursor-pointer"
              >
                FAQ 9
              </button>
            )}
          </p>
        </div>
        {/* Quick budget summary pill on mobile */}
        <div className="inline-flex sm:hidden items-center justify-between px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200">
          <span className="text-[11px] font-semibold text-blue-900">Total Requested:</span>
          <span className="text-sm font-extrabold text-[#1c398e] tabular-nums">US${grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Inline Division Liaison Revision Callout when Section 9 Budget is flagged */}
      {proposal && (() => {
        const budgetLiaisonActions = getSectionLiaisonActionItems(proposal, 'section-budget');
        if (!budgetLiaisonActions) return null;
        return (
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-amber-950">
                Division Liaison Revision Request ({budgetLiaisonActions.authorName})
              </span>
              <span className="text-[11px] font-semibold text-amber-800">
                {budgetLiaisonActions.items.map((m) => `Q${m.questionNumber}`).join(', ')}
              </span>
            </div>
            <div className="space-y-1">
              {budgetLiaisonActions.items.map((item) => (
                <p key={item.criterionKey} className="text-slate-800 leading-relaxed">
                  <strong className="text-slate-900">{item.shortTitle}:</strong> {item.instruction}
                </p>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Live Approved SSD Peer Budget Benchmark Strip */}
      {approvedIntelligence && approvedIntelligence.totalSsdApprovedCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/75 border border-emerald-200/90 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-emerald-950">
                  Learned from Approved SSD Proposals
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">
                  {approvedIntelligence.isObjectiveSpecific
                    ? `${approvedIntelligence.matchingObjectiveApprovedCount} Approved in ${approvedIntelligence.scopeLabel}`
                    : `${approvedIntelligence.totalSsdApprovedCount} Approved across SSD`}
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-relaxed">
                Committee-approved proposals in this scope average{' '}
                <strong>{approvedIntelligence.avgBudgetLineCount} itemized budget lines</strong>
                {approvedIntelligence.avgApprovedGrant > 0 && (
                  <>
                    {' '}
                    with an average grant of{' '}
                    <strong>US${approvedIntelligence.avgApprovedGrant.toLocaleString()}</strong>
                    {approvedIntelligence.minApprovedGrant !== approvedIntelligence.maxApprovedGrant && (
                      <span>
                        {' '}
                        (range: US${approvedIntelligence.minApprovedGrant.toLocaleString()} – US$
                        {approvedIntelligence.maxApprovedGrant.toLocaleString()})
                      </span>
                    )}
                  </>
                )}
                .
              </p>
            </div>
          </div>

          {!isFormLocked &&
            items.length <= 1 &&
            approvedIntelligence.provenBudgetCategories.length >= 2 && (
              <button
                type="button"
                onClick={handleAddTopApprovedCategories}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition cursor-pointer shrink-0 self-end sm:self-center shadow-2xs active:scale-95"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Add Top 3 Approved Breakdown Lines</span>
              </button>
            )}
        </div>
      )}

      {/* Inline Alignment Flags (Pointers, Example & Quick Fix) */}
      {budgetFlags.length > 0 && (
        <SectionAlignmentCallout
          items={budgetFlags}
          isFormLocked={isFormLocked}
          onQuickAction={onExecuteQuickAction}
        />
      )}

      {/* Fallback single-item warning when ProposalBudgetSection is rendered without proposal context */}
      {budgetFlags.length === 0 &&
        smartBudget.treasurerWarningTitle &&
        smartBudget.treasurerWarningMessage && (
          <div className="p-4 rounded-2xl bg-amber-50/95 border-2 border-amber-300 text-amber-950 flex items-start gap-3 shadow-2xs animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-xs flex-1">
              <p className="font-bold text-amber-950 text-sm">
                {smartBudget.treasurerWarningTitle}
              </p>
              <p className="text-amber-900 leading-relaxed">
                {smartBudget.treasurerWarningMessage}
              </p>
              {isFormLocked && (
                <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-950">
                  <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>
                    Approved record is locked — Union Treasurer must click &ldquo;Reopen Review&rdquo; at the top of the page before additional budget breakdown lines can be added.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Deliverables vs Budget Cross-Check Notice (only for additional categories not already shown in SectionAlignmentCallout) */}
      {(() => {
        const hasDeliverableGapFlag = budgetFlags.some(
          (f) => f.id === 'budget_deliverable_gap'
        );
        const remainingCategories = hasDeliverableGapFlag
          ? smartBudget.missingDeliverableCategories.slice(1)
          : smartBudget.missingDeliverableCategories;
        if (remainingCategories.length === 0) return null;
        return (
          <div className="p-3.5 rounded-2xl bg-blue-50/90 border border-blue-200 text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-blue-950">Deliverables Cost Check: </span>
                <span className="text-blue-900">
                  Section 6 also mentions{' '}
                  <strong>
                    {remainingCategories.map((d) => d.deliverableKeyword).join(' & ')}
                  </strong>
                  , which isn&apos;t listed in your budget yet.
                </span>
              </div>
            </div>
            {!isFormLocked && (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {remainingCategories.map((missing) => (
                  <button
                    key={missing.suggestedItem}
                    type="button"
                    onClick={() => handleAddBudgetItem(missing.suggestedItem)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-[11px] transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>Add {missing.suggestedItem}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Budget items container */}
      <div className="rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs bg-white">
        {/* Desktop Table Header (hidden on mobile < md) */}
        <div className="hidden md:block bg-[#fafbfc] border-b border-slate-200/90 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          <div className="grid grid-cols-12 px-4 py-2.5 items-center gap-3">
            <div className="col-span-7">ACTIVITY / DESCRIPTION</div>
            <div className="col-span-4 text-right pr-4 text-[#1c398e]">
              AMOUNT (USD)
            </div>
            <div className="col-span-1 text-center"></div>
          </div>
        </div>

        {/* Items Content: Responsive Desktop Rows & Mobile Cards */}
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-600">No budget activities added yet</p>
            <p>Click &quot;Add Blank Row&quot; or select a suggested breakdown tag below to begin.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const fundingVal =
                item.divisionFunding !== undefined
                  ? item.divisionFunding
                  : item.gcFunding;

              return (
                <div key={item.id} className="p-3 sm:p-4 hover:bg-slate-50/60 transition">
                  {/* Desktop View (md and up) */}
                  <div className="hidden md:grid grid-cols-12 items-center gap-3">
                    {/* Activity name */}
                    <div className="col-span-7">
                      {isFormLocked ? (
                        <div className="w-full px-3.5 py-2 rounded-xl bg-[#f8fafc] border border-slate-200/90 text-sm text-slate-800 leading-relaxed break-words select-text">
                          {item.activity || '—'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Activity or expense item (e.g., Venue Rental, Digital Tools, Stipends)..."
                          value={item.activity}
                          onChange={(e) => handleUpdateBudgetItem(item.id, 'activity', e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition"
                        />
                      )}
                    </div>

                    {/* Southern-Asia Pacific Division funding input */}
                    <div className="col-span-4">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                          US$
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          placeholder="0"
                          readOnly={isFormLocked}
                          value={fundingVal || ''}
                          onChange={(e) =>
                            handleUpdateBudgetItem(item.id, 'divisionFunding', Number(e.target.value) || 0)
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full pl-11 pr-3.5 py-2 text-right rounded-xl bg-white border-2 border-blue-200 hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm font-semibold text-slate-800 outline-none transition read-only:bg-[#f8fafc] read-only:border-slate-200/90 read-only:focus:ring-0"
                        />
                      </div>
                    </div>

                    {/* Remove row */}
                    <div className="col-span-1 text-center">
                      {!isFormLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBudgetItem(item.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition cursor-pointer"
                          title="Remove activity"
                          aria-label="Remove activity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile & Tablet Card Layout (< md) */}
                  <div className="md:hidden space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Item #{idx + 1}
                      </span>
                      {!isFormLocked && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBudgetItem(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[44px] rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-xs font-semibold active:scale-95 transition cursor-pointer"
                          aria-label={`Remove activity item ${idx + 1}`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Activity
                      </label>
                      {isFormLocked ? (
                        <div className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-slate-200/90 text-sm text-slate-800 leading-relaxed break-words select-text">
                          {item.activity || '—'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="What will this fund be used for?..."
                          value={item.activity}
                          onChange={(e) => handleUpdateBudgetItem(item.id, 'activity', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm text-slate-800 placeholder-slate-400 outline-none transition"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Amount (USD)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-xs font-bold">
                          US$
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          placeholder="0"
                          readOnly={isFormLocked}
                          value={fundingVal || ''}
                          onChange={(e) =>
                            handleUpdateBudgetItem(item.id, 'divisionFunding', Number(e.target.value) || 0)
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full pl-11 pr-3.5 py-2.5 text-right rounded-xl bg-white border-2 border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 text-sm font-bold text-slate-900 outline-none transition read-only:bg-[#f8fafc] read-only:border-slate-200/90 read-only:focus:ring-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Total Row */}
        <div className="p-3.5 sm:px-4 sm:py-3.5 bg-[#fcfdff] font-bold text-sm border-t border-slate-200">
          {/* Desktop total */}
          <div className="hidden md:grid grid-cols-12 items-center gap-3">
            <div className="col-span-7 text-slate-900 font-bold">Total Budget</div>
            <div className="col-span-4 text-right pr-3.5 text-[#1c398e] font-extrabold text-base">
              US${grandTotal.toLocaleString()}
            </div>
            <div className="col-span-1"></div>
          </div>

          {/* Mobile total */}
          <div className="md:hidden flex items-center justify-between">
            <span className="text-slate-800 font-bold text-sm">Total Budget</span>
            <span className="text-[#1c398e] font-black text-lg">US${grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* 4-Entity Share Breakdown (Shown on Approved proposals & Governance Review views) */}
      {(showShareBreakdown || isFormLocked) && proposal && grandTotal > 0 && (
        <ProposalShareBreakdownCard proposal={proposal} allProposals={allProposals} />
      )}

      {/* Add Activity Button + Smart Suggested Breakdown Tags */}
      {isFormLocked ? (
        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>
            Budget rows are locked because this proposal is Approved. To add breakdown categories, the Union Treasurer must click <strong>Reopen Review</strong> at the top of the page.
          </span>
        </div>
      ) : (
        <div className="pt-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddBudgetItem('')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-dashed border-[#1c398e]/60 text-[#1c398e] hover:bg-blue-50/60 active:bg-blue-100 font-semibold text-xs active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Blank Row</span>
            </button>

            {((approvedIntelligence && approvedIntelligence.provenBudgetCategories.length > 0) ||
              smartBudget.suggestedTags.length > 0) && (
              <button
                type="button"
                onClick={() => setShowSuggestedBudgetTags((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 text-[#1c398e]" />
                <span>
                  {showSuggestedBudgetTags ? 'Hide Suggested Categories' : 'Suggested Categories'}
                </span>
                {showSuggestedBudgetTags ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {showSuggestedBudgetTags && (
            <div className="space-y-2.5 animate-in fade-in">
              {/* Proven Breakdown Categories Learned from Approved SSD Proposals */}
              {approvedIntelligence && approvedIntelligence.provenBudgetCategories.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 space-y-2">
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      Approved Peer Categories
                      {approvedIntelligence.isObjectiveSpecific
                        ? ` (${approvedIntelligence.scopeLabel})`
                        : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {approvedIntelligence.provenBudgetCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleAddBudgetItem(cat.label)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-emerald-100/80 text-emerald-950 border border-emerald-300 hover:border-emerald-400 transition cursor-pointer active:scale-95 shadow-2xs"
                        title={`Used in ${cat.frequency} approved proposal${cat.frequency === 1 ? '' : 's'} (${cat.sampleUnions.join(', ')})${cat.avgAmount ? ` • Avg ~US$${cat.avgAmount.toLocaleString()}` : ''}`}
                      >
                        <Plus className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>{cat.label}</span>
                        <span className="text-[10px] font-bold text-emerald-700 tabular-nums">
                          ({cat.frequency}x)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clickable Breakdown Suggestion Tags */}
              {smartBudget.suggestedTags.length > 0 && (
                <div className="p-3 rounded-2xl bg-[#f8fafc] border border-slate-200/90 space-y-2">
                  <div className="text-xs font-bold text-slate-700">
                    Suggested Breakdown Categories
                    {proposal?.divisionProject
                      ? ` (${getCanonicalDivisionProject(proposal.divisionProject) || proposal.divisionProject})`
                      : ''}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {smartBudget.suggestedTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleAddBudgetItem(tag.label)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer active:scale-95 ${
                          tag.isFromDeliverables
                            ? 'bg-blue-50/90 hover:bg-blue-100/80 text-blue-900 border-blue-300 font-semibold shadow-2xs'
                            : 'bg-white hover:bg-blue-50/60 text-slate-700 hover:text-[#1c398e] border-slate-200/90 hover:border-blue-300 shadow-2xs'
                        }`}
                        title={
                          tag.reason
                            ? `${tag.reason} — Click to add "${tag.label}"`
                            : `Click to add "${tag.label}" as a budget line item`
                        }
                      >
                        <Plus className="w-3 h-3 text-[#1c398e] shrink-0" />
                        <span>{tag.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
