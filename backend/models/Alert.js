const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  alertType: {
    type: String,
    enum: ['price', 'volume', 'change_percent', 'technical'],
    required: true
  },
  condition: {
    type: String,
    enum: ['above', 'below', 'equals'],
    required: true
  },
  targetValue: {
    type: Number,
    required: true
  },
  currentValue: {
    type: Number,
    default: 0
  },
  message: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isTriggered: {
    type: Boolean,
    default: false
  },
  triggeredAt: Date,
  notificationSent: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  expiresAt: Date,
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
alertSchema.index({ userId: 1, isActive: 1 });
alertSchema.index({ symbol: 1, isActive: 1 });
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update updatedAt on save
alertSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Alert', alertSchema);