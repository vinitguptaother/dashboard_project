// backend/routes/dataHealth.js
// Unified Data Health Panel — shows which broker/API is live, demo values,
// last refresh, token expiry, failed endpoints, and symbol-price conflicts
// across tabs. Read-only, side-effect free.

const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const router = express.Router();

const { apiLogger } = require('../middleware/logger');

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJwtExpiry(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (!payload.exp) return null;
    const expiryMs = payload.exp * 1000;
    const now = Date.now();
    return {
      expiresAt: new Date(expiryMs).toISOString(),
      expired: expiryMs < now,
      msRemaining: expiryMs - now,
      hoursRemaining: Math.floor((expiryMs - now) / (1000 * 60 * 60)),
      daysRemaining: Math.floor((expiryMs - now) / (1000 * 60 * 60 * 24)),
    };
  } catch {
    return null;
  }
}

function maskKey(s) {
  if (!s) return null;
  if (s.length <= 8) return '***';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

// ─── GET /api/data-health/summary ───────────────────────────────────────────
// Main dashboard endpoint — consolidated view of all integrations
router.get('/summary', async (req, res) => {
  try {
    const integrations = [];
    const alerts = [];

    // ── 1. MongoDB ──
    const mongoState = mongoose.connection.readyState; // 0=disconnected 1=connected 2=connecting 3=disconnecting
    integrations.push({
      name: 'MongoDB',
      category: 'database',
      status: mongoState === 1 ? 'live' : mongoState === 2 ? 'degraded' : 'offline',
      details: mongoState === 1
        ? `Connected to ${mongoose.connection.name || 'stock_dashboard'}`
        : mongoState === 2 ? 'Connecting…' : 'Disconnected',
      lastCheck: new Date().toISOString(),
    });
    if (mongoState !== 1) alerts.push({ level: 'error', source: 'MongoDB', message: 'Database not connected — most features will fail' });

    // ── 2. Upstox ──
    const upstoxToken = process.env.UPSTOX_ACCESS_TOKEN;
    if (!upstoxToken || upstoxToken === 'your_access_token_here') {
      integrations.push({
        name: 'Upstox',
        category: 'broker',
        status: 'offline',
        details: 'Access token not configured — live prices disabled, demo data used',
        usingDemoData: true,
        lastCheck: new Date().toISOString(),
      });
      alerts.push({ level: 'warning', source: 'Upstox', message: 'No access token configured — live market data is disabled' });
    } else {
      const expiry = parseJwtExpiry(upstoxToken);
      let status = 'live';
      let details = 'Token valid';
      if (expiry) {
        if (expiry.expired) {
          status = 'offline';
          details = `Token expired ${new Date(expiry.expiresAt).toLocaleDateString()}`;
          alerts.push({ level: 'error', source: 'Upstox', message: `Access token expired — generate a new one` });
        } else if (expiry.hoursRemaining < 24) {
          status = 'degraded';
          details = `Token expires in ${expiry.hoursRemaining}h — renew soon`;
          alerts.push({ level: 'warning', source: 'Upstox', message: `Token expires in ${expiry.hoursRemaining} hours` });
        } else {
          details = `Token valid, expires in ${expiry.daysRemaining} days`;
        }
      }
      integrations.push({
        name: 'Upstox',
        category: 'broker',
        status,
        details,
        tokenMask: maskKey(upstoxToken),
        tokenExpiry: expiry ? expiry.expiresAt : null,
        hoursRemaining: expiry ? expiry.hoursRemaining : null,
        daysRemaining: expiry ? expiry.daysRemaining : null,
        usingDemoData: status === 'offline',
        lastCheck: new Date().toISOString(),
      });
    }

    // ── 3. Perplexity AI ──
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) {
      integrations.push({
        name: 'Perplexity AI',
        category: 'ai',
        status: 'offline',
        details: 'API key not configured — AI features disabled',
        lastCheck: new Date().toISOString(),
      });
      alerts.push({ level: 'warning', source: 'Perplexity', message: 'No API key — AI ranking/analysis disabled' });
    } else {
      integrations.push({
        name: 'Perplexity AI',
        category: 'ai',
        status: 'live',
        details: 'API key configured (live calls on demand)',
        keyMask: maskKey(perplexityKey),
        lastCheck: new Date().toISOString(),
      });
    }

    // ── 4. Yahoo Finance (free, no key needed) ──
    integrations.push({
      name: 'Yahoo Finance',
      category: 'market-data',
      status: 'live',
      details: 'Free tier — used as fallback for index data and chart history',
      lastCheck: new Date().toISOString(),
    });

    // ── 5. Alice Blue (optional broker) ──
    const aliceBlueKey = process.env.ALICE_BLUE_API_KEY || process.env.ALICE_BLUE_USER_ID;
    integrations.push({
      name: 'Alice Blue',
      category: 'broker',
      status: aliceBlueKey ? 'live' : 'offline',
      details: aliceBlueKey ? 'Credentials configured' : 'Not configured (optional)',
      optional: true,
      lastCheck: new Date().toISOString(),
    });

    // ── 6. API call statistics from last hour ──
    let recentCalls = { total: 0, failed: 0, byProvider: {} };
    try {
      if (mongoState === 1) {
        const col = mongoose.connection.db.collection('api_usage_logs');
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const agg = await col.aggregate([
          { $match: { timestamp: { $gte: oneHourAgo } } },
          { $group: {
              _id: { provider: '$provider', success: '$success' },
              count: { $sum: 1 },
          } }
        ]).toArray();
        for (const row of agg) {
          recentCalls.total += row.count;
          if (row._id.success === false) recentCalls.failed += row.count;
          const p = row._id.provider || 'unknown';
          recentCalls.byProvider[p] = (recentCalls.byProvider[p] || { success: 0, failed: 0 });
          if (row._id.success === false) recentCalls.byProvider[p].failed += row.count;
          else recentCalls.byProvider[p].success += row.count;
        }
      }
    } catch { /* ignore */ }

    // ── 7. Failed endpoints from error logs (last 10 minutes) ──
    // We tail the most recent error log for /error|ECONN|ETIMEOUT/ patterns
    let failedEndpoints = [];
    try {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(__dirname, '..', 'logs');
      if (fs.existsSync(logDir)) {
        const files = fs.readdirSync(logDir)
          .filter(f => /^error\d*\.log$/.test(f))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(logDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) {
          const latest = path.join(logDir, files[0].name);
          const size = fs.statSync(latest).size;
          const readFrom = Math.max(0, size - 40 * 1024); // read last 40KB only
          const fd = fs.openSync(latest, 'r');
          const buf = Buffer.alloc(size - readFrom);
          fs.readSync(fd, buf, 0, size - readFrom, readFrom);
          fs.closeSync(fd);
          const tenMinAgo = Date.now() - 10 * 60 * 1000;
          const lines = buf.toString('utf8').split('\n');
          const seen = new Set();
          for (let i = lines.length - 1; i >= 0 && failedEndpoints.length < 5; i--) {
            const line = lines[i];
            if (!line.includes('error') && !line.includes('Error') && !line.includes('ECONN')) continue;
            const tsMatch = line.match(/"timestamp":"([^"]+)"/);
            if (tsMatch && new Date(tsMatch[1]).getTime() < tenMinAgo) break;
            const m = line.match(/"module":"([^"]+)".*?"action":"([^"]+)"/) ||
                      line.match(/"(?:service|route)":"([^"]+)".*?"(?:method|action)":"([^"]+)"/);
            const msgMatch = line.match(/"message":"([^"]{0,120})"/);
            const key = m ? `${m[1]}:${m[2]}` : msgMatch ? msgMatch[1].slice(0, 50) : null;
            if (key && !seen.has(key)) {
              seen.add(key);
              failedEndpoints.push({
                source: m ? m[1] : 'unknown',
                action: m ? m[2] : (msgMatch ? msgMatch[1].slice(0, 80) : 'error'),
                at: tsMatch ? tsMatch[1] : null,
              });
            }
          }
        }
      }
    } catch { /* non-critical */ }

    // ── 8. Freshness — when did caches last refresh? ──
    const aiSvc = require('../services/aiService');
    const marketContextAge = aiSvc.marketContextCacheTime
      ? Math.floor((Date.now() - aiSvc.marketContextCacheTime) / 1000)
      : null;

    const freshness = {
      marketContextAgeSec: marketContextAge,
      marketContextFresh: marketContextAge !== null && marketContextAge < 600,
      serverUptimeSec: Math.floor(process.uptime()),
    };

    // ── 9. Overall system status ──
    const overallStatus =
      integrations.some(i => i.status === 'offline' && !i.optional) ? 'degraded'
      : integrations.some(i => i.status === 'degraded') ? 'degraded'
      : 'healthy';

    apiLogger.info('DataHealth', 'summary', { overall: overallStatus, alertCount: alerts.length });

    res.json({
      status: 'success',
      data: {
        overall: overallStatus,
        integrations,
        alerts,
        freshness,
        recentCalls,
        failedEndpoints,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    apiLogger.error('DataHealth', 'summary', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/data-health/symbol-conflict/:symbol ───────────────────────────
// Fetches the same symbol from multiple sources and flags discrepancies.
// Used to detect "Tab A shows ₹1200, Tab B shows ₹1195" kind of bugs.
router.get('/symbol-conflict/:symbol', async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase().trim();
  if (!symbol) return res.status(400).json({ status: 'error', message: 'Missing symbol' });

  const sources = [];

  // Source 1: Upstox LTP (if configured)
  try {
    const upstoxService = require('../services/upstoxService');
    const r = await upstoxService.fetchStockQuote(symbol);
    if (r && typeof r.price === 'number' && r.price > 0) {
      sources.push({ source: 'upstox', price: parseFloat(r.price.toFixed(2)), at: new Date().toISOString() });
    }
  } catch (e) { sources.push({ source: 'upstox', error: e.message }); }

  // Source 2: Yahoo Finance live
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?interval=1d&range=1d`;
    const r = await axios.get(url, { timeout: 5000 });
    const meta = r.data?.chart?.result?.[0]?.meta;
    if (meta?.regularMarketPrice) {
      sources.push({ source: 'yahoo', price: parseFloat(meta.regularMarketPrice), at: new Date().toISOString() });
    }
  } catch (e) { sources.push({ source: 'yahoo', error: e.message }); }

  // Source 3: Latest TradeSetup snapshot (if any)
  try {
    const TradeSetup = require('../models/TradeSetup');
    const latest = await TradeSetup.findOne({ symbol })
      .sort({ updatedAt: -1 })
      .select('currentPrice updatedAt')
      .lean();
    if (latest && latest.currentPrice) {
      sources.push({
        source: 'trade-setup-cache',
        price: parseFloat(latest.currentPrice),
        at: latest.updatedAt,
      });
    }
  } catch { /* ignore */ }

  // Source 4: Latest ScreenBatch snapshot (ranking-day price)
  try {
    const ScreenBatch = require('../models/ScreenBatch');
    const recent = await ScreenBatch.findOne(
      { 'rankedResults.symbol': symbol },
      { rankedResults: 1, runDate: 1 }
    ).sort({ runDate: -1 }).lean();
    if (recent) {
      const match = recent.rankedResults.find(r => r.symbol === symbol);
      if (match?.lastPrice) {
        sources.push({
          source: 'screen-batch-snapshot',
          price: parseFloat(match.lastPrice),
          at: recent.runDate,
        });
      }
    }
  } catch { /* ignore */ }

  // Detect conflicts: any two prices differing > 1% from the median
  const prices = sources.filter(s => typeof s.price === 'number').map(s => s.price);
  let conflict = null;
  if (prices.length >= 2) {
    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const maxDev = Math.max(...prices.map(p => Math.abs((p - median) / median) * 100));
    if (maxDev > 1.0) {
      conflict = {
        maxDeviationPct: parseFloat(maxDev.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
        severity: maxDev > 5 ? 'high' : maxDev > 2 ? 'medium' : 'low',
      };
    }
  }

  res.json({
    status: 'success',
    data: { symbol, sources, conflict, sourcesCount: sources.length },
  });
});

// ─── GET /api/data-health/conflicts ─────────────────────────────────────────
// Runs conflict detection on the top 10 active paper trades / trade setups.
router.get('/conflicts', async (req, res) => {
  try {
    const TradeSetup = require('../models/TradeSetup');
    const setups = await TradeSetup.find({ status: 'ACTIVE' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('symbol')
      .lean();

    const uniqueSymbols = [...new Set(setups.map(s => s.symbol))];
    const conflicts = [];

    for (const sym of uniqueSymbols) {
      try {
        // Reuse /symbol-conflict logic inline
        const sources = [];
        try {
          const upstoxService = require('../services/upstoxService');
          const r = await upstoxService.fetchStockQuote(sym);
          if (r && typeof r.price === 'number' && r.price > 0) {
            sources.push({ source: 'upstox', price: parseFloat(r.price.toFixed(2)) });
          }
        } catch { /* ignore */ }
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}.NS?interval=1d&range=1d`;
          const r = await axios.get(url, { timeout: 4000 });
          const meta = r.data?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice) {
            sources.push({ source: 'yahoo', price: parseFloat(meta.regularMarketPrice) });
          }
        } catch { /* ignore */ }

        if (sources.length >= 2) {
          const prices = sources.map(s => s.price);
          const sorted = [...prices].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          const maxDev = Math.max(...prices.map(p => Math.abs((p - median) / median) * 100));
          if (maxDev > 1.0) {
            conflicts.push({
              symbol: sym,
              sources,
              maxDeviationPct: parseFloat(maxDev.toFixed(2)),
              severity: maxDev > 5 ? 'high' : maxDev > 2 ? 'medium' : 'low',
            });
          }
        }
      } catch { /* ignore per-symbol errors */ }
    }

    res.json({ status: 'success', data: { checked: uniqueSymbols.length, conflicts } });
  } catch (err) {
    apiLogger.error('DataHealth', 'conflicts', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
