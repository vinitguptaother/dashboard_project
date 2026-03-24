// backend/routes/instruments.js
// Provides instrument search and import endpoints.
// The import now auto-downloads from Upstox public URL — no CSV file needed on disk.

const express = require('express');
const router = express.Router();
const Instrument = require('../models/Instrument');
const { importInstruments } = require('../scripts/downloadInstruments');

// ─── GET /api/instruments/search ──────────────────────────────────────────────
// Search instruments by symbol (prefix match) or company name (contains match)
// Query params: q (required), exchange (default NSE), limit (default 20)
// Example: /api/instruments/search?q=RELI&exchange=NSE
router.get('/search', async (req, res) => {
  try {
    const { q, exchange = 'NSE', limit = '20' } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Query parameter "q" is required',
      });
    }

    const query = q.trim();
    const maxResults = Math.min(parseInt(limit) || 20, 50);

    const instruments = await Instrument.find({
      exchange: exchange.toUpperCase(),
      $or: [
        { symbol: { $regex: `^${query}`, $options: 'i' } },
        { name:   { $regex: query,       $options: 'i' } },
      ],
    })
      .limit(maxResults)
      .select('symbol name exchange token isin segment')
      .lean();

    // Sort: symbol-starts-with matches first, then name matches
    const q_upper = query.toUpperCase();
    instruments.sort((a, b) => {
      const aStarts = a.symbol.startsWith(q_upper) ? 0 : 1;
      const bStarts = b.symbol.startsWith(q_upper) ? 0 : 1;
      return aStarts - bStarts;
    });

    res.json({
      status: 'success',
      data: instruments,
      count: instruments.length,
    });
  } catch (error) {
    console.error('Instrument search error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search instruments',
    });
  }
});

// ─── GET /api/instruments/count ───────────────────────────────────────────────
// Returns count of instruments in DB — useful for health checks
router.get('/count', async (req, res) => {
  try {
    const [nse, bse] = await Promise.all([
      Instrument.countDocuments({ exchange: 'NSE' }),
      Instrument.countDocuments({ exchange: 'BSE' }),
    ]);
    res.json({
      status: 'success',
      data: { nse, bse, total: nse + bse },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── GET /api/instruments/:symbol ─────────────────────────────────────────────
// Get a single instrument by symbol — returns its instrument_key for LTP lookup
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const instrument = await Instrument.findOne({ symbol, exchange: 'NSE' })
      .select('symbol name exchange token isin segment')
      .lean();

    if (!instrument) {
      return res.status(404).json({
        status: 'error',
        message: `Instrument ${symbol} not found in NSE`,
      });
    }

    res.json({ status: 'success', data: instrument });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── POST /api/instruments/import ─────────────────────────────────────────────
// Triggers a fresh download + import of all NSE/BSE instruments.
// Safe to call anytime — does upserts, won't duplicate data.
// Responds immediately, runs import in background.
router.post('/import', async (req, res) => {
  try {
    const count = await Instrument.countDocuments();
    res.json({
      status: 'success',
      message: 'Instrument import started in background',
      currentCount: count,
    });

    // Run without blocking the response
    importInstruments(false)
      .then((total) => console.log(`✅ Background import complete: ${total} instruments`))
      .catch((err)  => console.error('❌ Background import failed:', err.message));

  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
