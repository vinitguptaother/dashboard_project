/**
 * Market Regime Engine — classifies the Indian market into one of:
 *   trending-bull / trending-bear / choppy / breakout / risk-off / unknown
 *
 * BOT_BLUEPRINT item #30.
 *
 * Inputs (cheap — reuses existing data + one Upstox historical fetch):
 *   • NIFTY current level + 20/50/200 EMA (from Upstox historical daily)
 *   • India VIX (current + day-over-day change)
 *   • FII + DII latest EOD (from FiiDiiDaily — already shipped #26)
 *   • Breadth (advances/declines) — optional, not used in v1
 *
 * Classification rules (simple, readable — tune as we observe live):
 *   RISK-OFF:       VIX > 22  OR  VIX up >25% day-over-day
 *   TRENDING-BULL:  NIFTY > 50 EMA > 200 EMA  AND  FII net ≥ 0
 *   TRENDING-BEAR:  NIFTY < 50 EMA < 200 EMA  AND  FII net ≤ 0
 *   BREAKOUT:       NIFTY crossed 50 EMA from below in last 3 sessions  AND  VIX < 18
 *   CHOPPY:         everything else
 */

const axios = require('axios');
const MarketRegime = require('../models/MarketRegime');
const FiiDiiDaily = require('../models/FiiDiiDaily');

const UPSTOX_INST = {
  NIFTY: 'NSE_INDEX|Nifty 50',
  VIX: 'NSE_INDEX|India VIX',
};

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

async function fetchNiftyHistoricalClose(days = 500) {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error('UPSTOX_ACCESS_TOKEN not set');
  const to = new Date().toISOString().slice(0, 10);
  // Pad generously — Upstox only returns what's available; trading days ≈ 250/year
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(UPSTOX_INST.NIFTY)}/day/${to}/${fromDate}`;
  const res = await axios.get(url, { timeout: 15000, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const candles = res.data?.data?.candles || []; // [[ts, open, high, low, close, volume, oi], ...]
  // Upstox returns NEWEST first — reverse to chronological for EMA calc
  return candles.slice().reverse().map(c => ({ ts: c[0], close: parseFloat(c[4]) })).filter(d => d.close > 0);
}

async function fetchVix() {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) return { current: 0, delta: 0 };
  try {
    const url = `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(UPSTOX_INST.VIX)}`;
    const res = await axios.get(url, { timeout: 8000, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const quote = Object.values(res.data?.data || {})[0];
    const current = parseFloat(quote?.last_price || quote?.ltp || 0);
    // Fetch previous close via 2-day historical for delta%
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(UPSTOX_INST.VIX)}/day/${to}/${from}`;
    const histRes = await axios.get(histUrl, { timeout: 8000, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const candles = histRes.data?.data?.candles || [];
    const prevClose = parseFloat(candles[1]?.[4] || candles[0]?.[4] || current);
    const delta = prevClose > 0 ? ((current - prevClose) / prevClose) * 100 : 0;
    return { current, delta };
  } catch (err) {
    return { current: 0, delta: 0, error: err.message };
  }
}

