const axios = require('axios');
const { apiLogger } = require('../middleware/logger');

class UpstoxService {
  constructor() {
    // Use V3 endpoint – same as the working MarketQuoteV3Api used by the index bar
    this.baseURL = 'https://api.upstox.com/v3';
    this.accessToken = process.env.UPSTOX_ACCESS_TOKEN;
  }

  // Fetch stock quote from Upstox V3 API
  // Aligned with the working MarketQuoteV3Api.getLtp() used by the index bar.
  // V3 accepts instrument_key with '|' but returns response keys with ':'
  async fetchStockQuote(symbol) {
    try {
      if (!this.accessToken) {
        throw new Error('Upstox access token not configured');
      }

      // Build the instrument key (pipe-separated, e.g. NSE_EQ|INE522F01014)
      const instrumentKey = this.formatSymbolForUpstox(symbol);

      apiLogger.info('Upstox Service', 'fetchStockQuote:request', {
        incomingSymbol: symbol,
        resolvedInstrumentKey: instrumentKey,
      });

      // V3 endpoint – same path & param name as the SDK's MarketQuoteV3Api.getLtp
      const response = await axios.get(
        `${this.baseURL}/market-quote/ltp`,
        {
          params: { instrument_key: instrumentKey },
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      // V3 returns keys with ':' instead of '|'
      // e.g. response.data.data['NSE_EQ:INE522F01014']
      const colonKey = instrumentKey.replace('|', ':');
      const responseData = response.data?.data || {};
      const data = responseData[instrumentKey] || responseData[colonKey] || null;

      apiLogger.info('Upstox Service', 'fetchStockQuote:response', {
        incomingSymbol: symbol,
        instrumentKey,
        colonKey,
        hasData: !!data,
        lastPrice: data ? (data.last_price ?? data.lastPrice) : null,
        responseKeys: Object.keys(responseData),
      });

      if (!data) return null;

      // V3 SDK uses camelCase (lastPrice) while V2 REST used snake_case (last_price)
      const ltp = data.last_price ?? data.lastPrice ?? 0;
      const prevClose = data.ohlc?.close ?? data.previousClose ?? data.ohlc?.previousClose ?? 0;
      const high = data.ohlc?.high ?? data.dayHigh ?? 0;
      const low = data.ohlc?.low ?? data.dayLow ?? 0;
      const vol = data.volume ?? 0;

      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(Number(ltp).toFixed(2)),
        change: 0,
        changePercent: 0,
        volume: parseInt(vol, 10),
        dayHigh: parseFloat(Number(high).toFixed(2)),
        dayLow: parseFloat(Number(low).toFixed(2)),
        previousClose: parseFloat(Number(prevClose).toFixed(2)),
        timestamp: new Date().toISOString(),
        source: 'upstox_v3'
      };
    } catch (error) {
      apiLogger.error('Upstox Service', 'fetchStockQuote:error', error, {
        incomingSymbol: symbol,
        resolvedInstrumentKey: this.formatSymbolForUpstox(symbol),
        errorMessage: error.message,
        httpStatus: error.response?.status,
        httpData: error.response?.data,
      });
      return null;
    }
  }

  // Format symbol for Upstox API
  //
  // Handles three input shapes:
  //   1. Already a full instrument key containing '|' (e.g. "NSE_EQ|INE522F01014") → use as-is
  //   2. A plain ISIN identifier (starts with "IN", 12 chars, e.g. "INE522F01014") → prepend NSE_EQ|
  //   3. A trading symbol name (e.g. "RELIANCE") → look up in hardcoded map, else fallback NSE_EQ|{symbol}
  formatSymbolForUpstox(symbol) {
    const input = (symbol || '').trim();

    // 1. Already a full instrument key (contains '|') → use as-is, avoid double-prefixing
    if (input.includes('|')) {
      return input;
    }

    // 2. Plain ISIN identifier (starts with IN, 12 characters) → prepend NSE_EQ|
    if (/^IN[A-Z0-9]{10}$/i.test(input)) {
      return `NSE_EQ|${input.toUpperCase()}`;
    }

    // 3. Trading symbol name → hardcoded map or fallback
    const symbolMap = {
      'NIFTY': 'NSE_INDEX|Nifty 50',
      'SENSEX': 'BSE_INDEX|SENSEX',
      'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
      'RELIANCE': 'NSE_EQ|INE002A01018',
      'INFY': 'NSE_EQ|INE009A01021',
      'INFOSYS': 'NSE_EQ|INE009A01021',
      'TCS': 'NSE_EQ|INE467B01029',
      'HDFC': 'NSE_EQ|INE040A01034'
    };

    return symbolMap[input.toUpperCase()] || `NSE_EQ|${input.toUpperCase()}`;
  }

  // Fetch historical data (for calculating change)
  async fetchHistoricalData(symbol, interval = '1day') {
    try {
      if (!this.accessToken) {
        throw new Error('Upstox access token not configured');
      }

      const instrumentKey = this.formatSymbolForUpstox(symbol);
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await axios.get(
        `${this.baseURL}/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${toDate}/${fromDate}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      return response.data?.data?.candles || [];
    } catch (error) {
      apiLogger.error('Upstox Service', 'fetchHistoricalData', error, { symbol });
      return [];
    }
  }
}

module.exports = new UpstoxService();