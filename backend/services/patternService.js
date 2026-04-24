/**
 * Pattern Service — support/resistance + ATR derived from real candles.
 *
 * Phase 1 Track A: replaces Scanner's mechanical 5%/12% SL logic with
 * entry/SL/target anchored to actual pivot levels and ATR-based volatility.
 *
 * No new dependencies. Reuses upstoxService's symbol formatting + token.
 */

const axios = require('axios');
const upstoxService = require('./upstoxService');

const HIST_BASE = 'https://api.upstox.com/v2';

// Small in-memory cache — candles rarely change intraday at daily resolution.
const _candleCache = new Map(); // key: `${symbol}|${days}` → { ts, candles }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch last N days daily OHLC from Upstox for a symbol.
 * Returns chronological array: [{ date, open, high, low, close, volume }, ...]
 */
async function getDailyCloses(symbol, days = 120) {
  const cacheKey = `${symbol}|${days}`;
  const cached = _candleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.candles;

  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error('UPSTOX_ACCESS_TOKEN not set');

  const instrumentKey = upstoxService.formatSymbolForUpstox(symbol);
  const to = new Date().toISOString().slice(0, 10);
  // Pad: trading days ≈ 250/year, so (days * ~1.5) calendar days safely covers N trading days
  const from = new Date(Date.now() - Math.ceil(days * 1.6) * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const url = `${HIST_BASE}/historical-candle/${encodeURIComponent(instrumentKey)}/day/${to}/${from}`;

  const res = await axios.get(url, {
    timeout: 15000,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const raw = res.data?.data?.candles || []; // [[ts, open, high, low, close, vol, oi], ...]
  // Upstox returns NEWEST first — reverse to chronological
  const candles = raw.slice().reverse().map(c => ({
    date: c[0],
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseInt(c[5] || 0, 10),
  })).filter(x => x.close > 0 && x.high > 0 && x.low > 0);

  _candleCache.set(cacheKey, { ts: Date.now(), candles });
  return candles;
}

/**
 * Average True Range (Wilder-ish simple-average flavour).
 * Returns { atr, atrPct } — atrPct relative to last close.
 */
function computeATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return { atr: 0, atrPct: 0 };
  }
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
  }
  // Simple average of the last `period` TRs (close enough for MVP).
  const recent = trs.slice(-period);
  const atr = recent.reduce((a, b) => a + b, 0) / recent.length;
  const lastClose = candles[candles.length - 1].close;
  const atrPct = lastClose > 0 ? (atr / lastClose) * 100 : 0;
  return {
    atr: parseFloat(atr.toFixed(2)),
    atrPct: parseFloat(atrPct.toFixed(2)),
  };
}

/**
 * Cluster nearby levels: merge any two levels within `pctTol` of each other.
 * Returns new array, sorted ascending.
 */
function _clusterLevels(levels, pctTol = 0.5) {
  if (!levels.length) return [];
  const sorted = levels.slice().sort((a, b) => a - b);
  const clusters = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const v = sorted[i];
    const tail = clusters[clusters.length - 1];
    const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
    if (Math.abs(v - mean) / mean * 100 <= pctTol) {
      tail.push(v);
    } else {
      clusters.push([v]);
    }
  }
  return clusters.map(g => parseFloat((g.reduce((a, b) => a + b, 0) / g.length).toFixed(2)));
}

/**
 * Find pivot-point supports + resistances over N-bar lookback.
 * Pivot high: high[i] strictly > neighbours in [i-lookback..i-1] and [i+1..i+lookback].
 * Pivot low: mirror.
 */
function findPivotLevels(candles, lookback = 5) {
  if (!Array.isArray(candles) || candles.length < lookback * 2 + 1) {
    return { supports: [], resistances: [] };
  }
  const highs = [];
  const lows = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    let isPivotHigh = true;
    let isPivotLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= h || candles[i + j].high >= h) isPivotHigh = false;
      if (candles[i - j].low <= l || candles[i + j].low <= l) isPivotLow = false;
      if (!isPivotHigh && !isPivotLow) break;
    }
    if (isPivotHigh) highs.push(h);
    if (isPivotLow) lows.push(l);
  }
  const supportsAsc = _clusterLevels(lows, 0.5);
  const resistancesAsc = _clusterLevels(highs, 0.5);
  // Spec: supports descending (highest support first = closest to price from below)
  // Resistances ascending (lowest resistance first = closest to price from above)
  return {
    supports: supportsAsc.slice().sort((a, b) => b - a),
    resistances: resistancesAsc.slice().sort((a, b) => a - b),
  };
}

/**
 * Classify a symbol's liquidity band by ATR%.
 * Options always override to 'OPTIONS'.
 */
function classifyLiquidityBand(atrPct, segment = 'equity') {
  if (segment === 'options') return 'OPTIONS';
  if (atrPct < 1.5) return 'LARGE';
  if (atrPct < 3) return 'MID';
  if (atrPct < 5) return 'SMALL';
  return 'ILLIQUID';
}

/**
 * Orchestrator: full S/R + ATR picture for a symbol.
 * Returns null-safe object even on failure.
 */
async function getLevelsForSymbol(symbol, lastPrice) {
  const candles = await getDailyCloses(symbol, 120);
  if (candles.length < 20) {
    throw new Error(`Insufficient history for ${symbol}: got ${candles.length} candles`);
  }
  const effectivePrice = lastPrice && lastPrice > 0
    ? parseFloat(lastPrice)
    : candles[candles.length - 1].close;

  const { atr, atrPct } = computeATR(candles, 14);
  const liquidityBand = classifyLiquidityBand(atrPct);
  const { supports, resistances } = findPivotLevels(candles, 5);

  // Nearest support BELOW current price (first strictly less than lastPrice).
  const nearestSupport = supports.find(s => s < effectivePrice) ?? null;
  // Nearest resistance ABOVE current price (first strictly greater).
  const nearestResistance = resistances.find(r => r > effectivePrice) ?? null;

  // SL: the MAX of (nearest support, price - 1.5*ATR) — we want the TIGHTER stop
  // when price is near support, and ATR floor when support is far away.
  // (Per spec: "max(nearestSupport, lastPrice - 1.5*atr)" — higher value = closer stop.)
  const atrFloor = parseFloat((effectivePrice - 1.5 * atr).toFixed(2));
  const suggestedStopLoss = nearestSupport != null
    ? parseFloat(Math.max(nearestSupport, atrFloor).toFixed(2))
    : atrFloor;

  // Target: the MIN of (nearest resistance, price + 3*ATR) — 1:2 R:R vs 1.5*ATR stop.
  const atrCeiling = parseFloat((effectivePrice + 3 * atr).toFixed(2));
  const suggestedTarget = nearestResistance != null
    ? parseFloat(Math.min(nearestResistance, atrCeiling).toFixed(2))
    : atrCeiling;

  return {
    symbol: symbol.toUpperCase(),
    lastPrice: parseFloat(effectivePrice.toFixed(2)),
    atr,
    atrPct,
    liquidityBand,
    nearestSupport,
    nearestResistance,
    allSupports: supports,
    allResistances: resistances,
    suggestedStopLoss,
    suggestedTarget,
    computedAt: new Date(),
  };
}

module.exports = {
  getDailyCloses,
  computeATR,
  findPivotLevels,
  classifyLiquidityBand,
  getLevelsForSymbol,
};
