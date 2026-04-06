const express = require('express');
const router = express.Router();
const axios = require('axios');
const optionsService = require('../services/optionsService');
const optionsMath = require('../utils/optionsMath');
const OptionsTrade = require('../models/OptionsTrade');
const RealTrade = require('../models/RealTrade');
const trackAPI = require('../utils/trackAPI');

// GET /api/options/expiries/:underlying
// Returns available expiry dates for an underlying (NIFTY, BANKNIFTY, etc.)
router.get('/expiries/:underlying', async (req, res) => {
  try {
    const { underlying } = req.params;
    const result = await optionsService.getExpiries(underlying);
    res.json({ status: 'success', data: result });
  } catch (error) {
    console.error('Options expiries error:', error.message);
    res.status(500).json({
      status: 'error',
      message: error.response?.data?.message || error.message || 'Failed to fetch expiries',
    });
  }
});

// GET /api/options/chain/:underlying?expiry=YYYY-MM-DD
// Returns full option chain with strikes, OI, IV, Greeks
router.get('/chain/:underlying', async (req, res) => {
  try {
    const { underlying } = req.params;
    const { expiry } = req.query;

    if (!expiry) {
      return res.status(400).json({ status: 'error', message: 'expiry query param required (YYYY-MM-DD)' });
    }

    const result = await optionsService.getOptionChain(underlying, expiry);
    res.json({ status: 'success', data: result });
  } catch (error) {
    console.error('Options chain error:', error.message);
    res.status(500).json({
      status: 'error',
      message: error.response?.data?.message || error.message || 'Failed to fetch option chain',
    });
  }
});

// GET /api/options/contract/:instrumentKey
// Returns contract details (lot size, tick size, etc.)
router.get('/contract/:instrumentKey', async (req, res) => {
  try {
    const { instrumentKey } = req.params;
    // URL-decode the instrument key (e.g. NSE_INDEX%7CNifty%2050 → NSE_INDEX|Nifty 50)
    const decoded = decodeURIComponent(instrumentKey);
    const result = await optionsService.getContractDetails(decoded);
    res.json({ status: 'success', data: result });
  } catch (error) {
    console.error('Options contract error:', error.message);
    res.status(500).json({
      status: 'error',
      message: error.response?.data?.message || error.message || 'Failed to fetch contract details',
    });
  }
});

// POST /api/options/payoff
// Calculate payoff curve, breakevens, max P&L, SD bands, Greeks for a strategy
router.post('/payoff', (req, res) => {
  try {
    const { legs, spotPrice, iv, daysToExpiry } = req.body;

    if (!legs || !legs.length || !spotPrice) {
      return res.status(400).json({ status: 'error', message: 'legs[] and spotPrice required' });
    }

    // Calculate SD bands for range
    const avgIV = iv || 0.15; // fallback 15%
    const dte = daysToExpiry || 1;
    const sdMoves = optionsMath.calculateSDMoves(spotPrice, avgIV, dte);

    // Payoff range: +/- 2.5 SD from spot
    const range = sdMoves.sdValue * 2.5 || spotPrice * 0.1;
    const spotMin = spotPrice - range;
    const spotMax = spotPrice + range;

    const payoffData = optionsMath.calculatePayoff(legs, spotMin, spotMax, 200);
    const breakevens = optionsMath.calculateBreakevens(payoffData);
    const maxPL = optionsMath.calculateMaxProfitLoss(payoffData);
    const greeks = optionsMath.aggregateGreeks(legs);
    const premium = optionsMath.calculateNetPremium(legs);
    const pop = optionsMath.calculatePOP(breakevens, spotPrice, avgIV, dte, premium.type);

    res.json({
      status: 'success',
      data: {
        payoffData,
        breakevens,
        maxProfit: maxPL.maxProfit,
        maxLoss: maxPL.maxLoss,
        riskReward: maxPL.riskReward,
        sdMoves,
        greeks,
        netPremium: premium.netPremium,
        premiumType: premium.type,
        pop,
      },
    });
  } catch (error) {
    console.error('Options payoff error:', error.message);
    res.status(500).json({ status: 'error', message: error.message || 'Payoff calculation failed' });
  }
});

