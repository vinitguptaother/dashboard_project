/**
 * Smart Money Tracker — weekly (Sunday) AI research agent.
 *
 * Purpose:
 *   Identify WHO (named HNI/FII/DII entities) are accumulating or distributing
 *   WHAT (sectors/stocks) this week in Indian markets, WHY it matters for
 *   Vinit's swing + long-term book, and with what CONFIDENCE.
 *
 * Data sources (READ-ONLY):
 *   - AgentMemory       (lastSnapshot, topPlayerList, runningObservations)
 *   - LargeDeal         (last 7 days of NSE bulk/block/short deals)
 *   - FiiDiiDaily       (last 7 days of institutional cash flow)
 *   - ParticipantOI     (last 7 days of F&O participant-wise OI, if collection exists)
 *   - CorporateEvent    (upcoming earnings in 7-day window)
 *   - Perplexity sonar-pro (named-investor news + FII weekly flow)
 *
 * Synthesis:
 *   - Claude Sonnet 4.5 produces a ~200-word briefing + structured JSON.
 *
 * Safety:
 *   - ONLY writes to: AgentMemory (own bucket), LLMUsage, ActionItem.
 *
 * Graceful degradation:
 *   - If ANTHROPIC_API_KEY is missing, Perplexity portion still logs usage and
 *     returns a partial success; Claude synthesis step throws a helpful error
 *     caught in run() — the agent does NOT crash the route.
 *
 * Cost estimate: ~50k input tokens/run -> ~$0.22 (~₹18) per weekly run.
 */

const mongoose = require('mongoose');
const AgentBase = require('./agentBase');
const llmService = require('../llmService');

// Read-only models
const LargeDeal = require('../../models/LargeDeal');
const FiiDiiDaily = require('../../models/FiiDiiDaily');
const CorporateEvent = require('../../models/CorporateEvent');
const Portfolio = require('../../models/Portfolio');

const ACTION_ITEM_SOURCE = 'chief-analyst';

// ─── Utilities ──────────────────────────────────────────────────────────────

