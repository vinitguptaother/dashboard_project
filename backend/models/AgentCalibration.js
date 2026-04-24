/**
 * AgentCalibration — Meta-Critic's audit of every AI research agent.
 *
 * MASTER_PLAN §7 Phase 4. One document per (agentKey × metric × window).
 * Written weekly by Meta-Critic. Consumed by Chief Analyst + UI as
 * "how much should we trust this agent right now?"
 *
 * Metrics:
 *   accuracy    — of verifiable predictions, what % came true?
 *   consistency — do similar inputs produce similar outputs?
 *   utility     — were ActionItems accepted / dismissed / resolved?
 *
 * Meta-Critic can ONLY write here. It cannot modify the agent's code or
 * auto-disable any agent — only surface recommendations to the user via
 * ActionItems.
 */
const mongoose = require('mongoose');

const agentCalibrationSchema = new mongoose.Schema({
  agentKey: {
    type: String,
    required: true,
    index: true,   // 'market-scout', 'chief-analyst', etc.
  },
  metric: {
    type: String,
    required: true,
    enum: ['accuracy', 'consistency', 'utility'],
    index: true,
  },
  // 0-1 score, where 1 = perfect
  currentScore: { type: Number, default: 0.5, min: 0, max: 1 },
  // Meta-Critic's suggested delta (e.g. -0.15 = "dampen confidence by 15%")
  recommendedAdjustment: { type: Number, default: 0 },
  // Plain-English reasoning for the adjustment
  rationale: { type: String, default: '' },

  // Sample size (how many runs this score is based on)
  sampleSize: { type: Number, default: 0 },
  windowDays: { type: Number, default: 30 },

  evaluatedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

agentCalibrationSchema.index(
  { agentKey: 1, metric: 1, windowDays: 1 },
  { unique: true }
);

module.exports = mongoose.model('AgentCalibration', agentCalibrationSchema);
