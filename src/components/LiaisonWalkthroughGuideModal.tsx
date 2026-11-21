import React, { useEffect } from 'react';
import {
  X,
  Printer,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ClipboardCheck,
  ShieldCheck,
  Compass,
  ArrowRight,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import { REVIEW_FRAMEWORK_PDF_URL } from '../utils/projectReviewFramework';

export interface LiaisonWalkthroughGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RUBRIC_ROWS = [
  {
    q: 'Q1',
    title: 'Primary Pillar & Budget Use',
    check:
      'Do the Strategic Pillar, Deliverable (Sec 6), and Budget lines (Sec 9) tell the same story?',
  },
  {
    q: 'Q2',
    title: 'Pathway Stage Contribution',
    check:
      'Does the project advance one clear Mission Pathway stage matching its Global Objective and KPI (Sec 5)?',
  },
  {
    q: 'Q3',
    title: 'Input & Baseline Context',
    check:
      'Are the target audiences (Sec 7) and starting local context or numbers (Sec 2) clear and consistent?',
  },
  {
    q: 'Q4',
    title: 'Core Activity & Safeguards',
    check:
      'Are the planned steps practical (Sec 3 & 6) and aligned with SSD ethical and voluntary-help safeguards?',
  },
  {
    q: 'Q5',
    title: 'Verifiable Stage Output',
    check:
      'Does the proposal measure real people taking action or concrete outputs—not just passive views?',
  },
  {
    q: 'Q6',
    title: 'Named Onward Handoff',
    check:
      'Does Section 8 name the local church, pastor, or care team who will receive contacts or tools next?',
  },
  {
    q: 'Q7',
    title: 'Sustained Continuity',
    check:
      'Is there a realistic plan for ongoing follow-up or ministry use after the grant or event finishes?',
  },
];

const TROUBLESHOOTING_ROWS = [
  {
    issue: 'My assigned Union is missing',
    action:
      'Open the Union dropdown and check both Your Voting Unions and Invitee Unions. If your Union is still missing, contact the Portal Administrator before reviewing.',
  },
  {
    issue: 'I do not see Vote buttons on a proposal',
    action:
      'Check the Step 4 card—if it shows Invitee Access · View & Comment Only, you can still post helpful remarks in Review Notes, while the named Voting Liaisons cast the Step 4 vote.',
  },
  {
    issue: 'A Union says they cannot edit after my Revision Request',
    action:
      'Remind the Union Treasurer to open the proposal and click Reopen Review in the right panel. That unlocks the form for edits and re-submission.',
  },
  {
    issue: 'A System Alignment warning does not apply here',
    action:
      'Do not block a ready proposal. Click Vote & Recommend to OV27, select or type the brief reason in the confirmation popup, and submit—Division Treasury sees your rationale automatically.',
  },
  {
    issue: 'I voted by mistake or the Union updated the proposal',
    action:
      'Click Edit Vote inside the Step 4 card (available anytime before Step 5 SSD OV27 Committee Authorization).',
  },
  {
    issue: 'Policy, safeguarding, or conflict-of-interest concern',
    action:
      'Do not guess—post a clear note or escalate directly to the Division Coordinator or Portal Administrator before voting.',
  },
];

export function LiaisonWalkthroughGuideModal({
  isOpen,
  onClose,
}: LiaisonWalkthroughGuideModalProps) {
  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove('print-modal-active');
      return;
    }
    document.body.classList.add('print-modal-active');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('print-modal-active');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = 'OneVoice27_Division_Liaison_Walkthrough_Guide_4p';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 600);
  };

  return (
    <div
      className="print-modal-backdrop fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:block print:overflow-visible"
      role="dialog"
      aria-modal="true"
      aria-labelledby="liaison-guide-modal-title"
    >
      <div className="print-modal-shell relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-2 border border-slate-200 print:border-none print:shadow-none print:my-0 print:p-0 print:rounded-none print:max-w-none print:w-full">
        {/* Sticky Screen-Only Toolbar */}
        <div className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-r from-[#182747] to-[#1c398e] text-white border-b border-blue-900/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 id="liaison-guide-modal-title" className="text-sm font-extrabold truncate">
                OneVoice27 Division Liaison Walkthrough Guide
              </h2>
              <p className="text-[11px] text-blue-200 truncate">
                4-page print-ready edition · Matches the live Step 4 review &amp; voting portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={REVIEW_FRAMEWORK_PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition whitespace-nowrap"
            >
              <span>7-Question Rubric PDF</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-blue-100 hover:text-white hover:bg-white/15 transition cursor-pointer"
              aria-label="Close guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable 4-Page Document Body */}
        <div
          id="printable-liaison-guide"
          className="bg-slate-100/80 print:bg-white p-4 sm:p-8 print:p-0 space-y-6 print:space-y-0 text-slate-800"
        >
          {/* ============================================================== */}
          {/* PAGE 1 — YOUR ROLE & GETTING STARTED                           */}
          {/* ============================================================== */}
          <section className="bg-white rounded-2xl print:rounded-none border border-slate-200 print:border-none shadow-sm print:shadow-none p-6 sm:p-8 print:p-0 space-y-5">
            {/* Official Masthead */}
            <div className="border-b-2 border-[#1c398e] pb-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest text-[#1c398e]">
                  <span>Southern Asia-Pacific Division (SSD) · OneVoice27</span>
                </div>
                <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-[#182747] leading-tight">
                  OneVoice27 Proposal Review &amp; Voting Guide
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-600">
                  Quick Walkthrough for Division Liaisons &amp; Invitee Liaisons · 4-Page Edition
                </p>
              </div>
              <div className="flex flex-col items-end shrink-0 gap-1">
                <img
                  src="/adventist-symbol.png"
                  alt="Seventh-day Adventist Symbol"
                  className="w-10 h-10 object-contain opacity-90"
                />
                <span className="text-[10px] font-bold text-slate-500">
                  ov27.hopestartshere.asia
                </span>
              </div>
            </div>

            {/* Role Summary & Governance Reminder */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-7 p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e]">
                  Your Role in One Sentence
                </p>
                <p className="text-xs leading-relaxed text-slate-700">
                  As a <strong>Division Liaison</strong>, you review Union-voted proposals, coach
                  and assist the Union where clarity is needed, and cast your{' '}
                  <strong>Step 4 vote</strong> to advance ready proposals to the{' '}
                  <strong>SSD OV27 Committee (Step 5)</strong>.
                </p>
              </div>
              <div className="md:col-span-5 p-4 rounded-xl bg-amber-50/85 border border-amber-300 space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Important Governance Reminder</span>
                </p>
                <p className="text-xs leading-snug text-amber-950 font-semibold">
                  A Liaison vote <strong>recommends</strong> a proposal to Step 5. It is{' '}
                  <strong>not</strong> final project authorization and does not release funds.
                </p>
              </div>
            </div>

            {/* Visual 6-Step Governance Pipeline */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 break-inside-avoid">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Where Your Vote Fits · 6-Step Governance Pipeline
                </span>
                <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                  Your Stage: Step 4
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 text-center">
                {[
                  { num: '1', label: 'Submitted', tone: 'done' },
                  { num: '2', label: 'Union Review', tone: 'done' },
                  { num: '3', label: 'Union Voted', tone: 'done' },
                  { num: '4', label: 'Liaison Vote (You)', tone: 'active' },
                  { num: '5', label: 'SSD OV27 Committee', tone: 'next' },
                  { num: '6', label: 'Base Survey & Eval', tone: 'next' },
                ].map((step) => (
                  <div
                    key={step.num}
                    className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 ${
                      step.tone === 'active'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : step.tone === 'done'
                        ? 'bg-emerald-50/80 text-emerald-950 border-emerald-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                        step.tone === 'active'
                          ? 'bg-white text-indigo-700'
                          : step.tone === 'done'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {step.num}
                    </span>
                    <span className="text-[9.5px] font-bold leading-tight">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Voting Access vs Invitee Access */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 break-inside-avoid">
              <div className="p-3.5 rounded-xl bg-indigo-50/55 border border-indigo-200/90 space-y-1">
                <p className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <span>Voting Unions (Assigned to You)</span>
                </p>
                <p className="text-[11px] text-slate-700 leading-snug">
                  You can inspect proposals, flag rubric items, post review notes, and cast formal
                  Step 4 votes (<strong>Vote &amp; Recommend</strong> or{' '}
                  <strong>Request Revision</strong>).
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1">
                <p className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>Invitee Unions (View &amp; Comment Only)</span>
                </p>
                <p className="text-[11px] text-slate-700 leading-snug">
                  You can read proposals and post helpful comments in <strong>Review Notes</strong>,
                  while formal voting is reserved for that Union&rsquo;s named Voting Liaisons.
                </p>
              </div>
            </div>

            {/* Step 1: Sign In & Open Your Voting Queue */}
            <div className="space-y-3 break-inside-avoid">
              <h2 className="text-sm font-black text-[#182747] border-l-4 border-[#1c398e] pl-2.5">
                Step 1 · Sign In &amp; Open Your Voting Queue
              </h2>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700 leading-snug">
                <li>
                  Open <strong>ov27.hopestartshere.asia</strong> and click <strong>Sign In</strong>{' '}
                  using your assigned Liaison account.
                </li>
                <li>
                  Confirm your name and the <strong>Division Liaison</strong> badge appear in the
                  top-right header.
                </li>
                <li>
                  The portal opens directly to the <strong>Approved</strong> page with{' '}
                  <strong>Your Step 4 Voting Queue</strong> at the top:
                  <span className="block mt-1 text-[11px] text-slate-600">
                    Click <strong>Start Reviewing →</strong> to open your first unvoted proposal
                    immediately, or use the <strong>Needs My Vote</strong> filter and the grouped{' '}
                    <strong>Union dropdown</strong> (<em>Voting Unions</em> vs.{' '}
                    <em>Invitee Unions</em>).
                  </span>
                </li>
              </ol>

              {/* Print-Safe Schematic of the Approved Page Queue Banner */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 border-b border-indigo-200/70 pb-2">
                  <span className="font-extrabold text-[#182747]">
                    Portal Preview · Approved Proposals Screen
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-slate-700">
                      Union Selector (Voting / Invitee)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 border border-indigo-300 font-bold text-indigo-900">
                      Division Liaison
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border border-indigo-200 p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-[11px] font-extrabold text-indigo-950">
                        4 proposals await your Step 4 Liaison vote
                      </p>
                      <p className="text-[10px] text-slate-600">
                        Step straight through your queue with the built-in 7-Question Rubric.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-indigo-200 text-[10px] font-bold text-indigo-900">
                      Filter Queue · Needs My Vote
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold">
                      <span>Start Reviewing</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Page 1 Footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span>OneVoice27 Division Liaison Walkthrough Guide</span>
              <span>Page 1 of 4 · ov27.hopestartshere.asia</span>
            </div>
          </section>

          {/* ============================================================== */}
          {/* PAGE 2 — 3-ZONE WORKSPACE & 7-QUESTION RUBRIC                  */}
          {/* ============================================================== */}
          <section className="break-before-page bg-white rounded-2xl print:rounded-none border border-slate-200 print:border-none shadow-sm print:shadow-none p-6 sm:p-8 print:p-0 space-y-5">
            {/* Running Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] font-bold text-slate-500">
              <span className="text-[#1c398e] uppercase tracking-wider">
                OneVoice27 Liaison Guide · Reviewing a Proposal
              </span>
              <span>Page 2 of 4</span>
            </div>

            {/* 3-Zone Workspace Map */}
            <div className="space-y-3 break-inside-avoid">
              <h2 className="text-sm font-black text-[#182747] border-l-4 border-[#1c398e] pl-2.5">
                How the Proposal Screen Works (3 Clean Zones)
              </h2>
              <p className="text-xs text-slate-600 leading-snug">
                When you open an Approved Proposal, everything you need is arranged in three
                non-overlapping zones so you never lose your reading position:
              </p>

              {/* Visual Schematic of the 3 Zones */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="grid grid-cols-12 gap-3">
                  {/* Left: Executive Summary */}
                  <div className="col-span-7 bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-[#1c398e]">
                        Zone 1 · Left: Clean Executive Summary
                      </span>
                      <span className="text-[9.5px] font-bold text-slate-400">Read top → bottom</span>
                    </div>
                    <div className="space-y-1.5 text-[10px] text-slate-600">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200/80">
                        <strong className="text-slate-800">Sections 1–9:</strong> Strategic Scope,
                        Overview, Goal, Outcomes, KPI, Deliverables, Audience, Integration &amp;
                        Budget. Clean sections have zero clutter.
                      </div>
                      <div className="p-2 rounded bg-amber-50 border border-amber-300 flex items-center justify-between gap-2">
                        <span className="text-amber-950 font-semibold">
                          Amber <strong>System Alignment</strong> card appears only if a section has
                          a warning.
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-700 text-white text-[9px] font-bold shrink-0">
                          Flag Q# for Fix
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Step 4 Card + Floating Chat */}
                  <div className="col-span-5 flex flex-col justify-between gap-2.5">
                    <div className="bg-white rounded-lg border border-indigo-200 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-indigo-950">
                          Zone 2 · Right: Step 4 Card
                        </span>
                        <span className="text-[9px] font-bold text-indigo-700">0/2 Voted</span>
                      </div>
                      <div className="text-[9.5px] text-slate-600 space-y-1">
                        <div className="flex items-center justify-between bg-slate-50 px-1.5 py-1 rounded">
                          <span>Q1–Q7 Rubric (Reviewed 0/7 → 7/7)</span>
                          <span className="inline-flex items-center gap-0.5">
                            <span className="px-1 rounded bg-emerald-600 text-white font-bold">
                              ✓ OK
                            </span>
                            <span className="px-1 rounded bg-amber-100 text-amber-900 font-bold">
                              Flag
                            </span>
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded bg-indigo-600 text-white text-center font-bold">
                          Vote &amp; Recommend to OV27
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#182747] text-white rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <div>
                          <p className="text-[10px] font-extrabold leading-tight">
                            Zone 3 · Bottom-Right
                          </p>
                          <p className="text-[9px] text-blue-200 leading-tight">
                            Floating Review Notes box
                          </p>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-white/15 text-[9px] font-bold">
                        Always handy
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Tips on the 3 Zones */}
              <div className="grid grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <p className="font-extrabold text-slate-900 mb-0.5">1. Executive Summary</p>
                  <p className="text-slate-600 leading-snug">
                    Click <strong>Flag Q# for Fix</strong> on any amber warning card to instantly
                    flag that rubric item in the sidebar.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <p className="font-extrabold text-slate-900 mb-0.5">2. Step 4 Sidebar</p>
                  <p className="text-slate-600 leading-snug">
                    Smart <strong>Auto-hints</strong> guide you as you tap <strong>OK</strong> or{' '}
                    <strong>Flag</strong> on Q1–Q7 (click any title for evidence or <strong>↗</strong>{' '}
                    to jump).
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <p className="font-extrabold text-slate-900 mb-0.5">3. Floating Notes</p>
                  <p className="text-slate-600 leading-snug">
                    Open anytime while reading to paste quotes or ask questions without scrolling
                    away from your place.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2: 7-Question SSD Rubric Table */}
            <div className="space-y-2.5 break-inside-avoid">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-[#182747] border-l-4 border-[#1c398e] pl-2.5">
                  Step 2 · Verify the 7-Question SSD Rubric (Q1–Q7)
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                  <ClipboardCheck className="w-3 h-3" />
                  <span>Always visible in Step 4 Card</span>
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#182747] text-white text-[10.5px]">
                      <th className="py-2 px-3 font-extrabold w-12">Q#</th>
                      <th className="py-2 px-3 font-extrabold w-52">Rubric Check</th>
                      <th className="py-2 px-3 font-extrabold">What to Verify</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {RUBRIC_ROWS.map((row, idx) => (
                      <tr key={row.q} className={idx % 2 === 1 ? 'bg-slate-50/75' : 'bg-white'}>
                        <td className="py-2 px-3 font-black text-[#1c398e] align-top">{row.q}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 align-top">
                          {row.title}
                        </td>
                        <td className="py-2 px-3 text-slate-700 leading-snug align-top">
                          {row.check}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-slate-600 bg-emerald-50/70 border border-emerald-200 rounded-lg px-3 py-2">
                <strong className="text-emerald-950">Quick Tip:</strong> Smart hints (
                <em>Auto-hint: OK</em>, <em>Alignment check</em>, or <em>Needs check</em>) assist
                your review, but <strong>you</strong> confirm each question by tapping{' '}
                <strong>OK</strong> or <strong>Flag</strong> (or click{' '}
                <strong>Confirm All 7 OK</strong> / <strong>Mark 7/7 OK</strong> after reading).
                Click <strong>PDF ↗</strong> anytime for the full SSD Review Framework PDF.
              </p>
            </div>

            {/* Page 2 Footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span>OneVoice27 Division Liaison Walkthrough Guide</span>
              <span>Page 2 of 4 · ov27.hopestartshere.asia</span>
            </div>
          </section>

          {/* ============================================================== */}
          {/* PAGE 3 — FEEDBACK & CASTING YOUR STEP 4 DECISION               */}
          {/* ============================================================== */}
          <section className="break-before-page bg-white rounded-2xl print:rounded-none border border-slate-200 print:border-none shadow-sm print:shadow-none p-6 sm:p-8 print:p-0 space-y-4">
            {/* Running Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] font-bold text-slate-500">
              <span className="text-[#1c398e] uppercase tracking-wider">
                OneVoice27 Liaison Guide · Feedback &amp; Voting
              </span>
              <span>Page 3 of 4</span>
            </div>

            {/* Step 3: Coach the Union Clearly */}
            <div className="space-y-2.5 break-inside-avoid">
              <h2 className="text-sm font-black text-[#182747] border-l-4 border-[#1c398e] pl-2.5">
                Step 3 · Coach the Union Clearly (Review Notes &amp; Flagged Fixes)
              </h2>
              <p className="text-xs text-slate-600 leading-snug">
                Use floating <strong>Review Notes</strong> for quick questions, or click{' '}
                <strong>Flag</strong> on Q1–Q7 to attach section instructions (system-alerted rows
                show 1-click fix chips; clean <em>Auto-hint: OK</em> rows open a blank note box).{' '}
                <strong>No copy-pasting needed</strong>—flagged notes attach to your vote and
                post to <strong>Review Notes</strong> automatically when submitted:
              </p>

              <div className="grid grid-cols-4 gap-2 text-[10.5px]">
                {[
                  { n: '1', t: 'Affirm', d: 'Note a real strength in the proposal.' },
                  { n: '2', t: 'Name the Gap', d: 'Point to the exact section, figure, or KPI.' },
                  { n: '3', t: 'Explain Why', d: 'Connect it to mission or Treasury clarity.' },
                  { n: '4', t: 'State the Fix', d: 'Tell the Union exactly what to add or update.' },
                ].map((f) => (
                  <div
                    key={f.n}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-0.5"
                  >
                    <p className="font-extrabold text-[#1c398e]">
                      {f.n}. {f.t}
                    </p>
                    <p className="text-slate-600 leading-snug">{f.d}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-[10.5px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="py-1.5 px-3 font-extrabold w-44">Avoid (Too Vague)</th>
                      <th className="py-1.5 px-3 font-extrabold">
                        Use Instead (Clear &amp; Actionable)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-1.5 px-3 text-rose-700 font-semibold">
                        &ldquo;Improve the KPI.&rdquo;
                      </td>
                      <td className="py-1.5 px-3 text-slate-700">
                        &ldquo;In Sec 5, clarify how the 2,600 participants will be counted and who
                        will report the total.&rdquo;
                      </td>
                    </tr>
                    <tr className="bg-slate-50/70">
                      <td className="py-1.5 px-3 text-rose-700 font-semibold">
                        &ldquo;The budget is too high.&rdquo;
                      </td>
                      <td className="py-1.5 px-3 text-slate-700">
                        &ldquo;In Sec 9, break the US$5,172 lump sum into clear cost lines (venue,
                        materials, travel) tied to Sec 6.&rdquo;
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 text-rose-700 font-semibold">
                        &ldquo;Add follow-up.&rdquo;
                      </td>
                      <td className="py-1.5 px-3 text-slate-700">
                        &ldquo;In Sec 8, name the local pastor or Hope Care Team receiving
                        interested contacts after the event.&rdquo;
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 4: Two Decisions & The Confirmation Popup */}
            <div className="space-y-2.5 break-inside-avoid">
              <h2 className="text-sm font-black text-[#182747] border-l-4 border-[#1c398e] pl-2.5">
                Step 4 · Cast Your Decision &amp; Complete the Confirmation Popup
              </h2>
              <p className="text-xs text-slate-600 leading-snug">
                Choose one of two decisions in the right <strong>Step 4</strong> card.{' '}
                <strong>Both open a confirmation popup</strong> so your review and reasoning are
                clearly recorded for co-Liaisons and Division Treasury:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3.5 rounded-xl bg-indigo-50/55 border border-indigo-200 space-y-1.5">
                  <p className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                    <span>Option A · Vote &amp; Recommend to OV27</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-snug">
                    <li>
                      <strong>Clean proposal (0 flags):</strong> Check the box confirming you
                      reviewed the proposal and assisted the Union, then click{' '}
                      <strong>Confirm &amp; Submit Vote</strong>.
                    </li>
                    <li>
                      <strong>Minor tip with flags?</strong> Check{' '}
                      <strong>Minor coaching only — still Vote &amp; Recommend</strong>, tap{' '}
                      <strong>OK</strong> on remaining rows to reach 7/7, and submit with coaching
                      attached.
                    </li>
                    <li>
                      <strong>System or manual flag remains?</strong> Briefly confirm why in the
                      popup (using the <strong>3 quick-fill chips</strong> or your own note), or
                      click <strong>Switch to Request Revision</strong>.
                    </li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/75 border border-amber-300 space-y-1.5">
                  <p className="font-extrabold text-amber-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Option B · Request Revision</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-snug">
                    <li>
                      Click <strong>Flag</strong> on Q1–Q7 item(s) needing updates—or click{' '}
                      <strong>Request Revision instead</strong> to write an overall revision note.
                    </li>
                    <li>
                      Review the auto-attached fix list in the popup, check the attestation box, and
                      click <strong>Confirm &amp; Request Revision</strong>.
                    </li>
                    <li>
                      <strong>Next step for the Union:</strong> Because Union-voted proposals are
                      locked, the <strong>Union Treasurer must click Reopen Review</strong> to
                      unlock the form, apply edits, and re-record Step 3 approval.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Print-Safe Schematic of the Pre-Vote Confirmation Popup */}
              <div className="rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2 bg-[#182747] text-white flex items-center justify-between text-[10.5px]">
                  <span className="font-extrabold">
                    Popup Preview · Confirm Step 4 Vote &amp; Recommendation
                  </span>
                  <span className="text-blue-200 font-semibold">
                    Required before every vote or revision
                  </span>
                </div>
                <div className="p-3 space-y-2 text-[10px]">
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                    <p className="font-extrabold text-amber-950">
                      Remaining Flagged Suggestions (shown whenever Rubric or Alignment flags remain)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-white border border-amber-300 font-semibold text-amber-950">
                        Clarified directly with Union
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white border border-amber-300 font-semibold text-amber-950">
                        Approved due to local Union context
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white border border-amber-300 font-semibold text-amber-950">
                        System suggestion does not apply
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                      <span className="w-3.5 h-3.5 rounded border border-indigo-600 bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                        ✓
                      </span>
                      <span>
                        I confirm that I have reviewed this proposal and assisted the Union where
                        needed.
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold shrink-0">
                      Confirm &amp; Submit Vote
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5: Verify & Move On */}
            <div className="p-3 rounded-xl bg-emerald-50/75 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-[11px] break-inside-avoid">
              <div className="space-y-0.5">
                <p className="font-extrabold text-emerald-950">
                  Step 5 · Verify &amp; Continue Your Queue
                </p>
                <p className="text-slate-700 leading-snug">
                  Confirm <strong>Step 4 vote saved</strong> and <strong>Voted ✓</strong> appear on
                  the roster. Click <strong>Edit Vote</strong> anytime before Step 5 authorization, or
                  click <strong>Next Unvoted Proposal →</strong> to move straight to the next one.
                </p>
              </div>
            </div>

            {/* Page 3 Footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span>OneVoice27 Division Liaison Walkthrough Guide</span>
              <span>Page 3 of 4 · ov27.hopestartshere.asia</span>
            </div>
          </section>

          {/* ============================================================== */}
          {/* PAGE 4 — TROUBLESHOOTING & 5-STEP DESK CHECKLIST               */}
          {/* ============================================================== */}
          <section className="break-before-page bg-white rounded-2xl print:rounded-none border border-slate-200 print:border-none shadow-sm print:shadow-none p-6 sm:p-8 print:p-0 space-y-5">
            {/* Running Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] font-bold text-slate-500">
              <span className="text-[#1c398e] uppercase tracking-wider">
                OneVoice27 Liaison Guide · Troubleshooting &amp; Desk Reminder
              </span>
              <span>Page 4 of 4</span>
            </div>

            {/* Troubleshooting Table */}
            <div className="space-y-2.5 break-inside-avoid">
              <h2 className="text-sm font-black text-[#182747] border-l-4 border-[#1c398e] pl-2.5 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#1c398e]" />
                <span>Quick Troubleshooting</span>
              </h2>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#182747] text-white text-[10.5px]">
                      <th className="py-2 px-3 font-extrabold w-56">Situation</th>
                      <th className="py-2 px-3 font-extrabold">What to Do</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {TROUBLESHOOTING_ROWS.map((item, idx) => (
                      <tr key={item.issue} className={idx % 2 === 1 ? 'bg-slate-50/75' : 'bg-white'}>
                        <td className="py-2.5 px-3 font-bold text-slate-900 align-top">
                          {item.issue}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 leading-snug align-top">
                          {item.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5-Step Tear-Off Desk Reminder */}
            <div className="rounded-2xl border-2 border-[#1c398e] bg-indigo-50/40 p-5 space-y-3 break-inside-avoid">
              <div className="flex items-center justify-between gap-2 border-b border-indigo-200 pb-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e]">
                    Keep Beside Your Monitor
                  </p>
                  <h3 className="text-base font-black text-[#182747]">
                    5-Step Liaison Desk Checklist (Every Proposal)
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#1c398e] text-white text-[10px] font-extrabold">
                  Step 4 Workflow
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  {
                    step: '1',
                    title: 'Open Your Queue',
                    desc: 'Sign in as Division Liaison → click Start Reviewing → in Your Step 4 Voting Queue.',
                  },
                  {
                    step: '2',
                    title: 'Read & Verify Q1–Q7',
                    desc: 'Review the Executive Summary and tap OK or Flag on each rubric question (or Confirm All 7 OK / Mark 7/7 OK after reading).',
                  },
                  {
                    step: '3',
                    title: 'Coach Clearly',
                    desc: 'Use the floating Review Notes box for questions, or click Flag on specific rubric items for required fixes.',
                  },
                  {
                    step: '4',
                    title: 'Confirm & Submit',
                    desc: 'Click Vote & Recommend to OV27 (noting any remaining flag exceptions) or Request Revision in the popup.',
                  },
                  {
                    step: '5',
                    title: 'Verify & Continue',
                    desc: 'Check that Voted ✓ appears on the Step 4 roster, then click Next Unvoted Proposal →.',
                  },
                ].map((row) => (
                  <div
                    key={row.step}
                    className="flex items-start gap-3 bg-white rounded-xl border border-indigo-200/80 px-3.5 py-2.5"
                  >
                    <span className="w-6 h-6 rounded-full bg-[#1c398e] text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      {row.step}
                    </span>
                    <div className="leading-snug">
                      <span className="font-extrabold text-slate-900">{row.title}: </span>
                      <span className="text-slate-700">{row.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Principle & Reference Strip */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-[11px] break-inside-avoid">
              <p className="font-extrabold text-[#182747]">Final Governance Principle</p>
              <p className="text-slate-700 leading-relaxed">
                Review each proposal carefully, assist the Union with specific and respectful
                guidance, and vote only when the record supports your recommendation. Your Step 4
                vote advances readiness to Step 5; final authorization remains with the{' '}
                <strong>SSD OV27 Committee</strong>.
              </p>
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-semibold text-slate-600">
                <span>
                  <strong>Portal:</strong> ov27.hopestartshere.asia
                </span>
                <span>
                  <strong>Rubric PDF:</strong> Click &ldquo;PDF ↗&rdquo; inside the Step 4 card
                </span>
                <span>
                  <strong>Support:</strong> Contact your SSD Portal Administrator
                </span>
              </div>
            </div>

            {/* Page 4 Footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span>OneVoice27 Division Liaison Walkthrough Guide</span>
              <span>Page 4 of 4 · ov27.hopestartshere.asia</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
