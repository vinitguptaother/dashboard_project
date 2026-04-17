'use client';

/**
 * TradePreviewCard — real-world cost + slippage preview for a prospective
 * paper trade. Calls /api/paper-realism/preview with current form values
 * (debounced) and renders:
 *   • Entry fill (after slippage)
 *   • At-Target and At-Stop: gross, charges, net, ROI
 *   • Break-even price
 *   • Entry + exit cost breakdown (expandable)
 *
 * BOT_BLUEPRINT #9 — Phase 2 UI.
 */

import { useEffect, useState } from 'react';
import { Sparkles, AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

type Segment = 'equity-delivery' | 'equity-intraday' | 'options' | 'futures';
type Side = 'BUY' | 'SELL';
type Band = 'LARGE' | 'MID' | 'SMALL' | 'ILLIQUID' | 'OPTIONS';

interface Props {
  segment: Segment;
  entrySide: Side;
  qty: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  liquidityBand?: Band;
  compact?: boolean;
}

interface LegCosts {
  brokerage: number; stt: number; exchangeTxn: number; sebi: number;
  stampDuty: number; gst: number; dp: number; total: number; notional: number;
}
interface Outcome {
  grossPnL: number; totalCharges: number; netPnL: number; roiPct: number;
  entryCosts: LegCosts; exitCosts: LegCosts;
}
interface Preview {
  slippagePreview: {
    entry: { fillPrice: number; slippageBps: number; band: string };
    targetFill: { fillPrice: number };
    stopFill: { fillPrice: number };
  };
  atTarget: Outcome;
  atStop: Outcome;
  breakEven: number;
  notes: { segment: string; liquidityBand: string; slippageBps: number; latencyMs: number };
}

function cr(n: number): string {
  const sign = n < 0 ? '−' : n > 0 ? '+' : '';
  const abs = Math.abs(n);
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000)   return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  return `${sign}₹${abs.toFixed(2)}`;
}

function cellBg(n: number): string {
  if (n > 0)  return 'text-green-700 dark:text-green-400';
  if (n < 0)  return 'text-red-700 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-300';
}

