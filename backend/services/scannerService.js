/**
 * Scanner Service — pulls candidates from existing screen batches and
 * submits them through the Validator (#6).
 *
 * BOT_BLUEPRINT item #5.
 *
 * Scanner is the **bot entry-point**. It answers:
 *   "Given my latest Screener.in batches, who are today's top candidates
 *    my swing bot should consider?"
 *
 * Data source: `ScreenBatch.rankedResults` — already populated by the
 * existing /api/screens/rankBatch + /saveBatch flow. No new data ingestion.
 *
 * Candidate levels: rule-based MVP (last price ± band-width). When the
 * user wants AI-computed levels they can use the existing /api/trade-setup/
 * generate endpoint (Perplexity flow).
 *
 * Public surface:
 *   scanScreen({ screenId, botId, topN, persistAccepted, sector, liquidityBand, risk })
 *   scanSymbol({ symbol, botId, persistAccepted, ... })
 *   getRecentScans({ limit })
 */

const mongoose = require('mongoose');
const compliance = require('./complianceService');
const validator = require('./validatorService');
const Screen = require('../models/Screen');
const ScreenBatch = require('../models/ScreenBatch');
const RiskSettings = require('../models/RiskSettings');

// ─── Rule-based candidate level generation ──────────────────────────────────

/**
 * Builds a candidate trade from a ranked-screen row using mechanical rules.
 *
 * Defaults target a 1:2 R:R and a stop-loss % that reflects the bot holding
 * horizon (swing = tighter, longterm = wider).
 */
function buildMechanicalCandidate({
  symbol, lastPrice, botId = 'swing', sector = 'Unclassified',
  liquidityBand = 'MID', risk = {},
}) {
  if (!lastPrice || lastPrice <= 0) return null;
  const defaults = {
    swing:       { slPct: 5,  rr: 2 },
    longterm:    { slPct: 12, rr: 3 },
    'options-buy':  { slPct: 30, rr: 2 },
    'options-sell': { slPct: 50, rr: 0.5 },
    manual:      { slPct: 5,  rr: 2 },
  };
  const d = defaults[botId] || defaults.swing;
  const slPct = risk.slPct != null ? risk.slPct : d.slPct;
  const rr    = risk.rr    != null ? risk.rr    : d.rr;
  const entry = parseFloat(lastPrice.toFixed(2));
  const slMove = (entry * slPct) / 100;
  const stopLoss = parseFloat((entry - slMove).toFixed(2));
  const target   = parseFloat((entry + slMove * rr).toFixed(2));

  // Quantity: sized so per-trade risk ≈ 1% of capital (Sprint 1 #14 default).
  // Scanner just proposes; Validator will reject if any Risk Engine gate fails.
  let qty = 1;
  try {
    // Best-effort sync is fine here — getRecentScans can await a separate call.
    // We approximate from defaults; true sizing comes later via user settings.
    const defaultCapital = 500000;
    const defaultRiskPct = 2;
    const riskRupees = (defaultCapital * defaultRiskPct) / 100;
    qty = Math.max(1, Math.floor(riskRupees / slMove));
  } catch (_) { qty = 1; }

  return {
    botId,
    symbol: symbol.toUpperCase(),
    action: 'BUY',                     // Scanner MVP is long-only; shorts come later
    qty,
    entryPrice: entry,
    stopLoss,
    target,
    sector,
    segment: botId === 'options-buy' || botId === 'options-sell' ? 'options' : 'equity-delivery',
    liquidityBand,
    tradeType: botId === 'longterm' ? 'INVESTMENT' : 'SWING',
    holdingDuration: botId === 'longterm' ? '3-6 months' : '2-4 weeks',
    confidence: 55,                    // mechanical scan = moderate confidence
    reasoning: `Scanner pick from latest screen batch. Mechanical levels: SL ${slPct}%, R:R 1:${rr}.`,
    riskFactors: ['Rule-based levels — not AI-reasoned', 'Verify technicals before entry'],
    allowOffHours: true,
  };
}

// ─── Sector resolution (best-effort) ────────────────────────────────────────

async function resolveSector(screenName) {
  // For MVP: use screen name as sector proxy. Sector Rotation service (#28)
  // keeps proper NSE sector data; symbol→sector map will come with Scanner v2.
  if (!screenName) return 'Unclassified';
  return screenName.replace(/\s+screen$/i, '').trim() || 'Unclassified';
}

