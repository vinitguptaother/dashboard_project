const express = require('express');
const axios = require('axios');

const router = express.Router();

// Model fallback: sonar-pro first, then smaller model
const MODELS = ['sonar-pro', 'llama-3.1-sonar-small-128k-online'];

async function callPerplexity(apiKey, systemPrompt, userMessage, options = {}) {
  const { maxTokens = 1500, temperature = 0.7, searchMode = false } = options;
  let lastError = null;

  for (const model of MODELS) {
    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature,
          ...(searchMode ? { search_recency_filter: 'day' } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      const content = response.data.choices?.[0]?.message?.content || '';
      const citations = response.data.citations || [];

      return { content, citations, model };
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // Auth issue → try next model
      if (status === 401 || status === 403) continue;
      // Other errors → don't retry
      break;
    }
  }

  throw lastError || new Error('All Perplexity models failed');
}

// POST /api/perplexity/ask
// General chat endpoint
router.post('/ask', async (req, res) => {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey || apiKey === 'your_perplexity_api_key') {
      return res.status(400).json({ status: 'error', message: 'Perplexity API key not configured' });
    }

    const { question } = req.body || {};
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'Question is required' });
    }

    const systemPrompt =
      'You are an expert Indian stock market analyst with deep knowledge of NSE, BSE, technical and fundamental analysis. ' +
      'You have access to real-time internet data. Answer clearly and concisely. ' +
      'When discussing stocks, include current prices and recent news if available. ' +
      'Format your response with clear sections using line breaks.';

    const result = await callPerplexity(apiKey, systemPrompt, question);

    return res.json({
      status: 'success',
      data: {
        answer: result.content,
        citations: result.citations,
        model: result.model,
      },
    });
  } catch (error) {
    const status = error.response?.status || 500;
    console.error('Perplexity API Error:', {
      status,
      message: error.response?.data || error.message,
    });

    let userMessage = 'Failed to get response from Perplexity';
    if (status === 401) userMessage = 'Perplexity API key is invalid or expired. Update it in Settings.';
    else if (status === 429) userMessage = 'Rate limit exceeded. Wait a minute and try again.';

    return res.status(500).json({ status: 'error', message: userMessage });
  }
});

// POST /api/perplexity/search
// Explicit web search endpoint — searches the internet for real-time info
router.post('/search', async (req, res) => {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey || apiKey === 'your_perplexity_api_key') {
      return res.status(400).json({ status: 'error', message: 'Perplexity API key not configured' });
    }

    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ status: 'error', message: 'Search query is required' });
    }

    const systemPrompt =
      'You are a real-time internet search assistant specialized in the Indian stock market (NSE/BSE). ' +
      "Today's date is " + new Date().toISOString().split('T')[0] + '. ' +
      'Search the internet for the most up-to-date information. ' +
      'Always include: source names, dates, and specific numbers/prices when available. ' +
      'Format your response clearly with bullet points or numbered lists. ' +
      'If providing stock prices, mention whether they are live or last closing prices.';

    const result = await callPerplexity(apiKey, systemPrompt, query, {
      maxTokens: 2000,
      temperature: 0.3,
      searchMode: true,
    });

    return res.json({
      status: 'success',
      data: {
        answer: result.content,
        citations: result.citations,
        model: result.model,
      },
    });
  } catch (error) {
    const status = error.response?.status || 500;
    console.error('Perplexity Search Error:', {
      status,
      message: error.response?.data || error.message,
    });

    let userMessage = 'Search failed';
    if (status === 401) userMessage = 'Perplexity API key is invalid or expired. Update it in Settings.';
    else if (status === 429) userMessage = 'Rate limit exceeded. Wait a minute and try again.';

    return res.status(500).json({ status: 'error', message: userMessage });
  }
});

module.exports = router;
