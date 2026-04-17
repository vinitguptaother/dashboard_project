/**
 * Validator API.
 * BOT_BLUEPRINT item #6.
 */

const express = require('express');
const router = express.Router();
const svc = require('../services/validatorService');

// POST /api/validator/validate
// Body: full candidate object; optional ?persist=true to save as TradeSetup on accept.
router.post('/validate', async (req, res) => {
  try {
    const persist = req.query.persist === 'true' || req.body?.persist === true;
    const candidate = { ...req.body, clientIp: req.ip };
    delete candidate.persist;
    const result = await svc.validateCandidate(candidate, { persist });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/validator/validate-batch
// Body: { candidates: [...], persist?: boolean }
router.post('/validate-batch', async (req, res) => {
  try {
    const { candidates = [], persist = false } = req.body || {};
    if (!Array.isArray(candidates)) {
      return res.status(400).json({ status: 'error', message: 'candidates must be an array' });
    }
    const withIp = candidates.map(c => ({ ...c, clientIp: req.ip }));
    const results = await svc.validateBatch(withIp, { persist });
    res.json({ status: 'success', data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/validator/history?limit=20&botId=swing
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const botId = req.query.botId || undefined;
    const rows = await svc.getRecentValidations({ limit, botId });
    res.json({ status: 'success', data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
