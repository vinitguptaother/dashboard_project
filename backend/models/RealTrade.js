const mongoose = require('mongoose');

// RealTrade.js — stores real broker trades that Vinit takes manually
// These are logged AFTER placing the trade on Zerodha/Upstox
// Can be compared against paper trades to track discipline & slippage

const realTradeSchema = new mongoose.Schema({
  underlying: { type: String, required: true, uppercase: true, trim: true },
  expiry: { type: String, required: true },
  strategyName: { type: String, default: 'Custom' },
  legsText: { type: String, default: '' }, // e.g. "SELL CE 24500 @ 120, SELL PE 24000 @ 80"
  entrySpot: { type: Number, required: true },
  exitSpot: { type: Number, default: null },
  netPremium: { type: Number, default: 0 }, // total premium received (CREDIT) or paid (DEBIT)
  premiumType: { type: String, enum: ['CREDIT', 'DEBIT'], default: 'CREDIT' },
  exitPnl: { type: Number, default: null },  // gross P&L before brokerage
  brokerage: { type: Number, default: 0 },   // total brokerage + STT + charges
  broker: { type: String, default: '' },     // e.g. "Zerodha", "Upstox"
  status: { type: String, enum: ['open', 'closed', 'expired'], default: 'open' },
  notes: { type: String, default: '' },      // why you took this trade, any observations
  closedAt: { type: Date, default: null },
  linkedPaperTradeId: { type: String, default: null }, // link to a paper trade for comparison
}, {
  timestamps: true,
});

realTradeSchema.index({ status: 1, createdAt: -1 });
realTradeSchema.index({ underlying: 1 });

module.exports = mongoose.model('RealTrade', realTradeSchema);
