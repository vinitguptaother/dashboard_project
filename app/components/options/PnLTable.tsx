'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BACKEND_URL } from './constants';
import { StrategyLeg } from './types';

interface PnLGridData {
  spotPrices: number[];
  daysRemaining: number[];
  grid: number[][];
}

interface Props {
  legs: StrategyLeg[];
  spotPrice: number;
  daysToExpiry: number;
}

type Mode = 'sd' | 'percent';

// Fixed-% offsets for % mode — from +5% down to -5%
// Order matters: renders as rows top-to-bottom (gain at top, loss at bottom)
const PERCENT_OFFSETS = [5, 2, 1, 0, -1, -2, -5];

export default function PnLTable({ legs, spotPrice, daysToExpiry }: Props) {
  const [data, setData] = useState<PnLGridData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('sd');

  // Precompute % mode spot array so we can label rows consistently
  const percentSpots = useMemo(() => {
    if (!spotPrice) return [] as number[];
    return PERCENT_OFFSETS.map(pct => spotPrice * (1 + pct / 100));
  }, [spotPrice]);

  useEffect(() => {
    if (!legs.length || !spotPrice || daysToExpiry <= 0) {
      setData(null);
      return;
    }

    const fetchGrid = async () => {
      setLoading(true);
      try {
        const body: any = {
          legs: legs.map(l => ({
            type: l.type, strike: l.strike, premium: l.premium,
            qty: l.qty, side: l.side, lotSize: l.lotSize, iv: l.iv || 0.15,
          })),
          spotPrice,
          daysToExpiry,
        };

        if (mode === 'percent') {
          body.customSpots = percentSpots;
        } else {
          body.spotSteps = 13;
        }

        const res = await fetch(`${BACKEND_URL}/api/options/payoff-grid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.status === 'success') setData(json.data);
      } catch (e) {
        console.error('P&L grid error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchGrid();
  }, [legs, spotPrice, daysToExpiry, mode, percentSpots]);

  const formatPnL = (val: number) => {
    if (Math.abs(val) >= 100000) return (val / 100000).toFixed(1) + 'L';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'K';
    return val.toFixed(0);
  };

  const formatSpot = (val: number) => val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // In % mode, the row label is "+X%" derived from the fixed offsets
  const formatRowLabel = (spot: number, rowIdx: number): { main: string; sub?: string } => {
    if (mode === 'percent' && rowIdx < PERCENT_OFFSETS.length) {
      const pct = PERCENT_OFFSETS[rowIdx];
      return {
        main: pct === 0 ? 'Spot' : `${pct > 0 ? '+' : ''}${pct}%`,
        sub: formatSpot(spot),
      };
    }
    return { main: formatSpot(spot) };
  };

  return (
    <div className="p-4">
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">P&L Scenarios</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            {mode === 'sd'
              ? 'Spot rows span ±2 SD from current (IV-based)'
              : 'Spot rows are fixed percentages: ±5%, ±2%, ±1%, 0'}
          </p>
        </div>
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'sd'}
            onClick={() => setMode('sd')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'sd'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
            title="Standard Deviation mode — uses IV-implied ranges"
          >
            SD
          </button>
          <button
            role="tab"
            aria-selected={mode === 'percent'}
            onClick={() => setMode('percent')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'percent'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
            title="Percent mode — fixed spot moves (±5%, ±2%, ±1%)"
          >
            %
          </button>
        </div>
      </div>

      {/* Loading / empty states */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && !data && (
        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
          Select a strategy to see the P&L table
        </div>
      )}

      {!loading && data && <PnLGrid data={data} spotPrice={spotPrice} mode={mode} formatPnL={formatPnL} formatRowLabel={formatRowLabel} />}
    </div>
  );
}

// ─── Grid Table ───────────────────────────────────────────────────────────────

function PnLGrid({ data, spotPrice, mode, formatPnL, formatRowLabel }: {
  data: PnLGridData;
  spotPrice: number;
  mode: Mode;
  formatPnL: (val: number) => string;
  formatRowLabel: (spot: number, rowIdx: number) => { main: string; sub?: string };
}) {
  // Find closest spot row to current price (for SD mode highlight; in % mode, the "0" row is the highlight)
  const highlightRowIdx = mode === 'percent'
    ? PERCENT_OFFSETS.indexOf(0)
    : data.spotPrices.reduce((best, s, i) =>
        Math.abs(s - spotPrice) < Math.abs(data.spotPrices[best] - spotPrice) ? i : best, 0);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="py-2 px-2 text-left text-gray-500 dark:text-gray-400 font-medium sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">
                {mode === 'percent' ? 'Spot move ↓ / Days →' : 'Spot ↓ / Days →'}
              </th>
              {data.daysRemaining.map(d => (
                <th
                  key={d}
                  className={`py-2 px-2 text-center font-medium ${
                    d === 0 ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {d === 0 ? 'Expiry' : `${d}d`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.spotPrices.map((spot, rowIdx) => {
              const label = formatRowLabel(spot, rowIdx);
              const isHighlight = rowIdx === highlightRowIdx;
              return (
                <tr
                  key={`${spot}-${rowIdx}`}
                  className={`border-t border-gray-100 dark:border-gray-800 ${
                    isHighlight ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                  }`}
                >
                  <td className={`py-1.5 px-2 font-mono-nums font-medium sticky left-0 z-10 ${
                    isHighlight
                      ? 'bg-yellow-50 dark:bg-yellow-900/10 text-blue-600 dark:text-blue-400'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                  }`}>
                    <div className="flex items-baseline gap-1.5">
                      <span>{label.main}</span>
                      {label.sub && (
                        <span className="text-[9px] text-gray-400 dark:text-gray-500">{label.sub}</span>
                      )}
                      {isHighlight && <span className="text-[9px] text-blue-500">●</span>}
                    </div>
                  </td>
                  {data.grid[rowIdx].map((pnl, colIdx) => {
                    const val = pnl ?? 0;
                    return (
                      <td
                        key={colIdx}
                        className={`py-1.5 px-2 text-center font-mono-nums font-medium ${
                          val >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        } ${data.daysRemaining[colIdx] === 0 ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
                      >
                        {val >= 0 ? '+' : ''}{formatPnL(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
        Values in ₹ · Yellow row = {mode === 'percent' ? 'current spot (0%)' : 'current spot'} · Blue column = expiry
      </p>
    </>
  );
}
