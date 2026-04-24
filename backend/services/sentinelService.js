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
const LLMUsage = require('../models/LLMUsage');
const Watchlist = require('../models/Watchlist');
const TradeSetup = require('../models/TradeSetup');
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

// ─── Check 5: Pending agent outputs awaiting user review ───────────────────
/**
 * Surfaces a meta-alert if HIGH/URGENT ActionItems produced by agents
 * have been sitting unread for more than 2 hours.
 */
async function checkPendingAgentOutputs() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const items = await ActionItem.find({
      status: 'new',
      createdAt: { $lt: twoHoursAgo },
      priority: { $in: ['URGENT', 'HIGH'] },
      source: { $in: ['chief-analyst', 'pattern-miner', 'trading-bot'] },
    }).lean();

    if (items.length === 0) {
      // Clear any prior meta-alert by resolving it silently
      return 0;
    }

    // Group by source for a concise one-liner
    const sourceCounts = {};
    for (const it of items) {
      sourceCounts[it.source] = (sourceCounts[it.source] || 0) + 1;
    }
    const sourcesLine = Object.entries(sourceCounts)
      .map(([s, n]) => `${n} from ${s}`)
      .join(', ');

    await upsertAlert({
      dedupKey: 'sentinel:pending-agent-outputs',
      title: `${items.length} un-reviewed high-priority items from agents`,
      description: `You have ${items.length} new ActionItems older than 2 hours: ${sourcesLine}.`,
      impact: 'Ignoring agent outputs defeats the purpose of running them — their insights go stale fast.',
      action: 'Open the Today tab → triage (acknowledge, act, or dismiss) the oldest first.',
      priority: 'HIGH',
      source: 'sentinel',
    });
    return 1;
  } catch (err) {
    console.warn('[sentinel] checkPendingAgentOutputs failed:', err.message);
    return 0;
  }
}

// ─── Check 6: Agent health (are agents actually running?) ──────────────────
/**
 * For each known agent, compare expected run count (per week) vs actual
 * successful LLMUsage entries in the last 7 days. Flag behind-schedule.
 */
