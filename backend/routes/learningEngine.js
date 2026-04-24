/**
 * Learning Engine API — BOT_BLUEPRINT #12, MASTER_PLAN §7 Phase 4.
 *
 * Routes:
 *   GET  /api/learning/performance?botId=swing&strategyKey=...&regime=...&windowDays=30
 *   GET  /api/learning/bayesian?wins=N&losses=M
 *   POST /api/learning/run-cycle    — manual trigger of nightly cycle
 *   GET  /api/learning/snapshots?botId=... — list stored BotPerformance slices
 */

const express = require('express');
const router = express.Router();

const learningEngineService = require('../services/learningEngineService');
const BotPerformance = require('../models/BotPerformance');

// ─── GET /api/learning/performance ──────────────────────────────────────────
router.get('/performance', async (req, res) => {
  try {
    const { botId, strategyKey = '', regime = '', windowDays = 30 } = req.query;
    if (!botId) {
      return res.status(400).json({ status: 'error', message: 'botId query param is required' });
    }
    const stats = await learningEngineService.computeBotPerformance({
      botId,
      strategyKey: String(strategyKey || ''),
      regime: String(regime || ''),
      windowDays: Math.max(1, parseInt(windowDays, 10) || 30),
    });
    return res.json({ status: 'success', data: stats });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/learning/bayesian ─────────────────────────────────────────────
router.get('/bayesian', (req, res) => {
  try {
    const wins = parseInt(req.query.wins, 10);
    const losses = parseInt(req.query.losses, 10);
    if (!Number.isInteger(wins) || !Number.isInteger(losses) || wins < 0 || losses < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'wins and losses must be non-negative integers',
      });
    }
    const ci = learningEngineService.getBayesianWinRate(wins, losses);
    return res.json({
      status: 'success',
      data: {
        wins,
        losses,
        ...ci,
        note: 'Beta(wins+1, losses+1) normal-approximation 95% credible interval.',
      },
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── POST /api/learning/run-cycle ───────────────────────────────────────────
router.post('/run-cycle', async (req, res) => {
  try {
    const result = await learningEngineService.runNightlyLearningCycle();
    return res.json({ status: 'success', data: result });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/learning/snapshots ────────────────────────────────────────────
router.get('/snapshots', async (req, res) => {
  try {
    const { botId = '', windowDays } = req.query;
    const q = {};
    if (botId) q.botId = String(botId);
    if (windowDays) q.windowDays = parseInt(windowDays, 10);
    const rows = await BotPerformance.find(q).sort({ computedAt: -1 }).limit(100).lean();
    return res.json({ status: 'success', count: rows.length, data: rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
