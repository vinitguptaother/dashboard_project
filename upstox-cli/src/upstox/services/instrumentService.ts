/**
 * Instrument Service
 * Handles instruments master data, searching, and derivatives contracts
 * Supports NSE, BSE, MCX equities, futures, and options
 */

import type {
  Instrument,
  OptionContract,
  FuturesContract,
  Exchange,
  InstrumentSearchParams,
  InstrumentFilter,
  UpstoxMarketDataError,
  CacheEntry,
} from '../types/marketData';

import {
  buildInstrumentsMasterUrl,
  buildOptionContractsUrl,
  buildAuthHeaders,
  buildApiUrl,
  ENDPOINTS,
  CACHE_CONFIG,
} from '../config/marketDataConfig';

/**
 * InstrumentService - Manage instruments and contracts
 */
export class InstrumentService {
  private accessToken: string;
  private instrumentsCache: Map<Exchange, CacheEntry<Instrument[]>> = new Map();
  private optionsCache: Map<string, CacheEntry<OptionContract[]>> = new Map();

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get instruments master for an exchange
   * @param exchange - Exchange to fetch instruments for
   * @param forceRefresh - Force refresh cache
   */
  async getInstrumentsMaster(
    exchange: Exchange,
    forceRefresh = false
  ): Promise<Instrument[]> {
    // Check cache
    if (!forceRefresh) {
      const cached = this.instrumentsCache.get(exchange);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }

    try {
      // Download instruments master (usually a CSV file)
      const url = buildInstrumentsMasterUrl(exchange);
      const response = await fetch(url, {
        method: 'GET',
        headers: buildAuthHeaders(this.accessToken),
      });

      if (!response.ok) {
        throw new UpstoxMarketDataError(
          `Failed to fetch instruments for ${exchange}`,
          response.status
        );
      }

      // Parse response (format depends on Upstox API - could be CSV or JSON)
      const data = await response.text();
      const instruments = this.parseInstrumentsMaster(data, exchange);

      // Update cache
      this.instrumentsCache.set(exchange, {
        data: instruments,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_CONFIG.INSTRUMENTS_TTL,
      });

      return instruments;
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching instruments master: ${(error as Error).message}`
      );
    }
  }

  /**
   * Search for instruments by symbol or name
   * @param params - Search parameters
   */
  async searchInstrument(params: InstrumentSearchParams): Promise<Instrument[]> {
    const { query, exchange, instrumentType, limit = 50 } = params;
    
    // Get instruments for specified exchange or all exchanges
    let allInstruments: Instrument[] = [];
    
    if (exchange) {
      allInstruments = await this.getInstrumentsMaster(exchange);
    } else {
      // Search across multiple exchanges
      const exchanges: Exchange[] = ['NSE_EQ', 'BSE_EQ', 'NSE_FO'];
      const promises = exchanges.map((ex) => 
        this.getInstrumentsMaster(ex).catch(() => [])
      );
      const results = await Promise.all(promises);
      allInstruments = results.flat();
    }

    // Filter by query
    const queryLower = query.toLowerCase();
    let filtered = allInstruments.filter((instrument) => 
      instrument.symbol.toLowerCase().includes(queryLower) ||
      instrument.name.toLowerCase().includes(queryLower) ||
      instrument.tradingSymbol.toLowerCase().includes(queryLower)
    );

    // Filter by instrument type if specified
    if (instrumentType) {
      filtered = filtered.filter((i) => i.instrumentType === instrumentType);
    }

    // Return limited results
    return filtered.slice(0, limit);
  }

  /**
   * Get instrument by exact key
   * @param instrumentKey - Instrument key (e.g., "NSE_EQ|RELIANCE")
   */
  async getInstrumentByKey(instrumentKey: string): Promise<Instrument | null> {
    const [exchangeStr, symbol] = instrumentKey.split('|');
    const exchange = exchangeStr as Exchange;

    const instruments = await this.getInstrumentsMaster(exchange);
    return instruments.find((i) => i.instrumentKey === instrumentKey) || null;
  }

  /**
   * Get option contracts for an underlying
   * @param underlyingSymbol - Underlying symbol (e.g., "NIFTY", "RELIANCE")
   * @param exchange - Exchange (NSE_EQ or BSE_EQ)
   */
  async getOptionContracts(
    underlyingSymbol: string,
    exchange: Exchange = 'NSE_EQ'
  ): Promise<OptionContract[]> {
    // Check cache
    const cacheKey = `${exchange}|${underlyingSymbol}`;
    const cached = this.optionsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      // Get underlying instrument key
      const underlyingKey = `${exchange}|${underlyingSymbol}`;
      const url = buildOptionContractsUrl(underlyingKey);

      const response = await fetch(url, {
        method: 'GET',
        headers: buildAuthHeaders(this.accessToken),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new UpstoxMarketDataError(
          `Failed to fetch option contracts for ${underlyingSymbol}`,
          response.status,
          errorData
        );
      }

      const data = await response.json();
      const contracts = this.mapOptionContracts(data.data, exchange);

      // Update cache
      this.optionsCache.set(cacheKey, {
        data: contracts,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      });

      return contracts;
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching option contracts: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get option contracts filtered by expiry and strike range
   * @param underlyingSymbol - Underlying symbol
   * @param expiryDate - Expiry date (YYYY-MM-DD)
   * @param strikeRange - Optional strike range filter
   */
  async getOptionContractsByExpiryAndStrike(
    underlyingSymbol: string,
    expiryDate: string,
    strikeRange?: { min: number; max: number },
    exchange: Exchange = 'NSE_EQ'
  ): Promise<OptionContract[]> {
    const allContracts = await this.getOptionContracts(underlyingSymbol, exchange);

    let filtered = allContracts.filter((c) => c.expiryDate === expiryDate);

    if (strikeRange) {
      filtered = filtered.filter(
        (c) => c.strikePrice >= strikeRange.min && c.strikePrice <= strikeRange.max
      );
    }

    return filtered;
  }

  /**
   * Get futures contracts for an underlying
   * @param underlyingSymbol - Underlying symbol
   * @param exchange - Exchange
   */
  async getFuturesContracts(
    underlyingSymbol: string,
    exchange: Exchange = 'NSE_EQ'
  ): Promise<FuturesContract[]> {
    try {
      const underlyingKey = `${exchange}|${underlyingSymbol}`;
      const url = buildOptionContractsUrl(underlyingKey);

      const response = await fetch(url, {
        method: 'GET',
        headers: buildAuthHeaders(this.accessToken),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new UpstoxMarketDataError(
          `Failed to fetch futures contracts for ${underlyingSymbol}`,
          response.status,
          errorData
        );
      }

      const data = await response.json();
      return this.mapFuturesContracts(data.data, exchange);
    } catch (error) {
      if (error instanceof UpstoxMarketDataError) {
        throw error;
      }
      throw new UpstoxMarketDataError(
        `Error fetching futures contracts: ${(error as Error).message}`
      );
    }
  }

  /**
   * Filter instruments by multiple criteria
   * @param exchange - Exchange to filter from
   * @param filter - Filter criteria
   */
  async filterInstruments(
    exchange: Exchange,
    filter: InstrumentFilter
  ): Promise<Instrument[]> {
    let instruments = await this.getInstrumentsMaster(exchange);

    if (filter.instrumentType) {
      instruments = instruments.filter((i) => i.instrumentType === filter.instrumentType);
    }

    if (filter.segment) {
      instruments = instruments.filter((i) => i.exchangeSegment === filter.segment);
    }

    if (filter.minPrice !== undefined) {
      instruments = instruments.filter((i) => i.lastPrice >= filter.minPrice!);
    }

    if (filter.maxPrice !== undefined) {
      instruments = instruments.filter((i) => i.lastPrice <= filter.maxPrice!);
    }

    return instruments;
  }

  /**
   * Get available expiry dates for an underlying
   * @param underlyingSymbol - Underlying symbol
   * @param exchange - Exchange
   */
  async getExpiryDates(
    underlyingSymbol: string,
    exchange: Exchange = 'NSE_EQ'
  ): Promise<string[]> {
    const contracts = await this.getOptionContracts(underlyingSymbol, exchange);
    const expiries = new Set(contracts.map((c) => c.expiryDate));
    return Array.from(expiries).sort();
  }

  /**
   * Get available strike prices for an expiry
   * @param underlyingSymbol - Underlying symbol
   * @param expiryDate - Expiry date
   * @param exchange - Exchange
   */
  async getStrikePrices(
    underlyingSymbol: string,
    expiryDate: string,
    exchange: Exchange = 'NSE_EQ'
  ): Promise<number[]> {
    const contracts = await this.getOptionContractsByExpiryAndStrike(
      underlyingSymbol,
      expiryDate,
      undefined,
      exchange
    );
    const strikes = new Set(contracts.map((c) => c.strikePrice));
    return Array.from(strikes).sort((a, b) => a - b);
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Parse instruments master data (CSV format)
   */
  private parseInstrumentsMaster(data: string, exchange: Exchange): Instrument[] {
    // Split by lines and parse CSV
    const lines = data.trim().split('\n');
    if (lines.length === 0) return [];

    // Parse header
    const headers = lines[0].split(',');
    const instruments: Instrument[] = [];

    // Parse each line
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const instrument = this.parseInstrumentLine(headers, values, exchange);
      if (instrument) {
        instruments.push(instrument);
      }
    }

    return instruments;
  }

  /**
   * Parse single instrument line from CSV
   */
  private parseInstrumentLine(
    headers: string[],
    values: string[],
    exchange: Exchange
  ): Instrument | null {
    try {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });

      return {
        instrumentKey: row['instrument_key'] || '',
        symbol: row['trading_symbol'] || '',
        name: row['name'] || row['trading_symbol'] || '',
        exchange,
        exchangeSegment: row['segment'] || '',
        instrumentType: (row['instrument_type'] || 'EQUITY') as Instrument['instrumentType'],
        isin: row['isin'] || '',
        tradingSymbol: row['trading_symbol'] || '',
        tickSize: parseFloat(row['tick_size'] || '0.05'),
        lotSize: parseInt(row['lot_size'] || '1', 10),
        freezeQuantity: parseInt(row['freeze_quantity'] || '0', 10),
        lastPrice: parseFloat(row['last_price'] || '0'),
        expiry: row['expiry'] || undefined,
        strike: row['strike'] ? parseFloat(row['strike']) : undefined,
        optionType: row['option_type'] as Instrument['optionType'],
        underlyingSymbol: row['underlying_symbol'] || undefined,
        underlyingKey: row['underlying_key'] || undefined,
      };
    } catch (error) {
      console.error('Failed to parse instrument line:', error);
      return null;
    }
  }

  /**
   * Map option contracts from API response
   */
  private mapOptionContracts(rawData: unknown[], exchange: Exchange): OptionContract[] {
    return rawData.map((item: any) => ({
      instrumentKey: item.instrument_key,
      symbol: item.trading_symbol,
      tradingSymbol: item.trading_symbol,
      underlyingSymbol: item.underlying_symbol,
      underlyingKey: item.underlying_key,
      strikePrice: parseFloat(item.strike),
      expiryDate: item.expiry,
      optionType: item.option_type as 'CE' | 'PE',
      lotSize: parseInt(item.lot_size || '1', 10),
      tickSize: parseFloat(item.tick_size || '0.05'),
      isWeekly: item.weekly_expiry || false,
      exchange,
    }));
  }

  /**
   * Map futures contracts from API response
   */
  private mapFuturesContracts(rawData: unknown[], exchange: Exchange): FuturesContract[] {
    return rawData
      .filter((item: any) => item.instrument_type === 'FUTURES')
      .map((item: any) => ({
        instrumentKey: item.instrument_key,
        symbol: item.trading_symbol,
        tradingSymbol: item.trading_symbol,
        underlyingSymbol: item.underlying_symbol,
        underlyingKey: item.underlying_key,
        expiryDate: item.expiry,
        lotSize: parseInt(item.lot_size || '1', 10),
        tickSize: parseFloat(item.tick_size || '0.05'),
        exchange,
      }));
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.instrumentsCache.clear();
    this.optionsCache.clear();
  }

  /**
   * Clear cache for specific exchange
   */
  clearCacheForExchange(exchange: Exchange): void {
    this.instrumentsCache.delete(exchange);
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    instrumentsCacheSize: number;
    optionsCacheSize: number;
  } {
    return {
      instrumentsCacheSize: this.instrumentsCache.size,
      optionsCacheSize: this.optionsCache.size,
    };
  }
}
