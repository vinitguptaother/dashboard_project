'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, TrendingUp, BarChart3, Target, RefreshCw, Loader2 } from 'lucide-react';
import { screenerService, ScreenedStock, PresetScreen, ScreeningStatistics, ScreeningFilters } from '../lib/screenerService';
import { AuthClient } from '../lib/apiService';

const ScreenerTab = () => {
  const [filters, setFilters] = useState<ScreeningFilters>({
    marketCap: 'all',
    sector: 'all',
    peRatioMin: '',
    peRatioMax: '',
    priceChange: 'all',
    volume: 'all',
    technicalPattern: 'all'
  });

  const [screenedStocks, setScreenedStocks] = useState<ScreenedStock[]>([]);
  const [presetScreens, setPresetScreens] = useState<PresetScreen[]>([]);
  const [statistics, setStatistics] = useState<ScreeningStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    if (!AuthClient.token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [presets, stats] = await Promise.all([
        screenerService.getPresetScreens(),
        screenerService.getStatistics()
      ]);
      
      setPresetScreens(presets);
      setStatistics(stats);
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      setError('Failed to load screening data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadScreenedStocks = async (filterParams: ScreeningFilters = {}) => {
    if (!AuthClient.token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await screenerService.getScreenedStocks({
        ...filterParams,
        page: currentPage,
        limit: 50
      });
      
      setScreenedStocks(result.stocks);
      setTotalPages(result.pagination.totalPages);
    } catch (error: any) {
      console.error('Error loading screened stocks:', error);
      setError('Failed to load screened stocks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleApplyFilters = async () => {
    setCurrentPage(1);
    await loadScreenedStocks(filters);
  };

  const handleResetFilters = () => {
    setFilters({
      marketCap: 'all',
      sector: 'all',
      peRatioMin: '',
      peRatioMax: '',
      priceChange: 'all',
      volume: 'all',
      technicalPattern: 'all'
    });
    setCurrentPage(1);
    loadScreenedStocks({});
  };

  const handlePresetClick = async (preset: PresetScreen) => {
    if (preset.filters) {
      setFilters(preset.filters);
      setCurrentPage(1);
      await loadScreenedStocks(preset.filters);
    }
  };

  const handleRefresh = async () => {
    await loadInitialData();
    await loadScreenedStocks(filters);
  };

  if (!AuthClient.token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Login Required</h3>
          <p className="text-gray-600 mb-4">Please log in to access the stock screener</p>
          <p className="text-sm text-gray-500">Use demo@stockdashboard.com / demo123</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mr-4">Stock Screener</h1>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
            title="Refresh data"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          </button>
        </div>
        <p className="text-gray-600">Advanced filtering to find investment opportunities</p>
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Preset Screens */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2 text-blue-600" />
          Preset Screens
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {presetScreens.map((screen, index) => (
            <div 
              key={index} 
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
              onClick={() => handlePresetClick(screen)}
            >
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
                value={filters.peRatioMin}
                onChange={(e) => handleFilterChange('peRatioMin', e.target.value)}
              />
              <input 
                type="number" 
                placeholder="Max"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                value={filters.peRatioMax}
                onChange={(e) => handleFilterChange('peRatioMax', e.target.value)}
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
          <button 
            onClick={handleApplyFilters}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
            Apply Filters
          </button>
          <button 
            onClick={handleResetFilters}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Screened Results */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Search className="h-5 w-5 mr-2 text-purple-600" />
          Screened Results ({screenedStocks.length} stocks)
          {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
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
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-effect rounded-lg p-4 text-center">
            <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{statistics.totalStocks.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Total Stocks</p>
          </div>
          <div className="glass-effect rounded-lg p-4 text-center">
            <Search className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{statistics.filteredResults}</p>
            <p className="text-sm text-gray-600">Filtered Results</p>
          </div>
          <div className="glass-effect rounded-lg p-4 text-center">
            <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{statistics.bullishSignals}</p>
            <p className="text-sm text-gray-600">Bullish Signals</p>
          </div>
          <div className="glass-effect rounded-lg p-4 text-center">
            <Target className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{statistics.highConfidence}</p>
            <p className="text-sm text-gray-600">High Confidence</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenerTab;