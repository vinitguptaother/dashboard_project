const mongoose = require('mongoose');

const marketDataSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  exchange: {
    type: String,
    enum: ['NSE', 'BSE', 'INDEX'],
    default: 'NSE'
  },
  price: {
    type: Number,
    required: true
  },
  change: {
    type: Number,
    default: 0
  },
  changePercent: {
    type: Number,
    default: 0
  },
  volume: {
    type: Number,
    default: 0
  },
  dayHigh: Number,
  dayLow: Number,
  open: Number,
  previousClose: Number,
  marketCap: Number,
  pe: Number,
  pb: Number,
  dividend: Number,
  dividendYield: Number,
  eps: Number,
  bookValue: Number,
  faceValue: Number,
  sector: String,
  industry: String,
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    enum: ['yahoo_finance', 'alpha_vantage', 'manual'],
    default: 'yahoo_finance'
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Compound index for efficient queries
marketDataSchema.index({ symbol: 1, lastUpdated: -1 });
marketDataSchema.index({ exchange: 1, lastUpdated: -1 });

// TTL index to automatically remove old data (keep for 7 days)
marketDataSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 604800 });

// Static method to get latest data for symbol
marketDataSchema.statics.getLatest = function(symbol) {
  return this.findOne({ symbol: symbol.toUpperCase(), isActive: true })
    .sort({ lastUpdated: -1 });
};

// Static method to get multiple symbols
marketDataSchema.statics.getMultiple = function(symbols) {
  return this.find({ 
    symbol: { $in: symbols.map(s => s.toUpperCase()) }, 
    isActive: true 
  }).sort({ lastUpdated: -1 });
};

module.exports = mongoose.model('MarketData', marketDataSchema);