import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  HelpCircle,
  FileText,
  Search,
  ArrowLeft,
  Download,
  ExternalLink,
  Users,
  Layers,
  BarChart3,
  Calculator,
  DollarSign,
  Share2,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Compass,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Radio,
  Printer,
} from 'lucide-react';
import {
  PLAYBOOK_GOLDEN_RULE,
  PLAYBOOK_PATHWAY_BY_KPI,
  PLAYBOOK_INTEGRATION_PARTNERS,
} from '../data/oneVoice27Playbook';
import { REVIEW_FRAMEWORK_PDF_URL } from '../utils/projectReviewFramework';

export const PLAYBOOK_PDF_URL =
  '/assets/aistudio/OneVoice27_Playbook_Southern_Asia_Pacific_Division_b2d40673.pdf';

export const PLAYBOOK_PAGE_STATE_STORAGE_KEY = 'onevoice27_playbook_page_state_v1';

export type PlaybookFaqTab = 'faqs' | 'playbook' | 'pdf';

export interface PlaybookSavedState {
  activeTab: PlaybookFaqTab;
  activeTopicId: string;
  pdfPage: number;
  searchQuery: string;
  returnView?: string;
  returnSectionId?: string;
  returnSectionLabel?: string;
}

export interface PlaybookFaqPageProps {
  initialTopic?: string;
  activeProposalTitle?: string;
  returnViewLabel?: string;
  returnSectionLabel?: string;
  onReturnToPrevious: () => void;
  onOpenLiaisonGuide?: () => void;
}

