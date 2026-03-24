// backend/services/screenScoringService.js
// Scores each screen based on historical performance.
// Runs nightly (11 PM IST) via cron in server.js, or on-demand via API.
// Score = weighted composite of hit rate, AI win rate, and consistency.

const Screen = require('../models/Screen');
const ScreenBatch = require('../models/ScreenBatch');
const TradeSetup = require('../models/TradeSetup');
const ScreenPerformance = require('../models/ScreenPerformance');

// ─── Score a single screen ──────────────────────────────────────────────────
async function scoreScreen(screen) {
  const screenName = screen.name;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  // 1. Get batches for this screen (last 90 days, at least 5 days old for price movement)
  const batches = await ScreenBatch.find({
    screenName,
    runDate: { $gte: ninetyDaysAgo, $lte: fiveDaysAgo },
  }).lean();

  // 2. Get resolved trade setups linked to this screen
  const resolvedSetups = await TradeSetup.find({
    screenName,
    status: { $in: ['TARGET_HIT', 'SL_HIT'] },
    createdAt: { $gte: ninetyDaysAgo },
  }).lean();

  // 3. Get feedback data if available
  const feedback = await ScreenPerformance.findOne({ screenName }).lean();

  const totalBatches = batches.length;
  let hitRate = null;
  let aiWinRate = null;
  let avgReturn = null;
  let consistency = null;

  // ── Calculate batch hit rate (stocks that went up after ranking) ──
  // This uses a simplified approach: if rankedResults has score > 0, it went up on ranking day.
  // For longer-term hit rate, we'd need to fetch current prices (done by /api/screens/performance).
  // Here we use the feedback service data if available.
  if (feedback && feedback.totalSetups >= 2) {
    hitRate = feedback.winRate;
    avgReturn = feedback.avgReturnPct;
  }

  // ── Calculate AI setup win rate ──
  if (resolvedSetups.length >= 2) {
    const wins = resolvedSetups.filter(s => s.status === 'TARGET_HIT').length;
    aiWinRate = (wins / resolvedSetups.length) * 100;

    // Calculate avg return from resolved setups
    if (avgReturn === null) {
      const returns = resolvedSetups.map(s => {
        const entry = s.entryPrice;
        const exit = s.exitPrice || s.currentPrice || entry;
        if (!entry || entry === 0) return 0;
        if (s.action === 'BUY' || s.action === 'ACCUMULATE') return ((exit - entry) / entry) * 100;
        if (s.action === 'SELL') return ((entry - exit) / entry) * 100;
        return 0;
      });
      avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    }

    // Calculate consistency (inverse of standard deviation of returns)
    const returns = resolvedSetups.map(s => {
      const entry = s.entryPrice;
      const exit = s.exitPrice || s.currentPrice || entry;
      if (!entry || entry === 0) return 0;
      if (s.action === 'BUY' || s.action === 'ACCUMULATE') return ((exit - entry) / entry) * 100;
      if (s.action === 'SELL') return ((entry - exit) / entry) * 100;
      return 0;
    });
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    // Consistency score: lower stdDev = more consistent = higher score
    // Map stdDev to 0-100: stdDev of 0 = 100, stdDev of 20+ = 0
    consistency = Math.max(0, Math.min(100, 100 - (stdDev * 5)));
  }

  // ── Composite score ──
  // Weighted: 40% hit rate + 40% AI win rate + 20% consistency
  // If we don't have enough data, use what we have
  let score = null;
  const components = [];

  if (hitRate !== null) components.push({ weight: 0.4, value: hitRate });
  if (aiWinRate !== null) components.push({ weight: 0.4, value: aiWinRate });
  if (consistency !== null) components.push({ weight: 0.2, value: consistency });

  if (components.length > 0) {
    // Normalize weights to sum to 1
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    score = components.reduce((sum, c) => sum + (c.value * c.weight / totalWeight), 0);
    score = Math.round(Math.max(0, Math.min(100, score)));
  }

  // ── Determine status ──
  let status = 'new';
  if (score !== null) {
    if (score >= 40) status = 'active';
    else status = 'underperforming';
  } else if (totalBatches > 0 || resolvedSetups.length > 0) {
    status = 'active'; // Has activity but not enough resolved data for scoring
  }

  return {
    screenName,
    performanceScore: score,
    totalBatches,
    avgHitRate: hitRate !== null ? Math.round(hitRate * 10) / 10 : null,
    avgAIWinRate: aiWinRate !== null ? Math.round(aiWinRate * 10) / 10 : null,
    avgReturn: avgReturn !== null ? Math.round(avgReturn * 10) / 10 : null,
    consistency: consistency !== null ? Math.round(consistency) : null,
    status,
    resolvedTrades: resolvedSetups.length,
  };
}

