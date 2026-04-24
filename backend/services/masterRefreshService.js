/**
 * Master Refresh Service — single-click orchestrator for every scheduled
 * data refresh + (optionally) every AI agent. Replaces the need for the
 * user to manually trigger each service individually.
 *
 * Modes:
 *   quick  — data refresh only. No AI. Fast (~20-40s), ~₹0 cost.
 *   full   — quick + AI agents (Market Scout, Pattern Miner, Chief Analyst,
 *            Smart Money Tracker weekly, Meta-Critic weekly). ~90-180s, ~₹30-80.
 *
 * Safety invariants:
 *   - Wraps EVERY sub-task in try/catch. One failure NEVER aborts the run.
 *   - READS from and TRIGGERS existing services. Never modifies trading state.
 *   - Bot runs go through the normal bot-run path (honors kill switches +
 *     market-hours). Disabled bots are skipped quietly.
 *   - Graceful on missing ANTHROPIC_API_KEY — agents return partial success.
 *   - Cost cap: if estimated cost > ₹100 (~$1.20 USD), refuses unless
 *     caller explicitly sets allowExpensive=true.
 *
 * Public API:
 *   runMasterRefresh({ mode, onProgress, trigger, allowExpensive })
 *   getLatestRun()
 *   getRunHistory({ limit })
 *   getRunById(jobId)
 *   getCurrentJob(jobId)     — in-memory snapshot of running job (for status polling)
 *   getCooldownRemainingMs()
 */

const crypto = require('crypto');
const MasterRefreshRun = require('../models/MasterRefreshRun');
const ActionItem = require('../models/ActionItem');
const cadenceService = require('./cadenceService');
const { isMarketOpen } = require('../utils/marketHours');

// Lazy-loaded services — avoid circular imports on first boot + allow the
// service to keep running even if one of these files throws at require time.
function tryRequire(relPath) {
  try { return require(relPath); } catch (_) { return null; }
}

// ── Cost cap (₹100 ≈ $1.20 USD; allow easy override via env) ────────────────
const COST_CAP_USD = parseFloat(process.env.MASTER_REFRESH_COST_CAP_USD || '1.20');

// ── Rate limiter (1 run per 5 minutes, in-memory) ───────────────────────────
const COOLDOWN_MS = parseInt(process.env.MASTER_REFRESH_COOLDOWN_MS || `${5 * 60 * 1000}`, 10);
let lastRunStartedAt = 0;

// ── In-memory job registry (for status polling while running) ───────────────
const runningJobs = new Map();

function getCooldownRemainingMs() {
  const elapsed = Date.now() - lastRunStartedAt;
  return Math.max(0, COOLDOWN_MS - elapsed);
}

function getCurrentJob(jobId) {
  return runningJobs.get(jobId) || null;
}

function getLatestRunningJob() {
  let latest = null;
  for (const snap of runningJobs.values()) {
    if (!latest || snap.startedAt > latest.startedAt) latest = snap;
  }
  return latest;
}

function isWeeklyWindow(date = new Date()) {
  // Used to decide whether the weekly agents (Smart Money / Meta-Critic) should
  // fire on a full-mode run. We fire them if it's been >= 6 days since the
  // weekly cron's natural slot. To keep it simple, we fire whenever the day
  // is Sunday OR Friday (covers the two weekly cron days).
  const d = new Date(date);
  return d.getDay() === 0 || d.getDay() === 5; // Sunday OR Friday
}

