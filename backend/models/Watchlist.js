const mongoose = require('mongoose');

const watchlistItemSchema = new mongoose.Schema({
  symbol: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, default: '', trim: true },
  addedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  // AI analysis results (populated by periodic analysis)
  lastAnalysis: {
    score: { type: Number, default: null }, // 0-24
    health: { type: Number, default: null },
    growth: { type: Number, default: null },
    valuation: { type: Number, default: null },
    technical: { type: Number, default: null },
    orderFlow: { type: Number, default: null },
    institutional: { type: Number, default: null },
    summary: { type: String, default: '' },
    signal: { type: String, enum: ['BUY', 'SELL', 'HOLD', 'WATCH', null], default: null },
    analyzedAt: { type: Date, default: null },
  },
  // Price tracking
  priceWhenAdded: { type: Number, default: null },
  currentPrice: { type: Number, default: null },
  priceUpdatedAt: { type: Date, default: null },
});

const watchlistSchema = new mongoose.Schema({
  userId: { type: String, default: 'default' },
  items: [watchlistItemSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

watchlistSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Watchlist', watchlistSchema);
