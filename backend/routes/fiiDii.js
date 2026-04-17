/**
 * FII/DII API — daily institutional flows + rolling history.
 *
 * BOT_BLUEPRINT item #26.
 */

const express = require('express');
const router = express.Router();
const fiiDiiService = require('../services/fiiDiiService');

// GET /api/fii-dii/latest — latest single day
router.get('/latest', async (req, res) => {
  try {
    const latest = await fiiDiiService.getLatest();
    if (!latest) return res.json({ status: 'success', data: null, message: 'No FII/DII data cached yet. Call /refresh first.' });
    res.json({ status: 'success', data: latest });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/fii-dii/history?days=30
router.get('/history', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);
    const rows = await fiiDiiService.getHistory(days);
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/fii-dii/refresh — manual fetch from sources (normally called by cron)
router.post('/refresh', async (req, res) => {
  try {
    const result = await fiiDiiService.refreshLatest();
    res.json({ status: result.ok ? 'success' : 'error', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
