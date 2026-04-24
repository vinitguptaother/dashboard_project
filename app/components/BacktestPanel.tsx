'use client';

/**
 * BacktestPanel — MASTER_PLAN §7 Phase 5.
 *
 * Lets the user configure + run a backtest for any registered strategy.
 * Displays summary stats, equity curve (Recharts), trade log, and
 * breakdown by regime + month. Supports saving to history + side-by-side
 * strategy comparison.
 *
 * Backend routes used:
 *   GET  /api/strategies                    — list strategies
 *   POST /api/backtest/run                  — run (sync or async)
 *   GET  /api/backtest/jobs                 — recent jobs
 *   POST /api/backtest/compare              — side-by-side runs
 */

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Play,
  Loader2,
  BarChart3,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:5002';

// ─── Presets ─────────────────────────────────────────────────────────────
const NIFTY50_PRESET = [
  'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'INFY', 'TCS', 'LT', 'KOTAKBANK',
  'AXISBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'HINDUNILVR', 'BAJFINANCE',
  'MARUTI', 'ASIANPAINT', 'HCLTECH', 'WIPRO', 'NTPC', 'POWERGRID',
];

type RegimeFilter = '' | 'trending-bull' | 'trending-bear' | 'choppy' | 'breakout' | 'risk-off';

interface Strategy {
  key: string;
  name: string;
  botId: string;
  segment: string;
  regimeCompatibility: string[];
  description: string;
  backtestLink?: string;
}

interface BacktestTrade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  exitReason: string;
  side: string;
  qty: number;
  netPnL: number;
  returnPct: number;
  regimeAtEntry: string;
}

interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

interface BacktestResult {
  strategyKey: string;
  universe: string[];
  period: { from: string; to: string; days: number };
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgReturnPct: number;
  totalReturnPct: number;
  sharpe: number;
  sortino: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDDDuration: number;
  equityCurve: EquityPoint[];
  byRegime: Record<string, { trades: number; wins: number; winRate: number; netPnL: number; avgReturnPct: number }>;
  byMonth: { month: string; trades: number; wins: number; netPnL: number; returnPct: number }[];
  trades: BacktestTrade[];
  finalEquity: number;
  runDurationMs: number;
  note?: string;
}

interface Props {
  initialStrategyKey?: string;
}

