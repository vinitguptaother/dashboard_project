/**
 * Sentiment Watcher — hourly (market hours) AI research agent.
 *
 * Purpose:
 *   For each symbol on Vinit's watchlist, detect UNUSUAL chatter vs the
 *   typical baseline — not generic news. A sudden volume-of-mentions spike,
 *   a sentiment flip, or an out-of-band event should raise a flag.
 *
 * Data sources (READ-ONLY):
 *   - Watchlist        (capped at 20 symbols per run to keep cost bounded)
 *   - AgentMemory      (baselines per symbol, last alert per symbol)
 *   - Perplexity sonar (cheap, fast — for each symbol's last-4h chatter)
 *
 * Synthesis:
 *   - Claude Haiku 4.5 classifies {NORMAL | ABNORMAL} per symbol and drafts
 *     a one-line alert only for abnormal cases.
 *
 * Safety:
 *   - ONLY writes to: AgentMemory (own bucket), LLMUsage, ActionItem.
 *
 * Graceful degradation:
 *   - If ANTHROPIC_API_KEY is missing, Perplexity still runs per symbol and
 *     logs usage; Claude step throws — handled, agent returns partial.
 *
 * Cost estimate: ~140 runs/month × ~5k Haiku tokens ≈ $0.30 (~₹25) / month.
 */

const AgentBase = require('./agentBase');
const llmService = require('../llmService');
const Watchlist = require('../../models/Watchlist');

const ACTION_ITEM_SOURCE = 'chief-analyst';
const MAX_SYMBOLS_PER_RUN = 20;

// ─── Utilities ──────────────────────────────────────────────────────────────

function hourTag(date = new Date()) {
  // `YYYY-MM-DDTHH` in IST — dedup within the same hour
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 13);
}

class SentimentWatcher extends AgentBase {
  constructor() {
    super({
      agentKey: 'sentiment-watcher',
      displayName: 'Sentiment Watcher',
      defaultModel: 'claude-haiku-4-5-20251001',
    });
  }

  // ─── Load watchlist symbols (capped) ──────────────────────────────────────

  async _loadWatchlistSymbols() {
    try {
      const docs = await Watchlist.find({}).lean();
      const seen = new Set();
      const symbols = [];
      for (const d of docs) {
        for (const item of (d.items || [])) {
          const sym = (item.symbol || '').toUpperCase().trim();
          if (!sym || seen.has(sym)) continue;
          seen.add(sym);
          symbols.push({ symbol: sym, name: item.name || '', addedAt: item.addedAt });
          if (symbols.length >= MAX_SYMBOLS_PER_RUN) return symbols;
        }
      }
      return symbols;
    } catch (err) {
      console.warn('[sentiment-watcher] watchlist read failed:', err.message);
      return [];
    }
  }

  // ─── Fetch chatter for a single symbol ────────────────────────────────────

