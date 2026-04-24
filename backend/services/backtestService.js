/**
 * Backtest Service — the full backtest engine.
 *
 * MASTER_PLAN §7 Phase 5. Replaces the Phase 3 stub that returned
 * `{ runs: 0, pendingPhase5: true }`.
 *
 * Flow
 *   1. For each symbol in `universe`, load day-by-day OHLC for the requested
 *      period (cached in HistoricalOHLC — first backtest populates).
 *   2. Iterate day-by-day chronologically. For each day:
 *        • refresh the per-symbol rolling window of candles
 *        • update open positions (check SL/target using that day's high/low;
 *          time-exit if max hold reached)
 *        • call strategy.evaluate() with context built up to that day
 *        • if it returns a candidate, simulate an entry at NEXT day's open
 *   3. Apply realism (slippage + charges via paperRealismService) on every
 *      entry and exit.
 *   4. Aggregate metrics: win rate, avg return, sharpe, sortino, profit
 *      factor, max drawdown (+ duration), equity curve, byRegime, byMonth.
 *
 * Notes
 *   • PURE LOCAL — no LLM, no per-run API cost.
 *   • Heavy uses concurrency-bounded Upstox historical fetch to respect
 *     Upstox rate limits (max 3 parallel per batch, gentle spacing).
 *   • Regime during a past day is approximated from the cached NIFTY series
 *     (50 EMA + simple breakout rules). Matches regimeService's rule-based
 *     output closely enough for filtering; the dashboard's live regime
 *     classifier remains the source of truth for current-day routing.
 */

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');

const HistoricalOHLC = require('../models/HistoricalOHLC');
const BacktestJob = require('../models/BacktestJob');
const Instrument = require('../models/Instrument');
const paperRealism = require('./paperRealismService');

const UPSTOX_HIST_BASE = 'https://api.upstox.com/v2/historical-candle';

// ─── Small helpers ─────────────────────────────────────────────────────────

