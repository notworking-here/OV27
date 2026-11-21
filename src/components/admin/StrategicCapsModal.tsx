import React from 'react';
import { Sliders, X, RotateCcw, Save, Info } from 'lucide-react';
import { STRATEGIC_PILLARS_CONFIG } from '../../types';

interface StrategicCapsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tempPillarCaps: Record<string, number>;
  onUpdatePillarCap: (pillarId: string, val: number) => void;
  onResetCaps: () => void;
  onSaveCaps: () => Promise<void>;
  isSaving: boolean;
  saveSuccess: boolean;
  tempPillarsSum: number;
}

export function StrategicCapsModal({
  isOpen,
  onClose,
  tempPillarCaps,
  onUpdatePillarCap,
  onResetCaps,
  onSaveCaps,
  isSaving,
  saveSuccess,
  tempPillarsSum,
}: StrategicCapsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#fbfcfd]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-900 rounded-xl">
              <Sliders className="w-5 h-5 text-blue-800" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Adjust Strategic Percentage Caps
              </h3>
              <p className="text-xs text-slate-500">
                Set policy benchmark limits for Pillars across OneVoice27 initiatives
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Pillar Caps Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Pillar Percentage Caps (Target Sum: 100%)
              </h4>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  tempPillarsSum === 100
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                Current Total: {tempPillarsSum}%
              </span>
            </div>

            <div className="space-y-3">
              {STRATEGIC_PILLARS_CONFIG.map((pillar) => (
                <div
                  key={pillar.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900">
                      Pillar {pillar.number}: {pillar.title}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {pillar.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={tempPillarCaps[pillar.id] ?? pillar.defaultCap}
                      onChange={(e) =>
                        onUpdatePillarCap(pillar.id, Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-24 px-3 py-1.5 text-right font-black text-sm rounded-xl bg-white border border-slate-300 outline-none focus:border-blue-500"
                    />
                    <span className="text-sm font-bold text-slate-600">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reset to defaults info */}
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Default Division Benchmark:</strong> Pillar 1 (12.50%), Pillar 2 (58.50%), Pillar 3 (29.00%). Caps serve as visual governance markers on the executive dashboard to prevent over-commitment.
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onResetCaps}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            title="Reset to default benchmark percentages"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveCaps}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{saveSuccess ? 'Saved!' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
