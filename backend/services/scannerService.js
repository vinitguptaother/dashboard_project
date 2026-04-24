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
const patternService = require('./patternService');
const regimeService = require('./regimeService');
const strategies = require('./strategies');
const Screen = require('../models/Screen');
const ScreenBatch = require('../models/ScreenBatch');
const Strategy = require('../models/Strategy');
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

/**
 * Pattern-aware candidate: uses real S/R + ATR levels when available,
 * falls back to the mechanical builder on any failure.
 */
async function buildCandidateWithLevels({
  symbol, lastPrice, botId = 'swing', sector = 'Unclassified',
  liquidityBand = 'MID', risk = {},
}) {
  const base = buildMechanicalCandidate({ symbol, lastPrice, botId, sector, liquidityBand, risk });
  if (!base) return null;

  try {
    const levels = await patternService.getLevelsForSymbol(symbol, lastPrice);
    if (!levels || !levels.suggestedStopLoss || !levels.suggestedTarget) return base;

    const entry = base.entryPrice;
    const stopLoss = levels.suggestedStopLoss;
    const target = levels.suggestedTarget;

    // Sanity: SL must be below entry, target above entry. Otherwise fall back.
    if (!(stopLoss < entry && target > entry)) return base;

    const slMove = entry - stopLoss;
    const rewardMove = target - entry;
    const rr = slMove > 0 ? parseFloat((rewardMove / slMove).toFixed(2)) : 0;

    // Re-size qty to 2% capital risk given the (usually tighter) S/R-based stop.
    const defaultCapital = 500000;
    const defaultRiskPct = 2;
    const riskRupees = (defaultCapital * defaultRiskPct) / 100;
    const qty = Math.max(1, Math.floor(riskRupees / Math.max(slMove, 0.01)));

    // Band the pattern-derived liquidity assessment into the candidate
    // (options segment keeps caller-provided band).
    const finalLiquidityBand = base.segment === 'options' ? base.liquidityBand : levels.liquidityBand;

    const supportTxt = levels.nearestSupport != null ? `support ₹${levels.nearestSupport}` : 'ATR floor';
    const resistanceTxt = levels.nearestResistance != null ? `resistance ₹${levels.nearestResistance}` : 'ATR ceiling';

    return {
      ...base,
      qty,
      stopLoss,
      target,
      liquidityBand: finalLiquidityBand,
      confidence: 65, // real levels → bump confidence one notch
      reasoning: `S/R-based levels · Scanner pick. SL at ${supportTxt}, target at ${resistanceTxt}. ATR ${levels.atr} (${levels.atrPct}%), R:R 1:${rr}.`,
      riskFactors: [
        `Pivot-derived levels from last 120d candles`,
        `ATR ${levels.atrPct}% → ${levels.liquidityBand}`,
        'Verify current S/R on your chart before entry',
      ],
      patternLevels: {
        atr: levels.atr,
        atrPct: levels.atrPct,
        nearestSupport: levels.nearestSupport,
        nearestResistance: levels.nearestResistance,
      },
    };
  } catch (err) {
    // Pattern failure (insufficient history, Upstox hiccup) → mechanical fallback.
    return base;
  }
}

// ─── Strategy-driven candidate builder ──────────────────────────────────────

/**
 * Try every compatible strategy in priority order. Returns the first strategy
 * that fires a non-null candidate; falls back to the pattern-aware mechanical
 * builder if none fire. Also updates Strategy metadata counters.
 *
 * botId / regime / sector / liquidityBand are forwarded to the strategy
 * via `evaluate({ ... })`.
 */
