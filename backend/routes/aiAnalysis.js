// backend/routes/aiAnalysis.js
// What this does: AI-powered market analysis using Perplexity AI (sonar-pro model).
// 4 endpoints: market-sentiment, predictions, recommendations, patterns.
// Each calls Perplexity with a structured JSON prompt and returns parsed results.

const express = require('express');
const axios = require('axios');

const router = express.Router();

// ─────────────────────────────────────────────
// In-memory cache — avoids re-hitting Perplexity for the same data
// TTL: 10 minutes (AI insights don't need to refresh every click)
// ─────────────────────────────────────────────
const AI_CACHE = {};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const entry = AI_CACHE[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  return null;
}

function setCache(key, data) {
  AI_CACHE[key] = { data, ts: Date.now() };
}

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

function checkAPIKey() {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key || key === 'your_perplexity_api_key') {
    throw new Error('Perplexity API key not configured');
  }
  return key;
}

// System prompt shared across all AI analysis calls
const SYSTEM_PROMPT =
  'You are an expert Indian stock market analyst. You specialize in NSE/BSE equities, ' +
  'NIFTY 50, SENSEX, technical analysis, fundamental analysis, and swing trading strategies. ' +
  'Today\'s date is ' + new Date().toISOString().split('T')[0] + '. ' +
  'IMPORTANT: Always respond with ONLY valid JSON — no markdown, no code blocks, no explanation outside the JSON. ' +
  'Use realistic, current market data. All prices should be in INR (₹).';

// Try sonar-pro first, fall back to the smaller model if auth fails
const MODELS = ['sonar-pro', 'llama-3.1-sonar-small-128k-online'];

async function callPerplexity(apiKey, userPrompt) {
  let lastError = null;

  for (const model of MODELS) {
    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2000,
          temperature: 0.4,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      return response.data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      console.error(`AI Analysis: ${model} failed (${status || err.message})`);
      if (status === 401 || status === 403) continue;
      break;
    }
  }

  throw lastError || new Error('All Perplexity models failed');
}

