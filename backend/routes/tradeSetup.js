// backend/routes/tradeSetup.js
// What this does: AI-powered trade setup generator.
// Takes stock symbols → asks Perplexity for entry, SL, target, duration → saves to MongoDB.

const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const TradeSetup = require('../models/TradeSetup');
const { apiLogger } = require('../middleware/logger');

const router = express.Router();

// ─────────────────────────────────────────────
// Helpers (same robust approach as aiAnalysis.js)
// ─────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You are an expert Indian stock market trader specializing in swing trades (2 days to 6 months) ' +
  'and long-term investments (6+ months) on NSE/BSE. ' +
  "Today's date is " + new Date().toISOString().split('T')[0] + '. ' +
  'You provide actionable trade setups with specific entry prices, stop losses, and targets. ' +
  'IMPORTANT: Respond with ONLY valid JSON — no markdown, no code blocks, no text outside the JSON. ' +
  'All prices must be realistic and in INR (₹). Always calculate the risk/reward ratio.';

// What this does: Try sonar-pro first, fall back to the smaller model if auth fails
const MODELS = ['sonar-pro', 'llama-3.1-sonar-small-128k-online'];

async function callPerplexity(apiKey, prompt) {
  let lastError = null;

  for (const model of MODELS) {
    try {
      apiLogger.info('TradeSetup', 'callPerplexity', { model, promptLength: prompt.length });
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          max_tokens: 3000,
          temperature: 0.3, // very factual for trade setups
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000, // 45s — this prompt is larger
        }
      );
      return response.data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const errMsg = err.response?.data?.error?.message || err.message;
      apiLogger.error('TradeSetup', `callPerplexity:${model}:failed`, null, { status, errMsg });
      // If it's a 401/403 (auth issue), try next model
      if (status === 401 || status === 403) continue;
      // For other errors (timeout, 429, 500), don't retry with a different model
      break;
    }
  }

  throw lastError || new Error('All Perplexity models failed');
}

function extractJSON(text) {
  if (!text) return null;
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') depth--;
    if (depth === 0) { end = i; break; }
  }
  if (end === -1) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

