const mongoose = require('mongoose');

/**
 * TradeJournalEntry — rich post-trade record for quarterly review.
 *
 * BOT_BLUEPRINT items #17 (Auto Journal) + #18 (Mistake Tagging).
 *
 * Created automatically when a trade closes (via /api/trade-journal/entry).
 * Enriched with market context (VIX, regime, FII/DII, sector) at close time.
 * Mistake tag is MANDATORY — default 'clean' if user confirmed no mistakes.
 *
 * Quarterly report surfaces: "revenge trades cost ₹X, FOMO entries cost ₹Y".
 */
const tradeJournalEntrySchema = new mongoose.Schema({
  // Link back to the actual trade
  tradeType: { type: String, enum: ['options', 'stock', 'realStock', 'realOptions', ''], default: '' },
  tradeId: { type: String, default: '' }, // MongoDB _id of OptionsTrade / TradeSetup / RealTrade
  checklistId: { type: String, default: '' }, // TradeChecklist _id if Pre-Trade Gate was used

  // Trade snapshot (denormalized so journal works even if source trade is deleted)
  underlying: { type: String, default: '' },
  symbol: { type: String, default: '' },
  strategyName: { type: String, default: '' },
  side: { type: String, enum: ['BUY', 'SELL', ''], default: '' },
  entryPrice: { type: Number, default: 0 },
  exitPrice: { type: Number, default: 0 },
  entryAt: { type: Date, default: null },
  exitAt: { type: Date, default: null },
  qty: { type: Number, default: 0 },
  pnl: { type: Number, default: 0 },
  outcome: { type: String, enum: ['win', 'loss', 'breakeven', ''], default: '' },
  holdingPeriodHours: { type: Number, default: 0 },

  // Market context at close time
  context: {
    vix: { type: Number, default: 0 },
    niftyLevel: { type: Number, default: 0 },
    niftyRegime: { type: String, default: '' }, // 'trending-bull' | 'trending-bear' | 'choppy' | ...
    fiiNetCash: { type: Number, default: 0 },   // cached last EOD
    diiNetCash: { type: Number, default: 0 },
    sectorPerformance: { type: String, default: '' },
    capturedAt: { type: Date, default: Date.now },
  },

  // Mistake tagging (MANDATORY — must be one of these)
  mistakeTag: {
    type: String,
    enum: [
      'clean',            // no mistakes — execution followed plan
      'revenge',          // traded after loss to recoup
      'fomo',             // entered chasing a move
      'moved_sl',         // widened stop during trade
      'oversized',        // position > risk rule
      'early_exit',       // closed before target unnecessarily
      'late_exit',        // held past SL / target
      'no_thesis',        // no written reason at entry
      'ignored_plan',     // deviated from setup rules
      'other',            // with freeform notes
    ],
    required: true,
    default: 'clean',
  },

  // User's own reflection
  notes: { type: String, default: '' },
  lessonLearned: { type: String, default: '' },

  // Audit
  source: { type: String, enum: ['manual', 'bot', 'auto-on-close'], default: 'auto-on-close' },
}, {
  timestamps: true,
});

// Indexes for quarterly reports + filtering
tradeJournalEntrySchema.index({ exitAt: -1 });
tradeJournalEntrySchema.index({ mistakeTag: 1, exitAt: -1 });
tradeJournalEntrySchema.index({ strategyName: 1, exitAt: -1 });
tradeJournalEntrySchema.index({ 'context.niftyRegime': 1, exitAt: -1 });

// Auto-compute outcome from pnl before save if not set
tradeJournalEntrySchema.pre('save', function (next) {
  if (!this.outcome) {
    if (this.pnl > 0) this.outcome = 'win';
    else if (this.pnl < 0) this.outcome = 'loss';
    else this.outcome = 'breakeven';
  }
  next();
});

module.exports = mongoose.model('TradeJournalEntry', tradeJournalEntrySchema);