// Robust JSON extraction — handles:
//   1. Raw JSON: { ... }
//   2. Markdown code blocks: ```json { ... } ```
//   3. Text before/after JSON
function extractJSON(text) {
  if (!text) return null;

  // Strip markdown code fences first
  let cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

  // Find the outermost { ... } pair
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

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// GET /api/ai/market-sentiment
// ─────────────────────────────────────────────
router.get('/market-sentiment', async (req, res) => {
  try {
    const cached = getCached('market-sentiment');
    if (cached) return res.json({ status: 'success', data: { sentiment: cached }, cached: true });

    const apiKey = checkAPIKey();

    const prompt = `Analyze the current Indian stock market sentiment as of today.
Return ONLY this JSON structure (no other text):
{
  "overall": "Bullish" or "Neutral" or "Bearish",
  "confidence": number between 0-100,
  "aiAnalysis": "2-3 sentence analysis of current market conditions",
  "factors": [
    { "factor": "Technical Indicators", "sentiment": "Bullish/Neutral/Bearish", "weight": 35 },
    { "factor": "News Sentiment", "sentiment": "Bullish/Neutral/Bearish", "weight": 25 },
    { "factor": "Volume Analysis", "sentiment": "Bullish/Neutral/Bearish", "weight": 20 },
    { "factor": "Sector Rotation", "sentiment": "Bullish/Neutral/Bearish", "weight": 20 }
  ]
}
Focus on NIFTY 50, BANK NIFTY, and SENSEX. Use today's actual market conditions.`;

    const aiText = await callPerplexity(apiKey, prompt);
    const parsed = extractJSON(aiText);

    if (parsed && parsed.overall) {
      setCache('market-sentiment', parsed);
      return res.json({ status: 'success', data: { sentiment: parsed } });
    }

    // JSON parse failed but we got text — use it as analysis
    return res.json({
      status: 'success',
      data: {
        sentiment: {
          overall: 'Neutral',
          confidence: 50,
          aiAnalysis: aiText || 'AI returned non-structured response.',
          factors: [
            { factor: 'Technical Indicators', sentiment: 'Neutral', weight: 35 },
            { factor: 'News Sentiment', sentiment: 'Neutral', weight: 25 },
            { factor: 'Volume Analysis', sentiment: 'Neutral', weight: 20 },
            { factor: 'Sector Rotation', sentiment: 'Neutral', weight: 20 },
          ],
        },
      },
    });
  } catch (error) {
    console.error('AI sentiment error:', error.message);
    res.json({
      status: 'success',
      data: {
        sentiment: {
          overall: 'Neutral',
          confidence: 0,
          aiAnalysis: `AI analysis unavailable: ${error.message}. Check your Perplexity API key.`,
          factors: [
            { factor: 'Technical Indicators', sentiment: 'Neutral', weight: 35 },
            { factor: 'News Sentiment', sentiment: 'Neutral', weight: 25 },
            { factor: 'Volume Analysis', sentiment: 'Neutral', weight: 20 },
            { factor: 'Sector Rotation', sentiment: 'Neutral', weight: 20 },
          ],
        },
      },
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/ai/predictions
// ─────────────────────────────────────────────
router.get('/predictions', async (req, res) => {
  try {
    const { symbols = 'NIFTY 50,BANK NIFTY,SENSEX' } = req.query;
    const cacheKey = `predictions:${symbols}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ status: 'success', data: { predictions: cached }, cached: true });

    const apiKey = checkAPIKey();

    const prompt = `Provide price predictions for these Indian market instruments: ${symbols}
Return ONLY this JSON structure (no other text):
{
  "predictions": [
    {
      "symbol": "NIFTY 50",
      "currentPrice": <actual current price as number>,
      "predictedPrice": <your predicted price for next week>,
      "timeframe": "1 Week",
      "confidence": <0-100>,
      "direction": "up" or "down",
      "probability": <0-100>,
      "keyLevels": {
        "support": <nearest support level>,
        "resistance": <nearest resistance level>
      }
    }
  ]
}
Use today's actual prices. Provide realistic short-term predictions based on technical analysis, market trends, and recent news.`;

    const aiText = await callPerplexity(apiKey, prompt);
    const parsed = extractJSON(aiText);
    const predictions = parsed?.predictions || (Array.isArray(parsed) ? parsed : null);

    if (predictions && predictions.length > 0) {
      setCache(cacheKey, predictions);
      return res.json({ status: 'success', data: { predictions } });
    }

    // Return empty if parsing failed
    return res.json({
      status: 'success',
      data: { predictions: [], note: 'AI returned non-parseable response' },
    });
  } catch (error) {
    console.error('AI predictions error:', error.message);
    res.json({ status: 'success', data: { predictions: [] } });
  }
});

// ─────────────────────────────────────────────
// GET /api/ai/recommendations
// ─────────────────────────────────────────────
router.get('/recommendations', async (req, res) => {
  try {
    const { limit = 5, category = 'large-cap' } = req.query;
    const cacheKey = `recommendations:${limit}:${category}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ status: 'success', data: { recommendations: cached }, cached: true });

    const apiKey = checkAPIKey();

    const prompt = `Give me ${limit} actionable stock recommendations for Indian markets (NSE) focusing on ${category} stocks.
Return ONLY this JSON structure (no other text):
{
  "recommendations": [
    {
      "symbol": "STOCK_SYMBOL",
      "action": "BUY" or "SELL" or "HOLD" or "ACCUMULATE",
      "confidence": <0-100>,
      "aiScore": <1.0-10.0>,
      "targetPrice": <target price in INR>,
      "currentPrice": <current actual price in INR>,
      "timeframe": "e.g. 2-4 weeks",
      "reasoning": "2-3 sentence explanation",
      "riskFactors": ["risk 1", "risk 2"],
      "catalysts": ["catalyst 1", "catalyst 2"]
    }
  ]
}
Use today's actual stock prices. Include both technical and fundamental reasoning. Consider swing trade timeframes (2 days to 6 months).`;

    const aiText = await callPerplexity(apiKey, prompt);
    const parsed = extractJSON(aiText);
    const recommendations =
      parsed?.recommendations || (Array.isArray(parsed) ? parsed : null);

    if (recommendations && recommendations.length > 0) {
      setCache(cacheKey, recommendations);
      return res.json({ status: 'success', data: { recommendations } });
    }

    return res.json({
      status: 'success',
      data: { recommendations: [], note: 'AI returned non-parseable response' },
    });
  } catch (error) {
    console.error('AI recommendations error:', error.message);
    res.json({ status: 'success', data: { recommendations: [] } });
  }
});

// ─────────────────────────────────────────────
// GET /api/ai/patterns
// ─────────────────────────────────────────────
router.get('/patterns', async (req, res) => {
  try {
    const cached = getCached('patterns');
    if (cached) return res.json({ status: 'success', data: { patterns: cached }, cached: true });

    const apiKey = checkAPIKey();

    const prompt = `Identify 3-5 technical chart patterns currently visible in top Indian stocks (NSE/BSE).
Return ONLY this JSON structure (no other text):
{
  "patterns": [
    {
      "pattern": "Pattern Name (e.g. Cup and Handle, Ascending Triangle, Bull Flag)",
      "symbols": ["SYMBOL1", "SYMBOL2"],
      "confidence": <0-100>,
      "expectedMove": "Bullish" or "Bearish",
      "timeframe": "e.g. 2-4 weeks",
      "description": "1-2 sentence description of the pattern and its significance",
      "keyLevels": {
        "breakout": <breakout price level>,
        "stopLoss": <stop loss level>
      }
    }
  ]
}
Use actual current stock prices and real chart analysis. Focus on patterns that are forming or recently confirmed.`;

    const aiText = await callPerplexity(apiKey, prompt);
    const parsed = extractJSON(aiText);
    const patterns = parsed?.patterns || (Array.isArray(parsed) ? parsed : null);

    if (patterns && patterns.length > 0) {
      setCache('patterns', patterns);
      return res.json({ status: 'success', data: { patterns } });
    }

    return res.json({
      status: 'success',
      data: { patterns: [], note: 'AI returned non-parseable response' },
    });
  } catch (error) {
    console.error('AI patterns error:', error.message);
    res.json({ status: 'success', data: { patterns: [] } });
  }
});

// ─────────────────────────────────────────────
// POST /api/ai/deep-research
// Goldman Sachs-level institutional research report
// 2 sequential Perplexity calls for depth:
//   Call 1 → Fundamentals + Con-Call Analysis (sections 1-4, 6)
//   Call 2 → Technicals + Trade Setup (sections 5, 7)
// ─────────────────────────────────────────────
const DEEP_RESEARCH_CACHE = {};
const DEEP_RESEARCH_TTL = 30 * 60 * 1000; // 30 minutes

router.post('/deep-research', async (req, res) => {
  try {
    const { symbol, quarters = 4 } = req.body;
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ status: 'error', message: 'symbol is required' });
    }

    const sym = symbol.trim().toUpperCase();
    const cacheKey = `deep-research:${sym}:${quarters}`;

    // Check cache
    const cached = DEEP_RESEARCH_CACHE[cacheKey];
    if (cached && Date.now() - cached.ts < DEEP_RESEARCH_TTL) {
      return res.json({ status: 'success', data: cached.data, cached: true });
    }

    const apiKey = checkAPIKey();
    const today = new Date().toISOString().split('T')[0];

    // ── Call 1: Fundamental + Con-Call Analysis ──
    const fundamentalPrompt = `You are a senior Goldman Sachs equity research analyst specializing in Indian markets (NSE/BSE). Today is ${today}.

Conduct a deep institutional-grade research analysis on ${sym} (NSE).

IMPORTANT INSTRUCTIONS:
1. Search Trendlyne.com for the last ${quarters} quarterly earnings conference call transcripts of ${sym}
2. Search Screener.in for the latest financial data of ${sym}
3. Search for recent news, analyst opinions, and broker reports about ${sym}
4. Cross-reference management's past guidance with actual delivered results

Return ONLY this JSON (no markdown, no code blocks, no other text):
{
  "executiveSummary": {
    "verdict": "Strong Buy/Buy/Hold/Sell/Strong Sell",
    "convictionScore": 8,
    "thesis": "one-line investment thesis",
    "briefing": "3-4 sentence CIO-level summary covering why this stock deserves attention right now"
  },
  "businessOverview": {
    "description": "2-3 sentences on what the company does",
    "moat": "Wide/Narrow/None",
    "moatDetails": "explain the competitive advantages",
    "segments": [{"name": "segment name", "revenueShare": "30%", "growth": "15% YoY"}],
    "marketPosition": "e.g. market leader in X, #2 in Y"
  },
  "financials": {
    "quarters": [
      {
        "quarter": "Q3 FY25",
        "revenue": 250000,
        "revenueGrowthYoY": 12.5,
        "ebitdaMargin": 28.3,
        "pat": 18500,
        "patGrowthYoY": 15.2
      }
    ],
    "debtToEquity": 0.45,
    "debtTrend": "declining/stable/rising",
    "roe": 22.5,
    "roce": 18.3,
    "currentPE": 25.4,
    "industryPE": 22.1,
    "pbRatio": 3.2,
    "evEbitda": 18.5,
    "cashFlowFromOps": 45000,
    "redFlags": ["list any concerning trends, empty array if none"]
  },
  "conCallAnalysis": {
    "quarters": [
      {
        "quarter": "Q3 FY25",
        "guidanceGiven": ["revenue growth of 15%", "margin expansion to 30%"],
        "actualDelivery": ["revenue grew 12.5%", "margin at 28.3%"],
        "executionStatus": "Fully Met/Partially Met/Missed",
        "newInitiatives": ["announced $2B capex in green energy"],
        "initiativeFollowUp": "On track — first plant commissioned in Oct",
        "managementTone": "Confident/Cautious/Defensive/Evasive",
        "keyQuote": "We expect FY26 to be our strongest year...",
        "quarterScore": 75
      }
    ],
    "overallComplianceScore": 78,
    "complianceVerdict": "one sentence summary of management credibility",
    "trustLevel": "High/Medium/Low"
  },
  "risks": {
    "companySpecific": ["risk 1", "risk 2", "risk 3"],
    "sectorMacro": ["sector risk 1"],
    "regulatory": ["regulatory risk if any"],
    "valuationRisk": "Fairly Valued/Overvalued/Undervalued",
    "overallRiskRating": "Low/Medium/High"
  }
}

RULES:
- Use REAL financial data, not made up numbers. Search the internet for actual results.
- For con-call analysis, search for ACTUAL transcripts and guidance given by management.
- If you cannot find data for a quarter, note it as "Data not available" but still score what you can find.
- Con-Call Compliance Score rubric: 90-100 = consistently delivers, 70-89 = mostly delivers, 50-69 = mixed, below 50 = poor credibility.
- All financial numbers in ₹ Crores.`;

    let call1Raw;
    let lastErr1;
    for (const model of MODELS) {
      try {
        const r = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: 'You are a senior Goldman Sachs equity research analyst covering Indian equities (NSE/BSE). Today is ' + today + '. IMPORTANT: Always respond with ONLY valid JSON — no markdown, no code blocks, no explanation outside the JSON.' },
              { role: 'user', content: fundamentalPrompt },
            ],
            max_tokens: 4000,
            temperature: 0.2,
          },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60000, // 60s — deep research takes longer
          }
        );
        call1Raw = r.data.choices?.[0]?.message?.content || '';
        break;
      } catch (err) {
        lastErr1 = err;
        const status = err.response?.status;
        console.error(`Deep Research Call 1: ${model} failed (${status || err.message})`);
        if (status === 401 || status === 403) continue;
        break;
      }
    }
    if (!call1Raw) throw lastErr1 || new Error('Perplexity Call 1 failed');

    const fundamentals = extractJSON(call1Raw);
    if (!fundamentals || !fundamentals.executiveSummary) {
      return res.status(500).json({
        status: 'error',
        message: 'AI returned unparseable response for fundamental analysis',
        raw: call1Raw?.substring(0, 500),
      });
    }

    // ── Call 2: Technical Analysis + Trade Setup ──
    const verdictSummary = `${fundamentals.executiveSummary.verdict} conviction ${fundamentals.executiveSummary.convictionScore}/10. ${fundamentals.executiveSummary.thesis}`;

    const technicalPrompt = `You are a senior technical analyst at a top Indian brokerage (ICICI Direct / Motilal Oswal level). Today is ${today}.

The fundamental analysis for ${sym} (NSE) concludes: ${verdictSummary}
Con-Call Compliance Score: ${fundamentals.conCallAnalysis?.overallComplianceScore || 'N/A'}/100.
Risk Rating: ${fundamentals.risks?.overallRiskRating || 'Medium'}.

Now provide detailed technical analysis and a specific actionable trade setup for ${sym}.

Search for the latest price data, chart patterns, and technical indicators for ${sym} on NSE.

Return ONLY this JSON (no markdown, no code blocks):
{
  "technicals": {
    "weeklyTrend": "Uptrend/Downtrend/Sideways",
    "dailyTrend": "Uptrend/Downtrend/Sideways",
    "rsi14": 58.3,
    "rsiSignal": "Neutral/Overbought/Oversold",
    "macd": "Bullish crossover/Bearish crossover/Neutral",
    "above50DMA": true,
    "above200DMA": true,
    "dma50": 1612,
    "dma200": 1545,
    "currentPrice": 1645,
    "support": [1580, 1520],
    "resistance": [1680, 1750],
    "volumeProfile": "Accumulation/Distribution/Neutral",
    "chartPattern": "e.g. Cup and Handle forming / No clear pattern",
    "distFrom52wHigh": -8.5,
    "distFrom52wLow": 22.3,
    "high52w": 1795,
    "low52w": 1363
  },
  "tradeSetup": {
    "action": "BUY/SELL/HOLD/AVOID",
    "investmentType": "Swing/Positional/Long-term",
    "entryPrice": 1645,
    "stopLoss": 1580,
    "stopLossPercent": -3.9,
    "stopLossReasoning": "Below 50 DMA and recent swing low",
    "target1": 1750,
    "target1Percent": 6.4,
    "target1Timeframe": "2-4 weeks",
    "target2": 1850,
    "target2Percent": 12.5,
    "target2Timeframe": "2-3 months",
    "riskReward": "1:2.5",
    "positionSizePercent": 8,
    "positionSizeReasoning": "Medium conviction, moderate risk — allocate 8% of portfolio",
    "confidence": 72
  }
}

RULES:
- Use REAL current price for ${sym} from today's market data.
- Support/resistance must be actual price levels visible on charts.
- Stop loss must be below a real support level (for BUY) or above resistance (for SELL).
- If the stock looks bad technically, set action to AVOID with reasoning.`;

    let call2Raw;
    let lastErr2;
    for (const model of MODELS) {
      try {
        const r = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: 'You are a senior technical analyst at a top Indian brokerage. Today is ' + today + '. IMPORTANT: Always respond with ONLY valid JSON — no markdown, no code blocks.' },
              { role: 'user', content: technicalPrompt },
            ],
            max_tokens: 2000,
            temperature: 0.3,
          },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 45000,
          }
        );
        call2Raw = r.data.choices?.[0]?.message?.content || '';
        break;
      } catch (err) {
        lastErr2 = err;
        const status = err.response?.status;
        console.error(`Deep Research Call 2: ${model} failed (${status || err.message})`);
        if (status === 401 || status === 403) continue;
        break;
      }
    }
    if (!call2Raw) throw lastErr2 || new Error('Perplexity Call 2 failed');

    const technicals = extractJSON(call2Raw);
    if (!technicals || !technicals.tradeSetup) {
      return res.status(500).json({
        status: 'error',
        message: 'AI returned unparseable response for technical analysis',
        raw: call2Raw?.substring(0, 500),
      });
    }

    // ── Merge into unified report ──
    const report = {
      symbol: sym,
      generatedAt: new Date().toISOString(),
      quartersAnalyzed: quarters,
      ...fundamentals,
      ...technicals,
    };

    // Cache
    DEEP_RESEARCH_CACHE[cacheKey] = { data: report, ts: Date.now() };

    return res.json({ status: 'success', data: report });
  } catch (error) {
    console.error('Deep research error:', error.message);
    res.status(500).json({
      status: 'error',
      message: `Deep research failed: ${error.message}`,
    });
  }
});

module.exports = router;
