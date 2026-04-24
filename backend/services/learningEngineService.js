/**
 * learningEngineService — BOT_BLUEPRINT #12, MASTER_PLAN §7 Phase 4.
 *
 * Rolling performance + Bayesian win-rate + auto-pause logic for each
 * trading bot. Runs every night (11:30 PM IST, after screen scoring) and
 * writes BotPerformance + ActionItem rows.
 *
 * Public API:
 *   computeBotPerformance({ botId, strategyKey?, regime?, windowDays })
 *   getBayesianWinRate(wins, losses)  — Beta(wins+1, losses+1) credible interval
 *   shouldAutoPauseBot(botId)         — { pause, reason }
 *   runNightlyLearningCycle()         — aggregate for each bot + decide pause/unpause
 *
 * All maths pure JS — no scipy / python. The Beta CI uses a well-known
 * closed-form approximation for the 95% credible interval (Jeffreys / normal
 * approximation on the mean, clamped to [0, 1]).
 *
 * Safety:
 *   - Reads: TradeSetup, BotConfig
 *   - Writes: BotPerformance, ActionItem, and BotConfig.autoPaused flag ONLY.
 *   - Does NOT change trading rules, SL, target, or any strategy params.
 */

const TradeSetup = require('../models/TradeSetup');
const BotPerformance = require('../models/BotPerformance');
const ActionItem = require('../models/ActionItem');

// BotConfig may not exist in some older envs — guard the require.
let BotConfig = null;
try { BotConfig = require('../models/BotConfig'); } catch (_) { /* optional */ }

// Closed-trade statuses (rollup universe)
const CLOSED_STATUSES = ['TARGET_HIT', 'SL_HIT', 'EXPIRED'];
// Auto-pause thresholds (tune carefully — user can override via API)
const AUTO_PAUSE_THRESHOLDS = {
  rollingWindowTrades: 10,
  minWinRate: 0.35,
  sharpeWindow: 15,
  minSharpe: -0.5,
  consecutiveLosses: 3,
};

// ─── Beta credible interval ────────────────────────────────────────────────
/**
 * Approximate 95% credible interval for Beta(a, b).
 * For a = wins + 1, b = losses + 1, uses:
 *   mean  = a / (a + b)
 *   var   = (a * b) / ((a + b)^2 * (a + b + 1))
 *   CI    = mean ± 1.96 * sqrt(var)  (clamped to [0, 1])
 * This normal approximation is accurate enough at n >= 5 for our purposes
 * and avoids pulling in a stats dependency.
 */
