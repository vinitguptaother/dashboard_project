const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const Screen = require('../models/Screen');
const ScreenBatch = require('../models/ScreenBatch');
const Instrument = require('../models/Instrument');
const { upstoxService } = require('../../services/upstoxService');
const { apiLogger } = require('../middleware/logger');
const aiService = require('../services/aiService');
const trackAPI = require('../utils/trackAPI');
const logActivity = require('../utils/logActivity');

// ─────────────────────────────────────────────
// AI Fundamental Ranking via Perplexity
// ─────────────────────────────────────────────
const AI_RANK_MODELS = ['sonar-pro', 'llama-3.1-sonar-small-128k-online'];

async function callPerplexityForRanking(apiKey, prompt) {
  let lastError = null;
  for (const model of AI_RANK_MODELS) {
    try {
      const resp = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are a senior Indian stock market analyst specializing in fundamental analysis for NSE/BSE stocks. ' +
                'You score stocks on fundamentals using live data from Screener.in, Trendlyne, and MoneyControl. ' +
                "Today's date is " + new Date().toISOString().split('T')[0] + '. ' +
                'IMPORTANT: Respond with ONLY valid JSON — no markdown, no code blocks, no text outside the JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 5000,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );
      const content = resp.data?.choices?.[0]?.message?.content || null;
      const usage = resp.data?.usage || {};
      trackAPI('perplexity', 'screen-ranking', { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, success: true, model });
      return content;
    } catch (err) {
      lastError = err;
      trackAPI('perplexity', 'screen-ranking', { success: false, model });
      if (err.response?.status !== 401) break;
    }
  }
  throw lastError || new Error('AI ranking failed');
}

function extractJSON(text) {
  if (!text) return null;
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Try extracting from code blocks
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) try { return JSON.parse(codeBlock[1].trim()); } catch {}
  // Try finding first [ or {
  const start = text.search(/[\[{]/);
  const end = text.lastIndexOf(text[start] === '[' ? ']' : '}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

/**
 * AI Fundamental Ranking: Sends stock symbols to Perplexity for fundamental scoring.
 * Returns a Map of symbol → { aiScore (0-20), breakdown }
 * Falls back gracefully — if AI fails, returns empty map (price ranking used instead).
 */
async function getAIFundamentalScores(symbols) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey || symbols.length === 0) return new Map();

  try {
    // Fetch market context once (cached 10 min — adds NIFTY trend, VIX, regime)
    let marketContext = '';
    try { marketContext = await aiService.getMarketContext(); } catch (e) { /* non-critical */ }

    // Batch symbols into chunks of 25 to avoid token truncation
    const BATCH_SIZE = 25;
    const batches = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      batches.push(symbols.slice(i, i + BATCH_SIZE));
    }

    apiLogger.info('Screens API', 'AI fundamental ranking start', {
      stockCount: symbols.length,
      batches: batches.length,
    });

    const scoreMap = new Map();

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const symbolList = batch.join(', ');

      const prompt = `${marketContext}
Score these Indian stocks (NSE/BSE) on FUNDAMENTALS for swing trading and long-term investing.

STOCKS: ${symbolList}

For EACH stock, search Screener.in and Trendlyne for live data and score on these 6 parameters (0-4 points each, total 0-24):

1. FINANCIAL HEALTH (0-4): ROE > 15% = good, ROCE > 15% = good, Debt/Equity < 1 = good, positive cash flow = good
2. GROWTH (0-4): Revenue growth > 15% YoY = good, Profit growth > 20% YoY = great, consistent quarterly growth = bonus
3. VALUATION (0-4): P/E below industry avg = good, PEG < 1.5 = good, P/B reasonable for sector = good
4. TECHNICAL STRENGTH (0-4): Price above 50 DMA = good, above 200 DMA = great, RSI 40-70 = good (not overbought)
5. MOMENTUM & ORDER FLOW (0-4): Delivery % > 50% = good, volume spike vs 20-day avg = bonus, bulk/block deals in last 7 days = bonus
6. INSTITUTIONAL QUALITY (0-4): Promoter holding stable/increasing = good, FII/DII net buying = good, no pledge concerns = good

Return ONLY this JSON array (no other text):
[
  { "symbol": "STOCKNAME", "aiScore": 19, "health": 3, "growth": 4, "valuation": 3, "technical": 3, "orderFlow": 3, "institutional": 3, "reason": "Strong ROE 22%, profit growth 35% YoY, delivery 58%, FII increasing" },
  ...
]

IMPORTANT: Use the EXACT stock names I gave you. Score ALL ${batch.length} stocks. If you can't find data for a stock, give it a conservative score of 10-14 with reason "Limited data".`;

      try {
        const rawResponse = await callPerplexityForRanking(apiKey, prompt);
        const parsed = extractJSON(rawResponse);

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.symbol && typeof item.aiScore === 'number') {
              scoreMap.set(item.symbol.toUpperCase(), {
                aiScore: Math.min(24, Math.max(0, item.aiScore)),
                health: item.health || 0,
                growth: item.growth || 0,
                valuation: item.valuation || 0,
                technical: item.technical || 0,
                orderFlow: item.orderFlow || item.momentum || 0,
                institutional: item.institutional || 0,
                reason: item.reason || '',
              });
            }
          }
          apiLogger.info('Screens API', `AI ranking batch ${batchIdx + 1}/${batches.length} done`, {
            batchSize: batch.length, scored: scoreMap.size,
          });
        } else {
          apiLogger.warn('Screens API', `AI ranking batch ${batchIdx + 1} returned non-array`, {
            raw: rawResponse?.slice(0, 200),
          });
        }
      } catch (batchErr) {
        apiLogger.warn('Screens API', `AI ranking batch ${batchIdx + 1} failed, continuing`, batchErr.message);
        // Continue with remaining batches — partial scoring is better than none
      }
    }

    apiLogger.info('Screens API', 'AI fundamental ranking complete', {
      requested: symbols.length,
      scored: scoreMap.size,
    });

    return scoreMap;
  } catch (err) {
    apiLogger.error('Screens API', 'AI fundamental ranking failed (falling back to price)', err.message);
    return new Map(); // Graceful fallback — price ranking will be used
  }
}

