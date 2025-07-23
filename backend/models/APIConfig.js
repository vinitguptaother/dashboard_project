const mongoose = require('mongoose');

const apiConfigSchema = new mongoose.Schema({
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
  provider: {
    type: String,
    required: true,
    enum: ['yahoo_finance', 'alpha_vantage', 'newsapi', 'fmp', 'coingecko', 'perplexity', 'custom']
  },
  category: {
    type: String,
    required: true,
    enum: ['market-data', 'news', 'technical-analysis', 'fundamental-analysis', 'ai-ml', 'crypto']
  },
  endpoint: {
    type: String,
    required: true
  },
  apiKey: {
    type: String,
    required: function() {
      return this.provider !== 'yahoo_finance'; // Yahoo Finance doesn't require API key
    }
  },
  headers: {
    type: Map,
    of: String,
    default: new Map()
  },
  parameters: {
    type: Map,
    of: String,
    default: new Map()
  },
  rateLimit: {
    requestsPerMinute: {
      type: Number,
      default: 60
    },
    requestsPerDay: {
      type: Number,
      default: 1000
    }
  },
  usage: {
    requestsToday: {
      type: Number,
      default: 0
    },
    lastRequestAt: Date,
    totalRequests: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'testing', 'error', 'rate_limited'],
    default: 'disconnected'
  },
  lastTestAt: Date,
  lastError: String,
  latency: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
apiConfigSchema.index({ userId: 1, provider: 1 });
apiConfigSchema.index({ status: 1, isActive: 1 });

// Update updatedAt on save
apiConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Reset daily usage counter
apiConfigSchema.methods.resetDailyUsage = function() {
  this.usage.requestsToday = 0;
  return this.save();
};

// Increment usage counter
apiConfigSchema.methods.incrementUsage = function() {
  this.usage.requestsToday += 1;
  this.usage.totalRequests += 1;
  this.usage.lastRequestAt = new Date();
  return this.save();
};

module.exports = mongoose.model('APIConfig', apiConfigSchema);