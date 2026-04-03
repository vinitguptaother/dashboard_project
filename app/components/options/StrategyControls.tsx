'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { MULTIPLIER_OPTIONS } from './constants';

interface Props {
  onShift: (direction: -1 | 1) => void;
  multiplier: number;
  onSetMultiplier: (m: number) => void;
  netPremium: number;
  premiumType: 'CREDIT' | 'DEBIT';
  totalPremiumValue: number;
  hasLegs: boolean;
}

export default function StrategyControls({
  onShift, multiplier, onSetMultiplier,
  netPremium, premiumType, totalPremiumValue, hasLegs,
}: Props) {
  if (!hasLegs) return null;

  return (
    <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
      {/* Shift + Multiplier row */}
      <div className="flex items-center justify-between">
        {/* Shift controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shift</span>
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md">
            <button onClick={() => onShift(-1)} className="px-2 py-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200">
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs text-gray-400 px-1">·</span>
            <button onClick={() => onShift(1)} className="px-2 py-1 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200">
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Multiplier */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Multiplier</span>
          <select
            value={multiplier}
            onChange={e => onSetMultiplier(Number(e.target.value))}
            className="text-xs bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-1 outline-none cursor-pointer font-mono-nums text-gray-700 dark:text-gray-300"
          >
            {MULTIPLIER_OPTIONS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Premium summary */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          Price {premiumType === 'CREDIT' ? 'Get' : 'Pay'}
        </span>
        <span className={`font-mono-nums font-semibold ${
          premiumType === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {netPremium.toFixed(1)}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          Premium {premiumType === 'CREDIT' ? 'Get' : 'Pay'}
        </span>
        <span className={`font-mono-nums font-bold ${
          premiumType === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
        }`}>
          ₹{totalPremiumValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
