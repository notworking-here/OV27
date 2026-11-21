import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ShieldCheck, Lock, Globe, ExternalLink, RefreshCw, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  fetchPublicMonitorShareToken,
  rotatePublicMonitorShareToken,
} from '../../services/publicMonitorService';

interface ShareQuickviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncNow?: (explicitToken?: string | null) => Promise<boolean | void> | void;
  territoriesCount?: number;
  projectsCount?: number;
}

export function ShareQuickviewModal({
  isOpen,
  onClose,
  onSyncNow,
  territoriesCount = 14,
  projectsCount = 0,
}: ShareQuickviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [syncConfirmed, setSyncConfirmed] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  // Fetch secret share token and push immediate sync to cloud on modal open
  useEffect(() => {
    let active = true;
    if (isOpen) {
      setIsSyncing(true);
      setSyncConfirmed(false);
      (async () => {
        try {
          const token = await fetchPublicMonitorShareToken(true);
          if (active) setShareToken(token);
          if (onSyncNow) {
            await onSyncNow(token);
            if (active) setSyncConfirmed(true);
          }
        } finally {
          if (active) setIsSyncing(false);
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Construct private tokenized URL: ?view=public-monitor&key=<secret_token>
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const shareableUrl = shareToken
    ? `${origin}${pathname}?view=public-monitor&key=${encodeURIComponent(shareToken)}`
    : '';

  const handleCopy = async () => {
    if (!shareableUrl) return;
    if (onSyncNow) {
      setIsSyncing(true);
      Promise.resolve(onSyncNow(shareToken)).finally(() => {
        setIsSyncing(false);
        setSyncConfirmed(true);
      });
    }
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareableUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleRegenerateLink = async () => {
    if (isRotating || isSyncing) return;
    setIsRotating(true);
    setSyncConfirmed(false);
    setCopied(false);
    try {
      const nextToken = await rotatePublicMonitorShareToken();
      if (nextToken) {
        setShareToken(nextToken);
        if (onSyncNow) {
          await onSyncNow(nextToken);
        }
        setSyncConfirmed(true);
      }
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-linear-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#1c398e] text-white rounded-xl shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Private Stakeholder Quickview Link</h3>
              <p className="text-xs text-slate-500">Admin-issued tokenized URL · Revocable anytime</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Live Cloud Snapshot Status Banner */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {isSyncing || isRotating ? (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <span className="font-semibold text-slate-700 truncate">
                {isRotating
                  ? 'Rotating secret link & revoking previous URL...'
                  : isSyncing
                  ? 'Publishing live division snapshot to cloud...'
                  : syncConfirmed
                  ? `Snapshot live (${territoriesCount} territories · ${projectsCount} proposals)`
                  : `Ready to share (${territoriesCount} territories · ${projectsCount} proposals)`}
              </span>
            </div>
            {onSyncNow && !isSyncing && !isRotating && (
              <button
                type="button"
                onClick={async () => {
                  setIsSyncing(true);
                  await onSyncNow(shareToken);
                  setIsSyncing(false);
                  setSyncConfirmed(true);
                }}
                className="text-[11px] font-bold text-[#1c398e] hover:underline cursor-pointer shrink-0"
              >
                Publish Now
              </button>
            )}
          </div>

          {/* Link Box */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Private Admin-Only Quickview URL
              </label>
              <button
                type="button"
                onClick={handleRegenerateLink}
                disabled={isRotating || isSyncing}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                title="Invalidate the current link immediately and generate a new secret token"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Regenerate / Revoke Link</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareableUrl || 'Generating private access link...'}
                className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono select-all focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
              <button
                onClick={handleCopy}
                disabled={!shareableUrl || isRotating}
                className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#1c398e] hover:bg-[#152c70] text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Only visitors with this exact secret key URL can open the read-only monitor without signing in.
            </p>
          </div>

          {/* Privacy & Scope Callout */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>What Stakeholders Can View:</span>
              </div>
              <ul className="list-disc list-inside text-emerald-800 space-y-0.5 pl-1 leading-relaxed">
                <li>Division Strategic Pillars overview & progress against benchmark caps</li>
                <li>Quantified Mission Targets & Projected Impact across all 5 Strategic Focus areas</li>
                <li>Missional Investment & Unit Economics (Frontline Outreach C–D–E vs Church Equipping A–B)</li>
                <li>Territory budget utilization, SSD grant, and union match pledges across all 14 territories</li>
                <li>Approved & submitted project summaries (unpublished drafts are excluded)</li>
                <li>Assigned Union Officers & Division Liaison leadership directory</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Protected & Inaccessible to Stakeholders:</span>
              </div>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5 pl-1 leading-relaxed">
                <li>Unauthenticated visitors without the secret link see only the Sign-In portal</li>
                <li>No access to full proposal narratives, personal contact phones/emails, or unpublished drafts</li>
                <li>No access to Review Hub, internal reviewer remarks, or committee minutes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
          {shareToken ? (
            <a
              href={`${pathname}?view=public-monitor&key=${encodeURIComponent(shareToken)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#1c398e] hover:text-blue-800 flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open preview in new tab</span>
            </a>
          ) : (
            <span className="text-xs text-slate-400">Preparing private link...</span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
