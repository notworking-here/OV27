import { useEffect, useRef } from 'react';
import { UserAccount, isUserInviteeForUnion } from '../../types';
import { LiaisonReviewController } from './useLiaisonReviewState';
import { LogIn, MessageSquare, Minus, Send, X } from 'lucide-react';

export interface FloatingReviewNotesChatProps {
  currentUser: UserAccount;
  liaisonReview: LiaisonReviewController;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAuth?: () => void;
}

/**
 * Floating lower-right chat box for Review Notes & Remarks.
 * Stays accessible while liaisons read any part of the Executive Summary so they can
 * copy/paste quotes or jot remarks without scrolling away from their reading position.
 */
export function FloatingReviewNotesChat({
  currentUser,
  liaisonReview,
  isOpen,
  onOpenChange,
  onOpenAuth,
}: FloatingReviewNotesChatProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    directoryUsers,
    assignedUnion,
    unionAcronym,
    canPostNote,
    reviewNotes,
    noteText,
    setNoteText,
    isSavingNote,
    noteError,
    addNote,
  } = liaisonReview;

  // Scroll notes list to latest message when opened or when a new note arrives
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [isOpen, reviewNotes.length]);

  // Focus composer when note text is pre-populated (e.g. from coaching rubric)
  useEffect(() => {
    if (isOpen && noteText && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen, noteText]);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#1c398e] hover:bg-[#152c70] text-white shadow-xl border border-blue-400/30 transition active:scale-95 cursor-pointer"
          title="Open floating Review Notes & Remarks chat box"
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold whitespace-nowrap">Review Notes</span>
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/20 text-[11px] font-extrabold tabular-nums">
            {reviewNotes.length}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      id="proposal-review-notes"
      role="dialog"
      aria-label="Review Notes and Remarks"
      className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] sm:w-[384px] max-h-[min(78vh,520px)] bg-white rounded-2xl border border-slate-300/90 shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Floating Chat Header */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-300/30 text-amber-300 flex items-center justify-center shrink-0">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-extrabold tracking-tight truncate">
                Review Notes &amp; Remarks
              </h3>
              <span className="px-1.5 py-0.5 rounded-full bg-white/15 text-[10px] font-bold tabular-nums shrink-0">
                {reviewNotes.length}
              </span>
            </div>
            <p className="text-[10px] text-slate-300 truncate">
              Liaisons, Treasurers &amp; Project Director
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Minimize Review Notes"
            aria-label="Minimize Review Notes"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Close Review Notes"
            aria-label="Close Review Notes"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Notes Thread */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50/75 min-h-[160px]"
      >
        {reviewNotes.length > 0 ? (
          reviewNotes.map((note) => {
            const matchedLiaison =
              note.authorRole === 'division_liaison' && note.authorEmail
                ? directoryUsers.find(
                    (u) => u.email.toLowerCase() === note.authorEmail.toLowerCase()
                  )
                : undefined;
            const isNoteFromInvitee =
              note.authorRole === 'division_liaison' &&
              (Boolean(note.isInvitee) ||
                (matchedLiaison ? isUserInviteeForUnion(assignedUnion, matchedLiaison) : false));

            const roleBadge =
              note.authorRole === 'division_liaison'
                ? isNoteFromInvitee
                  ? 'Liaison · Invitee'
                  : 'Liaison · Voting'
                : note.authorRole === 'treasurer'
                ? 'Treasurer'
                : note.authorRole === 'super_admin'
                ? 'Division'
                : note.authorRole === 'coordinator'
                ? 'Coordinator'
                : 'Author';

            const isOwnNote =
              Boolean(currentUser?.email) &&
              (note.authorEmail || '').trim().toLowerCase() ===
                currentUser.email.trim().toLowerCase();

            return (
              <div
                key={note.id}
                className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                  isOwnNote
                    ? 'bg-indigo-50/70 border-indigo-200/80'
                    : 'bg-white border-slate-200/90'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 truncate text-[11px]">
                    {note.authorName}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                    {roleBadge}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-700 whitespace-pre-line leading-relaxed break-words">
                  {note.text}
                </p>
                <p className="text-[9.5px] text-slate-400 tabular-nums">
                  {new Date(note.createdAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4 space-y-1">
            <MessageSquare className="w-6 h-6 text-slate-300" />
            <p className="text-xs font-semibold text-slate-500">No review notes yet</p>
            <p className="text-[11px] text-slate-400 leading-snug">
              Keep this box open while reading to jot questions or paste quotes from the proposal.
            </p>
          </div>
        )}
      </div>

      {/* Composer Footer */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        {!currentUser?.email ? (
          onOpenAuth ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-[#1c398e]" />
              <span>Sign in to post a review note</span>
            </button>
          ) : null
        ) : canPostNote ? (
          <form onSubmit={addNote} className="space-y-2">
            <textarea
              ref={textareaRef}
              rows={2}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note or paste a quote from the proposal..."
              className="w-full px-3 py-2 rounded-xl bg-[#f8fafc] border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#1c398e] outline-none transition resize-y max-h-32"
            />
            {noteError && <p className="text-[11px] text-red-600 font-medium">{noteError}</p>}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                Visible to team &amp; officers
              </span>
              <button
                type="submit"
                disabled={!noteText.trim() || isSavingNote}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1c398e] hover:bg-[#152c70] disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3 h-3" />
                <span>{isSavingNote ? 'Saving...' : 'Post Note'}</span>
              </button>
            </div>
          </form>
        ) : (
          <p className="text-[11px] text-slate-500 text-center py-1">
            Read-only · Posting notes is restricted to the proposal team and assigned{' '}
            <strong>{unionAcronym}</strong> officers.
          </p>
        )}
      </div>
    </div>
  );
}
