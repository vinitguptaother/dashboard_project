const mongoose = require('mongoose');

const instrumentSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    default: '',
    trim: true
  },
  exchange: {
    type: String,
    required: true,
    trim: true
  },
  token: {
    type: String,
    required: true,
    trim: true
  },
  segment: {
    type: String,
    default: '',
    trim: true
  },
  isin: {
    type: String,
    default: '',
    trim: true
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
instrumentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for fast search by symbol/name
instrumentSchema.index({ symbol: 1 });
instrumentSchema.index({ name: 1 });

module.exports = mongoose.model('Instrument', instrumentSchema);