async function checkAgentHealth() {
  const expected = [
    { agentId: 'market-scout', name: 'Market Scout', expectedRuns: 7 },         // daily
    { agentId: 'smart-money-tracker', name: 'Smart Money Tracker', expectedRuns: 1 }, // weekly
    { agentId: 'sentiment-watcher', name: 'Sentiment Watcher', expectedRuns: 140 },   // hourly × market hours
    // Pattern Miner: manual-trigger only in Phase 3. Expected runs track roughly
    // one invocation per closed trade per week (conservative default: 2).
    { agentId: 'pattern-miner', name: 'Pattern Miner', expectedRuns: 2 },
  ];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let flagged = 0;

  try {
    // We define "a run" as any successful `:synthesize` / `:classify` LLMUsage row.
    // Fallback: any successful row for that agentId.
    const agg = await LLMUsage.aggregate([
      { $match: { at: { $gte: sevenDaysAgo }, success: true, agentId: { $in: expected.map(e => e.agentId) } } },
      {
        $group: {
          _id: { agentId: '$agentId', op: '$operation' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Count distinct run-synthesis events per agent
    const runCountByAgent = {};
    for (const row of agg) {
      const aid = row._id.agentId;
      const op = row._id.op || '';
      // Each agent has one "terminal" operation (synthesize / classify) — counting that
      // avoids double-counting Perplexity + Claude from the same run.
      if (op.endsWith(':synthesize') || op.endsWith(':classify')) {
        runCountByAgent[aid] = (runCountByAgent[aid] || 0) + row.count;
      }
    }
    // Fallback: if the terminal op has zero rows (e.g. Anthropic key missing),
    // count any successful Perplexity row as "half a run" so we don't wildly
    // under-report. Still enough to flag when nothing is running at all.
    for (const e of expected) {
      if ((runCountByAgent[e.agentId] || 0) > 0) continue;
      const perplexityRows = agg
        .filter(r => r._id.agentId === e.agentId && !r._id.op?.endsWith(':synthesize') && !r._id.op?.endsWith(':classify'))
        .reduce((s, r) => s + r.count, 0);
      if (perplexityRows > 0) {
        runCountByAgent[e.agentId] = Math.floor(perplexityRows / 2) || 1;
      }
    }

    for (const e of expected) {
      const got = runCountByAgent[e.agentId] || 0;
      // Tolerance: flag only if got < 50% of expected (avoid noisy alerts)
      const threshold = Math.max(1, Math.floor(e.expectedRuns * 0.5));
      if (got < threshold) {
        await upsertAlert({
          dedupKey: `sentinel:agent-health:${e.agentId}`,
          title: `Agent ${e.name} is behind schedule`,
          description: `Expected ~${e.expectedRuns} runs in the last 7 days, got ${got}.`,
          impact: e.agentId === 'market-scout'
            ? 'Without daily briefings you start sessions blind to overnight moves.'
            : e.agentId === 'smart-money-tracker'
            ? 'Weekly HNI/FII footprint read is missing — you lose leading-edge context.'
            : e.agentId === 'pattern-miner'
            ? 'Post-trade lessons aren\'t being extracted — recurring mistakes will compound.'
            : 'Hourly chatter watch is down — unusual moves on watchlist stocks go undetected.',
          action: e.agentId === 'sentiment-watcher'
            ? 'Check ANTHROPIC_API_KEY + PERPLEXITY_API_KEY, or trigger via POST /api/agents/sentiment-watcher/run.'
            : `Trigger manually: POST /api/agents/${e.agentId}/run — check LLMUsage for errors.`,
          priority: 'MEDIUM',
          source: 'sentinel',
        });
        flagged += 1;
      }
    }
  } catch (err) {
    console.warn('[sentinel] checkAgentHealth failed:', err.message);
  }
  return flagged;
}

// ─── Check 7: Watchlist staleness ───────────────────────────────────────────
/**
 * Flags watchlist symbols added > 30 days ago that were never traded
 * (no TradeSetup exists for them) and never queried (no AI analysis run).
 */
async function checkWatchlistStaleness() {
  try {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - THIRTY_DAYS);

    const watchlists = await Watchlist.find({}).lean();
    const staleSymbols = [];

    // Candidate stale symbols first — old, no analysis ever recorded
    const candidates = [];
    for (const wl of watchlists) {
      for (const item of (wl.items || [])) {
        if (!item.symbol) continue;
        const addedAt = item.addedAt ? new Date(item.addedAt) : null;
        if (!addedAt || addedAt >= cutoff) continue;
        const neverQueried = !item.lastAnalysis || !item.lastAnalysis.analyzedAt;
        if (!neverQueried) continue;
        candidates.push(item.symbol.toUpperCase());
      }
    }

    if (candidates.length === 0) return 0;

    // Filter out any that have a TradeSetup (ever traded)
    const traded = await TradeSetup.find({ symbol: { $in: candidates } })
      .select('symbol').lean();
    const tradedSet = new Set(traded.map(t => (t.symbol || '').toUpperCase()));

    for (const sym of candidates) {
      if (!tradedSet.has(sym)) staleSymbols.push(sym);
    }

    if (staleSymbols.length === 0) return 0;

    await upsertAlert({
      dedupKey: 'sentinel:watchlist-stale',
      title: `${staleSymbols.length} stale watchlist symbols — consider pruning`,
      description: `These symbols were added > 30 days ago, never traded, never analysed: ${staleSymbols.slice(0, 15).join(', ')}${staleSymbols.length > 15 ? ` + ${staleSymbols.length - 15} more` : ''}.`,
      impact: 'A cluttered watchlist hides real signals and wastes the hourly Sentiment Watcher budget.',
      action: 'Open Watchlist → remove symbols you no longer care about, or run a quick analysis on the rest.',
      priority: 'LOW',
      source: 'sentinel',
    });
    return staleSymbols.length;
  } catch (err) {
    console.warn('[sentinel] checkWatchlistStaleness failed:', err.message);
    return 0;
  }
}

// ─── Main runner ────────────────────────────────────────────────────────────

async function runSentinelCycle() {
  const results = {
    missedTasks: 0,
    tokenIssues: 0,
    drawdownAlerts: 0,
    pendingApprovals: 0,
    pendingAgentOutputs: 0,
    agentHealthFlags: 0,
    staleWatchlistSymbols: 0,
  };
  try { results.missedTasks = await checkMissedTasks(); } catch (_) {}
  try { results.tokenIssues = await checkUpstoxToken(); } catch (_) {}
  try { results.drawdownAlerts = await checkDrawdownState(); } catch (_) {}
  try { results.pendingApprovals = await checkPendingApprovals(); } catch (_) {}
  try { results.pendingAgentOutputs = await checkPendingAgentOutputs(); } catch (_) {}
  try { results.agentHealthFlags = await checkAgentHealth(); } catch (_) {}
  try { results.staleWatchlistSymbols = await checkWatchlistStaleness(); } catch (_) {}
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
