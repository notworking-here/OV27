import React from 'react';
import { LogIn, ShieldCheck, Lock, FileCheck2, AlertTriangle } from 'lucide-react';
import { HopeChannelLogo } from './HopeChannelLogo';

interface LoginLandingPageProps {
  onOpenAuth: () => void;
  isAuthChecking?: boolean;
  hasProposalDeepLink?: boolean;
  hasInvalidStakeholderLink?: boolean;
}

export function LoginLandingPage({
  onOpenAuth,
  isAuthChecking = false,
  hasProposalDeepLink = false,
  hasInvalidStakeholderLink = false,
}: LoginLandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-slate-900">
      {/* Minimal Top Bar */}
      <header className="bg-white border-b border-slate-200/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#1c398e] flex items-center justify-center p-1.5 shrink-0">
              <HopeChannelLogo className="w-full h-full text-white" />
            </div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              SSD OneVoice27
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenAuth}
            disabled={isAuthChecking}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span>Sign In</span>
          </button>
        </div>
      </header>

      {/* Main Centered Access Gate */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 sm:p-10 space-y-6">
          {isAuthChecking ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-8 h-8 border-3 border-[#1c398e] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-800">
                Verifying your session...
              </p>
              <p className="text-xs text-slate-500">
                Checking authorized credentials for SSD OneVoice27
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#1c398e]">
                  Southern Asia-Pacific Division · Proposal Portal
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  Sign in to access OneVoice27 proposals
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Authorized union directors, coordinators, treasurers, division liaisons, and
                  administrators must sign in to view, draft, or review strategic proposals.
                </p>
              </div>

              {hasInvalidStakeholderLink && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-relaxed">
                    <p className="font-semibold">
                      Stakeholder Quickview link is missing an access key or is invalid
                    </p>
                    <p className="text-amber-900/90">
                      This dashboard requires the full private link shared by Division Administration.
                      Request an updated link or sign in with your staff account below.
                    </p>
                  </div>
                </div>
              )}

              {hasProposalDeepLink && !hasInvalidStakeholderLink && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-950 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-[#1c398e] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Please sign in with an authorized account to open the requested proposal.
                  </p>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Sign In with Google or Email</span>
                </button>
              </div>

              <div className="pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Lock className="w-3.5 h-3.5 text-[#1c398e] shrink-0" />
                    <span>Protected Records</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Proposals and budgets are hidden until verified sign-in.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#1c398e] shrink-0" />
                    <span>Territory Scoped</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Access is matched automatically to your assigned union or role.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#1c398e] shrink-0" />
                    <span>Step 1–6 Workflow</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Drafting, union review, liaison voting, and division action.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="py-5 px-4 text-center text-xs text-slate-500">
        Southern Asia-Pacific Division · OneVoice27 Strategic Proposal System
      </footer>
    </div>
  );
}
