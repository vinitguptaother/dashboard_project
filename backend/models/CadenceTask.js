const mongoose = require('mongoose');

/**
 * CadenceTask — registry of every scheduled activity the dashboard knows about.
 *
 * Covers BOTH:
 *   - System crons (IV snapshot, screen scoring, token check, etc.)
 *   - User activities (journal review, weekly screen update, monthly portfolio review)
 *
 * Watchdog cron compares lastRunAt against expectedNextRun + graceMinutes
 * and flags status='missed'. Frontend surfaces missed tasks via bell + toast.
 *
 * Per CLAUDE.md §Work Style rule #5: every new cron or recurring duty must
 * be seeded here in the same commit that ships it.
 */
const cadenceTaskSchema = new mongoose.Schema({
  // Unique task identifier (used as upsert key)
  taskKey: { type: String, required: true, unique: true },

  // Human-readable
  name: { type: String, required: true },
  description: { type: String, default: '' },

  // system = automated cron; user = manual activity user is expected to do
  type: { type: String, enum: ['system', 'user'], required: true },

  // Cadence category drives the watchdog's expected-interval math
  cadence: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'on-demand', 'custom'],
    required: true,
  },

  // Cron expression (for system tasks) OR free-text schedule (for user tasks, e.g. "every Monday morning")
  schedule: { type: String, default: '' },

  // Timezone name (e.g. 'Asia/Kolkata') — relevant for schedule interpretation
  timezone: { type: String, default: 'Asia/Kolkata' },

  // Time window this task is REQUIRED to run within (minutes after expected run)
  // e.g. daily IV snapshot expected 15:25 IST, graceMinutes=120 = flagged after 17:25 IST
  graceMinutes: { type: Number, default: 120 },

  // Last successful run
  lastRunAt: { type: Date, default: null },
  lastRunStatus: { type: String, enum: ['success', 'failure', 'skipped', 'unknown'], default: 'unknown' },
  lastRunDetails: { type: String, default: '' },

  // Expected next run (computed by reportRun helper + watchdog)
  expectedNextRun: { type: Date, default: null },

  // Current status as of last watchdog pass
  status: {
    type: String,
    enum: ['on-track', 'due-soon', 'missed', 'stale', 'disabled'],
    default: 'on-track',
  },

  // How many consecutive times this task has been flagged missed (for alerting)
  missedCount: { type: Number, default: 0 },

  // Disable the check entirely (e.g. when market is closed for a stretch)
  enabled: { type: Boolean, default: true },

  // Category tag for grouping in the UI (e.g. 'market-data', 'risk', 'journal', 'bot')
  category: { type: String, default: 'general' },

  // Only-run-on-market-days hint; watchdog skips weekend/holiday expectations when true
  marketDaysOnly: { type: Boolean, default: false },
}, {
  timestamps: true,
});

cadenceTaskSchema.index({ status: 1, enabled: 1 });
cadenceTaskSchema.index({ type: 1, category: 1 });

module.exports = mongoose.model('CadenceTask', cadenceTaskSchema);
