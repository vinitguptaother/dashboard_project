// backend/utils/trackAPI.js
// Fire-and-forget API usage tracker. Logs every Perplexity call to MongoDB.
// Uses schemaless collection (no Mongoose model needed).

const mongoose = require('mongoose');

let collection = null;
let indexCreated = false;

function getCollection() {
  if (collection) return collection;
  if (mongoose.connection.readyState !== 1) return null;
  collection = mongoose.connection.db.collection('api_usage_logs');
  return collection;
}

// Perplexity sonar-pro pricing (as of March 2026)
const COST_PER_1K = {
  'sonar-pro':                          { input: 0.003, output: 0.015 },
  'llama-3.1-sonar-small-128k-online':  { input: 0.0002, output: 0.0008 },
};

/**
 * Track an external API call. Fire-and-forget — never throws, never blocks.
 * @param {string} provider  - 'perplexity' | 'upstox' | 'yahoo'
 * @param {string} endpoint  - e.g. 'stock-recommendation', 'screen-ranking'
 * @param {object} meta      - { inputTokens, outputTokens, success, model }
 */
function trackAPI(provider, endpoint, meta = {}) {
  try {
    const col = getCollection();
    if (!col) return;

    const rates = COST_PER_1K[meta.model] || COST_PER_1K['sonar-pro'];
    const inputTokens = meta.inputTokens || 0;
    const outputTokens = meta.outputTokens || 0;
    const estimatedCost = (inputTokens * rates.input + outputTokens * rates.output) / 1000;

    col.insertOne({
      provider,
      endpoint,
      model: meta.model || 'unknown',
      inputTokens,
      outputTokens,
      estimatedCost: parseFloat(estimatedCost.toFixed(6)),
      success: meta.success !== false,
      timestamp: new Date(),
    }).catch(() => {}); // silently ignore write errors

    // Create TTL index once (90-day auto-cleanup)
    if (!indexCreated) {
      indexCreated = true;
      col.createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * 86400 }).catch(() => {});
    }
  } catch (e) {
    // Never throw — tracking must not break API functionality
  }
}

module.exports = trackAPI;
