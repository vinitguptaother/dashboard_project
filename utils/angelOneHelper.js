// utils/angelOneHelper.js
const axios = require('axios');
const { angelOneAuth } = require('../services/angelOneAuth');

/**
 * Angel One API Helper Functions
 * Provides convenient methods for common Angel One API operations
 */
class AngelOneHelper {
  constructor() {
    this.auth = angelOneAuth;
  }

  /**
   * Get LTP data for a single symbol using Angel One API
   */
  async getLTPData(exchange, symbol, symbolToken) {
    const endpoint = '/order-service/rest/secure/angelbroking/order/v1/getLtpData';
    
    const requestData = {
      exchange: exchange,
      tradingsymbol: symbol,
      symboltoken: symbolToken
    };

    try {
      const response = await this.auth.makeAuthenticatedRequest('POST', endpoint, requestData);
      
      if (!response.status) {
        throw new Error(`LTP data request failed: ${response.message || 'Unknown error'}`);
      }

      const data = response.data;
      if (!data || !data.ltp) {
        throw new Error('No LTP data found for the requested symbol');
      }

      return {
        ltp: parseFloat(data.ltp || 0),
        exchange: exchange,
        symbol: symbol,
        symbolToken: symbolToken,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('LTP data fetch error:', error.message);
      throw error;
    }
  }

  /**
   * Search for a symbol and get its token
   */
  async searchSymbol(exchange, searchTerm) {
    const endpoint = '/rest/secure/angelbroking/order/v1/searchScrip';
    
    const requestData = {
      exchange: exchange,
      searchscrip: searchTerm.replace('-EQ', '')
    };

    try {
      const response = await this.auth.makeAuthenticatedRequest('POST', endpoint, requestData);
      
      if (!response.status) {
        throw new Error(`Symbol search failed: ${response.message || 'Unknown error'}`);
      }

      if (!response.data || response.data.length === 0) {
        throw new Error(`No symbols found for search term: ${searchTerm}`);
      }

      return response.data.map(item => ({
        symbolToken: item.symboltoken,
        symbol: item.tradingsymbol,
        name: item.name,
        exchange: item.exchange,
        expirydate: item.expirydate,
        strike: item.strike,
        lotsize: item.lotsize,
        instrumenttype: item.instrumenttype,
        tick_size: item.tick_size
      }));

    } catch (error) {
      console.error('Symbol search error:', error.message);
      throw error;
    }
  }

  /**
   * Get symbol token for a specific symbol
   */
  async getSymbolToken(symbol, exchange = 'NSE') {
    try {
      const searchResults = await this.searchSymbol(exchange, symbol);
      
      if (searchResults.length === 0) {
        throw new Error(`Symbol ${symbol} not found on ${exchange}`);
      }

      // Find exact match for the trading symbol
      const match = searchResults.find(s => s.symbol === symbol);
      return match ? match.symbolToken : null;

    } catch (error) {
      console.error('Get symbol token error:', error.message);
      throw error;
    }
  }

  /**
   * Get LTP (Last Traded Price) for a symbol
   */
  async getLTP(exchange, symbol) {
    try {
      // First search for the symbol to get its token
      const searchResults = await this.searchSymbol(exchange, symbol);
      
      if (searchResults.length === 0) {
        throw new Error(`Symbol ${symbol} not found on ${exchange}`);
      }

      // Find exact match for the symbol
      const symbolData = searchResults.find(s => s.symbol === symbol) || searchResults[0];
      
      // Get LTP data using the symbol token
      const ltpData = await this.getLTPData(exchange, symbol, symbolData.symbolToken);
      
      return {
        ...ltpData,
        name: symbolData.name
      };

    } catch (error) {
      console.error(`LTP fetch error for ${exchange}:${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get multiple LTPs in batch
   */
  async getBatchLTP(symbols) {
    const results = {};
    
    // Process symbols in parallel for better performance
    const promises = symbols.map(async (symbolData) => {
      const key = `${symbolData.exchange}:${symbolData.symbol}`;
      
      try {
        const quote = await this.getLTP(symbolData.exchange, symbolData.symbol);
        results[key] = {
          ...quote,
          status: 'success'
        };
      } catch (error) {
        results[key] = {
          exchange: symbolData.exchange,
          symbol: symbolData.symbol,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get user profile information
   */
  async getUserProfile() {
    const endpoint = '/rest/secure/angelbroking/user/v1/getProfile';
    
    try {
      const response = await this.auth.makeAuthenticatedRequest('GET', endpoint);
      
      if (!response.status) {
        throw new Error(`Profile fetch failed: ${response.message || 'Unknown error'}`);
      }

      return response.data;

    } catch (error) {
      console.error('Profile fetch error:', error.message);
      throw error;
    }
  }

  /**
   * Get user's holdings
   */
  async getHoldings() {
    const endpoint = '/rest/secure/angelbroking/portfolio/v1/getHolding';
    
    try {
      const response = await this.auth.makeAuthenticatedRequest('GET', endpoint);
      
      if (!response.status) {
        throw new Error(`Holdings fetch failed: ${response.message || 'Unknown error'}`);
      }

      return response.data;

    } catch (error) {
      console.error('Holdings fetch error:', error.message);
      throw error;
    }
  }

  /**
   * Get user's positions
   */
  async getPositions() {
    const endpoint = '/rest/secure/angelbroking/order/v1/getPosition';
    
    try {
      const response = await this.auth.makeAuthenticatedRequest('GET', endpoint);
      
      if (!response.status) {
        throw new Error(`Positions fetch failed: ${response.message || 'Unknown error'}`);
      }

      return response.data;

    } catch (error) {
      console.error('Positions fetch error:', error.message);
      throw error;
    }
  }

  /**
   * Get historical candle data
   */
  async getCandleData(exchange, symbolToken, interval, fromDate, toDate) {
    const endpoint = '/rest/secure/angelbroking/historical/v1/getCandleData';
    
    const requestData = {
      exchange: exchange,
      symboltoken: symbolToken,
      interval: interval, // ONE_MINUTE, THREE_MINUTE, FIVE_MINUTE, etc.
      fromdate: fromDate, // YYYY-MM-DD HH:MM
      todate: toDate      // YYYY-MM-DD HH:MM
    };

    try {
      const response = await this.auth.makeAuthenticatedRequest('POST', endpoint, requestData);
      
      if (!response.status) {
        throw new Error(`Candle data fetch failed: ${response.message || 'Unknown error'}`);
      }

      return response.data;

    } catch (error) {
      console.error('Candle data fetch error:', error.message);
      throw error;
    }
  }

  /**
   * WebSocket helper - get feed token for WebSocket connections
   */
  async getFeedToken() {
    const tokens = await this.auth.getTokens();
    return tokens.feedToken;
  }

  /**
   * Get authentication status
   */
  getAuthStatus() {
    return this.auth.getTokenStatus();
  }

  /**
   * Force re-authentication
   */
  async refreshAuthentication(totpCode = null) {
    await this.auth.logout();
    return await this.auth.login(totpCode);
  }

  /**
   * Get common headers for Angel One API requests (matches documentation example)
   */
  getCommonHeaders(jwtToken = null) {
    // Use the auth service's network info (which auto-detects)
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': this.auth.clientLocalIP,
      'X-ClientPublicIP': this.auth.clientPublicIP || '127.0.0.1',
      'X-MACAddress': this.auth.macAddress,
      'X-PrivateKey': process.env.ANGELONE_API_KEY
    };

    if (jwtToken) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    }

    return headers;
  }

  /**
   * Angel One login function (following documentation example)
   */
  async angelOneLogin(totpCode = null) {
    try {
      const loginData = {
        clientcode: process.env.ANGELONE_CLIENT_CODE,
        password: process.env.ANGELONE_PASSWORD,
        totp: totpCode || this.auth.generateTOTP()
      };

      const headers = this.getCommonHeaders();

      const response = await axios.post(
        'https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword',
        loginData,
        { headers }
      );

      if (response.data.status) {
        return response.data.data;
      } else {
        throw new Error(response.data.message);
      }
    } catch (err) {
      console.error("Login error:", err.message);
      throw err;
    }
  }
}

// Export singleton instance
const angelOneHelper = new AngelOneHelper();

module.exports = {
  AngelOneHelper,
  angelOneHelper
};

