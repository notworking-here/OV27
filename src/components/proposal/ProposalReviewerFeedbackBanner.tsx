import { useState, useMemo } from 'react';
import { Proposal, UserAccount, getProposalReviewNotes } from '../../types';
import {
  getActiveLiaisonActionItems,
  evaluateProposalReviewFramework,
  resolveQuestionTargetForInstruction,
} from '../../utils/projectReviewFramework';
import {
  MessageSquareQuote,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Building2,
  ShieldCheck,
  Shield,
  History,
  ArrowRight,
  ClipboardCheck,
} from 'lucide-react';

export interface ProposalReviewerFeedbackBannerProps {
  proposal: Proposal;
  currentUser?: UserAccount | null;
}

export function ProposalReviewerFeedbackBanner({
  proposal,
}: ProposalReviewerFeedbackBannerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const notesList = useMemo(() => getProposalReviewNotes(proposal), [proposal]);
  const activeLiaisonActions = useMemo(
    () => getActiveLiaisonActionItems(proposal),
    [proposal]
  );
  const frameworkEval = useMemo(
    () => evaluateProposalReviewFramework(proposal),
    [proposal]
  );

  if (notesList.length === 0 && !activeLiaisonActions) {
    return null;
  }

  const isDraft = !proposal.status || proposal.status === 'draft';
  const isApproved =
    proposal.status === 'approved' || Boolean(proposal.unionApproval?.actionNumber);
  const isUnderReview = proposal.status === 'under_review';
  const hasLiaisonRevisionOnApproved =
    isApproved &&
    !proposal.divisionApproval?.authorized &&
    (proposal.liaisonVotes || []).some((v) => v.vote === 'revision_requested');

  const themeClasses = hasLiaisonRevisionOnApproved
    ? {
        container: 'bg-amber-50/95 border-amber-300 text-amber-950',
        badge: 'text-amber-900',
        iconBg: 'bg-amber-600 text-white',
        contentBox: 'bg-white border-amber-200 text-slate-800',
      }
    : isApproved
    ? {
        container: 'bg-emerald-50/90 border-emerald-300 text-emerald-950',
        badge: 'text-emerald-800',
        iconBg: 'bg-emerald-600 text-white',
        contentBox: 'bg-white border-emerald-200 text-slate-800',
      }
    : isDraft
    ? {
        container: 'bg-amber-50/95 border-amber-300 text-amber-950',
        badge: 'text-amber-900',
        iconBg: 'bg-amber-600 text-white',
        contentBox: 'bg-white border-amber-200 text-slate-800',
      }
    : {
        container: 'bg-blue-50/90 border-blue-300 text-blue-950',
        badge: 'text-blue-900',
        iconBg: 'bg-[#1c398e] text-white',
        contentBox: 'bg-white border-blue-200 text-slate-800',
      };

  const latestNote = notesList.length > 0 ? notesList[notesList.length - 1] : null;
  const earlierNotes = notesList.length > 1 ? notesList.slice(0, notesList.length - 1) : [];

  const formatNoteDate = (dateStr: string) => {
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
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'division_liaison':
        return 'Division Liaison';
      case 'treasurer':
        return 'Union Treasurer';
      case 'coordinator':
        return 'Union Coordinator';
      default:
        return 'Reviewer';
    }
  };

  const handleJumpToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
      }, 2200);
    }
  };

  const headerAuthorName =
    latestNote?.authorName || activeLiaisonActions?.authorName || 'Review Committee';
  const headerAuthorRole =
    latestNote?.authorRole || activeLiaisonActions?.authorRole || 'reviewer';
  const headerTimestamp = latestNote?.createdAt || activeLiaisonActions?.createdAt || '';

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all ${themeClasses.container}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${themeClasses.iconBg}`}
          >
            {activeLiaisonActions && activeLiaisonActions.items.length > 0 ? (
              <ClipboardCheck className="w-5 h-5" />
            ) : (
              <MessageSquareQuote className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold tracking-tight text-slate-900">
                {activeLiaisonActions &&
                activeLiaisonActions.items.length > 0 &&
                (!isApproved || hasLiaisonRevisionOnApproved)
                  ? `Reviewer Section Checklist (${activeLiaisonActions.items.length} ${
                      activeLiaisonActions.items.length === 1 ? 'Section' : 'Sections'
                    } to Update)`
                  : hasLiaisonRevisionOnApproved
                  ? 'Division Liaison Revision Request'
                  : isApproved
                  ? 'Treasury & Liaison Approval Remarks'
                  : isDraft
                  ? 'Reviewer Feedback — Action Required'
                  : 'Coordinator, Treasury & Liaison Review Notes'}
              </h3>

              <span className={`text-xs font-bold ${themeClasses.badge}`}>
                ·{' '}
                {hasLiaisonRevisionOnApproved ? (
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    Step 4 Revisions Requested
                  </span>
                ) : isApproved ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    Approved
                  </span>
                ) : isDraft ? (
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    Revisions Requested
                  </span>
                ) : isUnderReview ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-700" />
                    Under Review
                  </span>
                ) : (
                  'Review Guidance'
                )}
              </span>

              {notesList.length > 1 && (
                <span className="text-xs font-medium text-slate-600 tabular-nums">
                  · {notesList.length} notes in thread
                </span>
              )}
            </div>

            {/* Clean unboxed metadata subtitle */}
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Latest by <strong className="text-slate-900">{headerAuthorName}</strong>
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                {headerAuthorRole === 'super_admin' ? (
                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                ) : headerAuthorRole === 'treasurer' ? (
                  <Building2 className="w-3 h-3 text-emerald-700" />
                ) : (
                  <Shield className="w-3 h-3 text-[#1c398e]" />
                )}
                <span>{getRoleLabel(headerAuthorRole)}</span>
              </span>

              {headerTimestamp && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 tabular-nums">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formatNoteDate(headerTimestamp)}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-xl hover:bg-black/5 text-slate-600 transition cursor-pointer shrink-0"
          title={isCollapsed ? 'Expand feedback checklist' : 'Collapse feedback checklist'}
          aria-label={isCollapsed ? 'Expand feedback checklist' : 'Collapse feedback checklist'}
        >
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expandable Body */}
      {!isCollapsed && (
        <div className="mt-3.5 space-y-3">
          {/* Structured Section-by-Section Fix Checklist (Zero Vagueness for Proposal Makers) */}
          {activeLiaisonActions && activeLiaisonActions.items.length > 0 && (
            <div className="space-y-2">
              {activeLiaisonActions.items.map((item, idx) => {
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
                    className="p-3 rounded-xl bg-white border border-amber-200/90 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="font-bold text-slate-900 tabular-nums">
                          {idx + 1}. {item.sectionLabel}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="font-semibold text-amber-900">
                          SSD Q{item.questionNumber}: {item.shortTitle}
                        </span>
                      </div>
                      <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {item.instruction}
                      </p>

                      {chipInfo && (
                        <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 space-y-1 text-[11px] text-slate-700">
                          <p className="leading-snug">
                            <span className="font-bold text-slate-900">Why it matters: </span>
                            {chipInfo.whyItMatters}
                          </p>
                          {chipInfo.pointers.length > 0 && (
                            <ul className="list-disc pl-4 space-y-0.5 leading-snug">
                              {chipInfo.pointers.map((pt, pIdx) => (
                                <li key={`${item.criterionKey}_pt_${pIdx}`}>{pt}</li>
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
                      onClick={() => handleJumpToSection(item.sectionId)}
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

          {/* Latest Note Box (Shown when there is prose commentary not already covered solely by the structured checklist) */}
          {latestNote &&
            (!activeLiaisonActions ||
              activeLiaisonActions.items.length === 0 ||
              !latestNote.text.includes('Specific Changes Requested:')) && (
              <div
                className={`p-4 rounded-xl border font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${themeClasses.contentBox}`}
              >
                {latestNote.text}
              </div>
            )}

          {/* Earlier Notes History Toggle */}
          {earlierNotes.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer whitespace-nowrap"
              >
                <History className="w-3.5 h-3.5 text-[#1c398e]" />
                <span>
                  {showHistory
                    ? 'Hide previous notes'
                    : `View ${earlierNotes.length} earlier ${
                        earlierNotes.length === 1 ? 'note' : 'notes'
                      } in thread`}
                </span>
                {showHistory ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showHistory && (
                <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-200/80">
                  {earlierNotes.map((note, idx) => (
                    <div
                      key={note.id || `prev_note_${idx}`}
                      className="p-3 rounded-xl bg-white/90 border border-slate-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{note.authorName}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-slate-600 font-medium">
                            {getRoleLabel(note.authorRole)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {formatNoteDate(note.createdAt)}
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

          {/* Action guidance footer (clean typography, no decorative pulsing dots) */}
          <div className="text-[11px] text-slate-600 font-medium pt-0.5">
            {hasLiaisonRevisionOnApproved ? (
              <span>
                This proposal remains locked under Union Committee approval until your{' '}
                <strong className="text-slate-900">Union Treasurer</strong> clicks{' '}
                <strong className="text-slate-900">Reopen Review (Unlock &amp; Edit)</strong> so these section updates can be saved.
              </span>
            ) : isDraft ? (
              <span>
                Update the flagged sections directly below, then click{' '}
                <strong className="text-slate-900">Submit</strong> to resubmit to your Union.
              </span>
            ) : isApproved ? (
              <span>These official review notes are preserved in the proposal governance record.</span>
            ) : (
              <span>
                Use the <strong className="text-slate-900">Go to</strong> button above to jump directly to each section that needs an update.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
