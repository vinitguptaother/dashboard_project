'use client';

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { OptionChainData } from './types';
import { formatNum, calculateMaxPain } from './utils';

interface Props {
  chain: OptionChainData | null;
  spotPrice: number;
}

/**
 * OI Distribution — horizontal bar chart showing open interest at each strike.
 * CE OI extends right (green), PE OI extends left (red via negative values).
 * Highlights ATM strike, call/put walls (max OI), and Max Pain strike.
 */
export default function OIDistributionChart({ chain, spotPrice }: Props) {
  // Compute Max Pain from the FULL chain (not just visible strikes) — far-OTM OI matters
  const maxPain = useMemo(() => {
    if (!chain?.strikes?.length) return null;
    return calculateMaxPain(chain.strikes);
  }, [chain]);

  // Build chart data — center on ATM, show ~21 strikes
  const chartData = useMemo(() => {
    if (!chain?.strikes?.length || !spotPrice) return [];

    const atmStrike = chain.strikes.reduce((closest, s) =>
      Math.abs(s.strike - spotPrice) < Math.abs(closest.strike - spotPrice) ? s : closest,
      chain.strikes[0]
    );
    const atmIdx = chain.strikes.findIndex(s => s.strike === atmStrike.strike);
    const range = 10; // 10 ITM + ATM + 10 OTM = 21 strikes
    const start = Math.max(0, atmIdx - range);
    const end = Math.min(chain.strikes.length, atmIdx + range + 1);

    return chain.strikes.slice(start, end).map(s => ({
      strike: s.strike,
      strikeLabel: s.strike.toLocaleString('en-IN'),
      ceOI: s.ce.oi || 0,
      peOI: -(s.pe.oi || 0),  // negative so bar extends left
      peOIRaw: s.pe.oi || 0,  // for tooltip
      isATM: s.strike === atmStrike.strike,
      isMaxPain: maxPain?.maxPainStrike === s.strike,
    }));
  }, [chain, spotPrice, maxPain]);

  // Identify call wall (max CE OI) and put wall (max PE OI) — classic resistance/support
  const { callWall, putWall } = useMemo(() => {
    if (!chartData.length) return { callWall: null as number | null, putWall: null as number | null };
    let maxCE = 0, maxPE = 0, ceStrike = null as number | null, peStrike = null as number | null;
    for (const d of chartData) {
      if (d.ceOI > maxCE) { maxCE = d.ceOI; ceStrike = d.strike; }
      if (d.peOIRaw > maxPE) { maxPE = d.peOIRaw; peStrike = d.strike; }
    }
    return { callWall: ceStrike, putWall: peStrike };
  }, [chartData]);

  const formatOI = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 100000) return (abs / 100000).toFixed(1) + 'L';
    if (abs >= 1000) return (abs / 1000).toFixed(1) + 'K';
    return abs.toFixed(0);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg border border-gray-700 text-xs">
        <div className="text-gray-300 font-semibold mb-1">Strike: {d.strikeLabel}</div>
        <div className="text-green-400 font-mono-nums">CE OI: {formatNum(d.ceOI, 0)}</div>
        <div className="text-red-400 font-mono-nums">PE OI: {formatNum(d.peOIRaw, 0)}</div>
        {d.isATM && <div className="text-blue-400 text-[10px] mt-1">● ATM</div>}
        {d.isMaxPain && <div className="text-purple-400 text-[10px] mt-1">◆ Max Pain (Expected pin)</div>}
        {d.strike === callWall && <div className="text-green-500 text-[10px] mt-1">▲ Call Wall (Resistance)</div>}
        {d.strike === putWall && <div className="text-red-500 text-[10px] mt-1">▼ Put Wall (Support)</div>}
      </div>
    );
  };

  if (!chain || !chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500 text-sm">
        No option chain data available
      </div>
    );
  }

  // Compute total OI + distance from spot to max pain
  const totalCEOI = chartData.reduce((s, d) => s + d.ceOI, 0);
  const totalPEOI = chartData.reduce((s, d) => s + d.peOIRaw, 0);
  const pcr = totalCEOI > 0 ? (totalPEOI / totalCEOI) : 0;
  const maxPainDistance = maxPain && spotPrice
    ? ((maxPain.maxPainStrike - spotPrice) / spotPrice) * 100
    : 0;

  return (
    <div className="p-4 space-y-3">
      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatChip
          label="Max Pain"
          value={maxPain?.maxPainStrike ? maxPain.maxPainStrike.toLocaleString('en-IN') : '-'}
          sublabel={maxPain?.maxPainStrike && spotPrice
            ? `${maxPainDistance >= 0 ? '+' : ''}${maxPainDistance.toFixed(2)}% from spot`
            : 'Expected pin'}
          color="purple"
        />
        <StatChip label="Call Wall" value={callWall ? callWall.toLocaleString('en-IN') : '-'} sublabel="Resistance" color="green" />
        <StatChip label="Put Wall" value={putWall ? putWall.toLocaleString('en-IN') : '-'} sublabel="Support" color="red" />
        <StatChip label="PCR" value={pcr.toFixed(2)} sublabel={pcr > 1 ? 'Bullish bias' : pcr < 0.8 ? 'Bearish bias' : 'Neutral'} color={pcr > 1 ? 'green' : pcr < 0.8 ? 'red' : 'neutral'} />
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2 text-[11px]">
          <span className="text-red-500 font-semibold">◀ PUT OI</span>
          <span className="text-gray-500 dark:text-gray-400">Open Interest Distribution</span>
          <span className="text-green-500 font-semibold">CALL OI ▶</span>
        </div>

        <ResponsiveContainer width="100%" height={520}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            stackOffset="sign"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={formatOI}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={{ stroke: '#6b7280' }}
            />
            <YAxis
              type="category"
              dataKey="strikeLabel"
              tick={(props) => {
                const { x, y, payload } = props;
                const entry = chartData.find(d => d.strikeLabel === payload.value);
                const isATM = entry?.isATM;
                const isMaxPain = entry?.isMaxPain;
                const isWall = entry?.strike === callWall || entry?.strike === putWall;
                // Priority: ATM (blue) > Max Pain (purple) > Wall (amber) > default
                const fill = isATM ? '#3b82f6'
                  : isMaxPain ? '#a855f7'
                  : isWall ? '#f59e0b'
                  : '#9ca3af';
                return (
                  <text
                    x={x}
                    y={y}
                    dy={4}
                    textAnchor="end"
                    fontSize={isATM || isMaxPain ? 11 : 10}
                    fontWeight={isATM || isMaxPain || isWall ? 700 : 400}
                    fill={fill}
                  >
                    {payload.value}
                  </text>
                );
              }}
              width={70}
              interval={0}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#6b728015' }} />
            <ReferenceLine x={0} stroke="#6b7280" strokeWidth={1} />

            {/* PE OI — extends left (negative values) */}
            <Bar dataKey="peOI" fill="#ef4444" radius={[2, 0, 0, 2]}>
              {chartData.map((d, i) => (
                <Cell
                  key={`pe-${i}`}
                  fill={d.strike === putWall ? '#dc2626' : '#ef4444'}
                  opacity={d.isATM ? 1 : 0.85}
                />
              ))}
            </Bar>

            {/* CE OI — extends right (positive values) */}
            <Bar dataKey="ceOI" fill="#22c55e" radius={[0, 2, 2, 0]}>
              {chartData.map((d, i) => (
                <Cell
                  key={`ce-${i}`}
                  fill={d.strike === callWall ? '#16a34a' : '#22c55e'}
                  opacity={d.isATM ? 1 : 0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
          <span className="text-blue-500">Blue</span> = ATM ·{' '}
          <span className="text-purple-500">Purple</span> = Max Pain ·{' '}
          <span className="text-amber-500">Amber</span> = Max OI (wall) ·{' '}
          Darker bars = Call/Put walls
        </p>
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, sublabel, color }: {
  label: string;
  value: string;
  sublabel?: string;
  color?: 'green' | 'red' | 'purple' | 'neutral';
}) {
  const colorClass =
    color === 'green' ? 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
    : color === 'red' ? 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    : color === 'purple' ? 'text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20'
    : 'text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50';

  return (
    <div className={`rounded-lg border px-3 py-2 ${colorClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="font-mono-nums font-bold text-sm mt-0.5">{value}</div>
      {sublabel && <div className="text-[10px] opacity-60 mt-0.5">{sublabel}</div>}
    </div>
  );
}