function getBayesianWinRate(wins, losses) {
  const w = Math.max(0, Math.floor(wins || 0));
  const l = Math.max(0, Math.floor(losses || 0));
  const a = w + 1;
  const b = l + 1;
  const mean = a / (a + b);
  const variance = (a * b) / (Math.pow(a + b, 2) * (a + b + 1));
  const sd = Math.sqrt(variance);
  const lower = Math.max(0, mean - 1.96 * sd);
  const upper = Math.min(1, mean + 1.96 * sd);
  return {
    mean: +mean.toFixed(4),
    lower: +lower.toFixed(4),
    upper: +upper.toFixed(4),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function pct(entry, exit, isShort = false) {
  if (!entry || !exit) return null;
  const ret = isShort ? (entry - exit) / entry : (exit - entry) / entry;
  return +(ret * 100).toFixed(4);
}

/**
 * Extract realized return % from a closed TradeSetup. Uses netPnL-based %
 * if available (realism engine), otherwise exit price vs entry price.
 */
function tradeReturnPct(t) {
  // Prefer explicit P&L / investment if both present
  if (typeof t.netPnL === 'number' && typeof t.investmentAmount === 'number' && t.investmentAmount > 0) {
    return +(100 * t.netPnL / t.investmentAmount).toFixed(4);
  }
  const exit = t.exitFillPrice ?? t.exitPrice ?? t.currentPrice;
  const entry = t.entryFillPrice ?? t.entryPrice;
  const isShort = t.action === 'SELL';
  return pct(entry, exit, isShort);
}

function sharpe(returnsPct) {
  if (!returnsPct.length) return 0;
  const n = returnsPct.length;
  const mean = returnsPct.reduce((s, x) => s + x, 0) / n;
  const variance = returnsPct.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / Math.max(1, n - 1);
  const sd = Math.sqrt(variance);
  if (!sd) return 0;
  return +(mean / sd).toFixed(4);
}

function profitFactor(returnsPct) {
  let gains = 0, losses = 0;
  for (const r of returnsPct) {
    if (r > 0) gains += r;
    else if (r < 0) losses += -r;
  }
  if (!losses) return gains > 0 ? 99 : 0; // sentinel for "no losses"
  return +(gains / losses).toFixed(4);
}

// ─── computeBotPerformance ─────────────────────────────────────────────────
/**
 * Aggregate a single (bot × strategy × regime × windowDays) slice.
 *
 * @param {Object} opts
 * @param {string} opts.botId
 * @param {string} [opts.strategyKey]  '' or undefined = aggregate across strategies
 * @param {string} [opts.regime]       '' or undefined = aggregate across regimes
 * @param {number} [opts.windowDays=30]
 * @returns {Promise<Object>} the stats object (not yet persisted)
 */
async function computeBotPerformance({ botId, strategyKey = '', regime = '', windowDays = 30 } = {}) {
  if (!botId) throw new Error('computeBotPerformance: botId is required');

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const query = {
    botId,
    status: { $in: CLOSED_STATUSES },
    closedAt: { $gte: since },
  };
  // strategyKey filtering is optional (TradeSetup does not always have it — skip if empty)
  if (strategyKey) query.strategyKey = strategyKey;
  // regime filter — requires trade to carry regimeAtEntry (may be empty on old trades)
  if (regime) query.regimeAtEntry = regime;

  const trades = await TradeSetup.find(query).sort({ closedAt: -1 }).lean();

  const returns = [];
  let wins = 0, losses = 0;
  let best = -Infinity, worst = +Infinity;
  for (const t of trades) {
    const r = tradeReturnPct(t);
    if (r === null || !Number.isFinite(r)) continue;
    returns.push(r);
    if (r >= 0) wins++; else losses++;
    if (r > best) best = r;
    if (r < worst) worst = r;
  }

  const totalTrades = returns.length;
  const winRate = totalTrades ? wins / totalTrades : 0;
  const avgReturnPct = totalTrades ? returns.reduce((s, x) => s + x, 0) / totalTrades : 0;
  const credibleWinRate = getBayesianWinRate(wins, losses);

  // Max drawdown = worst single-trade return in the window (MVP — full equity-curve
  // DD is handled by riskEngineService; we want a quick bot-level read.)
  const maxDrawdown = returns.length ? Math.min(...returns) : 0;

  return {
    botId,
    strategyKey: strategyKey || '',
    regime: regime || '',
    windowDays,
    totalTrades,
    wins,
    losses,
    winRate: +winRate.toFixed(4),
    credibleWinRate,
    avgReturnPct: +avgReturnPct.toFixed(4),
    bestReturn: Number.isFinite(best) ? +best.toFixed(4) : 0,
    worstReturn: Number.isFinite(worst) ? +worst.toFixed(4) : 0,
    sharpe: sharpe(returns),
    profitFactor: profitFactor(returns),
    maxDrawdown: +maxDrawdown.toFixed(4),
    computedAt: new Date(),
  };
}

// ─── shouldAutoPauseBot ────────────────────────────────────────────────────
/**
 * Look at the recent closed trades for a bot and decide whether it should be
 * paused. Returns { pause: boolean, reason: string, cooldownOnly?: boolean }.
 *
 * cooldownOnly = true for 3-consecutive-loss: we flag it but do NOT set the
 * persistent auto-pause; a short-term cooldown is the right response.
 */
async function shouldAutoPauseBot(botId) {
  if (!botId) return { pause: false, reason: 'no botId' };

  // Pull last N trades by close time (largest of any threshold window we need)
  const cap = Math.max(
    AUTO_PAUSE_THRESHOLDS.rollingWindowTrades,
    AUTO_PAUSE_THRESHOLDS.sharpeWindow,
    AUTO_PAUSE_THRESHOLDS.consecutiveLosses
  );
  const recent = await TradeSetup.find({
    botId,
    status: { $in: CLOSED_STATUSES },
  }).sort({ closedAt: -1 }).limit(cap).lean();

  if (!recent.length) return { pause: false, reason: 'no closed trades' };

  // Rule 1: 10-trade rolling win rate < 35% → PAUSE
  const last10 = recent.slice(0, AUTO_PAUSE_THRESHOLDS.rollingWindowTrades);
  if (last10.length >= AUTO_PAUSE_THRESHOLDS.rollingWindowTrades) {
    let wins = 0;
    for (const t of last10) {
      const r = tradeReturnPct(t);
      if (r !== null && r >= 0) wins++;
    }
    const wr = wins / last10.length;
    if (wr < AUTO_PAUSE_THRESHOLDS.minWinRate) {
      return {
        pause: true,
        reason: `10-trade win rate ${(wr * 100).toFixed(1)}% is below ${AUTO_PAUSE_THRESHOLDS.minWinRate * 100}% threshold`,
      };
    }
  }

  // Rule 2: Sharpe < -0.5 over last 15 trades → PAUSE
  const last15 = recent.slice(0, AUTO_PAUSE_THRESHOLDS.sharpeWindow);
  if (last15.length >= AUTO_PAUSE_THRESHOLDS.sharpeWindow) {
    const rets = last15.map(tradeReturnPct).filter(r => r !== null && Number.isFinite(r));
    const s = sharpe(rets);
    if (s < AUTO_PAUSE_THRESHOLDS.minSharpe) {
      return {
        pause: true,
        reason: `15-trade Sharpe ${s.toFixed(2)} is below ${AUTO_PAUSE_THRESHOLDS.minSharpe} threshold`,
      };
    }
  }

  // Rule 3: 3 consecutive losses in last 3 → COOLDOWN (not full pause)
  const last3 = recent.slice(0, AUTO_PAUSE_THRESHOLDS.consecutiveLosses);
  if (last3.length >= AUTO_PAUSE_THRESHOLDS.consecutiveLosses) {
    const allLosses = last3.every(t => {
      const r = tradeReturnPct(t);
      return r !== null && r < 0;
    });
    if (allLosses) {
      return {
        pause: true,
        cooldownOnly: true,
        reason: '3 consecutive losing trades — short cooldown recommended',
      };
    }
  }

  return { pause: false, reason: 'all checks passed' };
}

// ─── Persist one slice ─────────────────────────────────────────────────────
async function upsertPerformance(stats, autoPauseInfo) {
  const update = {
    ...stats,
    autoPaused: !!(autoPauseInfo && autoPauseInfo.pause && !autoPauseInfo.cooldownOnly),
    pausedReason: autoPauseInfo?.pause ? (autoPauseInfo.reason || '') : '',
  };
  await BotPerformance.findOneAndUpdate(
    {
      botId: stats.botId,
      strategyKey: stats.strategyKey,
      regime: stats.regime,
      windowDays: stats.windowDays,
    },
    { $set: update, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// ─── Maintain BotConfig.autoPaused (best-effort; no-op if model missing) ───
async function syncBotConfigPauseFlag(botId, pause, reason) {
  if (!BotConfig) return;
  try {
    const cfg = await BotConfig.findOne({ botId });
    if (!cfg) return;
    // Only flip the flag — do NOT touch enabled (user controls that).
    if (pause && !cfg.autoPaused) {
      cfg.autoPaused = true;
      cfg.autoPausedReason = reason || '';
      cfg.autoPausedAt = new Date();
      await cfg.save();
    } else if (!pause && cfg.autoPaused) {
      cfg.autoPaused = false;
      cfg.autoPausedReason = '';
      cfg.autoPausedAt = null;
      await cfg.save();
    }
  } catch (err) {
    console.warn('[learning-engine] syncBotConfigPauseFlag failed:', err.message);
  }
}

// ─── runNightlyLearningCycle ───────────────────────────────────────────────
async function runNightlyLearningCycle() {
  const startedAt = Date.now();
  const botIds = ['swing', 'longterm', 'options-sell', 'options-buy'];
  const results = [];

  for (const botId of botIds) {
    try {
      const perf = await computeBotPerformance({ botId, windowDays: 30 });
      const pauseDecision = await shouldAutoPauseBot(botId);
      await upsertPerformance(perf, pauseDecision);

      // Persistent pause only — cooldowns don't flip BotConfig
      if (!pauseDecision.cooldownOnly) {
        await syncBotConfigPauseFlag(botId, pauseDecision.pause, pauseDecision.reason);
      }

      // Surface to Today tab if a material change
      if (pauseDecision.pause) {
        await ActionItem.findOneAndUpdate(
          { dedupKey: `learning:auto-pause:${botId}`, status: { $in: ['new', 'acknowledged'] } },
          {
            $set: {
              title: `${botId} bot ${pauseDecision.cooldownOnly ? 'cooldown' : 'auto-paused'}`,
              description: pauseDecision.reason || '',
              impact: pauseDecision.cooldownOnly
                ? 'The bot will skip its next scheduled run to break the losing streak.'
                : 'The bot will not place new paper trades until you re-enable it or performance recovers.',
              action: 'Review recent trades → decide whether to re-enable or retrain the strategy.',
              priority: pauseDecision.cooldownOnly ? 'MEDIUM' : 'HIGH',
              source: 'sentinel',
              botId,
            },
            $setOnInsert: {
              dedupKey: `learning:auto-pause:${botId}`,
              status: 'new',
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      results.push({ botId, perf, pauseDecision });
    } catch (err) {
      console.warn(`[learning-engine] bot=${botId} cycle failed:`, err.message);
      results.push({ botId, error: err.message });
    }
  }

  return {
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    botsProcessed: results.length,
    results,
  };
}

module.exports = {
  computeBotPerformance,
  getBayesianWinRate,
  shouldAutoPauseBot,
  runNightlyLearningCycle,
  // exported for tests / Meta-Critic
  _sharpe: sharpe,
  _profitFactor: profitFactor,
  _tradeReturnPct: tradeReturnPct,
  AUTO_PAUSE_THRESHOLDS,
};
