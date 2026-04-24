/**
 * Market Scout — first AI research agent.
 *
 * Purpose:
 *   Each morning (or whenever manually triggered), fetches overnight news
 *   + today's dashboard state, and produces a ~150-word plain-English
 *   pre-market briefing for Vinit. Writes the briefing as an ActionItem
 *   so it surfaces on the Today tab.
 *
 * Data sources:
 *   - AgentMemory (lastBriefing, runningThesis)
 *   - MarketRegime (latest snapshot)
 *   - FiiDiiDaily (latest day)
 *   - SectorPerformance (latest snapshot)
 *   - Perplexity sonar-pro (overnight news + global cues)
 *
 * Synthesis:
 *   - Claude Sonnet 4.5 produces the final briefing JSON.
 *
 * Safety:
 *   - ONLY reads from the above collections + Perplexity.
 *   - ONLY writes to: AgentMemory (own bucket), LLMUsage, ActionItem.
 */

const AgentBase = require('./agentBase');
const llmService = require('../llmService');

// Read-only models
const MarketRegime = require('../../models/MarketRegime');
const FiiDiiDaily = require('../../models/FiiDiiDaily');
const SectorPerformance = require('../../models/SectorPerformance');

// ActionItem source enum check — use 'chief-analyst' since Market Scout
// feeds into the Chief Analyst view. ('sentinel' would misattribute.)
const ACTION_ITEM_SOURCE = 'chief-analyst';

class MarketScout extends AgentBase {
  constructor() {
    super({
      agentKey: 'market-scout',
      displayName: 'Market Scout',
      defaultModel: 'claude-sonnet-4-5',
    });
  }

  // ─── Helper: gather dashboard state ───────────────────────────────────────

  async _fetchDashboardContext() {
    const [regime, fii, sector] = await Promise.all([
      MarketRegime.findOne({}).sort({ computedAt: -1 }).lean().catch(() => null),
      FiiDiiDaily.findOne({}).sort({ date: -1 }).lean().catch(() => null),
      SectorPerformance.findOne({}).sort({ computedAt: -1 }).lean().catch(() => null),
    ]);

    const ctx = {
      regime: null,
      fiiDii: null,
      sectors: null,
    };

    if (regime) {
      ctx.regime = {
        regime: regime.regime,
        confidence: regime.confidence,
        reason: regime.reason,
        nifty: regime.inputs?.niftyLevel,
        vix: regime.inputs?.vix,
        computedAt: regime.computedAt,
      };
    }

    if (fii) {
      ctx.fiiDii = {
        date: fii.date,
        fiiNetCr: fii.fii?.netValue || 0,
        diiNetCr: fii.dii?.netValue || 0,
      };
    }

    if (sector) {
      ctx.sectors = {
        leaders: sector.leaders || [],
        laggards: sector.laggards || [],
        niftyDayChangePct: sector.niftyDayChangePct,
        computedAt: sector.computedAt,
      };
    }

    return ctx;
  }

  // ─── Helper: fetch overnight news via Perplexity ──────────────────────────

  async _fetchOvernightNews() {
    const today = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
    });

    const prompt =
