// backend/models/ScreenPerformance.js
// Denormalized per-screen performance stats, updated whenever a trade setup resolves.
// This is the core data that feeds the AI feedback loop — the AI reads this before generating new setups.

const mongoose = require('mongoose');

const screenPerformanceSchema = new mongoose.Schema({
  // Keyed by screenName (not screenId) because trade setups store screenName
  screenName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  // Overall stats
  totalSetups: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },         // TARGET_HIT count
  losses: { type: Number, default: 0 },        // SL_HIT count
  winRate: { type: Number, default: 0 },        // wins / (wins + losses) * 100
  avgReturnPct: { type: Number, default: 0 },   // average P&L % across resolved trades
  avgConfidence: { type: Number, default: 0 },   // average AI confidence on resolved trades

  // Confidence calibration — does the AI's confidence match reality?
  // e.g. when AI says 80+ confidence, what's the actual win rate?
  confidenceBrackets: {
    low: { count: { type: Number, default: 0 }, wins: { type: Number, default: 0 }, winRate: { type: Number, default: 0 } },       // 0-40
    medium: { count: { type: Number, default: 0 }, wins: { type: Number, default: 0 }, winRate: { type: Number, default: 0 } },    // 40-60
    high: { count: { type: Number, default: 0 }, wins: { type: Number, default: 0 }, winRate: { type: Number, default: 0 } },      // 60-80
    veryHigh: { count: { type: Number, default: 0 }, wins: { type: Number, default: 0 }, winRate: { type: Number, default: 0 } },  // 80-100
  },

  // Per-symbol track record from this screen
  symbolStats: [{
    symbol: String,
    total: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    avgReturnPct: { type: Number, default: 0 },
  }],

  // Quick lookups
  bestSymbols: [String],   // top 5 symbols by win rate (min 2 trades)
  worstSymbols: [String],  // bottom 5 symbols by win rate (min 2 trades)

  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ScreenPerformance', screenPerformanceSchema);