// ─────────────────────────────────────────────
// POST /api/trade-setup/generate
// Body: { symbols: string[], screenBatchId?: string, screenName?: string }
// Returns: AI-generated trade setups for each symbol
// ─────────────────────────────────────────────
router.post(
  '/generate',
  [
    body('symbols')
      .isArray({ min: 1, max: 50 })
      .withMessage('Provide 1-50 stock symbols'),
    body('symbols.*')
      .isString()
      .trim()
      .notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      // Check kill switch — block new trade generation if daily loss limit hit
      try {
        const RiskSettings = require('../models/RiskSettings');
        const riskSettings = await RiskSettings.findOne({ userId: 'default' });
        if (riskSettings && riskSettings.killSwitchActive) {
          return res.status(403).json({
            status: 'error',
            message: '🛑 Kill switch is active — daily loss limit reached. No new trade setups until tomorrow.',
          });
        }
      } catch (ksErr) {
        console.warn('Kill switch check failed, proceeding anyway:', ksErr.message);
      }

      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (!apiKey || apiKey === 'your_perplexity_api_key') {
        return res.status(500).json({
          status: 'error',
          message: 'Perplexity API key not configured',
        });
      }

      const { symbols, screenBatchId, screenName } = req.body;
      const cleanSymbols = symbols.map((s) => s.trim().toUpperCase());

      apiLogger.info('TradeSetup', 'generate:start', { symbols: cleanSymbols });

      // Fetch performance context from feedback loop (if screen has resolved trades)
      let performanceContext = '';
      try {
        const { getScreenContext } = require('../services/feedbackService');
        performanceContext = await getScreenContext(screenName);
        if (performanceContext) {
          apiLogger.info('TradeSetup', 'generate:feedbackContext', { screenName, contextLength: performanceContext.length });
        }
      } catch (fbErr) {
        console.warn('⚠️ Failed to get screen context, proceeding without:', fbErr.message);
      }

      const symbolList = cleanSymbols.join(', ');

      const prompt = `${performanceContext}Generate detailed trade setups for these Indian stocks: ${symbolList}

For EACH stock, determine if it's better suited for a swing trade (2 days to 6 months) or long-term investment (6+ months).

Return ONLY this JSON structure (no other text):
{
  "setups": [
    {
      "symbol": "STOCK_SYMBOL",
      "tradeType": "SWING" or "INVESTMENT",
      "action": "BUY" or "SELL" or "HOLD" or "AVOID",
      "currentPrice": <actual current price in INR>,
      "entryPrice": <recommended entry price — can be current price or a pullback level>,
      "stopLoss": <stop loss price — specific number>,
      "target": <target price — specific number>,
      "holdingDuration": "e.g. 2-4 weeks or 3-6 months",
      "confidence": <0-100>,
      "reasoning": "2-3 sentences explaining why this setup, including key technical/fundamental factors",
      "riskFactors": ["risk 1", "risk 2"]
    }
  ]
}

RULES:
- Use today's actual live prices for each stock
- Entry price should be at or near current price, or at a nearby support level
- Stop loss should be below a key support level (for BUY) or above resistance (for SELL)
- Target should be at a key resistance level (for BUY) or support (for SELL)
- Risk/reward should ideally be 1:2 or better
- If a stock looks bad, set action to "AVOID" with reasoning
- Be specific with price levels — no ranges, just numbers`;

      const aiText = await callPerplexity(apiKey, prompt);
      const parsed = extractJSON(aiText);
      const rawSetups = parsed?.setups || (Array.isArray(parsed) ? parsed : null);

      if (!rawSetups || rawSetups.length === 0) {
        apiLogger.error('TradeSetup', 'generate:parseFail', null, {
          aiResponse: aiText?.slice(0, 500),
        });
        return res.status(500).json({
          status: 'error',
          message: 'AI returned unparseable response. Please try again.',
        });
      }

      // Calculate risk/reward ratio and save to MongoDB
      const savedSetups = [];
      for (const setup of rawSetups) {
        const entry = Number(setup.entryPrice) || 0;
        const sl = Number(setup.stopLoss) || 0;
        const target = Number(setup.target) || 0;

        let riskRewardRatio = 'N/A';
        if (entry > 0 && sl > 0 && target > 0) {
          const risk = Math.abs(entry - sl);
          const reward = Math.abs(target - entry);
          if (risk > 0) {
            riskRewardRatio = `1:${(reward / risk).toFixed(1)}`;
          }
        }

        const doc = new TradeSetup({
          symbol: (setup.symbol || '').toUpperCase(),
          tradeType: setup.tradeType === 'INVESTMENT' ? 'INVESTMENT' : 'SWING',
          action: ['BUY', 'SELL', 'HOLD', 'AVOID'].includes(setup.action) ? setup.action : 'HOLD',
          entryPrice: entry,
          stopLoss: sl,
          target,
          currentPrice: Number(setup.currentPrice) || null,
          holdingDuration: setup.holdingDuration || 'Unknown',
          riskRewardRatio,
          confidence: Math.min(100, Math.max(0, Number(setup.confidence) || 50)),
          reasoning: setup.reasoning || '',
          riskFactors: Array.isArray(setup.riskFactors) ? setup.riskFactors : [],
          screenBatchId: screenBatchId || null,
          screenName: screenName || null,
          isPaperTrade: true,
        });

        try {
          const saved = await doc.save();
          savedSetups.push(saved);
        } catch (saveErr) {
          apiLogger.error('TradeSetup', 'generate:saveFail', saveErr, { symbol: setup.symbol });
          // Still include in response even if save fails
          savedSetups.push({ ...doc.toObject(), _saveError: true });
        }
      }

      apiLogger.info('TradeSetup', 'generate:complete', {
        requested: cleanSymbols.length,
        generated: savedSetups.length,
      });

      res.json({
        status: 'success',
        data: { setups: savedSetups },
      });
    } catch (error) {
      apiLogger.error('TradeSetup', 'generate', error);
      const status = error.response?.status;
      const perplexityMsg = error.response?.data?.error?.message;
      let userMessage = error.message || 'Failed to generate trade setups';
      if (status === 401) userMessage = 'Perplexity API key is invalid or expired. Go to Settings → update your key.';
      else if (status === 429) userMessage = 'Rate limit exceeded. Wait a minute and try again.';
      else if (perplexityMsg) userMessage = `Perplexity error: ${perplexityMsg}`;
      res.status(500).json({
        status: 'error',
        message: userMessage,
      });
    }
  }
);

// ─────────────────────────────────────────────
// GET /api/trade-setup/active
// Returns all active trade setups (not expired/hit)
// ─────────────────────────────────────────────
router.get('/active', async (req, res) => {
  try {
    const setups = await TradeSetup.find({ status: 'ACTIVE', action: { $in: ['BUY', 'SELL', 'ACCUMULATE'] } })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ status: 'success', data: setups });
  } catch (error) {
    apiLogger.error('TradeSetup', 'active', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch active setups' });
  }
});

