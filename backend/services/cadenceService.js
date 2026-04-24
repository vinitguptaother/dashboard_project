/**
 * Cadence Service — registry + heartbeat + watchdog logic for the
 * dashboard's scheduled duties.
 *
 * Public surface:
 *   seedCadenceTasks()       — idempotent boot-time seed of known tasks
 *   reportRun(taskKey, ...)  — crons call this on success (updates lastRunAt, status)
 *   evaluateAll()            — watchdog: compares lastRunAt vs expectedNextRun, flags missed
 *   computeNextRun(task)     — pure fn for expected-next math per cadence type
 */

const CadenceTask = require('../models/CadenceTask');

// ─── Known tasks (seeded on boot, idempotent upsert) ─────────────────────────
const SEED_TASKS = [
  // ── System crons
  {
    taskKey: 'holiday-refresh',
    name: 'Holiday list refresh',
    description: 'Pulls NSE holiday list + falls back to static cache. Runs once daily at 00:30 UTC.',
    type: 'system', cadence: 'daily', schedule: '30 0 * * *',
    graceMinutes: 180, category: 'market-data',
  },
  {
    taskKey: 'market-data-update',
    name: 'Market data refresh (every 2 min during market hours)',
    description: 'Fetches batch market data for key symbols every 2 minutes while market is open.',
    type: 'system', cadence: 'custom', schedule: '*/2 * * * *',
    graceMinutes: 10, category: 'market-data', marketDaysOnly: true,
  },
  {
    taskKey: 'news-fetch',
    name: 'News feed refresh (every 30 min)',
    description: 'Pulls latest news from external sources every 30 minutes.',
    type: 'system', cadence: 'custom', schedule: '*/30 * * * *',
    graceMinutes: 90, category: 'market-data',
  },
  {
    taskKey: 'cache-clear',
    name: 'Service cache clear (hourly)',
    description: 'Clears in-memory caches in marketDataService + newsService.',
    type: 'system', cadence: 'custom', schedule: '0 * * * *',
    graceMinutes: 120, category: 'system',
  },
  {
    taskKey: 'api-usage-reset',
    name: 'Daily API usage counter reset',
    description: 'Resets per-day request counters at midnight UTC.',
    type: 'system', cadence: 'daily', schedule: '0 0 * * *',
    graceMinutes: 180, category: 'system',
  },
  {
    taskKey: 'kill-switch-reset',
    name: 'Kill switch midnight IST reset',
    description: 'Resets the Daily Loss Circuit Breaker kill switch at 00:00 IST for the new trading day.',
    type: 'system', cadence: 'daily', schedule: '30 18 * * *',
    graceMinutes: 180, category: 'risk',
  },
  {
    taskKey: 'instruments-weekly',
    name: 'Weekly Upstox instruments download',
    description: 'Full NSE+BSE instruments refresh every Sunday 6 AM IST.',
    type: 'system', cadence: 'weekly', schedule: '0 6 * * 0',
    graceMinutes: 360, category: 'market-data',
  },
  {
    taskKey: 'upstox-token-check',
    name: 'Upstox token validity check',
    description: 'Verifies Upstox access token hasn\'t expired (runs every 15 min during market hours).',
    type: 'system', cadence: 'custom', schedule: '*/15 * * * *',
    graceMinutes: 60, category: 'auth', marketDaysOnly: true,
  },
  {
    taskKey: 'paper-trade-monitor',
    name: 'Paper trade SL/target monitor',
    description: 'Checks live prices against every open paper trade\'s SL + target (every 2 min, market hours).',
    type: 'system', cadence: 'custom', schedule: '*/2 9-15 * * 1-5',
    graceMinutes: 10, category: 'trading', marketDaysOnly: true,
  },
  {
    taskKey: 'auto-expiry',
    name: 'Auto-expiry of stale trades',
    description: 'Expires trades past their max holding period at 10:30 PM IST daily.',
    type: 'system', cadence: 'daily', schedule: '30 22 * * 1-5',
    graceMinutes: 120, category: 'trading', marketDaysOnly: true,
  },
  {
    taskKey: 'screen-scoring',
    name: 'Nightly screen scoring',
    description: 'Recomputes hit rate + performance score for all screens at 11 PM IST (Mon-Fri).',
    type: 'system', cadence: 'daily', schedule: '0 23 * * 1-5',
    graceMinutes: 180, category: 'screens', marketDaysOnly: true,
  },
  {
    taskKey: 'iv-snapshot',
    name: 'Daily ATM IV snapshot',
    description: 'Captures ATM IV for NIFTY/BANKNIFTY/FINNIFTY/SENSEX/MIDCPNIFTY at 3:25 PM IST (Mon-Fri). Powers IV Rank/Percentile.',
    type: 'system', cadence: 'daily', schedule: '25 15 * * 1-5',
    graceMinutes: 120, category: 'market-data', marketDaysOnly: true,
  },
  {
    taskKey: 'cadence-watchdog',
    name: 'Cadence watchdog — missed-task detection',
    description: 'Evaluates every registered task\'s expectedNextRun vs lastRunAt + grace. Flags missed tasks.',
    type: 'system', cadence: 'custom', schedule: '*/30 * * * *',
    graceMinutes: 60, category: 'system',
  },
  {
    taskKey: 'fii-dii-daily',
    name: 'Daily FII/DII institutional flow fetch',
    description: 'Pulls FII + DII cash activity at 6:30 PM IST Mon-Fri (NSE publishes ~6 PM). Primary Indian directional signal.',
    type: 'system', cadence: 'daily', schedule: '30 18 * * 1-5',
    graceMinutes: 180, category: 'market-data', marketDaysOnly: true,
  },
  {
    taskKey: 'market-regime',
    name: 'Market Regime classifier (every 30 min, market hours)',
    description: 'Classifies NIFTY regime as trending-bull / bear / choppy / breakout / risk-off using EMAs + VIX + FII/DII. Feeds bot Validator layer.',
    type: 'system', cadence: 'custom', schedule: '*/30 9-15 * * 1-5',
    graceMinutes: 60, category: 'market-data', marketDaysOnly: true,
  },
  {
    taskKey: 'sector-rotation',
    name: 'Sector Rotation scanner (every 30 min, market hours)',
    description: 'Refreshes 12 NSE sector indices vs NIFTY. Computes 1D/1W/1M relative strength; surfaces leaders + laggards for swing bot + screen scoring.',
    type: 'system', cadence: 'custom', schedule: '15,45 9-15 * * 1-5',
    graceMinutes: 60, category: 'market-data', marketDaysOnly: true,
  },
  {
    taskKey: 'corporate-actions',
    name: 'Corporate Actions + Earnings daily fetch (7 AM IST)',
    description: 'Pulls NSE corporate actions (div/split/bonus/buyback) + upcoming board meetings (earnings). Drives next-30-day calendar widget + pre-trade event check.',
    type: 'system', cadence: 'daily', schedule: '0 7 * * *',
    graceMinutes: 360, category: 'market-data',
  },
  {
    taskKey: 'large-deals',
    name: 'Bulk / Block / Short deals daily fetch (6 PM IST)',
    description: 'Pulls NSE EOD large deals (bulk ≥0.5% equity, block ≥₹10cr, short aggregates). Smart-money signal — who took big positions.',
    type: 'system', cadence: 'daily', schedule: '0 18 * * 1-5',
    graceMinutes: 180, category: 'market-data', marketDaysOnly: true,
  },
  // ── 4 Bots (BOT_BLUEPRINT #1-#4) — each honors BotConfig.enabled ─────────
  {
    taskKey: 'bot-swing',
    name: 'Swing Bot (Tue-Fri 09:00 IST)',
    description: 'Scans the configured screen\'s latest batch, picks top-N, validates, persists accepted.',
    type: 'system', cadence: 'custom', schedule: '0 9 * * 2-5',
    graceMinutes: 180, category: 'bots', marketDaysOnly: true,
  },
  {
    taskKey: 'bot-longterm',
    name: 'Long-term Bot (Mon 09:00 IST)',
    description: 'Weekly scan of long-term screen; wider SL + R:R; quality-first names.',
    type: 'system', cadence: 'weekly', schedule: '0 9 * * 1',
    graceMinutes: 360, category: 'bots', marketDaysOnly: true,
  },
  {
    taskKey: 'bot-options-sell',
    name: 'Options Sell Bot (Mon-Thu 11:30 IST)',
    description: 'Premium-selling bot; triggers when IV rank is elevated (regime-gated later).',
    type: 'system', cadence: 'custom', schedule: '30 11 * * 1-4',
    graceMinutes: 60, category: 'bots', marketDaysOnly: true,
  },
  {
    taskKey: 'bot-options-buy',
    name: 'Options Buy Bot (Mon-Thu 10:00 IST)',
    description: 'Directional premium buyer; regime=breakout + IV rank low.',
    type: 'system', cadence: 'custom', schedule: '0 10 * * 1-4',
    graceMinutes: 60, category: 'bots', marketDaysOnly: true,
  },
  {
    taskKey: 'risk-engine-snapshot',
    name: 'Risk Engine EOD portfolio snapshot (3:35 PM IST)',
    description: 'Computes equity = realized + unrealized P&L; tracks peak + drawdown. Auto-locks trading if DD crosses maxDrawdownPct. Powers the Risk Engine panel.',
    type: 'system', cadence: 'daily', schedule: '35 15 * * 1-5',
    graceMinutes: 120, category: 'risk', marketDaysOnly: true,
  },
  {
    taskKey: 'sentinel-monitor',
    name: 'Sentinel self-awareness monitor (every 5 min)',
    description: 'Watches cadence, data freshness, token expiry, risk state, pending approvals. Writes ActionItems to the Today tab.',
    type: 'system', cadence: 'custom', schedule: '*/5 * * * *',
    graceMinutes: 30, category: 'system',
  },

  // ── User activities (no automation; user is expected to perform them)
  {
    taskKey: 'user-review-journal',
    name: 'Review trade journal',
    description: 'Skim the week\'s closed trades + mistake tags. Look for recurring patterns.',
    type: 'user', cadence: 'weekly', schedule: 'Monday morning',
    graceMinutes: 24 * 60 * 3, category: 'journal',
  },
  {
    taskKey: 'user-screen-update',
    name: 'Refresh Screener.in screens',
    description: 'Re-run your Screener.in queries and upload fresh CSVs for each active screen.',
    type: 'user', cadence: 'weekly', schedule: 'Saturday',
    graceMinutes: 24 * 60 * 3, category: 'screens',
  },
  {
    taskKey: 'user-portfolio-review',
    name: 'Monthly portfolio review',
    description: 'Check sector allocation, drawdown curve, risk-adjusted return; rebalance if needed.',
    type: 'user', cadence: 'monthly', schedule: 'First weekend of month',
    graceMinutes: 24 * 60 * 7, category: 'portfolio',
  },
  {
    taskKey: 'user-mistake-review',
    name: 'Quarterly mistake audit',
    description: 'GET /api/trade-journal/mistake-stats — quantify rupee cost per mistake category. Adjust rules to prevent repeats.',
    type: 'user', cadence: 'quarterly', schedule: 'End of quarter',
    graceMinutes: 24 * 60 * 14, category: 'journal',
  },
  {
    taskKey: 'user-tax-reconciliation',
    name: 'Tax P&L reconciliation',
    description: 'Before ITR filing: verify STCG / LTCG / F&O business income segregation + STT math.',
    type: 'user', cadence: 'yearly', schedule: 'Before 31 July',
    graceMinutes: 24 * 60 * 30, category: 'tax',
  },
];

