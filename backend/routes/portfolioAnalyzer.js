/**
 * Portfolio Analyzer API — Phase 2 Track C.
 *
 * POST   /api/portfolio-analyzer/upload       Upload CSV (JSON body: { csv })
 * GET    /api/portfolio-analyzer/holdings     List current holdings
 * GET    /api/portfolio-analyzer/verdict/:sym Verdict for a single stock
 * POST   /api/portfolio-analyzer/analyze-all  Batch verdict for whole portfolio
 * DELETE /api/portfolio-analyzer/holdings     Clear all holdings
 */

const express = require('express');
const router = express.Router();
const PortfolioHolding = require('../models/PortfolioHolding');
const analyzerSvc = require('../services/portfolioAnalyzerService');

const DEFAULT_USER = 'default';

// Keep payloads reasonable — CSV files from brokers are usually <50KB.
router.use(express.json({ limit: '5mb' }));
router.use(express.text({ type: 'text/csv', limit: '5mb' }));

// ─── POST /upload ───────────────────────────────────────────────────────────
router.post('/upload', async (req, res) => {
  try {
    let csv = '';
    let mapping;

    if (typeof req.body === 'string') {
      csv = req.body;
    } else if (req.body && typeof req.body.csv === 'string') {
      csv = req.body.csv;
      mapping = req.body.mapping;
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Send CSV as text/csv body OR JSON { "csv": "<text>" }.',
      });
    }

    if (!csv.trim()) {
      return res.status(400).json({ status: 'error', message: 'Empty CSV' });
    }

    const result = await analyzerSvc.importFromCSV(csv, mapping);
    if (result.error) {
      return res.status(400).json({ status: 'error', message: result.error, result });
    }

    return res.json({
      status: 'success',
      imported: result.imported,
      skipped: result.skipped,
      detectedMapping: result.detectedMapping,
      holdings: result.holdings,
    });
  } catch (err) {
    console.error('[portfolioAnalyzer] upload error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /holdings ──────────────────────────────────────────────────────────
router.get('/holdings', async (_req, res) => {
  try {
    const holdings = await PortfolioHolding.find({ userId: DEFAULT_USER }).sort({ symbol: 1 }).lean();
    const totals = holdings.reduce(
      (acc, h) => {
        acc.invested += h.investedValue || 0;
        acc.currentValue += h.currentValue || 0;
        return acc;
      },
      { invested: 0, currentValue: 0 },
    );
    totals.pnl = totals.currentValue - totals.invested;
    totals.pnlPct = totals.invested > 0 ? (totals.pnl / totals.invested) * 100 : 0;

    return res.json({
      status: 'success',
      count: holdings.length,
      totals,
      aiAvailable: analyzerSvc.hasClaudeKey(),
      holdings,
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /verdict/:symbol ───────────────────────────────────────────────────
router.get('/verdict/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ status: 'error', message: 'symbol required' });
    const verdict = await analyzerSvc.getVerdict(symbol);
    return res.json({ status: 'success', verdict });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── POST /analyze-all ──────────────────────────────────────────────────────
router.post('/analyze-all', async (_req, res) => {
  try {
    const result = await analyzerSvc.analyzePortfolio();
    return res.json({ status: 'success', ...result });
  } catch (err) {
    console.error('[portfolioAnalyzer] analyze-all error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── DELETE /holdings ───────────────────────────────────────────────────────
router.delete('/holdings', async (_req, res) => {
  try {
    const r = await PortfolioHolding.deleteMany({ userId: DEFAULT_USER });
    return res.json({ status: 'success', deleted: r.deletedCount || 0 });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