`Give me a concise summary of overnight developments relevant to the Indian stock market (${today}).
Cover exactly these four buckets, 1-2 sentences each, with specific numbers where possible:
1. Global cues (US close, Asian futures, crude, USD/INR, US bond yields)
2. FII/DII activity (latest NSE provisional data)
3. India-specific news (stock/sector moves, regulatory, earnings)
4. Upcoming events today (RBI, data releases, major earnings)

Be factual and current. Cite sources if possible. Avoid speculation or advice.`;

    try {
      const result = await llmService.perplexityAsk({
        prompt,
        model: 'sonar-pro',
        maxTokens: 1200,
        operation: 'market-scout:news-fetch',
        agentId: this.agentKey,
      });
      return {
        content: result.content,
        citations: result.citations || [],
        costUSD: result.costUSD,
      };
    } catch (err) {
      console.warn('[market-scout] Perplexity fetch failed:', err.message);
      return { content: '', citations: [], costUSD: 0, error: err.message };
    }
  }

  // ─── Helper: extract JSON from Claude's response ──────────────────────────

  _parseBriefingJSON(text) {
    // Look for first top-level { ... } block
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  // ─── run() ────────────────────────────────────────────────────────────────

  async run() {
    const startedAt = Date.now();
    let totalTokensIn = 0, totalTokensOut = 0, totalCostUSD = 0;

    try {
      // 1. Load memory
      const lastBriefing = await this.loadMemory('lastBriefing');
      const runningThesis = await this.loadMemory('runningThesis');

      // 2. Fetch dashboard state
      const dashboard = await this._fetchDashboardContext();

      // 3. Overnight news from Perplexity
      const news = await this._fetchOvernightNews();
      totalCostUSD += news.costUSD || 0;

      // 4. Build Claude prompt
      const systemPrompt =
`You are Vinit's pre-market analyst. Vinit is a retail swing trader in India
(NSE/BSE), not a professional. He needs a 150-word plain-English briefing
each morning, delivered in clear, calm language — no jargon, no hedging fluff.

Your job:
1. Synthesize overnight news + current dashboard state into a useful briefing.
2. Call out 2-3 specific things to watch today (events, stocks, sectors).
3. If the regime or FII flow has shifted materially vs the running thesis, say so explicitly.

Output STRICTLY as JSON in this exact shape, no prose before or after:
{
  "briefing": "string — 120-180 words, plain English, for a retail trader",
  "keyEvents": ["string", ...],           // 2-5 concrete events/items to watch
  "watchList": ["SYMBOL", ...],           // 0-5 NSE symbols worth eyeballing
  "confidence": 0.0-1.0,                  // your confidence in the briefing
  "thesisUpdate": "string"                // 1 sentence: how the running thesis is evolving
}

Be honest if data is thin — do not invent facts.`;

      const contextBlob = `
── DASHBOARD STATE (read-only) ──
${dashboard.regime ? `REGIME: ${dashboard.regime.regime} (confidence ${(dashboard.regime.confidence || 0).toFixed(2)}) — ${dashboard.regime.reason || 'no reason recorded'}; NIFTY ${dashboard.regime.nifty}, VIX ${dashboard.regime.vix}` : 'REGIME: no snapshot yet'}
${dashboard.fiiDii ? `FII/DII (${dashboard.fiiDii.date}): FII net ₹${dashboard.fiiDii.fiiNetCr} cr, DII net ₹${dashboard.fiiDii.diiNetCr} cr` : 'FII/DII: no data yet'}
${dashboard.sectors ? `SECTOR LEADERS: ${(dashboard.sectors.leaders || []).join(', ') || 'n/a'}; LAGGARDS: ${(dashboard.sectors.laggards || []).join(', ') || 'n/a'}` : 'SECTORS: no snapshot yet'}

── OVERNIGHT NEWS (Perplexity sonar-pro) ──
${news.content || '(Perplexity unavailable — synthesize from dashboard state alone and note that news is missing.)'}

── YESTERDAY'S BRIEFING ──
${lastBriefing ? JSON.stringify(lastBriefing.briefing || lastBriefing, null, 2) : '(none yet — this is the first run)'}

── RUNNING THESIS ──
${runningThesis ? (typeof runningThesis === 'string' ? runningThesis : JSON.stringify(runningThesis)) : '(none yet — establish one now)'}

Now produce today's briefing JSON.`;

      // 5. Call Claude
      const claudeResult = await llmService.claudeChat({
        model: this.defaultModel,
        system: systemPrompt,
        messages: [{ role: 'user', content: contextBlob }],
        maxTokens: 1500,
        operation: 'market-scout:synthesize',
        agentId: this.agentKey,
      });

      totalTokensIn += claudeResult.tokensIn;
      totalTokensOut += claudeResult.tokensOut;
      totalCostUSD += claudeResult.costUSD;

      // 6. Parse output
      const parsed = this._parseBriefingJSON(claudeResult.content);
      if (!parsed || !parsed.briefing) {
        throw new Error('Market Scout: Claude did not return valid briefing JSON. Raw: ' +
          claudeResult.content.slice(0, 300));
      }

      // 7. Save to memory
      const briefingRecord = {
        briefing: parsed.briefing,
        keyEvents: parsed.keyEvents || [],
        watchList: parsed.watchList || [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
        thesisUpdate: parsed.thesisUpdate || '',
        generatedAt: new Date().toISOString(),
        citations: (news.citations || []).slice(0, 5),
      };

      await this.saveMemory('lastBriefing', briefingRecord);
      if (parsed.thesisUpdate) {
        await this.saveMemory('runningThesis', parsed.thesisUpdate);
      }

      // 8. Write ActionItem (surfaces on Today tab)
      const eventsLine = (parsed.keyEvents || []).slice(0, 4).map(e => `• ${e}`).join('\n');
      const watchLine = (parsed.watchList && parsed.watchList.length)
        ? `Watch: ${parsed.watchList.join(', ')}` : '';

      const description = [parsed.briefing, '', eventsLine, watchLine]
        .filter(Boolean).join('\n');

      await this.writeActionItem({
        title: `Market Scout — Pre-market briefing (${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })})`,
        description,
        impact: 'Skipping means starting the day without context on overnight moves, FII flow, and events.',
        action: 'Read briefing → update your plan for today.',
        priority: 'HIGH',
        source: ACTION_ITEM_SOURCE,
        // Dedup by date so re-running the same morning updates the same card
        dedupKey: `market-scout:briefing:${new Date().toISOString().slice(0, 10)}`,
      });

      return {
        success: true,
        output: {
          ...briefingRecord,
          dashboardContext: dashboard,
          newsAvailable: !!news.content,
        },
        tokensUsed: { in: totalTokensIn, out: totalTokensOut },
        costUSD: +totalCostUSD.toFixed(6),
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      console.error('[market-scout] run() failed:', err.message);
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

module.exports = new MarketScout();
