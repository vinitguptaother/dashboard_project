const UpstoxClient = require('upstox-js-sdk');
const fs = require('fs');
const path = require('path');

// Path to the token file saved by the OAuth flow
const TOKEN_FILE = path.join(__dirname, 'backend/upstox-token.json');

// ─────────────────────────────────────────────
// Read the best available token:
// 1. From the saved token file (most up-to-date)
// 2. Fall back to process.env
// ─────────────────────────────────────────────
function getBestToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            const stored = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
            if (stored?.access_token) return stored.access_token;
        }
    } catch (e) {
        // file read failed — fall through to env
    }
    return process.env.UPSTOX_ACCESS_TOKEN || null;
}

class UpstoxService {
    constructor() {
        this.client = null;
        this.apiInstance = null;
        this.marketQuoteApi = null;
        this.portfolioApi = null;
        this.orderApi = null;
        this.userApi = null;
        this.historyApi = null;
        this.isInitialized = false;

        // Add caching to reduce API calls
        this.ltpCache = {};
        this.cacheExpiry = {};
        this.CACHE_DURATION_MS = 2000; // Cache for 2 seconds
        this.isRateLimited = false;
        this.rateLimitUntil = null;
    }

    /**
     * Call this after a new token is saved to update the running service
     */
    updateToken(newToken) {
        process.env.UPSTOX_ACCESS_TOKEN = newToken;
        this.isInitialized = false;
        this.ltpCache = {}; // clear stale cache
        this.initializeClient();
    }

    /**
     * Initialize the Upstox client with API credentials
     */
    initializeClient() {
        try {
            // Always pick the freshest token (file > env)
            const token = getBestToken();
            if (!token) {
                console.warn('⚠️  No Upstox access token found — running in demo mode');
                return false;
            }

            // Get default client instance
            this.client = UpstoxClient.ApiClient.instance;

            // Configure OAuth2 authentication
            const OAUTH2 = this.client.authentications['OAUTH2'];
            OAUTH2.accessToken = token;
            // Keep env in sync too
            process.env.UPSTOX_ACCESS_TOKEN = token;

            // Initialize API instances
            this.marketQuoteApi = new UpstoxClient.MarketQuoteApi();
            this.marketQuoteV3Api = new UpstoxClient.MarketQuoteV3Api();
            this.portfolioApi = new UpstoxClient.PortfolioApi();
            this.orderApi = new UpstoxClient.OrderApi();
            this.userApi = new UpstoxClient.UserApi();
            this.historyApi = new UpstoxClient.HistoryApi();
            
            this.isInitialized = true;
            console.log('✅ Upstox client initialized successfully');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Upstox client:', error.message);
            return false;
        }
    }

    /**
     * Check if the client is properly initialized
     */
    checkInitialization() {
        if (!this.isInitialized) {
            throw new Error('Upstox client not initialized. Please check your access token.');
        }
    }

    /**
     * Map of common symbols to Upstox instrument keys
     */
    getInstrumentKeyMap() {
        return {
            'NIFTY': 'NSE_INDEX|Nifty 50',
            'NIFTY 50': 'NSE_INDEX|Nifty 50',
            'SENSEX': 'BSE_INDEX|SENSEX',
            'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
            'BANK NIFTY': 'NSE_INDEX|Nifty Bank',
            'FINNIFTY': 'NSE_INDEX|Nifty Fin Service',
            'RELIANCE': 'NSE_EQ|INE002A01018',
            'INFOSYS': 'NSE_EQ|INE009A01021',
            'INFY': 'NSE_EQ|INE009A01021',
            'TCS': 'NSE_EQ|INE467B01029',
            'HDFCBANK': 'NSE_EQ|INE040A01034',
            'ICICIBANK': 'NSE_EQ|INE090A01021',
            'SBIN': 'NSE_EQ|INE062A01020',
            'BHARTIARTL': 'NSE_EQ|INE397D01024',
            'ITC': 'NSE_EQ|INE154A01025',
            'LT': 'NSE_EQ|INE018A01030',
            'AXISBANK': 'NSE_EQ|INE238A01034',
            'MARUTI': 'NSE_EQ|INE585B01010',
            'HINDUNILVR': 'NSE_EQ|INE030A01027',
            'ASIANPAINT': 'NSE_EQ|INE021A01026'
        };
    }

