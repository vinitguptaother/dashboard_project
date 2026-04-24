/**
 * Sentinel Service — the dashboard's self-awareness layer.
 *
 * MASTER_PLAN §3 (System C). NOT AI. Pure Node.js monitoring.
 *
 * Runs every 5 min. Watches:
 *   1. Cadence Registry — missed tasks
 *   2. Data freshness — stale scraper data, expired tokens
 *   3. Pending approvals — bot suggestions awaiting user
 *   4. Risk state — drawdown approaching limit, sector concentration
 *   5. Agent health — failed runs, error streaks
 *
 * Writes ActionItems with the user-requested structure:
 *   what / why / impact / action
 *
 * Phase 0: critical alerts only (token expiry, missed data).
 * Phase 1: full categories.
 */

const ActionItem = require('../models/ActionItem');
const CadenceTask = require('../models/CadenceTask');
const RiskSettings = require('../models/RiskSettings');
const cadenceService = require('./cadenceService');

// ─── Utility: dedup upsert ──────────────────────────────────────────────────

async function upsertAlert({
  dedupKey, title, description, impact, action, priority, source,
  symbol, botId, relatedSetupId, deadline,
}) {
  try {
    // If an open alert with same dedupKey exists, update it; else create.
    const existing = await ActionItem.findOne({ dedupKey, status: { $in: ['new', 'acknowledged'] } });
    if (existing) {
      Object.assign(existing, { title, description, impact, action, priority, symbol, botId, relatedSetupId, deadline });
      return existing.save();
    }
    return ActionItem.create({
      dedupKey, title, description, impact, action, priority, source,
      symbol, botId, relatedSetupId, deadline,
    });
  } catch (err) {
    console.warn('[sentinel] upsertAlert failed:', err.message);
    return null;
  }
}

// ─── Check 1: Missed cadence tasks ──────────────────────────────────────────

async function checkMissedTasks() {
  const { missed } = await cadenceService.evaluateAll();
  if (missed === 0) return 0;

  // Fetch the actual missed tasks for details
  const missedTasks = await CadenceTask.find({ status: 'missed', enabled: true }).lean();
  for (const t of missedTasks) {
    await upsertAlert({
      dedupKey: `cadence:${t.taskKey}`,
      title: `Task overdue: ${t.name}`,
      description: `${t.description || 'Scheduled task has not run as expected.'} Last ran: ${t.lastRunAt ? new Date(t.lastRunAt).toLocaleString('en-IN') : 'never'}.`,
      impact: t.category === 'market-data' ? 'Your market analysis may be using stale data.'
            : t.category === 'risk' ? 'Risk calculations may be out of date.'
            : t.category === 'bots' ? 'Bot runs may have been skipped.'
            : 'Automated duty missed — investigate soon.',
      action: `Check ${t.category} services OR manually trigger via dashboard.`,
      priority: t.category === 'risk' ? 'URGENT' : 'HIGH',
      source: 'sentinel',
    });
  }
  return missedTasks.length;
}

// ─── Check 2: Upstox token expiry (critical — affects all live prices) ───────

async function checkUpstoxToken() {
  // Upstox token has no standard "expiring-in" API; detect via token length + env var.
  // Tokens ~335 chars, valid ~6 months from issue. Without a structured check here,
  // we surface a low-priority reminder based on last-known-state.
  // Phase 1 will read from upstox-token.json + expiry date.
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token || token.length < 100) {
    await upsertAlert({
      dedupKey: 'upstox:token-missing',
      title: 'Upstox API token is missing or invalid',
      description: 'The dashboard cannot fetch live prices without a valid Upstox token.',
      impact: 'All bot scans will fail. Live prices on Dashboard will be blank. Scanner returns no candidates.',
      action: 'Open Settings → Upstox tab → reconnect your Upstox account.',
      priority: 'URGENT',
      source: 'sentinel',
    });
    return 1;
  }
  return 0;
}

// ─── Check 3: Drawdown approaching limit ────────────────────────────────────

async function checkDrawdownState() {
  try {
    const riskSvc = require('./riskEngineService');
    const dd = await riskSvc.getDrawdownState();
    if (dd.locked) {
      await upsertAlert({
        dedupKey: 'risk:drawdown-locked',
        title: 'Drawdown lockout is ACTIVE',
        description: `Equity is ${dd.drawdownPct.toFixed(1)}% below peak (max allowed: ${dd.maxPct}%). All new trades blocked.`,
        impact: 'Bots cannot enter new positions. Manual trades also blocked by validator.',
        action: 'Open Bots & Agents → Kill Switch Board → Clear drawdown lockout (requires UNLOCK confirmation).',
        priority: 'URGENT',
        source: 'sentinel',
      });
      return 1;
    }
    // Warn at 75% of limit
    const warnThreshold = dd.maxPct * 0.75;
    if (dd.drawdownPct >= warnThreshold && dd.drawdownPct < dd.maxPct) {
      await upsertAlert({
        dedupKey: 'risk:drawdown-warning',
        title: `Drawdown approaching limit (${dd.drawdownPct.toFixed(1)}% of ${dd.maxPct}%)`,
        description: 'Current equity drawdown is within 25% of the hard lockout threshold.',
        impact: `If another ${(dd.maxPct - dd.drawdownPct).toFixed(1)}% loss occurs, all trading auto-locks.`,
        action: 'Review open positions. Consider reducing size or closing weakest trades.',
        priority: 'HIGH',
        source: 'sentinel',
      });
      return 1;
    }
    return 0;
  } catch (err) {
    return 0;
  }
}

// ─── Check 4: Pending bot suggestions (Phase 1+ will refine) ────────────────

async function checkPendingApprovals() {
  // Phase 0: no suggestion-approval flow yet; placeholder for Phase 1.
  return 0;
}

// ─── Main runner ────────────────────────────────────────────────────────────

async function runSentinelCycle() {
  const results = {
    missedTasks: 0,
    tokenIssues: 0,
    drawdownAlerts: 0,
    pendingApprovals: 0,
  };
  try { results.missedTasks = await checkMissedTasks(); } catch (_) {}
  try { results.tokenIssues = await checkUpstoxToken(); } catch (_) {}
  try { results.drawdownAlerts = await checkDrawdownState(); } catch (_) {}
  try { results.pendingApprovals = await checkPendingApprovals(); } catch (_) {}
  return results;
}

// ─── Query helpers for the Today tab ────────────────────────────────────────

async function getActiveActionItems({ limit = 20 } = {}) {
  // Sort by priority (URGENT → HIGH → MEDIUM → LOW), then by createdAt DESC
  const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const items = await ActionItem.find({ status: { $in: ['new', 'acknowledged'] } })
    .limit(Math.min(limit, 100))
    .lean();
  items.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 99;
    const pb = priorityOrder[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return items;
}

async function acknowledgeItem(id) {
  return ActionItem.findByIdAndUpdate(id, { status: 'acknowledged' }, { new: true });
}

async function dismissItem(id) {
  return ActionItem.findByIdAndUpdate(id, { status: 'dismissed' }, { new: true });
}

async function resolveItem(id) {
  return ActionItem.findByIdAndUpdate(id, { status: 'resolved', resolvedAt: new Date() }, { new: true });
}

module.exports = {
  runSentinelCycle,
  getActiveActionItems,
  acknowledgeItem,
  dismissItem,
  resolveItem,
  upsertAlert,
};
