import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import {
  Proposal,
  UNION_ACRONYMS,
  getCanonicalUnion,
} from './src/types';
import {
  toExternalProposalJson,
  isProposalApprovedForApi,
  buildCollisionFreeUnionSequenceMap,
  ExternalProposalApiListItem,
} from './src/utils/externalProposalCodec';
import { computeAllProposalsFundingAttribution } from './src/utils/fundingAttribution';
import {
  BUDGET_ALLOCATIONS_DOC,
  DEFAULT_OFFICIAL_UNION_ALLOCATIONS,
  GC_API_META_DOC,
  GcApiPublicMeta,
  SETTINGS_COLLECTION,
  reconcileShiftedV1Allocations,
} from './src/services/proposalService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase for Server-Side Read-Only Approved Proposals API
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const serverDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const SERVER_CONFIG_CACHE_TTL_MS = 60_000;
let cachedApiMeta: { data: GcApiPublicMeta; expiresAt: number } | null = null;
let cachedBudgetDetails: {
  data: { allocations: Record<string, number>; matchingPledges: Record<string, number> };
  expiresAt: number;
} | null = null;

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function timingSafeMatchSha256(providedKey: string, expectedHashHex: string): boolean {
  if (!providedKey || !expectedHashHex || expectedHashHex.length !== 64) {
    return false;
  }
  try {
    const providedDigest = crypto.createHash('sha256').update(providedKey, 'utf8').digest();
    const expectedDigest = Buffer.from(expectedHashHex, 'hex');
    if (providedDigest.length !== expectedDigest.length) {
      return false;
    }
    return crypto.timingSafeEqual(providedDigest, expectedDigest);
  } catch {
    return false;
  }
}

async function getServerApiMeta(): Promise<GcApiPublicMeta> {
  const now = Date.now();
  if (cachedApiMeta && now < cachedApiMeta.expiresAt) {
    return cachedApiMeta.data;
  }

  const envKey = (process.env.GC_API_KEY || '').trim();
  const fallback: GcApiPublicMeta = {
    apiKeyHash: envKey ? sha256Hex(envKey) : '',
    enabled: true,
    orgId: 'AT1111',
    approvedOnly: true,
  };

  try {
    const snap = await getDoc(doc(serverDb, 'settings', GC_API_META_DOC));
    if (snap.exists()) {
      const data = snap.data() as Partial<GcApiPublicMeta>;
      const resolved: GcApiPublicMeta = {
        apiKeyHash: data.apiKeyHash || fallback.apiKeyHash,
        enabled: data.enabled !== false,
        orgId: data.orgId || 'AT1111',
        approvedOnly: true,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
      cachedApiMeta = { data: resolved, expiresAt: now + SERVER_CONFIG_CACHE_TTL_MS };
      return resolved;
    }
  } catch (err) {
    console.warn('Server API metadata lookup notice:', err);
  }

  cachedApiMeta = { data: fallback, expiresAt: now + 15_000 };
  return fallback;
}

async function getServerBudgetAllocationDetails(): Promise<{
  allocations: Record<string, number>;
  matchingPledges: Record<string, number>;
}> {
  const now = Date.now();
  if (cachedBudgetDetails && now < cachedBudgetDetails.expiresAt) {
    return cachedBudgetDetails.data;
  }

  const fallback = {
    allocations: { ...DEFAULT_OFFICIAL_UNION_ALLOCATIONS },
    matchingPledges: {} as Record<string, number>,
  };

  try {
    const snap = await getDoc(doc(serverDb, SETTINGS_COLLECTION, BUDGET_ALLOCATIONS_DOC));
    if (snap.exists()) {
      const data = snap.data();
      const rawAlloc = { ...((data.allocations as Record<string, number>) || {}) };
      const matchingPledges = { ...((data.matchingPledges as Record<string, number>) || {}) };
      const docVersion = Number(data.allocationSchemaVersion) || 1;
      delete rawAlloc['Southern Asia-Pacific Division (SSD Headquarters)'];
      delete rawAlloc['Other Union / Attached Field'];
      delete matchingPledges['Southern Asia-Pacific Division (SSD Headquarters)'];
      delete matchingPledges['Other Union / Attached Field'];

      const { allocations } = reconcileShiftedV1Allocations(rawAlloc, docVersion);
      const resolved = { allocations, matchingPledges };
      cachedBudgetDetails = { data: resolved, expiresAt: now + SERVER_CONFIG_CACHE_TTL_MS };
      return resolved;
    }
  } catch (err) {
    console.warn('Server budget allocations lookup notice:', err);
  }

  cachedBudgetDetails = { data: fallback, expiresAt: now + 15_000 };
  return fallback;
}

// Strict header-only extraction (prevents API keys leaking in URL query access logs)
function extractRequestApiKey(req: Request): string {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

// Lightweight sliding-window rate limiter per client IP on /api/v1/*
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const ipRequestBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimitApi(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip) || 'unknown';

  let bucket = ipRequestBuckets.get(clientIp);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipRequestBuckets.set(clientIp, bucket);
  }

  bucket.count += 1;
  if (ipRequestBuckets.size > 2000) {
    for (const [k, v] of ipRequestBuckets.entries()) {
      if (now >= v.resetAt) ipRequestBuckets.delete(k);
    }
  }

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'API rate limit exceeded. Please wait before retrying.',
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }

  next();
}

async function requireGcApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const meta = await getServerApiMeta();
    if (!meta.enabled) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'GC External API access is currently paused by Division Administration.',
      });
      return;
    }

    const providedKey = extractRequestApiKey(req);
    if (!providedKey || !meta.apiKeyHash || !timingSafeMatchSha256(providedKey, meta.apiKeyHash)) {
      res.status(401).json({
        error: 'Unauthorized',
        message:
          'Invalid or missing API Key. Pass your key via the "x-api-key" header or "Authorization: Bearer <API_KEY>".',
      });
      return;
    }

    next();
  } catch (err) {
    console.error('API authentication error:', err);
    res.status(500).json({ error: 'Internal Server Error during authentication.' });
  }
}

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
}

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const token = (idToken || '').trim();
  const apiKey = (firebaseConfig?.apiKey || '').trim();
  if (!token || !apiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; email?: string; disabled?: boolean }>;
    };
    const user = data?.users?.[0];
    if (!user || user.disabled || !user.localId || !user.email) {
      return null;
    }
    return {
      uid: user.localId,
      email: user.email,
    };
  } catch (err) {
    console.warn('Firebase ID token verification error:', err);
    return null;
  }
}

async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token =
    typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';

  if (!token) {
    res.status(401).json({
      ok: false,
      error: 'Unauthorized: Missing Firebase authentication token.',
    });
    return;
  }

  const verified = await verifyFirebaseIdToken(token);
  if (!verified) {
    res.status(401).json({
      ok: false,
      error: 'Unauthorized: Invalid or expired Firebase session token.',
    });
    return;
  }

  (req as Request & { firebaseUser?: VerifiedFirebaseUser }).firebaseUser = verified;
  next();
}

function sanitizeEmailList(input: unknown, maxCount: number): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || trimmed.length > 254 || !EMAIL_FORMAT_REGEX.test(trimmed)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
    if (out.length >= maxCount) break;
  }
  return out;
}

interface GcApiSnapshotDoc {
  updatedAt: string;
  orgId: string;
  items: ExternalProposalApiListItem[];
  envelopesById?: Record<string, ReturnType<typeof toExternalProposalJson>>;
}

async function fetchStep5ExportFromFirestore(providedApiKey: string): Promise<GcApiSnapshotDoc | null> {
  if (!providedApiKey) return null;
  const exportDocId = sha256Hex(`${providedApiKey}:gc_export_v1`);
  try {
    const snap = await getDoc(doc(serverDb, 'gc_api_snapshots', exportDocId));
    if (snap.exists()) {
      return snap.data() as GcApiSnapshotDoc;
    }
  } catch (err) {
    console.warn('Notice reading gc_api_snapshots doc:', err);
  }
  return null;
}

