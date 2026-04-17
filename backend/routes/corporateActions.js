/**
 * Corporate Actions + Earnings Calendar API.
 * BOT_BLUEPRINT item #27.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/corporateActionsService');

// GET /api/corporate-actions/upcoming?days=30&kind=action|meeting&symbol=XXX
router.get('/upcoming', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10), 180);
    const kind = req.query.kind && ['action', 'meeting'].includes(req.query.kind) ? req.query.kind : null;
    const symbol = req.query.symbol || null;
    const rows = await svc.getUpcoming({ days, kind, symbol });
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/corporate-actions/by-symbol/:symbol
router.get('/by-symbol/:symbol', async (req, res) => {
  try {
    const rows = await svc.getBySymbol(req.params.symbol, { limit: 30 });
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/corporate-actions/refresh
router.post('/refresh', async (req, res) => {
  try {
    const result = await svc.refreshAll();
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
