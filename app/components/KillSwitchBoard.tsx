'use client';

/**
 * KillSwitchBoard — unified control panel for ALL trading kill states.
 *
 * BOT_BLUEPRINT item #11. One surface for:
 *   • Active global blockers (daily-loss / cooldown / drawdown)
 *   • Per-bot kill toggles
 *   • Panic button (stops everything)
 *   • Recent event log (audit trail for compliance #46)
 *
 * Polls /api/kill-switches/state every 30s.
 */

import { useEffect, useState } from 'react';
import {
  Power, AlertTriangle, ShieldOff, ShieldCheck, Bot, History, RefreshCw, X,
  Siren, Clock,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 30 * 1000;

type BotId = 'swing' | 'longterm' | 'options-sell' | 'options-buy';

interface Blocker {
  kind: 'daily-loss' | 'post-loss-cooldown' | 'drawdown' | 'bot-kill';
  label: string;
  since?: string | null;
  reason: string;
  msRemaining?: number;
  until?: string;
  botId?: string;
  clearable: boolean;
  clearVia: string;
}
interface PerBotState {
  active: boolean;
  reason: string;
  activatedAt: string | null;
}
interface UnifiedState {
  globalBlocked: boolean;
  blockers: Blocker[];
  perBot: Record<BotId, PerBotState>;
  capital: number;
  limits: { maxDrawdownPct: number; dailyLossLimitPct: number };
  computedAt: string;
}
interface KillEvent {
  _id: string;
  kind: string;
  action: 'activate' | 'clear';
  botId: string;
  trigger: 'auto' | 'manual';
  reason: string;
  at: string;
}

const BOT_LABEL: Record<BotId, string> = {
  swing: 'Swing',
  longterm: 'Long-term',
  'options-sell': 'Options Sell',
  'options-buy': 'Options Buy',
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const ago = Math.round((now - d.getTime()) / 1000);
    if (ago < 60) return `${ago}s ago`;
    if (ago < 3600) return `${Math.round(ago / 60)}m ago`;
    if (ago < 86400) return `${Math.round(ago / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '—';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export default function KillSwitchBoard() {
  const [state, setState] = useState<UnifiedState | null>(null);
  const [history, setHistory] = useState<KillEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchState = async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/kill-switches/state`),
        fetch(`${BACKEND_URL}/api/kill-switches/history?limit=10`),
      ]);
      const sJ = await sRes.json();
      const hJ = await hRes.json();
      if (sJ.status === 'success') setState(sJ.data);
      if (hJ.status === 'success') setHistory(hJ.data || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const toggleBot = async (botId: BotId) => {
    const current = state?.perBot[botId]?.active;
    const url = current
      ? `${BACKEND_URL}/api/kill-switches/bot-kill/clear`
      : `${BACKEND_URL}/api/kill-switches/bot-kill`;
    const reason = current
      ? undefined
      : (window.prompt(`Reason for killing the ${BOT_LABEL[botId]} bot?`) || '');
    if (current === false && reason === null) return;
    setBusy(true);
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, reason }),
      });
      await fetchState();
    } finally { setBusy(false); }
  };

  const clearBlocker = async (b: Blocker) => {
    if (!window.confirm(`Clear: ${b.label}?\n\n${b.reason}`)) return;
    setBusy(true);
    try {
      let url = '', body: any = {};
      if (b.kind === 'daily-loss') { url = `${BACKEND_URL}/api/risk/kill-switch/override`; body = { confirmation: 'UNLOCK' }; }
      else if (b.kind === 'post-loss-cooldown') { url = `${BACKEND_URL}/api/risk/cooldown/clear`; }
      else if (b.kind === 'drawdown') { url = `${BACKEND_URL}/api/risk-engine/drawdown-lockout/clear`; body = { confirmation: 'UNLOCK' }; }
      else if (b.kind === 'bot-kill' && b.botId) { url = `${BACKEND_URL}/api/kill-switches/bot-kill/clear`; body = { botId: b.botId }; }
      if (url) {
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      await fetchState();
    } finally { setBusy(false); }
  };

  const panic = async () => {
    const reason = window.prompt('PANIC — halt ALL trading. Why?\n(Trips daily-loss kill, drawdown lockout, and all 4 bot kills.)\n\nType a reason or Cancel:');
    if (reason === null) return;
    if (!window.confirm('Confirm: stop all trading now?')) return;
    setBusy(true);
    try {
      await fetch(`${BACKEND_URL}/api/kill-switches/panic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'PANIC', reason: reason || 'Panic button' }),
      });
      await fetchState();
    } finally { setBusy(false); }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear ALL kill states (daily-loss + cooldown + drawdown + every bot kill)?\n\nOnly do this if you\'ve reviewed why each one was tripped.')) return;
    setBusy(true);
    try {
      await fetch(`${BACKEND_URL}/api/kill-switches/clear-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'UNLOCK', reason: 'Manual clear-all' }),
      });
      await fetchState();
    } finally { setBusy(false); }
  };

  useEffect(() => {
    fetchState();
    const iv = setInterval(fetchState, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  if (loading && !state) {
    return <div className="rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-gray-900 p-4 text-xs text-gray-500 italic">Loading kill switches…</div>;
  }
  if (error && !state) {
    return <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 p-4 text-xs text-red-600 dark:text-red-400">{error}</div>;
  }
  if (!state) return null;

  const globalBlocked = state.globalBlocked;
  const anyBotKilled = Object.values(state.perBot).some(b => b.active);

  return (
    <div className={`rounded-xl border-2 p-4 ${
      globalBlocked
        ? 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-900/10'
        : anyBotKilled
        ? 'border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10'
        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-gray-900'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {globalBlocked ? (
            <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400" />
          ) : anyBotKilled ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
          )}
          <h3 className={`text-sm font-bold uppercase tracking-wider ${
            globalBlocked ? 'text-red-700 dark:text-red-300'
            : anyBotKilled ? 'text-amber-700 dark:text-amber-300'
            : 'text-gray-700 dark:text-gray-300'
          }`}>
            Kill Switch Board
          </h3>
          <span className="text-[11px] font-mono-nums text-gray-500">
            {globalBlocked ? 'ALL TRADING BLOCKED' : anyBotKilled ? 'Partial — some bots killed' : 'All systems green'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Toggle recent events"
          >
            <History className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button
            onClick={fetchState}
            disabled={busy}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${busy ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active blockers */}
      {state.blockers.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {state.blockers.map((b, i) => (
            <div key={i} className={`flex items-start justify-between gap-2 px-2.5 py-1.5 rounded border ${
              b.kind === 'bot-kill'
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
            }`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                  {b.kind === 'bot-kill' ? <Bot className="w-3 h-3 text-amber-600" /> : <Power className="w-3 h-3 text-red-600" />}
                  <span>{b.label}</span>
                  {b.msRemaining != null && (
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-600 font-mono-nums">
                      <Clock className="w-3 h-3" /> {fmtMs(b.msRemaining)}
                    </span>
                  )}
                  {b.since && <span className="text-[10px] text-gray-500">· {fmtTime(b.since)}</span>}
                </div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">{b.reason}</div>
              </div>
              {b.clearable && (
                <button
                  onClick={() => clearBlocker(b)}
                  disabled={busy}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 hover:opacity-80 disabled:opacity-50 shrink-0"
                  title="Clear this blocker"
                >
                  Clear
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-3 px-2.5 py-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-[11px] text-green-800 dark:text-green-300">
          ✓ No active blockers — trading permitted for all bots.
        </div>
      )}

      {/* Per-bot kills */}
      <div className="mb-3">
        <div className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-gray-400 mb-1.5">
          Per-bot kill switches
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['swing', 'longterm', 'options-sell', 'options-buy'] as BotId[]).map((botId) => {
            const b = state.perBot[botId];
            return (
              <button
                key={botId}
                onClick={() => toggleBot(botId)}
                disabled={busy}
                className={`rounded border px-2 py-1.5 text-left transition-colors ${
                  b.active
                    ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 hover:bg-red-200'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title={b.active ? `Killed${b.reason ? ': ' + b.reason : ''}` : 'Click to kill this bot'}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">{BOT_LABEL[botId]}</span>
                  <span className={`text-[9px] font-bold uppercase ${b.active ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-400'}`}>
                    {b.active ? 'KILLED' : 'LIVE'}
                  </span>
                </div>
                {b.active && b.activatedAt && (
                  <div className="text-[9px] text-gray-500 mt-0.5 font-mono-nums">
                    since {fmtTime(b.activatedAt)}
                  </div>
                )}
                {b.active && b.reason && (
                  <div className="text-[9px] text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                    {b.reason}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panic + Clear-all footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="text-[10px] text-gray-500">
          Max DD {state.limits.maxDrawdownPct}% · Daily loss limit {state.limits.dailyLossLimitPct}%
        </div>
        <div className="flex items-center gap-2">
          {(state.blockers.length > 0 || anyBotKilled) && (
            <button
              onClick={clearAll}
              disabled={busy}
              className="text-[10px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Clear all
            </button>
          )}
          <button
            onClick={panic}
            disabled={busy}
            className="text-[10px] px-2.5 py-1 rounded bg-red-600 text-white font-bold flex items-center gap-1 hover:bg-red-700 disabled:opacity-50"
          >
            <Siren className="w-3 h-3" />
            PANIC
          </button>
        </div>
      </div>

      {/* Recent history */}
      {showHistory && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
            <History className="w-3 h-3" /> Recent events
          </div>
          {history.length === 0 ? (
            <div className="text-[11px] text-gray-500 italic">No events recorded yet.</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {history.map((e) => (
                <div key={e._id} className="flex items-center gap-2 text-[10px] py-0.5">
                  <span className={`font-bold uppercase px-1 py-0 rounded ${
                    e.action === 'activate' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  }`}>
                    {e.action}
                  </span>
                  <span className="font-mono-nums font-semibold text-gray-700 dark:text-gray-300">{e.kind}</span>
                  {e.botId !== 'all' && <span className="text-gray-500">({e.botId})</span>}
                  <span className="text-gray-500 truncate flex-1" title={e.reason}>{e.reason || '—'}</span>
                  <span className="text-gray-400 shrink-0">{fmtTime(e.at)}</span>
                  <span className={`text-[9px] px-1 rounded ${e.trigger === 'auto' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                    {e.trigger}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
