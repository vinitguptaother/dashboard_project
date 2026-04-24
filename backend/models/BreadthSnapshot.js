const mongoose = require('mongoose');

/**
 * BreadthSnapshot — point-in-time market breadth for the NIFTY universe.
 *
 * Phase 2 Track A, Edge Signal #2.
 *
 * Advance / Decline ratio + 52-week-high % across the NIFTY 50 (MVP scope).
 * Snapshots are taken hourly during market hours so we can chart breadth
 * divergence vs price over the session.
 *
 * breadth classification:
 *   'bullish'  — advDeclRatio > 1.5 OR pct52WHighs > 8
 *   'bearish'  — advDeclRatio < 0.66 OR pct52WHighs < 1
 *   'neutral'  — everything in between
 */
const breadthSnapshotSchema = new mongoose.Schema({
  adv: { type: Number, default: 0 },          // count of stocks up vs prev close
  decl: { type: Number, default: 0 },         // count down
  unchg: { type: Number, default: 0 },        // unchanged
  advDeclRatio: { type: Number, default: 0 }, // adv / max(decl, 1)
  pct52WHighs: { type: Number, default: 0 },  // % of universe at 52w high (0-100)
  pct52WLows: { type: Number, default: 0 },
  universeSize: { type: Number, default: 0 },
  universe: { type: String, default: 'NIFTY50' }, // 'NIFTY50' | 'NIFTY500'
  breadth: { type: String, enum: ['bullish', 'neutral', 'bearish'], default: 'neutral' },
  timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

breadthSnapshotSchema.index({ timestamp: -1 });

module.exports = mongoose.model('BreadthSnapshot', breadthSnapshotSchema);