// ─────────────────────────────────────────────
// GET /api/trade-setup/history
// Returns past trade setups (all statuses)
// ─────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, screen } = req.query;
    const filter = {};
    if (screen) filter.screenName = screen;

    const setups = await TradeSetup.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ status: 'success', data: setups });
  } catch (error) {
    apiLogger.error('TradeSetup', 'history', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch setup history' });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/trade-setup/:id/status
// Update setup status (TARGET_HIT, SL_HIT, EXPIRED, CANCELLED)
// ─────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['ACTIVE', 'TARGET_HIT', 'SL_HIT', 'EXPIRED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: `Invalid status. Use: ${validStatuses.join(', ')}` });
    }

    const updated = await TradeSetup.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Setup not found' });
    }

    res.json({ status: 'success', data: updated });
  } catch (error) {
    apiLogger.error('TradeSetup', 'updateStatus', error);
    res.status(500).json({ status: 'error', message: 'Failed to update status' });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/trade-setup/:id/edit
// Edit SL, target, or entry price on an ACTIVE setup
// ─────────────────────────────────────────────
router.patch('/:id/edit', async (req, res) => {
  try {
    const { entryPrice, stopLoss, target } = req.body;

    if (entryPrice === undefined && stopLoss === undefined && target === undefined) {
      return res.status(400).json({ status: 'error', message: 'Provide at least one of: entryPrice, stopLoss, target' });
    }

    const setup = await TradeSetup.findById(req.params.id);
    if (!setup) {
      return res.status(404).json({ status: 'error', message: 'Setup not found' });
    }
    if (setup.status !== 'ACTIVE') {
      return res.status(400).json({ status: 'error', message: `Cannot edit a ${setup.status} setup — only ACTIVE setups can be modified` });
    }

    // Apply changes
    if (entryPrice !== undefined) setup.entryPrice = Number(entryPrice);
    if (stopLoss !== undefined) setup.stopLoss = Number(stopLoss);
    if (target !== undefined) setup.target = Number(target);

    // Recalculate R:R ratio
    const entry = setup.entryPrice;
    const sl = setup.stopLoss;
    const tgt = setup.target;
    if (entry > 0 && sl > 0 && tgt > 0) {
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tgt - entry);
      setup.riskRewardRatio = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : 'N/A';
    }

    setup.updatedAt = new Date();
    const saved = await setup.save();
    apiLogger.info('TradeSetup', 'edit', { id: saved._id, symbol: saved.symbol, entryPrice: saved.entryPrice, stopLoss: saved.stopLoss, target: saved.target });

    res.json({ status: 'success', data: saved });
  } catch (error) {
    apiLogger.error('TradeSetup', 'edit', error);
    res.status(500).json({ status: 'error', message: 'Failed to edit setup' });
  }
});

// ─────────────────────────────────────────────
// POST /api/trade-setup/paper
// Save an AI recommendation as a paper trade (no AI call needed)
// ─────────────────────────────────────────────
router.post('/paper', async (req, res) => {
  try {
    const { symbol, action, entryPrice, stopLoss, target, confidence, reasoning, riskFactors, holdingDuration, tradeType } = req.body;

    if (!symbol || !action || !entryPrice || !stopLoss || !target) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields: symbol, action, entryPrice, stopLoss, target' });
    }

    if (!['BUY', 'SELL', 'ACCUMULATE'].includes(action)) {
      return res.status(400).json({ status: 'error', message: 'Paper trades only support BUY, SELL, or ACCUMULATE actions' });
    }

    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tgt = Number(target);

    let riskRewardRatio = 'N/A';
    if (entry > 0 && sl > 0 && tgt > 0) {
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tgt - entry);
      if (risk > 0) riskRewardRatio = `1:${(reward / risk).toFixed(1)}`;
    }

    const doc = new TradeSetup({
      symbol: symbol.toUpperCase(),
      tradeType: tradeType || 'SWING',
      action,
      entryPrice: entry,
      stopLoss: sl,
      target: tgt,
      currentPrice: entry,
      holdingDuration: holdingDuration || '2-4 weeks',
      riskRewardRatio,
      confidence: Math.min(100, Math.max(0, Number(confidence) || 50)),
      reasoning: reasoning || '',
      riskFactors: Array.isArray(riskFactors) ? riskFactors : [],
      isPaperTrade: true,
      source: 'AI_ANALYSIS',
    });

    const saved = await doc.save();
    apiLogger.info('TradeSetup', 'paper:created', { symbol: saved.symbol, id: saved._id });

    res.json({ status: 'success', data: saved });
  } catch (error) {
    apiLogger.error('TradeSetup', 'paper:create', error);
    res.status(500).json({ status: 'error', message: 'Failed to save paper trade' });
  }
});

