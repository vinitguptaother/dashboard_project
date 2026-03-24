const axios = require('axios');
const marketDataService = require('./marketDataService');
const newsService = require('./newsService');
const { apiLogger } = require('../middleware/logger');

class AIService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.baseURL = 'https://api.perplexity.ai/chat/completions';
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes cache for AI responses
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

  // Get Real-time Market Context
  async getMarketContext() {
    try {
      // Get major indices
      const indices = ['NIFTY', 'SENSEX', 'BANKNIFTY'];
      const marketData = await marketDataService.getBatchMarketData(indices);
      
      // Get top stocks
      const topStocks = ['RELIANCE', 'TCS', 'HDFC', 'INFY', 'ICICIBANK'];
      const stockData = await marketDataService.getBatchMarketData(topStocks);
      
      // Format market context
      let context = "LIVE MARKET DATA:\n\n";
      
      // Add indices data
      context += "MAJOR INDICES:\n";
      indices.forEach(symbol => {
        const data = marketData[symbol];
        if (data && data.status === 'success') {
          const stock = data.data;
          context += `${symbol}: ₹${stock.price} (${stock.change >= 0 ? '+' : ''}${stock.change}, ${stock.changePercent}%)\n`;
        }
      });
      
      // Add top stocks data
      context += "\nTOP STOCKS:\n";
      topStocks.forEach(symbol => {
        const data = stockData[symbol];
        if (data && data.status === 'success') {
          const stock = data.data;
          context += `${symbol}: ₹${stock.price} (${stock.change >= 0 ? '+' : ''}${stock.change}, ${stock.changePercent}%)\n`;
        }
      });
      
      // Add market sentiment
      const marketSentiment = this.calculateMarketSentiment(marketData, stockData);
      context += `\nMARKET SENTIMENT: ${marketSentiment}\n`;
      
      return context;

    } catch (error) {
      apiLogger.error('AIService', 'getMarketContext', error);
      return "Market data temporarily unavailable.";
    }
  }

  // Calculate Market Sentiment from Real Data
  calculateMarketSentiment(indicesData, stockData) {
    let positiveCount = 0;
    let totalCount = 0;
    
    // Check indices sentiment
    Object.values(indicesData).forEach(data => {
      if (data.status === 'success') {
        totalCount++;
        if (data.data.changePercent > 0) positiveCount++;
      }
    });
    
    // Check stocks sentiment
    Object.values(stockData).forEach(data => {
      if (data.status === 'success') {
        totalCount++;
        if (data.data.changePercent > 0) positiveCount++;
      }
    });
    
    const positiveRatio = positiveCount / totalCount;
    
    if (positiveRatio >= 0.7) return "BULLISH";
    if (positiveRatio >= 0.4) return "NEUTRAL";
    return "BEARISH";
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
      
      if (!aiResponse) {
        throw new Error('No response from AI service');
      }

      return aiResponse;

    } catch (error) {
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