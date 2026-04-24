/**
 * Chief Analyst — the super-bot (Tier 1 of MASTER_PLAN §3).
 *
 * Synthesizes:
 *   - Market context (regime, FII/DII, sector rotation, breadth, participant OI)
 *   - All specialist research agents' latest outputs (Market Scout, Smart Money,
 *     Pattern Miner, Sentiment Watcher)
 *   - Last 30 days of closed-trade stats (per bot) via learningEngineService
 *   - Recent TradingLessons
 *   - All 5 of its own memory stores (see below)
 *
 * Modes:
 *   - 'briefing'    → 3×/day (07:00, 12:00, 15:35 IST) — structured JSON briefing
 *   - 'deep-review' → weekly Sunday 10:00 IST — Opus, deeper thesis + lessons
 *   - 'chat'        → user asks a question, CA answers conversationally
 *
 * 5 memory stores (AgentMemory.stores):
 *   - CA_MarketView    → current thesis (regime + sector + flow view)
 *   - CA_TraderProfile → accumulated notes on Vinit's style
 *   - CA_Predictions   → rolling array of predictions with outcome check
 *   - CA_Lessons       → distilled lessons from verified predictions
 *   - CA_ShortTerm     → rolling 7-day briefing log (compacted weekly)
 *
 * Safety:
 *   - READS widely (any collection for context)
 *   - WRITES ONLY to: AgentMemory (own stores), ActionItem, LLMUsage
 *   - Chat mode NEVER writes memory — experimental queries shouldn't pollute context
 *   - No price predictions, no "X will rise Y%" — confidence + caveats enforced
 *     in the system prompt
 */

const AgentBase = require('./agentBase');
const llmService = require('../llmService');

// Context sources (all read-only)
const MarketRegime = require('../../models/MarketRegime');
const FiiDiiDaily = require('../../models/FiiDiiDaily');
const SectorPerformance = require('../../models/SectorPerformance');
const BreadthSnapshot = require('../../models/BreadthSnapshot');
const ParticipantOI = require('../../models/ParticipantOI');
const AgentMemory = require('../../models/AgentMemory');
const TradingLesson = require('../../models/TradingLesson');
const ActionItem = require('../../models/ActionItem');
const learningEngineService = require('../learningEngineService');

// Memory store keys (kept as constants so UI + compaction stay in sync)
const MEMORY_KEYS = {
  MarketView: 'CA_MarketView',
  TraderProfile: 'CA_TraderProfile',
  Predictions: 'CA_Predictions',
  Lessons: 'CA_Lessons',
  ShortTerm: 'CA_ShortTerm',
};

// Other agents we read latest output from
const PEER_AGENTS = ['market-scout', 'smart-money-tracker', 'pattern-miner', 'sentiment-watcher'];

// Max rolling entries in short-term + predictions before compaction
const SHORT_TERM_MAX = 21;   // 7 days × 3 briefings
const PREDICTIONS_MAX = 50;

class ChiefAnalyst extends AgentBase {
  constructor() {
    super({
      agentKey: 'chief-analyst',
      displayName: 'Chief Analyst',
      defaultModel: 'claude-sonnet-4-5',
    });
  }

  // ─── Context loaders (parallel-friendly) ────────────────────────────────

