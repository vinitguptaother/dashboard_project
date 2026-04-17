'use client';

/**
 * CorporateEventsWidget — next-30-day calendar of NSE corporate actions
 * (dividends / splits / bonuses / buybacks) + board meetings (earnings).
 *
 * BOT_BLUEPRINT item #27. Prevents surprises like:
 *   • Holding a position through its earnings date without knowing.
 *   • Missing a dividend ex-date.
 *   • Trading the day of a buyback ex-date (unusual volume).
 *
 * Polls /api/corporate-actions/upcoming every 10 min (low cadence — data
 * is published daily, not intraday).
 */

import { useEffect, useMemo, useState } from 'react';
import { Calendar, RefreshCw, Filter, TrendingUp, Gift, Scissors, DollarSign, FileText } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 10 * 60 * 1000;

type Kind = 'action' | 'meeting';
type Filter = 'all' | 'action' | 'meeting';

interface CorpEvent {
  _id: string;
  symbol: string;
  company: string;
  kind: Kind;
  eventDate: string;
  subject: string;
  rawPurpose: string;
  recordDate: string | null;
  faceValue: string;
  series: string;
  description: string;
}

function iconForEvent(e: CorpEvent) {
  if (e.kind === 'meeting') {
    if (/result|earning/i.test(e.subject)) return TrendingUp;
    return FileText;
  }
  if (/dividend/i.test(e.subject)) return DollarSign;
  if (/bonus/i.test(e.subject)) return Gift;
  if (/split/i.test(e.subject)) return Scissors;
  return FileText;
}

function colorForEvent(e: CorpEvent): string {
  if (e.kind === 'meeting') {
    if (/result|earning/i.test(e.subject)) return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
    return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800';
  }
  if (/dividend/i.test(e.subject)) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
  if (/bonus/i.test(e.subject)) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
  if (/split/i.test(e.subject)) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  if (/buy\s*back/i.test(e.subject)) return 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800';
  return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  } catch { return iso; }
}

function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((d - now) / (24 * 60 * 60 * 1000));
}

function groupByDate(events: CorpEvent[]): Record<string, CorpEvent[]> {
  const g: Record<string, CorpEvent[]> = {};
  events.forEach(e => {
    const key = e.eventDate.slice(0, 10);
    if (!g[key]) g[key] = [];
    g[key].push(e);
  });
  return g;
}

export default function CorporateEventsWidget() {
  const [events, setEvents] = useState<CorpEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [days, setDays] = useState<7 | 14 | 30>(14);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (filter !== 'all') params.set('kind', filter);
      const res = await fetch(`${BACKEND_URL}/api/corporate-actions/upcoming?${params}`);
      const json = await res.json();
      if (json.status === 'success') setEvents(json.data || []);
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
      await fetch(`${BACKEND_URL}/api/corporate-actions/refresh`, { method: 'POST' });
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [filter, days]);

  const grouped = useMemo(() => groupByDate(events), [events]);
  const dates = Object.keys(grouped).sort();

  return (
    <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
            Corporate Events Calendar
          </h3>
          <span className="text-[11px] font-mono-nums text-gray-500">
            {events.length} event{events.length !== 1 ? 's' : ''} · next {days}d
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Days toggle */}
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5 text-[11px]">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  days === d
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <div className="inline-flex rounded-md bg-gray-100 dark:bg-gray-800 p-0.5 text-[11px]">
            {(['all', 'action', 'meeting'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded font-semibold transition-colors capitalize ${
                  filter === f
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f === 'action' ? 'Actions' : f === 'meeting' ? 'Earnings' : 'All'}
              </button>
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

      {loading && events.length === 0 && (
        <div className="text-xs text-gray-500 italic py-8 text-center">Loading events…</div>
      )}
      {error && events.length === 0 && (
        <div className="text-xs text-red-500 py-4">{error}</div>
      )}
      {!loading && !error && events.length === 0 && (
        <div className="text-xs text-gray-500 py-6 text-center">
          No {filter === 'all' ? '' : filter + ' '}events in the next {days} days.
          <div className="mt-2">
            <button onClick={manualRefresh} className="text-purple-600 hover:underline">
              Click to re-fetch from NSE
            </button>
          </div>
        </div>
      )}

      {dates.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {dates.map((dateKey) => {
            const group = grouped[dateKey];
            const du = daysUntil(dateKey);
            return (
              <div key={dateKey} className="border-l-2 border-purple-300 dark:border-purple-700 pl-3">
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">
                    {formatDate(dateKey)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono-nums">
                    {du === 0 ? 'TODAY' : du === 1 ? 'tomorrow' : `in ${du}d`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.map((e) => {
                    const Icon = iconForEvent(e);
                    const color = colorForEvent(e);
                    return (
                      <div
                        key={e._id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${color}`}
                        title={`${e.company || e.symbol} — ${e.subject}${e.description ? '\n\n' + e.description : ''}`}
                      >
                        <Icon className="w-3 h-3 shrink-0" />
                        <span className="font-semibold font-mono-nums">{e.symbol}</span>
                        <span className="opacity-80 truncate max-w-[180px]">· {e.subject}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span>Source: NSE corporate actions + board meetings. Refreshed daily 7 AM IST.</span>
      </div>
    </div>
  );
}