// ─── Main scan: from latest batch of a specific screen ──────────────────────

async function scanScreen({
  screenId,
  botId = 'swing',
  topN = 5,
  persistAccepted = false,
  liquidityBand = 'MID',
  risk = {},
}) {
  // 1) Resolve the screen + latest batch
  const screen = await Screen.findById(screenId).lean();
  if (!screen) throw new Error(`Screen not found: ${screenId}`);
  const latestBatch = await ScreenBatch.findOne({ screenId: new mongoose.Types.ObjectId(screenId) })
    .sort({ runDate: -1 })
    .lean();
  if (!latestBatch) {
    return {
      screen, batch: null,
      candidates: [],
      summary: { scanned: 0, accepted: 0, rejected: 0, reasons: {} },
      error: 'No batches found for this screen — upload a CSV first.',
    };
  }

  // 2) Pick top-N by score from the batch
  const ranked = (latestBatch.rankedResults || [])
    .filter(r => r && r.symbol && r.lastPrice && r.lastPrice > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, Math.min(topN, 20));
  if (ranked.length === 0) {
    return {
      screen, batch: latestBatch,
      candidates: [],
      summary: { scanned: 0, accepted: 0, rejected: 0, reasons: {} },
      error: 'Batch has no valid ranked results.',
    };
  }

  const sector = await resolveSector(screen.name);

  // 3) Build candidates + log a 'generated' compliance event for each
  const candidates = ranked.map(r => buildMechanicalCandidate({
    symbol: r.symbol,
    lastPrice: r.lastPrice,
    botId,
    sector,
    liquidityBand,
    risk,
  })).filter(Boolean);

  for (const c of candidates) {
    await compliance.recordEvent({
      botId: c.botId,
      decision: 'generated',
      symbol: c.symbol,
      action: c.action,
      quantity: c.qty,
      entryPrice: c.entryPrice,
      stopLoss: c.stopLoss,
      target: c.target,
      price: c.entryPrice,
      reasoning: `Scanner: ${screen.name} top-${topN} pick. Rank by score.`,
      reasons: [`screen=${screen.name}`, `screenId=${screenId}`, `topN=${topN}`, `bot=${c.botId}`],
    });
  }

  // 4) Run all through Validator batch
  const batchResults = await validator.validateBatch(candidates, { persist: persistAccepted });

  // 5) Summarize
  const reasons = {};
  let accepted = 0, rejected = 0;
  for (const r of batchResults) {
    if (r.result.accepted) accepted++;
    else {
      rejected++;
      for (const reason of r.result.reasons) {
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
    }
  }

  return {
    screen: { id: screen._id, name: screen.name },
    batch: { id: latestBatch._id, runDate: latestBatch.runDate, symbolCount: (latestBatch.rankedResults || []).length },
    candidates: batchResults,
    summary: { scanned: candidates.length, accepted, rejected, reasons, topReason: Object.keys(reasons).sort((a,b) => reasons[b]-reasons[a])[0] || null },
    botId,
  };
}

// ─── Single-symbol ad-hoc scan ──────────────────────────────────────────────

async function scanSymbol({ symbol, lastPrice, botId = 'manual', persistAccepted = false, sector = 'Unclassified', liquidityBand = 'MID', risk = {} }) {
  if (!symbol) throw new Error('symbol required');
  if (!lastPrice) throw new Error('lastPrice required (pass from current quote)');
  const candidate = buildMechanicalCandidate({ symbol, lastPrice, botId, sector, liquidityBand, risk });
  if (!candidate) throw new Error('Failed to build candidate');
  await compliance.recordEvent({
    botId: candidate.botId, decision: 'generated',
    symbol: candidate.symbol, action: candidate.action, quantity: candidate.qty,
    entryPrice: candidate.entryPrice, stopLoss: candidate.stopLoss, target: candidate.target,
    reasoning: `Scanner: ad-hoc symbol scan.`,
    reasons: [`adhoc=true`, `bot=${candidate.botId}`],
  });
  const result = await validator.validateCandidate(candidate, { persist: persistAccepted });
  return { candidate, result };
}

// ─── Recent scans (merged from compliance 'generated' + 'accepted'/'rejected') ─

async function getRecentScans({ limit = 20 } = {}) {
  const { rows } = await compliance.getEvents({ decision: 'generated', limit: Math.min(limit, 100) });
  return rows;
}

module.exports = { scanScreen, scanSymbol, getRecentScans };