  async loadMarketContext() {
    const safeOne = async (Model, sort = { computedAt: -1 }) => {
      try { return await Model.findOne({}).sort(sort).lean(); } catch { return null; }
    };
    const [regime, fii, sector, breadth, poi] = await Promise.all([
      safeOne(MarketRegime),
      safeOne(FiiDiiDaily, { date: -1 }),
      safeOne(SectorPerformance),
      safeOne(BreadthSnapshot, { at: -1 }).catch(() => safeOne(BreadthSnapshot)),
      safeOne(ParticipantOI, { date: -1 }),
    ]);
    return {
      regime: regime
        ? {
            regime: regime.regime,
            confidence: regime.confidence,
            reason: regime.reason,
            nifty: regime.inputs?.niftyLevel,
            vix: regime.inputs?.vix,
            computedAt: regime.computedAt,
          }
        : null,
      fiiDii: fii
        ? { date: fii.date, fiiNetCr: fii.fii?.netValue || 0, diiNetCr: fii.dii?.netValue || 0 }
        : null,
      sectors: sector
        ? {
            leaders: sector.leaders || [],
            laggards: sector.laggards || [],
            niftyDayChangePct: sector.niftyDayChangePct,
          }
        : null,
      breadth: breadth
        ? {
            adv: breadth.adv, decl: breadth.decl, advDeclRatio: breadth.advDeclRatio,
            pct52WHighs: breadth.pct52WHighs, state: breadth.breadth,
          }
        : null,
      participantOI: poi
        ? {
            date: poi.date,
            fii_fut: poi.fii_long_short_ratio_futures,
            fii_opt: poi.fii_long_short_ratio_options,
            dii: poi.dii_long_short_ratio,
            client: poi.client_long_short_ratio,
          }
        : null,
    };
  }

  async loadAgentOutputs() {
    const out = {};
    const docs = await AgentMemory.find({ agentKey: { $in: PEER_AGENTS } }).lean();
    for (const d of docs) {
      out[d.agentKey] = {
        // Surface the handful of known "output" keys without dumping huge blobs
        lastBriefing: d.stores?.lastBriefing || null,
        runningThesis: d.stores?.runningThesis || null,
        lastReport: d.stores?.lastReport || null,
        lastScan: d.stores?.lastScan || null,
        lastUpdated: d.lastUpdated,
      };
    }
    return out;
  }

  async loadTradeStats() {
    const botIds = ['swing', 'longterm', 'options-sell', 'options-buy'];
    const stats = {};
    await Promise.all(botIds.map(async (b) => {
      try {
        stats[b] = await learningEngineService.computeBotPerformance({ botId: b, windowDays: 30 });
      } catch (err) {
        stats[b] = { error: err.message };
      }
    }));
    return stats;
  }

  async loadRecentLessons(limit = 10) {
    try {
      return await TradingLesson.find({}).sort({ generatedAt: -1 }).limit(limit).lean();
    } catch {
      return [];
    }
  }

  async loadAllMemories() {
    const doc = await AgentMemory.findOne({ agentKey: this.agentKey }).lean();
    const stores = doc?.stores || {};
    return {
      marketView: stores[MEMORY_KEYS.MarketView] || null,
      traderProfile: stores[MEMORY_KEYS.TraderProfile] || null,
      predictions: stores[MEMORY_KEYS.Predictions] || [],
      lessons: stores[MEMORY_KEYS.Lessons] || [],
      shortTerm: stores[MEMORY_KEYS.ShortTerm] || [],
    };
  }

  // ─── Prompt construction ────────────────────────────────────────────────

