'use client';

/**
 * LargeDealsWidget — NSE bulk / block / short deals for the last N days.
 *
 * BOT_BLUEPRINT item #29. Smart-money signal:
 *   • Bulk deal  = single client's cumulative trade ≥ 0.5% of equity capital.
 *   • Block deal = single trade ≥ ₹10 crore (or 5 lakh shares) in window slots.
 *   • Short deal = aggregated short-selling for the session.
 *
 * Published by NSE after market close (~5:30-6 PM IST).
 * Polls /api/large-deals/recent every 10 min.
 */

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 10 * 60 * 1000;

type Kind = 'bulk' | 'block' | 'short';
type Filter = 'all' | Kind;

interface LargeDeal {
  _id: string;
  dealDate: string;
  symbol: string;
  company: string;
  kind: Kind;
  clientName: string;
  buySell: 'BUY' | 'SELL' | '';
  qty: number;
  watp: number;
  valueCr: number;
  remarks: string;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

function fmtValue(cr: number): string {
  if (cr >= 100) return `₹${cr.toFixed(0)} cr`;
  if (cr >= 10)  return `₹${cr.toFixed(1)} cr`;
  if (cr >= 1)   return `₹${cr.toFixed(2)} cr`;
  return `₹${(cr * 100).toFixed(0)} L`;
}

function fmtQty(q: number): string {
  if (q >= 1e7) return `${(q / 1e7).toFixed(2)} cr`;
  if (q >= 1e5) return `${(q / 1e5).toFixed(1)} L`;
  if (q >= 1e3) return `${(q / 1e3).toFixed(1)}k`;
  return q.toLocaleString('en-IN');
}

function kindChip(kind: Kind) {
  if (kind === 'bulk')  return { label: 'BULK',  cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' };
  if (kind === 'block') return { label: 'BLOCK', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' };
  return { label: 'SHORT', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' };
}

export default function LargeDealsWidget() {
  const [deals, setDeals] = useState<LargeDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [minCr, setMinCr] = useState<0 | 1 | 5 | 10>(1);
  const [days, setDays] = useState<1 | 3 | 7>(3);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({ days: String(days), minValueCr: String(minCr) });
      if (filter !== 'all') params.set('kind', filter);
      const res = await fetch(`${BACKEND_URL}/api/large-deals/recent?${params}`);
      const json = await res.json();
      if (json.status === 'success') setDeals(json.data || []);
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
      await fetch(`${BACKEND_URL}/api/large-deals/refresh`, { method: 'POST' });
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [filter, minCr, days]);

  // Symbol-level aggregate — net buy value per symbol over the window
  const symbolAgg = useMemo(() => {
    const map = new Map<string, { symbol: string; company: string; netCr: number; grossCr: number; dealCount: number }>();
    for (const d of deals) {
      if (d.kind === 'short') continue;
      const e = map.get(d.symbol) || { symbol: d.symbol, company: d.company, netCr: 0, grossCr: 0, dealCount: 0 };
      const signed = d.buySell === 'BUY' ? d.valueCr : d.buySell === 'SELL' ? -d.valueCr : 0;
      e.netCr += signed;
      e.grossCr += d.valueCr;
      e.dealCount += 1;
      map.set(d.symbol, e);
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.netCr) - Math.abs(a.netCr)).slice(0, 6);
  }, [deals]);

  return (
    <div className="rounded-xl border-2 border-cyan-200 dark:border-cyan-800 bg-white dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
            Large Deals (Smart Money)
          </h3>
          <span className="text-[11px] font-mono-nums text-gray-500">{deals.length} deal{deals.length !== 1 ? 's' : ''} · {days}d</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Days toggle */}
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5 text-[11px]">
            {([1, 3, 7] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  days === d ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >{d}d</button>
            ))}
          </div>

          {/* Filter kind */}
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5 text-[11px]">
            {(['all', 'bulk', 'block', 'short'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors capitalize ${
                  filter === f ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >{f}</button>
            ))}
          </div>

          {/* Min value toggle */}
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5 text-[11px]">
            {([0, 1, 5, 10] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMinCr(v)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  minCr === v ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >{v === 0 ? 'all' : `≥₹${v}cr`}</button>
            ))}
          </div>

          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Re-fetch NSE"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && deals.length === 0 && (
        <div className="text-xs text-gray-500 italic py-8 text-center">Loading deals…</div>
      )}
      {error && deals.length === 0 && (
        <div className="text-xs text-red-500 py-4">{error}</div>
      )}
      {!loading && !error && deals.length === 0 && (
        <div className="text-xs text-gray-500 py-6 text-center">
          No deals in the last {days} day{days !== 1 ? 's' : ''}.
          <div className="mt-2"><button onClick={manualRefresh} className="text-cyan-600 hover:underline">Re-fetch</button></div>
        </div>
      )}

      {deals.length > 0 && (
        <>
          {/* Top symbols by net flow */}
          {symbolAgg.length > 0 && (
            <div className="mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="text-[10px] uppercase font-bold text-gray-500 mb-1.5 tracking-wider">Top symbols by net flow</div>
              <div className="flex flex-wrap gap-1.5">
                {symbolAgg.map((s) => {
                  const isBuy = s.netCr > 0;
                  const isSell = s.netCr < 0;
                  return (
                    <div
                      key={s.symbol}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-nums border ${
                        isBuy ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 text-green-800 dark:text-green-300'
                          : isSell ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 text-red-800 dark:text-red-300'
                          : 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                      title={`${s.company || s.symbol}\nNet: ${fmtValue(Math.abs(s.netCr))} ${isBuy ? 'BUY' : isSell ? 'SELL' : 'mixed'}\nDeals: ${s.dealCount}`}
                    >
                      {isBuy && <ArrowUp className="w-3 h-3" />}
                      {isSell && <ArrowDown className="w-3 h-3" />}
                      <span className="font-bold">{s.symbol}</span>
                      <span className="opacity-80">{fmtValue(Math.abs(s.netCr))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Deal list */}
          <div className="max-h-96 overflow-y-auto pr-1">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="text-left py-1 pr-2">Date</th>
                  <th className="text-left py-1 pr-2">Kind</th>
                  <th className="text-left py-1 pr-2">Symbol</th>
                  <th className="text-left py-1 pr-2 max-w-[180px]">Client</th>
                  <th className="text-center py-1 pr-2">Side</th>
                  <th className="text-right py-1 pr-2">Qty</th>
                  <th className="text-right py-1 pr-2">WATP</th>
                  <th className="text-right py-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {deals.slice(0, 60).map((d) => {
                  const k = kindChip(d.kind);
                  return (
                    <tr key={d._id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="py-1 pr-2 text-gray-600 dark:text-gray-400 font-mono-nums">{fmtDate(d.dealDate)}</td>
                      <td className="py-1 pr-2">
                        <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${k.cls}`}>{k.label}</span>
                      </td>
                      <td className="py-1 pr-2 font-bold font-mono-nums text-gray-900 dark:text-gray-100" title={d.company}>{d.symbol}</td>
                      <td className="py-1 pr-2 text-gray-700 dark:text-gray-300 truncate max-w-[180px]" title={d.clientName}>{d.clientName || '—'}</td>
                      <td className="py-1 pr-2 text-center">
                        {d.buySell === 'BUY' && <span className="text-green-600 dark:text-green-400 font-bold">BUY</span>}
                        {d.buySell === 'SELL' && <span className="text-red-600 dark:text-red-400 font-bold">SELL</span>}
                        {!d.buySell && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-1 pr-2 text-right font-mono-nums text-gray-700 dark:text-gray-300">{fmtQty(d.qty)}</td>
                      <td className="py-1 pr-2 text-right font-mono-nums text-gray-700 dark:text-gray-300">₹{d.watp.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono-nums font-semibold text-gray-900 dark:text-gray-100">{fmtValue(d.valueCr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {deals.length > 60 && (
              <div className="mt-2 text-center text-[10px] text-gray-500">Showing top 60 of {deals.length}. Narrow filter to see more.</div>
            )}
          </div>
        </>
      )}

      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
        Source: NSE EOD snapshot. Refreshed daily 6 PM IST (Mon–Fri).
      </div>
    </div>
  );
}
