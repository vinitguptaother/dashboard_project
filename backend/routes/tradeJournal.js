/**
 * Trade Journal API — BOT_BLUEPRINT items #17 (Auto Journal) + #18 (Mistake Tagging)
 *
 * Endpoints:
 *   POST /api/trade-journal/entry         — create entry (called on trade close)
 *   GET  /api/trade-journal/list          — list with filters
 *   GET  /api/trade-journal/mistake-stats — rupee attribution per mistake category
 *   GET  /api/trade-journal/:id           — single entry
 *
 * Phase 1 (this):
 *   - Manual creation (called from trade-close flow in frontend)
 *   - Market context enrichment is thin: VIX + regime from cache if available
 * Phase 2 (later):
 *   - Auto-pull FII/DII, sector performance, chart screenshots
 *   - Auto-link from options trade PUT endpoint
 */

const express = require('express');
const router = express.Router();
const TradeJournalEntry = require('../models/TradeJournalEntry');

// POST /api/trade-journal/entry
// Body: { tradeType, tradeId, checklistId?, underlying, symbol, strategyName,
//         side, entryPrice, exitPrice, entryAt?, exitAt?, qty, pnl,
//         mistakeTag, notes, lessonLearned, source?, context? }
router.post('/entry', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.mistakeTag) {
      return res.status(400).json({
        status: 'error',
        message: 'mistakeTag is required (use "clean" if no mistakes)',
      });
    }

    // Compute holding period hours if both timestamps provided
    let holdingPeriodHours = 0;
    if (body.entryAt && body.exitAt) {
      const start = new Date(body.entryAt).getTime();
      const end = new Date(body.exitAt).getTime();
      if (start && end && end > start) {
        holdingPeriodHours = parseFloat(((end - start) / 3_600_000).toFixed(2));
      }
    }

    // Minimal market context enrichment (Phase 1 — no external calls)
    const context = body.context || {};
    try {
      const MarketData = require('../models/MarketData');
      // Best-effort: grab latest NIFTY snapshot for niftyLevel
      const nifty = await MarketData.findOne({ symbol: 'NIFTY' }).sort({ timestamp: -1 }).lean();
      if (nifty && !context.niftyLevel) context.niftyLevel = nifty.price || nifty.lastPrice || 0;
    } catch (_) { /* optional */ }
    context.capturedAt = new Date();

    const doc = await TradeJournalEntry.create({
      tradeType: body.tradeType || '',
      tradeId: body.tradeId || '',
      checklistId: body.checklistId || '',
      underlying: body.underlying || '',
      symbol: body.symbol || '',
      strategyName: body.strategyName || '',
      side: body.side || '',
      entryPrice: body.entryPrice || 0,
      exitPrice: body.exitPrice || 0,
      entryAt: body.entryAt ? new Date(body.entryAt) : null,
      exitAt: body.exitAt ? new Date(body.exitAt) : new Date(),
      qty: body.qty || 0,
      pnl: body.pnl || 0,
      holdingPeriodHours,
      context,
      mistakeTag: body.mistakeTag,
      notes: body.notes || '',
      lessonLearned: body.lessonLearned || '',
      source: body.source || 'auto-on-close',
    });

    res.json({ status: 'success', data: doc });
  } catch (error) {
    console.error('TradeJournal create error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/trade-journal/list?limit=50&mistakeTag=&strategy=&outcome=
router.get('/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const query = {};
    if (req.query.mistakeTag) query.mistakeTag = req.query.mistakeTag;
    if (req.query.strategy) query.strategyName = req.query.strategy;
    if (req.query.outcome) query.outcome = req.query.outcome;
    if (req.query.tradeType) query.tradeType = req.query.tradeType;

    const docs = await TradeJournalEntry
      .find(query)
      .sort({ exitAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ status: 'success', data: docs, count: docs.length });
  } catch (error) {
    console.error('TradeJournal list error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/trade-journal/mistake-stats?days=90
// Rupee attribution per mistake category — the killer feature.
router.get('/mistake-stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '90', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await TradeJournalEntry.aggregate([
      { $match: { exitAt: { $gte: since } } },
      {
        $group: {
          _id: '$mistakeTag',
          count: { $sum: 1 },
          totalPnl: { $sum: '$pnl' },
          wins: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $lt: ['$pnl', 0] }, 1, 0] } },
          avgPnl: { $avg: '$pnl' },
        },
      },
      { $sort: { totalPnl: 1 } }, // worst first (most negative)
    ]);

    // Overall totals
    const all = await TradeJournalEntry.aggregate([
      { $match: { exitAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalPnl: { $sum: '$pnl' },
          wins: { $sum: { $cond: [{ $gt: ['$pnl', 0] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $lt: ['$pnl', 0] }, 1, 0] } },
        },
      },
    ]);

    const overall = all[0] || { count: 0, totalPnl: 0, wins: 0, losses: 0 };
    const winRate = overall.count > 0 ? (overall.wins / overall.count) * 100 : 0;

    res.json({
      status: 'success',
      data: {
        periodDays: days,
        byMistake: stats,
        overall: {
          ...overall,
          winRatePct: parseFloat(winRate.toFixed(1)),
        },
      },
    });
  } catch (error) {
    console.error('TradeJournal mistake-stats error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/trade-journal/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await TradeJournalEntry.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'success', data: doc });
  } catch (error) {
    console.error('TradeJournal get error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
