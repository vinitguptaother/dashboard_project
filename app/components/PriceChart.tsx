'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useHistoricalData, TimeframeOption, formatCandleTime } from '../hooks/useHistoricalData';

interface PriceChartProps {
  symbol: string;
  timeframe: TimeframeOption;
}

const PriceChart: React.FC<PriceChartProps> = ({ symbol, timeframe }) => {
  const { candles, loading, error, demo } = useHistoricalData({
    symbol,
    timeframe,
    autoRefresh: timeframe === '1D',
    refreshInterval: 60000
  });

  // Transform data for the chart
  const chartData = candles.map(candle => ({
    time: formatCandleTime(candle.time, timeframe),
    price: candle.close,
    timestamp: candle.time
  }));

  // Calculate price change
  const priceChange = candles.length >= 2 
    ? candles[candles.length - 1].close - candles[0].open
    : 0;
  const priceChangePercent = candles.length >= 2 
    ? (priceChange / candles[0].open) * 100
    : 0;

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const isPositive = priceChange >= 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg">
          <p className="text-sm text-gray-300">{label}</p>
          <p className="text-sm font-semibold">₹{payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {symbol} Price Chart
          </h2>
          {currentPrice > 0 && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-2xl font-bold text-gray-900">
                ₹{currentPrice.toFixed(2)}
              </span>
              <div className={`flex items-center gap-1 ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {isPositive ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span className="font-semibold">
                  ₹{Math.abs(priceChange).toFixed(2)}
                </span>
                <span className="text-sm">
                  ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-600">
            {timeframe} • {candles.length} periods
          </div>
          {demo && (
            <div className="text-xs text-amber-600 mt-1">
              Demo Data
            </div>
          )}
        </div>
      </div>

      <div style={{ width: '100%', height: '300px' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <BarChart3 className="w-8 h-8 animate-pulse mr-2" />
            Loading chart data...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">
            <BarChart3 className="w-8 h-8 mr-2" />
            Error loading data
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="5%" 
                    stopColor={isPositive ? "#10b981" : "#ef4444"} 
                    stopOpacity={0.3}
                  />
                  <stop 
                    offset="95%" 
                    stopColor={isPositive ? "#10b981" : "#ef4444"} 
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                fontSize={12}
                tick={{ fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                fontSize={12}
                tick={{ fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                domain={['dataMin - 10', 'dataMax + 10']}
                tickFormatter={(value) => `₹${value.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="linear"
                dataKey="price"
                stroke={isPositive ? "#10b981" : "#ef4444"}
                fill={`url(#gradient-${symbol})`}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No data available</p>
              <p className="text-sm">Select a different symbol</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {candles.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xs text-gray-600">Open</div>
            <div className="text-sm font-semibold">₹{candles[0].open.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">High</div>
            <div className="text-sm font-semibold text-green-600">
              ₹{Math.max(...candles.map(c => c.high)).toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">Low</div>
            <div className="text-sm font-semibold text-red-600">
              ₹{Math.min(...candles.map(c => c.low)).toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">Volume</div>
            <div className="text-sm font-semibold">
              {(candles.reduce((sum, c) => sum + c.volume, 0) / 1000000).toFixed(1)}M
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceChart;