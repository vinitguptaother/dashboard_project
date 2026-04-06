// backend/services/holidayService.js
// Fetches NSE trading holidays with a hybrid strategy:
//   1. Try NSE's unofficial JSON endpoint (holiday-master?type=trading)
//   2. On failure → fall back to bundled static JSON (backend/data/nseHolidays.json)
//   3. Cache successful fetches in memory + on disk for 24h (survives restart)
//
// Exports: { getHolidays, refreshHolidays, getHolidayStats }

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'nseHolidays.cache.json');
const STATIC_FILE = path.join(__dirname, '..', 'data', 'nseHolidays.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let memCache = null; // { holidays: [{date, name}], source, fetchedAt }

/** Load static bundled fallback. Always succeeds. */
function loadStatic() {
  try {
    const raw = fs.readFileSync(STATIC_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      holidays: parsed.holidays || [],
      source: 'static-fallback',
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('❌ Holiday service: static fallback missing', e.message);
    return { holidays: [], source: 'empty', fetchedAt: new Date().toISOString() };
  }
}

/** Load previously fetched cache from disk. */
function loadDiskCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.fetchedAt || !Array.isArray(parsed.holidays)) return null;
    const age = Date.now() - new Date(parsed.fetchedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

/** Save fetched holidays to disk cache. */
function saveDiskCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('⚠️ Holiday cache write failed:', e.message);
  }
}

/**
 * Fetch from NSE. Returns parsed holiday list or throws.
 * NSE requires a cookie + browser-like User-Agent; we do a two-step handshake.
 */
async function fetchFromNSE() {
  const client = axios.create({
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/',
    },
    withCredentials: true,
  });

  // Step 1: hit home page to get cookies
  const home = await client.get('https://www.nseindia.com/');
  const cookies = (home.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  if (!cookies) throw new Error('NSE: no cookies received');

  // Step 2: hit holiday endpoint with cookies
  const res = await client.get('https://www.nseindia.com/api/holiday-master?type=trading', {
    headers: { Cookie: cookies },
  });

  // Response shape: { CM: [{tradingDate: '03-Apr-2026', day, description, morning?, afternoon?, Sr_no}] }
  const list = res.data?.CM;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('NSE: empty holiday list in response');
  }

  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const holidays = list.map(h => {
    const parts = String(h.tradingDate || '').split('-'); // "03-Apr-2026"
    if (parts.length !== 3) return null;
    const [day, monStr, year] = parts;
    const mm = months[monStr];
    if (!mm) return null;
    return {
      date: `${year}-${mm}-${day.padStart(2, '0')}`,
      name: h.description || 'NSE Holiday',
    };
  }).filter(Boolean);

  return {
    holidays,
    source: 'nse-api',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Main getter. Returns cached list (memory → disk → NSE fetch → static fallback).
 * Non-blocking for callers: if nothing cached yet, returns static fallback immediately
 * and triggers a background refresh.
 */
function getHolidays() {
  if (memCache) return memCache;

  // Try disk cache
  const disk = loadDiskCache();
  if (disk) {
    memCache = disk;
    return memCache;
  }

  // Nothing cached — return static now, refresh in background
  memCache = loadStatic();
  refreshHolidays().catch(() => {}); // fire-and-forget
  return memCache;
}

/**
 * Force a refresh from NSE. Falls back silently to static on failure.
 * Safe to call from cron / startup.
 */
async function refreshHolidays() {
  try {
    const fresh = await fetchFromNSE();
    memCache = fresh;
    saveDiskCache(fresh);
    console.log(`✅ Holiday service: fetched ${fresh.holidays.length} holidays from NSE`);
    return fresh;
  } catch (e) {
    console.warn(`⚠️ Holiday service: NSE fetch failed (${e.message}) — using static fallback`);
    if (!memCache || memCache.source === 'empty') {
      memCache = loadStatic();
    }
    return memCache;
  }
}

/** For /api/market-status endpoint debugging. */
function getHolidayStats() {
  const c = memCache || loadStatic();
  return {
    count: c.holidays.length,
    source: c.source,
    fetchedAt: c.fetchedAt,
    sample: c.holidays.slice(0, 3),
  };
}

module.exports = { getHolidays, refreshHolidays, getHolidayStats };
