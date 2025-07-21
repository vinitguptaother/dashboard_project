'use client';

import { useState } from 'react';
import { Calendar, TrendingUp, Target, BarChart3, Clock } from 'lucide-react';

const SwingTradingTab = () => {
  const [swingOpportunities, setSwingOpportunities] = useState([
    {
      symbol: 'TATA STEEL',
      price: 125.40,
      signal: 'BUY',
      timeframe: '2-5 days',
      entry: 125,
      target: 145,
      stopLoss: 115,
      confidence: 87,
      technicalPattern: 'Cup & Handle',
      fundamentalScore: 8.2,
      reason: 'Breakout from consolidation with strong steel demand outlook'
    },
    {
      symbol: 'BAJAJ FINANCE',
      price: 6850.30,
      signal: 'BUY',
      timeframe: '5-10 days',
      entry: 6850,
      target: 7200,
      stopLoss: 6600,
      confidence: 82,
      technicalPattern: 'Ascending Triangle',
      fundamentalScore: 9.1,
      reason: 'Strong Q2 results, credit growth momentum continues'
    },
    {
      symbol: 'MARUTI SUZUKI',
      price: 10245.75,
      signal: 'HOLD',
      timeframe: '3-7 days',
      entry: 10200,
      target: 10800,
      stopLoss: 9900,
      confidence: 75,
      technicalPattern: 'Flag Pattern',
      fundamentalScore: 7.8,
      reason: 'Festive season demand pickup, awaiting auto sales data'
    }
  ]);

  const [sectorAnalysis, setSectorAnalysis] = useState([
    { sector: 'Banking', trend: 'Bullish', strength: 85, opportunities: 12 },
    { sector: 'IT', trend: 'Neutral', strength: 60, opportunities: 8 },
    { sector: 'Auto', trend: 'Bullish', strength: 78, opportunities: 15 },
    { sector: 'Pharma', trend: 'Bearish', strength: 45, opportunities: 5 },
    { sector: 'Metals', trend: 'Bullish', strength: 82, opportunities: 10 }
  ]);

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY': return 'text-green-600 bg-green-50';
      case 'SELL': return 'text-red-600 bg-red-50';
      case 'HOLD': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'Bullish': return 'text-green-600';
      case 'Bearish': return 'text-red-600';
      case 'Neutral': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Swing Trading Opportunities</h1>
        <p className="text-gray-600">Medium-term trading setups with 2-15 day holding periods</p>
      </div>

      {/* Sector Analysis */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
          Sector Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {sectorAnalysis.map((sector, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 text-center">
              <h4 className="font-semibold text-gray-900 mb-2">{sector.sector}</h4>
              <p className={`text-sm font-medium mb-1 ${getTrendColor(sector.trend)}`}>
                {sector.trend}
              </p>
              <p className="text-lg font-bold text-blue-600 mb-1">{sector.strength}%</p>
              <p className="text-xs text-gray-600">{sector.opportunities} opportunities</p>
            </div>
          ))}
        </div>
      </div>

      {/* Swing Trading Opportunities */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-green-600" />
          Active Swing Opportunities
        </h3>
        <div className="space-y-4">
          {swingOpportunities.map((opportunity, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg text-gray-900">{opportunity.symbol}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSignalColor(opportunity.signal)}`}>
                    {opportunity.signal}
                  </span>
                  <span className="text-sm text-gray-600 flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {opportunity.timeframe}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-600">Confidence</p>
                    <p className="text-sm font-bold text-blue-600">{opportunity.confidence}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">Fund. Score</p>
                    <p className="text-sm font-bold text-purple-600">{opportunity.fundamentalScore}/10</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-3">
                <div>
                  <span className="text-gray-600">Current: </span>
                  <span className="font-semibold">₹{opportunity.price}</span>
                </div>
                <div>
                  <span className="text-gray-600">Entry: </span>
                  <span className="font-semibold">₹{opportunity.entry}</span>
                </div>
                <div>
                  <span className="text-gray-600">Target: </span>
                  <span className="font-semibold text-green-600">₹{opportunity.target}</span>
                </div>
                <div>
                  <span className="text-gray-600">Stop Loss: </span>
                  <span className="font-semibold text-red-600">₹{opportunity.stopLoss}</span>
                </div>
                <div>
                  <span className="text-gray-600">Pattern: </span>
                  <span className="font-semibold text-blue-600">{opportunity.technicalPattern}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">{opportunity.reason}</p>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Potential Return: </span>
                    <span className="text-sm font-medium text-green-600">
                      {((opportunity.target - opportunity.entry) / opportunity.entry * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Risk-Reward: </span>
                    <span className="text-sm font-medium text-blue-600">
                      1:{((opportunity.target - opportunity.entry) / (opportunity.entry - opportunity.stopLoss)).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-lg p-4 text-center">
          <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">73%</p>
          <p className="text-sm text-gray-600">Success Rate</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Target className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">1:2.8</p>
          <p className="text-sm text-gray-600">Avg Risk-Reward</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Calendar className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">5.2</p>
          <p className="text-sm text-gray-600">Avg Hold Days</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <BarChart3 className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">+12.4%</p>
          <p className="text-sm text-gray-600">Monthly Return</p>
        </div>
      </div>

      {/* Swing Trading Guidelines */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Swing Trading Guidelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Entry Criteria</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Technical pattern confirmation</li>
              <li>• Volume above 20-day average</li>
              <li>• Fundamental score above 7.0</li>
              <li>• Sector momentum alignment</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Risk Management</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Maximum 5% portfolio per trade</li>
              <li>• Minimum 1:2 risk-reward ratio</li>
              <li>• Trail stop loss after 50% target</li>
              <li>• Review positions every 2 days</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwingTradingTab;