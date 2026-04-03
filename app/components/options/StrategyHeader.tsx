'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Settings, RefreshCw } from 'lucide-react';
import { UNDERLYINGS } from './constants';

interface Props {
  underlying: string;
  setUnderlying: (u: string) => void;
  spotPrice: number;
  loading: boolean;
  onRefresh: () => void;
  lastRefresh: Date | null;
}

export default function StrategyHeader({ underlying, setUnderlying, spotPrice, loading, onRefresh, lastRefresh }: Props) {
  return (
    <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
      {/* Underlying selector styled as search bar */}
      <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
        <select
          value={underlying}
          onChange={e => setUnderlying(e.target.value)}
          className="bg-transparent font-semibold text-sm outline-none cursor-pointer text-gray-900 dark:text-gray-100"
        >
          {UNDERLYINGS.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {spotPrice > 0 && (
          <span className="font-mono-nums text-sm font-bold text-gray-900 dark:text-gray-100">
            {spotPrice.toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
        title={lastRefresh ? `Last: ${lastRefresh.toLocaleTimeString('en-IN')}` : 'Refresh'}
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
