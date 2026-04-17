/**
 * Paper Realism API — cost + slippage preview for UI.
 * BOT_BLUEPRINT item #9.
 */

const express = require('express');
const router = express.Router();
const realism = require('../services/paperRealismService');

// POST /api/paper-realism/preview
// Body: { segment, entrySide, qty, entryPrice, stopLoss, target, liquidityBand? }
// Returns full preview: slippage-adjusted fills, costs per leg, net P&L at target + stop, break-even.
router.post('/preview', async (req, res) => {
  try {
    const { segment, entrySide, qty, entryPrice, stopLoss, target, liquidityBand } = req.body || {};
    if (!segment || !entrySide || !qty || !entryPrice || !stopLoss || !target) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: segment, entrySide, qty, entryPrice, stopLoss, target',
      });
    }
    const preview = realism.previewTrade({
      segment, entrySide, qty: parseFloat(qty),
      entryPrice: parseFloat(entryPrice),
      stopLoss: parseFloat(stopLoss),
      target: parseFloat(target),
      liquidityBand: liquidityBand || 'MID',
    });
    res.json({ status: 'success', data: preview });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/paper-realism/constants — what the cost table looks like right now.
// Useful for a Settings page to verify rates.
router.get('/constants', (req, res) => {
  res.json({
    status: 'success',
    data: {
      costs: realism.COSTS,
      slippageBps: realism.SLIPPAGE_BPS,
      latency: realism.LATENCY,
    },
  });
});

module.exports = router;
