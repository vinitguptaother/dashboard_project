/**
 * Paper Realism Service — applies real-world costs + slippage + latency to
 * paper trades so paper P&L matches what live trading would actually produce.
 *
 * BOT_BLUEPRINT item #9. Foundational for Sprint 3 — the 4 bots
 * (Swing / Long-term / Options Sell / Options Buy) all book trades through
 * this engine so graduation-to-live is honest.
 *
 * Cost math based on Indian discount-broker structure (Zerodha-style, FY26).
 * All rates live in CONSTANTS at the top — edit there to tune for your broker.
 *
 * Segments supported:
 *   • equity-delivery  — long-term bot, sometimes swing
 *   • equity-intraday  — swing bot intraday exits
 *   • options          — options buy + options sell bots
 *   • futures          — reserved for future bot
 *
 * Slippage model:
 *   • Default liquidity band lookup (LARGE / MID / SMALL / ILLIQUID) → bps.
 *   • Override via `liquidityBps` param if caller has better info.
 *   • Direction: BUY fills HIGHER than quote, SELL fills LOWER.
 */

// ─── CONSTANTS — Indian broker cost structure (FY26-27) ─────────────────────
// All percentages are in decimal (0.001 = 0.1%). Edit here to tune.
const COSTS = {
  'equity-delivery': {
    brokerage:           { type: 'flat', value: 0 },            // Zerodha: free
    sttBuyPct:           0,
    sttSellPct:          0.001,                                  // 0.1% on sell
    exchangeTxnPct:      0.0000297,                              // NSE 0.00297% each side
    sebiPct:             0.000001,                               // ₹10/crore
    stampDutyPct:        0.00015,                                // 0.015% on BUY only
    gstPct:              0.18,                                   // 18% on brokerage+exchange+SEBI
    dpChargesPerSell:    15.93,                                  // Flat ₹13.5 + 18% GST, per symbol per day
  },
  'equity-intraday': {
    brokerage:           { type: 'lower-of', flat: 20, pct: 0.0003 }, // ₹20 OR 0.03%, whichever lower
    sttBuyPct:           0,
    sttSellPct:          0.00025,                                // 0.025% on sell
    exchangeTxnPct:      0.0000297,
    sebiPct:             0.000001,
    stampDutyPct:        0.00003,                                // 0.003% on BUY
    gstPct:              0.18,
    dpChargesPerSell:    0,
  },
  'options': {
    brokerage:           { type: 'lower-of', flat: 20, pct: 0.0003 }, // ₹20 OR 0.03%
    sttBuyPct:           0,
    sttSellPct:          0.000625,                               // 0.0625% on premium SELL
    exchangeTxnPct:      0.00053,                                // 0.053% on premium (Oct 2024 raise)
    sebiPct:             0.000001,
    stampDutyPct:        0.00003,                                // 0.003% on BUY
    gstPct:              0.18,
    dpChargesPerSell:    0,
  },
  'futures': {
    brokerage:           { type: 'lower-of', flat: 20, pct: 0.0003 },
    sttBuyPct:           0,
    sttSellPct:          0.0000125,                              // 0.00125% of notional on SELL (post FY26 increase note: check broker)
    exchangeTxnPct:      0.0000173,                              // NSE 0.00173% FO futures
    sebiPct:             0.000001,
    stampDutyPct:        0.00002,                                // 0.002% on BUY
    gstPct:              0.18,
    dpChargesPerSell:    0,
  },
};

// Liquidity band slippage (basis points on quote).
// Applied as BUY fills = ltp × (1 + bps/10000), SELL = ltp × (1 − bps/10000).
const SLIPPAGE_BPS = {
  LARGE:    2,    // e.g. RELIANCE, HDFCBANK — tight spreads, small impact
  MID:      5,    // mid-cap names
  SMALL:    15,   // small-cap
  ILLIQUID: 40,   // low volume names
  OPTIONS:  10,   // premium slippage, varies by moneyness
};