interface FaqEntry {
  id: string;
  numberBadge: string;
  title: string;
  category: 'strategy' | 'kpi' | 'budget' | 'workflow';
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  bullets?: { bold: string; text: string }[];
  tip?: string;
  relatedPdfPage?: number;
  relatedFormSection?: string;
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'faq-audience',
    numberBadge: 'FAQ 1',
    title: 'Target Audience Positioning Architecture (Groups A to E)',
    category: 'strategy',
    icon: Users,
    summary:
      'OneVoice27 categorizes audiences into 5 primary groups (A to E) to align message clarity, tone, and mission funding. Each proposal may select up to 3 target audiences.',
    bullets: [
      {
        bold: 'Group A (Core Adventist Leaders & Youth):',
        text: 'Missional leaders, pastors, institutional staff, and youth in Adventist schools/universities. Tone is equipping, visionary, and mobilization-focused.',
      },
      {
        bold: 'Group B (Baptized Members Seeking Mission):',
        text: 'Church members who are spiritually rooted in the church but need training or tools to engage in active personal/digital outreach.',
      },
      {
        bold: 'Group C (Spiritual Seekers & Friends of Adventism):',
        text: 'Community members already curious about Seventh-day Adventist faith, health, family, or Bible prophecy. Tone is welcoming, clear, and relational.',
      },
      {
        bold: 'Group D (General Christian Community):',
        text: 'Believers from other Christian denominations. Focus on shared Christian values, Christ-centered hope, and deeper biblical study.',
      },
      {
        bold: 'Group E (Non-Religious & World Religions / 10/40 Window):',
        text: 'People from secular, Buddhist, Muslim, Hindu, or unreached backgrounds. Focus on felt needs, health, family, peace, and culturally contextualized bridge-building.',
      },
    ],
    tip: 'Avoid Contradictions: If your Project Narrative or Goal focuses on public evangelism, community outreach, or baptisms, do NOT select only Group A or B. Include Group C, D, or E so your target audience matches your evangelistic narrative.',
    relatedPdfPage: 10,
    relatedFormSection: 'Section 7: Target Audience',
  },
  {
    id: 'faq-deliverables',
    numberBadge: 'FAQ 2 & 3',
    title: 'Deliverables (Section 6) vs. Measurable Outcomes (Section 4)',
    category: 'strategy',
    icon: Layers,
    summary:
      'Understanding the difference between tangible outputs (Deliverables) and spiritual/behavioral change (Outcomes) helps committees evaluate your proposal quickly.',
    bullets: [
      {
        bold: 'Deliverables (Section 6 — What You Produce):',
        text: 'Concrete physical or digital assets and events provided to the end user — e.g., 12 short evangelistic video episodes, 5,000 printed Bible study guides, a 3-day Digital Missionary bootcamp, or a localized landing page.',
      },
      {
        bold: 'Outcomes (Section 4 — What Changes):',
        text: 'The lasting life transformation or ministry shift caused by your work — e.g., seekers transitioning from online videos into local Hope Care Teams, or youth actively mentoring online Bible study contacts.',
      },
      {
        bold: 'OneVoice27 Content Repository Rule:',
        text: 'If your project produces new media series, graphics, or study guides, include a deliverable commitment to upload master files to the SSD OneVoice27 Content Repository so other Unions can translate and adapt them.',
      },
    ],
    tip: 'Make sure every major Deliverable in Section 6 (such as printing, studio gear, venue rental, or ad boosting) has a matching cost line in your Budget Plan.',
    relatedPdfPage: 29,
    relatedFormSection: 'Section 4 & Section 6',
  },
  {
    id: 'faq-kpis',
    numberBadge: 'FAQ 4 to 7',
    title: 'Selecting the Single Best Primary KPI (Section 5)',
    category: 'kpi',
    icon: BarChart3,
    summary:
      'Every proposal must select strictly ONE Primary KPI that matches its Global Objective and represents its primary stage in the OneVoice27 5-Stage Evangelistic Pathway (Reach → Engage → Connect → Disciple → Multiply):',
    bullets: [
      {
        bold: '1. Reach & Exposure (Playbook Stage 1: Reach):',
        text: '"How many total people will see, hear, or encounter your message?" Count cumulative views, radio/broadcast listeners, social impressions, or literature distributed.',
      },
      {
        bold: '2. Engagement & Digital Connection (Playbook Stage 2: Engage):',
        text: '"How many people will actively interact with your content or digital team?" Count two-way DM conversations, prayer requests, WhatsApp/Messenger inquiries, or Bible questions.',
      },
      {
        bold: '3. Connection & Bridging Handoff (Playbook Stage 3: Connect):',
        text: '"How many people will take a direct next step into a physical or hosted environment?" Count health expo guests, bridging seminar attendees, or warm referrals to local churches.',
      },
      {
        bold: '4. Discipleship & Retention (Playbook Stage 4: Disciple):',
        text: '"How many individuals will be nurtured into ongoing discipleship and church community?" Count active Bible study completions, small group/Hope Care Team members, and baptisms.',
      },
      {
        bold: '5. Mobilization & Capability Building (Playbook Stage 5: Multiply):',
        text: '"How many trained leaders, creators, or volunteers will actively put their skills into practice?" Count trained Digital Missionaries, content creators, or Seeker-Ready Churches equipped.',
      },
    ],
    tip: 'Select the KPI that measures the primary output of THIS grant. For example, a training bootcamp for digital missionaries should select KPI #5 (Mobilization), whereas a public digital ad campaign should select KPI #1 (Reach) or KPI #2 (Engagement).',
    relatedPdfPage: 11,
    relatedFormSection: 'Section 5: Primary KPI',
  },
  {
    id: 'faq-target-clarity',
    numberBadge: 'FAQ 8',
    title: 'Target Goal Clarity Rule: Single Cumulative Number vs. Formulas',
    category: 'kpi',
    icon: Calculator,
    summary:
      'The Division Dashboard aggregates Target Goals across all 14 territories. Entering wordy sentences or multiplication formulas in the "Target Goal" box prevents accurate aggregation.',
    bullets: [
      {
        bold: 'Target Goal Box (Single Cumulative Number Only):',
        text: 'Enter ONE final cumulative number for the entire project duration (for example: "1,200" or "50,000"). Do NOT write "100 x 12 months" or "50 per church across 20 churches" inside the Target Goal input.',
      },
      {
        bold: 'Metric Details Box (Where Formulas & Breakdowns Belong):',
        text: 'Use the "Metric Details" box right below Target Goal to explain your math (e.g., "100 seekers per month × 12 months = 1,200 total seekers engaged via WhatsApp and HopeStartsHere.asia").',
      },
      {
        bold: 'Smart Calculator Assistant:',
        text: 'If you accidentally type a formula like "100 x 12" in Target Goal, the Smart Proposal Advisor will automatically offer a 1-click button to set Target Goal to "1,200" and move your formula into Metric Details.',
      },
    ],
    tip: 'Check the green "Detected Dashboard Target" badge and "Peer Target Benchmark" right below the Target Goal input to confirm how your number will appear on the Executive Monitor.',
    relatedPdfPage: 44,
    relatedFormSection: 'Section 5: Target Goal',
  },
  {
    id: 'faq-budget',
    numberBadge: 'FAQ 9',
    title: 'Budget Plan & What Union Treasurers Look For',
    category: 'budget',
    icon: DollarSign,
    summary:
      'Union and Division Treasurers review every proposal to verify financial stewardship and clear cost allocation before recording a Committee Action vote.',
    bullets: [
      {
        bold: 'Avoid Single-Line / Lump-Sum Budgets:',
        text: 'Entering only 1 budget row (or putting >85% of your total request into a single generic line) is the #1 reason Treasurers return proposals for revision.',
      },
      {
        bold: 'Itemize into 3 to 5 Clear Cost Categories:',
        text: 'Break down your requested funding into specific operational lines such as Production Equipment, Content Filming/Editing, Social Media Ad Boosting, Venue/Audio Rental, Translation/Dubbing, Printed Study Guides, or Volunteer Stipends.',
      },
      {
        bold: 'Use Proven Approved SSD Categories:',
        text: 'At the bottom of the Budget Plan, click any green "Proven Budget Categories from Approved SSD Proposals" tag or blue "Suggested Breakdown Category" tag to add Treasurer-approved line items in one click.',
      },
    ],
    tip: 'Committee-approved proposals across SSD average 3 to 5 itemized budget lines. Itemizing upfront speeds up Treasury review and committee voting.',
    relatedPdfPage: 46,
    relatedFormSection: 'Budget Plan',
  },
  {
    id: 'faq-integration',
    numberBadge: 'FAQ 10',
    title: 'Points of Integration & The Playbook Golden Rule (Section 8)',
    category: 'strategy',
    icon: Share2,
    summary:
      'The OneVoice27 Playbook establishes one overarching Golden Rule across the Southern Asia-Pacific Division: "Never start an activity unless someone is ready to respond and continue the relationship."',
    bullets: [
      {
        bold: 'Media & Reach Must Connect to Responders:',
        text: 'Every broadcast, video series, or literature campaign must include a clear Call to Action (CTA) routing seekers to www.HopeStartsHere.asia, WhatsApp/Messenger, or a QR code monitored by trained Digital Missionaries.',
      },
      {
        bold: '24–48 Hour Seeker Follow-Up Standard:',
        text: 'Online inquiries should receive a personal, warm response within 24 to 48 hours and be invited into an online or small-group Bible study.',
      },
      {
        bold: 'Warm Handoff to NDR-IEL & Seeker-Ready Churches:',
        text: 'Section 8 should explicitly name the receiving partners — such as NDR-IEL (Integrated Evangelism Lifestyle), local Church Interest Coordinators, Pastors/Elders, and Hope Care Teams — who will welcome and nurture seekers.',
      },
    ],
    tip: 'In Section 8, click any of the "Playbook Recommended" partner chips below the text box to insert the official SSD Playbook handoff workflow automatically.',
    relatedPdfPage: 28,
    relatedFormSection: 'Section 8: Points of Integration',
  },
  {
    id: 'faq-sensitive',
    numberBadge: 'FAQ 11',
    title: 'Sensitive-Area & 10/40 Window Protocol (Play 7 — Group E)',
    category: 'strategy',
    icon: ShieldCheck,
    summary:
      'When reaching Group E (Non-Christian Backgrounds / World Religions / 10/40 Window), Playbook Play 7 ("A Seeker Lives in a Sensitive Area", p. 38) requires special care and contextualization.',
    bullets: [
      {
        bold: 'Privacy & Safe Referral First:',
        text: 'Never refer a seeker in a sensitive or restricted area publicly to a local church without their explicit consent.',
      },
      {
        bold: 'Trained Sensitive-Contact Coordinators:',
        text: 'Route inquiries privately to a trained sensitive-contact coordinator, Adventist Muslim/Buddhist/Secular ministry specialist, or approved online mentor.',
      },
      {
        bold: 'Cultural & Linguistic Contextualization:',
        text: 'In the Group E justification box (Section 7), specify the people group, local language, felt-need entry point (health, family, peace), and safe follow-up protocol.',
      },
    ],
    tip: 'When you check Group E in Section 7, use the 1-click Play 7 buttons to insert the sensitive-area safety protocol directly into your justification.',
    relatedPdfPage: 38,
    relatedFormSection: 'Section 7: Group E Justification',
  },
  {
    id: 'faq-workflow',
    numberBadge: 'FAQ 12',
    title: 'Approval Workflow, Locked Proposals & Reopening Review',
    category: 'workflow',
    icon: Lock,
    summary:
      'How proposals move from initial drafting to official Union Committee Approval, and how locked records can be updated if needed:',
    bullets: [
      {
        bold: '1. Draft → Submitted → Under Review:',
        text: 'Once all required sections reach 100% readiness, the Proposal Creator clicks "Submit Proposal". Union Coordinators, Treasurers, and Division Liaisons review the proposal in the Review Hub and can leave Review Notes.',
      },
      {
        bold: '2. Official Committee Approval (Locks Record):',
        text: 'When a Union Treasurer or Super Admin records the official Union Committee Action / Vote Number, the proposal status becomes "Approved" and all form inputs lock to protect the audited financial record.',
      },
      {
        bold: '3. How to Unlock an Approved Proposal for Updates:',
        text: 'If an Approved proposal needs additional budget breakdown items or KPI/Audience adjustments, a Union Treasurer (or Super Admin) simply clicks "Reopen Review to Unlock" in the top banner or Review Hub Drawer. This returns the proposal to "Under Review" so edits can be saved.',
      },
    ],
    tip: 'Smart Proposal Advisor recommendations remain visible on Approved proposals so Treasurers and authors can see improvement opportunities without altering the locked record unless reopened.',
    relatedPdfPage: 48,
    relatedFormSection: 'Scope & Approval Bar',
  },
];

