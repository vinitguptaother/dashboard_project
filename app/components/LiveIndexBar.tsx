'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
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

  // Display name mapping
  const displayName: Record<string, string> = {
    'NIFTY': 'NIFTY 50',
    'SENSEX': 'SENSEX',
    'BANKNIFTY': 'BANK NIFTY'
  };

  // Show loading skeleton during hydration to prevent mismatch
  if (!isClient) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {symbols.map((symbol) => (
          <div key={symbol} className="glass-effect rounded-lg overflow-hidden animate-pulse">
            <div className="h-0.5 bg-gray-300" />
            <div className="p-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{displayName[symbol] || symbol}</p>
              <div className="h-8 bg-gray-200 rounded w-32 mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {symbols.map((symbol, i) => {
          const data = getDisplayData(symbol);
          const isPositive = data.change >= 0;
          const hasLiveData = prices[symbol] && typeof prices[symbol] === 'number';

          return (
            <div
              key={symbol}
              className="glass-effect rounded-lg overflow-hidden"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Colored top stripe */}
              <div className={`h-0.5 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="p-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">
                  {displayName[symbol] || symbol}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono-nums metric-glow text-gray-900">
                    {data.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  {isPositive ? (
                    <ArrowUp className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={isPositive ? 'badge-success' : 'badge-destructive'}>
                    {isPositive ? '+' : ''}{data.change.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-xs font-mono-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
                  </span>
                </div>
                <p className="text-[9px] text-gray-500 mt-1 font-mono-nums">
                  {hasLiveData ? `Updated ${formatTime(lastUpdated)}` : 'Demo Data'}
                  {loading && <RefreshCw className="w-2.5 h-2.5 inline ml-1 animate-spin" />}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default LiveIndexBar;