'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle, 
  BarChart3, 
  Zap,
  Eye,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Activity,
  PieChart,
  Loader2
} from 'lucide-react';

const AIAnalysisTab = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [selectedModel, setSelectedModel] = useState('ensemble');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiInsights, setAiInsights] = useState({
    marketSentiment: {
      overall: 'Bullish',
      confidence: 78,
      aiAnalysis: '', // Add this property
      factors: [
        { factor: 'Technical Indicators', sentiment: 'Bullish', weight: 35 },
        { factor: 'News Sentiment', sentiment: 'Neutral', weight: 25 },
        { factor: 'Volume Analysis', sentiment: 'Bullish', weight: 20 },
        { factor: 'Sector Rotation', sentiment: 'Bullish', weight: 20 }
      ]
    },
    predictions: [
      {
        symbol: 'NIFTY 50',
        currentPrice: 19850,
        predictedPrice: 20150,
        timeframe: '1 Week',
        confidence: 82,
        direction: 'up',
        probability: 78,
        keyLevels: { support: 19650, resistance: 20200 }
      },
      {
        symbol: 'BANK NIFTY',
        currentPrice: 44892,
        predictedPrice: 45800,
        timeframe: '1 Week',
        confidence: 75,
        direction: 'up',
        probability: 71,
        keyLevels: { support: 44200, resistance: 46000 }
      },
      {
        symbol: 'SENSEX',
        currentPrice: 66589,
        predictedPrice: 67500,
        timeframe: '1 Week',
        confidence: 79,
        direction: 'up',
        probability: 74,
        keyLevels: { support: 65800, resistance: 68000 }
      }
    ],
    stockRecommendations: [
      {
        symbol: 'RELIANCE',
        action: 'BUY',
        confidence: 89,
        aiScore: 8.7,
        targetPrice: 2650,
        currentPrice: 2485,
        timeframe: '2-4 weeks',
        reasoning: 'Strong technical breakout pattern with AI-detected volume accumulation. Fundamental score improved due to refining margin expansion.',
        riskFactors: ['Oil price volatility', 'Regulatory changes'],
        catalysts: ['Q3 earnings', 'New energy ventures update']
      },
      {
        symbol: 'HDFC BANK',
        action: 'ACCUMULATE',
        confidence: 85,
        aiScore: 8.4,
        targetPrice: 1680,
        currentPrice: 1545,
        timeframe: '4-8 weeks',
        reasoning: 'AI models detect institutional accumulation pattern. Credit growth momentum and NIM expansion expected.',
        riskFactors: ['Interest rate changes', 'Asset quality concerns'],
        catalysts: ['Merger synergies', 'Digital banking growth']
      },
      {
        symbol: 'INFOSYS',
        action: 'HOLD',
        confidence: 72,
        aiScore: 7.2,
        targetPrice: 1580,
        currentPrice: 1520,
        timeframe: '3-6 weeks',
        reasoning: 'Mixed signals from AI models. Strong fundamentals but technical resistance at current levels.',
        riskFactors: ['IT spending slowdown', 'Currency fluctuations'],
        catalysts: ['Large deal wins', 'AI service offerings']
      }
    ],
    patternRecognition: [
      {
        pattern: 'Cup and Handle',
        stocks: ['ASIAN PAINTS', 'BAJAJ FINANCE'],
        confidence: 87,
        expectedMove: '+8-12%',
        timeframe: '2-3 weeks',
        aiAnalysis: '' // Add this property
      },
      {
        pattern: 'Ascending Triangle',
        stocks: ['TATA STEEL', 'MARUTI SUZUKI'],
        confidence: 82,
        expectedMove: '+6-10%',
        timeframe: '1-2 weeks',
        aiAnalysis: '' // Add this property
      },
      {
        pattern: 'Bull Flag',
        stocks: ['ICICI BANK', 'WIPRO'],
        confidence: 79,
        expectedMove: '+5-8%',
        timeframe: '1-3 weeks',
        aiAnalysis: '' // Add this property
      }
    ],
    riskAnalysis: {
      portfolioRisk: 'Medium',
      volatilityForecast: 'Increasing',
      correlationRisk: 'Low',
      sectorConcentration: 'Moderate',
      recommendations: [
        'Consider reducing position size in high-beta stocks',
        'Increase defensive allocation by 10-15%',
        'Monitor global cues for volatility spikes'
      ]
    }
  });

  const [aiModels, setAiModels] = useState([
    {
      name: 'Ensemble Predictor',
      type: 'Combined ML Models',
      accuracy: '87.3%',
      status: 'active',
      lastTrained: '2 hours ago',
      description: 'Combines LSTM, Random Forest, and XGBoost for price prediction'
    },
    {
      name: 'Sentiment Analyzer',
      type: 'NLP Transformer',
      accuracy: '92.1%',
      status: 'active',
      lastTrained: '1 hour ago',
      description: 'Analyzes news, social media, and earnings call sentiment'
    },
    {
      name: 'Pattern Recognition',
      type: 'CNN + Computer Vision',
      accuracy: '84.7%',
      status: 'active',
      lastTrained: '3 hours ago',
      description: 'Identifies technical chart patterns and formations'
    },
    {
      name: 'Risk Assessment',
      type: 'Ensemble Risk Model',
      accuracy: '89.5%',
      status: 'active',
      lastTrained: '4 hours ago',
      description: 'Evaluates portfolio and individual stock risk metrics'
    }
  ]);

  // Function to get AI insights from Perplexity API
  const getAIInsights = async (query: string) => {
    try {
      const response = await fetch('http://localhost:5001/api/perplexity/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content || data.answer || 'No response from AI';
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      throw error;
    }
  };

  // Function to refresh AI analysis
  const refreshAIAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get market sentiment analysis
      const sentimentQuery = `Analyze the current Indian stock market sentiment. Provide a brief analysis of market mood, key factors affecting sentiment, and overall market direction. Focus on NIFTY 50, BANK NIFTY, and SENSEX.`;
      const sentimentAnalysis = await getAIInsights(sentimentQuery);
      
      // Get stock recommendations
      const recommendationsQuery = `Provide 3 top stock recommendations for Indian markets (NSE) with current analysis. Include: symbol, action (BUY/HOLD/SELL), confidence %, target price, reasoning, and risk factors. Focus on large-cap stocks.`;
      const stockRecommendations = await getAIInsights(recommendationsQuery);
      
      // Get technical analysis
      const technicalQuery = `Identify 3 most promising technical chart patterns currently forming in Indian stocks. Include: pattern name, stocks showing this pattern, confidence %, expected move, and timeframe.`;
      const technicalAnalysis = await getAIInsights(technicalQuery);
      
      // Update the state with AI-generated insights
      setAiInsights(prev => ({
        ...prev,
        marketSentiment: {
          ...prev.marketSentiment,
          aiAnalysis: sentimentAnalysis
        },
        stockRecommendations: [
          ...prev.stockRecommendations.slice(0, 1), // Keep first recommendation
          {
            symbol: 'AI GENERATED',
            action: 'ANALYSIS',
            confidence: 85,
            aiScore: 8.5,
            targetPrice: 0,
            currentPrice: 0,
            timeframe: 'Real-time',
            reasoning: stockRecommendations,
            riskFactors: ['AI-generated analysis'],
            catalysts: ['Perplexity AI integration']
          }
        ],
        patternRecognition: [
          ...prev.patternRecognition.slice(0, 1), // Keep first pattern
          {
            pattern: 'AI ANALYSIS',
            stocks: ['REAL-TIME DATA'],
            confidence: 88,
            expectedMove: 'AI Generated',
            timeframe: 'Live',
            aiAnalysis: technicalAnalysis
          }
        ]
      }));
      
    } catch (error) {
      setError('Failed to fetch AI insights. Please try again.');
      console.error('Error refreshing AI analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh on component mount
  useEffect(() => {
    refreshAIAnalysis();
  }, []);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'bullish': return 'text-green-600 bg-green-50';
      case 'bearish': return 'text-red-600 bg-red-50';
      case 'neutral': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-green-600 bg-green-50';
      case 'SELL': return 'text-red-600 bg-red-50';
      case 'HOLD': return 'text-yellow-600 bg-yellow-50';
      case 'ACCUMULATE': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">AI Market Analysis</h2>
        <button
          onClick={refreshAIAnalysis}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span>{isLoading ? 'Refreshing...' : 'Refresh Analysis'}</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* AI Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-lg p-4 text-center">
          <Brain className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">87.3%</p>
          <p className="text-sm text-gray-600">AI Accuracy</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">92.1%</p>
          <p className="text-sm text-gray-600">Prediction Rate</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">84.7%</p>
          <p className="text-sm text-gray-600">Pattern Success</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Zap className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">89.5%</p>
          <p className="text-sm text-gray-600">Risk Accuracy</p>
        </div>
      </div>

      {/* Market Sentiment with AI Analysis */}
      <div className="glass-effect rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Market Sentiment</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(aiInsights.marketSentiment.overall)}`}>
            {aiInsights.marketSentiment.overall}
          </div>
        </div>
        
        {/* AI-Generated Sentiment Analysis */}
        {aiInsights.marketSentiment.aiAnalysis && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <div className="flex items-start space-x-2">
              <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-2">AI Analysis</h4>
                <p className="text-blue-800 text-sm whitespace-pre-line">{aiInsights.marketSentiment.aiAnalysis}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Confidence Level</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${aiInsights.marketSentiment.confidence}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-1">{aiInsights.marketSentiment.confidence}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Key Factors</p>
            <div className="space-y-2">
              {aiInsights.marketSentiment.factors.map((factor, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{factor.factor}</span>
                  <span className={`text-xs px-2 py-1 rounded ${getSentimentColor(factor.sentiment)}`}>
                    {factor.sentiment}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Price Predictions */}
      <div className="glass-effect rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Predictions</h3>
        <div className="space-y-4">
          {aiInsights.predictions.map((prediction, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-gray-900">{prediction.symbol}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    prediction.direction === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                  }`}>
                    {prediction.direction === 'up' ? '↗' : '↘'} {prediction.probability}%
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Current: ₹{prediction.currentPrice.toLocaleString()} | 
                  Target: ₹{prediction.predictedPrice.toLocaleString()} | 
                  {prediction.timeframe}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{prediction.confidence}%</p>
                <p className="text-xs text-gray-600">Confidence</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStockRecommendations = () => (
    <div className="space-y-6">
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2 text-green-600" />
          AI Stock Recommendations
        </h3>
        
        {/* AI-Generated Recommendations */}
        {aiInsights.stockRecommendations.find(rec => rec.symbol === 'AI GENERATED') && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <div className="flex items-start space-x-2">
              <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-2">AI-Generated Analysis</h4>
                <p className="text-blue-800 text-sm whitespace-pre-line">
                  {aiInsights.stockRecommendations.find(rec => rec.symbol === 'AI GENERATED')?.reasoning}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiInsights.stockRecommendations.filter(rec => rec.symbol !== 'AI GENERATED').map((rec, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{rec.symbol}</h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getActionColor(rec.action)}`}>
                  {rec.action}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-gray-600">Confidence: </span>
                  <span className="font-semibold text-purple-600">{rec.confidence}%</span>
                </div>
                <div>
                  <span className="text-gray-600">AI Score: </span>
                  <span className="font-semibold text-blue-600">{rec.aiScore}/10</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
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

              <div className="mb-3">
                <h5 className="text-sm font-medium text-gray-900 mb-1">AI Reasoning:</h5>
                <p className="text-sm text-gray-700">{rec.reasoning}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-xs font-medium text-gray-600 mb-1">Risk Factors:</h5>
                  <div className="flex flex-wrap gap-1">
                    {rec.riskFactors.map((risk, idx) => (
                      <span key={idx} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        {risk}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-gray-600 mb-1">Catalysts:</h5>
                  <div className="flex flex-wrap gap-1">
                    {rec.catalysts.map((catalyst, idx) => (
                      <span key={idx} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        {catalyst}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPatternRecognition = () => (
    <div className="space-y-6">
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Eye className="h-5 w-5 mr-2 text-blue-600" />
          AI Pattern Recognition
        </h3>
        
        {/* AI-Generated Technical Analysis */}
        {aiInsights.patternRecognition.find(pattern => pattern.pattern === 'AI ANALYSIS') && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <div className="flex items-start space-x-2">
              <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900 mb-2">AI-Generated Technical Analysis</h4>
                <p className="text-blue-800 text-sm whitespace-pre-line">
                  {aiInsights.patternRecognition.find(pattern => pattern.pattern === 'AI ANALYSIS')?.aiAnalysis}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiInsights.patternRecognition.filter(pattern => pattern.pattern !== 'AI ANALYSIS').map((pattern, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="text-center mb-3">
                <h4 className="font-semibold text-gray-900">{pattern.pattern}</h4>
                <p className="text-sm text-gray-600">{pattern.timeframe}</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Confidence:</span>
                  <span className="font-medium text-purple-600">{pattern.confidence}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Move:</span>
                  <span className="font-medium text-green-600">{pattern.expectedMove}</span>
                </div>
              </div>

              <div className="mt-3">
                <h5 className="text-xs font-medium text-gray-600 mb-1">Detected in:</h5>
                <div className="flex flex-wrap gap-1">
                  {pattern.stocks.map((stock, idx) => (
                    <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {stock}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Analysis */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
          AI Risk Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Risk Metrics</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-700">Portfolio Risk:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  aiInsights.riskAnalysis.portfolioRisk === 'Low' ? 'bg-green-100 text-green-800' :
                  aiInsights.riskAnalysis.portfolioRisk === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {aiInsights.riskAnalysis.portfolioRisk}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-700">Volatility Forecast:</span>
                <span className="text-sm font-medium text-orange-600">{aiInsights.riskAnalysis.volatilityForecast}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-700">Correlation Risk:</span>
                <span className="text-sm font-medium text-green-600">{aiInsights.riskAnalysis.correlationRisk}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-700">Sector Concentration:</span>
                <span className="text-sm font-medium text-yellow-600">{aiInsights.riskAnalysis.sectorConcentration}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-3">AI Recommendations</h4>
            <ul className="space-y-2">
              {aiInsights.riskAnalysis.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderModelManagement = () => (
    <div className="space-y-6">
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2 text-gray-600" />
          AI Model Management
        </h3>
        <div className="space-y-4">
          {aiModels.map((model, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{model.name}</h4>
                  <p className="text-sm text-gray-600">{model.type}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded">
                    {model.status.toUpperCase()}
                  </span>
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 mb-3">{model.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Accuracy: </span>
                  <span className="font-medium text-green-600">{model.accuracy}</span>
                </div>
                <div>
                  <span className="text-gray-600">Last Trained: </span>
                  <span className="font-medium">{model.lastTrained}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status: </span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Configuration */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Prediction Settings</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Prediction Timeframe</span>
                <select 
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="1D">1 Day</option>
                  <option value="1W">1 Week</option>
                  <option value="1M">1 Month</option>
                  <option value="3M">3 Months</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Primary Model</span>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="ensemble">Ensemble Model</option>
                  <option value="lstm">LSTM Neural Network</option>
                  <option value="transformer">Transformer Model</option>
                  <option value="xgboost">XGBoost</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Confidence Threshold</span>
                <select className="px-3 py-1 border border-gray-300 rounded text-sm">
                  <option>70%</option>
                  <option>75%</option>
                  <option>80%</option>
                  <option>85%</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Analysis Features</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Sentiment Analysis</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Pattern Recognition</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Risk Assessment</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex space-x-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Save Configuration
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Reset to Default
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            Retrain Models
          </button>
        </div>
      </div>
    </div>
  );

  const sections = [
    { id: 'overview', label: 'Overview', icon: Brain },
    { id: 'recommendations', label: 'Stock Recommendations', icon: Star },
    { id: 'patterns', label: 'Pattern & Risk Analysis', icon: Eye },
    { id: 'models', label: 'Model Management', icon: Settings }
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'recommendations': return renderStockRecommendations();
      case 'patterns': return renderPatternRecognition();
      case 'models': return renderModelManagement();
      default: return renderOverview();
    }
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Analysis Center</h1>
        <p className="text-gray-600">Advanced AI-powered market analysis and intelligent insights</p>
      </div>

      {/* Section Navigation */}
      <div className="flex justify-center mb-6">
        <div className="glass-effect rounded-lg p-1 flex space-x-1 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {renderActiveSection()}
    </div>
  );
};

export default AIAnalysisTab;