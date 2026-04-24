/**
 * BotPerformance — rolling statistics for each trading bot.
 *
 * MASTER_PLAN §7 Phase 4 · BOT_BLUEPRINT #12.
 *
 * Written by learningEngineService.runNightlyLearningCycle() every night at
 * 11:30 PM IST. One document per (botId × strategyKey × regime × windowDays)
 * slice so we can slice performance by strategy and market regime.
 *
 * Consumed by:
 *   - learningEngineService.shouldAutoPauseBot (auto-pause logic)
 *   - Chief Analyst (context for briefings)
 *   - Meta-Critic (agent calibration)
 *   - Bots & Agents UI (per-bot stat strip)
 *
 * Dedup: slices are upserted by (botId, strategyKey, regime, windowDays).
 */
const mongoose = require('mongoose');

const botPerformanceSchema = new mongoose.Schema({
  botId: {
    type: String,
    required: true,
    enum: ['manual', 'swing', 'longterm', 'options-sell', 'options-buy'],
    index: true,
  },
  // `null` / empty string = aggregate across all strategies
  strategyKey: { type: String, default: '', index: true },
  // `null` / empty string = aggregate across all regimes
  regime: { type: String, default: '', index: true },

  windowDays: { type: Number, required: true },       // e.g. 30
  totalTrades: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },              // 0-1

  // Bayesian 95% credible interval for the win rate (Beta(wins+1, losses+1))
  credibleWinRate: {
    mean:  { type: Number, default: 0 },
    lower: { type: Number, default: 0 },
    upper: { type: Number, default: 0 },
  },

  avgReturnPct: { type: Number, default: 0 },
  bestReturn:   { type: Number, default: 0 },
  worstReturn:  { type: Number, default: 0 },

  // Risk / quality metrics
  sharpe:        { type: Number, default: 0 },
  profitFactor:  { type: Number, default: 0 },
  maxDrawdown:   { type: Number, default: 0 },        // worst negative return in window

  // Auto-pause state (mirrored on BotConfig via learningEngineService)
  autoPaused:    { type: Boolean, default: false },
  pausedReason:  { type: String, default: '' },

  computedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Compound uniqueness so the nightly cycle does an upsert per slice
botPerformanceSchema.index(
  { botId: 1, strategyKey: 1, regime: 1, windowDays: 1 },
  { unique: true }
);

module.exports = mongoose.model('BotPerformance', botPerformanceSchema);
