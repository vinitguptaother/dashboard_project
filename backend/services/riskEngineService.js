/**
 * Risk Engine Service — unified risk gate for all paper/bot trades.
 *
 * BOT_BLUEPRINT item #10.
 *
 * Aggregates Sprint 1 items (#14 Position Sizing, #15 Daily Loss Breaker,
 * #16 Post-Loss Cooldown) and adds new gates:
 *   • Drawdown lockout (peak-to-trough equity tracking)
 *   • Sector concentration cap
 *   • Per-bot capital utilization + concurrent position cap
 *   • Portfolio-level exposure summary
 *
 * Public surface:
 *   computeSnapshot()           — compute + persist today's EOD snapshot
 *   getDrawdownState()          — { current, peak, drawdownPct, locked, maxPct }
 *   getSectorExposure()         — { bySector: [{ sector, exposure, pct, count }], totalExposed, capital }
 *   getBotCapital()             — { perBot: [{ botId, allocated, deployed, utilizedPct, openPositions }] }
 *   evaluateTrade(candidate)    — returns { allowed, reasons[], checks{} }
 *   getPortfolioState()         — aggregate view used by the RiskEnginePanel widget
 */

const TradeSetup = require('../models/TradeSetup');
const RiskSettings = require('../models/RiskSettings');
const PortfolioSnapshot = require('../models/PortfolioSnapshot');

// ─── Helpers ────────────────────────────────────────────────────────────────

// Defaults for fields added in BOT_BLUEPRINT #10 — applied when existing docs
// predate the schema addition (Mongoose only sets defaults on new docs).
const DEFAULTS = {
  botCapital: { swing: 200000, longterm: 200000, optionsSell: 50000, optionsBuy: 50000 },
  maxConcurrentPositions: { swing: 5, longterm: 10, optionsSell: 3, optionsBuy: 3 },
  maxSectorConcentrationPct: 30,
  maxDrawdownPct: 15,
  drawdownLockoutActive: false,
};

async function getSettings() {
  let s = await RiskSettings.findOne({ userId: 'default' }).lean();
  if (!s) {
    await RiskSettings.create({ userId: 'default' });
    s = await RiskSettings.findOne({ userId: 'default' }).lean();
  }
  // Backfill any missing #10 fields (existing docs won't have them)
  const patch = {};
  if (!s.botCapital || typeof s.botCapital.swing !== 'number') patch.botCapital = DEFAULTS.botCapital;
  if (!s.maxConcurrentPositions || typeof s.maxConcurrentPositions.swing !== 'number') patch.maxConcurrentPositions = DEFAULTS.maxConcurrentPositions;
  if (s.maxSectorConcentrationPct == null) patch.maxSectorConcentrationPct = DEFAULTS.maxSectorConcentrationPct;
  if (s.maxDrawdownPct == null) patch.maxDrawdownPct = DEFAULTS.maxDrawdownPct;
  if (s.drawdownLockoutActive == null) patch.drawdownLockoutActive = DEFAULTS.drawdownLockoutActive;
  if (Object.keys(patch).length > 0) {
    await RiskSettings.findOneAndUpdate({ userId: 'default' }, { $set: patch });
    s = { ...s, ...patch };
  }
  return s;
}

// Realized P&L = sum of netPnL on closed paper trades since inception.
// Falls back to gross estimate (exitPrice-entryPrice)*qty when realism fields missing.
async function computeRealizedPnL() {
  const closed = await TradeSetup.find({
    isPaperTrade: true,
    status: { $in: ['TARGET_HIT', 'SL_HIT'] },
  }).lean();
  let total = 0;
  for (const t of closed) {
    if (t.netPnL != null) { total += t.netPnL; continue; }
    const qty = t.quantity || 0;
    if (!qty || !t.exitPrice || !t.entryPrice) continue;
    const dir = (t.action === 'SELL') ? -1 : 1;
    total += dir * (t.exitPrice - t.entryPrice) * qty;
  }
  return total;
}

// Unrealized = MTM on ACTIVE trades using currentPrice (or entryPrice fallback).
async function computeUnrealizedPnL() {
  const open = await TradeSetup.find({ isPaperTrade: true, status: 'ACTIVE' }).lean();
  let total = 0;
  for (const t of open) {
    const qty = t.quantity || 0;
    const cur = t.currentPrice || t.entryPrice;
    if (!qty || !cur || !t.entryPrice) continue;
    const dir = (t.action === 'SELL') ? -1 : 1;
    total += dir * (cur - t.entryPrice) * qty;
  }
  return total;
}

async function getPeakEquity() {
  const snap = await PortfolioSnapshot.findOne({}).sort({ peakEquity: -1 }).lean();
  return snap?.peakEquity || 0;
}

// ─── Snapshot & drawdown ────────────────────────────────────────────────────

async function computeSnapshot({ persist = true } = {}) {
  const realized = await computeRealizedPnL();
  const unrealized = await computeUnrealizedPnL();
  const currentEquity = parseFloat((realized + unrealized).toFixed(2));
  const prevPeak = await getPeakEquity();
  const peakEquity = Math.max(prevPeak, currentEquity);
  const drawdownPct = peakEquity > 0 ? parseFloat((((peakEquity - currentEquity) / peakEquity) * 100).toFixed(2)) : 0;
  const openPositions = await TradeSetup.countDocuments({ isPaperTrade: true, status: 'ACTIVE' });
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const closedToday = await TradeSetup.countDocuments({
    isPaperTrade: true,
    status: { $in: ['TARGET_HIT', 'SL_HIT'] },
    closedAt: { $gte: startOfDay },
  });

  const doc = {
    date: new Date(),
    realizedPnL: parseFloat(realized.toFixed(2)),
    unrealizedPnL: parseFloat(unrealized.toFixed(2)),
    currentEquity,
    peakEquity: parseFloat(peakEquity.toFixed(2)),
    drawdownPct,
    openPositions,
    closedToday,
  };

  if (persist) {
    return PortfolioSnapshot.create(doc);
  }
  return doc;
}

async function getDrawdownState() {
  const s = await getSettings();
  const realized = await computeRealizedPnL();
  const unrealized = await computeUnrealizedPnL();
  const current = parseFloat((realized + unrealized).toFixed(2));
  const prevPeak = await getPeakEquity();
  const peak = Math.max(prevPeak, current);
  const drawdownPct = peak > 0 ? parseFloat((((peak - current) / peak) * 100).toFixed(2)) : 0;
  return {
    currentEquity: current,
    peakEquity: parseFloat(peak.toFixed(2)),
    drawdownPct,
    maxPct: s.maxDrawdownPct,
    locked: !!s.drawdownLockoutActive,
    triggeredAt: s.drawdownLockoutTriggeredAt,
    realizedPnL: parseFloat(realized.toFixed(2)),
    unrealizedPnL: parseFloat(unrealized.toFixed(2)),
  };
}

// ─── Sector exposure ────────────────────────────────────────────────────────

// Sector is derived from the setup's `screenName` field when available, else
// 'Unclassified'. Proper sector mapping (symbol → sector) will come when the
// Scanner (#5) is built — for now this is a best-effort aggregation.
async function getSectorExposure() {
  const s = await getSettings();
  const open = await TradeSetup.find({ isPaperTrade: true, status: 'ACTIVE' }).lean();
  const bySector = new Map();
  let totalExposed = 0;
  for (const t of open) {
    const sector = t.sector || t.screenName || 'Unclassified';
    const qty = t.quantity || 0;
    const exposure = qty * (t.entryFillPrice || t.entryPrice || 0);
    if (!exposure) continue;
    const entry = bySector.get(sector) || { sector, exposure: 0, count: 0, symbols: [] };
    entry.exposure += exposure;
    entry.count += 1;
    entry.symbols.push(t.symbol);
    bySector.set(sector, entry);
    totalExposed += exposure;
  }
  const arr = Array.from(bySector.values()).map(e => ({
    ...e,
    exposure: parseFloat(e.exposure.toFixed(2)),
    pctOfCapital: s.capital > 0 ? parseFloat(((e.exposure / s.capital) * 100).toFixed(2)) : 0,
  })).sort((a, b) => b.exposure - a.exposure);

  return {
    bySector: arr,
    totalExposed: parseFloat(totalExposed.toFixed(2)),
    capital: s.capital,
    maxConcentrationPct: s.maxSectorConcentrationPct,
    utilizedPct: s.capital > 0 ? parseFloat(((totalExposed / s.capital) * 100).toFixed(2)) : 0,
  };
}

