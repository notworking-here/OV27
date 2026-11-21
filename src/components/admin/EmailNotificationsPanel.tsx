import React, { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  ShieldCheck,
  Info,
  Eye,
  FileText,
  Gauge,
  ChevronDown,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  EMAIL_TEMPLATE_PREVIEW_KEYS,
  EmailQuotaStatus,
  EmailServiceStatus,
  EmailTemplatePreviewKey,
  buildEmailTemplatePreview,
  fetchEmailServiceStatus,
  sendSampleTemplateEmail,
  sendTestEmailNotification,
  updateEmailQuotaConfig,
} from '../../services/emailNotificationService';

export interface EmailNotificationsPanelProps {
  currentAdminEmail?: string;
  currentAdminName?: string;
}

const UPDATED_APPS_SCRIPT_SNIPPET = `const WEBHOOK_SECRET = 'YOUR_MATCHING_EMAIL_WEBHOOK_SECRET';

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!WEBHOOK_SECRET || payload.secret !== WEBHOOK_SECRET) {
      return jsonOut({ ok: false, error: 'Unauthorized: secret mismatch.' });
    }

    // Live quota check (does not send an email)
    if (payload.action === 'quota') {
      return jsonOut({
        ok: true,
        quotaOnly: true,
        remainingDailyQuota: MailApp.getRemainingDailyQuota(),
      });
    }

    const toList = Array.isArray(payload.to) ? payload.to : [payload.to].filter(Boolean);
    if (!toList.length) {
      return jsonOut({ ok: false, error: 'Missing recipient list.' });
    }

    const htmlBody = payload.html || payload.htmlBody || '';
    const textBody = payload.text || payload.textBody || payload.body || '';
    const options = {
      name: payload.senderName || 'SSD OneVoice27',
    };
    if (htmlBody) options.htmlBody = htmlBody;
    if (Array.isArray(payload.cc) && payload.cc.length) options.cc = payload.cc.join(',');
    if (payload.replyTo) options.replyTo = payload.replyTo;

    MailApp.sendEmail(
      toList.join(','),
      payload.subject || '[OneVoice27] Notification',
      textBody || 'Please view this notification in an HTML-capable email client.',
      options
    );

    return jsonOut({
      ok: true,
      sentCount: toList.length,
      remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export function EmailNotificationsPanel({
  currentAdminEmail,
  currentAdminName,
}: EmailNotificationsPanelProps) {
  const [status, setStatus] = useState<EmailServiceStatus>({
    configured: false,
    hasWebhookUrl: false,
    hasWebhookSecret: false,
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplatePreviewKey>('step4_revision');
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');
  const [sendingSample, setSendingSample] = useState(false);
  const [sampleFeedback, setSampleFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [showMaximizeGuide, setShowMaximizeGuide] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const templatePreviews = useMemo(() => {
    return EMAIL_TEMPLATE_PREVIEW_KEYS.map((key) =>
      buildEmailTemplatePreview(key, currentAdminName, currentAdminEmail)
    );
  }, [currentAdminName, currentAdminEmail]);

  const activePreview = useMemo(() => {
    return (
      templatePreviews.find((t) => t.key === selectedTemplate) || templatePreviews[0]
    );
  }, [templatePreviews, selectedTemplate]);

  const applyQuotaUpdate = (nextQuota?: EmailQuotaStatus) => {
    if (!nextQuota) return;
    setStatus((prev) => ({ ...prev, quota: nextQuota }));
  };

  const loadStatus = async (syncGoogle = true) => {
    setLoadingStatus(true);
    try {
      const s = await fetchEmailServiceStatus(syncGoogle);
      setStatus(s);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus(true);
  }, []);

  const handleUpdateQuotaConfig = async (patch: {
    dailyLimit?: number;
    essentialOnlyMode?: boolean;
  }) => {
    setUpdatingConfig(true);
    try {
      const res = await updateEmailQuotaConfig(patch);
      if (res.ok && res.quota) {
        applyQuotaUpdate(res.quota);
      }
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(UPDATED_APPS_SCRIPT_SNIPPET);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      // ignore clipboard errors in restricted browsers
    }
  };

  const handleSendTest = async () => {
    if (!currentAdminEmail || sendingTest) return;
    setSendingTest(true);
    setTestFeedback(null);
    try {
      const res = await sendTestEmailNotification({
        toEmail: currentAdminEmail,
        actorName: currentAdminName,
      });
      if (res.quota) applyQuotaUpdate(res.quota);
      if (res.ok) {
        setTestFeedback({
          type: 'success',
          text: `Test email sent cleanly to ${currentAdminEmail}. Check your inbox (and Sent folder of your dedicated workspace account).`,
        });
      } else {
        setTestFeedback({
          type: 'error',
          text: res.error || 'Could not send test email.',
        });
      }
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendSampleTemplate = async () => {
    if (!currentAdminEmail || sendingSample) return;
    setSendingSample(true);
    setSampleFeedback(null);
    try {
      const res = await sendSampleTemplateEmail({
        templateKey: activePreview.key,
        toEmail: currentAdminEmail,
        actorName: currentAdminName,
      });
      if (res.quota) applyQuotaUpdate(res.quota);
      if (res.ok) {
        setSampleFeedback({
          type: 'success',
          text: `Sample "${activePreview.shortLabel}" email sent to ${currentAdminEmail}. Check your inbox to inspect it in Gmail/Outlook.`,
        });
      } else {
        setSampleFeedback({
          type: 'error',
          text: res.error || 'Could not send sample email.',
        });
      }
    } finally {
      setSendingSample(false);
    }
  };

  const quota = status.quota;
  const usedPercent = quota && quota.dailyLimit > 0
    ? Math.min(100, Math.round((quota.usedToday / quota.dailyLimit) * 100))
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Status Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                status.configured
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>Google Workspace Apps Script Email Relay</span>
                {loadingStatus ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Checking...
                  </span>
                ) : status.configured ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Ready &amp; Active
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    Secrets Needed
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Zero-cost automated emails sent via your dedicated Google Workspace sender using
                server-side secrets.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadStatus(true)}
            disabled={loadingStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Env Check Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-mono font-bold text-slate-800">EMAIL_WEBHOOK_URL</span>
              <span className="block text-[11px] text-slate-500">
                Apps Script Web App (<code className="font-mono">/exec</code>) URL
              </span>
            </div>
            {status.hasWebhookUrl ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-mono font-bold text-slate-800">EMAIL_WEBHOOK_SECRET</span>
              <span className="block text-[11px] text-slate-500">
                Shared secret matching Apps Script
              </span>
            </div>
            {status.hasWebhookSecret ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
          </div>
        </div>

        {!loadingStatus && !status.configured && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Environment Secrets Not Detected Yet</span>
            </span>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Add <code className="font-mono font-bold">EMAIL_WEBHOOK_URL</code> and{' '}
              <code className="font-mono font-bold">EMAIL_WEBHOOK_SECRET</code> in AI Studio{' '}
              <strong>Secrets</strong> (without any <code className="font-mono">VITE_</code> prefix).
              If you just saved them, refresh the preview or restart the dev server so the backend
              loads the new environment values.
            </p>
          </div>
        )}

        {/* Test Email Action */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Test Destination:</span>{' '}
            <span>{currentAdminEmail || 'No admin email signed in'}</span>
            <span className="block text-[11px] text-slate-500">
              Sends a sample message only to your signed-in account (never to proposal contacts).
            </span>
          </div>

          <button
            type="button"
            onClick={handleSendTest}
            disabled={!status.configured || !currentAdminEmail || sendingTest || quota?.quotaExhausted}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1c398e] hover:bg-[#152c70] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sendingTest ? 'Sending Test...' : 'Send Test Email to Myself'}</span>
          </button>
        </div>

        {testFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              testFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {testFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{testFeedback.text}</span>
          </div>
        )}
      </div>

      {/* Daily Email Counter & Quota Management */}
      {quota && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#1c398e]" />
                <span>Daily Email Counter &amp; Quota Management</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Google counts every recipient address sent per day (midnight Pacific Time reset).
              </p>
            </div>

            <span
              className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full self-start sm:self-center ${
                quota.source === 'google_live'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {quota.source === 'google_live'
                ? 'Synced Live from Google'
                : 'Server-Tracked Today'}
            </span>
          </div>

          {quota.quotaExhausted && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold block">
                  Daily Email Quota Maxed Out — Safe Fallback Active
                </span>
                <p className="text-[11.5px] text-rose-900 leading-relaxed">
                  All email sends are safely paused until Google&apos;s daily reset ({quota.dateKey}{' '}
                  PT). <strong>Nothing in the workflow breaks:</strong> Step 3 approvals, Step 4
                  votes, Step 5 authorizations, and in-app notification bells continue saving
                  normally, and confirmation modals automatically disable email sending.
                </p>
              </div>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                Sent Today (Recipients)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 tabular-nums">
                  {quota.usedToday.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  / {quota.dailyLimit.toLocaleString()} max
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5 tabular-nums">
                {quota.messagesSentToday} email {quota.messagesSentToday === 1 ? 'dispatch' : 'dispatches'} triggered via portal
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                Remaining Today
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-black tabular-nums ${
                    quota.quotaExhausted
                      ? 'text-rose-600'
                      : quota.isLowQuota
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {quota.remainingQuota.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">recipients left</span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {quota.quotaExhausted
                  ? 'Resumes automatically after Google daily reset'
                  : quota.isLowQuota
                  ? 'Low quota — Quota-Saver defaults engaged'
                  : `Resets daily (${quota.dateKey} PT)`}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                Google Account Limit Preset
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={updatingConfig}
                  onClick={() => handleUpdateQuotaConfig({ dailyLimit: 1500 })}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    quota.dailyLimit >= 1000
                      ? 'bg-[#1c398e] text-white border-[#1c398e]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Workspace · 1,500
                </button>
                <button
                  type="button"
                  disabled={updatingConfig}
                  onClick={() => handleUpdateQuotaConfig({ dailyLimit: 100 })}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    quota.dailyLimit < 1000
                      ? 'bg-[#1c398e] text-white border-[#1c398e]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Free Gmail · 100
                </button>
              </div>
              <span className="text-[10.5px] text-slate-500 block leading-tight">
                Paid <code className="font-mono">@adventist.asia</code> Workspace gets 1,500/day.
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>Daily Quota Utilization</span>
              <span className="tabular-nums">{usedPercent}% used</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/70">
              <div
                className={`h-full transition-all duration-300 ${
                  quota.quotaExhausted
                    ? 'bg-rose-600'
                    : usedPercent >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.max(usedPercent, quota.usedToday > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>

          {/* Essential-Only Quota-Saver Mode Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1c398e]" />
                <span>Quota-Saver Mode (Essential Emails Default ON Only)</span>
              </span>
              <p className="text-[11px] text-slate-600 leading-snug">
                When enabled, only <strong>Step 4 Revision Requests</strong> and{' '}
                <strong>Step 5 Final Authorizations</strong> default checked ON; Step 3 Union
                Approvals and Step 4 Recommend votes stay opt-in (saves ~40–60% of daily quota).
              </p>
            </div>

            <button
              type="button"
              disabled={updatingConfig}
              onClick={() =>
                handleUpdateQuotaConfig({ essentialOnlyMode: !quota.essentialOnlyMode })
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer border ${
                quota.essentialOnlyMode
                  ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {quota.essentialOnlyMode ? 'Quota-Saver: ON' : 'Quota-Saver: OFF'}
            </button>
          </div>

          {/* Maximize Quota Tips + Live Sync Apps Script Accordion */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMaximizeGuide((v) => !v)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 transition cursor-pointer"
            >
              <span>How to Maximize Daily Emails &amp; Sync Live Google Remaining Quota</span>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  showMaximizeGuide ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showMaximizeGuide && (
              <div className="p-4 bg-white border-t border-slate-200 space-y-3 text-xs text-slate-700">
                <ul className="space-y-1.5 list-disc pl-5 text-[11.5px] leading-relaxed">
                  <li>
                    <strong>Automatic deduplication &amp; self-exclusion:</strong> If one officer is
                    both Point of Contact and Union Lead, they only receive 1 email, and whoever
                    clicks Approve/Vote is excluded from emailing themselves.
                  </li>
                  <li>
                    <strong>Use Google Group aliases as contacts (15× multiplier):</strong> Google
                    counts each address on the <code className="font-mono">To:</code> line. Sending
                    to one Union Officers Group email (e.g.{' '}
                    <code className="font-mono">swpuc-officers@adventist.asia</code>) counts as{' '}
                    <strong>1 recipient</strong> instead of 5–10 separate officer addresses.
                  </li>
                  <li>
                    <strong>Use Quota-Saver Mode during peak review weeks:</strong> Saves 40–60% of
                    quota by keeping only urgent Revision Requests and Step 5 Authorizations ON by
                    default while relying on the in-app bell for routine progress.
                  </li>
                </ul>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-800">
                      Optional: Update Apps Script (<code className="font-mono">Code.gs</code>) so{' '}
                      <code className="font-mono">Refresh Status</code> reads Google&apos;s exact live
                      remaining quota:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Code.gs</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed">
                    {UPDATED_APPS_SCRIPT_SNIPPET}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Workflow Email Templates Previewer */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#1c398e]" />
              <span>Workflow Email Templates &amp; Live Preview</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect the exact HTML layout for each step and send a sample copy directly to your inbox.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPreviewMode('html')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  previewMode === 'html'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>HTML</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('text')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  previewMode === 'text'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Plain Text</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSendSampleTemplate}
              disabled={!status.configured || !currentAdminEmail || sendingSample || quota?.quotaExhausted}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-2xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingSample ? 'Sending...' : 'Send Sample to Myself'}</span>
            </button>
          </div>
        </div>

        {/* Step Template Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {templatePreviews.map((tpl) => {
            const isSelected = tpl.key === activePreview.key;
            return (
              <button
                key={tpl.key}
                type="button"
                onClick={() => {
                  setSelectedTemplate(tpl.key);
                  setSampleFeedback(null);
                }}
                className={`text-left px-3 py-2.5 rounded-xl border text-xs transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#1c398e]/5 border-[#1c398e] text-[#1c398e] shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-extrabold block truncate">{tpl.shortLabel}</span>
                <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                  {tpl.defaultChecked ? 'Default: Checked ON' : 'Default: Opt-in OFF'}
                </span>
              </button>
            );
          })}
        </div>

        {sampleFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              sampleFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {sampleFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{sampleFeedback.text}</span>
          </div>
        )}

        {/* Email Header Metadata Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
            <span className="font-bold text-slate-500 w-24 shrink-0">Subject:</span>
            <span className="font-mono font-bold text-slate-900 break-words">
              {activePreview.subject}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
            <span className="font-bold text-slate-500 w-24 shrink-0">Trigger:</span>
            <span className="text-slate-700">{activePreview.triggerStep}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
            <span className="font-bold text-slate-500 w-24 shrink-0">Recipients:</span>
            <span className="text-slate-700 font-medium">{activePreview.recipientsSummary}</span>
          </div>
        </div>

        {/* Rendered Preview Frame */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
          {previewMode === 'html' ? (
            <iframe
              key={activePreview.key}
              title={`Email preview: ${activePreview.label}`}
              srcDoc={activePreview.html}
              sandbox=""
              className="w-full h-[540px] bg-slate-100 border-0 block"
            />
          ) : (
            <pre className="p-4 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed bg-white max-h-[540px] overflow-y-auto">
              {activePreview.text}
            </pre>
          )}
        </div>
      </div>

      {/* Routing Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1c398e]" />
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            Automated Email Routing &amp; Safety Rules
          </h4>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="font-bold text-slate-900">Step 3 · Union Committee Approval</span>
              <span className="block text-[11px] text-slate-500">
                Includes Committee Action #, Union, budget, and direct proposal link
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-800">
              Assigned Division Liaisons + Point of Contact / Owner + Union Lead
            </span>
          </div>

          <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="font-bold text-slate-900">Step 4 · Request for Revision</span>
              <span className="block text-[11px] text-slate-500">
                Includes flagged 7-Question Rubric action items, Liaison remarks &amp; Reopen Review guide
              </span>
            </div>
            <span className="text-[11px] font-semibold text-amber-800">
              Point of Contact / Owner + Union Lead + Union Treasurers &amp; Coordinators
            </span>
          </div>

          <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <span className="font-bold text-slate-900">Step 5 · SSD OV27 Committee Authorization</span>
              <span className="block text-[11px] text-slate-500">
                Includes locked GC Project Code, OV27 Ref #, authorized grant &amp; Step 6 link
              </span>
            </div>
            <span className="text-[11px] font-semibold text-blue-800">
              Point of Contact / Owner + Union Lead + Union Officers + Assigned Liaisons
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 pt-1">
          All recipients are deduplicated automatically, the acting officer is excluded from
          receiving their own trigger email, and live emails are automatically paused whenever Role
          Preview mode is active.
        </p>
      </div>
    </div>
  );
}
