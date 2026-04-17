import { StrategyLeg } from './types';

// Format number with Indian notation (L, Cr, K)
export function formatNum(n: number, decimals = 2): string {
  if (n === 0) return '-';
  if (Math.abs(n) >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 100000) return (n / 100000).toFixed(2) + ' L';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

// Format as ₹ with Indian locale
export function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format large INR values as ₹1.05L or ₹2.3Cr
export function formatINRCompact(n: number): string {
  const sign = n >= 0 ? '+' : '';
  if (Math.abs(n) >= 10000000) return sign + '₹' + (n / 10000000).toFixed(2) + 'Cr';
  if (Math.abs(n) >= 100000) return sign + '₹' + (n / 100000).toFixed(2) + 'L';
  if (Math.abs(n) >= 1000) return sign + '₹' + (n / 1000).toFixed(1) + 'K';
  return sign + '₹' + n.toFixed(0);
}

// Unique leg ID generator
let legCounter = 0;
export function nextLegId() { return 'leg-' + (++legCounter); }

// Auto-detect strategy name from legs
export function guessStrategyName(legs: StrategyLeg[]): string {
  if (legs.length === 0) return 'Custom';
  const buys = legs.filter(l => l.side === 'BUY');
  const sells = legs.filter(l => l.side === 'SELL');
  const ces = legs.filter(l => l.type === 'CE');
  const pes = legs.filter(l => l.type === 'PE');

  if (legs.length === 2 && sells.length === 2 && ces.length === 1 && pes.length === 1) {
    return legs[0].strike === legs[1].strike ? 'Short Straddle' : 'Short Strangle';
  }
  if (legs.length === 2 && buys.length === 2 && ces.length === 1 && pes.length === 1) {
    return legs[0].strike === legs[1].strike ? 'Long Straddle' : 'Long Strangle';
  }
  if (legs.length === 4 && buys.length === 2 && sells.length === 2) {
    if (ces.length === 2 && pes.length === 2) return 'Iron Condor';
  }
  if (legs.length === 2 && ces.length === 2) {
    return buys.length === 1 ? 'Bull Call Spread' : 'Bear Call Spread';
  }
  if (legs.length === 2 && pes.length === 2) {
    return buys.length === 1 ? 'Bear Put Spread' : 'Bull Put Spread';
  }
  return 'Custom';
}

// Days to expiry from date string
export function getDTE(expiry: string): number {
  if (!expiry) return 0;
  const exp = new Date(expiry + 'T15:30:00+05:30'); // 3:30 PM IST
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// Check if a strike is ATM
export function isATM(strike: number, spotPrice: number, step: number): boolean {
  return Math.abs(strike - spotPrice) < step / 2;
}

// Check if a strike is ITM
export function isITM(strike: number, spotPrice: number, type: 'CE' | 'PE'): boolean {
  return type === 'CE' ? strike < spotPrice : strike > spotPrice;
}

// Check if a leg already exists for a given strike+type
export function legExists(legs: StrategyLeg[], strike: number, type: 'CE' | 'PE'): boolean {
  return legs.some(l => l.strike === strike && l.type === type);
}

// Estimate spot price from chain (ATM = where CE-PE premium diff is smallest)
export function estimateSpotFromChain(strikes: { strike: number; ce: { ltp: number }; pe: { ltp: number } }[]): number {
  if (!strikes.length) return 0;
  let minDiff = Infinity, atmStrike = strikes[0].strike;
  for (const s of strikes) {
    if (s.ce.ltp > 0 && s.pe.ltp > 0) {
      const diff = Math.abs(s.ce.ltp - s.pe.ltp);
      if (diff < minDiff) { minDiff = diff; atmStrike = s.strike; }
    }
  }
  return atmStrike;
}

// Get strike step size from chain
export function getStrikeStep(strikes: { strike: number }[]): number {
  if (strikes.length < 2) return 50;
  return Math.abs(strikes[1].strike - strikes[0].strike);
}

// ─── Max Pain ─────────────────────────────────────────────────────────────────

export interface MaxPainResult {
  maxPainStrike: number;        // The strike where aggregated writer pain is minimized
  totalPain: number;            // Total pain (rupees) option writers face at max pain strike
  painByStrike: { strike: number; pain: number }[]; // Full curve for charting
}

/**
 * Calculate Max Pain — the strike at which option writers collectively experience
 * the MINIMUM total loss if the underlying expires there.
 *
 * Rationale: market makers (who write options) have incentive to "pin" the underlying
 * near max pain on expiry. Historically, NIFTY / BANKNIFTY often close near this level.
 *
 * Math — for each candidate expiry spot K, total writer pain =
 *   sum over all strikes K':
 *     CE_OI[K'] × max(0, K - K')        // calls written at K' lose if spot > K'
 *   + PE_OI[K'] × max(0, K' - K)        // puts  written at K' lose if spot < K'
 *
 * Max Pain strike = K with minimum total pain.
 * Units: pain is in OI-lots × ₹ (before lot-size multiplier). Relative comparisons
 * across strikes are what matters — absolute value is informational.
 */
export function calculateMaxPain(
  strikes: { strike: number; ce: { oi: number }; pe: { oi: number } }[]
): MaxPainResult {
  if (!strikes?.length) {
    return { maxPainStrike: 0, totalPain: 0, painByStrike: [] };
  }

  const painByStrike: { strike: number; pain: number }[] = [];

  // Candidate max-pain strike = any strike in the chain
  for (const candidate of strikes) {
    const K = candidate.strike;
    let pain = 0;
    for (const s of strikes) {
      if (K > s.strike) pain += (s.ce?.oi || 0) * (K - s.strike);  // CE writers hurt
      if (K < s.strike) pain += (s.pe?.oi || 0) * (s.strike - K);  // PE writers hurt
    }
    painByStrike.push({ strike: K, pain });
  }

  // Pick the strike with minimum pain
  let minPain = Infinity;
  let maxPainStrike = strikes[0].strike;
  for (const p of painByStrike) {
    if (p.pain < minPain) { minPain = p.pain; maxPainStrike = p.strike; }
  }

  return { maxPainStrike, totalPain: minPain, painByStrike };
}
