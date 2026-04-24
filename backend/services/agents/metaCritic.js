/**
 * Meta-Critic — experimental 7th agent (MASTER_PLAN §7 Phase 4).
 *
 * Weekly audit of every AI research agent. For each agent, scores:
 *   accuracy    — of verifiable predictions, what % came true?
 *   consistency — do similar inputs produce similar outputs?
 *   utility     — were its ActionItems accepted / dismissed / resolved?
 *
 * Output: recommendations per agent, persisted in AgentCalibration. If any
 * recommendation is material (|adjustment| >= 0.15), surfaces an ActionItem.
 *
 * Safety:
 *   - Reads: LLMUsage, ActionItem, AgentMemory (all agents), BotPerformance
 *   - Writes: AgentCalibration, AgentMemory (own bucket), ActionItem, LLMUsage
 *   - NEVER modifies any agent's code or disables any agent.
 */

const AgentBase = require('./agentBase');
const llmService = require('../llmService');

const LLMUsage = require('../../models/LLMUsage');
const ActionItem = require('../../models/ActionItem');
const AgentMemory = require('../../models/AgentMemory');
const AgentCalibration = require('../../models/AgentCalibration');

const AUDITED_AGENTS = [
  'chief-analyst', 'market-scout', 'smart-money-tracker',
  'pattern-miner', 'sentiment-watcher',
];

class MetaCritic extends AgentBase {
  constructor() {
    super({
      agentKey: 'meta-critic',
      displayName: 'Meta-Critic',
      defaultModel: 'claude-sonnet-4-5',
    });
  }

  // ─── Per-agent metric calculators ───────────────────────────────────────

  /**
   * Utility = how many ActionItems this agent emitted that the user acted on.
   *   accepted  : acknowledged or resolved
   *   dismissed : ignored or rejected
   *   score = (accepted + 0.5 * resolved) / total
   */
  async calcUtility(agentKey, windowDays) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    // ActionItem.source mapping — only 'chief-analyst' and 'pattern-miner' are
    // valid source enums at present. Other agents log to chief-analyst stream.
    const sourceCandidates = ['chief-analyst', 'pattern-miner'];
    const match = {
      createdAt: { $gte: since },
      source: { $in: sourceCandidates },
    };
    const items = await ActionItem.find(match).lean().catch(() => []);
    // Only count items whose dedupKey or title references this agent
    const agentItems = items.filter(i =>
      (i.dedupKey || '').includes(agentKey) || (i.title || '').toLowerCase().includes(agentKey.replace('-', ' '))
    );
    if (!agentItems.length) return { score: 0.5, sampleSize: 0, note: 'no recent items' };