export default function TradePreviewCard({
  segment, entrySide, qty, entryPrice, stopLoss, target,
  liquidityBand = 'MID', compact = false,
}: Props) {
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expand, setExpand] = useState(false);

  useEffect(() => {
    if (!qty || !entryPrice || !stopLoss || !target) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/paper-realism/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment, entrySide, qty, entryPrice, stopLoss, target, liquidityBand }),
        });
        const json = await res.json();
        if (json.status === 'success') { setData(json.data); setError(null); }
        else { setError(json.message || 'preview failed'); setData(null); }
      } catch (e: any) {
        setError(e.message || 'network error');
        setData(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [segment, entrySide, qty, entryPrice, stopLoss, target, liquidityBand]);

  if (!qty) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 text-[11px] text-gray-500 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        Enter quantity to preview real-world costs & net P&L.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-[11px] text-gray-500 flex items-center gap-1.5">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Computing preview…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 p-3 text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" /> Preview error: {error}
      </div>
    );
  }

  if (!data) return null;

  const { atTarget, atStop, slippagePreview, breakEven, notes } = data;

  return (
    <div className="rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Pre-trade Preview · Realism Engine
          </span>
        </div>
        <div className="text-[10px] text-gray-500 font-mono-nums">
          {notes.liquidityBand} · {notes.slippageBps}bps · ~{notes.latencyMs}ms
        </div>
      </div>

      {/* Fills */}
      <div className="grid grid-cols-3 gap-2 mb-2 text-center">
        <div className="bg-white/70 dark:bg-black/20 rounded px-2 py-1.5">
          <div className="text-[9px] uppercase text-gray-500">Entry fill</div>
          <div className="text-[12px] font-bold font-mono-nums text-gray-900 dark:text-gray-100">₹{slippagePreview.entry.fillPrice.toFixed(2)}</div>
        </div>
        <div className="bg-white/70 dark:bg-black/20 rounded px-2 py-1.5">
          <div className="text-[9px] uppercase text-green-600 dark:text-green-400">Target exit</div>
          <div className="text-[12px] font-bold font-mono-nums text-green-700 dark:text-green-400">₹{slippagePreview.targetFill.fillPrice.toFixed(2)}</div>
        </div>
        <div className="bg-white/70 dark:bg-black/20 rounded px-2 py-1.5">
          <div className="text-[9px] uppercase text-red-600 dark:text-red-400">Stop exit</div>
          <div className="text-[12px] font-bold font-mono-nums text-red-700 dark:text-red-400">₹{slippagePreview.stopFill.fillPrice.toFixed(2)}</div>
        </div>
      </div>

      {/* P&L outcomes */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-green-100/70 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5">
          <div className="text-[9px] uppercase font-bold text-green-700 dark:text-green-400 mb-0.5">At target</div>
          <div className="text-[13px] font-bold font-mono-nums">
            <span className={cellBg(atTarget.netPnL)}>{cr(atTarget.netPnL)}</span>
            <span className="ml-1 text-[10px] text-gray-500">net · {atTarget.roiPct.toFixed(2)}%</span>
          </div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-mono-nums">
            gross {cr(atTarget.grossPnL)} · chg {cr(atTarget.totalCharges)}
          </div>
        </div>
        <div className="bg-red-100/70 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded px-2 py-1.5">
          <div className="text-[9px] uppercase font-bold text-red-700 dark:text-red-400 mb-0.5">At stop</div>
          <div className="text-[13px] font-bold font-mono-nums">
            <span className={cellBg(atStop.netPnL)}>{cr(atStop.netPnL)}</span>
            <span className="ml-1 text-[10px] text-gray-500">net · {atStop.roiPct.toFixed(2)}%</span>
          </div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-mono-nums">
            gross {cr(atStop.grossPnL)} · chg {cr(atStop.totalCharges)}
          </div>
        </div>
      </div>

      {/* Break-even */}
      <div className="bg-white/70 dark:bg-black/20 rounded px-2 py-1.5 text-[11px] flex items-center justify-between">
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Break-even:</span> price must cross
        </span>
        <span className="font-bold font-mono-nums text-amber-700 dark:text-amber-400">₹{breakEven.toFixed(2)}</span>
      </div>

      {/* Expandable cost breakdown */}
      {!compact && (
        <>
          <button
            onClick={() => setExpand(!expand)}
            className="mt-2 flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {expand ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expand ? 'Hide' : 'Show'} cost breakdown
          </button>

          {expand && (
            <div className="mt-1.5 bg-white/60 dark:bg-black/20 rounded p-2 text-[10px] font-mono-nums">
              <div className="grid grid-cols-[auto,1fr,1fr] gap-x-3 gap-y-0.5">
                <div className="font-bold text-gray-600 dark:text-gray-400">&nbsp;</div>
                <div className="font-bold text-gray-600 dark:text-gray-400 text-right">Entry</div>
                <div className="font-bold text-gray-600 dark:text-gray-400 text-right">Exit (tgt)</div>

                <div className="text-gray-500">Brokerage</div>
                <div className="text-right">{cr(atTarget.entryCosts.brokerage)}</div>
                <div className="text-right">{cr(atTarget.exitCosts.brokerage)}</div>

                <div className="text-gray-500">STT</div>
                <div className="text-right">{cr(atTarget.entryCosts.stt)}</div>
                <div className="text-right">{cr(atTarget.exitCosts.stt)}</div>

                <div className="text-gray-500">Exchange</div>
                <div className="text-right">{cr(atTarget.entryCosts.exchangeTxn)}</div>
                <div className="text-right">{cr(atTarget.exitCosts.exchangeTxn)}</div>

                <div className="text-gray-500">SEBI</div>
                <div className="text-right">{cr(atTarget.entryCosts.sebi)}</div>
                <div className="text-right">{cr(atTarget.exitCosts.sebi)}</div>

                <div className="text-gray-500">Stamp duty</div>
                <div className="text-right">{cr(atTarget.entryCosts.stampDuty)}</div>
                <div className="text-right">{cr(atTarget.exitCosts.stampDuty)}</div>

                <div className="text-gray-500">GST (18%)</div>
                <div className="text-right">{cr(atTarget.entryCosts.gst)}</div>
                <div className="text-right">{cr(atTarget.exitCosts.gst)}</div>

                <div className="text-gray-500">DP charges</div>
                <div className="text-right">{cr(atTarget.entryCosts.dp)}</div>
                <div className="text-right">{cr(atTarget.exitCosts.dp)}</div>

                <div className="font-bold text-gray-700 dark:text-gray-300 border-t border-gray-300 dark:border-gray-600 pt-0.5 mt-0.5">Total</div>
                <div className="text-right font-bold border-t border-gray-300 dark:border-gray-600 pt-0.5 mt-0.5">{cr(atTarget.entryCosts.total)}</div>
                <div className="text-right font-bold border-t border-gray-300 dark:border-gray-600 pt-0.5 mt-0.5">{cr(atTarget.exitCosts.total)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
