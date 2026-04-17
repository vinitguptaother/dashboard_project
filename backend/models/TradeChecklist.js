const mongoose = require('mongoose');

/**
 * TradeChecklist — per-trade pre-entry discipline check.
 *
 * One document per attempted trade entry. Captures whether the user / bot
 * passed all six discipline criteria at the moment of trade creation.
 *
 * Phase 1 (tracking only): checklist is recorded but does NOT block trade POST.
 *   Purpose: measure adherence baseline before we turn on enforcement.
 *
 * Phase 2 (TODO — next session): backend trade POSTs require a valid recent
 *   checklist with allPassed=true, else 403.
 *
 * See project_logs/BOT_BLUEPRINT.md item #13 "Execution Checklist (Pre-Trade Gate)".
 */
const tradeChecklistSchema = new mongoose.Schema({
  // Who / what the checklist is for
  source: { type: String, enum: ['manual', 'bot'], default: 'manual' },
  botName: { type: String, default: null }, // e.g. 'Swing', 'OptionsSell' if source='bot'
  userId: { type: String, default: 'default' }, // single-user for now

  // Trade context (snapshot at time of checklist)
  underlying: { type: String, default: '' },
  symbol: { type: String, default: '' },
  strategyName: { type: String, default: '' },
  intendedSide: { type: String, enum: ['BUY', 'SELL', ''], default: '' },
  intendedQty: { type: Number, default: 0 },
  intendedEntry: { type: Number, default: 0 },
  intendedSL: { type: Number, default: 0 },
  intendedTarget: { type: Number, default: 0 },

  // The six checks (each: 'pass' | 'fail' | 'na')
  checks: {
    trendAligned: { type: String, enum: ['pass', 'fail', 'na'], default: 'na' },
    riskAcceptable: { type: String, enum: ['pass', 'fail', 'na'], default: 'na' },
    stopLossDefined: { type: String, enum: ['pass', 'fail', 'na'], default: 'na' },
    noMajorNewsRisk: { type: String, enum: ['pass', 'fail', 'na'], default: 'na' },
    capitalAvailable: { type: String, enum: ['pass', 'fail', 'na'], default: 'na' },
    notOverexposed: { type: String, enum: ['pass', 'fail', 'na'], default: 'na' },
  },

  // Free-form notes captured at entry
  notes: { type: String, default: '' },

  // Derived / audit fields
  allPassed: { type: Boolean, default: false }, // true only if ALL six checks === 'pass'
  passCount: { type: Number, default: 0 },      // how many passed (0-6)
  failCount: { type: Number, default: 0 },      // how many failed

  // Outcome tracking — filled when the trade eventually closes
  // (Phase 2 will link this checklistId to the resulting trade.)
  linkedTradeId: { type: String, default: null },
  linkedTradeType: { type: String, enum: ['options', 'paper', 'real', ''], default: '' },
  tradeOutcome: { type: String, enum: ['win', 'loss', 'open', 'cancelled', ''], default: '' },
  tradePnl: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Fast lookup for recent checklists (used by Phase 2 gate validation)
tradeChecklistSchema.index({ createdAt: -1 });
// Adherence analytics — group by source + passed
tradeChecklistSchema.index({ source: 1, allPassed: 1, createdAt: -1 });

// Compute allPassed / passCount / failCount before save
tradeChecklistSchema.pre('save', function (next) {
  const values = Object.values(this.checks || {});
  this.passCount = values.filter(v => v === 'pass').length;
  this.failCount = values.filter(v => v === 'fail').length;
  this.allPassed = this.passCount === 6 && this.failCount === 0;
  next();
});

module.exports = mongoose.model('TradeChecklist', tradeChecklistSchema);
