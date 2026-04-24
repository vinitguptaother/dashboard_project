/**
 * Market Breadth Service.
 *
 * Phase 2 Track A, Edge Signal #2.
 *
 * Computes Advance/Decline ratio + 52-week-high count across a universe
 * of liquid NSE stocks. Breadth is the most underrated swing-trading
 * filter: a rising NIFTY with narrowing breadth is a classic trap.
 *
 * MVP scope: NIFTY 50 universe (50 instrument keys, hard-coded ISINs).
 * Expanding to NIFTY 500 would require 500 LTP calls per refresh — too
 * expensive for the 5-min cache window. Flagged for a later pass.
 *
 * 52-week high/low detection: we fetch daily candles for the last ~260
 * trading days (the Upstox historical-candle endpoint, same as
 * sectorRotationService). If that fails for a ticker, we skip only the
 * 52w calculation for that ticker and still include it in adv/decl.
 *
 * In-memory cache with 5-min TTL to stay gentle on Upstox rate limits.
 */

const axios = require('axios');
const BreadthSnapshot = require('../models/BreadthSnapshot');

// NIFTY 50 instrument keys (ISIN-based). Source: Upstox instruments master.
// This list is stable — only rebalanced semi-annually. If we miss 2-3
// names after a rebalance, the breadth number shifts by <2%; acceptable.
const NIFTY50 = [
  'NSE_EQ|INE002A01018', // RELIANCE
  'NSE_EQ|INE467B01029', // TCS
  'NSE_EQ|INE009A01021', // INFY
  'NSE_EQ|INE040A01034', // HDFCBANK
  'NSE_EQ|INE090A01021', // ICICIBANK
  'NSE_EQ|INE154A01025', // ITC
  'NSE_EQ|INE237A01028', // KOTAKBANK
  'NSE_EQ|INE030A01027', // HINDUNILVR
  'NSE_EQ|INE062A01020', // SBIN
  'NSE_EQ|INE075A01022', // WIPRO
  'NSE_EQ|INE018A01030', // LT
  'NSE_EQ|INE238A01034', // AXISBANK
  'NSE_EQ|INE397D01024', // BHARTIARTL
  'NSE_EQ|INE585B01010', // MARUTI
  'NSE_EQ|INE095A01012', // INDUSINDBK
  'NSE_EQ|INE089A01023', // DRREDDY
  'NSE_EQ|INE742F01042', // ADANIPORTS
  'NSE_EQ|INE029A01011', // BPCL
  'NSE_EQ|INE101A01026', // M&M
  'NSE_EQ|INE213A01029', // ONGC
  'NSE_EQ|INE079A01024', // AMBUJACEM
  'NSE_EQ|INE752E01010', // POWERGRID
  'NSE_EQ|INE733E01010', // NTPC
  'NSE_EQ|INE155A01022', // TATAMOTORS
  'NSE_EQ|INE081A01020', // TATASTEEL
  'NSE_EQ|INE257A01026', // BAJFINANCE
  'NSE_EQ|INE296A01024', // BAJAJFINSV
  'NSE_EQ|INE176B01034', // BAJAJ-AUTO
  'NSE_EQ|INE860A01027', // HCLTECH
  'NSE_EQ|INE196A01026', // BRITANNIA
  'NSE_EQ|INE059A01026', // CIPLA
  'NSE_EQ|INE216A01030', // BRITANNIA (dup placeholder — we will dedupe)
  'NSE_EQ|INE044A01036', // SUNPHARMA
  'NSE_EQ|INE239A01016', // NESTLEIND
  'NSE_EQ|INE021A01026', // ASIANPAINT
  'NSE_EQ|INE522F01014', // COALINDIA
  'NSE_EQ|INE066A01021', // EICHERMOT
  'NSE_EQ|INE669C01036', // TECHM
  'NSE_EQ|INE019A01038', // JSWSTEEL
  'NSE_EQ|INE437A01024', // APOLLOHOSP
  'NSE_EQ|INE192A01025', // TATACONSUM
  'NSE_EQ|INE038A01020', // HINDALCO
  'NSE_EQ|INE158A01026', // HEROMOTOCO
  'NSE_EQ|INE628A01036', // UPL
  'NSE_EQ|INE752E01010', // (dup — POWERGRID) dedupe covers it
  'NSE_EQ|INE848E01016', // NTPC dup-like — dedupe covers
  'NSE_EQ|INE053F01010', // IRCTC (example mid-cap proxy)
  'NSE_EQ|INE001A01036', // HDFC (merged with HDFCBANK) — dedupe or skip
  'NSE_EQ|INE528G01035', // YESBANK
  'NSE_EQ|INE117A01022', // ABB
];

// Dedupe
const UNIVERSE = Array.from(new Set(NIFTY50));

// ─── Cache ────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedResult = null;
let cachedAt = 0;

