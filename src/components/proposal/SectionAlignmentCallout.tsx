import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Lock,
  Plus,
} from 'lucide-react';
import { SmartAdvisoryItem } from '../../utils/proposalSmartAdvisor';
import { TARGET_AUDIENCE_OPTIONS } from '../../types';

export interface SectionAlignmentCalloutProps {
  items: SmartAdvisoryItem[];
  isFormLocked?: boolean;
  readOnly?: boolean;
  onQuickAction?: (item: SmartAdvisoryItem) => void;
  topFlagsAnchorId?: string;
}

export function getFlaggedSectionClass(
  hasFlags: boolean,
  defaultClass: string,
  flaggedClass = 'scroll-mt-24 rounded-2xl border-2 border-amber-300 bg-amber-50/45 p-4 sm:p-5 transition-all'
): string {
  return hasFlags ? flaggedClass : `scroll-mt-24 ${defaultClass}`;
}

export function SectionAlignmentCallout({
  items,
  isFormLocked = false,
  readOnly = false,
  onQuickAction,
  topFlagsAnchorId = 'proposal-alignment-flags',
}: SectionAlignmentCalloutProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  const canMutate = !isFormLocked && !readOnly && Boolean(onQuickAction);

  const handleCopyExample = async (itemId: string, text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedId(itemId);
        setTimeout(() => {
          setCopiedId((prev) => (prev === itemId ? null : prev));
        }, 2000);
      }
    } catch {
      // Clipboard unavailable in restricted browser contexts
    }
  };

  const handleScrollToTopFlags = () => {
    const el = document.getElementById(topFlagsAnchorId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      className="rounded-xl border border-amber-300 bg-white/95 overflow-hidden text-xs"
      role="region"
      aria-label="Section Alignment Pointers and Suggestions"
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-amber-100/80 border-b border-amber-200/90 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="font-extrabold text-amber-950 tracking-tight">
            Needs Alignment
          </span>
          <span aria-hidden="true" className="text-amber-700/60">
            ·
          </span>
          <span className="font-semibold text-amber-900 tabular-nums">
            {items.length} {items.length === 1 ? 'Suggestion' : 'Suggestions'} for This Section
          </span>
        </div>

        <button
          type="button"
          onClick={handleScrollToTopFlags}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:text-amber-950 hover:underline cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowUp className="w-3 h-3 shrink-0" />
          <span>Back to Top Flags</span>
        </button>
      </div>

      {/* Advisory Items List (Single-Elevation Hairline Dividers) */}
      <div className="divide-y divide-amber-200/80">
        {items.map((item) => {
          const isOutreachMultiAudience =
            item.id === 'aud_outreach_internal_only' &&
            Boolean(item.payload?.audienceIds && item.payload.audienceIds.length > 1);

          return (
            <div key={item.id} className="p-3.5 sm:p-4 space-y-2.5">
              {/* Item Title & Plain-English Explanation */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {item.severity === 'playbook' ? (
                    <BookOpen className="w-4 h-4 text-[#1c398e] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-bold text-slate-900 text-xs sm:text-[13px] leading-snug">
                      {item.title}
                    </p>
                    <p className="text-slate-700 leading-relaxed text-xs">
                      {item.message}
                    </p>
                  </div>
                </div>

                {/* Primary 1-Click Fix Button (when editing is unlocked) */}
                {canMutate && item.onQuickActionType && item.quickActionLabel && (
                  <button
                    type="button"
                    onClick={() => onQuickAction?.(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.quickActionLabel}</span>
                  </button>
                )}
              </div>

              {/* Pointers, Why It Matters, and Copyable Example */}
              {(item.whyItMatters || (item.pointers && item.pointers.length > 0) || item.exampleTemplate) && (
                <div className="p-3 rounded-lg bg-amber-50/55 border border-amber-200/80 space-y-2 text-[11px] sm:text-xs text-slate-700">
                  {item.whyItMatters && (
                    <p className="leading-relaxed">
                      <span className="font-bold text-slate-900">Why it matters: </span>
                      {item.whyItMatters}
                    </p>
                  )}

                  {item.pointers && item.pointers.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-bold text-slate-900 block">What to do:</span>
                      <ul className="list-disc pl-4 space-y-0.5 leading-relaxed">
                        {item.pointers.map((pt, idx) => (
                          <li key={`${item.id}_inline_pt_${idx}`}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.exampleTemplate && (
                    <div className="pt-2 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <p className="italic text-slate-700 leading-relaxed flex-1">
                        <span className="font-bold not-italic text-slate-900">
                          Example you can copy:{' '}
                        </span>
                        &ldquo;{item.exampleTemplate}&rdquo;
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyExample(item.id, item.exampleTemplate!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-amber-100/70 text-slate-700 border border-amber-200 font-semibold text-[11px] transition cursor-pointer whitespace-nowrap shrink-0 self-start"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                            <span className="text-emerald-800">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>Copy example</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Multi-Audience Quick Include Buttons for Outreach Contradiction */}
              {canMutate && isOutreachMultiAudience && item.payload?.audienceIds && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-[11px] font-bold text-amber-950">Quick Add Audience:</span>
                  {item.payload.audienceIds.map((audId) => {
                    const opt = TARGET_AUDIENCE_OPTIONS.find((o) => o.id === audId);
                    if (!opt) return null;
                    const shortName =
                      audId === 'C'
                        ? 'Group C (Seekers)'
                        : audId === 'D'
                        ? 'Group D (Other Christians)'
                        : audId === 'E'
                        ? 'Group E (World Religions / Secular)'
                        : `Group ${audId}`;
                    return (
                      <button
                        key={audId}
                        type="button"
                        onClick={() =>
                          onQuickAction?.({
                            ...item,
                            onQuickActionType: 'add_audience',
                            payload: { audienceIds: [audId] },
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] transition cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3 h-3 shrink-0" />
                        <span>Include {shortName}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Read-only lock note if quick fix exists but form is locked */}
              {(isFormLocked || readOnly) && item.onQuickActionType && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-900">
                  <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                  <span>
                    Read-only view — follow these pointers when editing in Standard Form.
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
