// backend/routes/marketStatus.js
// GET /api/market-status        → current market state + upcoming holiday
// POST /api/market-status/refresh → force-refresh holiday list from NSE
// GET /api/market-status/holidays → full holiday list + source info

const express = require('express');
const router = express.Router();
const { getMarketState } = require('../utils/marketHours');
const { getHolidays, refreshHolidays, getHolidayStats } = require('../services/holidayService');

router.get('/', (req, res) => {
  try {
    const { holidays } = getHolidays();
    const state = getMarketState(new Date(), holidays);
    res.json({ status: 'success', data: state });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.get('/holidays', (req, res) => {
  try {
    const c = getHolidays();
    res.json({
      status: 'success',
      data: {
        ...getHolidayStats(),
        holidays: c.holidays,
      },
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const fresh = await refreshHolidays();
    res.json({
      status: 'success',
      data: { count: fresh.holidays.length, source: fresh.source, fetchedAt: fresh.fetchedAt },
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
