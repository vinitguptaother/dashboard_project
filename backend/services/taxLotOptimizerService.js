/**
 * taxLotOptimizerService.js — Phase 6 deliverable #5.
 *
 * Indian equity tax-lot optimizer. Given a symbol + quantity to sell,
 * returns the optimal lot order to minimize tax.
 *
 * FY26 tax rates used:
 *   - STCG (<12 months)  — 15% on equity
 *   - LTCG (≥12 months)  — 10% on equity, first ₹1L/yr exempt (not applied per-trade)
 *   - F&O                — taxed as business income at slab rate (OUT of scope here)
 *
 * Strategy:
 *   1. Gather buy-lots from TWO sources:
 *      a. TradeSetup rows with action in ['BUY','ACCUMULATE'] (closed or active)
 *      b. PortfolioHolding (broker-imported, treated as one aggregated lot)
 *   2. Deduplicate and sort by buyDate.
 *   3. Fetch current price (best-effort via Upstox LTP).
 *   4. Classify each lot as STCG (<12mo) or LTCG (≥12mo).
 *   5. Decide direction:
 *        exit at PROFIT → prefer LTCG first (10% < 15%)
 *        exit at LOSS   → prefer STCG first (sets off STCG gains elsewhere)
 *   6. Consume lots in that order until `quantity` satisfied.
 *
 * This is ADVISORY. Output is shown in a modal; user still fires sell manually.
 */

const TradeSetup = require('../models/TradeSetup');
let PortfolioHolding = null;
try { PortfolioHolding = require('../models/PortfolioHolding'); } catch (_) {}

const STCG_RATE = 0.15;
const LTCG_RATE = 0.10;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * Best-effort current price: use the most recent currentPrice across setups
 * for that symbol; fall back to entryPrice of the newest lot.
 */
async function getReferencePrice(symbol, lots) {
  const recent = await TradeSetup.find({ symbol: symbol.toUpperCase(), currentPrice: { $gt: 0 } })
    .sort({ updatedAt: -1 }).limit(1).select('currentPrice').lean();
  if (recent[0]?.currentPrice) return recent[0].currentPrice;
  if (lots.length) return lots[lots.length - 1].buyPrice;
  return 0;
}

function classifyLot(lot, exitDate = new Date()) {
  const age = exitDate.getTime() - new Date(lot.buyDate).getTime();
  return age >= MS_PER_YEAR ? 'LTCG' : 'STCG';
}

/**
 * Collect all available buy-lots for a symbol.
 * Returns array of { buyDate, quantity, buyPrice, source, sourceId }.
 */
async function collectLots(symbol) {
  const sym = symbol.toUpperCase();
  const lots = [];

  // TradeSetup-derived lots
  const setups = await TradeSetup.find({
    symbol: sym,
    action: { $in: ['BUY', 'ACCUMULATE'] },
  }).sort({ createdAt: 1 }).lean();

  for (const s of setups) {
    // If a setup was closed (TARGET_HIT / SL_HIT / EXPIRED / CANCELLED), the
    // position is already gone — skip it for sell-side lot optimization.
    if (['TARGET_HIT', 'SL_HIT', 'CANCELLED', 'EXPIRED'].includes(s.status)) continue;
    if (!s.quantity || s.quantity <= 0) continue;
    lots.push({
      buyDate: s.createdAt,
      quantity: s.quantity,
      buyPrice: s.entryFillPrice || s.entryPrice || 0,
      source: 'TradeSetup',
      sourceId: s._id,
      isPaperTrade: !!s.isPaperTrade,
    });
  }

  // PortfolioHolding-derived lots (broker-imported)
  if (PortfolioHolding) {
    const holdings = await PortfolioHolding.find({ symbol: sym }).lean();
    for (const h of holdings) {
      if (!h.quantity || h.quantity <= 0) continue;
      // Broker CSV often lacks a real buyDate — treat as "today" (STCG) in that case.
      lots.push({
        buyDate: h.buyDate || new Date(),
        quantity: h.quantity,
        buyPrice: h.avgBuyPrice || 0,
        source: 'PortfolioHolding',
        sourceId: h._id,
        isPaperTrade: false,
      });
    }
  }

  // Sort oldest first (deterministic)
  lots.sort((a, b) => new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime());
  return lots;
}

/**
 * Compute the tax implication of selling `qty` from a single lot at `exitPrice`.
 */
function computeTax(lot, qtyToSell, exitPrice, exitDate = new Date()) {
  const category = classifyLot(lot, exitDate);
  const gainPerShare = exitPrice - lot.buyPrice;
  const gain = gainPerShare * qtyToSell;
  const taxRate = category === 'LTCG' ? LTCG_RATE : STCG_RATE;
  // Tax is only on POSITIVE gains. Losses have tax = 0 (but carry set-off value — not modeled here).
  const tax = gain > 0 ? gain * taxRate : 0;
  return { category, gain, tax, taxRate };
}

