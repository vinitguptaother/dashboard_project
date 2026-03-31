'use client';

import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PayoffPoint {
  spot: number;
  pnl: number;
}

interface SDMoves {
  sd1Upper: number;
  sd1Lower: number;
  sd2Upper: number;
  sd2Lower: number;
  sdValue: number;
}

interface PayoffChartProps {
  data: PayoffPoint[];
  spotPrice: number;
  breakevens: number[];
  sdMoves?: SDMoves;
  netDelta?: number;
  netTheta?: number;
  netGamma?: number;
  netVega?: number;
}

// ─── Chart ─────────────────────────────────────────────────────────────────────

export default function PayoffChart({
  data,
  spotPrice,
  breakevens,
  sdMoves,
  netDelta,
  netTheta,
  netGamma,
  netVega,
}: PayoffChartProps) {
  // Split data into profit (green) and loss (red) using gradientOffset
  const gradientOffset = useMemo(() => {
    if (!data.length) return 0;
    const max = Math.max(...data.map(d => d.pnl));
    const min = Math.min(...data.map(d => d.pnl));
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [data]);

  const formatXAxis = (value: number) => {
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toString();
  };

  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 100000) return '₹' + (value / 100000).toFixed(1) + 'L';
    if (Math.abs(value) >= 1000) return '₹' + (value / 1000).toFixed(1) + 'K';
    return '₹' + value.toFixed(0);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg border border-gray-700 text-sm">
          <p className="text-gray-400 mb-1">Spot: ₹{d.spot.toLocaleString('en-IN')}</p>
          <p className={`font-bold font-mono-nums ${d.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            P&L: {d.pnl >= 0 ? '+' : ''}₹{d.pnl.toLocaleString('en-IN')}
          </p>
        </div>
      );
    }
    return null;
  };

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 text-sm">
        Add legs to see the payoff chart
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="payoffGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset={gradientOffset} stopColor="#22c55e" stopOpacity={0.05} />
                <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={0.05} />
                <stop offset={1} stopColor="#ef4444" stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="payoffStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#22c55e" stopOpacity={1} />
                <stop offset={gradientOffset} stopColor="#22c55e" stopOpacity={1} />
                <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={1} />
                <stop offset={1} stopColor="#ef4444" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="spot"
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickCount={8}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Zero line */}
            <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />

            {/* Current spot price */}
            <ReferenceLine
              x={spotPrice}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{ value: 'Spot', position: 'top', fill: '#3b82f6', fontSize: 11 }}
            />

            {/* Breakevens */}
            {breakevens.map((be, i) => (
              <ReferenceLine
                key={`be-${i}`}
                x={be}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                label={{ value: `BE: ${be.toLocaleString('en-IN')}`, position: 'top', fill: '#f59e0b', fontSize: 10 }}
              />
            ))}

            {/* SD bands */}
            {sdMoves && sdMoves.sdValue > 0 && (
              <>
                <ReferenceLine x={sdMoves.sd1Upper} stroke="#8b5cf6" strokeDasharray="4 4" strokeWidth={1} label={{ value: '+1SD', position: 'top', fill: '#8b5cf6', fontSize: 9 }} />
                <ReferenceLine x={sdMoves.sd1Lower} stroke="#8b5cf6" strokeDasharray="4 4" strokeWidth={1} label={{ value: '-1SD', position: 'top', fill: '#8b5cf6', fontSize: 9 }} />
                <ReferenceLine x={sdMoves.sd2Upper} stroke="#6d28d9" strokeDasharray="2 4" strokeWidth={1} label={{ value: '+2SD', position: 'top', fill: '#6d28d9', fontSize: 9 }} />
                <ReferenceLine x={sdMoves.sd2Lower} stroke="#6d28d9" strokeDasharray="2 4" strokeWidth={1} label={{ value: '-2SD', position: 'top', fill: '#6d28d9', fontSize: 9 }} />
              </>
            )}

            {/* Payoff curve */}
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="url(#payoffStroke)"
              fill="url(#payoffGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Greeks Summary Bar */}
      {(netDelta !== undefined || netTheta !== undefined) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <GreekCard label="Net Delta" value={netDelta} format={(v) => v.toFixed(2)} />
          <GreekCard label="Net Theta" value={netTheta} format={(v) => '₹' + v.toFixed(2) + '/day'} highlight />
          <GreekCard label="Net Gamma" value={netGamma} format={(v) => v.toFixed(4)} />
          <GreekCard label="Net Vega" value={netVega} format={(v) => '₹' + v.toFixed(2)} />
        </div>
      )}
    </div>
  );
}

// ─── Greek Card ────────────────────────────────────────────────────────────────

function GreekCard({ label, value, format, highlight }: {
  label: string;
  value?: number;
  format: (v: number) => string;
  highlight?: boolean;
}) {
  if (value === undefined) return null;
  const isPositive = value >= 0;

  return (
    <div className={`rounded-lg border p-2.5 text-center ${
      highlight
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono-nums ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {format(value)}
      </div>
    </div>
  );
}
