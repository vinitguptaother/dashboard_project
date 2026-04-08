// backend/utils/logActivity.js
// Fire-and-forget activity logger. Identical pattern to trackAPI.js.
// Logs dashboard events to MongoDB 'activity_logs' collection.

const mongoose = require('mongoose');

let collection = null;
let indexCreated = false;

function getCollection() {
  if (collection) return collection;
  if (mongoose.connection.readyState !== 1) return null;
  collection = mongoose.connection.db.collection('activity_logs');
  return collection;
}

/**
 * Log a dashboard activity event. Fire-and-forget — never throws.
 * @param {string} type    - 'screen_import' | 'ai_ranking' | 'trade_setup' | 'paper_trade' | 'options_trade' | 'error' | 'system'
 * @param {string} action  - e.g. 'fetched', 'ranked', 'created', 'closed'
 * @param {object} details - freeform: { screenName, count, symbol, ... }
 */
function logActivity(type, action, details = {}) {
  try {
    const col = getCollection();
    if (!col) return;

    col.insertOne({
      type,
      action,
      details,
      timestamp: new Date(),
    }).catch(() => {});

    if (!indexCreated) {
      indexCreated = true;
      col.createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * 86400 }).catch(() => {});
      col.createIndex({ type: 1, timestamp: -1 }).catch(() => {});
    }
  } catch (e) {
    // Never throw — logging must not break functionality
  }
}

module.exports = logActivity;