  buildSystemPrompt(mode) {
    const common =
`You are Vinit's personal Chief Analyst for his Indian-market swing + long-term trading dashboard.

ABOUT VINIT
- Retail trader, not a professional. Based in India, trades NSE/BSE.
- Not from a technical background — explain clearly, avoid jargon, keep numbers concrete (INR, lakhs/crores).
- Relies on screens, AI ranking, paper trading, and hit-rate tracking.

YOUR BOUNDARIES (NEVER violate)
1. No price predictions like "stock will rise 8% with 92% confidence". Use bands, caveats, confidence levels (LOW / MEDIUM / HIGH).
2. You synthesize — you do NOT place trades. Every action you surface goes through the ActionItem card for Vinit's approval.
3. Be brutally honest about uncertainty. If data is thin, say so.
4. Favour probabilistic language ("evidence suggests", "tilt toward", "risk if") over definitive claims.
5. Indian-market specific. Use FII/DII, participant OI, GIFT Nifty, sector rotation idiom.
6. Reference your own running memories — keep continuity day-over-day.
7. Never make claims about what single stocks will do tomorrow.

YOUR MEMORY (5 stores)
- CA_MarketView: your current thesis about regime + flows + sectors
- CA_TraderProfile: what you've learned about Vinit's style (conservatism, favourite screens, mistakes)
- CA_Predictions: previous predictions + whether they played out
- CA_Lessons: distilled lessons from the predictions
- CA_ShortTerm: last ~7 days of briefings for context continuity`;

    if (mode === 'chat') {
      return `${common}

MODE: CHAT
Vinit is asking you a direct question. Respond conversationally, concisely,
and practically. Use plain prose (not JSON). Be warm but not fawning.
Cite specific data points you're using (regime, FII number, etc.) when
relevant. If you don't know, say so. Keep replies under 250 words unless the
question clearly needs depth.`;
    }

    if (mode === 'deep-review') {
      return `${common}

MODE: WEEKLY DEEP REVIEW
Produce a comprehensive weekly synthesis. Review what predictions came true
vs didn't, what the trade stats say about each bot, where the regime sits,
and what Vinit should focus on next week. Distil 3-5 durable lessons for
CA_Lessons.

OUTPUT STRICTLY AS JSON (no prose before/after):
{
  "briefing": "string — 400-700 word weekly review, plain English",
  "thesis": "string — 1-3 sentence current market thesis",
  "predictionReviews": [{"prediction": "...", "outcome": "hit|miss|inconclusive", "note": "..."}],
  "newLessons": ["string", ...],
  "actions": [
    {"title": "short title", "description": "...", "impact": "...", "nextStep": "...", "priority": "URGENT|HIGH|MEDIUM|LOW"}
  ],
  "predictions": [{"claim": "...", "horizon": "1w|1m", "confidence": "LOW|MEDIUM|HIGH"}],
  "confidence": 0.0-1.0
}`;
    }

    // briefing (default)
    return `${common}

MODE: DAILY BRIEFING
Produce today's briefing for Vinit. Integrate the specialist agents' outputs,
current market context, trade stats, and your running memories.

OUTPUT STRICTLY AS JSON (no prose before/after):
{
  "briefing": "string — 200-350 word briefing, plain English, India-specific",
  "thesis": "string — 1-2 sentence market thesis (becomes CA_MarketView)",
  "actions": [
    {"title": "short title", "description": "...", "impact": "...", "nextStep": "...", "priority": "URGENT|HIGH|MEDIUM|LOW"}
  ],
  "predictions": [
    {"claim": "string (no hard price targets)", "horizon": "1d|1w", "confidence": "LOW|MEDIUM|HIGH"}
  ],
  "confidence": 0.0-1.0
}

Rules:
- 0-4 actions. Only include an action if it is clearly useful.
- 0-3 predictions. Use broad claims ("NIFTY likely to hold above X support zone"), never exact price predictions.
- Confidence reflects how strong your evidence is, not how good the outcome will be.`;
  }

