// backend/models/TradeSetup.js
// What this does: Stores AI-generated trade setups (entry, SL, target) for stocks.
// Each setup is linked to a screen batch so you can track which screen produced it.

const mongoose = require('mongoose');

const tradeSetupSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  tradeType: {
    type: String,
    enum: ['SWING', 'INVESTMENT'],
    required: true,
  },
  action: {
    type: String,
    enum: ['BUY', 'SELL', 'HOLD', 'AVOID', 'ACCUMULATE'],
    required: true,
  },
  entryPrice: {
    type: Number,
    required: true,
  },
  stopLoss: {
    type: Number,
    required: true,
  },
  target: {
    type: Number,
    required: true,
  },
  currentPrice: {
    type: Number,
    default: null,
  },
  holdingDuration: {
    type: String,        // e.g. "2-4 weeks", "3-6 months"
    required: true,
  },
  riskRewardRatio: {
    type: String,        // e.g. "1:2.5"
    default: null,
  },
  confidence: {
    type: Number,        // 0-100
    default: 50,
  },
  reasoning: {
    type: String,        // AI explanation
    default: '',
  },
  riskFactors: {
    type: [String],
    default: [],
  },
  // Link to the screen batch that produced this stock
  screenBatchId: {
    type: String,
    default: null,
  },
  screenName: {
    type: String,
    default: null,
  },
  // Position sizing — auto-calculated from risk settings when setup is created
  quantity: {
    type: Number,
    default: null,
  },
  investmentAmount: {
    type: Number,
    default: null,
  },
  // Paper trading flag — paper trades use same monitoring but don't count as real
  isPaperTrade: {
    type: Boolean,
    default: true,
  },
  // Where this setup came from
  source: {
    type: String,
    enum: ['SCREENER', 'AI_ANALYSIS', 'MANUAL'],
    default: 'SCREENER',
  },
  // Track outcome later
  status: {
    type: String,
    enum: ['ACTIVE', 'TARGET_HIT', 'SL_HIT', 'EXPIRED', 'CANCELLED'],
    default: 'ACTIVE',
  },
  // When the trade was closed (SL/Target hit or manually changed)
  closedAt: {
    type: Date,
    default: null,
  },
  // The actual price at which the trade closed
  exitPrice: {
    type: Number,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

tradeSetupSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TradeSetup', tradeSetupSchema);
