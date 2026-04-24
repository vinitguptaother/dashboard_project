/**
 * Patterns API — S/R + ATR derived from real Upstox candles.
 * Phase 1 Track A.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/patternService');

// GET /api/patterns/levels/:symbol?lastPrice=X
router.get('/levels/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ status: 'error', message: 'symbol required' });
    const lastPriceRaw = req.query.lastPrice;
    const lastPrice = lastPriceRaw != null ? parseFloat(lastPriceRaw) : null;
    const data = await svc.getLevelsForSymbol(symbol, lastPrice);
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/patterns/candles/:symbol?days=60
router.get('/candles/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ status: 'error', message: 'symbol required' });
    const days = Math.max(20, Math.min(parseInt(req.query.days || '60', 10), 500));
    const candles = await svc.getDailyCloses(symbol, days);
    res.json({ status: 'success', data: candles, count: candles.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
