/**
 * Kill Switch Service — unified view + control for all trading kill states.
 *
 * BOT_BLUEPRINT item #11. One surface for:
 *   • Daily Loss Breaker (#15) — auto-tripped when daily P&L hits limit
 *   • Post-Loss Cooldown (#16) — auto after 2 consecutive losses
 *   • Drawdown Lockout (#10) — auto when equity drops >= maxDrawdownPct
 *   • Per-bot kills (new #11) — manual per-bot halt
 *   • Panic — activates ALL of the above with one call
 *
 * Every activation + clearance is logged to KillSwitchEvent for the
 * Compliance Log (#46).
 *
 * Public surface:
 *   getUnifiedState()        — aggregate {globalBlocked, blockers[], perBot{}}
 *   activateBotKill(botId, reason)
 *   clearBotKill(botId, reason)
 *   panic(reason)            — trips kill switch + drawdown lockout + all bot kills
 *   clearAll(reason)         — requires explicit call; clears everything
 *   recordEvent(kind, action, ...)   — internal; also callable for auto-trips
 *   getRecentEvents(limit)
 */

const RiskSettings = require('../models/RiskSettings');
const KillSwitchEvent = require('../models/KillSwitchEvent');

const BOT_KEYS = {
  swing: 'swing',
  longterm: 'longterm',
  'options-sell': 'optionsSell',
  'options-buy': 'optionsBuy',
};

async function getSettings() {
  let s = await RiskSettings.findOne({ userId: 'default' });
  if (!s) s = await RiskSettings.create({ userId: 'default' });
  return s;
}

async function recordEvent({ kind, action, botId = 'all', trigger = 'manual', reason = '', metadata = null }) {
  try {
    const ev = await KillSwitchEvent.create({ kind, action, botId, trigger, reason, metadata });
    // BOT_BLUEPRINT #46 — mirror kill events to the SEBI Compliance Log.
    // Activation of any kill = effectively a 'canceled' signal for affected bot(s).
    try {
      const compliance = require('./complianceService');
      await compliance.recordEvent({
        botId: botId === 'all' ? 'manual' : botId,
        decision: action === 'activate' ? 'canceled' : 'evaluated',
        reasoning: `${kind}:${action}${reason ? ' — ' + reason : ''}`,
        reasons: [kind, action, `trigger=${trigger}`],
      });
    } catch (e) { /* logged inside */ }
    return ev;
  } catch (err) {
    console.warn('[kill-switch] event log failed:', err.message);
    return null;
  }
}

async function getUnifiedState() {
  const s = await getSettings();
  const blockers = [];
  const now = Date.now();

  // 1) Daily Loss Breaker
  if (s.killSwitchActive) {
    blockers.push({
      kind: 'daily-loss',
      label: 'Daily Loss Breaker',
      since: s.killSwitchDate,
      reason: 'Daily loss limit hit — override required.',
      clearable: true,
      clearVia: 'POST /api/risk/kill-switch/override (confirmation: "UNLOCK")',
    });
  }

  // 2) Post-Loss Cooldown
  if (s.cooldownUntil && new Date(s.cooldownUntil).getTime() > now) {
    const msRemaining = new Date(s.cooldownUntil).getTime() - now;
    blockers.push({
      kind: 'post-loss-cooldown',
      label: 'Post-Loss Cooldown',
      since: null,
      reason: s.cooldownReason || '2 consecutive losses — cooldown active',
      msRemaining,
      until: s.cooldownUntil,
      clearable: true,
      clearVia: 'POST /api/risk/cooldown/clear',
    });
  }

  // 3) Drawdown Lockout
  if (s.drawdownLockoutActive) {
    blockers.push({
      kind: 'drawdown',
      label: 'Drawdown Lockout',
      since: s.drawdownLockoutTriggeredAt,
      reason: `Equity drawdown crossed ${s.maxDrawdownPct}% threshold`,
      clearable: true,
      clearVia: 'POST /api/risk-engine/drawdown-lockout/clear (confirmation: "UNLOCK")',
    });
  }

  // 4) Per-bot kills
  const perBot = {};
  for (const [botId, key] of Object.entries(BOT_KEYS)) {
    const k = s.botKillSwitches?.[key];
    const active = !!(k && k.active);
    perBot[botId] = {
      active,
      reason: k?.reason || '',
      activatedAt: k?.activatedAt || null,
    };
    if (active) {
      blockers.push({
        kind: 'bot-kill',
        label: `Bot kill — ${botId}`,
        botId,
        since: k.activatedAt,
        reason: k.reason || 'Manually killed',
        clearable: true,
        clearVia: `POST /api/kill-switches/bot-kill/clear with { botId: "${botId}" }`,
      });
    }
  }

  // Global blocked = ANY global-scope blocker (not bot-kill; bot-kills only
  // block that specific bot, other bots can still trade).
  const globalBlocked = blockers.some(b => b.kind !== 'bot-kill');

  return {
    globalBlocked,
    blockers,
    perBot,
    capital: s.capital,
    limits: {
      maxDrawdownPct: s.maxDrawdownPct,
      dailyLossLimitPct: s.dailyLossLimitPct,
    },
    computedAt: new Date(),
  };
}

