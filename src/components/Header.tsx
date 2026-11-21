import React, { useState } from 'react';
import {
  Printer,
  LogIn,
  Send,
  CheckCircle2,
  User,
  HelpCircle,
  Settings,
  Menu,
  X,
  Layers,
  Lock,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { HopeChannelLogo } from './HopeChannelLogo';
import { NotificationBell } from './NotificationBell';
import { UserProfile, UserAccount, Proposal, UNION_ACRONYMS } from '../types';
import { validateProposalForSubmission, ValidationError } from '../utils/validation';

interface HeaderProps {
  userProfile: UserProfile | null;
  currentUser: UserAccount | null;
  activeProposal?: Proposal;
  currentView?: 'form' | 'hub' | 'dashboard' | 'approved' | 'monitor' | 'settings' | 'playbook';
  onSwitchView?: (view: 'form' | 'hub' | 'dashboard' | 'approved' | 'monitor' | 'settings' | 'playbook') => void;
  onUpdateProposalStatus?: (status: 'draft' | 'submitted' | 'under_review' | 'approved') => void;
  onShowValidationErrors?: (errors: ValidationError[], completionPercentage: number) => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onOpenMonitor?: () => void;
  onOpenAdminSettings?: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenPrint?: () => void;
  onOpenFaq: () => void;
  onOpenMobileProposals?: () => void;
  onOpenUnionApprovalModal?: () => void;
  onSelectProposal?: (proposalId: string) => void;
  proposalsCount?: number;
  lastSavedText: string;
  onRefreshCatalog?: () => void;
  isRefreshingCatalog?: boolean;
}

export function Header({
  userProfile,
  currentUser,
  activeProposal,
  currentView = 'form',
  onSwitchView,
  onUpdateProposalStatus,
  onShowValidationErrors,
  onOpenProfile,
  onOpenAuth,
  onOpenMonitor,
  onOpenAdminSettings,
  onOpenAdminDashboard,
  onOpenPrint,
  onOpenFaq,
  onOpenMobileProposals,
  onOpenUnionApprovalModal,
  onSelectProposal,
  proposalsCount,
  lastSavedText,
  onRefreshCatalog,
  isRefreshingCatalog,
}: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Extract union / division acronym (e.g. 'ECPUC', 'SSD', etc.)
  const activeUnion = currentUser?.union || userProfile?.division || '';
  const unionTag = activeUnion
    ? UNION_ACRONYMS[activeUnion] ||
      (activeUnion.includes('Union')
        ? activeUnion.replace(/(Union Conference|Union Mission|Conference|Mission)/g, '').trim()
        : activeUnion.split(' ')[0])
    : 'SSD';

  const userDisplayName = currentUser?.displayName || userProfile?.name || 'Adventist Leader';
  const role = currentUser?.role || 'user';
  const isSuperAdmin = role === 'super_admin';
  const isCoordinator = role === 'coordinator';
  const isTreasurer = role === 'treasurer';
  const isLiaison = role === 'division_liaison';
  const hasHubAccess = isSuperAdmin || isCoordinator || isTreasurer || isLiaison;
  const hasDashboardAccess = hasHubAccess || Boolean(currentUser?.email);
  const currentStatus = activeProposal?.status || 'draft';

  // Determine submit button action for draft author submissions
  const handleSubmitAction = () => {
    if (!onUpdateProposalStatus) return;

    if (currentStatus === 'draft') {
      // Validate all required fields before allowing submission
      if (activeProposal) {
        const validation = validateProposalForSubmission(activeProposal);
        if (!validation.isValid) {
          if (onShowValidationErrors) {
            onShowValidationErrors(validation.errors, validation.completionPercentage);
          }
          return;
        }
      }

      // Any user submits their draft to their Union Coordinator
      onUpdateProposalStatus('submitted');
    }
  };

  const closeMobileMenuAndExecute = (action: () => void) => {
    setIsMobileMenuOpen(false);
    action();
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-colors no-print">
      <div className="max-w-[1536px] w-full mx-auto px-3 sm:px-5 lg:px-6 xl:px-8 h-16 flex items-center justify-between gap-2 lg:gap-3">
        {/* Left Zone: Logo & Clean Brand Identity */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div
            className="shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Scroll to top"
          >
            <HopeChannelLogo className="w-9 h-9 sm:w-10 sm:h-10 shadow-xs" />
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#1c398e] shrink-0">
            SSD OneVoice27
          </h1>
        </div>

        {/* Center Zone: Primary Workspace Switcher (Clean Typography, Zero Decorative Icons) */}
        {hasDashboardAccess && (
          <div className="hidden md:flex flex-1 items-center justify-center px-1 min-w-0 shrink-0">
            <nav
              aria-label="Main Navigation"
              className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/90 shrink-0"
            >
              {hasHubAccess && (
                <>
                  <button
                    type="button"
                    onClick={() => onSwitchView?.('monitor')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                      currentView === 'monitor'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/90'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title="Executive Monitor: Territorial budget caps, utilization, and pipeline risk"
                  >
                    Monitor
                  </button>

                  <button
                    type="button"
                    onClick={() => onSwitchView?.('hub')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                      currentView === 'hub'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/90'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title="Review Hub: Track pipeline, inspect proposals, and verify committee actions"
                  >
                    Review Hub
                  </button>

                  <button
                    type="button"
                    onClick={() => onSwitchView?.('approved')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                      currentView === 'approved'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/90'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                    title="Approved Proposals: Official 5-Step governance register & shared budget attribution"
                  >
                    Approved
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => onSwitchView?.('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                  currentView === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="OneVoice Dashboard: Impact metrics, audience investment, and strategic objective charts"
              >
                Dashboard
              </button>

              <button
                type="button"
                onClick={() => onSwitchView?.('form')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                  currentView === 'form'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="Proposal Editor: Draft, edit, and inspect proposal sections 1–9"
              >
                Editor
              </button>
            </nav>
          </div>
        )}

        {/* Right Zone: Unified Desktop Utility & Account Controls */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0 text-xs">
          {/* Icon-Only Cloud Sync Trigger with Hover Status Tooltip */}
          {onRefreshCatalog ? (
            <button
              type="button"
              onClick={onRefreshCatalog}
              disabled={isRefreshingCatalog}
              className="hidden lg:inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer disabled:opacity-40"
              title={`Sync status: ${lastSavedText} · Click to refresh proposals catalog`}
              aria-label={`Sync status: ${lastSavedText}. Click to refresh`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  lastSavedText.includes('Quota')
                    ? 'bg-amber-500'
                    : lastSavedText.includes('Saving')
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-500'
                }`}
              />
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshingCatalog ? 'animate-spin text-[#1c398e]' : ''}`}
              />
            </button>
          ) : (
            <span
              className="hidden lg:inline-flex items-center justify-center w-7 h-7 rounded-lg"
              title={`Sync status: ${lastSavedText}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  lastSavedText.includes('Quota')
                    ? 'bg-amber-500'
                    : lastSavedText.includes('Saving')
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-500'
                }`}
              />
            </span>
          )}

          {/* Notification Bell */}
          <NotificationBell
            currentUser={currentUser}
            onSelectProposal={onSelectProposal || (() => {})}
          />

          {/* Strategy Playbook & FAQs Page Button */}
          <button
            type="button"
            onClick={onOpenFaq}
            className={`inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-xl font-semibold transition cursor-pointer ${
              currentView === 'playbook'
                ? 'bg-[#1c398e] text-white shadow-xs font-bold border border-[#1c398e]'
                : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title="Open OneVoice27 Playbook & Strategy FAQs"
          >
            <HelpCircle
              className={`w-3.5 h-3.5 shrink-0 ${
                currentView === 'playbook' ? 'text-amber-300' : 'text-slate-500'
              }`}
            />
            <span className="hidden xl:inline">Playbook</span>
          </button>

          {/* Super Admin Settings Button */}
          {currentUser?.role === 'super_admin' && currentUser?.email && (
            <button
              type="button"
              onClick={onOpenAdminSettings}
              className={`inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-xl transition cursor-pointer ${
                currentView === 'settings'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold'
              }`}
              title="General Settings: Manage Roles, Union Budget Allocation, and Audit Logs"
            >
              <Settings className={`w-3.5 h-3.5 shrink-0 ${currentView === 'settings' ? 'text-white' : 'text-slate-500'}`} />
              <span className="hidden xl:inline">Settings</span>
            </button>
          )}

          {/* User Account / Role Switcher (Combines Name + Compact Role Context) */}
          {currentUser && currentUser.email ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 xl:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-800 font-semibold transition cursor-pointer"
              title={`${userDisplayName} (${
                isSuperAdmin
                  ? 'Division Admin · All Unions'
                  : isTreasurer
                  ? `Treasurer · ${activeUnion || unionTag}`
                  : isCoordinator
                  ? `Coordinator · ${activeUnion || unionTag}`
                  : isLiaison
                  ? `Division Liaison · ${activeUnion || unionTag}`
                  : `Director · ${activeUnion || unionTag}`
              }) — Click to manage account or switch role`}
            >
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={userDisplayName}
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
              <span className="truncate max-w-[95px] xl:max-w-[135px]">
                {userDisplayName}
              </span>
              <span className="hidden xl:inline text-[11px] font-medium text-slate-500 shrink-0">
                ·{' '}
                {isSuperAdmin
                  ? 'Admin'
                  : isTreasurer
                  ? `Treas (${unionTag})`
                  : isCoordinator
                  ? `Coord (${unionTag})`
                  : isLiaison
                  ? 'Liaison'
                  : unionTag}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-semibold transition cursor-pointer shadow-xs"
                title="Sign in or register your director account"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Header Quick Actions (visible only on mobile/tablet) */}
        <div className="flex md:hidden items-center gap-1.5">
          {/* Quick Proposals Switcher Trigger (Mobile) */}
          {onOpenMobileProposals && (
            <button
              type="button"
              onClick={onOpenMobileProposals}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[#1c398e] font-semibold text-xs transition active:scale-95"
              title="Browse all proposals"
            >
              <Layers className="w-3.5 h-3.5 text-[#1c398e]" />
              <span>Proposals</span>
              {typeof proposalsCount === 'number' && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#1c398e] text-white text-[10px] font-bold">
                  {proposalsCount}
                </span>
              )}
            </button>
          )}

          {/* Mobile Submit Button if in Draft */}
          {currentStatus === 'draft' && (
            <button
              type="button"
              onClick={handleSubmitAction}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1c398e] text-white font-semibold text-xs shadow-xs active:scale-95"
              title="Submit proposal"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Submit</span>
            </button>
          )}

          {/* Mobile Notification Bell */}
          <NotificationBell
            currentUser={currentUser}
            onSelectProposal={onSelectProposal || (() => {})}
          />

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition active:scale-95"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Slide-down Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
          {/* Cloud Sync & User Profile */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={userDisplayName}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[190px]">
                  {userDisplayName}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {currentUser?.email || 'Guest Session'}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile View Switcher */}
          {hasDashboardAccess && (
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
              {hasHubAccess && (
                <>
                  <button
                    type="button"
                    onClick={() => closeMobileMenuAndExecute(() => onSwitchView?.('monitor'))}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-xl transition ${
                      currentView === 'monitor'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Monitor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => closeMobileMenuAndExecute(() => onSwitchView?.('hub'))}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-xl transition ${
                      currentView === 'hub'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Review Hub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => closeMobileMenuAndExecute(() => onSwitchView?.('approved'))}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-xl transition ${
                      currentView === 'approved'
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Approved</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => closeMobileMenuAndExecute(() => onSwitchView?.('dashboard'))}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-xl transition ${
                  currentView === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => closeMobileMenuAndExecute(() => onSwitchView?.('form'))}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-xl transition ${
                  currentView === 'form'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Editor</span>
              </button>
            </div>
          )}

          {/* Mobile Review Actions (Only when directly viewing / editing a proposal in Form view) */}
          {currentView === 'form' && activeProposal && (
            <>
              {currentStatus === 'submitted' && (
                <div className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 font-semibold text-xs">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>Submitted to Union</span>
                </div>
              )}

              {currentStatus === 'under_review' && (
                <div className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-xs">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>In Review</span>
                </div>
              )}

              {currentStatus === 'approved' && (
                <div className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Approved</span>
                </div>
              )}
            </>
          )}

          {/* Primary Mobile Navigation Actions Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Account / Switch Role */}
            <button
              type="button"
              onClick={() => closeMobileMenuAndExecute(onOpenAuth)}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
            >
              {currentUser?.email ? (
                <>
                  <User className="w-4 h-4 text-[#1c398e]" />
                  <span>Account</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-[#1c398e]" />
                  <span>Sign In</span>
                </>
              )}
            </button>

            {/* Print / PDF (Only in Proposal view) */}
            {currentView === 'form' && onOpenPrint && (
              <button
                type="button"
                onClick={() => closeMobileMenuAndExecute(currentUser?.email ? onOpenPrint : onOpenAuth)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
              >
                {currentUser?.email ? (
                  <Printer className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
                <span>Print</span>
              </button>
            )}

            {/* Playbook & FAQs */}
            <button
              type="button"
              onClick={() => closeMobileMenuAndExecute(onOpenFaq)}
              className={`flex items-center gap-2 p-2.5 rounded-xl font-semibold border ${
                currentView === 'playbook'
                  ? 'bg-[#1c398e] text-white border-[#1c398e]'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              <HelpCircle
                className={`w-4 h-4 ${
                  currentView === 'playbook' ? 'text-amber-300' : 'text-amber-600'
                }`}
              />
              <span>Playbook &amp; FAQs</span>
            </button>

            {/* Director Profile / Onboarding */}
            <button
              type="button"
              onClick={() => closeMobileMenuAndExecute(onOpenProfile)}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
            >
              <User className="w-4 h-4 text-blue-600" />
              <span>Director Profile</span>
            </button>
          </div>

          {/* Super Admin Special Options */}
          {currentUser?.role === 'super_admin' && currentUser?.email && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Division Admin Tools
              </p>
              <button
                type="button"
                onClick={() => closeMobileMenuAndExecute(onOpenAdminSettings || (() => {}))}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-50 text-amber-900 font-semibold text-xs border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
              >
                <Settings className="w-4 h-4 text-amber-700" />
                <span>General Settings (Budgets & Roles)</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

