/**
 * Strategy Tuner Service — Phase 5 Strategy Parameter Auto-Adjust.
 *
 * MASTER_PLAN §7 Phase 5.
 *
 * Runs weekly (Sat 02:00 IST, before Sunday CA deep review). For each
 * strategy:
 *   1. Read the last 20 CLOSED TradeSetups tagged with that strategy (or
 *      heuristically matched by botId + sub-keyword if strategyKey wasn't
 *      persisted on the setup — graceful degradation).
 *   2. Compute realized:
 *        • Average R:R (|target - entry| / |entry - SL|)
 *        • Actual hit-rate of target vs SL vs expired
 *        • Avg holding days
 *   3. Compare to strategy's expected defaults:
 *        • Most swing strategies target 1:2 R:R.
 *        • Expected win-rate floor per strategy (conservative: 40%).
 *        • Expected holding: ≤30d swing, ≤90d longterm.
 *   4. If drift detected (>30% off on any key metric), propose a change:
 *        • R:R drift → reduce SL% OR tighten target multiplier.
 *        • Hold drift → flag for manual review (strategy code may need update).
 *   5. Persist proposal to StrategyAdjustment (status=pending).
 *   6. Create a single ActionItem for the user (dedupKey per strategy).
 *
 * The tuner NEVER modifies live strategy code autonomously. User must
 * approve via POST /api/strategy-tuner/approve/:id.
 */

const StrategyAdjustment = require('../models/StrategyAdjustment');
const ActionItem = require('../models/ActionItem');
const TradeSetup = require('../models/TradeSetup');
const strategiesLib = require('./strategies');

// Expected defaults per strategy. Sourced from the strategy module metadata
// where possible; otherwise seeded with sensible rules.
const EXPECTED = {
  'swing-stage2-breakout':            { targetRR: 2.0, minWinRate: 40, maxHoldDays: 30 },
  'swing-ema-pullback':               { targetRR: 2.0, minWinRate: 40, maxHoldDays: 30 },
  'swing-oversold-bounce':            { targetRR: 2.0, minWinRate: 38, maxHoldDays: 20 },
  'swing-post-earnings-momentum':     { targetRR: 2.0, minWinRate: 45, maxHoldDays: 20 },
  'longterm-qvm':                     { targetRR: 2.0, minWinRate: 50, maxHoldDays: 180 },
  'options-sell-iv-rank-iron-condor': { targetRR: 1.0, minWinRate: 55, maxHoldDays: 45 },
};

const DRIFT_THRESHOLD = 0.30; // 30%

function daysBetween(a, b) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function computeMetrics(trades) {
  if (!trades.length) return null;
  const rrs = [];
  const holdDays = [];
  let wins = 0;
  let losses = 0;

  for (const t of trades) {
    const entry = t.entryPrice, sl = t.stopLoss, tgt = t.target;
    if (!entry || !sl || !tgt) continue;
    const rr = Math.abs(tgt - entry) / Math.max(Math.abs(entry - sl), 0.01);
    rrs.push(rr);
    if (t.closedAt && t.createdAt) holdDays.push(daysBetween(t.createdAt, t.closedAt));
    if (t.status === 'TARGET_HIT' || (t.netPnL && t.netPnL > 0)) wins++;
    else if (t.status === 'SL_HIT' || (t.netPnL && t.netPnL <= 0)) losses++;
  }

  const n = Math.max(wins + losses, 1);
  return {
    sampleSize: trades.length,
    closedCount: wins + losses,
    winRate: (wins / n) * 100,
    avgRR: rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : 0,
    avgHoldDays: holdDays.length ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length : 0,
  };
}

async function getTradesForStrategy(strategy) {
  // Best-effort matching. Some older TradeSetups may not have a
  // strategyKey field — we fall back to botId + keyword match in
  // reasoning. Cap at last 20 closed trades.
  const botId = strategy.botId;
  const q = {
    status: { $in: ['TARGET_HIT', 'SL_HIT', 'EXPIRED'] },
  };
  if (botId && botId !== 'manual') q.botId = botId;
  const trades = await TradeSetup.find(q).sort({ closedAt: -1 }).limit(50).lean();
  // Heuristic keyword filter on reasoning if there are lots of bot trades
  const keyword = (strategy.name || '').toLowerCase().split(' ')[0];
  const filtered = keyword && trades.length > 20
    ? trades.filter(t => (t.reasoning || '').toLowerCase().includes(keyword)).slice(0, 20)
    : trades.slice(0, 20);
  return filtered;
}

function detectDrift(expected, observed) {
  const drift = {};
  if (!observed || observed.closedCount < 5) {
    return { driftDetected: false, reason: `Insufficient closed trades (${observed?.closedCount || 0} < 5 minimum)`, drift };
  }
  // R:R drift
  const rrDrift = Math.abs(observed.avgRR - expected.targetRR) / expected.targetRR;
  if (rrDrift > DRIFT_THRESHOLD) {
    drift.rrDrift = { observed: +observed.avgRR.toFixed(2), expected: expected.targetRR, driftPct: +(rrDrift * 100).toFixed(1) };
  }
  // Win-rate drift (only flag when BELOW floor)
  if (observed.winRate < expected.minWinRate * 0.85) {
    drift.winRate = { observed: +observed.winRate.toFixed(1), expected: expected.minWinRate, driftPct: +((1 - observed.winRate / expected.minWinRate) * 100).toFixed(1) };
  }
  // Hold-duration drift
  if (observed.avgHoldDays > expected.maxHoldDays * 1.3) {
    drift.holdDuration = { observed: +observed.avgHoldDays.toFixed(1), expected: expected.maxHoldDays, driftPct: +((observed.avgHoldDays / expected.maxHoldDays - 1) * 100).toFixed(1) };
  }
  return { driftDetected: Object.keys(drift).length > 0, drift };
}

