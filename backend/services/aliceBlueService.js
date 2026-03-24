const axios = require('axios');
const crypto = require('crypto');

class AliceBlueService {
  constructor(config) {
    this.baseURL = 'https://ant.aliceblueonline.com';
    this.appId = config.appId;           // Changed from appCode to appId
    this.apiSecret = config.apiSecret;   // Changed from appSecret to apiSecret
    this.apiKey = config.apiKey;
    this.username = config.username;
    this.password = config.password;
    this.twoFA = config.twoFA;
    this.sessionId = null;
    this.lastAuthTime = null;
    this.authExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  // Encrypt sensitive data as required by Alice Blue
  encryptData(data) {
    // Simple encryption - in production, use proper encryption
    return Buffer.from(data).toString('base64');
  }

  // Generate user data hash as required by Alice Blue
  generateUserDataHash() {
    const userData = {
      appId: this.appId,
      apiSecret: this.apiSecret,
      apiKey: this.apiKey,
      username: this.username,
      password: this.password,
      twoFA: this.twoFA
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(userData))
      .digest('hex');
  }

  // Authenticate and get session ID using the correct Alice Blue API
  async authenticate() {
    try {
      // Check if we have a valid session
      if (this.sessionId && this.lastAuthTime && 
          (Date.now() - this.lastAuthTime) < this.authExpiry) {
        return this.sessionId;
      }

      // Use the correct authentication endpoint as per Alice Blue documentation
      const response = await axios.post(`${this.baseURL}/open-api/od/v1/auth/login`, {
        userId: this.username,
        userData: this.encryptData(JSON.stringify({
          username: this.username,
          password: this.password,
          twoFA: this.twoFA
        })),
        appId: this.appId,           // Changed from appCode to appId
        apiSecret: this.apiSecret,   // Changed from appSecret to apiSecret
        apiKey: this.apiKey
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AliceBlue-Dashboard/1.0'
        }
      });

      if (response.data.status === 'Ok') {
        this.sessionId = response.data.data.sessionId || response.data.data.userSession;
        this.lastAuthTime = Date.now();
        return this.sessionId;
      } else {
        throw new Error(response.data.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Alice Blue authentication error:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Get market data for a symbol using correct Alice Blue endpoint
  async getMarketData(symbol, exchange = 'NSE') {
    try {
      const sessionId = await this.authenticate();
      
      // Use the correct market data endpoint as per Alice Blue documentation
      const response = await axios.get(`${this.baseURL}/open-api/od/v1/marketData`, {
        params: {
          symbol: symbol,
          exchange: exchange
        },
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'Ok') {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch market data');
      }
    } catch (error) {
      console.error('Alice Blue market data error:', error);
      throw new Error(`Market data fetch failed: ${error.message}`);
    }
  }

  // Get user portfolio using correct Alice Blue endpoint
  async getPortfolio() {
    try {
      const sessionId = await this.authenticate();
      
      // Use the correct portfolio endpoint as per Alice Blue documentation
      const response = await axios.get(`${this.baseURL}/open-api/od/v1/portfolio`, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'Ok') {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch portfolio');
      }
    } catch (error) {
      console.error('Alice Blue portfolio error:', error);
      throw new Error(`Portfolio fetch failed: ${error.message}`);
    }
  }

  // Place order using correct Alice Blue endpoint
  async placeOrder(orderData) {
    try {
      const sessionId = await this.authenticate();
      
      // Use the correct order placement endpoint as per Alice Blue documentation
      const response = await axios.post(`${this.baseURL}/open-api/od/v1/orders`, orderData, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'Ok') {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Order placement failed');
      }
    } catch (error) {
      console.error('Alice Blue order error:', error);
      throw new Error(`Order placement failed: ${error.message}`);
    }
  }

  // Get order book using correct Alice Blue endpoint
  async getOrderBook() {
    try {
      const sessionId = await this.authenticate();
      
      // Use the correct order book endpoint as per Alice Blue documentation
      const response = await axios.get(`${this.baseURL}/open-api/od/v1/orders`, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'Ok') {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch order book');
      }
    } catch (error) {
      console.error('Alice Blue order book error:', error);
      throw new Error(`Order book fetch failed: ${error.message}`);
    }
  }

  // Test connection
  async testConnection() {
    try {
      const sessionId = await this.authenticate();
      return {
        status: 'connected',
        message: 'Successfully connected to Alice Blue',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get account details using correct Alice Blue endpoint
  async getAccountDetails() {
    try {
      const sessionId = await this.authenticate();
      
      // Use the correct account details endpoint as per Alice Blue documentation
      const response = await axios.get(`${this.baseURL}/open-api/od/v1/account`, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'Ok') {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch account details');
      }
    } catch (error) {
      console.error('Alice Blue account details error:', error);
      throw new Error(`Account details fetch failed: ${error.message}`);
    }
  }

  // Get account balance (equivalent to Python's alice.get_balance())
  async getBalance() {
    try {
      const sessionId = await this.authenticate();
      
      // Use the balance endpoint as per Alice Blue documentation
      const response = await axios.get(`${this.baseURL}/open-api/od/v1/balance`, {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'Ok') {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch balance');
      }
    } catch (error) {
      console.error('Alice Blue balance error:', error);
      throw new Error(`Balance fetch failed: ${error.message}`);
    }
  }
}

module.exports = AliceBlueService;
