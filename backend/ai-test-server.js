const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Mock auth middleware for testing
const mockAuth = (req, res, next) => {
  req.user = { id: 'test-user-123', email: 'test@example.com' };
  next();
};

// Helper function to check Perplexity API key
const checkPerplexityAPI = () => {
  if (!process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY === 'your_perplexity_api_key') {
    throw new Error('Perplexity API key not configured. Please add your API key to the .env file.');
  }
  return process.env.PERPLEXITY_API_KEY;
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'AI Test Server is running',
    timestamp: new Date().toISOString(),
    perplexityConfigured: !!process.env.PERPLEXITY_API_KEY
  });
});

// Test Perplexity API connection
app.get('/api/ai/test-connection', async (req, res) => {
  try {
    const apiKey = checkPerplexityAPI();
    
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'user',
            content: 'Hello! Please respond with "Perplexity AI is working correctly" to test the connection.'
          }
        ],
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const aiResponse = response.data.choices?.[0]?.message?.content;

    res.json({
      status: 'success',
      message: 'Perplexity API connection successful',
      response: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Perplexity API test error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: error.message.includes('API key') ? error.message : 'Failed to connect to Perplexity API',
      error: error.response?.data || error.message
    });
  }
});

// AI Chatbot endpoint
app.post('/api/ai/chat', mockAuth, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Message is required'
      });
    }

    const apiKey = checkPerplexityAPI();

    // Enhanced prompt for Indian stock market context
    const enhancedPrompt = `
You are an expert Indian stock market analyst. The user asks: "${message}"

Provide a comprehensive response considering:
1. Current Indian market conditions (NSE, BSE)
2. Major indices like NIFTY 50, SENSEX, BANK NIFTY
3. Popular Indian stocks like RELIANCE, TCS, HDFC, INFY, ICICIBANK
4. Technical and fundamental analysis
5. Risk assessment and actionable insights

Keep your response informative, professional, and specific to Indian markets.
`;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Indian stock market analyst with deep knowledge of NSE, BSE, technical analysis, and fundamental analysis.'
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices?.[0]?.message?.content;

    res.json({
      status: 'success',
      data: {
        userMessage: message,
        aiResponse: aiResponse,
        timestamp: new Date().toISOString(),
        model: 'llama-3.1-sonar-small-128k-online'
      }
    });

  } catch (error) {
    console.error('AI Chat error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: error.message.includes('API key') ? error.message : 'Failed to process chat message',
      error: error.response?.data?.error || error.message
    });
  }
});

// Stock analysis endpoint
app.post('/api/ai/analyze-stock', mockAuth, async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol || symbol.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Stock symbol is required'
      });
    }

    const apiKey = checkPerplexityAPI();

    const prompt = `
Analyze the Indian stock ${symbol.toUpperCase()} and provide:

1. Current market position and recent performance
2. Technical analysis (support/resistance levels, trends)
3. Fundamental strengths and weaknesses
4. Risk factors and opportunities
5. Investment recommendation (BUY/HOLD/SELL) with reasoning
6. Target price and stop-loss suggestions
7. Time horizon for the recommendation

Format your response in a structured manner with clear sections.
`;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Indian stock market analyst specializing in individual stock analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices?.[0]?.message?.content;

    res.json({
      status: 'success',
      data: {
        symbol: symbol.toUpperCase(),
        analysis: aiResponse,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Stock analysis error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to analyze stock',
      error: error.response?.data?.error || error.message
    });
  }
});

// Market insights endpoint
app.get('/api/ai/market-insights', mockAuth, async (req, res) => {
  try {
    const apiKey = checkPerplexityAPI();

    const prompt = `
Provide current Indian stock market insights including:

1. Overall market sentiment (Bullish/Neutral/Bearish)
2. Key market drivers and news affecting Indian markets today
3. Sector-wise performance and outlook
4. Major index levels and technical outlook (NIFTY 50, SENSEX, BANK NIFTY)
5. Top stock picks for different investment horizons
6. Risk factors to watch out for
7. Trading opportunities for today/this week

Keep the analysis current and actionable for Indian investors.
`;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Indian stock market analyst providing daily market insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices?.[0]?.message?.content;

    res.json({
      status: 'success',
      data: {
        insights: aiResponse,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Market insights error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get market insights',
      error: error.response?.data?.error || error.message
    });
  }
});

const PORT = 5005; // Use a different port to avoid conflicts

app.listen(PORT, () => {
  console.log(`🤖 AI Test Server running on port ${PORT}`);
  console.log(`🔗 Test endpoints:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Test API: http://localhost:${PORT}/api/ai/test-connection`);
  console.log(`   Chat: POST http://localhost:${PORT}/api/ai/chat`);
  console.log(`   Stock Analysis: POST http://localhost:${PORT}/api/ai/analyze-stock`);
  console.log(`   Market Insights: GET http://localhost:${PORT}/api/ai/market-insights`);
  console.log(`🔑 Perplexity API Key: ${process.env.PERPLEXITY_API_KEY ? 'Configured ✅' : 'Not configured ❌'}`);
});

module.exports = app;