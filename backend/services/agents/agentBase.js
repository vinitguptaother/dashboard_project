/**
 * AgentBase — base class for Vinit's AI research agents.
 *
 * MASTER_PLAN §3-4. Provides shared plumbing:
 *   - Memory load/save (AgentMemory collection, keyed by agentKey + storeKey)
 *   - ActionItem writing (reuses sentinelService's upsertAlert pattern)
 *   - run() template method (subclass overrides)
 *
 * Subclasses:
 *   services/agents/marketScout.js   — daily pre-market briefing (Phase 1)
 *   services/agents/chiefAnalyst.js  — orchestrator (Phase 2+)
 *   services/agents/sectorSpecialist.js, etc. — per-sector (Phase 3+)
 *
 * Safety contract:
 *   - Agents READ from dashboard + internet.
 *   - Agents WRITE only to: AgentMemory, LLMUsage, ActionItem.
 *   - Agents MUST NOT write trades, portfolio, screens, or any other collection.
 */

const mongoose = require('mongoose');
const AgentMemory = require('../../models/AgentMemory');
const ActionItem = require('../../models/ActionItem');

class AgentBase {
  /**
   * @param {Object} opts
   * @param {string} opts.agentKey      e.g. 'market-scout'
   * @param {string} opts.displayName   e.g. 'Market Scout'
   * @param {string} [opts.defaultModel='claude-sonnet-4-5']
   */
  constructor({ agentKey, displayName, defaultModel = 'claude-sonnet-4-5' }) {
    if (!agentKey) throw new Error('AgentBase: agentKey is required');
    this.agentKey = agentKey;
    this.displayName = displayName || agentKey;
    this.defaultModel = defaultModel;
  }

  // ─── Memory ───────────────────────────────────────────────────────────────

  /**
   * Load a named memory bucket for this agent.
   * Returns `null` if this bucket has never been written.
   */
  async loadMemory(storeKey) {
    try {
      const doc = await AgentMemory.findOne({ agentKey: this.agentKey }).lean();
      if (!doc || !doc.stores) return null;
      return doc.stores[storeKey] ?? null;
    } catch (err) {
      console.warn(`[agent:${this.agentKey}] loadMemory(${storeKey}) failed:`, err.message);
      return null;
    }
  }

  /**
   * Save (or overwrite) a named memory bucket. Content can be any JSON-serializable value.
   */
  async saveMemory(storeKey, content) {
    try {
      await AgentMemory.findOneAndUpdate(
        { agentKey: this.agentKey },
        {
          $set: {
            [`stores.${storeKey}`]: content,
            lastUpdated: new Date(),
          },
          $setOnInsert: { agentKey: this.agentKey },
        },
        { upsert: true, new: true }
      );
      return true;
    } catch (err) {
      console.warn(`[agent:${this.agentKey}] saveMemory(${storeKey}) failed:`, err.message);
      return false;
    }
  }

  /**
   * Return full stores object (mainly for debugging / API inspection).
   */
  async dumpMemory() {
    const doc = await AgentMemory.findOne({ agentKey: this.agentKey }).lean();
    return doc || null;
  }

  // ─── ActionItem writing (same dedup pattern as sentinelService) ──────────

  /**
   * Write an ActionItem. Uses dedupKey based on agentKey + title so repeated
   * runs in the same morning update the existing card rather than stacking up.
   */
  async writeActionItem({
    title, description = '', impact = '', action = '',
    priority = 'MEDIUM', source = 'chief-analyst',
    symbol = '', dedupKey = '', deadline = null,
  }) {
    try {
      const effectiveDedupKey = dedupKey || `agent:${this.agentKey}:${title}`.slice(0, 200);

      // Prefer updating an open item with same dedupKey; else create.
      const existing = await ActionItem.findOne({
        dedupKey: effectiveDedupKey,
        status: { $in: ['new', 'acknowledged'] },
      });

      if (existing) {
        Object.assign(existing, {
          title, description, impact, action, priority, symbol, deadline,
        });
        await existing.save();
        return existing;
      }

      return await ActionItem.create({
        dedupKey: effectiveDedupKey,
        title, description, impact, action, priority, source,
        symbol, deadline,
      });
    } catch (err) {
      console.warn(`[agent:${this.agentKey}] writeActionItem failed:`, err.message);
      return null;
    }
  }

  // ─── Run (template method) ───────────────────────────────────────────────

  /**
   * Subclasses override this. Should return:
   *   { success: boolean, output: any, tokensUsed?: {in, out}, costUSD?: number, durationMs?: number, error?: string }
   */
  async run() {
    throw new Error(`Agent ${this.agentKey} has not implemented run()`);
  }
}

module.exports = AgentBase;
