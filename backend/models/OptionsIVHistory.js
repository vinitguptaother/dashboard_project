const mongoose = require('mongoose');

/**
 * OptionsIVHistory — daily snapshot of ATM IV for each underlying.
 * Used to compute IV Rank and IV Percentile.
 *
 * ATM IV is the average of call IV and put IV at the strike closest to spot,
 * taken from the nearest expiry.
 */
const optionsIVHistorySchema = new mongoose.Schema({
  underlying: { type: String, required: true, uppercase: true, trim: true },
  date: { type: String, required: true }, // YYYY-MM-DD (IST)
  atmIV: { type: Number, required: true }, // avg of ceIV and peIV at ATM
  ceIV: { type: Number, default: 0 },
  peIV: { type: Number, default: 0 },
  spot: { type: Number, default: 0 },
  atmStrike: { type: Number, default: 0 },
  expiry: { type: String, default: '' }, // which expiry was used
}, {
  timestamps: true,
});

// One snapshot per underlying per day
optionsIVHistorySchema.index({ underlying: 1, date: 1 }, { unique: true });
// Fast range queries by underlying + date
optionsIVHistorySchema.index({ underlying: 1, date: -1 });

module.exports = mongoose.model('OptionsIVHistory', optionsIVHistorySchema);
