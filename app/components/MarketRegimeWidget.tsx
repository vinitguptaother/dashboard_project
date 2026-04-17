'use client';

/**
 * MarketRegimeWidget — compact display of current classified market regime.
 *
 * BOT_BLUEPRINT item #30. Color-coded badge + reason + key inputs.
 * Polls /api/regime/current every 5 min.
 */

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, ShieldAlert, HelpCircle, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface Regime {
  regime: 'trending-bull' | 'trending-bear' | 'choppy' | 'breakout' | 'risk-off' | 'unknown';
  confidence: number;
  reason: string;
  inputs: {
    niftyLevel: number;
    nifty50EMA: number;
    nifty200EMA: number;
    niftyVs50PctTrend: number;
    vix: number;
    vixDelta: number;
    fiiNetCr: number;
    diiNetCr: number;
  };
  computedAt: string;
}

const REGIME_META: Record<Regime['regime'], { label: string; icon: any; color: string; bg: string; description: string }> = {
  'trending-bull': { label: 'Trending Bull', icon: TrendingUp, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', description: 'NIFTY in uptrend, FIIs buying. Favor momentum longs.' },
  'trending-bear': { label: 'Trending Bear', icon: TrendingDown, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', description: 'NIFTY in downtrend, FIIs selling. Favor shorts or cash.' },
  'choppy': { label: 'Choppy', icon: Activity, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700', description: 'No clear direction. Avoid breakouts; favor range / premium-sell.' },
  'breakout': { label: 'Breakout', icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', description: 'Fresh crossover with low VIX. Directional entries favored.' },
  'risk-off': { label: 'Risk-Off', icon: ShieldAlert, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', description: 'High VIX, elevated fear. Reduce size; avoid new entries.' },
  'unknown': { label: 'Unknown', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700', description: 'Insufficient data.' },
};

function formatCr(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : n > 0 ? '+' : '';
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k cr`;
  return `${sign}₹${abs.toFixed(0)} cr`;
}

export default function MarketRegimeWidget() {
  const [data, setData] = useState<Regime | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/regime/current`);
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
    try {
      await fetch(`${BACKEND_URL}/api/regime/refresh`, { method: 'POST' });
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  const meta = data ? REGIME_META[data.regime] : REGIME_META.unknown;
  const Icon = meta.icon;

  return (
    <div className={`rounded-xl border-2 p-4 ${meta.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-6 h-6 shrink-0 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className={`text-sm font-bold uppercase tracking-wider ${meta.color}`}>
              Market Regime · {meta.label}
            </div>
            <button
              onClick={manualRefresh}
              disabled={refreshing}
              className="p-1 rounded hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors"
              title="Recompute now"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{meta.description}</p>

          {loading && !data && (
            <div className="text-xs text-gray-500 italic">Loading regime…</div>
          )}

          {error && !data && (
            <div className="text-xs text-red-500">{error}</div>
          )}

          {data && (
            <>
              <div className="text-[11px] text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-black/20 rounded-md px-2 py-1.5 mb-2">
                <strong>Why:</strong> {data.reason}
              </div>

              {/* Key inputs inline */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] font-mono-nums text-gray-600 dark:text-gray-300">
                <div>NIFTY <strong className="text-gray-800 dark:text-gray-200">{data.inputs.niftyLevel.toFixed(0)}</strong></div>
                <div>50EMA <strong className="text-gray-800 dark:text-gray-200">{data.inputs.nifty50EMA.toFixed(0)}</strong></div>
                <div>VIX <strong className="text-gray-800 dark:text-gray-200">{data.inputs.vix.toFixed(1)}</strong>{data.inputs.vixDelta !== 0 && <span className={data.inputs.vixDelta >= 0 ? 'text-red-500 ml-0.5' : 'text-green-500 ml-0.5'}>{data.inputs.vixDelta >= 0 ? '+' : ''}{data.inputs.vixDelta.toFixed(1)}%</span>}</div>
                <div>FII <strong className={data.inputs.fiiNetCr >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCr(data.inputs.fiiNetCr)}</strong></div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                <span>Confidence: {(data.confidence * 100).toFixed(0)}%</span>
                <span>Computed {new Date(data.computedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
