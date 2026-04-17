/**
 * Scanner API.
 * BOT_BLUEPRINT item #5.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/scannerService');
const Screen = require('../models/Screen');

// GET /api/scanner/screens — list screens eligible for scanning (has batches)
router.get('/screens', async (req, res) => {
  try {
    const screens = await Screen.find({ status: { $in: ['new', 'active'] } })
      .select('name description status performanceScore avgHitRate avgReturn totalBatches')
      .sort({ performanceScore: -1, name: 1 })
      .lean();
    res.json({ status: 'success', data: screens });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/scanner/scan-screen
// Body: { screenId, botId?, topN?, persistAccepted?, liquidityBand?, risk? }
router.post('/scan-screen', async (req, res) => {
  try {
    const { screenId, botId, topN, persistAccepted, liquidityBand, risk } = req.body || {};
    if (!screenId) return res.status(400).json({ status: 'error', message: 'screenId required' });
    const result = await svc.scanScreen({
      screenId, botId, topN: topN || 5,
      persistAccepted: persistAccepted === true,
      liquidityBand, risk,
    });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/scanner/scan-symbol
// Body: { symbol, lastPrice, botId?, persistAccepted?, sector?, liquidityBand?, risk? }
router.post('/scan-symbol', async (req, res) => {
  try {
    const result = await svc.scanSymbol(req.body || {});
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// GET /api/scanner/recent?limit=20
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const rows = await svc.getRecentScans({ limit });
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