// ─────────────────────────────────────────────
// GET /api/trade-setup/paper-stats
// Detailed paper trading analytics — win rate, confidence calibration, performance
// ─────────────────────────────────────────────
router.get('/paper-stats', async (req, res) => {
  try {
    const allPaper = await TradeSetup.find({ isPaperTrade: true }).sort({ createdAt: -1 });

    const active = allPaper.filter(t => t.status === 'ACTIVE');
    const wins = allPaper.filter(t => t.status === 'TARGET_HIT');
    const losses = allPaper.filter(t => t.status === 'SL_HIT');
    const resolved = [...wins, ...losses];

    const winRate = resolved.length > 0 ? parseFloat(((wins.length / resolved.length) * 100).toFixed(1)) : null;

    // Average P&L % for resolved trades
    let avgReturnPct = null;
    let bestTrade = null;
    let worstTrade = null;
    if (resolved.length > 0) {
      const returns = resolved.map(t => {
        const exit = t.exitPrice || (t.status === 'TARGET_HIT' ? t.target : t.stopLoss);
        const pnlPct = (t.action === 'BUY' || t.action === 'ACCUMULATE')
          ? ((exit - t.entryPrice) / t.entryPrice) * 100
          : ((t.entryPrice - exit) / t.entryPrice) * 100;
        return { symbol: t.symbol, pnlPct: parseFloat(pnlPct.toFixed(2)), id: t._id, date: t.closedAt || t.updatedAt };
      });
      avgReturnPct = parseFloat((returns.reduce((s, r) => s + r.pnlPct, 0) / returns.length).toFixed(2));
      bestTrade = returns.reduce((best, r) => r.pnlPct > best.pnlPct ? r : best, returns[0]);
      worstTrade = returns.reduce((worst, r) => r.pnlPct < worst.pnlPct ? r : worst, returns[0]);
    }

    // Confidence calibration — group by confidence brackets
    const brackets = [
      { label: '0-40', min: 0, max: 40 },
      { label: '40-60', min: 40, max: 60 },
      { label: '60-80', min: 60, max: 80 },
      { label: '80-100', min: 80, max: 101 },
    ];
    const confidenceCalibration = brackets.map(b => {
      const inBracket = resolved.filter(t => t.confidence >= b.min && t.confidence < b.max);
      const bracketWins = inBracket.filter(t => t.status === 'TARGET_HIT');
      return {
        bracket: b.label,
        total: inBracket.length,
        wins: bracketWins.length,
        winRate: inBracket.length > 0 ? parseFloat(((bracketWins.length / inBracket.length) * 100).toFixed(1)) : null,
      };
    });

    // Weekly performance (last 12 weeks)
    const weeklyPerformance = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekTrades = resolved.filter(t => {
        const d = t.closedAt || t.updatedAt;
        return d >= weekStart && d < weekEnd;
      });
      const weekWins = weekTrades.filter(t => t.status === 'TARGET_HIT');
      if (weekTrades.length > 0) {
        weeklyPerformance.push({
          weekStart: weekStart.toISOString().split('T')[0],
          trades: weekTrades.length,
          wins: weekWins.length,
          winRate: parseFloat(((weekWins.length / weekTrades.length) * 100).toFixed(1)),
        });
      }
    }

    res.json({
      status: 'success',
      data: {
        total: allPaper.length,
        active: active.length,
        wins: wins.length,
        losses: losses.length,
        expired: allPaper.filter(t => t.status === 'EXPIRED').length,
        cancelled: allPaper.filter(t => t.status === 'CANCELLED').length,
        winRate,
        avgReturnPct,
        bestTrade,
        worstTrade,
        confidenceCalibration,
        weeklyPerformance: weeklyPerformance.reverse(),
        recentTrades: allPaper.slice(0, 50),
      },
    });
  } catch (error) {
    apiLogger.error('TradeSetup', 'paper-stats', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch paper trading stats' });
  }
});

// ─────────────────────────────────────────────
// GET /api/trade-setup/stats
// Returns win rate, counts by status, and active setup count
// ─────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [active, targetHit, slHit, expired, cancelled, total] = await Promise.all([
      TradeSetup.countDocuments({ status: 'ACTIVE' }),
      TradeSetup.countDocuments({ status: 'TARGET_HIT' }),
      TradeSetup.countDocuments({ status: 'SL_HIT' }),
      TradeSetup.countDocuments({ status: 'EXPIRED' }),
      TradeSetup.countDocuments({ status: 'CANCELLED' }),
      TradeSetup.countDocuments({}),
    ]);

    const resolved = targetHit + slHit;
    const winRate = resolved > 0 ? parseFloat(((targetHit / resolved) * 100).toFixed(1)) : null;

    res.json({
      status: 'success',
      data: {
        total,
        active,
        targetHit,
        slHit,
        expired,
        cancelled,
        winRate,
      },
    });
  } catch (error) {
    apiLogger.error('TradeSetup', 'stats', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch stats' });
  }
});

module.exports = router;
