const mongoose = require('mongoose');

/**
 * MarketRegime — snapshot of the classified market regime at a point in time.
 *
 * BOT_BLUEPRINT item #30. Feeds into Validator Layer of the 4 bots
 * (Sprint 3+) so strategies only fire in compatible regimes.
 *
 * Computed every 30 min during market hours by regimeService.
 * Stored history used for: regime-conditional strategy attribution,
 * "were we in a bull trend when Screen X worked?" analysis.
 */
const marketRegimeSchema = new mongoose.Schema({
  // Classification
  regime: {
    type: String,
    enum: ['trending-bull', 'trending-bear', 'choppy', 'breakout', 'risk-off', 'unknown'],
    required: true,
    index: true,
  },

  // Confidence 0-1 (how strong the signals are)
  confidence: { type: Number, default: 0.5 },

  // Human-readable reason string (why this regime)
  reason: { type: String, default: '' },

  // Input snapshot — all values used to classify
  inputs: {
    niftyLevel: { type: Number, default: 0 },
    nifty20EMA: { type: Number, default: 0 },
    nifty50EMA: { type: Number, default: 0 },
    nifty200EMA: { type: Number, default: 0 },
    niftyVs50PctTrend: { type: Number, default: 0 },  // % above/below 50 EMA
    vix: { type: Number, default: 0 },
    vixDelta: { type: Number, default: 0 },            // % change vs yesterday
    fiiNetCr: { type: Number, default: 0 },
    diiNetCr: { type: Number, default: 0 },
    breadthRatio: { type: Number, default: 0 },        // advances / declines
  },

  // When this snapshot was computed
  computedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Indexes for "current regime" + history queries
marketRegimeSchema.index({ computedAt: -1 });

module.exports = mongoose.model('MarketRegime', marketRegimeSchema);
