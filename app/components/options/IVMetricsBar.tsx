'use client';

import React, { useEffect, useState } from 'react';
import { Info, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { BACKEND_URL } from './constants';

interface IVMetrics {
  underlying: string;
  currentIV: number;
  atmStrike: number;
  ivRank: number;
  ivPercentile: number;
  high52w: number;
  low52w: number;
  avgIV: number;
  historyDays: number;
  isSufficient: boolean;
  date: string;
}

interface Props {
  underlying: string;
  spotPrice: number;
}

/**
 * Compact bar showing current ATM IV, IV Rank, and IV Percentile.
 * Pulls from /api/options/iv-metrics/:underlying which also triggers today's
 * snapshot capture if missing (idempotent).
 *
 * Color coding on IV Rank:
 *   < 30 = green  (IV is cheap — favor buying options / long vol)
 *   > 70 = red    (IV is rich  — favor selling options / short vol)
 *   else  = gray (IV is neutral)
 */
export default function IVMetricsBar({ underlying, spotPrice }: Props) {
  const [metrics, setMetrics] = useState<IVMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!underlying) return;
    let cancelled = false;

    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = spotPrice ? `?spotPrice=${spotPrice}` : '';
        const res = await fetch(`${BACKEND_URL}/api/options/iv-metrics/${underlying}${qs}`);
        const json = await res.json();
        if (!cancelled) {
          if (json.status === 'success') setMetrics(json.data);
          else setError(json.message || 'Failed to load IV metrics');
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMetrics();
    return () => { cancelled = true; };
  }, [underlying, spotPrice]);

  if (loading && !metrics) {
    return (
      <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 flex items-center gap-2">
        <Activity className="w-3 h-3 text-gray-400 animate-pulse" />
        <span className="text-[11px] text-gray-400">Loading IV metrics…</span>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
        <span className="text-[11px] text-gray-400">{error || 'IV metrics unavailable'}</span>
      </div>
    );
  }

  const ivPct = (metrics.currentIV * 100).toFixed(1);
  const avgPct = (metrics.avgIV * 100).toFixed(1);
  const highPct = (metrics.high52w * 100).toFixed(1);
  const lowPct = (metrics.low52w * 100).toFixed(1);

  const ivrColor = metrics.isSufficient
    ? metrics.ivRank < 30 ? 'text-green-600 dark:text-green-400'
    : metrics.ivRank > 70 ? 'text-red-600 dark:text-red-400'
    : 'text-gray-600 dark:text-gray-400'
    : 'text-gray-400 dark:text-gray-500';

  const ivpColor = metrics.isSufficient
    ? metrics.ivPercentile < 30 ? 'text-green-600 dark:text-green-400'
    : metrics.ivPercentile > 70 ? 'text-red-600 dark:text-red-400'
    : 'text-gray-600 dark:text-gray-400'
    : 'text-gray-400 dark:text-gray-500';

  // Interpretive label for traders
  const stance = metrics.isSufficient
    ? metrics.ivRank < 30 ? 'IV Cheap — favor buying'
    : metrics.ivRank > 70 ? 'IV Rich — favor selling'
    : 'IV Neutral'
    : null;

  const tooltipText = metrics.isSufficient
    ? `IV Rank: where current IV sits in its 52-week range (${lowPct}% – ${highPct}%, avg ${avgPct}%)\n`
      + `IV Percentile: % of past ${metrics.historyDays} days with IV below current value`
    : `Building IV history: ${metrics.historyDays}/30 days. IV Rank and Percentile become meaningful after 30 days of data. Snapshot runs daily at 3:25 PM IST.`;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/20 text-[11px]">
      {/* IV */}
      <div className="flex items-center gap-1">
        <span className="text-gray-400 dark:text-gray-500">IV</span>
        <span className="font-mono-nums font-bold text-gray-900 dark:text-gray-100">{ivPct}%</span>
      </div>

      {/* IVR */}
      <div className="flex items-center gap-1">
        <span className="text-gray-400 dark:text-gray-500">IVR</span>
        <span className={`font-mono-nums font-bold ${ivrColor}`}>
          {metrics.isSufficient ? metrics.ivRank.toFixed(0) : '—'}
        </span>
      </div>

      {/* IVP */}
      <div className="flex items-center gap-1">
        <span className="text-gray-400 dark:text-gray-500">IVP</span>
        <span className={`font-mono-nums font-bold ${ivpColor}`}>
          {metrics.isSufficient ? metrics.ivPercentile.toFixed(0) : '—'}
        </span>
      </div>

      {/* Stance or building-history pill */}
      {stance && (
        <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          metrics.ivRank < 30 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : metrics.ivRank > 70 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}>
          {stance}
        </span>
      )}

      {!metrics.isSufficient && (
        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
          Building history {metrics.historyDays}/30
        </span>
      )}

      {/* Info tooltip */}
      <div className="ml-auto group relative">
        <Info className="w-3 h-3 text-gray-400 cursor-help" />
        <div className="absolute right-0 top-5 hidden group-hover:block z-50 w-72 p-2.5 bg-gray-900 text-gray-100 rounded-lg shadow-xl border border-gray-700 text-[10px] leading-relaxed whitespace-pre-line">
          {tooltipText}
        </div>
      </div>
    </div>
  );
}
