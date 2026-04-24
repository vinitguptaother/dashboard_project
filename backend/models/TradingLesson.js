/**
 * TradingLesson — structured post-trade insight, written by Pattern Miner.
 *
 * MASTER_PLAN §7 Phase 3. Blueprint item #8 (Pattern Miner).
 *
 * One document per closed-trade analysis. Pattern Miner reads:
 *   - The closed TradeSetup (entry, exit, SL, target, outcome)
 *   - MarketRegime at entry time
 *   - Pattern levels (S/R, ATR) at entry
 *   - Which strategy fired (if any)
 *
 * Output: a verdict + 1-5 short lessons. Future Phase 4 (Learning Engine)
 * rolls these up to detect recurring mistakes and surface ActionItems.
 */
const mongoose = require('mongoose');

const tradingLessonSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true, index: true },
  botId: {
    type: String,
    enum: ['manual', 'swing', 'longterm', 'options-sell', 'options-buy'],
    default: 'manual',
    index: true,
  },
  // Matches Strategy.key (empty string if trade was mechanical / pre-Phase-3)
  strategyKey: { type: String, default: '', index: true },
  tradeSetupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradeSetup',
    required: true,
    index: true,
  },

  // The 4-quadrant verdict:
  //   GOOD_WIN   — won + process was sound
  //   BAD_WIN    — won but for the wrong reason (luck)
  //   GOOD_LOSS  — lost but following the rules (acceptable)
  //   BAD_LOSS   — lost AND process broke (mistake)
  verdict: {
    type: String,
    enum: ['GOOD_WIN', 'BAD_WIN', 'GOOD_LOSS', 'BAD_LOSS', 'INCONCLUSIVE'],
    default: 'INCONCLUSIVE',
  },

  // 1-5 short, concrete lessons (≤ 200 chars each)
  lessons: { type: [String], default: [] },

  // Snapshot of trade context for future re-analysis
  contextSnapshot: {
    regimeAtEntry: { type: String, default: '' },
    nearestSupport: { type: Number, default: null },
    nearestResistance: { type: Number, default: null },
    atrPct: { type: Number, default: null },
    holdDays: { type: Number, default: null },
    mfePct: { type: Number, default: null },  // max favorable excursion
    maePct: { type: Number, default: null },  // max adverse excursion
    strategyGateSatisfied: { type: Boolean, default: null },
  },

  // 0-100 — how confident Pattern Miner is in the verdict
  confidence: { type: Number, default: 50, min: 0, max: 100 },
  generatedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

tradingLessonSchema.index({ symbol: 1, generatedAt: -1 });

module.exports = mongoose.model('TradingLesson', tradingLessonSchema);
