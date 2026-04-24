/**
 * HistoricalOHLC — cache of daily OHLCV bars fetched from Upstox historical API.
 *
 * MASTER_PLAN §7 Phase 5.
 *
 * Populated lazily by backtestService the first time a symbol/date range is
 * needed, then reused forever. This lets backtests be repeatable, fast, and
 * offline after initial population.
 *
 * Unique compound index on (symbol, date) prevents duplicates.
 */
const mongoose = require('mongoose');

const historicalOHLCSchema = new mongoose.Schema({
  // Uppercased trading symbol — e.g. "RELIANCE", "HDFCBANK"
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  // Bar date — normalized to UTC midnight for the session day.
  date: {
    type: Date,
    required: true,
    index: true,
  },
  open:   { type: Number, required: true },
  high:   { type: Number, required: true },
  low:    { type: Number, required: true },
  close:  { type: Number, required: true },
  volume: { type: Number, default: 0 },

  // Upstox instrument_key used for the fetch (kept for debugging / refetch).
  instrumentKey: { type: String, default: '' },

  // Source tag — currently "upstox-v2/day"; lets us extend later (yahoo, nse, synthetic).
  source: { type: String, default: 'upstox-v2/day' },

  // When we cached this bar
  fetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Unique compound index — a given symbol has exactly one bar per date
historicalOHLCSchema.index({ symbol: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('HistoricalOHLC', historicalOHLCSchema);