// POST /api/options/payoff-at-date
// Calculate projected P&L curve at a target date using Black-Scholes pricing
router.post('/payoff-at-date', (req, res) => {
  try {
    const { legs, spotPrice, iv, daysToExpiry, targetDaysRemaining } = req.body;

    if (!legs || !legs.length || !spotPrice) {
      return res.status(400).json({ status: 'error', message: 'legs[], spotPrice required' });
    }

    const avgIV = iv || 0.15;
    const dte = daysToExpiry || 1;
    const targetDays = targetDaysRemaining != null ? targetDaysRemaining : Math.floor(dte / 2);
    const sdMoves = optionsMath.calculateSDMoves(spotPrice, avgIV, dte);

    const range = sdMoves.sdValue * 2.5 || spotPrice * 0.1;
    const spotMin = spotPrice - range;
    const spotMax = spotPrice + range;

    const targetDatePayoffData = optionsMath.calculatePayoffAtDate(
      legs, spotMin, spotMax, 200, targetDays, 0.07
    );

    res.json({
      status: 'success',
      data: { targetDatePayoffData, targetDaysRemaining: targetDays },
    });
  } catch (error) {
    console.error('Options payoff-at-date error:', error.message);
    res.status(500).json({ status: 'error', message: error.message || 'Target date calculation failed' });
  }
});

// POST /api/options/payoff-grid
// Calculate 2D P&L grid (spot × date) for the P&L table
router.post('/payoff-grid', (req, res) => {
  try {
    const { legs, spotPrice, daysToExpiry, spotSteps, dateSteps } = req.body;

    if (!legs || !legs.length || !spotPrice) {
      return res.status(400).json({ status: 'error', message: 'legs[], spotPrice required' });
    }

    const grid = optionsMath.calculatePayoffGrid(
      legs, spotPrice, daysToExpiry || 1, spotSteps || 15, dateSteps || null, 0.07
    );

    res.json({ status: 'success', data: grid });
  } catch (error) {
    console.error('Options payoff-grid error:', error.message);
    res.status(500).json({ status: 'error', message: error.message || 'Grid calculation failed' });
  }
});

// ─── Phase 3: Margin Calculator ────────────────────────────────────────────────

// POST /api/options/margin
// Calculate SPAN margin for a strategy via Upstox margin API
router.post('/margin', async (req, res) => {
  try {
    const { legs } = req.body;
    if (!legs || !legs.length) {
      return res.status(400).json({ status: 'error', message: 'legs[] required' });
    }

    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
    if (!accessToken) {
      return res.status(500).json({ status: 'error', message: 'Upstox token not configured' });
    }

    // Build instruments array for Upstox margin API
    const instruments = legs.map(leg => ({
      instrument_key: leg.instrumentKey,
      quantity: (leg.qty || 1) * (leg.lotSize || 1),
      transaction_type: leg.side === 'BUY' ? 'BUY' : 'SELL',
      product: 'D', // Delivery/NRML
    }));

    const response = await axios.post(
      'https://api.upstox.com/v2/charges/margin',
      { instruments },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      }
    );

    const marginData = response.data?.data || {};
    res.json({
      status: 'success',
      data: {
        totalMargin: marginData.required_margin || marginData.total_margin || 0,
        spanMargin: marginData.span || marginData.span_margin || 0,
        exposureMargin: marginData.exposure || marginData.exposure_margin || 0,
        marginBenefit: marginData.margin_benefit || 0,
        raw: marginData,
      },
    });
  } catch (error) {
    console.error('Options margin error:', error.response?.data || error.message);
    // Return a graceful fallback if margin API fails
    res.json({
      status: 'success',
      data: {
        totalMargin: 0,
        spanMargin: 0,
        exposureMargin: 0,
        marginBenefit: 0,
        error: error.response?.data?.message || error.message || 'Margin API unavailable',
      },
    });
  }
});

// ─── Phase 3: AI Strategy Analysis ─────────────────────────────────────────────

