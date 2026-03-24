// backend/services/feedbackService.js
// The feedback loop brain. Two jobs:
// 1. updateScreenPerformance(setup) — called when a trade resolves (TARGET_HIT/SL_HIT)
// 2. getScreenContext(screenName) — called before AI generates new setups, returns performance text for the prompt

const ScreenPerformance = require('../models/ScreenPerformance');
const TradeSetup = require('../models/TradeSetup');

// ─── Calculate P&L % for a resolved trade ───────────────────────────────────
function calcReturnPct(setup) {
  const entry = setup.entryPrice;
  const exit = setup.exitPrice || setup.currentPrice || entry;
  if (!entry || entry === 0) return 0;
  if (setup.action === 'BUY' || setup.action === 'ACCUMULATE') {
    return ((exit - entry) / entry) * 100;
  } else if (setup.action === 'SELL') {
    return ((entry - exit) / entry) * 100;
  }
  return 0;
}

// ─── Get confidence bracket key ─────────────────────────────────────────────
function getBracket(confidence) {
  if (confidence >= 80) return 'veryHigh';
  if (confidence >= 60) return 'high';
  if (confidence >= 40) return 'medium';
  return 'low';
}

// ─── Update screen performance after a trade resolves ───────────────────────
// Called from the cron job in server.js when a trade hits TARGET or SL
async function updateScreenPerformance(setup) {
  if (!setup.screenName) return; // AI_ANALYSIS trades without screenName skip this

  const isWin = setup.status === 'TARGET_HIT';
  const returnPct = calcReturnPct(setup);
  const bracket = getBracket(setup.confidence || 50);

  try {
    let perf = await ScreenPerformance.findOne({ screenName: setup.screenName });

    if (!perf) {
      perf = new ScreenPerformance({ screenName: setup.screenName });
    }

    // Update overall stats
    perf.totalSetups += 1;
    if (isWin) perf.wins += 1;
    else perf.losses += 1;
    perf.winRate = perf.wins + perf.losses > 0
      ? (perf.wins / (perf.wins + perf.losses)) * 100
      : 0;

    // Running average return
    const prevTotal = perf.totalSetups - 1;
    perf.avgReturnPct = prevTotal > 0
      ? (perf.avgReturnPct * prevTotal + returnPct) / perf.totalSetups
      : returnPct;

    // Running average confidence
    perf.avgConfidence = prevTotal > 0
      ? (perf.avgConfidence * prevTotal + (setup.confidence || 50)) / perf.totalSetups
      : (setup.confidence || 50);

    // Update confidence bracket
    const b = perf.confidenceBrackets[bracket];
    b.count += 1;
    if (isWin) b.wins += 1;
    b.winRate = b.count > 0 ? (b.wins / b.count) * 100 : 0;

    // Update per-symbol stats
    const sym = setup.symbol.toUpperCase();
    let symStat = perf.symbolStats.find(s => s.symbol === sym);
    if (!symStat) {
      perf.symbolStats.push({ symbol: sym, total: 0, wins: 0, losses: 0, avgReturnPct: 0 });
      symStat = perf.symbolStats[perf.symbolStats.length - 1];
    }
    const prevSymTotal = symStat.total;
    symStat.total += 1;
    if (isWin) symStat.wins += 1;
    else symStat.losses += 1;
    symStat.avgReturnPct = prevSymTotal > 0
      ? (symStat.avgReturnPct * prevSymTotal + returnPct) / symStat.total
      : returnPct;

    // Recompute best/worst symbols (min 2 trades to qualify)
    const qualified = perf.symbolStats.filter(s => s.total >= 2);
    const sorted = [...qualified].sort((a, b) => {
      const aWR = a.total > 0 ? (a.wins / a.total) * 100 : 0;
      const bWR = b.total > 0 ? (b.wins / b.total) * 100 : 0;
      return bWR - aWR;
    });
    perf.bestSymbols = sorted.slice(0, 5).map(s => s.symbol);
    perf.worstSymbols = sorted.slice(-5).reverse().map(s => s.symbol);

    perf.lastUpdated = new Date();
    await perf.save();

    console.log(`📊 Feedback: Updated ${setup.screenName} — ${isWin ? 'WIN' : 'LOSS'} ${setup.symbol} (${returnPct.toFixed(1)}%), win rate now ${perf.winRate.toFixed(1)}%`);
  } catch (err) {
    console.error(`❌ Feedback: Failed to update screen performance for ${setup.screenName}:`, err.message);
  }
}

