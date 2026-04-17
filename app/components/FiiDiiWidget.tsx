'use client';

/**
 * FiiDiiWidget — daily FII/DII institutional flow display.
 *
 * BOT_BLUEPRINT item #26. The single biggest Indian directional signal.
 * Polls /api/fii-dii/latest + /history every 5 min.
 */

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, RefreshCw, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface Snapshot {
  date: string;
  fii: { buyValue: number; sellValue: number; netValue: number };
  dii: { buyValue: number; sellValue: number; netValue: number };
  source: string;
  fetchedAt: string;
}

function formatCrore(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : n > 0 ? '+' : '';
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(2)}k cr`;
  return `${sign}₹${abs.toFixed(0)} cr`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export default function FiiDiiWidget() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [latestRes, histRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/fii-dii/latest`),
        fetch(`${BACKEND_URL}/api/fii-dii/history?days=10`),
      ]);
      const latestJson = await latestRes.json();
      const histJson = await histRes.json();
      if (latestJson.status === 'success') setLatest(latestJson.data);
      if (histJson.status === 'success') setHistory(histJson.data || []);
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
      await fetch(`${BACKEND_URL}/api/fii-dii/refresh`, { method: 'POST' });
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

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">FII / DII Flows</h3>
          {latest?.date && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {formatDate(latest.date)}
            </span>
          )}
        </div>
        <button
          onClick={manualRefresh}
          disabled={refreshing}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Refresh now"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 italic">Loading FII/DII…</div>
      ) : error ? (
        <div className="text-xs text-red-500">{error}</div>
      ) : !latest ? (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          No data yet. Cron runs 6:30 PM IST Mon-Fri, or click refresh.
        </div>
      ) : (
        <>
          {/* Today snapshot */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <InstitutionCard label="FII (Foreign)" net={latest.fii.netValue} buy={latest.fii.buyValue} sell={latest.fii.sellValue} />
            <InstitutionCard label="DII (Domestic)" net={latest.dii.netValue} buy={latest.dii.buyValue} sell={latest.dii.sellValue} />
          </div>

          {/* 10-day sparkline table */}
          {history.length > 1 && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Last 10 sessions</div>
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5 text-[11px] font-mono-nums">
                <span className="text-gray-500 dark:text-gray-400">Date</span>
                <span className="text-gray-500 dark:text-gray-400 text-right">FII net</span>
                <span className="text-gray-500 dark:text-gray-400 text-right">DII net</span>
                {history.slice(0, 10).map(row => (
                  <RowFragment key={row.date} row={row} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 text-right italic">
            Source: {latest.source} · updated {new Date(latest.fetchedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </>
      )}
    </div>
  );
}

function InstitutionCard({ label, net, buy, sell }: { label: string; net: number; buy: number; sell: number }) {
  const isBuy = net >= 0;
  return (
    <div className={`rounded-lg border p-2.5 ${isBuy ? 'border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/20' : 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
        {isBuy ? <ArrowUpRight className="w-3.5 h-3.5 text-green-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
      </div>
      <div className={`text-base font-bold font-mono-nums mt-0.5 ${isBuy ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
        {formatCrore(net)}
      </div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
        buy {formatCrore(buy)} · sell {formatCrore(sell)}
      </div>
    </div>
  );
}

function RowFragment({ row }: { row: Snapshot }) {
  const fii = row.fii.netValue;
  const dii = row.dii.netValue;
  return (
    <>
      <span className="text-gray-600 dark:text-gray-300">{formatDate(row.date)}</span>
      <span className={`text-right ${fii >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {formatCrore(fii)}
      </span>
      <span className={`text-right ${dii >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {formatCrore(dii)}
      </span>
    </>
  );
}
