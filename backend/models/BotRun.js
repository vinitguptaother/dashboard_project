const mongoose = require('mongoose');

/**
 * BotRun — audit record of every bot run (auto or manual).
 *
 * BOT_BLUEPRINT items #1-#4.
 *
 * One row per run. Links back to the ScreenBatch used + every TradeSetup
 * it persisted (via IDs). Surfaces "what did my bot do today" without
 * grepping the compliance feed.
 */
const botRunSchema = new mongoose.Schema({
  botId: { type: String, enum: ['swing', 'longterm', 'options-sell', 'options-buy'], required: true, index: true },
  trigger: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  startedAt: { type: Date, default: Date.now, index: true },
  finishedAt: { type: Date, default: null },
  status: { type: String, enum: ['running', 'success', 'failure', 'skipped'], default: 'running' },

  // Source
  screenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screen', default: null },
  screenName: { type: String, default: '' },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScreenBatch', default: null },

  // Results
  scanned: { type: Number, default: 0 },
  accepted: { type: Number, default: 0 },
  rejected: { type: Number, default: 0 },
  acceptedSetupIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  topRejection: { type: String, default: '' },
  rejectionCounts: { type: Object, default: null },

  // Error / skip reason
  error: { type: String, default: '' },
  skipReason: { type: String, default: '' },

  // Human-readable one-line summary for the UI
  summary: { type: String, default: '' },
}, { timestamps: true });

botRunSchema.index({ startedAt: -1 });
botRunSchema.index({ botId: 1, startedAt: -1 });

module.exports = mongoose.model('BotRun', botRunSchema);
