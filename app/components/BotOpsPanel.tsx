'use client';

/**
 * BotOpsPanel — 4 paper bots at a glance.
 *
 * BOT_BLUEPRINT items #1-#4 (Swing, Long-term, Options Sell, Options Buy).
 *
 * Each bot card shows:
 *   • enable/disable toggle
 *   • selected screen (dropdown editable)
 *   • cron schedule + description
 *   • last run status + summary
 *   • "Run now" button (manual trigger, ignores disabled flag)
 *   • strategy notes
 * Below the grid: combined recent runs feed.
 */

import { useEffect, useState } from 'react';
import {
  Bot, Play, Zap, Activity, TrendingUp, TrendingDown, Settings2,
  RefreshCw, Check, X, Clock, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_MS = 60 * 1000;

type BotId = 'swing' | 'longterm' | 'options-sell' | 'options-buy';

interface ScreenRef { _id: string; name: string }
interface BotConfig {
  _id: string;
  botId: BotId;
  algoId: string;
  displayName: string;
  enabled: boolean;
  screenId: ScreenRef | null;
  topN: number;
  liquidityBand: string;
  cronSchedule: string;
  cronDescription: string;
  persistAccepted: boolean;
  risk: { slPct: number | null; rr: number | null };
  strategyNotes: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failure' | 'skipped' | null;
  lastRunSummary: string;
}
interface BotRun {
  _id: string;
  botId: BotId;
  trigger: 'auto' | 'manual';
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'success' | 'failure' | 'skipped';
  screenName: string;
  scanned: number;
  accepted: number;
  rejected: number;
  topRejection: string;
  skipReason: string;
  error: string;
  summary?: string;
}

const BOT_META: Record<BotId, { icon: any; color: string }> = {
  swing:          { icon: TrendingUp,  color: 'text-blue-600 dark:text-blue-400' },
  longterm:       { icon: Activity,    color: 'text-emerald-600 dark:text-emerald-400' },
  'options-sell': { icon: TrendingDown, color: 'text-purple-600 dark:text-purple-400' },
  'options-buy':  { icon: Zap,         color: 'text-amber-600 dark:text-amber-400' },
};

function fmtAgo(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

export default function BotOpsPanel() {
  const [configs, setConfigs] = useState<BotConfig[]>([]);
  const [screens, setScreens] = useState<{ _id: string; name: string }[]>([]);
  const [runs, setRuns] = useState<BotRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BotId | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [showRuns, setShowRuns] = useState(false);

  const fetchAll = async () => {
    try {
      const [cRes, sRes, rRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/bots/configs`),
        fetch(`${BACKEND_URL}/api/scanner/screens`),
        fetch(`${BACKEND_URL}/api/bots/runs?limit=12`),
      ]);
      const c = await cRes.json();
      const s = await sRes.json();
      const r = await rRes.json();
      if (c.status === 'success') setConfigs(c.data || []);
      if (s.status === 'success') setScreens(s.data || []);
      if (r.status === 'success') setRuns(r.data || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (botId: BotId, patch: any) => {
    try {
      await fetch(`${BACKEND_URL}/api/bots/configs/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchAll();
    } catch (e: any) { setError(e.message); }
  };

  const runBot = async (botId: BotId) => {
    setBusy(botId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/bots/run/${botId}`, { method: 'POST' });
      const j = await res.json();
      if (j.status !== 'success') setError(j.message || 'Run failed');
      await fetchAll();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(''); }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(iv);
  }, []);

  if (loading && configs.length === 0) {
    return <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-900 p-4 text-xs text-gray-500 italic">Loading bots…</div>;
  }

  return (
    <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
            Bot Ops
          </h3>
          <span className="text-[11px] text-gray-500">4 paper bots — enable, schedule, run</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRuns(!showRuns)}
            className="text-[11px] px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600">
            {showRuns ? 'Hide' : 'Show'} runs ({runs.length})
          </button>
          <button onClick={fetchAll} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 px-2.5 py-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[11px] text-red-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {/* Bot grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {configs.map((c) => {
          const meta = BOT_META[c.botId] || BOT_META.swing;
          const Icon = meta.icon;
          const isBusy = busy === c.botId;
          return (
            <div key={c._id} className={`rounded-md border p-3 ${
              c.enabled
                ? 'bg-orange-50/40 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{c.displayName}</span>
                  <span className="text-[9px] font-mono-nums text-indigo-700 dark:text-indigo-300">{c.algoId}</span>
                </div>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={c.enabled}
                    onChange={(e) => updateConfig(c.botId, { enabled: e.target.checked })} />
                  <span className={`text-[9px] font-bold uppercase ${c.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                    {c.enabled ? 'ENABLED' : 'OFF'}
                  </span>
                </label>
              </div>

              {/* Screen dropdown */}
              <div className="mb-1.5">
                <label className="block text-[9px] uppercase font-bold tracking-wider text-gray-500">Screen</label>
                <select
                  value={c.screenId?._id || ''}
                  onChange={(e) => updateConfig(c.botId, { screenId: e.target.value || null })}
                  className="w-full text-[11px] px-1.5 py-0.5 border border-gray-300 rounded"
                >
                  <option value="">— select a screen —</option>
                  {screens.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* topN + SL + R:R */}
              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                <div>
                  <label className="block text-[9px] uppercase font-bold tracking-wider text-gray-500">Top N</label>
                  <input type="number" min={1} max={20} value={c.topN}
                    onChange={(e) => updateConfig(c.botId, { topN: Math.max(1, Math.min(20, Number(e.target.value) || 5)) })}
                    className="w-full text-[11px] px-1.5 py-0.5 border border-gray-300 rounded font-mono-nums" />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold tracking-wider text-gray-500">SL %</label>
                  <input type="number" step="0.5" value={c.risk?.slPct ?? ''}
                    onChange={(e) => updateConfig(c.botId, { risk: { ...c.risk, slPct: Number(e.target.value) || null } })}
                    className="w-full text-[11px] px-1.5 py-0.5 border border-gray-300 rounded font-mono-nums" />
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold tracking-wider text-gray-500">R:R</label>
                  <input type="number" step="0.1" value={c.risk?.rr ?? ''}
                    onChange={(e) => updateConfig(c.botId, { risk: { ...c.risk, rr: Number(e.target.value) || null } })}
                    className="w-full text-[11px] px-1.5 py-0.5 border border-gray-300 rounded font-mono-nums" />
                </div>
              </div>

              {/* Cron */}
              <div className="text-[10px] text-gray-600 dark:text-gray-400 font-mono-nums mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {c.cronSchedule} <span className="opacity-70">· {c.cronDescription}</span>
              </div>

              {/* Last run + Run Now */}
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-gray-600 dark:text-gray-400">
                  {c.lastRunAt ? (
                    <>
                      <span className={`font-bold uppercase mr-1 ${
                        c.lastRunStatus === 'success' ? 'text-green-700' :
                        c.lastRunStatus === 'skipped' ? 'text-gray-500' :
                        c.lastRunStatus === 'failure' ? 'text-red-700' : ''
                      }`}>
                        {c.lastRunStatus}
                      </span>
                      <span className="text-gray-500">{fmtAgo(c.lastRunAt)}</span>
                      {c.lastRunSummary && <span className="ml-1 text-gray-600 dark:text-gray-400 truncate" title={c.lastRunSummary}> · {c.lastRunSummary.slice(0, 40)}</span>}
                    </>
                  ) : (
                    <span className="italic text-gray-500">Never run</span>
                  )}
                </div>
                <button
                  onClick={() => runBot(c.botId)}
                  disabled={isBusy || !c.screenId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-600 text-white text-[10px] font-semibold hover:bg-orange-700 disabled:opacity-40"
                  title={!c.screenId ? 'Select a screen first' : 'Run this bot now (ignores disabled + market hours)'}
                >
                  {isBusy ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Run now
                </button>
              </div>

              {c.strategyNotes && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-600 dark:text-gray-400 italic">
                  {c.strategyNotes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent runs */}
      {showRuns && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1.5">Recent runs</div>
          {runs.length === 0 ? (
            <div className="text-[11px] text-gray-500 italic">No runs yet — click "Run now" on any bot.</div>
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {runs.map((r) => (
                <div key={r._id} className="flex items-center gap-2 text-[10px] py-0.5">
                  <span className={`px-1 py-0 rounded font-bold uppercase ${
                    r.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                    r.status === 'skipped' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                    r.status === 'failure' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>{r.status}</span>
                  <span className="font-mono-nums font-semibold text-gray-700 dark:text-gray-300 min-w-[90px]">{r.botId}</span>
                  <span className="text-gray-500">{r.trigger}</span>
                  <span className="text-gray-600 dark:text-gray-400 flex-1 truncate" title={r.summary || r.skipReason || r.error}>
                    {r.status === 'success'
                      ? `${r.scanned}→${r.accepted} accepted${r.topRejection ? ' · top reject: ' + r.topRejection.slice(0, 40) : ''}`
                      : (r.skipReason || r.error || '—')}
                  </span>
                  <span className="text-gray-400 shrink-0">{fmtAgo(r.startedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
