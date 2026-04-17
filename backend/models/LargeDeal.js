const mongoose = require('mongoose');

/**
 * LargeDeal — NSE bulk / block / short deal records.
 *
 * BOT_BLUEPRINT item #29.
 *
 * Bulk deals = any single-client cumulative trade ≥ 0.5% of equity capital.
 * Block deals = single trade ≥ ₹10 crore (or 5 lakh shares) in window slots.
 * Short deals  = aggregated short selling data.
 *
 * Published by NSE after market close (~5:30-6 PM IST).
 * Powers "who's taking big positions?" widget + symbol-specific deal history.
 */
const largeDealSchema = new mongoose.Schema({
  dealDate: { type: Date, required: true, index: true },
  symbol: { type: String, required: true, index: true },
  company: { type: String, default: '' },
  kind: { type: String, enum: ['bulk', 'block', 'short'], required: true, index: true },

  // Bulk + block only (short aggregates by symbol, no client)
  clientName: { type: String, default: '' },
  buySell: { type: String, enum: ['BUY', 'SELL', ''], default: '' },

  qty: { type: Number, default: 0 },
  watp: { type: Number, default: 0 },              // weighted avg traded price
  valueCr: { type: Number, default: 0 },           // qty × watp / 1e7

  remarks: { type: String, default: '' },
  source: { type: String, default: 'nse' },
  fetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Dedup via unique compound key (date + symbol + kind + client + buySell + qty)
largeDealSchema.index(
  { dealDate: 1, symbol: 1, kind: 1, clientName: 1, buySell: 1, qty: 1 },
  { unique: true },
);
// Fast "recent" query
largeDealSchema.index({ dealDate: -1, kind: 1 });

module.exports = mongoose.model('LargeDeal', largeDealSchema);
