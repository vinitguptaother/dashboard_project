/**
 * Market Regime API.
 * BOT_BLUEPRINT item #30.
 */

const express = require('express');
const router = express.Router();
const regimeService = require('../services/regimeService');

// GET /api/regime/current — latest classified regime
router.get('/current', async (req, res) => {
  try {
    const current = await regimeService.getCurrent();
    if (!current) return res.json({ status: 'success', data: null, message: 'No regime computed yet — hit /refresh' });
    res.json({ status: 'success', data: current });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/regime/history?limit=50
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
    const rows = await regimeService.getHistory(limit);
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/regime/refresh — manual recompute
router.post('/refresh', async (req, res) => {
  try {
    const doc = await regimeService.computeAndStore();
    res.json({ status: 'success', data: doc });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Phase 5: HMM endpoints ─────────────────────────────────────────────
// GET /api/regime/hmm — HMM-only classification (read-only, doesn't write MarketRegime)
router.get('/hmm', async (_req, res) => {
  try {
    const data = await regimeService.classifyWithHMM();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/regime/hmm/fit — force re-fit (weekly cron normally handles this)
router.post('/hmm/fit', async (req, res) => {
  try {
    const hmm = require('../services/hmmRegimeService');
    const result = await hmm.fitModel({ days: req.body?.days || 1260 });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/regime/compare-classifiers — rule vs HMM side-by-side
router.get('/compare-classifiers', async (_req, res) => {
  try {
    const data = await regimeService.compareClassifiers();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
