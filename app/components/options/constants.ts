import { StrategyPreset } from './types';

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

export const UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'MIDCPNIFTY'];

export const STRIKES_AROUND_ATM = 15;

export const STRATEGY_PRESETS: StrategyPreset[] = [
  // Neutral
  {
    name: 'Short Straddle',
    category: 'neutral',
    legs: (atm) => [
      { type: 'CE', strike: atm, qty: 1, side: 'SELL' },
      { type: 'PE', strike: atm, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Long Straddle',
    category: 'volatile',
    legs: (atm) => [
      { type: 'CE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Short Strangle',
    category: 'neutral',
    legs: (atm, step) => [
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'SELL' },
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Long Strangle',
    category: 'volatile',
    legs: (atm, step) => [
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Iron Condor',
    category: 'neutral',
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
    legs: (atm, step) => [
      { type: 'CE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'CE', strike: atm + step * 3, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Bull Put Spread',
    category: 'bullish',
    legs: (atm, step) => [
      { type: 'PE', strike: atm - step * 3, qty: 1, side: 'SELL' },
      { type: 'PE', strike: atm, qty: 1, side: 'BUY' },
    ],
  },
  // Bearish
  {
    name: 'Bear Put Spread',
    category: 'bearish',
    legs: (atm, step) => [
      { type: 'PE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm - step * 3, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Bear Call Spread',
    category: 'bearish',
    legs: (atm, step) => [
      { type: 'CE', strike: atm, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 3, qty: 1, side: 'BUY' },
    ],
  },
  // Volatile
  {
    name: 'Jade Lizard',
    category: 'bullish',
    legs: (atm, step) => [
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 4, qty: 1, side: 'BUY' },
    ],
  },
];

export const MULTIPLIER_OPTIONS = [1, 2, 3, 5, 10];
