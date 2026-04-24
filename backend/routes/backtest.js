/**
 * Backtest API — MASTER_PLAN §7 Phase 5.
 *
 * Routes
 *   POST /api/backtest/run        body: { strategyKey, universe, fromDate, toDate,
 *                                         initialCapital, riskPerTradePct, regimeFilter, async }
 *                                  returns jobId (async=true) OR full result (sync).
 *   GET  /api/backtest/job/:jobId  returns status + progress + full result when done
 *   GET  /api/backtest/jobs?strategyKey&limit=10   recent jobs list
 *   POST /api/backtest/compare     body: { strategies:[k1,k2], ...commonConfig }
 *                                  runs two backtests (sync) and returns side-by-side metrics
 */

const express = require('express');
const router = express.Router();

const backtestService = require('../services/backtestService');
const strategiesLib = require('../services/strategies');

// ─── POST /run ────────────────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  try {
    const {
      strategyKey,
      universe,
      fromDate,
      toDate,
      initialCapital = 500000,
      riskPerTradePct = 2,
      regimeFilter = null,
      async: isAsync = false,
    } = req.body || {};

    if (!strategyKey) return res.status(400).json({ status: 'error', message: 'strategyKey required' });
    if (!strategiesLib.getStrategyByKey(strategyKey)) {
      return res.status(404).json({ status: 'error', message: `Strategy not found: ${strategyKey}` });
    }
    if (!Array.isArray(universe) || universe.length === 0) {
      return res.status(400).json({ status: 'error', message: 'universe (non-empty string array) required' });
    }
    if (!fromDate || !toDate) {
      return res.status(400).json({ status: 'error', message: 'fromDate and toDate required (YYYY-MM-DD)' });
    }

    if (isAsync) {
      const { jobId, status, startedAt } = await backtestService.runBacktestAsync({
        strategyKey, universe, fromDate, toDate,
        initialCapital, riskPerTradePct, regimeFilter,
      });
      return res.json({ status: 'success', mode: 'async', jobId, jobStatus: status, startedAt });
    }

    const result = await backtestService.runBacktest({
      strategyKey, universe, fromDate, toDate,
      initialCapital, riskPerTradePct, regimeFilter,
    });
    res.json({ status: 'success', mode: 'sync', data: result });
  } catch (err) {
    console.error('[backtest] run error:', err);
    res.status(500).json({ status: 'error', message: err.message || String(err) });
  }
});

// ─── GET /job/:jobId ──────────────────────────────────────────────────────
router.get('/job/:jobId', async (req, res) => {
  try {
    const doc = await backtestService.getBacktestResults(req.params.jobId);
    if (!doc) return res.status(404).json({ status: 'error', message: `Job not found: ${req.params.jobId}` });
    res.json({ status: 'success', data: doc });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /jobs ────────────────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const strategyKey = req.query.strategyKey || null;
    const rows = await backtestService.listRecentJobs({ strategyKey, limit });
    res.json({ status: 'success', count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── POST /compare ────────────────────────────────────────────────────────
router.post('/compare', async (req, res) => {
  try {
    const { strategies = [], universe, fromDate, toDate, initialCapital = 500000, riskPerTradePct = 2, regimeFilter = null } = req.body || {};
    if (!Array.isArray(strategies) || strategies.length < 2) {
      return res.status(400).json({ status: 'error', message: 'strategies (array of >=2 keys) required' });
    }
    const results = [];
    for (const key of strategies) {
      if (!strategiesLib.getStrategyByKey(key)) {
        results.push({ strategyKey: key, error: 'strategy not found' });
        continue;
      }
      try {
        const r = await backtestService.runBacktest({
          strategyKey: key, universe, fromDate, toDate,
          initialCapital, riskPerTradePct, regimeFilter,
        });
        results.push({
          strategyKey: key,
          totalTrades: r.totalTrades,
          winRate: r.winRate,
          avgReturnPct: r.avgReturnPct,
          totalReturnPct: r.totalReturnPct,
          sharpe: r.sharpe,
          maxDrawdown: r.maxDrawdown,
          profitFactor: r.profitFactor,
          finalEquity: r.finalEquity,
        });
      } catch (err) {
        results.push({ strategyKey: key, error: err.message });
      }
    }
    res.json({ status: 'success', data: { strategies: results } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
