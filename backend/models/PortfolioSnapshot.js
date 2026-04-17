const mongoose = require('mongoose');

/**
 * PortfolioSnapshot — daily EOD equity snapshot used for drawdown tracking.
 *
 * BOT_BLUEPRINT item #10 (Risk Engine).
 *
 * Computed once per trading day at 3:35 PM IST (after close) and stored.
 * Drawdown % = (peakEquity − currentEquity) / peakEquity × 100
 *
 * "Equity" = realized net P&L since inception (sum of closed trades' netPnL)
 * + unrealized P&L on open positions (mark-to-market).
 *
 * This is simulation-only for now (paper trades); when live bots launch the
 * same field means realized + open positions' MTM.
 */
const portfolioSnapshotSchema = new mongoose.Schema({
  date: { type: Date, required: true, index: true },

  realizedPnL: { type: Number, default: 0 },       // sum of netPnL across closed paper trades
  unrealizedPnL: { type: Number, default: 0 },     // (currentPrice − entryPrice) × qty for open trades
  currentEquity: { type: Number, default: 0 },     // realized + unrealized
  peakEquity: { type: Number, default: 0 },        // running max of currentEquity
  drawdownPct: { type: Number, default: 0 },       // (peak − current) / peak * 100

  // Context for debugging / history
  openPositions: { type: Number, default: 0 },
  closedToday: { type: Number, default: 0 },
  notes: { type: String, default: '' },

  computedAt: { type: Date, default: Date.now },
}, { timestamps: true });

portfolioSnapshotSchema.index({ date: -1 });

module.exports = mongoose.model('PortfolioSnapshot', portfolioSnapshotSchema);
