'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { useLTP } from '../hooks/useLTP';
import { useTickFlash } from '../hooks/useTickFlash';

interface LiveIndexBarProps {
  symbols?: string[];
  pollMs?: number;
}

/**
 * LiveIndexBar — Koyfin × Aceternity reskin
 * ──────────────────────────────────────────────────────────────────
 * - Stacked surface (bg-1) with subtle dividers between indices
 * - Index names in small-caps label style
 * - Prices in JetBrains Mono with tick-flash on price change
 * - Aceternity-style pulsing LIVE dot
 * - No glass-effect / backdrop-blur
 */

// Per-index subcomponent so each gets its own tick-flash hook
const IndexTile: React.FC<{
  symbol: string;
  displayName: string;
  price: number;
  change: number;
  changePercent: number;
  hasLiveData: boolean;
  updatedTime: string;
  loading: boolean;
}> = ({ symbol, displayName, price, change, changePercent, hasLiveData, updatedTime, loading }) => {
  const isPositive = change >= 0;
  const flash = useTickFlash(price);

  return (
    <div className="flex items-center gap-4 px-4 py-3 first:pl-5 last:pr-5 border-r last:border-r-0 border-[var(--border-subtle)] min-w-0">
      {/* Label column */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="label-micro truncate">{displayName}</span>
        <span className="text-[9px] text-[var(--text-3)] font-mono-nums">
          {hasLiveData ? updatedTime : 'Demo'}
          {loading && <RefreshCw className="w-2.5 h-2.5 inline ml-1 animate-spin" />}
        </span>
      </div>

      {/* Price column */}
      <div className="flex flex-col items-end gap-0.5 min-w-0 ml-auto">
        <span
          className={`text-lg sm:text-xl font-semibold font-mono-nums leading-none text-[var(--text-1)] px-1 rounded ${flash}`}
        >
          {price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div className="flex items-center gap-1">
          {isPositive ? (
            <ArrowUp className="w-3 h-3 text-[var(--up)]" />
          ) : (
            <ArrowDown className="w-3 h-3 text-[var(--down)]" />
          )}
          <span
            className={`text-[11px] font-mono-nums ${isPositive ? 'price-up' : 'price-down'}`}
          >
            {isPositive ? '+' : ''}{change.toFixed(2)}
          </span>
          <span
            className={`text-[11px] font-mono-nums ${isPositive ? 'price-up' : 'price-down'}`}
          >
            ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    </div>
  );
};

const LiveIndexBar: React.FC<LiveIndexBarProps> = ({
  symbols = ['NIFTY', 'SENSEX', 'BANKNIFTY'],
  pollMs = 2000,
}) => {
  const [isClient, setIsClient] = useState(false);
  const { prices, ltpData, previousPrices, loading, error, lastUpdated } = useLTP({
    symbols,
    pollMs,
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  const formatTime = (date: Date | undefined): string => {
    if (!date) return '--:--:--';
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Static demo data to prevent hydration mismatch
  const getStaticDemoData = (symbol: string) => {
    const demoData = {
      NIFTY: { price: 19850.25, change: 127.3, changePercent: 0.65 },
      SENSEX: { price: 66590.85, change: -234.15, changePercent: -0.35 },
      BANKNIFTY: { price: 44890.1, change: 89.45, changePercent: 0.2 },
    };
    return demoData[symbol as keyof typeof demoData] || demoData.NIFTY;
  };

  const getDisplayData = (symbol: string) => {
    const currentPrice = prices[symbol];
    const symbolLtpData = ltpData[symbol];
    const previousPrice = previousPrices[symbol];

    if (currentPrice && typeof currentPrice === 'number') {
      let change = 0;
      let changePercent = 0;

      if (symbolLtpData?.cp !== undefined && typeof symbolLtpData.cp === 'number') {
        const cp = symbolLtpData.cp;
        if (Math.abs(cp) <= 50) {
          changePercent = cp;
          change = (changePercent / 100) * currentPrice;
        } else if (cp > 100) {
          change = currentPrice - cp;
          changePercent = (change / cp) * 100;
        }
      } else if (
        previousPrice &&
        typeof previousPrice === 'number' &&
        previousPrice > 100 &&
        previousPrice !== currentPrice
      ) {
        change = currentPrice - previousPrice;
        changePercent = (change / previousPrice) * 100;
      }

      if (Math.abs(changePercent) > 20) {
        changePercent = 0;
        change = 0;
      }

      return { price: currentPrice, change, changePercent };
    }

    return getStaticDemoData(symbol);
  };

  const displayName: Record<string, string> = {
    NIFTY: 'NIFTY 50',
    SENSEX: 'SENSEX',
    BANKNIFTY: 'BANK NIFTY',
  };

  // SSR skeleton — matches final layout to avoid hydration flicker
  if (!isClient) {
    return (
      <div className="surface-1 rounded-lg border-subtle mb-4 overflow-hidden">
        <div className="flex items-center px-3 py-1.5 border-b border-[var(--border-subtle)]">
          <span className="label-micro flex items-center gap-1.5">
            <span className="pulse-dot pulse-dot--accent" />
            LIVE
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {symbols.map((symbol) => (
            <div key={symbol} className="px-4 py-3 border-r last:border-r-0 border-[var(--border-subtle)]">
              <span className="label-micro">{displayName[symbol] || symbol}</span>
              <div className="h-5 w-28 mt-2 rounded bg-[var(--bg-2)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      {/* Stacked strip: LIVE badge row → indices row */}
      <div className="surface-1 rounded-lg border border-[var(--border-subtle)] overflow-hidden">
        {/* Header strip with pulsing LIVE dot */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border-subtle)]">
          <span className="label-micro flex items-center gap-1.5">
            <span className="pulse-dot" aria-hidden />
            LIVE
          </span>
          <span className="text-[10px] text-[var(--text-3)] font-mono-nums">
            {lastUpdated ? formatTime(lastUpdated) : '--:--:--'}
          </span>
        </div>

        {/* Index grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {symbols.map((symbol) => {
            const data = getDisplayData(symbol);
            const hasLiveData = Boolean(prices[symbol] && typeof prices[symbol] === 'number');
            return (
              <IndexTile
                key={symbol}
                symbol={symbol}
                displayName={displayName[symbol] || symbol}
                price={data.price}
                change={data.change}
                changePercent={data.changePercent}
                hasLiveData={hasLiveData}
                updatedTime={hasLiveData ? `Updated ${formatTime(lastUpdated)}` : 'Demo Data'}
                loading={loading}
              />
            );
          })}
        </div>
      </div>

      {error && (
        <div className="text-xs text-[var(--warn)] bg-[rgba(245,166,35,0.08)] border border-[rgba(245,166,35,0.25)] px-3 py-1.5 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default LiveIndexBar;
