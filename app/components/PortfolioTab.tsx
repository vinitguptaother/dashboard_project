'use client';

import { useState } from 'react';
import { 
  Briefcase, 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Settings,
  BarChart3,
  Target,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';

interface Stock {
  id: string;
  symbol: string;
  companyName: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  currentPrice: number;
  parameters: {
    fundamental: { [key: string]: number | string };
    technical: { [key: string]: number | string };
    other: { [key: string]: number | string };
  };
}

interface Portfolio {
  id: string;
  name: string;
  description: string;
  createdDate: string;
  totalInvestment: number;
  currentValue: number;
  stocks: Stock[];
  riskLevel: 'Conservative' | 'Moderate' | 'Aggressive';
  strategy: string;
}

const PortfolioTab = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showEditStock, setShowEditStock] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);

  const [portfolios, setPortfolios] = useState<Portfolio[]>([
    {
      id: '1',
      name: 'Growth Portfolio',
      description: 'High-growth technology and emerging market stocks',
      createdDate: '2024-01-15',
      totalInvestment: 500000,
      currentValue: 587500,
      riskLevel: 'Aggressive',
      strategy: 'Long-term Growth',
      stocks: [
        {
          id: '1',
          symbol: 'RELIANCE',
          companyName: 'Reliance Industries Ltd',
          quantity: 100,
          purchasePrice: 2450,
          purchaseDate: '2024-01-20',
          currentPrice: 2485,
          parameters: {
            fundamental: {
              'Revenue growth (YoY)': 12.5,
              'PE ratio': 24.8,
              'ROE': 15.2,
              'Debt-to-Equity ratio': 0.35,
              'Dividend Yield': 0.8
            },
            technical: {
              'RSI': 65,
              'MACD': 'Bullish',
              'Moving averages (50 EMA)': 2420,
              'Support level': 2400,
              'Resistance level': 2550
            },
            other: {
              'Daily Trading Volume': '2.5M',
              'Beta': 1.2,
              'News sentiment': 'Positive',
              'FII activity': 'Buying'
            }
          }
        }
      ]
    },
    {
      id: '2',
      name: 'Dividend Portfolio',
      description: 'Stable dividend-paying blue-chip stocks',
      createdDate: '2024-02-01',
      totalInvestment: 300000,
      currentValue: 315000,
      riskLevel: 'Conservative',
      strategy: 'Dividend Income',
      stocks: []
    }
  ]);

  const fundamentalParameters = [
    'Revenue growth (YoY)', 'Revenue growth (QoQ)', 'Profit margin', 'Earnings per share (EPS)',
    'Price-to-earnings (PE) ratio', 'Price/Book ratio', 'PEG ratio (PE / EPS growth)',
    'Return on Equity (ROE)', 'Return on Capital Employed (ROCE)', 'Free Cash Flow (FCF)',
    'Debt-to-Equity ratio', 'Interest Coverage ratio', 'Dividend Yield', 'Promoter Holding %',
    'Institutional Holding %', 'Operating Margin', 'Net Profit Margin', 'Book Value per Share',
    'Sales Growth', 'Consistency of Earnings', 'Corporate Governance'
  ];

  const technicalParameters = [
    'Price trends (Higher highs/lows)', 'Moving averages (20, 50, 200 EMA/SMA)',
    'VWAP (Volume Weighted Average Price)', 'RSI (Relative Strength Index)',
    'MACD (Moving Average Convergence Divergence)', 'Bollinger Bands', 'Stochastic Oscillator',
    'Volume spikes', 'Average True Range (ATR)', 'Support and resistance levels',
    'Breakouts & pullbacks', 'Candlestick patterns', 'Gap up/gap down',
    'Beta (Volatility relative to market)', 'Fibonacci levels', 'Trendlines and channels'
  ];

  const otherParameters = [
    'Liquidity / Daily Trading Volume', 'Volatility', 'News sentiment', 'Earnings dates / upcoming events',
    'FII/DII activity', 'Sector strength and rotation', 'Correlation with market/index',
    'Momentum (price & volume)', 'Technical breakouts (with volume confirmation)',
    'Pre-market or after-market movements', 'Open interest and option chain data',
    'Insider buying/selling trends', 'Management commentary and outlook',
    'Macroeconomic indicators (interest rates, inflation, etc.)', 'Moat / Competitive advantage (long-term only)'
  ];

  const [newPortfolio, setNewPortfolio] = useState({
    name: '',
    description: '',
    riskLevel: 'Moderate' as const,
    strategy: ''
  });

  const [newStock, setNewStock] = useState({
    symbol: '',
    companyName: '',
    quantity: 0,
    purchasePrice: 0,
    purchaseDate: '',
    currentPrice: 0,
    selectedParameters: {
      fundamental: [] as string[],
      technical: [] as string[],
      other: [] as string[]
    },
    parameterValues: {
      fundamental: {} as { [key: string]: number | string },
      technical: {} as { [key: string]: number | string },
      other: {} as { [key: string]: number | string }
    }
  });

  const calculatePortfolioMetrics = (portfolio: Portfolio) => {
    const totalGainLoss = portfolio.currentValue - portfolio.totalInvestment;
    const gainLossPercentage = (totalGainLoss / portfolio.totalInvestment) * 100;
    
    return {
      totalGainLoss,
      gainLossPercentage,
      totalStocks: portfolio.stocks.length
    };
  };

  const calculateStockMetrics = (stock: Stock) => {
    const totalInvestment = stock.quantity * stock.purchasePrice;
    const currentValue = stock.quantity * stock.currentPrice;
    const gainLoss = currentValue - totalInvestment;
    const gainLossPercentage = (gainLoss / totalInvestment) * 100;

    return {
      totalInvestment,
      currentValue,
      gainLoss,
      gainLossPercentage
    };
  };

  const handleCreatePortfolio = () => {
    const portfolio: Portfolio = {
      id: Date.now().toString(),
      ...newPortfolio,
      createdDate: new Date().toISOString().split('T')[0],
      totalInvestment: 0,
      currentValue: 0,
      stocks: []
    };

    setPortfolios([...portfolios, portfolio]);
    setNewPortfolio({ name: '', description: '', riskLevel: 'Moderate', strategy: '' });
    setShowCreatePortfolio(false);
  };

  const handleAddStock = () => {
    if (!selectedPortfolio) return;

    const stock: Stock = {
      id: Date.now().toString(),
      symbol: newStock.symbol,
      companyName: newStock.companyName,
      quantity: newStock.quantity,
      purchasePrice: newStock.purchasePrice,
      purchaseDate: newStock.purchaseDate,
      currentPrice: newStock.currentPrice,
      parameters: {
        fundamental: newStock.parameterValues.fundamental,
        technical: newStock.parameterValues.technical,
        other: newStock.parameterValues.other
      }
    };

    setPortfolios(portfolios.map(p => {
      if (p.id === selectedPortfolio) {
        const updatedStocks = [...p.stocks, stock];
        const totalInvestment = updatedStocks.reduce((sum, s) => sum + (s.quantity * s.purchasePrice), 0);
        const currentValue = updatedStocks.reduce((sum, s) => sum + (s.quantity * s.currentPrice), 0);
        
        return {
          ...p,
          stocks: updatedStocks,
          totalInvestment,
          currentValue
        };
      }
      return p;
    }));

    setNewStock({
      symbol: '',
      companyName: '',
      quantity: 0,
      purchasePrice: 0,
      purchaseDate: '',
      currentPrice: 0,
      selectedParameters: { fundamental: [], technical: [], other: [] },
      parameterValues: { fundamental: {}, technical: {}, other: {} }
    });
    setShowAddStock(false);
  };

  const handleEditStock = () => {
    if (!editingStock || !selectedPortfolio) return;

    setPortfolios(portfolios.map(p => {
      if (p.id === selectedPortfolio) {
        const updatedStocks = p.stocks.map(s => s.id === editingStock.id ? editingStock : s);
        const totalInvestment = updatedStocks.reduce((sum, s) => sum + (s.quantity * s.purchasePrice), 0);
        const currentValue = updatedStocks.reduce((sum, s) => sum + (s.quantity * s.currentPrice), 0);
        
        return {
          ...p,
          stocks: updatedStocks,
          totalInvestment,
          currentValue
        };
      }
      return p;
    }));

    setEditingStock(null);
    setShowEditStock(false);
  };

  const handleDeleteStock = (stockId: string) => {
    if (!selectedPortfolio) return;

    setPortfolios(portfolios.map(p => {
      if (p.id === selectedPortfolio) {
        const updatedStocks = p.stocks.filter(s => s.id !== stockId);
        const totalInvestment = updatedStocks.reduce((sum, s) => sum + (s.quantity * s.purchasePrice), 0);
        const currentValue = updatedStocks.reduce((sum, s) => sum + (s.quantity * s.currentPrice), 0);
        
        return {
          ...p,
          stocks: updatedStocks,
          totalInvestment,
          currentValue
        };
      }
      return p;
    }));
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Portfolio Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {portfolios.map((portfolio) => {
          const metrics = calculatePortfolioMetrics(portfolio);
          return (
            <div 
              key={portfolio.id} 
              className="glass-effect rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer"
              onClick={() => {
                setSelectedPortfolio(portfolio.id);
                setActiveTab('details');
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{portfolio.name}</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  portfolio.riskLevel === 'Conservative' ? 'bg-green-100 text-green-800' :
                  portfolio.riskLevel === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {portfolio.riskLevel}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">{portfolio.description}</p>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Investment:</span>
                  <span className="font-medium">₹{portfolio.totalInvestment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Current Value:</span>
                  <span className="font-medium">₹{portfolio.currentValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">P&L:</span>
                  <span className={`font-medium flex items-center ${
                    metrics.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metrics.totalGainLoss >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                    ₹{Math.abs(metrics.totalGainLoss).toLocaleString()} ({metrics.gainLossPercentage.toFixed(2)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Stocks:</span>
                  <span className="font-medium">{metrics.totalStocks}</span>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Add New Portfolio Card */}
        <div 
          className="glass-effect rounded-xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-dashed border-gray-300 flex items-center justify-center"
          onClick={() => setShowCreatePortfolio(true)}
        >
          <div className="text-center">
            <Plus className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-gray-600">Create New Portfolio</h3>
            <p className="text-sm text-gray-500">Start building your investment portfolio</p>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-lg p-4 text-center">
          <Briefcase className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{portfolios.length}</p>
          <p className="text-sm text-gray-600">Total Portfolios</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            ₹{portfolios.reduce((sum, p) => sum + p.totalInvestment, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Total Investment</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            ₹{portfolios.reduce((sum, p) => sum + p.currentValue, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Current Value</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Target className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {portfolios.reduce((sum, p) => sum + p.stocks.length, 0)}
          </p>
          <p className="text-sm text-gray-600">Total Stocks</p>
        </div>
      </div>
    </div>
  );

  const renderPortfolioDetails = () => {
    const portfolio = portfolios.find(p => p.id === selectedPortfolio);
    if (!portfolio) return null;

    const metrics = calculatePortfolioMetrics(portfolio);

    return (
      <div className="space-y-6">
        {/* Portfolio Header */}
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{portfolio.name}</h2>
              <p className="text-gray-600">{portfolio.description}</p>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setShowAddStock(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stock
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Edit className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Investment</p>
              <p className="text-xl font-bold text-gray-900">₹{portfolio.totalInvestment.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Current Value</p>
              <p className="text-xl font-bold text-gray-900">₹{portfolio.currentValue.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Total P&L</p>
              <p className={`text-xl font-bold ${metrics.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{Math.abs(metrics.totalGainLoss).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Returns</p>
              <p className={`text-xl font-bold ${metrics.gainLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.gainLossPercentage.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Holdings</h3>
          {portfolio.stocks.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No stocks in this portfolio yet</p>
              <button 
                onClick={() => setShowAddStock(true)}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Your First Stock
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-900">Stock</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Qty</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Avg Price</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Current Price</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Investment</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">Current Value</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-900">P&L</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.stocks.map((stock) => {
                    const stockMetrics = calculateStockMetrics(stock);
                    return (
                      <tr key={stock.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div>
                            <span className="font-semibold text-gray-900">{stock.symbol}</span>
                            <p className="text-sm text-gray-600">{stock.companyName}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">{stock.quantity}</td>
                        <td className="py-3 px-2 text-right">₹{stock.purchasePrice}</td>
                        <td className="py-3 px-2 text-right">₹{stock.currentPrice}</td>
                        <td className="py-3 px-2 text-right">₹{stockMetrics.totalInvestment.toLocaleString()}</td>
                        <td className="py-3 px-2 text-right">₹{stockMetrics.currentValue.toLocaleString()}</td>
                        <td className="py-3 px-2 text-right">
                          <div className={`${stockMetrics.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <span className="font-medium">₹{Math.abs(stockMetrics.gainLoss).toLocaleString()}</span>
                            <p className="text-sm">({stockMetrics.gainLossPercentage.toFixed(2)}%)</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex justify-center space-x-2">
                            <button 
                              onClick={() => {
                                setEditingStock(stock);
                                setShowEditStock(true);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteStock(stock.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderParameterSection = (
    title: string, 
    parameters: string[], 
    selectedParams: string[], 
    paramValues: { [key: string]: number | string },
    onParamToggle: (param: string) => void,
    onValueChange: (param: string, value: string) => void
  ) => (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">{title}</h4>
      <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
        {parameters.map((param) => (
          <div key={param} className="flex items-center space-x-3 mb-2">
            <input
              type="checkbox"
              checked={selectedParams.includes(param)}
              onChange={() => onParamToggle(param)}
              className="rounded border-gray-300"
            />
            <label className="text-sm text-gray-700 flex-1">{param}</label>
            {selectedParams.includes(param) && (
              <input
                type="text"
                value={paramValues[param] || ''}
                onChange={(e) => onValueChange(param, e.target.value)}
                placeholder="Value"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Portfolio Management</h1>
        <p className="text-gray-600">Create and manage multiple investment portfolios with detailed tracking</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-6">
        <div className="glass-effect rounded-lg p-1 flex space-x-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            Overview
          </button>
          {selectedPortfolio && (
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 rounded-lg transition-all ${
                activeTab === 'details'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              Portfolio Details
            </button>
          )}
        </div>
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'details' && renderPortfolioDetails()}

      {/* Create Portfolio Modal */}
      {showCreatePortfolio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-effect rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Portfolio</h3>
              <button onClick={() => setShowCreatePortfolio(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio Name</label>
                <input
                  type="text"
                  value={newPortfolio.name}
                  onChange={(e) => setNewPortfolio({...newPortfolio, name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Enter portfolio name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newPortfolio.description}
                  onChange={(e) => setNewPortfolio({...newPortfolio, description: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Describe your investment strategy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
                <select
                  value={newPortfolio.riskLevel}
                  onChange={(e) => setNewPortfolio({...newPortfolio, riskLevel: e.target.value as any})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Aggressive">Aggressive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
                <input
                  type="text"
                  value={newPortfolio.strategy}
                  onChange={(e) => setNewPortfolio({...newPortfolio, strategy: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="e.g., Long-term Growth, Dividend Income"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => setShowCreatePortfolio(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreatePortfolio}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Portfolio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="glass-effect rounded-xl p-6 max-w-4xl w-full mx-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Stock to Portfolio</h3>
              <button onClick={() => setShowAddStock(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Stock Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Symbol</label>
                    <input
                      type="text"
                      value={newStock.symbol}
                      onChange={(e) => setNewStock({...newStock, symbol: e.target.value.toUpperCase()})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="e.g., RELIANCE"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={newStock.companyName}
                      onChange={(e) => setNewStock({...newStock, companyName: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="e.g., Reliance Industries Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={newStock.quantity}
                      onChange={(e) => setNewStock({...newStock, quantity: parseInt(e.target.value) || 0})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="Number of shares"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newStock.purchasePrice}
                      onChange={(e) => setNewStock({...newStock, purchasePrice: parseFloat(e.target.value) || 0})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="Price per share"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                    <input
                      type="date"
                      value={newStock.purchaseDate}
                      onChange={(e) => setNewStock({...newStock, purchaseDate: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newStock.currentPrice}
                      onChange={(e) => setNewStock({...newStock, currentPrice: parseFloat(e.target.value) || 0})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="Current market price"
                    />
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Analysis Parameters</h4>
                
                {/* Fundamental Parameters */}
                {renderParameterSection(
                  "📌 Fundamental Parameters",
                  fundamentalParameters,
                  newStock.selectedParameters.fundamental,
                  newStock.parameterValues.fundamental,
                  (param) => {
                    const selected = newStock.selectedParameters.fundamental;
                    const updated = selected.includes(param) 
                      ? selected.filter(p => p !== param)
                      : [...selected, param];
                    setNewStock({
                      ...newStock,
                      selectedParameters: { ...newStock.selectedParameters, fundamental: updated }
                    });
                  },
                  (param, value) => {
                    setNewStock({
                      ...newStock,
                      parameterValues: {
                        ...newStock.parameterValues,
                        fundamental: { ...newStock.parameterValues.fundamental, [param]: value }
                      }
                    });
                  }
                )}

                {/* Technical Parameters */}
                {renderParameterSection(
                  "📈 Technical Parameters",
                  technicalParameters,
                  newStock.selectedParameters.technical,
                  newStock.parameterValues.technical,
                  (param) => {
                    const selected = newStock.selectedParameters.technical;
                    const updated = selected.includes(param) 
                      ? selected.filter(p => p !== param)
                      : [...selected, param];
                    setNewStock({
                      ...newStock,
                      selectedParameters: { ...newStock.selectedParameters, technical: updated }
                    });
                  },
                  (param, value) => {
                    setNewStock({
                      ...newStock,
                      parameterValues: {
                        ...newStock.parameterValues,
                        technical: { ...newStock.parameterValues.technical, [param]: value }
                      }
                    });
                  }
                )}

                {/* Other Parameters */}
                {renderParameterSection(
                  "🧠 Other Factors",
                  otherParameters,
                  newStock.selectedParameters.other,
                  newStock.parameterValues.other,
                  (param) => {
                    const selected = newStock.selectedParameters.other;
                    const updated = selected.includes(param) 
                      ? selected.filter(p => p !== param)
                      : [...selected, param];
                    setNewStock({
                      ...newStock,
                      selectedParameters: { ...newStock.selectedParameters, other: updated }
                    });
                  },
                  (param, value) => {
                    setNewStock({
                      ...newStock,
                      parameterValues: {
                        ...newStock.parameterValues,
                        other: { ...newStock.parameterValues.other, [param]: value }
                      }
                    });
                  }
                )}
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => setShowAddStock(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddStock}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {showEditStock && editingStock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-effect rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Stock</h3>
              <button onClick={() => setShowEditStock(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={editingStock.quantity}
                  onChange={(e) => setEditingStock({...editingStock, quantity: parseInt(e.target.value) || 0})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingStock.purchasePrice}
                  onChange={(e) => setEditingStock({...editingStock, purchasePrice: parseFloat(e.target.value) || 0})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={editingStock.purchaseDate}
                  onChange={(e) => setEditingStock({...editingStock, purchaseDate: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingStock.currentPrice}
                  onChange={(e) => setEditingStock({...editingStock, currentPrice: parseFloat(e.target.value) || 0})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => setShowEditStock(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleEditStock}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioTab;