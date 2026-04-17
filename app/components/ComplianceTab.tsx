'use client';

/**
 * ComplianceTab — SEBI-grade audit trail of every algo decision.
 *
 * BOT_BLUEPRINT #46. Shows:
 *   • Algo registry (declared algos with strategy + static IP)
 *   • Stats row (total / accepted / rejected / by bot, last 30 days)
 *   • Event table with full filter set + pagination
 *   • CSV export (for SEBI submission if audited)
 */

import { useEffect, useMemo, useState } from 'react';
import { FileText, Download, Filter, RefreshCw, ChevronLeft, ChevronRight, Check, XCircle, Target, ShieldOff, ShieldCheck, Activity } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const PAGE_SIZE = 50;

type Decision = 'generated' | 'evaluated' | 'accepted' | 'rejected' | 'executed' | 'filled' | 'canceled' | 'target_hit' | 'sl_hit' | 'expired';
type BotId = 'manual' | 'swing' | 'longterm' | 'options-sell' | 'options-buy';

interface AlgoRegEntry {
  _id: string;
  algoId: string;
  botId: BotId;
  strategy: string;
  description: string;
  owner: string;
  staticIp: string;
  version: string;
  approvedAt: string;
  active: boolean;
}

interface ComplianceEvent {
  _id: string;
  algoId: string;
  botId: BotId;
  tradeSetupId: string | null;
  decision: Decision;
  symbol: string;
  action: string;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  price: number;
  reasoning: string;
  reasons: string[];
  clientIp: string;
  latencyMs: number;
  orderRef: string;
  at: string;
}

interface Stats {
  days: number;
  total: number;
  byDecision: Record<string, number>;
  byBot: Record<string, number>;
}

