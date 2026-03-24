'use client';

import React from 'react';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useHistoricalData, TimeframeOption, formatCandleTime } from '../hooks/useHistoricalData';

interface HistoricalChartWidgetProps {
  symbol: string;
  timeframe: TimeframeOption;
  height?: number;
  showControls?: boolean;
  chartType?: 'line' | 'area';
  color?: string;
  title?: string;
}

const HistoricalChartWidget: React.FC<HistoricalChartWidgetProps> = ({
  symbol,
  timeframe,
  height = 200,
  showControls = false,
  chartType = 'line',
  color = '#3b82f6',
  title
}) => {
  const { candles, loading, error, demo, refetch } = useHistoricalData({
    symbol,
    timeframe,
    autoRefresh: timeframe === '1D', // Auto-refresh intraday data
    refreshInterval: 60000 // 1 minute
  });

  // Transform data for chart
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 text-white p-2 rounded shadow-lg text-xs">
          <p>{label}</p>
          <p>₹{payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {title || `${symbol} - ${timeframe}`}
          </h3>
          {currentPrice > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">₹{currentPrice.toFixed(2)}</span>
              <div className={`flex items-center gap-1 text-sm ${
                priceChange >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{priceChangePercent.toFixed(2)}%</span>
              </div>
            </div>
          )}
        </div>
        
        {showControls && (
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Status indicators */}
      {(error || demo) && (
        <div className="mb-2">
          {error && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span>Error loading data</span>
            </div>
          )}
          {demo && !error && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Info className="w-3 h-3" />
              <span>Demo data</span>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div style={{ width: '100%', height: `${height}px` }}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="time" 
                  fontSize={10}
                  tick={{ fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  fontSize={10}
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
                  stroke={color}
                  fill={`url(#gradient-${symbol})`}
                  strokeWidth={1.5}
                />
                <defs>
                  <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="time" 
                  fontSize={10}
                  tick={{ fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  fontSize={10}
                  tick={{ fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 10', 'dataMax + 10']}
                  tickFormatter={(value) => `₹${value.toFixed(0)}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="linear"
                  dataKey="price"
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No data available
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricalChartWidget;