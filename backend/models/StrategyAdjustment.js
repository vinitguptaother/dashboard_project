/**
 * StrategyAdjustment — proposed parameter drift correction for a strategy.
 *
 * MASTER_PLAN §7 Phase 5 — Strategy Parameter Auto-Adjust.
 *
 * strategyTunerService creates one of these whenever it detects realized
 * metrics (R:R, win-rate, hold duration) drifting beyond threshold from the
 * strategy's expected spec. The user approves or rejects via the
 * /api/strategy-tuner route; the tuner NEVER mutates live strategy code
 * autonomously.
 */
const mongoose = require('mongoose');

const strategyAdjustmentSchema = new mongoose.Schema({
  strategyKey: { type: String, required: true, index: true },

  // A map of proposed parameter changes — e.g. { slMultiplier: 0.9, targetRR: 1.5 }.
  // Interpreted by the tuner's "apply" handler; see strategyTunerService.
  proposedChange: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Human-readable reason — why the tuner proposed this change.
  reason: { type: String, default: '' },

  // The metrics that triggered the proposal (expected vs realized).
  observedMetrics: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Workflow state
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'implemented', 'superseded'],
    default: 'pending',
    index: true,
  },

  approvedAt:    { type: Date, default: null },
  rejectedAt:    { type: Date, default: null },
  implementedAt: { type: Date, default: null },
  approvedBy:    { type: String, default: '' },

  // Linked ActionItem (surfaced in Today tab) for traceability
  actionItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActionItem', default: null },
}, { timestamps: true });

strategyAdjustmentSchema.index({ strategyKey: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('StrategyAdjustment', strategyAdjustmentSchema);
