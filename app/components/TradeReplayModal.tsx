'use client';

// app/components/TradeReplayModal.tsx
// Trade Replay / Post-Trade Review modal — opens from the Journal.
// Shows: original setup, market context at entry, price path, what happened,
// and a "better action" insights panel.

import { useEffect, useState } from 'react';
import { X, PlayCircle, TrendingUp, TrendingDown, Info, AlertTriangle, Rewind, Target, Ban } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

interface PricePoint { date: string; open: number | null; close: number; high: number | null; low: number | null; volume: number; }

interface ReplayData {
  trade: {
    _id: string;
    symbol: string;
    action: string;
    tradeType: string;
    entryPrice: number;
    stopLoss: number;
    target: number;
    exitPrice: number | null;
    status: string;
    confidence: number;
    reasoning: string;
    riskFactors: string[];
    riskRewardRatio: string;
    holdingDuration: string;
    createdAt: string;
    closedAt: string | null;
    isPaperTrade: boolean;
  };
  screenContext: {
    screenName: string;
    runDate: string;
    totalStocks: number;
    rankAtEntry: number | null;
  } | null;
  marketContext: {
    openPrice: number;
    closePrice: number;
    returnPct: number;
    trend: string;
    days: number;
    dateFrom: string;
    dateTo: string;
  } | null;
  pricePath: PricePoint[];
  pathAnalysis: {
    outcome: string;
    targetHitDate: string | null;
    slHitDate: string | null;
    maxPrice: number | null;
    minPrice: number | null;
    lastClose: number | null;
    maxProfitAvailablePct: number | null;
    actualPnlPct: number | null;
    daysInTrade: number;
  };
  insights: { level: string; text: string }[];
}

interface Props {
  tradeId: string;
  onClose: () => void;
}

function outcomeBadge(outcome: string) {
  switch (outcome) {
    case 'target_hit':
    case 'target_hit_first':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-500/10 text-green-500 border border-green-500/30">
          <Target className="w-3 h-3" /> Target Hit
        </span>
      );
    case 'sl_hit':
    case 'sl_hit_first':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/30">
          <Ban className="w-3 h-3" /> SL Hit
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-500/10 text-gray-500 border border-gray-500/30">
          Open
        </span>
      );
  }
}

