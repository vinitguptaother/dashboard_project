const express = require('express');
const axios = require('axios');
const Watchlist = require('../models/Watchlist');
const { apiLogger } = require('../middleware/logger');

const router = express.Router();

// Helper: get or create the default watchlist
async function getWatchlist() {
  let wl = await Watchlist.findOne({ userId: 'default' });
  if (!wl) {
    wl = new Watchlist({ userId: 'default', items: [] });
    await wl.save();
  }
  return wl;
}

// GET /api/watchlist — get all watchlist items
router.get('/', async (req, res) => {
  try {
    const wl = await getWatchlist();
    res.json({ status: 'success', data: wl.items || [] });
  } catch (error) {
    apiLogger.error('Watchlist', 'get', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch watchlist' });
  }
});

// POST /api/watchlist/add — add a stock to watchlist
router.post('/add', async (req, res) => {
  try {
    const { symbol, name, notes, priceWhenAdded } = req.body;
    if (!symbol) return res.status(400).json({ status: 'error', message: 'Symbol is required' });

    const wl = await getWatchlist();
    const upperSymbol = symbol.toUpperCase().trim();

    // Check duplicate
    if (wl.items.some(i => i.symbol === upperSymbol)) {
      return res.status(400).json({ status: 'error', message: `${upperSymbol} is already in your watchlist` });
    }

    wl.items.push({
      symbol: upperSymbol,
      name: name || upperSymbol,
      notes: notes || '',
      priceWhenAdded: priceWhenAdded || null,
    });
    await wl.save();

    res.json({ status: 'success', data: wl.items });
  } catch (error) {
    apiLogger.error('Watchlist', 'add', error);
    res.status(500).json({ status: 'error', message: 'Failed to add to watchlist' });
  }
});

// DELETE /api/watchlist/:symbol — remove stock from watchlist
router.delete('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const wl = await getWatchlist();
    wl.items = wl.items.filter(i => i.symbol !== symbol);
    await wl.save();
    res.json({ status: 'success', data: wl.items });
  } catch (error) {
    apiLogger.error('Watchlist', 'remove', error);
    res.status(500).json({ status: 'error', message: 'Failed to remove from watchlist' });
  }
});

// PUT /api/watchlist/:symbol/notes — update notes for a stock
router.put('/:symbol/notes', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase().trim();
    const { notes } = req.body;
    const wl = await getWatchlist();
    const item = wl.items.find(i => i.symbol === symbol);
    if (!item) return res.status(404).json({ status: 'error', message: 'Stock not in watchlist' });
    item.notes = notes || '';
    await wl.save();
    res.json({ status: 'success', data: item });
  } catch (error) {
    apiLogger.error('Watchlist', 'updateNotes', error);
    res.status(500).json({ status: 'error', message: 'Failed to update notes' });
  }
});

// POST /api/watchlist/analyze — run AI analysis on all watchlist stocks
router.post('/analyze', async (req, res) => {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) return res.status(500).json({ status: 'error', message: 'Perplexity API key not configured' });

    const wl = await getWatchlist();
    if (wl.items.length === 0) return res.json({ status: 'success', data: [], message: 'Watchlist is empty' });

    const symbols = wl.items.map(i => i.symbol);
    const symbolList = symbols.join(', ');

    const prompt = `Analyze these Indian stocks (NSE/BSE) for a swing trader's watchlist. Today is ${new Date().toISOString().split('T')[0]}.

STOCKS: ${symbolList}

For EACH stock, search Screener.in and Trendlyne for latest data and provide:
1. Score (0-24) across 6 parameters (0-4 each): health, growth, valuation, technical, orderFlow, institutional
2. A signal: BUY (strong setup now), SELL (exit/avoid), HOLD (keep watching), WATCH (interesting but wait)
3. A 2-3 sentence summary of what's happening with the stock right now

Return ONLY this JSON array:
[
  { "symbol": "STOCKNAME", "score": 18, "health": 3, "growth": 4, "valuation": 3, "technical": 3, "orderFlow": 3, "institutional": 2, "signal": "BUY", "summary": "Strong quarterly results with 30% profit growth. RSI at 55 with price above 200 DMA. FII increasing positions." },
  ...
]

IMPORTANT: Use the EXACT stock names I gave you. Analyze ALL stocks.`;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a senior Indian stock market analyst. Respond with ONLY valid JSON — no markdown, no text outside JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );

    const rawText = response.data?.choices?.[0]?.message?.content || '';
    let parsed = null;
    try { parsed = JSON.parse(rawText); } catch {}
    if (!parsed) {
      const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) try { parsed = JSON.parse(codeBlock[1].trim()); } catch {}
    }
    if (!parsed) {
      const start = rawText.search(/[\[{]/);
      const end = rawText.lastIndexOf(rawText[start] === '[' ? ']' : '}');
      if (start >= 0 && end > start) try { parsed = JSON.parse(rawText.slice(start, end + 1)); } catch {}
    }

    if (!Array.isArray(parsed)) {
      return res.status(500).json({ status: 'error', message: 'AI returned unparseable response' });
    }

    // Update watchlist items with analysis results
    const now = new Date();
    for (const result of parsed) {
      const item = wl.items.find(i => i.symbol === (result.symbol || '').toUpperCase());
      if (item) {
        item.lastAnalysis = {
          score: Math.min(24, Math.max(0, result.score || 0)),
          health: result.health || 0,
          growth: result.growth || 0,
          valuation: result.valuation || 0,
          technical: result.technical || 0,
          orderFlow: result.orderFlow || 0,
          institutional: result.institutional || 0,
          summary: result.summary || '',
          signal: ['BUY', 'SELL', 'HOLD', 'WATCH'].includes(result.signal) ? result.signal : 'WATCH',
          analyzedAt: now,
        };
      }
    }

    await wl.save();

    res.json({ status: 'success', data: wl.items });
  } catch (error) {
    apiLogger.error('Watchlist', 'analyze', error);
    const msg = error.response?.data?.error?.message || error.message;
    res.status(500).json({ status: 'error', message: `Analysis failed: ${msg}` });
  }
});

module.exports = router;
