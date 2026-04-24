/**
 * Strategy Tuner API — Phase 5.
 *
 * Routes
 *   GET  /api/strategy-tuner/pending        — pending adjustments
 *   POST /api/strategy-tuner/approve/:id    — user approves proposal
 *   POST /api/strategy-tuner/reject/:id     — user rejects proposal
 *   POST /api/strategy-tuner/run            — manual trigger (cron runs it Sat 2 AM IST)
 */

const express = require('express');
const router = express.Router();
const tuner = require('../services/strategyTunerService');

router.get('/pending', async (_req, res) => {
  try {
    const data = await tuner.getPending();
    res.json({ status: 'success', count: data.length, data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/approve/:id', async (req, res) => {
  try {
    const doc = await tuner.approve(req.params.id, { approvedBy: req.body?.approvedBy || 'vinit' });
    res.json({ status: 'success', data: doc });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/reject/:id', async (req, res) => {
  try {
    const doc = await tuner.reject(req.params.id);
    res.json({ status: 'success', data: doc });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

router.post('/run', async (_req, res) => {
  try {
    const result = await tuner.runTunerCycle();
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
