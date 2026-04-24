/**
 * llmService.js — unified LLM wrapper.
 *
 * MASTER_PLAN §3-4. Single entry point for all LLM calls from the
 * AI agent infrastructure (Market Scout, Chief Analyst, etc.).
 *
 * Public API:
 *   claudeChat({ model, system, messages, tools, maxTokens })
 *   perplexityAsk({ prompt, model })
 *   openaiEmbed({ text, model })   — stub for now, fills in when needed
 *
 * Every call logs to the LLMUsage collection for cost visibility.
 */

const axios = require('axios');
const LLMUsage = require('../models/LLMUsage');

// ─── Pricing table ($ per 1M tokens) ────────────────────────────────────────
// Keep close to reality; used only for "estimated cost" display.
const PRICING = {
  anthropic: {
    // Sonnet 4.5 — default for agents (best cost/perf balance)
    'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
    'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
    // Opus 4.7 — for Chief Analyst / deep reasoning
    'claude-opus-4-7': { input: 5.0, output: 25.0 },
    // Haiku 4.5 — for cheap/fast classifiers
    'claude-haiku-4-5': { input: 1.0, output: 5.0 },
    'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  },
  perplexity: {
    // Perplexity charges per 1M tokens + per-request fee for online models.
    // These are approximate; actual billing is via the Perplexity dashboard.
    'sonar-pro': { input: 3.0, output: 15.0, perRequest: 0.005 },
    'sonar': { input: 1.0, output: 1.0, perRequest: 0.005 },
    'llama-3.1-sonar-small-128k-online': { input: 0.2, output: 0.2, perRequest: 0.005 },
  },
  openai: {
    'text-embedding-3-small': { input: 0.02, output: 0 },
    'text-embedding-3-large': { input: 0.13, output: 0 },
  },
};

function estimateCost(provider, model, tokensIn = 0, tokensOut = 0) {
  const rates = PRICING[provider]?.[model];
  if (!rates) return 0;
  const inCost = (tokensIn / 1_000_000) * (rates.input || 0);
  const outCost = (tokensOut / 1_000_000) * (rates.output || 0);
  const perReq = rates.perRequest || 0;
  return +(inCost + outCost + perReq).toFixed(6);
}

// ─── Usage logging ──────────────────────────────────────────────────────────
async function logUsage({
  provider, model, operation = '', tokensIn = 0, tokensOut = 0,
  costUSD = 0, agentId = '', success = true, errorMessage = '',
}) {
  try {
    await LLMUsage.create({
      provider, model, operation, tokensIn, tokensOut,
      costUSD, agentId, success, errorMessage, at: new Date(),
    });
  } catch (err) {
    // Never fail the actual LLM call because logging failed
    console.warn('[llmService] usage log failed:', err.message);
  }
}

// ─── Anthropic client (lazy init) ───────────────────────────────────────────
let _anthropicClient = null;
function getAnthropicClient() {
  if (_anthropicClient) return _anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_anthropic_api_key' || apiKey.trim() === '') {
    throw new Error(
      'Missing ANTHROPIC_API_KEY in .env. Get one from https://console.anthropic.com/ ' +
      'and add: ANTHROPIC_API_KEY=sk-ant-xxx to backend/.env'
    );
  }
  const Anthropic = require('@anthropic-ai/sdk');
  _anthropicClient = new Anthropic({ apiKey });
  return _anthropicClient;
}

// ─── claudeChat ─────────────────────────────────────────────────────────────
/**
 * @param {Object} opts
 * @param {string} [opts.model='claude-sonnet-4-5']
 * @param {string} [opts.system]       System prompt
 * @param {Array}  opts.messages       [{ role, content }]
 * @param {Array}  [opts.tools]        Anthropic tool defs
 * @param {number} [opts.maxTokens=4000]
 * @param {string} [opts.operation]    Used for LLMUsage.operation
 * @param {string} [opts.agentId]      e.g. 'market-scout'
 * @returns {Promise<{ content, tokensIn, tokensOut, costUSD, toolUseBlocks, raw }>}
 */
