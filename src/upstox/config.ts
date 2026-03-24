// ============================================
// UPSTOX API CONFIGURATION
// ============================================

export const UPSTOX_CONFIG = {
  BASE_URL: 'https://api.upstox.com/v2',
  
  ENDPOINTS: {
    MARKET_QUOTE_LTP: '/market-quote/ltp',
    MARKET_QUOTE_FULL: '/market-quote/quotes',
    HISTORICAL_CANDLE: '/historical-candle', // + /{instrumentKey}/{interval}/{to_date}/{from_date}
    HOLDINGS: '/portfolio/long-term-holdings',
    POSITIONS: '/portfolio/short-term-positions',
    FUNDS: '/user/get-funds-and-margin',
  },
  
  // Timeout in milliseconds
  REQUEST_TIMEOUT: 10000,
} as const;

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Creates authorization headers for Upstox API requests
 * @param accessToken - Upstox access token
 * @returns Headers object with Bearer token
 */
export function createAuthHeaders(accessToken: string): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Builds the full URL for a given endpoint
 * @param endpoint - API endpoint path
 * @param params - Optional query parameters
 * @returns Full URL string
 */
export function buildUrl(endpoint: string, params?: Record<string, string>): string {
  const url = `${UPSTOX_CONFIG.BASE_URL}${endpoint}`;
  
  if (!params || Object.keys(params).length === 0) {
    return url;
  }
  
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  
  return `${url}?${queryString}`;
}

/**
 * Formats instrument keys for API requests (comma-separated)
 * @param instrumentKeys - Array of instrument keys
 * @returns Comma-separated string
 */
export function formatInstrumentKeys(instrumentKeys: string[]): string {
  return instrumentKeys.join(',');
}

/**
 * Formats date for historical candle API (YYYY-MM-DD)
 * @param date - Date object
 * @returns Formatted date string
 */
export function formatHistoricalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds historical candle endpoint with path parameters
 * @param instrumentKey - Instrument key (e.g., NSE_EQ|INE002A01018)
 * @param interval - Candle interval
 * @param toDate - End date
 * @param fromDate - Start date
 * @returns Historical candle endpoint URL
 */
export function buildHistoricalCandleUrl(
  instrumentKey: string,
  interval: string,
  toDate: string,
  fromDate: string
): string {
  // URL encode the instrument key since it contains special characters
  const encodedKey = encodeURIComponent(instrumentKey);
  return `${UPSTOX_CONFIG.BASE_URL}${UPSTOX_CONFIG.ENDPOINTS.HISTORICAL_CANDLE}/${encodedKey}/${interval}/${toDate}/${fromDate}`;
}
