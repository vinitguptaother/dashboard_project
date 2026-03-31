const mongoose = require('mongoose');

const screenBatchSchema = new mongoose.Schema({
  screenId: {
    type: String,
    required: false
  },
  screenName: {
    type: String,
    required: true,
    trim: true
  },
  runDate: {
    type: Date,
    default: Date.now
  },
  symbols: {
    type: [String],
    default: []
  },
  rankedResults: [{
    symbol: String,
    lastPrice: Number,
    prevClose: Number,
    percentChange: Number,
    score: Number,
    aiScore: Number,
    aiBreakdown: {
      health: Number,
      growth: Number,
      valuation: Number,
      technical: Number,
      momentum: Number,
      reason: String
    },
    source: String,   // 'upstox' or 'yahoo' — tells us where the price came from
    error: String
  }],
  notes: {
    type: String,
    default: ''
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

// Update updatedAt on save
screenBatchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ScreenBatch', screenBatchSchema);
