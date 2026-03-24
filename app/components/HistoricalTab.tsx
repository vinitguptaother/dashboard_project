'use client';

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Calendar, 
  RefreshCw, 
  AlertCircle, 
  DollarSign,
  Activity,
  Volume2,
  Maximize2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts';
import { 
  useHistoricalData, 
  TimeframeOption, 
  formatCandleTime, 
  calculatePriceChange, 
  getOHLCSummary,
  HistoricalCandle 
} from '../hooks/useHistoricalData';

interface ChartDataPoint {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  priceChange: number;
}

const POPULAR_SYMBOLS = [
  'RELIANCE', 'INFY', 'TCS', 'HDFCBANK', 'ICICIBANK', 
  'HINDUNILVR', 'ITC', 'KOTAKBANK', 'LT', 'AXISBANK'
];

const TIMEFRAME_OPTIONS: { value: TimeframeOption; label: string; description: string }[] = [
  { value: '1D', label: '1D', description: 'Minute candles for today' },
  { value: '5D', label: '5D', description: '30min candles for 5 days' },
  { value: '1M', label: '1M', description: 'Daily candles for 1 month' },
  { value: '3M', label: '3M', description: 'Daily candles for 3 months' },
  { value: '6M', label: '6M', description: 'Daily candles for 6 months' },
  { value: '1Y', label: '1Y', description: 'Daily candles for 1 year' }
];

const HistoricalTab: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('1D');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('line');
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // Fetch historical data using our custom hook
  const { candles, loading, error, demo, lastUpdated, refetch } = useHistoricalData({
    symbol: selectedSymbol,
    timeframe: selectedTimeframe,
    autoRefresh: selectedTimeframe === '1D', // Auto-refresh for intraday data
    refreshInterval: 60000 // 1 minute for intraday
  });

  // Transform data for charts
  const chartData: ChartDataPoint[] = useMemo(() => {
    return candles.map(candle => {
      const prevClose = candles[candles.indexOf(candle) - 1]?.close || candle.open;
      return {
        time: formatCandleTime(candle.time, selectedTimeframe),
        timestamp: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        priceChange: candle.close - prevClose
      };
    });
  }, [candles, selectedTimeframe]);

  // Calculate summary statistics
  const priceChange = calculatePriceChange(candles);
  const ohlcSummary = getOHLCSummary(candles);

  // Custom tooltip for price chart
  const PriceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg border border-gray-600">
          <p className="text-sm text-gray-300 mb-1">{label}</p>
          <div className="space-y-1">
            {chartType === 'candlestick' ? (
              <>
                <p className="text-xs">Open: ₹{data.open.toFixed(2)}</p>
                <p className="text-xs">High: ₹{data.high.toFixed(2)}</p>
                <p className="text-xs">Low: ₹{data.low.toFixed(2)}</p>
                <p className="text-xs">Close: ₹{data.close.toFixed(2)}</p>
              </>
            ) : (
              <p className="text-xs">Price: ₹{data.close.toFixed(2)}</p>
            )}
            <p className="text-xs">Volume: {(data.volume / 1000).toFixed(1)}K</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Symbol and Timeframe Selection */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {POPULAR_SYMBOLS.map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
              <div className="flex gap-1">
                {TIMEFRAME_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTimeframe(option.value)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      selectedTimeframe === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={option.description}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Chart Type:</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as any)}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="candlestick">OHLC</option>
              </select>
            </div>

            <button
              onClick={() => setShowVolume(!showVolume)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                showVolume ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Volume2 className="w-4 h-4 inline mr-1" />
              Volume
            </button>

            <button
              onClick={() => refetch()}
              disabled={loading}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      {(error || loading) && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-2">
            {loading && (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">Loading historical data...</span>
              </>
            )}
            {error && (
              <>
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">Error: {error}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Price Summary Cards */}
      {ohlcSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Price</p>
                <p className="text-xl font-bold text-gray-900">₹{ohlcSummary.close.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
            <div className={`flex items-center gap-1 mt-1 ${
              priceChange.change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {priceChange.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-medium">
                ₹{Math.abs(priceChange.change).toFixed(2)} ({priceChange.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600">High</p>
            <p className="text-lg font-semibold text-green-600">₹{ohlcSummary.high.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600">Low</p>
            <p className="text-lg font-semibold text-red-600">₹{ohlcSummary.low.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600">Open</p>
            <p className="text-lg font-semibold text-gray-900">₹{ohlcSummary.open.toFixed(2)}</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Volume</p>
                <p className="text-lg font-semibold text-gray-900">
                  {(ohlcSummary.avgVolume / 1000).toFixed(1)}K
                </p>
              </div>
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Main Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {selectedSymbol} - {selectedTimeframe} Chart
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            {candles.length} candles
            {lastUpdated && (
              <span>• Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: '400px' }}>
            {chartType === 'candlestick' ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    fontSize={12}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['dataMin - 10', 'dataMax + 10']}
                    fontSize={12}
                    tickFormatter={(value) => `₹${value.toFixed(0)}`}
                  />
                  <Tooltip content={<PriceTooltip />} />
                  
                  {/* High-Low Line */}
                  <Line 
                    type="linear" 
                    dataKey="high" 
                    stroke="#ef4444" 
                    strokeWidth={1}
                    dot={false}
                    connectNulls
                  />
                  <Line 
                    type="linear" 
                    dataKey="low" 
                    stroke="#22c55e" 
                    strokeWidth={1}
                    dot={false}
                    connectNulls
                  />
                  
                  {/* Close Price Line */}
                  <Line 
                    type="linear" 
                    dataKey="close" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : chartType === 'area' ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    fontSize={12}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['dataMin - 10', 'dataMax + 10']}
                    fontSize={12}
                    tickFormatter={(value) => `₹${value.toFixed(0)}`}
                  />
                  <Tooltip content={<PriceTooltip />} />
                  <Area
                    type="linear"
                    dataKey="close"
                    stroke="#3b82f6"
                    fill="url(#colorGradient)"
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    fontSize={12}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['dataMin - 10', 'dataMax + 10']}
                    fontSize={12}
                    tickFormatter={(value) => `₹${value.toFixed(0)}`}
                  />
                  <Tooltip content={<PriceTooltip />} />
                  <Line
                    type="linear"
                    dataKey="close"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : !loading && (
          <div className="flex items-center justify-center h-96 text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No chart data available</p>
              <p className="text-sm">Try selecting a different symbol or timeframe</p>
            </div>
          </div>
        )}
      </div>

      {/* Volume Chart */}
      {showVolume && chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume</h3>
          <div style={{ width: '100%', height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  fontSize={12}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  fontSize={12}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip 
                  formatter={(value: number) => [`${(value / 1000).toFixed(1)}K`, 'Volume']}
                />
                <Bar 
                  dataKey="volume" 
                  fill="#8b5cf6"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Technical Analysis Summary */}
      {candles.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Period Return</p>
              <p className={`text-2xl font-bold ${
                priceChange.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {priceChange.changePercent >= 0 ? '+' : ''}{priceChange.changePercent.toFixed(2)}%
              </p>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Price Range</p>
              <p className="text-lg font-semibold text-gray-900">
                ₹{ohlcSummary?.low.toFixed(2)} - ₹{ohlcSummary?.high.toFixed(2)}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Volume</p>
              <p className="text-lg font-semibold text-purple-600">
                {ohlcSummary && (ohlcSummary.totalVolume / 1000000).toFixed(2)}M
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalTab;