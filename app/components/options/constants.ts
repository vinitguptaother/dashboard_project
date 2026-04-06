import { StrategyPreset } from './types';

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

export const UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'MIDCPNIFTY'];

export const STRIKES_AROUND_ATM = 15;

export const STRATEGY_PRESETS: StrategyPreset[] = [
  // Neutral
  {
    name: 'Short Straddle',
    category: 'neutral',
    description: 'Sell ATM CE + PE. Profit if market stays near current price.',
    legs: (atm) => [
      { type: 'CE', strike: atm, qty: 1, side: 'SELL' },
      { type: 'PE', strike: atm, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Short Strangle',
    category: 'neutral',
    description: 'Sell OTM CE + PE. Wider profit zone than straddle.',
    legs: (atm, step) => [
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'SELL' },
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Iron Condor',
    category: 'neutral',
    description: 'Sell strangle + buy wings. Limited risk, limited reward.',
    legs: (atm, step) => [
      { type: 'PE', strike: atm - step * 4, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 4, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Iron Butterfly',
    category: 'neutral',
    description: 'Sell straddle + buy wings. Max profit at ATM.',
    legs: (atm, step) => [
      { type: 'PE', strike: atm - step * 3, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 3, qty: 1, side: 'BUY' },
    ],
  },
  // Bullish
  {
    name: 'Bull Call Spread',
    category: 'bullish',
    description: 'Buy ATM CE + Sell OTM CE. Limited risk bullish bet.',
    legs: (atm, step) => [
      { type: 'CE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'CE', strike: atm + step * 3, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Bull Put Spread',
    category: 'bullish',
    description: 'Sell ATM PE + Buy OTM PE. Credit spread, profit if market stays up.',
    legs: (atm, step) => [
      { type: 'PE', strike: atm - step * 3, qty: 1, side: 'SELL' },
      { type: 'PE', strike: atm, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Jade Lizard',
    category: 'bullish',
    description: 'Sell put + sell call spread. No upside risk if done for credit.',
    legs: (atm, step) => [
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 4, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Synthetic Long',
    category: 'bullish',
    description: 'Buy ATM CE + Sell ATM PE. Mimics stock ownership.',
    legs: (atm) => [
      { type: 'CE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm, qty: 1, side: 'SELL' },
    ],
  },
  // Bearish
  {
    name: 'Bear Put Spread',
    category: 'bearish',
    description: 'Buy ATM PE + Sell OTM PE. Limited risk bearish bet.',
    legs: (atm, step) => [
      { type: 'PE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm - step * 3, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Bear Call Spread',
    category: 'bearish',
    description: 'Sell ATM CE + Buy OTM CE. Credit spread, profit if market stays down.',
    legs: (atm, step) => [
      { type: 'CE', strike: atm, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 3, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Synthetic Short',
    category: 'bearish',
    description: 'Buy ATM PE + Sell ATM CE. Mimics short selling.',
    legs: (atm) => [
      { type: 'PE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'CE', strike: atm, qty: 1, side: 'SELL' },
    ],
  },
  // Volatile
  {
    name: 'Long Straddle',
    category: 'volatile',
    description: 'Buy ATM CE + PE. Profit on big move in either direction.',
    legs: (atm) => [
      { type: 'CE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Long Strangle',
    category: 'volatile',
    description: 'Buy OTM CE + PE. Cheaper than straddle, needs bigger move.',
    legs: (atm, step) => [
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Long Call Butterfly',
    category: 'neutral',
    description: 'Buy 1 ITM + Sell 2 ATM + Buy 1 OTM call. Low cost, max profit at ATM.',
    legs: (atm, step) => [
      { type: 'CE', strike: atm - step * 2, qty: 1, side: 'BUY' },
      { type: 'CE', strike: atm, qty: 2, side: 'SELL' },
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Ratio Spread',
    category: 'neutral',
    description: 'Buy 1 ATM + Sell 2 OTM calls. Low cost, risk on big upside move.',
    legs: (atm, step) => [
      { type: 'CE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'CE', strike: atm + step * 3, qty: 2, side: 'SELL' },
    ],
  },
];

export const MULTIPLIER_OPTIONS = [1, 2, 3, 5, 10];

export const STRATEGY_CATEGORIES = ['all', 'neutral', 'bullish', 'bearish', 'volatile'] as const;