async function buildCandidateWithStrategies({
  symbol, lastPrice, botId = 'swing', sector = 'Unclassified',
  liquidityBand = 'MID', risk = {}, regime, context = {},
}) {
  if (!symbol || !lastPrice || lastPrice <= 0) return null;

  // Pattern levels (S/R + ATR + candles) — re-used for strategy evaluate()
  let patternLevels = null;
  let candles = [];
  try {
    patternLevels = await patternService.getLevelsForSymbol(symbol, lastPrice);
    // Pattern service has the candles internally; re-fetch for strategies.
    candles = await patternService.getDailyCloses(symbol, 220); // enough for 200 DMA
  } catch (_) {
    // Insufficient history / Upstox hiccup: strategies still run with empty
    // candles (they guard on length internally and return null).
  }

  const regimeTag = regime?.regime || regime || 'unknown';
  const compatible = strategies.getCompatibleStrategies(botId, regimeTag)
    .filter(s => s.enabled !== false);

  const strategyContext = {
    symbol,
    candles,
    lastPrice,
    atr: patternLevels?.atr,
    supports: patternLevels?.allSupports || [],
    resistances: patternLevels?.allResistances || [],
    regime: regime || { regime: regimeTag },
    sector,
    context,
  };

  let firedStrategy = null;
  let firedCandidate = null;
  for (const strat of compatible) {
    try {
      const out = await strat.evaluate(strategyContext);
      // Light stat bump — metadata-only, no trade side-effects.
      await Strategy.updateOne(
        { key: strat.key },
        {
          $set: { lastRunAt: new Date() },
          $inc: { runCount: 1, ...(out ? { acceptedCount: 1 } : { rejectedCount: 1 }) },
        },
      ).catch(() => {});
      if (out) {
        firedStrategy = strat;
        firedCandidate = out;
        break;
      }
    } catch (err) {
      console.warn(`[scanner] strategy ${strat.key} evaluate() failed on ${symbol}:`, err.message);
    }
  }

  if (firedCandidate && firedStrategy) {
    const entry = firedCandidate.entryPrice;
    const slMove = Math.max(entry - firedCandidate.stopLoss, 0.01);
    const rewardMove = Math.max(firedCandidate.target - entry, 0.01);
    const rr = parseFloat((rewardMove / slMove).toFixed(2));

    // Sizing: 2% of default capital risk
    const defaultCapital = 500000;
    const defaultRiskPct = 2;
    const riskRupees = (defaultCapital * defaultRiskPct) / 100;
    const qty = Math.max(1, Math.floor(riskRupees / slMove));

    return {
      botId,
      symbol: symbol.toUpperCase(),
      action: firedCandidate.action || 'BUY',
      qty,
      entryPrice: entry,
      stopLoss: firedCandidate.stopLoss,
      target: firedCandidate.target,
      sector,
      segment: firedStrategy.segment,
      liquidityBand: patternLevels?.liquidityBand || liquidityBand,
      tradeType: botId === 'longterm' ? 'INVESTMENT' : 'SWING',
      holdingDuration: botId === 'longterm' ? '3-6 months' : '2-4 weeks',
      confidence: firedCandidate.confidence ?? 60,
      reasoning: `[${firedStrategy.name}] ${firedCandidate.reasoning}`,
      strategyKey: firedStrategy.key,
      strategyName: firedStrategy.name,
      riskFactors: [
        `Strategy: ${firedStrategy.name}`,
        `Regime: ${regimeTag}`,
        `R:R 1:${rr}`,
      ],
      allowOffHours: true,
      patternLevels: patternLevels ? {
        atr: patternLevels.atr,
        atrPct: patternLevels.atrPct,
        nearestSupport: patternLevels.nearestSupport,
        nearestResistance: patternLevels.nearestResistance,
      } : null,
    };
  }

  // No strategy fired — fall back to the pattern-aware mechanical builder.
  const fallback = await buildCandidateWithLevels({
    symbol, lastPrice, botId, sector, liquidityBand, risk,
  });
  if (fallback) {
    fallback.strategyKey = null;
    fallback.strategyName = null;
  }
  return fallback;
}

// ─── Sector resolution (best-effort) ────────────────────────────────────────

async function resolveSector(screenName) {
  // For MVP: use screen name as sector proxy. Sector Rotation service (#28)
  // keeps proper NSE sector data; symbol→sector map will come with Scanner v2.
  if (!screenName) return 'Unclassified';
  return screenName.replace(/\s+screen$/i, '').trim() || 'Unclassified';
}

// ─── Main scan (strategy-aware) ─────────────────────────────────────────────

/**
 * scanScreenWithStrategies — Phase 3 evolution of scanScreen.
 *
 * For each symbol in the screen's top-N:
 *   1. Fetch pattern levels (existing patternService)
 *   2. Fetch current regime (existing regimeService)
 *   3. Filter strategies: getCompatibleStrategies(botId, regime)
 *   4. For each compatible strategy, call strategy.evaluate(...)
 *   5. If any strategy fires → use its candidate, tagged with strategyKey
 *   6. Else fall back to the pattern-aware mechanical builder
 *   7. Run every candidate through the Validator unchanged
 *
 * The returned shape is identical to the old scanScreen, plus each
 * candidate carries a strategyKey / strategyName field (null on fallback).
 */
