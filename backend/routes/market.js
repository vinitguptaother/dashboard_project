const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const MarketData = require('../models/MarketData');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Cache duration in seconds
const CACHE_DURATION = 60; // 1 minute

// Helper function to get cached data
const getCachedData = async (redis, key) => {
  if (!redis) return null;
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

// Helper function to set cached data
const setCachedData = async (redis, key, data, ttl = CACHE_DURATION) => {
  if (!redis) return;
  try {
    await redis.setEx(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

// @route   GET /api/market/indices
// @desc    Get major Indian indices (NIFTY, SENSEX, BANKNIFTY)
// @access  Public
router.get('/indices', optionalAuth, async (req, res) => {
  try {
    const redis = req.app.locals.redis;
    const cacheKey = 'market:indices';
    
    // Try to get from cache first
    let cachedData = await getCachedData(redis, cacheKey);
    if (cachedData) {
      return res.json({
        status: 'success',
        data: cachedData,
        cached: true
      });
    }

    // Fetch from Yahoo Finance
    const symbols = ['^NSEI', '^BSESN', '^NSEBANK']; // NIFTY, SENSEX, BANKNIFTY
    const promises = symbols.map(symbol => 
      axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`)
        .catch(err => ({ error: err.message, symbol }))
    );

    const responses = await Promise.all(promises);
    const indices = {};

    responses.forEach((response, index) => {
      const symbol = symbols[index];
      if (response.error) {
        console.error(`Error fetching ${symbol}:`, response.error);
        return;
      }

      try {
        const result = response.data.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators.quote[0];
        
        const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1];
        const previousClose = meta.previousClose;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;

        const indexName = symbol === '^NSEI' ? 'NIFTY' : 
                         symbol === '^BSESN' ? 'SENSEX' : 'BANKNIFTY';

        indices[indexName] = {
          symbol: indexName,
          price: parseFloat(currentPrice.toFixed(2)),
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          volume: meta.regularMarketVolume || 0,
          dayHigh: meta.regularMarketDayHigh,
          dayLow: meta.regularMarketDayLow,
          previousClose: previousClose,
          timestamp: new Date().toISOString()
        };

        // Save to database
        MarketData.findOneAndUpdate(
          { symbol: indexName },
          {
            symbol: indexName,
            exchange: 'INDEX',
            price: currentPrice,
            change: change,
            changePercent: changePercent,
            volume: meta.regularMarketVolume || 0,
            dayHigh: meta.regularMarketDayHigh,
            dayLow: meta.regularMarketDayLow,
            previousClose: previousClose,
            lastUpdated: new Date(),
            source: 'yahoo_finance'
          },
          { upsert: true, new: true }
        ).catch(err => console.error('DB save error:', err));

      } catch (parseError) {
        console.error(`Error parsing data for ${symbol}:`, parseError);
      }
    });

    // Cache the result
    await setCachedData(redis, cacheKey, indices);

    res.json({
      status: 'success',
      data: indices,
      cached: false
    });

  } catch (error) {
    console.error('Market indices error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch market indices'
    });
  }
});

// @route   GET /api/market/stock/:symbol
// @desc    Get individual stock data
// @access  Public
router.get('/stock/:symbol', optionalAuth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const redis = req.app.locals.redis;
    const cacheKey = `market:stock:${symbol.toUpperCase()}`;
    
    // Try cache first
    let cachedData = await getCachedData(redis, cacheKey);
    if (cachedData) {
      return res.json({
        status: 'success',
        data: cachedData,
        cached: true
      });
    }

    // Add .NS for NSE stocks if not present
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`
    );

    const result = response.data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators.quote[0];
    
    const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1];
    const previousClose = meta.previousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    const stockData = {
      symbol: symbol.toUpperCase(),
      price: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: meta.regularMarketVolume || 0,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      previousClose: previousClose,
      marketCap: meta.marketCap,
      timestamp: new Date().toISOString()
    };

    // Save to database
    MarketData.findOneAndUpdate(
      { symbol: symbol.toUpperCase() },
      {
        ...stockData,
        exchange: 'NSE',
        lastUpdated: new Date(),
        source: 'yahoo_finance'
      },
      { upsert: true, new: true }
    ).catch(err => console.error('DB save error:', err));

    // Cache the result
    await setCachedData(redis, cacheKey, stockData);

    res.json({
      status: 'success',
      data: stockData,
      cached: false
    });

  } catch (error) {
    console.error('Stock data error:', error);
    
    // Try to get from database as fallback
    try {
      const dbData = await MarketData.getLatest(req.params.symbol);
      if (dbData) {
        return res.json({
          status: 'success',
          data: {
            symbol: dbData.symbol,
            price: dbData.price,
            change: dbData.change,
            changePercent: dbData.changePercent,
            volume: dbData.volume,
            dayHigh: dbData.dayHigh,
            dayLow: dbData.dayLow,
            previousClose: dbData.previousClose,
            timestamp: dbData.lastUpdated.toISOString()
          },
          cached: false,
          source: 'database'
        });
      }
    } catch (dbError) {
      console.error('Database fallback error:', dbError);
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch stock data'
    });
  }
});

// @route   POST /api/market/stocks/batch
// @desc    Get multiple stocks data
// @access  Public
router.post('/stocks/batch', [
  optionalAuth,
  body('symbols').isArray().withMessage('Symbols must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { symbols } = req.body;
    const redis = req.app.locals.redis;
    
    if (symbols.length > 50) {
      return res.status(400).json({
        status: 'error',
        message: 'Maximum 50 symbols allowed per request'
      });
    }

    const results = {};
    const uncachedSymbols = [];

    // Check cache for each symbol
    for (const symbol of symbols) {
      const cacheKey = `market:stock:${symbol.toUpperCase()}`;
      const cachedData = await getCachedData(redis, cacheKey);
      
      if (cachedData) {
        results[symbol.toUpperCase()] = {
          status: 'success',
          data: cachedData,
          cached: true
        };
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    // Fetch uncached symbols
    if (uncachedSymbols.length > 0) {
      const promises = uncachedSymbols.map(symbol => {
        const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
        return axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`)
          .then(response => ({ symbol, response }))
          .catch(error => ({ symbol, error: error.message }));
      });

      const responses = await Promise.all(promises);

      for (const item of responses) {
        const { symbol, response, error } = item;
        
        if (error) {
          results[symbol.toUpperCase()] = {
            status: 'error',
            message: error
          };
          continue;
        }

        try {
          const result = response.data.chart.result[0];
          const meta = result.meta;
          const quote = result.indicators.quote[0];
          
          const currentPrice = meta.regularMarketPrice || quote.close[quote.close.length - 1];
          const previousClose = meta.previousClose;
          const change = currentPrice - previousClose;
          const changePercent = (change / previousClose) * 100;

          const stockData = {
            symbol: symbol.toUpperCase(),
            price: parseFloat(currentPrice.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            volume: meta.regularMarketVolume || 0,
            dayHigh: meta.regularMarketDayHigh,
            dayLow: meta.regularMarketDayLow,
            previousClose: previousClose,
            timestamp: new Date().toISOString()
          };

          results[symbol.toUpperCase()] = {
            status: 'success',
            data: stockData,
            cached: false
          };

          // Cache the result
          const cacheKey = `market:stock:${symbol.toUpperCase()}`;
          await setCachedData(redis, cacheKey, stockData);

          // Save to database
          MarketData.findOneAndUpdate(
            { symbol: symbol.toUpperCase() },
            {
              ...stockData,
              exchange: 'NSE',
              lastUpdated: new Date(),
              source: 'yahoo_finance'
            },
            { upsert: true, new: true }
          ).catch(err => console.error('DB save error:', err));

        } catch (parseError) {
          results[symbol.toUpperCase()] = {
            status: 'error',
            message: 'Failed to parse stock data'
          };
        }
      }
    }

    res.json({
      status: 'success',
      data: { results }
    });

  } catch (error) {
    console.error('Batch stocks error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch stocks data'
    });
  }
});

// @route   GET /api/market/search/:query
// @desc    Search for stocks
// @access  Public
router.get('/search/:query', optionalAuth, async (req, res) => {
  try {
    const { query } = req.params;
    
    if (query.length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Query must be at least 2 characters long'
      });
    }

    // Search in database first
    const dbResults = await MarketData.find({
      $or: [
        { symbol: { $regex: query, $options: 'i' } },
        { sector: { $regex: query, $options: 'i' } },
        { industry: { $regex: query, $options: 'i' } }
      ],
      isActive: true
    })
    .limit(20)
    .sort({ lastUpdated: -1 });

    const results = dbResults.map(stock => ({
      symbol: stock.symbol,
      price: stock.price,
      change: stock.change,
      changePercent: stock.changePercent,
      sector: stock.sector,
      industry: stock.industry,
      lastUpdated: stock.lastUpdated
    }));

    res.json({
      status: 'success',
      data: { results },
      count: results.length
    });

  } catch (error) {
    console.error('Stock search error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search stocks'
    });
  }
});

// @route   GET /api/market/historical/:symbol
// @desc    Get historical data for a stock
// @access  Public
router.get('/historical/:symbol', optionalAuth, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1mo', interval = '1d' } = req.query;
    
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
      {
        params: {
          range: period,
          interval: interval
        }
      }
    );

    const result = response.data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    
    const historicalData = timestamps.map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString(),
      open: quote.open[index],
      high: quote.high[index],
      low: quote.low[index],
      close: quote.close[index],
      volume: quote.volume[index]
    })).filter(item => item.close !== null);

    res.json({
      status: 'success',
      data: {
        symbol: symbol.toUpperCase(),
        period,
        interval,
        data: historicalData
      }
    });

  } catch (error) {
    console.error('Historical data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch historical data'
    });
  }
});

module.exports = router;