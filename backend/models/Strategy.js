/**
 * Strategy — metadata-only model for the Strategy Library.
 *
 * MASTER_PLAN §7 Phase 3.
 * BOT_BLUEPRINT item #8 (Strategy Library).
 *
 * The actual `evaluate()` logic lives in `backend/services/strategies/*.js`.
 * This model stores only the metadata + running stats for the UI + Learning
 * Engine (Phase 4): how often the strategy triggered, how often it was
 * accepted by the Validator, how it performed on closed trades.
 *
 * Seeded on boot via `strategies/index.js#seedStrategies()` — idempotent.
 */
const mongoose = require('mongoose');

const strategySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: { type: String, required: true },
  botId: {
    type: String,
    enum: ['swing', 'longterm', 'options-sell', 'options-buy', 'manual'],
    required: true,
    index: true,
  },
  segment: {
    type: String,
    enum: ['equity-delivery', 'equity-intraday', 'options', 'futures'],
    required: true,
  },
  // Which market regimes allow this strategy to fire.
  // Values align with regimeService output: trending-bull | trending-bear |
  // choppy | breakout | risk-off | unknown.
  regimeCompatibility: {
    type: [String],
    default: [],
  },
  description: { type: String, default: '' },
  enabled: { type: Boolean, default: true },

  // Runtime stats — updated by scannerService as evaluate() calls land.
  lastRunAt: { type: Date, default: null },
  runCount: { type: Number, default: 0 },
  acceptedCount: { type: Number, default: 0 },   // candidate fired
  rejectedCount: { type: Number, default: 0 },   // evaluate() returned null
  avgReturnPct: { type: Number, default: null }, // filled in Phase 4 Learning Engine
}, { timestamps: true });

strategySchema.index({ botId: 1, enabled: 1 });

module.exports = mongoose.model('Strategy', strategySchema);