    let accepted = 0, dismissed = 0, resolved = 0;
    for (const it of agentItems) {
      if (it.status === 'acknowledged') accepted++;
      else if (it.status === 'resolved') resolved++;
      else if (it.status === 'dismissed') dismissed++;
    }
    const total = agentItems.length;
    const score = (accepted + 0.5 * resolved) / total;
    return {
      score: +score.toFixed(4),
      sampleSize: total,
      note: `accepted=${accepted}, resolved=${resolved}, dismissed=${dismissed}, new=${total - accepted - resolved - dismissed}`,
    };
  }

  /**
   * Consistency = variance of the agent's LLMUsage costUSD + tokensOut across runs.
   * Low variance -> high consistency. We normalize to 0-1 (1 = very consistent).
   */
  async calcConsistency(agentKey, windowDays) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const runs = await LLMUsage.find({
      agentId: agentKey,
      at: { $gte: since },
      success: true,
    }).lean().catch(() => []);
    if (runs.length < 3) return { score: 0.5, sampleSize: runs.length, note: 'not enough runs' };

    const tokens = runs.map(r => r.tokensOut || 0);
    const mean = tokens.reduce((s, x) => s + x, 0) / tokens.length;
    const variance = tokens.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / tokens.length;
    const sd = Math.sqrt(variance);
    // Coefficient of variation — lower is more consistent
    const cv = mean ? sd / mean : 1;
    // Map CV=0 → score=1; CV=1 → score=0.3; CV≥2 → score=0
    const score = cv >= 2 ? 0 : Math.max(0, 1 - 0.35 * cv);
    return {
      score: +score.toFixed(4),
      sampleSize: runs.length,
      note: `mean=${mean.toFixed(0)} tokens, sd=${sd.toFixed(0)}, CV=${cv.toFixed(2)}`,
    };
  }

  /**
   * Accuracy = for chief-analyst only (others don't emit verifiable predictions yet).
   * Reads CA_Predictions memory and tallies outcome=hit / miss / inconclusive / pending.
   */
  async calcAccuracy(agentKey, windowDays) {
    if (agentKey !== 'chief-analyst') {
      return { score: 0.5, sampleSize: 0, note: 'no verifiable predictions for this agent yet' };
    }
    const mem = await AgentMemory.findOne({ agentKey }).lean();
    const preds = mem?.stores?.CA_Predictions || [];
    const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const inWindow = preds.filter(p => new Date(p.madeAt || 0).getTime() >= since);
    const verifiable = inWindow.filter(p => p.outcome && p.outcome !== 'pending');
    if (!verifiable.length) return { score: 0.5, sampleSize: inWindow.length, note: 'no verified predictions yet' };
    const hits = verifiable.filter(p => p.outcome === 'hit').length;
    const score = hits / verifiable.length;
    return {
      score: +score.toFixed(4),
      sampleSize: verifiable.length,
      note: `${hits}/${verifiable.length} predictions hit`,
    };
  }

  async collectMetricsForAgent(agentKey, windowDays) {
    const [accuracy, consistency, utility] = await Promise.all([
      this.calcAccuracy(agentKey, windowDays),
      this.calcConsistency(agentKey, windowDays),
      this.calcUtility(agentKey, windowDays),
    ]);
    return { agentKey, accuracy, consistency, utility };
  }

  async persistCalibration(agentKey, metric, data, windowDays, recommendedAdjustment, rationale) {
    await AgentCalibration.findOneAndUpdate(
      { agentKey, metric, windowDays },
      {
        $set: {
          currentScore: data.score,
          recommendedAdjustment,
          rationale,
          sampleSize: data.sampleSize,
          evaluatedAt: new Date(),
        },
        $setOnInsert: { agentKey, metric, windowDays },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  buildLLMPrompt(metricsByAgent) {
    const system =
`You are Meta-Critic — the auditor of all other AI agents in this dashboard.

Your ONLY job: review each agent's recent metrics (accuracy, consistency, utility)
and produce concrete recommendations for how each should be calibrated.

Constraints:
- You CANNOT disable or modify any agent.
- You can only suggest confidence adjustments in the range [-0.30, +0.30].
- Say "no adjustment needed" when metrics look fine.
- Keep each agent's rationale under 40 words. Plain English.

Output STRICTLY as JSON:
{
  "perAgent": [
    {
      "agentKey": "string",
      "adjustAccuracy": -0.30 to 0.30,
      "adjustConsistency": -0.30 to 0.30,
      "adjustUtility": -0.30 to 0.30,
      "rationale": "string — single paragraph why"
    }
  ],
  "summary": "string — 2-3 sentence overall audit summary"
}`;

    const lines = [];
    for (const m of metricsByAgent) {
      lines.push(`[${m.agentKey}]`);
      lines.push(`  accuracy:    score=${m.accuracy.score} (n=${m.accuracy.sampleSize}) — ${m.accuracy.note}`);
      lines.push(`  consistency: score=${m.consistency.score} (n=${m.consistency.sampleSize}) — ${m.consistency.note}`);
      lines.push(`  utility:     score=${m.utility.score} (n=${m.utility.sampleSize}) — ${m.utility.note}`);
    }
    return { system, user: lines.join('\n') };
  }

  async run({ windowDays = 30 } = {}) {
    const startedAt = Date.now();
    let tokensIn = 0, tokensOut = 0, costUSD = 0;

    try {
      // 1. Collect metrics per agent
      const metricsByAgent = [];
      for (const agentKey of AUDITED_AGENTS) {
        metricsByAgent.push(await this.collectMetricsForAgent(agentKey, windowDays));
      }

      // 2. Ask Claude for calibration recommendations
      let recommendations = { perAgent: [], summary: '' };
      try {
        const { system, user } = this.buildLLMPrompt(metricsByAgent);
        const response = await llmService.claudeChat({
          model: this.defaultModel,
          system,
          messages: [{ role: 'user', content: user }],
          maxTokens: 2000,
          operation: 'meta-critic:audit',
          agentId: this.agentKey,
        });
        tokensIn = response.tokensIn;
        tokensOut = response.tokensOut;
        costUSD = response.costUSD;

        const match = response.content.match(/\{[\s\S]*\}/);
        if (match) {
          try { recommendations = JSON.parse(match[0]); } catch { /* fallback below */ }
        }
      } catch (err) {
        const missingKey = /ANTHROPIC_API_KEY/i.test(err.message || '');
        if (missingKey) {
          // Scaffold path — persist metrics with zero adjustment so UI still has data
          recommendations = {
            perAgent: metricsByAgent.map(m => ({
              agentKey: m.agentKey,
              adjustAccuracy: 0, adjustConsistency: 0, adjustUtility: 0,
              rationale: 'LLM unavailable — raw metrics stored, no adjustment computed.',
            })),
            summary: 'LLM unavailable. Raw metrics stored without recommendations.',
          };
        } else {
          throw err;
        }
      }

      // 3. Persist calibration rows
      for (const m of metricsByAgent) {
        const rec = (recommendations.perAgent || []).find(r => r.agentKey === m.agentKey) || {};
        await this.persistCalibration(m.agentKey, 'accuracy', m.accuracy, windowDays, +(rec.adjustAccuracy || 0), rec.rationale || '');
        await this.persistCalibration(m.agentKey, 'consistency', m.consistency, windowDays, +(rec.adjustConsistency || 0), rec.rationale || '');
        await this.persistCalibration(m.agentKey, 'utility', m.utility, windowDays, +(rec.adjustUtility || 0), rec.rationale || '');
      }

      // 4. ActionItem if any recommendation is material
      const bigMoves = (recommendations.perAgent || []).filter(r =>
        Math.abs(r.adjustAccuracy || 0) >= 0.15
        || Math.abs(r.adjustConsistency || 0) >= 0.15
        || Math.abs(r.adjustUtility || 0) >= 0.15
      );
      if (bigMoves.length) {
        await this.writeActionItem({
          title: `Meta-Critic — ${bigMoves.length} agent${bigMoves.length === 1 ? '' : 's'} need attention`,
          description: recommendations.summary ||
            bigMoves.map(b => `${b.agentKey}: ${b.rationale}`).join('\n'),
          impact: 'Agent confidence may be miscalibrated; signals from these agents could be over- or under-trusted.',
          action: 'Review AgentCalibration records and consider tuning agent prompts.',
          priority: 'MEDIUM',
          source: 'chief-analyst', // only valid enum options are ['sentinel','chief-analyst','trading-bot','pattern-miner','user-duty']
          dedupKey: `meta-critic:audit:${new Date().toISOString().slice(0, 10)}`,
        });
      }

      // 5. Save snapshot to own memory
      await this.saveMemory('lastAudit', {
        at: new Date().toISOString(),
        windowDays,
        metricsByAgent,
        recommendations,
      });

      return {
        success: true,
        output: {
          windowDays,
          metricsByAgent,
          recommendations,
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
        error: missingKey ? 'needs key: ANTHROPIC_API_KEY not set' : msg,
        partial: missingKey,
        tokensUsed: { in: tokensIn, out: tokensOut },
        costUSD: +costUSD.toFixed(6),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

module.exports = new MetaCritic();
