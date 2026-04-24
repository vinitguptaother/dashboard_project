/**
 * Iron Condor on High IV Rank — options-sell strategy.
 *
 * Blueprint definition:
 *   Triggers when IV Rank > 60% AND regime in {choppy, trending-bull}.
 *   Sell 1 standard-deviation strangle with defined-risk wings.
 *   Exit at 50% of max profit or 21 DTE, whichever comes first.
 *
 * Inputs expected via `context`:
 *   context.options = {
 *     ivRank: number,          // 0-100, from OptionsIVHistory / optionsService
 *     underlying: 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | symbol,
 *     dte: number,             // days to expiry of the target chain
 *     expectedMovePct: number, // ~ atm IV * sqrt(dte/365); 1 SD
 *     spotPrice: number,
 *     lotSize: number,
 *   }
 *
 * Output is a "candidate" at a logical level: entry = spot, SL = max loss per
 * lot (spot * expectedMovePct * 1.5), target = spot unchanged (credit decay).
 * The actual strikes are left to the Options Execution layer (Phase 5+).
 */

async function evaluate({ symbol, lastPrice, regime, context = {} } = {}) {
  if (!symbol) return null;

  const regimeTag = regime?.regime || regime || '';
  if (!['choppy', 'trending-bull'].includes(regimeTag)) return null;

  const opt = context.options;
  if (!opt) return null; // MVP: skip silently when options context absent

  const { ivRank, dte, expectedMovePct, spotPrice } = opt;
  if (ivRank == null || ivRank <= 60) return null;
  if (!dte || dte < 25 || dte > 50) return null; // monthly expiry band
  if (!expectedMovePct || expectedMovePct <= 0) return null;

  const spot = spotPrice || lastPrice;
  if (!spot || spot <= 0) return null;

  // The "trade" — conceptually flat, wins on theta + IV crush
  const entryPrice = parseFloat(spot.toFixed(2));
  const stopLoss = parseFloat((spot * (1 - expectedMovePct * 0.015)).toFixed(2));
  const target = parseFloat((spot * (1 + expectedMovePct * 0.005)).toFixed(2));

  return {
    action: 'SELL',
    entryPrice,
    stopLoss,
    target,
    confidence: 68,
    reasoning:
      `IV Rank ${ivRank.toFixed(0)}% > 60 on ${opt.underlying || symbol}. ` +
      `Sell 1 SD strangle (${(expectedMovePct * 100).toFixed(1)}% expected move) with defined-risk wings. ` +
      `DTE ${dte}. Exit at 50% of max profit or at 21 DTE — whichever first.`,
  };
}

module.exports = {
  key: 'options-sell-iv-rank-iron-condor',
  name: 'IV-Rank Iron Condor',
  segment: 'options',
  botId: 'options-sell',
  regimeCompatibility: ['choppy', 'trending-bull'],
  description:
    'Sell a 1-SD iron condor when IV Rank > 60% and the regime is choppy or mildly bullish. ' +
    'Defined-risk wings; exit at 50% of max profit or 21 DTE.',
  evaluate,
};

module.exports.backtest = async (opts = {}) => {
  const backtestService = require('../backtestService');
  const {
    universe = [opts.symbol].filter(Boolean),
    fromDate, toDate,
    initialCapital = 500000, riskPerTradePct = 2, regimeFilter = null,
  } = opts;
  if (!fromDate || !toDate || universe.length === 0) {
    return { runs: 0, winRate: null, avgReturn: null, pendingPhase5: false, error: 'need universe+fromDate+toDate' };
  }
  const r = await backtestService.runBacktest({
    strategyKey: 'options-sell-iv-rank-iron-condor',
    universe, fromDate, toDate, initialCapital, riskPerTradePct, regimeFilter,
  });
  return { runs: r.totalTrades, winRate: r.winRate, avgReturn: r.avgReturnPct, pendingPhase5: false, full: r };
};
