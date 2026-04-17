/**
 * Kill Switches unified API.
 * BOT_BLUEPRINT item #11.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/killSwitchService');

// GET /api/kill-switches/state — unified aggregate view
router.get('/state', async (req, res) => {
  try {
    const data = await svc.getUnifiedState();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/kill-switches/bot-kill  body: { botId, reason? }
router.post('/bot-kill', async (req, res) => {
  try {
    const { botId, reason } = req.body || {};
    if (!botId) return res.status(400).json({ status: 'error', message: 'botId required' });
    const data = await svc.activateBotKill(botId, reason || '');
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/kill-switches/bot-kill/clear  body: { botId, reason? }
router.post('/bot-kill/clear', async (req, res) => {
  try {
    const { botId, reason } = req.body || {};
    if (!botId) return res.status(400).json({ status: 'error', message: 'botId required' });
    const data = await svc.clearBotKill(botId, reason || '');
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/kill-switches/panic  body: { confirmation: "PANIC", reason? }
// Trips daily-loss kill + drawdown lockout + all bot kills.
router.post('/panic', async (req, res) => {
  try {
    const { confirmation, reason } = req.body || {};
    if (confirmation !== 'PANIC') {
      return res.status(400).json({ status: 'error', message: 'confirmation must be "PANIC" — this halts ALL trading.' });
    }
    const data = await svc.panic(reason || 'Panic button pressed');
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/kill-switches/clear-all  body: { confirmation: "UNLOCK", reason? }
// Clears EVERYTHING — dangerous in a bad market. Requires explicit confirmation.
router.post('/clear-all', async (req, res) => {
  try {
    const { confirmation, reason } = req.body || {};
    if (confirmation !== 'UNLOCK') {
      return res.status(400).json({ status: 'error', message: 'confirmation must be "UNLOCK".' });
    }
    const data = await svc.clearAll(reason || 'Manually cleared');
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/kill-switches/history?limit=20
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const rows = await svc.getRecentEvents(limit);
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
