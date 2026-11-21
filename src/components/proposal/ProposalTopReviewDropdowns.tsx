import React, { useMemo, useState, useEffect } from 'react';
import {
  Proposal,
  UserAccount,
  ProposalReviewNote,
  REVIEW_READINESS_LABELS,
  getProposalReviewNotes,
  canUserPostProposalNote,
} from '../../types';
import {
  evaluateProposalReviewFramework,
  getActiveLiaisonActionItems,
  resolveQuestionTargetForInstruction,
} from '../../utils/projectReviewFramework';
import { SmartAdvisoryItem } from '../../utils/proposalSmartAdvisor';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileEdit,
  History,
  MessageSquare,
  RotateCcw,
  Send,
  User,
} from 'lucide-react';

export interface ProposalTopReviewDropdownsProps {
  proposal: Proposal;
  currentUser?: UserAccount | null;
  isApproved: boolean;
  isFormLocked: boolean;
  canApproveOrReopen: boolean;
  isLiaison: boolean;
  smartAdvisories: SmartAdvisoryItem[];
  isKpiMisaligned: boolean;
  objectiveKey?: string;
  selectedKpiLabel?: string;
  allowedKpiLabels: string[];
  totalFlagsCount: number;
  isAdvisorExpanded: boolean;
  setIsAdvisorExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  expandedFlagIds: Record<string, boolean>;
  onToggleFlagDetails: (id: string) => void;
  onJumpToSection: (sectionId: string) => void;
  onExecuteQuickAction: (item: SmartAdvisoryItem) => void;
  onOpenReopenConfirm: () => void;
  onPostReviewNote?: (text: string) => Promise<void>;
  focusTarget?: 'notes' | 'flags' | 'financials' | 'kpis' | null;
}

