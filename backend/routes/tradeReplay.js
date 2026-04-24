// backend/routes/tradeReplay.js
// Trade Replay / Post-Trade Review — rebuilds the full story for any closed
// (or active) TradeSetup:
//   • entry context (AI reasoning, screen, confidence)
//   • market conditions at entry (NIFTY price, trend)
//   • price path between createdAt and closedAt (Yahoo chart fallback)
//   • what happened (target hit / SL hit / still active)
//   • a "better action" scorecard based on the path
// Read-only.

const express = require('express');
const axios = require('axios');
const router = express.Router();
const TradeSetup = require('../models/TradeSetup');
const ScreenBatch = require('../models/ScreenBatch');
const { apiLogger } = require('../middleware/logger');

// ─── Helper: fetch Yahoo daily candles between two dates ────────────────────
async function fetchPricePath(symbol, from, to) {
  try {
    const fromTs = Math.floor(new Date(from).getTime() / 1000);
    const toTs = Math.floor(new Date(to).getTime() / 1000);
    if (toTs - fromTs < 60 * 60) return []; // too short
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS` +
                `?period1=${fromTs}&period2=${toTs}&interval=1d`;
    const r = await axios.get(url, { timeout: 8000 });
    const result = r.data?.chart?.result?.[0];
    if (!result) return [];
    const ts = result.timestamp || [];
    const q = result.indicators?.quote?.[0];
    if (!q || !Array.isArray(q.close)) return [];
    const out = [];
    for (let i = 0; i < ts.length; i++) {
      const close = q.close[i];
      const high = q.high?.[i];
      const low = q.low?.[i];
      const open = q.open?.[i];
      const vol = q.volume?.[i];
      if (close == null) continue;
      out.push({
        date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
        open: open != null ? parseFloat(open.toFixed(2)) : null,
        close: parseFloat(close.toFixed(2)),
        high: high != null ? parseFloat(high.toFixed(2)) : null,
        low: low != null ? parseFloat(low.toFixed(2)) : null,
        volume: vol || 0,
      });
    }
    return out;
  } catch (e) {
    apiLogger.error('TradeReplay', 'fetchPricePath', e, { symbol });
    return [];
  }
}

// ─── Helper: fetch NIFTY context for a date range ───────────────────────────
async function fetchNiftyContext(from, to) {
  try {
    const fromTs = Math.floor(new Date(from).getTime() / 1000);
    const toTs = Math.floor(new Date(to).getTime() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI` +
                `?period1=${fromTs}&period2=${toTs}&interval=1d`;
    const r = await axios.get(url, { timeout: 8000 });
    const result = r.data?.chart?.result?.[0];
    if (!result) return null;
    const ts = result.timestamp || [];
    const q = result.indicators?.quote?.[0];
    if (!q || !Array.isArray(q.close)) return null;
    const closes = q.close.filter((v) => v != null);
    if (closes.length < 2) return null;
    const first = closes[0];
    const last = closes[closes.length - 1];
    const niftyReturn = ((last - first) / first) * 100;
    return {
      openPrice: parseFloat(first.toFixed(2)),
      closePrice: parseFloat(last.toFixed(2)),
      returnPct: parseFloat(niftyReturn.toFixed(2)),
      trend: niftyReturn > 1 ? 'bullish' : niftyReturn < -1 ? 'bearish' : 'sideways',
      days: closes.length,
      dateFrom: new Date(ts[0] * 1000).toISOString().slice(0, 10),
      dateTo: new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}

// ─── GET /api/trade-replay/:id ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const trade = await TradeSetup.findById(req.params.id).lean();
    if (!trade) {
      return res.status(404).json({ status: 'error', message: 'Trade not found' });
    }

    const start = trade.createdAt || trade.updatedAt;
    // end window: closedAt if closed, otherwise now (cap at 180 days from start)
    const now = Date.now();
    const hardCap = new Date(start).getTime() + 180 * 24 * 60 * 60 * 1000;
    const end = trade.closedAt
      ? new Date(trade.closedAt).getTime()
      : Math.min(now, hardCap);

    // ── 1. Price path ──
    const pricePath = await fetchPricePath(trade.symbol, start, new Date(end));

    // ── 2. Market context (NIFTY) ──
    const marketContext = await fetchNiftyContext(start, new Date(end));

    // ── 3. Screen context (if linked) ──
    let screenContext = null;
    if (trade.screenBatchId) {
      try {
        const batch = await ScreenBatch.findById(trade.screenBatchId)
          .select('screenName runDate totalStocks rankedResults')
          .lean();
        if (batch) {
          const rank = (batch.rankedResults || []).findIndex((r) => r.symbol === trade.symbol);
          screenContext = {
            screenName: batch.screenName,
            runDate: batch.runDate,
            totalStocks: batch.totalStocks,
            rankAtEntry: rank >= 0 ? rank + 1 : null,
          };
        }
      } catch { /* ignore */ }
    }

    // ── 4. Path analysis: did it touch target? did it touch SL? when? ──
    let targetHit = null, slHit = null, maxPrice = null, minPrice = null;
    let targetHitDate = null, slHitDate = null;
    const isBuy = trade.action === 'BUY' || trade.action === 'ACCUMULATE';

    for (const d of pricePath) {
      if (maxPrice === null || (d.high ?? d.close) > maxPrice) maxPrice = d.high ?? d.close;
      if (minPrice === null || (d.low ?? d.close) < minPrice) minPrice = d.low ?? d.close;
      if (isBuy) {
        if (targetHit === null && (d.high ?? d.close) >= trade.target) {
          targetHit = d.date;
          targetHitDate = d.date;
        }
        if (slHit === null && (d.low ?? d.close) <= trade.stopLoss) {
          slHit = d.date;
          slHitDate = d.date;
        }
      } else if (trade.action === 'SELL') {
        if (targetHit === null && (d.low ?? d.close) <= trade.target) {
          targetHit = d.date;
          targetHitDate = d.date;
        }
        if (slHit === null && (d.high ?? d.close) >= trade.stopLoss) {
          slHit = d.date;
          slHitDate = d.date;
        }
      }
    }

    // Whichever hit FIRST in time is the "actual" outcome
    let pathOutcome = 'open';
    if (targetHitDate && slHitDate) {
      pathOutcome = targetHitDate <= slHitDate ? 'target_hit_first' : 'sl_hit_first';
    } else if (targetHitDate) pathOutcome = 'target_hit';
    else if (slHitDate) pathOutcome = 'sl_hit';

    // ── 5. Better-action analysis ──
    // If target was hit but recorded outcome is still active, user missed exit.
    // If max price got within 80% of the way to target, it was close — worth noting.
    const lastClose = pricePath.length > 0 ? pricePath[pricePath.length - 1].close : null;
    const entryToTarget = trade.target - trade.entryPrice;
    const maxProfitAvailable = isBuy && maxPrice !== null
      ? ((maxPrice - trade.entryPrice) / trade.entryPrice) * 100
      : !isBuy && minPrice !== null
      ? ((trade.entryPrice - minPrice) / trade.entryPrice) * 100
      : null;
    const actualPnl = trade.exitPrice != null
      ? (isBuy
          ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100
          : ((trade.entryPrice - trade.exitPrice) / trade.entryPrice) * 100)
      : (lastClose != null
          ? (isBuy
              ? ((lastClose - trade.entryPrice) / trade.entryPrice) * 100
              : ((trade.entryPrice - lastClose) / trade.entryPrice) * 100)
          : null);

    const insights = [];
    if (pathOutcome === 'target_hit_first' && trade.status === 'ACTIVE') {
      insights.push({
        level: 'warning',
        text: `Target was touched on ${targetHitDate} but trade is still marked ACTIVE — you may have missed the exit.`,
      });
    }
    if (pathOutcome === 'sl_hit_first' && trade.status === 'ACTIVE') {
      insights.push({
        level: 'error',
        text: `Stop-loss was breached on ${slHitDate} but trade is still marked ACTIVE — you may be riding a losing position.`,
      });
    }
    if (maxProfitAvailable !== null && actualPnl !== null && maxProfitAvailable - actualPnl > 5) {
      insights.push({
        level: 'info',
        text: `You left ${(maxProfitAvailable - actualPnl).toFixed(1)}% on the table — price went ${maxProfitAvailable.toFixed(1)}% your way before reversing.`,
      });
    }
    if (marketContext && marketContext.trend === 'bearish' && isBuy) {
      insights.push({
        level: 'info',
        text: `Entered a BUY during a bearish NIFTY window (${marketContext.returnPct}% over ${marketContext.days} days). Consider avoiding BUYs when index is falling.`,
      });
    }
    if (trade.confidence < 50) {
      insights.push({
        level: 'info',
        text: `This setup's confidence was only ${trade.confidence}%. Consider a minimum-confidence filter (e.g. ≥60%) going forward.`,
      });
    }

    const replay = {
      trade: {
        _id: trade._id,
        symbol: trade.symbol,
        action: trade.action,
        tradeType: trade.tradeType,
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        target: trade.target,
        exitPrice: trade.exitPrice,
        status: trade.status,
        confidence: trade.confidence,
        reasoning: trade.reasoning,
        riskFactors: trade.riskFactors,
        riskRewardRatio: trade.riskRewardRatio,
        holdingDuration: trade.holdingDuration,
        createdAt: trade.createdAt,
        closedAt: trade.closedAt,
        isPaperTrade: trade.isPaperTrade,
      },
      screenContext,
      marketContext,
      pricePath,
      pathAnalysis: {
        outcome: pathOutcome,
        targetHitDate,
        slHitDate,
        maxPrice: maxPrice !== null ? parseFloat(maxPrice.toFixed(2)) : null,
        minPrice: minPrice !== null ? parseFloat(minPrice.toFixed(2)) : null,
        lastClose,
        maxProfitAvailablePct: maxProfitAvailable !== null ? parseFloat(maxProfitAvailable.toFixed(2)) : null,
        actualPnlPct: actualPnl !== null ? parseFloat(actualPnl.toFixed(2)) : null,
        daysInTrade: pricePath.length,
      },
      insights,
    };

    apiLogger.info('TradeReplay', 'replay', { id: req.params.id, symbol: trade.symbol, outcome: pathOutcome });

    res.json({ status: 'success', data: replay });
  } catch (err) {
    apiLogger.error('TradeReplay', 'replay', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
