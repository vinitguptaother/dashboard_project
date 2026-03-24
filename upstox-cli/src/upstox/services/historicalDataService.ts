/**
 * Historical Data Service
 * Handles fetching OHLCV candle data across multiple timeframes
 * Supports intraday, daily, weekly, and monthly intervals
 */

import type {
  Candle,
  CandleInterval,
  GetCandlesParams,
  UpstoxCandleResponse,
} from '../types/marketData';

import { UpstoxMarketDataError } from '../types/marketData';

import {
  buildHistoricalCandleUrl,
  buildAuthHeaders,
  validateDateRange,
  getDateRange,
  formatDateForApi,
  isValidInstrumentKey,
  calculateRetryDelay,
  isRetryableError,
  RETRY_CONFIG,
} from '../config/marketDataConfig';

/**
 * HistoricalDataService - Fetch historical candle data
 */
export class HistoricalDataService {
  private accessToken: string;
  private cache: Map<string, { data: Candle[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get historical candles with flexible parameters
   * @param params - Candle request parameters
   */
  async getHistoricalCandles(params: GetCandlesParams): Promise<Candle[]> {
    const { instrumentKey, interval, fromDate, toDate } = params;

    if (!isValidInstrumentKey(instrumentKey)) {
      throw new UpstoxMarketDataError(`Invalid instrument key format: ${instrumentKey}`);
    }

    // Validate date range
    const validation = validateDateRange(interval, fromDate, toDate);
    if (!validation.isValid) {
      throw new UpstoxMarketDataError(validation.error!);
    }

    // Check cache
    const cacheKey = `${instrumentKey}:${interval}:${fromDate}:${toDate}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Fetch from API with retry logic
    const candles = await this.fetchCandlesWithRetry(instrumentKey, interval, toDate, fromDate);

    // Update cache
    this.cache.set(cacheKey, { data: candles, timestamp: Date.now() });

    return candles;
  }

  /**
   * Get intraday candles (1m, 5m, 15m aggregates)
   * @param instrumentKey - Instrument key
   * @param daysBack - Number of days to fetch (default: 30)
   * @param interval - Intraday interval (default: '5minute')
   */
  async getIntradayCandles(
    instrumentKey: string,
    daysBack = 30,
    interval: '1minute' | '5minute' | '15minute' | '30minute' = '5minute'
  ): Promise<Candle[]> {
    const dateRange = getDateRange(Math.min(daysBack, 30)); // Max 30 days for intraday

    return this.getHistoricalCandles({
      instrumentKey,
      interval,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
    });
  }

  /**
   * Get hourly candles
   * @param instrumentKey - Instrument key
   * @param daysBack - Number of days to fetch (default: 90)
   */
  async getHourlyCandles(instrumentKey: string, daysBack = 90): Promise<Candle[]> {
    const dateRange = getDateRange(Math.min(daysBack, 90)); // Max 90 days for hourly

    return this.getHistoricalCandles({
      instrumentKey,
      interval: '60minute',
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
    });
  }

  /**
   * Get daily candles
   * @param instrumentKey - Instrument key
   * @param yearsBack - Number of years to fetch (default: 2)
   */
  async getDailyCandles(instrumentKey: string, yearsBack = 2): Promise<Candle[]> {
    const daysBack = Math.min(yearsBack * 365, 365 * 5); // Max 5 years
    const dateRange = getDateRange(daysBack);

    return this.getHistoricalCandles({
      instrumentKey,
      interval: 'day',
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
    });
  }

  /**
   * Get weekly candles
   * @param instrumentKey - Instrument key
   * @param yearsBack - Number of years to fetch (default: 5)
   */
  async getWeeklyCandles(instrumentKey: string, yearsBack = 5): Promise<Candle[]> {
    const daysBack = Math.min(yearsBack * 365, 365 * 10); // Max 10 years
    const dateRange = getDateRange(daysBack);

    return this.getHistoricalCandles({
      instrumentKey,
      interval: 'week',
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
    });
  }

  /**
   * Get monthly candles
   * @param instrumentKey - Instrument key
   * @param yearsBack - Number of years to fetch (default: 10)
   */
  async getMonthlyCandles(instrumentKey: string, yearsBack = 10): Promise<Candle[]> {
    const daysBack = Math.min(yearsBack * 365, 365 * 20); // Max 20 years
    const dateRange = getDateRange(daysBack);

    return this.getHistoricalCandles({
      instrumentKey,
      interval: 'month',
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
    });
  }

  /**
   * Get candles for a custom date range
   * @param instrumentKey - Instrument key
   * @param interval - Candle interval
   * @param startDate - Start date (Date object)
   * @param endDate - End date (Date object)
   */
  async getCandlesForDateRange(
    instrumentKey: string,
    interval: CandleInterval,
    startDate: Date,
    endDate: Date
  ): Promise<Candle[]> {
    return this.getHistoricalCandles({
      instrumentKey,
      interval,
      fromDate: formatDateForApi(startDate),
      toDate: formatDateForApi(endDate),
    });
  }

  /**
   * Get latest N candles
   * @param instrumentKey - Instrument key
   * @param interval - Candle interval
   * @param count - Number of candles to fetch
   */
  async getLatestCandles(
    instrumentKey: string,
    interval: CandleInterval,
    count: number
  ): Promise<Candle[]> {
    // Estimate days needed based on interval and count
    let daysBack: number;
    
    switch (interval) {
      case '1minute':
        daysBack = Math.ceil(count / (60 * 6.5)); // ~390 candles per day (6.5 hours)
        break;
      case '5minute':
        daysBack = Math.ceil(count / (12 * 6.5)); // ~78 candles per day
        break;
      case '15minute':
        daysBack = Math.ceil(count / (4 * 6.5)); // ~26 candles per day
        break;
      case '30minute':
        daysBack = Math.ceil(count / (2 * 6.5)); // ~13 candles per day
        break;
      case '60minute':
        daysBack = Math.ceil(count / 6.5); // ~6.5 candles per day
        break;
      case 'day':
        daysBack = count;
        break;
      case 'week':
        daysBack = count * 7;
        break;
      case 'month':
        daysBack = count * 30;
        break;
      default:
        daysBack = count;
    }

    const dateRange = getDateRange(daysBack);
    const candles = await this.getHistoricalCandles({
      instrumentKey,
      interval,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
    });

    // Return latest N candles
    return candles.slice(-count);
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Fetch candles from API with retry logic
   */
  private async fetchCandlesWithRetry(
    instrumentKey: string,
    interval: CandleInterval,
    toDate: string,
    fromDate: string,
    attempt = 1
  ): Promise<Candle[]> {
    try {
      return await this.fetchCandles(instrumentKey, interval, toDate, fromDate);
    } catch (error) {
      const upstoxError = error as UpstoxMarketDataError;
      
      // Retry if error is retryable and we haven't exceeded max retries
      if (
        upstoxError.statusCode &&
        isRetryableError(upstoxError.statusCode) &&
        attempt < RETRY_CONFIG.MAX_RETRIES
      ) {
        const delay = calculateRetryDelay(attempt);
        console.log(`Retrying request in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.MAX_RETRIES})`);
        
        await this.sleep(delay);
        return this.fetchCandlesWithRetry(instrumentKey, interval, toDate, fromDate, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Fetch candles from API
   */
  private async fetchCandles(
    instrumentKey: string,
    interval: CandleInterval,
    toDate: string,
    fromDate: string
  ): Promise<Candle[]> {
    const url = buildHistoricalCandleUrl(instrumentKey, interval, toDate, fromDate);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: buildAuthHeaders(this.accessToken),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new UpstoxMarketDataError(
          `Failed to fetch candles for ${instrumentKey}`,
          response.status,
          errorData
        );
      }

      const data: UpstoxCandleResponse = await response.json();
      
      if (data.status === 'success' && data.data?.candles) {
        return this.mapCandleResponse(data.data.candles);
      }

      return [];
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching historical candles: ${(error as Error).message}`
      );
    }
  }

  /**
   * Map raw candle data to Candle interface
   */
  private mapCandleResponse(
    rawCandles: Array<[string, number, number, number, number, number, number?]>
  ): Candle[] {
    return rawCandles.map(([timestamp, open, high, low, close, volume, openInterest]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      openInterest,
    }));
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific instrument
   */
  clearCacheForInstrument(instrumentKey: string): void {
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (key.startsWith(instrumentKey)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
