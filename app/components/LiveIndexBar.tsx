'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Activity } from 'lucide-react';
import { useLTP } from '../hooks/useLTP';

interface LiveIndexBarProps {
  symbols?: string[];
  pollMs?: number;
}

const LiveIndexBar: React.FC<LiveIndexBarProps> = ({ 
  symbols = ['NIFTY', 'SENSEX', 'BANKNIFTY'], 
  pollMs = 2000 
}) => {
  const [isClient, setIsClient] = useState(false);
  const { prices, ltpData, previousPrices, loading, error, lastUpdated } = useLTP({
    symbols,
    pollMs
  });

  // Ensure component only renders dynamic content on client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Format time as hh:mm:ss
  const formatTime = (date: Date | undefined): string => {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Static demo data to prevent hydration mismatch
  const getStaticDemoData = (symbol: string) => {
    const demoData = {
      'NIFTY': { price: 19850.25, change: 127.30, changePercent: 0.65 },
      'SENSEX': { price: 66590.85, change: -234.15, changePercent: -0.35 },
      'BANKNIFTY': { price: 44890.10, change: 89.45, changePercent: 0.20 }
    };
    return demoData[symbol as keyof typeof demoData] || demoData['NIFTY'];
  };



  // Get display data with proper change calculation
  const getDisplayData = (symbol: string) => {
    const currentPrice = prices[symbol];
    const symbolLtpData = ltpData[symbol];
    const previousPrice = previousPrices[symbol];

    // Check if we have live data
    if (currentPrice && typeof currentPrice === 'number') {
      let change = 0;
      let changePercent = 0;

      // Priority 1: Use cp from ltp-batch data if available
      if (symbolLtpData?.cp !== undefined && typeof symbolLtpData.cp === 'number') {
        const cp = symbolLtpData.cp;
        if (Math.abs(cp) <= 50) {
          // cp is already a change percentage (demo data or pre-calculated)
          changePercent = cp;
          change = (changePercent / 100) * currentPrice;
        } else if (cp > 100) {
          // cp is a close price (from Upstox API) — calculate change from it
          change = currentPrice - cp;
          changePercent = (change / cp) * 100;
        }
      }
      // Priority 2: Compare with previous price to infer up/down
      else if (previousPrice && typeof previousPrice === 'number' && previousPrice > 100 && previousPrice !== currentPrice) {
        change = currentPrice - previousPrice;
        changePercent = (change / previousPrice) * 100;
      }

      // Safety clamp: no index/stock moves 20%+ in a single session
      if (Math.abs(changePercent) > 20) {
        changePercent = 0;
        change = 0;
      }

      return { price: currentPrice, change, changePercent };
    }

    // Use static demo data when no live data available
    return getStaticDemoData(symbol);
  };

  // Show loading skeleton during hydration to prevent mismatch
  if (!isClient) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Live Index Bar</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {symbols.map((symbol) => (
            <div key={symbol} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
              <div>
                <h3 className="text-sm font-medium text-gray-600 uppercase">{symbol}</h3>
                <div className="h-8 bg-gray-200 rounded w-32 mt-1"></div>
              </div>
              <div className="w-12 h-12 rounded-full bg-gray-200"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Live Index Bar</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
          <span>Last updated {formatTime(lastUpdated)}</span>
          {error && (
            <span className="text-amber-600 ml-2">• Demo Mode</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {symbols.map((symbol) => {
          const data = getDisplayData(symbol);
          const isPositive = data.change >= 0;
          const hasLiveData = prices[symbol] && typeof prices[symbol] === 'number';
          
          return (
            <div
              key={symbol}
              className={`flex items-center justify-between p-4 rounded-lg ${
                hasLiveData ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-600 uppercase">
                    {symbol}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    hasLiveData ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {hasLiveData ? 'LIVE' : 'DEMO'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-bold text-gray-900">
                    ₹{data.price.toFixed(2)}
                  </span>
                  <div className={`flex items-center gap-1 ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {isPositive ? '+' : ''}{data.change.toFixed(2)}
                    </span>
                    <span className="text-xs">
                      ({isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isPositive ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {isPositive ? (
                  <TrendingUp className={`w-6 h-6 text-green-600`} />
                ) : (
                  <TrendingDown className={`w-6 h-6 text-red-600`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 text-xs text-amber-600 bg-amber-50 p-2 rounded">
          ⚠️ Error: {error}
        </div>
      )}
    </div>
  );
};

export default LiveIndexBar;