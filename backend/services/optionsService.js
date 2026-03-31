const axios = require('axios');
const { apiLogger } = require('../middleware/logger');

// Upstox V2 Option Chain service
// V2 endpoints: /v2/option/chain, /v2/option/contract
class OptionsService {
  constructor() {
    this.baseURL = 'https://api.upstox.com/v2';
    this.accessToken = process.env.UPSTOX_ACCESS_TOKEN;

    // In-memory cache (options data is time-sensitive)
    this.cache = {};
    this.CACHE_TTL = 30 * 1000; // 30 seconds

    // Underlying → Upstox instrument key mapping
    this.underlyingMap = {
      'NIFTY': 'NSE_INDEX|Nifty 50',
      'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
      'FINNIFTY': 'NSE_INDEX|Nifty Fin Service',
      'SENSEX': 'BSE_INDEX|SENSEX',
      'MIDCPNIFTY': 'NSE_INDEX|NIFTY MID SELECT',
    };
  }

  _getCached(key) {
    const entry = this.cache[key];
    if (entry && Date.now() - entry.ts < this.CACHE_TTL) return entry.data;
    return null;
  }

  _setCache(key, data) {
    this.cache[key] = { data, ts: Date.now() };
  }

  _getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
    };
  }

  buildInstrumentKey(underlying) {
    const key = (underlying || '').toUpperCase().trim();
    return this.underlyingMap[key] || `NSE_INDEX|${key}`;
  }

  // Get available expiry dates for an underlying
  async getExpiries(underlying) {
    if (!this.accessToken) throw new Error('Upstox access token not configured');

    const instrumentKey = this.buildInstrumentKey(underlying);
    const cacheKey = `expiries:${instrumentKey}`;
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/option/contract`, {
        params: { instrument_key: instrumentKey },
        headers: this._getHeaders(),
        timeout: 15000,
      });

      const contracts = response.data?.data || [];

      // Extract unique expiry dates and lot size
      const expirySet = new Map();
      let lotSize = 0;

      for (const c of contracts) {
        const expiry = c.expiry || c.expiry_date;
        if (expiry && !expirySet.has(expiry)) {
          expirySet.set(expiry, true);
        }
        if (!lotSize && c.lot_size) lotSize = c.lot_size;
      }

      const expiries = Array.from(expirySet.keys()).sort();
      const result = { expiries, lotSize, underlying: underlying.toUpperCase() };

      // Cache expiries for 5 minutes (they don't change intraday)
      this.cache[cacheKey] = { data: result, ts: Date.now() };
      this.CACHE_TTL_EXPIRIES = 5 * 60 * 1000;

      apiLogger.info('OptionsService', 'getExpiries', {
        underlying, expiryCount: expiries.length, lotSize,
      });

      return result;
    } catch (error) {
      apiLogger.error('OptionsService', 'getExpiries', error, {
        underlying, status: error.response?.status, data: error.response?.data,
      });
      throw error;
    }
  }

  // Get full option chain for an underlying + expiry
  async getOptionChain(underlying, expiry) {
    if (!this.accessToken) throw new Error('Upstox access token not configured');

    const instrumentKey = this.buildInstrumentKey(underlying);
    const cacheKey = `chain:${instrumentKey}:${expiry}`;
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.baseURL}/option/chain`, {
        params: { instrument_key: instrumentKey, expiry_date: expiry },
        headers: this._getHeaders(),
        timeout: 15000,
      });

      const rawData = response.data?.data || [];

      // Parse into structured format: array of strikes with CE/PE data
      const strikes = [];
      let totalCallOI = 0;
      let totalPutOI = 0;

      for (const item of rawData) {
        const strike = item.strike_price;
        const ce = item.call_options || {};
        const pe = item.put_options || {};

        const ceMarket = ce.market_data || {};
        const peMarket = pe.market_data || {};
        const ceGreeks = ce.option_greeks || {};
        const peGreeks = pe.option_greeks || {};

        totalCallOI += ceMarket.oi || 0;
        totalPutOI += peMarket.oi || 0;

        strikes.push({
          strike,
          ce: {
            ltp: ceMarket.ltp || 0,
            oi: ceMarket.oi || 0,
            volume: ceMarket.volume || 0,
            iv: ceGreeks.iv || 0,
            delta: ceGreeks.delta || 0,
            theta: ceGreeks.theta || 0,
            gamma: ceGreeks.gamma || 0,
            vega: ceGreeks.vega || 0,
            bidPrice: ceMarket.bid_price || 0,
            askPrice: ceMarket.ask_price || 0,
            instrumentKey: ce.instrument_key || '',
          },
          pe: {
            ltp: peMarket.ltp || 0,
            oi: peMarket.oi || 0,
            volume: peMarket.volume || 0,
            iv: peGreeks.iv || 0,
            delta: peGreeks.delta || 0,
            theta: peGreeks.theta || 0,
            gamma: peGreeks.gamma || 0,
            vega: peGreeks.vega || 0,
            bidPrice: peMarket.bid_price || 0,
            askPrice: peMarket.ask_price || 0,
            instrumentKey: pe.instrument_key || '',
          },
        });
      }

      // Sort by strike price
      strikes.sort((a, b) => a.strike - b.strike);

      const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 'N/A';

      const result = {
        underlying: underlying.toUpperCase(),
        expiry,
        strikes,
        totalCallOI,
        totalPutOI,
        pcr,
      };

      this._setCache(cacheKey, result);

      apiLogger.info('OptionsService', 'getOptionChain', {
        underlying, expiry, strikeCount: strikes.length, pcr,
      });

      return result;
    } catch (error) {
      apiLogger.error('OptionsService', 'getOptionChain', error, {
        underlying, expiry, status: error.response?.status, data: error.response?.data,
      });
      throw error;
    }
  }

  // Get contract details for a specific instrument
  async getContractDetails(instrumentKey) {
    if (!this.accessToken) throw new Error('Upstox access token not configured');

    const cacheKey = `contract:${instrumentKey}`;
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    try {
      // Use the contract endpoint to fetch details
      const response = await axios.get(`${this.baseURL}/option/contract`, {
        params: { instrument_key: instrumentKey },
        headers: this._getHeaders(),
        timeout: 10000,
      });

      const contracts = response.data?.data || [];
      const result = contracts.map(c => ({
        instrumentKey: c.instrument_key,
        lotSize: c.lot_size,
        tickSize: c.tick_size,
        expiry: c.expiry || c.expiry_date,
        strikePrice: c.strike_price,
        optionType: c.option_type,
      }));

      this._setCache(cacheKey, result);
      return result;
    } catch (error) {
      apiLogger.error('OptionsService', 'getContractDetails', error, {
        instrumentKey, status: error.response?.status,
      });
      throw error;
    }
  }
}

module.exports = new OptionsService();