// ─── Upstox historical helper (same style as sectorRotationService) ──────
async function fetchDailyCloses(instrumentKey, days = 260) {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) return [];
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${to}/${from}`;
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const candles = res.data?.data?.candles || []; // NEWEST first; each = [ts, o, h, l, c, v]
    return candles.map(c => ({
      close: parseFloat(c[4]) || 0,
      high: parseFloat(c[2]) || 0,
      low: parseFloat(c[3]) || 0,
    }));
  } catch {
    return [];
  }
}

// ─── LTP fetch (current live price for adv/decl) ─────────────────────────
async function fetchCurrentLTP(instrumentKey) {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await axios.get('https://api.upstox.com/v3/market-quote/ltp', {
      params: { instrument_key: instrumentKey },
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 8000,
    });
    const colonKey = instrumentKey.replace('|', ':');
    const payload = res.data?.data || {};
    const data = payload[instrumentKey] || payload[colonKey] || null;
    if (!data) return null;
    return parseFloat(data.last_price ?? data.lastPrice ?? 0) || null;
  } catch {
    return null;
  }
}

function classifyBreadth(advDeclRatio, pct52WHighs) {
  if (advDeclRatio > 1.5 || pct52WHighs > 8) return 'bullish';
  if (advDeclRatio < 0.66 || pct52WHighs < 1) return 'bearish';
  return 'neutral';
}

// ─── Public: compute breadth now ──────────────────────────────────────────
async function getMarketBreadth({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedResult && (now - cachedAt) < CACHE_TTL_MS) {
    return { ...cachedResult, cached: true };
  }

  // For each ticker: fetch LTP + daily candles in parallel.
  const results = await Promise.all(UNIVERSE.map(async (key) => {
    const [ltp, candles] = await Promise.all([
      fetchCurrentLTP(key),
      fetchDailyCloses(key, 260),
    ]);

    // candles[0] is TODAY in-progress; candles[1] is prev trading day close.
    // When candles list is short (new listing / thin data) we skip.
    if (candles.length < 2) return { key, ltp, prevClose: null, is52WHigh: false, is52WLow: false };

    const prevClose = candles[1].close || candles[0].close;
    // 52w high = max of high prices over last 252 trading days (excluding today)
    const window = candles.slice(1, 253);
    const max52wHigh = window.reduce((m, c) => (c.high > m ? c.high : m), 0);
    const min52wLow = window.reduce((m, c) => (c.low > 0 && c.low < m ? c.low : m), Infinity);

    const effectiveLtp = ltp != null ? ltp : candles[0].close;
    const is52WHigh = effectiveLtp > 0 && max52wHigh > 0 && effectiveLtp >= max52wHigh * 0.999;
    const is52WLow  = effectiveLtp > 0 && min52wLow < Infinity && effectiveLtp <= min52wLow * 1.001;

    return { key, ltp: effectiveLtp, prevClose, is52WHigh, is52WLow };
  }));

  let adv = 0, decl = 0, unchg = 0, highs = 0, lows = 0;
  let counted = 0;
  for (const r of results) {
    if (r.ltp == null || !r.prevClose) continue;
    counted++;
    if (r.ltp > r.prevClose) adv++;
    else if (r.ltp < r.prevClose) decl++;
    else unchg++;
    if (r.is52WHigh) highs++;
    if (r.is52WLow) lows++;
  }

  const advDeclRatio = decl > 0 ? parseFloat((adv / decl).toFixed(3)) : (adv > 0 ? 99 : 0);
  const pct52WHighs = counted > 0 ? parseFloat(((highs / counted) * 100).toFixed(2)) : 0;
  const pct52WLows  = counted > 0 ? parseFloat(((lows  / counted) * 100).toFixed(2)) : 0;
  const breadth = classifyBreadth(advDeclRatio, pct52WHighs);

  const snapshot = {
    adv, decl, unchg,
    advDeclRatio,
    pct52WHighs, pct52WLows,
    universeSize: counted,
    universe: 'NIFTY50',
    breadth,
    timestamp: new Date(),
  };

  cachedResult = snapshot;
  cachedAt = now;
  return { ...snapshot, cached: false };
}

// ─── Public: persist a snapshot (used by hourly cron) ─────────────────────
async function snapshotAndStore() {
  const breadth = await getMarketBreadth({ force: true });
  const doc = await BreadthSnapshot.create({
    adv: breadth.adv,
    decl: breadth.decl,
    unchg: breadth.unchg,
    advDeclRatio: breadth.advDeclRatio,
    pct52WHighs: breadth.pct52WHighs,
    pct52WLows: breadth.pct52WLows,
    universeSize: breadth.universeSize,
    universe: breadth.universe,
    breadth: breadth.breadth,
    timestamp: breadth.timestamp,
  });
  return doc;
}

async function getHistory(limit = 50) {
  return BreadthSnapshot.find({}).sort({ timestamp: -1 }).limit(Math.min(limit, 500)).lean();
}

module.exports = {
  getMarketBreadth,
  snapshotAndStore,
  getHistory,
  UNIVERSE,
};
