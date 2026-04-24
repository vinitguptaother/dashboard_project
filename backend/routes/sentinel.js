/**
 * Sentinel API — powers the Today tab.
 * MASTER_PLAN §3 (System C).
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/sentinelService');

// GET /api/sentinel/action-items — all active alerts, priority-sorted
router.get('/action-items', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const items = await svc.getActiveActionItems({ limit });
    res.json({ status: 'success', data: items });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/sentinel/run — manual trigger of Sentinel cycle
router.post('/run', async (req, res) => {
  try {
    const result = await svc.runSentinelCycle();
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/sentinel/action-items/:id/acknowledge
router.post('/action-items/:id/acknowledge', async (req, res) => {
  try {
    const item = await svc.acknowledgeItem(req.params.id);
    res.json({ status: 'success', data: item });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/sentinel/action-items/:id/dismiss
router.post('/action-items/:id/dismiss', async (req, res) => {
  try {
    const item = await svc.dismissItem(req.params.id);
    res.json({ status: 'success', data: item });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/sentinel/action-items/:id/resolve
router.post('/action-items/:id/resolve', async (req, res) => {
  try {
    const item = await svc.resolveItem(req.params.id);
    res.json({ status: 'success', data: item });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
