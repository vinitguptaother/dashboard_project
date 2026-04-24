/**
 * Pattern Miner — 5th research agent (MASTER_PLAN §7 Phase 3).
 *
 * Purpose:
 *   After every closed TradeSetup (ideally batched daily), Pattern Miner
 *   studies the trade and extracts 1-5 concrete lessons. Output is stored
 *   as a TradingLesson. If the lesson flags a recurring mistake, an
 *   ActionItem is also surfaced on the Today tab.
 *
 * Signals analysed:
 *   - Entry / exit conditions, SL + target
 *   - Regime at time of trade (MarketRegime nearest to entry)
 *   - Pattern levels at entry (S/R, ATR) via patternService
 *   - Hold days, MFE / MAE (if exitPrice present)
 *   - Was the strategy-gate satisfied? (compare entry regime vs strategy's
 *     regimeCompatibility, if a strategyKey was recorded)
 *
 * Safety:
 *   - Reads: TradeSetup, MarketRegime, Strategy, patternService
 *   - Writes: AgentMemory, TradingLesson, ActionItem, LLMUsage
 *   - NEVER writes trades, portfolio, or bot configs.
 */

const AgentBase = require('./agentBase');
const llmService = require('../llmService');

// Read-only sources
const TradeSetup = require('../../models/TradeSetup');
const MarketRegime = require('../../models/MarketRegime');
const TradingLesson = require('../../models/TradingLesson');
const strategies = require('../strategies');
const patternService = require('../patternService');

class PatternMiner extends AgentBase {
  constructor() {
    super({
      agentKey: 'pattern-miner',
      displayName: 'Pattern Miner',
      defaultModel: 'claude-sonnet-4-5',
    });
  }

  // ─── Helper: pick a closed trade to analyse ───────────────────────────────

  async _pickClosedTrade(tradeSetupId) {
    if (tradeSetupId) {
      return TradeSetup.findById(tradeSetupId).lean();
    }
    // Find the most recently closed trade that has no lesson yet.
    const closed = await TradeSetup.find({
      status: { $in: ['TARGET_HIT', 'SL_HIT', 'EXPIRED'] },
    }).sort({ closedAt: -1, updatedAt: -1 }).limit(20).lean();

    for (const t of closed) {
      const hasLesson = await TradingLesson.findOne({ tradeSetupId: t._id }).lean();
      if (!hasLesson) return t;
    }
    // If all recent closed trades already have lessons, return the very
    // newest anyway (fine to re-analyse — dedup handled by caller).
    return closed[0] || null;
  }

  // ─── Helper: contextual snapshot at entry time ────────────────────────────

  async _contextSnapshot(trade) {
    const snap = {
      regimeAtEntry: '',
      nearestSupport: null,
      nearestResistance: null,
      atrPct: null,
      holdDays: null,
      mfePct: null,
      maePct: null,
      strategyGateSatisfied: null,
    };
    const entryAt = trade.createdAt || new Date();

    // Nearest regime snapshot around entry
    try {
      const regimeDoc = await MarketRegime.findOne({
        computedAt: { $lte: entryAt },
      }).sort({ computedAt: -1 }).lean();
      if (regimeDoc) snap.regimeAtEntry = regimeDoc.regime;
    } catch (_) { /* best-effort */ }

    // Pattern levels NOW (Phase 3 MVP; ideally we'd reconstruct levels as of
    // entryAt, but that needs historical snapshots. Good enough for lessons.)
    if (trade.symbol && trade.entryPrice) {
      try {
        const levels = await patternService.getLevelsForSymbol(trade.symbol, trade.entryPrice);
        snap.nearestSupport = levels.nearestSupport;
        snap.nearestResistance = levels.nearestResistance;
        snap.atrPct = levels.atrPct;
      } catch (_) { /* best-effort */ }
    }

    // Hold days
    if (trade.closedAt && trade.createdAt) {
      const ms = new Date(trade.closedAt).getTime() - new Date(trade.createdAt).getTime();
      snap.holdDays = parseFloat((ms / (1000 * 60 * 60 * 24)).toFixed(2));
    }

    // Rough MFE/MAE from available price stamps (exact MFE/MAE needs tick
    // history; we approximate with exit + target + SL envelope).
    if (trade.exitPrice != null && trade.entryPrice) {
      const pct = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
      if (trade.status === 'TARGET_HIT') {
        snap.mfePct = parseFloat(pct.toFixed(2));
        snap.maePct = 0;
      } else if (trade.status === 'SL_HIT') {
        snap.maePct = parseFloat(pct.toFixed(2));
        snap.mfePct = 0;
      } else {
        snap.mfePct = pct > 0 ? parseFloat(pct.toFixed(2)) : 0;
        snap.maePct = pct < 0 ? parseFloat(pct.toFixed(2)) : 0;
      }
    }

    // Strategy gate check
    const strategyKey = trade.strategyKey || '';
    if (strategyKey) {
      const strat = strategies.getStrategyByKey(strategyKey);
      if (strat && snap.regimeAtEntry) {
        snap.strategyGateSatisfied =
          !Array.isArray(strat.regimeCompatibility) ||
          strat.regimeCompatibility.length === 0 ||
          strat.regimeCompatibility.includes(snap.regimeAtEntry);
      }
    }

    return snap;
  }

