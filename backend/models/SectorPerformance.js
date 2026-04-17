const mongoose = require('mongoose');

/**
 * SectorPerformance — snapshot of NSE sector index performance at a point in time.
 *
 * BOT_BLUEPRINT item #28. Feeds into:
 *   • Validator Layer (Sprint 3+): swing bot prefers leading sectors
 *   • Idea queue: surfaces stocks in rotating-in sectors
 *   • Screen scoring: sector tailwind boosts conviction
 *
 * Computed every 30 min during market hours by sectorRotationService.
 * Stored history powers the 1W / 1M heatmap + rotation trends.
 */
const sectorSnapshotSchema = new mongoose.Schema({
  name: { type: String, required: true },              // "NIFTY IT"
  instrumentKey: { type: String, required: true },     // "NSE_INDEX|Nifty IT"
  ltp: { type: Number, default: 0 },
  dayChangePct: { type: Number, default: 0 },          // vs previous close
  weekChangePct: { type: Number, default: 0 },         // vs 5 trading days ago
  monthChangePct: { type: Number, default: 0 },        // vs 21 trading days ago
  relStrengthVsNifty1D: { type: Number, default: 0 },  // sector%  −  NIFTY%
  relStrengthVsNifty1W: { type: Number, default: 0 },
  relStrengthVsNifty1M: { type: Number, default: 0 },
}, { _id: false });

const sectorPerformanceSchema = new mongoose.Schema({
  niftyLevel: { type: Number, default: 0 },
  niftyDayChangePct: { type: Number, default: 0 },
  niftyWeekChangePct: { type: Number, default: 0 },
  niftyMonthChangePct: { type: Number, default: 0 },
  sectors: { type: [sectorSnapshotSchema], default: [] },
  leaders: { type: [String], default: [] },   // top 3 sector names by 1W rel strength
  laggards: { type: [String], default: [] },  // bottom 3 sector names by 1W rel strength
  computedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

module.exports = mongoose.model('SectorPerformance', sectorPerformanceSchema);
