/**
 * Upstox Market Data Client
 * Unified interface aggregating all market data services
 * Entry point for accessing live quotes, historical data, instruments, and options
 */

import { LiveQuoteService } from './liveQuoteService';
import { HistoricalDataService } from './historicalDataService';
import { InstrumentService } from './instrumentService';
import { OptionsService } from './optionsService';

import type {
  LiveQuote,
  Candle,
  Instrument,
  OptionChainRow,
  OptionGreeks,
  MarketSegment,
  QuoteMode,
  CandleInterval,
  GetCandlesParams,
  Exchange,
  InstrumentSearchParams,
  OptionChainParams,
  WebSocketSubscription,
  WebSocketStream,
} from '../types/marketData';

import { isValidAccessToken } from '../config/marketDataConfig';
import { UpstoxMarketDataError } from '../types/marketData';

/**
 * UpstoxMarketDataClient - Main client for all market data operations
 * 
 * Usage:
 * ```typescript
 * const client = new UpstoxMarketDataClient(accessToken);
 * 
 * // Live quotes
 * const quote = await client.liveQuotes.getLiveQuote('NSE_EQ|RELIANCE');
 * 
 * // Historical data
 * const candles = await client.historical.getDailyCandles('NSE_EQ|RELIANCE', 2);
 * 
 * // Instruments
 * const instruments = await client.instruments.searchInstrument({ query: 'RELIANCE' });
 * 
 * // Options
 * const optionChain = await client.options.buildOptionChain({
 *   underlyingSymbol: 'NIFTY',
 *   expiryDate: '2024-12-28'
 * });
 * ```
 */
export class UpstoxMarketDataClient {
  private accessToken: string;
  
  // Service instances
  public readonly liveQuotes: LiveQuoteService;
  public readonly historical: HistoricalDataService;
  public readonly instruments: InstrumentService;
  public readonly options: OptionsService;

  constructor(accessToken: string) {
    if (!isValidAccessToken(accessToken)) {
      throw new UpstoxMarketDataError('Invalid access token provided');
    }

    this.accessToken = accessToken;

    // Initialize all services
    this.liveQuotes = new LiveQuoteService(accessToken);
    this.historical = new HistoricalDataService(accessToken);
    this.instruments = new InstrumentService(accessToken);
    this.options = new OptionsService(accessToken);
  }

  // ============================================
  // CONVENIENCE METHODS (Shortcuts to common operations)
  // ============================================

  /**
   * Get live quote for a single instrument (shortcut)
   */
  async getQuote(instrumentKey: string, mode: QuoteMode = 'ltpc'): Promise<LiveQuote> {
    return this.liveQuotes.getLiveQuote(instrumentKey, mode);
  }

  /**
   * Get historical candles (shortcut)
   */
  async getCandles(params: GetCandlesParams): Promise<Candle[]> {
    return this.historical.getHistoricalCandles(params);
  }

  /**
   * Search instruments (shortcut)
   */
  async searchInstruments(query: string, limit = 50): Promise<Instrument[]> {
    return this.instruments.searchInstrument({ query, limit });
  }

  /**
   * Get option chain (shortcut)
   */
  async getOptionChain(params: OptionChainParams): Promise<OptionChainRow[]> {
    return this.options.buildOptionChain(params);
  }

  /**
   * Get market status (shortcut)
   */
  async getMarketStatus(): Promise<MarketSegment[]> {
    return this.liveQuotes.getMarketStatus();
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Clear all caches across services
   */
  clearAllCaches(): void {
    this.historical.clearCache();
    this.instruments.clearCache();
  }

  /**
   * Get cache statistics from all services
   */
  getCacheStats(): {
    historical: ReturnType<HistoricalDataService['getCacheStats']>;
    instruments: ReturnType<InstrumentService['getCacheStats']>;
  } {
    return {
      historical: this.historical.getCacheStats(),
      instruments: this.instruments.getCacheStats(),
    };
  }

  /**
   * Validate connection by fetching market status
   */
  async validateConnection(): Promise<boolean> {
    try {
      await this.getMarketStatus();
      return true;
    } catch (error) {
      console.error('Connection validation failed:', error);
      return false;
    }
  }
}

// ============================================
// EXPORT ALL SERVICES AND TYPES
// ============================================

export {
  LiveQuoteService,
  HistoricalDataService,
  InstrumentService,
  OptionsService,
};

// Export all types
export type {
  LiveQuote,
  Candle,
  Instrument,
  OptionChainRow,
  OptionGreeks,
  MarketSegment,
  QuoteMode,
  CandleInterval,
  GetCandlesParams,
  Exchange,
  InstrumentSearchParams,
  OptionChainParams,
  WebSocketSubscription,
  WebSocketStream,
};

export { UpstoxMarketDataError } from '../types/marketData';

// Default export
export default UpstoxMarketDataClient;