  async _fetchSymbolChatter(symbol, name = '') {
    const label = name ? `${symbol} (${name})` : symbol;
    const prompt =
`Search for unusual activity, news, or social media chatter about the Indian-listed
stock "${label}" in the LAST 4 HOURS only. I specifically want to know:

  • Is there a sudden SPIKE in mentions vs a typical day?
  • Is the sentiment FLIPPING (bull->bear or bear->bull)?
  • Any unusual news (block deals, regulatory, rumour, management change, big order)?
  • Any unusual price/volume behaviour being discussed?

Keep it to 3-4 sentences. If there is NOTHING unusual, say "No abnormal chatter
detected — normal news flow only." Do not speculate. Cite sources if available.`;

    try {
      const result = await llmService.perplexityAsk({
        prompt,
        // Cheapest model that still has online access
        model: 'sonar',
        maxTokens: 350,
        operation: `sentiment-watcher:chatter:${symbol}`,
        agentId: this.agentKey,
      });
      return {
        symbol,
        content: result.content,
        citations: result.citations || [],
        costUSD: result.costUSD || 0,
        tokensIn: result.tokensIn || 0,
        tokensOut: result.tokensOut || 0,
      };
    } catch (err) {
      return { symbol, content: '', citations: [], costUSD: 0, tokensIn: 0, tokensOut: 0, error: err.message };
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
    let perplexityHits = 0;

    try {
      // 1. Load watchlist (cap) + memory
      const symbols = await this._loadWatchlistSymbols();
      if (symbols.length === 0) {
        return {
          success: true,
          output: { message: 'No watchlist symbols to monitor', abnormalCount: 0 },
          tokensUsed: { in: 0, out: 0 },
          costUSD: 0,
          durationMs: Date.now() - startedAt,
        };
      }

      const baselines = (await this.loadMemory('baselines')) || {};
      const lastAlerts = (await this.loadMemory('lastAlerts')) || {};

      // 2. Fetch chatter per symbol (in parallel, with small chunking safety)
      const chatter = await Promise.all(symbols.map(s => this._fetchSymbolChatter(s.symbol, s.name)));
      for (const c of chatter) {
        totalCostUSD += c.costUSD;
        totalTokensIn += c.tokensIn || 0;
        totalTokensOut += c.tokensOut || 0;
        if (c.content && !c.error) perplexityHits += 1;
      }

      // 3. Build a single Claude Haiku call that classifies all symbols at once
      const haikuSystem =
`You are Vinit's market-chatter watchdog. For each Indian-listed symbol, you get
recent (last 4 hours) chatter summary plus a "baseline" description of what
normal looks like for that symbol. Classify each as NORMAL or ABNORMAL.

Rules:
  • ABNORMAL only if there is genuine unusual activity: mention spike, sentiment
    flip, unexpected news (block deal, regulatory, rumour, sudden price move,
    management change, bulk/block deal, order win).
  • NORMAL if chatter is generic / routine / "no abnormal chatter detected".
  • Do NOT flag just because news exists. Only flag the UNUSUAL.
  • One sentence per alert. No jargon.

Output STRICTLY this JSON (no prose around it):
{
  "results": [
    {
      "symbol": "SYMBOL",
      "status": "NORMAL" | "ABNORMAL",
      "alert": "string — only if ABNORMAL, one sentence",
      "priority": "LOW" | "MEDIUM" | "HIGH",
      "newBaseline": "string — optional, 1 short sentence to store as updated baseline"
    }
  ]
}`;

      const symbolBlobs = chatter.map(c => {
        const baseline = baselines[c.symbol] || '(no baseline yet — treat as "normal" quiet)';
        const last = lastAlerts[c.symbol] ? `last alert hour: ${lastAlerts[c.symbol].hour}` : 'no prior alert';
        return `── ${c.symbol} ──
BASELINE: ${baseline}
LAST: ${last}
RECENT CHATTER (≤4h): ${c.content ? c.content.slice(0, 800) : '(no data — Perplexity failed)'}`;
      }).join('\n\n');

      const haikuUser =
`Here are ${chatter.length} watchlist symbols. For EACH one, decide NORMAL vs ABNORMAL
strictly from the recent chatter vs its baseline, then output the JSON above.

${symbolBlobs}`;

      let parsed = null;
      let claudeError = null;
      try {
        const claudeResult = await llmService.claudeChat({
          model: this.defaultModel,
          system: haikuSystem,
          messages: [{ role: 'user', content: haikuUser }],
          maxTokens: 2000,
          operation: 'sentiment-watcher:classify',
          agentId: this.agentKey,
        });
        totalTokensIn += claudeResult.tokensIn;
        totalTokensOut += claudeResult.tokensOut;
        totalCostUSD += claudeResult.costUSD;
        parsed = this._parseJSON(claudeResult.content);
        if (!parsed || !Array.isArray(parsed.results)) {
          throw new Error('Haiku did not return valid classification JSON. Raw: ' +
            (claudeResult.content || '').slice(0, 300));
        }
      } catch (err) {
        claudeError = err.message;
        console.warn('[sentiment-watcher] Haiku classification failed:', err.message);
      }

      // If Claude failed but Perplexity worked, return partial success
      if (!parsed) {
        return {
          success: false,
          partial: perplexityHits > 0,
          error: claudeError || 'No classification produced',
          output: {
            symbolsChecked: symbols.length,
            perplexitySuccesses: perplexityHits,
            perplexityFailures: symbols.length - perplexityHits,
          },
          tokensUsed: { in: totalTokensIn, out: totalTokensOut },
          costUSD: +totalCostUSD.toFixed(6),
          durationMs: Date.now() - startedAt,
        };
      }

      // 4. Process results — write ActionItem only for ABNORMAL ones
      const now = new Date();
      const hr = hourTag(now);
      const abnormal = [];
      const newBaselines = { ...baselines };
      const newLastAlerts = { ...lastAlerts };

      for (const r of parsed.results) {
        if (!r || !r.symbol) continue;
        const sym = String(r.symbol).toUpperCase();

        if (r.newBaseline && typeof r.newBaseline === 'string' && r.newBaseline.length) {
          newBaselines[sym] = r.newBaseline.slice(0, 400);
        }

        if (r.status === 'ABNORMAL' && r.alert) {
          abnormal.push({ symbol: sym, alert: r.alert, priority: r.priority || 'MEDIUM' });

          const priority = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(r.priority)
            ? r.priority : 'MEDIUM';

          await this.writeActionItem({
            title: `Sentiment alert — ${sym}`,
            description: r.alert,
            impact: 'Unusual chatter often precedes price moves on thin-float Indian mid/smallcaps.',
            action: `Open ${sym} in Search → verify with price action and latest news before acting.`,
            priority,
            symbol: sym,
            source: ACTION_ITEM_SOURCE,
            // dedupKey PER SYMBOL + HOUR — replaces prior same-hour alert, next hour gets new card
            dedupKey: `sentiment-watcher:${sym}:${hr}`,
          });

          newLastAlerts[sym] = { hour: hr, alert: r.alert, priority };
        }
      }

      // 5. Persist memory
      await this.saveMemory('baselines', newBaselines);
      await this.saveMemory('lastAlerts', newLastAlerts);
      await this.saveMemory('lastRun', {
        hour: hr,
        symbolsChecked: symbols.length,
        abnormalCount: abnormal.length,
        perplexitySuccesses: perplexityHits,
        generatedAt: now.toISOString(),
      });

      return {
        success: true,
        output: {
          hour: hr,
          symbolsChecked: symbols.length,
          perplexitySuccesses: perplexityHits,
          abnormalCount: abnormal.length,
          abnormal,
        },
        tokensUsed: { in: totalTokensIn, out: totalTokensOut },
        costUSD: +totalCostUSD.toFixed(6),
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      console.error('[sentiment-watcher] run() failed:', err.message);
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

module.exports = new SentimentWatcher();