// Tiny inline SVG line chart — no chart lib, just raw paths
function MiniChart({
  data, entry, sl, target, isBuy,
}: { data: PricePoint[]; entry: number; sl: number; target: number; isBuy: boolean }) {
  if (data.length < 2) return <div className="text-xs text-gray-400 italic">Not enough data for chart.</div>;

  const W = 720, H = 200, padL = 40, padR = 20, padT = 10, padB = 20;
  const closes = data.map((d) => d.close);
  const min = Math.min(...closes, sl, target, entry) * 0.99;
  const max = Math.max(...closes, sl, target, entry) * 1.01;
  const xStep = (W - padL - padR) / (data.length - 1);
  const yScale = (p: number) => padT + ((max - p) / (max - min)) * (H - padT - padB);

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${(padL + i * xStep).toFixed(1)} ${yScale(d.close).toFixed(1)}`)
    .join(' ');

  const lineColor = isBuy
    ? (data[data.length - 1].close >= entry ? '#22c55e' : '#ef4444')
    : (data[data.length - 1].close <= entry ? '#22c55e' : '#ef4444');

  return (
    <div className="w-full overflow-x-auto">
      <svg width={W} height={H} className="bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
        {/* Entry line */}
        <line x1={padL} x2={W - padR} y1={yScale(entry)} y2={yScale(entry)}
              stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" />
        <text x={padL + 4} y={yScale(entry) - 3} fontSize="10" fill="#3b82f6">Entry ₹{entry}</text>

        {/* Target line */}
        <line x1={padL} x2={W - padR} y1={yScale(target)} y2={yScale(target)}
              stroke="#22c55e" strokeWidth="1" strokeDasharray="4 2" />
        <text x={padL + 4} y={yScale(target) - 3} fontSize="10" fill="#22c55e">Target ₹{target}</text>

        {/* SL line */}
        <line x1={padL} x2={W - padR} y1={yScale(sl)} y2={yScale(sl)}
              stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2" />
        <text x={padL + 4} y={yScale(sl) - 3} fontSize="10" fill="#ef4444">SL ₹{sl}</text>

        {/* Y axis labels */}
        <text x={4} y={yScale(max) + 10} fontSize="9" fill="#9ca3af">₹{max.toFixed(0)}</text>
        <text x={4} y={yScale(min)} fontSize="9" fill="#9ca3af">₹{min.toFixed(0)}</text>

        {/* Price path */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="1.5" />

        {/* Date labels */}
        <text x={padL} y={H - 4} fontSize="9" fill="#9ca3af">{data[0].date}</text>
        <text x={W - padR - 50} y={H - 4} fontSize="9" fill="#9ca3af">{data[data.length - 1].date}</text>
      </svg>
    </div>
  );
}

export default function TradeReplayModal({ tradeId, onClose }: Props) {
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/trade-replay/${tradeId}`);
        const json = await res.json();
        if (!alive) return;
        if (json.status === 'success') setReplay(json.data);
        else setError(json.message || 'Failed to load replay');
      } catch (e: any) {
        if (alive) setError(e?.message || 'Network error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tradeId]);

  const isBuy = replay ? (replay.trade.action === 'BUY' || replay.trade.action === 'ACCUMULATE') : true;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Rewind className="w-5 h-5 text-blue-500" />
            <div>
              <div className="text-lg font-bold text-gray-800 dark:text-gray-100">
                Trade Replay{replay ? `: ${replay.trade.symbol}` : ''}
              </div>
              <div className="text-[11px] text-gray-500">Post-trade review and learning insights</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <PlayCircle className="w-4 h-4 animate-pulse" /> Loading replay…
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
              {error}
            </div>
          )}

          {replay && (
            <>
              {/* Trade summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-500 text-[10px] uppercase">Action</div>
                  <div className={`font-semibold ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                    {replay.trade.action} <span className="text-gray-400 font-normal">/ {replay.trade.tradeType}</span>
                  </div>
                </div>
                <div className="p-2 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-500 text-[10px] uppercase">Entry → Target / SL</div>
                  <div className="font-mono text-gray-700 dark:text-gray-200">
                    ₹{replay.trade.entryPrice} → <span className="text-green-500">₹{replay.trade.target}</span> / <span className="text-red-500">₹{replay.trade.stopLoss}</span>
                  </div>
                </div>
                <div className="p-2 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-500 text-[10px] uppercase">Confidence / RR</div>
                  <div className="text-gray-700 dark:text-gray-200">
                    {replay.trade.confidence}% <span className="text-gray-400 mx-1">•</span> {replay.trade.riskRewardRatio || '—'}
                  </div>
                </div>
                <div className="p-2 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-500 text-[10px] uppercase">Status / Outcome</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-700 dark:text-gray-200">{replay.trade.status}</span>
                    {outcomeBadge(replay.pathAnalysis.outcome)}
                  </div>
                </div>
              </div>

              {/* Entry context */}
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Entry Context</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-500 mb-1">AI Reasoning at entry</div>
                    <div className="text-gray-700 dark:text-gray-300 italic">
                      {replay.trade.reasoning || '—'}
                    </div>
                    {replay.trade.riskFactors?.length > 0 && (
                      <>
                        <div className="text-gray-500 mt-2 mb-1">Risk factors flagged</div>
                        <ul className="list-disc list-inside text-gray-600 dark:text-gray-300">
                          {replay.trade.riskFactors.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </>
                    )}
                  </div>
                  <div>
                    {replay.screenContext && (
                      <>
                        <div className="text-gray-500 mb-1">Screen</div>
                        <div className="text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">{replay.screenContext.screenName}</span>
                          {replay.screenContext.rankAtEntry !== null && (
                            <span className="ml-2 text-gray-400">
                              (ranked #{replay.screenContext.rankAtEntry} of {replay.screenContext.totalStocks})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Run: {new Date(replay.screenContext.runDate).toLocaleDateString('en-IN')}
                        </div>
                      </>
                    )}
                    {replay.marketContext && (
                      <div className="mt-3">
                        <div className="text-gray-500 mb-1">NIFTY during trade</div>
                        <div className="flex items-center gap-2">
                          {replay.marketContext.trend === 'bullish' ? (
                            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                          ) : replay.marketContext.trend === 'bearish' ? (
                            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <span className="w-3.5 h-3.5 inline-block text-center text-gray-400">↔</span>
                          )}
                          <span className="text-gray-700 dark:text-gray-300">
                            {replay.marketContext.returnPct >= 0 ? '+' : ''}
                            {replay.marketContext.returnPct}% over {replay.marketContext.days}d
                          </span>
                          <span className={`text-[10px] uppercase font-semibold ${
                            replay.marketContext.trend === 'bullish' ? 'text-green-500'
                            : replay.marketContext.trend === 'bearish' ? 'text-red-500'
                            : 'text-gray-500'
                          }`}>
                            {replay.marketContext.trend}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Price Path ({replay.pathAnalysis.daysInTrade} trading days)
                </div>
                <MiniChart
                  data={replay.pricePath}
                  entry={replay.trade.entryPrice}
                  sl={replay.trade.stopLoss}
                  target={replay.trade.target}
                  isBuy={isBuy}
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[11px]">
                  <div className="p-2 rounded bg-gray-50 dark:bg-gray-800/40">
                    <div className="text-gray-500">Max price</div>
                    <div className="font-mono text-green-500">
                      {replay.pathAnalysis.maxPrice != null ? `₹${replay.pathAnalysis.maxPrice}` : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-gray-50 dark:bg-gray-800/40">
                    <div className="text-gray-500">Min price</div>
                    <div className="font-mono text-red-500">
                      {replay.pathAnalysis.minPrice != null ? `₹${replay.pathAnalysis.minPrice}` : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-gray-50 dark:bg-gray-800/40">
                    <div className="text-gray-500">Max available profit</div>
                    <div className={`font-mono ${(replay.pathAnalysis.maxProfitAvailablePct ?? 0) > 0 ? 'text-green-500' : 'text-gray-400'}`}>
                      {replay.pathAnalysis.maxProfitAvailablePct != null ? `${replay.pathAnalysis.maxProfitAvailablePct}%` : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-gray-50 dark:bg-gray-800/40">
                    <div className="text-gray-500">Actual P&amp;L</div>
                    <div className={`font-mono ${(replay.pathAnalysis.actualPnlPct ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {replay.pathAnalysis.actualPnlPct != null ? `${replay.pathAnalysis.actualPnlPct}%` : '—'}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                  {replay.pathAnalysis.targetHitDate && (
                    <span className="text-green-500">Target touched: {replay.pathAnalysis.targetHitDate}</span>
                  )}
                  {replay.pathAnalysis.slHitDate && (
                    <span className="text-red-500">SL touched: {replay.pathAnalysis.slHitDate}</span>
                  )}
                </div>
              </div>

              {/* Insights */}
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> What would have been the better action?
                </div>
                {replay.insights.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">
                    No specific learning insights — this trade followed the plan cleanly.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {replay.insights.map((ins, i) => (
                      <li
                        key={i}
                        className={`flex items-start gap-2 p-2 rounded border text-xs ${
                          ins.level === 'error' ? 'border-red-500/30 bg-red-500/5 text-red-400'
                          : ins.level === 'warning' ? 'border-amber-500/30 bg-amber-500/5 text-amber-400'
                          : 'border-blue-500/30 bg-blue-500/5 text-blue-400'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{ins.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
