'use client';

// app/components/DataHealthPanel.tsx
// Unified Data Health Panel — full tab. Shows which integrations are live,
// token expiries, demo-data flags, recent API calls, failed endpoints, and
// any symbol-price conflicts across tabs.

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  ShieldCheck,
  Zap,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

interface Integration {
  name: string;
  category: string;
  status: 'live' | 'degraded' | 'offline';
  details: string;
  tokenMask?: string;
  keyMask?: string;
  tokenExpiry?: string | null;
  hoursRemaining?: number | null;
  daysRemaining?: number | null;
  usingDemoData?: boolean;
  optional?: boolean;
  lastCheck: string;
}

interface Alert {
  level: 'error' | 'warning' | 'info';
  source: string;
  message: string;
}

interface FailedEndpoint {
  source: string;
  action: string;
  at: string | null;
}

interface Summary {
  overall: 'healthy' | 'degraded';
  integrations: Integration[];
  alerts: Alert[];
  freshness: {
    marketContextAgeSec: number | null;
    marketContextFresh: boolean;
    serverUptimeSec: number;
  };
  recentCalls: {
    total: number;
    failed: number;
    byProvider: Record<string, { success: number; failed: number }>;
  };
  failedEndpoints: FailedEndpoint[];
  generatedAt: string;
}

interface ConflictItem {
  symbol: string;
  sources: { source: string; price: number }[];
  maxDeviationPct: number;
  severity: 'low' | 'medium' | 'high';
}

function fmtUptime(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

function fmtAge(sec: number | null) {
  if (sec === null) return 'never';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function statusPill(status: 'live' | 'degraded' | 'offline') {
  switch (status) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-green-500/40 bg-green-500/10 text-green-500">
          <Wifi className="w-3 h-3" /> LIVE
        </span>
      );
    case 'degraded':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-500">
          <AlertTriangle className="w-3 h-3" /> DEGRADED
        </span>
      );
    case 'offline':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-500/40 bg-red-500/10 text-red-500">
          <WifiOff className="w-3 h-3" /> OFFLINE
        </span>
      );
  }
}

function categoryIcon(cat: string) {
  switch (cat) {
    case 'database':
      return <Database className="w-4 h-4 text-indigo-400" />;
    case 'broker':
      return <Zap className="w-4 h-4 text-blue-400" />;
    case 'ai':
      return <ShieldCheck className="w-4 h-4 text-purple-400" />;
    case 'market-data':
      return <Activity className="w-4 h-4 text-cyan-400" />;
    default:
      return <Activity className="w-4 h-4 text-gray-400" />;
  }
}

