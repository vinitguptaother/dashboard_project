/**
 * Post-Earnings Momentum — swing strategy.
 *
 * Blueprint definition: on the results day, stock closes >= 5% above the
 * pre-results close, with volume >= 2x the 20-day average. Regime must
 * NOT be risk-off (we want receptive buyers).
 *
 * Context keys consumed:
 *   context.postEarnings = {
 *     preResultsClose: number,
 *     isResultsDay: boolean,
 *   }
 *
 * MVP: if the context is not passed, we infer a proxy by checking whether
 * today's candle is a >=5% gap+run on >=2x volume. In production Phase 4
 * the Corporate Actions service will set `isResultsDay` cleanly.
 */

function _sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

async function evaluate({ symbol, candles = [], lastPrice, atr, regime, context = {} } = {}) {
  if (!symbol || !lastPrice || lastPrice <= 0) return null;
  if (!Array.isArray(candles) || candles.length < 25) return null;

  const regimeTag = regime?.regime || regime || '';
  if (regimeTag === 'risk-off') return null;

  const closes = candles.map(c => c.close).filter(Boolean);
  const volumes = candles.map(c => c.volume || 0);

  // Prefer explicit pre-results close when supplied; else use yesterday's close.
  const postEarnings = context.postEarnings || {};
  const preResultsClose = postEarnings.preResultsClose != null
    ? postEarnings.preResultsClose
    : closes[closes.length - 2];
  if (!preResultsClose || preResultsClose <= 0) return null;

  const todayChangePct = ((lastPrice - preResultsClose) / preResultsClose) * 100;
  if (todayChangePct < 5) return null;

  // Volume confirmation
  const todayVol = volumes[volumes.length - 1] || 0;
  const avgVol = _sma(volumes.slice(0, -1), 20);
  if (!avgVol || todayVol < avgVol * 2) return null;

  // If the caller explicitly said this is NOT the results day, bail. If the
  // flag is missing we allow the price+volume proxy above to stand.
  if (postEarnings.isResultsDay === false) return null;

  // Levels: SL at pre-results close - 1 ATR, target at 1:2 R:R
  const effAtr = atr && atr > 0 ? atr : (lastPrice * 0.03);
  const stopLoss = preResultsClose - effAtr;
  const riskPerShare = Math.max(lastPrice - stopLoss, 0.01);
  const target = lastPrice + riskPerShare * 2;

  return {
    action: 'BUY',
    entryPrice: parseFloat(lastPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    target: parseFloat(target.toFixed(2)),
    confidence: 70,
    reasoning:
      `Post-earnings momentum: close +${todayChangePct.toFixed(1)}% vs pre-results ₹${preResultsClose.toFixed(2)}. ` +
      `Volume ${(todayVol / avgVol).toFixed(1)}x 20-day avg. Institutional participation likely.`,
  };
}

module.exports = {
  key: 'swing-post-earnings-momentum',
  name: 'Post-Earnings Momentum',
  segment: 'equity-delivery',
  botId: 'swing',
  regimeCompatibility: ['trending-bull', 'breakout', 'choppy'],
  description:
    'Post-results close >= 5% above the pre-results close, on volume >= 2x the 20-day average. ' +
    'Rides the momentum for a few sessions; stop below the pre-results level minus 1 ATR.',
  evaluate,
};

module.exports.backtest = async () => ({
  runs: 0, winRate: null, avgReturn: null, pendingPhase5: true,
});
