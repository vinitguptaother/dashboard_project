// backend/routes/apiUsage.js
// Lightweight API usage reporting endpoints.

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

function getCol() {
  if (mongoose.connection.readyState !== 1) return null;
  return mongoose.connection.db.collection('api_usage_logs');
}

// GET /api/api-usage/summary
router.get('/summary', async (req, res) => {
  try {
    const col = getCol();
    if (!col) return res.json({ status: 'success', data: { today: {}, week: {}, allTime: {}, topEndpoints: [] } });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday start

    const [todayStats, weekStats, allTimeStats, topEndpoints] = await Promise.all([
      // Today
      col.aggregate([
        { $match: { timestamp: { $gte: startOfDay } } },
        { $group: {
          _id: null,
          calls: { $sum: 1 },
          cost: { $sum: '$estimatedCost' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
        }}
      ]).toArray(),
      // This week
      col.aggregate([
        { $match: { timestamp: { $gte: startOfWeek } } },
        { $group: {
          _id: null,
          calls: { $sum: 1 },
          cost: { $sum: '$estimatedCost' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
        }}
      ]).toArray(),
      // All time
      col.aggregate([
        { $group: {
          _id: null,
          calls: { $sum: 1 },
          cost: { $sum: '$estimatedCost' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
        }}
      ]).toArray(),
      // Top endpoints (all time)
      col.aggregate([
        { $group: { _id: '$endpoint', calls: { $sum: 1 }, cost: { $sum: '$estimatedCost' } } },
        { $sort: { calls: -1 } },
        { $limit: 10 }
      ]).toArray(),
    ]);

    const fmt = (arr) => arr[0] || { calls: 0, cost: 0, inputTokens: 0, outputTokens: 0 };

    res.json({
      status: 'success',
      data: {
        today: fmt(todayStats),
        week: fmt(weekStats),
        allTime: fmt(allTimeStats),
        topEndpoints: topEndpoints.map(e => ({ endpoint: e._id, calls: e.calls, cost: parseFloat(e.cost.toFixed(4)) })),
      }
    });
  } catch (err) {
    console.error('API Usage summary error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/api-usage/recent
router.get('/recent', async (req, res) => {
  try {
    const col = getCol();
    if (!col) return res.json({ status: 'success', data: [] });

    const recent = await col.find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    res.json({ status: 'success', data: recent });
  } catch (err) {
    console.error('API Usage recent error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
