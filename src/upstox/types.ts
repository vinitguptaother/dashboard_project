// ============================================
// RAW API RESPONSE TYPES (from Upstox API)
// ============================================

export interface UpstoxLTPResponse {
  status: 'success' | 'error';
  data: {
    [instrumentKey: string]: {
      last_price: number;
      instrument_token?: string;
      last_trade_time?: string;
    };
  };
}

export interface UpstoxMarketQuoteResponse {
  status: 'success' | 'error';
  data: {
    [instrumentKey: string]: {
      ltpc?: {
        ltp: number;
        ltt?: string;
        close_price?: number;
        volume?: number;
      };
      ohlc?: {
        open: number;
        high: number;
        low: number;
        close: number;
      };
      depth?: {
        buy: Array<{ price: number; quantity: number; orders: number }>;
        sell: Array<{ price: number; quantity: number; orders: number }>;
      };
    };
  };
}

export interface UpstoxHistoricalCandleResponse {
  status: 'success' | 'error';
  data: {
    candles: Array<[
      string,  // timestamp ISO8601
      number,  // open
      number,  // high
      number,  // low
      number,  // close
      number,  // volume
      number   // open_interest (optional)
    ]>;
  };
}

export interface UpstoxHoldingsResponse {
  status: 'success' | 'error';
  data: Array<{
    isin: string;
    cnc_used_quantity: number;
    collateral_type?: string;
    company_name: string;
    haircut: number;
    product: string;
    quantity: number;
    tradingsymbol: string;
    last_price: number;
    close_price: number;
    average_price: number;
    collateral_quantity?: number;
    collateral_update_quantity?: number;
    t1_quantity: number;
    exchange: string;
    instrument_token: string;
    pnl: number;
    day_change: number;
    day_change_percentage: number;
  }>;
}

export interface UpstoxPositionsResponse {
  status: 'success' | 'error';
  data: Array<{
    exchange: string;
    multiplier: number;
    value: number;
    pnl: number;
    product: string;
    instrument_token: string;
    average_price: number;
    buy_value: number;
    overnight_quantity: number;
    day_buy_value: number;
    day_buy_price: number;
    overnight_buy_amount: number;
    overnight_buy_quantity: number;
    day_buy_quantity: number;
    sell_value: number;
    day_sell_value: number;
    day_sell_price: number;
    overnight_sell_amount: number;
    overnight_sell_quantity: number;
    day_sell_quantity: number;
    quantity: number;
    last_price: number;
    unrealised: number;
    realised: number;
    close_price: number;
    buy_price: number;
    sell_price: number;
    tradingsymbol: string;
  }>;
}

export interface UpstoxFundsResponse {
  status: 'success' | 'error';
  data: {
    commodity: {
      used_margin: number;
      payin_amount: number;
      span_margin: number;
      adhoc_margin: number;
      notional_cash: number;
      available_margin: number;
      exposure_margin: number;
    };
    equity: {
      used_margin: number;
      payin_amount: number;
      span_margin: number;
      adhoc_margin: number;
      notional_cash: number;
      available_margin: number;
      exposure_margin: number;
    };
  };
}

// ============================================
// NORMALIZED DOMAIN TYPES (our clean interface)
// ============================================

export interface LiveQuote {
  instrumentKey: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  lastTradeTime?: string;
  depth?: {
    totalBuyQuantity: number;
    totalSellQuantity: number;
    bestBid: number;
    bestAsk: number;
    spread: number;
  };
}

export interface HistoricalCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest?: number;
}

export interface Holding {
  symbol: string;
  isin: string;
  exchange: string;
  companyName: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  closePrice: number;
  currentValue: number;
  investmentValue: number;
  pnl: number;
  pnlPercentage: number;
  dayChange: number;
  dayChangePercentage: number;
  t1Quantity: number;
  instrumentToken: string;
}

export interface Position {
  symbol: string;
  exchange: string;
  product: string; // 'D' = delivery, 'I' = intraday, etc.
  quantity: number;
  overnightQuantity: number;
  multiplier: number;
  averagePrice: number;
  buyPrice: number;
  sellPrice: number;
  lastPrice: number;
  closePrice: number;
  pnl: number;
  realised: number;
  unrealised: number;
  value: number;
  dayBuyQuantity: number;
  daySellQuantity: number;
  instrumentToken: string;
}

export interface PortfolioHoldingsSnapshot {
  holdings: Holding[];
  summary: {
    totalInvestmentValue: number;
    totalCurrentValue: number;
    totalPnL: number;
    totalPnLPercentage: number;
    totalDayChange: number;
    totalDayChangePercentage: number;
    holdingsCount: number;
  };
  timestamp: string;
}

export interface PortfolioPositionsSnapshot {
  positions: Position[];
  summary: {
    totalPnL: number;
    totalRealisedPnL: number;
    totalUnrealisedPnL: number;
    totalValue: number;
    positionsCount: number;
    longPositions: number;
    shortPositions: number;
  };
  timestamp: string;
}

export interface PortfolioSnapshot {
  holdings: PortfolioHoldingsSnapshot;
  positions: PortfolioPositionsSnapshot;
  funds?: {
    equityAvailableMargin: number;
    equityUsedMargin: number;
    commodityAvailableMargin: number;
    commodityUsedMargin: number;
  };
  totalPortfolioValue: number;
  totalPnL: number;
  timestamp: string;
}

// ============================================
// QUERY PARAMETER TYPES
// ============================================

export interface HistoricalCandleParams {
  instrumentKey: string;
  interval: '1minute' | '30minute' | 'day' | 'week' | 'month';
  from: Date;
  to: Date;
}

export type DataType = 'live' | 'historical' | 'holdings' | 'positions' | 'portfolioSnapshot';
