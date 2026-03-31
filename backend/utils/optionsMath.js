/**
 * Options Math Utilities
 * Pure math functions — no API calls, no side effects.
 * Used by the strategy builder and payoff chart.
 */

// ─── Payoff Calculation ────────────────────────────────────────────────────────

/**
 * Calculate P&L for a multi-leg options strategy at each spot price.
 * @param {Array} legs — [{ type: 'CE'|'PE', strike, premium, qty, side: 'BUY'|'SELL', lotSize }]
 * @param {number} spotMin — start of spot range
 * @param {number} spotMax — end of spot range
 * @param {number} steps — number of data points (default 200)
 * @returns {Array} — [{ spot, pnl }]
 */
function calculatePayoff(legs, spotMin, spotMax, steps = 200) {
  const result = [];
  const step = (spotMax - spotMin) / steps;

  for (let i = 0; i <= steps; i++) {
    const spot = spotMin + step * i;
    let totalPnl = 0;

    for (const leg of legs) {
      const lots = leg.qty || 1;
      const lotSize = leg.lotSize || 1;
      const multiplier = leg.side === 'SELL' ? -1 : 1;
      let intrinsic = 0;

      if (leg.type === 'CE') {
        intrinsic = Math.max(0, spot - leg.strike);
      } else {
        intrinsic = Math.max(0, leg.strike - spot);
      }

      // P&L per unit = (intrinsic - premium) * multiplier
      // For seller: (premium - intrinsic) = -(intrinsic - premium)
      const pnlPerUnit = (intrinsic - leg.premium) * multiplier;
      totalPnl += pnlPerUnit * lots * lotSize;
    }

    result.push({ spot: parseFloat(spot.toFixed(2)), pnl: parseFloat(totalPnl.toFixed(2)) });
  }

  return result;
}

// ─── Breakevens ────────────────────────────────────────────────────────────────

/**
 * Find breakeven points (where P&L crosses zero).
 * @param {Array} payoffData — output of calculatePayoff()
 * @returns {Array} — breakeven spot prices
 */
function calculateBreakevens(payoffData) {
  const breakevens = [];
  for (let i = 1; i < payoffData.length; i++) {
    const prev = payoffData[i - 1];
    const curr = payoffData[i];
    // Zero crossing
    if ((prev.pnl <= 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl <= 0)) {
      // Linear interpolation
      if (curr.pnl !== prev.pnl) {
        const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
        const be = prev.spot + ratio * (curr.spot - prev.spot);
        breakevens.push(parseFloat(be.toFixed(2)));
      }
    }
  }
  return breakevens;
}

// ─── Max Profit / Loss ─────────────────────────────────────────────────────────

/**
 * Calculate max profit, max loss, and risk-reward from payoff data.
 * @param {Array} payoffData — output of calculatePayoff()
 * @returns {{ maxProfit, maxLoss, riskReward }}
 */
function calculateMaxProfitLoss(payoffData) {
  let maxProfit = -Infinity;
  let maxLoss = Infinity;

  for (const d of payoffData) {
    if (d.pnl > maxProfit) maxProfit = d.pnl;
    if (d.pnl < maxLoss) maxLoss = d.pnl;
  }

  // Check if profit/loss is unbounded (edge values still trending)
  const first = payoffData[0]?.pnl || 0;
  const last = payoffData[payoffData.length - 1]?.pnl || 0;
  const profitUnlimited = maxProfit === first || maxProfit === last;
  const lossUnlimited = maxLoss === first || maxLoss === last;

  const riskReward = maxLoss !== 0 ? Math.abs(maxProfit / maxLoss) : Infinity;

  return {
    maxProfit: profitUnlimited ? 'Unlimited' : parseFloat(maxProfit.toFixed(2)),
    maxLoss: lossUnlimited ? 'Unlimited' : parseFloat(maxLoss.toFixed(2)),
    riskReward: riskReward === Infinity ? 'N/A' : parseFloat(riskReward.toFixed(2)),
  };
}

// ─── SD (Standard Deviation) Moves ─────────────────────────────────────────────

/**
 * Calculate 1SD and 2SD price bands from current spot.
 * @param {number} spot — current underlying price
 * @param {number} iv — implied volatility (decimal, e.g. 0.15 for 15%)
 * @param {number} daysToExpiry — calendar days
 * @returns {{ sd1Upper, sd1Lower, sd2Upper, sd2Lower, sdValue }}
 */
