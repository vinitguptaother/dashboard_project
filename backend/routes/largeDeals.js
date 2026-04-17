/**
 * Large Deals (bulk / block / short) API.
 * BOT_BLUEPRINT item #29.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/largeDealsService');

// GET /api/large-deals/recent?days=5&kind=bulk|block|short&symbol=XXX&minValueCr=5
router.get('/recent', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '5', 10), 30);
    const kind = req.query.kind && ['bulk', 'block', 'short'].includes(req.query.kind) ? req.query.kind : null;
    const symbol = req.query.symbol || null;
    const minValueCr = parseFloat(req.query.minValueCr || '0') || 0;
    const rows = await svc.getRecent({ days, kind, symbol, minValueCr });
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/large-deals/by-symbol/:symbol
router.get('/by-symbol/:symbol', async (req, res) => {
  try {
    const rows = await svc.getBySymbol(req.params.symbol, { limit: 50 });
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/large-deals/refresh
router.post('/refresh', async (req, res) => {
  try {
    const result = await svc.refreshAll();
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
