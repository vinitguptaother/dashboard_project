const mongoose = require('mongoose');

/**
 * AgentMemory — persistent scratchpad for each AI research agent.
 *
 * MASTER_PLAN §3-4. One document per agent (keyed by agentKey).
 * Each agent maintains its own named "stores" (key → arbitrary content).
 *
 * Example: Market Scout uses:
 *   stores.lastBriefing    — last briefing text + timestamp
 *   stores.runningThesis   — ongoing hypothesis about market direction
 *
 * Agents are expected to compact/prune their own memory over time to
 * keep costs predictable.
 */
const agentMemorySchema = new mongoose.Schema({
  agentKey: { type: String, required: true, unique: true, index: true },
  stores: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('AgentMemory', agentMemorySchema);
