/**
 * FII/DII Service — fetches daily institutional flow data.
 *
 * BOT_BLUEPRINT item #26.
 *
 * Strategy:
 *   1) Try NSE's public daily report (has been unstable + 403s historically).
 *   2) Fallback to Moneycontrol's daily FII/DII table (more reliable).
 *   3) If all fail, return most recent cached entry from MongoDB.
 *
 * Values in ₹ crore. Publishes once per market day ~6 PM IST.
 */

const axios = require('axios');
const FiiDiiDaily = require('../models/FiiDiiDaily');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ── Fetcher 1: NSE — requires cookie from homepage, then API works ────────
async function fetchFromNSE() {
  try {
    // Step 1: hit the FII/DII report page to collect cookies (nsit, nseappid)
    const jar = [];
    const homeRes = await axios.get('https://www.nseindia.com/reports/fii-dii', {
      timeout: 10000,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: (s) => s < 500,
    });
    const setCookie = homeRes.headers['set-cookie'] || [];
    for (const c of setCookie) jar.push(c.split(';')[0]);
    const cookieHeader = jar.join('; ');

    // Step 2: call the API with the cookie
    const url = 'https://www.nseindia.com/api/fiidiiTradeReact';
    const res = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com/reports/fii-dii',
        'Cookie': cookieHeader,
      },
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    // NSE rows look like: [{ category: 'FII **', date, buyValue, sellValue, netValue }, ...]
    const fiiRow = rows.find(r => /FII|FPI/i.test(r.category || ''));
    const diiRow = rows.find(r => /DII/i.test(r.category || ''));

    if (!fiiRow || !diiRow) throw new Error('NSE response missing FII or DII rows (got ' + rows.length + ' rows)');

    const date = (fiiRow.date || diiRow.date || '').trim();
    if (!date) throw new Error('NSE response missing date');

    return {
      date: normalizeDate(date),
      sourceDateRaw: date,
      fii: {
        buyValue: parseFloat(fiiRow.buyValue) || 0,
        sellValue: parseFloat(fiiRow.sellValue) || 0,
        netValue: parseFloat(fiiRow.netValue) || 0,
      },
      dii: {
        buyValue: parseFloat(diiRow.buyValue) || 0,
        sellValue: parseFloat(diiRow.sellValue) || 0,
        netValue: parseFloat(diiRow.netValue) || 0,
      },
      source: 'nse',
      publishedAt: new Date(),
    };
  } catch (err) {
    throw new Error(`NSE fetch failed: ${err.message}`);
  }
}

// ── Fetcher 2: Moneycontrol (backup) ───────────────────────────────────────
async function fetchFromMoneycontrol() {
  try {
    // Moneycontrol publishes a JSON API for FII/DII. If it changes we'll need
    // to adapt. For now we try a well-known endpoint.
    const url = 'https://api.moneycontrol.com/mcapi/v1/fii-dii/get-fii-dii-data?deviceType=W';
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    });
    const data = res.data?.data;
    if (!data || !Array.isArray(data) || data.length === 0) throw new Error('Moneycontrol: empty data');

    const latest = data[0]; // usually latest-first
    const dateRaw = latest.date || latest.tradeDate || '';
    const date = normalizeDate(dateRaw);

    return {
      date,
      sourceDateRaw: dateRaw,
      fii: {
        buyValue: parseFloat(latest.fii_gross_purchase || latest.fiiGrossPurchase || 0),
        sellValue: parseFloat(latest.fii_gross_sales || latest.fiiGrossSales || 0),
        netValue: parseFloat(latest.fii_net || latest.fiiNet || 0),
      },
      dii: {
        buyValue: parseFloat(latest.dii_gross_purchase || latest.diiGrossPurchase || 0),
        sellValue: parseFloat(latest.dii_gross_sales || latest.diiGrossSales || 0),
        netValue: parseFloat(latest.dii_net || latest.diiNet || 0),
      },
      source: 'moneycontrol',
      publishedAt: new Date(),
    };
  } catch (err) {
    throw new Error(`Moneycontrol fetch failed: ${err.message}`);
  }
}

// ── Date normalizer: accepts "13-Apr-2026" / "2026-04-13" / "13/04/2026" ───
function normalizeDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const cleaned = String(raw).trim();

  // ISO already? 2026-04-13
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);

  // "13-Apr-2026" or "13 Apr 2026"
  const m1 = cleaned.match(/^(\d{1,2})[-\s](\w{3})[-\s](\d{4})/);
  if (m1) {
    const [, d, monStr, y] = m1;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months.findIndex(mm => mm.toLowerCase() === monStr.toLowerCase());
    if (m >= 0) return `${y}-${String(m+1).padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // "13/04/2026" (DD/MM/YYYY)
  const m2 = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;

  // Fallback: today
  return new Date().toISOString().slice(0, 10);
}

// ── Public: refresh (fetch latest + upsert into DB) ────────────────────────
async function refreshLatest() {
  const errors = [];
  for (const fetcher of [fetchFromNSE, fetchFromMoneycontrol]) {
    try {
      const snap = await fetcher();
      const doc = await FiiDiiDaily.findOneAndUpdate(
        { date: snap.date },
        { $set: snap },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return { ok: true, source: snap.source, doc };
    } catch (err) {
      errors.push(err.message);
    }
  }
  return { ok: false, errors };
}

// ── Public: read latest cached doc (or null) ───────────────────────────────
async function getLatest() {
  return FiiDiiDaily.findOne({}).sort({ date: -1 }).lean();
}

// ── Public: read rolling history ───────────────────────────────────────────
async function getHistory(days = 30) {
  return FiiDiiDaily
    .find({})
    .sort({ date: -1 })
    .limit(days)
    .lean();
}

module.exports = { refreshLatest, getLatest, getHistory };