// POST /api/options/ai-analysis
// Perplexity AI analysis of an options strategy
router.post('/ai-analysis', async (req, res) => {
  try {
    const { underlying, strategyName, legs, spotPrice, netPremium, maxProfit, maxLoss, breakevens, pop } = req.body;

    if (!legs || !legs.length) {
      return res.status(400).json({ status: 'error', message: 'Strategy legs required' });
    }

    // Build market context
    let marketContext = '';
    try {
      const aiService = require('../services/aiService');
      marketContext = await aiService.getMarketContext();
    } catch (e) { /* market context is optional */ }

    const legsDesc = legs.map(l =>
      `${l.side} ${l.qty} lot ${l.type} ${l.strike} @ ₹${l.premium}`
    ).join(', ');

    const prompt = `You are an expert Indian options trader. Analyze this options strategy and provide a concise risk assessment.

${marketContext}

Strategy: ${strategyName || 'Custom'} on ${underlying}
Spot Price: ₹${spotPrice}
Legs: ${legsDesc}
Net Premium: ₹${netPremium} (${netPremium >= 0 ? 'Credit' : 'Debit'})
Max Profit: ${maxProfit}
Max Loss: ${maxLoss}
Breakevens: ${breakevens?.join(', ') || 'None'}
POP: ${pop}%

Provide:
1. **Risk Assessment** (2-3 sentences): Is this strategy appropriate given current market conditions?
2. **Key Risks** (2-3 bullet points): What could go wrong?
3. **Adjustments** (1-2 suggestions): How to improve risk/reward if market moves against?
4. **Verdict**: FAVORABLE / NEUTRAL / RISKY (one word with 1-line reasoning)

Keep it concise and actionable. Focus on practical advice for an Indian market trader.`;

    const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY_KEY) {
      return res.status(500).json({ status: 'error', message: 'Perplexity API key not configured' });
    }

    const model = 'sonar-pro';
    const aiResponse = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = aiResponse.data?.choices?.[0]?.message?.content || '';
    const usage = aiResponse.data?.usage || {};

    trackAPI('perplexity', 'options-ai-analysis', {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      success: true,
      model,
    });

    res.json({ status: 'success', data: { analysis: content } });
  } catch (error) {
    console.error('Options AI analysis error:', error.message);
    trackAPI('perplexity', 'options-ai-analysis', { success: false, error: error.message });
    res.status(500).json({ status: 'error', message: error.message || 'AI analysis failed' });
  }
});

// ─── Phase 4: Options Mock Trading ─────────────────────────────────────────────