async function activateBotKill(botId, reason = '', trigger = 'manual') {
  const key = BOT_KEYS[botId];
  if (!key) throw new Error(`Unknown botId "${botId}"`);
  const s = await getSettings();
  if (!s.botKillSwitches) s.botKillSwitches = {};
  s.botKillSwitches[key] = { active: true, reason, activatedAt: new Date() };
  s.markModified('botKillSwitches');
  await s.save();
  await recordEvent({ kind: 'bot-kill', action: 'activate', botId, trigger, reason });
  return getUnifiedState();
}

async function clearBotKill(botId, reason = '', trigger = 'manual') {
  const key = BOT_KEYS[botId];
  if (!key) throw new Error(`Unknown botId "${botId}"`);
  const s = await getSettings();
  if (!s.botKillSwitches) s.botKillSwitches = {};
  s.botKillSwitches[key] = { active: false, reason: '', activatedAt: null };
  s.markModified('botKillSwitches');
  await s.save();
  await recordEvent({ kind: 'bot-kill', action: 'clear', botId, trigger, reason });
  return getUnifiedState();
}

async function panic(reason = 'Panic button pressed', trigger = 'manual') {
  const s = await getSettings();
  // 1) Daily loss kill switch
  s.killSwitchActive = true;
  s.killSwitchDate = new Date();
  // 2) Drawdown lockout
  s.drawdownLockoutActive = true;
  s.drawdownLockoutTriggeredAt = new Date();
  // 3) All bot kills
  if (!s.botKillSwitches) s.botKillSwitches = {};
  for (const key of Object.values(BOT_KEYS)) {
    s.botKillSwitches[key] = { active: true, reason: `Panic: ${reason}`, activatedAt: new Date() };
  }
  s.markModified('botKillSwitches');
  await s.save();
  await recordEvent({ kind: 'panic', action: 'activate', botId: 'all', trigger, reason });
  return getUnifiedState();
}

async function clearAll(reason = 'Manually cleared', trigger = 'manual') {
  const s = await getSettings();
  s.killSwitchActive = false;
  s.killSwitchDate = null;
  s.drawdownLockoutActive = false;
  s.drawdownLockoutTriggeredAt = null;
  s.cooldownUntil = null;
  s.cooldownReason = '';
  if (!s.botKillSwitches) s.botKillSwitches = {};
  for (const key of Object.values(BOT_KEYS)) {
    s.botKillSwitches[key] = { active: false, reason: '', activatedAt: null };
  }
  s.markModified('botKillSwitches');
  await s.save();
  await recordEvent({ kind: 'panic', action: 'clear', botId: 'all', trigger, reason });
  return getUnifiedState();
}

async function getRecentEvents(limit = 20) {
  return KillSwitchEvent.find({}).sort({ at: -1 }).limit(Math.min(limit, 200)).lean();
}

// Check if a specific bot is killed (used by evaluateTrade in risk engine).
async function isBotKilled(botId) {
  const key = BOT_KEYS[botId];
  if (!key) return false;
  const s = await RiskSettings.findOne({ userId: 'default' }).lean();
  return !!(s?.botKillSwitches?.[key]?.active);
}

module.exports = {
  getUnifiedState,
  activateBotKill,
  clearBotKill,
  panic,
  clearAll,
  recordEvent,
  getRecentEvents,
  isBotKilled,
};
