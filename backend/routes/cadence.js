/**
 * Cadence Registry API — per BOT_BLUEPRINT rule #5 (dashboard self-awareness).
 *
 * Endpoints:
 *   GET  /api/cadence/list        — all registered tasks + their status
 *   GET  /api/cadence/missed      — only missed tasks (for the bell badge + toast)
 *   GET  /api/cadence/summary     — counts by status (on-track / missed / due-soon / stale)
 *   POST /api/cadence/run-check   — manually trigger the watchdog (admin/debug)
 *   POST /api/cadence/acknowledge/:taskKey — user acknowledges a missed user-task
 *                                             (marks lastRunAt = now, resets missedCount)
 */

const express = require('express');
const router = express.Router();
const CadenceTask = require('../models/CadenceTask');
const cadenceService = require('../services/cadenceService');

// Full list with filters
router.get('/list', async (req, res) => {
  try {
    const query = {};
    if (req.query.type) query.type = req.query.type;
    if (req.query.category) query.category = req.query.category;
    if (req.query.status) query.status = req.query.status;
    const tasks = await CadenceTask.find(query).sort({ status: 1, taskKey: 1 }).lean();
    res.json({ status: 'success', data: tasks, count: tasks.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Only missed tasks — powers the bell badge
router.get('/missed', async (req, res) => {
  try {
    const missed = await CadenceTask.find({ status: 'missed', enabled: true })
      .sort({ missedCount: -1, updatedAt: -1 })
      .lean();
    res.json({ status: 'success', data: missed, count: missed.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Summary counts (cheap — used by the useCadenceAlerts hook poll)
router.get('/summary', async (req, res) => {
  try {
    const agg = await CadenceTask.aggregate([
      { $match: { enabled: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus = { 'on-track': 0, 'missed': 0, 'due-soon': 0, 'stale': 0, 'disabled': 0 };
    for (const row of agg) if (row._id) byStatus[row._id] = row.count;
    res.json({
      status: 'success',
      data: {
        byStatus,
        total: Object.values(byStatus).reduce((s, n) => s + n, 0),
        missedCount: byStatus.missed || 0,
        needsAttentionCount: (byStatus.missed || 0) + (byStatus.stale || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Manually trigger watchdog evaluation
router.post('/run-check', async (req, res) => {
  try {
    const result = await cadenceService.evaluateAll();
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// User acknowledges a user-type missed task (e.g. "I did my journal review")
router.post('/acknowledge/:taskKey', async (req, res) => {
  try {
    const result = await cadenceService.reportRun(req.params.taskKey, 'success', 'user-acknowledged');
    if (!result) return res.status(404).json({ status: 'error', message: 'Unknown taskKey' });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