  buildUserPrompt({ marketContext, agentOutputs, tradeStats, lessons, myMemory, userQuery }) {
    const blob = [];
    blob.push('── MARKET CONTEXT ──');
    blob.push(marketContext.regime
      ? `REGIME: ${marketContext.regime.regime} (conf ${(marketContext.regime.confidence || 0).toFixed(2)}) — ${marketContext.regime.reason || 'n/a'}. NIFTY ${marketContext.regime.nifty}, VIX ${marketContext.regime.vix}`
      : 'REGIME: no snapshot');
    blob.push(marketContext.fiiDii
      ? `FII/DII (${marketContext.fiiDii.date}): FII ₹${marketContext.fiiDii.fiiNetCr} cr net, DII ₹${marketContext.fiiDii.diiNetCr} cr net`
      : 'FII/DII: no data');
    blob.push(marketContext.sectors
      ? `SECTOR — Leaders: ${(marketContext.sectors.leaders || []).join(', ') || 'n/a'} | Laggards: ${(marketContext.sectors.laggards || []).join(', ') || 'n/a'}`
      : 'SECTORS: no data');
    blob.push(marketContext.breadth
      ? `BREADTH: adv ${marketContext.breadth.adv} / decl ${marketContext.breadth.decl} (ratio ${marketContext.breadth.advDeclRatio}); state=${marketContext.breadth.state}`
      : 'BREADTH: no snapshot');
    blob.push(marketContext.participantOI
      ? `PARTICIPANT OI (${marketContext.participantOI.date}): FII_fut=${marketContext.participantOI.fii_fut}, FII_opt=${marketContext.participantOI.fii_opt}, DII=${marketContext.participantOI.dii}, Client=${marketContext.participantOI.client}`
      : 'PARTICIPANT OI: no data');

    blob.push('\n── SPECIALIST AGENTS — LATEST ──');
    for (const key of Object.keys(agentOutputs || {})) {
      const a = agentOutputs[key];
      if (!a) continue;
      blob.push(`[${key}] updated=${a.lastUpdated ? new Date(a.lastUpdated).toISOString() : 'n/a'}`);
      const summary = a.lastBriefing?.briefing || a.lastReport?.summary || a.lastScan?.summary || a.runningThesis;
      if (summary) blob.push(`  → ${typeof summary === 'string' ? summary.slice(0, 400) : JSON.stringify(summary).slice(0, 400)}`);
    }

    blob.push('\n── TRADE STATS (last 30 days, per bot) ──');
    for (const bot of Object.keys(tradeStats || {})) {
      const s = tradeStats[bot];
      if (!s || s.error) { blob.push(`[${bot}] unavailable`); continue; }
      blob.push(`[${bot}] trades=${s.totalTrades}, win%=${(s.winRate * 100).toFixed(1)}, avg=${s.avgReturnPct}%, Sharpe=${s.sharpe}, PF=${s.profitFactor}, worst=${s.worstReturn}%, CI=[${(s.credibleWinRate.lower * 100).toFixed(0)}-${(s.credibleWinRate.upper * 100).toFixed(0)}]%`);
    }

    if (lessons?.length) {
      blob.push('\n── RECENT TRADING LESSONS ──');
      for (const L of lessons.slice(0, 10)) {
        blob.push(`- [${L.symbol} · ${L.verdict}] ${(L.lessons || []).join(' · ').slice(0, 240)}`);
      }
    }

    blob.push('\n── YOUR MEMORIES ──');
    blob.push(`CA_MarketView: ${myMemory.marketView ? (typeof myMemory.marketView === 'string' ? myMemory.marketView : JSON.stringify(myMemory.marketView).slice(0, 400)) : '(none)'}`);
    blob.push(`CA_TraderProfile: ${myMemory.traderProfile ? (typeof myMemory.traderProfile === 'string' ? myMemory.traderProfile : JSON.stringify(myMemory.traderProfile).slice(0, 400)) : '(none)'}`);
    if (Array.isArray(myMemory.lessons) && myMemory.lessons.length) {
      blob.push(`CA_Lessons (last 5): ${myMemory.lessons.slice(-5).map(l => `- ${typeof l === 'string' ? l : l.lesson || JSON.stringify(l)}`).join('\n')}`);
    }
    if (Array.isArray(myMemory.predictions) && myMemory.predictions.length) {
      blob.push(`CA_Predictions (last 5): ${myMemory.predictions.slice(-5).map(p => `- ${typeof p === 'string' ? p : (p.claim || JSON.stringify(p))}`).join('\n')}`);
    }
    if (Array.isArray(myMemory.shortTerm) && myMemory.shortTerm.length) {
      blob.push(`CA_ShortTerm (last 3): ${myMemory.shortTerm.slice(-3).map(s => `- ${typeof s === 'string' ? s.slice(0, 200) : (s.thesis || JSON.stringify(s)).slice(0, 200)}`).join('\n')}`);
    }

    if (userQuery) {
      blob.push('\n── VINIT\'S QUESTION ──');
      blob.push(userQuery);
    }

    return blob.join('\n');
  }

  // ─── Response parsing ───────────────────────────────────────────────────

