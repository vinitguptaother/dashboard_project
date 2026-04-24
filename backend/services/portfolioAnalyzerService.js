/**
 * portfolioAnalyzerService.js — CSV-import + AI verdict engine.
 * Phase 2 Track C.
 *
 * Vinit's workflow: download Holdings CSV from Zerodha/Upstox/Groww →
 * upload to dashboard → each stock gets a GOOD / AVERAGE / BAD verdict
 * plus BUY / HOLD / SELL recommendation with detailed reasoning.
 *
 * Reuses llmService (Claude + Perplexity). If ANTHROPIC_API_KEY is missing
 * we return a placeholder verdict instead of failing — so the CSV import
 * path still works for users without AI setup.
 */

const PortfolioHolding = require('../models/PortfolioHolding');
const StockVerdict = require('../models/StockVerdict');
const Instrument = require('../models/Instrument');
const llmService = require('./llmService');

const DEFAULT_USER = 'default';

// ─── CSV parser (self-contained, no new deps) ───────────────────────────────
/**
 * Parse a CSV string into rows of objects keyed by header.
 * Handles basic RFC 4180 cases: quoted fields, embedded commas, CRLF.
 * Does NOT attempt to handle escaped quotes inside quoted fields beyond "".
 */
function parseCSV(csvString) {
  if (!csvString || typeof csvString !== 'string') return [];
  const text = csvString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }

  // Filter empty rows
  const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ''));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map(h => String(h).trim());
  return nonEmpty.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] !== undefined ? String(row[idx]) : '').trim();
    });
    return obj;
  });
}

// ─── Broker column auto-detection ───────────────────────────────────────────
/**
 * Given the row's headers, return a column-map of the canonical field → actual header.
 * Covers Zerodha, Upstox, Groww plus generic Qty/Avg/LTP styles.
 */
function detectMapping(headerKeys) {
  const lowered = headerKeys.map(h => h.toLowerCase());
  const findKey = patterns => {
    for (const p of patterns) {
      const idx = lowered.findIndex(h => p.test(h));
      if (idx !== -1) return headerKeys[idx];
    }
    return null;
  };

  return {
    symbol: findKey([/^symbol$/i, /^instrument$/i, /^stock\s*name$/i, /^scrip$/i, /^tradingsymbol$/i]),
    company: findKey([/company\s*name/i, /^name$/i]),
    quantity: findKey([/^qty\.?$/i, /^quantity$/i, /^shares$/i, /^holdings?$/i]),
    avgBuyPrice: findKey([
      /avg\.?\s*cost/i,
      /avg\.?\s*price/i,
      /average\s*price/i,
      /buy\s*price/i,
      /purchase\s*price/i,
      /^avg\.?$/i,
    ]),
    currentPrice: findKey([/^ltp$/i, /^cmp$/i, /current\s*price/i, /last\s*price/i, /market\s*price/i]),
    currentValue: findKey([/cur\.?\s*val/i, /current\s*value/i, /market\s*value/i, /^value$/i]),
    pnl: findKey([/^p&l$/i, /^pnl$/i, /profit.*loss/i, /unrealized/i]),
    buyDate: findKey([/buy\s*date/i, /purchase\s*date/i, /^date$/i]),
  };
}

function numeric(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value)
    .replace(/[₹,\s]/g, '')
    .replace(/[()]/g, m => (m === '(' ? '-' : ''));
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * importFromCSV — parses and upserts holdings for DEFAULT_USER.
 * Returns { imported, skipped, holdings }.
 * If `mapping` is provided, it wins over auto-detection.
 */
async function importFromCSV(csvString, mapping) {
  const rows = parseCSV(csvString);
  if (rows.length === 0) {
    return { imported: 0, skipped: 0, holdings: [], error: 'CSV is empty or invalid' };
  }

  const headers = Object.keys(rows[0]);
  const effective = { ...detectMapping(headers), ...(mapping || {}) };

  if (!effective.symbol) {
    return {
      imported: 0,
      skipped: rows.length,
      holdings: [],
      error: 'Could not find a Symbol/Instrument column. Supported: Symbol, Instrument, Tradingsymbol, Scrip.',
    };
  }
  if (!effective.quantity) {
    return {
      imported: 0,
      skipped: rows.length,
      holdings: [],
      error: 'Could not find a Quantity column. Supported: Qty., Quantity, Shares, Holdings.',
    };
  }
  if (!effective.avgBuyPrice) {
    return {
      imported: 0,
      skipped: rows.length,
      holdings: [],
      error: 'Could not find an Avg Price column. Supported: Avg. cost, Avg Price, Average Price, Buy Price.',
    };
  }

  // Clear prior holdings so re-uploads are idempotent (Vinit's common case).
  await PortfolioHolding.deleteMany({ userId: DEFAULT_USER });

  const created = [];
  let skipped = 0;
  for (const row of rows) {
    const rawSymbol = (row[effective.symbol] || '').toUpperCase().trim();
    if (!rawSymbol) { skipped++; continue; }

    // Strip common suffixes Zerodha uses ("RELIANCE-EQ" → "RELIANCE")
    const symbol = rawSymbol.replace(/[-_.](EQ|BE|BZ|SM|XT)$/i, '');
    const quantity = numeric(row[effective.quantity]);
    const avgBuyPrice = numeric(row[effective.avgBuyPrice]);
    if (quantity <= 0 || avgBuyPrice <= 0) { skipped++; continue; }

    const currentPrice = effective.currentPrice ? numeric(row[effective.currentPrice]) : avgBuyPrice;
    const company = effective.company ? row[effective.company] : '';

    let buyDate = null;
    if (effective.buyDate && row[effective.buyDate]) {
      const parsed = new Date(row[effective.buyDate]);
      if (!Number.isNaN(parsed.getTime())) buyDate = parsed;
    }

    const doc = new PortfolioHolding({
      userId: DEFAULT_USER,
      symbol,
      company,
      quantity,
      avgBuyPrice,
      currentPrice: currentPrice > 0 ? currentPrice : avgBuyPrice,
      buyDate,
      source: 'manual-csv',
      importedAt: new Date(),
    });
    await doc.save();
    created.push(doc.toObject());
  }

  return {
    imported: created.length,
    skipped,
    holdings: created,
    detectedMapping: effective,
  };
}