function calculateSDMoves(spot, iv, daysToExpiry) {
  if (!spot || !iv || !daysToExpiry || daysToExpiry <= 0) {
    return { sd1Upper: spot, sd1Lower: spot, sd2Upper: spot, sd2Lower: spot, sdValue: 0 };
  }

  const sd = spot * iv * Math.sqrt(daysToExpiry / 365);

  return {
    sd1Upper: parseFloat((spot + sd).toFixed(2)),
    sd1Lower: parseFloat((spot - sd).toFixed(2)),
    sd2Upper: parseFloat((spot + 2 * sd).toFixed(2)),
    sd2Lower: parseFloat((spot - 2 * sd).toFixed(2)),
    sdValue: parseFloat(sd.toFixed(2)),
  };
}

// ─── Greeks Aggregation ────────────────────────────────────────────────────────

/**
 * Aggregate Greeks across all legs.
 * @param {Array} legs — [{ delta, theta, gamma, vega, qty, side, lotSize }]
 * @returns {{ netDelta, netTheta, netGamma, netVega }}
 */
function aggregateGreeks(legs) {
  let netDelta = 0, netTheta = 0, netGamma = 0, netVega = 0;

  for (const leg of legs) {
    const lots = leg.qty || 1;
    const lotSize = leg.lotSize || 1;
    const multiplier = leg.side === 'SELL' ? -1 : 1;
    const totalQty = lots * lotSize * multiplier;

    netDelta += (leg.delta || 0) * totalQty;
    netTheta += (leg.theta || 0) * totalQty;
    netGamma += (leg.gamma || 0) * totalQty;
    netVega += (leg.vega || 0) * totalQty;
  }

  return {
    netDelta: parseFloat(netDelta.toFixed(4)),
    netTheta: parseFloat(netTheta.toFixed(2)),
    netGamma: parseFloat(netGamma.toFixed(6)),
    netVega: parseFloat(netVega.toFixed(2)),
  };
}

// ─── Probability of Profit (POP) ──────────────────────────────────────────────

/**
 * Estimate Probability of Profit using normal distribution.
 * Assumes log-normal returns.
 * @param {Array} breakevens — breakeven spot prices
 * @param {number} spot — current price
 * @param {number} iv — implied volatility (decimal)
 * @param {number} daysToExpiry — calendar days
 * @param {string} direction — 'CREDIT' or 'DEBIT' (credit = profit inside breakevens)
 * @returns {number} — POP as percentage (0-100)
 */
function calculatePOP(breakevens, spot, iv, daysToExpiry, direction = 'CREDIT') {
  if (!breakevens.length || !spot || !iv || daysToExpiry <= 0) return 0;

  const sigma = iv * Math.sqrt(daysToExpiry / 365);

  // Standard normal CDF approximation (Abramowitz and Stegun)
  function normCDF(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.SQRT2;
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  }

  // Calculate Z-scores for each breakeven
  const zScores = breakevens.map(be => Math.log(be / spot) / sigma);

  if (breakevens.length === 1) {
    const prob = normCDF(zScores[0]);
    // Credit spread: profit if spot stays below upper BE (for puts) or above lower BE
    return direction === 'CREDIT'
      ? parseFloat((prob * 100).toFixed(1))
      : parseFloat(((1 - prob) * 100).toFixed(1));
  }

  if (breakevens.length === 2) {
    const [z1, z2] = zScores.sort((a, b) => a - b);
    const probBetween = normCDF(z2) - normCDF(z1);
    // Credit: profit between breakevens; Debit: profit outside
    return direction === 'CREDIT'
      ? parseFloat((probBetween * 100).toFixed(1))
      : parseFloat(((1 - probBetween) * 100).toFixed(1));
  }

  // For 3+ breakevens, approximate
  return 0;
}

/**
 * Calculate net premium for a strategy.
 * Positive = credit received, Negative = debit paid.
 * @param {Array} legs
 * @returns {{ netPremium, type }}
 */
function calculateNetPremium(legs) {
  let net = 0;
  for (const leg of legs) {
    const lots = leg.qty || 1;
    const lotSize = leg.lotSize || 1;
    const multiplier = leg.side === 'SELL' ? 1 : -1; // selling = receiving premium
    net += leg.premium * lots * lotSize * multiplier;
  }
  return {
    netPremium: parseFloat(net.toFixed(2)),
    type: net >= 0 ? 'CREDIT' : 'DEBIT',
  };
}

module.exports = {
  calculatePayoff,
  calculateBreakevens,
  calculateMaxProfitLoss,
  calculateSDMoves,
  aggregateGreeks,
  calculatePOP,
  calculateNetPremium,
};