  parseResponse(text) {
    if (!text) return null;
    // Try JSON first
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return null;
  }

  // ─── Memory updates ─────────────────────────────────────────────────────

  async updateMemoriesAfterRun({ mode, parsed }) {
    if (!parsed || mode === 'chat') return;

    // CA_ShortTerm: append
    const short = (await this.loadMemory(MEMORY_KEYS.ShortTerm)) || [];
    short.push({
      at: new Date().toISOString(),
      mode,
      thesis: parsed.thesis || '',
      briefing: (parsed.briefing || '').slice(0, 500),
    });
    while (short.length > SHORT_TERM_MAX) short.shift();
    await this.saveMemory(MEMORY_KEYS.ShortTerm, short);

    // CA_MarketView: overwrite if thesis provided
    if (parsed.thesis) {
      await this.saveMemory(MEMORY_KEYS.MarketView, {
        thesis: parsed.thesis,
        confidence: parsed.confidence ?? 0.6,
        updatedAt: new Date().toISOString(),
      });
    }

    // CA_Predictions: append new predictions
    if (Array.isArray(parsed.predictions) && parsed.predictions.length) {
      const preds = (await this.loadMemory(MEMORY_KEYS.Predictions)) || [];
      for (const p of parsed.predictions) {
        preds.push({
          claim: p.claim,
          horizon: p.horizon,
          confidence: p.confidence,
          madeAt: new Date().toISOString(),
          outcome: 'pending',
        });
      }
      while (preds.length > PREDICTIONS_MAX) preds.shift();
      await this.saveMemory(MEMORY_KEYS.Predictions, preds);
    }

    // CA_Lessons: for deep-review, append newLessons
    if (mode === 'deep-review' && Array.isArray(parsed.newLessons) && parsed.newLessons.length) {
      const existing = (await this.loadMemory(MEMORY_KEYS.Lessons)) || [];
      for (const l of parsed.newLessons) {
        existing.push({ lesson: l, learnedAt: new Date().toISOString() });
      }
      // Cap at 40 lessons; older ones drop off
      while (existing.length > 40) existing.shift();
      await this.saveMemory(MEMORY_KEYS.Lessons, existing);
    }
  }

  // ─── Weekly memory compaction (called from deep-review cron) ────────────

  async compactMemories() {
    // Roll up old short-term into a summary paragraph in CA_MarketView history
    const short = (await this.loadMemory(MEMORY_KEYS.ShortTerm)) || [];
    if (short.length > 14) {
      const toCompact = short.slice(0, short.length - 7); // keep latest 7
      const tail = short.slice(short.length - 7);
      await this.saveMemory(MEMORY_KEYS.ShortTerm, tail);
      // Best-effort: append compressed summary to marketView history
      const mv = (await this.loadMemory(MEMORY_KEYS.MarketView)) || { thesis: '' };
      mv.recentHistory = (mv.recentHistory || []).concat([
        {
          period: `${toCompact[0]?.at?.slice(0, 10)} to ${toCompact.at(-1)?.at?.slice(0, 10)}`,
          count: toCompact.length,
          sampleThesis: toCompact.at(-1)?.thesis || '',
        },
      ]).slice(-4);
      await this.saveMemory(MEMORY_KEYS.MarketView, mv);
    }
    // Prune old resolved predictions (older than 30 days with outcome != pending)
    const preds = (await this.loadMemory(MEMORY_KEYS.Predictions)) || [];
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const kept = preds.filter(p => {
      const made = new Date(p.madeAt || 0).getTime();
      return made >= cutoff || p.outcome === 'pending';
    });
    if (kept.length !== preds.length) {
      await this.saveMemory(MEMORY_KEYS.Predictions, kept);
    }
  }

  // ─── Main run ───────────────────────────────────────────────────────────