// GET /api/options/trades — List all options mock trades
router.get('/trades', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const trades = await OptionsTrade.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ status: 'success', data: trades });
  } catch (error) {
    console.error('Options trades list error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/options/trades — Create a new mock trade
router.post('/trades', async (req, res) => {
  try {
    const trade = new OptionsTrade(req.body);
    await trade.save();
    res.json({ status: 'success', data: trade });
  } catch (error) {
    console.error('Options trade create error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PUT /api/options/trades/:id — Update/close a trade
router.put('/trades/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If closing the trade, set closedAt
    if (updates.status === 'closed' && !updates.closedAt) {
      updates.closedAt = new Date();
    }

    const trade = await OptionsTrade.findByIdAndUpdate(id, updates, { new: true });
    if (!trade) return res.status(404).json({ status: 'error', message: 'Trade not found' });
    res.json({ status: 'success', data: trade });
  } catch (error) {
    console.error('Options trade update error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// DELETE /api/options/trades/:id — Delete a trade
router.delete('/trades/:id', async (req, res) => {
  try {
    const trade = await OptionsTrade.findByIdAndDelete(req.params.id);
    if (!trade) return res.status(404).json({ status: 'error', message: 'Trade not found' });
    res.json({ status: 'success', message: 'Trade deleted' });
  } catch (error) {
    console.error('Options trade delete error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/options/trades/stats — Win rate, avg P&L stats
router.get('/trades/stats', async (req, res) => {
  try {
    const closed = await OptionsTrade.find({ status: 'closed', exitPnl: { $ne: null } }).lean();
    const total = closed.length;
    const wins = closed.filter(t => t.exitPnl > 0).length;
    const totalPnl = closed.reduce((sum, t) => sum + (t.exitPnl || 0), 0);
    const avgPnl = total > 0 ? totalPnl / total : 0;
    const openCount = await OptionsTrade.countDocuments({ status: 'open' });

    res.json({
      status: 'success',
      data: {
        totalTrades: total,
        wins,
        losses: total - wins,
        winRate: total > 0 ? parseFloat(((wins / total) * 100).toFixed(1)) : 0,
        totalPnl: parseFloat(totalPnl.toFixed(2)),
        avgPnl: parseFloat(avgPnl.toFixed(2)),
        openTrades: openCount,
      },
    });
  } catch (error) {
    console.error('Options trades stats error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── AI Review of a Closed Paper Trade ────────────────────────────────────────

// POST /api/options/trades/:id/ai-review
// AI post-trade review — what worked, what didn't, key lesson
router.post('/trades/:id/ai-review', async (req, res) => {
  try {
    const trade = await OptionsTrade.findById(req.params.id).lean();
    if (!trade) return res.status(404).json({ status: 'error', message: 'Trade not found' });

    const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
    if (!PERPLEXITY_KEY) return res.status(500).json({ status: 'error', message: 'Perplexity API key not configured' });

    const legsDesc = trade.legs.map(l => `${l.side} ${l.qty}x ${l.type} ${l.strike} @ ₹${l.premium}`).join(', ');
    const pnlText = trade.exitPnl !== null
      ? `₹${trade.exitPnl} (${trade.exitPnl >= 0 ? 'PROFIT' : 'LOSS'})`
      : 'Not yet closed';

    // Build market context (optional, non-blocking)
    let marketContext = '';
    try {
      const aiService = require('../services/aiService');
      marketContext = await aiService.getMarketContext();
    } catch (e) { /* ok to skip */ }

    const prompt = `You are an expert Indian options trader reviewing a completed paper trade.

${marketContext}

Trade Details:
- Strategy: ${trade.strategyName} on ${trade.underlying}
- Expiry: ${trade.expiry}
- Legs: ${legsDesc}
- Entry Spot: ₹${trade.entrySpot}
- Net Premium: ₹${trade.netPremium} (${trade.premiumType})
- POP at Entry: ${trade.pop}%
- Max Profit: ${trade.maxProfit} | Max Loss: ${trade.maxLoss}
- Breakevens: ${trade.breakevens?.join(' / ') || 'N/A'}
- Exit P&L: ${pnlText}

Give a concise post-trade review:
1. **What Worked** (1-2 sentences)
2. **What Went Wrong** (1-2 sentences, skip if profitable)
3. **Key Lesson** (1 actionable sentence for the next trade)
4. **Grade**: A / B / C / D with 1-line reason

Keep it short and practical. Focus on what Vinit can learn for his next options trade on Indian markets.`;

    const model = 'sonar-pro';
    const aiResponse = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      { model, messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.3 },
      { headers: { 'Authorization': `Bearer ${PERPLEXITY_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    const content = aiResponse.data?.choices?.[0]?.message?.content || '';
    const usage = aiResponse.data?.usage || {};

    trackAPI('perplexity', 'options-trade-review', {
      inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, success: true, model,
    });

    res.json({ status: 'success', data: { review: content } });
  } catch (error) {
    console.error('Trade AI review error:', error.message);
    trackAPI('perplexity', 'options-trade-review', { success: false, error: error.message });
    res.status(500).json({ status: 'error', message: error.message || 'AI review failed' });
  }
});

// ─── Real Trades Journal CRUD ──────────────────────────────────────────────────
// These are actual broker trades Vinit logs manually after placing on Zerodha/Upstox

// GET /api/options/realTrades
router.get('/realTrades', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const trades = await RealTrade.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ status: 'success', data: trades });
  } catch (error) {
    console.error('Real trades list error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/options/realTrades/stats
router.get('/realTrades/stats', async (req, res) => {
  try {
    const closed = await RealTrade.find({ status: 'closed', exitPnl: { $ne: null } }).lean();
    const total = closed.length;
    // Win = net P&L after brokerage is positive
    const wins = closed.filter(t => (t.exitPnl - (t.brokerage || 0)) > 0).length;
    const totalGross = closed.reduce((s, t) => s + (t.exitPnl || 0), 0);
    const totalBrokerage = closed.reduce((s, t) => s + (t.brokerage || 0), 0);
    const totalNet = totalGross - totalBrokerage;
    const openCount = await RealTrade.countDocuments({ status: 'open' });

    res.json({
      status: 'success',
      data: {
        totalTrades: total,
        wins,
        losses: total - wins,
        winRate: total > 0 ? parseFloat(((wins / total) * 100).toFixed(1)) : 0,
        totalPnl: parseFloat(totalNet.toFixed(2)),
        avgPnl: total > 0 ? parseFloat((totalNet / total).toFixed(2)) : 0,
        totalBrokerage: parseFloat(totalBrokerage.toFixed(2)),
        openTrades: openCount,
      },
    });
  } catch (error) {
    console.error('Real trades stats error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// POST /api/options/realTrades
router.post('/realTrades', async (req, res) => {
  try {
    const trade = new RealTrade(req.body);
    await trade.save();
    res.json({ status: 'success', data: trade });
  } catch (error) {
    console.error('Real trade create error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PUT /api/options/realTrades/:id
router.put('/realTrades/:id', async (req, res) => {
  try {
    const updates = req.body;
    if (updates.status === 'closed' && !updates.closedAt) updates.closedAt = new Date();
    const trade = await RealTrade.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!trade) return res.status(404).json({ status: 'error', message: 'Trade not found' });
    res.json({ status: 'success', data: trade });
  } catch (error) {
    console.error('Real trade update error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// DELETE /api/options/realTrades/:id
router.delete('/realTrades/:id', async (req, res) => {
  try {
    const trade = await RealTrade.findByIdAndDelete(req.params.id);
    if (!trade) return res.status(404).json({ status: 'error', message: 'Trade not found' });
    res.json({ status: 'success', message: 'Trade deleted' });
  } catch (error) {
    console.error('Real trade delete error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