function proposeChange(strategyKey, observed, drift) {
  // Heuristic change map. Keep it conservative — small tweaks only.
  const change = {};
  const reasons = [];

  if (drift.rrDrift) {
    const observedRR = drift.rrDrift.observed;
    // Realized < expected → tighten target multiplier to match reality
    change.targetMultiplier = Math.max(1.3, Math.min(2.5, observedRR));
    reasons.push(`Realized R:R ${observedRR}x vs expected ${drift.rrDrift.expected}x → recommend adjusting target multiplier to ${change.targetMultiplier.toFixed(2)}x`);
  }
  if (drift.winRate) {
    change.needsManualReview = true;
    reasons.push(`Win-rate ${drift.winRate.observed}% is ${drift.winRate.driftPct}% below the ${drift.winRate.expected}% floor — strategy may need rule tightening.`);
  }
  if (drift.holdDuration) {
    // Reduce max hold days toward realized avg + 20% buffer
    change.maxHoldDays = Math.round(drift.holdDuration.observed * 1.2);
    reasons.push(`Avg hold ${drift.holdDuration.observed}d > expected ${drift.holdDuration.expected}d → recommend lowering max hold to ${change.maxHoldDays}d.`);
  }

  return { change, reason: reasons.join(' ') };
}

async function analyzeStrategy(strategy) {
  const expected = EXPECTED[strategy.key];
  if (!expected) return { strategyKey: strategy.key, skipped: true, reason: 'no expected metrics baseline' };

  const trades = await getTradesForStrategy(strategy);
  const observed = computeMetrics(trades);
  const { driftDetected, drift, reason } = detectDrift(expected, observed);

  const base = {
    strategyKey: strategy.key,
    observed,
    expected,
    drift,
  };

  if (!driftDetected) return { ...base, driftDetected: false, reason: reason || 'within tolerance' };

  const { change, reason: proposalReason } = proposeChange(strategy.key, observed, drift);
  return { ...base, driftDetected: true, change, reason: proposalReason };
}

/**
 * Main entry: run the tuner across all registered strategies. Writes
 * StrategyAdjustment docs (status=pending) + a single ActionItem per
 * drifted strategy (dedup by strategyKey+day).
 */
async function runTunerCycle() {
  const strategies = strategiesLib.getAllStrategies();
  const results = [];
  let pendingCreated = 0;
  let noDrift = 0;
  let skipped = 0;

  for (const s of strategies) {
    try {
      const result = await analyzeStrategy(s);
      if (result.skipped) { skipped++; results.push(result); continue; }
      if (!result.driftDetected) { noDrift++; results.push(result); continue; }

      // Persist proposal. Supersede any existing pending for the same strategy.
      await StrategyAdjustment.updateMany(
        { strategyKey: s.key, status: 'pending' },
        { $set: { status: 'superseded' } }
      );

      const adj = await StrategyAdjustment.create({
        strategyKey: s.key,
        proposedChange: result.change,
        reason: result.reason,
        observedMetrics: {
          expected: result.expected,
          observed: result.observed,
          drift: result.drift,
        },
        status: 'pending',
      });

      // Surface ActionItem (dedup per strategy per day)
      const dedupKey = `strategy-tuner:${s.key}:${new Date().toISOString().slice(0, 10)}`;
      try {
        await ActionItem.findOneAndUpdate(
          { dedupKey },
          {
            $set: {
              title: `Strategy drift detected: ${s.name}`,
              description: result.reason,
              impact: `If left unchecked, this strategy's trade quality will continue diverging from its design spec. Review proposed parameter change.`,
              action: `/portfolio#strategy-tuner?adjustmentId=${adj._id}`,
              priority: result.drift.winRate ? 'HIGH' : 'MEDIUM',
              source: 'pattern-miner',
              status: 'new',
              dedupKey,
              botId: s.botId || '',
            },
          },
          { upsert: true, new: true }
        ).then(async (actionItem) => {
          if (actionItem) await StrategyAdjustment.updateOne({ _id: adj._id }, { $set: { actionItemId: actionItem._id } });
        });
      } catch (_err) { /* ActionItem creation errors don't block proposal persistence */ }

      pendingCreated++;
      results.push({ ...result, adjustmentId: adj._id });
    } catch (err) {
      results.push({ strategyKey: s.key, error: err.message });
    }
  }

  return {
    runAt: new Date(),
    totalStrategies: strategies.length,
    pendingCreated,
    noDrift,
    skipped,
    results,
  };
}

// ─── Approve / reject workflow ────────────────────────────────────────────

async function getPending() {
  return StrategyAdjustment.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
}

async function approve(id, { approvedBy = 'vinit' } = {}) {
  const doc = await StrategyAdjustment.findById(id);
  if (!doc) throw new Error('Adjustment not found');
  if (doc.status !== 'pending') throw new Error(`Adjustment is ${doc.status}, cannot approve`);
  doc.status = 'approved';
  doc.approvedAt = new Date();
  doc.approvedBy = approvedBy;
  await doc.save();
  // We do NOT mutate the strategy code; this records user's intent. A
  // future phase (6+) can wire a runtime param store that each strategy
  // reads from on evaluate().
  return doc;
}

async function reject(id) {
  const doc = await StrategyAdjustment.findById(id);
  if (!doc) throw new Error('Adjustment not found');
  if (doc.status !== 'pending') throw new Error(`Adjustment is ${doc.status}, cannot reject`);
  doc.status = 'rejected';
  doc.rejectedAt = new Date();
  await doc.save();
  return doc;
}

module.exports = {
  runTunerCycle,
  analyzeStrategy,
  getPending,
  approve,
  reject,
  _expected: EXPECTED,
};