  async run({ mode = 'briefing', model, userQuery } = {}) {
    const startedAt = Date.now();
    let tokensIn = 0, tokensOut = 0, costUSD = 0;

    if (mode === 'chat' && !userQuery) {
      return { success: false, error: 'chat mode requires userQuery', mode };
    }

    try {
      // Load context in parallel
      const [marketContext, agentOutputs, tradeStats, lessons, myMemory] = await Promise.all([
        this.loadMarketContext(),
        this.loadAgentOutputs(),
        this.loadTradeStats(),
        this.loadRecentLessons(),
        this.loadAllMemories(),
      ]);

      const systemPrompt = this.buildSystemPrompt(mode);
      const userPrompt = this.buildUserPrompt({
        marketContext, agentOutputs, tradeStats, lessons, myMemory, userQuery,
      });

      // Pick model: deep-review forces Opus, otherwise caller override or default
      const effectiveModel =
        mode === 'deep-review'
          ? 'claude-opus-4-7'
          : (model || this.defaultModel);

      const maxTokens = mode === 'deep-review' ? 8000 : (mode === 'chat' ? 1500 : 3000);

      const response = await llmService.claudeChat({
        model: effectiveModel,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens,
        operation: `chief-analyst:${mode}`,
        agentId: this.agentKey,
      });

      tokensIn = response.tokensIn; tokensOut = response.tokensOut; costUSD = response.costUSD;

      // Chat mode → return the raw text, no parsing, no memory writes
      if (mode === 'chat') {
        return {
          success: true,
          mode,
          output: { reply: response.content, model: effectiveModel },
          tokensUsed: { in: tokensIn, out: tokensOut },
          costUSD: +costUSD.toFixed(6),
          durationMs: Date.now() - startedAt,
        };
      }

      // Parse structured JSON for briefing / deep-review
      const parsed = this.parseResponse(response.content);
      if (!parsed || !parsed.briefing) {
        throw new Error(`Chief Analyst: invalid JSON output. Raw: ${response.content.slice(0, 300)}`);
      }

      // Memory updates
      await this.updateMemoriesAfterRun({ mode, parsed });
      if (mode === 'deep-review') {
        await this.compactMemories();
      }

      // Write ActionItems for any actions
      if (Array.isArray(parsed.actions)) {
        for (const a of parsed.actions) {
          if (!a?.title) continue;
          await this.writeActionItem({
            title: a.title,
            description: a.description || '',
            impact: a.impact || '',
            action: a.nextStep || '',
            priority: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].includes(a.priority) ? a.priority : 'MEDIUM',
            source: 'chief-analyst',
            dedupKey: `chief-analyst:${mode}:${a.title}:${new Date().toISOString().slice(0, 10)}`,
          });
        }
      }

      // Surface the briefing itself as an ActionItem (dedup by date + mode)
      const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      await this.writeActionItem({
        title: `Chief Analyst — ${mode === 'deep-review' ? 'Weekly deep review' : 'Daily briefing'} (${today})`,
        description: parsed.briefing,
        impact: 'Skipping means losing continuity with your running thesis and agent signals.',
        action: 'Read the briefing → align today\'s plan.',
        priority: mode === 'deep-review' ? 'HIGH' : 'MEDIUM',
        source: 'chief-analyst',
        dedupKey: `chief-analyst:${mode}:briefing:${new Date().toISOString().slice(0, 10)}`,
      });

      return {
        success: true,
        mode,
        output: {
          ...parsed,
          model: effectiveModel,
          generatedAt: new Date().toISOString(),
        },
        tokensUsed: { in: tokensIn, out: tokensOut },
        costUSD: +costUSD.toFixed(6),
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      const msg = err.message || 'unknown';
      const missingKey = /ANTHROPIC_API_KEY/i.test(msg);
      return {
        success: false,
        mode,
        error: missingKey ? 'needs key: ANTHROPIC_API_KEY not set' : msg,
        partial: missingKey,
        tokensUsed: { in: tokensIn, out: tokensOut },
        costUSD: +costUSD.toFixed(6),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

const instance = new ChiefAnalyst();
instance.MEMORY_KEYS = MEMORY_KEYS;
module.exports = instance;
