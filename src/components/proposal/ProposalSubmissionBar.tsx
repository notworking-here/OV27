import React from 'react';
import { CheckCircle2, AlertCircle, Send, Lock } from 'lucide-react';
import { ValidationResult, ValidationError } from '../../utils/validation';

export interface ProposalSubmissionBarProps {
  validationResult: ValidationResult;
  proposalStatus?: string;
  actionNumber?: string;
  onShowValidation?: (errors: ValidationError[], completionPercentage: number) => void;
  onSubmitProposal?: () => void;
}

export function ProposalSubmissionBar({
  validationResult,
  proposalStatus,
  actionNumber,
  onShowValidation,
  onSubmitProposal,
}: ProposalSubmissionBarProps) {
  const isApproved = proposalStatus === 'approved';

  return (
    <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#f8fafc] -mx-6 md:-mx-10 -mb-6 md:-mb-10 p-6 md:px-10 rounded-b-2xl">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            validationResult.isValid
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {validationResult.isValid ? (
            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          ) : (
            <AlertCircle className="w-5 h-5 stroke-[2.5]" />
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-900">
            {isApproved
              ? validationResult.isValid
                ? 'Officially Approved & Complete (100%)'
                : `Approved Record Needs Attention (${validationResult.completionPercentage}%)`
              : validationResult.isValid
              ? 'Ready for Submission'
              : `${validationResult.completionPercentage}% Completed — All details required to submit`}
          </p>
          <p className="text-[11px] text-slate-500">
            {isApproved
              ? validationResult.isValid
                ? `Committee Action #${actionNumber || 'Voted'} verified on record. Protected against changes.`
                : `${validationResult.errors.length} required ${
                    validationResult.errors.length === 1 ? 'item is' : 'items are'
                  } incomplete. Form unlocked so you can complete details.`
              : validationResult.isValid
              ? 'Ready to submit to Union Coordinator for evaluation.'
              : `${validationResult.errors.length} required ${
                  validationResult.errors.length === 1 ? 'item must' : 'items must'
                } be completed before submission.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        {!validationResult.isValid && onShowValidation && (
          <button
            type="button"
            onClick={() =>
              onShowValidation(validationResult.errors, validationResult.completionPercentage)
            }
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Missing ({validationResult.errors.length})</span>
          </button>
        )}

        {onSubmitProposal && (!proposalStatus || proposalStatus === 'draft') && (
          <button
            type="button"
            disabled={!validationResult.isValid}
            onClick={() => {
              if (!validationResult.isValid) {
                onShowValidation?.(validationResult.errors, validationResult.completionPercentage);
                return;
              }
              onSubmitProposal();
            }}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition shadow-xs ${
              validationResult.isValid
                ? 'bg-[#1c398e] hover:bg-[#152c70] text-white ring-2 ring-blue-600/30 cursor-pointer active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/60 shadow-none'
            }`}
            title={
              validationResult.isValid
                ? 'Submit proposal to Union Coordinator'
                : `Cannot submit: ${validationResult.errors.length} required fields missing (${validationResult.completionPercentage}% complete)`
            }
          >
            {validationResult.isValid ? (
              <Send className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{validationResult.isValid ? 'Submit' : 'Submit Locked'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
