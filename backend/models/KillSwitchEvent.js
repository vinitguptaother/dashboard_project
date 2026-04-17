const mongoose = require('mongoose');

/**
 * KillSwitchEvent — audit log of every kill-switch activation + clearance.
 *
 * BOT_BLUEPRINT item #11. Feeds the Kill Switch Board "recent events"
 * section AND the future SEBI Compliance Log (#46). Every bot decision
 * that was blocked, every manual override, every auto-trip — recorded.
 *
 * Five kill types:
 *   daily-loss        — #15 Daily Loss Breaker (auto-tripped by monitor cron)
 *   post-loss-cooldown — #16 Post-Loss Cooldown (auto after 2 consec losses)
 *   drawdown          — #10 Drawdown Lockout (auto by EOD snapshot)
 *   bot-kill          — #11 per-bot manual kill switch
 *   panic             — #11 "stop all" — trips every kill at once
 */
const killSwitchEventSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ['daily-loss', 'post-loss-cooldown', 'drawdown', 'bot-kill', 'panic'],
    required: true,
    index: true,
  },
  action: {
    type: String,
    enum: ['activate', 'clear'],
    required: true,
  },
  botId: {
    type: String,
    enum: ['manual', 'swing', 'longterm', 'options-sell', 'options-buy', 'all'],
    default: 'all',
  },
  trigger: {
    type: String,
    enum: ['auto', 'manual'],
    required: true,
  },
  reason: { type: String, default: '' },
  metadata: { type: Object, default: null },
  at: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Fast "recent events" query
killSwitchEventSchema.index({ at: -1 });

module.exports = mongoose.model('KillSwitchEvent', killSwitchEventSchema);
