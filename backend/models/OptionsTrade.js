const mongoose = require('mongoose');

const optionsLegSchema = new mongoose.Schema({
  type: { type: String, enum: ['CE', 'PE'], required: true },
  strike: { type: Number, required: true },
  premium: { type: Number, required: true },
  qty: { type: Number, default: 1 },
  side: { type: String, enum: ['BUY', 'SELL'], required: true },
  lotSize: { type: Number, default: 1 },
  iv: { type: Number, default: 0 },
  instrumentKey: { type: String, default: '' },
}, { _id: false });

const optionsTradeSchema = new mongoose.Schema({
  underlying: { type: String, required: true, uppercase: true, trim: true },
  expiry: { type: String, required: true },
  strategyName: { type: String, default: 'Custom' },
  legs: [optionsLegSchema],
  entrySpot: { type: Number, required: true },
  exitSpot: { type: Number, default: null },
  netPremium: { type: Number, default: 0 },
  premiumType: { type: String, enum: ['CREDIT', 'DEBIT'], default: 'CREDIT' },
  entryMargin: { type: Number, default: 0 },
  maxProfit: { type: mongoose.Schema.Types.Mixed, default: 0 },  // can be 'Unlimited'
  maxLoss: { type: mongoose.Schema.Types.Mixed, default: 0 },
  breakevens: [Number],
  pop: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'closed', 'expired'], default: 'open' },
  exitPnl: { type: Number, default: null },
  notes: { type: String, default: '' },
  closedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

optionsTradeSchema.index({ status: 1, createdAt: -1 });
optionsTradeSchema.index({ underlying: 1 });

module.exports = mongoose.model('OptionsTrade', optionsTradeSchema);