export default function DataHealthPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [conflictsChecked, setConflictsChecked] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/data-health/summary`);
      const json = await res.json();
      if (json.status === 'success') {
        setSummary(json.data);
        setLastRefresh(new Date());
      } else {
        setError(json.message || 'Failed to load data health');
      }
    } catch (e: any) {
      setError(e?.message || 'Network error — is the backend running on port 5002?');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConflicts = useCallback(async () => {
    setLoadingConflicts(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/data-health/conflicts`);
      const json = await res.json();
      if (json.status === 'success') {
        setConflicts(json.data.conflicts || []);
        setConflictsChecked(json.data.checked || 0);
      }
    } catch {
      /* non-critical */
    } finally {
      setLoadingConflicts(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const id = setInterval(fetchSummary, 60 * 1000); // auto-refresh each minute
    return () => clearInterval(id);
  }, [fetchSummary]);

  const overallBadge = () => {
    if (!summary) return null;
    if (summary.overall === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-green-500/40 bg-green-500/10 text-green-500">
          <CheckCircle2 className="w-3.5 h-3.5" /> System Healthy
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-500">
        <AlertTriangle className="w-3.5 h-3.5" /> Attention Needed
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Data Health</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Live status of every broker / API / data source the dashboard depends on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overallBadge()}
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* Alerts strip */}
          {summary.alerts.length > 0 && (
            <div className="space-y-2">
              {summary.alerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
                    a.level === 'error'
                      ? 'border-red-500/40 bg-red-500/5 text-red-400'
                      : a.level === 'warning'
                      ? 'border-amber-500/40 bg-amber-500/5 text-amber-400'
                      : 'border-blue-500/40 bg-blue-500/5 text-blue-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold">{a.source}:</span> {a.message}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Integrations grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.integrations.map((ig) => (
              <div
                key={ig.name}
                className={`p-3 rounded-lg border bg-white/40 dark:bg-gray-800/40 ${
                  ig.status === 'offline' && !ig.optional
                    ? 'border-red-500/30'
                    : ig.status === 'degraded'
                    ? 'border-amber-500/30'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {categoryIcon(ig.category)}
                    <div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {ig.name}
                        {ig.optional && (
                          <span className="ml-1 text-[9px] font-normal text-gray-400">(optional)</span>
                        )}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">
                        {ig.category}
                      </div>
                    </div>
                  </div>
                  {statusPill(ig.status)}
                </div>

                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">{ig.details}</div>

                {ig.usingDemoData && (
                  <div className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                    USING DEMO DATA
                  </div>
                )}

                {(ig.tokenMask || ig.keyMask) && (
                  <div className="mt-2 text-[10px] text-gray-400 font-mono">
                    {ig.tokenMask && <>Token: <span className="text-gray-500">{ig.tokenMask}</span></>}
                    {ig.keyMask && <>Key: <span className="text-gray-500">{ig.keyMask}</span></>}
                  </div>
                )}

                {ig.daysRemaining !== null && ig.daysRemaining !== undefined && (
                  <div className="mt-1.5 text-[10px] text-gray-500">
                    Expires in <span className={ig.daysRemaining < 7 ? 'text-red-400' : ig.daysRemaining < 30 ? 'text-amber-400' : 'text-green-400'}>
                      {ig.daysRemaining}d {(ig.hoursRemaining ?? 0) % 24}h
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Freshness + API calls row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Clock className="w-3.5 h-3.5" /> Freshness
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Market context</span>
                  <span className={summary.freshness.marketContextFresh ? 'text-green-400' : 'text-amber-400'}>
                    {fmtAge(summary.freshness.marketContextAgeSec)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Server uptime</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {fmtUptime(summary.freshness.serverUptimeSec)}
                  </span>
                </div>
                {lastRefresh && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Panel refreshed</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {lastRefresh.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Activity className="w-3.5 h-3.5" /> API Calls (last hour)
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="text-gray-700 dark:text-gray-300 font-mono">
                    {summary.recentCalls.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Failed</span>
                  <span className={summary.recentCalls.failed > 0 ? 'text-red-400 font-mono' : 'text-green-400 font-mono'}>
                    {summary.recentCalls.failed}
                  </span>
                </div>
                {Object.entries(summary.recentCalls.byProvider).slice(0, 3).map(([p, v]) => (
                  <div key={p} className="flex justify-between text-[11px]">
                    <span className="text-gray-400 truncate pr-2">{p}</span>
                    <span className="text-gray-600 dark:text-gray-400 font-mono">
                      {v.success}✓ / {v.failed}✗
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Failed Endpoints (last 10m)
              </div>
              {summary.failedEndpoints.length === 0 ? (
                <div className="text-xs text-gray-400 italic">None — all endpoints responsive</div>
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {summary.failedEndpoints.map((f, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="text-red-400 truncate font-mono">
                        {f.source}:{f.action}
                      </span>
                      <span className="text-gray-500 shrink-0 text-[10px]">
                        {f.at ? new Date(f.at).toLocaleTimeString() : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Symbol conflict panel */}
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                <AlertTriangle className="w-3.5 h-3.5" /> Symbol Price Conflicts
              </div>
              <button
                onClick={fetchConflicts}
                disabled={loadingConflicts}
                className="text-[11px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {loadingConflicts ? 'Checking…' : 'Run check'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mb-2">
              Compares Upstox vs Yahoo prices for active trade symbols. Flags any &gt;1% discrepancy.
            </p>
            {conflictsChecked === 0 ? (
              <div className="text-xs text-gray-400 italic">Click &quot;Run check&quot; to compare prices across data sources.</div>
            ) : conflicts.length === 0 ? (
              <div className="text-xs text-green-400">
                ✓ Checked {conflictsChecked} symbols — no significant conflicts found.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {conflicts.map((c) => (
                  <li
                    key={c.symbol}
                    className={`flex items-center justify-between p-2 rounded border text-xs ${
                      c.severity === 'high'
                        ? 'border-red-500/40 bg-red-500/5'
                        : c.severity === 'medium'
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-gray-300 bg-gray-50 dark:bg-gray-800/30'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{c.symbol}</span>
                      <span className="ml-2 text-gray-500">
                        {c.sources.map((s) => `${s.source}: ₹${s.price}`).join('  •  ')}
                      </span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      c.severity === 'high' ? 'bg-red-500/20 text-red-400'
                      : c.severity === 'medium' ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-gray-200 text-gray-600'
                    }`}>
                      Δ {c.maxDeviationPct}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
