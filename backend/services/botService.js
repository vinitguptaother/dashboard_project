/**
 * Bot Service — unified driver for the 4 paper bots.
 *
 * BOT_BLUEPRINT items #1-#4 (Swing / Long-term / Options Sell / Options Buy).
 *
 * Each bot is a thin scheduled wrapper:
 *   1) Check kill switches (global + per-bot)
 *   2) Check if market is open (skip otherwise, unless bot runs pre-market)
 *   3) Read BotConfig (screenId, topN, liquidityBand, risk overrides)
 *   4) Call Scanner.scanScreen() with persistAccepted=true
 *   5) Record BotRun audit row + update BotConfig.lastRunAt
 *
 * The bot's "strategy" is encoded in its screen choice + its mechanical
 * risk overrides (SL%, R:R). Deeper strategy logic can be added by swapping
 * scanner rule-based levels for AI levels in a future version.
 *
 * Public surface:
 *   seedBotConfigs()          — idempotent on-boot default configs
 *   listBotConfigs()
 *   updateBotConfig(botId, patch)
 *   runBot(botId, { trigger='manual' })  — executes one run, returns BotRun
 *   getRecentRuns({ botId?, limit })
 *   getBotStats({ botId? })   — acceptance rate + recent run success
 */

const BotConfig = require('../models/BotConfig');
const BotRun = require('../models/BotRun');
const Screen = require('../models/Screen');
const scannerService = require('./scannerService');
const killSwitchService = require('./killSwitchService');
const holidayService = require('./holidayService');
const { isMarketOpen } = require('../utils/marketHours');
const compliance = require('./complianceService');

// ─── Default bot configs ────────────────────────────────────────────────────

const DEFAULTS = [
  {
    botId: 'swing',
    algoId: 'SWING-V1',
    displayName: 'Swing Bot',
    enabled: false,                              // default OFF
    topN: 5,
    liquidityBand: 'MID',
    cronSchedule: '0 9 * * 2-5',                 // Tue-Fri 9 AM IST (before market)
    cronDescription: 'Tue-Fri 09:00 IST — pre-market scan',
    risk: { slPct: 5, rr: 2 },
    strategyNotes: 'Swing: picks top 5 by score from selected screen. 5% SL, 1:2 R:R. 2-4 week holding.',
  },
  {
    botId: 'longterm',
    algoId: 'LONGTERM-V1',
    displayName: 'Long-term Bot',
    enabled: false,
    topN: 3,
    liquidityBand: 'LARGE',
    cronSchedule: '0 9 * * 1',                   // Mondays 9 AM IST (weekly)
    cronDescription: 'Monday 09:00 IST — weekly scan',
    risk: { slPct: 12, rr: 3 },
    strategyNotes: 'Long-term: picks top 3 quality names. 12% SL, 1:3 R:R. 3-6 month holding.',
  },
  {
    botId: 'options-sell',
    algoId: 'OPTSELL-V1',
    displayName: 'Options Sell Bot',
    enabled: false,
    topN: 3,
    liquidityBand: 'OPTIONS',
    cronSchedule: '30 11 * * 1-4',               // Mon-Thu 11:30 IST (after open stabilization)
    cronDescription: 'Mon-Thu 11:30 IST — IV-rank-driven premium selling',
    risk: { slPct: 50, rr: 0.5 },
    strategyNotes: 'Sells option premium when IV Rank > 60 and regime is choppy/bull. 50% SL on premium, 0.5 R:R (win small/often).',
  },
  {
    botId: 'options-buy',
    algoId: 'OPTBUY-V1',
    displayName: 'Options Buy Bot',
    enabled: false,
    topN: 3,
    liquidityBand: 'OPTIONS',
    cronSchedule: '0 10 * * 1-4',                // Mon-Thu 10:00 IST
    cronDescription: 'Mon-Thu 10:00 IST — directional premium buying',
    risk: { slPct: 30, rr: 2 },
    strategyNotes: 'Buys directional premium when regime is breakout + IV Rank < 30. 30% SL, 1:2 R:R.',
  },
];

