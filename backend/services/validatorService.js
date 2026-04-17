/**
 * Validator Service — the single gate between "bot has an idea" and
 * "trade setup gets persisted".
 *
 * BOT_BLUEPRINT item #6.
 *
 * Every bot-generated candidate AND every manual-test submission flows
 * through `validateCandidate()`. The service:
 *   1) Runs the candidate through the Risk Engine (#10) `evaluateTrade()`
 *   2) Adds 2 bot-specific gates on top:
 *        a) Duplicate-open check — don't re-enter a symbol the bot already holds
 *        b) Market-hours check — skip if closed (unless `allowOffHours`)
 *   3) Records a compliance event (`evaluated` / `accepted` / `rejected`)
 *   4) If accepted AND `persist=true`: saves a TradeSetup with full bot
 *      context + Realism Engine entry costs (#9)
 *
 * Return shape (uniform):
 *   {
 *     accepted: boolean,
 *     reasons: string[],          // empty when accepted
 *     checks: {...},              // full risk-check snapshot
 *     setupId?: ObjectId,         // present when persist=true + accepted
 *     complianceEventId?: ObjectId,
 *   }
 */

const mongoose = require('mongoose');
const riskEngine = require('./riskEngineService');
const compliance = require('./complianceService');
const paperRealism = require('./paperRealismService');
const TradeSetup = require('../models/TradeSetup');
const holidayService = require('./holidayService');
const { isMarketOpen } = require('../utils/marketHours');

// ─── Additional gates beyond evaluateTrade() ────────────────────────────────

async function checkDuplicateOpen({ botId, symbol, action }) {
  if (!symbol) return null;
  // Match the existing DB unique index `uniq_active_symbol_action_paper`:
  // (symbol, action, status=ACTIVE, isPaperTrade=true). Rejecting here prevents
  // the persist-time E11000 collision.
  const existing = await TradeSetup.findOne({
    isPaperTrade: true,
    status: 'ACTIVE',
    symbol: symbol.toUpperCase(),
    action,
  }).lean();
  if (existing) {
    const who = existing.botId && existing.botId !== 'manual' ? existing.botId : 'another workflow';
    return `${symbol.toUpperCase()} already has an active ${action} setup under ${who} (opened ${new Date(existing.createdAt).toLocaleDateString('en-IN')}).`;
  }
  return null;
}

function checkMarketOpen(allowOffHours) {
  if (allowOffHours) return null;
  try {
    const { holidays } = holidayService.getHolidays();
    if (!isMarketOpen(new Date(), holidays)) {
      return 'Market is currently closed. Pass `allowOffHours: true` to override (paper trade will use last-close price).';
    }
  } catch (_) { /* best effort only */ }
  return null;
}

// ─── Main entry-point ───────────────────────────────────────────────────────

/**
 * @param {Object} candidate
 * @param {string} candidate.botId         — 'manual' | 'swing' | 'longterm' | 'options-sell' | 'options-buy'
 * @param {string} candidate.symbol
 * @param {'BUY'|'SELL'|'ACCUMULATE'} candidate.action
 * @param {number} candidate.qty
 * @param {number} candidate.entryPrice
 * @param {number} candidate.stopLoss
 * @param {number} candidate.target
 * @param {string} [candidate.sector='Unclassified']
 * @param {string} [candidate.segment='equity-delivery']
 * @param {string} [candidate.liquidityBand='MID']
 * @param {string} [candidate.reasoning='']   — strategy's explanation
 * @param {string} [candidate.tradeType='SWING']
 * @param {string} [candidate.holdingDuration='2-4 weeks']
 * @param {number} [candidate.confidence=50]
 * @param {string[]} [candidate.riskFactors=[]]
 * @param {boolean} [candidate.allowOffHours=false]
 * @param {boolean} [persist=false]   — if true and accepted, saves as TradeSetup
 * @param {string} [candidate.clientIp='']
 *
 * @returns {{ accepted, reasons, checks, setupId?, complianceEventId? }}
 */
