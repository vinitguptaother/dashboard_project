'use client';

import { useState } from 'react';
import { Search, TrendingUp, TrendingDown, BarChart3, Calendar, Target, AlertCircle, Star, Activity } from 'lucide-react';

interface StockData {
  symbol: string;
  companyName: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  marketCap: string;
  sector: string;
  industry: string;
  lastUpdated: string;
  fundamentals: {
    [key: string]: number | string;
  };
  technical: {
    [key: string]: number | string;
  };
  other: {
    [key: string]: number | string;
  };
}

const StockSearchTab = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockData[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Mock stock database
  const stockDatabase: StockData[] = [
    {
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries Limited',
      currentPrice: 2485.75,
      change: 35.20,
      changePercent: 1.44,
      marketCap: '16.8L Cr',
      sector: 'Oil & Gas',
      industry: 'Refineries',
      lastUpdated: '2 minutes ago',
      fundamentals: {
        'Revenue growth (YoY)': 12.5,
        'Revenue growth (QoQ)': 8.2,
        'Profit margin': 8.7,
        'Earnings per share (EPS)': 98.5,
        'Price-to-earnings (PE) ratio': 24.8,
        'Price/Book ratio': 2.1,
        'PEG ratio (PE / EPS growth)': 1.8,
        'Return on Equity (ROE)': 15.2,
        'Return on Capital Employed (ROCE)': 12.8,
        'Free Cash Flow (FCF)': '45,000 Cr',
        'Debt-to-Equity ratio': 0.35,
        'Interest Coverage ratio': 8.5,
        'Dividend Yield': 0.8,
        'Promoter Holding %': 50.3,
        'Institutional Holding %': 25.7,
        'Operating Margin': 12.4,
        'Net Profit Margin': 8.7,
        'Book Value per Share': 1180,
        'Sales Growth': 15.2,
        'Consistency of Earnings': 'High',
        'Corporate Governance': 'Good'
      },
      technical: {
        'Price trends (Higher highs/lows)': 'Bullish',
        'Moving averages (20, 50, 200 EMA/SMA)': '20: 2420, 50: 2380, 200: 2250',
        'VWAP (Volume Weighted Average Price)': 2465,
        'RSI (Relative Strength Index)': 65,
        'MACD (Moving Average Convergence Divergence)': 'Bullish',
        'Bollinger Bands': 'Upper: 2520, Lower: 2380',
        'Stochastic Oscillator': 72,
        'Volume spikes': 'Above Average',
        'Average True Range (ATR)': 45.2,
        'Support and resistance levels': 'Support: 2400, Resistance: 2550',
        'Breakouts & pullbacks': 'Recent breakout',
        'Candlestick patterns': 'Bullish Engulfing',
        'Gap up/gap down': 'Gap up 1.2%',
        'Beta (Volatility relative to market)': 1.2,
        'Fibonacci levels': '61.8%: 2420, 38.2%: 2380',
        'Trendlines and channels': 'Ascending channel'
      },
      other: {
        'Liquidity / Daily Trading Volume': '2.5M shares',
        'Volatility': 'Medium',
        'News sentiment': 'Positive',
        'Earnings dates / upcoming events': 'Q3 Results: Jan 15',
        'FII/DII activity': 'FII: Buying, DII: Neutral',
        'Sector strength and rotation': 'Strong',
        'Correlation with market/index': 0.85,
        'Momentum (price & volume)': 'Strong',
        'Technical breakouts (with volume confirmation)': 'Yes',
        'Pre-market or after-market movements': '+0.8%',
        'Open interest and option chain data': 'High OI at 2500 CE',
        'Insider buying/selling trends': 'Neutral',
        'Management commentary and outlook': 'Positive',
        'Macroeconomic indicators (interest rates, inflation, etc.)': 'Favorable',
        'Moat / Competitive advantage (long-term only)': 'Strong'
      }
    },
    {
      symbol: 'TCS',
      companyName: 'Tata Consultancy Services Limited',
      currentPrice: 3720.45,
      change: -25.80,
      changePercent: -0.69,
      marketCap: '13.5L Cr',
      sector: 'Information Technology',
      industry: 'IT Services',
      lastUpdated: '1 minute ago',
      fundamentals: {
        'Revenue growth (YoY)': 8.4,
        'Revenue growth (QoQ)': 2.1,
        'Profit margin': 24.2,
        'Earnings per share (EPS)': 125.8,
        'Price-to-earnings (PE) ratio': 29.6,
        'Price/Book ratio': 12.5,
        'PEG ratio (PE / EPS growth)': 3.5,
        'Return on Equity (ROE)': 42.8,
        'Return on Capital Employed (ROCE)': 48.5,
        'Free Cash Flow (FCF)': '38,500 Cr',
        'Debt-to-Equity ratio': 0.02,
        'Interest Coverage ratio': 185.2,
        'Dividend Yield': 3.2,
        'Promoter Holding %': 72.3,
        'Institutional Holding %': 15.8,
        'Operating Margin': 25.8,
        'Net Profit Margin': 24.2,
        'Book Value per Share': 298,
        'Sales Growth': 8.4,
        'Consistency of Earnings': 'Very High',
        'Corporate Governance': 'Excellent'
      },
      technical: {
        'Price trends (Higher highs/lows)': 'Neutral',
        'Moving averages (20, 50, 200 EMA/SMA)': '20: 3750, 50: 3680, 200: 3580',
        'VWAP (Volume Weighted Average Price)': 3735,
        'RSI (Relative Strength Index)': 45,
        'MACD (Moving Average Convergence Divergence)': 'Bearish',
        'Bollinger Bands': 'Upper: 3820, Lower: 3620',
        'Stochastic Oscillator': 38,
        'Volume spikes': 'Below Average',
        'Average True Range (ATR)': 68.5,
        'Support and resistance levels': 'Support: 3650, Resistance: 3800',
        'Breakouts & pullbacks': 'Consolidation',
        'Candlestick patterns': 'Doji',
        'Gap up/gap down': 'No gap',
        'Beta (Volatility relative to market)': 0.8,
        'Fibonacci levels': '61.8%: 3680, 38.2%: 3750',
        'Trendlines and channels': 'Sideways channel'
      },
      other: {
        'Liquidity / Daily Trading Volume': '1.8M shares',
        'Volatility': 'Low',
        'News sentiment': 'Neutral',
        'Earnings dates / upcoming events': 'Q3 Results: Jan 10',
        'FII/DII activity': 'FII: Selling, DII: Buying',
        'Sector strength and rotation': 'Weak',
        'Correlation with market/index': 0.72,
        'Momentum (price & volume)': 'Weak',
        'Technical breakouts (with volume confirmation)': 'No',
        'Pre-market or after-market movements': '-0.3%',
        'Open interest and option chain data': 'High OI at 3700 PE',
        'Insider buying/selling trends': 'Neutral',
        'Management commentary and outlook': 'Cautious',
        'Macroeconomic indicators (interest rates, inflation, etc.)': 'Challenging',
        'Moat / Competitive advantage (long-term only)': 'Very Strong'
      }
    },
    {
      symbol: 'HDFC',
      companyName: 'HDFC Bank Limited',
      currentPrice: 1545.30,
      change: 18.75,
      changePercent: 1.23,
      marketCap: '11.8L Cr',
      sector: 'Financial Services',
      industry: 'Private Sector Bank',
      lastUpdated: '3 minutes ago',
      fundamentals: {
        'Revenue growth (YoY)': 18.5,
        'Revenue growth (QoQ)': 4.2,
        'Profit margin': 22.8,
        'Earnings per share (EPS)': 83.2,
        'Price-to-earnings (PE) ratio': 18.6,
        'Price/Book ratio': 2.8,
        'PEG ratio (PE / EPS growth)': 1.0,
        'Return on Equity (ROE)': 16.8,
        'Return on Capital Employed (ROCE)': 2.1,
        'Free Cash Flow (FCF)': 'N/A',
        'Debt-to-Equity ratio': 6.8,
        'Interest Coverage ratio': 'N/A',
        'Dividend Yield': 1.2,
        'Promoter Holding %': 0.0,
        'Institutional Holding %': 78.5,
        'Operating Margin': 'N/A',
        'Net Profit Margin': 22.8,
        'Book Value per Share': 552,
        'Sales Growth': 18.5,
        'Consistency of Earnings': 'High',
        'Corporate Governance': 'Excellent'
      },
      technical: {
        'Price trends (Higher highs/lows)': 'Bullish',
        'Moving averages (20, 50, 200 EMA/SMA)': '20: 1520, 50: 1485, 200: 1420',
        'VWAP (Volume Weighted Average Price)': 1535,
        'RSI (Relative Strength Index)': 68,
        'MACD (Moving Average Convergence Divergence)': 'Bullish',
        'Bollinger Bands': 'Upper: 1580, Lower: 1480',
        'Stochastic Oscillator': 75,
        'Volume spikes': 'High',
        'Average True Range (ATR)': 32.5,
        'Support and resistance levels': 'Support: 1500, Resistance: 1580',
        'Breakouts & pullbacks': 'Breakout confirmed',
        'Candlestick patterns': 'Hammer',
        'Gap up/gap down': 'Gap up 0.8%',
        'Beta (Volatility relative to market)': 1.1,
        'Fibonacci levels': '61.8%: 1510, 38.2%: 1540',
        'Trendlines and channels': 'Uptrend'
      },
      other: {
        'Liquidity / Daily Trading Volume': '3.2M shares',
        'Volatility': 'Medium',
        'News sentiment': 'Positive',
        'Earnings dates / upcoming events': 'Q3 Results: Jan 18',
        'FII/DII activity': 'FII: Buying, DII: Buying',
        'Sector strength and rotation': 'Strong',
        'Correlation with market/index': 0.88,
        'Momentum (price & volume)': 'Strong',
        'Technical breakouts (with volume confirmation)': 'Yes',
        'Pre-market or after-market movements': '+1.1%',
        'Open interest and option chain data': 'High OI at 1550 CE',
        'Insider buying/selling trends': 'Neutral',
        'Management commentary and outlook': 'Optimistic',
        'Macroeconomic indicators (interest rates, inflation, etc.)': 'Favorable',
        'Moat / Competitive advantage (long-term only)': 'Very Strong'
      }
    }
  ];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      setIsLoading(true);
      // Simulate API call delay
      setTimeout(() => {
        const results = stockDatabase.filter(stock => 
          stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
          stock.companyName.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(results);
        setIsLoading(false);
      }, 500);
    } else {
      setSearchResults([]);
    }
  };

  const handleStockSelect = (stock: StockData) => {
    setSelectedStock(stock);
    setSearchResults([]);
    setSearchQuery(stock.symbol);
  };

  const renderStockOverview = () => {
    if (!selectedStock) return null;

    return (
      <div className="space-y-6">
        {/* Stock Header */}
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedStock.symbol}</h2>
              <p className="text-gray-600">{selectedStock.companyName}</p>
              <p className="text-sm text-gray-500">{selectedStock.sector} • {selectedStock.industry}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">₹{selectedStock.currentPrice.toLocaleString()}</p>
              <div className={`flex items-center justify-end ${selectedStock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {selectedStock.change >= 0 ? <TrendingUp className="h-5 w-5 mr-1" /> : <TrendingDown className="h-5 w-5 mr-1" />}
                <span className="font-semibold">
                  {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change} ({selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent}%)
                </span>
              </div>
              <p className="text-sm text-gray-500">Last updated: {selectedStock.lastUpdated}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Market Cap</p>
              <p className="text-lg font-bold text-blue-600">{selectedStock.marketCap}</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">P/E Ratio</p>
              <p className="text-lg font-bold text-green-600">{selectedStock.fundamentals['Price-to-earnings (PE) ratio']}</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">ROE</p>
              <p className="text-lg font-bold text-purple-600">{selectedStock.fundamentals['Return on Equity (ROE)']}%</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-effect rounded-lg p-4 text-center">
            <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">{selectedStock.fundamentals['Revenue growth (YoY)']}%</p>
            <p className="text-sm text-gray-600">Revenue Growth</p>
          </div>
          <div className="glass-effect rounded-lg p-4 text-center">
            <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">{selectedStock.fundamentals['Profit margin']}%</p>
            <p className="text-sm text-gray-600">Profit Margin</p>
          </div>
          <div className="glass-effect rounded-lg p-4 text-center">
            <Activity className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">{selectedStock.technical['RSI (Relative Strength Index)']}</p>
            <p className="text-sm text-gray-600">RSI</p>
          </div>
          <div className="glass-effect rounded-lg p-4 text-center">
            <Star className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-lg font-bold text-gray-900">{selectedStock.fundamentals['Dividend Yield']}%</p>
            <p className="text-sm text-gray-600">Dividend Yield</p>
          </div>
        </div>
      </div>
    );
  };

  const renderParameterTable = (title: string, data: { [key: string]: number | string }, icon: any) => {
    const Icon = icon;
    return (
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Icon className="h-5 w-5 mr-2 text-blue-600" />
          {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-700">{key}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Search & Analysis</h1>
        <p className="text-gray-600">Search for detailed stock information and comprehensive analysis</p>
      </div>

      {/* Search Bar */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search stocks by symbol or company name (e.g., RELIANCE, TCS, HDFC)"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="mt-4 border border-gray-200 rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((stock, index) => (
              <div
                key={index}
                onClick={() => handleStockSelect(stock)}
                className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{stock.symbol}</h4>
                    <p className="text-sm text-gray-600">{stock.companyName}</p>
                    <p className="text-xs text-gray-500">{stock.sector}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">₹{stock.currentPrice}</p>
                    <p className={`text-sm ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.change} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent}%)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mt-4 text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Searching...</p>
          </div>
        )}
      </div>

      {/* Stock Details */}
      {selectedStock && (
        <>
          {/* Tab Navigation */}
          <div className="flex justify-center mb-6">
            <div className="glass-effect rounded-lg p-1 flex space-x-1">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'fundamentals', label: 'Fundamentals' },
                { id: 'technical', label: 'Technical' },
                { id: 'other', label: 'Other Factors' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && renderStockOverview()}
          {activeTab === 'fundamentals' && renderParameterTable('📌 Fundamental Analysis', selectedStock.fundamentals, BarChart3)}
          {activeTab === 'technical' && renderParameterTable('📈 Technical Analysis', selectedStock.technical, Activity)}
          {activeTab === 'other' && renderParameterTable('🧠 Other Factors', selectedStock.other, Target)}
        </>
      )}

      {/* No Stock Selected */}
      {!selectedStock && !isLoading && searchQuery === '' && (
        <div className="glass-effect rounded-xl p-12 shadow-lg text-center">
          <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Search for Stocks</h3>
          <p className="text-gray-600 mb-4">Enter a stock symbol or company name to get detailed analysis</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['RELIANCE', 'TCS', 'HDFC', 'INFY', 'ICICIBANK'].map((symbol) => (
              <button
                key={symbol}
                onClick={() => handleSearch(symbol)}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200 transition-colors"
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockSearchTab;