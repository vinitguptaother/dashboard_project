'use client';

/**
 * RiskEnginePanel — portfolio-level risk dashboard.
 *
 * BOT_BLUEPRINT item #10. Shows at a glance:
 *   • Current drawdown vs max (with lockout indicator)
 *   • Sector concentration bars (highlights any near/over cap)
 *   • Per-bot capital utilization (4-bot prep for Sprint 4)
 *   • Active risk alerts from any triggered check
 *
 * Polls /api/risk-engine/portfolio-state every 2 min.
 */

import { useEffect, useState } from 'react';
import { ShieldAlert, TrendingDown, Layers, Bot, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 2 * 60 * 1000;

interface DrawdownState {
  currentEquity: number;
  peakEquity: number;
  drawdownPct: number;
  maxPct: number;
  locked: boolean;
  realizedPnL: number;
  unrealizedPnL: number;
}
interface SectorEntry {
  sector: string;
  exposure: number;
  count: number;
  symbols: string[];
  pctOfCapital: number;
}
interface SectorExposure {
  bySector: SectorEntry[];
  totalExposed: number;
  capital: number;
  maxConcentrationPct: number;
  utilizedPct: number;
}
interface BotEntry {
  botId: string;
  allocated: number | null;
  deployed: number;
  utilizedPct: number | null;
  openPositions: number;
  maxPositions: number | null;
}
interface PortfolioState {
  capital: number;
  drawdown: DrawdownState;
  sector: SectorExposure;
  bots: { perBot: BotEntry[] };
  limits: {
    riskPerTradePct: number;
    maxPositionPct: number;
    maxSectorConcentrationPct: number;
    maxDrawdownPct: number;
    dailyLossLimitPct: number;
  };
}

function cr(n: number): string {
  const sign = n < 0 ? '−' : n > 0 ? '+' : '';
  const abs = Math.abs(n);
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000)   return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  return `${sign}₹${abs.toFixed(0)}`;
}

const BOT_LABEL: Record<string, string> = {
  manual: 'Manual',
  swing: 'Swing',
  longterm: 'Long-term',
  'options-sell': 'Options Sell',
  'options-buy': 'Options Buy',
};

export default function RiskEnginePanel() {
  const [data, setData] = useState<PortfolioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/risk-engine/portfolio-state`);
      const json = await res.json();
      if (json.status === 'success') setData(json.data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    try { await fetchData(); } finally { setRefreshing(false); }
  };

  const clearLockout = async () => {
    if (!window.confirm('Clear drawdown lockout? This lets new trades through again.')) return;
    await fetch(`${BACKEND_URL}/api/risk-engine/drawdown-lockout/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'UNLOCK' }),
    });
    await fetchData();
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  if (loading && !data) {
    return <div className="rounded-xl border-2 border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 p-4 text-xs text-gray-500 italic">Loading risk engine…</div>;
  }
  if (error && !data) {
    return <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 p-4 text-xs text-red-600 dark:text-red-400">{error}</div>;
  }
  if (!data) return null;

  const { drawdown, sector, bots, capital, limits } = data;
  const ddRatio = drawdown.maxPct > 0 ? Math.min(100, (drawdown.drawdownPct / drawdown.maxPct) * 100) : 0;
  const ddColor = drawdown.locked
    ? 'bg-red-500'
    : ddRatio >= 75 ? 'bg-orange-500'
    : ddRatio >= 50 ? 'bg-amber-500'
    : 'bg-green-500';

  return (
    <div className="rounded-xl border-2 border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            Risk Engine
          </h3>
          <span className="text-[11px] text-gray-500 font-mono-nums">
            capital {cr(capital)} · risk/trade {limits.riskPerTradePct}% · max sector {limits.maxSectorConcentrationPct}% · max DD {limits.maxDrawdownPct}%
          </span>
        </div>
        <button onClick={manualRefresh} disabled={refreshing}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Lockout banner */}
      {drawdown.locked && (
        <div className="mb-3 px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 text-[12px] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span><strong>Drawdown lockout active.</strong> No new trades allowed.</span>
          </span>
          <button onClick={clearLockout} className="px-2 py-0.5 text-[11px] font-semibold rounded bg-red-600 text-white hover:bg-red-700">
            Clear lockout
          </button>
        </div>
      )}

      {/* Drawdown + Equity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-gray-400">Drawdown</span>
          </div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div>
              <span className="text-[20px] font-bold font-mono-nums text-gray-900 dark:text-gray-100">{drawdown.drawdownPct.toFixed(2)}%</span>
              <span className="text-[11px] text-gray-500 ml-1">of max {drawdown.maxPct}%</span>
            </div>
            {drawdown.drawdownPct === 0 && drawdown.currentEquity >= 0 && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full ${ddColor} transition-all`} style={{ width: `${ddRatio}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400 font-mono-nums flex justify-between">
            <span>equity <strong className={drawdown.currentEquity >= 0 ? 'text-green-600' : 'text-red-600'}>{cr(drawdown.currentEquity)}</strong></span>
            <span>peak <strong>{cr(drawdown.peakEquity)}</strong></span>
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500 font-mono-nums flex gap-3">
            <span>realized {cr(drawdown.realizedPnL)}</span>
            <span>unrealized {cr(drawdown.unrealizedPnL)}</span>
          </div>
        </div>

        {/* Total utilization */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Layers className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-gray-400">Total exposure</span>
          </div>
          <div className="flex items-baseline justify-between mb-1.5">
            <div>
              <span className="text-[20px] font-bold font-mono-nums text-gray-900 dark:text-gray-100">{sector.utilizedPct.toFixed(1)}%</span>
              <span className="text-[11px] text-gray-500 ml-1">of capital</span>
            </div>
            <span className="text-[11px] text-gray-500 font-mono-nums">{cr(sector.totalExposed)}</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, sector.utilizedPct)}%` }} />
          </div>
          <div className="mt-1.5 text-[10px] text-gray-500">
            {sector.bySector.length} sector{sector.bySector.length !== 1 ? 's' : ''} · {bots.perBot.reduce((sum, b) => sum + b.openPositions, 0)} open position{bots.perBot.reduce((sum, b) => sum + b.openPositions, 0) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Sector concentration */}
      <div className="mb-3">
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
          Sector concentration (max {sector.maxConcentrationPct}% each)
        </div>
        {sector.bySector.length === 0 ? (
          <div className="text-[11px] text-gray-500 italic py-1">No open positions.</div>
        ) : (
          <div className="space-y-1">
            {sector.bySector.map((s) => {
              const pct = s.pctOfCapital;
              const over = pct > sector.maxConcentrationPct;
              const near = pct > sector.maxConcentrationPct * 0.8 && !over;
              const bar = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-indigo-400';
              return (
                <div key={s.sector} className="flex items-center gap-2 text-[11px]">
                  <div className="w-28 truncate text-gray-700 dark:text-gray-300 font-mono-nums" title={s.symbols.join(', ')}>{s.sector}</div>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                    <div className={`h-full ${bar} transition-all`} style={{ width: `${Math.min(100, (pct / sector.maxConcentrationPct) * 100)}%` }} />
                  </div>
                  <div className="w-16 text-right font-mono-nums text-gray-700 dark:text-gray-300">{pct.toFixed(1)}%</div>
                  <div className="w-12 text-right text-[10px] text-gray-500">{s.count} tr</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Per-bot capital */}
      <div>
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
          <Bot className="w-3 h-3" /> Per-bot capital (Sprint 4 preview)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {bots.perBot.filter(b => b.allocated != null).map((b) => {
            const util = b.utilizedPct || 0;
            const barColor = util >= 90 ? 'bg-red-500' : util >= 70 ? 'bg-amber-500' : 'bg-green-500';
            return (
              <div key={b.botId} className="rounded border border-gray-200 dark:border-gray-700 p-2">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{BOT_LABEL[b.botId] || b.botId}</span>
                  <span className="font-mono-nums text-gray-600 dark:text-gray-400">{b.openPositions}/{b.maxPositions} pos</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, util)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono-nums">
                  <span>{cr(b.deployed)} / {cr(b.allocated!)}</span>
                  <span>{util.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
        {bots.perBot.find(b => b.botId === 'manual' && b.openPositions > 0) && (
          <div className="mt-1.5 text-[10px] text-gray-500">
            Manual: {bots.perBot.find(b => b.botId === 'manual')?.openPositions} open, {cr(bots.perBot.find(b => b.botId === 'manual')?.deployed || 0)} deployed.
          </div>
        )}
      </div>
    </div>
  );
}
