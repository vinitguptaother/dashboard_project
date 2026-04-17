/**
 * Sector Rotation API.
 * BOT_BLUEPRINT item #28.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/sectorRotationService');

// GET /api/sector-rotation/current — latest sector performance snapshot
router.get('/current', async (req, res) => {
  try {
    const current = await svc.getCurrent();
    if (!current) return res.json({ status: 'success', data: null, message: 'No snapshot yet — POST /refresh' });
    res.json({ status: 'success', data: current });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/sector-rotation/history?limit=30
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 500);
    const rows = await svc.getHistory(limit);
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/sector-rotation/refresh — manual recompute
router.post('/refresh', async (req, res) => {
  try {
    const doc = await svc.computeAndStore();
    res.json({ status: 'success', data: doc });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
