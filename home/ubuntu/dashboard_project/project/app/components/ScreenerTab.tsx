'use client';

import { useState } from 'react';
import { Search, Filter, TrendingUp, BarChart3, Target } from 'lucide-react';

const ScreenerTab = () => {
  const [filters, setFilters] = useState({
    marketCap: 'all',
    sector: 'all',
    peRatio: { min: '', max: '' },
    priceChange: 'all',
    volume: 'all',
    technicalPattern: 'all'
  });

  const [screenedStocks, setScreenedStocks] = useState([
    {
      symbol: 'BAJAJ FINANCE',
      price: 6850.30,
      change: 2.45,
      changePercent: 0.36,
      marketCap: '4.2L Cr',
      peRatio: 28.5,
      sector: 'NBFC',
      volume: 'High',
      technicalScore: 8.5,
      fundamentalScore: 9.2,
      pattern: 'Bullish Flag'
    },
    {
      symbol: 'ASIAN PAINTS',
      price: 3245.60,
      change: -15.20,
      changePercent: -0.47,
      marketCap: '3.1L Cr',
      peRatio: 58.2,
      sector: 'Paints',
      volume: 'Medium',
      technicalScore: 7.8,
      fundamentalScore: 9.4,
      pattern: 'Cup & Handle'
    },
    {
      symbol: 'HDFC BANK',
      price: 1545.30,
      change: 8.75,
      changePercent: 0.57,
      marketCap: '11.8L Cr',
      peRatio: 18.5,
      sector: 'Banking',
      volume: 'High',
      technicalScore: 8.2,
      fundamentalScore: 9.1,
      pattern: 'Ascending Triangle'
    },
    {
      symbol: 'TATA STEEL',
      price: 125.40,
      change: 3.20,
      changePercent: 2.62,
      marketCap: '1.5L Cr',
      peRatio: 45.2,
      sector: 'Metals',
      volume: 'Very High',
      technicalScore: 8.7,
      fundamentalScore: 7.8,
      pattern: 'Breakout'
    }
  ]);

  const [presetScreens, setPresetScreens] = useState([
    {
      name: 'Momentum Stocks',
      description: 'Stocks with strong price momentum and volume',
      criteria: 'Price change > 5%, Volume > 2x avg',
      count: 23
    },
    {
      name: 'Value Picks',
      description: 'Undervalued stocks with strong fundamentals',
      criteria: 'P/E < 15, ROE > 15%, Debt/Equity < 0.5',
      count: 18
    },
    {
      name: 'Breakout Candidates',
      description: 'Stocks near technical breakout levels',
      criteria: 'Near 52-week high, Volume surge',
      count: 31
    },
    {
      name: 'Dividend Aristocrats',
      description: 'Consistent dividend paying companies',
      criteria: 'Dividend yield > 2%, 5yr consistency',
      count: 15
    }
  ]);

  const handleFilterChange = (filterType: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getVolumeColor = (volume: string) => {
    switch (volume) {
      case 'Very High': return 'text-red-600 bg-red-50';
      case 'High': return 'text-orange-600 bg-orange-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'Low': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Screener</h1>
        <p className="text-gray-600">Advanced filtering to find investment opportunities</p>
      </div>

      {/* Preset Screens */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2 text-blue-600" />
          Preset Screens
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {presetScreens.map((screen, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer">
              <h4 className="font-semibold text-gray-900 mb-2">{screen.name}</h4>
              <p className="text-sm text-gray-600 mb-2">{screen.description}</p>
              <p className="text-xs text-gray-500 mb-3">{screen.criteria}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-blue-600">{screen.count}</span>
                <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Apply →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Filters */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Filter className="h-5 w-5 mr-2 text-green-600" />
          Custom Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Market Cap</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              value={filters.marketCap}
              onChange={(e) => handleFilterChange('marketCap', e.target.value)}
            >
              <option value="all">All</option>
              <option value="large">Large Cap</option>
              <option value="mid">Mid Cap</option>
              <option value="small">Small Cap</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              value={filters.sector}
              onChange={(e) => handleFilterChange('sector', e.target.value)}
            >
              <option value="all">All Sectors</option>
              <option value="banking">Banking</option>
              <option value="it">IT Services</option>
              <option value="auto">Automobile</option>
              <option value="pharma">Pharmaceuticals</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">P/E Ratio</label>
            <div className="flex space-x-1">
              <input 
                type="number" 
                placeholder="Min"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                value={filters.peRatio.min}
                onChange={(e) => handleFilterChange('peRatio', {...filters.peRatio, min: e.target.value})}
              />
              <input 
                type="number" 
                placeholder="Max"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                value={filters.peRatio.max}
                onChange={(e) => handleFilterChange('peRatio', {...filters.peRatio, max: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Change</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              value={filters.priceChange}
              onChange={(e) => handleFilterChange('priceChange', e.target.value)}
            >
              <option value="all">All</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="strong-up">+5% or more</option>
              <option value="strong-down">-5% or more</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Volume</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              value={filters.volume}
              onChange={(e) => handleFilterChange('volume', e.target.value)}
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="very-high">Very High</option>
              <option value="above-avg">Above Average</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
            <select 
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              value={filters.technicalPattern}
              onChange={(e) => handleFilterChange('technicalPattern', e.target.value)}
            >
              <option value="all">All Patterns</option>
              <option value="breakout">Breakout</option>
              <option value="flag">Flag Pattern</option>
              <option value="triangle">Triangle</option>
              <option value="cup-handle">Cup & Handle</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex space-x-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Apply Filters
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* Screened Results */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Search className="h-5 w-5 mr-2 text-purple-600" />
          Screened Results ({screenedStocks.length} stocks)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-900">Symbol</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Price</th>
                <th className="text-right py-3 px-2 font-medium text-gray-900">Change</th>
                <th className="text-center py-3 px-2 font-medium text-gray-900">Market Cap</th>
                <th className="text-center py-3 px-2 font-medium text-gray-900">P/E</th>
                <th className="text-center py-3 px-2 font-medium text-gray-900">Sector</th>
                <th className="text-center py-3 px-2 font-medium text-gray-900">Volume</th>
                <th className="text-center py-3 px-2 font-medium text-gray-900">Tech Score</th>
                <th className="text-center py-3 px-2 font-medium text-gray-900">Fund Score</th>
                <th className="text-center py-3 px-2 font-medium text-gray-900">Pattern</th>
              </tr>
            </thead>
            <tbody>
              {screenedStocks.map((stock, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <span className="font-semibold text-gray-900">{stock.symbol}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-medium">₹{stock.price}</span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className={`${getChangeColor(stock.change)}`}>
                      <span className="font-medium">{stock.change > 0 ? '+' : ''}{stock.change}</span>
                      <span className="text-sm"> ({stock.changePercent > 0 ? '+' : ''}{stock.changePercent}%)</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center text-sm">{stock.marketCap}</td>
                  <td className="py-3 px-2 text-center text-sm">{stock.peRatio}</td>
                  <td className="py-3 px-2 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {stock.sector}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`px-2 py-1 text-xs rounded ${getVolumeColor(stock.volume)}`}>
                      {stock.volume}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="font-medium text-green-600">{stock.technicalScore}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="font-medium text-blue-600">{stock.fundamentalScore}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                      {stock.pattern}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screening Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-lg p-4 text-center">
          <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">2,847</p>
          <p className="text-sm text-gray-600">Total Stocks</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Search className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">156</p>
          <p className="text-sm text-gray-600">Filtered Results</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">89</p>
          <p className="text-sm text-gray-600">Bullish Signals</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Target className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">23</p>
          <p className="text-sm text-gray-600">High Confidence</p>
        </div>
      </div>
    </div>
  );
};

export default ScreenerTab;