function isoWeek(date = new Date()) {
  // Returns `YYYY-WW` tag in IST for dedup keying
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

function safeNum(n, digits = 2) {
  const x = Number(n);
  return Number.isFinite(x) ? +x.toFixed(digits) : 0;
}

class SmartMoneyTracker extends AgentBase {
  constructor() {
    super({
      agentKey: 'smart-money-tracker',
      displayName: 'Smart Money Tracker',
      defaultModel: 'claude-sonnet-4-5',
    });
  }

  // ─── Helper: load last 7 days of institutional activity ───────────────────

  async _fetchInstitutionalActivity() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const ctx = {
      largeDeals: { count: 0, top: [], topBuyers: [], topSellers: [] },
      fiiDii: { days: 0, fiiNetCr: 0, diiNetCr: 0, recent: [] },
      participantOI: { available: false, summary: '' },
      corporateEvents: { count: 0, upcomingEarnings: [] },
    };

    // 1. Large deals (bulk + block only — short deals aggregate per symbol)
    try {
      const deals = await LargeDeal.find({
        dealDate: { $gte: sevenDaysAgo },
        kind: { $in: ['bulk', 'block'] },
      }).sort({ dealDate: -1, valueCr: -1 }).limit(200).lean();

      ctx.largeDeals.count = deals.length;
      ctx.largeDeals.top = deals.slice(0, 20).map(d => ({
        date: d.dealDate?.toISOString()?.slice(0, 10) || '',
        symbol: d.symbol,
        client: (d.clientName || '').slice(0, 60),
        side: d.buySell,
        valueCr: safeNum(d.valueCr),
      }));

      // Aggregate top buyers / sellers by client name
      const buyerMap = new Map();
      const sellerMap = new Map();
      for (const d of deals) {
        if (!d.clientName) continue;
        const map = d.buySell === 'BUY' ? buyerMap : d.buySell === 'SELL' ? sellerMap : null;
        if (!map) continue;
        const key = d.clientName;
        const prev = map.get(key) || { client: key, totalCr: 0, symbols: new Set() };
        prev.totalCr += d.valueCr || 0;
        prev.symbols.add(d.symbol);
        map.set(key, prev);
      }
      const toArr = m => Array.from(m.values())
        .map(x => ({ client: x.client, totalCr: safeNum(x.totalCr), symbols: Array.from(x.symbols).slice(0, 5) }))
        .sort((a, b) => b.totalCr - a.totalCr)
        .slice(0, 8);
      ctx.largeDeals.topBuyers = toArr(buyerMap);
      ctx.largeDeals.topSellers = toArr(sellerMap);
    } catch (err) {
      console.warn('[smart-money-tracker] LargeDeal read failed:', err.message);
    }

    // 2. FII/DII (last 7 days)
    try {
      const recent = await FiiDiiDaily.find({}).sort({ date: -1 }).limit(7).lean();
      ctx.fiiDii.days = recent.length;
      ctx.fiiDii.fiiNetCr = safeNum(recent.reduce((s, r) => s + (r.fii?.netValue || 0), 0));
      ctx.fiiDii.diiNetCr = safeNum(recent.reduce((s, r) => s + (r.dii?.netValue || 0), 0));
      ctx.fiiDii.recent = recent.map(r => ({
        date: r.date,
        fiiNet: safeNum(r.fii?.netValue),
        diiNet: safeNum(r.dii?.netValue),
      }));
    } catch (err) {
      console.warn('[smart-money-tracker] FiiDiiDaily read failed:', err.message);
    }

    // 3. ParticipantOI — optional, only read if model/collection exists
    try {
      const ParticipantOI = mongoose.models.ParticipantOI
        || (mongoose.modelNames().includes('ParticipantOI') ? mongoose.model('ParticipantOI') : null);
      if (ParticipantOI && typeof ParticipantOI.find === 'function') {
        const rows = await ParticipantOI.find({
          date: { $gte: sevenDaysAgo },
        }).sort({ date: -1 }).limit(50).lean();
        if (rows.length) {
          ctx.participantOI.available = true;
          ctx.participantOI.summary = `${rows.length} rows last 7d`;
          ctx.participantOI.rows = rows.slice(0, 15);
        }
      }
    } catch {
      // silently skip — collection is optional
    }

    // 4. Upcoming earnings in portfolios
    try {
      const portfolios = await Portfolio.find({ isActive: true }).lean();
      const portfolioSymbols = new Set();
      for (const p of portfolios) {
        for (const pos of (p.positions || [])) {
          if (pos.symbol) portfolioSymbols.add(pos.symbol.toUpperCase());
        }
      }
      const upcomingWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const events = await CorporateEvent.find({
        kind: 'meeting',
        eventDate: { $gte: now, $lte: upcomingWindow },
        ...(portfolioSymbols.size ? { symbol: { $in: Array.from(portfolioSymbols) } } : {}),
      }).sort({ eventDate: 1 }).limit(15).lean();
      ctx.corporateEvents.count = events.length;
      ctx.corporateEvents.upcomingEarnings = events.map(e => ({
        symbol: e.symbol,
        date: e.eventDate?.toISOString()?.slice(0, 10) || '',
        subject: e.subject,
      }));
    } catch (err) {
      console.warn('[smart-money-tracker] CorporateEvent read failed:', err.message);
    }

    return ctx;
  }

  // ─── Helper: Perplexity smart-money news ───────────────────────────────────

  async _fetchSmartMoneyNews() {
    const today = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
    });

    const prompt =
