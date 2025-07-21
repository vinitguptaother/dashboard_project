const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Mock API configurations
let apis = [
  {
    id: 'yahoo_finance_demo',
    name: 'Yahoo Finance',
    provider: 'Yahoo',
    category: 'market-data',
    endpoint: 'https://query1.finance.yahoo.com/v8/finance/chart',
    description: 'Real-time market data from Yahoo Finance',
    status: 'connected',
    lastUpdate: new Date().toISOString(),
    latency: '120ms',
    requestsToday: 123,
    rateLimit: '2000/day',
    createdAt: new Date().toISOString(),
    headers: {},
    parameters: {}
  },
  {
    id: 'perplexity_ai',
    name: 'Perplexity AI',
    provider: 'Perplexity',
    category: 'ai-ml',
    endpoint: 'https://api.perplexity.ai/v1/ask',
    description: 'Perplexity AI API integration',
    status: 'connected',
    lastUpdate: new Date().toISOString(),
    latency: '100ms',
    requestsToday: 0,
    rateLimit: '1000/day',
    createdAt: new Date().toISOString(),
    apiKey: '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',
    headers: { 'Authorization': 'Bearer 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' },
    parameters: {}
  }
];

// GET /api/config/apis
app.get('/api/config/apis', (req, res) => {
  res.json({ status: 'success', apis });
});

// GET /api/config/stats
app.get('/api/config/stats', (req, res) => {
  res.json({
    status: 'success',
    stats: {
      connected: apis.filter(api => api.status === 'connected').length,
      totalRequests: apis.reduce((sum, api) => sum + api.requestsToday, 0),
      uptime: 99.9,
      avgLatency: 120
    }
  });
});

// Proxy endpoint to Perplexity AI
app.post('/api/perplexity/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }
  try {
    // Perplexity's /chat/completions endpoint expects OpenAI-style payload
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'pplx-70b-online', // You may change this to another model if needed
        messages: [
          { role: 'user', content: question }
        ]
      },
      {
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Perplexity API error' });
  }
});

// Start the server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
}); 