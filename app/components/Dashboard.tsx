'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Brain,
  Target,
  AlertTriangle,
  CheckCircle,
  Bell,
  Plus
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useMarketData, usePortfolios, useNotifications } from '../hooks/useRealTimeData';

const Dashboard = () => {
  const { marketData, isLoading: marketLoading } = useMarketData();
  const { portfolios } = usePortfolios();
  const { notifications, unreadCount, createPriceAlert } = useNotifications();
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertForm, setAlertForm] = useState({
    symbol: '',
    targetPrice: '',
    condition: 'above' as 'above' | 'below'
  });

  const [aiRecommendations, setAiRecommendations] = useState([
    {
      symbol: 'RELIANCE',
      action: 'BUY',
      confidence: 85,
      targetPrice: 2650,
      currentPrice: 2485,
      strategy: 'Swing Trading',
      reason: 'Strong technical breakout with volume confirmation'
    },
    {
      symbol: 'TCS',
      action: 'HOLD',
      confidence: 78,
      targetPrice: 3850,
      currentPrice: 3720,
      strategy: 'Long Term',
      reason: 'Solid fundamentals, awaiting Q3 results'
    },
    {
      symbol: 'HDFC BANK',
      action: 'BUY',
      confidence: 92,
      targetPrice: 1680,
      currentPrice: 1545,
      strategy: 'Intraday',
      reason: 'Oversold conditions with RSI divergence'
    }
  ]);

  const [chartData, setChartData] = useState([
    { time: '9:15', nifty: 19720, volume: 1200 },
    { time: '10:00', nifty: 19745, volume: 1850 },
    { time: '11:00', nifty: 19780, volume: 2100 },
    { time: '12:00', nifty: 19825, volume: 1950 },
    { time: '13:00', nifty: 19810, volume: 1750 },
    { time: '14:00', nifty: 19840, volume: 2200 },
    { time: '15:00', nifty: 19850, volume: 2500 }
  ]);

  // Update chart data when market data changes
  useEffect(() => {
    if (marketData) {
      const currentTime = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      setChartData(prev => {
        const newData = [...prev];
        if (newData.length >= 20) {
          newData.shift(); // Remove oldest data point
        }
        newData.push({
          time: currentTime,
          nifty: Math.round(marketData.nifty.price),
          volume: Math.round(marketData.nifty.volume / 1000)
        });
        return newData;
      });
    }
  }, [marketData]);

  const portfolioData = portfolios.length > 0 ? [
    { name: 'Equity', value: portfolios.reduce((sum, p) => sum + p.currentValue, 0) * 0.75, allocation: 75 },
    { name: 'Debt', value: portfolios.reduce((sum, p) => sum + p.currentValue, 0) * 0.15, allocation: 15 },
    { name: 'Cash', value: portfolios.reduce((sum, p) => sum + p.currentValue, 0) * 0.10, allocation: 10 }
  ] : [
    { name: 'Equity', value: 750000, allocation: 75 },
    { name: 'Debt', value: 150000, allocation: 15 },
    { name: 'Cash', value: 100000, allocation: 10 }
  ];

  const handleCreateAlert = () => {
    if (alertForm.symbol && alertForm.targetPrice) {
      createPriceAlert(
        alertForm.symbol.toUpperCase(),
        parseFloat(alertForm.targetPrice),
        alertForm.condition
      );
      setAlertForm({ symbol: '', targetPrice: '', condition: 'above' });
      setShowAlertModal(false);
    }
  };

  if (marketLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 slide-in">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI-Powered Market Dashboard</h1>
        <p className="text-gray-600">Real-time insights and intelligent recommendations for Indian markets</p>
        
        {/* Notifications Badge */}
        {unreadCount > 0 && (
          <div className="mt-4 flex justify-center">
            <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2 flex items-center space-x-2">
              <Bell className="h-4 w-4 text-red-600" />
              <span className="text-red-800 text-sm font-medium">
                {unreadCount} new notification{unreadCount > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">NIFTY 50</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{marketData?.nifty.price.toLocaleString() || '19,850.25'}
              </p>
            </div>
            <div className={`flex items-center space-x-1 ${
              (marketData?.nifty.change || 125.30) > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(marketData?.nifty.change || 125.30) > 0 ? 
                <TrendingUp className="h-5 w-5" /> : 
                <TrendingDown className="h-5 w-5" />
              }
              <span className="font-semibold">
                {(marketData?.nifty.change || 125.30) > 0 ? '+' : ''}
                {marketData?.nifty.change.toFixed(2) || '125.30'} (
                {(marketData?.nifty.changePercent || 0.63) > 0 ? '+' : ''}
                {marketData?.nifty.changePercent.toFixed(2) || '0.63'}%)
              </span>
            </div>
          </div>
        </div>

        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">SENSEX</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{marketData?.sensex.price.toLocaleString() || '66,589.93'}
              </p>
            </div>
            <div className={`flex items-center space-x-1 ${
              (marketData?.sensex.change || 418.60) > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(marketData?.sensex.change || 418.60) > 0 ? 
                <TrendingUp className="h-5 w-5" /> : 
                <TrendingDown className="h-5 w-5" />
              }
              <span className="font-semibold">
                {(marketData?.sensex.change || 418.60) > 0 ? '+' : ''}
                {marketData?.sensex.change.toFixed(2) || '418.60'} (
                {(marketData?.sensex.changePercent || 0.63) > 0 ? '+' : ''}
                {marketData?.sensex.changePercent.toFixed(2) || '0.63'}%)
              </span>
            </div>
          </div>
        </div>

        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">BANK NIFTY</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{marketData?.bankNifty.price.toLocaleString() || '44,892.15'}
              </p>
            </div>
            <div className={`flex items-center space-x-1 ${
              (marketData?.bankNifty.change || -89.25) > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(marketData?.bankNifty.change || -89.25) > 0 ? 
                <TrendingUp className="h-5 w-5" /> : 
                <TrendingDown className="h-5 w-5" />
              }
              <span className="font-semibold">
                {marketData?.bankNifty.change.toFixed(2) || '-89.25'} (
                {marketData?.bankNifty.changePercent.toFixed(2) || '-0.20'}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-600" />
              NIFTY Live Chart
            </h3>
            <button
              onClick={() => setShowAlertModal(true)}
              className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Alert</span>
            </button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="nifty" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-green-600" />
            Portfolio Allocation
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={portfolioData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Value']} />
              <Bar dataKey="value" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-purple-600" />
          AI-Powered Recommendations
        </h3>
        <div className="space-y-4">
          {aiRecommendations.map((rec, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg text-gray-900">{rec.symbol}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    rec.action === 'BUY' ? 'bg-green-100 text-green-800' :
                    rec.action === 'SELL' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {rec.action}
                  </span>
                  <span className="text-sm text-gray-600">{rec.strategy}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Confidence: {rec.confidence}%</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Current Price: </span>
                  <span className="font-semibold">₹{rec.currentPrice}</span>
                </div>
                <div>
                  <span className="text-gray-600">Target Price: </span>
                  <span className="font-semibold text-green-600">₹{rec.targetPrice}</span>
                </div>
                <div>
                  <span className="text-gray-600">Potential: </span>
                  <span className="font-semibold text-blue-600">
                    {((rec.targetPrice - rec.currentPrice) / rec.currentPrice * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-2">{rec.reason}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-lg p-4 text-center">
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{portfolios.length}</p>
          <p className="text-sm text-gray-600">Active Portfolios</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {portfolios.length > 0 ? 
              `${(portfolios.reduce((sum, p) => sum + p.totalPnLPercent, 0) / portfolios.length).toFixed(1)}%` : 
              '+8.5%'
            }
          </p>
          <p className="text-sm text-gray-600">Avg Portfolio Return</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
          <p className="text-sm text-gray-600">Active Alerts</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Brain className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">89%</p>
          <p className="text-sm text-gray-600">AI Accuracy</p>
        </div>
      </div>

      {/* Price Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-effect rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Price Alert</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Symbol</label>
                <input
                  type="text"
                  value={alertForm.symbol}
                  onChange={(e) => setAlertForm({...alertForm, symbol: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="e.g., RELIANCE"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Price (₹)</label>
                <input
                  type="number"
                  value={alertForm.targetPrice}
                  onChange={(e) => setAlertForm({...alertForm, targetPrice: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Enter target price"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                <select
                  value={alertForm.condition}
                  onChange={(e) => setAlertForm({...alertForm, condition: e.target.value as 'above' | 'below'})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="above">Price goes above</option>
                  <option value="below">Price goes below</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => setShowAlertModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateAlert}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;