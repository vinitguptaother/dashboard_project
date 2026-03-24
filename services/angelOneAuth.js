// services/angelOneAuth.js
const axios = require('axios');
const { authenticator } = require('otplib');
const os = require('os');

/**
 * Angel One Smart API Authentication Service
 * Handles login, token management, and refresh operations
 * Reads from .env.local (preferred) or .env files
 */
class AngelOneAuthService {
  constructor() {
    // Load environment variables from .env.local (preferred) or .env
    require('dotenv').config({ path: '.env.local' });
    require('dotenv').config(); // Fallback to .env if .env.local doesn't exist
    
    // Environment variables
    this.apiKey = process.env.ANGELONE_API_KEY;
    this.clientCode = process.env.ANGELONE_CLIENT_CODE;
    this.password = process.env.ANGELONE_PASSWORD;
    this.totpSecret = process.env.ANGELONE_TOTP_SECRET;
    
    // Network configuration - auto-detect or use environment variables
    this.clientLocalIP = process.env.ANGELONE_LOCAL_IP || this.getLocalIP();
    this.clientPublicIP = process.env.ANGELONE_PUBLIC_IP || null; // Will be auto-detected
    this.macAddress = process.env.ANGELONE_MAC_ADDRESS || this.getMACAddress();
    
    // Auto-detect public IP on initialization
    this.initializeNetworkInfo();
    
    // Token storage
    this.tokens = {
      jwtToken: null,
      refreshToken: null,
      feedToken: null,
      expiresAt: null
    };
    
    // API endpoints
    this.baseURL = 'https://apiconnect.angelone.in';
    this.endpoints = {
      login: '/rest/auth/angelbroking/user/v1/loginByPassword',
      generateToken: '/rest/auth/angelbroking/jwt/v1/generateTokens',
      logout: '/rest/secure/angelbroking/user/v1/logout'
    };
    
    this.validateCredentials();
  }

