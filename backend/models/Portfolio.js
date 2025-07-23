const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  averagePrice: {
    type: Number,
    required: true,
    min: 0
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  investedAmount: {
    type: Number,
    required: true
  },
  currentValue: {
    type: Number,
    default: 0
  },
  pnl: {
    type: Number,
    default: 0
  },
  pnlPercent: {
    type: Number,
    default: 0
  },
  sector: String,
  exchange: {
    type: String,
    enum: ['NSE', 'BSE'],
    default: 'NSE'
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

const portfolioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['equity', 'mutual_fund', 'mixed'],
    default: 'equity'
  },
  totalInvested: {
    type: Number,
    default: 0
  },
  currentValue: {
    type: Number,
    default: 0
  },
  totalPnL: {
    type: Number,
    default: 0
  },
  totalPnLPercent: {
    type: Number,
    default: 0
  },
  positions: [positionSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update portfolio totals before saving
portfolioSchema.pre('save', function(next) {
  this.totalInvested = this.positions.reduce((sum, pos) => sum + pos.investedAmount, 0);
  this.currentValue = this.positions.reduce((sum, pos) => sum + pos.currentValue, 0);
  this.totalPnL = this.currentValue - this.totalInvested;
  this.totalPnLPercent = this.totalInvested > 0 ? (this.totalPnL / this.totalInvested) * 100 : 0;
  this.updatedAt = Date.now();
  next();
});

// Index for faster queries
portfolioSchema.index({ userId: 1, createdAt: -1 });
portfolioSchema.index({ 'positions.symbol': 1 });

module.exports = mongoose.model('Portfolio', portfolioSchema);