function ensureDate(d) {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function ymd(d) { return ensureDate(d).toISOString().slice(0, 10); }
function daysBetween(a, b) {
  return Math.round((ensureDate(b).getTime() - ensureDate(a).getTime()) / 86400000);
}
function newJobId() {
  return `bt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return sma(trs, period);
}

// ─── Instrument key resolution (cached per process) ─────────────────────────

const _instrumentKeyCache = new Map();

async function resolveInstrumentKey(symbol) {
  const upper = symbol.toUpperCase();
  if (_instrumentKeyCache.has(upper)) return _instrumentKeyCache.get(upper);
  try {
    const rows = await Instrument.find({ symbol: upper, token: { $ne: '' } }).lean();
    // Prefer NSE over BSE
    const nse = rows.find(r => r.exchange === 'NSE');
    const any = rows[0];
    const key = (nse || any)?.token || null;
    _instrumentKeyCache.set(upper, key);
    return key;
  } catch {
    return null;
  }
}

// ─── Historical OHLC loader with cache ─────────────────────────────────────

/**
 * Fetch + cache daily OHLCV bars for a symbol across a date window.
 * Reads existing cache first; only calls Upstox for the delta.
 *
 * @returns {Array<{date,open,high,low,close,volume}>} chronological
 */
async function loadHistorical(symbol, fromDate, toDate) {
  const symU = symbol.toUpperCase();
  const from = ensureDate(fromDate);
  const to   = ensureDate(toDate);

  // 1) Try cache first
  let cached = await HistoricalOHLC.find({
    symbol: symU,
    date: { $gte: from, $lte: to },
  }).sort({ date: 1 }).lean();

  const needFetch = cached.length < Math.max(30, daysBetween(from, to) * 0.4);

  if (needFetch) {
    const instrumentKey = await resolveInstrumentKey(symU);
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    if (instrumentKey && token) {
      try {
        const fromStr = ymd(from);
        const toStr = ymd(to);
        const url = `${UPSTOX_HIST_BASE}/${encodeURIComponent(instrumentKey)}/day/${toStr}/${fromStr}`;
        const res = await axios.get(url, {
          timeout: 20000,
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const candles = res.data?.data?.candles || [];
        // Upstox returns newest-first — reverse for chronological
        const rows = candles.slice().reverse().map(c => ({
          symbol: symU,
          date: new Date(c[0]),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low:  parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5] || 0),
          instrumentKey,
          source: 'upstox-v2/day',
          fetchedAt: new Date(),
        })).filter(r => r.close > 0);

        if (rows.length > 0) {
          // Upsert — idempotent, survives reruns
          const ops = rows.map(r => ({
            updateOne: {
              filter: { symbol: r.symbol, date: r.date },
              update: { $set: r },
              upsert: true,
            },
          }));
          await HistoricalOHLC.bulkWrite(ops, { ordered: false }).catch(() => {});
          // Re-read what we now have in the window
          cached = await HistoricalOHLC.find({
            symbol: symU,
            date: { $gte: from, $lte: to },
          }).sort({ date: 1 }).lean();
        }
      } catch (err) {
        // Fetch failure isn't fatal — we use whatever cache we have.
        // Caller decides what to do with an empty series.
      }
    }
  }

  return cached.map(c => ({
    date: c.date,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume || 0,
  }));
}

// ─── Trading-day union + per-day candle lookups ───────────────────────────

/**
 * Build a sorted array of unique trading days across all symbols in the
 * universe. Using union rather than intersection so if one symbol misses a
 * single day (rare, e.g. delisted/suspended), other symbols still trade.
 */
function buildTradingDays(seriesBySymbol) {
  const set = new Set();
  for (const sym of Object.keys(seriesBySymbol)) {
    for (const c of seriesBySymbol[sym]) set.add(ensureDate(c.date).getTime());
  }
  return Array.from(set).sort((a, b) => a - b).map(t => new Date(t));
}

// ─── Cheap regime classifier on a NIFTY series ────────────────────────────

async function loadNiftySeries(fromDate, toDate) {
  // NIFTY 50 is stored under "NIFTY" or instrument_key NSE_INDEX|Nifty 50.
  // We cache by symbol "NIFTY" in HistoricalOHLC with a custom instrumentKey.
  const symU = 'NIFTY';
  const from = ensureDate(fromDate);
  const to   = ensureDate(toDate);

  let cached = await HistoricalOHLC.find({
    symbol: symU,
    date: { $gte: from, $lte: to },
  }).sort({ date: 1 }).lean();

  if (cached.length < Math.max(30, daysBetween(from, to) * 0.4)) {
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    if (token) {
      try {
        const fromStr = ymd(from);
        const toStr = ymd(to);
        const instrumentKey = 'NSE_INDEX|Nifty 50';
        const url = `${UPSTOX_HIST_BASE}/${encodeURIComponent(instrumentKey)}/day/${toStr}/${fromStr}`;
        const res = await axios.get(url, {
          timeout: 20000,
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const candles = res.data?.data?.candles || [];
        const rows = candles.slice().reverse().map(c => ({
          symbol: symU,
          date: new Date(c[0]),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low:  parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseFloat(c[5] || 0),
          instrumentKey,
          source: 'upstox-v2/day',
          fetchedAt: new Date(),
        })).filter(r => r.close > 0);
        if (rows.length > 0) {
          const ops = rows.map(r => ({
            updateOne: { filter: { symbol: r.symbol, date: r.date }, update: { $set: r }, upsert: true },
          }));
          await HistoricalOHLC.bulkWrite(ops, { ordered: false }).catch(() => {});
          cached = await HistoricalOHLC.find({ symbol: symU, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
        }
      } catch { /* use whatever cache we have */ }
    }
  }
  return cached.map(c => ({ date: c.date, close: c.close, high: c.high, low: c.low, open: c.open }));
}

/**
 * Approximate the regime as-of `asOfIndex` in the NIFTY series using the
 * simpler rule-based heuristic. Produces the same string enum the live
 * regime classifier emits so the backtester's regime filter is compatible.
 */
function regimeAtIndex(niftySeries, asOfIndex) {
  const i = Math.min(Math.max(asOfIndex, 0), niftySeries.length - 1);
  if (i < 50) return 'unknown';
  const closes = niftySeries.slice(0, i + 1).map(c => c.close);
  const level = closes[closes.length - 1];
  const e20 = ema(closes, 20) || 0;
  const e50 = ema(closes, 50) || 0;
  const e200 = closes.length >= 200 ? (ema(closes, 200) || 0) : 0;
  const has200 = e200 > 0;

  if (level > e50 * 1.0 && (!has200 || e50 > e200)) return 'trending-bull';
  if (level < e50 * 1.0 && (!has200 || e50 < e200)) return 'trending-bear';

  // Simple breakout check: today closes above 20-day high
  const recentHighs = niftySeries.slice(Math.max(0, i - 20), i).map(c => c.high || c.close);
  const hi20 = recentHighs.length ? Math.max(...recentHighs) : 0;
  if (hi20 > 0 && level > hi20) return 'breakout';

  return 'choppy';
}

// ─── Position sizing using risk-per-trade ──────────────────────────────────

function positionSize({ equity, riskPerTradePct, entryPrice, stopLoss }) {
  const riskBudget = equity * (riskPerTradePct / 100);
  const perShareRisk = Math.max(Math.abs(entryPrice - stopLoss), 0.01);
  const qty = Math.max(1, Math.floor(riskBudget / perShareRisk));
  // Cap at 25% of equity notional per trade (sanity)
  const maxByNotional = Math.floor((equity * 0.25) / Math.max(entryPrice, 0.01));
  return Math.max(1, Math.min(qty, maxByNotional || qty));
}

// ─── Core: per-strategy day-by-day simulation ──────────────────────────────

async function runBacktest(config = {}) {
  const t0 = Date.now();
  const {
    strategyKey,
    universe = [],
    fromDate,
    toDate,
    initialCapital = 500000,
    riskPerTradePct = 2,
    regimeFilter = null,
    onProgress = null,
    maxHoldDays = null,
  } = config;

  if (!strategyKey) throw new Error('strategyKey is required');
  if (!Array.isArray(universe) || universe.length === 0) throw new Error('universe (array of symbols) is required');
  if (!fromDate || !toDate) throw new Error('fromDate and toDate are required');

  const strategies = require('./strategies');
  const strategy = strategies.getStrategyByKey(strategyKey);
  if (!strategy) throw new Error(`Strategy not found: ${strategyKey}`);

  const segment = strategy.segment || 'equity-delivery';
  const liquidityBand = segment === 'options' ? 'OPTIONS' : 'LARGE';

  // Default time-exit: 30 trading days for swing, 90 for longterm
  const timeExitDays = maxHoldDays != null
    ? maxHoldDays
    : (strategy.botId === 'longterm' ? 90 : 30);

  // 1) Load all OHLC + regime backing series (need ~250d pre-roll for EMAs)
  const prerollDays = 260;
  const loadFrom = new Date(ensureDate(fromDate).getTime() - prerollDays * 86400000);

  const seriesBySymbol = {};
  // Limited concurrency — 3 parallel Upstox fetches
  const symbols = universe.slice();
  const concurrency = 3;
  let idx = 0;
  async function worker() {
    while (idx < symbols.length) {
      const i = idx++;
      const sym = symbols[i];
      try {
        const s = await loadHistorical(sym, loadFrom, toDate);
        seriesBySymbol[sym.toUpperCase()] = s;
      } catch {
        seriesBySymbol[sym.toUpperCase()] = [];
      }
      if (typeof onProgress === 'function') {
        onProgress({ phase: 'loading', done: idx, total: symbols.length });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker()));

  // Load NIFTY for regime
  const niftySeries = await loadNiftySeries(loadFrom, toDate);
  const niftyDateIdx = new Map();
  niftySeries.forEach((c, i) => niftyDateIdx.set(ensureDate(c.date).getTime(), i));

  // 2) Build trading-day union within [fromDate, toDate]
  const allTradingDays = buildTradingDays(seriesBySymbol)
    .filter(d => d >= ensureDate(fromDate) && d <= ensureDate(toDate));
  if (allTradingDays.length < 2) {
    return emptyResult(strategyKey, universe, fromDate, toDate, initialCapital, riskPerTradePct, t0,
      `Insufficient trading days (got ${allTradingDays.length}). Try a wider date range or verify Upstox token.`);
  }

  // 3) Build per-symbol "candles up to (inclusive) date" lookup
  //    Candles include pre-roll (so EMA/ATR have history) — we slice on the fly.
  const symDateIdx = {};
  for (const sym of Object.keys(seriesBySymbol)) {
    symDateIdx[sym] = new Map();
    seriesBySymbol[sym].forEach((c, i) => symDateIdx[sym].set(ensureDate(c.date).getTime(), i));
  }

  // 4) State
  let equity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let peakAt = allTradingDays[0];
  let maxDDDuration = 0;
  const equityCurve = [];
  const openPositions = {}; // by symbol
  const closedTrades = [];

  const byRegime = {};
  const byMonth = {};

  // 5) Day-by-day loop
  for (let d = 0; d < allTradingDays.length; d++) {
    const day = allTradingDays[d];
    const dayT = day.getTime();

    // Regime for this day (for filter + tagging)
    const niftyI = niftyDateIdx.has(dayT)
      ? niftyDateIdx.get(dayT)
      : findNearestIndex(niftySeries, day);
    const todayRegime = regimeAtIndex(niftySeries, niftyI);

    // 5a) Update open positions with today's high/low (check SL/target)
    for (const sym of Object.keys(openPositions)) {
      const pos = openPositions[sym];
      const i = symDateIdx[sym].get(dayT);
      if (i == null) continue;
      const bar = seriesBySymbol[sym][i];
      if (!bar) continue;

      let exitPrice = null;
      let exitReason = null;
      if (pos.side === 'BUY') {
        // Worst-case ordering: if gap-down below SL, exit at open; if
        // both SL + target hit intraday we pessimistically assume SL first.
        if (bar.low <= pos.stopLoss) { exitPrice = Math.min(pos.stopLoss, bar.open); exitReason = 'SL_HIT'; }
        else if (bar.high >= pos.target) { exitPrice = Math.max(pos.target, bar.open); exitReason = 'TARGET_HIT'; }
      } else {
        if (bar.high >= pos.stopLoss) { exitPrice = Math.max(pos.stopLoss, bar.open); exitReason = 'SL_HIT'; }
        else if (bar.low <= pos.target) { exitPrice = Math.min(pos.target, bar.open); exitReason = 'TARGET_HIT'; }
      }

      // Time-exit
      if (!exitReason) {
        const held = d - pos.entryDayIdx;
        if (held >= timeExitDays) { exitPrice = bar.close; exitReason = 'TIME_EXIT'; }
      }

      if (exitReason) {
        const trade = closePosition({ pos, exitPrice, exitReason, exitDate: day, segment, liquidityBand });
        equity += trade.netPnL;
        closedTrades.push(trade);
        delete openPositions[sym];
        // Aggregate
        aggregateByRegime(byRegime, pos.regimeAtEntry, trade);
        aggregateByMonth(byMonth, day, trade);
      }
    }

    // 5b) Generate new candidates for symbols we're not already holding
    if (!regimeFilter || todayRegime === regimeFilter) {
      for (const sym of symbols) {
        const symU = sym.toUpperCase();
        if (openPositions[symU]) continue;
        const i = symDateIdx[symU]?.get(dayT);
        if (i == null) continue;

        // Provide history up to and INCLUDING today to the strategy —
        // evaluate() sees a close that already happened. Entry is next day's open.
        const hist = seriesBySymbol[symU].slice(0, i + 1);
        if (hist.length < 30) continue;

        const lastBar = hist[hist.length - 1];
        const effAtr = atr(hist.slice(-50), 14) || null;

        let candidate = null;
        try {
          candidate = await strategy.evaluate({
            symbol: symU,
            candles: hist,
            lastPrice: lastBar.close,
            atr: effAtr,
            supports: [],
            resistances: [],
            regime: { regime: todayRegime, confidence: 0.5 },
          });
        } catch (err) {
          // individual eval errors must not kill the backtest
          candidate = null;
        }
        if (!candidate || !candidate.action) continue;

        // Simulate entry at NEXT day's open
        const nextDay = allTradingDays[d + 1];
        if (!nextDay) continue;
        const nextI = symDateIdx[symU].get(nextDay.getTime());
        if (nextI == null) continue;
        const nextBar = seriesBySymbol[symU][nextI];
        if (!nextBar) continue;

        const entrySide = candidate.action === 'SELL' ? 'SELL' : 'BUY';
        const slip = paperRealism.applySlippage({ side: entrySide, ltp: nextBar.open, liquidityBand });
        const entryFill = slip.fillPrice;

        const qty = positionSize({ equity, riskPerTradePct, entryPrice: entryFill, stopLoss: candidate.stopLoss });
        if (qty <= 0) continue;

        const entryCostsDoc = paperRealism.computeLegCosts({ segment, side: entrySide, qty, price: entryFill });

        openPositions[symU] = {
          symbol: symU,
          side: entrySide,
          qty,
          entryDate: nextDay,
          entryDayIdx: d + 1,
          entryPrice: entryFill,
          entryCosts: entryCostsDoc.total,
          stopLoss: candidate.stopLoss,
          target: candidate.target,
          regimeAtEntry: todayRegime,
        };
        // Charge entry costs immediately (reflects cash outflow)
        equity -= entryCostsDoc.total;
      }
    }

    // 5c) Record equity point (includes unrealized MTM of open positions)
    const mtm = markToMarket(openPositions, seriesBySymbol, symDateIdx, dayT);
    const totalEquity = equity + mtm;
    if (totalEquity > peakEquity) { peakEquity = totalEquity; peakAt = day; maxDDDuration = 0; }
    const dd = peakEquity > 0 ? ((peakEquity - totalEquity) / peakEquity) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (dd > 0) {
      const dur = daysBetween(peakAt, day);
      if (dur > maxDDDuration) maxDDDuration = dur;
    }
    equityCurve.push({ date: day, equity: Math.round(totalEquity), drawdown: parseFloat(dd.toFixed(3)) });

    if (typeof onProgress === 'function' && d % 10 === 0) {
      onProgress({ phase: 'simulating', done: d + 1, total: allTradingDays.length });
    }
  }

  // 6) Close any residual positions at end of period
  const lastDay = allTradingDays[allTradingDays.length - 1];
  for (const sym of Object.keys(openPositions)) {
    const pos = openPositions[sym];
    const i = symDateIdx[sym]?.get(lastDay.getTime());
    const bar = i != null ? seriesBySymbol[sym][i] : null;
    const exitPrice = bar?.close || pos.entryPrice;
    const trade = closePosition({
      pos, exitPrice, exitReason: 'END_OF_PERIOD', exitDate: lastDay, segment, liquidityBand,
    });
    equity += trade.netPnL;
    closedTrades.push(trade);
    aggregateByRegime(byRegime, pos.regimeAtEntry, trade);
    aggregateByMonth(byMonth, lastDay, trade);
  }

  // 7) Metrics
  const wins = closedTrades.filter(t => t.netPnL > 0).length;
  const losses = closedTrades.filter(t => t.netPnL <= 0).length;
  const totalTrades = closedTrades.length;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
  const returns = closedTrades.map(t => t.returnPct);
  const avgReturnPct = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const totalReturnPct = initialCapital > 0 ? ((equity - initialCapital) / initialCapital) * 100 : 0;

  // Sharpe & Sortino from daily equity-curve returns (annualized, rf=0)
  const dailyRets = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    const cur = equityCurve[i].equity;
    if (prev > 0) dailyRets.push((cur - prev) / prev);
  }
  const sharpe = annualizedSharpe(dailyRets);
  const sortino = annualizedSortino(dailyRets);

  const grossWin = closedTrades.filter(t => t.netPnL > 0).reduce((a, b) => a + b.netPnL, 0);
  const grossLoss = Math.abs(closedTrades.filter(t => t.netPnL <= 0).reduce((a, b) => a + b.netPnL, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 999 : 0);

  // Finalize byMonth as an array
  const byMonthArr = Object.keys(byMonth).sort().map(k => ({
    month: k,
    trades: byMonth[k].trades,
    wins: byMonth[k].wins,
    netPnL: Math.round(byMonth[k].netPnL),
    returnPct: +byMonth[k].avgReturnPct.toFixed(3),
  }));

  const runDurationMs = Date.now() - t0;

  return {
    strategyKey,
    universe: universe.map(s => s.toUpperCase()),
    period: { from: ensureDate(fromDate), to: ensureDate(toDate), days: allTradingDays.length },
    totalTrades,
    wins,
    losses,
    winRate: +winRate.toFixed(2),
    avgReturnPct: +avgReturnPct.toFixed(3),
    totalReturnPct: +totalReturnPct.toFixed(3),
    sharpe: +sharpe.toFixed(3),
    sortino: +sortino.toFixed(3),
    profitFactor: +profitFactor.toFixed(3),
    maxDrawdown: +maxDrawdown.toFixed(3),
    maxDDDuration,
    equityCurve: equityCurve.map(p => ({ date: p.date, equity: p.equity, drawdown: p.drawdown })),
    byRegime: finalizeByRegime(byRegime),
    byMonth: byMonthArr,
    trades: closedTrades.slice(-500), // cap memory
    config: { initialCapital, riskPerTradePct, regimeFilter: regimeFilter || null },
    finalEquity: Math.round(equity),
    runDurationMs,
  };
}

// ─── Async job wrapper ────────────────────────────────────────────────────

async function runBacktestAsync(config = {}) {
  const jobId = newJobId();
  const jobDoc = await BacktestJob.create({
    jobId,
    strategyKey: config.strategyKey || '',
    universe: (config.universe || []).map(s => s.toUpperCase()),
    period: {
      from: ensureDate(config.fromDate),
      to: ensureDate(config.toDate),
    },
    config: {
      initialCapital: config.initialCapital || 500000,
      riskPerTradePct: config.riskPerTradePct || 2,
      regimeFilter: config.regimeFilter || '',
    },
    status: 'running',
    progress: 0,
    startedAt: new Date(),
  });

  // Fire-and-forget worker
  setImmediate(async () => {
    try {
      const result = await runBacktest({
        ...config,
        onProgress: async (p) => {
          const progress = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
          await BacktestJob.updateOne({ jobId }, { $set: { progress } }).catch(() => {});
        },
      });
      await BacktestJob.updateOne({ jobId }, {
        $set: {
          status: 'success',
          progress: 100,
          result,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      await BacktestJob.updateOne({ jobId }, {
        $set: {
          status: 'failure',
          error: err.message || String(err),
          completedAt: new Date(),
        },
      }).catch(() => {});
    }
  });

  return { jobId, status: 'running', startedAt: jobDoc.startedAt };
}

async function getBacktestResults(jobId) {
  const doc = await BacktestJob.findOne({ jobId }).lean();
  if (!doc) return null;
  return doc;
}

async function listRecentJobs({ strategyKey, limit = 10 } = {}) {
  const q = {};
  if (strategyKey) q.strategyKey = strategyKey;
  return BacktestJob.find(q).sort({ createdAt: -1 }).limit(Math.min(limit, 50)).lean();
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function closePosition({ pos, exitPrice, exitReason, exitDate, segment, liquidityBand }) {
  const exitSide = pos.side === 'BUY' ? 'SELL' : 'BUY';
  const slip = paperRealism.applySlippage({ side: exitSide, ltp: exitPrice, liquidityBand });
  const exitFill = slip.fillPrice;
  const r = paperRealism.computeRealisticPnL({
    segment,
    entrySide: pos.side,
    qty: pos.qty,
    entryFillPrice: pos.entryPrice,
    exitFillPrice: exitFill,
  });
  const returnPct = (pos.entryPrice * pos.qty) > 0
    ? (r.netPnL / (pos.entryPrice * pos.qty)) * 100
    : 0;
  return {
    symbol: pos.symbol,
    entryDate: pos.entryDate,
    entryPrice: pos.entryPrice,
    exitDate,
    exitPrice: exitFill,
    exitReason,
    side: pos.side,
    qty: pos.qty,
    stopLoss: pos.stopLoss,
    target: pos.target,
    grossPnL: r.grossPnL,
    netPnL: r.netPnL - pos.entryCosts, // already-charged entry costs -> final net
    returnPct: +returnPct.toFixed(3),
    regimeAtEntry: pos.regimeAtEntry || 'unknown',
  };
}

function markToMarket(openPositions, seriesBySymbol, symDateIdx, dayT) {
  let mtm = 0;
  for (const sym of Object.keys(openPositions)) {
    const pos = openPositions[sym];
    const i = symDateIdx[sym]?.get(dayT);
    const bar = i != null ? seriesBySymbol[sym][i] : null;
    if (!bar) continue;
    const dirSign = pos.side === 'BUY' ? 1 : -1;
    mtm += dirSign * (bar.close - pos.entryPrice) * pos.qty;
    mtm += pos.entryPrice * pos.qty; // add notional back (since we subtracted at entry cost time)
    mtm -= pos.entryPrice * pos.qty; // net zero — we track realized-only in `equity`
  }
  return mtm;
}

function aggregateByRegime(agg, regime, trade) {
  const key = regime || 'unknown';
  if (!agg[key]) agg[key] = { trades: 0, wins: 0, losses: 0, netPnL: 0, returnPctSum: 0 };
  agg[key].trades += 1;
  agg[key].wins += trade.netPnL > 0 ? 1 : 0;
  agg[key].losses += trade.netPnL <= 0 ? 1 : 0;
  agg[key].netPnL += trade.netPnL;
  agg[key].returnPctSum += trade.returnPct;
}
function finalizeByRegime(agg) {
  const out = {};
  for (const k of Object.keys(agg)) {
    const a = agg[k];
    out[k] = {
      trades: a.trades,
      wins: a.wins,
      losses: a.losses,
      winRate: a.trades ? +(a.wins / a.trades * 100).toFixed(2) : 0,
      netPnL: Math.round(a.netPnL),
      avgReturnPct: a.trades ? +(a.returnPctSum / a.trades).toFixed(3) : 0,
    };
  }
  return out;
}

function aggregateByMonth(agg, date, trade) {
  const d = ensureDate(date);
  const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (!agg[k]) agg[k] = { trades: 0, wins: 0, netPnL: 0, avgReturnPct: 0, _sum: 0 };
  agg[k].trades += 1;
  agg[k].wins += trade.netPnL > 0 ? 1 : 0;
  agg[k].netPnL += trade.netPnL;
  agg[k]._sum += trade.returnPct;
  agg[k].avgReturnPct = agg[k]._sum / agg[k].trades;
}

function annualizedSharpe(rets) {
  if (!rets.length) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  const sd = Math.sqrt(variance);
  if (!sd) return 0;
  return (mean / sd) * Math.sqrt(252);
}
function annualizedSortino(rets) {
  if (!rets.length) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const downs = rets.filter(r => r < 0);
  if (!downs.length) return mean > 0 ? 999 : 0;
  const dv = downs.reduce((a, b) => a + b * b, 0) / downs.length;
  const dd = Math.sqrt(dv);
  if (!dd) return 0;
  return (mean / dd) * Math.sqrt(252);
}

function findNearestIndex(series, date) {
  // Linear scan backwards (series is small enough).
  const t = ensureDate(date).getTime();
  let best = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].date.getTime() <= t) best = i;
    else break;
  }
  return best;
}

function emptyResult(strategyKey, universe, fromDate, toDate, initialCapital, riskPerTradePct, t0, note = '') {
  return {
    strategyKey,
    universe: (universe || []).map(s => s.toUpperCase()),
    period: { from: ensureDate(fromDate), to: ensureDate(toDate), days: 0 },
    totalTrades: 0, wins: 0, losses: 0, winRate: 0,
    avgReturnPct: 0, totalReturnPct: 0, sharpe: 0, sortino: 0,
    profitFactor: 0, maxDrawdown: 0, maxDDDuration: 0,
    equityCurve: [], byRegime: {}, byMonth: [], trades: [],
    config: { initialCapital, riskPerTradePct, regimeFilter: null },
    finalEquity: initialCapital,
    runDurationMs: Date.now() - t0,
    note,
  };
}

module.exports = {
  runBacktest,
  runBacktestAsync,
  getBacktestResults,
  listRecentJobs,
  // Exported for tests
  _loadHistorical: loadHistorical,
  _regimeAtIndex: regimeAtIndex,
};
