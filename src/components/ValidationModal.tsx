import { AlertCircle, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { ValidationError } from '../utils/validation';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: ValidationError[];
  completionPercentage: number;
  onJumpToField?: (sectionId: string) => void;
}

export function ValidationModal({
  isOpen,
  onClose,
  errors,
  completionPercentage,
  onJumpToField,
}: ValidationModalProps) {
  if (!isOpen) return null;

  const handleFixField = (sectionId: string) => {
    onClose();
    if (onJumpToField) {
      onJumpToField(sectionId);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-red-400');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-red-400');
        }, 2500);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-h-[90vh] flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-5 pb-4 border-b border-slate-100">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 shrink-0">
            <AlertCircle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="min-w-0 pr-6">
            <h2 className="text-lg font-bold text-slate-900">
              Required Fields Missing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All proposal fields and budget lines must be completed before submission to your Union Coordinator.
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-slate-600">Proposal Readiness</span>
            <span className={completionPercentage >= 80 ? 'text-emerald-600' : 'text-amber-600'}>
              {completionPercentage}% Complete
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                completionPercentage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            <strong>{errors.length}</strong> required {errors.length === 1 ? 'item needs' : 'items need'} your attention.
          </p>
        </div>

        {/* List of missing fields */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
          {errors.map((err, index) => (
            <div
              key={`${err.field}-${index}`}
              onClick={() => handleFixField(err.sectionId)}
              className="p-3 rounded-xl bg-red-50/60 hover:bg-red-50 border border-red-200/80 transition cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span className="text-xs font-bold text-slate-900">{err.label}</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 truncate">{err.message}</p>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 opacity-80 group-hover:opacity-100 shrink-0">
                <span>Fix</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            Review & Complete Proposal
          </button>
        </div>
      </div>
    </div>
  );
}
