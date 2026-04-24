const mongoose = require('mongoose');

/**
 * LLMUsage — tracks every LLM API call for cost visibility.
 *
 * Written by backend/services/llmService.js after every claudeChat,
 * perplexityAsk, and openaiEmbed call. Consumed by:
 *   - /api/agents/usage?days=30 (aggregates for UI)
 *   - Future: Chief Analyst "budget watch" surface
 *
 * Keep this schema minimal and write-once — never update rows.
 */
const llmUsageSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['anthropic', 'perplexity', 'openai'],
    required: true,
    index: true,
  },
  model: { type: String, required: true },
  operation: { type: String, default: '' },     // e.g. 'market-scout:run', 'chatbot'
  tokensIn: { type: Number, default: 0 },
  tokensOut: { type: Number, default: 0 },
  costUSD: { type: Number, default: 0 },
  agentId: { type: String, default: '', index: true }, // e.g. 'market-scout'
  success: { type: Boolean, default: true },
  errorMessage: { type: String, default: '' },
  at: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

llmUsageSchema.index({ at: -1 });
llmUsageSchema.index({ agentId: 1, at: -1 });

module.exports = mongoose.model('LLMUsage', llmUsageSchema);
