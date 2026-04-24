/**
 * Oversold Bounce — swing strategy.
 *
 * Blueprint definition: RSI(14) drops below 30, price is at or near a
 * known support level, and today's volume spikes (>= 1.3x 20-day avg).
 *
 * Regime gate: any regime except risk-off (we still want SOME supportive
 * backdrop — a falling knife in risk-off is exactly what we want to avoid).
 */

function _rsi(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function _sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

async function evaluate({ symbol, candles = [], lastPrice, atr, supports = [], regime } = {}) {
  if (!symbol || !lastPrice || lastPrice <= 0) return null;
  if (!Array.isArray(candles) || candles.length < 30) return null;

  const regimeTag = regime?.regime || regime || '';
  if (regimeTag === 'risk-off') return null;

  const closes = candles.map(c => c.close).filter(Boolean);
  const rsi = _rsi(closes, 14);
  if (rsi == null || rsi >= 30) return null;

  // Support proximity: lastPrice must be within 2% of a known support.
  const nearestSupport = (supports || []).find(s => s <= lastPrice * 1.02 && s >= lastPrice * 0.97);
  if (!nearestSupport) return null;

  // Volume spike on today's bar
  const volumes = candles.map(c => c.volume || 0);
  const todayVol = volumes[volumes.length - 1] || 0;
  const avgVol = _sma(volumes.slice(0, -1), 20);
  if (!avgVol || todayVol < avgVol * 1.3) return null;

  // Levels: tight SL just below support; 1:2 R:R target
  const stopLoss = nearestSupport * 0.98;
  const riskPerShare = Math.max(lastPrice - stopLoss, 0.01);
  const target = lastPrice + riskPerShare * 2;

  return {
    action: 'BUY',
    entryPrice: parseFloat(lastPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    target: parseFloat(target.toFixed(2)),
    confidence: 60,
    reasoning:
      `Oversold bounce: RSI(14) ${rsi.toFixed(1)} < 30. Price near support ₹${nearestSupport.toFixed(2)}. ` +
      `Today's volume ${(todayVol / avgVol).toFixed(1)}x 20-day avg — buyers stepping in.`,
  };
}

module.exports = {
  key: 'swing-oversold-bounce',
  name: 'Oversold Bounce',
  segment: 'equity-delivery',
  botId: 'swing',
  regimeCompatibility: ['trending-bull', 'choppy', 'breakout', 'trending-bear'],
  description:
    'RSI(14) below 30 + price hitting a known support + today\'s volume at least 1.3x the 20-day average. ' +
    'Buys the bounce; tight stop just below support.',
  evaluate,
};

module.exports.backtest = async () => ({
  runs: 0, winRate: null, avgReturn: null, pendingPhase5: true,
});
