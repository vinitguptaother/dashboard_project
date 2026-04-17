/**
 * Compliance Service — SEBI-grade audit trail of every algo decision.
 *
 * BOT_BLUEPRINT item #46.
 *
 * Public surface:
 *   seedAlgoRegistry()               — idempotent boot-time seed of 5 default algos
 *   registerAlgo({...})              — add a new algo
 *   getAlgoRegistry()                — list all declared algos
 *   recordEvent({...})               — append a compliance event
 *   getEvents({ filters, limit, skip }) — paginated query
 *   getStats({ days })               — decision counts + bot breakdown
 *   exportCsv({ from, to })          — returns CSV string for SEBI submission
 *
 * Write paths (where events get recorded):
 *   • trade-setup paper POST          → decision='accepted' (or 'rejected' if evaluate gates block)
 *   • risk-engine evaluate            → caller decides whether to persist
 *   • paper-trade-monitor cron        → decision='target_hit' / 'sl_hit'
 *   • kill-switch service events      → mirrored here with decision='canceled' per-bot
 *   • scanner (Sprint 4+)             → decision='generated'
 *   • bot validator (Sprint 4+)       → decision='evaluated'
 */

const ComplianceEvent = require('../models/ComplianceEvent');
const AlgoRegistry = require('../models/AlgoRegistry');

// ─── Seed: default algo registry (idempotent) ───────────────────────────────

const DEFAULT_ALGOS = [
  {
    algoId: 'MANUAL-V1',
    botId: 'manual',
    strategy: 'Human discretionary trades',
    description: 'Trades placed manually via dashboard UI (no bot). Tracked for completeness.',
    version: 'v1',
  },
  {
    algoId: 'SWING-V1',
    botId: 'swing',
    strategy: 'Swing Bot v1 — Screener-ranked, AI-graded, Validator-gated',
    description: 'Pulls from weekly screener CSVs, AI scores top candidates, Validator enforces regime + risk. Holding 2-4 weeks.',
    version: 'v1',
  },
  {
    algoId: 'LONGTERM-V1',
    botId: 'longterm',
    strategy: 'Long-term Bot v1 — Quality+Value composite',
    description: 'Fundamental-first selection, monthly rebalance, 3-6 month holding.',
    version: 'v1',
  },
  {
    algoId: 'OPTSELL-V1',
    botId: 'options-sell',
    strategy: 'Options Sell Bot v1 — IV rank-based premium selling',
    description: 'Short strangles / iron condors when IV Rank > 60, regime=choppy/trending-bull.',
    version: 'v1',
  },
  {
    algoId: 'OPTBUY-V1',
    botId: 'options-buy',
    strategy: 'Options Buy Bot v1 — Directional premium buying',
    description: 'Long calls/puts when regime=breakout, IV Rank < 30, with defined-risk entries.',
    version: 'v1',
  },
];

