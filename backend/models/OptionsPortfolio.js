const mongoose = require('mongoose');

const optionsPortfolioSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  color: { type: String, default: '#3B82F6' }, // blue default
  trades: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OptionsTrade' }],
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

optionsPortfolioSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('OptionsPortfolio', optionsPortfolioSchema);
