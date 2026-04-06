'use client';

import React from 'react';
import { PayoffResult, MarginData } from './types';
import { formatINRCompact } from './utils';

interface Props {
  payoff: PayoffResult | null;
  margin: MarginData | null;
}

export default function SummaryBar({ payoff, margin }: Props) {
  if (!payoff) {
    return (
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-400 dark:text-gray-500 text-center">
          Build a strategy to see analysis
        </div>
      </div>
    );
  }

  const maxProfitStr = typeof payoff.maxProfit === 'number' ? formatINRCompact(payoff.maxProfit) : 'Unlimited';
  const maxLossStr = typeof payoff.maxLoss === 'number' ? formatINRCompact(Math.abs(payoff.maxLoss as number)) : 'Unlimited';
  const rrStr = typeof payoff.riskReward === 'number' ? `1/${payoff.riskReward.toFixed(1)}` : 'NA';

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* Top row: big numbers */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-gray-800">
        {/* Profit */}
        <div className="bg-white dark:bg-gray-900 px-3 py-2.5">
          <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Profit left</div>
          <div className="font-mono-nums text-lg font-bold text-green-600 dark:text-green-400">
            {maxProfitStr}
          </div>
        </div>

        {/* Loss */}
        <div className="bg-white dark:bg-gray-900 px-3 py-2.5">
          <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Loss left</div>
          <div className="font-mono-nums text-lg font-bold text-red-600 dark:text-red-400">
            {maxLossStr}
          </div>
        </div>

        {/* R/R + POP */}
        <div className="bg-white dark:bg-gray-900 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Reward/Risk</div>
              <div className="font-mono-nums text-sm font-semibold text-gray-700 dark:text-gray-300">{rrStr}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">POP</div>
              <div className={`font-mono-nums text-sm font-bold ${
                payoff.pop >= 60 ? 'text-green-600 dark:text-green-400' :
                payoff.pop >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {(payoff.pop ?? 0).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail row */}
      <div className="flex items-center gap-4 px-3 py-2 text-xs overflow-x-auto">
        <DetailItem label="Max Profit" value={maxProfitStr} color="green" />
        <DetailItem label="Max Loss" value={maxLossStr} color="red" />

        {(payoff.breakevens ?? []).length > 0 && (
          <DetailItem
            label="Breakeven"
            value={(payoff.breakevens ?? []).map(b => (b ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })).join(', ')}
          />
        )}

        {margin && margin.totalMargin > 0 && (
          <DetailItem
            label="Margin"
            value={formatINRCompact(margin.totalMargin)}
          />
        )}

        <DetailItem
          label="Premium"
          value={`${payoff.premiumType === 'CREDIT' ? 'Get' : 'Pay'} ₹${Math.abs(payoff.netPremium).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          color={payoff.premiumType === 'CREDIT' ? 'green' : 'red'}
        />
      </div>
    </div>
  );
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClass = color === 'green' ? 'text-green-600 dark:text-green-400'
    : color === 'red' ? 'text-red-600 dark:text-red-400'
    : 'text-gray-700 dark:text-gray-300';

  return (
    <div className="flex-shrink-0">
      <span className="text-gray-400 dark:text-gray-500 mr-1">{label}:</span>
      <span className={`font-mono-nums font-semibold ${colorClass}`}>{value}</span>
    </div>
  );
}
