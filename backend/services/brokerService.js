const axios = require('axios');
const { apiLogger } = require('../middleware/logger');

class BrokerService {
  constructor() {
    this.apiKey = process.env.BROKER_API_KEY;
    this.apiSecret = process.env.BROKER_API_SECRET;
    this.baseURL = process.env.BROKER_BASE_URL;
    this.brokerType = process.env.BROKER_TYPE; // 'alice_blue', 'zerodha', 'upstox', etc.
  }

  // Generic broker API call
  async callBrokerAPI(endpoint, params = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Broker API key not configured');
      }

      const config = {
        timeout: 10000,
        headers: this.getBrokerHeaders()
      };

      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        ...config,
        params
      });

      return response.data;
    } catch (error) {
      apiLogger.error('BrokerService', 'callBrokerAPI', error);
      throw error;
    }
  }

  // Get broker-specific headers
  getBrokerHeaders() {
    switch (this.brokerType) {
      case 'alice_blue':
        return {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        };
      case 'zerodha':
        return {
          'X-Kite-Version': '3',
          'Authorization': `token ${this.apiKey}:${this.apiSecret}`
        };
      case 'upstox':
        return {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        };
      default:
        return {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        };
    }
  }

  // Fetch stock quote from broker
  async fetchStockQuote(symbol) {
    try {
      let data;
      
      switch (this.brokerType) {
        case 'alice_blue':
          data = await this.fetchFromAliceBlue(symbol);
          break;
        case 'zerodha':
          data = await this.fetchFromZerodha(symbol);
          break;
        case 'upstox':
          data = await this.fetchFromUpstox(symbol);
          break;
        default:
          throw new Error(`Unsupported broker type: ${this.brokerType}`);
      }

      return this.formatBrokerData(data, symbol);
    } catch (error) {
      apiLogger.error('BrokerService', 'fetchStockQuote', error, { symbol });
      throw error;
    }
  }

  // Alice Blue API integration
  async fetchFromAliceBlue(symbol) {
    try {
      // Alice Blue uses NSE:SYMBOL format
      const aliceSymbol = `NSE:${symbol}`;
      const response = await this.callBrokerAPI('/marketdata/instruments/quotes', {
        instruments: aliceSymbol
      });
      
      return response[aliceSymbol];
    } catch (error) {
      apiLogger.error('BrokerService', 'fetchFromAliceBlue', error, { symbol });
      throw error;
    }
  }

  // Zerodha Kite API integration
  async fetchFromZerodha(symbol) {
    try {
      // Zerodha uses instrument_token, you'll need to map symbols to tokens
      const instrumentToken = await this.getZerodhaInstrumentToken(symbol);
      const response = await this.callBrokerAPI(`/quote`, {
        i: `NSE:${symbol}`
      });
      
      return response.data[`NSE:${symbol}`];
    } catch (error) {
      apiLogger.error('BrokerService', 'fetchFromZerodha', error, { symbol });
      throw error;
    }
  }

  // Upstox API integration
  async fetchFromUpstox(symbol) {
    try {
      const response = await this.callBrokerAPI('/market-quote/quotes', {
        symbol: `NSE_EQ|INE002A01018`, // You'll need instrument key mapping
        interval: '1d'
      });
      
      return response.data;
    } catch (error) {
      apiLogger.error('BrokerService', 'fetchFromUpstox', error, { symbol });
      throw error;
    }
  }

  // Format broker data to standard format
  formatBrokerData(brokerData, symbol) {
    // This will vary based on broker response format
    // Here's a generic formatter - you'll customize based on your broker
    
    return {
      symbol: symbol.toUpperCase(),
      price: brokerData.ltp || brokerData.last_price || brokerData.close,
      change: brokerData.change || (brokerData.ltp - brokerData.prev_close),
      changePercent: brokerData.change_percent || ((brokerData.ltp - brokerData.prev_close) / brokerData.prev_close * 100),
      volume: brokerData.volume || brokerData.volume_traded,
      dayHigh: brokerData.high || brokerData.day_high,
      dayLow: brokerData.low || brokerData.day_low,
      previousClose: brokerData.prev_close || brokerData.previous_close,
      timestamp: new Date().toISOString(),
      source: `broker_${this.brokerType}`
    };
  }

  // Get instrument token for Zerodha (example)
  async getZerodhaInstrumentToken(symbol) {
    // You'll need to implement instrument mapping
    // This is just a placeholder
    const instrumentMap = {
      'RELIANCE': '738561',
      'TCS': '2953217',
      'HDFC': '340481'
      // Add more mappings
    };
    
    return instrumentMap[symbol] || symbol;
  }

  // Test broker connection
  async testConnection() {
    try {
      // Test with a common stock
      const testData = await this.fetchStockQuote('RELIANCE');
      return {
        status: 'connected',
        broker: this.brokerType,
        testSymbol: 'RELIANCE',
        testPrice: testData.price,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        broker: this.brokerType,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get service status
  getStatus() {
    return {
      brokerType: this.brokerType,
      apiKeyConfigured: !!this.apiKey,
      baseURL: this.baseURL,
      status: 'ready'
    };
  }
}

module.exports = new BrokerService();