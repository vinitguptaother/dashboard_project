/**
 * Participant-wise OI API — FII/DII/Client/Pro long-short ratios from NSE.
 *
 * Phase 2 Track A, Edge Signal #1.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/participantOIService');

// GET /api/participant-oi/latest — latest single day
router.get('/latest', async (req, res) => {
  try {
    const latest = await svc.getLatest();
    if (!latest) return res.json({ status: 'success', data: null, message: 'No participant OI data cached yet. POST /refresh first.' });
    res.json({ status: 'success', data: latest });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/participant-oi/history?days=30
router.get('/history', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);
    const rows = await svc.getHistory(days);
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/participant-oi/refresh — manual fetch
router.post('/refresh', async (req, res) => {
  try {
    const result = await svc.refreshLatest();
    res.json({ status: result.ok ? 'success' : 'error', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
