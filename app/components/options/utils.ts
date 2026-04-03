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
