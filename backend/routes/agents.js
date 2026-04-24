/**
 * AI Agents API — MASTER_PLAN §3-4.
 *
 * Endpoints:
 *   POST /api/agents/market-scout/run          — manual trigger, returns full output
 *   POST /api/agents/smart-money-tracker/run   — weekly Sunday agent (manual trigger)
 *   POST /api/agents/sentiment-watcher/run     — hourly market-hours agent (manual trigger)
 *   GET  /api/agents/usage?days=30             — LLMUsage aggregates (cost visibility)
 *   GET  /api/agents/memory/:agentKey          — dump AgentMemory for debugging
 *
 * NO cron scheduling — manual trigger only for now (Phase 1-2 Track B).
 */

const express = require('express');
const router = express.Router();

const LLMUsage = require('../models/LLMUsage');
const AgentMemory = require('../models/AgentMemory');

// Agent singletons (each file exports a ready-to-use instance)
const marketScout = require('../services/agents/marketScout');
const smartMoneyTracker = require('../services/agents/smartMoneyTracker');
const sentimentWatcher = require('../services/agents/sentimentWatcher');

// Generic runner — keeps all agent endpoints identical in shape
async function runAgent(agent, agentKey, res) {
  try {
    const result = await agent.run();
    // partial = Perplexity-half worked, Claude-half failed (still HTTP 200, flagged)
    const statusCode = result.success ? 200 : (result.partial ? 200 : 500);
    return res.status(statusCode).json({
      status: result.success ? 'success' : (result.partial ? 'partial' : 'error'),
      agent: agentKey,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      agent: agentKey,
      message: err.message,
    });
  }
}

// ─── POST /api/agents/market-scout/run ──────────────────────────────────────
router.post('/market-scout/run', (req, res) => runAgent(marketScout, 'market-scout', res));

// ─── POST /api/agents/smart-money-tracker/run ───────────────────────────────
router.post('/smart-money-tracker/run', (req, res) => runAgent(smartMoneyTracker, 'smart-money-tracker', res));

// ─── POST /api/agents/sentiment-watcher/run ─────────────────────────────────
router.post('/sentiment-watcher/run', (req, res) => runAgent(sentimentWatcher, 'sentiment-watcher', res));

// ─── GET /api/agents/usage ──────────────────────────────────────────────────
/**
 * Returns:
 *   totals: { totalCostUSD, totalTokensIn, totalTokensOut, callCount }
 *   byProvider: [{ provider, callCount, costUSD, tokensIn, tokensOut }]
 *   byAgent: [{ agentId, callCount, costUSD }]
 *   recent: last 20 calls
 */
router.get('/usage', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const matchStage = { at: { $gte: sinceDate } };

    const [totalsAgg, byProviderAgg, byAgentAgg, recent] = await Promise.all([
      LLMUsage.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalCostUSD: { $sum: '$costUSD' },
            totalTokensIn: { $sum: '$tokensIn' },
            totalTokensOut: { $sum: '$tokensOut' },
            callCount: { $sum: 1 },
            failureCount: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
          },
        },
      ]),
      LLMUsage.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$provider',
            callCount: { $sum: 1 },
            costUSD: { $sum: '$costUSD' },
            tokensIn: { $sum: '$tokensIn' },
            tokensOut: { $sum: '$tokensOut' },
          },
        },
        { $sort: { costUSD: -1 } },
      ]),
      LLMUsage.aggregate([
        { $match: { ...matchStage, agentId: { $ne: '' } } },
        {
          $group: {
            _id: '$agentId',
            callCount: { $sum: 1 },
            costUSD: { $sum: '$costUSD' },
          },
        },
        { $sort: { costUSD: -1 } },
      ]),
      LLMUsage.find(matchStage).sort({ at: -1 }).limit(20).lean(),
    ]);

    const totals = totalsAgg[0] || {
      totalCostUSD: 0, totalTokensIn: 0, totalTokensOut: 0, callCount: 0, failureCount: 0,
    };

    return res.json({
      status: 'success',
      data: {
        windowDays: days,
        since: sinceDate.toISOString(),
        totals: {
          ...totals,
          totalCostUSD: +(totals.totalCostUSD || 0).toFixed(4),
        },
        byProvider: byProviderAgg.map(p => ({
          provider: p._id,
          callCount: p.callCount,
          costUSD: +(p.costUSD || 0).toFixed(4),
          tokensIn: p.tokensIn,
          tokensOut: p.tokensOut,
        })),
        byAgent: byAgentAgg.map(a => ({
          agentId: a._id,
          callCount: a.callCount,
          costUSD: +(a.costUSD || 0).toFixed(4),
        })),
        recent,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/agents/memory/:agentKey ───────────────────────────────────────
router.get('/memory/:agentKey', async (req, res) => {
  try {
    const { agentKey } = req.params;
    if (!agentKey) {
      return res.status(400).json({ status: 'error', message: 'agentKey is required' });
    }
    const doc = await AgentMemory.findOne({ agentKey }).lean();
    if (!doc) {
      return res.json({
        status: 'success',
        data: { agentKey, stores: {}, lastUpdated: null, _exists: false },
      });
    }
    return res.json({ status: 'success', data: { ...doc, _exists: true } });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
