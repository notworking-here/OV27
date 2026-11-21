import { useState, useEffect } from 'react';
import { Proposal, UserAccount } from '../../types';
import { ValidationError } from '../../utils/validation';
import { ProposalForm, ProposalFocusTarget } from '../ProposalForm';
import { ApprovedProposalSidePanel } from './ApprovedProposalSidePanel';
import { FloatingReviewNotesChat } from './FloatingReviewNotesChat';
import { useLiaisonReviewState } from './useLiaisonReviewState';
import { ArrowUp, MessageSquare } from 'lucide-react';

export interface ProposalReviewWorkspaceProps {
  proposal: Proposal;
  allProposals: Proposal[];
  currentUser: UserAccount;
  onChangeActiveProposal: (updated: Partial<Proposal>) => void;
  onUpdateProposal: (proposalId: string, updates: Partial<Proposal>) => Promise<void> | void;
  onOpenFaqTopic?: (topic: string) => void;
  onOpenAuth?: () => void;
  onOpenPrint?: () => void;
  onCopyDirectLink?: () => void;
  copiedLink?: boolean;
  onSubmitProposal?: () => void;
  onShowValidation?: (errors: ValidationError[], completionPercentage: number) => void;
  onOpenTransferProposal?: (proposal: Proposal) => void;
  isDedicatedApprovedPage: boolean;
  onOpenDedicatedApprovedPage?: () => void;
  focusTarget?: ProposalFocusTarget;
  onClearFocusTarget?: () => void;
  backTargetLabel?: string | null;
  onBack?: () => void;
  navigableProposals?: Proposal[];
  onSelectProposal?: (proposalId: string) => void;
  onOpenLiaisonGuide?: () => void;
}

/**
 * Coordinates the clean Executive Summary (left), single-home Step 4 Rubric & Vote sidebar (right),
 * and floating lower-right Review Notes chat box so liaisons can read, take notes, and vote without clutter.
 */
export function ProposalReviewWorkspace({
  proposal,
  allProposals,
  currentUser,
  onChangeActiveProposal,
  onUpdateProposal,
  onOpenFaqTopic,
  onOpenAuth,
  onOpenPrint,
  onCopyDirectLink,
  copiedLink = false,
  onSubmitProposal,
  onShowValidation,
  onOpenTransferProposal,
  isDedicatedApprovedPage,
  onOpenDedicatedApprovedPage,
  focusTarget,
  onClearFocusTarget,
  backTargetLabel,
  onBack,
  navigableProposals = [],
  onSelectProposal,
  onOpenLiaisonGuide,
}: ProposalReviewWorkspaceProps) {
  const [isNotesChatOpen, setIsNotesChatOpen] = useState(false);

  // Close floating chat when leaving dedicated view
  useEffect(() => {
    if (!isDedicatedApprovedPage) {
      setIsNotesChatOpen(false);
    }
  }, [isDedicatedApprovedPage]);

  const liaisonReview = useLiaisonReviewState({
    proposal,
    currentUser,
    onUpdateProposal,
    navigableProposals,
    focusNotes: isDedicatedApprovedPage && focusTarget === 'notes',
    onClearFocusNotes: onClearFocusTarget,
    onOpenNotesChat: () => setIsNotesChatOpen(true),
  });

  const showStep4Jump = liaisonReview.isProposalApproved || liaisonReview.isLiaison;

  return (
    <>
      {/* Main Left Column: Clean Proposal Document + Quiet Finish Bar */}
      <div className="flex-1 min-w-0 w-full space-y-6">
        <ProposalForm
          proposal={proposal}
          allProposals={allProposals}
          currentUser={currentUser}
          onChange={onChangeActiveProposal}
          onUpdateProposalImmediate={(changes) => onUpdateProposal(proposal.id, changes)}
          onOpenFaqTopic={onOpenFaqTopic}
          onOpenAuth={onOpenAuth}
          onOpenPrint={onOpenPrint}
          onSubmitProposal={onSubmitProposal}
          onShowValidation={onShowValidation}
          onOpenTransferProposal={onOpenTransferProposal}
          isDedicatedApprovedPage={isDedicatedApprovedPage}
          onOpenDedicatedApprovedPage={onOpenDedicatedApprovedPage}
          focusTarget={focusTarget && focusTarget !== 'notes' ? focusTarget : null}
          onClearFocusTarget={onClearFocusTarget}
          liaisonReview={isDedicatedApprovedPage ? liaisonReview : undefined}
        />

        {/* Quiet 1-line Finish Bar at bottom of proposal (no duplicate rubric) */}
        {isDedicatedApprovedPage && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
            <span className="font-semibold text-slate-600">
              Finished reading this proposal?
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {showStep4Jump && (
                <button
                  type="button"
                  onClick={() => liaisonReview.scrollToElement('sidebar-step4-card')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer whitespace-nowrap"
                >
                  <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {liaisonReview.canVoteStep4 ? 'Jump to Step 4 Vote' : 'Jump to Step 4 Rubric'}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsNotesChatOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs transition cursor-pointer whitespace-nowrap tabular-nums"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Review Notes ({liaisonReview.reviewNotes.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right-Hand Governance, Single-Home Step 4 Rubric & Vote, and Contacts Side Panel */}
      {isDedicatedApprovedPage && (
        <ApprovedProposalSidePanel
          proposal={proposal}
          currentUser={currentUser}
          onUpdateProposal={onUpdateProposal}
          onOpenAuth={onOpenAuth}
          onOpenPrint={onOpenPrint}
          onCopyDirectLink={onCopyDirectLink}
          copiedLink={copiedLink}
          onOpenTransferOwnership={
            currentUser.role === 'super_admin' && onOpenTransferProposal
              ? () => onOpenTransferProposal(proposal)
              : undefined
          }
          onShowValidation={onShowValidation}
          onSubmitProposal={onSubmitProposal}
          focusNotes={focusTarget === 'notes'}
          onClearFocusNotes={onClearFocusTarget}
          backTargetLabel={backTargetLabel}
          onBack={onBack}
          navigableProposals={navigableProposals}
          onSelectProposal={onSelectProposal}
          liaisonReview={liaisonReview}
          onOpenNotesChat={() => setIsNotesChatOpen(true)}
          onOpenLiaisonGuide={onOpenLiaisonGuide}
        />
      )}

      {/* Floating Lower-Right Review Notes & Remarks Chat Box */}
      {isDedicatedApprovedPage && (
        <FloatingReviewNotesChat
          currentUser={currentUser}
          liaisonReview={liaisonReview}
          isOpen={isNotesChatOpen}
          onOpenChange={setIsNotesChatOpen}
          onOpenAuth={onOpenAuth}
        />
      )}
    </>
  );
}
