/**
 * Trade Checklist API — Pre-Trade Discipline Gate (Phase 1 tracking)
 *
 * Endpoints:
 *   POST /api/trade-checklist            — record a completed checklist (tracking only)
 *   GET  /api/trade-checklist/stats      — adherence stats (pass rate, count by source)
 *   GET  /api/trade-checklist/recent     — last N checklists (for Journal / review)
 *   GET  /api/trade-checklist/:id        — fetch single checklist (verification for Phase 2 gate)
 *
 * See project_logs/BOT_BLUEPRINT.md item #13.
 */

const express = require('express');
const router = express.Router();
const TradeChecklist = require('../models/TradeChecklist');

// POST /api/trade-checklist
// Record a checklist completion. Returns the saved _id so the caller can
// reference it when the trade POST fires (Phase 2 will validate this id).
router.post('/', async (req, res) => {
  try {
    const {
      source = 'manual',
      botName = null,
      underlying = '',
      symbol = '',
      strategyName = '',
      intendedSide = '',
      intendedQty = 0,
      intendedEntry = 0,
      intendedSL = 0,
      intendedTarget = 0,
      checks = {},
      notes = '',
    } = req.body || {};

    // Minimal validation — every check key is optional but any provided must
    // be one of 'pass' | 'fail' | 'na'. Schema enforces this on save.
    const doc = await TradeChecklist.create({
      source,
      botName,
      underlying,
      symbol,
      strategyName,
      intendedSide,
      intendedQty,
      intendedEntry,
      intendedSL,
      intendedTarget,
      checks,
      notes,
    });

    res.json({ status: 'success', data: doc });
  } catch (error) {
    console.error('TradeChecklist create error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/trade-checklist/stats
// Adherence: how often do we actually pass ALL six checks?
router.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [total, passed, failedAny, bySource] = await Promise.all([
      TradeChecklist.countDocuments({ createdAt: { $gte: since } }),
      TradeChecklist.countDocuments({ createdAt: { $gte: since }, allPassed: true }),
      TradeChecklist.countDocuments({ createdAt: { $gte: since }, failCount: { $gt: 0 } }),
      TradeChecklist.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
            _id: '$source',
            total: { $sum: 1 },
            passed: { $sum: { $cond: ['$allPassed', 1, 0] } },
        } },
      ]),
    ]);

    const adherencePct = total > 0 ? (passed / total) * 100 : 0;

    res.json({
      status: 'success',
      data: {
        periodDays: days,
        total,
        passed,
        failedAny,
        adherencePct: parseFloat(adherencePct.toFixed(1)),
        bySource,
      },
    });
  } catch (error) {
    console.error('TradeChecklist stats error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/trade-checklist/recent
// Last N checklists — for the Journal / review UI.
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const docs = await TradeChecklist
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ status: 'success', data: docs });
  } catch (error) {
    console.error('TradeChecklist recent error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/trade-checklist/:id
// Fetch a single checklist by id — Phase 2 gate will call this to verify
// allPassed=true + createdAt within last 10 min before allowing the trade POST.
router.get('/:id', async (req, res) => {
  try {
    const doc = await TradeChecklist.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ status: 'error', message: 'Checklist not found' });
    res.json({ status: 'success', data: doc });
  } catch (error) {
    console.error('TradeChecklist get error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
