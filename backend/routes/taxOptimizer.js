/**
 * taxOptimizer.js — Phase 6 deliverable #5.
 *
 * POST /api/tax-optimizer/suggest
 *   body: { symbol, quantity, exitPrice? }
 *   returns: suggested lot order + estimated tax savings vs FIFO
 *
 * GET /api/tax-optimizer/lots/:symbol
 *   returns: all available buy-lots for the symbol (diagnostic)
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/taxLotOptimizerService');

router.post('/suggest', async (req, res) => {
  try {
    const { symbol, quantity, exitPrice } = req.body || {};
    if (!symbol) return res.status(400).json({ status: 'error', message: 'symbol required' });
    if (!quantity) return res.status(400).json({ status: 'error', message: 'quantity required' });
    const result = await svc.suggestExitLots({ symbol, quantity, exitPrice });
    res.json({ status: 'success', data: result });
  } catch (err) {
    console.error('[taxOptimizer] /suggest error:', err.message);
    res.status(400).json({ status: 'error', message: err.message });
  }
});

router.get('/lots/:symbol', async (req, res) => {
  try {
    const lots = await svc.collectLots(req.params.symbol);
    res.json({
      status: 'success',
      count: lots.length,
      totalQty: lots.reduce((s, l) => s + l.quantity, 0),
      data: lots,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
