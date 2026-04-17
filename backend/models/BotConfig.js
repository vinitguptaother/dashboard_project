const mongoose = require('mongoose');

/**
 * BotConfig — per-bot configuration record.
 *
 * BOT_BLUEPRINT items #1-#4 (Swing / Long-term / Options Sell / Options Buy).
 *
 * Each bot has:
 *   • a declared `botId` + `algoId` (SEBI compliance #46)
 *   • a primary `screenId` (Sprint 3 Scanner reads the latest batch of this screen)
 *   • a cron schedule (string, Asia/Kolkata TZ)
 *   • enabled/disabled flag + strategyNotes
 *   • preferred liquidityBand + topN + risk overrides (SL%, R:R)
 *
 * Seeded idempotently on boot. User edits via Settings or the BotOpsPanel.
 */
const botConfigSchema = new mongoose.Schema({
  botId: {
    type: String,
    enum: ['swing', 'longterm', 'options-sell', 'options-buy'],
    required: true,
    unique: true,
  },
  algoId: { type: String, required: true, uppercase: true }, // mirrors AlgoRegistry
  displayName: { type: String, required: true },
  enabled: { type: Boolean, default: false },                // default OFF — user enables explicitly
  screenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Screen', default: null },
  topN: { type: Number, default: 5, min: 1, max: 20 },
  liquidityBand: { type: String, enum: ['LARGE', 'MID', 'SMALL', 'ILLIQUID', 'OPTIONS'], default: 'MID' },
  cronSchedule: { type: String, default: '' },               // e.g. '0 9 * * 1-5'
  cronDescription: { type: String, default: '' },            // human-readable
  persistAccepted: { type: Boolean, default: true },         // if true, accepted candidates become real TradeSetups
  risk: {
    slPct: { type: Number, default: null },
    rr: { type: Number, default: null },
  },
  strategyNotes: { type: String, default: '' },
  lastRunAt: { type: Date, default: null },
  lastRunStatus: { type: String, enum: ['success', 'failure', 'skipped', null], default: null },
  lastRunSummary: { type: String, default: '' },
}, { timestamps: true });

botConfigSchema.index({ botId: 1 });

module.exports = mongoose.model('BotConfig', botConfigSchema);
