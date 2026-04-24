/**
 * diff.js — "What changed since last login" aggregator.
 *
 * MASTER_PLAN §7 Phase 6 deliverable #3.
 *
 * Given an ISO timestamp `ts`, aggregates:
 *   - newSuggestions   — count of new ActionItems created after ts
 *   - closedTrades     — TradeSetups whose status changed to TARGET_HIT / SL_HIT
 *                        / EXPIRED / CANCELLED since ts
 *   - newSignals       — any new ActionItem rows from sentinel / bots (short list)
 *   - regimeChanges    — distinct regime transitions since ts (e.g. bull → choppy)
 *   - agentOutputs     — per-agent new-output counts from ActionItem by source
 *
 * The UI calls this right after load, using the last visit timestamp stored
 * in localStorage.
 */

const express = require('express');
const router = express.Router();

const ActionItem = require('../models/ActionItem');
const TradeSetup = require('../models/TradeSetup');

let MarketRegime = null;
try { MarketRegime = require('../models/MarketRegime'); } catch (_) {}

// Map ActionItem.source → friendly agent key used in UI
const SOURCE_TO_AGENT = {
  'chief-analyst': 'chiefAnalyst',
  'trading-bot': 'tradingBot',
  'pattern-miner': 'patternMiner',
  'sentinel': 'sentinel',
  'user-duty': 'userDuty',
};

function parseTs(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

router.get('/since', async (req, res) => {
  try {
    const since = parseTs(req.query.ts) || new Date(Date.now() - 24 * 60 * 60 * 1000);

    // ── 1. Suggestions / action items created since `since`
    const newActionItems = await ActionItem.find({ createdAt: { $gt: since } })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const newSuggestions = newActionItems.length;

    // ── 2. Closed trades — status transitions since `since`
    const closedStatuses = ['TARGET_HIT', 'SL_HIT', 'EXPIRED', 'CANCELLED'];
    const closedTradesDocs = await TradeSetup.find({
      status: { $in: closedStatuses },
      closedAt: { $gt: since },
    })
      .sort({ closedAt: -1 })
      .limit(50)
      .lean();

    const closedTrades = closedTradesDocs.map((t) => {
      const verdict =
        t.status === 'TARGET_HIT' ? 'win' :
        t.status === 'SL_HIT' ? 'loss' :
        t.status === 'EXPIRED' ? 'expired' : 'cancelled';

      // Use netPnL if the Realism Engine filled it, else approximate from entry/exit.
      let pnl = null;
      if (t.netPnL != null) pnl = t.netPnL;
      else if (t.entryPrice && t.exitPrice && t.quantity) {
        const dir = (t.action === 'SELL') ? -1 : 1;
        pnl = (t.exitPrice - t.entryPrice) * t.quantity * dir;
      }

      return {
        symbol: t.symbol,
        status: t.status,
        verdict,
        pnl: pnl != null ? Math.round(pnl) : null,
        closedAt: t.closedAt,
      };
    });

    // ── 3. New signals — top recent sentinel / bot-sourced items
    const newSignals = newActionItems
      .filter((ai) => ai.source === 'sentinel' || ai.source === 'trading-bot' || ai.source === 'pattern-miner')
      .slice(0, 10)
      .map((ai) => ({
        type: ai.source,
        priority: ai.priority,
        description: ai.title,
      }));

    // ── 4. Regime changes — list distinct transitions since `since`
    let regimeChanges = [];
    if (MarketRegime) {
      const recent = await MarketRegime.find({ computedAt: { $gt: since } })
        .sort({ computedAt: 1 })
        .select('regime computedAt')
        .limit(200)
        .lean();

      // Also pick the last regime BEFORE `since` so we detect "A → B" at the boundary.
      const priorDoc = await MarketRegime.findOne({ computedAt: { $lte: since } })
        .sort({ computedAt: -1 })
        .select('regime computedAt')
        .lean();

      let prevRegime = priorDoc ? priorDoc.regime : null;
      for (const r of recent) {
        if (r.regime !== prevRegime) {
          regimeChanges.push(
            prevRegime ? `${prevRegime} → ${r.regime}` : `${r.regime} (new)`
          );
          prevRegime = r.regime;
        }
      }
    }

    // ── 5. Agent outputs — counts per source
    const agentOutputs = {};
    for (const ai of newActionItems) {
      const key = SOURCE_TO_AGENT[ai.source] || ai.source || 'other';
      agentOutputs[key] = (agentOutputs[key] || 0) + 1;
    }

    // Any non-trivial change?
    const hasChanges =
      newSuggestions > 0 ||
      closedTrades.length > 0 ||
      newSignals.length > 0 ||
      regimeChanges.length > 0 ||
      Object.keys(agentOutputs).length > 0;

    return res.json({
      status: 'success',
      data: {
        since: since.toISOString(),
        now: new Date().toISOString(),
        hasChanges,
        newSuggestions,
        closedTrades,
        newSignals,
        regimeChanges,
        agentOutputs,
      },
    });
  } catch (err) {
    console.error('[diff] /since error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
