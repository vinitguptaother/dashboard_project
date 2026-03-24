import { useState, useEffect, useCallback } from 'react';

export interface HistoricalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalDataResponse {
  success: boolean;
  data: {
    candles: HistoricalCandle[];
  };
  symbol: string;
  timeframe: string;
  timestamp: string;
  demo?: boolean;
  source?: string;
  fallbackReason?: string;
  error?: string;
}

export type TimeframeOption = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y';

interface UseHistoricalDataOptions {
  symbol: string;
  timeframe: TimeframeOption;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseHistoricalDataReturn {
  candles: HistoricalCandle[];
  loading: boolean;
  error: string | null;
  demo: boolean;
  lastUpdated: string | null;
  refetch: () => Promise<void>;
}

export const useHistoricalData = ({
  symbol,
  timeframe,
  autoRefresh = false,
  refreshInterval = 60000 // 1 minute
}: UseHistoricalDataOptions): UseHistoricalDataReturn => {
  const [candles, setCandles] = useState<HistoricalCandle[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!symbol || !timeframe) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/upstox/history?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: HistoricalDataResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch historical data');
      }

      // Transform and validate data
      const validCandles = data.data.candles.filter(candle => 
        candle.time && 
        typeof candle.open === 'number' && 
        typeof candle.high === 'number' && 
        typeof candle.low === 'number' && 
        typeof candle.close === 'number' &&
        candle.high >= candle.low &&
        candle.high >= Math.max(candle.open, candle.close) &&
        candle.low <= Math.min(candle.open, candle.close)
      );

      setCandles(validCandles);
      setDemo(data.demo || false);
      setLastUpdated(new Date().toISOString());

      if (data.demo) {
        console.log(`📊 Loaded ${validCandles.length} demo candles for ${symbol} (${timeframe})`);
      } else {
        console.log(`📊 Loaded ${validCandles.length} real candles for ${symbol} (${timeframe}) from ${data.source}`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setCandles([]);
      setDemo(false);
      console.error('Error fetching historical data:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !symbol || !timeframe) return;

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  return {
    candles,
    loading,
    error,
    demo,
    lastUpdated,
    refetch: fetchData
  };
};

// Utility functions for working with historical data
export const formatCandleTime = (timestamp: number, timeframe: TimeframeOption): string => {
  const date = new Date(timestamp);
  
  switch (timeframe) {
    case '1D':
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });
    case '5D':
      return `${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      })}`;
    default:
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: timeframe === '1Y' ? 'numeric' : undefined
      });
  }
};

export const calculatePriceChange = (candles: HistoricalCandle[]): { change: number; changePercent: number } => {
  if (candles.length < 2) return { change: 0, changePercent: 0 };
  
  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];
  
  const change = lastCandle.close - firstCandle.open;
  const changePercent = (change / firstCandle.open) * 100;
  
  return { change, changePercent };
};

export const getOHLCSummary = (candles: HistoricalCandle[]) => {
  if (candles.length === 0) return null;
  
  const prices = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  
  return {
    open: candles[0].open,
    close: candles[candles.length - 1].close,
    high: Math.max(...highs),
    low: Math.min(...lows),
    avgVolume: Math.round(volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length),
    totalVolume: volumes.reduce((sum, vol) => sum + vol, 0)
  };
};