// ─── Verdict helpers ────────────────────────────────────────────────────────
function hasClaudeKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!(key && key.trim() && key !== 'your_anthropic_api_key');
}

function buildPlaceholderVerdict(symbol) {
  return {
    symbol,
    verdict: 'HOLD',
    grade: 'AVERAGE',
    confidence: 0,
    summary: 'AI verdict unavailable — add ANTHROPIC_API_KEY to backend/.env to enable stock analysis.',
    detailedReasoning:
      'No AI analysis was performed because ANTHROPIC_API_KEY is not configured. Current holding is shown without a verdict. Once you add your Anthropic API key and restart the backend, click "Analyze all" to generate detailed verdicts for every holding in your portfolio.',
    factors: [
      { name: 'ai-availability', score: 0, weight: 1, note: 'Claude API key missing' },
    ],
    source: 'placeholder',
    generatedAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h only for placeholders
  };
}

/**
 * Calls Claude with the stock context and parses a structured verdict.
 * Assumes hasClaudeKey() === true.
 */
async function callClaudeForVerdict(symbol, ctx) {
  const system = `You are a senior equity research analyst covering Indian NSE/BSE stocks.
You give honest, actionable verdicts for retail swing/long-term investors.
ALWAYS respond with valid JSON matching this exact shape:
{
  "verdict": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "grade": "GOOD" | "AVERAGE" | "BAD",
  "confidence": <0-100 integer>,
  "summary": "<2-3 line plain-English verdict a non-expert can understand>",
  "detailedReasoning": "<5-8 lines explaining fundamentals, technicals, sentiment, and specific catalysts/risks for this stock>",
  "factors": [
    {"name": "Fundamentals", "score": <-100..100>, "weight": <1-5>, "note": "<short>"},
    {"name": "Technicals", "score": <-100..100>, "weight": <1-5>, "note": "<short>"},
    {"name": "Sector momentum", "score": <-100..100>, "weight": <1-5>, "note": "<short>"},
    {"name": "Valuation", "score": <-100..100>, "weight": <1-5>, "note": "<short>"},
    {"name": "Sentiment", "score": <-100..100>, "weight": <1-5>, "note": "<short>"}
  ]
}`;

  const userMsg = `Stock: ${symbol}${ctx.company ? ` (${ctx.company})` : ''}
Exchange: ${ctx.exchange || 'NSE'}
Current price: ₹${ctx.currentPrice ?? 'unknown'}
User's avg buy price: ₹${ctx.avgBuyPrice ?? 'unknown'}
Quantity held: ${ctx.quantity ?? 'unknown'}
Unrealized P&L%: ${ctx.unrealizedPnLPct != null ? ctx.unrealizedPnLPct.toFixed(2) + '%' : 'unknown'}
Sector: ${ctx.sector || 'unknown'}
Market regime context: ${ctx.regime || 'unknown'}
Sector rotation: ${ctx.sectorNote || 'unknown'}

Give a verdict for this holding. Respond with ONLY the JSON object. No prose before or after.`;

  const resp = await llmService.claudeChat({
    model: 'claude-sonnet-4-5',
    system,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 1200,
    operation: 'portfolio-verdict',
    agentId: 'portfolio-analyzer',
  });

  // Strip markdown fences if present
  let content = (resp.content || '').trim();
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) content = fence[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_err) {
    // If Claude returned invalid JSON, surface a minimal HOLD with the raw text.
    return {
      verdict: 'HOLD',
      grade: 'AVERAGE',
      confidence: 30,
      summary: 'AI returned a non-structured response — verdict uncertain.',
      detailedReasoning: content.slice(0, 800),
      factors: [{ name: 'parse-error', score: 0, weight: 1, note: 'JSON parse failed' }],
      source: 'claude',
    };
  }

  return {
    verdict: parsed.verdict || 'HOLD',
    grade: parsed.grade || 'AVERAGE',
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 50)),
    summary: String(parsed.summary || '').slice(0, 600),
    detailedReasoning: String(parsed.detailedReasoning || '').slice(0, 4000),
    factors: Array.isArray(parsed.factors)
      ? parsed.factors.slice(0, 8).map(f => ({
          name: String(f.name || '').slice(0, 60),
          score: Math.max(-100, Math.min(100, Number(f.score) || 0)),
          weight: Math.max(1, Math.min(5, Number(f.weight) || 1)),
          note: String(f.note || '').slice(0, 200),
        }))
      : [],
    source: 'claude',
  };
}