// ─── Build performance context for AI prompt ────────────────────────────────
// Returns a string to prepend to the Perplexity prompt, or empty string if no data
async function getScreenContext(screenName) {
  if (!screenName) return '';

  try {
    const perf = await ScreenPerformance.findOne({ screenName }).lean();
    if (!perf || perf.totalSetups < 3) return ''; // Need minimum 3 resolved trades for meaningful data

    const lines = [];
    lines.push(`PERFORMANCE CONTEXT FOR SCREEN "${screenName}" (based on ${perf.totalSetups} resolved trades):`);
    lines.push(`- Win rate: ${perf.winRate.toFixed(1)}% (${perf.wins} wins / ${perf.wins + perf.losses} resolved)`);
    lines.push(`- Average return: ${perf.avgReturnPct >= 0 ? '+' : ''}${perf.avgReturnPct.toFixed(1)}%`);
    lines.push(`- Average AI confidence: ${perf.avgConfidence.toFixed(0)}`);

    // Confidence calibration
    const brackets = perf.confidenceBrackets;
    const calLines = [];
    if (brackets.veryHigh.count >= 2) calLines.push(`  80-100 confidence: actual win rate ${brackets.veryHigh.winRate.toFixed(0)}% (${brackets.veryHigh.count} trades)`);
    if (brackets.high.count >= 2) calLines.push(`  60-80 confidence: actual win rate ${brackets.high.winRate.toFixed(0)}% (${brackets.high.count} trades)`);
    if (brackets.medium.count >= 2) calLines.push(`  40-60 confidence: actual win rate ${brackets.medium.winRate.toFixed(0)}% (${brackets.medium.count} trades)`);
    if (brackets.low.count >= 2) calLines.push(`  0-40 confidence: actual win rate ${brackets.low.winRate.toFixed(0)}% (${brackets.low.count} trades)`);
    if (calLines.length > 0) {
      lines.push('- Confidence calibration:');
      lines.push(...calLines);
    }

    // Best/worst symbols
    if (perf.bestSymbols.length > 0) {
      lines.push(`- Best performers from this screen: ${perf.bestSymbols.join(', ')}`);
    }
    if (perf.worstSymbols.length > 0) {
      lines.push(`- Worst performers from this screen: ${perf.worstSymbols.join(', ')} (consider AVOID)`);
    }

    lines.push('');
    lines.push('USE THIS DATA TO:');
    lines.push('- Calibrate your confidence scores to match actual win rates above');
    lines.push('- Be more cautious with historically weak symbols from this screen');
    lines.push('- Favor symbols that have performed well from this screen');
    lines.push('');

    return lines.join('\n');
  } catch (err) {
    console.error(`❌ Feedback: Failed to get screen context for ${screenName}:`, err.message);
    return '';
  }
}

// ─── Get full performance data for API endpoint ─────────────────────────────
async function getPerformanceSummary(screenName) {
  if (!screenName) return null;
  try {
    return await ScreenPerformance.findOne({ screenName }).lean();
  } catch (err) {
    console.error(`❌ Feedback: Failed to get performance summary:`, err.message);
    return null;
  }
}

// ─── Get all screen performances for dashboard ──────────────────────────────
async function getAllPerformances() {
  try {
    return await ScreenPerformance.find({}).sort({ winRate: -1 }).lean();
  } catch (err) {
    console.error(`❌ Feedback: Failed to get all performances:`, err.message);
    return [];
  }
}

module.exports = {
  updateScreenPerformance,
  getScreenContext,
  getPerformanceSummary,
  getAllPerformances,
};