interface PlaybookPlayCard {
  playNumber: number;
  title: string;
  pageRef: number;
  trigger: string;
  immediateAction: string;
  whoOwns: string;
  handoffGoal: string;
}

const PLAYBOOK_EIGHT_PLAYS: PlaybookPlayCard[] = [
  {
    playNumber: 1,
    title: 'A Seeker Watches Online',
    pageRef: 32,
    trigger: 'Someone watches a short video, livestream, or broadcast clip.',
    immediateAction:
      'Include a clear Call to Action (CTA) in every video inviting viewers to message, ask a question, or visit www.HopeStartsHere.asia.',
    whoOwns: 'Media / Communication Team & Content Creators',
    handoffGoal: 'Convert passive viewing into a two-way conversation (Stage 1 → Stage 2).',
  },
  {
    playNumber: 2,
    title: 'A Seeker Messages or Asks a Question',
    pageRef: 33,
    trigger: 'A viewer sends a DM, WhatsApp message, prayer request, or web inquiry.',
    immediateAction:
      'Respond personally within 24–48 hours with warmth, listen to their need, pray with them, and offer a relevant next step.',
    whoOwns: 'Digital Missionaries & Online Responders',
    handoffGoal: 'Build trust and invite the seeker into a structured Bible discovery or small group (Stage 2 → Stage 3).',
  },
  {
    playNumber: 3,
    title: 'A Seeker Joins an Online Bible Study',
    pageRef: 34,
    trigger: 'A contact agrees to study the Bible online, by phone, or in a digital care group.',
    immediateAction:
      'Pair the seeker with a trained Bible mentor; walk through Christ-centered lessons at their pace and introduce local believers when ready.',
    whoOwns: 'Digital Bible Mentors & Interest Coordinators',
    handoffGoal: 'Transition from online study into a welcoming local fellowship or Hope Care Team (Stage 3 → Stage 4).',
  },
  {
    playNumber: 4,
    title: 'A Seeker Wants to Visit a Church',
    pageRef: 35,
    trigger: 'An online contact or community friend is ready to attend a local church or bridging event.',
    immediateAction:
      'Make a warm introduction to the local Church Interest Coordinator and Greeter Team BEFORE Sabbath so someone meets them by name at the door.',
    whoOwns: 'Local Church Interest Coordinator, Greeters & Hope Care Team',
    handoffGoal: 'Ensure no guest walks in alone; connect them immediately to a small group family.',
  },
  {
    playNumber: 5,
    title: 'A New Believer Is Baptized',
    pageRef: 36,
    trigger: 'A seeker accepts Jesus and is baptized into the church family.',
    immediateAction:
      'Assign a spiritual mentor/friend, integrate them into an active Hope Care Team, and involve them in service within their first 90 days.',
    whoOwns: 'Pastor, Elders & Hope Care Team Leader',
    handoffGoal: 'Long-term retention, spiritual growth, and equipping for mission (Stage 4 → Stage 5).',
  },
  {
    playNumber: 6,
    title: 'A Member Wants to Share Faith Online',
    pageRef: 37,
    trigger: 'A church member or youth wants to use their social media for witness.',
    immediateAction:
      'Equip them with basic Digital Missionary training and grant access to the OneVoice27 Content Repository for shareable clips and guides.',
    whoOwns: 'Union/Mission Communication & Youth Ministries',
    handoffGoal: 'Multiply everyday digital witnesses connected to the local response system.',
  },
  {
    playNumber: 7,
    title: 'A Seeker Lives in a Sensitive Area',
    pageRef: 38,
    trigger: 'An inquiry comes from a restricted, 10/40 Window, or sensitive religious context (Group E).',
    immediateAction:
      'Protect privacy strictly. Do NOT refer publicly to a local church without consent; connect privately to a trained sensitive-contact coordinator.',
    whoOwns: 'Sensitive-Contact Coordinator & Specialized Mission Mentors',
    handoffGoal: 'Safe, culturally respectful mentorship and house-group fellowship.',
  },
  {
    playNumber: 8,
    title: 'A Church Wants to Join OneVoice27',
    pageRef: 39,
    trigger: 'A local congregation wants to become a "Seeker-Ready Church" for the 2027 harvest.',
    immediateAction:
      'Appoint an Interest Coordinator, form a Hope Care Team, train greeters, and align with the "All Things New" 12-Month Calendar.',
    whoOwns: 'Local Pastor, Church Board & NDR-IEL Coordinator',
    handoffGoal: 'Every participating church ready to receive, love, and disciple new seekers.',
  },
];