// ─── Score all screens and update the DB ────────────────────────────────────
async function scoreAllScreens() {
  try {
    const screens = await Screen.find({});
    const results = [];

    for (const screen of screens) {
      const scoreData = await scoreScreen(screen);

      // Update the Screen document
      await Screen.findByIdAndUpdate(screen._id, {
        performanceScore: scoreData.performanceScore,
        totalBatches: scoreData.totalBatches,
        avgHitRate: scoreData.avgHitRate,
        avgAIWinRate: scoreData.avgAIWinRate,
        avgReturn: scoreData.avgReturn,
        status: scoreData.status,
        lastScoredAt: new Date(),
        updatedAt: new Date(),
      });

      results.push(scoreData);
      console.log(`📊 Scored screen "${scoreData.screenName}": ${scoreData.performanceScore ?? 'no data'}/100 (${scoreData.status})`);
    }

    return results;
  } catch (err) {
    console.error('❌ Screen scoring failed:', err.message);
    return [];
  }
}

// ─── Get recommendations (screens ranked by score) ──────────────────────────
async function getRecommendations() {
  const screens = await Screen.find({}).lean();
  const scored = [];

  for (const screen of screens) {
    const scoreData = await scoreScreen(screen);
    scored.push({
      screenId: screen._id,
      screenName: screen.name,
      description: screen.description,
      score: scoreData.performanceScore,
      status: scoreData.status,
      totalBatches: scoreData.totalBatches,
      resolvedTrades: scoreData.resolvedTrades,
      avgHitRate: scoreData.avgHitRate,
      avgAIWinRate: scoreData.avgAIWinRate,
      avgReturn: scoreData.avgReturn,
      consistency: scoreData.consistency,
      reason: buildReason(scoreData),
    });
  }

  // Sort: scored screens first (by score desc), then unscored
  scored.sort((a, b) => {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score;
  });

  return {
    recommended: scored.filter(s => s.score !== null && s.score >= 50),
    active: scored.filter(s => s.score !== null && s.score >= 30 && s.score < 50),
    underperforming: scored.filter(s => s.score !== null && s.score < 30),
    needsData: scored.filter(s => s.score === null),
  };
}

function buildReason(data) {
  if (data.performanceScore === null) {
    if (data.totalBatches === 0) return 'No batches run yet — upload a CSV and rank to start tracking';
    return `${data.totalBatches} batches run, but no resolved trades yet — need more time for SL/target hits`;
  }
  const parts = [];
  if (data.avgAIWinRate !== null) parts.push(`${data.avgAIWinRate}% AI win rate`);
  if (data.avgHitRate !== null) parts.push(`${data.avgHitRate}% hit rate`);
  if (data.avgReturn !== null) parts.push(`${data.avgReturn >= 0 ? '+' : ''}${data.avgReturn}% avg return`);
  parts.push(`${data.resolvedTrades} resolved trades`);
  return parts.join(', ');
}

module.exports = {
  scoreScreen,
  scoreAllScreens,
  getRecommendations,
};
