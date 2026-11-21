import React, { useState } from 'react';
import { HopeChannelLogo } from '../HopeChannelLogo';
import { ShieldCheck, Eye, LogIn, RefreshCw, CheckCircle2 } from 'lucide-react';

interface StakeholderHeaderProps {
  onExitQuickview: () => void;
  onOpenAuth: () => void;
  onRefreshData?: () => Promise<void> | void;
  isRefreshing?: boolean;
  lastSyncedAt?: string;
}

export function StakeholderHeader({
  onExitQuickview,
  onOpenAuth,
  onRefreshData,
  isRefreshing = false,
  lastSyncedAt,
}: StakeholderHeaderProps) {
  const [justSynced, setJustSynced] = useState(false);

  const handleSyncClick = async () => {
    if (!onRefreshData || isRefreshing) return;
    try {
      await onRefreshData();
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 3000);
    } catch {
      // ignore
    }
  };

  const formattedTime = lastSyncedAt
    ? (() => {
        try {
          const date = new Date(lastSyncedAt);
          if (isNaN(date.getTime())) return null;
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-[1536px] mx-auto px-3 sm:px-5 lg:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#1c398e] flex items-center justify-center shadow-xs shrink-0 p-1.5">
            <HopeChannelLogo className="w-full h-full text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-slate-900 truncate">
                SSD OneVoice27
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                <Eye className="w-3 h-3 text-amber-600" />
                Stakeholder Quickview
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block truncate">
              Public Division Monitor · Read-Only Access
            </p>
          </div>
        </div>

        {/* Status, Sync Button & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Sync Status & Last Updated */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 font-medium bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/70">
            <span className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
            <span>
              {isRefreshing
                ? 'Syncing Cloud...'
                : justSynced
                ? 'Synced with Server'
                : formattedTime
                ? `Updated ${formattedTime}`
                : 'Live Governance Sync'}
            </span>
          </div>

          {/* Dedicated 1-Click Sync Latest Data Button */}
          {onRefreshData && (
            <button
              onClick={handleSyncClick}
              disabled={isRefreshing}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                justSynced
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-700 border-slate-200 shadow-2xs active:scale-95'
              } disabled:opacity-60`}
              title="Force fetch latest proposals and allocations directly from the server, clearing local browser cache"
            >
              {justSynced ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden xs:inline">Synced</span>
                </>
              ) : (
                <>
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Sync Latest'}</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onExitQuickview}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            title="Exit stakeholder view and return to standard portal"
          >
            Exit
          </button>

          <button
            onClick={onOpenAuth}
            className="px-3.5 py-1.5 text-xs font-bold bg-[#1c398e] hover:bg-[#152c70] text-white rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Sign in with an authorized union or division staff account"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Staff Sign In</span>
            <span className="sm:hidden">Login</span>
          </button>
        </div>
      </div>
    </header>
  );
}
