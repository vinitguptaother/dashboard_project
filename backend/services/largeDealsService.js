/**
 * Large Deals Service — fetches NSE bulk / block / short deal snapshots.
 *
 * BOT_BLUEPRINT item #29.
 *
 * NSE exposes a single snapshot endpoint with three arrays:
 *   /api/snapshot-capital-market-largedeal
 *     → BULK_DEALS_DATA, BLOCK_DEALS_DATA, SHORT_DEALS_DATA
 *
 * Refreshed once per market day at 6 PM IST (after EOD publication).
 * Same NSE cookie flow as FII/DII + Corporate Actions.
 */

const axios = require('axios');
const LargeDeal = require('../models/LargeDeal');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getNseCookies() {
  const res = await axios.get('https://www.nseindia.com/market-data/large-deals', {
    timeout: 12000,
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    validateStatus: (s) => s < 500,
  });
  const setCookie = res.headers['set-cookie'] || [];
  return setCookie.map(c => c.split(';')[0]).join('; ');
}

function parseNseDate(s) {
  if (!s || s === '-' || typeof s !== 'string') return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{1,2})-(\w{3})-(\d{4})$/);
  if (m) {
    const p = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
    return isNaN(p.getTime()) ? null : p;
  }
  return null;
}

function toNum(v) {
  if (v == null || v === '' || v === '-') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function normalizeBulkOrBlock(row, kind) {
  const date = parseNseDate(row.date);
  if (!date) return null;
  const qty = toNum(row.qty);
  const watp = toNum(row.watp);
  return {
    dealDate: date,
    symbol: (row.symbol || '').toUpperCase(),
    company: row.name || '',
    kind,
    clientName: row.clientName || '',
    buySell: (row.buySell || '').toUpperCase() === 'BUY' ? 'BUY' : (row.buySell || '').toUpperCase() === 'SELL' ? 'SELL' : '',
    qty,
    watp,
    valueCr: parseFloat(((qty * watp) / 1e7).toFixed(4)),
    remarks: row.remarks || '',
    source: 'nse',
  };
}

function normalizeShort(row) {
  const date = parseNseDate(row.date);
  if (!date) return null;
  const qty = toNum(row.qty);
  const watp = toNum(row.watp);
  return {
    dealDate: date,
    symbol: (row.symbol || '').toUpperCase(),
    company: row.name || '',
    kind: 'short',
    clientName: '',
    buySell: '',
    qty,
    watp,
    valueCr: parseFloat(((qty * watp) / 1e7).toFixed(4)),
    remarks: row.remarks || '',
    source: 'nse',
  };
}

async function refreshAll() {
  const cookie = await getNseCookies();
  const url = 'https://www.nseindia.com/api/snapshot-capital-market-largedeal';
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': UA, 'Accept': 'application/json',
      'Referer': 'https://www.nseindia.com/market-data/large-deals',
      'Cookie': cookie,
    },
  });
  const data = res.data || {};
  const bulk  = (data.BULK_DEALS_DATA  || []).map(r => normalizeBulkOrBlock(r, 'bulk')).filter(Boolean);
  const block = (data.BLOCK_DEALS_DATA || []).map(r => normalizeBulkOrBlock(r, 'block')).filter(Boolean);
  const short = (data.SHORT_DEALS_DATA || []).map(normalizeShort).filter(Boolean);
  const all = [...bulk, ...block, ...short];

  let upserted = 0;
  for (const d of all) {
    try {
      await LargeDeal.updateOne(
        { dealDate: d.dealDate, symbol: d.symbol, kind: d.kind, clientName: d.clientName, buySell: d.buySell, qty: d.qty },
        { $set: { ...d, fetchedAt: new Date() } },
        { upsert: true },
      );
      upserted++;
    } catch (err) {
      if (err.code !== 11000) console.warn('[large-deals] upsert error:', err.message);
    }
  }
  return { fetched: all.length, upserted, bulk: bulk.length, block: block.length, short: short.length, asOn: data.as_on_date || '' };
}

async function getRecent({ days = 5, kind = null, symbol = null, minValueCr = 0 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const q = { dealDate: { $gte: since } };
  if (kind) q.kind = kind;
  if (symbol) q.symbol = symbol.toUpperCase();
  if (minValueCr > 0) q.valueCr = { $gte: minValueCr };
  return LargeDeal.find(q).sort({ dealDate: -1, valueCr: -1 }).limit(500).lean();
}

async function getBySymbol(symbol, { limit = 50 } = {}) {
  return LargeDeal.find({ symbol: (symbol || '').toUpperCase() })
    .sort({ dealDate: -1 })
    .limit(limit)
    .lean();
}

module.exports = { refreshAll, getRecent, getBySymbol };
