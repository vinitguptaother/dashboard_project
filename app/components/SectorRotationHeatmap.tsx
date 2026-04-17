'use client';

/**
 * SectorRotationHeatmap — shows 12 NSE sector indices color-coded by
 * relative strength vs NIFTY across 1D / 1W / 1M horizons.
 *
 * BOT_BLUEPRINT item #28. Swing/positional traders use this to:
 *   • Enter stocks in leading sectors (tailwind).
 *   • Exit stocks in lagging sectors (headwind).
 *
 * Polls /api/sector-rotation/current every 5 min.
 */

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Flame, Snowflake, BarChart3 } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface SectorSnapshot {
  name: string;
  instrumentKey: string;
  ltp: number;
  dayChangePct: number;
  weekChangePct: number;
  monthChangePct: number;
  relStrengthVsNifty1D: number;
  relStrengthVsNifty1W: number;
  relStrengthVsNifty1M: number;
}

interface SectorData {
  niftyLevel: number;
  niftyDayChangePct: number;
  niftyWeekChangePct: number;
  niftyMonthChangePct: number;
  sectors: SectorSnapshot[];
  leaders: string[];
  laggards: string[];
  computedAt: string;
}

type Horizon = '1D' | '1W' | '1M';

function colorForRS(rs: number): string {
  // Relative strength (sector − NIFTY). Color scale: deep green ↔ deep red.
  if (rs >= 3)   return 'bg-green-600/90 text-white';
  if (rs >= 1.5) return 'bg-green-500/80 text-white';
  if (rs >= 0.3) return 'bg-green-400/70 text-gray-900';
  if (rs > -0.3) return 'bg-gray-300/80 text-gray-800 dark:bg-gray-600/50 dark:text-gray-200';
  if (rs > -1.5) return 'bg-red-400/70 text-gray-900';
  if (rs > -3)   return 'bg-red-500/80 text-white';
  return 'bg-red-600/90 text-white';
}

function shortName(n: string): string {
  return n.replace(/^NIFTY\s+/, '').replace(/\s+SERVICES$/i, ' SVC');
}

export default function SectorRotationHeatmap() {
  const [data, setData] = useState<SectorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<Horizon>('1W');

  const fetchData = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sector-rotation/current`);
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
      await fetch(`${BACKEND_URL}/api/sector-rotation/refresh`, { method: 'POST' });
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

  const sorted = useMemo(() => {
    if (!data?.sectors) return [];
    const key: keyof SectorSnapshot = horizon === '1D'
      ? 'relStrengthVsNifty1D'
      : horizon === '1W'
      ? 'relStrengthVsNifty1W'
      : 'relStrengthVsNifty1M';
    return [...data.sectors].sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [data, horizon]);

  const niftyRef = useMemo(() => {
    if (!data) return 0;
    if (horizon === '1D') return data.niftyDayChangePct;
    if (horizon === '1W') return data.niftyWeekChangePct;
    return data.niftyMonthChangePct;
  }, [data, horizon]);

  return (
    <div className="rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            Sector Rotation
          </h3>
          {data && (
            <span className="text-[11px] font-mono-nums text-gray-500">
              NIFTY {data.niftyLevel.toFixed(0)} · {niftyRef >= 0 ? '+' : ''}{niftyRef.toFixed(2)}% {horizon}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Horizon toggle */}
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5 text-[11px]">
            {(['1D', '1W', '1M'] as Horizon[]).map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  horizon === h
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Recompute now"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="text-xs text-gray-500 italic py-8 text-center">Loading sector data…</div>
      )}
      {error && !data && (
        <div className="text-xs text-red-500 py-4">{error}</div>
      )}
      {!loading && !error && !data && (
        <div className="text-xs text-gray-500 py-4">
          No snapshot yet. Click refresh to fetch.
        </div>
      )}

      {data && (
        <>
          {/* Leaders / Laggards bar */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-green-700 dark:text-green-400 mb-0.5">
                <Flame className="w-3 h-3" /> Leaders (1W)
              </div>
              <div className="text-[11px] text-green-800 dark:text-green-300 font-mono-nums">
                {data.leaders.map(shortName).join(' · ') || '—'}
              </div>
            </div>
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-red-700 dark:text-red-400 mb-0.5">
                <Snowflake className="w-3 h-3" /> Laggards (1W)
              </div>
              <div className="text-[11px] text-red-800 dark:text-red-300 font-mono-nums">
                {data.laggards.map(shortName).join(' · ') || '—'}
              </div>
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {sorted.map((s) => {
              const rs = horizon === '1D' ? s.relStrengthVsNifty1D : horizon === '1W' ? s.relStrengthVsNifty1W : s.relStrengthVsNifty1M;
              const abs = horizon === '1D' ? s.dayChangePct : horizon === '1W' ? s.weekChangePct : s.monthChangePct;
              return (
                <div
                  key={s.instrumentKey}
                  className={`rounded-md px-2 py-1.5 ${colorForRS(rs)} transition-all`}
                  title={`${s.name} · ${horizon} abs ${abs >= 0 ? '+' : ''}${abs.toFixed(2)}% · RS vs NIFTY ${rs >= 0 ? '+' : ''}${rs.toFixed(2)}%`}
                >
                  <div className="text-[11px] font-bold tracking-tight leading-tight">{shortName(s.name)}</div>
                  <div className="text-[10px] font-mono-nums opacity-90 leading-tight">
                    {abs >= 0 ? '+' : ''}{abs.toFixed(2)}%
                    <span className="opacity-70 ml-1">
                      (RS {rs >= 0 ? '+' : ''}{rs.toFixed(2)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
            <span>
              Color = relative strength vs NIFTY ({horizon}). Green = outperforming · Red = lagging.
            </span>
            <span>
              Computed {new Date(data.computedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