async function seedBotConfigs() {
  for (const d of DEFAULTS) {
    await BotConfig.findOneAndUpdate(
      { botId: d.botId },
      { $setOnInsert: d },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  return DEFAULTS.length;
}

async function listBotConfigs() {
  // Populate screen name for the UI
  const rows = await BotConfig.find({}).populate('screenId', 'name status performanceScore avgHitRate').lean();
  return rows.sort((a, b) => {
    const order = { swing: 0, longterm: 1, 'options-sell': 2, 'options-buy': 3 };
    return (order[a.botId] ?? 99) - (order[b.botId] ?? 99);
  });
}

async function updateBotConfig(botId, patch = {}) {
  const allowed = ['enabled', 'screenId', 'topN', 'liquidityBand', 'cronSchedule', 'cronDescription', 'persistAccepted', 'risk', 'strategyNotes'];
  const $set = {};
  for (const k of allowed) if (patch[k] !== undefined) $set[k] = patch[k];
  if (Object.keys($set).length === 0) return BotConfig.findOne({ botId }).populate('screenId', 'name').lean();
  const doc = await BotConfig.findOneAndUpdate({ botId }, { $set }, { new: true }).populate('screenId', 'name').lean();
  return doc;
}

// ─── runBot — the unified execution path ────────────────────────────────────

async function runBot(botId, { trigger = 'manual' } = {}) {
  const config = await BotConfig.findOne({ botId }).lean();
  if (!config) throw new Error(`No BotConfig for ${botId}`);

  // Open BotRun record immediately so we can track "running" state
  const run = await BotRun.create({
    botId, trigger, status: 'running',
  });

  const finalize = async (patch) => {
    run.finishedAt = new Date();
    Object.assign(run, patch);
    await run.save();
    // Update BotConfig.lastRunAt
    await BotConfig.findOneAndUpdate(
      { botId },
      { $set: { lastRunAt: run.finishedAt, lastRunStatus: patch.status, lastRunSummary: patch.summary || '' } },
    );
    return run.toObject();
  };

  try {
    // Gate 1: bot disabled?
    if (!config.enabled && trigger === 'auto') {
      return finalize({ status: 'skipped', skipReason: 'Bot disabled (auto-run guarded)', summary: 'disabled' });
    }

    // Gate 2: per-bot kill switch (manual runs also respect this)
    const killed = await killSwitchService.isBotKilled(botId);
    if (killed) {
      return finalize({ status: 'skipped', skipReason: 'Per-bot kill switch active', summary: 'killed' });
    }

    // Gate 3: screen selected?
    if (!config.screenId) {
      return finalize({ status: 'skipped', skipReason: 'No screenId configured', summary: 'no-screen' });
    }

    // Gate 4: market-hours (skip on non-market days for auto runs; manual allowed)
    if (trigger === 'auto') {
      try {
        const { holidays } = holidayService.getHolidays();
        const now = new Date();
        // Pre-market runs are OK if the CURRENT DAY is a market day.
        const noon = new Date(new Date().setHours(12, 0, 0, 0));
        if (!isMarketOpen(noon, holidays)) {
          return finalize({ status: 'skipped', skipReason: 'Non-market day', summary: 'holiday' });
        }
      } catch (_) { /* best-effort */ }
    }

    // Compliance 'generated' roll-up: recorded by scannerService per-candidate
    const result = await scannerService.scanScreen({
      screenId: config.screenId,
      botId,
      topN: config.topN,
      persistAccepted: config.persistAccepted,
      liquidityBand: config.liquidityBand,
      risk: config.risk || {},
    });

    const acceptedSetupIds = (result.candidates || [])
      .filter(cr => cr.result.accepted && cr.result.setupId)
      .map(cr => cr.result.setupId);

    const summary = `scan: ${result.summary.scanned} → ${result.summary.accepted} accepted, ${result.summary.rejected} rejected${result.summary.topReason ? ' · top: ' + result.summary.topReason.slice(0, 60) : ''}`;

    return finalize({
      status: 'success',
      screenId: config.screenId,
      screenName: result.screen?.name || '',
      batchId: result.batch?.id || null,
      scanned: result.summary.scanned,
      accepted: result.summary.accepted,
      rejected: result.summary.rejected,
      acceptedSetupIds,
      topRejection: result.summary.topReason || '',
      rejectionCounts: result.summary.reasons || null,
      summary,
    });
  } catch (err) {
    return finalize({ status: 'failure', error: err.message, summary: `error: ${err.message.slice(0, 80)}` });
  }
}

// ─── Recent runs + stats ────────────────────────────────────────────────────

async function getRecentRuns({ botId, limit = 20 } = {}) {
  const q = {};
  if (botId) q.botId = botId;
  return BotRun.find(q).sort({ startedAt: -1 }).limit(Math.min(limit, 100)).lean();
}

async function getBotStats({ botId, days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const q = { startedAt: { $gte: since } };
  if (botId) q.botId = botId;
  const runs = await BotRun.find(q).lean();
  const stats = { runs: runs.length, success: 0, failure: 0, skipped: 0, totalScanned: 0, totalAccepted: 0, totalRejected: 0 };
  for (const r of runs) {
    if (r.status === 'success') stats.success++;
    else if (r.status === 'failure') stats.failure++;
    else if (r.status === 'skipped') stats.skipped++;
    stats.totalScanned  += r.scanned || 0;
    stats.totalAccepted += r.accepted || 0;
    stats.totalRejected += r.rejected || 0;
  }
  stats.acceptanceRate = stats.totalScanned > 0
    ? parseFloat(((stats.totalAccepted / stats.totalScanned) * 100).toFixed(2))
    : null;
  return stats;
}

module.exports = {
  seedBotConfigs, listBotConfigs, updateBotConfig,
  runBot, getRecentRuns, getBotStats,
  DEFAULTS,
};
