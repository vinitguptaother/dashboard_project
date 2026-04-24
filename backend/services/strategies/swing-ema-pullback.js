/**
 * EMA Pullback — swing strategy.
 *
 * Blueprint definition: in an uptrend (20 EMA > 50 EMA), price pulls back to
 * the 20 EMA and closes green (bounce confirmed). Regime must be trending-bull.
 */

function _ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

async function evaluate({ symbol, candles = [], lastPrice, atr, supports = [], regime } = {}) {
  if (!symbol || !lastPrice || lastPrice <= 0) return null;
  if (!Array.isArray(candles) || candles.length < 60) return null;

  const regimeTag = regime?.regime || regime || '';
  if (regimeTag !== 'trending-bull') return null;

  const closes = candles.map(c => c.close).filter(Boolean);
  const ema20 = _ema(closes, 20);
  const ema50 = _ema(closes, 50);
  if (!ema20 || !ema50) return null;

  // Uptrend gate — fast EMA must be above slow EMA by at least 0.5%
  if (ema20 <= ema50 * 1.005) return null;

  // Pullback: price must be within 1.5% of the 20 EMA (either side)
  const distPct = Math.abs((lastPrice - ema20) / ema20) * 100;
  if (distPct > 1.5) return null;

  // Bounce confirmation: today's candle must close green
  const today = candles[candles.length - 1];
  if (!today || today.close <= today.open) return null;

  // Levels
  const stopLoss = ema50 * 0.99; // below the slower EMA
  const effAtr = atr && atr > 0 ? atr : (lastPrice * 0.02);
  const target = lastPrice + Math.max(2 * effAtr, lastPrice - stopLoss);

  return {
    action: 'BUY',
    entryPrice: parseFloat(lastPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    target: parseFloat(target.toFixed(2)),
    confidence: 65,
    reasoning:
      `Uptrend pullback: 20 EMA ₹${ema20.toFixed(2)} > 50 EMA ₹${ema50.toFixed(2)}. ` +
      `Price within ${distPct.toFixed(1)}% of 20 EMA and closed green today (₹${today.open.toFixed(2)} → ₹${today.close.toFixed(2)}).`,
  };
}

module.exports = {
  key: 'swing-ema-pullback',
  name: 'EMA Pullback',
  segment: 'equity-delivery',
  botId: 'swing',
  regimeCompatibility: ['trending-bull'],
  description:
    'Uptrend pullback: 20 EMA above 50 EMA, price tags the 20 EMA, and today closes green. ' +
    'Buy on the bounce; stop below the 50 EMA.',
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
    strategyKey: 'swing-ema-pullback',
    universe, fromDate, toDate, initialCapital, riskPerTradePct, regimeFilter,
  });
  return { runs: r.totalTrades, winRate: r.winRate, avgReturn: r.avgReturnPct, pendingPhase5: false, full: r };
};
