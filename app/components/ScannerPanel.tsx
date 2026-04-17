'use client';

/**
 * ScannerPanel — one-click bot entry-point.
 *
 * BOT_BLUEPRINT item #5. Pulls top-N candidates from the latest ScreenBatch
 * of a user-selected screen, builds rule-based levels, and submits them all
 * through the Validator (#6). Shows:
 *   • Which screens are eligible (has batches)
 *   • Running progress (N candidates being validated)
 *   • Accepted vs rejected summary with top-rejection-reason
 *   • Individual result cards per candidate (accepted or reasons)
 *   • "Save all accepted" button → persists every accepted candidate
 *
 * This is the paper-trading loop prototype. When Sprint 4+ bots ship, they
 * call the same /api/scanner/scan-screen endpoint on a cron.
 */

import { useEffect, useState } from 'react';
import { Radar, Play, Save, Check, X, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

type BotId = 'manual' | 'swing' | 'longterm' | 'options-sell' | 'options-buy';
type Band = 'LARGE' | 'MID' | 'SMALL' | 'ILLIQUID' | 'OPTIONS';

interface ScreenOpt {
  _id: string;
  name: string;
  description?: string;
  status: string;
  performanceScore?: number;
  avgHitRate?: number;
  avgReturn?: number;
  totalBatches?: number;
}

interface CandidateResult {
  candidate: {
    botId: BotId;
    symbol: string;
    action: string;
    qty: number;
    entryPrice: number;
    stopLoss: number;
    target: number;
    sector: string;
  };
  result: {
    accepted: boolean;
    reasons: string[];
    setupId?: string | null;
  };
}

interface ScanResponse {
  screen: { id: string; name: string };
  batch: { id: string; runDate: string; symbolCount: number } | null;
  candidates: CandidateResult[];
  summary: { scanned: number; accepted: number; rejected: number; reasons: Record<string, number>; topReason: string | null };
  botId: BotId;
  error?: string;
}

export default function ScannerPanel() {
  const [screens, setScreens] = useState<ScreenOpt[]>([]);
  const [screenId, setScreenId] = useState('');
  const [botId, setBotId] = useState<BotId>('swing');
  const [topN, setTopN] = useState(5);
  const [liquidityBand, setLiquidityBand] = useState<Band>('MID');
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchScreens = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/scanner/screens`);
      const j = await res.json();
      if (j.status === 'success') {
        setScreens(j.data || []);
        if (!screenId && j.data?.length > 0) setScreenId(j.data[0]._id);
      }
    } catch { /* non-critical */ }
  };

  useEffect(() => { fetchScreens(); }, []);

  const runScan = async (persistAccepted: boolean) => {
    if (!screenId) { setError('Select a screen first'); return; }
    if (persistAccepted) setPersisting(true); else setRunning(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/scanner/scan-screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenId, botId, topN, liquidityBand, persistAccepted }),
      });
      const j = await res.json();
      if (j.status === 'success') setResult(j.data);
      else setError(j.message || 'Scan failed');
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setRunning(false); setPersisting(false);
    }
  };

  const toggleExpand = (sym: string) => {
    const ns = new Set(expanded);
    if (ns.has(sym)) ns.delete(sym); else ns.add(sym);
    setExpanded(ns);
  };

  return (
    <div className="rounded-xl border-2 border-teal-200 dark:border-teal-800 bg-white dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
            Scanner
          </h3>
          <span className="text-[11px] text-gray-500">
            Bot entry-point — pull top-N from latest screen batch + validate
          </span>
        </div>
        <button onClick={fetchScreens} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Refresh screen list">
          <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
        <div className="col-span-2">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Screen</label>
          <select value={screenId} onChange={(e) => setScreenId(e.target.value)}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded">
            <option value="">— select —</option>
            {screens.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}{s.totalBatches ? ` (${s.totalBatches} batches)` : ''}
                {s.avgHitRate != null ? ` · hit ${s.avgHitRate.toFixed(0)}%` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Bot</label>
          <select value={botId} onChange={(e) => setBotId(e.target.value as BotId)}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded">
            <option value="swing">Swing</option>
            <option value="longterm">Long-term</option>
            <option value="manual">Manual</option>
            <option value="options-buy">Options Buy</option>
            <option value="options-sell">Options Sell</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Top N</label>
          <input type="number" min={1} max={20} value={topN}
            onChange={(e) => setTopN(Math.min(20, Math.max(1, Number(e.target.value) || 5)))}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded font-mono-nums" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-500">Liquidity</label>
          <select value={liquidityBand} onChange={(e) => setLiquidityBand(e.target.value as Band)}
            className="w-full px-1.5 py-1 text-sm border border-gray-300 rounded">
            <option value="LARGE">Large (2bps)</option>
            <option value="MID">Mid (5bps)</option>
            <option value="SMALL">Small (15bps)</option>
            <option value="ILLIQUID">Illiquid (40bps)</option>
            <option value="OPTIONS">Options (10bps)</option>
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => runScan(false)}
          disabled={running || persisting || !screenId}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Scan + Validate (dry run)
        </button>
        <button
          onClick={() => runScan(true)}
          disabled={running || persisting || !screenId}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          title="Scan + persist every accepted candidate as paper trade"
        >
          {persisting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Scan + Save Accepted
        </button>
      </div>

      {error && (
        <div className="mb-3 px-2.5 py-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-700 dark:text-red-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {result?.error && !result.candidates.length && (
        <div className="mb-3 px-2.5 py-1.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[12px] text-amber-800 dark:text-amber-300">
          {result.error}
        </div>
      )}

      {/* Summary + results */}
      {result && result.candidates.length > 0 && (
        <>
          {/* Summary card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <StatCell label="Scanned" value={result.summary.scanned} color="text-gray-900 dark:text-gray-100" />
            <StatCell label="Accepted" value={result.summary.accepted} color="text-green-600" />
            <StatCell label="Rejected" value={result.summary.rejected} color="text-red-600" />
            <StatCell
              label="Top rejection"
              value={result.summary.topReason ? result.summary.reasons[result.summary.topReason] : 0}
              color="text-amber-600"
              subtitle={result.summary.topReason ? result.summary.topReason.slice(0, 40) + (result.summary.topReason.length > 40 ? '…' : '') : '—'}
            />
          </div>

          {/* Per-candidate result list */}
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Candidates · {result.screen.name} · {botId}
          </div>
          <div className="space-y-1">
            {result.candidates.map((cr) => {
              const c = cr.candidate;
              const r = cr.result;
              const exp = expanded.has(c.symbol);
              return (
                <div
                  key={c.symbol}
                  className={`rounded border px-2.5 py-1.5 ${
                    r.accepted
                      ? 'bg-green-50/60 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : 'bg-red-50/40 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[12px] flex-wrap">
                    {r.accepted ? <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> : <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                    <span className="font-mono-nums font-bold text-gray-900 dark:text-gray-100 min-w-[80px]">{c.symbol}</span>
                    <span className="text-gray-600 dark:text-gray-400 font-mono-nums">
                      {c.action} {c.qty} @ ₹{c.entryPrice} · SL ₹{c.stopLoss} · T ₹{c.target}
                    </span>
                    <span className="text-[10px] text-gray-500 flex-1 truncate">
                      {r.accepted
                        ? (r.setupId ? `✓ Saved · ${String(r.setupId).slice(-6)}` : 'Accepted (dry run)')
                        : r.reasons[0]}
                    </span>
                    {!r.accepted && r.reasons.length > 1 && (
                      <button onClick={() => toggleExpand(c.symbol)} className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center">
                        {exp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        +{r.reasons.length - 1}
                      </button>
                    )}
                  </div>
                  {exp && !r.accepted && (
                    <ul className="mt-1 ml-5 text-[10px] text-gray-700 dark:text-gray-300 list-disc">
                      {r.reasons.slice(1).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {result.summary.rejected > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-400">
              <strong className="text-gray-800 dark:text-gray-200">Rejection breakdown:</strong>{' '}
              {Object.entries(result.summary.reasons)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([reason, n], i) => (
                  <span key={i} className="inline-block mr-2">
                    <span className="font-mono-nums">{n}×</span> {reason.slice(0, 60)}{reason.length > 60 ? '…' : ''}
                  </span>
                ))}
            </div>
          )}
        </>
      )}

      <div className="mt-3 text-[10px] text-gray-500">
        Rule-based levels: swing 5%SL / 1:2 R:R · longterm 12%SL / 1:3 R:R. For AI-computed levels, use Trade Setup Generate (Perplexity flow) instead.
      </div>
    </div>
  );
}

function StatCell({ label, value, color, subtitle }: { label: string; value: number; color: string; subtitle?: string }) {
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 p-2 text-center">
      <div className="text-[9px] uppercase text-gray-500 mb-0.5">{label}</div>
      <div className={`text-xl font-bold font-mono-nums ${color}`}>{value}</div>
      {subtitle && <div className="text-[9px] text-gray-500 mt-0.5 truncate" title={subtitle}>{subtitle}</div>}
    </div>
  );
}