const DECISION_META: Record<Decision, { color: string; icon: any }> = {
  generated:  { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200', icon: Activity },
  evaluated:  { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Filter },
  accepted:   { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: Check },
  rejected:   { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  executed:   { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', icon: Activity },
  filled:     { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', icon: Check },
  canceled:   { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: ShieldOff },
  target_hit: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: Target },
  sl_hit:     { color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300', icon: XCircle },
  expired:    { color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: Activity },
};

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function ComplianceTab() {
  const [registry, setRegistry] = useState<AlgoRegEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(0);
  const [filterBot, setFilterBot] = useState<BotId | ''>('');
  const [filterDecision, setFilterDecision] = useState<Decision | ''>('');
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const fetchAll = async (keepPage = false) => {
    if (!keepPage) setPage(0);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), skip: String(keepPage ? page * PAGE_SIZE : 0) });
      if (filterBot) params.set('botId', filterBot);
      if (filterDecision) params.set('decision', filterDecision);
      if (filterSymbol) params.set('symbol', filterSymbol.toUpperCase());
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);

      const [evRes, regRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/compliance/events?${params}`),
        fetch(`${BACKEND_URL}/api/compliance/algo-registry`),
        fetch(`${BACKEND_URL}/api/compliance/stats?days=30`),
      ]);
      const ev = await evRes.json();
      const reg = await regRes.json();
      const st = await statsRes.json();
      if (ev.status === 'success') { setEvents(ev.data || []); setTotal(ev.total || 0); }
      if (reg.status === 'success') setRegistry(reg.data || []);
      if (st.status === 'success') setStats(st.data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    await fetchAll(true);
    setRefreshing(false);
  };

  const downloadCsv = () => {
    const params = new URLSearchParams();
    if (filterBot) params.set('botId', filterBot);
    if (filterDecision) params.set('decision', filterDecision);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    const url = `${BACKEND_URL}/api/compliance/export.csv?${params}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    fetchAll(false);
  }, [filterBot, filterDecision, filterSymbol, filterFrom, filterTo]);

  useEffect(() => {
    fetchAll(true);
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">SEBI Compliance Log</h2>
              <p className="text-xs text-gray-500">Immutable audit trail of every algo decision. Retained 7 years per SEBI requirement.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              title="Download CSV for SEBI submission"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={manualRefresh}
              disabled={refreshing}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-800">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-2">Last 30 days</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCell label="Total events" value={stats.total} color="text-gray-900 dark:text-gray-100" />
            <StatCell label="Accepted" value={stats.byDecision.accepted || 0} color="text-green-600" />
            <StatCell label="Rejected" value={stats.byDecision.rejected || 0} color="text-red-600" />
            <StatCell label="Target hits" value={stats.byDecision.target_hit || 0} color="text-emerald-600" />
            <StatCell label="SL hits" value={stats.byDecision.sl_hit || 0} color="text-rose-600" />
            <StatCell label="Canceled" value={stats.byDecision.canceled || 0} color="text-amber-600" />
          </div>
          {Object.keys(stats.byBot).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2 text-[11px]">
              {Object.entries(stats.byBot).map(([bot, count]) => (
                <span key={bot} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono-nums">
                  {bot}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Algo registry */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-800">
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-2">Algo Registry (SEBI declaration)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {registry.map((a) => (
            <div key={a._id} className="rounded border border-gray-200 dark:border-gray-700 p-2.5 bg-gray-50 dark:bg-gray-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono-nums text-[12px] font-bold text-indigo-700 dark:text-indigo-300">{a.algoId}</span>
                <span className={`text-[9px] px-1 py-0 rounded uppercase ${a.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                  {a.active ? 'active' : 'inactive'}
                </span>
              </div>
              <div className="text-[11px] text-gray-800 dark:text-gray-200 font-semibold">{a.strategy}</div>
              <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">{a.description}</div>
              <div className="text-[10px] text-gray-500 mt-1 font-mono-nums">
                bot {a.botId} · v{a.version} · owner {a.owner}{a.staticIp && ` · IP ${a.staticIp}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-800">
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-2 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filters
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <select value={filterBot} onChange={(e) => setFilterBot(e.target.value as any)} className="px-2 py-1 text-sm border border-gray-300 rounded">
            <option value="">All bots</option>
            <option value="manual">Manual</option>
            <option value="swing">Swing</option>
            <option value="longterm">Long-term</option>
            <option value="options-sell">Options Sell</option>
            <option value="options-buy">Options Buy</option>
          </select>
          <select value={filterDecision} onChange={(e) => setFilterDecision(e.target.value as any)} className="px-2 py-1 text-sm border border-gray-300 rounded">
            <option value="">All decisions</option>
            <option value="generated">Generated</option>
            <option value="evaluated">Evaluated</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="executed">Executed</option>
            <option value="filled">Filled</option>
            <option value="canceled">Canceled</option>
            <option value="target_hit">Target hit</option>
            <option value="sl_hit">SL hit</option>
            <option value="expired">Expired</option>
          </select>
          <input type="text" placeholder="Symbol e.g. RELIANCE" value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded font-mono-nums" />
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded" title="From date" />
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 rounded" title="To date" />
        </div>
      </div>

      {/* Event table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading && events.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-500 italic">Loading events…</div>
        )}
        {error && events.length === 0 && (
          <div className="p-4 text-xs text-red-600">{error}</div>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-500">
            No events match the filters. Widen the date range or clear filters.
          </div>
        )}
        {events.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="text-left px-3 py-2">Timestamp</th>
                  <th className="text-left px-2 py-2">AlgoId</th>
                  <th className="text-left px-2 py-2">Bot</th>
                  <th className="text-left px-2 py-2">Decision</th>
                  <th className="text-left px-2 py-2">Symbol</th>
                  <th className="text-left px-2 py-2">Action</th>
                  <th className="text-right px-2 py-2">Qty</th>
                  <th className="text-right px-2 py-2">Price</th>
                  <th className="text-left px-3 py-2">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const meta = DECISION_META[e.decision] || DECISION_META.evaluated;
                  const Icon = meta.icon;
                  return (
                    <tr key={e._id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-1.5 font-mono-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(e.at)}</td>
                      <td className="px-2 py-1.5 font-mono-nums font-bold text-indigo-700 dark:text-indigo-300">{e.algoId}</td>
                      <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{e.botId}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.color}`}>
                          <Icon className="w-3 h-3" />
                          {e.decision}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-mono-nums text-gray-900 dark:text-gray-100">{e.symbol || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{e.action || '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono-nums text-gray-600 dark:text-gray-400">{e.quantity || '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono-nums text-gray-600 dark:text-gray-400">{e.price ? `₹${e.price.toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-md">
                        <div className="truncate" title={[e.reasoning, ...(e.reasons || [])].filter(Boolean).join(' · ')}>
                          {e.reasoning || (e.reasons || []).join(' · ') || '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
            <span className="text-gray-500">
              Page {page + 1} of {totalPages} · {total} total events
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 p-2 text-center">
      <div className="text-[9px] uppercase text-gray-500 mb-0.5">{label}</div>
      <div className={`text-xl font-bold font-mono-nums ${color}`}>{value.toLocaleString('en-IN')}</div>
    </div>
  );
}
