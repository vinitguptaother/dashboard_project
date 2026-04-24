/**
 * StockVerdict — per-stock AI verdict cache.
 * Phase 2 Track C: Portfolio Analyzer.
 *
 * Each symbol has at most one "fresh" verdict. Expires after 12 hours; when
 * expired, portfolioAnalyzerService regenerates via Claude + Perplexity.
 */

const mongoose = require('mongoose');

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const factorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    score: { type: Number, default: 0 }, // -100..100
    weight: { type: Number, default: 1 }, // relative importance
    note: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const stockVerdictSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
    unique: true,
  },
  verdict: {
    type: String,
    enum: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'],
    default: 'HOLD',
  },
  grade: {
    type: String,
    enum: ['GOOD', 'AVERAGE', 'BAD'],
    default: 'AVERAGE',
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50,
  },
  summary: {
    type: String,
    default: '',
    trim: true,
  },
  detailedReasoning: {
    type: String,
    default: '',
    trim: true,
  },
  factors: {
    type: [factorSchema],
    default: [],
  },
  source: {
    type: String,
    enum: ['claude', 'perplexity', 'placeholder'],
    default: 'placeholder',
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + TWELVE_HOURS_MS),
  },
});

// Convenience helper so callers can treat docs as live/stale without math
stockVerdictSchema.virtual('isFresh').get(function getIsFresh() {
  return this.expiresAt && this.expiresAt.getTime() > Date.now();
});

module.exports = mongoose.model('StockVerdict', stockVerdictSchema);
module.exports.TWELVE_HOURS_MS = TWELVE_HOURS_MS;