// ─── Per-bot capital utilization ────────────────────────────────────────────

const BOT_IDS = ['manual', 'swing', 'longterm', 'options-sell', 'options-buy'];

async function getBotCapital() {
  const s = await getSettings();
  const open = await TradeSetup.find({ isPaperTrade: true, status: 'ACTIVE' }).lean();
  const buckets = {};
  for (const b of BOT_IDS) {
    const keyMap = { 'swing': 'swing', 'longterm': 'longterm', 'options-sell': 'optionsSell', 'options-buy': 'optionsBuy', 'manual': null };
    buckets[b] = {
      botId: b,
      allocated: b === 'manual' ? null : (s.botCapital?.[keyMap[b]] ?? 0),
      deployed: 0,
      openPositions: 0,
      maxPositions: b === 'manual' ? null : (s.maxConcurrentPositions?.[keyMap[b]] ?? 0),
    };
  }
  for (const t of open) {
    const botId = t.botId || 'manual';
    if (!buckets[botId]) continue;
    const qty = t.quantity || 0;
    const deployed = qty * (t.entryFillPrice || t.entryPrice || 0);
    buckets[botId].deployed += deployed;
    buckets[botId].openPositions += 1;
  }
  const perBot = Object.values(buckets).map(b => ({
    ...b,
    deployed: parseFloat(b.deployed.toFixed(2)),
    utilizedPct: (b.allocated && b.allocated > 0) ? parseFloat(((b.deployed / b.allocated) * 100).toFixed(2)) : null,
  }));
  return { perBot };
}

// ─── Unified evaluate() — the single gate for trade creation ────────────────

