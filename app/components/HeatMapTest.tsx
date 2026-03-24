'use client';

import React, { useState } from 'react';
import { DEFAULT_WATCHLIST } from '../lib/watchlist';
import HeatMap from './HeatMap';

const HeatMapTest: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const handleSymbolClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    console.log('Selected:', symbol);
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Heat Map Test</h1>
      
      <div className="bg-gray-100 rounded-lg p-4">
        <h2 className="font-semibold mb-2">Testing with DEFAULT_WATCHLIST:</h2>
        <div className="text-sm text-gray-600">
          {DEFAULT_WATCHLIST.join(', ')}
        </div>
      </div>

      <HeatMap 
        symbols={DEFAULT_WATCHLIST}
        pollMs={2000}
        onSelect={handleSymbolClick}
      />

      {selectedSymbol && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Selected Stock:</h3>
          <p className="text-blue-800">{selectedSymbol}</p>
        </div>
      )}
    </div>
  );
};

export default HeatMapTest;