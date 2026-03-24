const mongoose = require('mongoose');

const screenSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  query: {
    type: String,
    default: '',
    trim: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  // Performance scoring — updated nightly by screenScoringService
  performanceScore: { type: Number, default: null },  // 0-100 composite score
  totalBatches: { type: Number, default: 0 },
  avgHitRate: { type: Number, default: null },         // % of ranked stocks that went up
  avgAIWinRate: { type: Number, default: null },       // % of AI setups that hit target
  avgReturn: { type: Number, default: null },          // avg return % across resolved trades
  status: {
    type: String,
    enum: ['new', 'active', 'underperforming', 'retired'],
    default: 'new',
  },
  lastScoredAt: { type: Date, default: null },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

screenSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Screen', screenSchema);
