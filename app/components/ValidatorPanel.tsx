'use client';

/**
 * ValidatorPanel — interactive "will this trade pass?" checker.
 *
 * BOT_BLUEPRINT item #6. Lets the user submit a candidate (symbol, side,
 * qty, entry, SL, target, sector, bot) and see the full Validator response:
 *   ✅ accepted  — with a button to also persist as a TradeSetup
 *   ❌ rejected  — with ordered reason list + gate-by-gate check snapshot
 *
 * Also shows the last 10 validations across bots for quick pattern-spotting
 * ("why do my swing bot candidates keep getting rejected in Energy?").
 */

import { useEffect, useState } from 'react';
import { Shield, Check, X, RefreshCw, Play, Save, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

type BotId = 'manual' | 'swing' | 'longterm' | 'options-sell' | 'options-buy';
type Action = 'BUY' | 'SELL' | 'ACCUMULATE';
type Segment = 'equity-delivery' | 'equity-intraday' | 'options' | 'futures';

interface ValidatorResult {
  accepted: boolean;
  reasons: string[];
  checks: Record<string, any>;
  setupId?: string | null;
  complianceEventId?: string | null;
}
interface HistoryEvent {
  _id: string;
  botId: BotId;
  decision: 'accepted' | 'rejected' | 'evaluated';
  symbol: string;
  action: string;
  quantity: number;
  reasoning: string;
  reasons: string[];
  at: string;
}

function fmtTime(iso: string): string {
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

export default function ValidatorPanel() {
  const [form, setForm] = useState({
    botId: 'manual' as BotId,
    symbol: '',
    action: 'BUY' as Action,
    qty: 0,
    entryPrice: 0,
    stopLoss: 0,
    target: 0,
    sector: 'Unclassified',
    segment: 'equity-delivery' as Segment,
    liquidityBand: 'MID' as 'LARGE' | 'MID' | 'SMALL' | 'ILLIQUID' | 'OPTIONS',
    allowOffHours: true,
    reasoning: '',
  });
  const [result, setResult] = useState<ValidatorResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChecks, setShowChecks] = useState(false);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/validator/history?limit=10`);
      const j = await res.json();
      if (j.status === 'success') setHistory(j.data || []);
    } catch { /* non-critical */ }
  };

  useEffect(() => { fetchHistory(); }, []);

  const run = async (persist: boolean) => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/validator/validate?persist=${persist}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.status === 'success') setResult(j.data);
      else setError(j.message || 'Validation failed');
      await fetchHistory();
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            Validator
          </h3>
          <span className="text-[11px] text-gray-500">Pre-flight gate — run a candidate through every risk check</span>
        </div>
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="text-[11px] px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          title="Toggle recent validations"
        >
          {historyOpen ? 'Hide' : 'Show'} history ({history.length})
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Bot</label>
          <select value={form.botId} onChange={(e) => setForm({...form, botId: e.target.value as BotId})}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded">
            <option value="manual">Manual</option>
            <option value="swing">Swing</option>
            <option value="longterm">Long-term</option>
            <option value="options-sell">Options Sell</option>
            <option value="options-buy">Options Buy</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Symbol</label>
          <input type="text" value={form.symbol}
            onChange={(e) => setForm({...form, symbol: e.target.value.toUpperCase()})}
            placeholder="RELIANCE"
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded font-mono-nums" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Side</label>
          <select value={form.action} onChange={(e) => setForm({...form, action: e.target.value as Action})}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded">
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="ACCUMULATE">ACCUMULATE</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Qty</label>
          <input type="number" min={0} value={form.qty || ''}
            onChange={(e) => setForm({...form, qty: Math.max(0, Number(e.target.value) || 0)})}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded font-mono-nums" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Entry ₹</label>
          <input type="number" min={0} step={0.05} value={form.entryPrice || ''}
            onChange={(e) => setForm({...form, entryPrice: Number(e.target.value) || 0})}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded font-mono-nums" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Stop ₹</label>
          <input type="number" min={0} step={0.05} value={form.stopLoss || ''}
            onChange={(e) => setForm({...form, stopLoss: Number(e.target.value) || 0})}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded font-mono-nums" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Target ₹</label>
          <input type="number" min={0} step={0.05} value={form.target || ''}
            onChange={(e) => setForm({...form, target: Number(e.target.value) || 0})}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded font-mono-nums" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Sector</label>
          <input type="text" value={form.sector}
            onChange={(e) => setForm({...form, sector: e.target.value})}
            placeholder="Banking"
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Segment</label>
          <select value={form.segment} onChange={(e) => setForm({...form, segment: e.target.value as Segment})}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded">
            <option value="equity-delivery">Delivery</option>
            <option value="equity-intraday">Intraday</option>
            <option value="options">Options</option>
            <option value="futures">Futures</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Liquidity</label>
          <select value={form.liquidityBand} onChange={(e) => setForm({...form, liquidityBand: e.target.value as any})}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded">
            <option value="LARGE">Large (2bps)</option>
            <option value="MID">Mid (5bps)</option>
            <option value="SMALL">Small (15bps)</option>
            <option value="ILLIQUID">Illiquid (40bps)</option>
            <option value="OPTIONS">Options (10bps)</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Reasoning (optional)</label>
          <input type="text" value={form.reasoning}
            onChange={(e) => setForm({...form, reasoning: e.target.value})}
            placeholder="Strategy explanation — goes into compliance log"
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => run(false)}
          disabled={running || !form.symbol || !form.qty || !form.entryPrice || !form.stopLoss || !form.target}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Validate (dry run)
        </button>
        <button
          onClick={() => run(true)}
          disabled={running || !result?.accepted}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40"
          title={result?.accepted ? 'Save as paper trade' : 'Run validation first — must be accepted'}
        >
          <Save className="w-4 h-4" />
          Save as Paper Trade
        </button>
        <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400 ml-2">
          <input type="checkbox" checked={form.allowOffHours}
            onChange={(e) => setForm({...form, allowOffHours: e.target.checked})} />
          allow off-hours
        </label>
      </div>

      {/* Result panel */}
      {error && (
        <div className="mb-3 px-2.5 py-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-700 dark:text-red-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {result && (
        <div className={`rounded-md border-2 p-3 mb-3 ${
          result.accepted
            ? 'bg-green-50/60 dark:bg-green-900/20 border-green-300 dark:border-green-700'
            : 'bg-red-50/60 dark:bg-red-900/20 border-red-300 dark:border-red-700'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              {result.accepted ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" /> : <X className="w-4 h-4 text-red-600 dark:text-red-400" />}
              <span className={`text-sm font-bold uppercase ${result.accepted ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {result.accepted ? 'Accepted' : 'Rejected'}
              </span>
              {result.setupId && (
                <span className="text-[10px] text-green-700 dark:text-green-400 font-mono-nums">
                  · setupId {String(result.setupId).slice(-6)}
                </span>
              )}
            </div>
            <button onClick={() => setShowChecks(!showChecks)}
              className="text-[11px] text-gray-600 dark:text-gray-400 hover:text-gray-900 flex items-center gap-0.5">
              {showChecks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showChecks ? 'Hide' : 'Show'} gate snapshot
            </button>
          </div>
          {result.reasons.length > 0 && (
            <ul className="text-[11px] text-gray-800 dark:text-gray-200 space-y-0.5 list-disc list-inside">
              {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {result.accepted && (
            <div className="text-[11px] text-gray-700 dark:text-gray-300">
              All gates passed. {result.setupId ? 'Trade setup persisted and visible in Paper Trading tab.' : 'Click "Save as Paper Trade" to persist.'}
            </div>
          )}
          {showChecks && result.checks && (
            <pre className="mt-2 text-[10px] bg-white/70 dark:bg-black/30 rounded p-2 overflow-x-auto font-mono-nums">
{JSON.stringify(result.checks, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Recent validations */}
      {historyOpen && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1.5">Recent validations</div>
          {history.length === 0 ? (
            <div className="text-[11px] text-gray-500 italic">No validations yet — submit one above.</div>
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {history.map((e) => (
                <div key={e._id} className="flex items-center gap-2 text-[10px] py-0.5">
                  <span className={`px-1 py-0 rounded font-bold uppercase ${
                    e.decision === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                    e.decision === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>{e.decision}</span>
                  <span className="font-mono-nums text-gray-700 dark:text-gray-300">{e.botId}</span>
                  <span className="font-semibold font-mono-nums text-gray-900 dark:text-gray-100">{e.symbol || '—'}</span>
                  <span className="text-gray-500">{e.action} {e.quantity || ''}</span>
                  <span className="text-gray-500 truncate flex-1" title={[e.reasoning, ...(e.reasons || [])].filter(Boolean).join(' · ')}>
                    {(e.reasons && e.reasons.length > 0) ? e.reasons[0] : (e.reasoning || '—')}
                  </span>
                  <span className="text-gray-400 shrink-0">{fmtTime(e.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
