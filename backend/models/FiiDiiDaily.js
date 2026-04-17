const mongoose = require('mongoose');

/**
 * FiiDiiDaily — daily FII/DII cash activity snapshot.
 *
 * BOT_BLUEPRINT item #26. The single biggest Indian directional signal.
 * NSE publishes EOD data via public report URLs; we scrape + cache.
 *
 * Both FII and DII fields are stored on one doc (same day = same record).
 * All amounts in ₹ crore (Indian convention for institutional flow reports).
 */
const fiiDiiDailySchema = new mongoose.Schema({
  // Date in IST — uses YYYY-MM-DD to avoid timezone ambiguity
  date: { type: String, required: true, unique: true, index: true },

  // FII (Foreign Institutional Investors)
  fii: {
    buyValue: { type: Number, default: 0 },   // gross buys ₹ crore
    sellValue: { type: Number, default: 0 },  // gross sells ₹ crore
    netValue: { type: Number, default: 0 },   // net (buy − sell) ₹ crore
  },

  // DII (Domestic Institutional Investors)
  dii: {
    buyValue: { type: Number, default: 0 },
    sellValue: { type: Number, default: 0 },
    netValue: { type: Number, default: 0 },
  },

  // Source of data (for transparency)
  source: { type: String, default: 'nse' }, // 'nse' | 'moneycontrol' | 'manual' | 'cached'

  // Raw date string from source (for debugging)
  sourceDateRaw: { type: String, default: '' },

  // Fetched vs published timestamps
  fetchedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

// Convenience: sort by date desc for recent-data queries
fiiDiiDailySchema.index({ date: -1 });

module.exports = mongoose.model('FiiDiiDaily', fiiDiiDailySchema);
