/**
 * Participant-wise Open Interest Service.
 *
 * Phase 2 Track A, Edge Signal #1.
 *
 * Scrapes NSE's daily Participant-wise OI report (EOD) and computes
 * long/short ratios for Clients, FII futures, FII options, DIIs, and Pro
 * traders. This is the single most actionable derivatives positioning
 * signal in the Indian market.
 *
 * Data sources attempted (in order):
 *   1. NSE snapshot-derivatives-equity API (probe + adapt).
 *   2. NSE fao_participant_wise_oi CSV endpoint (legacy, still works
 *      sometimes).
 *
 * If NSE blocks all endpoints, the refresh returns a clean error — we do
 * NOT fake data.
 *
 * Cookie flow: identical pattern to fiiDiiService — hit an NSE html page
 * first to warm cookies, then call the JSON/CSV endpoint with those
 * cookies in the header.
 */

const axios = require('axios');
const ParticipantOI = require('../models/ParticipantOI');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── Helper: warm NSE cookies (copy-paste of the fiiDiiService pattern) ─────
async function getNseCookies(seedPage = 'https://www.nseindia.com/all-reports-derivatives') {
  const jar = [];
  try {
    const res = await axios.get(seedPage, {
      timeout: 10000,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: (s) => s < 500,
    });
    const setCookie = res.headers['set-cookie'] || [];
    for (const c of setCookie) jar.push(c.split(';')[0]);
  } catch (err) {
    // intentional: cookie warm-up failure → downstream call will fail too
  }
  return jar.join('; ');
}

// ─── Fetcher 1: NSE JSON snapshot endpoint ──────────────────────────────────
async function fetchFromSnapshotAPI() {
  const cookieHeader = await getNseCookies('https://www.nseindia.com/all-reports-derivatives');
  if (!cookieHeader) throw new Error('NSE cookie warm-up returned empty jar');

  const url = 'https://www.nseindia.com/api/snapshot-derivatives-equity?index=nse_fii_dii_der_stats';
  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/all-reports-derivatives',
      'Cookie': cookieHeader,
    },
    validateStatus: (s) => s < 500,
  });

  if (res.status !== 200) throw new Error(`snapshot API returned HTTP ${res.status}`);

  const data = res.data;
  // The NSE snapshot schema can vary — we probe a few common shapes:
  //   { data: [ { date, participant, ... } ] }
  //   { records: [...] }
  //   { fii_dii_der_stats: { data: [...] } }
  const rows = data?.data || data?.records || data?.fii_dii_der_stats?.data || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`snapshot API returned unexpected shape (keys=${Object.keys(data || {}).join(',')})`);
  }

  return parseParticipantRows(rows, 'nse-snapshot', data);
}

// ─── Fetcher 2: NSE CSV fallback (fao_participant_wise_oi) ──────────────────
async function fetchFromCSV() {
  const cookieHeader = await getNseCookies('https://www.nseindia.com/all-reports-derivatives');
  if (!cookieHeader) throw new Error('NSE cookie warm-up returned empty jar');

  // Today in DDMMYYYY for the filename
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const url = `https://archives.nseindia.com/content/nsccl/fao_participant_oi_${dd}${mm}${yyyy}.csv`;

  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      'User-Agent': UA,
      'Accept': 'text/csv, text/plain, */*',
      'Referer': 'https://www.nseindia.com/all-reports-derivatives',
      'Cookie': cookieHeader,
    },
    validateStatus: (s) => s < 500,
  });

  if (res.status !== 200) throw new Error(`CSV endpoint returned HTTP ${res.status} (likely EOD file not yet published or blocked)`);
  if (typeof res.data !== 'string' || res.data.length < 50) throw new Error('CSV response empty/tiny');

  const rows = parseCSV(res.data);
  if (rows.length === 0) throw new Error('CSV parsed 0 rows');
  return parseParticipantRows(rows, 'nse-csv', { csv: res.data.slice(0, 2000) });
}

// ─── CSV parser — tolerant to NSE's two-header-line format ──────────────────
function parseCSV(text) {
  // NSE CSV typically looks like:
  // "Date: 25-Apr-2026"
  // ,Future Index Long,Future Index Short,Option Index Call Long,...
  // Client,...
  // FII,...
  // DII,...
  // Pro,...
  // We skip any row with fewer than 3 numeric-ish cells, and find the header row by matching "Future" or "Long".
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/Future|Option/i.test(lines[i]) && /Long/i.test(lines[i])) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];
  const header = splitCSVLine(lines[headerIdx]).map(h => h.trim());
  const out = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    if (cells.length < header.length / 2) continue;
    const row = {};
    for (let j = 0; j < header.length; j++) row[header[j] || `col${j}`] = (cells[j] || '').trim();
    out.push(row);
  }
  return out;
}

