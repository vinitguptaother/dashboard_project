const express = require('express');
const { body, validationResult } = require('express-validator');
const aiService = require('../services/aiService');
const marketDataService = require('../services/marketDataService');
const newsService = require('../services/newsService');
const { apiLogger } = require('../middleware/logger');

const router = express.Router();

// @route   POST /api/ai/chat
// @desc    AI Chatbot with real-time market context
// @access  Private
router.post('/chat', [
  body('message').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be between 1-2000 characters'),
  body('context').optional().isObject()
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

    const { message, context } = req.body;
    const userId = req.user?.id || 'public';

    // Get AI response with real-time market context
    const aiResponse = await aiService.chatWithContext(message, userId);

    res.json({
      status: 'success',
      data: {
        message: message,
        response: aiResponse.response,
        marketContext: aiResponse.marketContext,
        timestamp: aiResponse.timestamp,
        userId: userId
      }
    });

  } catch (error) {
    apiLogger.error('AIChatbot', 'chat', error, { userId: req.user?.id || 'public' });
    res.status(500).json({
      status: 'error',
      message: 'Failed to process chat message',
      error: error.message
    });
  }
});

// @route   POST /api/ai/analyze-stock
// @desc    AI-powered stock analysis with real-time data
// @access  Private
router.post('/analyze-stock', [
  body('symbol').trim().isLength({ min: 1, max: 20 }).toUpperCase().withMessage('Valid stock symbol required')
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

    const { symbol } = req.body;
    
    // Get AI-powered stock analysis
    const analysis = await aiService.analyzeStock(symbol);

    res.json({
      status: 'success',
      data: {
        symbol: symbol,
        analysis: analysis,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    apiLogger.error('AIChatbot', 'analyzeStock', error, { symbol: req.body.symbol });
    res.status(500).json({
      status: 'error',
      message: 'Failed to analyze stock',
      error: error.message
    });
  }
});

// @route   GET /api/ai/market-insights
// @desc    Get AI-powered market insights with real-time data
// @access  Private
router.get('/market-insights', async (req, res) => {
  try {
    const { timeframe = 'today' } = req.query;

    // Get real-time market context
    const marketContext = await aiService.getMarketContext();
    
    // Get recent news for sentiment analysis
    const recentNews = await newsService.searchNews('market', { limit: 10 });
    const newsSentiment = await aiService.analyzeNewsSentiment(recentNews.news);

    // Create comprehensive market insights prompt
    const insightsPrompt = `
Based on the following REAL-TIME market data and news sentiment, provide comprehensive market insights:

${marketContext}

NEWS SENTIMENT: ${newsSentiment.overallSentiment} (Confidence: ${newsSentiment.confidence}%)

Provide insights in JSON format:
{
  "marketOutlook": "bullish/neutral/bearish",
  "confidence": 0-100,
  "keyInsights": [
    "insight 1",
    "insight 2",
    "insight 3"
  ],
  "tradingOpportunities": [
    {
      "type": "opportunity type",
      "description": "detailed description",
      "symbols": ["SYMBOL1", "SYMBOL2"],
      "timeframe": "short/medium/long term"
    }
  ],
  "riskFactors": ["risk1", "risk2"],
  "sectorFocus": ["sector1", "sector2"],
  "actionableAdvice": "specific advice for traders/investors"
}

Focus on actionable insights based on current market conditions.
`;

    const aiInsights = await aiService.callPerplexityAPI(insightsPrompt);
    
    let insightsData;
    try {
      const jsonMatch = aiInsights.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insightsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      insightsData = {
        marketOutlook: newsSentiment.overallSentiment || 'neutral',
        confidence: newsSentiment.confidence || 50,
        keyInsights: [
          'Market showing mixed signals with selective stock movements',
          'Technology and banking sectors showing relative strength',
          'Monitor global cues and domestic policy developments'
        ],
        tradingOpportunities: [
          {
            type: 'Sector Rotation',
            description: 'Potential rotation from defensive to growth stocks',
            symbols: ['TCS', 'INFY', 'HDFC'],
            timeframe: 'medium term'
          }
        ],
        riskFactors: ['Global market volatility', 'Currency fluctuations'],
        sectorFocus: ['Technology', 'Banking'],
        actionableAdvice: 'Maintain diversified portfolio with focus on quality stocks'
      };
    }

    res.json({
      status: 'success',
      data: {
        insights: insightsData,
        marketContext: marketContext,
        newsSentiment: newsSentiment,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    apiLogger.error('AIChatbot', 'marketInsights', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get market insights',
      error: error.message
    });
  }
});

// @route   POST /api/ai/portfolio-analysis
// @desc    AI-powered portfolio analysis
// @access  Private
router.post('/portfolio-analysis', [
  body('holdings').isArray().withMessage('Holdings must be an array'),
  body('holdings.*.symbol').trim().isLength({ min: 1 }).withMessage('Each holding must have a symbol'),
  body('holdings.*.quantity').isInt({ min: 1 }).withMessage('Each holding must have a valid quantity'),
  body('holdings.*.avgPrice').isFloat({ min: 0 }).withMessage('Each holding must have a valid average price')
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

    const { holdings } = req.body;
    
    // Get AI-powered portfolio analysis
    const analysis = await aiService.analyzePortfolio(holdings);

    res.json({
      status: 'success',
      data: {
        portfolioAnalysis: analysis,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    apiLogger.error('AIChatbot', 'portfolioAnalysis', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to analyze portfolio',
      error: error.message
    });
  }
});

// @route   GET /api/ai/trading-signals
// @desc    AI-powered trading signals with real-time data
// @access  Private
router.get('/trading-signals', async (req, res) => {
  try {
    const { symbols = 'NIFTY,BANKNIFTY,RELIANCE,TCS,HDFC' } = req.query;
    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());

    // Get real-time data for symbols
    const marketData = await marketDataService.getBatchMarketData(symbolList);

    // Create trading signals prompt with real-time data
    let dataContext = "REAL-TIME MARKET DATA:\n";
    symbolList.forEach(symbol => {
      const data = marketData[symbol];
      if (data && data.status === 'success') {
        const stock = data.data;
        dataContext += `${symbol}: ₹${stock.price} (${stock.change >= 0 ? '+' : ''}${stock.change}, ${stock.changePercent}%) Vol: ${stock.volume}\n`;
      }
    });

    const signalsPrompt = `
Based on this REAL-TIME market data, generate trading signals:

${dataContext}

Provide trading signals in JSON format:
{
  "signals": [
    {
      "symbol": "SYMBOL",
      "signal": "BUY/SELL/HOLD",
      "strength": "STRONG/MODERATE/WEAK",
      "confidence": 0-100,
      "entryPrice": price,
      "stopLoss": price,
      "target": price,
      "timeframe": "intraday/short-term/positional",
      "reasoning": "detailed reasoning based on real-time data",
      "riskReward": ratio
    }
  ],
  "marketCondition": "trending/sideways/volatile",
  "overallBias": "bullish/neutral/bearish"
}

Focus on actionable signals based on current price action, volume, and momentum.
`;

    const aiSignals = await aiService.callPerplexityAPI(signalsPrompt);
    
    let signalsData;
    try {
      const jsonMatch = aiSignals.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        signalsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      // Generate fallback signals based on real data
      const signals = symbolList.map(symbol => {
        const data = marketData[symbol];
        if (data && data.status === 'success') {
          const stock = data.data;
          const signal = stock.changePercent > 1 ? 'BUY' : stock.changePercent < -1 ? 'SELL' : 'HOLD';
          return {
            symbol: symbol,
            signal: signal,
            strength: Math.abs(stock.changePercent) > 2 ? 'STRONG' : 'MODERATE',
            confidence: Math.min(Math.abs(stock.changePercent) * 20 + 50, 95),
            entryPrice: stock.price,
            stopLoss: stock.price * (signal === 'BUY' ? 0.97 : 1.03),
            target: stock.price * (signal === 'BUY' ? 1.05 : 0.95),
            timeframe: 'short-term',
            reasoning: `Based on ${stock.changePercent}% move with volume of ${stock.volume}`,
            riskReward: 1.5
          };
        }
        return null;
      }).filter(Boolean);

      signalsData = {
        signals: signals,
        marketCondition: 'trending',
        overallBias: 'neutral'
      };
    }

    res.json({
      status: 'success',
      data: {
        tradingSignals: signalsData,
        marketData: marketData,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    apiLogger.error('AIChatbot', 'tradingSignals', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate trading signals',
      error: error.message
    });
  }
});

// @route   GET /api/ai/news-sentiment
// @desc    AI-powered news sentiment analysis
// @access  Private
router.get('/news-sentiment', async (req, res) => {
  try {
    const { category = 'market-news', limit = 20 } = req.query;

    // Get recent news
    const newsResults = await newsService.searchNews('', { 
      category: category !== 'all' ? category : undefined, 
      limit: parseInt(limit) 
    });

    if (!newsResults.news || newsResults.news.length === 0) {
      return res.json({
        status: 'success',
        data: {
          sentiment: {
            overallSentiment: 'neutral',
            confidence: 0,
            analysis: 'No recent news available for analysis'
          },
          newsCount: 0
        }
      });
    }

    // Get AI sentiment analysis
    const sentimentAnalysis = await aiService.analyzeNewsSentiment(newsResults.news);

    res.json({
      status: 'success',
      data: {
        sentiment: sentimentAnalysis,
        newsCount: newsResults.news.length,
        sampleNews: newsResults.news.slice(0, 5).map(news => ({
          title: news.title,
          summary: news.summary,
          publishedAt: news.publishedAt,
          sentiment: news.sentiment
        })),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    apiLogger.error('AIChatbot', 'newsSentiment', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to analyze news sentiment',
      error: error.message
    });
  }
});

// @route   GET /api/ai/status
// @desc    Get AI service status and statistics
// @access  Private
router.get('/status', async (req, res) => {
  try {
    const stats = aiService.getStats();
    
    res.json({
      status: 'success',
      data: {
        aiServiceStatus: 'operational',
        apiKeyConfigured: stats.apiKeyConfigured,
        cacheSize: stats.cacheSize,
        availableFeatures: [
          'Real-time Chat',
          'Stock Analysis',
          'Market Insights',
          'Portfolio Analysis',
          'Trading Signals',
          'News Sentiment'
        ],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    apiLogger.error('AIChatbot', 'status', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get AI service status'
    });
  }
});

module.exports = router;