/**
 * analyzeStock — returns a StockVerdict (fresh or newly generated).
 * context is optional — if provided, fields augment the prompt.
 */
async function analyzeStock(symbol, context = {}) {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) throw new Error('symbol required');

  // Reuse fresh cache if present
  const cached = await StockVerdict.findOne({ symbol: sym });
  if (cached && cached.expiresAt.getTime() > Date.now()) {
    return cached.toObject();
  }

  // Pull extra context from holdings + instruments when missing
  let enriched = { ...context };
  if (enriched.currentPrice == null || enriched.avgBuyPrice == null) {
    const holding = await PortfolioHolding.findOne({ userId: DEFAULT_USER, symbol: sym });
    if (holding) {
      enriched = {
        ...enriched,
        currentPrice: enriched.currentPrice ?? holding.currentPrice,
        avgBuyPrice: enriched.avgBuyPrice ?? holding.avgBuyPrice,
        quantity: enriched.quantity ?? holding.quantity,
        unrealizedPnLPct: enriched.unrealizedPnLPct ?? holding.unrealizedPnLPct,
        company: enriched.company ?? holding.company,
      };
    }
  }
  if (!enriched.exchange) {
    try {
      const inst = await Instrument.findOne({ symbol: sym }).lean();
      if (inst) enriched.exchange = inst.exchange;
    } catch (_e) { /* non-fatal */ }
  }

  let verdictData;
  if (!hasClaudeKey()) {
    verdictData = buildPlaceholderVerdict(sym);
  } else {
    try {
      const ai = await callClaudeForVerdict(sym, enriched);
      verdictData = {
        symbol: sym,
        ...ai,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      };
    } catch (err) {
      // If Claude is configured but fails (rate-limit, network), degrade gracefully.
      verdictData = {
        symbol: sym,
        verdict: 'HOLD',
        grade: 'AVERAGE',
        confidence: 0,
        summary: `AI verdict failed: ${err.message.slice(0, 180)}`,
        detailedReasoning: 'Please retry in a moment. If the issue persists, check backend logs and your ANTHROPIC_API_KEY.',
        factors: [{ name: 'error', score: 0, weight: 1, note: err.message.slice(0, 100) }],
        source: 'placeholder',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // short TTL on error
      };
    }
  }

  // Upsert (one row per symbol)
  await StockVerdict.findOneAndUpdate(
    { symbol: sym },
    { $set: verdictData },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const saved = await StockVerdict.findOne({ symbol: sym }).lean();
  return saved;
}

/**
 * getVerdict — returns cached verdict if fresh, else triggers analysis.
 */
async function getVerdict(symbol) {
  const sym = String(symbol || '').toUpperCase().trim();
  const cached = await StockVerdict.findOne({ symbol: sym });
  if (cached && cached.expiresAt.getTime() > Date.now()) {
    return cached.toObject();
  }
  return analyzeStock(sym);
}

/**
 * analyzePortfolio — runs verdict for every holding.
 * Rate-limited: ~1s between Claude calls to avoid bursting.
 * Returns [{ holding, verdict }].
 */
async function analyzePortfolio() {
  const holdings = await PortfolioHolding.find({ userId: DEFAULT_USER }).sort({ symbol: 1 });
  if (holdings.length === 0) return { count: 0, rows: [], aiAvailable: hasClaudeKey() };

  const rows = [];
  let placeholderCount = 0;

  for (let i = 0; i < holdings.length; i++) {
    const h = holdings[i];
    try {
      const verdict = await analyzeStock(h.symbol, {
        currentPrice: h.currentPrice,
        avgBuyPrice: h.avgBuyPrice,
        quantity: h.quantity,
        unrealizedPnLPct: h.unrealizedPnLPct,
        company: h.company,
      });
      if (verdict.source === 'placeholder') placeholderCount++;
      rows.push({ holding: h.toObject(), verdict });
    } catch (err) {
      rows.push({
        holding: h.toObject(),
        verdict: { symbol: h.symbol, verdict: 'HOLD', grade: 'AVERAGE', summary: `Failed: ${err.message}`, source: 'placeholder' },
      });
      placeholderCount++;
    }

    // small delay between real Claude calls — skip on placeholders for speed
    if (hasClaudeKey() && i < holdings.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return {
    count: rows.length,
    rows,
    aiAvailable: hasClaudeKey(),
    placeholderCount,
  };
}

module.exports = {
  importFromCSV,
  parseCSV,
  detectMapping,
  getVerdict,
  analyzeStock,
  analyzePortfolio,
  hasClaudeKey,
};
