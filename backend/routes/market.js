const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const MarketData = require('../models/MarketData');
const { optionalAuth } = require('../middleware/auth');

const aiService = require('../services/aiService');
const trackAPI = require('../utils/trackAPI');

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
// @desc    Search for stocks — two-source approach:
//          1. Instruments collection (fast, has instrument_key for Upstox LTP)
//          2. Yahoo Finance autocomplete (catches ALL NSE stocks, no auth needed)
//          Results merged and deduplicated, enriched with cached prices.
// @access  Public
router.get('/search/:query', optionalAuth, async (req, res) => {
  try {
    const { query } = req.params;
    const Instrument = require('../models/Instrument');
    const redis = req.app.locals.redis;

    if (!query || query.trim().length < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Query must be at least 1 character long'
      });
    }

    const q = query.trim();
    const cacheKey = `market:search:${q.toLowerCase()}`;

    // Try Redis cache first (5 min TTL)
    const cached = await getCachedData(redis, cacheKey);
    if (cached) {
      return res.json({ status: 'success', data: { results: cached }, count: cached.length, cached: true });
    }

    // ── Source 1: Instruments collection (fast, has instrument_key) ──────────
    const dbInstruments = await Instrument.find({
      exchange: 'NSE',
      $or: [
        { symbol: { $regex: `^${q}`, $options: 'i' } },
        { name:   { $regex: q,       $options: 'i' } },
      ],
    })
      .limit(20)
      .select('symbol name exchange token isin')
      .lean();

    // Build a map so Yahoo results can reuse instrument_key if we have it
    const dbMap = {};
    dbInstruments.forEach(i => { dbMap[i.symbol] = i; });

    // ── Source 2: Yahoo Finance autocomplete (all NSE stocks, no auth) ────────
    let yahooResults = [];
    try {
      const yahooResp = await axios.get(
        'https://query2.finance.yahoo.com/v1/finance/search',
        {
          params: { q, lang: 'en-US', region: 'US', quotesCount: 15, newsCount: 0 },
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)' },
          timeout: 5000,
        }
      );
      const quotes = (yahooResp.data?.quotes || []);
      yahooResults = quotes
        .filter(item => item.exchange === 'NSI' && item.quoteType === 'EQUITY')
        .map(item => {
          const sym = item.symbol.replace('.NS', '').toUpperCase();
          const db  = dbMap[sym];
          return {
            symbol:        sym,
            name:          item.longname || item.shortname || sym,
            exchange:      'NSE',
            instrumentKey: db?.token || null,
            isin:          db?.isin  || null,
            sector:        item.sector   || null,
            industry:      item.industry || null,
            price:         null,
            change:        null,
            changePercent: null,
            volume:        null,
            lastUpdated:   null,
          };
        });
    } catch (yahooErr) {
      console.warn('⚠️  Yahoo Finance search fallback failed:', yahooErr.message);
    }

    // ── Merge: DB results first (have instrument_key), then Yahoo extras ──────
    const seenSymbols = new Set();
    const results = [];

    dbInstruments.forEach(inst => {
      seenSymbols.add(inst.symbol);
      results.push({
        symbol:        inst.symbol,
        name:          inst.name || inst.symbol,
        exchange:      inst.exchange,
        instrumentKey: inst.token || null,
        isin:          inst.isin  || null,
        price: null, change: null, changePercent: null, volume: null, lastUpdated: null,
      });
    });

    yahooResults.forEach(r => {
      if (!seenSymbols.has(r.symbol)) {
        seenSymbols.add(r.symbol);
        results.push(r);
      }
    });

    // ── Enrich with any cached live prices ────────────────────────────────────
    if (results.length > 0) {
      const symbols = results.map(r => r.symbol);
      const cachedPrices = await MarketData.find({ symbol: { $in: symbols } })
        .select('symbol price change changePercent volume dayHigh dayLow lastUpdated')
        .lean();
      const priceMap = {};
      cachedPrices.forEach(p => { priceMap[p.symbol] = p; });
      results.forEach(r => {
        if (priceMap[r.symbol]) {
          r.price         = priceMap[r.symbol].price;
          r.change        = priceMap[r.symbol].change;
          r.changePercent = priceMap[r.symbol].changePercent;
          r.volume        = priceMap[r.symbol].volume;
          r.lastUpdated   = priceMap[r.symbol].lastUpdated;
        }
      });
    }

    // Sort: symbol prefix matches first
    const q_upper = q.toUpperCase();
    results.sort((a, b) => {
      const aStarts = a.symbol.startsWith(q_upper) ? 0 : 1;
      const bStarts = b.symbol.startsWith(q_upper) ? 0 : 1;
      return aStarts - bStarts;
    });

    const finalResults = results.slice(0, 20);
    await setCachedData(redis, cacheKey, finalResults, 300); // 5-min cache

    res.json({
      status: 'success',
      data: { results: finalResults },
      count: finalResults.length
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/market/stock-analysis/:symbol
// Complete stock analysis: price, fundamentals, technicals, news, AI recommendation
// This is the single endpoint that powers the Stock Search tab
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stock-analysis/:symbol', optionalAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().replace('.NS', '');
  const yahooSymbol = `${symbol}.NS`;

  try {
    // ── 1. Fetch price from Yahoo v8 chart + sector from Yahoo search ────────
    //    (Yahoo v10 quoteSummary is now blocked with 401)
    let fundamentals = {};
    let priceData = {};
    let sectorInfo = { sector: 'N/A', industry: 'N/A' };

    // 1a. Price data from v8 chart API (always works)
    try {
      const chartResp = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
        {
          params: { range: '1d', interval: '5m' },
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)' },
          timeout: 10000,
        }
      );
      const meta = chartResp.data?.chart?.result?.[0]?.meta;
      if (meta) {
        const currentPrice = meta.regularMarketPrice || 0;
        const prevClose = meta.previousClose || meta.chartPreviousClose || 0;
        priceData = {
          currentPrice,
          change: parseFloat((currentPrice - prevClose).toFixed(2)),
          changePercent: prevClose ? parseFloat((((currentPrice - prevClose) / prevClose) * 100).toFixed(2)) : 0,
          dayHigh: meta.regularMarketDayHigh || 0,
          dayLow: meta.regularMarketDayLow || 0,
          previousClose: prevClose,
          open: 0,
          volume: meta.regularMarketVolume || 0,
          avgVolume: 0,
          marketCap: 0,
          marketCapFormatted: 'N/A',
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
          companyName: meta.longName || meta.shortName || symbol,
          sector: 'N/A',
          industry: 'N/A',
          exchange: meta.fullExchangeName || 'NSE',
        };
      }
    } catch (chartErr) {
      console.warn(`⚠️ Yahoo v8 chart failed for ${symbol}:`, chartErr.message);
    }

    // 1b. Sector/industry from Yahoo search API
    try {
      const searchResp = await axios.get(
        'https://query2.finance.yahoo.com/v1/finance/search',
        {
          params: { q: symbol, quotesCount: 5, newsCount: 0 },
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)' },
          timeout: 5000,
        }
      );
      const match = (searchResp.data?.quotes || []).find(
        q => q.symbol === yahooSymbol || q.symbol === `${symbol}.BO`
      );
      if (match) {
        sectorInfo.sector = match.sectorDisp || match.sector || 'N/A';
        sectorInfo.industry = match.industryDisp || match.industry || 'N/A';
        priceData.sector = sectorInfo.sector;
        priceData.industry = sectorInfo.industry;
        if (!priceData.companyName || priceData.companyName === symbol) {
          priceData.companyName = match.longname || match.shortname || symbol;
        }
      }
    } catch (searchErr) {
      console.warn(`⚠️ Yahoo search failed for ${symbol}:`, searchErr.message);
    }

    // 1c. Fundamentals via Perplexity (since Yahoo v10 is blocked)
    try {
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (apiKey && apiKey !== 'your_perplexity_api_key') {
        const fundPrompt = `Get the current fundamental data for ${symbol} (${priceData.companyName || symbol}) stock listed on NSE India.
Search Screener.in and Trendlyne for the most accurate data.
Return ONLY this JSON (no other text):
{
  "PE_Ratio": <trailing P/E ratio as number or null>,
  "Forward_PE": <forward P/E as number or null>,
  "PB_Ratio": <price to book ratio as number or null>,
  "EPS": <earnings per share TTM in INR as number or null>,
  "ROE": <return on equity % as number or null>,
  "ROA": <return on assets % as number or null>,
  "ROCE": <return on capital employed % as number or null>,
  "Profit_Margin": <net profit margin % as number or null>,
  "Operating_Margin": <operating profit margin OPM % as number or null>,
  "Revenue_Growth": <YoY revenue/sales growth % as number or null>,
  "Earnings_Growth": <YoY net profit growth % as number or null>,
  "Compounded_Sales_Growth_3yr": <3-year compounded sales growth % or null>,
  "Compounded_Sales_Growth_5yr": <5-year compounded sales growth % or null>,
  "Compounded_Profit_Growth_3yr": <3-year compounded profit growth % or null>,
  "Compounded_Profit_Growth_5yr": <5-year compounded profit growth % or null>,
  "Stock_Price_CAGR_3yr": <3-year stock price CAGR % or null>,
  "Stock_Price_CAGR_5yr": <5-year stock price CAGR % or null>,
  "Quarterly_Sales_Growth": <latest quarter sales growth YoY % or null>,
  "Quarterly_Profit_Growth": <latest quarter profit growth YoY % or null>,
  "Debt_Equity": <debt to equity ratio as number or null>,
  "Current_Ratio": <current ratio as number or null>,
  "Interest_Coverage": <interest coverage ratio as number or null>,
  "Cash_From_Operations_Cr": <cash from operating activity in crores or null>,
  "Free_Cash_Flow_Cr": <free cash flow in crores or null>,
  "Debtor_Days": <debtor days as number or null>,
  "Working_Capital_Days": <working capital days as number or null>,
  "Dividend_Yield": <dividend yield % as number or null>,
  "Book_Value": <book value per share in INR as number or null>,
  "Face_Value": <face value per share in INR as number or null>,
  "Market_Cap_Cr": <market cap in crores as number or null>,
  "Beta": <beta as number or null>,
  "Promoter_Holding": <promoter holding % or null>,
  "FII_Holding": <FII holding % or null>,
  "DII_Holding": <DII/mutual fund holding % or null>,
  "Number_of_Shareholders": <total number of shareholders or null>
}
Use the most recent available data from Screener.in. All percentage values should be numbers (e.g., 15.5 for 15.5%).`;

        const MODELS_F = ['sonar-pro', 'llama-3.1-sonar-small-128k-online'];
        let aiText = null;
        for (const model of MODELS_F) {
          try {
            const resp = await axios.post(
              'https://api.perplexity.ai/chat/completions',
              {
                model,
                messages: [
                  { role: 'system', content: 'You are a financial data provider for Indian stocks (NSE/BSE). Today is ' + new Date().toISOString().split('T')[0] + '. Return ONLY valid JSON with real data.' },
                  { role: 'user', content: fundPrompt },
                ],
                max_tokens: 1500,
                temperature: 0.2,
              },
              {
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 25000,
              }
            );
            aiText = resp.data.choices?.[0]?.message?.content;
            const fUsage = resp.data.usage || {};
            trackAPI('perplexity', 'stock-fundamentals', { inputTokens: fUsage.prompt_tokens, outputTokens: fUsage.completion_tokens, success: true, model });
            break;
          } catch (err) {
            trackAPI('perplexity', 'stock-fundamentals', { success: false, model });
            if (err.response?.status === 401 || err.response?.status === 403) continue;
            break;
          }
        }

        if (aiText) {
          let cleaned = aiText.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
          const start = cleaned.indexOf('{');
          if (start !== -1) {
            let depth = 0, end = -1;
            for (let i = start; i < cleaned.length; i++) {
              if (cleaned[i] === '{') depth++;
              else if (cleaned[i] === '}') depth--;
              if (depth === 0) { end = i; break; }
            }
            if (end !== -1) {
              try {
                const fd = JSON.parse(cleaned.slice(start, end + 1));
                const fmt = (v, suffix = '') => v != null ? `${v}${suffix}` : 'N/A';
                const fmtCr = (v) => {
                  if (v == null) return 'N/A';
                  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L Cr`;
                  return `₹${v.toLocaleString('en-IN')} Cr`;
                };
                fundamentals = {
                  // Valuation
                  'P/E Ratio (TTM)': fmt(fd.PE_Ratio),
                  'Forward P/E': fmt(fd.Forward_PE),
                  'P/B Ratio': fmt(fd.PB_Ratio),
                  'EPS (TTM)': fd.EPS != null ? `₹${fd.EPS}` : 'N/A',
                  'Book Value': fd.Book_Value != null ? `₹${fd.Book_Value}` : 'N/A',
                  'Face Value': fd.Face_Value != null ? `₹${fd.Face_Value}` : 'N/A',
                  'Market Cap': fmtCr(fd.Market_Cap_Cr),
                  'Beta': fmt(fd.Beta),
                  // Profitability
                  'ROE': fmt(fd.ROE, '%'),
                  'ROA': fmt(fd.ROA, '%'),
                  'ROCE': fmt(fd.ROCE, '%'),
                  'Profit Margin': fmt(fd.Profit_Margin, '%'),
                  'Operating Margin': fmt(fd.Operating_Margin, '%'),
                  // Growth
                  'Revenue Growth (YoY)': fmt(fd.Revenue_Growth, '%'),
                  'Earnings Growth (YoY)': fmt(fd.Earnings_Growth, '%'),
                  'Sales Growth (3yr CAGR)': fmt(fd.Compounded_Sales_Growth_3yr, '%'),
                  'Sales Growth (5yr CAGR)': fmt(fd.Compounded_Sales_Growth_5yr, '%'),
                  'Profit Growth (3yr CAGR)': fmt(fd.Compounded_Profit_Growth_3yr, '%'),
                  'Profit Growth (5yr CAGR)': fmt(fd.Compounded_Profit_Growth_5yr, '%'),
                  'Stock Price CAGR (3yr)': fmt(fd.Stock_Price_CAGR_3yr, '%'),
                  'Stock Price CAGR (5yr)': fmt(fd.Stock_Price_CAGR_5yr, '%'),
                  'Quarterly Sales Growth': fmt(fd.Quarterly_Sales_Growth, '%'),
                  'Quarterly Profit Growth': fmt(fd.Quarterly_Profit_Growth, '%'),
                  // Financial Health
                  'Debt/Equity': fmt(fd.Debt_Equity),
                  'Current Ratio': fmt(fd.Current_Ratio),
                  'Interest Coverage': fmt(fd.Interest_Coverage),
                  // Cash Flow
                  'Cash from Operations': fd.Cash_From_Operations_Cr != null ? fmtCr(fd.Cash_From_Operations_Cr) : 'N/A',
                  'Free Cash Flow': fd.Free_Cash_Flow_Cr != null ? fmtCr(fd.Free_Cash_Flow_Cr) : 'N/A',
                  // Efficiency
                  'Debtor Days': fmt(fd.Debtor_Days),
                  'Working Capital Days': fmt(fd.Working_Capital_Days),
                  // Dividends
                  'Dividend Yield': fmt(fd.Dividend_Yield, '%'),
                  // Ownership
                  'Promoter Holding': fmt(fd.Promoter_Holding, '%'),
                  'FII Holding': fmt(fd.FII_Holding, '%'),
                  'DII Holding': fmt(fd.DII_Holding, '%'),
                  'No. of Shareholders': fd.Number_of_Shareholders != null ? Number(fd.Number_of_Shareholders).toLocaleString('en-IN') : 'N/A',
                  // Price Range
                  '52-Week High': priceData.fiftyTwoWeekHigh ? `₹${priceData.fiftyTwoWeekHigh}` : 'N/A',
                  '52-Week Low': priceData.fiftyTwoWeekLow ? `₹${priceData.fiftyTwoWeekLow}` : 'N/A',
                };

                // Also update marketCap in priceData if we got it
                if (fd.Market_Cap_Cr && !priceData.marketCap) {
                  priceData.marketCap = fd.Market_Cap_Cr * 10000000; // Convert Cr to raw
                  priceData.marketCapFormatted = fmtCr(fd.Market_Cap_Cr);
                }
              } catch { /* ignore parse error */ }
            }
          }
        }
      }
    } catch (fundErr) {
      console.warn(`⚠️ Perplexity fundamentals failed for ${symbol}:`, fundErr.message);
    }

    // ── 2. Fetch historical OHLCV and calculate technical indicators ──────────
    let technicals = {};
    try {
      const histResp = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
        {
          params: { range: '6mo', interval: '1d' },
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)' },
          timeout: 10000,
        }
      );
      const histResult = histResp.data?.chart?.result?.[0];
      if (histResult) {
        const closes = histResult.indicators.quote[0].close.filter(c => c !== null);
        const highs = histResult.indicators.quote[0].high.filter(h => h !== null);
        const lows = histResult.indicators.quote[0].low.filter(l => l !== null);
        const volumes = histResult.indicators.quote[0].volume.filter(v => v !== null);

        if (closes.length >= 20) {
          // RSI (14-period)
          const rsi = calcRSI(closes, 14);

          // MACD (12, 26, 9)
          const macd = calcMACD(closes);

          // EMAs
          const ema20 = calcEMA(closes, 20);
          const ema50 = calcEMA(closes, 50);
          const ema200 = calcEMA(closes, 200);

          // SMA 20 (for Bollinger Bands)
          const sma20 = calcSMA(closes, 20);

          // Bollinger Bands (20, 2)
          const bb = calcBollingerBands(closes, 20, 2);

          // ADX (14-period)
          const adx = calcADX(highs, lows, closes, 14);

          // VWAP (today's approx — use recent 20 candles)
          const recentCloses = closes.slice(-20);
          const recentVolumes = volumes.slice(-20);
          const vwap = calcVWAP(recentCloses, recentVolumes);

          // Average volume
          const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);

          const lastClose = closes[closes.length - 1];

          // Trend determination
          let trend = 'Sideways';
          if (lastClose > ema20 && ema20 > ema50) trend = 'Bullish';
          else if (lastClose < ema20 && ema20 < ema50) trend = 'Bearish';

          // Signal
          let signal = 'Neutral';
          if (rsi < 30 && macd.histogram > 0) signal = 'Strong Buy';
          else if (rsi < 40 && macd.histogram > 0) signal = 'Buy';
          else if (rsi > 70 && macd.histogram < 0) signal = 'Strong Sell';
          else if (rsi > 60 && macd.histogram < 0) signal = 'Sell';

          technicals = {
            'RSI (14)': rsi?.toFixed(2) ?? 'N/A',
            'MACD Line': macd.macdLine?.toFixed(2) ?? 'N/A',
            'MACD Signal': macd.signalLine?.toFixed(2) ?? 'N/A',
            'MACD Histogram': macd.histogram?.toFixed(2) ?? 'N/A',
            'EMA 20': ema20?.toFixed(2) ?? 'N/A',
            'EMA 50': ema50?.toFixed(2) ?? 'N/A',
            'EMA 200': ema200 ? ema200.toFixed(2) : 'N/A (need 200+ days)',
            'SMA 20': sma20?.toFixed(2) ?? 'N/A',
            'Bollinger Upper': bb.upper?.toFixed(2) ?? 'N/A',
            'Bollinger Lower': bb.lower?.toFixed(2) ?? 'N/A',
            'ADX (14)': adx ? adx.toFixed(2) : 'N/A',
            'VWAP (approx)': vwap?.toFixed(2) ?? 'N/A',
            'Avg Volume (20d)': Math.round(avgVol20).toLocaleString(),
            'Trend': trend,
            'Signal': signal,
          };
        }
      }
    } catch (techErr) {
      console.warn(`⚠️ Technical calc failed for ${symbol}:`, techErr.message);
    }

    // ── 3. Fetch latest news via Perplexity ──────────────────────────────────
    let news = [];
    let newsError = null;
    try {
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (apiKey && apiKey !== 'your_perplexity_api_key') {
        const newsPrompt = `Search for the latest news and updates about ${symbol} (${priceData.companyName || symbol}) stock on NSE India from the last 7 days.
Return ONLY this JSON (no other text):
{
  "news": [
    { "headline": "...", "summary": "1-2 sentence summary", "sentiment": "Positive/Negative/Neutral", "date": "YYYY-MM-DD", "source": "source name" }
  ]
}
Include 3-5 most relevant recent news items. Use real news from the internet.`;

        const MODELS = ['sonar-pro', 'llama-3.1-sonar-small-128k-online'];
        let aiText = null;
        for (const model of MODELS) {
          try {
            const resp = await axios.post(
              'https://api.perplexity.ai/chat/completions',
              {
                model,
                messages: [
                  { role: 'system', content: 'You are an Indian stock market news researcher. Today is ' + new Date().toISOString().split('T')[0] + '. Return ONLY valid JSON.' },
                  { role: 'user', content: newsPrompt },
                ],
                max_tokens: 1500,
                temperature: 0.3,
                search_recency_filter: 'week',
              },
              {
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 30000,
              }
            );
            aiText = resp.data.choices?.[0]?.message?.content;
            const nUsage = resp.data.usage || {};
            trackAPI('perplexity', 'stock-news', { inputTokens: nUsage.prompt_tokens, outputTokens: nUsage.completion_tokens, success: true, model });
            break;
          } catch (err) {
            trackAPI('perplexity', 'stock-news', { success: false, model });
            if (err.response?.status === 401 || err.response?.status === 403) continue;
            break;
          }
        }

        if (aiText) {
          // Extract JSON
          let cleaned = aiText.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
          const start = cleaned.indexOf('{');
          if (start !== -1) {
            let depth = 0, end = -1;
            for (let i = start; i < cleaned.length; i++) {
              if (cleaned[i] === '{') depth++;
              else if (cleaned[i] === '}') depth--;
              if (depth === 0) { end = i; break; }
            }
            if (end !== -1) {
              try {
                const parsed = JSON.parse(cleaned.slice(start, end + 1));
                news = parsed.news || [];
              } catch { /* ignore parse error */ }
            }
          }
        }
      }
    } catch (newsErr) {
      newsError = newsErr.message;
      console.warn(`⚠️ News fetch failed for ${symbol}:`, newsErr.message);
    }

    // ── 4. AI Recommendation ─────────────────────────────────────────────────
    let recommendation = null;
    try {
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (apiKey && apiKey !== 'your_perplexity_api_key') {
        const techSummary = Object.keys(technicals).length > 0
          ? `Technical data: RSI=${technicals['RSI (14)']}, MACD Histogram=${technicals['MACD Histogram']}, Trend=${technicals['Trend']}, EMA20=${technicals['EMA 20']}, EMA50=${technicals['EMA 50']}`
          : '';
        const fundSummary = Object.keys(fundamentals).length > 0
          ? `Fundamentals: P/E=${fundamentals['P/E Ratio (TTM)']}, ROE=${fundamentals['ROE']}, Profit Margin=${fundamentals['Profit Margin']}, Debt/Equity=${fundamentals['Debt/Equity']}`
          : '';

        // Fetch market context (cached 10 min — adds NIFTY trend, VIX, regime)
        let marketContext = '';
        try { marketContext = await aiService.getMarketContext(); } catch (e) { /* non-critical */ }

        const recoPrompt = `${marketContext}
Analyze ${symbol} (${priceData.companyName || symbol}) stock on NSE India at current price ₹${priceData.currentPrice || 'unknown'}.
${techSummary}
${fundSummary}
Recent news sentiment: ${news.length > 0 ? news.map(n => n.sentiment).join(', ') : 'unavailable'}

Provide a swing trading recommendation (holding period 2 days to 3 months).
Return ONLY this JSON:
{
  "action": "BUY" or "SELL" or "HOLD" or "ACCUMULATE",
  "confidence": <0-100>,
  "entryPrice": <suggested entry price in INR>,
  "targetPrice": <target price in INR>,
  "stopLoss": <stop loss price in INR>,
  "timeframe": "e.g. 2-4 weeks",
  "riskReward": "e.g. 1:2.5",
  "reasoning": "3-4 sentence explanation covering technicals, fundamentals, and catalysts",
  "risks": ["risk1", "risk2", "risk3"],
  "catalysts": ["catalyst1", "catalyst2"]
}
Be realistic. Use actual current prices. If unsure, say HOLD.`;

        const MODELS = ['sonar-pro', 'llama-3.1-sonar-small-128k-online'];
        let aiText = null;
        for (const model of MODELS) {
          try {
            const resp = await axios.post(
              'https://api.perplexity.ai/chat/completions',
              {
                model,
                messages: [
                  { role: 'system', content: 'You are an expert Indian stock market swing trading analyst. Today is ' + new Date().toISOString().split('T')[0] + '. Return ONLY valid JSON.' },
                  { role: 'user', content: recoPrompt },
                ],
                max_tokens: 1500,
                temperature: 0.4,
              },
              {
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 30000,
              }
            );
            aiText = resp.data.choices?.[0]?.message?.content;
            const rUsage = resp.data.usage || {};
            trackAPI('perplexity', 'stock-recommendation', { inputTokens: rUsage.prompt_tokens, outputTokens: rUsage.completion_tokens, success: true, model });
            break;
          } catch (err) {
            trackAPI('perplexity', 'stock-recommendation', { success: false, model });
            if (err.response?.status === 401 || err.response?.status === 403) continue;
            break;
          }
        }

        if (aiText) {
          let cleaned = aiText.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
          const start = cleaned.indexOf('{');
          if (start !== -1) {
            let depth = 0, end = -1;
            for (let i = start; i < cleaned.length; i++) {
              if (cleaned[i] === '{') depth++;
              else if (cleaned[i] === '}') depth--;
              if (depth === 0) { end = i; break; }
            }
            if (end !== -1) {
              try {
                recommendation = JSON.parse(cleaned.slice(start, end + 1));
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch (recoErr) {
      console.warn(`⚠️ AI recommendation failed for ${symbol}:`, recoErr.message);
    }

    // ── 5. Paper trading is now manual — user clicks "Paper Trade This" in the frontend ──

    // ── 6. Respond ───────────────────────────────────────────────────────────
    res.json({
      status: 'success',
      data: {
        symbol,
        price: priceData,
        fundamentals,
        technicals,
        news,
        recommendation,
        analyzedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error(`Stock analysis error for ${symbol}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Failed to analyze ${symbol}`,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Technical Indicator Calculation Functions
// ─────────────────────────────────────────────────────────────────────────────

function calcEMA(data, period) {
  if (data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcSMA(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12 === null || ema26 === null) return { macdLine: null, signalLine: null, histogram: null };

  // Build full MACD line series for signal line calculation
  const k12 = 2 / 13, k26 = 2 / 27;
  let e12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let e26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  const macdSeries = [];
  for (let i = 0; i < closes.length; i++) {
    if (i >= 12) e12 = closes[i] * k12 + e12 * (1 - k12);
    if (i >= 26) {
      e26 = closes[i] * k26 + e26 * (1 - k26);
      macdSeries.push(e12 - e26);
    }
  }
  if (macdSeries.length < 9) return { macdLine: macdSeries[macdSeries.length - 1] || null, signalLine: null, histogram: null };

  // Signal line = 9-period EMA of MACD
  const k9 = 2 / 10;
  let signal = macdSeries.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  for (let i = 9; i < macdSeries.length; i++) {
    signal = macdSeries[i] * k9 + signal * (1 - k9);
  }
  const macdLine = macdSeries[macdSeries.length - 1];
  return { macdLine, signalLine: signal, histogram: macdLine - signal };
}

function calcBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  if (closes.length < period) return { upper: null, lower: null, middle: null };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: mean + stdDevMultiplier * stdDev,
    lower: mean - stdDevMultiplier * stdDev,
    middle: mean,
  };
}

function calcADX(highs, lows, closes, period = 14) {
  if (highs.length < period * 2 || lows.length < period * 2 || closes.length < period * 2) return null;
  const len = Math.min(highs.length, lows.length, closes.length);
  const trueRanges = [];
  const plusDM = [];
  const minusDM = [];

  for (let i = 1; i < len; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
    trueRanges.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  if (trueRanges.length < period) return null;

  // Smoothed averages
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let plusDI = plusDM.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let minusDI = minusDM.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const dxValues = [];
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    plusDI = (plusDI * (period - 1) + plusDM[i]) / period;
    minusDI = (minusDI * (period - 1) + minusDM[i]) / period;

    const pdi = atr > 0 ? (plusDI / atr) * 100 : 0;
    const mdi = atr > 0 ? (minusDI / atr) * 100 : 0;
    const diSum = pdi + mdi;
    dxValues.push(diSum > 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0);
  }

  if (dxValues.length < period) return null;
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }
  return adx;
}

function calcVWAP(closes, volumes) {
  if (!closes.length || !volumes.length) return null;
  let cumPV = 0, cumV = 0;
  const len = Math.min(closes.length, volumes.length);
  for (let i = 0; i < len; i++) {
    cumPV += closes[i] * (volumes[i] || 0);
    cumV += (volumes[i] || 0);
  }
  return cumV > 0 ? cumPV / cumV : null;
}

module.exports = router;