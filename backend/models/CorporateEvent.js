const mongoose = require('mongoose');

/**
 * CorporateEvent — unified store for NSE corporate actions + board meetings
 * (earnings announcements).
 *
 * BOT_BLUEPRINT item #27.
 *
 * Two `kind`s merged into one collection so the widget can render a single
 * time-sorted calendar:
 *   • 'action'   — dividends, splits, bonuses, buybacks, rights issues
 *   • 'meeting'  — board meetings (commonly quarterly earnings)
 *
 * Refreshed daily at 7 AM IST. Dedup key is (symbol + date + kind + subject).
 */
const corporateEventSchema = new mongoose.Schema({
  symbol: { type: String, required: true, index: true },
  company: { type: String, default: '' },
  isin: { type: String, default: '' },
  kind: { type: String, enum: ['action', 'meeting'], required: true },

  // When it happens (ex-date for actions, meeting date for earnings)
  eventDate: { type: Date, required: true, index: true },

  // For actions: "Dividend — ₹8.5/sh" · "Bonus — 1:2" · "Split — ₹10→₹5" · "Buy Back"
  // For meetings: "Financial Results" · "Financial Results/Dividend"
  subject: { type: String, default: '' },

  // Extra metadata
  rawPurpose: { type: String, default: '' }, // unparsed purpose from NSE
  recordDate: { type: Date, default: null },
  faceValue: { type: String, default: '' },
  series: { type: String, default: '' },
  description: { type: String, default: '' }, // board meeting long desc (truncated)

  source: { type: String, default: 'nse' },
  fetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Dedup via unique compound key
corporateEventSchema.index({ symbol: 1, eventDate: 1, kind: 1, subject: 1 }, { unique: true });
// Calendar queries
corporateEventSchema.index({ eventDate: 1, kind: 1 });

module.exports = mongoose.model('CorporateEvent', corporateEventSchema);
