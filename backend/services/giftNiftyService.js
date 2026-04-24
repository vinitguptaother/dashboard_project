/**
 * GIFT Nifty Pre-Market Gap Predictor.
 *
 * Phase 2 Track A, Edge Signal #3.
 *
 * GIFT Nifty (formerly SGX Nifty) is the NSE-IX-listed Nifty futures
 * contract that trades 6:30 AM – 9:15 AM IST, before NSE opens. It is
 * the best available proxy for NIFTY's opening gap.
 *
 * Strategy:
 *   1) Scrape GIFT Nifty current level from NSE-IX public pages.
 *   2) Get yesterday's NIFTY close via Upstox historical-candle.
 *   3) Predicted gap % = (GIFT current − yesterday's NIFTY close) / yesterday's NIFTY close × 100
 *   4) Direction = UP / DOWN / FLAT (|gap| < 0.15% = FLAT).
 *
 * If NSE-IX blocks us (their cookie setup is fragile) we return
 * { giftLevel: null, predictedGapDirection: 'UNKNOWN', note: 'GIFT
 * Nifty source unavailable' } — we DO NOT fabricate a level.
 *
 * 5-minute in-memory cache.
 */

const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CACHE_TTL_MS = 5 * 60 * 1000;
let cached = null;
let cachedAt = 0;

// ─── Scrape GIFT Nifty spot from NSE-IX ────────────────────────────────────
async function scrapeFromNseIx() {
  const url = 'https://www.nse-ix.com/nifty/';
  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    validateStatus: (s) => s < 500,
  });
  if (res.status !== 200) throw new Error(`NSE-IX HTTP ${res.status}`);
  const html = String(res.data || '');

  // NSE-IX renders the level in HTML like:
  //   <div class="live-price">23,456.75</div>
  // Patterns vary — we try several regexes.
  const patterns = [
    /"ltp"\s*:\s*([\d,]+\.?\d*)/i,
    /"last_price"\s*:\s*([\d,]+\.?\d*)/i,
    /<[^>]*class="[^"]*live-price[^"]*"[^>]*>([\d,]+\.?\d*)<\//i,
    /Nifty[^<]{0,50}?([\d]{2},?\d{3}\.\d{1,2})/i,
    /GIFT[^<]{0,100}?([\d]{2},?\d{3}\.\d{1,2})/i,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (val > 10000 && val < 100000) return { level: val, source: 'nse-ix' };
    }
  }
  throw new Error('NSE-IX HTML shape changed — no level extracted');
}

// ─── Fallback: try Google Finance-style quote lookup via public proxy ─────
async function scrapeFromGoogleFinance() {
  const url = 'https://www.google.com/finance/quote/NIFTY_INDIAN_NEXT_INDEX50:NSEIX';
  const res = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    validateStatus: (s) => s < 500,
  });
  if (res.status !== 200) throw new Error(`Google Finance HTTP ${res.status}`);
  const html = String(res.data || '');
  const m = html.match(/data-last-price="([\d.]+)"/);
  if (m) {
    const val = parseFloat(m[1]);
    if (val > 10000 && val < 100000) return { level: val, source: 'google-finance' };
  }
  throw new Error('Google Finance — no extractable GIFT Nifty price');
}

// ─── Yesterday's NIFTY close via Upstox (reuse sectorRotation pattern) ────
async function getYesterdaysClose() {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error('UPSTOX_ACCESS_TOKEN not set');
  const instrumentKey = 'NSE_INDEX|Nifty 50';
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${to}/${from}`;
  const res = await axios.get(url, {
    timeout: 10000,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const candles = res.data?.data?.candles || [];
  if (candles.length === 0) throw new Error('NIFTY history empty');
  // NEWEST first. If today's candle exists (market already opened) we use [1];
  // otherwise we use [0].
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDateStr = String(candles[0][0] || '').slice(0, 10);
  const candle = firstDateStr === todayStr ? candles[1] : candles[0];
  if (!candle) throw new Error('NIFTY history has no yesterday candle');
  return {
    close: parseFloat(candle[4]) || 0,
    date: String(candle[0] || '').slice(0, 10),
  };
}

// ─── Public: current GIFT level (cached) ──────────────────────────────────
async function getCurrentGiftLevel() {
  const errors = [];
  for (const fn of [scrapeFromNseIx, scrapeFromGoogleFinance]) {
    try { return await fn(); } catch (err) { errors.push(`${fn.name}: ${err.message}`); }
  }
  return { level: null, source: null, errors };
}

// ─── Public: predict open gap ──────────────────────────────────────────────
async function predictOpenGap() {
  const now = Date.now();
  if (cached && (now - cachedAt) < CACHE_TTL_MS) return { ...cached, cached: true };

  let giftData = null;
  let giftErr = null;
  try {
    giftData = await getCurrentGiftLevel();
  } catch (err) {
    giftErr = err.message;
  }

  let yCloseData = null;
  let yCloseErr = null;
  try {
    yCloseData = await getYesterdaysClose();
  } catch (err) {
    yCloseErr = err.message;
  }

  const hasGift = giftData && typeof giftData.level === 'number' && giftData.level > 0;
  const hasClose = yCloseData && yCloseData.close > 0;

  if (!hasGift && !hasClose) {
    const out = {
      giftLevel: null,
      giftSource: null,
      yesterdayClose: null,
      yesterdayCloseDate: null,
      predictedGapPct: null,
      predictedGapDirection: 'UNKNOWN',
      note: 'Both GIFT Nifty and yesterday\'s NIFTY close unavailable',
      errors: [giftErr, yCloseErr, ...(giftData?.errors || [])].filter(Boolean),
      generatedAt: new Date(),
    };
    cached = out; cachedAt = now;
    return out;
  }

  if (!hasGift) {
    const out = {
      giftLevel: null,
      giftSource: null,
      yesterdayClose: yCloseData.close,
      yesterdayCloseDate: yCloseData.date,
      predictedGapPct: null,
      predictedGapDirection: 'UNKNOWN',
      note: 'GIFT Nifty source unavailable — gap unknown. Showing yesterday\'s close only.',
      errors: giftData?.errors || [giftErr].filter(Boolean),
      generatedAt: new Date(),
    };
    cached = out; cachedAt = now;
    return out;
  }

  const gapAbs = giftData.level - yCloseData.close;
  const gapPct = parseFloat(((gapAbs / yCloseData.close) * 100).toFixed(3));
  let direction = 'FLAT';
  if (gapPct > 0.15) direction = 'UP';
  else if (gapPct < -0.15) direction = 'DOWN';

  const out = {
    giftLevel: parseFloat(giftData.level.toFixed(2)),
    giftSource: giftData.source,
    yesterdayClose: parseFloat(yCloseData.close.toFixed(2)),
    yesterdayCloseDate: yCloseData.date,
    predictedGapAbs: parseFloat(gapAbs.toFixed(2)),
    predictedGapPct: gapPct,
    predictedGapDirection: direction,
    note: null,
    generatedAt: new Date(),
  };
  cached = out; cachedAt = now;
  return out;
}

module.exports = { getCurrentGiftLevel, getYesterdaysClose, predictOpenGap };
