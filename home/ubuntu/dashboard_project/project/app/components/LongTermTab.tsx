'use client';

import { useState } from 'react';
import { Calendar, TrendingUp, Shield, Award, PieChart } from 'lucide-react';

const LongTermTab = () => {
  const [longTermPicks, setLongTermPicks] = useState([
    {
      symbol: 'ASIAN PAINTS',
      price: 3245.60,
      recommendation: 'BUY',
      targetPrice: 4200,
      timeHorizon: '12-18 months',
      fundamentalScore: 9.4,
      technicalScore: 8.7,
      dividendYield: 0.8,
      peRatio: 58.2,
      marketCap: '3.1L Cr',
      sector: 'Paints',
      reason: 'Market leader with strong brand moat, rural recovery expected'
    },
    {
      symbol: 'HDFC BANK',
      price: 1545.30,
      recommendation: 'ACCUMULATE',
      targetPrice: 1950,
      timeHorizon: '18-24 months',
      fundamentalScore: 9.1,
      technicalScore: 7.8,
      dividendYield: 1.2,
      peRatio: 18.5,
      marketCap: '11.8L Cr',
      sector: 'Banking',
      reason: 'Best-in-class bank, merger benefits to materialize'
    },
    {
      symbol: 'INFOSYS',
      price: 1420.75,
      recommendation: 'BUY',
      targetPrice: 1750,
      timeHorizon: '15-20 months',
      fundamentalScore: 8.8,
      technicalScore: 8.2,
      dividendYield: 2.4,
      peRatio: 24.3,
      marketCap: '5.9L Cr',
      sector: 'IT Services',
      reason: 'AI transformation leader, strong deal pipeline'
    }
  ]);

  const [portfolioAllocation, setPortfolioAllocation] = useState([
    { category: 'Large Cap', allocation: 60, amount: 600000, color: '#059669' },
    { category: 'Mid Cap', allocation: 25, amount: 250000, color: '#2563eb' },
    { category: 'Small Cap', allocation: 10, amount: 100000, color: '#dc2626' },
    { category: 'Cash', allocation: 5, amount: 50000, color: '#6b7280' }
  ]);

  const [sectorAllocation, setSectorAllocation] = useState([
    { sector: 'Banking & Finance', allocation: 25, color: '#059669' },
    { sector: 'IT Services', allocation: 20, color: '#2563eb' },
    { sector: 'Consumer Goods', allocation: 15, color: '#dc2626' },
    { sector: 'Healthcare', allocation: 12, color: '#7c3aed' },
    { sector: 'Others', allocation: 28, color: '#6b7280' }
  ]);

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY': return 'text-green-600 bg-green-50';
      case 'ACCUMULATE': return 'text-blue-600 bg-blue-50';
      case 'HOLD': return 'text-yellow-600 bg-yellow-50';
      case 'SELL': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Long Term Investment Ideas</h1>
        <p className="text-gray-600">Quality stocks for wealth creation over 6+ months</p>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PieChart className="h-5 w-5 mr-2 text-blue-600" />
            Portfolio Allocation
          </h3>
          <div className="space-y-3">
            {portfolioAllocation.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-900">{item.category}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">{item.allocation}%</span>
                  <p className="text-xs text-gray-600">₹{(item.amount / 1000).toFixed(0)}K</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-green-600" />
            Sector Allocation
          </h3>
          <div className="space-y-3">
            {sectorAllocation.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-900">{item.sector}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{item.allocation}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Long Term Recommendations */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-purple-600" />
          Long Term Investment Recommendations
        </h3>
        <div className="space-y-4">
          {longTermPicks.map((stock, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg text-gray-900">{stock.symbol}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRecommendationColor(stock.recommendation)}`}>
                    {stock.recommendation}
                  </span>
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {stock.sector}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Time Horizon</p>
                  <p className="text-sm font-medium text-blue-600">{stock.timeHorizon}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm mb-3">
                <div>
                  <span className="text-gray-600">Current: </span>
                  <span className="font-semibold">₹{stock.price}</span>
                </div>
                <div>
                  <span className="text-gray-600">Target: </span>
                  <span className="font-semibold text-green-600">₹{stock.targetPrice}</span>
                </div>
                <div>
                  <span className="text-gray-600">P/E Ratio: </span>
                  <span className="font-semibold">{stock.peRatio}</span>
                </div>
                <div>
                  <span className="text-gray-600">Dividend: </span>
                  <span className="font-semibold">{stock.dividendYield}%</span>
                </div>
                <div>
                  <span className="text-gray-600">Market Cap: </span>
                  <span className="font-semibold">{stock.marketCap}</span>
                </div>
                <div>
                  <span className="text-gray-600">Potential: </span>
                  <span className="font-semibold text-blue-600">
                    {((stock.targetPrice - stock.price) / stock.price * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-700">{stock.reason}</p>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Fundamental: </span>
                    <span className="text-sm font-medium text-green-600">{stock.fundamentalScore}/10</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Technical: </span>
                    <span className="text-sm font-medium text-blue-600">{stock.technicalScore}/10</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Investment Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-lg p-4 text-center">
          <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">+18.5%</p>
          <p className="text-sm text-gray-600">Annual Return</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Shield className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">12.8%</p>
          <p className="text-sm text-gray-600">Volatility</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Award className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">1.45</p>
          <p className="text-sm text-gray-600">Sharpe Ratio</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Calendar className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">15</p>
          <p className="text-sm text-gray-600">Avg Hold Months</p>
        </div>
      </div>

      {/* Investment Philosophy */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Long Term Investment Philosophy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Quality Criteria</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Consistent revenue growth (15%+ CAGR)</li>
              <li>• Strong return on equity (&gt;15%)</li>
              <li>• Low debt-to-equity ratio</li>
              <li>• Market leadership position</li>
              <li>• Sustainable competitive advantage</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Portfolio Strategy</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Diversification across sectors</li>
              <li>• 60% large cap, 30% mid cap, 10% small cap</li>
              <li>• Regular portfolio rebalancing</li>
              <li>• SIP approach for accumulation</li>
              <li>• Long-term wealth creation focus</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LongTermTab;