function splitCSVLine(line) {
  // Very simple — handles quoted commas (which NSE rarely uses here).
  const out = [];
  let cur = '';
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

// ─── Parser: map raw NSE rows → our schema ──────────────────────────────────
function parseParticipantRows(rows, source, rawPayload) {
  // Find row for each participant category (case-insensitive substring match).
  const find = (pattern) => rows.find(r => {
    const firstVal = r['Client Type'] || r.clientType || r.client_type || r.category || r.type || r.participant || Object.values(r)[0] || '';
    return new RegExp(pattern, 'i').test(String(firstVal));
  });

  const clientRow = find('^\\s*Client');
  const fiiRow    = find('^\\s*FII|^\\s*FPI');
  const diiRow    = find('^\\s*DII');
  const proRow    = find('^\\s*Pro');

  if (!clientRow && !fiiRow && !diiRow && !proRow) {
    throw new Error(`parser found no participant rows (source=${source}, rowCount=${rows.length})`);
  }

  // Figure out long/short columns. NSE uses verbose headers; we probe.
  const getLong = (row, kind) => {
    if (!row) return 0;
    for (const [k, v] of Object.entries(row)) {
      if (new RegExp(`${kind}.*Long`, 'i').test(k)) return parseFloat(String(v).replace(/,/g, '')) || 0;
    }
    return 0;
  };
  const getShort = (row, kind) => {
    if (!row) return 0;
    for (const [k, v] of Object.entries(row)) {
      if (new RegExp(`${kind}.*Short`, 'i').test(k)) return parseFloat(String(v).replace(/,/g, '')) || 0;
    }
    return 0;
  };

  const ratio = (long, short) => {
    if (!short || short <= 0) return 0;
    return parseFloat((long / short).toFixed(3));
  };

  // For each participant, prefer "Future Index" long/short for futures ratio,
  // and sum of Call-Long + Put-Short vs Call-Short + Put-Long for options.
  // (standard options long/short bias convention in Indian derivatives.)
  const futuresLongShort = (row) => ratio(getLong(row, 'Future'), getShort(row, 'Future'));

  const optionsLongShort = (row) => {
    if (!row) return 0;
    const callLong  = getLong(row, 'Option.*Call|Call');
    const putShort  = getShort(row, 'Option.*Put|Put');
    const callShort = getShort(row, 'Option.*Call|Call');
    const putLong   = getLong(row, 'Option.*Put|Put');
    const long = callLong + putShort;   // bullish exposure
    const short = callShort + putLong;  // bearish exposure
    if (!short || short <= 0) return 0;
    return parseFloat((long / short).toFixed(3));
  };

  // Date extraction — NSE sometimes puts date in a row header like "Date: 25-Apr-2026"
  let dateRaw = '';
  if (rawPayload?.csv) {
    const m = rawPayload.csv.match(/(\d{1,2}[-\/\s]\w{3}[-\/\s]\d{4})|(\d{4}-\d{2}-\d{2})/);
    if (m) dateRaw = m[0];
  }
  const date = normalizeDate(dateRaw);

  return {
    date,
    sourceDateRaw: dateRaw,
    client_long_short_ratio: futuresLongShort(clientRow),
    fii_long_short_ratio_futures: futuresLongShort(fiiRow),
    fii_long_short_ratio_options: optionsLongShort(fiiRow),
    dii_long_short_ratio: futuresLongShort(diiRow),
    pro_long_short_ratio: futuresLongShort(proRow),
    source,
    raw: { rowCount: rows.length, first: rows[0] || null, last: rows[rows.length - 1] || null },
    publishedAt: new Date(),
  };
}

function normalizeDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const cleaned = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);
  const m1 = cleaned.match(/^(\d{1,2})[-\s\/](\w{3})[-\s\/](\d{4})/);
  if (m1) {
    const [, d, monStr, y] = m1;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months.findIndex(mm => mm.toLowerCase() === monStr.toLowerCase());
    if (m >= 0) return `${y}-${String(m+1).padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  const m2 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  return new Date().toISOString().slice(0, 10);
}

// ─── Public: refresh ────────────────────────────────────────────────────────
async function refreshLatest() {
  const errors = [];
  for (const fetcher of [fetchFromSnapshotAPI, fetchFromCSV]) {
    try {
      const snap = await fetcher();
      const doc = await ParticipantOI.findOneAndUpdate(
        { date: snap.date },
        { $set: snap },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return { ok: true, source: snap.source, doc };
    } catch (err) {
      errors.push(`${fetcher.name}: ${err.message}`);
    }
  }
  return { ok: false, errors };
}

async function getLatest() {
  return ParticipantOI.findOne({}).sort({ date: -1 }).lean();
}

async function getHistory(days = 30) {
  return ParticipantOI.find({}).sort({ date: -1 }).limit(Math.min(days, 365)).lean();
}

module.exports = { refreshLatest, getLatest, getHistory, getNseCookies };