async function fetchUnionApprovedProposalsFromFirestore(): Promise<Proposal[]> {
  const q = query(collection(serverDb, 'proposals'), where('status', '==', 'approved'));
  const snapshot = await getDocs(q);
  const proposals: Proposal[] = [];
  snapshot.forEach((docSnap) => {
    proposals.push({ ...(docSnap.data() as Proposal), id: docSnap.id });
  });
  return proposals.sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // CORS middleware for /api/* routes so external GC servers and tools can connect cleanly
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use('/api/v1', rateLimitApi);

  // Admin cache invalidation hook when API key is rotated, toggled, or budget allocations updated
  app.post('/api/v1/admin/invalidate-cache', (_req: Request, res: Response) => {
    cachedApiMeta = null;
    cachedBudgetDetails = null;
    res.json({ ok: true });
  });

  // 1. Public Health & Discovery Endpoint
  app.get('/api/v1/health', async (_req: Request, res: Response) => {
    const meta = await getServerApiMeta();
    res.json({
      status: meta.enabled ? 'ok' : 'paused',
      service: 'OneVoice27 SSD Proposal Integration API',
      division: 'SSD - Southern Asia-Pacific Division',
      orgId: meta.orgId || 'AT1111',
      accessMode: 'one-way-read-only',
      exposedScope: 'step5-authorized-proposals-only',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. List All Step 5 Authorized Proposals (One-Way Read-Only)
  app.get('/api/v1/proposals', requireGcApiKey, async (req: Request, res: Response) => {
    try {
      const providedKey = extractRequestApiKey(req);
      const [meta, exportDoc] = await Promise.all([
        getServerApiMeta(),
        fetchStep5ExportFromFirestore(providedKey),
      ]);
      const defaultOrgId = meta.orgId || 'AT1111';

      let items: ExternalProposalApiListItem[] = [];
      if (exportDoc && Array.isArray(exportDoc.items)) {
        items = exportDoc.items;
      } else {
        // Fallback only if Firestore rules still permit legacy approved queries
        const [budgetDetails, allUnionApproved] = await Promise.all([
          getServerBudgetAllocationDetails(),
          fetchUnionApprovedProposalsFromFirestore().catch(() => [] as Proposal[]),
        ]);
        const { byProposalId: attributionMap } = computeAllProposalsFundingAttribution(
          allUnionApproved,
          budgetDetails.allocations,
          budgetDetails.matchingPledges
        );
        const step5Authorized = allUnionApproved.filter((p) => isProposalApprovedForApi(p));
        const sequenceMap = buildCollisionFreeUnionSequenceMap(step5Authorized);

        items = step5Authorized.map((p) => {
          const canonUnion = getCanonicalUnion(p.union) || p.union || 'SSD';
          const acronym =
            UNION_ACRONYMS[p.union] || UNION_ACRONYMS[canonUnion] || 'SSD';
          const seqIndex = sequenceMap.get(p.id) || 1;
          const externalEnvelope = toExternalProposalJson(
            p,
            seqIndex,
            defaultOrgId,
            attributionMap[p.id]
          );
          return {
            id: p.id,
            union: canonUnion,
            unionAcronym: acronym,
            status: 'approved',
            actionNumber: p.unionApproval?.actionNumber || null,
            approvedAt: p.unionApproval?.timestamp || p.reviewedAt || p.updatedAt || null,
            divisionAuthorizedAt: p.divisionApproval?.timestamp || p.divisionApproval?.authorizedDate || null,
            authorizationRef: p.divisionApproval?.referenceNumber || null,
            updatedAt: p.updatedAt || p.createdAt,
            proposal: externalEnvelope.proposal,
            projectCode: externalEnvelope.projectCode,
          };
        });
      }

      // Optional Filter: ?union=ECPUC or full union name
      if (typeof req.query.union === 'string' && req.query.union.trim()) {
        const uFilter = req.query.union.trim().toLowerCase();
        const targetCanon = getCanonicalUnion(req.query.union).toLowerCase();
        items = items.filter(
          (item) =>
            item.unionAcronym.toLowerCase() === uFilter ||
            item.union.toLowerCase() === uFilter ||
            (targetCanon && item.union.toLowerCase() === targetCanon)
        );
      }

      // Optional Filter: ?focusId=1|2|3
      if (typeof req.query.focusId === 'string' && req.query.focusId.trim()) {
        const focusNum = Number(req.query.focusId.trim());
        if (!isNaN(focusNum)) {
          items = items.filter((item) => item.proposal.focusId === focusNum);
        }
      }

      // Optional Filter: ?strategicProjectId=1..7
      if (
        typeof req.query.strategicProjectId === 'string' &&
        req.query.strategicProjectId.trim()
      ) {
        const projNum = Number(req.query.strategicProjectId.trim());
        if (!isNaN(projNum)) {
          items = items.filter((item) => item.proposal.strategicProjectId === projNum);
        }
      }

      // Optional Filter: ?updatedSince=YYYY-MM-DD
      if (typeof req.query.updatedSince === 'string' && req.query.updatedSince.trim()) {
        const sinceTime = new Date(req.query.updatedSince.trim()).getTime();
        if (!isNaN(sinceTime)) {
          items = items.filter((item) => new Date(item.updatedAt).getTime() >= sinceTime);
        }
      }

      // Optional Format: ?format=raw_array returns an array of pure { proposal, projectCode } objects
      if (req.query.format === 'raw_array') {
        res.json(
          items.map((it) => ({
            proposal: it.proposal,
            projectCode: it.projectCode,
          }))
        );
        return;
      }

      res.json({
        organization: 'Southern Asia-Pacific Division (SSD)',
        orgId: defaultOrgId,
        scope: 'approved_only',
        authorizationGate: 'step5_ssd_ov27_committee',
        count: items.length,
        exportedAt: new Date().toISOString(),
        proposals: items,
      });
    } catch (err) {
      console.error('Error in GET /api/v1/proposals:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Could not retrieve authorized proposals from database.',
      });
    }
  });

  // 3. Get a Single Step 5 Authorized Proposal by Document ID or Project Code ID
  app.get('/api/v1/proposals/:id', requireGcApiKey, async (req: Request, res: Response) => {
    try {
      const targetId = String(req.params.id || '').trim();
      if (!targetId || targetId.length > 160) {
        res.status(400).json({ error: 'Invalid or missing proposal ID parameter.' });
        return;
      }

      const providedKey = extractRequestApiKey(req);
      const exportDoc = await fetchStep5ExportFromFirestore(providedKey);
      if (exportDoc?.envelopesById) {
        const matched =
          exportDoc.envelopesById[targetId] || exportDoc.envelopesById[targetId.toLowerCase()];
        if (matched) {
          res.json(matched);
          return;
        }
      }

      res.status(404).json({
        error: 'Not Found',
        message: `No Step 5 SSD OV27 authorized proposal found matching ID "${targetId}". Only Step 5 authorized proposals are exposed via this API.`,
      });
    } catch (err) {
      console.error('Error in GET /api/v1/proposals/:id:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Could not retrieve proposal from database.',
      });
    }
  });

  interface EmailQuotaState {
    dateKey: string;
    messagesSentToday: number;
    recipientsSentToday: number;
    dailyLimit: number;
    googleRemainingQuota: number | null;
    quotaExhausted: boolean;
    essentialOnlyMode: boolean;
    lastError: string | null;
    lastSentAt: string | null;
    lastSyncedAt: string | null;
  }

  const EMAIL_QUOTA_FILE = '/tmp/onevoice27-email-quota.json';

  function getGoogleQuotaDateKey(): string {
    try {
      // Google Apps Script resets daily email quota at midnight Pacific Time
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function getConfiguredDefaultDailyLimit(): number {
    const raw = Number(process.env.EMAIL_DAILY_LIMIT || 1500);
    if (Number.isFinite(raw) && raw >= 50 && raw <= 10000) {
      return Math.floor(raw);
    }
    return 1500;
  }

  function loadEmailQuotaState(): EmailQuotaState {
    const todayKey = getGoogleQuotaDateKey();
    const defaultLimit = getConfiguredDefaultDailyLimit();
    const fresh: EmailQuotaState = {
      dateKey: todayKey,
      messagesSentToday: 0,
      recipientsSentToday: 0,
      dailyLimit: defaultLimit,
      googleRemainingQuota: null,
      quotaExhausted: false,
      essentialOnlyMode: false,
      lastError: null,
      lastSentAt: null,
      lastSyncedAt: null,
    };

    try {
      if (fs.existsSync(EMAIL_QUOTA_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(EMAIL_QUOTA_FILE, 'utf8')) as Partial<EmailQuotaState>;
        const persistedLimit =
          typeof parsed.dailyLimit === 'number' && parsed.dailyLimit >= 50 && parsed.dailyLimit <= 10000
            ? Math.floor(parsed.dailyLimit)
            : defaultLimit;
        const essentialOnlyMode = Boolean(parsed.essentialOnlyMode);

        if (parsed.dateKey === todayKey) {
          return {
            ...fresh,
            messagesSentToday: Math.max(0, Number(parsed.messagesSentToday) || 0),
            recipientsSentToday: Math.max(0, Number(parsed.recipientsSentToday) || 0),
            dailyLimit: persistedLimit,
            googleRemainingQuota:
              typeof parsed.googleRemainingQuota === 'number' && Number.isFinite(parsed.googleRemainingQuota)
                ? Math.max(0, Math.floor(parsed.googleRemainingQuota))
                : null,
            quotaExhausted: Boolean(parsed.quotaExhausted),
            essentialOnlyMode,
            lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
            lastSentAt: typeof parsed.lastSentAt === 'string' ? parsed.lastSentAt : null,
            lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
          };
        }

        // New day rollover: reset daily counters while keeping account limit & essential-only preference
        return {
          ...fresh,
          dailyLimit: persistedLimit,
          essentialOnlyMode,
        };
      }
    } catch {
      // ignore local cache read failure
    }

    return fresh;
  }

  let emailQuotaState: EmailQuotaState = loadEmailQuotaState();

  function ensureCurrentDayQuotaState(): EmailQuotaState {
    const todayKey = getGoogleQuotaDateKey();
    if (emailQuotaState.dateKey !== todayKey) {
      emailQuotaState = {
        dateKey: todayKey,
        messagesSentToday: 0,
        recipientsSentToday: 0,
        dailyLimit: emailQuotaState.dailyLimit,
        googleRemainingQuota: null,
        quotaExhausted: false,
        essentialOnlyMode: emailQuotaState.essentialOnlyMode,
        lastError: null,
        lastSentAt: null,
        lastSyncedAt: null,
      };
      persistEmailQuotaState();
    }
    return emailQuotaState;
  }

  function persistEmailQuotaState() {
    try {
      fs.writeFileSync(EMAIL_QUOTA_FILE, JSON.stringify(emailQuotaState, null, 2), 'utf8');
    } catch {
      // non-fatal if /tmp is unavailable
    }
  }

  function buildPublicQuotaSnapshot() {
    const s = ensureCurrentDayQuotaState();
    const localRemaining = Math.max(0, s.dailyLimit - s.recipientsSentToday);
    const remainingQuota = s.quotaExhausted
      ? 0
      : s.googleRemainingQuota !== null
      ? Math.max(0, s.googleRemainingQuota)
      : localRemaining;

    const effectiveLimit =
      s.googleRemainingQuota !== null && s.googleRemainingQuota + s.recipientsSentToday > s.dailyLimit
        ? s.googleRemainingQuota + s.recipientsSentToday
        : s.dailyLimit;

    const usedToday = Math.max(
      s.recipientsSentToday,
      s.googleRemainingQuota !== null ? Math.max(0, effectiveLimit - s.googleRemainingQuota) : 0
    );

    const lowThreshold = Math.max(15, Math.floor(effectiveLimit * 0.1));
    const isLowQuota = !s.quotaExhausted && remainingQuota > 0 && remainingQuota <= lowThreshold;

    return {
      dateKey: s.dateKey,
      resetTimezone: 'America/Los_Angeles (Google Daily Reset)',
      messagesSentToday: s.messagesSentToday,
      recipientsSentToday: s.recipientsSentToday,
      usedToday,
      dailyLimit: effectiveLimit,
      remainingQuota,
      googleRemainingQuota: s.googleRemainingQuota,
      source: s.googleRemainingQuota !== null ? ('google_live' as const) : ('server_tracked' as const),
      quotaExhausted: s.quotaExhausted || remainingQuota <= 0,
      isLowQuota,
      essentialOnlyMode: s.essentialOnlyMode,
      lastError: s.lastError,
      lastSentAt: s.lastSentAt,
      lastSyncedAt: s.lastSyncedAt,
    };
  }

  // 4. Email Notification Configuration Status & Daily Quota Counter (Secrets stay strictly server-side)
  app.get(
    '/api/v1/notifications/email-status',
    requireFirebaseAuth,
    async (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      const webhookUrl = (process.env.EMAIL_WEBHOOK_URL || '').trim();
      const webhookSecret = (process.env.EMAIL_WEBHOOK_SECRET || '').trim();
      const configured = Boolean(webhookUrl && webhookSecret);

      const syncGoogleQuota = req.query.syncGoogleQuota === '1';
      if (configured && syncGoogleQuota) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        try {
          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            redirect: 'follow',
            signal: controller.signal,
            body: JSON.stringify({
              secret: webhookSecret,
              action: 'quota',
            }),
          });
          const rawText = await resp.text();
          const parsed = JSON.parse(rawText) as {
            ok?: boolean;
            quotaOnly?: boolean;
            remainingDailyQuota?: number;
          };
          if (
            resp.ok &&
            parsed?.ok === true &&
            parsed?.quotaOnly === true &&
            typeof parsed.remainingDailyQuota === 'number' &&
            Number.isFinite(parsed.remainingDailyQuota)
          ) {
            const state = ensureCurrentDayQuotaState();
            state.googleRemainingQuota = Math.max(0, Math.floor(parsed.remainingDailyQuota));
            state.quotaExhausted = state.googleRemainingQuota <= 0;
            state.lastSyncedAt = new Date().toISOString();
            if (state.googleRemainingQuota > 0) {
              state.lastError = null;
            }
            persistEmailQuotaState();
          }
        } catch {
          // Non-fatal: older Code.gs without action === 'quota' still works cleanly
        } finally {
          clearTimeout(timeout);
        }
      }

      res.json({
        ok: true,
        configured,
        hasWebhookUrl: Boolean(webhookUrl),
        hasWebhookSecret: Boolean(webhookSecret),
        quota: buildPublicQuotaSnapshot(),
      });
    }
  );

  // 4b. Update Daily Limit Preset (1500 Workspace / 100 Free Gmail) & Quota-Saver Essential Mode
  app.post(
    '/api/v1/notifications/email-quota-config',
    requireFirebaseAuth,
    (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      const body = (req.body || {}) as {
        dailyLimit?: unknown;
        essentialOnlyMode?: unknown;
      };
      const state = ensureCurrentDayQuotaState();

      if (typeof body.dailyLimit === 'number' && Number.isFinite(body.dailyLimit)) {
        const clamped = Math.min(10000, Math.max(50, Math.floor(body.dailyLimit)));
        state.dailyLimit = clamped;
        if (state.googleRemainingQuota === null && state.recipientsSentToday < clamped) {
          state.quotaExhausted = false;
        }
      }
      if (typeof body.essentialOnlyMode === 'boolean') {
        state.essentialOnlyMode = body.essentialOnlyMode;
      }

      persistEmailQuotaState();
      res.json({
        ok: true,
        quota: buildPublicQuotaSnapshot(),
      });
    }
  );

  // 5. Email Notification Relay -> Google Workspace Apps Script Web App
  app.post(
    '/api/v1/notifications/email',
    requireFirebaseAuth,
    async (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      try {
        const webhookUrl = (process.env.EMAIL_WEBHOOK_URL || '').trim();
        const webhookSecret = (process.env.EMAIL_WEBHOOK_SECRET || '').trim();

        if (!webhookUrl || !webhookSecret) {
          res.status(503).json({
            ok: false,
            code: 'EMAIL_NOT_CONFIGURED',
            error:
              'Email notification service is not configured yet. Set EMAIL_WEBHOOK_URL and EMAIL_WEBHOOK_SECRET in AI Studio Secrets.',
          });
          return;
        }

        let parsedWebhookUrl: URL;
        try {
          parsedWebhookUrl = new URL(webhookUrl);
        } catch {
          res.status(500).json({
            ok: false,
            code: 'INVALID_WEBHOOK_URL',
            error: 'Configured EMAIL_WEBHOOK_URL is not a valid URL.',
          });
          return;
        }

        if (parsedWebhookUrl.protocol !== 'https:') {
          res.status(500).json({
            ok: false,
            code: 'INVALID_WEBHOOK_PROTOCOL',
            error: 'Configured EMAIL_WEBHOOK_URL must use HTTPS.',
          });
          return;
        }

        const body = (req.body || {}) as {
          to?: unknown;
          cc?: unknown;
          replyTo?: unknown;
          subject?: unknown;
          text?: unknown;
          html?: unknown;
          senderName?: unknown;
          eventType?: unknown;
          proposalId?: unknown;
        };

        const to = sanitizeEmailList(body.to, 25);
        if (to.length === 0) {
          res.status(400).json({
            ok: false,
            error: 'At least one valid recipient email address is required.',
          });
          return;
        }

        const cc = sanitizeEmailList(body.cc, 10);
        const rawReplyTo = typeof body.replyTo === 'string' ? body.replyTo.trim() : '';
        const replyTo =
          rawReplyTo && rawReplyTo.length <= 254 && EMAIL_FORMAT_REGEX.test(rawReplyTo)
            ? rawReplyTo
            : undefined;

        const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
        if (!subject || subject.length > 240) {
          res.status(400).json({
            ok: false,
            error: 'A valid email subject (1-240 characters) is required.',
          });
          return;
        }

        const html = typeof body.html === 'string' ? body.html.trim() : '';
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!html && !text) {
          res.status(400).json({
            ok: false,
            error: 'Email content (html or text) is required.',
          });
          return;
        }
        if (html.length > 65_000 || text.length > 25_000) {
          res.status(400).json({
            ok: false,
            error: 'Email payload exceeds allowed size.',
          });
          return;
        }

        const senderName =
          typeof body.senderName === 'string' && body.senderName.trim()
            ? body.senderName.trim().slice(0, 100)
            : 'SSD OneVoice27';

        const currentQuotaBeforeSend = buildPublicQuotaSnapshot();
        if (currentQuotaBeforeSend.quotaExhausted || currentQuotaBeforeSend.remainingQuota <= 0) {
          res.status(429).json({
            ok: false,
            code: 'DAILY_QUOTA_EXCEEDED',
            quota: currentQuotaBeforeSend,
            error:
              'Daily Google email quota has been reached for today (0 remaining). Proposal approvals, votes, and in-app notifications still save normally; emails resume after Google\'s daily reset.',
          });
          return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        let webhookResp: globalThis.Response;
        try {
          webhookResp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            redirect: 'follow',
            signal: controller.signal,
            body: JSON.stringify({
              secret: webhookSecret,
              to,
              ...(cc.length > 0 ? { cc } : {}),
              ...(replyTo ? { replyTo } : {}),
              subject,
              text: text || undefined,
              textBody: text || undefined,
              body: text || undefined,
              html: html || undefined,
              htmlBody: html || undefined,
              senderName,
            }),
          });
        } finally {
          clearTimeout(timeout);
        }

        const rawResponseText = await webhookResp.text();
        let parsedResult: {
          ok?: boolean;
          status?: string;
          error?: string;
          sentCount?: number;
          remainingDailyQuota?: number;
          message?: string;
        } | null = null;
        try {
          parsedResult = JSON.parse(rawResponseText);
        } catch {
          parsedResult = null;
        }

        if (!webhookResp.ok) {
          res.status(502).json({
            ok: false,
            quota: buildPublicQuotaSnapshot(),
            error:
              parsedResult?.error ||
              `Apps Script webhook responded with HTTP ${webhookResp.status}. Verify Web App deployment is set to "Anyone" and authorized.`,
          });
          return;
        }

        if (!parsedResult) {
          const looksLikeHtml =
            rawResponseText.trim().startsWith('<') ||
            rawResponseText.toLowerCase().includes('<html');
          res.status(502).json({
            ok: false,
            quota: buildPublicQuotaSnapshot(),
            error: looksLikeHtml
              ? 'Apps Script returned an HTML page instead of JSON. Ensure Web App deployment has "Who has access: Anyone" and was authorized once.'
              : 'Apps Script returned an unexpected non-JSON response.',
          });
          return;
        }

        const scriptSucceeded =
          parsedResult.ok === true ||
          parsedResult.status === 'ok' ||
          parsedResult.status === 'success';

        if (!scriptSucceeded) {
          const errMsg = parsedResult.error || 'Apps Script rejected the email request.';
          const isQuotaErr = /too many times|quota|limit exceeded|daily limit|max.*recipients/i.test(
            errMsg
          );
          if (isQuotaErr) {
            const state = ensureCurrentDayQuotaState();
            state.quotaExhausted = true;
            state.googleRemainingQuota = 0;
            state.lastError = errMsg;
            state.lastSyncedAt = new Date().toISOString();
            persistEmailQuotaState();

            res.status(429).json({
              ok: false,
              code: 'DAILY_QUOTA_EXCEEDED',
              quota: buildPublicQuotaSnapshot(),
              error:
                'Daily Google email quota reached (Apps Script limit exceeded). Your workflow action and in-app notifications still save normally; emails resume after Google\'s daily reset.',
            });
            return;
          }

          res.status(502).json({
            ok: false,
            quota: buildPublicQuotaSnapshot(),
            error: errMsg,
          });
          return;
        }

        // Update daily usage counter cleanly
        const recipientCount = to.length + cc.length;
        const state = ensureCurrentDayQuotaState();
        state.messagesSentToday += 1;
        state.recipientsSentToday += recipientCount;
        state.lastSentAt = new Date().toISOString();
        state.lastError = null;
        if (
          typeof parsedResult.remainingDailyQuota === 'number' &&
          Number.isFinite(parsedResult.remainingDailyQuota)
        ) {
          state.googleRemainingQuota = Math.max(0, Math.floor(parsedResult.remainingDailyQuota));
          state.quotaExhausted = state.googleRemainingQuota <= 0;
          state.lastSyncedAt = state.lastSentAt;
        } else if (state.recipientsSentToday >= state.dailyLimit) {
          state.quotaExhausted = true;
        }
        persistEmailQuotaState();

        res.json({
          ok: true,
          sentCount: parsedResult.sentCount ?? to.length,
          recipients: to,
          ...(cc.length > 0 ? { cc } : {}),
          quota: buildPublicQuotaSnapshot(),
        });
      } catch (err) {
        const message =
          err instanceof Error && err.name === 'AbortError'
            ? 'Email webhook request timed out after 15 seconds.'
            : err instanceof Error
            ? err.message
            : 'Unexpected error relaying email notification.';
        console.error('Error in POST /api/v1/notifications/email:', err);
        res.status(502).json({
          ok: false,
          error: message,
        });
      }
    }
  );

  // Catch-all for unknown /api/* routes
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message:
        'Unknown API endpoint. Supported endpoints: GET /api/v1/health, GET /api/v1/proposals, GET /api/v1/proposals/:id, GET /api/v1/notifications/email-status, POST /api/v1/notifications/email',
    });
  });

  // Vite middleware for development or static assets in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OneVoice27 Server & GC API running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
