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
import { aiService, MarketSentiment, StockPrediction, StockRecommendation, PatternRecognition, DeepResearchReport } from '../lib/aiService';
import { Search, Sparkles, ChevronDown, ChevronUp, Shield, FileText, MessageSquare, TrendingDown as TrendDown } from 'lucide-react';
import { AuthClient } from '../lib/apiService';

const AIAnalysisTab = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [selectedModel, setSelectedModel] = useState('ensemble');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiInsights, setAiInsights] = useState<{
    marketSentiment: MarketSentiment;
    predictions: StockPrediction[];
    stockRecommendations: StockRecommendation[];
    patterns: PatternRecognition[];
  }>({
    marketSentiment: {
      overall: 'Neutral',
      confidence: 50,
      aiAnalysis: 'Loading AI analysis...',
      factors: [
        { factor: 'Technical Indicators', sentiment: 'Neutral', weight: 35 },
        { factor: 'News Sentiment', sentiment: 'Neutral', weight: 25 },
        { factor: 'Volume Analysis', sentiment: 'Neutral', weight: 20 },
        { factor: 'Sector Rotation', sentiment: 'Neutral', weight: 20 }
      ]
    },
    predictions: [],
    stockRecommendations: [],
    patterns: []
  });

  // Deep Research state
  const [deepResearchSymbol, setDeepResearchSymbol] = useState('');
  const [deepResearchQuarters, setDeepResearchQuarters] = useState(4);
  const [deepResearchLoading, setDeepResearchLoading] = useState(false);
  const [deepResearchError, setDeepResearchError] = useState<string | null>(null);
  const [deepResearchReport, setDeepResearchReport] = useState<DeepResearchReport | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    executive: true, business: true, financials: true, concall: true,
    technicals: true, risks: true, tradesetup: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const generateDeepResearch = async () => {
    if (!deepResearchSymbol.trim()) return;
    setDeepResearchLoading(true);
    setDeepResearchError(null);
    setDeepResearchReport(null);
    try {
      const report = await aiService.deepResearch(deepResearchSymbol.trim().toUpperCase(), deepResearchQuarters);
      setDeepResearchReport(report);
    } catch (err: any) {
      setDeepResearchError(err.message || 'Failed to generate deep research');
    } finally {
      setDeepResearchLoading(false);
    }
  };

  const getVerdictColor = (verdict: string) => {
    if (verdict.includes('Strong Buy')) return 'text-green-700 bg-green-100 border-green-300';
    if (verdict.includes('Buy')) return 'text-green-600 bg-green-50 border-green-200';
    if (verdict.includes('Hold')) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (verdict.includes('Sell')) return 'text-red-600 bg-red-50 border-red-200';
    if (verdict.includes('Strong Sell')) return 'text-red-700 bg-red-100 border-red-300';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getComplianceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getExecStatusIcon = (status: string) => {
    if (status === 'Fully Met') return '✅';
    if (status === 'Partially Met') return '⚠️';
    return '❌';
  };

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

  // Load AI insights on component mount
  useEffect(() => {
    loadAIInsights();
  }, []);

  const loadAIInsights = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Sequential calls to avoid Perplexity rate limits (429)
      // Backend caches results for 10 min so subsequent loads are instant
      const sentiment = await aiService.getMarketSentiment();
      const predictions = await aiService.getPredictions();
      const recommendations = await aiService.getRecommendations();
      const patterns = await aiService.getPatterns();

      setAiInsights({
        marketSentiment: sentiment,
        predictions: predictions,
        stockRecommendations: recommendations,
        patterns: patterns
      });
    } catch (error: any) {
      console.error('Error loading AI insights:', error);
      setError('Failed to load AI analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAIAnalysis = async () => {
    await loadAIInsights();
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'bullish': return 'text-green-600 bg-green-50';
      case 'bearish': return 'text-red-600 bg-red-50';
      default: return 'text-yellow-600 bg-yellow-50';
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
      {/* Market Sentiment */}
      <div className="glass-effect rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Market Sentiment Analysis</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(aiInsights.marketSentiment.overall)}`}>
            {aiInsights.marketSentiment.overall}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Confidence Level</span>
              <span className="text-sm font-semibold text-gray-900">{aiInsights.marketSentiment.confidence}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${aiInsights.marketSentiment.confidence}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 mb-3">{aiInsights.marketSentiment.aiAnalysis}</p>
          </div>
        </div>

        {/* Sentiment Factors */}
        <div className="mt-6">
          <h4 className="text-lg font-medium text-gray-900 mb-3">Sentiment Factors</h4>
          <div className="space-y-3">
            {aiInsights.marketSentiment.factors.map((factor, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{factor.factor}</span>
                <div className="flex items-center space-x-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getSentimentColor(factor.sentiment)}`}>
                    {factor.sentiment}
                  </div>
                  <span className="text-xs text-gray-500">({factor.weight}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Predictions */}
      <div className="glass-effect rounded-xl p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">AI Price Predictions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiInsights.predictions.map((prediction, index) => (
            <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{prediction.symbol}</h4>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  prediction.direction === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                }`}>
                  {prediction.direction.toUpperCase()}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Current:</span>
                  <span className="font-medium">₹{prediction.currentPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Target:</span>
                  <span className="font-medium">₹{prediction.predictedPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Confidence:</span>
                  <span className="font-medium">{prediction.confidence}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Timeframe:</span>
                  <span className="font-medium">{prediction.timeframe}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStockRecommendations = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">AI Stock Recommendations</h3>
        <div className="flex space-x-2">
          <select 
            value={selectedTimeframe} 
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="1D">1 Day</option>
            <option value="1W">1 Week</option>
            <option value="1M">1 Month</option>
            <option value="3M">3 Months</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {aiInsights.stockRecommendations.map((recommendation, index) => (
          <div key={index} className="glass-effect rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{recommendation.symbol}</h4>
                <p className="text-sm text-gray-600">{recommendation.timeframe}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getActionColor(recommendation.action)}`}>
                {recommendation.action}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Current Price</p>
                <p className="text-lg font-semibold text-gray-900">₹{recommendation.currentPrice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Target Price</p>
                <p className="text-lg font-semibold text-gray-900">₹{recommendation.targetPrice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Confidence</p>
                <p className="text-lg font-semibold text-gray-900">{recommendation.confidence}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">AI Score</p>
                <p className="text-lg font-semibold text-gray-900">{recommendation.aiScore}/10</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">AI Reasoning:</p>
              <p className="text-sm text-gray-800">{recommendation.reasoning}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Risk Factors</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {recommendation.riskFactors.map((risk, idx) => (
                    <li key={idx} className="flex items-center">
                      <AlertTriangle className="h-3 w-3 text-red-500 mr-2" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Catalysts</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {recommendation.catalysts.map((catalyst, idx) => (
                    <li key={idx} className="flex items-center">
                      <Zap className="h-3 w-3 text-blue-500 mr-2" />
                      {catalyst}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPatternRecognition = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">Pattern Recognition</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {aiInsights.patterns.map((pattern, index) => (
          <div key={index} className="glass-effect rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{pattern.pattern}</h4>
                <p className="text-sm text-gray-600">{pattern.timeframe}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                pattern.expectedMove === 'Bullish' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
              }`}>
                {pattern.expectedMove}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Stocks:</p>
              <div className="flex flex-wrap gap-2">
                {pattern.symbols.map((symbol, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {symbol}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Description:</p>
              <p className="text-sm text-gray-800">{pattern.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Confidence</p>
                <p className="text-lg font-semibold text-gray-900">{pattern.confidence}%</p>
              </div>
              {pattern.keyLevels.breakout && (
                <div>
                  <p className="text-sm text-gray-600">Breakout Level</p>
                  <p className="text-lg font-semibold text-gray-900">₹{pattern.keyLevels.breakout.toLocaleString()}</p>
                </div>
              )}
              {pattern.keyLevels.stopLoss && (
                <div>
                  <p className="text-sm text-gray-600">Stop Loss</p>
                  <p className="text-lg font-semibold text-gray-900">₹{pattern.keyLevels.stopLoss.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderModelManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">AI Model Management</h3>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Settings className="h-4 w-4 inline mr-2" />
          Configure Models
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {aiModels.map((model, index) => (
          <div key={index} className="glass-effect rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{model.name}</h4>
                <p className="text-sm text-gray-600">{model.type}</p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                model.status === 'active' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
              }`}>
                {model.status}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Accuracy</span>
                <span className="text-sm font-semibold text-gray-900">{model.accuracy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Last Trained</span>
                <span className="text-sm text-gray-600">{model.lastTrained}</span>
              </div>
              <p className="text-sm text-gray-600">{model.description}</p>
            </div>

            <div className="mt-4 flex space-x-2">
              <button className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 transition-colors">
                <Eye className="h-4 w-4 inline mr-1" />
                View Details
              </button>
              <button className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded text-sm hover:bg-blue-200 transition-colors">
                <RefreshCw className="h-4 w-4 inline mr-1" />
                Retrain
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDeepResearch = () => {
    const r = deepResearchReport;

    return (
      <div className="space-y-6">
        {/* Search Input */}
        <div className="glass-effect rounded-xl p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Goldman Sachs-Level Deep Research
          </h3>
          <p className="text-sm text-gray-500 mb-4">Institutional-grade analysis with con-call tracking, management credibility scoring, and CIO-level recommendations.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">NSE Symbol</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={deepResearchSymbol}
                  onChange={(e) => setDeepResearchSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && generateDeepResearch()}
                  placeholder="e.g. RELIANCE, HDFCBANK, TCS"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="w-32">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Quarters</label>
              <select
                value={deepResearchQuarters}
                onChange={(e) => setDeepResearchQuarters(Number(e.target.value))}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={4}>4 Quarters</option>
                <option value={6}>6 Quarters</option>
              </select>
            </div>
            <button
              onClick={generateDeepResearch}
              disabled={deepResearchLoading || !deepResearchSymbol.trim()}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {deepResearchLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing (~20s)...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Generate Deep Research</>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {deepResearchError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">{deepResearchError}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {deepResearchLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-effect rounded-xl p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-5/6" />
              </div>
            ))}
          </div>
        )}

        {/* Report */}
        {r && !deepResearchLoading && (
          <div className="space-y-4">
            {/* Section 1: Executive Summary */}
            <div className="glass-effect rounded-xl overflow-hidden border-l-4 border-blue-500">
              <button onClick={() => toggleSection('executive')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  Executive Summary — CIO Brief
                </h3>
                {expandedSections.executive ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {expandedSections.executive && (
                <div className="px-5 pb-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getVerdictColor(r.executiveSummary.verdict)}`}>
                      {r.executiveSummary.verdict}
                    </span>
                    <span className="text-sm text-gray-500">Conviction:</span>
                    <span className="text-2xl font-extrabold text-gray-900">{r.executiveSummary.convictionScore}<span className="text-sm font-normal text-gray-400">/10</span></span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-800 mb-1">Investment Thesis</p>
                    <p className="text-blue-900 font-medium">{r.executiveSummary.thesis}</p>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{r.executiveSummary.briefing}</p>
                </div>
              )}
            </div>

            {/* Section 2: Business Overview */}
            <div className="glass-effect rounded-xl overflow-hidden border-l-4 border-purple-500">
              <button onClick={() => toggleSection('business')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Business Overview & Moat
                </h3>
                {expandedSections.business ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {expandedSections.business && (
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-gray-700">{r.businessOverview.description}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Moat:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      r.businessOverview.moat === 'Wide' ? 'bg-green-100 text-green-700' :
                      r.businessOverview.moat === 'Narrow' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{r.businessOverview.moat}</span>
                  </div>
                  <p className="text-sm text-gray-600">{r.businessOverview.moatDetails}</p>
                  {r.businessOverview.segments?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Revenue Segments</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {r.businessOverview.segments.map((seg, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="font-semibold text-sm text-gray-900">{seg.name}</p>
                            <p className="text-xs text-gray-500">{seg.revenueShare} · {seg.growth}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-gray-600"><span className="font-semibold">Market Position:</span> {r.businessOverview.marketPosition}</p>
                </div>
              )}
            </div>

            {/* Section 3: Financials */}
            <div className="glass-effect rounded-xl overflow-hidden border-l-4 border-green-500">
              <button onClick={() => toggleSection('financials')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Financial Deep Dive ({r.quartersAnalyzed}Q)
                </h3>
                {expandedSections.financials ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {expandedSections.financials && (
                <div className="px-5 pb-5 space-y-4">
                  {/* Quarterly table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                          <th className="px-3 py-2 text-left">Quarter</th>
                          <th className="px-3 py-2 text-right">Revenue (₹ Cr)</th>
                          <th className="px-3 py-2 text-right">Rev Growth YoY</th>
                          <th className="px-3 py-2 text-right">EBITDA Margin</th>
                          <th className="px-3 py-2 text-right">PAT (₹ Cr)</th>
                          <th className="px-3 py-2 text-right">PAT Growth YoY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.financials.quarters?.map((q, i) => (
                          <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{q.quarter}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">{q.revenue?.toLocaleString('en-IN')}</td>
                            <td className={`px-3 py-2 text-right font-mono font-semibold ${q.revenueGrowthYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {q.revenueGrowthYoY >= 0 ? '+' : ''}{q.revenueGrowthYoY}%
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">{q.ebitdaMargin}%</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-700">{q.pat?.toLocaleString('en-IN')}</td>
                            <td className={`px-3 py-2 text-right font-mono font-semibold ${q.patGrowthYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {q.patGrowthYoY >= 0 ? '+' : ''}{q.patGrowthYoY}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Key ratios */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'D/E', value: r.financials.debtToEquity, trend: r.financials.debtTrend },
                      { label: 'ROE', value: `${r.financials.roe}%` },
                      { label: 'ROCE', value: `${r.financials.roce}%` },
                      { label: 'PE', value: `${r.financials.currentPE} (Ind: ${r.financials.industryPE})` },
                    ].map((item, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                        <p className="text-xs font-semibold uppercase text-gray-500">{item.label}</p>
                        <p className="text-lg font-bold text-gray-900 font-mono">{item.value}</p>
                        {item.trend && <p className="text-xs text-gray-500">{item.trend}</p>}
                      </div>
                    ))}
                  </div>
                  {/* Red flags */}
                  {r.financials.redFlags?.length > 0 && r.financials.redFlags[0] !== '' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs font-bold uppercase text-red-600 mb-1">⚠️ Red Flags</p>
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {r.financials.redFlags.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 4: Con-Call Analysis */}
            <div className="glass-effect rounded-xl overflow-hidden border-l-4 border-orange-500">
              <button onClick={() => toggleSection('concall')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-orange-600" />
                  Con-Call Analysis — Management Credibility
                </h3>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <span className={`text-2xl font-extrabold font-mono ${getComplianceColor(r.conCallAnalysis.overallComplianceScore)}`}>
                      {r.conCallAnalysis.overallComplianceScore}
                    </span>
                    <span className="text-xs text-gray-400">/100</span>
                  </div>
                  {expandedSections.concall ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </div>
              </button>
              {expandedSections.concall && (
                <div className="px-5 pb-5 space-y-4">
                  {/* Trust badge */}
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      r.conCallAnalysis.trustLevel === 'High' ? 'bg-green-100 text-green-700' :
                      r.conCallAnalysis.trustLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>Trust: {r.conCallAnalysis.trustLevel}</span>
                    <span className="text-sm text-gray-600">{r.conCallAnalysis.complianceVerdict}</span>
                  </div>
                  {/* Quarter-by-quarter */}
                  {r.conCallAnalysis.quarters?.map((q, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900">{q.quarter}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getExecStatusIcon(q.executionStatus)}</span>
                          <span className={`font-mono font-bold ${getComplianceColor(q.quarterScore)}`}>{q.quarterScore}/100</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Guidance Given</p>
                          <ul className="list-disc list-inside text-gray-700 space-y-0.5">
                            {q.guidanceGiven?.map((g, j) => <li key={j}>{g}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Actual Delivery</p>
                          <ul className="list-disc list-inside text-gray-700 space-y-0.5">
                            {q.actualDelivery?.map((a, j) => <li key={j}>{a}</li>)}
                          </ul>
                        </div>
                      </div>
                      {q.newInitiatives?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">New Initiatives</p>
                          <p className="text-sm text-gray-700">{q.newInitiatives.join('; ')}</p>
                          {q.initiativeFollowUp && <p className="text-sm text-blue-600 mt-1">↳ {q.initiativeFollowUp}</p>}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Tone: <span className={`font-semibold ${q.managementTone === 'Confident' ? 'text-green-600' : q.managementTone === 'Defensive' || q.managementTone === 'Evasive' ? 'text-red-600' : 'text-yellow-600'}`}>{q.managementTone}</span></span>
                      </div>
                      {q.keyQuote && (
                        <p className="text-sm italic text-gray-500 border-l-2 border-gray-300 pl-3">"{q.keyQuote}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Technical Analysis */}
            <div className="glass-effect rounded-xl overflow-hidden border-l-4 border-cyan-500">
              <button onClick={() => toggleSection('technicals')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-600" />
                  Technical Analysis
                </h3>
                {expandedSections.technicals ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
              </button>
              {expandedSections.technicals && r.technicals && (
                <div className="px-5 pb-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 border text-center">
                      <p className="text-xs font-semibold uppercase text-gray-500">Current Price</p>
                      <p className="text-xl font-bold text-gray-900 font-mono">₹{r.technicals.currentPrice?.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border text-center">
                      <p className="text-xs font-semibold uppercase text-gray-500">Weekly Trend</p>
                      <p className={`text-lg font-bold ${r.technicals.weeklyTrend === 'Uptrend' ? 'text-green-600' : r.technicals.weeklyTrend === 'Downtrend' ? 'text-red-600' : 'text-yellow-600'}`}>{r.technicals.weeklyTrend}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border text-center">
                      <p className="text-xs font-semibold uppercase text-gray-500">RSI (14)</p>
                      <p className={`text-lg font-bold font-mono ${r.technicals.rsiSignal === 'Overbought' ? 'text-red-600' : r.technicals.rsiSignal === 'Oversold' ? 'text-green-600' : 'text-yellow-600'}`}>{r.technicals.rsi14}</p>
                      <p className="text-xs text-gray-500">{r.technicals.rsiSignal}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border text-center">
                      <p className="text-xs font-semibold uppercase text-gray-500">MACD</p>
                      <p className={`text-sm font-bold ${r.technicals.macd?.includes('Bullish') ? 'text-green-600' : r.technicals.macd?.includes('Bearish') ? 'text-red-600' : 'text-yellow-600'}`}>{r.technicals.macd}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div className="flex justify-between py-1.5 border-b"><span className="text-gray-500">50 DMA</span><span className="font-mono font-semibold">₹{r.technicals.dma50?.toLocaleString('en-IN')} {r.technicals.above50DMA ? '✅' : '❌'}</span></div>
                    <div className="flex justify-between py-1.5 border-b"><span className="text-gray-500">200 DMA</span><span className="font-mono font-semibold">₹{r.technicals.dma200?.toLocaleString('en-IN')} {r.technicals.above200DMA ? '✅' : '❌'}</span></div>
                    <div className="flex justify-between py-1.5 border-b"><span className="text-gray-500">Volume</span><span className="font-semibold">{r.technicals.volumeProfile}</span></div>
                    <div className="flex justify-between py-1.5 border-b"><span className="text-gray-500">52W High</span><span className="font-mono font-semibold">₹{r.technicals.high52w?.toLocaleString('en-IN')} ({r.technicals.distFrom52wHigh}%)</span></div>
                    <div className="flex justify-between py-1.5 border-b"><span className="text-gray-500">52W Low</span><span className="font-mono font-semibold">₹{r.technicals.low52w?.toLocaleString('en-IN')} (+{r.technicals.distFrom52wLow}%)</span></div>
                    <div className="flex justify-between py-1.5 border-b"><span className="text-gray-500">Pattern</span><span className="font-semibold">{r.technicals.chartPattern}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-semibold uppercase text-green-600">Support Levels</p>
                      <p className="font-mono font-bold text-green-700">{r.technicals.support?.map(s => `₹${s.toLocaleString('en-IN')}`).join(' · ')}</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs font-semibold uppercase text-red-600">Resistance Levels</p>
                      <p className="font-mono font-bold text-red-700">{r.technicals.resistance?.map(s => `₹${s.toLocaleString('en-IN')}`).join(' · ')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 6: Risk Assessment */}
            <div className="glass-effect rounded-xl overflow-hidden border-l-4 border-red-500">
              <button onClick={() => toggleSection('risks')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-600" />
                  Risk Assessment
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  r.risks.overallRiskRating === 'Low' ? 'bg-green-100 text-green-700' :
                  r.risks.overallRiskRating === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>{r.risks.overallRiskRating} Risk</span>
              </button>
              {expandedSections.risks && (
                <div className="px-5 pb-5 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Company-Specific Risks</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {r.risks.companySpecific?.map((risk, i) => <li key={i}>{risk}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Sector / Macro Risks</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {r.risks.sectorMacro?.map((risk, i) => <li key={i}>{risk}</li>)}
                    </ul>
                  </div>
                  {r.risks.regulatory?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Regulatory Risks</p>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {r.risks.regulatory?.map((risk, i) => <li key={i}>{risk}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase text-gray-500">Valuation:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      r.risks.valuationRisk === 'Undervalued' ? 'bg-green-100 text-green-700' :
                      r.risks.valuationRisk === 'Fairly Valued' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>{r.risks.valuationRisk}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 7: Trade Setup */}
            {r.tradeSetup && (
              <div className={`glass-effect rounded-xl overflow-hidden border-l-4 ${
                r.tradeSetup.action === 'BUY' ? 'border-green-500' :
                r.tradeSetup.action === 'SELL' ? 'border-red-500' :
                r.tradeSetup.action === 'AVOID' ? 'border-red-500' :
                'border-yellow-500'
              }`}>
                <button onClick={() => toggleSection('tradesetup')} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Trade Setup & Recommendation
                  </h3>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${getVerdictColor(r.tradeSetup.action)}`}>
                    {r.tradeSetup.action}
                  </span>
                </button>
                {expandedSections.tradesetup && (
                  <div className="px-5 pb-5 space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{r.tradeSetup.investmentType}</span>
                      <span className="text-gray-500">Confidence: <span className="font-bold text-gray-900">{r.tradeSetup.confidence}%</span></span>
                      <span className="text-gray-500">R:R: <span className="font-bold text-gray-900">{r.tradeSetup.riskReward}</span></span>
                    </div>
                    {/* Entry / SL / Target grid */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <p className="text-xs font-bold uppercase text-blue-600">Entry</p>
                        <p className="text-2xl font-extrabold text-blue-900 font-mono mt-1">₹{r.tradeSetup.entryPrice?.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <p className="text-xs font-bold uppercase text-red-600">Stop Loss</p>
                        <p className="text-2xl font-extrabold text-red-900 font-mono mt-1">₹{r.tradeSetup.stopLoss?.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-red-500 font-mono mt-0.5">{r.tradeSetup.stopLossPercent}%</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <p className="text-xs font-bold uppercase text-green-600">Target 1</p>
                        <p className="text-2xl font-extrabold text-green-900 font-mono mt-1">₹{r.tradeSetup.target1?.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-green-500 font-mono mt-0.5">+{r.tradeSetup.target1Percent}% · {r.tradeSetup.target1Timeframe}</p>
                      </div>
                    </div>
                    {/* Target 2 */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase text-green-600">Target 2 (Aggressive)</p>
                        <p className="text-sm text-gray-500">{r.tradeSetup.target2Timeframe}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-extrabold text-green-900 font-mono">₹{r.tradeSetup.target2?.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-green-500 font-mono">+{r.tradeSetup.target2Percent}%</p>
                      </div>
                    </div>
                    {/* SL reasoning */}
                    <p className="text-sm text-gray-600"><span className="font-semibold">SL Reasoning:</span> {r.tradeSetup.stopLossReasoning}</p>
                    {/* Position sizing */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-bold uppercase text-gray-500 mb-1">Position Sizing</p>
                      <p className="text-sm text-gray-700">Allocate <span className="font-bold text-gray-900">{r.tradeSetup.positionSizePercent}%</span> of portfolio — {r.tradeSetup.positionSizeReasoning}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timestamp */}
            <p className="text-xs text-gray-400 text-center font-mono">
              Report generated: {new Date(r.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {r.symbol} · {r.quartersAnalyzed} quarters analyzed
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();
      case 'recommendations':
        return renderStockRecommendations();
      case 'patterns':
        return renderPatternRecognition();
      case 'models':
        return renderModelManagement();
      case 'deep-research':
        return renderDeepResearch();
      default:
        return renderOverview();
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI-Powered Market Analysis</h2>
          <p className="text-gray-600">Advanced AI insights and predictions for Indian markets</p>
        </div>
        <button
          onClick={refreshAIAnalysis}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'recommendations', label: 'Recommendations', icon: Star },
          { id: 'patterns', label: 'Patterns', icon: Target },
          { id: 'models', label: 'AI Models', icon: Brain },
          { id: 'deep-research', label: 'Deep Research', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                activeSection === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="min-h-[600px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading AI analysis...</p>
            </div>
          </div>
        ) : (
          renderActiveSection()
        )}
      </div>
    </div>
  );
};

export default AIAnalysisTab;
