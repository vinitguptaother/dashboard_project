/**
 * Strategy Library API — MASTER_PLAN §7 Phase 3.
 *
 * Endpoints:
 *   GET  /api/strategies                         — list all registered strategies + DB metadata
 *   GET  /api/strategies/:key                    — single strategy detail
 *   GET  /api/strategies/by-bot/:botId           — filter by bot
 *   POST /api/strategies/:key/toggle             — enable/disable flag
 *
 * Strategy logic is code in backend/services/strategies/*.js. This route
 * exposes metadata + stats only; no scan/evaluate calls happen here.
 */

const express = require('express');
const router = express.Router();

const strategies = require('../services/strategies');
const Strategy = require('../models/Strategy');

// ─── Helpers ────────────────────────────────────────────────────────────────

function _meta(s) {
  return {
    key: s.key,
    name: s.name,
    botId: s.botId,
    segment: s.segment,
    regimeCompatibility: s.regimeCompatibility || [],
    description: s.description || '',
    // Phase 5: deep-link into the Portfolio tab's Backtest panel with strategy preselected.
    backtestLink: `/portfolio#backtest?strategy=${encodeURIComponent(s.key)}`,
  };
}

async function _withStats(list) {
  const keys = list.map(s => s.key);
  const dbRows = await Strategy.find({ key: { $in: keys } }).lean();
  const byKey = Object.fromEntries(dbRows.map(r => [r.key, r]));
  return list.map(s => ({
    ..._meta(s),
    stats: byKey[s.key] ? {
      enabled: byKey[s.key].enabled,
      lastRunAt: byKey[s.key].lastRunAt,
      runCount: byKey[s.key].runCount || 0,
      acceptedCount: byKey[s.key].acceptedCount || 0,
      rejectedCount: byKey[s.key].rejectedCount || 0,
      avgReturnPct: byKey[s.key].avgReturnPct,
    } : {
      enabled: true, lastRunAt: null, runCount: 0,
      acceptedCount: 0, rejectedCount: 0, avgReturnPct: null,
    },
  }));
}

// ─── GET /api/strategies ────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const list = strategies.getAllStrategies();
    const data = await _withStats(list);
    res.json({ status: 'success', count: data.length, data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/strategies/by-bot/:botId ──────────────────────────────────────
router.get('/by-bot/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const list = strategies.getStrategiesForBot(botId);
    const data = await _withStats(list);
    res.json({ status: 'success', botId, count: data.length, data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/strategies/:key ───────────────────────────────────────────────
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const s = strategies.getStrategyByKey(key);
    if (!s) return res.status(404).json({ status: 'error', message: `Strategy not found: ${key}` });
    const [withStats] = await _withStats([s]);
    res.json({ status: 'success', data: withStats });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── POST /api/strategies/:key/toggle ───────────────────────────────────────
// Body: { enabled: boolean }
router.post('/:key/toggle', async (req, res) => {
  try {
    const { key } = req.params;
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ status: 'error', message: 'body.enabled (boolean) required' });
    }
    const s = strategies.getStrategyByKey(key);
    if (!s) return res.status(404).json({ status: 'error', message: `Strategy not found: ${key}` });
    const doc = await Strategy.findOneAndUpdate({ key }, { $set: { enabled } }, { new: true }).lean();
    res.json({ status: 'success', data: doc });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
