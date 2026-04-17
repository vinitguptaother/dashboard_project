/**
 * Sector Rotation Service — tracks 12 NSE sector indices vs NIFTY 50 benchmark,
 * computes day / week / month % change + relative strength (sector − NIFTY).
 *
 * BOT_BLUEPRINT item #28.
 *
 * Strategy:
 *   1) Fetch last 30 trading-day closes for NIFTY + each sector (Upstox historical-candle).
 *   2) Latest = closes[0] (Upstox returns NEWEST first).
 *   3) Day% = (latest − prev) / prev × 100
 *   4) Week% = (latest − close[5]) / close[5] × 100
 *   5) Month% = (latest − close[21]) / close[21] × 100
 *   6) Relative strength = sector% − NIFTY% at each horizon.
 *   7) Leaders = top 3 by 1W rel strength. Laggards = bottom 3.
 *
 * Data cost: 13 instruments × 1 historical call ≈ 13 requests per refresh.
 * Cron: every 30 min during market hours (same pattern as regime).
 */

const axios = require('axios');
const SectorPerformance = require('../models/SectorPerformance');

const NIFTY_KEY = 'NSE_INDEX|Nifty 50';

// 12 core sector indices — the set most swing/positional traders watch.
const SECTORS = [
  { name: 'NIFTY BANK',          key: 'NSE_INDEX|Nifty Bank' },
  { name: 'NIFTY IT',            key: 'NSE_INDEX|Nifty IT' },
  { name: 'NIFTY AUTO',          key: 'NSE_INDEX|Nifty Auto' },
  { name: 'NIFTY PHARMA',        key: 'NSE_INDEX|Nifty Pharma' },
  { name: 'NIFTY FMCG',          key: 'NSE_INDEX|Nifty FMCG' },
  { name: 'NIFTY METAL',         key: 'NSE_INDEX|Nifty Metal' },
  { name: 'NIFTY REALTY',        key: 'NSE_INDEX|Nifty Realty' },
  { name: 'NIFTY MEDIA',         key: 'NSE_INDEX|Nifty Media' },
  { name: 'NIFTY PSU BANK',      key: 'NSE_INDEX|Nifty PSU Bank' },
  { name: 'NIFTY PVT BANK',      key: 'NSE_INDEX|Nifty Pvt Bank' },
  { name: 'NIFTY ENERGY',        key: 'NSE_INDEX|Nifty Energy' },
  { name: 'NIFTY FIN SERVICES',  key: 'NSE_INDEX|Nifty Fin Service' },
];

async function fetchDailyCloses(instrumentKey, days = 45) {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error('UPSTOX_ACCESS_TOKEN not set');
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${to}/${from}`;
  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const candles = res.data?.data?.candles || []; // NEWEST first
    return candles.map(c => parseFloat(c[4])).filter(n => n > 0);
  } catch (err) {
    console.warn(`[sector-rotation] fetch ${instrumentKey} failed: ${err.message}`);
    return [];
  }
}

function pct(latest, previous) {
  if (!previous || previous <= 0) return 0;
  return ((latest - previous) / previous) * 100;
}

async function classifyCurrent() {
  // 1) NIFTY benchmark closes
  const niftyCloses = await fetchDailyCloses(NIFTY_KEY, 45);
  if (niftyCloses.length < 2) throw new Error(`NIFTY history too short (got ${niftyCloses.length})`);
  const niftyLatest = niftyCloses[0];
  const niftyPrev   = niftyCloses[1];
  const niftyW      = niftyCloses[Math.min(5, niftyCloses.length - 1)];
  const niftyM      = niftyCloses[Math.min(21, niftyCloses.length - 1)];
  const niftyDayPct   = pct(niftyLatest, niftyPrev);
  const niftyWeekPct  = pct(niftyLatest, niftyW);
  const niftyMonthPct = pct(niftyLatest, niftyM);

  // 2) Each sector — parallel fetch
  const sectorResults = await Promise.all(SECTORS.map(async (s) => {
    const closes = await fetchDailyCloses(s.key, 45);
    if (closes.length < 2) {
      return {
        name: s.name, instrumentKey: s.key,
        ltp: 0, dayChangePct: 0, weekChangePct: 0, monthChangePct: 0,
        relStrengthVsNifty1D: 0, relStrengthVsNifty1W: 0, relStrengthVsNifty1M: 0,
      };
    }
    const latest = closes[0];
    const prev   = closes[1];
    const w      = closes[Math.min(5, closes.length - 1)];
    const m      = closes[Math.min(21, closes.length - 1)];
    const dPct = pct(latest, prev);
    const wPct = pct(latest, w);
    const mPct = pct(latest, m);
    return {
      name: s.name, instrumentKey: s.key,
      ltp: parseFloat(latest.toFixed(2)),
      dayChangePct: parseFloat(dPct.toFixed(3)),
      weekChangePct: parseFloat(wPct.toFixed(3)),
      monthChangePct: parseFloat(mPct.toFixed(3)),
      relStrengthVsNifty1D: parseFloat((dPct - niftyDayPct).toFixed(3)),
      relStrengthVsNifty1W: parseFloat((wPct - niftyWeekPct).toFixed(3)),
      relStrengthVsNifty1M: parseFloat((mPct - niftyMonthPct).toFixed(3)),
    };
  }));

  // 3) Leaders / laggards by 1W relative strength
  const ranked = [...sectorResults].sort((a, b) => b.relStrengthVsNifty1W - a.relStrengthVsNifty1W);
  const leaders  = ranked.slice(0, 3).map(r => r.name);
  const laggards = ranked.slice(-3).reverse().map(r => r.name);

  return {
    niftyLevel: parseFloat(niftyLatest.toFixed(2)),
    niftyDayChangePct: parseFloat(niftyDayPct.toFixed(3)),
    niftyWeekChangePct: parseFloat(niftyWeekPct.toFixed(3)),
    niftyMonthChangePct: parseFloat(niftyMonthPct.toFixed(3)),
    sectors: sectorResults,
    leaders, laggards,
    computedAt: new Date(),
  };
}

async function computeAndStore() {
  const doc = await classifyCurrent();
  const saved = await SectorPerformance.create(doc);
  return saved;
}

async function getCurrent() {
  return SectorPerformance.findOne({}).sort({ computedAt: -1 }).lean();
}

async function getHistory(limit = 30) {
  return SectorPerformance.find({}).sort({ computedAt: -1 }).limit(limit).lean();
}

module.exports = { classifyCurrent, computeAndStore, getCurrent, getHistory, SECTORS };