async function classifyCurrent() {
  // 1) Fetch NIFTY candles + compute EMAs
  const candles = await fetchNiftyHistoricalClose(500);
  if (candles.length < 50) throw new Error(`Not enough NIFTY history (got ${candles.length}, need ≥50 for minimum classification)`);
  const closes = candles.map(c => c.close);
  const niftyLevel = closes[closes.length - 1];
  const ema20 = ema(closes, 20) || 0;
  const ema50 = ema(closes, 50) || 0;
  // 200 EMA is optional — fall back to 50-EMA-only logic if not enough data
  const ema200 = closes.length >= 200 ? (ema(closes, 200) || 0) : 0;
  const has200 = ema200 > 0;

  // 2) VIX
  const vix = await fetchVix();

  // 3) Latest FII/DII
  const latestFd = await FiiDiiDaily.findOne({}).sort({ date: -1 }).lean();
  const fiiNet = latestFd?.fii?.netValue || 0;
  const diiNet = latestFd?.dii?.netValue || 0;

  // 4) Detect recent 50 EMA crossover (bull breakout signal)
  let recentBullCross = false;
  if (closes.length >= 50) {
    for (let i = Math.max(closes.length - 3, 50); i < closes.length; i++) {
      const emaNow = ema(closes.slice(0, i + 1), 50);
      const emaPrev = ema(closes.slice(0, i), 50);
      if (emaPrev && emaNow && closes[i - 1] < emaPrev && closes[i] > emaNow) {
        recentBullCross = true;
        break;
      }
    }
  }

  const niftyVs50Pct = ema50 > 0 ? ((niftyLevel - ema50) / ema50) * 100 : 0;

  // 5) Classify
  let regime = 'choppy';
  let confidence = 0.5;
  const reasons = [];

  if (vix.current >= 22 || vix.delta >= 25) {
    regime = 'risk-off';
    confidence = Math.min(1, 0.6 + (vix.current - 22) / 20);
    reasons.push(`VIX ${vix.current.toFixed(2)} ${vix.delta >= 0 ? '+' : ''}${vix.delta.toFixed(1)}% — elevated fear`);
  } else if (niftyLevel > ema50 && (!has200 || ema50 > ema200) && fiiNet >= 0) {
    regime = 'trending-bull';
    const strength = Math.max(0, niftyVs50Pct);
    confidence = Math.min(1, (has200 ? 0.6 : 0.45) + strength / 10);
    if (has200) reasons.push(`NIFTY ${niftyLevel.toFixed(0)} > 50 EMA ${ema50.toFixed(0)} > 200 EMA ${ema200.toFixed(0)}`);
    else reasons.push(`NIFTY ${niftyLevel.toFixed(0)} > 50 EMA ${ema50.toFixed(0)} (200 EMA N/A — history limited)`);
    reasons.push(`FII net +₹${fiiNet.toFixed(0)}cr (buying)`);
  } else if (niftyLevel < ema50 && (!has200 || ema50 < ema200) && fiiNet <= 0) {
    regime = 'trending-bear';
    const strength = Math.max(0, -niftyVs50Pct);
    confidence = Math.min(1, (has200 ? 0.6 : 0.45) + strength / 10);
    if (has200) reasons.push(`NIFTY ${niftyLevel.toFixed(0)} < 50 EMA ${ema50.toFixed(0)} < 200 EMA ${ema200.toFixed(0)}`);
    else reasons.push(`NIFTY ${niftyLevel.toFixed(0)} < 50 EMA ${ema50.toFixed(0)} (200 EMA N/A — history limited)`);
    reasons.push(`FII net ₹${fiiNet.toFixed(0)}cr (selling)`);
  } else if (recentBullCross && vix.current < 18) {
    regime = 'breakout';
    confidence = 0.7;
    reasons.push(`NIFTY recently crossed above 50 EMA`);
    reasons.push(`VIX ${vix.current.toFixed(1)} (low volatility = clean breakout)`);
  } else {
    regime = 'choppy';
    confidence = 0.4;
    reasons.push(`NIFTY ${niftyLevel.toFixed(0)} vs 50 EMA ${ema50.toFixed(0)} (${niftyVs50Pct >= 0 ? '+' : ''}${niftyVs50Pct.toFixed(2)}%)`);
    reasons.push(`mixed signals — no dominant direction`);
  }

  const doc = {
    regime,
    confidence: parseFloat(confidence.toFixed(2)),
    reason: reasons.join(' · '),
    inputs: {
      niftyLevel,
      nifty20EMA: ema20,
      nifty50EMA: ema50,
      nifty200EMA: ema200,
      niftyVs50PctTrend: parseFloat(niftyVs50Pct.toFixed(3)),
      vix: vix.current,
      vixDelta: parseFloat(vix.delta.toFixed(2)),
      fiiNetCr: fiiNet,
      diiNetCr: diiNet,
      breadthRatio: 0, // not computed in v1
    },
    computedAt: new Date(),
  };

  return doc;
}

async function computeAndStore() {
  const doc = await classifyCurrent();
  const saved = await MarketRegime.create(doc);
  return saved;
}

async function getCurrent() {
  return MarketRegime.findOne({}).sort({ computedAt: -1 }).lean();
}

async function getHistory(limit = 50) {
  return MarketRegime.find({}).sort({ computedAt: -1 }).limit(limit).lean();
}

/**
 * Phase 5 — HMM-based regime classification.
 *
 * Returns a doc shaped similarly to classifyCurrent() so callers can swap
 * based on RiskSettings.regimeClassifier without schema surprises. This
 * method does NOT write to MarketRegime — it's advisory unless the user
 * opts into 'hmm' mode.
 */
async function classifyWithHMM() {
  const hmm = require('./hmmRegimeService');
  const out = await hmm.classifyCurrent();
  // Map HMM state ('trending'|'choppy'|'risk-off') to the existing enum values
  // expected by downstream validator / strategies. 'trending' defaults to
  // 'trending-bull' here; the rule-based classifier does the bear separation
  // via FII sign — HMM's 3-state model does not distinguish bull/bear so we
  // pick bull as the common default (the Validator can cross-check sign if
  // strict bear detection is needed).
  const regimeMap = {
    'trending': 'trending-bull',
    'choppy': 'choppy',
    'risk-off': 'risk-off',
  };
  const regime = regimeMap[out.state] || 'unknown';
  return {
    regime,
    confidence: out.confidence,
    reason: `HMM (${out.method}) state="${out.state}" · conf=${out.confidence.toFixed(2)}`,
    inputs: {
      niftyLevel: 0,
      nifty20EMA: 0,
      nifty50EMA: 0,
      nifty200EMA: 0,
      niftyVs50PctTrend: 0,
      vix: out.observedToday?.vix || 0,
      vixDelta: 0,
      fiiNetCr: 0,
      diiNetCr: 0,
      breadthRatio: 0,
    },
    hmm: out,
    computedAt: new Date(),
  };
}

/**
 * Compare the rule-based and HMM classifiers side-by-side.
 */
async function compareClassifiers() {
  const [ruleRes, hmmRes] = await Promise.allSettled([
    classifyCurrent(),
    classifyWithHMM(),
  ]);
  return {
    rule: ruleRes.status === 'fulfilled' ? ruleRes.value : { error: ruleRes.reason?.message || String(ruleRes.reason) },
    hmm: hmmRes.status === 'fulfilled' ? hmmRes.value : { error: hmmRes.reason?.message || String(hmmRes.reason) },
    agreement: (
      ruleRes.status === 'fulfilled' && hmmRes.status === 'fulfilled'
        ? (ruleRes.value.regime === hmmRes.value.regime)
        : null
    ),
    at: new Date(),
  };
}

module.exports = {
  classifyCurrent,
  computeAndStore,
  getCurrent,
  getHistory,
  classifyWithHMM,
  compareClassifiers,
};