`Research Indian stock market smart-money activity for the week ending ${today}.
Cover EXACTLY these four buckets, 2-3 sentences each with specific rupee amounts,
named entities, stock tickers, and date references where possible:

1. Named HNI / super-investor moves this week — think Rakesh Jhunjhunwala estate,
   Vijay Kedia, Radhakishan Damani, Ashish Kacholia, Porinju Veliyath, Mohnish Pabrai,
   Dolly Khanna, Sunil Singhania, Akash Bhanshali. Any BSE/NSE filings (SAST, insider,
   bulk/block disclosures) they made this week?

2. FII / FPI weekly India equity flows — net buy or sell, sectors favoured, any notable
   fund or custodian being flagged (Morgan Stanley, Norges, GQG, Vanguard, BlackRock, etc.).

3. DII / mutual-fund action — AMFI data, any big MF adding/trimming a stock, LIC moves.

4. Promoter / insider activity — meaningful promoter stake changes, SAST trigger,
   open offers, OFS announcements this week.

Be strictly factual, cite sources, and include dates. No advice, no speculation.`;

    try {
      const result = await llmService.perplexityAsk({
        prompt,
        model: 'sonar-pro',
        maxTokens: 1800,
        operation: 'smart-money-tracker:news-fetch',
        agentId: this.agentKey,
      });
      return {
        content: result.content,
        citations: result.citations || [],
        costUSD: result.costUSD,
        tokensIn: result.tokensIn || 0,
        tokensOut: result.tokensOut || 0,
      };
    } catch (err) {
      console.warn('[smart-money-tracker] Perplexity fetch failed:', err.message);
      return { content: '', citations: [], costUSD: 0, tokensIn: 0, tokensOut: 0, error: err.message };
    }
  }

  _parseJSON(text) {
    const match = text && text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }

  // ─── run() ────────────────────────────────────────────────────────────────

  async run() {
    const startedAt = Date.now();
    let totalTokensIn = 0, totalTokensOut = 0, totalCostUSD = 0;
    let perplexityOk = false;

    try {
      // 1. Memory
      const lastSnapshot = await this.loadMemory('lastSnapshot');
      const topPlayerList = await this.loadMemory('topPlayerList');
      const runningObservations = await this.loadMemory('runningObservations');

      // 2. Institutional activity from MongoDB
      const activity = await this._fetchInstitutionalActivity();

      // 3. Perplexity news
      const news = await this._fetchSmartMoneyNews();
      totalCostUSD += news.costUSD || 0;
      totalTokensIn += news.tokensIn || 0;
      totalTokensOut += news.tokensOut || 0;
      perplexityOk = !!news.content;

      // 4. Build Claude prompt
      const systemPrompt =
`You are Vinit's smart-money analyst. Vinit is a retail swing + long-term investor
in India (NSE/BSE). Every Sunday you tell him, in 200 words of plain English:

  WHO  — named HNI / FII / DII / promoter entities that are BUYING or SELLING this week
  WHAT — which sectors / stocks are being accumulated or distributed
  WHY  — what it means for his swing trades and long-term positions
  CONFIDENCE — how trustworthy this read is (0-1), because smart-money data is noisy

Rules:
  - Use ONLY the provided dashboard data + Perplexity news. Do not invent filings.
  - If a claim comes from dashboard large-deal data, reference the client name.
  - If a claim comes only from news, say "reportedly" or hedge appropriately.
  - Do NOT give trade advice. Just describe the footprint and its implication.
  - If data is thin, say so explicitly rather than padding.

Output STRICTLY as JSON (no prose before or after):
{
  "briefing": "string — 180-220 words, plain English",
  "topBuyers": [{ "entity": "name", "sector": "string", "symbols": ["SYM"], "confidence": 0.0-1.0 }],
  "topSellers": [{ "entity": "name", "sector": "string", "symbols": ["SYM"], "confidence": 0.0-1.0 }],
  "sectorsAccumulated": ["sector", ...],
  "sectorsDistributed": ["sector", ...],
  "portfolioWatch": ["SYM", ...],          // symbols with upcoming earnings + smart-money action
  "overallConfidence": 0.0-1.0,
  "observation": "string — 1 sentence worth remembering for future weeks"
}`;

      const contextBlob = `
── DASHBOARD: LARGE DEALS (last 7 days) ──
Total rows: ${activity.largeDeals.count}
TOP BUYERS (by ₹ value):
${activity.largeDeals.topBuyers.map(b => `  • ${b.client} — ₹${b.totalCr}cr — ${b.symbols.join(', ')}`).join('\n') || '  (none)'}
TOP SELLERS (by ₹ value):
${activity.largeDeals.topSellers.map(s => `  • ${s.client} — ₹${s.totalCr}cr — ${s.symbols.join(', ')}`).join('\n') || '  (none)'}
TOP 10 SINGLE DEALS:
${activity.largeDeals.top.slice(0, 10).map(d => `  • ${d.date} ${d.symbol} ${d.side} ${d.valueCr}cr by ${d.client}`).join('\n') || '  (none)'}

── DASHBOARD: FII/DII (last 7 days, ₹ crore) ──
Days captured: ${activity.fiiDii.days}
Cumulative FII net: ${activity.fiiDii.fiiNetCr} · DII net: ${activity.fiiDii.diiNetCr}
Daily:
${activity.fiiDii.recent.map(r => `  ${r.date}: FII ${r.fiiNet >= 0 ? '+' : ''}${r.fiiNet} · DII ${r.diiNet >= 0 ? '+' : ''}${r.diiNet}`).join('\n') || '  (none)'}

── DASHBOARD: PARTICIPANT-WISE OI (F&O) ──
${activity.participantOI.available ? activity.participantOI.summary : 'Not available in this dashboard — rely on news + deal data.'}

── DASHBOARD: UPCOMING PORTFOLIO EARNINGS (next 7 days) ──
${activity.corporateEvents.upcomingEarnings.map(e => `  • ${e.date} ${e.symbol} — ${e.subject}`).join('\n') || '  (none — or no portfolio positions)'}

── EXTERNAL NEWS (Perplexity sonar-pro) ──
${news.content || '(Perplexity unavailable — synthesize from dashboard data only and flag the gap.)'}

── LAST WEEK'S SNAPSHOT ──
${lastSnapshot ? JSON.stringify(lastSnapshot.briefing ? { briefing: lastSnapshot.briefing } : lastSnapshot, null, 2).slice(0, 1200) : '(none yet — this is the first run)'}

── KNOWN TOP PLAYER LIST (entities seen repeatedly) ──
${topPlayerList ? JSON.stringify(topPlayerList).slice(0, 600) : '(empty — build it this run)'}

── RUNNING OBSERVATIONS ──
${runningObservations ? (typeof runningObservations === 'string' ? runningObservations : JSON.stringify(runningObservations)).slice(0, 600) : '(none yet)'}

Produce this Sunday's smart-money JSON now.`;

      // 5. Call Claude — this is the step that fails gracefully without ANTHROPIC_API_KEY
      let parsed = null;
      let claudeError = null;
      try {
        const claudeResult = await llmService.claudeChat({
          model: this.defaultModel,
          system: systemPrompt,
          messages: [{ role: 'user', content: contextBlob }],
          maxTokens: 2000,
          operation: 'smart-money-tracker:synthesize',
          agentId: this.agentKey,
        });
        totalTokensIn += claudeResult.tokensIn;
        totalTokensOut += claudeResult.tokensOut;
        totalCostUSD += claudeResult.costUSD;
        parsed = this._parseJSON(claudeResult.content);
        if (!parsed || !parsed.briefing) {
          throw new Error('Claude did not return valid smart-money JSON. Raw: ' +
            (claudeResult.content || '').slice(0, 300));
        }
      } catch (err) {
        claudeError = err.message;
        console.warn('[smart-money-tracker] Claude synthesis failed:', err.message);
      }

      // If Claude failed but Perplexity worked, return partial success so caller
      // sees that the data-gathering half of the agent is healthy.
      if (!parsed) {
        return {
          success: false,
          partial: perplexityOk,
          error: claudeError || 'No synthesis produced',
          output: {
            perplexityAvailable: perplexityOk,
            perplexityContent: news.content ? news.content.slice(0, 800) : '',
            dashboardContext: activity,
          },
          tokensUsed: { in: totalTokensIn, out: totalTokensOut },
          costUSD: +totalCostUSD.toFixed(6),
          durationMs: Date.now() - startedAt,
        };
      }

      // 6. Save memory
      const snapshot = {
        briefing: parsed.briefing,
        topBuyers: parsed.topBuyers || [],
        topSellers: parsed.topSellers || [],
        sectorsAccumulated: parsed.sectorsAccumulated || [],
        sectorsDistributed: parsed.sectorsDistributed || [],
        portfolioWatch: parsed.portfolioWatch || [],
        overallConfidence: typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : 0.5,
        observation: parsed.observation || '',
        generatedAt: new Date().toISOString(),
        weekTag: isoWeek(),
        citations: (news.citations || []).slice(0, 5),
      };
      await this.saveMemory('lastSnapshot', snapshot);

      // Keep a rolling top-player list (merge known names)
      try {
        const knownEntities = new Set(
          (Array.isArray(topPlayerList) ? topPlayerList : []).map(x => String(x).toLowerCase())
        );
        [...(parsed.topBuyers || []), ...(parsed.topSellers || [])]
          .map(x => x && x.entity)
          .filter(Boolean)
          .forEach(n => knownEntities.add(String(n).toLowerCase()));
        await this.saveMemory(
          'topPlayerList',
          Array.from(knownEntities).slice(0, 100)
        );
      } catch {}

      // Append to running observations (cap at 20 entries)
      try {
        const obs = Array.isArray(runningObservations) ? runningObservations.slice() : [];
        if (parsed.observation) {
          obs.push({ week: isoWeek(), obs: parsed.observation });
        }
        await this.saveMemory('runningObservations', obs.slice(-20));
      } catch {}

      // 7. ActionItem (dedup per ISO week)
      const buyersLine = (parsed.topBuyers || []).slice(0, 3)
        .map(b => `• Buy: ${b.entity}${b.symbols?.length ? ` → ${b.symbols.join(', ')}` : ''}`).join('\n');
      const sellersLine = (parsed.topSellers || []).slice(0, 3)
        .map(s => `• Sell: ${s.entity}${s.symbols?.length ? ` → ${s.symbols.join(', ')}` : ''}`).join('\n');
      const description = [
        parsed.briefing,
        '',
        buyersLine,
        sellersLine,
        parsed.portfolioWatch?.length ? `Portfolio watch: ${parsed.portfolioWatch.join(', ')}` : '',
      ].filter(Boolean).join('\n');

      await this.writeActionItem({
        title: `Smart Money — weekly snapshot (${isoWeek()})`,
        description,
        impact: 'Skipping means missing named-HNI / FII footprints that often lead retail by days-to-weeks.',
        action: 'Review buyers/sellers → cross-check against your watchlist and open positions.',
        priority: 'MEDIUM',
        source: ACTION_ITEM_SOURCE,
        dedupKey: `smart-money:weekly:${isoWeek()}`,
      });

      return {
        success: true,
        output: {
          ...snapshot,
          dashboardContext: activity,
          newsAvailable: perplexityOk,
        },
        tokensUsed: { in: totalTokensIn, out: totalTokensOut },
        costUSD: +totalCostUSD.toFixed(6),
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      console.error('[smart-money-tracker] run() failed:', err.message);
      return {
        success: false,
        error: err.message,
        tokensUsed: { in: totalTokensIn, out: totalTokensOut },
        costUSD: +totalCostUSD.toFixed(6),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

module.exports = new SmartMoneyTracker();
