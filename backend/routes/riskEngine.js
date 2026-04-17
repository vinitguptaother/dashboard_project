/**
 * Risk Engine API.
 * BOT_BLUEPRINT item #10.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/riskEngineService');
const RiskSettings = require('../models/RiskSettings');

// GET /api/risk-engine/portfolio-state
router.get('/portfolio-state', async (req, res) => {
  try {
    const data = await svc.getPortfolioState();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/risk-engine/drawdown
router.get('/drawdown', async (req, res) => {
  try {
    const data = await svc.getDrawdownState();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/risk-engine/sector-exposure
router.get('/sector-exposure', async (req, res) => {
  try {
    const data = await svc.getSectorExposure();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/risk-engine/bot-capital
router.get('/bot-capital', async (req, res) => {
  try {
    const data = await svc.getBotCapital();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/risk-engine/evaluate  — unified gate
// Body: { botId?, symbol, action, qty, entryPrice, stopLoss, sector? }
router.post('/evaluate', async (req, res) => {
  try {
    const data = await svc.evaluateTrade(req.body || {});
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/risk-engine/snapshot  — manual compute (normally cron-driven)
router.post('/snapshot', async (req, res) => {
  try {
    const data = await svc.computeSnapshot({ persist: true });
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/risk-engine/drawdown-lockout/clear — manual reset (like kill switch override)
router.post('/drawdown-lockout/clear', async (req, res) => {
  try {
    const { confirmation } = req.body || {};
    if (confirmation !== 'UNLOCK') {
      return res.status(400).json({ status: 'error', message: 'confirmation must be "UNLOCK"' });
    }
    await RiskSettings.findOneAndUpdate(
      { userId: 'default' },
      { $set: { drawdownLockoutActive: false, drawdownLockoutTriggeredAt: null } },
      { upsert: true },
    );
    res.json({ status: 'success', message: 'Drawdown lockout cleared.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
