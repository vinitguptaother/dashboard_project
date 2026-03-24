'use client';

import React, { useState } from 'react';
import { Eye, Settings } from 'lucide-react';
import { DEFAULT_WATCHLIST } from '../lib/watchlist';
import HeatMap from './HeatMap';

const WatchlistHeatMapExample: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    console.log(`Selected symbol: ${symbol}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Eye className="w-5 h-5 mr-2 text-blue-600" />
              Market Watchlist Heat Map
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Tracking {DEFAULT_WATCHLIST.length} stocks from your default watchlist
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Real-time data</span>
          </div>
        </div>
        
        {/* Watchlist symbols display */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs font-medium text-gray-700 mb-2">DEFAULT_WATCHLIST:</div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_WATCHLIST.map((symbol) => (
              <span 
                key={symbol}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedSymbol === symbol 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {symbol}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Heat Map Component */}
      <HeatMap 
        symbols={DEFAULT_WATCHLIST}
        pollMs={3000}
        onSelect={handleSymbolSelect}
      />

      {/* Selected Symbol Info */}
      {selectedSymbol && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            <span className="font-medium text-blue-900">
              Selected: {selectedSymbol}
            </span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            Click on any stock in the heat map above to select it
          </p>
        </div>
      )}

      {/* Usage Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">How to use:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• The heat map shows real-time price changes for all watchlist stocks</li>
          <li>• Color intensity indicates the magnitude of price change</li>
          <li>• Green colors indicate positive changes, red indicates negative</li>
          <li>• Click on any stock tile to select and view detailed information</li>
          <li>• Stocks are grouped by sector for better organization</li>
        </ul>
      </div>
    </div>
  );
};

export default WatchlistHeatMapExample;