  /**
   * Validate required credentials
   */
  validateCredentials() {
    const required = ['apiKey', 'clientCode', 'password'];
    const missing = required.filter(key => !this[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required Angel One credentials: ${missing.join(', ')}. Please set the corresponding environment variables.`);
    }
  }

  /**
   * Get local IP address
   */
  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  /**
   * Get MAC address (improved detection)
   */
  getMACAddress() {
    const interfaces = os.networkInterfaces();
    
    // Try to find the primary network interface
    const priorityInterfaces = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0'];
    
    // First, try priority interfaces
    for (const interfaceName of priorityInterfaces) {
      if (interfaces[interfaceName]) {
        for (const iface of interfaces[interfaceName]) {
          if (iface.family === 'IPv4' && !iface.internal && iface.mac !== '00:00:00:00:00:00') {
            console.log(`Using MAC address from ${interfaceName}: ${iface.mac}`);
            return iface.mac;
          }
        }
      }
    }
    
    // Fallback: any non-internal interface
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && iface.mac !== '00:00:00:00:00:00') {
          console.log(`Using MAC address from ${name}: ${iface.mac}`);
          return iface.mac;
        }
      }
    }
    
    console.warn('Could not detect MAC address, using default');
    return '00:00:00:00:00:00';
  }

  /**
   * Auto-detect public IP address
   */
  async getPublicIP() {
    const services = [
      'https://api.ipify.org?format=json',
      'https://httpbin.org/ip',
      'https://ipapi.co/json/',
      'https://jsonip.com'
    ];

    for (const service of services) {
      try {
        console.log(`Trying to get public IP from: ${service}`);
        const response = await axios.get(service, { 
          timeout: 5000,
          headers: { 'User-Agent': 'Angel-One-API-Client' }
        });
        
        let ip = null;
        
        // Handle different response formats
        if (response.data.ip) {
          ip = response.data.ip;
        } else if (response.data.origin) {
          ip = response.data.origin.split(',')[0].trim(); // httpbin sometimes returns multiple IPs
        } else if (typeof response.data === 'string') {
          ip = response.data.trim();
        }
        
        if (ip && this.isValidIP(ip)) {
          console.log(`✅ Public IP detected: ${ip}`);
          return ip;
        }
      } catch (error) {
        console.warn(`Failed to get IP from ${service}:`, error.message);
        continue;
      }
    }
    
    console.warn('Could not detect public IP, using local IP as fallback');
    return this.clientLocalIP;
  }

  /**
   * Validate IP address format
   */
  isValidIP(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Initialize network information (auto-detect public IP)
   */
  async initializeNetworkInfo() {
    try {
      if (!this.clientPublicIP) {
        console.log('🌐 Auto-detecting public IP address...');
        this.clientPublicIP = await this.getPublicIP();
      }
      
      console.log('📡 Network Configuration:');
      console.log(`   Local IP: ${this.clientLocalIP}`);
      console.log(`   Public IP: ${this.clientPublicIP}`);
      console.log(`   MAC Address: ${this.macAddress}`);
      
    } catch (error) {
      console.warn('Network info initialization failed:', error.message);
      this.clientPublicIP = this.clientLocalIP; // Fallback
    }
  }

  /**
   * Generate TOTP code from secret using otplib
   */
  generateTOTP(secret = this.totpSecret) {
    if (!secret) {
      throw new Error('TOTP secret not configured. Please set ANGELONE_TOTP_SECRET environment variable.');
    }
    
    try {
      return authenticator.generate(secret);
    } catch (error) {
      throw new Error(`TOTP generation failed: ${error.message}`);
    }
  }

  /**
   * Get standard headers for Angel One API requests
   */
  getStandardHeaders(includeAuth = false) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': this.clientLocalIP,
      'X-ClientPublicIP': this.clientPublicIP,
      'X-MACAddress': this.macAddress,
      'X-PrivateKey': this.apiKey
    };

    if (includeAuth && this.tokens.jwtToken) {
      headers['Authorization'] = `Bearer ${this.tokens.jwtToken}`;
    }

    return headers;
  }

  /**
   * Login to Angel One Smart API
   */
  async login(totpCode = null) {
    try {
      // Ensure network info is initialized
      if (!this.clientPublicIP || this.clientPublicIP === null) {
        console.log('🔄 Initializing network configuration...');
        await this.initializeNetworkInfo();
      }

      // Generate TOTP if not provided
      if (!totpCode) {
        totpCode = this.generateTOTP();
        console.log('Generated TOTP code from secret');
      }

      if (!totpCode || totpCode.length !== 6) {
        throw new Error('Valid 6-digit TOTP code is required');
      }

      const loginData = {
        clientcode: this.clientCode,
        password: this.password,
        totp: totpCode
      };

      console.log('Angel One login request:', { 
        ...loginData, 
        password: '***', 
        totp: '***' 
      });

      const response = await axios.post(
        `${this.baseURL}${this.endpoints.login}`,
        loginData,
        {
          headers: this.getStandardHeaders(),
          timeout: 30000 // 30 second timeout
        }
      );

      if (!response.data || !response.data.status) {
        throw new Error(`Login failed: ${response.data?.message || response.data?.errorMessage || 'Unknown error'}`);
      }

      // Store tokens with expiration (Angel One tokens last ~28 hours)
      const tokenData = response.data.data;
      this.tokens = {
        jwtToken: tokenData.jwtToken,
        refreshToken: tokenData.refreshToken,
        feedToken: tokenData.feedToken,
        expiresAt: new Date(Date.now() + (27 * 60 * 60 * 1000)) // 27 hours from now
      };

      console.log('Angel One login successful');
      return {
        success: true,
        tokens: {
          jwtToken: this.tokens.jwtToken,
          refreshToken: this.tokens.refreshToken,
          feedToken: this.tokens.feedToken
        },
        expiresAt: this.tokens.expiresAt
      };

    } catch (error) {
      console.error('Angel One login error:', error.message);
      
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          throw new Error(`Invalid request: ${data?.message || 'Bad request parameters'}`);
        } else if (status === 401) {
          throw new Error(`Authentication failed: ${data?.message || 'Invalid credentials or TOTP'}`);
        } else if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (status >= 500) {
          throw new Error(`Angel One server error: ${data?.message || 'Internal server error'}`);
        }
      }
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to Angel One servers. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  /**
   * Refresh JWT token using refresh token
   */
  async refreshToken() {
    if (!this.tokens.refreshToken) {
      throw new Error('No refresh token available. Please login first.');
    }

    try {
      const response = await axios.post(
        `${this.baseURL}${this.endpoints.generateToken}`,
        {
          refreshToken: this.tokens.refreshToken
        },
        {
          headers: this.getStandardHeaders(),
          timeout: 30000
        }
      );

      if (!response.data || !response.data.status) {
        throw new Error(`Token refresh failed: ${response.data?.message || 'Unknown error'}`);
      }

      // Update JWT token and extend expiration
      const tokenData = response.data.data;
      this.tokens.jwtToken = tokenData.jwtToken;
      this.tokens.expiresAt = new Date(Date.now() + (27 * 60 * 60 * 1000));

      console.log('JWT token refreshed successfully');
      return {
        success: true,
        jwtToken: this.tokens.jwtToken,
        expiresAt: this.tokens.expiresAt
      };

    } catch (error) {
      console.error('Token refresh error:', error.message);
      
      // If refresh fails, clear tokens to force re-login
      this.clearTokens();
      
      throw new Error(`Token refresh failed: ${error.message}. Please login again.`);
    }
  }

  /**
   * Check if JWT token is valid and not expired
   */
  isTokenValid() {
    if (!this.tokens.jwtToken || !this.tokens.expiresAt) {
      return false;
    }
    
    // Check if token expires in next 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + (5 * 60 * 1000));
    return this.tokens.expiresAt > fiveMinutesFromNow;
  }

  /**
   * Ensure valid authentication (login or refresh as needed)
   */
  async ensureAuthenticated() {
    if (this.isTokenValid()) {
      return this.tokens;
    }

    if (this.tokens.refreshToken) {
      try {
        await this.refreshToken();
        return this.tokens;
      } catch (error) {
        console.warn('Token refresh failed, attempting fresh login:', error.message);
      }
    }

    // Fresh login required
    await this.login();
    return this.tokens;
  }

  /**
   * Get current tokens (with auto-refresh if needed)
   */
  async getTokens() {
    await this.ensureAuthenticated();
    return {
      jwtToken: this.tokens.jwtToken,
      refreshToken: this.tokens.refreshToken,
      feedToken: this.tokens.feedToken,
      expiresAt: this.tokens.expiresAt
    };
  }

  /**
   * Get authenticated headers for API requests
   */
  async getAuthenticatedHeaders() {
    await this.ensureAuthenticated();
    return this.getStandardHeaders(true);
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest(method, endpoint, data = null, customHeaders = {}) {
    const headers = await this.getAuthenticatedHeaders();
    
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: { ...headers, ...customHeaders },
      timeout: 30000
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      // If unauthorized, try to refresh token and retry once
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        
        try {
          await this.refreshToken();
          config.headers = await this.getAuthenticatedHeaders();
          const retryResponse = await axios(config);
          return retryResponse.data;
        } catch (refreshError) {
          console.error('Token refresh and retry failed:', refreshError.message);
          throw error;
        }
      }
      
      throw error;
    }
  }

  /**
   * Logout from Angel One
   */
  async logout() {
    if (!this.tokens.jwtToken) {
      console.log('No active session to logout');
      return { success: true };
    }

    try {
      await this.makeAuthenticatedRequest('POST', this.endpoints.logout, {
        clientcode: this.clientCode
      });
      
      console.log('Logged out successfully');
    } catch (error) {
      console.warn('Logout request failed:', error.message);
    } finally {
      this.clearTokens();
    }

    return { success: true };
  }

  /**
   * Clear stored tokens
   */
  clearTokens() {
    this.tokens = {
      jwtToken: null,
      refreshToken: null,
      feedToken: null,
      expiresAt: null
    };
  }

  /**
   * Get token status
   */
  getTokenStatus() {
    return {
      hasTokens: !!this.tokens.jwtToken,
      isValid: this.isTokenValid(),
      expiresAt: this.tokens.expiresAt,
      timeToExpiry: this.tokens.expiresAt ? 
        Math.max(0, this.tokens.expiresAt.getTime() - Date.now()) : 0
    };
  }
}

// Export singleton instance
const angelOneAuth = new AngelOneAuthService();

module.exports = {
  AngelOneAuthService,
  angelOneAuth
};

