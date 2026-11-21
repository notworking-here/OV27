import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X, Loader2, DollarSign } from 'lucide-react';
import { Proposal, UNION_ACRONYMS } from '../types';

interface DeleteProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  proposal: Proposal | null;
  isDeleting?: boolean;
}

export function DeleteProposalModal({
  isOpen,
  onClose,
  onConfirm,
  proposal,
  isDeleting = false,
}: DeleteProposalModalProps) {
  // Listen for Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !proposal) return null;

  const displayTitle = proposal.title?.trim() || 'Untitled proposal';
  const unionName =
    UNION_ACRONYMS[proposal.union] ||
    proposal.union?.replace(/(Union Conference|Union Mission|Conference|Mission)/g, '').trim() ||
    proposal.union ||
    'Unassigned';

  const totalBudget = (proposal.budgetItems || []).reduce(
    (sum, item) =>
      sum + (Number(item.divisionFunding ?? item.gcFunding) || 0) + (Number(item.localFunding) || 0),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-proposal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header with Icon and Close Button */}
        <div className="p-6 pb-4 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <h3
              id="delete-proposal-title"
              className="text-lg font-bold text-slate-900 leading-snug"
            >
              Delete Proposal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              This action cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Proposal Details Card */}
        <div className="px-6 py-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Proposal to remove
            </p>
            <h4 className="text-sm font-bold text-slate-900 line-clamp-2 mb-2">
              {displayTitle}
            </h4>

            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
              {unionName && (
                <span className="px-2 py-0.5 rounded-md font-semibold bg-blue-50 text-[#1c398e] border border-blue-200/60 text-[11px]">
                  {unionName}
                </span>
              )}

              {proposal.status && (
                <span
                  className={`px-2 py-0.5 rounded-md font-semibold text-[11px] capitalize border ${
                    proposal.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : proposal.status === 'under_review'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : proposal.status === 'submitted'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {proposal.status.replace('_', ' ')}
                </span>
              )}

              {totalBudget > 0 && (
                <span className="inline-flex items-center gap-0.5 text-slate-700 font-medium text-[11px]">
                  <DollarSign className="w-3 h-3 text-slate-400" />
                  {totalBudget.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5 mt-3 text-xs text-rose-700 bg-rose-50/80 border border-rose-200/60 p-3 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <p>
              Are you sure you want to delete this proposal? It will be permanently removed from your proposal list and database records.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
