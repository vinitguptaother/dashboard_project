const { upstoxService } = require('../../../services/upstoxService');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
    }

    try {
        const { symbol, timeframe } = req.query;
        
        // Validate required parameters
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'symbol parameter is required',
                timestamp: new Date().toISOString()
            });
        }

        if (!timeframe) {
            return res.status(400).json({
                success: false,
                error: 'timeframe parameter is required (1D, 5D, 1M, 3M, 6M, 1Y)',
                timestamp: new Date().toISOString()
            });
        }

        // Validate timeframe
        const validTimeframes = ['1D', '5D', '1M', '3M', '6M', '1Y'];
        if (!validTimeframes.includes(timeframe)) {
            return res.status(400).json({
                success: false,
                error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}`,
                timestamp: new Date().toISOString()
            });
        }

        // Check if we're in demo mode or have access token
        if (!process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_ACCESS_TOKEN === 'your_access_token_here') {
            console.log('🎯 Using demo historical data for:', symbol, timeframe);
            const demoCandles = generateDemoCandles(symbol, timeframe);
            
            return res.status(200).json({
                success: true,
                data: {
                    candles: demoCandles
                },
                symbol,
                timeframe,
                timestamp: new Date().toISOString(),
                demo: true
            });
        }

        // Try to use real Upstox API
        try {
            const historicalData = await getUpstoxHistoricalData(symbol, timeframe);
            
            return res.status(200).json({
                success: true,
                data: {
                    candles: historicalData
                },
                symbol,
                timeframe,
                timestamp: new Date().toISOString(),
                source: 'upstox'
            });
            
        } catch (upstoxError) {
            console.warn('⚠️ Upstox API failed, falling back to demo data:', upstoxError.message);
            
            // Fall back to demo data
            const demoCandles = generateDemoCandles(symbol, timeframe);
            
            return res.status(200).json({
                success: true,
                data: {
                    candles: demoCandles
                },
                symbol,
                timeframe,
                timestamp: new Date().toISOString(),
                demo: true,
                fallbackReason: upstoxError.message
            });
        }
        
    } catch (error) {
        console.error('Error in historical data API:', error);
        
        // Emergency fallback
        const { symbol = 'UNKNOWN', timeframe = '1D' } = req.query;
        const demoCandles = generateDemoCandles(symbol, timeframe);
        
        res.status(200).json({
            success: true,
            data: {
                candles: demoCandles
            },
            symbol,
            timeframe,
            timestamp: new Date().toISOString(),
            demo: true,
            fallback: true,
            error: error.message
        });
    }
}

/**
 * Get historical data from Upstox API
 */
async function getUpstoxHistoricalData(symbol, timeframe) {
    // Check if upstoxService is initialized
    if (!upstoxService.isInitialized) {
        upstoxService.initializeClient();
    }

    // Convert symbol to instrument key if needed
    let instrumentKey = symbol;
    if (!symbol.includes('|')) {
        // If symbol is like "RELIANCE", convert to instrument key format
        // This is a simplified mapping - in production you'd have a proper symbol-to-instrument mapping
        const symbolMappings = {
            'RELIANCE': 'NSE_EQ|INE002A01018',
            'INFY': 'NSE_EQ|INE009A01021',
            'TCS': 'NSE_EQ|INE467B01029',
            'HDFCBANK': 'NSE_EQ|INE040A01034',
            'ICICIBANK': 'NSE_EQ|INE090A01021',
            'HINDUNILVR': 'NSE_EQ|INE030A01027',
            'ITC': 'NSE_EQ|INE154A01025',
            'KOTAKBANK': 'NSE_EQ|INE237A01028',
            'LT': 'NSE_EQ|INE018A01030',
            'AXISBANK': 'NSE_EQ|INE238A01034'
        };
        
        instrumentKey = symbolMappings[symbol.toUpperCase()] || `NSE_EQ|${symbol}`;
    }

    // Map timeframe to Upstox interval and calculate from/to dates
    const { interval, fromDate, toDate } = getTimeframeParams(timeframe);

    return new Promise((resolve, reject) => {
        upstoxService.historyApi.getHistoricalCandleData1(
            instrumentKey,
            interval,
            toDate,
            fromDate,
            (error, data, response) => {
                if (error) {
                    console.error('Upstox historical API error:', error);
                    reject(new Error(`Upstox API error: ${error.message || 'Unknown error'}`));
                } else {
                    // Transform Upstox response to our format
                    const candles = transformUpstoxCandles(data);
                    resolve(candles);
                }
            }
        );
    });
}

/**
 * Transform Upstox candle data to our format
 */
function transformUpstoxCandles(upstoxData) {
    if (!upstoxData || !upstoxData.data || !upstoxData.data.candles) {
        return [];
    }

    return upstoxData.data.candles.map(candle => ({
        time: new Date(candle[0]).getTime(), // Convert to timestamp
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseInt(candle[5]) || 0
    }));
}

/**
 * Get timeframe parameters for Upstox API
 */
function getTimeframeParams(timeframe) {
    const now = new Date();
    const toDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    let fromDate;
    let interval;

    switch (timeframe) {
        case '1D':
            interval = '1minute';
            fromDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        case '5D':
            interval = '30minute';
            fromDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        case '1M':
            interval = '1day';
            fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        case '3M':
            interval = '1day';
            fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        case '6M':
            interval = '1day';
            fromDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        case '1Y':
            interval = '1day';
            fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
        default:
            interval = '1day';
            fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    return { interval, fromDate, toDate };
}

/**
 * Generate realistic demo candle data
 */
function generateDemoCandles(symbol, timeframe) {
    const candles = [];
    const now = Date.now();
    
    // Determine number of candles and interval based on timeframe
    let numberOfCandles, intervalMs, startPrice;
    
    // Set realistic base price for common symbols
    const basePrices = {
        'RELIANCE': 2400,
        'INFY': 1500,
        'TCS': 3200,
        'HDFCBANK': 1600,
        'ICICIBANK': 900,
        'HINDUNILVR': 2500,
        'ITC': 450,
        'KOTAKBANK': 1800,
        'LT': 2800,
        'AXISBANK': 1000
    };
    
    startPrice = basePrices[symbol.toUpperCase()] || 1000 + Math.random() * 1000;
    
    switch (timeframe) {
        case '1D':
            numberOfCandles = 390; // 1 minute intervals for 6.5 hour trading day
            intervalMs = 60 * 1000; // 1 minute
            break;
        case '5D':
            numberOfCandles = 65; // 30 minute intervals for 5 days
            intervalMs = 30 * 60 * 1000; // 30 minutes
            break;
        case '1M':
            numberOfCandles = 30; // Daily candles for 1 month
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
            break;
        case '3M':
            numberOfCandles = 90; // Daily candles for 3 months
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
            break;
        case '6M':
            numberOfCandles = 180; // Daily candles for 6 months
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
            break;
        case '1Y':
            numberOfCandles = 365; // Daily candles for 1 year
            intervalMs = 24 * 60 * 60 * 1000; // 1 day
            break;
        default:
            numberOfCandles = 30;
            intervalMs = 24 * 60 * 60 * 1000;
    }
    
    let currentPrice = startPrice;
    
    for (let i = numberOfCandles - 1; i >= 0; i--) {
        const time = now - (i * intervalMs);
        
        // Generate realistic OHLC data
        const volatility = 0.02; // 2% volatility
        const trend = (Math.random() - 0.5) * 0.001; // Small random trend
        
        const open = currentPrice;
        const changePercent = (Math.random() - 0.5) * volatility + trend;
        const close = open * (1 + changePercent);
        
        // High and low should encompass open and close
        const maxPrice = Math.max(open, close);
        const minPrice = Math.min(open, close);
        
        const high = maxPrice * (1 + Math.random() * 0.005); // Up to 0.5% above max
        const low = minPrice * (1 - Math.random() * 0.005);  // Up to 0.5% below min
        
        // Volume varies based on timeframe
        const baseVolume = timeframe === '1D' ? 10000 : timeframe.includes('D') ? 500000 : 1000000;
        const volume = Math.floor(baseVolume * (0.5 + Math.random()));
        
        candles.push({
            time: time,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: volume
        });
        
        currentPrice = close; // Next candle starts where this one ended
    }
    
    return candles.sort((a, b) => a.time - b.time); // Sort by time ascending
}