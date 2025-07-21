'use client';

import { useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Target, AlertCircle, Zap } from 'lucide-react';

const IntradayTab = () => {
  const [intradaySignals, setIntradaySignals] = useState([
    {
      symbol: 'HDFC BANK',
      price: 1545.30,
      signal: 'BUY',
      strength: 'Strong',
      entry: 1545,
      target: 1580,
      stopLoss: 1525,
      timeframe: '15m',
      confidence: 92,
      volume: 'High',
      reason: 'Bullish engulfing pattern with volume spike'
    },
    {
      symbol: 'RELIANCE',
      price: 2485.75,
      signal: 'SELL',
      strength: 'Medium',
      entry: 2485,
      target: 2450,
      stopLoss: 2505,
      timeframe: '5m',
      confidence: 78,
      volume: 'Medium',
      reason: 'Resistance at 2490 level, RSI overbought'
    },
    {
      symbol: 'ICICI BANK',
      price: 985.20,
      signal: 'BUY',
      strength: 'Strong',
      entry: 985,
      target: 1005,
      stopLoss: 975,
      timeframe: '30m',
      confidence: 88,
      volume: 'High',
      reason: 'Breakout above 980 resistance with momentum'
    }
  ]);

  const [marketMomentum, setMarketMomentum] = useState({
    trend: 'Bullish',
    strength: 85,
    volatility: 'Medium',
    volume: 'Above Average'
  });

  const getSignalColor = (signal: string) => {
    return signal === 'BUY' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'Strong': return 'text-green-600';
      case 'Medium': return 'text-yellow-600';
      case 'Weak': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Intraday Trading Signals</h1>
        <p className="text-gray-600">Real-time AI-powered intraday trading opportunities</p>
      </div>

      {/* Market Momentum Card */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Zap className="h-5 w-5 mr-2 text-yellow-600" />
          Market Momentum
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Trend</p>
            <p className={`text-lg font-bold ${marketMomentum.trend === 'Bullish' ? 'text-green-600' : 'text-red-600'}`}>
              {marketMomentum.trend}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Strength</p>
            <p className="text-lg font-bold text-blue-600">{marketMomentum.strength}%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Volatility</p>
            <p className="text-lg font-bold text-yellow-600">{marketMomentum.volatility}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Volume</p>
            <p className="text-lg font-bold text-purple-600">{marketMomentum.volume}</p>
          </div>
        </div>
      </div>

      {/* Active Signals */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-blue-600" />
          Active Intraday Signals
        </h3>
        <div className="space-y-4">
          {intradaySignals.map((signal, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-lg text-gray-900">{signal.symbol}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSignalColor(signal.signal)}`}>
                    {signal.signal}
                  </span>
                  <span className={`text-sm font-medium ${getStrengthColor(signal.strength)}`}>
                    {signal.strength}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{signal.timeframe}</span>
                  <div className="flex items-center space-x-1">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">{signal.confidence}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-3">
                <div>
                  <span className="text-gray-600">Current: </span>
                  <span className="font-semibold">₹{signal.price}</span>
                </div>
                <div>
                  <span className="text-gray-600">Entry: </span>
                  <span className="font-semibold">₹{signal.entry}</span>
                </div>
                <div>
                  <span className="text-gray-600">Target: </span>
                  <span className="font-semibold text-green-600">₹{signal.target}</span>
                </div>
                <div>
                  <span className="text-gray-600">Stop Loss: </span>
                  <span className="font-semibold text-red-600">₹{signal.stopLoss}</span>
                </div>
                <div>
                  <span className="text-gray-600">Volume: </span>
                  <span className="font-semibold">{signal.volume}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">{signal.reason}</p>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Risk-Reward: </span>
                  <span className="text-xs font-medium text-blue-600">
                    1:{((Math.abs(signal.target - signal.entry) / Math.abs(signal.entry - signal.stopLoss))).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-effect rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="font-semibold text-gray-900">Bullish Setups</p>
          <p className="text-2xl font-bold text-green-600">8</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <TrendingDown className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="font-semibold text-gray-900">Bearish Setups</p>
          <p className="text-2xl font-bold text-red-600">3</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="font-semibold text-gray-900">Alerts Active</p>
          <p className="text-2xl font-bold text-yellow-600">5</p>
        </div>
      </div>

      {/* Trading Tips */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Intraday Trading Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Risk Management</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Never risk more than 2% per trade</li>
              <li>• Always use stop losses</li>
              <li>• Maintain 1:2 risk-reward ratio minimum</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Market Timing</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Best volatility: 9:15-10:30 AM</li>
              <li>• Avoid 12:00-1:00 PM (lunch hour)</li>
              <li>• High activity: 2:30-3:30 PM</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntradayTab;