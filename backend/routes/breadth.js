/**
 * Market Breadth API — advance/decline + 52w high count for NIFTY 50.
 *
 * Phase 2 Track A, Edge Signal #2.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/breadthService');

// GET /api/breadth/current — live breadth (5 min cache)
router.get('/current', async (req, res) => {
  try {
    const force = req.query.force === '1';
    const data = await svc.getMarketBreadth({ force });
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/breadth/history?limit=50 — historical snapshots from DB
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
    const rows = await svc.getHistory(limit);
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/breadth/snapshot — manual store (normally cron triggers this)
router.post('/snapshot', async (req, res) => {
  try {
    const doc = await svc.snapshotAndStore();
    res.json({ status: 'success', data: doc });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