async function validateCandidate(candidate, { persist = false } = {}) {
  const {
    botId = 'manual',
    symbol,
    action,
    qty,
    entryPrice,
    stopLoss,
    target,
    sector = 'Unclassified',
    segment = 'equity-delivery',
    liquidityBand = 'MID',
    reasoning = '',
    tradeType = 'SWING',
    holdingDuration = '2-4 weeks',
    confidence = 50,
    riskFactors = [],
    allowOffHours = false,
    clientIp = '',
  } = candidate || {};

  const reasons = [];
  let checks = {};

  // 1) Preliminary shape checks
  if (!symbol)     reasons.push('Missing symbol.');
  if (!action)     reasons.push('Missing action.');
  if (!entryPrice) reasons.push('Missing entryPrice.');
  if (!stopLoss)   reasons.push('Missing stopLoss.');
  if (!target)     reasons.push('Missing target.');
  if (!qty || qty <= 0) reasons.push('Quantity must be > 0.');

  // Only run heavy gates if shape is valid
  if (reasons.length === 0) {
    // 2) Risk Engine evaluateTrade (the 7 gates from Sprint 3 #10)
    const riskResult = await riskEngine.evaluateTrade({
      botId, symbol, action, qty, entryPrice, stopLoss, sector,
    });
    checks = riskResult.checks;
    if (!riskResult.allowed) reasons.push(...riskResult.reasons);

    // 3) Validator-specific extra gates
    const dupReason = await checkDuplicateOpen({ botId, symbol, action });
    if (dupReason) { reasons.push(dupReason); checks.duplicateOpen = { blocked: true }; }
    else checks.duplicateOpen = { blocked: false };

    const mktReason = checkMarketOpen(allowOffHours);
    if (mktReason) { reasons.push(mktReason); checks.marketHours = { blocked: true }; }
    else checks.marketHours = { blocked: false };
  }

  const accepted = reasons.length === 0;

  // 4) Record "evaluated" always — the audit trail shows every attempt
  const evaluatedEvent = await compliance.recordEvent({
    botId, tradeSetupId: null,
    decision: 'evaluated',
    symbol, action, quantity: qty, entryPrice, stopLoss, target,
    price: entryPrice,
    reasoning: reasoning || 'Candidate validation',
    reasons: [], checks, clientIp,
  });

  // 5) If rejected — log rejection with full reasons[]
  if (!accepted) {
    const rejEvent = await compliance.recordEvent({
      botId, tradeSetupId: null,
      decision: 'rejected',
      symbol, action, quantity: qty, entryPrice, stopLoss, target,
      price: entryPrice,
      reasoning: `Validator rejected: ${reasons[0] || 'no specific reason'}`,
      reasons, checks, clientIp,
    });
    return {
      accepted: false, reasons, checks,
      complianceEventId: rejEvent?._id || evaluatedEvent?._id,
    };
  }

  // 6) If accepted, optionally persist as TradeSetup with realism
  let setupDoc = null;
  if (persist) {
    try {
      const entrySide = action === 'SELL' ? 'SELL' : 'BUY';
      const slip = paperRealism.applySlippage({ side: entrySide, ltp: entryPrice, liquidityBand });
      const entryCosts = paperRealism.computeLegCosts({ segment, side: entrySide, qty, price: slip.fillPrice });

      const riskAmount = Math.abs(entryPrice - stopLoss) * qty;
      const reward = Math.abs(target - entryPrice) * qty;
      const rrr = riskAmount > 0 ? `1:${(reward / riskAmount).toFixed(1)}` : 'N/A';

      setupDoc = await TradeSetup.create({
        symbol: symbol.toUpperCase(),
        tradeType, action,
        entryPrice, stopLoss, target,
        currentPrice: entryPrice,
        holdingDuration,
        riskRewardRatio: rrr,
        confidence: Math.min(100, Math.max(0, confidence)),
        reasoning,
        riskFactors: Array.isArray(riskFactors) ? riskFactors : [],
        quantity: qty,
        isPaperTrade: true,
        source: botId === 'manual' ? 'MANUAL' : 'AI_ANALYSIS',
        segment,
        botId,
        liquidityBand,
        entryFillPrice: slip.fillPrice,
        entrySlippageBps: slip.slippageBps,
        entryCosts,
      });
    } catch (persistErr) {
      // Persistence failure is rare but must not corrupt the validator contract
      console.error('[validator] persist failed:', persistErr.message);
      return {
        accepted: false, reasons: ['TradeSetup persist failed: ' + persistErr.message],
        checks, complianceEventId: evaluatedEvent?._id,
      };
    }
  }

  // 7) Log 'accepted' event, linked to the setup if persisted
  const accEvent = await compliance.recordEvent({
    botId, tradeSetupId: setupDoc?._id || null,
    decision: 'accepted',
    symbol, action, quantity: qty, entryPrice, stopLoss, target,
    price: setupDoc?.entryFillPrice || entryPrice,
    reasoning: reasoning || 'All gates passed',
    reasons: [], checks, clientIp,
  });

  return {
    accepted: true, reasons: [], checks,
    setupId: setupDoc?._id || null,
    complianceEventId: accEvent?._id || evaluatedEvent?._id,
  };
}

async function validateBatch(candidates = [], opts = {}) {
  const out = [];
  for (const c of candidates) {
    const result = await validateCandidate(c, opts);
    out.push({ candidate: c, result });
  }
  return out;
}

// Recent validations for the panel — pulls compliance feed filtered to
// evaluated/accepted/rejected.
async function getRecentValidations({ limit = 20, botId } = {}) {
  const filters = { limit: Math.min(limit, 100) };
  if (botId) filters.botId = botId;
  // Merge the 3 decision types client-side (keeps query simple).
  const filterSet = ['evaluated', 'accepted', 'rejected'];
  const results = [];
  for (const d of filterSet) {
    const { rows } = await compliance.getEvents({ ...filters, decision: d });
    results.push(...rows);
  }
  results.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return results.slice(0, limit);
}

module.exports = { validateCandidate, validateBatch, getRecentValidations };
