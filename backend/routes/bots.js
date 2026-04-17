/**
 * Bots API — unified driver for the 4 paper bots.
 * BOT_BLUEPRINT items #1-#4.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/botService');

// GET /api/bots/configs — list all 4 bot configs
router.get('/configs', async (req, res) => {
  try {
    const data = await svc.listBotConfigs();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// PUT /api/bots/configs/:botId  body: { enabled?, screenId?, topN?, liquidityBand?, cronSchedule?, persistAccepted?, risk?, strategyNotes? }
router.put('/configs/:botId', async (req, res) => {
  try {
    const data = await svc.updateBotConfig(req.params.botId, req.body || {});
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/bots/run/:botId — manual trigger (respects kill switches + missing-screen guard)
router.post('/run/:botId', async (req, res) => {
  try {
    const run = await svc.runBot(req.params.botId, { trigger: 'manual' });
    res.json({ status: 'success', data: run });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/bots/runs?botId=swing&limit=20
router.get('/runs', async (req, res) => {
  try {
    const botId = req.query.botId;
    const limit = parseInt(req.query.limit || '20', 10);
    const runs = await svc.getRecentRuns({ botId, limit });
    res.json({ status: 'success', data: runs });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/bots/stats?botId=swing&days=30
router.get('/stats', async (req, res) => {
  try {
    const botId = req.query.botId;
    const days = parseInt(req.query.days || '30', 10);
    const stats = await svc.getBotStats({ botId, days });
    res.json({ status: 'success', data: stats });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