async function claudeChat({
  model = 'claude-sonnet-4-5',
  system,
  messages,
  tools,
  maxTokens = 4000,
  operation = '',
  agentId = '',
}) {
  const client = getAnthropicClient();
  const startedAt = Date.now();
  let tokensIn = 0, tokensOut = 0, costUSD = 0;

  try {
    const params = {
      model,
      max_tokens: maxTokens,
      messages,
    };
    if (system) params.system = system;
    if (tools && tools.length) params.tools = tools;

    const response = await client.messages.create(params);

    tokensIn = response.usage?.input_tokens || 0;
    tokensOut = response.usage?.output_tokens || 0;
    costUSD = estimateCost('anthropic', model, tokensIn, tokensOut);

    // Extract plain-text content (concatenating all text blocks)
    const textBlocks = (response.content || []).filter(b => b.type === 'text');
    const content = textBlocks.map(b => b.text).join('\n').trim();

    const toolUseBlocks = (response.content || []).filter(b => b.type === 'tool_use');

    await logUsage({
      provider: 'anthropic', model, operation, tokensIn, tokensOut,
      costUSD, agentId, success: true,
    });

    return {
      content,
      tokensIn,
      tokensOut,
      costUSD,
      toolUseBlocks: toolUseBlocks.length ? toolUseBlocks : undefined,
      durationMs: Date.now() - startedAt,
      raw: response,
    };
  } catch (err) {
    await logUsage({
      provider: 'anthropic', model, operation, tokensIn, tokensOut,
      costUSD, agentId, success: false,
      errorMessage: err.message?.slice(0, 500) || 'unknown',
    });
    throw err;
  }
}

// ─── perplexityAsk ──────────────────────────────────────────────────────────
/**
 * Thin wrapper around the existing Perplexity integration so agents
 * have a consistent API for external research + citations.
 *
 * @param {Object} opts
 * @param {string} opts.prompt
 * @param {string} [opts.model='sonar-pro']
 * @param {string} [opts.system]    Optional system override
 * @param {number} [opts.maxTokens=2000]
 * @param {string} [opts.operation]
 * @param {string} [opts.agentId]
 * @returns {Promise<{ content, citations, costUSD, tokensIn, tokensOut }>}
 */
async function perplexityAsk({
  prompt,
  model = 'sonar-pro',
  system = 'You are a research assistant for Indian stock markets. Be concise, cite sources, surface specific facts not opinions.',
  maxTokens = 2000,
  operation = '',
  agentId = '',
}) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey || apiKey === 'your_perplexity_api_key') {
    throw new Error('Missing PERPLEXITY_API_KEY in backend/.env');
  }

  const startedAt = Date.now();
  let tokensIn = 0, tokensOut = 0, costUSD = 0;

  try {
    const resp = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const choice = resp.data?.choices?.[0];
    const content = choice?.message?.content || '';
    const citations = resp.data?.citations || [];
    const usage = resp.data?.usage || {};
    tokensIn = usage.prompt_tokens || 0;
    tokensOut = usage.completion_tokens || 0;
    costUSD = estimateCost('perplexity', model, tokensIn, tokensOut);

    await logUsage({
      provider: 'perplexity', model, operation, tokensIn, tokensOut,
      costUSD, agentId, success: true,
    });

    return {
      content,
      citations,
      costUSD,
      tokensIn,
      tokensOut,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message || 'unknown';
    await logUsage({
      provider: 'perplexity', model, operation, tokensIn, tokensOut,
      costUSD, agentId, success: false,
      errorMessage: errMsg.slice(0, 500),
    });
    throw new Error(`Perplexity error: ${errMsg}`);
  }
}

// ─── openaiEmbed (stub) ─────────────────────────────────────────────────────
/**
 * Placeholder. Real implementation will be added when vector search
 * is wired up (likely via OpenAI text-embedding-3-small + a local vector
 * store). Throws helpful error so callers know it's not ready yet.
 */
async function openaiEmbed(/* { text, model } */) {
  throw new Error(
    'openaiEmbed not yet implemented. Will be wired when vector search is needed. ' +
    'For now, agents should use keyword retrieval or rely on Claude\'s long context.'
  );
}

module.exports = {
  claudeChat,
  perplexityAsk,
  openaiEmbed,
  estimateCost,       // exported for tests + debug
  _logUsage: logUsage,
};
