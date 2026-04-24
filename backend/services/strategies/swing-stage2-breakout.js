/**
 * Stage 2 Breakout — swing strategy.
 *
 * Blueprint definition: price breaks out above a consolidation zone at the
 * 50 DMA, with volume >= 1.5x the recent average.
 *
 * Regime gate: trending-bull OR breakout. Refuses choppy / risk-off.
 *
 * Output contract (shared by every strategy):
 *   null | {
 *     action: 'BUY' | 'SELL',
 *     entryPrice: number,
 *     stopLoss: number,
 *     target: number,
 *     confidence: number (0-100),
 *     reasoning: string,
 *   }
 *
 * MVP — many calls will return null when we lack data. That's fine.
 */

function _sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

async function evaluate({ symbol, candles = [], lastPrice, atr, supports = [], resistances = [], regime } = {}) {
  if (!symbol || !lastPrice || lastPrice <= 0) return null;
  if (!Array.isArray(candles) || candles.length < 60) return null;

  // Regime gate — hard-no for anything outside trending-bull / breakout.
  const regimeTag = regime?.regime || regime || '';
  if (!['trending-bull', 'breakout'].includes(regimeTag)) return null;

  const closes = candles.map(c => c.close).filter(Boolean);
  const volumes = candles.map(c => c.volume || 0);
  const highs = candles.map(c => c.high).filter(Boolean);

  const sma50 = _sma(closes, 50);
  if (!sma50) return null;

  // Stage 2: price trading above 50 DMA
  if (lastPrice < sma50 * 0.99) return null;

  // Breakout: today close must be above the 20-bar high (consolidation high)
  const last20Highs = highs.slice(-21, -1); // exclude today
  if (last20Highs.length < 10) return null;
  const consolidationHigh = Math.max(...last20Highs);
  if (lastPrice < consolidationHigh * 1.001) return null;

  // Volume confirmation: today vs 20-day average
  const todayVol = volumes[volumes.length - 1] || 0;
  const avgVol = _sma(volumes.slice(0, -1), 20);
  if (!avgVol || todayVol < avgVol * 1.5) return null;

  // Levels: SL just under breakout level (or nearest support), target 1:2 R:R
  const slFromBreakout = consolidationHigh * 0.98;
  const nearestSupport = (supports || []).find(s => s < lastPrice) ?? null;
  const stopLoss = nearestSupport != null
    ? Math.max(nearestSupport, slFromBreakout)
    : slFromBreakout;

  const riskPerShare = Math.max(lastPrice - stopLoss, 0.01);
  const target = lastPrice + riskPerShare * 2;

  // Confidence: stronger the volume surge, higher the conviction
  const volRatio = todayVol / avgVol;
  const confidence = Math.min(85, 55 + Math.round((volRatio - 1.5) * 10));

  return {
    action: 'BUY',
    entryPrice: parseFloat(lastPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    target: parseFloat(target.toFixed(2)),
    confidence,
    reasoning:
      `Stage 2 breakout above 50 DMA. Consolidation high ₹${consolidationHigh.toFixed(2)} cleared on ` +
      `${volRatio.toFixed(1)}x volume vs 20-day avg. 50 DMA ₹${sma50.toFixed(2)} supports the trend.`,
  };
}

module.exports = {
  key: 'swing-stage2-breakout',
  name: 'Stage 2 Breakout',
  segment: 'equity-delivery',
  botId: 'swing',
  regimeCompatibility: ['trending-bull', 'breakout'],
  description:
    'Price breaks out above a multi-week consolidation zone at the 50 DMA with volume >= 1.5x the 20-day average. ' +
    'Stop below the breakout level; 1:2 R:R target.',
  evaluate,
};

/**
 * Phase 5: real backtest. Delegates to backtestService.runBacktest.
 * Backward compat: the old stub shape is preserved via `runs/winRate/avgReturn`.
 */
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
    strategyKey: 'swing-stage2-breakout',
    universe, fromDate, toDate, initialCapital, riskPerTradePct, regimeFilter,
  });
  return {
    runs: r.totalTrades,
    winRate: r.winRate,
    avgReturn: r.avgReturnPct,
    pendingPhase5: false,
    full: r,
  };
};