/**
 * Main: given a symbol + quantity, suggest the best order of lots to sell.
 *
 * @param {Object} opts
 * @param {string} opts.symbol
 * @param {number} opts.quantity
 * @param {number} [opts.exitPrice]  — override current price if provided
 * @returns {Promise<{
 *   symbol, quantity, exitPrice, availableQty,
 *   lots: Array<{ buyDate, quantity, buyPrice, taxCategory, gainPerShare, gain, tax, source }>,
 *   totalTaxSaved,
 *   totalTaxOptimal,
 *   totalTaxFIFO,
 *   strategy,
 *   note
 * }>}
 */
async function suggestExitLots({ symbol, quantity, exitPrice }) {
  if (!symbol || typeof symbol !== 'string') throw new Error('symbol is required');
  const qtyNeeded = Number(quantity);
  if (!Number.isFinite(qtyNeeded) || qtyNeeded <= 0) throw new Error('quantity must be > 0');

  const lots = await collectLots(symbol);
  const availableQty = lots.reduce((sum, l) => sum + l.quantity, 0);
  if (availableQty === 0) {
    return {
      symbol: symbol.toUpperCase(),
      quantity: qtyNeeded,
      availableQty: 0,
      exitPrice: 0,
      lots: [],
      totalTaxOptimal: 0, totalTaxFIFO: 0, totalTaxSaved: 0,
      strategy: 'none',
      note: 'No buy-lots found for this symbol. Upload portfolio CSV or create a BUY trade setup first.',
    };
  }

  const price = Number.isFinite(exitPrice) && exitPrice > 0
    ? Number(exitPrice)
    : await getReferencePrice(symbol, lots);

  // ── Compute both orderings: FIFO vs OPTIMAL ───────────────────────────────
  const now = new Date();

  // Decide strategy based on whether AVERAGE exit is a profit or loss
  const avgBuy = lots.reduce((s, l) => s + l.buyPrice * l.quantity, 0) / availableQty;
  const isProfitSide = price >= avgBuy;

  // OPTIMAL ordering:
  //   profit side → LTCG first (10%), then STCG (15%). Within each group, sell HIGHEST cost first to minimize gain.
  //   loss side   → STCG first  (offsets STCG gains elsewhere). Within each group, sell LOWEST cost first to maximize loss.
  const classified = lots.map((l) => ({
    ...l,
    category: classifyLot(l, now),
  }));

  const sortForOptimal = (a, b) => {
    if (isProfitSide) {
      // LTCG preferred
      if (a.category !== b.category) return a.category === 'LTCG' ? -1 : 1;
      // Within group: highest cost first (smaller gain → smaller tax)
      return b.buyPrice - a.buyPrice;
    } else {
      // STCG preferred
      if (a.category !== b.category) return a.category === 'STCG' ? -1 : 1;
      // Within group: lowest cost first (bigger loss)
      return a.buyPrice - b.buyPrice;
    }
  };

  const consumeOrder = (orderedLots) => {
    let qtyLeft = Math.min(qtyNeeded, availableQty);
    let totalTax = 0;
    const consumed = [];
    for (const lot of orderedLots) {
      if (qtyLeft <= 0) break;
      const useQty = Math.min(lot.quantity, qtyLeft);
      const { category, gain, tax, taxRate } = computeTax(lot, useQty, price, now);
      consumed.push({
        buyDate: lot.buyDate,
        buyPrice: Number(lot.buyPrice.toFixed(2)),
        quantity: useQty,
        taxCategory: category,
        taxRate,
        gainPerShare: Number((price - lot.buyPrice).toFixed(2)),
        gain: Number(gain.toFixed(2)),
        estimatedTax: Number(tax.toFixed(2)),
        source: lot.source,
      });
      totalTax += tax;
      qtyLeft -= useQty;
    }
    return { consumed, totalTax };
  };

  const optimalOrder = [...classified].sort(sortForOptimal);
  const fifoOrder = [...classified]; // lots already sorted oldest-first

  const optimal = consumeOrder(optimalOrder);
  const fifo = consumeOrder(fifoOrder);

  const totalTaxOptimal = Number(optimal.totalTax.toFixed(2));
  const totalTaxFIFO = Number(fifo.totalTax.toFixed(2));
  const totalTaxSaved = Number((totalTaxFIFO - totalTaxOptimal).toFixed(2));

  return {
    symbol: symbol.toUpperCase(),
    quantity: Math.min(qtyNeeded, availableQty),
    availableQty,
    exitPrice: Number(price.toFixed(2)),
    lots: optimal.consumed,
    totalTaxOptimal,
    totalTaxFIFO,
    totalTaxSaved,
    strategy: isProfitSide ? 'LTCG-first (profit exit)' : 'STCG-first (loss exit)',
    note: qtyNeeded > availableQty
      ? `Requested ${qtyNeeded}, but only ${availableQty} available. Showing plan for ${availableQty}.`
      : '',
  };
}

module.exports = {
  suggestExitLots,
  collectLots,
  classifyLot,
  computeTax,
  // constants exported for tests
  STCG_RATE, LTCG_RATE, MS_PER_YEAR,
};