const PDF_QUICK_CHAPTERS: { label: string; page: number; description: string }[] = [
  { label: 'Cover & Executive Overview', page: 1, description: 'Vision & Golden Rule of OneVoice27' },
  { label: 'The 5-Stage Evangelistic Pathway', page: 10, description: 'Reach → Engage → Connect → Disciple → Multiply' },
  { label: 'Department & NDR-IEL Integration', page: 22, description: 'How departments work as one ecosystem' },
  { label: 'Digital Missionaries & Repository', page: 26, description: 'Online response roles & shared media assets' },
  { label: 'The 8 Practical Plays (Plays 1–8)', page: 32, description: 'Step-by-step seeker handoff scenarios' },
  { label: 'Seeker-Ready Church Checklist', page: 34, description: '4 core local roles to welcome seekers' },
  { label: 'Play 7: Sensitive Areas (Group E)', page: 38, description: 'Safe handling in 10/40 Window contexts' },
  { label: '"All Things New" 48-Week Calendar', page: 40, description: '3 four-month cycles leading to Sept 2027' },
  { label: 'Metrics, Reporting & Evaluation', page: 44, description: 'Measuring what matters across SSD' },
];

function loadSavedPlaybookState(): PlaybookSavedState {
  try {
    const raw = localStorage.getItem(PLAYBOOK_PAGE_STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        activeTab: parsed.activeTab || 'faqs',
        activeTopicId: parsed.activeTopicId || 'faq-audience',
        pdfPage: Number(parsed.pdfPage) || 1,
        searchQuery: parsed.searchQuery || '',
        returnView: parsed.returnView,
        returnSectionId: parsed.returnSectionId,
        returnSectionLabel: parsed.returnSectionLabel,
      };
    }
  } catch {
    // ignore
  }
  return {
    activeTab: 'faqs',
    activeTopicId: 'faq-audience',
    pdfPage: 1,
    searchQuery: '',
  };
}

