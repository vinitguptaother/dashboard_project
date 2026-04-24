'use client';

/**
 * TradeIdeaDiff — "What changed since last login" banner.
 *
 * MASTER_PLAN §7 Phase 6 deliverable #3.
 *
 * Tracks `localStorage.lastDashboardVisit`. On mount, calls
 * /api/diff/since?ts=<prevVisit>. If meaningful changes exist, shows a
 * compact banner at the top of the Dashboard. Clicking "Dismiss" hides it
 * and updates the timestamp.
 */

import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle, X, TrendingUp, XCircle, Activity, AlertCircle } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5002';
const LS_KEY = 'lastDashboardVisit';

interface ClosedTrade {
  symbol: string;
  verdict: 'win' | 'loss' | 'expired' | 'cancelled';
  status: string;
  pnl: number | null;
  closedAt: string;
}

interface NewSignal {
  type: string;
  priority: string;
  description: string;
}

interface DiffData {
  since: string;
  now: string;
  hasChanges: boolean;
  newSuggestions: number;
  closedTrades: ClosedTrade[];
  newSignals: NewSignal[];
  regimeChanges: string[];
  agentOutputs: Record<string, number>;
}

export default function TradeIdeaDiff() {
  const [data, setData] = useState<DiffData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Read previous visit + schedule the next one.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prev = localStorage.getItem(LS_KEY);
    const ts = prev || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/diff/since?ts=${encodeURIComponent(ts)}`);
        const json = await res.json();
        if (json.status === 'success') {
          setData(json.data);
        }
      } catch (err) {
        // Quiet — backend may be down or the route may not exist yet.
        // eslint-disable-next-line no-console
        console.warn('[TradeIdeaDiff] diff fetch failed', err);
      }
    })();
  }, []);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, new Date().toISOString());
    }
    setHidden(true);
  };

  const { wins, losses, netPnl } = useMemo(() => {
    if (!data) return { wins: 0, losses: 0, netPnl: 0 };
    let w = 0, l = 0, n = 0;
    for (const t of data.closedTrades) {
      if (t.verdict === 'win') w++;
      if (t.verdict === 'loss') l++;
      if (t.pnl != null) n += t.pnl;
    }
    return { wins: w, losses: l, netPnl: n };
  }, [data]);

  if (hidden || !data || !data.hasChanges) return null;

  const bits: string[] = [];
  if (data.newSuggestions > 0) bits.push(`${data.newSuggestions} new suggestion${data.newSuggestions === 1 ? '' : 's'}`);
  if (data.closedTrades.length > 0) bits.push(`${data.closedTrades.length} trade${data.closedTrades.length === 1 ? '' : 's'} closed (${wins}W/${losses}L)`);
  if (data.regimeChanges.length > 0) bits.push(`regime changed`);
  if (data.newSignals.length > 0 && !bits.length) bits.push(`${data.newSignals.length} new signal${data.newSignals.length === 1 ? '' : 's'}`);

  return (
    <div
      role="region"
      aria-label="Changes since last visit"
      className="glass-effect rounded-xl p-3 sm:p-4 shadow border border-blue-200 bg-blue-50/40"
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-full bg-blue-600/10 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Since your last visit</p>
          <p className="text-xs text-gray-600 mt-0.5">
            {bits.length > 0 ? bits.join(' · ') : 'Updates available'}
            {netPnl !== 0 && (
              <>
                {' '}
                <span className={netPnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {netPnl >= 0 ? '+' : ''}₹{netPnl.toLocaleString('en-IN')}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs px-2.5 py-1.5 rounded-md bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 min-h-[44px] sm:min-h-0"
            aria-expanded={expanded}
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {data.closedTrades.length > 0 && (
            <div>
              <p className="font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Closed trades
              </p>
              <ul className="space-y-1">
                {data.closedTrades.slice(0, 6).map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 truncate">
                      {t.verdict === 'win' ? (
                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                      ) : t.verdict === 'loss' ? (
                        <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-gray-400 shrink-0" />
                      )}
                      <span className="font-medium text-gray-800 truncate">{t.symbol}</span>
                      <span className="text-gray-500 capitalize">{t.verdict}</span>
                    </span>
                    {t.pnl != null && (
                      <span className={`font-mono text-[11px] ${t.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toLocaleString('en-IN')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data.newSignals.length > 0 || data.regimeChanges.length > 0) && (
            <div>
              {data.regimeChanges.length > 0 && (
                <>
                  <p className="font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Regime changes
                  </p>
                  <ul className="space-y-0.5 mb-3">
                    {data.regimeChanges.slice(0, 4).map((r, i) => (
                      <li key={i} className="text-gray-700">{r}</li>
                    ))}
                  </ul>
                </>
              )}
              {data.newSignals.length > 0 && (
                <>
                  <p className="font-semibold text-gray-700 mb-1">New signals</p>
                  <ul className="space-y-0.5">
                    {data.newSignals.slice(0, 4).map((s, i) => (
                      <li key={i} className="flex items-center gap-1 truncate">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                          s.priority === 'URGENT' ? 'bg-red-500' :
                          s.priority === 'HIGH' ? 'bg-amber-500' :
                          'bg-blue-400'
                        }`} />
                        <span className="text-gray-700 truncate" title={s.description}>{s.description}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {Object.keys(data.agentOutputs).length > 0 && (
            <div className="sm:col-span-2 pt-2 border-t border-blue-100">
              <p className="font-semibold text-gray-700 mb-1">Agent activity</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.agentOutputs).map(([agent, count]) => (
                  <span key={agent} className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700">
                    {agent}: <span className="font-semibold">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
