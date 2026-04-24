const mongoose = require('mongoose');

/**
 * ParticipantOI — daily NSE "Participant-wise Open Interest" snapshot.
 *
 * Phase 2 Track A, Edge Signal #1.
 *
 * NSE publishes this once per trading day EOD. It's the single highest-leverage
 * Indian derivatives positioning signal: it shows how FIIs, DIIs, Pro traders
 * and Clients are positioned in index futures + options.
 *
 * Long/Short ratios are derived:
 *   ratio = long_contracts / short_contracts
 *   >1 means net-long bias, <1 means net-short bias.
 *
 * All long/short ratios are snapshots for the date — one row per date.
 */
const participantOISchema = new mongoose.Schema({
  // Date in YYYY-MM-DD (IST) — unique key
  date: { type: String, required: true, unique: true, index: true },

  // Long/Short ratios — derived from NSE participant-wise OI
  // Each ratio: >1 = net long bias, <1 = net short bias
  client_long_short_ratio: { type: Number, default: 0 },
  fii_long_short_ratio_futures: { type: Number, default: 0 },
  fii_long_short_ratio_options: { type: Number, default: 0 },
  dii_long_short_ratio: { type: Number, default: 0 },
  pro_long_short_ratio: { type: Number, default: 0 },

  // Source of data (for transparency)
  source: { type: String, default: 'nse' },
  sourceDateRaw: { type: String, default: '' },

  // Raw NSE payload captured — kept for debugging + downstream re-parse
  raw: { type: mongoose.Schema.Types.Mixed, default: null },

  fetchedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

participantOISchema.index({ date: -1 });

module.exports = mongoose.model('ParticipantOI', participantOISchema);