async function scanScreenWithStrategies({
  screenId,
  botId = 'swing',
  topN = 5,
  persistAccepted = false,
  liquidityBand = 'MID',
  risk = {},
  context = {},
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
  const regime = await regimeService.getCurrent().catch(() => null);

  // 3) Build candidates (strategy-first, pattern fallback) in parallel
  const candidateResults = await Promise.all(ranked.map(r => buildCandidateWithStrategies({
    symbol: r.symbol,
    lastPrice: r.lastPrice,
    botId,
    sector,
    liquidityBand,
    risk,
    regime,
    context,
  })));
  const candidates = candidateResults.filter(Boolean);

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
      reasoning: `Scanner: ${screen.name} top-${topN} pick. ${c.strategyKey ? `Strategy: ${c.strategyKey}` : 'Fallback: pattern-levels'}.`,
      reasons: [
        `screen=${screen.name}`, `screenId=${screenId}`, `topN=${topN}`, `bot=${c.botId}`,
        c.strategyKey ? `strategy=${c.strategyKey}` : 'strategy=none',
      ],
    });
  }

  // 4) Run all through Validator batch
  const batchResults = await validator.validateBatch(candidates, { persist: persistAccepted });

  // 5) Summarize
  const reasons = {};
  const strategyCounts = {};
  let accepted = 0, rejected = 0;
  for (const r of batchResults) {
    const sk = r.candidate?.strategyKey || 'fallback';
    strategyCounts[sk] = (strategyCounts[sk] || 0) + 1;
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
    summary: {
      scanned: candidates.length,
      accepted,
      rejected,
      reasons,
      strategyCounts,
      topReason: Object.keys(reasons).sort((a,b) => reasons[b]-reasons[a])[0] || null,
    },
    botId,
    regime: regime?.regime || 'unknown',
  };
}

/**
 * Backwards-compatible wrapper — preserves the old signature for existing
 * callers (botService, routes). All new code should call
 * scanScreenWithStrategies directly.
 */
async function scanScreen(opts) {
  return scanScreenWithStrategies(opts);
}

// ─── Single-symbol ad-hoc scan ──────────────────────────────────────────────

async function scanSymbol({ symbol, lastPrice, botId = 'manual', persistAccepted = false, sector = 'Unclassified', liquidityBand = 'MID', risk = {}, context = {} }) {
  if (!symbol) throw new Error('symbol required');
  if (!lastPrice) throw new Error('lastPrice required (pass from current quote)');
  const regime = await regimeService.getCurrent().catch(() => null);

  // Strategy Library is keyed off bot segments. 'manual' has no strategies
  // defined yet, so fall back to the pattern-aware mechanical builder.
  let candidate = null;
  if (botId && botId !== 'manual') {
    candidate = await buildCandidateWithStrategies({
      symbol, lastPrice, botId, sector, liquidityBand, risk, regime, context,
    });
  } else {
    candidate = await buildCandidateWithLevels({ symbol, lastPrice, botId, sector, liquidityBand, risk });
    if (candidate) {
      candidate.strategyKey = null;
      candidate.strategyName = null;
    }
  }

  if (!candidate) throw new Error('Failed to build candidate');

  await compliance.recordEvent({
    botId: candidate.botId, decision: 'generated',
    symbol: candidate.symbol, action: candidate.action, quantity: candidate.qty,
    entryPrice: candidate.entryPrice, stopLoss: candidate.stopLoss, target: candidate.target,
    reasoning: `Scanner: ad-hoc symbol scan. ${candidate.strategyKey ? `Strategy: ${candidate.strategyKey}` : 'Fallback: pattern-levels'}.`,
    reasons: [
      `adhoc=true`, `bot=${candidate.botId}`,
      candidate.strategyKey ? `strategy=${candidate.strategyKey}` : 'strategy=none',
    ],
  });
  const result = await validator.validateCandidate(candidate, { persist: persistAccepted });
  return { candidate, result, regime: regime?.regime || 'unknown' };
}

// ─── Recent scans (merged from compliance 'generated' + 'accepted'/'rejected') ─

async function getRecentScans({ limit = 20 } = {}) {
  const { rows } = await compliance.getEvents({ decision: 'generated', limit: Math.min(limit, 100) });
  return rows;
}

module.exports = {
  scanScreen,
  scanScreenWithStrategies,
  scanSymbol,
  getRecentScans,
  // Exposed for tests + future reuse
  buildCandidateWithStrategies,
  buildCandidateWithLevels,
};
