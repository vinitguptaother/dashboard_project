const axios = require('axios');
const MarketData = require('../models/MarketData');
const APIConfig = require('../models/APIConfig');
const { apiLogger } = require('../middleware/logger');

class MarketDataService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  // Get market data with caching
  async getMarketData(symbol, useCache = true) {
    const cacheKey = `market_${symbol}`;
    
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Try to get from database first
      const dbData = await MarketData.getLatest(symbol);
      if (dbData && Date.now() - dbData.lastUpdated.getTime() < this.cacheTimeout) {
        const data = this.formatMarketData(dbData);
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }

      // Fetch from external API
      const freshData = await this.fetchFromExternalAPI(symbol);
      if (freshData) {
        // Save to database
        await this.saveMarketData(freshData);
        
        // Cache the result
        this.cache.set(cacheKey, { data: freshData, timestamp: Date.now() });
        return freshData;
      }

      // Return database data as fallback
      return dbData ? this.formatMarketData(dbData) : null;

    } catch (error) {
      apiLogger.error('MarketDataService', 'getMarketData', error, { symbol });
      
      // Return cached data if available
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey).data;
      }
      
      throw error;
    }
  }

  // Fetch data from external APIs
  async fetchFromExternalAPI(symbol) {
    try {
      // Try Yahoo Finance first (free)
      const yahooData = await this.fetchFromYahoo(symbol);
      if (yahooData) {
        apiLogger.info('Yahoo Finance', 'fetchQuote', { symbol, success: true });
        return yahooData;
      }

      // Try Alpha Vantage as fallback
      const alphaData = await this.fetchFromAlphaVantage(symbol);
      if (alphaData) {
        apiLogger.info('Alpha Vantage', 'fetchQuote', { symbol, success: true });
        return alphaData;
      }

      return null;
    } catch (error) {
      apiLogger.error('External APIs', 'fetchMarketData', error, { symbol });
      throw error;
    }
  }

  // Fetch from Yahoo Finance
  async fetchFromYahoo(symbol) {
    try {
      const yahooSymbol = this.formatSymbolForYahoo(symbol);
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
        { timeout: 10000 }
      );

      const result = response.data.chart.result[0];
      if (!result) return null;

      const meta = result.meta;
      const quote = result.indicators.quote[0];
      
      const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1];
      const previousClose = meta.previousClose;
      const change = currentPrice - previousClose;
      const changePercent = (change / previousClose) * 100;

      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(currentPrice.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        volume: meta.regularMarketVolume || 0,
        dayHigh: meta.regularMarketDayHigh,
        dayLow: meta.regularMarketDayLow,
        previousClose: previousClose,
        marketCap: meta.marketCap,
        timestamp: new Date().toISOString(),
        source: 'yahoo_finance'
      };
    } catch (error) {
      apiLogger.error('Yahoo Finance', 'fetchQuote', error, { symbol });
      return null;
    }
  }

  // Fetch from Alpha Vantage
  async fetchFromAlphaVantage(symbol) {
    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) return null;

      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: apiKey
        },
        timeout: 10000
      });

      const quote = response.data['Global Quote'];
      if (!quote) return null;

      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        dayHigh: parseFloat(quote['03. high']),
        dayLow: parseFloat(quote['04. low']),
        previousClose: parseFloat(quote['08. previous close']),
        timestamp: new Date().toISOString(),
        source: 'alpha_vantage'
      };
    } catch (error) {
      apiLogger.error('Alpha Vantage', 'fetchQuote', error, { symbol });
      return null;
    }
  }

  // Format symbol for Yahoo Finance
  formatSymbolForYahoo(symbol) {
    // Handle Indian stocks
    if (symbol === 'NIFTY') return '^NSEI';
    if (symbol === 'SENSEX') return '^BSESN';
    if (symbol === 'BANKNIFTY') return '^NSEBANK';
    
    // Add .NS for NSE stocks if not present
    return symbol.includes('.') ? symbol : `${symbol}.NS`;
  }

  // Save market data to database
  async saveMarketData(data) {
    try {
      await MarketData.findOneAndUpdate(
        { symbol: data.symbol },
        {
          ...data,
          exchange: this.getExchange(data.symbol),
          lastUpdated: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      apiLogger.error('Database', 'saveMarketData', error, { symbol: data.symbol });
    }
  }

  // Format database data
  formatMarketData(dbData) {
    return {
      symbol: dbData.symbol,
      price: dbData.price,
      change: dbData.change,
      changePercent: dbData.changePercent,
      volume: dbData.volume,
      dayHigh: dbData.dayHigh,
      dayLow: dbData.dayLow,
      previousClose: dbData.previousClose,
      marketCap: dbData.marketCap,
      timestamp: dbData.lastUpdated.toISOString(),
      source: dbData.source
    };
  }

  // Get exchange for symbol
  getExchange(symbol) {
    if (['NIFTY', 'SENSEX', 'BANKNIFTY'].includes(symbol)) {
      return 'INDEX';
    }
    return 'NSE'; // Default to NSE for Indian stocks
  }

  // Batch fetch multiple symbols
  async getBatchMarketData(symbols) {
    const promises = symbols.map(symbol => 
      this.getMarketData(symbol).catch(error => ({
        symbol,
        error: error.message
      }))
    );

    const results = await Promise.all(promises);
    const data = {};

    results.forEach(result => {
      if (result.error) {
        data[result.symbol] = { status: 'error', message: result.error };
      } else {
        data[result.symbol] = { status: 'success', data: result };
      }
    });

    return data;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

module.exports = new MarketDataService();