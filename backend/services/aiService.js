const axios = require('axios');
const marketDataService = require('./marketDataService');
const newsService = require('./newsService');
const { apiLogger } = require('../middleware/logger');
const trackAPI = require('../utils/trackAPI');

class AIService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.baseURL = 'https://api.perplexity.ai/chat/completions';
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes cache for AI responses
    // Market context cache — 10 minutes, shared across all AI prompts
    this.marketContextCache = null;
    this.marketContextCacheTime = 0;
    this.MARKET_CONTEXT_TTL = 600000; // 10 minutes
  }

  // Enhanced AI Chat with Real-time Market Context
  async chatWithContext(userQuery, userId) {
    try {
      // Get real-time market context
      const marketContext = await this.getMarketContext();
      
      // Enhanced prompt with real-time data
      const enhancedPrompt = `
You are an expert Indian stock market analyst with access to real-time data. 

CURRENT MARKET DATA:
${marketContext}

USER QUERY: ${userQuery}

Provide a comprehensive analysis considering:
1. Current market conditions and real-time prices
2. Technical analysis based on live data
3. Fundamental factors affecting Indian markets
4. Risk assessment and recommendations
5. Specific actionable insights

Format your response in a structured, professional manner. Include specific numbers, percentages, and price levels where relevant.
`;

      const response = await this.callPerplexityAPI(enhancedPrompt);
      
      // Log the interaction
      apiLogger.info('AIService', 'chatWithContext', {
        userId,
        queryLength: userQuery.length,
        responseLength: response.length
      });

      return {
        response,
        marketContext: marketContext,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      apiLogger.error('AIService', 'chatWithContext', error, { userId });
      throw error;
    }
  }

  // Get Real-time Market Context (cached for 10 minutes)
  // Used by: stock recommendations, screen ranking, trade setup generation, chatbot
  async getMarketContext() {
    // Return cached version if fresh
    if (this.marketContextCache && (Date.now() - this.marketContextCacheTime < this.MARKET_CONTEXT_TTL)) {
      return this.marketContextCache;
    }

    try {
      // ── Fetch all data in parallel ──
      const [niftyData, vixData, indexLTP] = await Promise.allSettled([
        // NIFTY 50 — 1-month daily chart for 5d/20d trend
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI', {
          params: { interval: '1d', range: '1mo' },
          timeout: 8000
        }),
        // India VIX — current value
        axios.get('https://query1.finance.yahoo.com/v8/finance/chart/%5EINDIAVIX', {
          params: { interval: '1d', range: '5d' },
          timeout: 8000
        }),
        // Live index prices from Upstox (already connected)
        this._getIndexLTP()
      ]);

      // ── Parse NIFTY chart data ──
      let niftyPrice = null, nifty5dChange = null, nifty20dChange = null, niftyTodayChange = null;
      if (niftyData.status === 'fulfilled') {
        const chart = niftyData.value.data?.chart?.result?.[0];
        if (chart) {
          const closes = chart.indicators?.quote?.[0]?.close?.filter(c => c != null) || [];
          const meta = chart.meta;
          niftyPrice = meta?.regularMarketPrice || closes[closes.length - 1];
          const prevClose = meta?.chartPreviousClose || meta?.previousClose;
          if (niftyPrice && prevClose) {
            niftyTodayChange = ((niftyPrice - prevClose) / prevClose * 100).toFixed(2);
          }
          if (closes.length >= 6) {
            const price5dAgo = closes[closes.length - 6];
            nifty5dChange = ((niftyPrice - price5dAgo) / price5dAgo * 100).toFixed(2);
          }
          if (closes.length >= 20) {
            const price20dAgo = closes[closes.length - 20];
            nifty20dChange = ((niftyPrice - price20dAgo) / price20dAgo * 100).toFixed(2);
          }
        }
      }

      // ── Parse India VIX ──
      let vixValue = null, vixLabel = '';
      if (vixData.status === 'fulfilled') {
        const chart = vixData.value.data?.chart?.result?.[0];
        if (chart) {
          vixValue = chart.meta?.regularMarketPrice;
          if (!vixValue) {
            const closes = chart.indicators?.quote?.[0]?.close?.filter(c => c != null) || [];
            vixValue = closes[closes.length - 1];
          }
          if (vixValue) {
            vixValue = parseFloat(vixValue).toFixed(2);
            if (vixValue < 15) vixLabel = 'LOW — market calm';
            else if (vixValue < 20) vixLabel = 'MODERATE — normal volatility';
            else if (vixValue < 25) vixLabel = 'HIGH — caution advised';
            else vixLabel = 'VERY HIGH — extreme fear, avoid aggressive buys';
          }
        }
      }

      // ── Parse live index prices from Upstox ──
      let sensexStr = '', bankNiftyStr = '';
      if (indexLTP.status === 'fulfilled' && indexLTP.value) {
        const ltp = indexLTP.value;
        if (ltp.SENSEX) sensexStr = `SENSEX: ₹${Math.round(ltp.SENSEX).toLocaleString('en-IN')}`;
        if (ltp.BANKNIFTY) bankNiftyStr = `BANK NIFTY: ₹${Math.round(ltp.BANKNIFTY).toLocaleString('en-IN')}`;
      }

      // ── Determine Market Regime ──
      const regime = this._classifyRegime(niftyTodayChange, nifty5dChange, nifty20dChange, vixValue);

      // ── Build context string ──
      let context = '── MARKET CONTEXT (DO NOT IGNORE) ──\n';
      if (niftyPrice) {
        context += `NIFTY 50: ₹${Math.round(niftyPrice).toLocaleString('en-IN')}`;
        if (niftyTodayChange) context += ` (${niftyTodayChange >= 0 ? '+' : ''}${niftyTodayChange}% today`;
        if (nifty5dChange) context += `, ${nifty5dChange >= 0 ? '+' : ''}${nifty5dChange}% 5-day`;
        if (nifty20dChange) context += `, ${nifty20dChange >= 0 ? '+' : ''}${nifty20dChange}% 20-day`;
        if (niftyTodayChange) context += ')';
        context += '\n';
      }
      if (sensexStr) context += sensexStr + '\n';
      if (bankNiftyStr) context += bankNiftyStr + '\n';
      if (vixValue) context += `India VIX: ${vixValue} (${vixLabel})\n`;
      context += `Market Regime: ${regime}\n`;
      context += '── Factor this into your analysis. Be cautious if VIX > 20 or regime is BEARISH ──\n';

      // Cache it
      this.marketContextCache = context;
      this.marketContextCacheTime = Date.now();

      apiLogger.info('AIService', 'getMarketContext', {
        niftyPrice, niftyTodayChange, nifty5dChange, vixValue, regime
      });

      return context;

    } catch (error) {
      apiLogger.error('AIService', 'getMarketContext', error);
      return 'Market data temporarily unavailable.\n';
    }
  }

  // Classify overall market regime from NIFTY trends and VIX
  _classifyRegime(todayPct, fiveDayPct, twentyDayPct, vix) {
    const t = parseFloat(todayPct) || 0;
    const f = parseFloat(fiveDayPct) || 0;
    const tw = parseFloat(twentyDayPct) || 0;
    const v = parseFloat(vix) || 15;

    // High VIX overrides everything
    if (v >= 25) return 'VOLATILE — extreme fear, tighten stop losses, avoid new aggressive positions';
    if (v >= 20 && (t < -1 || f < -3)) return 'BEARISH — falling market with high volatility, prefer cash or hedged positions';

    // Trend-based classification
    if (tw > 3 && f > 1 && t > -0.5) return 'BULLISH — uptrend across timeframes, favorable for BUY setups';
    if (tw < -3 && f < -1 && t < 0.5) return 'BEARISH — downtrend across timeframes, prefer HOLD/SELL, avoid catching falling knives';
    if (tw < -3 && f > 0) return 'RECOVERING — recent bounce after correction, be selective with entries';
    if (tw > 3 && f < 0) return 'CORRECTING — pullback in an uptrend, good for ACCUMULATE if fundamentals are strong';

    return 'SIDEWAYS — no clear trend, be selective and keep tight stop losses';
  }

  // Fetch live index LTP from Upstox (best-effort, non-critical)
  async _getIndexLTP() {
    try {
      const upstoxService = require('./upstoxService');
      if (!upstoxService || !upstoxService.fetchStockQuote) return null;
      const results = {};
      const symbols = ['SENSEX', 'BANKNIFTY'];
      for (const sym of symbols) {
        try {
          const data = await upstoxService.fetchStockQuote(sym);
          if (data && data.price) results[sym] = data.price;
        } catch (e) { /* skip */ }
      }
      return Object.keys(results).length > 0 ? results : null;
    } catch (e) {
      return null;
    }
  }

  // AI-Powered Stock Analysis with Real-time Data
  async analyzeStock(symbol) {
    try {
      // Get real-time stock data
      const stockData = await marketDataService.getMarketData(symbol);
      
      if (!stockData) {
        throw new Error(`Unable to fetch data for ${symbol}`);
      }

      const prompt = `
Analyze ${symbol} stock with the following LIVE DATA:

CURRENT PRICE: ₹${stockData.price}
CHANGE: ${stockData.change} (${stockData.changePercent}%)
VOLUME: ${stockData.volume}
DAY HIGH: ₹${stockData.dayHigh}
DAY LOW: ₹${stockData.dayLow}
PREVIOUS CLOSE: ₹${stockData.previousClose}

Provide a comprehensive analysis including:
1. Technical Analysis (support/resistance levels, trend analysis)
2. Price Action Assessment
3. Volume Analysis
4. Risk Assessment
5. Short-term and Medium-term Outlook
6. Entry/Exit Recommendations with specific price levels

Format as JSON:
{
  "symbol": "${symbol}",
  "currentPrice": ${stockData.price},
  "analysis": "detailed analysis text",
  "technicalRating": "BUY/HOLD/SELL",
  "confidence": 0-100,
  "keyLevels": {
    "support": price,
    "resistance": price,
    "stopLoss": price,
    "target": price
  },
  "riskFactors": ["factor1", "factor2"],
  "timeframe": "short/medium/long term"
}
`;

      const response = await this.callPerplexityAPI(prompt);
      
      // Try to parse JSON response
      let analysisData;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        // Fallback structured response
        analysisData = {
          symbol: symbol,
          currentPrice: stockData.price,
          analysis: response,
          technicalRating: stockData.changePercent > 2 ? 'BUY' : stockData.changePercent < -2 ? 'SELL' : 'HOLD',
          confidence: 75,
          keyLevels: {
            support: stockData.dayLow,
            resistance: stockData.dayHigh,
            stopLoss: stockData.price * 0.95,
            target: stockData.price * 1.1
          },
          riskFactors: ['Market volatility', 'Sector performance'],
          timeframe: 'medium term'
        };
      }

      return analysisData;

    } catch (error) {
      apiLogger.error('AIService', 'analyzeStock', error, { symbol });
      throw error;
    }
  }

  // AI-Powered News Sentiment Analysis
  async analyzeNewsSentiment(newsItems) {
    try {
      if (!newsItems || newsItems.length === 0) {
        return { sentiment: 'neutral', confidence: 0, analysis: 'No news available' };
      }

      // Prepare news summary for AI analysis
      const newsText = newsItems.slice(0, 10).map(item => 
        `${item.title}: ${item.summary}`
      ).join('\n\n');

      const prompt = `
Analyze the sentiment of these recent Indian stock market news items:

${newsText}

Provide sentiment analysis in JSON format:
{
  "overallSentiment": "bullish/neutral/bearish",
  "confidence": 0-100,
  "analysis": "detailed sentiment analysis",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "marketImpact": "high/medium/low",
  "affectedSectors": ["sector1", "sector2"],
  "recommendation": "investment recommendation based on news sentiment"
}
`;

      const response = await this.callPerplexityAPI(prompt);
      
      let sentimentData;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          sentimentData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        sentimentData = {
          overallSentiment: 'neutral',
          confidence: 50,
          analysis: response,
          keyThemes: ['Market volatility', 'Economic indicators'],
          marketImpact: 'medium',
          affectedSectors: ['Banking', 'IT'],
          recommendation: 'Monitor market conditions closely'
        };
      }

      return sentimentData;

    } catch (error) {
      apiLogger.error('AIService', 'analyzeNewsSentiment', error);
      throw error;
    }
  }

  // AI-Powered Portfolio Analysis
  async analyzePortfolio(holdings) {
    try {
      if (!holdings || holdings.length === 0) {
        return { analysis: 'No holdings to analyze', recommendations: [] };
      }

      // Get real-time data for all holdings
      const symbols = holdings.map(h => h.symbol);
      const marketData = await marketDataService.getBatchMarketData(symbols);

      // Calculate portfolio metrics
      let totalValue = 0;
      let totalGainLoss = 0;
      const holdingsWithData = holdings.map(holding => {
        const data = marketData[holding.symbol];
        if (data && data.status === 'success') {
          const currentValue = data.data.price * holding.quantity;
          const gainLoss = currentValue - (holding.avgPrice * holding.quantity);
          totalValue += currentValue;
          totalGainLoss += gainLoss;
          
          return {
            ...holding,
            currentPrice: data.data.price,
            currentValue,
            gainLoss,
            gainLossPercent: (gainLoss / (holding.avgPrice * holding.quantity)) * 100
          };
        }
        return holding;
      });

      const prompt = `
Analyze this portfolio with LIVE market data:

PORTFOLIO SUMMARY:
Total Value: ₹${totalValue.toFixed(2)}
Total Gain/Loss: ₹${totalGainLoss.toFixed(2)}
Overall Return: ${((totalGainLoss / (totalValue - totalGainLoss)) * 100).toFixed(2)}%

HOLDINGS:
${holdingsWithData.map(h => 
  `${h.symbol}: ${h.quantity} shares @ ₹${h.currentPrice || h.avgPrice} (${h.gainLossPercent ? h.gainLossPercent.toFixed(2) : 0}%)`
).join('\n')}

Provide comprehensive portfolio analysis in JSON:
{
  "overallRating": "excellent/good/average/poor",
  "riskLevel": "low/medium/high",
  "diversificationScore": 0-100,
  "analysis": "detailed portfolio analysis",
  "recommendations": [
    {
      "action": "BUY/SELL/HOLD",
      "symbol": "stock symbol",
      "reasoning": "why this action",
      "priority": "high/medium/low"
    }
  ],
  "rebalancingSuggestions": ["suggestion1", "suggestion2"],
  "riskFactors": ["risk1", "risk2"]
}
`;

      const response = await this.callPerplexityAPI(prompt);
      
      let portfolioAnalysis;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          portfolioAnalysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        portfolioAnalysis = {
          overallRating: 'average',
          riskLevel: 'medium',
          diversificationScore: 70,
          analysis: response,
          recommendations: [],
          rebalancingSuggestions: ['Consider diversifying across sectors'],
          riskFactors: ['Market volatility', 'Concentration risk']
        };
      }

      return {
        ...portfolioAnalysis,
        portfolioMetrics: {
          totalValue,
          totalGainLoss,
          overallReturn: ((totalGainLoss / (totalValue - totalGainLoss)) * 100).toFixed(2)
        }
      };

    } catch (error) {
      apiLogger.error('AIService', 'analyzePortfolio', error);
      throw error;
    }
  }

  // Call Perplexity API
  async callPerplexityAPI(prompt, model = 'llama-3.1-sonar-small-128k-online') {
    try {
      if (!this.apiKey) {
        throw new Error('Perplexity API key not configured');
      }

      const response = await axios.post(this.baseURL, {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert Indian stock market analyst with deep knowledge of NSE, BSE, technical analysis, and fundamental analysis. Provide accurate, actionable insights based on real-time data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const aiResponse = response.data.choices?.[0]?.message?.content;
      const usage = response.data.usage || {};
      trackAPI('perplexity', 'ai-service', { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, success: true, model });

      if (!aiResponse) {
        throw new Error('No response from AI service');
      }

      return aiResponse;

    } catch (error) {
      trackAPI('perplexity', 'ai-service', { success: false, model });
      if (error.response) {
        apiLogger.error('AIService', 'callPerplexityAPI', {
          status: error.response.status,
          data: error.response.data
        });
        throw new Error(`AI API Error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
      } else {
        apiLogger.error('AIService', 'callPerplexityAPI', error);
        throw new Error('Failed to connect to AI service');
      }
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get service statistics
  getStats() {
    return {
      cacheSize: this.cache.size,
      apiKeyConfigured: !!this.apiKey
    };
  }
}

module.exports = new AIService();