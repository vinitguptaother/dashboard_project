'use client';

import React from 'react';
import { PayoffResult, OptionChainData, StrategyLeg } from './types';

interface Props {
  payoff: PayoffResult | null;
  chain: OptionChainData | null;
  legs: StrategyLeg[];
  spotPrice: number;
}

export default function GreeksPanel({ payoff, chain, legs, spotPrice }: Props) {
  if (!payoff) return null;

  const { greeks, sdMoves } = payoff;

  return (
    <div className="p-4 space-y-4">
      {/* Aggregate Greeks */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Greeks</h4>
        <div className="grid grid-cols-2 gap-3">
          <GreekItem label="Delta" symbol="Δ" value={greeks.netDelta} decimals={2} />
          <GreekItem label="Theta (Decay)" symbol="Θ" value={greeks.netTheta} decimals={0} prefix="₹" />
          <GreekItem label="Gamma" symbol="Γ" value={greeks.netGamma} decimals={4} />
          <GreekItem label="Vega" symbol="ν" value={greeks.netVega} decimals={0} />
        </div>
      </div>

      {/* Standard Deviation */}
      {sdMoves && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Standard Deviation</h4>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 gap-px text-[10px] uppercase tracking-wider text-gray-400 px-3 py-1.5 bg-gray-100 dark:bg-gray-700">
              <span>SD</span>
              <span className="text-right">Points</span>
              <span className="text-right">Price</span>
            </div>
            <SDRow
              label="1 SD"
              points={sdMoves.sdValue}
              spotPrice={spotPrice}
              pct={((sdMoves.sdValue / spotPrice) * 100)}
              lower={sdMoves.sd1Lower}
              upper={sdMoves.sd1Upper}
            />
            <SDRow
              label="2 SD"
              points={sdMoves.sdValue * 2}
              spotPrice={spotPrice}
              pct={((sdMoves.sdValue * 2 / spotPrice) * 100)}
              lower={sdMoves.sd2Lower}
              upper={sdMoves.sd2Upper}
            />
          </div>
        </div>
      )}

      {/* Strikewise IVs for selected legs */}
      {legs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Strikewise IVs</h4>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
            <div className="grid grid-cols-4 gap-px text-[10px] uppercase tracking-wider text-gray-400 px-3 py-1.5 bg-gray-100 dark:bg-gray-700">
              <span>Strike</span>
              <span>Type</span>
              <span className="text-right">IV</span>
              <span className="text-right">Delta</span>
            </div>
            {legs.map(leg => (
              <div key={leg.id} className="grid grid-cols-4 gap-px px-3 py-1.5 text-xs border-t border-gray-100 dark:border-gray-700">
                <span className="font-mono-nums text-gray-800 dark:text-gray-200">{leg.strike.toLocaleString('en-IN')}</span>
                <span className={leg.type === 'CE' ? 'text-green-600' : 'text-red-600'}>{leg.type}</span>
                <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">{(leg.iv * 100).toFixed(1)}</span>
                <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">{leg.delta.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GreekItem({ label, symbol, value, decimals, prefix }: {
  label: string; symbol: string; value: number; decimals: number; prefix?: string;
}) {
  const isPositive = value >= 0;
  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-gray-400">{symbol}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <span className={`font-mono-nums text-sm font-semibold ${
        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      }`}>
        {isPositive ? '+' : ''}{prefix || ''}{value.toFixed(decimals)}
      </span>
    </div>
  );
}

function SDRow({ label, points, spotPrice, pct, lower, upper }: {
  label: string; points: number; spotPrice: number; pct: number; lower: number; upper: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-px px-3 py-1.5 text-xs border-t border-gray-100 dark:border-gray-700">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">
        {points.toFixed(1)} ({pct.toFixed(0)}%)
      </span>
      <span className="text-right font-mono-nums text-gray-700 dark:text-gray-300">
        {lower.toFixed(0)} - {upper.toFixed(0)}
      </span>
    </div>
  );
}