export function PlaybookFaqPage({
  initialTopic,
  activeProposalTitle,
  returnViewLabel = 'Proposal Editor',
  returnSectionLabel,
  onReturnToPrevious,
  onOpenLiaisonGuide,
}: PlaybookFaqPageProps) {
  const initialSaved = useMemo(() => loadSavedPlaybookState(), []);

  const [activeTab, setActiveTab] = useState<PlaybookFaqTab>(initialSaved.activeTab);
  const [activeTopicId, setActiveTopicId] = useState<string>(initialSaved.activeTopicId);
  const [pdfPage, setPdfPage] = useState<number>(initialSaved.pdfPage);
  const [searchQuery, setSearchQuery] = useState<string>(initialSaved.searchQuery);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'strategy' | 'kpi' | 'budget' | 'workflow'>('all');

  // Map deep-linked initialTopic (e.g., from ProposalForm "Learn More" buttons) to exact tab & anchor
  useEffect(() => {
    if (!initialTopic) return;
    const topicMap: Record<string, { tab: PlaybookFaqTab; anchor: string; page?: number }> = {
      audience: { tab: 'faqs', anchor: 'faq-audience' },
      deliverables: { tab: 'faqs', anchor: 'faq-deliverables' },
      kpis: { tab: 'faqs', anchor: 'faq-kpis' },
      metric: { tab: 'faqs', anchor: 'faq-target-clarity' },
      budget: { tab: 'faqs', anchor: 'faq-budget' },
      integration: { tab: 'faqs', anchor: 'faq-integration' },
      sensitive: { tab: 'faqs', anchor: 'faq-sensitive' },
      workflow: { tab: 'faqs', anchor: 'faq-workflow' },
      playbook: { tab: 'playbook', anchor: 'playbook-pathway' },
      pdf: { tab: 'pdf', anchor: 'pdf-viewer', page: 1 },
    };

    const mapped = topicMap[initialTopic];
    if (mapped) {
      setActiveTab(mapped.tab);
      setActiveTopicId(mapped.anchor);
      if (mapped.page) setPdfPage(mapped.page);

      setTimeout(() => {
        const el = document.getElementById(mapped.anchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 120);
    }
  }, [initialTopic]);

  // Persist reading spot so browser reload returns user to exact tab, topic, and PDF page
  useEffect(() => {
    try {
      const existing = loadSavedPlaybookState();
      const updated: PlaybookSavedState = {
        ...existing,
        activeTab,
        activeTopicId,
        pdfPage,
        searchQuery,
      };
      localStorage.setItem(PLAYBOOK_PAGE_STATE_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, [activeTab, activeTopicId, pdfPage, searchQuery]);

  // Scroll to activeTopicId on initial mount if restored from reload
  useEffect(() => {
    if (activeTab === 'pdf') return;
    const timer = setTimeout(() => {
      if (activeTopicId) {
        const el = document.getElementById(activeTopicId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSelectTopicAnchor = (tab: PlaybookFaqTab, topicId: string) => {
    setActiveTab(tab);
    setActiveTopicId(topicId);
    setTimeout(() => {
      const el = document.getElementById(topicId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  const handleOpenPdfAtPage = (page: number) => {
    setPdfPage(page);
    setActiveTab('pdf');
    setActiveTopicId(`pdf-page-${page}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQ_ENTRIES.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (!q) return true;
      const hay = [
        item.numberBadge,
        item.title,
        item.summary,
        item.tip || '',
        ...(item.bullets || []).map((b) => `${b.bold} ${b.text}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [searchQuery, categoryFilter]);

  const filteredPlays = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return PLAYBOOK_EIGHT_PLAYS;
    return PLAYBOOK_EIGHT_PLAYS.filter((p) =>
      `${p.title} ${p.trigger} ${p.immediateAction} ${p.whoOwns} ${p.handoffGoal}`
        .toLowerCase()
        .includes(q)
    );
  }, [searchQuery]);

  const pathwayStages = useMemo(() => Object.values(PLAYBOOK_PATHWAY_BY_KPI), []);

  return (
    <div className="max-w-[1536px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8 py-5 space-y-5">
      {/* Sticky Return-to-Spot & Context Bar */}
      <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-3 sm:px-5 sm:py-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onReturnToPrevious}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-xs transition cursor-pointer shadow-2xs active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back to {returnViewLabel}</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-slate-900 truncate">
                {activeProposalTitle
                  ? `Working on: "${activeProposalTitle}"`
                  : 'OneVoice27 Strategy, Playbook & Proposal FAQ Hub'}
              </span>
              {returnSectionLabel && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1c398e] border border-blue-200">
                  Saved Spot: {returnSectionLabel}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              Your reading tab, topic, and proposal progress are automatically saved if the page reloads.
            </p>
          </div>
        </div>

        {/* Primary 3-Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/90 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('faqs')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'faqs'
                ? 'bg-white text-[#1c398e] shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Proposal &amp; Budget FAQs (1–12)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('playbook')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'playbook'
                ? 'bg-white text-[#1c398e] shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>SSD Playbook Guide &amp; 8 Plays</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'pdf'
                ? 'bg-white text-[#1c398e] shadow-2xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Official Playbook PDF (58p)</span>
          </button>
        </div>
      </div>

      {/* Hero Banner & Search Bar (Shown on FAQs and Playbook Guide tabs) */}
      {activeTab !== 'pdf' && (
        <div className="rounded-3xl bg-gradient-to-r from-[#1c398e] via-[#1e40af] to-indigo-900 text-white p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-amber-300 text-[11px] font-bold">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Southern Asia-Pacific Division • OneVoice27 Mission Playbook &amp; Proposal Guide</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {activeTab === 'faqs'
                  ? 'Proposal Workbook & Treasury Review FAQs'
                  : 'OneVoice27 Mission Playbook: From Broadcast to Baptism'}
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                {PLAYBOOK_GOLDEN_RULE.quote} —{' '}
                <span className="text-amber-200 font-semibold">
                  Use this guide to align your narrative, KPI target, target audiences, and multi-line budget.
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenLiaisonGuide && (
                <button
                  type="button"
                  onClick={onOpenLiaisonGuide}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-extrabold text-xs transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Liaison Guide (4p PDF)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenPdfAtPage(1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs transition cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Open Full Playbook PDF</span>
              </button>
              <a
                href={PLAYBOOK_PDF_URL}
                download="OneVoice27_Playbook_Southern_Asia_Pacific_Division.pdf"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs border border-white/20 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </a>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search FAQs, Playbook plays, KPI rules, Group E sensitive protocol, or budget tips..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {activeTab === 'faqs' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'all', label: 'All Topics' },
                    { id: 'strategy', label: 'Audience & Strategy' },
                    { id: 'kpi', label: 'KPIs & Target Math' },
                    { id: 'budget', label: 'Budget & Treasury' },
                    { id: 'workflow', label: 'Approval & Unlocking' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      categoryFilter === cat.id
                        ? 'bg-amber-400 text-slate-950 shadow-2xs'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: PROPOSAL & BUDGET FAQs (WITH LEFT TABLE OF CONTENTS)          */}
      {/* =================================================================== */}
      {activeTab === 'faqs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Sticky Table of Contents */}
          <aside className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-36 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Quick Jump — FAQs 1 to 12
              </span>
              <span className="text-[11px] font-bold text-[#1c398e]">
                {filteredFaqs.length} {filteredFaqs.length === 1 ? 'Topic' : 'Topics'}
              </span>
            </div>

            <div className="space-y-1">
              {FAQ_ENTRIES.map((faq) => {
                const isSelected = activeTopicId === faq.id;
                const Icon = faq.icon;
                return (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => handleSelectTopicAnchor('faqs', faq.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-[#1c398e] font-bold border border-blue-200/80'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#1c398e]" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                        {faq.numberBadge}
                      </span>
                      <span className="line-clamp-2 leading-snug">{faq.title}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right FAQ Cards List */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            {filteredFaqs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <p className="text-sm font-bold text-slate-800">
                  No FAQ topics match &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-xs text-slate-500">
                  Try clearing your search or switching to the SSD Playbook Guide tab.
                </p>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const Icon = faq.icon;
                const isHighlighted = activeTopicId === faq.id;
                return (
                  <div
                    key={faq.id}
                    id={faq.id}
                    onClick={() => setActiveTopicId(faq.id)}
                    className={`p-5 sm:p-6 rounded-2xl bg-white border transition-all space-y-3.5 shadow-2xs ${
                      isHighlighted
                        ? 'border-2 border-[#1c398e] ring-2 ring-blue-500/10'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1c398e] flex items-center justify-center shrink-0 border border-blue-200/60">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[10px] uppercase tracking-wider">
                              {faq.numberBadge}
                            </span>
                            {faq.relatedFormSection && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                Applies to: {faq.relatedFormSection}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 mt-0.5">{faq.title}</h3>
                        </div>
                      </div>

                      {faq.relatedPdfPage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPdfAtPage(faq.relatedPdfPage!);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#1c398e] border border-slate-200 text-[11px] font-bold transition cursor-pointer shrink-0"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#1c398e]" />
                          <span>View in Playbook PDF (p. {faq.relatedPdfPage})</span>
                        </button>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {faq.summary}
                    </p>

                    {faq.bullets && faq.bullets.length > 0 && (
                      <ul className="space-y-2 text-xs sm:text-sm text-slate-700 bg-slate-50/90 p-4 rounded-xl border border-slate-200/70">
                        {faq.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 leading-relaxed">
                            <CheckCircle2 className="w-4 h-4 text-[#1c398e] shrink-0 mt-0.5" />
                            <span>
                              <strong className="text-slate-900">{b.bold}</strong> {b.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {faq.tip && (
                      <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                        <BookOpen className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Playbook Alignment Tip: </span>
                          <span>{faq.tip}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: SSD ONEVOICE27 PLAYBOOK INTERACTIVE GUIDE                    */}
      {/* =================================================================== */}
      {activeTab === 'playbook' && (
        <div className="space-y-6">
          {/* 1. The 5-Stage Evangelistic Pathway (Playbook pp. 10–15) */}
          <section
            id="playbook-pathway"
            className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-2xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1c398e]">
                  OneVoice27 Core Architecture • Playbook pp. 10–15
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  The 5-Stage Evangelistic Pathway &amp; Handoff System
                </h3>
                <p className="text-xs text-slate-500">
                  Every stage has a clear leader, supporting team, and warm handoff (&ldquo;The Pass&rdquo;) to the next stage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenPdfAtPage(10)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1c398e] border border-blue-200 font-bold text-xs transition cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open Pathway in PDF (p. 10)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {pathwayStages.map((st) => (
                <div
                  key={st.stageNumber}
                  className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200/90 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#1c398e] text-white">
                        Stage {st.stageNumber}: {st.stageName}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{st.pageRef}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {st.purpose}
                    </p>
                    <div className="pt-1 space-y-1 text-[11px]">
                      <p className="text-slate-800">
                        <strong className="text-slate-900">Leads:</strong> {st.whoLeads}
                      </p>
                      <p className="text-slate-600">
                        <strong className="text-slate-800">Supports:</strong> {st.whoSupports}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-[11px]">
                    <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-200/70 text-blue-950">
                      <span className="font-extrabold text-[10px] uppercase tracking-wider text-blue-800 block">
                        The Pass (Passed Forward):
                      </span>
                      <span>{st.whatGetsPassedForward}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-emerald-950">
                      <span className="font-extrabold text-[10px] uppercase tracking-wider text-emerald-800 block">
                        Playbook Next Step:
                      </span>
                      <span>{st.doThisNext}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. The 8 Practical Plays (Playbook pp. 32–39) */}
          <section
            id="playbook-8-plays"
            className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-2xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
                  Action Scenarios • Playbook pp. 32–39
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  The 8 Practical OneVoice27 Plays
                </h3>
                <p className="text-xs text-slate-500">
                  Real-world operational scenarios showing how media, digital responders, and local churches work together.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenPdfAtPage(32)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open Plays in PDF (p. 32)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlays.map((play) => (
                <div
                  key={play.playNumber}
                  id={`play-${play.playNumber}`}
                  className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 hover:border-blue-300 transition space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#1c398e] text-white font-extrabold text-xs">
                          Play {play.playNumber}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{play.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenPdfAtPage(play.pageRef)}
                        className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer shrink-0"
                      >
                        PDF p. {play.pageRef} →
                      </button>
                    </div>

                    <p className="text-xs text-slate-600">
                      <strong className="text-slate-800">When: </strong>
                      {play.trigger}
                    </p>
                    <p className="text-xs text-slate-800 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200/80">
                      <strong className="text-[#1c398e]">Playbook Action: </strong>
                      {play.immediateAction}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600">
                      <strong>Owner:</strong> {play.whoOwns}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold">
                      Goal: {play.handoffGoal}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Seeker-Ready Church Checklist & "All Things New" 48-Week Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seeker-Ready Church 4 Core Roles */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1c398e]" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    Seeker-Ready Church: 4 Core Local Roles (pp. 26–35)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenPdfAtPage(34)}
                  className="text-xs font-bold text-[#1c398e] hover:underline cursor-pointer"
                >
                  PDF p. 34 →
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Before launching media or public campaigns, local churches and missions organize four practical roles so no seeker is ever dropped:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-900 block">1. Digital Missionary / Online Responder</strong>
                  <span className="text-slate-600">
                    Monitors digital channels, answers comments/DMs within 24–48 hours, prays with seekers, and logs warm contacts.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-900 block">2. Local Church Interest Coordinator</strong>
                  <span className="text-slate-600">
                    Receives referrals from HopeStartsHere.asia or Union media hubs and assigns a personal mentor or care group within 48 hours.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-900 block">3. Hope Care Team / Small Group Leader</strong>
                  <span className="text-slate-600">
                    Hosts a warm, relational small group or Bible discovery circle where seekers experience friendship and belonging.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-900 block">4. Pastor, Elders &amp; Greeter Team</strong>
                  <span className="text-slate-600">
                    Ensures Sabbath visitors are welcomed by name, nurtured through baptism, and equipped to share their faith.
                  </span>
                </div>
              </div>
            </div>

            {/* "All Things New" 12-Month / 48-Week Calendar */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    &ldquo;All Things New&rdquo; 48-Week Integrated Calendar (pp. 30, 40)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenPdfAtPage(40)}
                  className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  PDF p. 40 →
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                SSD aligns sermons, Hope Channel broadcasts, social media reels, Publishing literature, and small-group lessons into three 4-month cycles culminating in September 2027:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <strong className="text-emerald-950 block">
                    Cycle 1 (Months 1–4): RESET — Spiritual Revival &amp; Seeker Readiness
                  </strong>
                  <span className="text-emerald-900">
                    Prayer mobilization, training Digital Missionaries, organizing local Hope Care Teams, and launching foundational felt-need media.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                  <strong className="text-blue-950 block">
                    Cycle 2 (Months 5–8): REBUILD — Community Bridging &amp; Bible Discovery
                  </strong>
                  <span className="text-blue-900">
                    Health/family community bridges, active online-to-offline handoffs, and small-group Bible studies across all Unions.
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200">
                  <strong className="text-amber-950 block">
                    Cycle 3 (Months 9–12): RENEW — Public Reaping &amp; Multiplication (Sept 2027)
                  </strong>
                  <span className="text-amber-900">
                    Coordinated evangelistic reaping, baptisms, new believer mentoring, and equipping new disciples as witnesses.
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Official SSD Ecosystem Partners:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PLAYBOOK_INTEGRATION_PARTNERS.map((p) => (
                    <span
                      key={p.id}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold"
                    >
                      {p.label} ({p.pageRef})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: OFFICIAL 58-PAGE PLAYBOOK PDF READER                         */}
      {/* =================================================================== */}
      {activeTab === 'pdf' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Chapter & Page Jump Sidebar */}
          <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
            <div className="space-y-1 border-b border-slate-100 pb-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c398e]">
                Official Document • 58 Pages
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                SSD OneVoice27 Playbook Chapters
              </h3>
              <p className="text-[11px] text-slate-500">
                Click any chapter below to jump directly to that page in the PDF viewer.
              </p>
            </div>

            {/* Direct Page Stepper */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                disabled={pdfPage <= 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <span>Page</span>
                <input
                  type="number"
                  min={1}
                  max={58}
                  value={pdfPage}
                  onChange={(e) => {
                    const val = Math.min(58, Math.max(1, Number(e.target.value) || 1));
                    setPdfPage(val);
                  }}
                  className="w-14 px-2 py-1 text-center rounded-lg bg-white border border-slate-300 font-extrabold text-[#1c398e]"
                />
                <span className="text-slate-400">of 58</span>
              </div>
              <button
                type="button"
                onClick={() => setPdfPage((p) => Math.min(58, p + 1))}
                disabled={pdfPage >= 58}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Chapter Jump Buttons */}
            <div className="space-y-1.5">
              {PDF_QUICK_CHAPTERS.map((chap) => {
                const isCurrent = pdfPage === chap.page;
                return (
                  <button
                    key={chap.page}
                    type="button"
                    onClick={() => setPdfPage(chap.page)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition flex items-start justify-between gap-2 cursor-pointer ${
                      isCurrent
                        ? 'bg-[#1c398e] text-white font-bold shadow-2xs'
                        : 'bg-slate-50/80 hover:bg-blue-50/70 text-slate-800 border border-slate-200/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-bold">{chap.label}</span>
                      <span
                        className={`text-[10px] block truncate ${
                          isCurrent ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        {chap.description}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                        isCurrent ? 'bg-white/20 text-white' : 'bg-white text-[#1c398e] border border-slate-200'
                      }`}
                    >
                      p. {chap.page}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <a
                href={`${PLAYBOOK_PDF_URL}#page=${pdfPage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open PDF in Full Browser Tab</span>
              </a>
              <a
                href={PLAYBOOK_PDF_URL}
                download="OneVoice27_Playbook_Southern_Asia_Pacific_Division.pdf"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] text-white font-bold text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Official Playbook PDF</span>
              </a>
              <a
                href={REVIEW_FRAMEWORK_PDF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold text-xs transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>SSD Project Review Framework (PDF)</span>
              </a>
            </div>
          </aside>

          {/* Right Embedded PDF Viewer */}
          <div className="lg:col-span-8 xl:col-span-9 bg-slate-900 rounded-2xl border border-slate-300 overflow-hidden shadow-md">
            <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold">
                  OneVoice27 Playbook — Southern Asia-Pacific Division (Viewing Page {pdfPage})
                </span>
              </div>
              <span className="text-[11px] text-slate-300">
                Saved automatically across reloads
              </span>
            </div>
            <iframe
              key={`playbook-pdf-page-${pdfPage}`}
              src={`${PLAYBOOK_PDF_URL}#page=${pdfPage}&view=FitH`}
              title="OneVoice27 Playbook Southern Asia-Pacific Division PDF"
              className="w-full h-[78vh] min-h-[620px] bg-slate-100 border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
