/**
 * PortfolioHolding — a single broker-imported holding.
 * Phase 2 Track C: Portfolio Analyzer.
 *
 * One document per symbol per user. Re-importing a CSV replaces existing
 * holdings (see POST /api/portfolio-analyzer/upload).
 */

const mongoose = require('mongoose');

const portfolioHoldingSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: 'default', // single-user dashboard
    index: true,
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  company: {
    type: String,
    default: '',
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  avgBuyPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  currentPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  investedValue: {
    type: Number,
    default: 0,
  },
  currentValue: {
    type: Number,
    default: 0,
  },
  unrealizedPnL: {
    type: Number,
    default: 0,
  },
  unrealizedPnLPct: {
    type: Number,
    default: 0,
  },
  buyDate: {
    type: Date,
    default: null,
  },
  source: {
    type: String,
    enum: ['upstox', 'manual-csv', 'broker-api'],
    default: 'manual-csv',
  },
  importedAt: {
    type: Date,
    default: Date.now,
  },
});

// Recompute derived values before save
portfolioHoldingSchema.pre('save', function preSave(next) {
  this.investedValue = this.quantity * this.avgBuyPrice;
  this.currentValue = this.quantity * (this.currentPrice || this.avgBuyPrice);
  this.unrealizedPnL = this.currentValue - this.investedValue;
  this.unrealizedPnLPct =
    this.investedValue > 0 ? (this.unrealizedPnL / this.investedValue) * 100 : 0;
  next();
});

portfolioHoldingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model('PortfolioHolding', portfolioHoldingSchema);
