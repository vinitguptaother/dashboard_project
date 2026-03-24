/**
 * Upstox Market Data API Configuration
 * Base URLs, WebSocket endpoints, rate limits, and helper functions
 */

import type { CandleInterval } from '../types/marketData';

// ============================================
// API BASE URLS
// ============================================

export const UPSTOX_API_BASE_URL = 'https://api.upstox.com/v2';
export const UPSTOX_WEBSOCKET_URL = 'wss://api.upstox.com/v2/feed/market-data-feed';

// ============================================
// API ENDPOINTS
// ============================================

export const ENDPOINTS = {
  // Live Market Data
  MARKET_QUOTE: '/market-quote/quotes',
  MARKET_QUOTE_LTPC: '/market-quote/ltp',
  FULL_MARKET_QUOTE: '/market-quote/ohlc',
  OPTION_GREEKS: '/option/greeks',
  MARKET_STATUS: '/market/status',
  
  // Historical Data
  HISTORICAL_CANDLE: '/historical-candle',
  INTRADAY_CANDLE: '/historical-candle/intraday',
  
  // Instruments
  INSTRUMENTS_MASTER: '/market-quote/instruments',
  OPTION_CONTRACTS: '/option/contract',
  FUTURES_CONTRACTS: '/option/contract',
  
  // User Profile (for validation)
  USER_PROFILE: '/user/profile',
} as const;

// ============================================
// RATE LIMITS (per minute)
// ============================================

export const RATE_LIMITS = {
  MARKET_QUOTE: 100,
  HISTORICAL_CANDLE: 100,
  OPTION_GREEKS: 50,
  INSTRUMENTS_MASTER: 10,
  WEBSOCKET_SUBSCRIPTIONS: 5000, // Max instruments per connection
} as const;

// ============================================
// CACHE CONFIGURATION
// ============================================

export const CACHE_CONFIG = {
  INSTRUMENTS_TTL: 24 * 60 * 60 * 1000, // 24 hours
  QUOTE_TTL: 1000, // 1 second
  GREEKS_TTL: 5000, // 5 seconds
  MARKET_STATUS_TTL: 60 * 1000, // 1 minute
} as const;

// ============================================
// WEBSOCKET CONFIGURATION
// ============================================

export const WEBSOCKET_CONFIG = {
  RECONNECT_INTERVAL: 5000, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 10,
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 10000, // 10 seconds
} as const;

// ============================================
// INTERVAL MAPPING
// ============================================

/**
 * Map internal interval names to Upstox API interval format
 */
export const INTERVAL_MAP: Record<CandleInterval, string> = {
  '1minute': '1minute',
  '5minute': '5minute',
  '15minute': '15minute',
  '30minute': '30minute',
  '60minute': '60minute',
  'day': 'day',
  'week': 'week',
  'month': 'month',
};

/**
 * Get historical data depth limits based on interval
 * Returns maximum days of historical data available
 */
export function getHistoricalDepthLimit(interval: CandleInterval): number {
  switch (interval) {
    case '1minute':
    case '5minute':
    case '15minute':
      return 30; // 30 days for intraday
    case '30minute':
    case '60minute':
      return 90; // 90 days for hourly
    case 'day':
      return 365 * 5; // 5 years for daily
    case 'week':
      return 365 * 10; // 10 years for weekly
    case 'month':
      return 365 * 20; // 20 years for monthly
    default:
      return 30;
  }
}

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Build authorization headers with Bearer token
 */
export function buildAuthHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Build WebSocket authorization message
 */
export function buildWebSocketAuthPayload(accessToken: string): object {
  return {
    guid: 'someguid',
    method: 'authorization',
    authorization: {
      token: accessToken,
    },
  };
}

// ============================================
// URL BUILDERS
// ============================================

/**
 * Build full API URL with endpoint
 */
export function buildApiUrl(endpoint: string): string {
  return `${UPSTOX_API_BASE_URL}${endpoint}`;
}

/**
 * Build historical candle URL
 */
export function buildHistoricalCandleUrl(
  instrumentKey: string,
  interval: CandleInterval,
  toDate: string,
  fromDate: string
): string {
  const encodedKey = encodeURIComponent(instrumentKey);
  const intervalStr = INTERVAL_MAP[interval];
  return buildApiUrl(`${ENDPOINTS.HISTORICAL_CANDLE}/${encodedKey}/${intervalStr}/${toDate}/${fromDate}`);
}

/**
 * Build instruments master download URL
 */
export function buildInstrumentsMasterUrl(exchange: string): string {
  return `${UPSTOX_API_BASE_URL}/market-quote/instruments/${exchange}`;
}

/**
 * Build option contracts URL
 */
export function buildOptionContractsUrl(underlyingKey: string, expiryDate?: string): string {
  const baseUrl = buildApiUrl(ENDPOINTS.OPTION_CONTRACTS);
  const params = new URLSearchParams({
    instrument_key: underlyingKey,
  });
  
  if (expiryDate) {
    params.append('expiry_date', expiryDate);
  }
  
  return `${baseUrl}?${params.toString()}`;
}

// ============================================
// DATE UTILITIES
// ============================================

/**
 * Format date to YYYY-MM-DD for Upstox API
 */
export function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get date range for historical data query
 */
export function getDateRange(daysBack: number): { fromDate: string; toDate: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  
  return {
    fromDate: formatDateForApi(from),
    toDate: formatDateForApi(to),
  };
}

/**
 * Validate date range against interval limits
 */
export function validateDateRange(
  interval: CandleInterval,
  fromDate: string,
  toDate: string
): { isValid: boolean; error?: string } {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const maxDays = getHistoricalDepthLimit(interval);
  
  if (diffDays > maxDays) {
    return {
      isValid: false,
      error: `Date range exceeds maximum limit of ${maxDays} days for ${interval} interval`,
    };
  }
  
  if (from > to) {
    return {
      isValid: false,
      error: 'From date must be before to date',
    };
  }
  
  return { isValid: true };
}

// ============================================
// RETRY CONFIGURATION
// ============================================

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(attemptNumber: number): number {
  const delay = RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attemptNumber - 1);
  return Math.min(delay, RETRY_CONFIG.MAX_DELAY);
}

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Check if error is retryable
 */
export function isRetryableError(statusCode: number): boolean {
  return [
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    ERROR_CODES.SERVICE_UNAVAILABLE,
  ].includes(statusCode as any);
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate instrument key format
 */
export function isValidInstrumentKey(instrumentKey: string): boolean {
  // Format: EXCHANGE|SYMBOL (e.g., NSE_EQ|RELIANCE)
  const pattern = /^[A-Z_]+\|[A-Z0-9_-]+$/;
  return pattern.test(instrumentKey);
}

/**
 * Validate access token format
 */
export function isValidAccessToken(token: string): boolean {
  return token.length > 0 && typeof token === 'string';
}

/**
 * Extract exchange from instrument key
 */
export function extractExchange(instrumentKey: string): string {
  const [exchange] = instrumentKey.split('|');
  return exchange;
}

/**
 * Extract symbol from instrument key
 */
export function extractSymbol(instrumentKey: string): string {
  const [, symbol] = instrumentKey.split('|');
  return symbol;
}
