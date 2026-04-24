/**
 * GIFT Nifty API — pre-market gap predictor for NIFTY.
 *
 * Phase 2 Track A, Edge Signal #3.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/giftNiftyService');

// GET /api/gift-nifty/current — predict today's opening gap (5 min cache)
router.get('/current', async (req, res) => {
  try {
    const data = await svc.predictOpenGap();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