function istTime(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

function isAfter6pmIst(date = new Date()) {
  const ist = istTime(date);
  return ist.getHours() >= 18;
}

// ─── Step helpers ───────────────────────────────────────────────────────────

function makeStep(key, label, required = true) {
  return {
    key,
    label,
    required,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    details: '',
    error: null,
    costUSD: 0,
  };
}

function markRunning(step) {
  step.status = 'running';
  step.startedAt = new Date();
}

function markDone(step, details = '', costUSD = 0) {
  step.status = 'done';
  step.completedAt = new Date();
  step.durationMs = step.completedAt.getTime() - (step.startedAt?.getTime() || step.completedAt.getTime());
  step.details = details;
  step.costUSD = costUSD;
}

function markFailed(step, error) {
  step.status = 'failed';
  step.completedAt = new Date();
  step.durationMs = step.completedAt.getTime() - (step.startedAt?.getTime() || step.completedAt.getTime());
  step.error = (error?.message || String(error || 'Unknown error')).slice(0, 300);
}

function markSkipped(step, reason = '') {
  step.status = 'skipped';
  step.completedAt = new Date();
  step.durationMs = step.completedAt.getTime() - (step.startedAt?.getTime() || step.completedAt.getTime());
  step.details = `Skipped: ${reason}`;
}

// ─── Sub-task runners — each is totally isolated (try/catch within) ─────────

async function runUpstoxRefresh(step, results) {
  try {
    markRunning(step);
    const marketDataService = tryRequire('./marketDataService');
    if (!marketDataService) { markSkipped(step, 'marketDataService unavailable'); return; }

    const symbols = ['NIFTY', 'SENSEX', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFC', 'INFY'];
    const data = await marketDataService.getBatchMarketData(symbols);
    results.upstox = { ok: true, symbolsFetched: Object.keys(data || {}).length };
    markDone(step, `LTP cache refreshed for ${results.upstox.symbolsFetched} symbols`);
    cadenceService.reportRun('market-data-update', 'success', 'master-refresh').catch(() => {});
  } catch (err) {
    results.upstox = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runFiiDiiRefresh(step, results) {
  try {
    markRunning(step);
    // Only fetch if after 6 PM IST (NSE publishes ~6 PM) AND not already today
    if (!isAfter6pmIst()) {
      markSkipped(step, 'Skipped (NSE publishes after 6 PM IST)');
      results.fiiDii = { ok: false, skipped: 'pre-6pm' };
      return;
    }
    const fiiDiiService = tryRequire('./fiiDiiService');
    if (!fiiDiiService) { markSkipped(step, 'fiiDiiService unavailable'); return; }

    const latest = await fiiDiiService.getLatest();
    const todayStr = new Date().toISOString().slice(0, 10);
    if (latest && new Date(latest.date).toISOString().slice(0, 10) === todayStr) {
      results.fiiDii = { ok: true, fresh: true, source: 'cache' };
      markSkipped(step, `Already fetched today (FII ₹${latest.fii?.netValue || 0}cr, DII ₹${latest.dii?.netValue || 0}cr)`);
      return;
    }

    const res = await fiiDiiService.refreshLatest();
    if (res.ok) {
      results.fiiDii = { ok: true, source: res.source, fii: res.doc?.fii?.netValue, dii: res.doc?.dii?.netValue };
      markDone(step, `FII ₹${res.doc?.fii?.netValue || 0}cr net · DII ₹${res.doc?.dii?.netValue || 0}cr net (source: ${res.source})`);
      cadenceService.reportRun('fii-dii-daily', 'success', 'master-refresh').catch(() => {});
    } else {
      results.fiiDii = { ok: false, errors: res.errors };
      markFailed(step, new Error((res.errors || []).join('; ')));
    }
  } catch (err) {
    results.fiiDii = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runRegimeRefresh(step, results) {
  try {
    markRunning(step);
    const regimeService = tryRequire('./regimeService');
    if (!regimeService) { markSkipped(step, 'regimeService unavailable'); return; }
    const doc = await regimeService.computeAndStore();
    results.regime = { ok: true, regime: doc.regime, confidence: doc.confidence };
    markDone(step, `${doc.regime} (confidence ${doc.confidence})`);
    cadenceService.reportRun('market-regime', 'success', 'master-refresh').catch(() => {});
  } catch (err) {
    results.regime = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runSectorRotationRefresh(step, results) {
  try {
    markRunning(step);
    const sectorRotationService = tryRequire('./sectorRotationService');
    if (!sectorRotationService) { markSkipped(step, 'sectorRotationService unavailable'); return; }
    const doc = await sectorRotationService.computeAndStore();
    results.sectorRotation = { ok: true, leaders: doc.leaders, laggards: doc.laggards };
    markDone(step, `leaders: ${(doc.leaders || []).join(', ') || 'n/a'} · laggards: ${(doc.laggards || []).join(', ') || 'n/a'}`);
    cadenceService.reportRun('sector-rotation', 'success', 'master-refresh').catch(() => {});
  } catch (err) {
    results.sectorRotation = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runParticipantOI(step, results) {
  try {
    markRunning(step);
    const participantOIService = tryRequire('./participantOIService');
    if (!participantOIService) { markSkipped(step, 'participantOIService unavailable'); return; }

    if (!isAfter6pmIst()) {
      markSkipped(step, 'NSE publishes EOD after 6 PM IST');
      results.participantOI = { ok: false, skipped: 'pre-6pm' };
      return;
    }

    const res = await participantOIService.refreshLatest();
    if (res.ok) {
      const d = res.doc || {};
      results.participantOI = { ok: true, source: res.source, date: d.date };
      markDone(step, `${d.date || 'latest'} · FII fut ratio ${d.fii_long_short_ratio_futures ?? 'n/a'} (source: ${res.source})`);
      cadenceService.reportRun('participant-oi-daily', 'success', 'master-refresh').catch(() => {});
    } else {
      results.participantOI = { ok: false, errors: res.errors };
      markFailed(step, new Error((res.errors || []).join('; ')));
    }
  } catch (err) {
    results.participantOI = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runCorporateEvents(step, results) {
  try {
    markRunning(step);
    const corpSvc = tryRequire('./corporateActionsService');
    if (!corpSvc) { markSkipped(step, 'corporateActionsService unavailable'); return; }
    const r = await corpSvc.refreshAll();
    results.corporateEvents = { ok: true, fetched: r.fetched, upserted: r.upserted };
    markDone(step, `fetched ${r.fetched || 0}, upserted ${r.upserted || 0}`);
    cadenceService.reportRun('corporate-actions', 'success', 'master-refresh').catch(() => {});
  } catch (err) {
    results.corporateEvents = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runLargeDeals(step, results) {
  try {
    markRunning(step);
    const dealSvc = tryRequire('./largeDealsService');
    if (!dealSvc) { markSkipped(step, 'largeDealsService unavailable'); return; }

    if (!isAfter6pmIst()) {
      markSkipped(step, 'NSE publishes large deals after 6 PM IST');
      results.largeDeals = { ok: false, skipped: 'pre-6pm' };
      return;
    }

    const r = await dealSvc.refreshAll();
    results.largeDeals = { ok: true, bulk: r.bulk, block: r.block, short: r.short };
    markDone(step, `bulk=${r.bulk || 0} block=${r.block || 0} short=${r.short || 0}`);
    cadenceService.reportRun('large-deals', 'success', 'master-refresh').catch(() => {});
  } catch (err) {
    results.largeDeals = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runSentinelCycle(step, results) {
  try {
    markRunning(step);
    const sentinelService = tryRequire('./sentinelService');
    if (!sentinelService) { markSkipped(step, 'sentinelService unavailable'); return; }
    const r = await sentinelService.runSentinelCycle();
    const total = (r.missedTasks || 0) + (r.tokenIssues || 0) + (r.drawdownAlerts || 0);
    results.sentinel = { ok: true, ...r, totalAlerts: total };
    markDone(step, `${total} alert(s) surfaced`);
  } catch (err) {
    results.sentinel = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runLearningCycle(step, results) {
  try {
    markRunning(step);
    const learning = tryRequire('./learningEngineService');
    if (!learning) { markSkipped(step, 'learningEngineService unavailable'); return; }
    const r = await learning.runNightlyLearningCycle();
    results.learning = { ok: true, botsProcessed: r.botsProcessed, flagged: (r.results || []).filter(x => x.pauseDecision?.pause).length };
    markDone(step, `bots processed: ${r.botsProcessed || 0}, flagged: ${results.learning.flagged}`);
  } catch (err) {
    results.learning = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runBotTriggers(step, results, { trigger = 'manual' } = {}) {
  try {
    markRunning(step);
    const botService = tryRequire('./botService');
    const holidayService = tryRequire('./holidayService');
    if (!botService) { markSkipped(step, 'botService unavailable'); return; }

    // Respect market hours — if closed, skip but don't error.
    try {
      const { holidays } = holidayService?.getHolidays() || { holidays: [] };
      if (!isMarketOpen(new Date(), holidays)) {
        markSkipped(step, 'Market closed — bot triggers skipped');
        results.bots = { ok: true, skipped: true, reason: 'market closed' };
        return;
      }
    } catch (_) { /* best-effort */ }

    const configs = await botService.listBotConfigs();
    const enabled = (configs || []).filter(c => c.enabled && c.screenId);
    if (enabled.length === 0) {
      markSkipped(step, 'No enabled bots with screen configured');
      results.bots = { ok: true, triggered: 0 };
      return;
    }

    const runs = [];
    for (const cfg of enabled) {
      try {
        const run = await botService.runBot(cfg.botId, { trigger: trigger === 'cron' ? 'auto' : 'manual' });
        runs.push({ botId: cfg.botId, status: run.status, summary: run.summary || run.skipReason || '' });
      } catch (botErr) {
        runs.push({ botId: cfg.botId, status: 'failure', error: botErr.message });
      }
    }
    const succeeded = runs.filter(r => r.status === 'success').length;
    results.bots = { ok: true, triggered: runs.length, succeeded, runs };
    markDone(step, `${succeeded}/${runs.length} bot(s) succeeded`);
  } catch (err) {
    results.bots = { ok: false, error: err.message };
    markFailed(step, err);
  }
}

async function runMarketScout(step, results) {
  try {
    markRunning(step);
    const scout = tryRequire('./agents/marketScout');
    if (!scout) { markSkipped(step, 'Market Scout unavailable'); return; }
    const r = await scout.run();
    results.marketScout = r;
    if (r.success) {
      markDone(step, `briefing generated (conf ${r.output?.confidence ?? 'n/a'})`, r.costUSD || 0);
    } else {
      markFailed(step, new Error(r.error || 'Market Scout failed'));
    }
  } catch (err) {
    results.marketScout = { success: false, error: err.message };
    markFailed(step, err);
  }
}

async function runSmartMoneyTracker(step, results) {
  try {
    markRunning(step);
    if (!isWeeklyWindow()) {
      markSkipped(step, 'Weekly window only (Sunday/Friday)');
      results.smartMoneyTracker = { success: false, skipped: 'not weekly window' };
      return;
    }
    const smt = tryRequire('./agents/smartMoneyTracker');
    if (!smt) { markSkipped(step, 'Smart Money Tracker unavailable'); return; }
    const r = await smt.run();
    results.smartMoneyTracker = r;
    if (r.success) {
      markDone(step, 'weekly smart-money summary saved', r.costUSD || 0);
    } else {
      markFailed(step, new Error(r.error || 'Smart Money Tracker failed'));
    }
  } catch (err) {
    results.smartMoneyTracker = { success: false, error: err.message };
    markFailed(step, err);
  }
}

async function runPatternMinerRun(step, results) {
  try {
    markRunning(step);
    const miner = tryRequire('./agents/patternMiner');
    if (!miner) { markSkipped(step, 'Pattern Miner unavailable'); return; }
    // Pattern Miner picks the most recent closed trade without a lesson each
    // run. We call it once — the method picks the trade internally.
    const TradeSetup = tryRequire('../models/TradeSetup');
    const closedCount = TradeSetup ? await TradeSetup.countDocuments({ status: { $in: ['TARGET_HIT', 'SL_HIT', 'EXPIRED'] } }).catch(() => 0) : 0;
    if (closedCount === 0) {
      markSkipped(step, 'No closed trades to analyze');
      results.patternMiner = { success: true, skipped: 'no closed trades' };
      return;
    }
    const r = await miner.run({});
    results.patternMiner = r;
    if (r.success) {
      markDone(step, 'lesson extracted from last closed trade', r.costUSD || 0);
    } else {
      markFailed(step, new Error(r.error || 'Pattern Miner failed'));
    }
  } catch (err) {
    results.patternMiner = { success: false, error: err.message };
    markFailed(step, err);
  }
}

async function runChiefAnalyst(step, results) {
  try {
    markRunning(step);
    const chief = tryRequire('./agents/chiefAnalyst');
    if (!chief) { markSkipped(step, 'Chief Analyst unavailable'); return; }
    const r = await chief.run({ mode: 'briefing' });
    results.chiefAnalyst = r;
    if (r.success) {
      markDone(step, 'chief analyst briefing written', r.costUSD || 0);
    } else {
      markFailed(step, new Error(r.error || 'Chief Analyst failed'));
    }
  } catch (err) {
    results.chiefAnalyst = { success: false, error: err.message };
    markFailed(step, err);
  }
}

async function runMetaCritic(step, results) {
  try {
    markRunning(step);
    if (!isWeeklyWindow()) {
      markSkipped(step, 'Weekly window only (Sunday/Friday)');
      results.metaCritic = { success: false, skipped: 'not weekly window' };
      return;
    }
    const mc = tryRequire('./agents/metaCritic');
    if (!mc) { markSkipped(step, 'Meta-Critic unavailable'); return; }
    const r = await mc.run({ windowDays: 30 });
    results.metaCritic = r;
    if (r.success) {
      markDone(step, 'weekly agent audit complete', r.costUSD || 0);
    } else {
      markFailed(step, new Error(r.error || 'Meta-Critic failed'));
    }
  } catch (err) {
    results.metaCritic = { success: false, error: err.message };
    markFailed(step, err);
  }
}

// ─── Step catalog per mode ──────────────────────────────────────────────────

function buildSteps(mode) {
  const quick = [
    makeStep('upstox',           'Refresh Upstox LTP cache'),
    makeStep('fiiDii',            'Refresh FII/DII institutional flow'),
    makeStep('regime',            'Classify market regime'),
    makeStep('sectorRotation',   'Scan sector rotation'),
    makeStep('participantOI',     'Refresh participant OI (EOD)'),
    makeStep('corporateEvents',  'Update corporate events calendar'),
    makeStep('largeDeals',       'Pull bulk/block/short deals'),
    makeStep('sentinel',          'Run Sentinel self-awareness cycle'),
    makeStep('learning',         'Run Learning Engine (quick)'),
    makeStep('bots',             'Trigger enabled bot runs'),
  ];
  if (mode === 'quick') return quick;

  // Full mode appends AI agents.
  return [
    ...quick,
    makeStep('marketScout',      'Market Scout — pre-market briefing (Sonnet)'),
    makeStep('smartMoneyTracker','Smart Money Tracker (weekly window)'),
    makeStep('patternMiner',     'Pattern Miner — analyze recent closed trade'),
    makeStep('chiefAnalyst',     'Chief Analyst — briefing (Sonnet)'),
    makeStep('metaCritic',       'Meta-Critic — weekly audit (weekly window)'),
  ];
}

// ─── Consolidated summary + ActionItem writer ───────────────────────────────

function summarize(steps, results, mode, durationMs, costUSD) {
  const done = steps.filter(s => s.status === 'done').length;
  const failed = steps.filter(s => s.status === 'failed').length;
  const skipped = steps.filter(s => s.status === 'skipped').length;
  const parts = [];
  parts.push(`${mode.toUpperCase()} refresh: ${done} done, ${failed} failed, ${skipped} skipped in ${(durationMs / 1000).toFixed(1)}s`);
  if (results.regime?.regime) parts.push(`Regime: ${results.regime.regime}`);
  if (results.fiiDii?.ok && results.fiiDii.fii !== undefined) parts.push(`FII net ₹${results.fiiDii.fii}cr`);
  if (results.sectorRotation?.leaders?.length) parts.push(`Leaders: ${results.sectorRotation.leaders.slice(0, 2).join(', ')}`);
  if (results.bots?.triggered) parts.push(`${results.bots.succeeded || 0}/${results.bots.triggered} bots ran`);
  if (costUSD > 0) parts.push(`~$${costUSD.toFixed(3)} AI cost`);
  return parts.join(' · ');
}

async function writeConsolidatedActionItem(run) {
  try {
    const changes = [];
    const r = run.results || {};
    if (r.fiiDii?.ok && !r.fiiDii.fresh) changes.push(`New FII/DII data (${r.fiiDii.source})`);
    if (r.regime?.ok) changes.push(`Regime: ${r.regime.regime}`);
    if (r.sectorRotation?.ok && r.sectorRotation.leaders?.length) {
      changes.push(`Sector leaders: ${r.sectorRotation.leaders.slice(0, 2).join(', ')}`);
    }
    if (r.bots?.triggered) changes.push(`${r.bots.succeeded || 0}/${r.bots.triggered} bot run(s) completed`);
    if (r.marketScout?.success) changes.push('Market Scout briefing ready');
    if (r.chiefAnalyst?.success) changes.push('Chief Analyst briefing ready');
    if (r.learning?.ok && r.learning.flagged) changes.push(`${r.learning.flagged} bot(s) flagged for review`);

    const failed = (run.steps || []).filter(s => s.status === 'failed');
    const title = failed.length
      ? `Master Refresh complete — ${changes.length} updates, ${failed.length} issue(s)`
      : `Master Refresh complete — ${changes.length} updates available`;

    const description = [
      changes.length ? changes.map(c => `• ${c}`).join('\n') : '(no material changes this run)',
      failed.length ? `\nFailed steps: ${failed.map(f => f.label).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    await ActionItem.findOneAndUpdate(
      { dedupKey: `master-refresh:${new Date().toISOString().slice(0, 10)}`, status: { $in: ['new', 'acknowledged'] } },
      {
        title,
        description,
        impact: 'Summary of everything that refreshed — view Today tab for detail.',
        action: 'Open Today tab or review the Dashboard.',
        priority: 'MEDIUM',
        source: 'sentinel',
        dedupKey: `master-refresh:${new Date().toISOString().slice(0, 10)}`,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    console.warn('[master-refresh] writeConsolidatedActionItem failed:', err.message);
  }
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

/**
 * Run a Master Refresh.
 *
 * @param {Object} opts
 * @param {'quick'|'full'} [opts.mode='quick']
 * @param {Function} [opts.onProgress]   — (step) => void; called after each step state change
 * @param {'manual'|'keyboard'|'cron'|'api'} [opts.trigger='manual']
 * @param {boolean} [opts.allowExpensive=false] — override cost cap guard
 * @returns {Promise<Object>} run summary (same shape as MasterRefreshRun doc)
 */
async function runMasterRefresh({ mode = 'quick', onProgress, trigger = 'manual', allowExpensive = false } = {}) {
  if (mode !== 'quick' && mode !== 'full') throw new Error(`Invalid mode: ${mode}`);

  // Cooldown guard (skip for cron runs — they're trusted)
  if (trigger !== 'cron') {
    const remaining = getCooldownRemainingMs();
    if (remaining > 0) {
      const err = new Error(`Master refresh on cooldown — ${Math.ceil(remaining / 1000)}s remaining`);
      err.code = 'COOLDOWN';
      err.remainingMs = remaining;
      throw err;
    }
  }

  // Cost cap guard (full mode only)
  if (mode === 'full' && !allowExpensive) {
    // Rough upper bound estimate: 5 agents × $0.25 = $1.25 USD
    const estimatedUSD = 1.25;
    if (estimatedUSD > COST_CAP_USD) {
      const err = new Error(`Estimated cost $${estimatedUSD.toFixed(2)} exceeds cap $${COST_CAP_USD.toFixed(2)} — pass allowExpensive=true to override.`);
      err.code = 'COST_CAP';
      err.estimatedUSD = estimatedUSD;
      err.capUSD = COST_CAP_USD;
      throw err;
    }
  }

  const jobId = crypto.randomBytes(8).toString('hex');
  const startedAt = new Date();
  lastRunStartedAt = startedAt.getTime();

  const steps = buildSteps(mode);
  const results = {};
  const errors = [];

  // Persist the run document early so UI can fetch it mid-flight.
  const runDoc = await MasterRefreshRun.create({
    jobId,
    mode,
    trigger,
    startedAt,
    status: 'running',
    steps,
    results: {},
  });

  // In-memory snapshot for status polling — updated after each step.
  const liveSnapshot = {
    jobId,
    mode,
    trigger,
    startedAt,
    status: 'running',
    steps,
    results,
  };
  runningJobs.set(jobId, liveSnapshot);

  const dispatchProgress = async () => {
    try { if (typeof onProgress === 'function') await onProgress(liveSnapshot); } catch (_) {}
    // Persist step array (cheap — small object) so the status endpoint works
    // even after a server restart.
    try {
      await MasterRefreshRun.updateOne(
        { jobId },
        { $set: { steps, results } },
      );
    } catch (_) {}
  };

  const runStep = async (stepKey, fn) => {
    const step = steps.find(s => s.key === stepKey);
    if (!step) return;
    await dispatchProgress();
    try {
      await fn(step, results);
    } catch (err) {
      // Belt-and-suspenders — each fn also has its own try/catch.
      markFailed(step, err);
      errors.push({ step: stepKey, error: err.message });
    }
    if (step.status === 'failed' && step.error) {
      errors.push({ step: stepKey, error: step.error });
    }
    await dispatchProgress();
  };

  // ── Quick-mode steps (data refresh) ───────────────────────────────────────
  await runStep('upstox',          runUpstoxRefresh);
  await runStep('fiiDii',          runFiiDiiRefresh);
  await runStep('regime',          runRegimeRefresh);
  await runStep('sectorRotation', runSectorRotationRefresh);
  await runStep('participantOI',   runParticipantOI);
  await runStep('corporateEvents', runCorporateEvents);
  await runStep('largeDeals',     runLargeDeals);
  await runStep('sentinel',       runSentinelCycle);
  await runStep('learning',       runLearningCycle);
  await runStep('bots',           (s, r) => runBotTriggers(s, r, { trigger }));

  // ── Full-mode steps (AI agents) ───────────────────────────────────────────
  if (mode === 'full') {
    await runStep('marketScout',      runMarketScout);
    await runStep('smartMoneyTracker', runSmartMoneyTracker);
    await runStep('patternMiner',      runPatternMinerRun);
    await runStep('chiefAnalyst',      runChiefAnalyst);
    await runStep('metaCritic',        runMetaCritic);
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();
  const costUSD = steps.reduce((sum, s) => sum + (s.costUSD || 0), 0);

  const failedCount = steps.filter(s => s.status === 'failed').length;
  const doneCount = steps.filter(s => s.status === 'done').length;
  const status = failedCount === 0 ? 'success' : (doneCount > 0 ? 'partial' : 'failure');
  const summary = summarize(steps, results, mode, durationMs, costUSD);

  const finalDoc = await MasterRefreshRun.findOneAndUpdate(
    { jobId },
    {
      $set: {
        completedAt,
        durationMs,
        status,
        steps,
        results,
        errors,
        summary,
        costUSD: +costUSD.toFixed(6),
      },
    },
    { new: true },
  );

  // Update in-memory snapshot one last time, then evict after a minute.
  liveSnapshot.completedAt = completedAt;
  liveSnapshot.durationMs = durationMs;
  liveSnapshot.status = status;
  liveSnapshot.summary = summary;
  liveSnapshot.costUSD = costUSD;
  setTimeout(() => { runningJobs.delete(jobId); }, 60 * 1000);

  // Write consolidated ActionItem
  await writeConsolidatedActionItem(finalDoc || liveSnapshot).catch(() => {});

  return {
    jobId,
    mode,
    startedAt,
    completedAt,
    durationMs,
    status,
    results,
    errors,
    summary,
    costUSD: +costUSD.toFixed(6),
    steps,
  };
}

async function getLatestRun() {
  return MasterRefreshRun.findOne({ status: { $ne: 'running' } })
    .sort({ startedAt: -1 })
    .lean();
}

async function getRunHistory({ limit = 10 } = {}) {
  return MasterRefreshRun.find({})
    .sort({ startedAt: -1 })
    .limit(Math.min(Math.max(1, Number(limit) || 10), 100))
    .lean();
}

async function getRunById(jobId) {
  return MasterRefreshRun.findOne({ jobId }).lean();
}

module.exports = {
  runMasterRefresh,
  getLatestRun,
  getRunHistory,
  getRunById,
  getCurrentJob,
  getLatestRunningJob,
  getCooldownRemainingMs,
  COOLDOWN_MS,
  COST_CAP_USD,
};