// Escape special regex characters for safe use in RegExp constructors
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Yahoo Finance fallback helpers ---
// Used for stocks NOT found in the Upstox instruments database.

/**
 * Single Yahoo Finance search call. Returns the best NSE/BSE symbol or null.
 */
async function _yahooSearch(query) {
  try {
    const url =
      'https://query2.finance.yahoo.com/v1/finance/search?q=' +
      encodeURIComponent(query) +
      '&quotesCount=5&newsCount=0&region=IN';
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const quotes = (data.quotes || []).filter(
      (q) =>
        q.exchDisp === 'NSE' ||
        q.exchDisp === 'BSE' ||
        q.exchange === 'NSI' ||
        q.exchange === 'BSE'
    );
    if (quotes.length === 0) return null;
    // Prefer NSE over BSE
    const nse = quotes.find((q) => q.exchDisp === 'NSE' || q.exchange === 'NSI');
    return nse ? nse.symbol : quotes[0].symbol;
  } catch {
    return null;
  }
}

// Common suffixes in Screener company names that hurt Yahoo search matching
const STRIP_SUFFIXES = /\s+(LTD|LIMITED|INC|CORP|CORPORATION|PVT|PRIVATE|INDIA)$/i;

/**
 * Build an ordered list of search name variations for a company name.
 * Screener exports often contain truncated / abbreviated names, so we
 * try progressively simpler queries until Yahoo finds a match.
 */
function _buildNameVariations(rawName) {
  const clean = rawName.replace(/[.,:;!?]+$/g, '').trim(); // strip trailing punctuation
  const variations = [clean];

  // Without common suffixes ("ORIANA POWER LTD" → "ORIANA POWER")
  const noSuffix = clean.replace(STRIP_SUFFIXES, '').trim();
  if (noSuffix !== clean) variations.push(noSuffix);

  // Drop last word — Screener truncates names ("MAHA RASHTRA APX" → "MAHA RASHTRA")
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    variations.push(words.slice(0, -1).join(' '));
  }
  // First two words only (for 4+ word names)
  if (words.length >= 4) {
    variations.push(words.slice(0, 2).join(' '));
  }

  // De-duplicate while preserving order
  return [...new Set(variations)];
}

/**
 * Search Yahoo Finance for the NSE/BSE trading symbol matching a company name.
 * Tries multiple name variations and returns the first match, or null.
 */
async function yahooSearchSymbol(companyName) {
  const variations = _buildNameVariations(companyName);
  for (const query of variations) {
    const symbol = await _yahooSearch(query);
    if (symbol) return symbol;
  }
  return null;
}

/**
 * Fetch last traded price and previous close from Yahoo Finance chart API.
 * Returns { lastPrice, prevClose } or null.
 */
async function yahooGetPrice(yahooSymbol) {
  try {
    const url =
      'https://query1.finance.yahoo.com/v8/finance/chart/' +
      encodeURIComponent(yahooSymbol);
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice || meta.regularMarketPrice <= 0)
      return null;
    return {
      lastPrice: meta.regularMarketPrice,
      prevClose: meta.previousClose || null,
    };
  } catch {
    return null;
  }
}

/**
 * Process an array of items with limited concurrency.
 * Prevents hitting Yahoo rate limits with large batches (150+ stocks).
 */
