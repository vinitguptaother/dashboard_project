/**
 * Comprehensive TypeScript type definitions for Upstox Market Data Layer
 * Covers: Live Quotes, Historical Data, Instruments, Options, and Greeks
 */

// ============================================
// EXCHANGE & SEGMENT TYPES
// ============================================

export type Exchange = 'NSE_EQ' | 'BSE_EQ' | 'NSE_FO' | 'BSE_FO' | 'MCX_FO' | 'NSE_INDEX' | 'BSE_INDEX';

export type MarketSegmentStatus = 'NORMAL_OPEN' | 'CLOSED' | 'PRE_OPEN' | 'POST_CLOSE' | 'MARKET_NOT_AVAILABLE';

export type InstrumentType = 'EQUITY' | 'INDEX' | 'FUTURES' | 'OPTIONS' | 'CURRENCY' | 'COMMODITY';

export type OptionType = 'CE' | 'PE';

export type CandleInterval = '1minute' | '5minute' | '15minute' | '30minute' | '60minute' | 'day' | 'week' | 'month';

export type QuoteMode = 'ltpc' | 'full' | 'full_d30' | 'option_greeks';

// ============================================
// LIVE MARKET DATA TYPES
// ============================================

/**
 * Live quote snapshot with LTP, OHLC, volume, and optional depth/greeks
 */
export interface LiveQuote {
  instrumentKey: string;
  symbol: string;
  exchange: Exchange;
  ltp: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  change: number;
  changePercent: number;
  lastTradeTime: string;
  marketStatus: MarketSegmentStatus;
  depth?: MarketDepth;
  greeks?: OptionGreeks;
}

/**
 * Market depth with best bid/ask and up to 30 levels
 */
export interface MarketDepth {
  bestBidPrice: number;
  bestBidQty: number;
  bestAskPrice: number;
  bestAskQty: number;
  totalBidQty: number;
  totalAskQty: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

/**
 * Option Greeks for derivatives
 */
export interface OptionGreeks {
  instrumentKey: string;
  symbol: string;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  impliedVolatility: number;
  rho: number;
  underlyingPrice: number;
  strikePrice: number;
  daysToExpiry: number;
}

/**
 * Market segment status for each exchange
 */
export interface MarketSegment {
  exchange: Exchange;
  segment: string;
  status: MarketSegmentStatus;
  lastUpdateTime: string;
}

// ============================================
// HISTORICAL DATA TYPES
// ============================================

/**
 * OHLCV candlestick data with open interest
 */
export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest?: number;
}

/**
 * Parameters for fetching historical candles
 */
export interface GetCandlesParams {
  instrumentKey: string;
  interval: CandleInterval;
  fromDate: string; // ISO date string YYYY-MM-DD
  toDate: string; // ISO date string YYYY-MM-DD
}

// ============================================
// INSTRUMENT TYPES
// ============================================

/**
 * Master instrument data from Upstox
 */
export interface Instrument {
  instrumentKey: string;
  symbol: string;
  name: string;
  exchange: Exchange;
  exchangeSegment: string;
  instrumentType: InstrumentType;
  isin: string;
  tradingSymbol: string;
  tickSize: number;
  lotSize: number;
  freezeQuantity: number;
  lastPrice: number;
  expiry?: string; // For derivatives
  strike?: number; // For options
  optionType?: OptionType; // For options
  underlyingSymbol?: string; // For derivatives
  underlyingKey?: string; // For derivatives
}

/**
 * Option contract details
 */
export interface OptionContract {
  instrumentKey: string;
  symbol: string;
  tradingSymbol: string;
  underlyingSymbol: string;
  underlyingKey: string;
  strikePrice: number;
  expiryDate: string;
  optionType: OptionType;
  lotSize: number;
  tickSize: number;
  isWeekly: boolean;
  exchange: Exchange;
}

/**
 * Futures contract details
 */
export interface FuturesContract {
  instrumentKey: string;
  symbol: string;
  tradingSymbol: string;
  underlyingSymbol: string;
  underlyingKey: string;
  expiryDate: string;
  lotSize: number;
  tickSize: number;
  exchange: Exchange;
}

// ============================================
// OPTION CHAIN TYPES
// ============================================

/**
 * Complete option chain row with call and put data
 */
export interface OptionChainRow {
  strikePrice: number;
  call: OptionChainLeg;
  put: OptionChainLeg;
  openInterestDiff: number; // Put OI - Call OI
}

/**
 * Individual option leg (call or put) in the chain
 */
export interface OptionChainLeg {
  instrumentKey: string;
  symbol: string;
  ltp: number;
  openInterest: number;
  volume: number;
  changeInOI: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  bidPrice: number;
  askPrice: number;
  bidQty: number;
  askQty: number;
}

/**
 * Option chain request parameters
 */
export interface OptionChainParams {
  underlyingSymbol: string;
  expiryDate: string;
  strikeRange?: {
    min: number;
    max: number;
  };
}

// ============================================
// WEBSOCKET TYPES
// ============================================

/**
 * WebSocket subscription configuration
 */
export interface WebSocketSubscription {
  instrumentKeys: string[];
  mode: QuoteMode;
  onData: (quotes: LiveQuote[]) => void;
  onError: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * WebSocket stream handle for managing subscriptions
 */
export interface WebSocketStream<T> {
  subscribe(): void;
  unsubscribe(): void;
  addInstruments(instrumentKeys: string[]): void;
  removeInstruments(instrumentKeys: string[]): void;
  close(): void;
  isConnected(): boolean;
}

// ============================================
// API RESPONSE TYPES (Raw Upstox Responses)
// ============================================

/**
 * Raw Upstox quote response (internal use)
 */
export interface UpstoxQuoteResponse {
  status: string;
  data: {
    [instrumentKey: string]: {
      ltpc?: {
        ltp: number;
        ltt: string;
        cp: number;
        volume: number;
      };
      ohlc?: {
        open: number;
        high: number;
        low: number;
        close: number;
      };
      depth?: {
        buy: Array<{
          price: number;
          quantity: number;
          orders: number;
        }>;
        sell: Array<{
          price: number;
          quantity: number;
          orders: number;
        }>;
      };
      greeks?: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        iv: number;
        rho: number;
      };
    };
  };
}

/**
 * Raw Upstox historical candle response (internal use)
 */
export interface UpstoxCandleResponse {
  status: string;
  data: {
    candles: Array<[string, number, number, number, number, number, number?]>;
  };
}

/**
 * Raw Upstox instrument response (internal use)
 */
export interface UpstoxInstrumentResponse {
  instrument_key: string;
  exchange_token: string;
  trading_symbol: string;
  name: string;
  last_price: number;
  expiry: string;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  option_type: string;
  exchange: string;
}

// ============================================
// ERROR TYPES
// ============================================

export class UpstoxMarketDataError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseData?: unknown
  ) {
    super(message);
    this.name = 'UpstoxMarketDataError';
  }
}

// ============================================
// SEARCH & FILTER TYPES
// ============================================

export interface InstrumentSearchParams {
  query: string;
  exchange?: Exchange;
  instrumentType?: InstrumentType;
  limit?: number;
}

export interface InstrumentFilter {
  exchange?: Exchange;
  instrumentType?: InstrumentType;
  segment?: string;
  minVolume?: number;
  minPrice?: number;
  maxPrice?: number;
}

// ============================================
// CACHE TYPES
// ============================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size
}