// Latency simulation — broker roundtrip + exchange match in ms.
const LATENCY = { minMs: 400, maxMs: 1600 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(x) { return Math.round(x * 100) / 100; }

function computeBrokerage(cfg, notional) {
  if (!cfg) return 0;
  if (cfg.type === 'flat') return cfg.value;
  if (cfg.type === 'lower-of') {
    const byPct = notional * cfg.pct;
    return Math.min(cfg.flat, byPct);
  }
  return 0;
}

/**
 * Per-leg cost breakdown (one side: entry OR exit).
 *
 * @param {Object} p
 * @param {'equity-delivery'|'equity-intraday'|'options'|'futures'} p.segment
 * @param {'BUY'|'SELL'} p.side
 * @param {number} p.qty
 * @param {number} p.price  — fill price (after slippage)
 * @returns {Object} — { brokerage, stt, exchangeTxn, sebi, stampDuty, gst, dp, total, notional }
 */
function computeLegCosts({ segment, side, qty, price }) {
  const c = COSTS[segment];
  if (!c) throw new Error(`Unknown segment "${segment}"`);
  const notional = qty * price;
  const brokerage = round2(computeBrokerage(c.brokerage, notional));
  const stt = side === 'BUY'
    ? round2(notional * c.sttBuyPct)
    : round2(notional * c.sttSellPct);
  const exchangeTxn = round2(notional * c.exchangeTxnPct);
  const sebi = round2(notional * c.sebiPct);
  const stampDuty = side === 'BUY' ? round2(notional * c.stampDutyPct) : 0;
  // GST applies to brokerage + exchange charges + SEBI fee.
  const gst = round2((brokerage + exchangeTxn + sebi) * c.gstPct);
  const dp = (segment === 'equity-delivery' && side === 'SELL') ? c.dpChargesPerSell : 0;
  const total = round2(brokerage + stt + exchangeTxn + sebi + stampDuty + gst + dp);
  return { brokerage, stt, exchangeTxn, sebi, stampDuty, gst, dp, total, notional };
}

/**
 * Apply slippage to LTP to produce a realistic fill price.
 *
 * @param {Object} p
 * @param {'BUY'|'SELL'} p.side
 * @param {number} p.ltp
 * @param {string} [p.liquidityBand='MID']  — LARGE / MID / SMALL / ILLIQUID / OPTIONS
 * @param {number} [p.liquidityBps]         — explicit override in bps
 * @returns {Object} — { fillPrice, slippageBps, band }
 */
function applySlippage({ side, ltp, liquidityBand = 'MID', liquidityBps = null }) {
  const band = String(liquidityBand).toUpperCase();
  const bps = liquidityBps != null ? liquidityBps : (SLIPPAGE_BPS[band] ?? SLIPPAGE_BPS.MID);
  const mul = 1 + ((side === 'BUY' ? 1 : -1) * bps / 10000);
  const fillPrice = round2(ltp * mul);
  return { fillPrice, slippageBps: bps, band };
}

function simulateLatencyMs() {
  return Math.round(LATENCY.minMs + Math.random() * (LATENCY.maxMs - LATENCY.minMs));
}

/**
 * Full round-trip: compute realistic net P&L for a closed paper trade.
 *
 * @param {Object} p
 * @param {'equity-delivery'|'equity-intraday'|'options'|'futures'} p.segment
 * @param {'BUY'|'SELL'} p.entrySide          — direction of the entry leg
 * @param {number} p.qty
 * @param {number} p.entryFillPrice
 * @param {number} p.exitFillPrice
 * @returns {Object} — { grossPnL, entryCosts, exitCosts, totalCharges, netPnL, roiPct }
 */
function computeRealisticPnL({ segment, entrySide, qty, entryFillPrice, exitFillPrice }) {
  const exitSide = entrySide === 'BUY' ? 'SELL' : 'BUY';
  const entryCosts = computeLegCosts({ segment, side: entrySide, qty, price: entryFillPrice });
  const exitCosts  = computeLegCosts({ segment, side: exitSide,  qty, price: exitFillPrice  });
  // Gross = (exit − entry) × qty if entrySide=BUY; else (entry − exit) × qty.
  const directionSign = entrySide === 'BUY' ? 1 : -1;
  const grossPnL = round2(directionSign * (exitFillPrice - entryFillPrice) * qty);
  const totalCharges = round2(entryCosts.total + exitCosts.total);
  const netPnL = round2(grossPnL - totalCharges);
  const capitalDeployed = qty * entryFillPrice;
  const roiPct = capitalDeployed > 0 ? parseFloat(((netPnL / capitalDeployed) * 100).toFixed(3)) : 0;
  return { grossPnL, entryCosts, exitCosts, totalCharges, netPnL, roiPct };
}

/**
 * Preview for UI — shown BEFORE placing a paper trade so user knows what
 * their net P&L would be at the target (assuming no mid-trade adjustments).
 *
 * @param {Object} p — { segment, entrySide, qty, entryPrice, stopLoss, target, liquidityBand }
 * @returns {Object} — { atTarget: {...}, atStop: {...}, breakEven: number, slippagePreview: {...} }
 */
function previewTrade({ segment, entrySide, qty, entryPrice, stopLoss, target, liquidityBand = 'MID' }) {
  const band = segment === 'options' ? 'OPTIONS' : liquidityBand;
  const entry = applySlippage({ side: entrySide, ltp: entryPrice, liquidityBand: band });
  const exitSide = entrySide === 'BUY' ? 'SELL' : 'BUY';
  const targetFill = applySlippage({ side: exitSide, ltp: target,   liquidityBand: band });
  const stopFill   = applySlippage({ side: exitSide, ltp: stopLoss, liquidityBand: band });

  const atTarget = computeRealisticPnL({
    segment, entrySide, qty,
    entryFillPrice: entry.fillPrice,
    exitFillPrice: targetFill.fillPrice,
  });
  const atStop = computeRealisticPnL({
    segment, entrySide, qty,
    entryFillPrice: entry.fillPrice,
    exitFillPrice: stopFill.fillPrice,
  });

  // Break-even exit price = entry + (all charges / qty), direction-adjusted.
  // Using atTarget's totalCharges as a rough proxy (it's usually close to atStop within a few %).
  const breakEvenMove = atTarget.totalCharges / qty;
  const breakEven = entrySide === 'BUY'
    ? round2(entry.fillPrice + breakEvenMove)
    : round2(entry.fillPrice - breakEvenMove);

  return {
    slippagePreview: { entry, targetFill, stopFill },
    atTarget,
    atStop,
    breakEven,
    notes: {
      segment,
      liquidityBand: band,
      slippageBps: entry.slippageBps,
      latencyMs: simulateLatencyMs(),
    },
  };
}

module.exports = {
  COSTS, SLIPPAGE_BPS, LATENCY,
  computeLegCosts,
  applySlippage,
  simulateLatencyMs,
  computeRealisticPnL,
  previewTrade,
};
