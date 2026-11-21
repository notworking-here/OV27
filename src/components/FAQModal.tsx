import React, { useEffect } from 'react';
import { X, BookOpen, Users, BarChart3, Layers } from 'lucide-react';

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
}

export function FAQModal({ isOpen, onClose, initialTopic }: FAQModalProps) {
  useEffect(() => {
    if (isOpen && initialTopic) {
      const topicIdMap: Record<string, string> = {
        audience: 'faq-audience',
        deliverables: 'faq-deliverables',
        kpis: 'faq-kpis',
        metric: 'faq-kpis',
      };
      const targetId = topicIdMap[initialTopic];
      if (targetId) {
        setTimeout(() => {
          const el = document.getElementById(targetId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            el.classList.add('ring-2', 'ring-[#1c398e]', 'bg-blue-50');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-[#1c398e]', 'bg-blue-50');
            }, 2500);
          }
        }, 120);
      }
    }
  }, [isOpen, initialTopic]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-h-[88vh] overflow-y-auto border border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              OneVoice27 Strategy & Workbook Guide
            </h2>
            <p className="text-xs text-slate-500">
              Helpful guidance for drafting your strategic proposal and budget submission
            </p>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-700">
          {/* FAQ 1 */}
          <div id="faq-audience" className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 transition-all">
            <div className="flex items-center gap-2 text-[#1c398e] font-bold">
              <Users className="w-4 h-4" />
              <span>FAQ 1: Target Audience Positioning Architecture</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              OneVoice27 categorizes audiences into 5 primary groups (A to E) to align message clarity and tone:
            </p>
            <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-600">
              <li><strong>Group A (Core Adventist Leaders & Youth):</strong> Missional leaders, pastors, institutional staff, and youth in schools and universities. Tone is collaborative, visionary, and equipping.</li>
              <li><strong>Group B (Baptized Members seeking mission):</strong> Church members who are spiritually rooted but not yet engaged in active outreach. Tone is inspiring and mobilising.</li>
              <li><strong>Group C (Spiritual Seekers & Friends of Adventism):</strong> Community members curious about Seventh-day Adventist faith, health, and prophecy. Tone is welcoming, clear, and relational.</li>
              <li><strong>Group D (General Christian Community):</strong> Believers from other Christian denominations. Focus on shared Christian values, Christ-centered hope, and biblical enrichment.</li>
              <li><strong>Group E (Non-Religious & World Religions):</strong> People from secular, humanist, Hindu, Muslim, Buddhist, or other backgrounds. Focus on bridge-building, health, family, and universal themes of peace and hope.</li>
            </ul>
          </div>

          {/* FAQ 2 & 3 */}
          <div id="faq-deliverables" className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 transition-all">
            <div className="flex items-center gap-2 text-[#1c398e] font-bold">
              <Layers className="w-4 h-4" />
              <span>FAQ 2 & 3: Deliverables & Measurable Outcomes</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Deliverables (Section 6)</strong> are the concrete physical or digital assets you will produce — such as 12 documentary episodes, a mobile app, 50 evangelistic social clips, or a physical pastor training symposium.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Outcomes (Section 4)</strong> are the lasting qualitative or systemic impacts resulting from those deliverables — such as increased local volunteer mobilization, stronger media literacy, or documented life transformations.
            </p>
          </div>

          {/* FAQ 4 to 7 */}
          <div id="faq-kpis" className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 transition-all">
            <div className="flex items-center gap-2 text-[#1c398e] font-bold">
              <BarChart3 className="w-4 h-4" />
              <span>FAQ 4 to 7: Selecting the Single Best Success Metric (Section 5)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Per OneVoice27 guidelines, proposals must select <strong>only one primary metric</strong> that best captures your core evangelistic journey stage:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs pt-1">
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">1. Reach & Exposure</span>
                  <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">Public Awareness</span>
                </div>
                <p className="text-slate-600"><strong>Focus:</strong> Broad public awareness and campaign visibility.</p>
                <p className="text-slate-500 italic">"How many total people will see, hear, or encounter your message?"</p>
                <p className="text-[11px] text-slate-400">e.g., Video views, radio/broadcast listeners, social impressions.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">2. Engagement & Connection</span>
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Digital Conversation</span>
                </div>
                <p className="text-slate-600"><strong>Focus:</strong> Interactive, two-way communication and online relationships.</p>
                <p className="text-slate-500 italic">"How many people will actively interact with your content or digital team?"</p>
                <p className="text-[11px] text-slate-400">e.g., DM inquiries, prayer requests, comments, Power of 10 conversations.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">3. Connection & Bridging Handoff</span>
                  <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">In-Person Steps</span>
                </div>
                <p className="text-slate-600"><strong>Focus:</strong> Transitioning people from digital contact into real-world relationships.</p>
                <p className="text-slate-500 italic">"How many people will take a direct next step into a physical or hosted environment?"</p>
                <p className="text-[11px] text-slate-400">e.g., Class 1 (local church) / Class 2 bridging attendees, seminar sign-ups.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">4. Discipleship & Retention</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Church Integration</span>
                </div>
                <p className="text-slate-600"><strong>Focus:</strong> Long-term spiritual growth, fellowship, and local church belonging.</p>
                <p className="text-slate-500 italic">"How many individuals will be nurtured into ongoing discipleship and church community?"</p>
                <p className="text-[11px] text-slate-400">e.g., Small group participants, completed Bible study series, baptisms.</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 md:col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">5. Mobilization & Capability Building</span>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Leader Equipping</span>
                </div>
                <p className="text-slate-600"><strong>Focus:</strong> Equipping, training, and activating local members and creators for ministry.</p>
                <p className="text-slate-500 italic">"How many trained leaders, creators, or volunteers will actively put their skills into practice?"</p>
                <p className="text-[11px] text-slate-400">e.g., Digital missionaries active after 90 days, creators publishing monthly, host teams deployed.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition"
          >
            Got it, return to workbook
          </button>
        </div>
      </div>
    </div>
  );
}