export default function BacktestPanel({ initialStrategyKey }: Props): ReactElement {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategyKey, setStrategyKey] = useState<string>(initialStrategyKey || '');
  const [universeMode, setUniverseMode] = useState<'nifty50' | 'custom'>('nifty50');
  const [customUniverse, setCustomUniverse] = useState<string>('RELIANCE, HDFCBANK, INFY');
  const [fromDate, setFromDate] = useState<string>('2024-01-01');
  const [toDate, setToDate] = useState<string>('2024-06-30');
  const [initialCapital, setInitialCapital] = useState<number>(500000);
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(2);
  const [regimeFilter, setRegimeFilter] = useState<RegimeFilter>('');

  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tradeLogPage, setTradeLogPage] = useState<number>(0);
  const TRADES_PER_PAGE = 25;

  const [compareKey, setCompareKey] = useState<string>('');
  const [comparing, setComparing] = useState<boolean>(false);
  const [compareResult, setCompareResult] = useState<any>(null);

  // Load strategies
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/strategies`)
      .then(r => r.json())
      .then(j => {
        const list = (j?.data || []) as Strategy[];
        setStrategies(list);
        if (!strategyKey && list.length) setStrategyKey(list[0].key);
      })
      .catch(() => { /* silent */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const universe = useMemo(() => (
    universeMode === 'nifty50'
      ? NIFTY50_PRESET
      : customUniverse.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  ), [universeMode, customUniverse]);

  const runBacktest = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setTradeLogPage(0);
    try {
      const body = {
        strategyKey,
        universe,
        fromDate,
        toDate,
        initialCapital,
        riskPerTradePct,
        regimeFilter: regimeFilter || null,
        async: false,
      };
      const res = await fetch(`${BACKEND_URL}/api/backtest/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok || j?.status !== 'success') throw new Error(j?.message || 'Backtest failed');
      setResult(j.data);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  }, [strategyKey, universe, fromDate, toDate, initialCapital, riskPerTradePct, regimeFilter]);

  const runCompare = useCallback(async () => {
    if (!compareKey || compareKey === strategyKey) {
      setError('Pick a different strategy to compare against.');
      return;
    }
    setComparing(true);
    setError(null);
    try {
      const body = {
        strategies: [strategyKey, compareKey],
        universe,
        fromDate,
        toDate,
        initialCapital,
        riskPerTradePct,
        regimeFilter: regimeFilter || null,
      };
      const res = await fetch(`${BACKEND_URL}/api/backtest/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok || j?.status !== 'success') throw new Error(j?.message || 'Compare failed');
      setCompareResult(j.data);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setComparing(false);
    }
  }, [strategyKey, compareKey, universe, fromDate, toDate, initialCapital, riskPerTradePct, regimeFilter]);

  const selectedStrategy = strategies.find(s => s.key === strategyKey);

  // ─── Derived display data ──────────────────────────────────────────────
  const tradeLogSlice = result?.trades.slice(
    tradeLogPage * TRADES_PER_PAGE,
    (tradeLogPage + 1) * TRADES_PER_PAGE,
  ) || [];
  const tradeLogPages = result ? Math.max(1, Math.ceil(result.trades.length / TRADES_PER_PAGE)) : 0;

  const equityChartData = result?.equityCurve.map(p => ({
    date: new Date(p.date).toISOString().slice(0, 10),
    equity: p.equity,
    drawdown: p.drawdown,
  })) || [];

  const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" id="backtest">
      <div className="glass-effect rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900">Strategy Backtester</h2>
          <span className="ml-auto text-xs text-gray-500">Phase 5 · regime-aware · realism-on</span>
        </div>

        {/* Config grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Strategy</label>
            <select
              value={strategyKey}
              onChange={(e) => setStrategyKey(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {strategies.map(s => (
                <option key={s.key} value={s.key}>{s.name} — {s.botId}</option>
              ))}
            </select>
            {selectedStrategy && (
              <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{selectedStrategy.description}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Universe</label>
            <select
              value={universeMode}
              onChange={(e) => setUniverseMode(e.target.value as 'nifty50' | 'custom')}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="nifty50">NIFTY 50 (top 19)</option>
              <option value="custom">Custom comma-separated</option>
            </select>
            {universeMode === 'custom' && (
              <input
                type="text"
                value={customUniverse}
                onChange={(e) => setCustomUniverse(e.target.value)}
                placeholder="RELIANCE, HDFCBANK, INFY"
                className="w-full mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            )}
            <p className="text-[10px] text-gray-500 mt-0.5">{universe.length} symbols</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Regime filter (optional)</label>
            <select
              value={regimeFilter}
              onChange={(e) => setRegimeFilter(e.target.value as RegimeFilter)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">No filter</option>
              <option value="trending-bull">trending-bull</option>
              <option value="trending-bear">trending-bear</option>
              <option value="choppy">choppy</option>
              <option value="breakout">breakout</option>
              <option value="risk-off">risk-off</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">From date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">To date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Initial capital (₹)</label>
              <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Risk/trade (%)</label>
              <input type="number" step="0.5" min="0.5" max="10" value={riskPerTradePct} onChange={(e) => setRiskPerTradePct(Number(e.target.value))} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="flex flex-wrap gap-2 mt-4 items-center">
          <button
            type="button"
            disabled={running || !strategyKey}
            onClick={runBacktest}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Running…' : 'Run Backtest'}
          </button>

          {/* Compare block */}
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={compareKey}
              onChange={(e) => setCompareKey(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
            >
              <option value="">Compare against…</option>
              {strategies.filter(s => s.key !== strategyKey).map(s => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={comparing || !compareKey}
              onClick={runCompare}
              className="inline-flex items-center gap-1 bg-amber-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {comparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
              Compare
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result?.note && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {result.note}
          </div>
        )}
      </div>

      {/* Summary stats */}
      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Trades" value={result.totalTrades.toString()} />
            <StatCard label="Win rate" value={`${result.winRate.toFixed(1)}%`} tone={result.winRate >= 50 ? 'good' : result.winRate >= 35 ? 'neutral' : 'bad'} />
            <StatCard label="Avg return" value={fmtPct(result.avgReturnPct)} tone={result.avgReturnPct > 0 ? 'good' : 'bad'} />
            <StatCard label="Total return" value={fmtPct(result.totalReturnPct)} tone={result.totalReturnPct > 0 ? 'good' : 'bad'} />
            <StatCard label="Sharpe" value={result.sharpe.toFixed(2)} tone={result.sharpe >= 1 ? 'good' : result.sharpe >= 0 ? 'neutral' : 'bad'} />
            <StatCard label="Max DD" value={`${result.maxDrawdown.toFixed(2)}%`} tone={result.maxDrawdown < 10 ? 'good' : result.maxDrawdown < 20 ? 'neutral' : 'bad'} />
            <StatCard label="Sortino" value={result.sortino.toFixed(2)} />
            <StatCard label="Profit factor" value={result.profitFactor.toFixed(2)} tone={result.profitFactor >= 1.5 ? 'good' : result.profitFactor >= 1 ? 'neutral' : 'bad'} />
            <StatCard label="Max DD days" value={result.maxDDDuration.toString()} />
            <StatCard label="Final equity" value={fmtINR(result.finalEquity)} />
            <StatCard label="Period (trading days)" value={result.period.days.toString()} />
            <StatCard label="Run time" value={`${(result.runDurationMs / 1000).toFixed(1)}s`} />
          </div>

          {/* Equity curve */}
          {equityChartData.length > 1 && (
            <div className="glass-effect rounded-xl p-4 shadow-lg">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Equity curve
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => fmtINR(Number(v))} />
                    <ReferenceLine y={initialCapital} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: 'Start', position: 'insideTopLeft', fontSize: 10 }} />
                    <Line type="monotone" dataKey="equity" stroke="#4f46e5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* By regime + By month */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="glass-effect rounded-xl p-4 shadow-lg">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Breakdown by regime</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200">
                    <th className="text-left py-1">Regime</th>
                    <th className="text-right py-1">Trades</th>
                    <th className="text-right py-1">Win%</th>
                    <th className="text-right py-1">Avg %</th>
                    <th className="text-right py-1">Net ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(result.byRegime).length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-2">No regime buckets yet</td></tr>
                  )}
                  {Object.entries(result.byRegime).map(([regime, r]) => (
                    <tr key={regime} className="border-b border-gray-100">
                      <td className="py-1 font-medium">{regime}</td>
                      <td className="text-right">{r.trades}</td>
                      <td className={`text-right ${r.winRate >= 50 ? 'text-green-600' : 'text-amber-600'}`}>{r.winRate.toFixed(1)}%</td>
                      <td className={`text-right ${r.avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.avgReturnPct.toFixed(2)}%</td>
                      <td className="text-right font-mono">{fmtINR(r.netPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="glass-effect rounded-xl p-4 shadow-lg">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Breakdown by month</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200">
                    <th className="text-left py-1">Month</th>
                    <th className="text-right py-1">Trades</th>
                    <th className="text-right py-1">Wins</th>
                    <th className="text-right py-1">Avg %</th>
                    <th className="text-right py-1">Net ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {result.byMonth.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-2">No monthly data</td></tr>
                  )}
                  {result.byMonth.map(m => (
                    <tr key={m.month} className="border-b border-gray-100">
                      <td className="py-1">{m.month}</td>
                      <td className="text-right">{m.trades}</td>
                      <td className="text-right">{m.wins}</td>
                      <td className={`text-right ${m.returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{m.returnPct.toFixed(2)}%</td>
                      <td className="text-right font-mono">{fmtINR(m.netPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trade log */}
          <div className="glass-effect rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Trade log</h3>
              <div className="flex items-center gap-2 text-xs">
                <button
                  disabled={tradeLogPage === 0}
                  onClick={() => setTradeLogPage(p => Math.max(0, p - 1))}
                  className="p-1 rounded border border-gray-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span>Page {tradeLogPage + 1} / {tradeLogPages}</span>
                <button
                  disabled={tradeLogPage >= tradeLogPages - 1}
                  onClick={() => setTradeLogPage(p => Math.min(tradeLogPages - 1, p + 1))}
                  className="p-1 rounded border border-gray-300 disabled:opacity-40"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200">
                    <th className="text-left py-1">Symbol</th>
                    <th className="text-left py-1">Entry</th>
                    <th className="text-left py-1">Exit</th>
                    <th className="text-right py-1">Qty</th>
                    <th className="text-right py-1">Entry ₹</th>
                    <th className="text-right py-1">Exit ₹</th>
                    <th className="text-left py-1">Reason</th>
                    <th className="text-left py-1">Regime</th>
                    <th className="text-right py-1">Return %</th>
                    <th className="text-right py-1">Net ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeLogSlice.length === 0 && (
                    <tr><td colSpan={10} className="text-center text-gray-400 py-2">No trades in this run</td></tr>
                  )}
                  {tradeLogSlice.map((t, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-1 font-medium">{t.symbol}</td>
                      <td>{new Date(t.entryDate).toISOString().slice(0, 10)}</td>
                      <td>{new Date(t.exitDate).toISOString().slice(0, 10)}</td>
                      <td className="text-right">{t.qty}</td>
                      <td className="text-right font-mono">{t.entryPrice.toFixed(2)}</td>
                      <td className="text-right font-mono">{t.exitPrice.toFixed(2)}</td>
                      <td>{t.exitReason}</td>
                      <td className="text-[10px] text-gray-500">{t.regimeAtEntry}</td>
                      <td className={`text-right font-mono ${t.returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{t.returnPct.toFixed(2)}%</td>
                      <td className={`text-right font-mono ${t.netPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Math.round(t.netPnL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Comparison results */}
      {compareResult?.strategies && (
        <div className="glass-effect rounded-xl p-4 shadow-lg">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Side-by-side comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="text-left py-1">Strategy</th>
                  <th className="text-right py-1">Trades</th>
                  <th className="text-right py-1">Win%</th>
                  <th className="text-right py-1">Avg %</th>
                  <th className="text-right py-1">Total %</th>
                  <th className="text-right py-1">Sharpe</th>
                  <th className="text-right py-1">Max DD</th>
                  <th className="text-right py-1">Final ₹</th>
                </tr>
              </thead>
              <tbody>
                {compareResult.strategies.map((s: any) => (
                  <tr key={s.strategyKey} className="border-b border-gray-100">
                    <td className="py-1 font-medium">{s.strategyKey}</td>
                    {s.error ? (
                      <td colSpan={7} className="text-red-600">{s.error}</td>
                    ) : (
                      <>
                        <td className="text-right">{s.totalTrades}</td>
                        <td className="text-right">{s.winRate?.toFixed(1)}%</td>
                        <td className={`text-right ${s.avgReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.avgReturnPct?.toFixed(2)}%</td>
                        <td className={`text-right ${s.totalReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.totalReturnPct?.toFixed(2)}%</td>
                        <td className="text-right">{s.sharpe?.toFixed(2)}</td>
                        <td className="text-right">{s.maxDrawdown?.toFixed(2)}%</td>
                        <td className="text-right">{fmtINR(s.finalEquity || 0)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

interface StatCardProps { label: string; value: string; tone?: 'good' | 'neutral' | 'bad' }
function StatCard({ label, value, tone = 'neutral' }: StatCardProps): ReactElement {
  const color =
    tone === 'good' ? 'text-green-600' :
    tone === 'bad' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="glass-effect rounded-xl p-3 shadow text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}
