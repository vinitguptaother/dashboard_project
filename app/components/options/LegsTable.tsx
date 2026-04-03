'use client';

import React from 'react';
import { X, Minus, Plus, GripVertical } from 'lucide-react';
import { StrategyLeg } from './types';

interface Props {
  legs: StrategyLeg[];
  strategyName: string;
  onToggleSide: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdateStrike: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onResetPrices: () => void;
  selectedExpiry: string;
}

export default function LegsTable({
  legs, strategyName, onToggleSide, onUpdateQty,
  onUpdateStrike, onRemove, onResetPrices, selectedExpiry,
}: Props) {
  if (legs.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
        Select a strategy from Ready-made or click Add/Edit to add legs
      </div>
    );
  }

  const expiryLabel = selectedExpiry
    ? new Date(selectedExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : '';

  return (
    <div className="px-3 py-2">
      {/* Strategy name + Reset */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {legs.length} selected
          </span>
          <span className="text-xs text-gray-400">-</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {strategyName}
          </span>
        </div>
        <button
          onClick={onResetPrices}
          className="text-xs text-blue-500 hover:text-blue-600 font-medium"
        >
          Reset Prices
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[20px_32px_64px_1fr_36px_52px_72px_24px] gap-1 items-center text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 px-1">
        <span></span>
        <span>B/S</span>
        <span>Expiry</span>
        <span className="text-center">Strike</span>
        <span>Type</span>
        <span className="text-center">Lots</span>
        <span className="text-right">Price</span>
        <span></span>
      </div>

      {/* Leg rows */}
      {legs.map(leg => (
        <div
          key={leg.id}
          className="grid grid-cols-[20px_32px_64px_1fr_36px_52px_72px_24px] gap-1 items-center py-1.5 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
        >
          {/* Drag handle */}
          <GripVertical className="w-3 h-3 text-gray-300 dark:text-gray-600 cursor-grab opacity-0 group-hover:opacity-100" />

          {/* B/S badge */}
          <button
            onClick={() => onToggleSide(leg.id)}
            className={`text-[10px] font-bold w-7 h-6 rounded flex items-center justify-center transition-colors ${
              leg.side === 'SELL'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            }`}
          >
            {leg.side === 'SELL' ? 'S' : 'B'}
          </button>

          {/* Expiry */}
          <span className="text-xs text-gray-600 dark:text-gray-400 font-mono-nums">
            {expiryLabel}
          </span>

          {/* Strike with -/+ */}
          <div className="flex items-center justify-center gap-0.5">
            <button
              onClick={() => onUpdateStrike(leg.id, -1)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono-nums text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[50px] text-center">
              {leg.strike.toLocaleString('en-IN')}
            </span>
            <button
              onClick={() => onUpdateStrike(leg.id, 1)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Type */}
          <span className={`text-xs font-semibold ${
            leg.type === 'CE' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {leg.type}
          </span>

          {/* Lots with -/+ */}
          <div className="flex items-center justify-center gap-0.5">
            <button
              onClick={() => onUpdateQty(leg.id, leg.qty - 1)}
              className="w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <span className="font-mono-nums text-xs font-medium text-gray-900 dark:text-gray-100 min-w-[16px] text-center">
              {leg.qty}
            </span>
            <button
              onClick={() => onUpdateQty(leg.id, leg.qty + 1)}
              className="w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Price */}
          <span className="font-mono-nums text-sm text-right text-gray-900 dark:text-gray-100">
            {leg.premium.toFixed(1)}
          </span>

          {/* Delete */}
          <button
            onClick={() => onRemove(leg.id)}
            className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
