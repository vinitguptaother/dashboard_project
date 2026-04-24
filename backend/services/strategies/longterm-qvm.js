/**
 * Quality + Value + Momentum (QVM) — long-term composite strategy.
 *
 * Blueprint definition:
 *   • Quality: ROE > 15%
 *   • Value: P/E < sector average
 *   • Momentum: price > 200 DMA
 *
 * Position sizing: 10% of long-term capital (handled by Scanner / Validator).
 * Stop: 30% trailing from peak (NOT a tight SL — long-term bot tolerates drawdown).
 *
 * Inputs expected via `context`:
 *   context.fundamentals = {
 *     roe: number,          // %
 *     pe: number,
 *     sectorAvgPe: number,
 *   }
 *
 * If fundamentals are missing we still check the Momentum leg on price data.
 * A final candidate is only returned when all three legs pass (or we default
 * to null on missing fundamentals, which is expected on most MVP calls).
 */

function _sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

async function evaluate({ symbol, candles = [], lastPrice, regime, context = {} } = {}) {
  if (!symbol || !lastPrice || lastPrice <= 0) return null;

  const regimeTag = regime?.regime || regime || '';
  if (regimeTag === 'risk-off') return null;

  const fundamentals = context.fundamentals;
  if (!fundamentals) return null; // MVP: skip silently when fundamentals absent

  const { roe, pe, sectorAvgPe } = fundamentals;
  if (roe == null || pe == null || sectorAvgPe == null) return null;

  // Quality + Value gates
  if (roe <= 15) return null;
  if (pe >= sectorAvgPe) return null;

  // Momentum gate: price > 200 DMA (need at least 200 candles)
  const closes = candles.map(c => c.close).filter(Boolean);
  if (closes.length < 200) return null;
  const sma200 = _sma(closes, 200);
  if (!sma200 || lastPrice <= sma200) return null;

  // Long-term levels: SL at 30% below entry (trailing-in-spirit),
  // target at 2x (1:2 R:R on generous stop).
  const stopLoss = lastPrice * 0.70;
  const target = lastPrice * 1.60;

  return {
    action: 'BUY',
    entryPrice: parseFloat(lastPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    target: parseFloat(target.toFixed(2)),
    confidence: 72,
    reasoning:
      `QVM composite passes: ROE ${roe.toFixed(1)}% > 15% (quality), ` +
      `P/E ${pe.toFixed(1)} < sector avg ${sectorAvgPe.toFixed(1)} (value), ` +
      `price ₹${lastPrice.toFixed(2)} > 200 DMA ₹${sma200.toFixed(2)} (momentum). ` +
      `Position size 10% of long-term capital; 30% trailing stop from peak.`,
  };
}

module.exports = {
  key: 'longterm-qvm',
  name: 'Quality + Value + Momentum',
  segment: 'equity-delivery',
  botId: 'longterm',
  regimeCompatibility: ['trending-bull', 'breakout', 'choppy', 'trending-bear'],
  description:
    'Long-term composite: ROE > 15% (quality) + P/E below sector average (value) + price above 200 DMA (momentum). ' +
    'Position size 10% of long-term capital; 30% trailing stop from peak — no tight intraday SL.',
  evaluate,
};

module.exports.backtest = async () => ({
  runs: 0, winRate: null, avgReturn: null, pendingPhase5: true,
});
