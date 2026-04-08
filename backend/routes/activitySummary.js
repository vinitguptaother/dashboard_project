const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

function getCollection() {
  if (mongoose.connection.readyState !== 1) return null;
  return mongoose.connection.db.collection('activity_logs');
}

// GET /api/activity/summary?date=YYYY-MM-DD
// Returns all activity events for a given day (IST timezone)
router.get('/summary', async (req, res) => {
  try {
    const col = getCollection();
    if (!col) return res.json({ status: 'success', data: { date: req.query.date, events: [], counts: {} } });

    // Default to today in IST
    const dateStr = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const start = new Date(dateStr + 'T00:00:00+05:30');
    const end = new Date(dateStr + 'T23:59:59.999+05:30');

    const events = await col.find({
      timestamp: { $gte: start, $lte: end },
    }).sort({ timestamp: -1 }).limit(500).toArray();

    // Count by type
    const counts = {};
    for (const e of events) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }

    res.json({ status: 'success', data: { date: dateStr, events, counts, total: events.length } });
  } catch (error) {
    console.error('Activity summary error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/activity/dates — list dates that have activity (last 30 days)
router.get('/dates', async (req, res) => {
  try {
    const col = getCollection();
    if (!col) return res.json({ status: 'success', data: [] });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const results = await col.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: '+05:30' } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]).toArray();

    res.json({ status: 'success', data: results.map(r => ({ date: r._id, count: r.count })) });
  } catch (error) {
    console.error('Activity dates error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
