const mongoose = require('mongoose');

/**
 * MasterRefreshRun — audit record of every Master Refresh Button invocation.
 *
 * The Master Refresh Button is an orchestrator that runs EVERY data refresh
 * and (optionally) every AI agent in one click. Each run is persisted here
 * so the user can see history + inspect failures.
 *
 * One row per run. 'quick' mode is data-only (no AI). 'full' mode includes
 * agents (Claude Sonnet). Costs are aggregated from sub-agent LLMUsage.
 *
 * Safety:
 *   - This model is WRITE-ONLY from masterRefreshService — no other service
 *     should modify these rows.
 */
const masterRefreshRunSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  mode: { type: String, enum: ['quick', 'full'], required: true },
  trigger: { type: String, enum: ['manual', 'keyboard', 'cron', 'api'], default: 'manual' },

  // Timing
  startedAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date, default: null },
  durationMs: { type: Number, default: 0 },

  // Status
  status: {
    type: String,
    enum: ['running', 'success', 'partial', 'failure'],
    default: 'running',
    index: true,
  },

  // Granular progress: each sub-task records here
  // { key, label, status: 'pending'|'running'|'done'|'failed'|'skipped', startedAt, completedAt, durationMs, details, error, costUSD }
  steps: { type: Array, default: [] },

  // Full aggregated results object keyed by sub-task name
  results: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Captured errors (one per failed sub-task)
  errors: { type: Array, default: [] },

  // Human-readable one-line summary for the UI history list
  summary: { type: String, default: '' },

  // Aggregated cost of all AI sub-tasks (Sonnet runs in full mode)
  costUSD: { type: Number, default: 0 },

  // Optional: caller note / tag
  note: { type: String, default: '' },
}, { timestamps: true });

masterRefreshRunSchema.index({ startedAt: -1 });
masterRefreshRunSchema.index({ mode: 1, startedAt: -1 });

module.exports = mongoose.model('MasterRefreshRun', masterRefreshRunSchema);
