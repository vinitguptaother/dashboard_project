const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  summary: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  content: {
    type: String,
    trim: true
  },
  url: {
    type: String,
    required: true,
    unique: true
  },
  imageUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid image URL'
    }
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'market-news',
      'sector-news', 
      'company-news',
      'economic-policy',
      'global-markets',
      'commodities',
      'currency',
      'ipos',
      'earnings',
      'analysis'
    ],
    default: 'market-news'
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    default: 'neutral'
  },
  impact: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  relevantStocks: [{
    type: String,
    uppercase: true
  }],
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  publishedAt: {
    type: Date,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
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

// Indexes for better query performance
newsSchema.index({ category: 1, publishedAt: -1 });
newsSchema.index({ tags: 1, publishedAt: -1 });
newsSchema.index({ relevantStocks: 1, publishedAt: -1 });
newsSchema.index({ sentiment: 1, publishedAt: -1 });
newsSchema.index({ title: 'text', summary: 'text', content: 'text' });

// Update updatedAt on save
newsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get trending news
newsSchema.statics.getTrending = function(limit = 10) {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  return this.find({
    publishedAt: { $gte: oneDayAgo },
    isActive: true
  })
  .sort({ views: -1, likes: -1, publishedAt: -1 })
  .limit(limit);
};

// Static method to get featured news
newsSchema.statics.getFeatured = function(limit = 5) {
  return this.find({
    isFeatured: true,
    isActive: true
  })
  .sort({ publishedAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('News', newsSchema);