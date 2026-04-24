/**
 * Strategy Library registry.
 *
 * MASTER_PLAN §7 Phase 3. BOT_BLUEPRINT item #8.
 *
 * This module owns the in-memory list of strategy modules + the idempotent
 * seeder that syncs metadata to the `strategies` collection on boot.
 *
 * Strategy modules follow this contract:
 *   module.exports = {
 *     key, name, segment, botId, regimeCompatibility, description,
 *     evaluate: async ({ symbol, candles, lastPrice, atr, supports, resistances, regime, sector, context }) => null | candidate
 *   };
 *   module.exports.backtest = async ({ symbol, fromDate, toDate }) => { runs, winRate, avgReturn, pendingPhase5 };
 *
 * Strategy modules are READ-ONLY: evaluate() must not write to DB.
 */

const Strategy = require('../../models/Strategy');

// Register every strategy module here. Order matters only for tie-breaking.
const _modules = [
  require('./swing-stage2-breakout'),
  require('./swing-ema-pullback'),
  require('./swing-oversold-bounce'),
  require('./swing-post-earnings-momentum'),
  require('./longterm-qvm'),
  require('./options-sell-iv-rank-iron-condor'),
];

// ─── Public getters ─────────────────────────────────────────────────────────

function getAllStrategies() {
  return _modules.slice();
}

function getStrategiesForBot(botId) {
  if (!botId) return [];
  return _modules.filter(s => s.botId === botId);
}

/**
 * Filter by bot AND regime compatibility.
 * If `regime` is falsy / 'unknown', we return the full bot list — missing
 * regime data should not silently hide all strategies.
 */
function getCompatibleStrategies(botId, regime) {
  const forBot = getStrategiesForBot(botId);
  if (!regime || regime === 'unknown') return forBot;
  return forBot.filter(s =>
    !Array.isArray(s.regimeCompatibility) ||
    s.regimeCompatibility.length === 0 ||
    s.regimeCompatibility.includes(regime)
  );
}

function getStrategyByKey(key) {
  if (!key) return null;
  return _modules.find(s => s.key === key) || null;
}

// ─── Seeding ────────────────────────────────────────────────────────────────

/**
 * Idempotent on-boot seed. Like BotConfig / AlgoRegistry:
 * only inserts new docs; does NOT overwrite user-edited `enabled` flag.
 * Does freshen the immutable-but-editable-in-code fields (name, description,
 * regimeCompatibility) so rename / regime adjustments flow through on deploy.
 */
async function seedStrategies() {
  let inserted = 0, updated = 0;
  for (const s of _modules) {
    const metaPatch = {
      name: s.name,
      botId: s.botId,
      segment: s.segment,
      regimeCompatibility: s.regimeCompatibility || [],
      description: s.description || '',
    };
    const existing = await Strategy.findOne({ key: s.key }).lean();
    if (!existing) {
      await Strategy.create({ key: s.key, enabled: true, ...metaPatch });
      inserted += 1;
    } else {
      await Strategy.updateOne({ key: s.key }, { $set: metaPatch });
      updated += 1;
    }
  }
  return { inserted, updated, total: _modules.length };
}

module.exports = {
  getAllStrategies,
  getStrategiesForBot,
  getCompatibleStrategies,
  getStrategyByKey,
  seedStrategies,
};