async function seedAlgoRegistry() {
  for (const a of DEFAULT_ALGOS) {
    await AlgoRegistry.findOneAndUpdate(
      { algoId: a.algoId },
      { $set: a, $setOnInsert: { approvedAt: new Date(), active: true } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  return DEFAULT_ALGOS.length;
}

async function registerAlgo(doc) {
  return AlgoRegistry.findOneAndUpdate(
    { algoId: doc.algoId },
    { $set: doc },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function getAlgoRegistry() {
  return AlgoRegistry.find({}).sort({ botId: 1, algoId: 1 }).lean();
}

// ─── Map botId → default algoId ─────────────────────────────────────────────

const BOT_TO_ALGO = {
  'manual': 'MANUAL-V1',
  'swing': 'SWING-V1',
  'longterm': 'LONGTERM-V1',
  'options-sell': 'OPTSELL-V1',
  'options-buy': 'OPTBUY-V1',
};

function algoIdForBot(botId) { return BOT_TO_ALGO[botId] || 'MANUAL-V1'; }

// ─── Record event ───────────────────────────────────────────────────────────

async function recordEvent(input) {
  try {
    const algoId = input.algoId || algoIdForBot(input.botId || 'manual');
    const doc = {
      algoId,
      botId: input.botId || 'manual',
      tradeSetupId: input.tradeSetupId || null,
      decision: input.decision,
      symbol: (input.symbol || '').toUpperCase(),
      action: input.action || '',
      quantity: input.quantity || 0,
      entryPrice: input.entryPrice || 0,
      stopLoss: input.stopLoss || 0,
      target: input.target || 0,
      price: input.price || 0,
      reasoning: input.reasoning || '',
      reasons: Array.isArray(input.reasons) ? input.reasons : [],
      checks: input.checks || null,
      clientIp: input.clientIp || '',
      staticIp: input.staticIp || '',
      latencyMs: input.latencyMs || 0,
      orderRef: input.orderRef || '',
      at: input.at || new Date(),
    };
    return await ComplianceEvent.create(doc);
  } catch (err) {
    console.warn('[compliance] recordEvent failed:', err.message);
    return null;
  }
}

// ─── Query ──────────────────────────────────────────────────────────────────

function buildFilter({ algoId, botId, decision, symbol, from, to } = {}) {
  const q = {};
  if (algoId) q.algoId = algoId.toUpperCase();
  if (botId) q.botId = botId;
  if (decision) q.decision = decision;
  if (symbol) q.symbol = symbol.toUpperCase();
  if (from || to) {
    q.at = {};
    if (from) q.at.$gte = new Date(from);
    if (to) q.at.$lte = new Date(to);
  }
  return q;
}

async function getEvents({ limit = 50, skip = 0, ...filters } = {}) {
  const q = buildFilter(filters);
  const rows = await ComplianceEvent.find(q)
    .sort({ at: -1 })
    .skip(Math.max(0, skip))
    .limit(Math.min(limit, 500))
    .lean();
  const total = await ComplianceEvent.countDocuments(q);
  return { rows, total };
}

async function getStats({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const agg = await ComplianceEvent.aggregate([
    { $match: { at: { $gte: since } } },
    { $group: { _id: { decision: '$decision', botId: '$botId' }, count: { $sum: 1 } } },
  ]);
  const byDecision = {};
  const byBot = {};
  let total = 0;
  for (const row of agg) {
    total += row.count;
    byDecision[row._id.decision] = (byDecision[row._id.decision] || 0) + row.count;
    byBot[row._id.botId] = (byBot[row._id.botId] || 0) + row.count;
  }
  return { days, total, byDecision, byBot };
}

// ─── CSV export ─────────────────────────────────────────────────────────────

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function exportCsv({ from, to, algoId, botId, decision } = {}) {
  const q = buildFilter({ from, to, algoId, botId, decision });
  const rows = await ComplianceEvent.find(q).sort({ at: 1 }).lean();
  const headers = [
    'at', 'algoId', 'botId', 'decision', 'symbol', 'action', 'quantity',
    'entryPrice', 'stopLoss', 'target', 'price',
    'reasoning', 'reasons', 'clientIp', 'staticIp', 'latencyMs', 'orderRef', 'tradeSetupId',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      new Date(r.at).toISOString(),
      r.algoId, r.botId, r.decision, r.symbol, r.action, r.quantity,
      r.entryPrice, r.stopLoss, r.target, r.price,
      r.reasoning, (r.reasons || []).join(' | '),
      r.clientIp, r.staticIp, r.latencyMs, r.orderRef,
      r.tradeSetupId ? r.tradeSetupId.toString() : '',
    ].map(csvEscape).join(','));
  }
  return { csv: lines.join('\n'), rowCount: rows.length };
}

module.exports = {
  seedAlgoRegistry,
  registerAlgo,
  getAlgoRegistry,
  algoIdForBot,
  recordEvent,
  getEvents,
  getStats,
  exportCsv,
};