// ─── Next-run computation per cadence ────────────────────────────────────────
function computeNextRun(task, fromDate = new Date()) {
  const from = new Date(fromDate);
  switch (task.cadence) {
    case 'daily':     return new Date(from.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':    return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':   { const d = new Date(from); d.setMonth(d.getMonth() + 1); return d; }
    case 'quarterly': { const d = new Date(from); d.setMonth(d.getMonth() + 3); return d; }
    case 'yearly':    { const d = new Date(from); d.setFullYear(d.getFullYear() + 1); return d; }
    case 'custom':
      // For */N patterns, compute best-effort interval. Fallback: 2 hours.
      if (task.schedule.startsWith('*/')) {
        const m = task.schedule.match(/^\*\/(\d+)\s+/);
        if (m) return new Date(from.getTime() + parseInt(m[1], 10) * 60 * 1000);
      }
      return new Date(from.getTime() + 2 * 60 * 60 * 1000);
    case 'on-demand': return null;
    default:          return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }
}

// ─── Seed: idempotent upsert of known tasks ──────────────────────────────────
async function seedCadenceTasks() {
  for (const t of SEED_TASKS) {
    await CadenceTask.findOneAndUpdate(
      { taskKey: t.taskKey },
      { $set: t, $setOnInsert: { lastRunAt: null, status: 'on-track', missedCount: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  return SEED_TASKS.length;
}

// ─── Heartbeat: crons call this on success ───────────────────────────────────
async function reportRun(taskKey, status = 'success', details = '') {
  try {
    const task = await CadenceTask.findOne({ taskKey });
    if (!task) {
      console.warn(`[cadence] reportRun: unknown taskKey "${taskKey}" — did you forget to seed?`);
      return null;
    }
    task.lastRunAt = new Date();
    task.lastRunStatus = status;
    task.lastRunDetails = details;
    task.expectedNextRun = computeNextRun(task, task.lastRunAt);
    task.status = 'on-track';
    task.missedCount = 0;
    await task.save();
    return task;
  } catch (err) {
    console.error('[cadence] reportRun error:', err.message);
    return null;
  }
}

// ─── Watchdog: evaluate all tasks and flag missed ones ───────────────────────
async function evaluateAll() {
  const now = Date.now();
  const tasks = await CadenceTask.find({ enabled: true });
  let missed = 0, onTrack = 0, dueSoon = 0, stale = 0;

  for (const task of tasks) {
    if (!task.lastRunAt) {
      // Never run — mark stale only if it's been seeded long enough
      const ageMs = now - (task.createdAt?.getTime() || now);
      if (ageMs > (task.graceMinutes + 60) * 60 * 1000) {
        task.status = 'stale';
        stale++;
      } else {
        task.status = 'on-track';
        onTrack++;
      }
    } else {
      const expected = task.expectedNextRun?.getTime() || (task.lastRunAt.getTime() + 24 * 60 * 60 * 1000);
      const cutoff = expected + task.graceMinutes * 60 * 1000;
      if (now > cutoff) {
        task.status = 'missed';
        task.missedCount = (task.missedCount || 0) + 1;
        missed++;
      } else if (now > expected) {
        task.status = 'due-soon';
        dueSoon++;
      } else {
        task.status = 'on-track';
        task.missedCount = 0;
        onTrack++;
      }
    }
    await task.save();
  }

  return { total: tasks.length, missed, dueSoon, onTrack, stale, at: new Date() };
}

module.exports = { seedCadenceTasks, reportRun, evaluateAll, computeNextRun, SEED_TASKS };
