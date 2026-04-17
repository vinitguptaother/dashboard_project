const mongoose = require('mongoose');

/**
 * ComplianceEvent — SEBI-grade audit log of every algo decision.
 *
 * BOT_BLUEPRINT item #46.
 *
 * Writes happen at every decision point:
 *   • `generated`  — Scanner produced a candidate
 *   • `evaluated`  — Risk Engine ran all gates
 *   • `accepted`   — Trade passed all gates; setup persisted
 *   • `rejected`   — Trade blocked by one or more gates (reasons[] captured)
 *   • `executed`   — Order sent to broker (live only; paper trades never produce this)
 *   • `filled`     — Broker confirmed fill (live only)
 *   • `canceled`   — Manually canceled or auto-canceled (e.g. bot kill mid-flight)
 *   • `target_hit` / `sl_hit` / `expired` — outcome
 *
 * Immutable once written (we don't edit compliance records). Older than
 * 7 years per SEBI retention requirement — no TTL index by default.
 */
const complianceEventSchema = new mongoose.Schema({
  // SEBI-required identifiers
  algoId: { type: String, required: true, uppercase: true, index: true },
  botId: {
    type: String,
    enum: ['manual', 'swing', 'longterm', 'options-sell', 'options-buy'],
    required: true,
    index: true,
  },
  tradeSetupId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradeSetup', default: null, index: true },

  // Decision type
  decision: {
    type: String,
    enum: [
      'generated', 'evaluated', 'accepted', 'rejected',
      'executed', 'filled', 'canceled',
      'target_hit', 'sl_hit', 'expired',
    ],
    required: true,
    index: true,
  },

  // Trade context (snapshot — never references a mutable doc)
  symbol: { type: String, default: '' },
  action: { type: String, enum: ['BUY', 'SELL', 'ACCUMULATE', ''], default: '' },
  quantity: { type: Number, default: 0 },
  entryPrice: { type: Number, default: 0 },
  stopLoss: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
  price: { type: Number, default: 0 },                 // fill price for executed/filled/closed events

  // Why this decision was made — free-form string + structured checks
  reasoning: { type: String, default: '' },
  reasons: { type: [String], default: [] },            // from evaluateTrade or scanner notes
  checks: { type: Object, default: null },             // risk-check snapshot

  // Environment snapshot (also SEBI-required)
  clientIp: { type: String, default: '' },
  staticIp: { type: String, default: '' },             // algo's declared static IP
  latencyMs: { type: Number, default: 0 },
  orderRef: { type: String, default: '' },             // broker order ref when live

  at: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Fast common queries
complianceEventSchema.index({ at: -1 });
complianceEventSchema.index({ algoId: 1, at: -1 });
complianceEventSchema.index({ decision: 1, at: -1 });
complianceEventSchema.index({ symbol: 1, at: -1 });

module.exports = mongoose.model('ComplianceEvent', complianceEventSchema);