async function evaluateTrade(candidate) {
  const {
    botId = 'manual',
    symbol,
    action,
    qty,
    entryPrice,
    stopLoss,
    sector = 'Unclassified',
  } = candidate || {};
  const reasons = [];
  const checks = {};
  const s = await getSettings();

  // 1) Kill switch (daily loss breaker)
  if (s.killSwitchActive) {
    reasons.push('Daily Loss Breaker is active — override required.');
    checks.killSwitch = { active: true };
  } else {
    checks.killSwitch = { active: false };
  }

  // 2) Post-loss cooldown
  if (s.cooldownUntil && new Date(s.cooldownUntil).getTime() > Date.now()) {
    const msRemaining = new Date(s.cooldownUntil).getTime() - Date.now();
    reasons.push(`Post-loss cooldown active — ${Math.ceil(msRemaining / 60000)} min remaining.`);
    checks.cooldown = { active: true, until: s.cooldownUntil, reason: s.cooldownReason };
  } else {
    checks.cooldown = { active: false };
  }

  // 3) Drawdown lockout
  const dd = await getDrawdownState();
  checks.drawdown = { pct: dd.drawdownPct, max: dd.maxPct, locked: dd.locked };
  if (dd.locked || dd.drawdownPct >= dd.maxPct) {
    reasons.push(`Drawdown ${dd.drawdownPct.toFixed(1)}% ≥ max ${dd.maxPct}% — lockout active.`);
  }

  // 4) Per-trade risk cap (from Sprint 1 #14)
  if (qty && entryPrice && stopLoss) {
    const perShareRisk = Math.abs(entryPrice - stopLoss);
    const totalRisk = perShareRisk * qty;
    const riskLimit = (s.capital * s.riskPerTrade) / 100;
    checks.perTradeRisk = { risk: parseFloat(totalRisk.toFixed(2)), limit: parseFloat(riskLimit.toFixed(2)) };
    if (totalRisk > riskLimit) {
      reasons.push(`Per-trade risk ₹${totalRisk.toFixed(0)} exceeds limit ₹${riskLimit.toFixed(0)} (${s.riskPerTrade}% of capital).`);
    }
  }

  // 5) Max position % of capital (from Sprint 1 #14)
  if (qty && entryPrice) {
    const notional = qty * entryPrice;
    const maxPos = (s.capital * s.maxPositionPct) / 100;
    checks.positionSize = { notional: parseFloat(notional.toFixed(2)), maxNotional: parseFloat(maxPos.toFixed(2)) };
    if (notional > maxPos) {
      reasons.push(`Position ₹${notional.toFixed(0)} exceeds max ₹${maxPos.toFixed(0)} (${s.maxPositionPct}% of capital).`);
    }
  }

  // 6) Sector concentration cap (new #10)
  const sectorState = await getSectorExposure();
  const current = sectorState.bySector.find(x => x.sector === sector);
  const currentExposure = current?.exposure || 0;
  const addExposure = (qty && entryPrice) ? qty * entryPrice : 0;
  const newSectorPct = s.capital > 0 ? ((currentExposure + addExposure) / s.capital) * 100 : 0;
  checks.sectorConcentration = {
    sector,
    currentPct: current?.pctOfCapital || 0,
    afterTradePct: parseFloat(newSectorPct.toFixed(2)),
    maxPct: s.maxSectorConcentrationPct,
  };
  if (newSectorPct > s.maxSectorConcentrationPct) {
    reasons.push(`Sector ${sector} would reach ${newSectorPct.toFixed(1)}% > max ${s.maxSectorConcentrationPct}% of capital.`);
  }

  // 7) Per-bot manual kill switch (#11)
  if (botId && botId !== 'manual') {
    const keyMap = { 'swing': 'swing', 'longterm': 'longterm', 'options-sell': 'optionsSell', 'options-buy': 'optionsBuy' };
    const k = keyMap[botId];
    const bk = k ? s.botKillSwitches?.[k] : null;
    checks.botKill = { active: !!(bk && bk.active), reason: bk?.reason || '' };
    if (bk && bk.active) {
      reasons.push(`Bot ${botId} kill switch is active${bk.reason ? ': ' + bk.reason : '.'}`);
    }
  }

  // 8) Per-bot concurrent positions + capital cap (new #10)
  if (botId && botId !== 'manual') {
    const keyMap = { 'swing': 'swing', 'longterm': 'longterm', 'options-sell': 'optionsSell', 'options-buy': 'optionsBuy' };
    const k = keyMap[botId];
    const botAllocated = k ? (s.botCapital?.[k] ?? 0) : 0;
    const maxOpen = k ? (s.maxConcurrentPositions?.[k] ?? 0) : 0;
    const botOpen = await TradeSetup.countDocuments({ isPaperTrade: true, status: 'ACTIVE', botId });
    const capState = await getBotCapital();
    const myBot = capState.perBot.find(b => b.botId === botId);
    checks.botLimits = {
      botId, openPositions: botOpen, maxPositions: maxOpen,
      deployed: myBot?.deployed || 0, allocated: botAllocated,
    };
    if (maxOpen && botOpen >= maxOpen) {
      reasons.push(`Bot ${botId} already has ${botOpen}/${maxOpen} open positions.`);
    }
    if (botAllocated > 0 && addExposure > 0 && (myBot?.deployed || 0) + addExposure > botAllocated) {
      reasons.push(`Bot ${botId} deployed ₹${((myBot?.deployed||0)+addExposure).toFixed(0)} > allocated ₹${botAllocated}.`);
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    checks,
    timestamp: new Date(),
  };
}

// ─── Aggregate portfolio state (widget consumer) ────────────────────────────

async function getPortfolioState() {
  const [dd, sector, bots, settings] = await Promise.all([
    getDrawdownState(),
    getSectorExposure(),
    getBotCapital(),
    getSettings(),
  ]);
  return {
    capital: settings.capital,
    drawdown: dd,
    sector,
    bots,
    limits: {
      riskPerTradePct: settings.riskPerTrade,
      maxPositionPct: settings.maxPositionPct,
      maxSectorConcentrationPct: settings.maxSectorConcentrationPct,
      maxDrawdownPct: settings.maxDrawdownPct,
      dailyLossLimitPct: settings.dailyLossLimitPct,
    },
    computedAt: new Date(),
  };
}

module.exports = {
  computeSnapshot,
  getDrawdownState,
  getSectorExposure,
  getBotCapital,
  getPortfolioState,
  evaluateTrade,
};