  // ─── Helper: parse JSON from Claude response ─────────────────────────────

  _parseLessonJSON(text) {
    const match = text && text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  // ─── Helper: heuristic fallback verdict (LLM failure path) ───────────────

  _heuristicVerdict(trade, snapshot) {
    const won = trade.status === 'TARGET_HIT' || (trade.netPnL != null && trade.netPnL > 0);
    const gateOk = snapshot.strategyGateSatisfied !== false;
    if (won && gateOk) return 'GOOD_WIN';
    if (won && !gateOk) return 'BAD_WIN';
    if (!won && gateOk) return 'GOOD_LOSS';
    if (!won && !gateOk) return 'BAD_LOSS';
    return 'INCONCLUSIVE';
  }

  // ─── run() ────────────────────────────────────────────────────────────────

  async run({ tradeSetupId } = {}) {
    const startedAt = Date.now();
    let totalTokensIn = 0, totalTokensOut = 0, totalCostUSD = 0;

    try {
      // 1. Pick a trade to analyse
      const trade = await this._pickClosedTrade(tradeSetupId);
      if (!trade) {
        return {
          success: true,
          output: { message: 'No closed trades yet — nothing to analyse.' },
          tokensUsed: { in: 0, out: 0 },
          costUSD: 0,
          durationMs: Date.now() - startedAt,
        };
      }

      // 2. Gather context snapshot
      const snapshot = await this._contextSnapshot(trade);

      // 3. Build Claude prompt
      const systemPrompt =
`You are Pattern Miner, a post-trade analyst for Vinit's Indian-market swing trading dashboard.
You get ONE closed trade and the context around it. Produce a short, concrete lesson record.

Rules:
- You are not predicting markets. You are auditing process quality on THIS trade.
- Lessons must be concrete and actionable — no generic platitudes.
- If the trade has a known strategy, judge whether its regime gate was satisfied.
- If context is thin, say so honestly and keep the confidence low.

Output STRICTLY as JSON in this shape — nothing before or after:
{
  "verdict": "GOOD_WIN" | "BAD_WIN" | "GOOD_LOSS" | "BAD_LOSS" | "INCONCLUSIVE",
  "lessons": ["string", ...],      // 1-5 items, each <= 200 chars
  "confidence": 0-100,
  "recurring_pattern": "string | null"   // short phrase if this looks like a repeated mistake; else null
}`;

      const tradeBlob = {
        symbol: trade.symbol,
        botId: trade.botId,
        strategyKey: trade.strategyKey || null,
        action: trade.action,
        tradeType: trade.tradeType,
        status: trade.status,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        stopLoss: trade.stopLoss,
        target: trade.target,
        netPnL: trade.netPnL,
        grossPnL: trade.grossPnL,
        totalCharges: trade.totalCharges,
        quantity: trade.quantity,
        reasoning: (trade.reasoning || '').slice(0, 400),
        createdAt: trade.createdAt,
        closedAt: trade.closedAt,
      };

      const contextBlob = `
── TRADE RECORD ──
${JSON.stringify(tradeBlob, null, 2)}

── CONTEXT SNAPSHOT ──
regimeAtEntry: ${snapshot.regimeAtEntry || '(unknown)'}
nearestSupport: ${snapshot.nearestSupport ?? '(unknown)'}
nearestResistance: ${snapshot.nearestResistance ?? '(unknown)'}
atrPct: ${snapshot.atrPct ?? '(unknown)'}
holdDays: ${snapshot.holdDays ?? '(unknown)'}
mfePct: ${snapshot.mfePct ?? '(unknown)'}
maePct: ${snapshot.maePct ?? '(unknown)'}
strategyGateSatisfied: ${snapshot.strategyGateSatisfied == null ? '(unknown)' : snapshot.strategyGateSatisfied}

Produce the JSON now.`;

      // 4. Call Claude (fall back to heuristic if LLM unavailable)
      let parsed = null;
      let llmFailed = false;
      try {
        const claudeResult = await llmService.claudeChat({
          model: this.defaultModel,
          system: systemPrompt,
          messages: [{ role: 'user', content: contextBlob }],
          maxTokens: 800,
          operation: 'pattern-miner:synthesize',
          agentId: this.agentKey,
        });
        totalTokensIn += claudeResult.tokensIn;
        totalTokensOut += claudeResult.tokensOut;
        totalCostUSD += claudeResult.costUSD;
        parsed = this._parseLessonJSON(claudeResult.content);
      } catch (err) {
        console.warn('[pattern-miner] Claude call failed:', err.message);
        llmFailed = true;
      }

      // 5. Fallback if Claude didn't return usable JSON
      if (!parsed || !parsed.verdict) {
        parsed = {
          verdict: this._heuristicVerdict(trade, snapshot),
          lessons: [
            `${trade.status} on ${trade.symbol}. Regime at entry: ${snapshot.regimeAtEntry || 'unknown'}.`,
            llmFailed ? 'LLM analysis unavailable — heuristic verdict used.' : 'LLM output unparsable — heuristic verdict used.',
          ],
          confidence: 30,
          recurring_pattern: null,
        };
      }

      // 6. Persist TradingLesson (idempotent-ish: one lesson per trade)
      const lessons = (parsed.lessons || []).map(s => String(s).slice(0, 200)).slice(0, 5);
      const verdict = ['GOOD_WIN', 'BAD_WIN', 'GOOD_LOSS', 'BAD_LOSS', 'INCONCLUSIVE']
        .includes(parsed.verdict) ? parsed.verdict : 'INCONCLUSIVE';
      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
        : 50;

      const lessonDoc = await TradingLesson.findOneAndUpdate(
        { tradeSetupId: trade._id },
        {
          $set: {
            symbol: trade.symbol,
            botId: trade.botId || 'manual',
            strategyKey: trade.strategyKey || '',
            tradeSetupId: trade._id,
            verdict,
            lessons,
            contextSnapshot: snapshot,
            confidence,
            generatedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      // 7. Save running memory (most recent lessons + recurring patterns)
      const existingPatterns = (await this.loadMemory('recurringPatterns')) || [];
      if (parsed.recurring_pattern) {
        existingPatterns.unshift({
          pattern: parsed.recurring_pattern,
          symbol: trade.symbol,
          at: new Date().toISOString(),
        });
      }
      await this.saveMemory('recurringPatterns', existingPatterns.slice(0, 25));
      await this.saveMemory('lastLesson', {
        tradeSetupId: String(trade._id),
        symbol: trade.symbol,
        verdict,
        lessons,
        at: new Date().toISOString(),
      });

      // 8. Action item only if it's a BAD_LOSS or a named recurring pattern
      if (verdict === 'BAD_LOSS' || parsed.recurring_pattern) {
        const title = parsed.recurring_pattern
          ? `Recurring pattern: ${parsed.recurring_pattern}`
          : `Process slip on ${trade.symbol} — ${verdict}`;
        await this.writeActionItem({
          title,
          description: lessons.join(' · ') || `See TradingLesson for ${trade.symbol}.`,
          impact: 'Left unaddressed, the same process error will keep eroding returns.',
          action: 'Review the trade in Journal tab; tag the mistake; add a rule if needed.',
          priority: verdict === 'BAD_LOSS' ? 'HIGH' : 'MEDIUM',
          source: 'pattern-miner',
          symbol: trade.symbol,
          dedupKey: `pattern-miner:${trade._id}`,
        });
      }

      return {
        success: true,
        output: {
          tradeSetupId: String(trade._id),
          symbol: trade.symbol,
          verdict,
          lessons,
          confidence,
          recurringPattern: parsed.recurring_pattern || null,
          contextSnapshot: snapshot,
          lessonId: String(lessonDoc._id),
          llmAvailable: !llmFailed,
        },
        tokensUsed: { in: totalTokensIn, out: totalTokensOut },
        costUSD: +totalCostUSD.toFixed(6),
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      console.error('[pattern-miner] run() failed:', err.message);
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

module.exports = new PatternMiner();
