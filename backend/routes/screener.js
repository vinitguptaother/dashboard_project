const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');

const router = express.Router();

// @route   GET /api/screener/stocks
// @desc    Get screened stocks based on filters
// @access  Private
router.get('/stocks', async (req, res) => {
  try {
    const {
      marketCap = 'all',
      sector = 'all',
      peRatioMin = '',
      peRatioMax = '',
      priceChange = 'all',
      volume = 'all',
      technicalPattern = 'all',
      limit = 50,
      page = 1
    } = req.query;

    // For now, we'll use a comprehensive list of Indian stocks
    // In a real implementation, this would come from a database or external API
    const allStocks = [
      'RELIANCE', 'TCS', 'HDFC', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
      'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH',
      'SUNPHARMA', 'ULTRACEMCO', 'TITAN', 'BAJFINANCE', 'WIPRO', 'NESTLEIND',
      'POWERGRID', 'TECHM', 'BAJAJFINSV', 'NTPC', 'ADANIENT', 'JSWSTEEL',
      'ONGC', 'COALINDIA', 'TATAMOTORS', 'HINDALCO', 'DRREDDY', 'SHREECEM',
      'CIPLA', 'DIVISLAB', 'BRITANNIA', 'EICHERMOT', 'HEROMOTOCO', 'UPL',
      'VEDL', 'GRASIM', 'TATACONSUM', 'BAJAJ-AUTO', 'INDUSINDBK', 'TATASTEEL',
      'BPCL', 'MM', 'SBILIFE', 'HDFCLIFE', 'TATAPOWER', 'APOLLOHOSP',
      'ADANIPORTS', 'M&M', 'LT', 'HINDCOPPER', 'VEDANTA', 'JINDALSTEL'
    ];

    // Simulate fetching stock data with filters
    const screenedStocks = [];
    const offset = (page - 1) * limit;

    for (let i = 0; i < Math.min(limit, allStocks.length); i++) {
      const symbol = allStocks[offset + i];
      if (!symbol) break;

      // Generate realistic stock data
      const basePrice = Math.random() * 2000 + 100;
      const change = (Math.random() - 0.5) * 100;
      const changePercent = (change / basePrice) * 100;
      const price = basePrice + change;
      
      const marketCapValue = Math.random() * 100000 + 10000; // in crores
      const peRatio = Math.random() * 50 + 10;
      const volume = Math.random() > 0.7 ? 'Very High' : Math.random() > 0.5 ? 'High' : Math.random() > 0.3 ? 'Medium' : 'Low';
      const technicalScore = Math.random() * 10;
      const fundamentalScore = Math.random() * 10;
      
      const sectors = ['Banking', 'IT Services', 'Automobile', 'Pharmaceuticals', 'Oil & Gas', 'Metals', 'FMCG', 'Telecom', 'Power', 'Real Estate'];
      const sector = sectors[Math.floor(Math.random() * sectors.length)];
      
      const patterns = ['Breakout', 'Flag Pattern', 'Triangle', 'Cup & Handle', 'Double Top', 'Head & Shoulders', 'Channel', 'Wedge'];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      // Apply filters
      let include = true;

      // Market Cap filter
      if (marketCap !== 'all') {
        const capCategory = marketCapValue > 50000 ? 'large' : marketCapValue > 10000 ? 'mid' : 'small';
        if (capCategory !== marketCap) include = false;
      }

      // Sector filter
      if (sector !== 'all' && sector.toLowerCase() !== sector.toLowerCase()) {
        include = false;
      }

      // P/E Ratio filter
      if (peRatioMin && peRatio < parseFloat(peRatioMin)) include = false;
      if (peRatioMax && peRatio > parseFloat(peRatioMax)) include = false;

      // Price Change filter
      if (priceChange !== 'all') {
        switch (priceChange) {
          case 'positive':
            if (changePercent <= 0) include = false;
            break;
          case 'negative':
            if (changePercent >= 0) include = false;
            break;
          case 'strong-up':
            if (changePercent < 5) include = false;
            break;
          case 'strong-down':
            if (changePercent > -5) include = false;
            break;
        }
      }

      // Volume filter
      if (volume !== 'all') {
        const volumeMap = { 'high': 'High', 'very-high': 'Very High', 'above-avg': 'Medium' };
        if (volumeMap[volume] && volumeMap[volume] !== volume) include = false;
      }

      // Technical Pattern filter
      if (technicalPattern !== 'all' && pattern.toLowerCase() !== technicalPattern.toLowerCase()) {
        include = false;
      }

      if (include) {
        screenedStocks.push({
          symbol,
          price: parseFloat(price.toFixed(2)),
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          marketCap: `${(marketCapValue / 1000).toFixed(1)}L Cr`,
          peRatio: parseFloat(peRatio.toFixed(1)),
          sector,
          volume,
          technicalScore: parseFloat(technicalScore.toFixed(1)),
          fundamentalScore: parseFloat(fundamentalScore.toFixed(1)),
          pattern
        });
      }
    }

    res.json({
      status: 'success',
      data: {
        stocks: screenedStocks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allStocks.length,
          totalPages: Math.ceil(allStocks.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Stock screening error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to screen stocks'
    });
  }
});

// @route   GET /api/screener/presets
// @desc    Get preset screening criteria
// @access  Private
router.get('/presets', async (req, res) => {
  try {
    const presets = [
      {
        name: 'Momentum Stocks',
        description: 'Stocks with strong price momentum and volume',
        criteria: 'Price change > 5%, Volume > 2x avg',
        count: Math.floor(Math.random() * 50) + 20,
        filters: {
          priceChange: 'strong-up',
          volume: 'high'
        }
      },
      {
        name: 'Value Picks',
        description: 'Undervalued stocks with strong fundamentals',
        criteria: 'P/E < 15, ROE > 15%, Debt/Equity < 0.5',
        count: Math.floor(Math.random() * 30) + 15,
        filters: {
          peRatioMax: '15'
        }
      },
      {
        name: 'Breakout Candidates',
        description: 'Stocks near technical breakout levels',
        criteria: 'Near 52-week high, Volume surge',
        count: Math.floor(Math.random() * 40) + 25,
        filters: {
          technicalPattern: 'breakout',
          volume: 'very-high'
        }
      },
      {
        name: 'Dividend Aristocrats',
        description: 'Consistent dividend paying companies',
        criteria: 'Dividend yield > 2%, 5yr consistency',
        count: Math.floor(Math.random() * 25) + 10,
        filters: {
          marketCap: 'large'
        }
      },
      {
        name: 'High Growth Tech',
        description: 'Technology stocks with high growth potential',
        criteria: 'IT sector, High P/E, Strong momentum',
        count: Math.floor(Math.random() * 35) + 15,
        filters: {
          sector: 'it',
          priceChange: 'positive'
        }
      },
      {
        name: 'Banking Leaders',
        description: 'Leading banking stocks with strong fundamentals',
        criteria: 'Banking sector, Large cap, Low P/E',
        count: Math.floor(Math.random() * 20) + 10,
        filters: {
          sector: 'banking',
          marketCap: 'large'
        }
      }
    ];

    res.json({
      status: 'success',
      data: { presets }
    });
  } catch (error) {
    console.error('Preset screening error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get preset screens'
    });
  }
});

// @route   GET /api/screener/statistics
// @desc    Get screening statistics
// @access  Private
router.get('/statistics', async (req, res) => {
  try {
    const stats = {
      totalStocks: 2847,
      filteredResults: Math.floor(Math.random() * 200) + 100,
      bullishSignals: Math.floor(Math.random() * 100) + 50,
      highConfidence: Math.floor(Math.random() * 50) + 20,
      sectorBreakdown: {
        'Banking': Math.floor(Math.random() * 50) + 20,
        'IT Services': Math.floor(Math.random() * 40) + 15,
        'Automobile': Math.floor(Math.random() * 30) + 10,
        'Pharmaceuticals': Math.floor(Math.random() * 25) + 8,
        'Oil & Gas': Math.floor(Math.random() * 20) + 5,
        'Others': Math.floor(Math.random() * 100) + 30
      },
      marketCapBreakdown: {
        'Large Cap': Math.floor(Math.random() * 80) + 40,
        'Mid Cap': Math.floor(Math.random() * 60) + 30,
        'Small Cap': Math.floor(Math.random() * 40) + 20
      }
    };

    res.json({
      status: 'success',
      data: { statistics: stats }
    });
  } catch (error) {
    console.error('Screening statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get screening statistics'
    });
  }
});

module.exports = router;
