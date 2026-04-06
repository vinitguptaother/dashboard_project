'use client';

import React, { useEffect, useState } from 'react';
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

export default function PnLTable({ legs, spotPrice, daysToExpiry }: Props) {
  const [data, setData] = useState<PnLGridData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!legs.length || !spotPrice || daysToExpiry <= 0) {
      setData(null);
      return;
    }

    const fetchGrid = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/options/payoff-grid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            legs: legs.map(l => ({
              type: l.type, strike: l.strike, premium: l.premium,
              qty: l.qty, side: l.side, lotSize: l.lotSize, iv: l.iv || 0.15,
            })),
            spotPrice,
            daysToExpiry,
            spotSteps: 13,
          }),
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
  }, [legs, spotPrice, daysToExpiry]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
        Select a strategy to see the P&L table
      </div>
    );
  }

  const formatPnL = (val: number) => {
    if (Math.abs(val) >= 100000) return (val / 100000).toFixed(1) + 'L';
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'K';
    return val.toFixed(0);
  };

  const formatSpot = (val: number) => val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // Find closest spot row to current price
  const closestSpotIdx = data.spotPrices.reduce((best, s, i) =>
    Math.abs(s - spotPrice) < Math.abs(data.spotPrices[best] - spotPrice) ? i : best, 0);

  // Find closest date column (today = highest days remaining)
  const todayIdx = 0; // first column is usually the farthest date, last is expiry (0 days)

  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="py-2 px-2 text-left text-gray-500 dark:text-gray-400 font-medium sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">
                Spot ↓ / Days →
              </th>
              {data.daysRemaining.map((d, i) => (
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
            {data.spotPrices.map((spot, rowIdx) => (
              <tr
                key={spot}
                className={`border-t border-gray-100 dark:border-gray-800 ${
                  rowIdx === closestSpotIdx ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                }`}
              >
                <td className={`py-1.5 px-2 font-mono-nums font-medium sticky left-0 z-10 ${
                  rowIdx === closestSpotIdx
                    ? 'bg-yellow-50 dark:bg-yellow-900/10 text-blue-600 dark:text-blue-400'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                }`}>
                  {formatSpot(spot)}
                  {rowIdx === closestSpotIdx && <span className="ml-1 text-[9px] text-blue-500">●</span>}
                </td>
                {data.grid[rowIdx].map((pnl, colIdx) => (
                  <td
                    key={colIdx}
                    className={`py-1.5 px-2 text-center font-mono-nums font-medium ${
                      pnl >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    } ${data.daysRemaining[colIdx] === 0 ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
                  >
                    {pnl >= 0 ? '+' : ''}{formatPnL(pnl)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
        Values in ₹ · Yellow row = current spot · Blue column = expiry
      </p>
    </div>
  );
}
