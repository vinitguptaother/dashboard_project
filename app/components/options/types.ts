// Options Tab — Shared TypeScript Interfaces

export interface OptionSide {
  ltp: number;
  oi: number;
  volume: number;
  iv: number;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  bidPrice: number;
  askPrice: number;
  instrumentKey: string;
}

export interface Strike {
  strike: number;
  ce: OptionSide;
  pe: OptionSide;
}

export interface OptionChainData {
  underlying: string;
  expiry: string;
  strikes: Strike[];
  totalCallOI: number;
  totalPutOI: number;
  pcr: string;
}

export interface ExpiryData {
  expiries: string[];
  lotSize: number;
  underlying: string;
}

export interface StrategyLeg {
  id: string;
  type: 'CE' | 'PE';
  strike: number;
  premium: number;
  qty: number;
  side: 'BUY' | 'SELL';
  lotSize: number;
  iv: number;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  expiry?: string; // per-leg expiry for calendar spreads
}

export interface PayoffResult {
  payoffData: { spot: number; pnl: number }[];
  breakevens: number[];
  maxProfit: number | string;
  maxLoss: number | string;
  riskReward: number | string;
  sdMoves: { sd1Upper: number; sd1Lower: number; sd2Upper: number; sd2Lower: number; sdValue: number };
  greeks: { netDelta: number; netTheta: number; netGamma: number; netVega: number };
  netPremium: number;
  premiumType: string;
  pop: number;
}

export interface MarginData {
  totalMargin: number;
  spanMargin: number;
  exposureMargin: number;
  marginBenefit: number;
  error?: string;
}

export interface OptionsMockTrade {
  _id: string;
  underlying: string;
  expiry: string;
  strategyName: string;
  legs: { type: string; strike: number; premium: number; qty: number; side: string; lotSize: number }[];
  entrySpot: number;
  exitSpot: number | null;
  netPremium: number;
  premiumType: string;
  maxProfit: number | string;
  maxLoss: number | string;
  breakevens: number[];
  pop: number;
  status: string;
  exitPnl: number | null;
  notes: string;
  closedAt: string | null;
  createdAt: string;
}

export interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  openTrades: number;
}

export interface RealTrade {
  _id: string;
  underlying: string;
  expiry: string;
  strategyName: string;
  legsText: string;
  entrySpot: number;
  exitSpot: number | null;
  netPremium: number;
  premiumType: string;
  exitPnl: number | null;
  brokerage: number;
  broker: string;
  notes: string;
  status: string;
  closedAt: string | null;
  createdAt: string;
}

export interface RealTradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  totalBrokerage: number;
  openTrades: number;
}

export interface DraftPortfolio {
  _id: string;
  name: string;
  strategies: OptionsMockTrade[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyPreset {
  name: string;
  category: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  description?: string;
  legs: (atm: number, step: number) => Omit<StrategyLeg, 'id' | 'premium' | 'lotSize' | 'iv' | 'delta' | 'theta' | 'gamma' | 'vega'>[];
}

export interface PayoffPoint {
  spot: number;
  pnl: number;
}