    /**
     * Get Last Traded Price (LTP) for given instruments
     */
    async getLTP(instruments) {
        // Check if we're in demo mode (no token available at all)
        const token = getBestToken();
        if (!token || token === 'your_access_token_here') {
            console.log('📊 No token — using demo LTP data');
            return this.getDemoLTPData(instruments);
        }

        // Check if we're rate limited
        if (this.isRateLimited && this.rateLimitUntil && Date.now() < this.rateLimitUntil) {
            const waitTime = Math.ceil((this.rateLimitUntil - Date.now()) / 1000);
            console.log(`⏳ Rate limited. Using cached/demo data. Retry in ${waitTime}s`);
            return this.getDemoLTPData(instruments);
        }

        // Convert instruments array to array if needed
        const instrumentArray = Array.isArray(instruments) ? instruments : instruments.split(',').map(s => s.trim());
        
        // Map simple symbols to Upstox instrument keys
        const instrumentKeyMap = this.getInstrumentKeyMap();
        const upstoxInstrumentKeys = instrumentArray.map(symbol => {
            const upperSymbol = symbol.toUpperCase().trim();
            // If it's already a proper instrument key (contains |), use it as-is
            if (upperSymbol.includes('|')) {
                return upperSymbol;
            }
            // Otherwise, map it
            const mappedKey = instrumentKeyMap[upperSymbol];
            if (mappedKey) {
                console.log(`📍 Mapped ${upperSymbol} -> ${mappedKey}`);
                return mappedKey;
            }
            // Fallback: assume it's an NSE equity symbol
            console.log(`⚠️  No mapping for ${upperSymbol}, using NSE_EQ default`);
            return `NSE_EQ|${upperSymbol}`;
        });
        
        const instrumentString = upstoxInstrumentKeys.join(',');

        // Check cache
        const cacheKey = instrumentString;
        const now = Date.now();
        if (this.ltpCache[cacheKey] && this.cacheExpiry[cacheKey] && now < this.cacheExpiry[cacheKey]) {
            console.log('📦 Returning cached LTP data');
            return this.ltpCache[cacheKey];
        }

        // Check if client is initialized
        if (!this.isInitialized) {
            console.log('⚠️  Upstox client not initialized, using demo data');
            return this.getDemoLTPData(instruments);
        }

        try {
            return new Promise((resolve, reject) => {
                this.marketQuoteV3Api.getLtp(
                    { instrumentKey: instrumentString },
                    (error, data, response) => {
                        if (error) {
                            const errorMsg = error.message || error.toString();
                            console.error('❌ Upstox LTP Error:', errorMsg);
                            
                            // Check if rate limited (429 or Too Many Requests)
                            if (errorMsg.includes('429') || errorMsg.includes('Too many requests') || errorMsg.includes('rate limit')) {
                                this.isRateLimited = true;
                                this.rateLimitUntil = Date.now() + (15 * 60 * 1000); // 15 minutes
                                console.log('🚫 RATE LIMITED by Upstox. Waiting 15 minutes before retry.');
                            }
                            
                            resolve(this.getDemoLTPData(instruments));
                        } else {
                            // Success - clear rate limit
                            this.isRateLimited = false;
                            this.rateLimitUntil = null;
                            
                            console.log('✅ Real LTP data fetched from Upstox');
                            console.log('Raw Upstox response:', JSON.stringify(data, null, 2));
                            
                            // Transform the response to use simple symbol keys
                            // Upstox returns: { status: 'success', data: { 'NSE_INDEX|Nifty 50': {...} } }
                            // We need: { status: 'success', data: { 'NIFTY': {...} } }
                            
                            // Create reverse mapping (instrument key -> simple symbol)
                            const reverseMap = {};
                            instrumentArray.forEach((symbol, index) => {
                                reverseMap[upstoxInstrumentKeys[index]] = symbol.toUpperCase();
                            });
                            
                            // Transform the data
                            const transformedData = {};
                            if (data && data.data) {
                                for (const [instrumentKey, value] of Object.entries(data.data)) {
                                    // Upstox returns keys with : instead of | (e.g., "NSE_INDEX:Nifty 50")
                                    // Try both formats for reverse mapping
                                    const keyWithPipe = instrumentKey.replace(':', '|');
                                    const simpleSymbol = reverseMap[instrumentKey] || reverseMap[keyWithPipe] || instrumentKey;
                                    
                                    console.log(`Transforming: ${instrumentKey} -> ${simpleSymbol}`);
                                    console.log('Value:', JSON.stringify(value));
                                    
                                    // Upstox uses camelCase property names
                                    transformedData[simpleSymbol] = {
                                        lastPrice: value.lastPrice || value.last_price,
                                        instrumentToken: value.instrumentToken || value.instrument_token,
                                        volume: value.volume || 0,
                                        ltq: value.ltq || value.last_traded_quantity || 0,
                                        cp: value.cp || value.net_change || 0
                                    };
                                }
                            }
                            
                            console.log('Transformed data:', JSON.stringify(transformedData, null, 2));
                            
                            const result = {
                                status: 'success',
                                data: transformedData
                            };
                            
                            // Cache the transformed result
                            this.ltpCache[cacheKey] = result;
                            this.cacheExpiry[cacheKey] = Date.now() + this.CACHE_DURATION_MS;
                            
                            resolve(result);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error in getLTP:', error);
            return this.getDemoLTPData(instruments);
        }
    }

    /**
     * Get portfolio holdings
     */
    async getPortfolio() {
        if (!this.isInitialized) {
            console.log('📊 Upstox not initialized — returning demo portfolio');
            return this.getDemoPortfolioData();
        }
        try {
            return new Promise((resolve) => {
                this.portfolioApi.getHoldings((error, data) => {
                    if (error) {
                        console.error('Error fetching portfolio:', error.message);
                        resolve(this.getDemoPortfolioData());
                    } else {
                        console.log('✅ Real portfolio data fetched');
                        resolve(data);
                    }
                });
            });
        } catch (error) {
            console.error('Error in getPortfolio:', error);
            return this.getDemoPortfolioData();
        }
    }

    /**
     * Get current trading positions
     */
    async getPositions() {
        if (!this.isInitialized) {
            console.log('📊 Upstox not initialized — returning demo positions');
            return this.getDemoPositionsData();
        }
        try {
            return new Promise((resolve) => {
                this.portfolioApi.getPositions((error, data) => {
                    if (error) {
                        console.error('Error fetching positions:', error.message);
                        resolve(this.getDemoPositionsData());
                    } else {
                        console.log('✅ Real positions data fetched');
                        resolve(data);
                    }
                });
            });
        } catch (error) {
            console.error('Error in getPositions:', error);
            return this.getDemoPositionsData();
        }
    }

    /**
     * Get account funds and margins
     */
    async getFunds() {
        if (!this.isInitialized) {
            console.log('📊 Upstox not initialized — returning demo funds');
            return this.getDemoFundsData();
        }
        try {
            return new Promise((resolve) => {
                this.userApi.getUserFundsAndMargin((error, data) => {
                    if (error) {
                        console.error('Error fetching funds:', error.message);
                        resolve(this.getDemoFundsData());
                    } else {
                        console.log('✅ Real funds data fetched');
                        resolve(data);
                    }
                });
            });
        } catch (error) {
            console.error('Error in getFunds:', error);
            return this.getDemoFundsData();
        }
    }

    /**
     * Get order history
     */
    async getOrders() {
        if (!this.isInitialized) {
            console.log('📊 Upstox not initialized — returning demo orders');
            return this.getDemoOrdersData();
        }
        try {
            return new Promise((resolve) => {
                this.orderApi.getOrderBook((error, data) => {
                    if (error) {
                        console.error('Error fetching orders:', error.message);
                        resolve(this.getDemoOrdersData());
                    } else {
                        console.log('✅ Real orders data fetched');
                        resolve(data);
                    }
                });
            });
        } catch (error) {
            console.error('Error in getOrders:', error);
            return this.getDemoOrdersData();
        }
    }

    /**
     * Place a new order
     */
    async placeOrder(orderData) {
        if (!process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN === 'your_access_token_here') {
            return this.getDemoOrderResult(orderData);
        }

        this.checkInitialization();

        try {
            return new Promise((resolve, reject) => {
                const orderRequest = new UpstoxClient.PlaceOrderRequest();
                
                orderRequest.quantity = orderData.quantity;
                orderRequest.product = orderData.product || 'I';
                orderRequest.validity = orderData.validity || 'DAY';
                orderRequest.price = orderData.price || 0;
                orderRequest.tag = orderData.tag || 'upstox-dashboard';
                orderRequest.instrument_token = orderData.instrument_token;
                orderRequest.order_type = orderData.order_type || 'MARKET';
                orderRequest.transaction_type = orderData.transaction_type;
                orderRequest.disclosed_quantity = orderData.disclosed_quantity || 0;
                orderRequest.trigger_price = orderData.trigger_price || 0;
                orderRequest.is_amo = orderData.is_amo || false;

                this.orderApi.placeOrder(orderRequest, (error, data, response) => {
                    if (error) {
                        console.error('Error placing order:', error);
                        reject(error);
                    } else {
                        resolve(data);
                    }
                });
            });
        } catch (error) {
            console.error('Error in placeOrder:', error);
            throw error;
        }
    }

    /**
     * Get historical candle data for a symbol
     */
    async getHistoricalData(symbol, timeframe) {
        const token = getBestToken();
        if (!token || token === 'your_access_token_here') {
            console.log('📊 No token — using demo historical data');
            return this.getDemoHistoricalData(symbol, timeframe);
        }

        // Check if client is initialized
        if (!this.isInitialized) {
            console.log('⚠️  Upstox client not initialized, using demo historical data');
            return this.getDemoHistoricalData(symbol, timeframe);
        }

        try {
            // Map symbol to instrument key
            const instrumentKeyMap = this.getInstrumentKeyMap();
            const upperSymbol = symbol.toUpperCase().trim();
            const instrumentKey = instrumentKeyMap[upperSymbol] || `NSE_EQ|${upperSymbol}`;

            // Map timeframe to Upstox interval
            const intervalMap = {
                '1D': '1minute',
                '5D': '30minute',
                '1M': 'day',
                '3M': 'day',
                '6M': 'day',
                '1Y': 'day'
            };
            const interval = intervalMap[timeframe] || 'day';

            // Calculate date range
            const toDate = new Date();
            const fromDate = new Date();
            switch (timeframe) {
                case '1D':
                    fromDate.setDate(fromDate.getDate() - 1);
                    break;
                case '5D':
                    fromDate.setDate(fromDate.getDate() - 5);
                    break;
                case '1M':
                    fromDate.setMonth(fromDate.getMonth() - 1);
                    break;
                case '3M':
                    fromDate.setMonth(fromDate.getMonth() - 3);
                    break;
                case '6M':
                    fromDate.setMonth(fromDate.getMonth() - 6);
                    break;
                case '1Y':
                    fromDate.setFullYear(fromDate.getFullYear() - 1);
                    break;
            }

            console.log(`📊 Fetching historical data for ${instrumentKey} (${interval}) from ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);

            return new Promise((resolve, reject) => {
                this.historyApi.getHistoricalCandleData1(
                    instrumentKey,
                    interval,
                    toDate.toISOString().split('T')[0],
                    fromDate.toISOString().split('T')[0],
                    '2.0',
                    (error, data, response) => {
                        if (error) {
                            console.error('❌ Upstox Historical Data Error:', error.message);
                            resolve(this.getDemoHistoricalData(symbol, timeframe));
                        } else {
                            console.log('✅ Real historical data fetched from Upstox');
                            
                            // Transform Upstox candles format to our format
                            const candles = data.data.candles.map(candle => ({
                                time: new Date(candle[0]).getTime(),
                                open: candle[1],
                                high: candle[2],
                                low: candle[3],
                                close: candle[4],
                                volume: candle[5] || 0
                            }));

                            resolve({
                                candles: candles,
                                demo: false,
                                source: 'upstox'
                            });
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error in getHistoricalData:', error);
            return this.getDemoHistoricalData(symbol, timeframe);
        }
    }

    /**
     * Get default instruments from environment
     */
    getDefaultInstruments() {
        const defaultInstruments = process.env.UPSTOX_DEFAULT_INSTRUMENTS;
        if (defaultInstruments) {
            return defaultInstruments.split(',').map(instrument => instrument.trim());
        }
        
        return [
            'NSE_EQ|INE002A01018', // Reliance
            'NSE_EQ|INE009A01021', // Infosys
            'NSE_EQ|INE030A01027'  // HUL
        ];
    }

    // Demo data methods
    getDemoLTPData(instruments) {
        console.log('📊 getDemoLTPData called with:', instruments);
        const instrumentArray = Array.isArray(instruments) ? instruments : instruments.split(',');
        console.log('📋 Instrument array:', instrumentArray);
        const data = {};
        
        instrumentArray.forEach(instrument => {
            const key = instrument.trim();
            const basePrice = Math.random() * 2000 + 100;
            const change = (Math.random() - 0.5) * 10;
            
            console.log(`  Creating demo data for key: "${key}"`);
            data[key] = {
                lastPrice: parseFloat(basePrice.toFixed(2)),
                instrumentToken: Math.floor(Math.random() * 100000).toString(),
                volume: Math.floor(Math.random() * 1000000),
                ltq: Math.floor(Math.random() * 1000),
                cp: parseFloat(change.toFixed(2))
            };
        });
        
        console.log('✅ Returning demo data with keys:', Object.keys(data));
        console.log('✅ Demo data:', JSON.stringify(data, null, 2));
        
        return {
            status: 'success',
            data: data
        };
    }

    getDemoPortfolioData() {
        return {
            status: 'success',
            data: [
                {
                    instrument_token: 'NSE_EQ|INE002A01018',
                    quantity: 10,
                    product: 'CNC',
                    average_price: 1350.50,
                    last_price: 1407.4,
                    pnl: 568.50,
                    day_change: 15.30,
                    day_change_percentage: 1.1,
                    symbol: 'RELIANCE'
                },
                {
                    instrument_token: 'NSE_EQ|INE009A01021',
                    quantity: 5,
                    product: 'CNC',
                    average_price: 1520.00,
                    last_price: 1540.2,
                    pnl: 101.00,
                    day_change: 8.50,
                    day_change_percentage: 0.55,
                    symbol: 'INFOSYS'
                },
                {
                    instrument_token: 'NSE_EQ|INE030A01027',
                    quantity: 3,
                    product: 'CNC',
                    average_price: 2500.00,
                    last_price: 2559.6,
                    pnl: 178.8,
                    day_change: 9.60,
                    day_change_percentage: 0.38,
                    symbol: 'HINDUNILVR'
                }
            ]
        };
    }

    getDemoPositionsData() {
        return {
            status: 'success',
            data: [
                {
                    instrument_token: 'NSE_EQ|INE030A01027',
                    quantity: 2,
                    product: 'MIS',
                    average_price: 2550.00,
                    last_price: 2559.6,
                    pnl: 19.20,
                    day_change: 9.60,
                    day_change_percentage: 0.38,
                    symbol: 'HINDUNILVR'
                }
            ]
        };
    }

    getDemoFundsData() {
        return {
            status: 'success',
            data: {
                equity: {
                    enabled: true,
                    net: 45000.75,
                    available: {
                        adhoc_margin: 0,
                        cash: 45000.75,
                        opening_balance: 50000.00,
                        live_balance: 45000.75,
                        collateral: 0,
                        intraday_payin: 0
                    },
                    utilised: {
                        debits: 4999.25,
                        span: 2500.00,
                        option_premium: 0,
                        holding_sales: 0,
                        exposure: 1200.00,
                        turnover: 0
                    }
                }
            }
        };
    }

    getDemoOrdersData() {
        return {
            status: 'success',
            data: [
                {
                    order_id: 'UPX_ORD_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    instrument_token: 'NSE_EQ|INE002A01018',
                    symbol: 'RELIANCE',
                    quantity: 10,
                    price: 1400.00,
                    order_type: 'LIMIT',
                    transaction_type: 'BUY',
                    status: 'COMPLETE',
                    order_timestamp: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    order_id: 'UPX_ORD_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    instrument_token: 'NSE_EQ|INE009A01021',
                    symbol: 'INFOSYS',
                    quantity: 5,
                    price: 0,
                    order_type: 'MARKET',
                    transaction_type: 'SELL',
                    status: 'PENDING',
                    order_timestamp: new Date(Date.now() - 1800000).toISOString()
                }
            ]
        };
    }

    getDemoOrderResult(orderData) {
        return {
            status: 'success',
            data: {
                order_id: 'UPX_ORD_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                message: 'Order placed successfully (Demo Mode)',
                timestamp: new Date().toISOString()
            }
        };
    }

    getDemoHistoricalData(symbol, timeframe) {
        console.log(`📋 Generating demo historical data for ${symbol} (${timeframe})`);
        
        // Determine number of candles based on timeframe
        const candleCount = {
            '1D': 390,   // 390 minutes in trading day
            '5D': 65,    // 13 30-min candles per day * 5 days
            '1M': 22,    // ~22 trading days
            '3M': 65,    // ~65 trading days
            '6M': 130,   // ~130 trading days
            '1Y': 252    // ~252 trading days
        }[timeframe] || 100;

        const candles = [];
        const basePrice = 1000 + Math.random() * 1000;
        let currentPrice = basePrice;
        const now = Date.now();
        
        // Time intervals for each timeframe
        const intervalMs = {
            '1D': 60 * 1000,        // 1 minute
            '5D': 30 * 60 * 1000,   // 30 minutes
            '1M': 24 * 60 * 60 * 1000,  // 1 day
            '3M': 24 * 60 * 60 * 1000,
            '6M': 24 * 60 * 60 * 1000,
            '1Y': 24 * 60 * 60 * 1000
        }[timeframe] || 24 * 60 * 60 * 1000;

        for (let i = candleCount; i > 0; i--) {
            const time = now - (i * intervalMs);
            const volatility = basePrice * 0.02; // 2% volatility
            
            const open = currentPrice;
            const change = (Math.random() - 0.5) * volatility;
            const close = open + change;
            const high = Math.max(open, close) + Math.random() * volatility * 0.5;
            const low = Math.min(open, close) - Math.random() * volatility * 0.5;
            const volume = Math.floor(Math.random() * 1000000) + 100000;

            candles.push({
                time: time,
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(close.toFixed(2)),
                volume: volume
            });

            currentPrice = close;
        }

        return {
            candles: candles,
            demo: true,
            source: 'demo'
        };
    }
}

// Create singleton instance
const upstoxService = new UpstoxService();

/**
 * Initialize the Upstox client
 */
function initializeUpstoxClient() {
    return upstoxService.initializeClient();
}

module.exports = {
    upstoxService,
    initializeUpstoxClient
};