async function parallelLimit(items, limit, fn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const router = express.Router();

/**
 * @route   GET /api/screens
 * @desc    Get all screens
 * @access  Public (add auth later if needed)
 */
router.get('/', async (req, res) => {
  try {
    const screens = await Screen.find().sort({ createdAt: 1 });

    // If no screens exist, seed two default ones
    if (!screens || screens.length === 0) {
      const defaultScreens = [
        {
          name: 'Companies with good latest results',
          description: 'Strong YoY & QoQ sales/profit growth',
          query: 'YoY profit growth > 25% AND QoQ profit growth > 10%',
          isDefault: true,
        },
        {
          name: 'Quarterly Growers',
          description: 'Net profit rising for last 4 quarters',
          query: 'Net profit growth > 0 for last 4 quarters',
          isDefault: true,
        },
      ];

      const created = await Screen.insertMany(defaultScreens);

      apiLogger.info('Screens API', 'seedDefaults', {
        count: created.length,
      });

      return res.json({
        status: 'success',
        data: created,
      });
    }

    apiLogger.info('Screens API', 'getAll', { count: screens.length });

    res.json({
      status: 'success',
      data: screens,
    });
  } catch (error) {
    apiLogger.error('Screens API', 'getAll', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch screens',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/screens/stats
 * @desc    Dashboard stat counters — totalScreens, activeBatches, hitRate
 * @access  Public (add auth if needed)
 */
router.get('/stats', async (req, res) => {
  try {
    const [totalScreens, activeBatches] = await Promise.all([
      Screen.countDocuments(),
      ScreenBatch.countDocuments(),
    ]);

    // --- Calculate real hit rate from batches in the last 3 months ---
    // A "hit" = stock price went UP since ranking day (score > 0 at ranking time
    // and the batch was saved with valid price data).
    // We look at batches older than 5 days (to allow meaningful price movement)
    // but within the last 90 days (3-month window).
    let hitRate = null;
    try {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const recentBatches = await ScreenBatch.find({
        runDate: { $gte: threeMonthsAgo, $lt: fiveDaysAgo },
        'rankedResults.0': { $exists: true }, // only batches with ranked data
      }).select('rankedResults');

      let totalStocks = 0;
      let totalHits = 0;
      for (const batch of recentBatches) {
        for (const stock of batch.rankedResults || []) {
          if (stock.lastPrice != null && stock.score != null) {
            totalStocks++;
            if (stock.score > 0) totalHits++;
          }
        }
      }

      if (totalStocks > 0) {
        hitRate = parseFloat(((totalHits / totalStocks) * 100).toFixed(1));
      }
    } catch (hitRateErr) {
      apiLogger.error('Screens API', 'stats:hitRate', hitRateErr);
      // hitRate stays null — dashboard will show "–"
    }

    // --- Screen leaderboard (top 3 by performance score) ---
    let screenLeaderboard = [];
    try {
      screenLeaderboard = await Screen.find({ performanceScore: { $ne: null } })
        .sort({ performanceScore: -1 })
        .limit(3)
        .select('name performanceScore avgHitRate avgAIWinRate totalBatches status')
        .lean();
    } catch (lbErr) {
      apiLogger.error('Screens API', 'stats:leaderboard', lbErr);
    }

    apiLogger.info('Screens API', 'stats', { totalScreens, activeBatches, hitRate });

    res.json({
      status: 'success',
      data: {
        totalScreens,
        activeBatches,
        hitRate,
        screenLeaderboard,
      },
    });
  } catch (error) {
    apiLogger.error('Screens API', 'stats', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch stats',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/screens/top-ideas
 * @desc    Return top 5 ranked stocks from the most recent ScreenBatch
 * @access  Public (add auth if needed)
 */
router.get('/top-ideas', async (req, res) => {
  try {
    const latestBatch = await ScreenBatch.findOne().sort({ runDate: -1 }).limit(1);

    if (!latestBatch) {
      return res.json({ status: 'success', data: null });
    }

    const validStocks = (latestBatch.rankedResults || [])
      .filter((s) => s.lastPrice != null && s.score != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => ({
        symbol: s.symbol,
        score: s.score,
        aiScore: s.aiScore ?? null,
        aiReason: s.aiBreakdown?.reason ?? null,
        lastPrice: s.lastPrice,
        percentChange: s.percentChange ?? null,
      }));

    apiLogger.info('Screens API', 'topIdeas', {
      batchId: latestBatch._id,
      count: validStocks.length,
    });

    res.json({
      status: 'success',
      data: {
        batchDate: latestBatch.runDate,
        screenName: latestBatch.screenName,
        topIdeas: validStocks,
      },
    });
  } catch (error) {
    apiLogger.error('Screens API', 'topIdeas', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch top ideas',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/screens/performance
 * @desc    Hit-rate tracking — compare ranking-day prices to current live prices
 * @access  Public (add auth if needed)
 */
router.get('/performance', async (req, res) => {
  try {
    // Only look at batches older than 5 days so there is meaningful price movement
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const oldBatches = await ScreenBatch.find({ runDate: { $lt: fiveDaysAgo } }).sort({ runDate: -1 });

    if (!oldBatches || oldBatches.length === 0) {
      return res.json({
        status: 'success',
        data: { batches: [], screens: [] },
      });
    }

    // --- Collect every unique symbol (with valid ranking-day data) across all batches ---
    const allSymbols = new Set();
    for (const batch of oldBatches) {
      for (const stock of batch.rankedResults || []) {
        if (stock.symbol && stock.lastPrice != null && stock.lastPrice > 0 && stock.score != null) {
          allSymbols.add(stock.symbol.trim().toUpperCase());
        }
      }
    }

    const uniqueNames = [...allSymbols];

    // --- Instrument matching (same logic as rankBatch) ---
    const orConditions = [];
    for (const rawName of uniqueNames) {
      const escaped = escapeRegex(rawName);
      orConditions.push({ name: new RegExp('^' + escaped, 'i') });
      orConditions.push({ name: new RegExp(escaped, 'i') });
      orConditions.push({ symbol: new RegExp('^' + escaped, 'i') });

      const cleaned = rawName
        .replace(/[.,:;!?]+$/g, '')
        .replace(STRIP_SUFFIXES, '')
        .trim();
      if (cleaned !== rawName && cleaned.length >= 3) {
        const cleanEsc = escapeRegex(cleaned);
        orConditions.push({ name: new RegExp('^' + cleanEsc, 'i') });
        orConditions.push({ name: new RegExp(cleanEsc, 'i') });
      }
    }

    const matchedInstruments =
      orConditions.length > 0
        ? await Instrument.find({
            $or: orConditions,
            exchange: { $in: ['NSE_EQ', 'BSE_EQ', 'NSE', 'BSE'] },
          })
        : [];

    const exchangeRank = (inst) => (inst.exchange === 'NSE_EQ' || inst.exchange === 'NSE' ? 0 : 1);
    const instrumentMap = new Map();
    for (const rawName of uniqueNames) {
      const upper = rawName.toUpperCase();
      const escaped = escapeRegex(rawName);
      const prefixRe = new RegExp('^' + escaped, 'i');
      const containsRe = new RegExp(escaped, 'i');

      let candidates = matchedInstruments.filter((i) => prefixRe.test(i.name));
      if (candidates.length === 0) {
        candidates = matchedInstruments.filter((i) => containsRe.test(i.name));
      }
      if (candidates.length === 0) {
        candidates = matchedInstruments.filter((i) => prefixRe.test(i.symbol));
      }

      if (candidates.length === 0) {
        const cleaned = rawName
          .replace(/[.,:;!?]+$/g, '')
          .replace(STRIP_SUFFIXES, '')
          .trim();
        if (cleaned !== rawName && cleaned.length >= 3) {
          const cleanEsc = escapeRegex(cleaned);
          const cleanPre = new RegExp('^' + cleanEsc, 'i');
          const cleanCon = new RegExp(cleanEsc, 'i');
          candidates = matchedInstruments.filter((i) => cleanPre.test(i.name));
          if (candidates.length === 0) {
            candidates = matchedInstruments.filter((i) => cleanCon.test(i.name));
          }
        }
      }

      if (candidates.length > 0) {
        candidates.sort(
          (a, b) => exchangeRank(a) - exchangeRank(b) || a.name.length - b.name.length
        );
        instrumentMap.set(upper, candidates[0]);
      }
    }

    // --- Batch LTP fetch (same chunked approach as rankBatch) ---
    const tokensToFetch = new Set();
    for (const inst of instrumentMap.values()) {
      tokensToFetch.add(inst.token);
    }
    const tokenToLTP = new Map();
    const tokenArray = [...tokensToFetch];
    const UPSTOX_CHUNK_SIZE = 50;

    if (tokenArray.length > 0) {
      const tokenChunks = [];
      for (let i = 0; i < tokenArray.length; i += UPSTOX_CHUNK_SIZE) {
        tokenChunks.push(tokenArray.slice(i, i + UPSTOX_CHUNK_SIZE));
      }

      for (const chunk of tokenChunks) {
        try {
          const ltpResult = await upstoxService.getLTP(chunk);
          const rawLTP = (ltpResult && ltpResult.data) || {};

          for (const [key, value] of Object.entries(rawLTP)) {
            if (value && value.instrumentToken) {
              tokenToLTP.set(value.instrumentToken, value);
            }
            tokenToLTP.set(key, value);
            tokenToLTP.set(key.replace(':', '|'), value);
          }
        } catch (ltpError) {
          apiLogger.error('Screens API', 'performance LTP chunk error', ltpError);
        }
      }
    }

    // --- Yahoo fallback for symbols not found in Upstox ---
    const unmatchedNames = uniqueNames.filter((n) => !instrumentMap.has(n.toUpperCase()));
    const yahooFallbackMap = new Map();

    if (unmatchedNames.length > 0) {
      await parallelLimit(unmatchedNames, 5, async (rawName) => {
        const upper = rawName.toUpperCase();
        const yahooSymbol = await yahooSearchSymbol(rawName);
        if (!yahooSymbol) return;
        const priceData = await yahooGetPrice(yahooSymbol);
        if (priceData) {
          yahooFallbackMap.set(upper, priceData);
        }
      });
    }

    // --- Helper: resolve current price for a symbol ---
    function getCurrentPrice(symbol) {
      const upper = (symbol || '').trim().toUpperCase();
      const inst = instrumentMap.get(upper);
      if (inst) {
        const ltp = tokenToLTP.get(inst.token);
        if (ltp && ltp.lastPrice != null) {
          return parseFloat(Number(ltp.lastPrice).toFixed(2));
        }
      }
      const yahoo = yahooFallbackMap.get(upper);
      if (yahoo && yahoo.lastPrice != null) {
        return parseFloat(Number(yahoo.lastPrice).toFixed(2));
      }
      return null;
    }

    // --- Build per-batch results ---
    const batchResults = [];

    for (const batch of oldBatches) {
      const stocks = [];

      for (const stock of batch.rankedResults || []) {
        if (!stock.symbol || stock.lastPrice == null || stock.lastPrice <= 0 || stock.score == null) {
          continue;
        }

        const priceAtRanking = stock.lastPrice;
        const currentPrice = getCurrentPrice(stock.symbol);

        if (currentPrice == null) continue;

        const returnSinceRanking = parseFloat(
          (((currentPrice - priceAtRanking) / priceAtRanking) * 100).toFixed(2)
        );
        const hit = returnSinceRanking > 0;

        stocks.push({
          symbol: stock.symbol,
          scoreAtRanking: stock.score,
          priceAtRanking,
          currentPrice,
          returnSinceRanking,
          hit,
        });
      }

      if (stocks.length === 0) continue;

      const totalStocks = stocks.length;
      const hits = stocks.filter((s) => s.hit).length;
      const hitRate = parseFloat(((hits / totalStocks) * 100).toFixed(1));
      const avgReturn = parseFloat(
        (stocks.reduce((sum, s) => sum + s.returnSinceRanking, 0) / totalStocks).toFixed(2)
      );

      batchResults.push({
        batchId: batch._id,
        screenName: batch.screenName,
        runDate: batch.runDate,
        totalStocks,
        hits,
        hitRate,
        avgReturn,
        stocks,
      });
    }

    // --- Aggregate by screenName ---
    const screenMap = new Map();
    for (const b of batchResults) {
      if (!screenMap.has(b.screenName)) {
        screenMap.set(b.screenName, { totalBatches: 0, totalHits: 0, totalStocks: 0, totalReturn: 0 });
      }
      const agg = screenMap.get(b.screenName);
      agg.totalBatches += 1;
      agg.totalHits += b.hits;
      agg.totalStocks += b.totalStocks;
      agg.totalReturn += b.stocks.reduce((sum, s) => sum + s.returnSinceRanking, 0);
    }

    const screens = [];
    for (const [screenName, agg] of screenMap.entries()) {
      screens.push({
        screenName,
        totalBatches: agg.totalBatches,
        overallHitRate: parseFloat(((agg.totalHits / agg.totalStocks) * 100).toFixed(1)),
        overallAvgReturn: parseFloat((agg.totalReturn / agg.totalStocks).toFixed(2)),
      });
    }

    apiLogger.info('Screens API', 'performance', {
      batchCount: batchResults.length,
      screenCount: screens.length,
    });

    res.json({
      status: 'success',
      data: {
        batches: batchResults,
        screens,
      },
    });
  } catch (error) {
    apiLogger.error('Screens API', 'performance', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to compute performance data',
      error: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/screens/recommendations
// Returns all screens ranked by performance score with recommendations
// ─────────────────────────────────────────────────────────────────────────────
router.get('/recommendations', async (req, res) => {
  try {
    const { getRecommendations } = require('../services/screenScoringService');
    const data = await getRecommendations();
    res.json({ status: 'success', data });
  } catch (error) {
    console.error('Screen recommendations error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to get recommendations' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/screens/score-now
// Manually trigger scoring for all screens (instead of waiting for nightly cron)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/score-now', async (req, res) => {
  try {
    const { scoreAllScreens } = require('../services/screenScoringService');
    const results = await scoreAllScreens();
    res.json({ status: 'success', data: results });
  } catch (error) {
    console.error('Manual scoring error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to score screens' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/screens/feedback-all
// Returns feedback data for all screens (for dashboard overview)
// MUST be before /:id routes to avoid being caught by catch-all
// ─────────────────────────────────────────────────────────────────────────────
router.get('/feedback-all', async (req, res) => {
  try {
    const { getAllPerformances } = require('../services/feedbackService');
    const data = await getAllPerformances();
    res.json({ status: 'success', data });
  } catch (error) {
    console.error('All feedback error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch feedback data' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/screens/feedback/:screenName
// Returns the AI feedback loop performance data for a screen
// ─────────────────────────────────────────────────────────────────────────────
router.get('/feedback/:screenName', async (req, res) => {
  try {
    const { getPerformanceSummary } = require('../services/feedbackService');
    const data = await getPerformanceSummary(req.params.screenName);
    if (!data) {
      return res.json({
        status: 'success',
        data: null,
        message: 'No performance data yet — trades need to resolve (hit SL or target) first',
      });
    }
    res.json({ status: 'success', data });
  } catch (error) {
    console.error('Screen feedback error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch screen feedback' });
  }
});

/**
 * @route   GET /api/screens/batch/:batchId
 * @desc    Get a single saved batch by ID (full document)
 * @access  Public (add auth if needed)
 */
router.get('/batch/:batchId', async (req, res) => {
  try {
    const batch = await ScreenBatch.findById(req.params.batchId);

    if (!batch) {
      return res.status(404).json({
        status: 'error',
        message: 'Batch not found',
      });
    }

    apiLogger.info('Screens API', 'getBatch', { id: req.params.batchId });

    res.json({
      status: 'success',
      data: batch,
    });
  } catch (error) {
    apiLogger.error('Screens API', 'getBatch', error, { id: req.params.batchId });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch batch',
    });
  }
});

/**
 * @route   GET /api/screens/:screenId/batches
 * @desc    List saved batches for a screen, sorted by runDate descending
 * @access  Public (add auth if needed)
 */
router.get('/:screenId/batches', async (req, res) => {
  try {
    const batches = await ScreenBatch.find({ screenId: req.params.screenId })
      .sort({ runDate: -1 })
      .select('_id runDate screenName symbols');

    const data = batches.map((b) => ({
      _id: b._id,
      runDate: b.runDate,
      screenName: b.screenName,
      batchSize: b.symbols.length,
    }));

    apiLogger.info('Screens API', 'getBatches', {
      screenId: req.params.screenId,
      count: data.length,
    });

    res.json({
      status: 'success',
      data,
    });
  } catch (error) {
    apiLogger.error('Screens API', 'getBatches', error, { screenId: req.params.screenId });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch batches',
    });
  }
});

/**
 * @route   DELETE /api/screens/batch/:batchId
 * @desc    Delete a saved batch and its associated trade setups
 */
router.delete('/batch/:batchId', async (req, res) => {
  try {
    const batch = await ScreenBatch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ status: 'error', message: 'Batch not found' });
    }

    // Also delete trade setups linked to this batch
    const TradeSetup = require('../models/TradeSetup');
    const deletedSetups = await TradeSetup.deleteMany({ screenBatchId: req.params.batchId });

    await ScreenBatch.findByIdAndDelete(req.params.batchId);

    apiLogger.info('Screens API', 'deleteBatch', {
      batchId: req.params.batchId,
      screenName: batch.screenName,
      deletedSetups: deletedSetups.deletedCount,
    });

    res.json({
      status: 'success',
      data: {
        deletedBatch: req.params.batchId,
        deletedSetups: deletedSetups.deletedCount,
        screenName: batch.screenName,
      },
    });
  } catch (error) {
    apiLogger.error('Screens API', 'deleteBatch', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete batch' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SCREENER.IN AUTO-FETCH (v2 — query-based, credentials saved once)
// Must be ABOVE /:id catch-all route to avoid "screener-status" matching /:id
// ═══════════════════════════════════════════════════════════════════════
const {
  testAndSaveCredentials,
  runQueryAndScrape,
  hasCredentials,
  clearCredentials,
  loadCredentials,
} = require('../services/screenerFetchService');

/**
 * @route   GET /api/screens/screener-status
 * @desc    Check if screener.in credentials are saved
 */
router.get('/screener-status', (req, res) => {
  const creds = loadCredentials();
  res.json({
    status: 'success',
    data: {
      connected: !!creds,
      email: creds?.email || null,
    },
  });
});

/**
 * @route   POST /api/screens/screener-login
 * @desc    Test + save screener.in credentials (one-time setup)
 */
router.post('/screener-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password required' });
    }
    const result = await testAndSaveCredentials(email, password);
    res.json({ status: 'success', data: result });
  } catch (error) {
    apiLogger.error('Screens API', 'screener-login', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to login to screener.in',
    });
  }
});

/**
 * @route   POST /api/screens/screener-logout
 * @desc    Clear saved screener.in credentials
 */
router.post('/screener-logout', (req, res) => {
  clearCredentials();
  res.json({ status: 'success', message: 'Credentials cleared' });
});

/**
 * @route   POST /api/screens/screener-fetch
 * @desc    Run a screener.in query and return companies
 * @body    { query, screenName }
 */
router.post('/screener-fetch', async (req, res) => {
  try {
    const { query, screenName, onlyLatestResults } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ status: 'error', message: 'Screen query is required. Add a Screener Query to this screen first.' });
    }
    if (!hasCredentials()) {
      return res.status(401).json({ status: 'error', message: 'No screener.in credentials saved. Click "Connect Screener.in" first.' });
    }

    const result = await runQueryAndScrape(query.trim(), { onlyLatestResults: !!onlyLatestResults });

    // Dedup check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingBatch = await ScreenBatch.findOne({
      screenName: screenName || 'Auto-fetched',
      createdAt: { $gte: today },
    });

    logActivity('screen_import', 'fetched', { screenName: screenName || 'Auto', count: result.companies.length, totalResults: result.totalResults });

    res.json({
      status: 'success',
      data: {
        companies: result.companies,
        companyCount: result.companies.length,
        totalResults: result.totalResults,
        pages: result.pages,
        alreadyImportedToday: !!existingBatch,
        existingBatchId: existingBatch?._id || null,
      },
    });
  } catch (error) {
    logActivity('error', 'screener-fetch failed', { error: error.message });
    apiLogger.error('Screens API', 'screener-fetch', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch from screener.in',
    });
  }
});

/**
 * @route   GET /api/screens/:id
 * @desc    Get a single screen by ID
 * @access  Public (add auth later if needed)
 */
router.get('/:id', async (req, res) => {
  try {
    const screen = await Screen.findById(req.params.id);

    if (!screen) {
      return res.status(404).json({
        status: 'error',
        message: 'Screen not found',
      });
    }

    apiLogger.info('Screens API', 'getById', { id: req.params.id });

    res.json({
      status: 'success',
      data: screen,
    });
  } catch (error) {
    apiLogger.error('Screens API', 'getById', error, { id: req.params.id });
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch screen',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/screens
 * @desc    Create a new screen
 * @access  Public (add auth later if needed)
 */
router.post(
  '/',
  [
    body('name')
      .notEmpty()
      .withMessage('Screen name is required')
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('query')
      .optional()
      .trim(),
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { name, description, query, isDefault } = req.body;

      const screen = new Screen({
        name: name.trim(),
        description: description ? description.trim() : '',
        query: query ? query.trim() : '',
        isDefault: isDefault !== undefined ? isDefault : false,
      });

      const saved = await screen.save();

      apiLogger.info('Screens API', 'create', { id: saved._id, name: saved.name });

      res.status(201).json({
        status: 'success',
        message: 'Screen created successfully',
        data: saved,
      });
    } catch (error) {
      apiLogger.error('Screens API', 'create', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create screen',
        error: error.message,
      });
    }
  }
);

/**
 * @route   PUT /api/screens/:id
 * @desc    Update an existing screen
 * @access  Public (add auth later if needed)
 */
router.put(
  '/:id',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('query')
      .optional()
      .trim(),
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const updates = {};
      const { name, description, query, isDefault } = req.body;

      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description.trim();
      if (query !== undefined) updates.query = query.trim();
      if (isDefault !== undefined) updates.isDefault = isDefault;

      const updated = await Screen.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({
          status: 'error',
          message: 'Screen not found',
        });
      }

      apiLogger.info('Screens API', 'update', { id: req.params.id, fields: Object.keys(updates) });

      res.json({
        status: 'success',
        message: 'Screen updated successfully',
        data: updated,
      });
    } catch (error) {
      apiLogger.error('Screens API', 'update', error, { id: req.params.id });
      res.status(500).json({
        status: 'error',
        message: 'Failed to update screen',
        error: error.message,
      });
    }
  }
);

/**
 * @route   DELETE /api/screens/:id
 * @desc    Delete a screen
 * @access  Public (add auth later if needed)
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Screen.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Screen not found',
      });
    }

    apiLogger.info('Screens API', 'delete', { id: req.params.id });

    res.json({
      status: 'success',
      message: 'Screen deleted successfully',
    });
  } catch (error) {
    apiLogger.error('Screens API', 'delete', error, { id: req.params.id });
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete screen',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/screens/saveBatch
 * @desc    Persist a ranked batch to MongoDB
 * @access  Public (add auth if needed)
 */
router.post(
  '/saveBatch',
  [
    body('screenName')
      .notEmpty()
      .withMessage('screenName is required')
      .trim(),
    body('symbols')
      .isArray({ min: 1 })
      .withMessage('symbols must be a non-empty array'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { screenId, screenName, symbols, rankedResults } = req.body;

      const batch = new ScreenBatch({
        screenId: screenId || null,
        screenName: screenName.trim(),
        symbols,
        rankedResults: rankedResults || [],
      });

      const saved = await batch.save();

      apiLogger.info('Screens API', 'saveBatch', {
        id: saved._id,
        screenName: saved.screenName,
        symbolCount: saved.symbols.length,
      });

      res.status(201).json({
        status: 'success',
        data: saved,
      });
    } catch (error) {
      apiLogger.error('Screens API', 'saveBatch', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to save batch',
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/screens/rankBatch
 * @desc    Rank a batch of stock symbols using live Upstox market data
 * @access  Public (add auth if needed)
 */
router.post(
  '/rankBatch',
  [
    body('symbols')
      .isArray({ min: 1 })
      .withMessage('Symbols must be a non-empty array')
      .custom((symbols) => {
        return symbols.every((s) => typeof s === 'string');
      })
      .withMessage('All symbols must be strings'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid request',
          errors: errors.array(),
        });
      }

      const { symbols, companyNames } = req.body;
      const nameMap = companyNames || {}; // { "SYMBOL": "Company Name" } for fallback matching

      apiLogger.info('Screens API', 'rankBatch', { symbolCount: symbols.length, hasCompanyNames: !!companyNames });

      // --- Step 1: Match Screener names to Instrument master (NSE cash equity) ---
      // Screener CSVs contain company names (e.g. "Coal India"), not trading symbols
      const uniqueNames = [
        ...new Set(symbols.map((s) => (s || '').trim()).filter(Boolean)),
      ];

      // Build $or conditions: prefix + contains on name, prefix on symbol
      // Also try cleaned variants (strip trailing punctuation + common suffixes)
      // Also try company names from nameMap (helps with BSE-code symbols like 514330)
      const orConditions = [];
      for (const rawName of uniqueNames) {
        const escaped = escapeRegex(rawName);
        orConditions.push({ name: new RegExp('^' + escaped, 'i') });
        orConditions.push({ name: new RegExp(escaped, 'i') });
        orConditions.push({ symbol: new RegExp('^' + escaped, 'i') });

        // Cleaned variant: strip trailing dots/punctuation and common suffixes
        const cleaned = rawName
          .replace(/[.,:;!?]+$/g, '')
          .replace(STRIP_SUFFIXES, '')
          .trim();
        if (cleaned !== rawName && cleaned.length >= 3) {
          const cleanEsc = escapeRegex(cleaned);
          orConditions.push({ name: new RegExp('^' + cleanEsc, 'i') });
          orConditions.push({ name: new RegExp(cleanEsc, 'i') });
        }

        // Company name fallback (e.g. symbol="514330", companyName="IndiaMART InterMESH")
        const compName = nameMap[rawName.toUpperCase()];
        if (compName && compName !== rawName) {
          const compEsc = escapeRegex(compName);
          orConditions.push({ name: new RegExp('^' + compEsc, 'i') });
          orConditions.push({ name: new RegExp(compEsc, 'i') });
          // Also try first word of company name as symbol match
          const firstWord = compName.split(/\s+/)[0];
          if (firstWord.length >= 3) {
            orConditions.push({ symbol: new RegExp('^' + escapeRegex(firstWord), 'i') });
          }
        }
      }

      const matchedInstruments =
        orConditions.length > 0
          ? await Instrument.find({
              $or: orConditions,
              // Support both old format (exchange: 'NSE_EQ') and new full download (exchange: 'NSE')
              exchange: { $in: ['NSE_EQ', 'BSE_EQ', 'NSE', 'BSE'] },
            })
          : [];

      // Map: screener name (UPPERCASE) → best matching instrument
      // Priority: prefix-on-name > contains-in-name > prefix-on-symbol
      // Tie-break: prefer NSE over BSE, then shortest name (most specific)
      const exchangeRank = (inst) => (inst.exchange === 'NSE_EQ' || inst.exchange === 'NSE' ? 0 : 1);
      const instrumentMap = new Map();
      for (const rawName of uniqueNames) {
        const upper = rawName.toUpperCase();
        const escaped = escapeRegex(rawName);
        const prefixRe = new RegExp('^' + escaped, 'i');
        const containsRe = new RegExp(escaped, 'i');

        let candidates = matchedInstruments.filter((i) => prefixRe.test(i.name));
        if (candidates.length === 0) {
          candidates = matchedInstruments.filter((i) => containsRe.test(i.name));
        }
        if (candidates.length === 0) {
          candidates = matchedInstruments.filter((i) => prefixRe.test(i.symbol));
        }

        // Retry with cleaned name (strip trailing punctuation + common suffixes)
        if (candidates.length === 0) {
          const cleaned = rawName
            .replace(/[.,:;!?]+$/g, '')
            .replace(STRIP_SUFFIXES, '')
            .trim();
          if (cleaned !== rawName && cleaned.length >= 3) {
            const cleanEsc = escapeRegex(cleaned);
            const cleanPre = new RegExp('^' + cleanEsc, 'i');
            const cleanCon = new RegExp(cleanEsc, 'i');
            candidates = matchedInstruments.filter((i) => cleanPre.test(i.name));
            if (candidates.length === 0) {
              candidates = matchedInstruments.filter((i) => cleanCon.test(i.name));
            }
          }
        }

        // Retry with company name from frontend (for BSE-code symbols like "514330")
        if (candidates.length === 0) {
          const compName = nameMap[upper];
          if (compName) {
            const compEsc = escapeRegex(compName);
            const compPre = new RegExp('^' + compEsc, 'i');
            const compCon = new RegExp(compEsc, 'i');
            candidates = matchedInstruments.filter((i) => compPre.test(i.name));
            if (candidates.length === 0) {
              candidates = matchedInstruments.filter((i) => compCon.test(i.name));
            }
            // Try first word of company name as NSE symbol
            if (candidates.length === 0) {
              const firstWord = compName.split(/\s+/)[0].toUpperCase();
              if (firstWord.length >= 3) {
                candidates = matchedInstruments.filter((i) => i.symbol.toUpperCase() === firstWord);
              }
            }
          }
        }

        if (candidates.length > 0) {
          candidates.sort(
            (a, b) => exchangeRank(a) - exchangeRank(b) || a.name.length - b.name.length
          );
          instrumentMap.set(upper, candidates[0]);
        }
      }

      apiLogger.info('Screens API', 'instrumentMatching', {
        totalNames: uniqueNames.length,
        matched: instrumentMap.size,
        unmatched: uniqueNames
          .filter((n) => !instrumentMap.has(n.toUpperCase()))
          .slice(0, 20),
      });

      // --- Step 2: Map each symbol → instrument, collect tokens for batch LTP ---
      const symbolToInstrument = new Map();
      const tokensToFetch = new Set();

      for (const rawSymbol of symbols) {
        const sym = (rawSymbol || '').trim().toUpperCase();
        if (!sym) continue;
        const inst = instrumentMap.get(sym);
        if (inst) {
          symbolToInstrument.set(sym, inst);
          tokensToFetch.add(inst.token);
        }
      }

      // --- Step 3: Batch LTP via working Upstox service ---
      //
      // IMPORTANT: Upstox V3 getLtp is a GET request — sending too many instrument
      // tokens in one call can exceed URL-length limits or API batch limits.
      // We chunk into batches of 50 to safely support 150+ stocks.
      //
      // Response keys are EXCHANGE:TRADINGSYMBOL (e.g. "NSE_EQ:COALINDIA"), but
      // each entry includes an instrumentToken field matching the ISIN-based token
      // we sent (e.g. "NSE_EQ|INE522F01014"). We build a reverse map for lookup.
      const tokenToLTP = new Map();
      const tokenArray = [...tokensToFetch];
      const UPSTOX_CHUNK_SIZE = 50;

      if (tokenArray.length > 0) {
        // Split tokens into chunks of 50
        const tokenChunks = [];
        for (let i = 0; i < tokenArray.length; i += UPSTOX_CHUNK_SIZE) {
          tokenChunks.push(tokenArray.slice(i, i + UPSTOX_CHUNK_SIZE));
        }

        apiLogger.info('Screens API', 'batchLTP', {
          totalTokens: tokenArray.length,
          chunks: tokenChunks.length,
        });

        for (const chunk of tokenChunks) {
          try {
            const ltpResult = await upstoxService.getLTP(chunk);
            const rawLTP = (ltpResult && ltpResult.data) || {};

            // Build reverse map using instrumentToken from each entry
            for (const [key, value] of Object.entries(rawLTP)) {
              if (value && value.instrumentToken) {
                tokenToLTP.set(value.instrumentToken, value);
              }
              // Also store by the raw key and its pipe-variant
              tokenToLTP.set(key, value);
              tokenToLTP.set(key.replace(':', '|'), value);
            }
          } catch (ltpError) {
            apiLogger.error('Screens API', 'batchLTP chunk error', ltpError, {
              chunkSize: chunk.length,
            });
          }
        }

        apiLogger.info('Screens API', 'batchLTP complete', {
          requested: tokenArray.length,
          resolved: tokenToLTP.size,
        });
      }

      // --- Step 3b: Yahoo Finance fallback ---
      // Two use-cases:
      //   A) Stocks NOT in Upstox instruments DB at all → full price from Yahoo
      //   B) Stocks in Upstox with lastPrice BUT missing cp (prevClose) →
      //      supplement prevClose from Yahoo so %change isn't stuck at 0%
      //
      // The upstoxService transforms missing cp as `cp: 0` (|| 0 fallback).
      // We detect that here and ask Yahoo for the real previous close.
      const yahooFallbackMap = new Map(); // stockName(UPPER) → { lastPrice, prevClose }

      // (A) Completely unmatched names
      const unmatchedNames = uniqueNames.filter(
        (n) => !symbolToInstrument.has(n.toUpperCase())
      );

      // (B) Matched by Upstox but missing prevClose (cp ≤ 0)
      const missingPrevCloseNames = uniqueNames.filter((n) => {
        const upper = n.toUpperCase();
        const inst = symbolToInstrument.get(upper);
        if (!inst) return false; // already in (A)
        const ltp = tokenToLTP.get(inst.token);
        if (!ltp || ltp.lastPrice == null) return false; // no data at all
        return ltp.cp == null || Number(ltp.cp) <= 0;
      });

      const allNamesForYahoo = [...unmatchedNames, ...missingPrevCloseNames];

      if (allNamesForYahoo.length > 0) {
        apiLogger.info('Screens API', 'yahooFallback start', {
          unmatched: unmatchedNames.length,
          missingPrevClose: missingPrevCloseNames.length,
          total: allNamesForYahoo.length,
          names: allNamesForYahoo.slice(0, 30),
        });

        // Process with limited concurrency (max 5 parallel) to avoid Yahoo rate limits
        await parallelLimit(allNamesForYahoo, 5, async (rawName) => {
          const upper = rawName.toUpperCase();
          // Try symbol first, then company name for BSE-code stocks
          let yahooSymbol = await yahooSearchSymbol(rawName);
          if (!yahooSymbol && nameMap[upper]) {
            yahooSymbol = await yahooSearchSymbol(nameMap[upper]);
          }
          if (!yahooSymbol) return;
          const priceData = await yahooGetPrice(yahooSymbol);
          if (priceData) {
            yahooFallbackMap.set(upper, priceData);
          }
        });

        apiLogger.info('Screens API', 'yahooFallback complete', {
          searched: allNamesForYahoo.length,
          found: yahooFallbackMap.size,
          foundNames: [...yahooFallbackMap.keys()],
        });
      }

      // --- Step 4: AI Fundamental Scoring ---
      // Send all valid stock symbols to Perplexity for fundamental analysis
      const validSymbols = uniqueNames.filter((n) => {
        const upper = n.toUpperCase();
        return symbolToInstrument.has(upper) || yahooFallbackMap.has(upper);
      });

      const aiScoreMap = await getAIFundamentalScores(validSymbols);

      // --- Step 5: Build ranked results with composite scoring ---
      // Helper: compute % change from lastPrice and prevClose
      function calcChange(lastPrice, prevClose) {
        if (lastPrice != null && prevClose != null && prevClose !== 0) {
          return parseFloat(
            (((lastPrice - prevClose) / prevClose) * 100).toFixed(2)
          );
        }
        return null;
      }

      const rankedSymbols = symbols.map((rawSymbol) => {
        const symbol = (rawSymbol || '').trim().toUpperCase();
        if (!symbol) {
          return {
            symbol: rawSymbol || '',
            lastPrice: null,
            prevClose: null,
            percentChange: null,
            score: 0,
            aiScore: 0,
            aiBreakdown: null,
            error: 'Empty symbol',
          };
        }

        const instrument = symbolToInstrument.get(symbol);
        const yahooData = yahooFallbackMap.get(symbol) || null;
        const aiData = aiScoreMap.get(symbol) || null;

        let lastPrice = null;
        let prevClose = null;
        let source = undefined;

        // --- Path 1: Upstox matched + has lastPrice ---
        if (instrument) {
          const ltp = tokenToLTP.get(instrument.token) || null;
          if (ltp && ltp.lastPrice != null) {
            lastPrice = parseFloat(Number(ltp.lastPrice).toFixed(2));
            if (ltp.cp != null && isFinite(Number(ltp.cp)) && Number(ltp.cp) > 0) {
              prevClose = parseFloat(Number(ltp.cp).toFixed(2));
            } else if (yahooData && yahooData.prevClose != null && Number(yahooData.prevClose) > 0) {
              prevClose = parseFloat(Number(yahooData.prevClose).toFixed(2));
            }
          }
        }

        // --- Path 2: Full Yahoo Finance fallback ---
        if (lastPrice == null && yahooData) {
          lastPrice = parseFloat(Number(yahooData.lastPrice).toFixed(2));
          prevClose =
            yahooData.prevClose != null && Number(yahooData.prevClose) > 0
              ? parseFloat(Number(yahooData.prevClose).toFixed(2))
              : null;
          source = 'yahoo';
        }

        if (lastPrice == null) {
          return {
            symbol,
            lastPrice: null,
            prevClose: null,
            percentChange: null,
            score: 0,
            aiScore: 0,
            aiBreakdown: null,
            error: 'No price data available',
          };
        }

        const percentChange = calcChange(lastPrice, prevClose);

        // Composite score: AI fundamental score (0-20) is the PRIMARY ranking factor
        // If AI scoring failed/unavailable, fall back to price-based scoring
        const aiScore = aiData ? aiData.aiScore : 0;
        const score = aiData ? aiData.aiScore : (percentChange != null ? percentChange : 0);

        return {
          symbol,
          lastPrice,
          prevClose,
          percentChange,
          score,           // Used for sorting — AI score if available, else price change
          aiScore,         // The fundamental score (0-24, 6 params × 4 each)
          aiBreakdown: aiData ? {
            health: aiData.health,
            growth: aiData.growth,
            valuation: aiData.valuation,
            technical: aiData.technical,
            orderFlow: aiData.orderFlow || 0,
            institutional: aiData.institutional || 0,
            reason: aiData.reason,
          } : null,
          ...(source ? { source } : {}),
        };
      });

      // Sort by score descending (AI fundamental score, or price change if AI unavailable)
      rankedSymbols.sort((a, b) => b.score - a.score);

      // Log summary
      const validCount = rankedSymbols.filter((s) => !s.error).length;
      apiLogger.info('Screens API', 'rankBatch complete', {
        totalSymbols: symbols.length,
        matchedInstruments: symbolToInstrument.size,
        unmatchedInstruments: symbols.length - symbolToInstrument.size,
        validData: validCount,
      });

      logActivity('ai_ranking', 'ranked', { count: symbols.length, matched: symbolToInstrument.size, valid: validCount });

      res.json({
        status: 'success',
        data: {
          ranked: rankedSymbols,
        },
      });
    } catch (error) {
      logActivity('error', 'rankBatch failed', { error: error.message });
      apiLogger.error('Screens API', 'rankBatch', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to rank batch',
        error: error.message,
      });
    }
  }
);

module.exports = router;
