/**
 * Corporate Actions + Earnings Service — fetches NSE corporate actions
 * (dividends, splits, bonuses, buybacks) + upcoming board meetings
 * (quarterly earnings).
 *
 * BOT_BLUEPRINT item #27.
 *
 * NSE endpoints require cookie flow — hit the HTML page first to collect
 * nsit/nseappid cookies, then call the JSON API with those cookies.
 *
 * Dedup: (symbol, eventDate, kind, subject) is the unique key.
 * Fetch cadence: daily at 7 AM IST (before market open).
 */

const axios = require('axios');
const CorporateEvent = require('../models/CorporateEvent');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getNseCookies(referrerPath) {
  const res = await axios.get(`https://www.nseindia.com${referrerPath}`, {
    timeout: 12000,
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
    validateStatus: (s) => s < 500,
  });
  const setCookie = res.headers['set-cookie'] || [];
  return setCookie.map(c => c.split(';')[0]).join('; ');
}

// NSE date format: "17-Apr-2026"  →  Date
function parseNseDate(s) {
  if (!s || s === '-' || typeof s !== 'string') return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{1,2})-(\w{3})-(\d{4})$/);
  if (m) {
    const parsed = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

// Normalize NSE corporate action row to CorporateEvent
function normalizeAction(row) {
  const subject = (row.subject || '').trim();
  const exDate = parseNseDate(row.exDate);
  if (!exDate) return null;
  return {
    symbol: (row.symbol || '').toUpperCase(),
    company: row.comp || '',
    isin: row.isin || '',
    kind: 'action',
    eventDate: exDate,
    subject: subject || 'Corporate Action',
    rawPurpose: subject,
    recordDate: parseNseDate(row.recDate),
    faceValue: row.faceVal || '',
    series: row.series || '',
    description: '',
    source: 'nse',
  };
}

// Normalize NSE board meeting row to CorporateEvent (earnings = purpose contains "Financial Results")
function normalizeMeeting(row) {
  const purpose = (row.bm_purpose || '').trim();
  const bmDate = parseNseDate(row.bm_date);
  if (!bmDate) return null;
  return {
    symbol: (row.bm_symbol || '').toUpperCase(),
    company: row.sm_name || '',
    isin: row.sm_isin || '',
    kind: 'meeting',
    eventDate: bmDate,
    subject: purpose || 'Board Meeting',
    rawPurpose: purpose,
    recordDate: null,
    faceValue: '',
    series: '',
    description: (row.bm_desc || '').slice(0, 400),
    source: 'nse',
  };
}

async function fetchCorporateActions() {
  const cookie = await getNseCookies('/companies-listing/corporate-filings-actions');
  const url = 'https://www.nseindia.com/api/corporates-corporateActions?index=equities';
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': UA, 'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-actions',
      'Cookie': cookie,
    },
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map(normalizeAction).filter(Boolean);
}

async function fetchBoardMeetings() {
  const cookie = await getNseCookies('/companies-listing/corporate-filings-board-meetings');
  const url = 'https://www.nseindia.com/api/corporate-board-meetings?index=equities';
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': UA, 'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-board-meetings',
      'Cookie': cookie,
    },
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map(normalizeMeeting).filter(Boolean);
}

async function refreshAll() {
  const [actions, meetings] = await Promise.all([
    fetchCorporateActions().catch(e => { console.warn('[corp-actions] actions fetch failed:', e.message); return []; }),
    fetchBoardMeetings().catch(e => { console.warn('[corp-actions] meetings fetch failed:', e.message); return []; }),
  ]);
  const all = [...actions, ...meetings];
  let upserted = 0;
  for (const evt of all) {
    try {
      await CorporateEvent.updateOne(
        { symbol: evt.symbol, eventDate: evt.eventDate, kind: evt.kind, subject: evt.subject },
        { $set: { ...evt, fetchedAt: new Date() } },
        { upsert: true },
      );
      upserted++;
    } catch (err) {
      if (err.code !== 11000) console.warn('[corp-actions] upsert error:', err.message);
    }
  }
  return { fetched: all.length, upserted, actions: actions.length, meetings: meetings.length };
}

async function getUpcoming({ days = 30, kind = null, symbol = null } = {}) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const q = { eventDate: { $gte: now, $lte: end } };
  if (kind) q.kind = kind;
  if (symbol) q.symbol = symbol.toUpperCase();
  return CorporateEvent.find(q).sort({ eventDate: 1, symbol: 1 }).lean();
}

async function getBySymbol(symbol, { limit = 30 } = {}) {
  return CorporateEvent.find({ symbol: (symbol || '').toUpperCase() })
    .sort({ eventDate: -1 })
    .limit(limit)
    .lean();
}

module.exports = { refreshAll, getUpcoming, getBySymbol, fetchCorporateActions, fetchBoardMeetings };
