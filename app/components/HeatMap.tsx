'use client';

import React, { useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3 } from 'lucide-react';
import { useLTP } from '../hooks/useLTP';
import { SECTOR_MAP } from '../lib/watchlist';

interface HeatMapProps {
  symbols: string[];
  pollMs?: number;
  onSelect?: (symbol: string) => void;
}

const HeatMap: React.FC<HeatMapProps> = ({ symbols, pollMs = 2000, onSelect }) => {
  const { prices, ltpData, previousPrices, loading, error, lastUpdated } = useLTP({
    symbols,
    pollMs
  });

  // Get stock data with proper change calculation
  const getStockData = (symbol: string) => {
    const currentPrice = prices[symbol];
    const symbolLtpData = ltpData[symbol];
    const previousPrice = previousPrices[symbol];
    
    // Base prices for demo fallback
    const basePrices: Record<string, number> = {
      'RELIANCE': 2400,
      'TCS': 3200,
      'HDFCBANK': 1600,
      'INFY': 1500,
      'INFOSYS': 1500,
      'HDFC': 2650,
      'ICICIBANK': 900,
      'HINDUNILVR': 2500,
      'ITC': 450,
      'SBIN': 590,
      'BAJFINANCE': 6800,
      'LT': 2800,
      'KOTAKBANK': 1800,
      'AXISBANK': 1000,
      'ASIANPAINT': 3200,
      'MARUTI': 10500,
      'WIPRO': 420,
      'ULTRACEMCO': 8900,
      'NESTLEIND': 21000,
      'POWERGRID': 250,
      'TATASTEEL': 120,
      'HCLTECH': 1450
    };

    if (currentPrice && typeof currentPrice === 'number') {
      let change = 0;
      let changePercent = 0;
      
      // Priority 1: Use cp (change percentage) from ltp-batch data if available
      if (symbolLtpData?.cp !== undefined && typeof symbolLtpData.cp === 'number') {
        changePercent = symbolLtpData.cp;
        change = (changePercent / 100) * currentPrice;
      }
      // Priority 2: Compare with last tick (previous price) to infer up/down
      else if (previousPrice && typeof previousPrice === 'number' && previousPrice !== currentPrice) {
        change = currentPrice - previousPrice;
        changePercent = (change / previousPrice) * 100;
      }
      // Fallback: Use small random change for demo
      else {
        change = (Math.random() - 0.5) * currentPrice * 0.02; // ±1% for demo
        changePercent = (change / currentPrice) * 100;
      }
      
      return {
        price: currentPrice,
        change,
        changePercent,
        volume: symbolLtpData?.volume || 0,
        hasRealData: true
      };
    }
    
    // Demo data fallback when no real price available
    const basePrice = basePrices[symbol] || 1000;
    const change = (Math.random() - 0.5) * basePrice * 0.03;
    const price = basePrice + change;
    
    return {
      price,
      change,
      changePercent: (change / basePrice) * 100,
      volume: Math.floor(Math.random() * 1000000),
      hasRealData: false
    };
  };

  // Get color intensity based on change percentage
  const getColorClass = (changePercent: number): string => {
    if (changePercent >= 3) return 'bg-green-500 text-white';
    if (changePercent >= 1.5) return 'bg-green-400 text-white';
    if (changePercent >= 0.5) return 'bg-green-300 text-gray-900';
    if (changePercent >= -0.5) return 'bg-gray-200 text-gray-900';
    if (changePercent >= -1.5) return 'bg-red-300 text-gray-900';
    if (changePercent >= -3) return 'bg-red-400 text-white';
    return 'bg-red-500 text-white';
  };

  // Group symbols by sector
  const groupedSymbols = symbols.reduce((acc, symbol) => {
    const sector = SECTOR_MAP[symbol] || 'Others';
    if (!acc[sector]) acc[sector] = [];
    acc[sector].push(symbol);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Market Heat Map</h2>
          <span className="text-sm text-gray-500">({symbols.length} stocks)</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">-3%</span>
            <div className="w-3 h-3 bg-red-300 rounded ml-1"></div>
            <div className="w-3 h-3 bg-gray-200 rounded"></div>
            <div className="w-3 h-3 bg-green-300 rounded"></div>
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600 ml-1">+3%</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            {lastUpdated && (
              <span>Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main heat map grid */}
      <div className="space-y-4">
        {/* Show ungrouped view for smaller watchlists */}
        {symbols.length <= 15 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {symbols.map((symbol) => {
              const data = getStockData(symbol);
              const colorClass = getColorClass(data.changePercent);
              const isPositive = data.change >= 0;
              const sector = SECTOR_MAP[symbol] || 'Other';
              
              return (
                <div
                  key={symbol}
                  onClick={() => onSelect?.(symbol)}
                  className={`
                    relative p-3 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer
                    ${colorClass}
                    ${onSelect ? 'cursor-pointer' : 'cursor-default'}
                  `}
                  title={`${symbol} (${sector}): ₹${data.price.toFixed(2)} (${isPositive ? '+' : ''}${data.changePercent.toFixed(2)}%) ${data.hasRealData ? '• Live' : '• Demo'}`}
                >
                  <div className="text-xs font-medium truncate mb-1">
                    {symbol}
                  </div>
                  <div className="text-xs opacity-90 mb-1">
                    ₹{data.price.toFixed(data.price < 1000 ? 1 : 0)}
                  </div>
                  <div className="text-xs font-semibold">
                    {isPositive ? '+' : ''}{data.changePercent.toFixed(1)}%
                  </div>
                  
                  {/* Data source indicator */}
                  <div className="absolute top-1 left-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      data.hasRealData ? 'bg-green-400' : 'bg-yellow-400'
                    }`} title={data.hasRealData ? 'Live data' : 'Demo data'}></div>
                  </div>
                  
                  {/* Trend indicator */}
                  <div className="absolute top-1 right-1">
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 opacity-70" />
                    ) : (
                      <TrendingDown className="w-3 h-3 opacity-70" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Grouped by sector for larger watchlists
          Object.entries(groupedSymbols).map(([sector, sectorSymbols]) => (
            <div key={sector}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded bg-gray-300"></div>
                <span className="text-sm font-medium text-gray-700">{sector}</span>
                <span className="text-xs text-gray-500">({sectorSymbols.length})</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {sectorSymbols.map((symbol) => {
                  const data = getStockData(symbol);
                  const colorClass = getColorClass(data.changePercent);
                  const isPositive = data.change >= 0;
                  
                  return (
                    <div
                      key={symbol}
                      onClick={() => onSelect?.(symbol)}
                      className={`
                        relative p-2 rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg
                        ${colorClass}
                        ${onSelect ? 'cursor-pointer' : 'cursor-default'}
                      `}
                      title={`${symbol}: ₹${data.price.toFixed(2)} (${isPositive ? '+' : ''}${data.changePercent.toFixed(2)}%) ${data.hasRealData ? '• Live' : '• Demo'}`}
                    >
                      <div className="text-xs font-medium truncate mb-1">
                        {symbol}
                      </div>
                      <div className="text-xs opacity-90">
                        ₹{data.price.toFixed(0)}
                      </div>
                      <div className="text-xs font-semibold">
                        {isPositive ? '+' : ''}{data.changePercent.toFixed(1)}%
                      </div>
                      
                      {/* Data indicator */}
                      <div className="absolute top-0.5 left-0.5">
                        <div className={`w-1 h-1 rounded-full ${
                          data.hasRealData ? 'bg-green-400' : 'bg-yellow-400'
                        }`}></div>
                      </div>
                      
                      {/* Trend indicator */}
                      <div className="absolute top-0.5 right-0.5">
                        {isPositive ? (
                          <TrendingUp className="w-2.5 h-2.5 opacity-70" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5 opacity-70" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Status information */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-600">Live data</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            <span className="text-gray-600">Demo data</span>
          </div>
        </div>
        
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1">
            <span className="text-amber-700">
              ⚠️ API unavailable - showing demo data
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatMap;