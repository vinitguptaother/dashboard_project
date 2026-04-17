const mongoose = require('mongoose');

/**
 * AlgoRegistry — SEBI-mandated declaration of every algo strategy.
 *
 * BOT_BLUEPRINT item #46.
 *
 * Every algorithmic order SEBI reviews must carry a unique algoId tied to
 * a declared strategy document. We pre-register our 4 bots (swing, long-term,
 * options-sell, options-buy) + a MANUAL entry for human-placed trades so the
 * compliance feed is unified.
 *
 * Required fields per SEBI circular (Apr 2026): algoId, strategy, owner,
 * staticIp, approvedAt.
 */
const algoRegistrySchema = new mongoose.Schema({
  algoId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  botId: {
    type: String,
    enum: ['manual', 'swing', 'longterm', 'options-sell', 'options-buy'],
    required: true,
  },
  strategy: { type: String, required: true },        // e.g. "EMA pullback swing (v1)"
  description: { type: String, default: '' },
  owner: { type: String, default: 'Vinit Gupta' },
  staticIp: { type: String, default: '' },           // filled when live; SEBI requires declared static IP
  version: { type: String, default: 'v1' },
  approvedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
}, { timestamps: true });

algoRegistrySchema.index({ algoId: 1 });
algoRegistrySchema.index({ botId: 1, active: 1 });

module.exports = mongoose.model('AlgoRegistry', algoRegistrySchema);