function getRoleDisplayLabel(role?: string): string {
  switch (role) {
    case 'super_admin':
      return 'Division Admin';
    case 'division_liaison':
      return 'Division Liaison';
    case 'treasurer':
      return 'Union Treasurer';
    case 'coordinator':
      return 'Union Coordinator';
    case 'user':
      return 'Proposal Maker';
    default:
      return 'Reviewer';
  }
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function ProposalTopReviewDropdowns({
  proposal,
  currentUser,
  isApproved,
  isFormLocked,
  canApproveOrReopen,
  isLiaison,
  smartAdvisories,
  isKpiMisaligned,
  objectiveKey,
  selectedKpiLabel,
  allowedKpiLabels,
  totalFlagsCount,
  isAdvisorExpanded,
  setIsAdvisorExpanded,
  expandedFlagIds,
  onToggleFlagDetails,
  onJumpToSection,
  onExecuteQuickAction,
  onOpenReopenConfirm,
  onPostReviewNote,
  focusTarget,
}: ProposalTopReviewDropdownsProps) {
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isRevisionsExpanded, setIsRevisionsExpanded] = useState(false);
  const [showEarlierNotes, setShowEarlierNotes] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSavingReply, setIsSavingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const notesList = useMemo(() => getProposalReviewNotes(proposal), [proposal]);
  const activeLiaisonActions = useMemo(
    () => getActiveLiaisonActionItems(proposal),
    [proposal]
  );
  const frameworkEval = useMemo(
    () => evaluateProposalReviewFramework(proposal),
    [proposal]
  );

  const isStep5Authorized = Boolean(proposal.divisionApproval?.authorized);
  const revisionVotes = useMemo(
    () =>
      (proposal.liaisonVotes || []).filter((v) => v.vote === 'revision_requested'),
    [proposal.liaisonVotes]
  );
  const hasLiaisonRevisionOnApproved =
    isApproved && !isStep5Authorized && revisionVotes.length > 0;
  const isDraftWithRevisionNotes =
    (!proposal.status || proposal.status === 'draft') &&
    (notesList.length > 0 || Boolean(activeLiaisonActions));

  const revisionActionItems = activeLiaisonActions?.items || [];
  const hasRevisionRequests =
    revisionVotes.length > 0 ||
    revisionActionItems.length > 0 ||
    isDraftWithRevisionNotes;

  const revisionBadgeCount =
    revisionActionItems.length > 0
      ? revisionActionItems.length
      : revisionVotes.length > 0
      ? revisionVotes.length
      : isDraftWithRevisionNotes
      ? 1
      : 0;

  // Reset collapsed states smoothly when switching proposals
  useEffect(() => {
    setIsNotesExpanded(false);
    setIsRevisionsExpanded(false);
    setShowEarlierNotes(false);
    setReplyText('');
    setReplyError(null);
  }, [proposal.id]);

  // Expand Notes dropdown if deep-linked specifically to notes
  useEffect(() => {
    if (focusTarget === 'notes') {
      setIsNotesExpanded(true);
    }
  }, [focusTarget, proposal.id]);

  const canPostNote = canUserPostProposalNote(proposal, currentUser);
  const latestNote: ProposalReviewNote | null =
    notesList.length > 0 ? notesList[notesList.length - 1] : null;
  const earlierNotes =
    notesList.length > 1 ? notesList.slice(0, notesList.length - 1) : [];

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !onPostReviewNote || isSavingReply) return;
    setIsSavingReply(true);
    setReplyError(null);
    try {
      await onPostReviewNote(replyText.trim());
      setReplyText('');
    } catch {
      setReplyError('Unable to save review note right now. Please try again.');
    } finally {
      setIsSavingReply(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* =====================================================================
          1. REVIEW NOTES DROPDOWN
         ===================================================================== */}
      <div
        id="proposal-review-notes-dropdown"
        className={`rounded-2xl border overflow-hidden shadow-2xs transition-all ${
          notesList.length > 0
            ? 'border-blue-300/90 bg-blue-50/55'
            : 'border-slate-200 bg-slate-50/70'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsNotesExpanded((prev) => !prev)}
          className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
            notesList.length > 0 ? 'hover:bg-blue-100/50' : 'hover:bg-slate-100/80'
          }`}
          title="View or post Review Notes between Proposal Maker, Union Officers, and Division Liaisons"
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0 text-xs">
            <MessageSquare
              className={`w-4 h-4 shrink-0 ${
                notesList.length > 0 ? 'text-[#1c398e]' : 'text-slate-400'
              }`}
            />
            <span
              className={`font-extrabold ${
                notesList.length > 0 ? 'text-blue-950' : 'text-slate-700'
              }`}
            >
              Review Notes ({notesList.length})
            </span>
            <span
              className={`text-[11px] font-semibold truncate ${
                notesList.length > 0 ? 'text-blue-800' : 'text-slate-500'
              }`}
            >
              {latestNote
                ? `· Latest by ${latestNote.authorName} (${getRoleDisplayLabel(
                    latestNote.authorRole
                  )})`
                : '· No notes yet'}
            </span>
          </div>
          <div
            className={`flex items-center gap-1 text-xs font-bold shrink-0 ${
              notesList.length > 0 ? 'text-[#1c398e]' : 'text-slate-600'
            }`}
          >
            <span>{isNotesExpanded ? 'Hide' : 'Show'}</span>
            {isNotesExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {isNotesExpanded && (
          <div className="px-4 pb-4 pt-3 space-y-3 border-t border-blue-200/70 bg-white/80">
            {latestNote ? (
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl bg-white border border-blue-200/90 space-y-1.5 text-xs shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <User className="w-3.5 h-3.5 text-[#1c398e]" />
                      <span className="font-bold text-slate-900">
                        {latestNote.authorName}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="font-semibold text-[#1c398e]">
                        {getRoleDisplayLabel(latestNote.authorRole)}
                      </span>
                    </div>
                    {latestNote.createdAt && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 tabular-nums">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatShortDate(latestNote.createdAt)}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {latestNote.text}
                  </p>
                </div>

                {earlierNotes.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowEarlierNotes((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-[#1c398e]" />
                      <span>
                        {showEarlierNotes
                          ? 'Hide earlier notes'
                          : `View ${earlierNotes.length} earlier ${
                              earlierNotes.length === 1 ? 'note' : 'notes'
                            }`}
                      </span>
                      {showEarlierNotes ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {showEarlierNotes && (
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
                        {[...earlierNotes].reverse().map((note, idx) => (
                          <div
                            key={note.id || `earlier_note_${idx}`}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">
                                  {note.authorName}
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="font-medium text-slate-600">
                                  {getRoleDisplayLabel(note.authorRole)}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 tabular-nums">
                                {formatShortDate(note.createdAt)}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {note.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No review notes have been posted on this proposal yet.
              </p>
            )}

            {canPostNote && onPostReviewNote && (
              <form
                onSubmit={handleSubmitReply}
                className="pt-2 border-t border-slate-200/80 space-y-2"
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a review note or reply for the Union & review team..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1c398e] outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSavingReply}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] disabled:opacity-45 text-white font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSavingReply ? 'Posting...' : 'Post Note'}</span>
                  </button>
                </div>
                {replyError && (
                  <p className="text-[11px] font-medium text-rose-600">{replyError}</p>
                )}
              </form>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          2. ALIGNMENT FLAGS DROPDOWN
         ===================================================================== */}
      <div
        id="proposal-alignment-flags"
        className={`rounded-2xl border overflow-hidden shadow-2xs transition-all ${
          totalFlagsCount > 0
            ? 'border-amber-300/90 bg-amber-50/60'
            : 'border-emerald-200/80 bg-emerald-50/40'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsAdvisorExpanded((prev) => !prev)}
          className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
            totalFlagsCount > 0
              ? 'hover:bg-amber-100/50'
              : 'hover:bg-emerald-100/40'
          }`}
          title="Real-time checks for Strategic KPI alignment, Playbook handoffs, audience alignment, and itemized Treasury budget detail"
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0 text-xs">
            {totalFlagsCount > 0 ? (
              <ClipboardCheck className="w-4 h-4 text-amber-700 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span
              className={`font-extrabold ${
                totalFlagsCount > 0 ? 'text-amber-950' : 'text-emerald-950'
              }`}
            >
              Alignment Flags ({totalFlagsCount})
            </span>
            {totalFlagsCount === 0 ? (
              <span className="text-[11px] font-semibold text-emerald-700">
                · All checks passed
              </span>
            ) : isApproved ? (
              <span className="text-[11px] font-semibold text-amber-800">
                · Read-only
              </span>
            ) : null}
          </div>
          <div
            className={`flex items-center gap-1 text-xs font-bold shrink-0 ${
              totalFlagsCount > 0 ? 'text-amber-900' : 'text-emerald-800'
            }`}
          >
            <span>{isAdvisorExpanded ? 'Hide' : 'Show'}</span>
            {isAdvisorExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {isAdvisorExpanded && (
          <div className="px-4 pb-4 pt-2.5 space-y-2.5 border-t border-amber-200/70">
            {totalFlagsCount === 0 ? (
              <p className="text-xs text-emerald-900">
                No alignment flags detected. Primary KPI, strategic objective, target audience, and
                budget breakdown pass automated alignment checks.
              </p>
            ) : (
              <>
                {isKpiMisaligned && (
                  <div className="p-3 rounded-xl bg-white border border-amber-300 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 text-xs shadow-2xs">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <p className="font-bold text-slate-900">
                          Primary KPI Does Not Match Your Global Objective in Sec 5
                        </p>
                        <p className="text-slate-600 leading-relaxed text-[11px]">
                          Current selection:{' '}
                          <span className="font-bold text-slate-800">
                            {selectedKpiLabel}
                          </span>{' '}
                          (Objective: <span className="font-bold text-slate-800">{objectiveKey}</span>).
                        </p>
                        <div className="px-2.5 py-1.5 rounded-lg bg-amber-50/75 border border-amber-200/90 border-l-4 border-l-amber-600 text-[11px] text-slate-900">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 mr-1.5">
                            {isFormLocked ? 'Verify in Sec 5:' : 'Action Step:'}
                          </span>
                          <span className="font-semibold">
                            {allowedKpiLabels.length > 0
                              ? isFormLocked
                                ? `Confirm whether Section 5 Primary KPI should be updated to ${allowedKpiLabels.join(' or ')}.`
                                : `Open Section 5 and switch Primary KPI to ${allowedKpiLabels.join(' or ')}.`
                              : isFormLocked
                              ? 'Confirm Section 5 Primary KPI aligns with the chosen Global Objective.'
                              : 'Open Section 5 and pick the matching Primary KPI card.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleFlagDetails('kpi_misaligned_top')}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1c398e] hover:underline cursor-pointer"
                        >
                          <span>
                            {expandedFlagIds['kpi_misaligned_top']
                              ? 'Hide pointers & example'
                              : 'How to fix & example'}
                          </span>
                          {expandedFlagIds['kpi_misaligned_top'] ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        {expandedFlagIds['kpi_misaligned_top'] && (
                          <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 space-y-1 text-[11px] text-slate-700">
                            <p>
                              <span className="font-bold text-slate-900">Why it matters: </span>
                              Your Primary KPI must match the Global Objective selected at the top of
                              the form so Division reports track the right results.
                            </p>
                            <ul className="list-disc pl-4 space-y-0.5">
                              <li>Click Go to Sec 5 · KPI on the right.</li>
                              <li>
                                Select{' '}
                                {allowedKpiLabels.length > 0
                                  ? allowedKpiLabels.join(' or ')
                                  : 'the highlighted matching KPI card'}
                                .
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => onJumpToSection('section-5-kpi')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>Go to Sec 5 · KPI</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {smartAdvisories.map((adv) => {
                  const hasGuides = Boolean(
                    adv.whyItMatters || adv.pointers?.length || adv.exampleTemplate
                  );
                  const isGuideOpen = Boolean(expandedFlagIds[adv.id]);
                  const jumpButtonText = adv.sectionLabel
                    ? `Go to ${adv.sectionLabel}`
                    : 'Go to Section';

                  return (
                    <div
                      key={adv.id}
                      className="p-3 rounded-xl bg-white border border-amber-200/90 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {adv.severity === 'playbook' ? (
                          <BookOpen className="w-4 h-4 text-[#1c398e] shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <p className="font-bold text-slate-900">{adv.title}</p>
                          <p className="text-slate-600 leading-relaxed text-[11px]">
                            {adv.message}
                          </p>
                          {(adv.pointers?.[0] || adv.quickActionLabel) && (
                            <div
                              className={`px-2.5 py-1.5 rounded-lg border border-l-4 text-[11px] text-slate-900 ${
                                adv.severity === 'playbook'
                                  ? 'bg-slate-50 border-slate-200 border-l-[#1c398e]'
                                  : 'bg-amber-50/70 border-amber-200/80 border-l-amber-600'
                              }`}
                            >
                              <span
                                className={`text-[10px] font-extrabold uppercase tracking-wider mr-1.5 ${
                                  adv.severity === 'playbook' ? 'text-[#1c398e]' : 'text-amber-800'
                                }`}
                              >
                                {isFormLocked
                                  ? `Verify (${adv.sectionLabel}):`
                                  : 'Action Step:'}
                              </span>
                              <span className="font-semibold">
                                {adv.pointers?.[0] || adv.quickActionLabel}
                              </span>
                            </div>
                          )}

                          {hasGuides && (
                            <div>
                              <button
                                type="button"
                                onClick={() => onToggleFlagDetails(adv.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1c398e] hover:underline cursor-pointer"
                              >
                                <span>
                                  {isGuideOpen
                                    ? 'Hide pointers & example'
                                    : 'Pointers & example'}
                                </span>
                                {isGuideOpen ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>

                              {isGuideOpen && (
                                <div className="mt-1.5 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 space-y-1.5 text-[11px] text-slate-700">
                                  {adv.whyItMatters && (
                                    <p className="leading-snug">
                                      <span className="font-bold text-slate-900">
                                        Why it matters:{' '}
                                      </span>
                                      {adv.whyItMatters}
                                    </p>
                                  )}
                                  {adv.pointers && adv.pointers.length > 0 && (
                                    <ul className="list-disc pl-4 space-y-0.5 leading-snug">
                                      {adv.pointers.map((pt, idx) => (
                                        <li key={`${adv.id}_pt_${idx}`}>{pt}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {adv.exampleTemplate && (
                                    <p className="italic text-slate-600 pt-1 border-t border-amber-200/60 leading-snug">
                                      <span className="font-semibold not-italic text-slate-800">
                                        Example you can copy:{' '}
                                      </span>
                                      &ldquo;{adv.exampleTemplate}&rdquo;
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                        {!isFormLocked && adv.onQuickActionType && adv.quickActionLabel && (
                          <button
                            type="button"
                            onClick={() => onExecuteQuickAction(adv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] transition cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap shrink-0"
                          >
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>{adv.quickActionLabel}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onJumpToSection(adv.sectionId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>{jumpButtonText}</span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          3. REQUESTS FOR REVISIONS DROPDOWN
         ===================================================================== */}
      <div
        id="proposal-revision-requests"
        className={`rounded-2xl border overflow-hidden shadow-2xs transition-all ${
          hasRevisionRequests
            ? 'border-rose-300/90 bg-rose-50/55'
            : 'border-slate-200 bg-slate-50/70'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsRevisionsExpanded((prev) => !prev)}
          className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition cursor-pointer ${
            hasRevisionRequests ? 'hover:bg-rose-100/50' : 'hover:bg-slate-100/80'
          }`}
          title="View Division Liaison Step 4 Revision Requests and section-by-section update checklist"
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0 text-xs">
            {hasRevisionRequests ? (
              <RotateCcw className="w-4 h-4 text-rose-700 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span
              className={`font-extrabold ${
                hasRevisionRequests ? 'text-rose-950' : 'text-slate-700'
              }`}
            >
              Requests for Revisions ({revisionBadgeCount})
            </span>
            <span
              className={`text-[11px] font-semibold ${
                hasRevisionRequests ? 'text-rose-800' : 'text-slate-500'
              }`}
            >
              {hasLiaisonRevisionOnApproved
                ? canApproveOrReopen
                  ? '· Action Needed (Treasurer Unlock)'
                  : '· Step 4 Revisions Requested'
                : isDraftWithRevisionNotes
                ? '· Returned for Revision'
                : hasRevisionRequests
                ? '· Updates Requested'
                : '· None active'}
            </span>
          </div>
          <div
            className={`flex items-center gap-1 text-xs font-bold shrink-0 ${
              hasRevisionRequests ? 'text-rose-900' : 'text-slate-600'
            }`}
          >
            <span>{isRevisionsExpanded ? 'Hide' : 'Show'}</span>
            {isRevisionsExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {isRevisionsExpanded && (
          <div className="px-4 pb-4 pt-3 space-y-3 border-t border-rose-200/70 bg-white/80">
            {!hasRevisionRequests ? (
              <p className="text-xs text-slate-500">
                No active revision requests from Union Officers or Division Liaisons.
              </p>
            ) : (
              <>
                {/* Union Treasurer / Proposal Maker Unlock Callout */}
                {hasLiaisonRevisionOnApproved && !isLiaison && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-extrabold text-amber-950">
                          {canApproveOrReopen
                            ? 'Action Needed · Unlock Form for Proposal Maker'
                            : 'Locked Under Step 3 Union Action · Ask Treasurer to Reopen'}
                        </p>
                        <p className="text-amber-900 leading-relaxed text-[11px]">
                          {canApproveOrReopen
                            ? `This proposal remains locked under Union Action #${
                                proposal.unionApproval?.actionNumber || 'Voted'
                              }. Click Reopen Review for Author so edits can be saved while preserving committee action history.`
                            : `This proposal is locked under Union Action #${
                                proposal.unionApproval?.actionNumber || 'Voted'
                              }. Ask your Union Treasurer to click Reopen Review so you can edit the sections below.`}
                        </p>
                      </div>
                    </div>

                    {canApproveOrReopen && (
                      <button
                        type="button"
                        onClick={onOpenReopenConfirm}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        <span>Reopen Review for Author</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Section-by-Section 7-Question Rubric Action Items */}
                {revisionActionItems.length > 0 && (
                  <div className="space-y-2">
                    {revisionActionItems.map((item, idx) => {
                      const matchedQ = frameworkEval.questions.find(
                        (q) => q.key === item.criterionKey
                      );
                      const resolvedTarget = matchedQ
                        ? resolveQuestionTargetForInstruction(matchedQ, item.instruction)
                        : null;
                      const chipInfo = resolvedTarget?.matchedChip;
                      const jumpLabel = resolvedTarget?.shortSectionBadge
                        ? `Go to ${resolvedTarget.shortSectionBadge}`
                        : `Go to ${item.sectionLabel.replace('Section ', 'Sec ')}`;
                      const alreadyIncludesExample = item.instruction.includes(
                        'Example to copy & fill in:'
                      );

                      return (
                        <div
                          key={`${item.criterionKey}_${idx}`}
                          className="p-3 rounded-xl bg-white border border-rose-200/90 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs shadow-2xs"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                              <span className="font-bold text-slate-900 tabular-nums">
                                {idx + 1}. {item.sectionLabel}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="font-semibold text-rose-800">
                                SSD Q{item.questionNumber}: {item.shortTitle}
                              </span>
                            </div>
                            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {item.instruction}
                            </p>

                            {chipInfo && (
                              <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 space-y-1 text-[11px] text-slate-700">
                                <p className="leading-snug">
                                  <span className="font-bold text-slate-900">
                                    Why it matters:{' '}
                                  </span>
                                  {chipInfo.whyItMatters}
                                </p>
                                {chipInfo.pointers.length > 0 && (
                                  <ul className="list-disc pl-4 space-y-0.5 leading-snug">
                                    {chipInfo.pointers.map((pt, pIdx) => (
                                      <li key={`${item.criterionKey}_rev_pt_${pIdx}`}>
                                        {pt}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {!alreadyIncludesExample && chipInfo.exampleTemplate && (
                                  <p className="italic text-slate-600 pt-1 border-t border-amber-200/60 leading-snug">
                                    <span className="font-semibold not-italic text-slate-800">
                                      Example you can copy:{' '}
                                    </span>
                                    &ldquo;{chipInfo.exampleTemplate}&rdquo;
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onJumpToSection(item.sectionId)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1c398e] hover:bg-[#152c70] text-white font-semibold text-xs transition cursor-pointer whitespace-nowrap shrink-0 self-end sm:self-center"
                          >
                            <span>{jumpLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Liaison Revision Vote Summaries */}
                {revisionVotes.length > 0 && (
                  <div className="space-y-2">
                    {revisionVotes.map((v, idx) => (
                      <div
                        key={v.liaisonEmail || `rev_vote_${idx}`}
                        className="p-3 rounded-xl bg-white border border-rose-200 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">
                              {v.liaisonName}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-semibold text-rose-800">
                              Division Liaison · Revision Requested
                            </span>
                            {v.readinessRating && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="text-slate-600">
                                  {REVIEW_READINESS_LABELS[v.readinessRating] ||
                                    v.readinessRating}
                                </span>
                              </>
                            )}
                          </div>
                          {v.timestamp && (
                            <span className="text-[10px] text-slate-400 tabular-nums">
                              {formatShortDate(v.timestamp)}
                            </span>
                          )}
                        </div>
                        {v.recommendation && (
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {v.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Returned-to-Draft Reviewer Feedback Note fallback when no Step 4 vote exists */}
                {revisionVotes.length === 0 &&
                  revisionActionItems.length === 0 &&
                  latestNote && (
                    <div className="p-3 rounded-xl bg-white border border-rose-200 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                        <span className="font-bold text-slate-900">
                          {latestNote.authorName} (
                          {getRoleDisplayLabel(latestNote.authorRole)})
                        </span>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {formatShortDate(latestNote.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {latestNote.text}
                      </p>
                    </div>
                  )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
