/**
 * Compliance API.
 * BOT_BLUEPRINT item #46.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/complianceService');

// GET /api/compliance/events
//   ?algoId=SWING-V1&botId=swing&decision=rejected&symbol=RELIANCE
//   &from=2026-04-01&to=2026-04-17&limit=50&skip=0
router.get('/events', async (req, res) => {
  try {
    const data = await svc.getEvents({
      algoId: req.query.algoId,
      botId: req.query.botId,
      decision: req.query.decision,
      symbol: req.query.symbol,
      from: req.query.from,
      to: req.query.to,
      limit: parseInt(req.query.limit || '50', 10),
      skip: parseInt(req.query.skip || '0', 10),
    });
    res.json({ status: 'success', data: data.rows, total: data.total });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/compliance/stats?days=30
router.get('/stats', async (req, res) => {
  try {
    const data = await svc.getStats({ days: parseInt(req.query.days || '30', 10) });
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/compliance/algo-registry
router.get('/algo-registry', async (req, res) => {
  try {
    const data = await svc.getAlgoRegistry();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/compliance/algo-registry  (upsert an algo)
router.post('/algo-registry', async (req, res) => {
  try {
    const doc = await svc.registerAlgo(req.body);
    res.json({ status: 'success', data: doc });
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// GET /api/compliance/export.csv?from=...&to=...&algoId=...
router.get('/export.csv', async (req, res) => {
  try {
    const { csv, rowCount } = await svc.exportCsv({
      from: req.query.from,
      to: req.query.to,
      algoId: req.query.algoId,
      botId: req.query.botId,
      decision: req.query.decision,
    });
    const fname = `compliance-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.setHeader('X-Row-Count', String(rowCount));
    res.send(csv);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
