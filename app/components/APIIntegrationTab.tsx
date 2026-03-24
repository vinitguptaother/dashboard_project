'use client';

import { useState, useEffect } from 'react';
import { Zap, CheckCircle, XCircle, AlertTriangle, Settings, RefreshCw, Plus, Edit, Trash2, Key, Globe, Play, Eye, Save, X } from 'lucide-react';
import { useAPIIntegration } from '../hooks/useAPIIntegration';

const APIIntegrationTab = () => {
  const {
    apis,
    isLoading,
    addAPI,
    updateAPI,
    deleteAPI,
    testAPI,
    testAllAPIs,
    getCachedData,
    getAPIStats,
    getAPIsByCategory,
    getConnectedAPIs
  } = useAPIIntegration();

  const [activeSection, setActiveSection] = useState('overview');
  const [showAddAPIModal, setShowAddAPIModal] = useState(false);
  const [showEditAPIModal, setShowEditAPIModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [selectedAPICategory, setSelectedAPICategory] = useState('');
  const [editingAPI, setEditingAPI] = useState<any>(null);
  const [viewingAPIData, setViewingAPIData] = useState<string | null>(null);
  const [testingAPI, setTestingAPI] = useState<string | null>(null);

  const [newAPIForm, setNewAPIForm] = useState({
    name: '',
    provider: '',
    category: '',
    apiKey: '',
    endpoint: '',
    description: '',
    headers: {} as { [key: string]: string },
    parameters: {} as { [key: string]: string },
    // Alice Blue specific fields
    appId: '',
    apiSecret: '',
    username: '',
    password: '',
    twoFA: ''
  });

  const apiCategories = [
    { id: 'market-data', label: 'Market Data', icon: '📊', description: 'Real-time and historical stock market data' },
    { id: 'broker', label: 'Broker APIs', icon: '🏦', description: 'Direct broker integration for trading and portfolio' },
    { id: 'news', label: 'Financial News', icon: '📰', description: 'Breaking news and market analysis' },
    { id: 'technical-analysis', label: 'Technical Analysis', icon: '📈', description: 'Charts, indicators, and pattern recognition' },
    { id: 'fundamental-analysis', label: 'Fundamental Data', icon: '📋', description: 'Company financials and ratios' },
    { id: 'ai-ml', label: 'AI & Machine Learning', icon: '🤖', description: 'AI-powered analysis and predictions' },
    { id: 'economic-data', label: 'Economic Indicators', icon: '🏛️', description: 'Macro-economic data and indicators' },
    { id: 'crypto', label: 'Cryptocurrency', icon: '₿', description: 'Digital asset market data' }
  ];

  const availableAPIs = {
    'broker': [
      {
        name: 'Alice Blue',
        provider: 'alice_blue',
        description: 'Indian broker API for trading and portfolio management',
        features: ['Real-time quotes', 'Order placement', 'Portfolio tracking', 'Market depth'],
        pricing: 'Free with account',
        documentation: 'https://ant.aliceblueonline.com',
        endpoint: 'https://ant.aliceblueonline.com/open-api/od/v1',
        requiresAuth: true,
        authFields: ['appId', 'apiSecret', 'apiKey', 'username', 'password', 'twoFA']
      }
    ],
    'market-data': [
      {
        name: 'Yahoo Finance',
        provider: 'Yahoo',
        description: 'Global market data including Indian stocks',
        features: ['Real-time quotes', 'Historical data', 'Company info'],
        pricing: 'Free with limits',
        documentation: 'https://finance.yahoo.com/api',
        endpoint: 'https://query1.finance.yahoo.com/v8/finance/chart'
      },
      {
        name: 'Alpha Vantage',
        provider: 'Alpha Vantage',
        description: 'Premium financial data API',
        features: ['Real-time data', 'Technical indicators', 'Fundamental data'],
        pricing: 'Free tier available',
        documentation: 'https://www.alphavantage.co/documentation',
        endpoint: 'https://www.alphavantage.co/query'
      },
      {
        name: 'NSE Official API',
        provider: 'NSE India',
        description: 'Official NSE market data',
        features: ['Live quotes', 'Market depth', 'Corporate actions'],
        pricing: 'Subscription based',
        documentation: 'https://www.nseindia.com/api',
        endpoint: 'https://www.nseindia.com/api/equity-stockIndices'
      }
    ],
    'news': [
      {
        name: 'NewsAPI',
        provider: 'NewsAPI',
        description: 'Global news aggregation service',
        features: ['Real-time news', 'Source filtering', 'Keyword search'],
        pricing: 'Free tier available',
        documentation: 'https://newsapi.org/docs',
        endpoint: 'https://newsapi.org/v2/everything'
      },
      {
        name: 'Economic Times API',
        provider: 'Times Internet',
        description: 'Indian financial news',
        features: ['Market news', 'Analysis', 'Expert opinions'],
        pricing: 'Contact for pricing',
        documentation: 'https://economictimes.indiatimes.com/api',
        endpoint: 'https://api.economictimes.indiatimes.com/v1'
      }
    ],
    'technical-analysis': [
      {
        name: 'TradingView API',
        provider: 'TradingView',
        description: 'Advanced charting and technical analysis',
        features: ['Custom indicators', 'Chart patterns', 'Alerts'],
        pricing: '₹1500/month',
        documentation: 'https://www.tradingview.com/rest-api-spec',
        endpoint: 'https://api.tradingview.com/v1'
      }
    ],
    'fundamental-analysis': [
      {
        name: 'Financial Modeling Prep',
        provider: 'FMP',
        description: 'Comprehensive financial data',
        features: ['Income statements', 'Balance sheets', 'Ratios'],
        pricing: '₹1200/month',
        documentation: 'https://financialmodelingprep.com/developer/docs',
        endpoint: 'https://financialmodelingprep.com/api/v3'
      }
    ],
    'economic-data': [
      {
        name: 'RBI Database API',
        provider: 'Reserve Bank of India',
        description: 'Official Indian economic data',
        features: ['Interest rates', 'Inflation', 'GDP data'],
        pricing: 'Free',
        documentation: 'https://rbi.org.in/Scripts/API_Documentation.aspx',
        endpoint: 'https://api.rbi.org.in/v1'
      }
    ],
    'crypto': [
      {
        name: 'CoinGecko API',
        provider: 'CoinGecko',
        description: 'Cryptocurrency market data',
        features: ['Price data', 'Market cap', 'Trading volume'],
        pricing: 'Free tier available',
        documentation: 'https://www.coingecko.com/en/api/documentation',
        endpoint: 'https://api.coingecko.com/api/v3'
      }
    ]
  };

  const [stats, setStats] = useState({ connected: 0, totalRequests: 0, uptime: 99.9, avgLatency: 150 });

  useEffect(() => {
    const fetchStats = async () => {
      const result = await getAPIStats();
      if (result) setStats(result);
    };
    fetchStats();
  }, [apis]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-50';
      case 'testing':
        return 'text-blue-600 bg-blue-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'disconnected':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'testing':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'disconnected':
        return <AlertTriangle className="h-5 w-5 text-gray-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleAddAPI = async () => {
    if (!newAPIForm.name || !newAPIForm.provider || !newAPIForm.category || !newAPIForm.endpoint) {
      alert('Please fill in all required fields');
      return;
    }

    // Special validation for Alice Blue
    if (newAPIForm.provider === 'alice_blue') {
      if (!newAPIForm.appId || !newAPIForm.apiSecret || !newAPIForm.apiKey || 
          !newAPIForm.username || !newAPIForm.password || !newAPIForm.twoFA) {
        alert('Please fill in all Alice Blue required fields (App ID, API Secret, API Key, Username, Password, 2FA)');
        return;
      }
    }

    const result = await addAPI({
      name: newAPIForm.name,
      provider: newAPIForm.provider,
      category: newAPIForm.category,
      apiKey: newAPIForm.apiKey,
      endpoint: newAPIForm.endpoint,
      description: newAPIForm.description,
      headers: newAPIForm.headers,
      parameters: newAPIForm.parameters,
      rateLimit: '1000/hour',
      // Alice Blue specific fields
      appId: newAPIForm.appId,
      apiSecret: newAPIForm.apiSecret,
      username: newAPIForm.username,
      password: newAPIForm.password,
      twoFA: newAPIForm.twoFA
    });

    if (result.success) {
      setNewAPIForm({
        name: '',
        provider: '',
        category: '',
        apiKey: '',
        endpoint: '',
        description: '',
        headers: {},
        parameters: {},
        // Reset Alice Blue fields
        appId: '',
        apiSecret: '',
        username: '',
        password: '',
        twoFA: ''
      });
      setShowAddAPIModal(false);
    } else {
      alert(`Failed to add API: ${result.error}`);
    }
  };

  const handleEditAPI = async () => {
    if (!editingAPI) return;

    const result = await updateAPI(editingAPI.id, {
      name: editingAPI.name,
      provider: editingAPI.provider,
      apiKey: editingAPI.apiKey,
      endpoint: editingAPI.endpoint,
      description: editingAPI.description
    });

    if (result.success) {
      setEditingAPI(null);
      setShowEditAPIModal(false);
    } else {
      alert(`Failed to update API: ${result.error}`);
    }
  };

  const handleDeleteAPI = async (id: string) => {
    if (confirm('Are you sure you want to delete this API configuration?')) {
      const result = deleteAPI(id);
      if (!result.success) {
        alert(`Failed to delete API: ${result.error}`);
      }
    }
  };

  const handleTestAPI = async (id: string) => {
    setTestingAPI(id);
    try {
      const result = await testAPI(id);
      if (result.success) {
        alert('API connection successful!');
      } else {
        alert(`API test failed: ${result.error}`);
      }
    } finally {
      setTestingAPI(null);
    }
  };

  const handleViewData = (apiId: string) => {
    setViewingAPIData(apiId);
    setShowDataModal(true);
  };

  const handleQuickAdd = (apiTemplate: any, category: string) => {
    setNewAPIForm({
      name: apiTemplate.name,
      provider: apiTemplate.provider,
      category: category,
      apiKey: '',
      endpoint: apiTemplate.endpoint,
      description: apiTemplate.description,
      headers: {},
      parameters: {},
      // Initialize Alice Blue fields if it's Alice Blue
      appId: apiTemplate.provider === 'alice_blue' ? '' : '',
      apiSecret: apiTemplate.provider === 'alice_blue' ? '' : '',
      username: apiTemplate.provider === 'alice_blue' ? '' : '',
      password: apiTemplate.provider === 'alice_blue' ? '' : '',
      twoFA: apiTemplate.provider === 'alice_blue' ? '' : ''
    });
    setShowAddAPIModal(true);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-lg p-4 text-center">
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.connected}</p>
          <p className="text-sm text-gray-600">APIs Connected</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Zap className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{(stats.totalRequests || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-600">API Calls Today</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <RefreshCw className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.uptime}%</p>
          <p className="text-sm text-gray-600">System Uptime</p>
        </div>
        <div className="glass-effect rounded-lg p-4 text-center">
          <Settings className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.avgLatency}ms</p>
          <p className="text-sm text-gray-600">Avg Latency</p>
        </div>
      </div>

      {/* Connected APIs */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Zap className="h-5 w-5 mr-2 text-blue-600" />
            Connected APIs
          </h3>
          <div className="flex space-x-2">
            <button 
              onClick={testAllAPIs}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Test All
            </button>
            <button 
              onClick={() => setShowAddAPIModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New API
            </button>
          </div>
        </div>
        
        {apis.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No APIs configured yet</p>
            <button 
              onClick={() => setShowAddAPIModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Your First API
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apis.map((api) => (
              <div key={api.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(api.status)}
                    <div>
                      <h4 className="font-semibold text-gray-900">{api.name}</h4>
                      <p className="text-sm text-gray-600">{api.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(api.status)}`}>
                      {api.status.toUpperCase()}
                    </span>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleTestAPI(api.id)}
                        disabled={testingAPI === api.id}
                        className="text-green-600 hover:text-green-800 text-sm disabled:opacity-50"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleViewData(api.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingAPI(api);
                          setShowEditAPIModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteAPI(api.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-700 mb-3">{api.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Last Update: </span>
                    <span className="font-medium">{api.lastUpdate}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Latency: </span>
                    <span className="font-medium">{api.latency}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Requests: </span>
                    <span className="font-medium">{api.requestsToday.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Rate Limit: </span>
                    <span className="font-medium">{api.rateLimit}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Category: </span>
                    <span className="font-medium capitalize">{api.category.replace('-', ' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAPIMarketplace = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">API Marketplace</h2>
        <p className="text-gray-600">Discover and integrate new data sources for your dashboard</p>
      </div>

      {/* API Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apiCategories.map((category) => (
          <div 
            key={category.id}
            className="glass-effect rounded-lg p-4 hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-blue-200"
            onClick={() => setSelectedAPICategory(category.id)}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">{category.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{category.label}</h3>
              <p className="text-sm text-gray-600 mb-3">{category.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-600 font-medium">
                  {availableAPIs[category.id as keyof typeof availableAPIs]?.length || 0} APIs
                </span>
                <button className="text-blue-600 hover:text-blue-800">
                  <Globe className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Category APIs */}
      {selectedAPICategory && (
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {apiCategories.find(cat => cat.id === selectedAPICategory)?.label} APIs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableAPIs[selectedAPICategory as keyof typeof availableAPIs]?.map((api, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{api.name}</h4>
                    <p className="text-sm text-gray-600">{api.provider}</p>
                  </div>
                  <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                    {api.pricing}
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 mb-3">{api.description}</p>
                
                <div className="mb-3">
                  <h5 className="text-xs font-medium text-gray-600 mb-1">Features:</h5>
                  <div className="flex flex-wrap gap-1">
                    {api.features.map((feature, idx) => (
                      <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <a 
                    href={api.documentation} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Documentation →
                  </a>
                  <button 
                    onClick={() => handleQuickAdd(api, selectedAPICategory)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Quick Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const sections = [
    { id: 'overview', label: 'Overview', icon: Zap },
    { id: 'marketplace', label: 'API Marketplace', icon: Globe }
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'marketplace': return renderAPIMarketplace();
      default: return renderOverview();
    }
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">API Integration Center</h1>
        <p className="text-gray-600">Connect, monitor, and configure data sources for your dashboard</p>
      </div>

      {/* Section Navigation */}
      <div className="flex justify-center mb-6">
        <div className="glass-effect rounded-lg p-1 flex space-x-1">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
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

      {/* Add API Modal */}
      {showAddAPIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-effect rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New API</h3>
              <button onClick={() => setShowAddAPIModal(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Name *</label>
                <input
                  type="text"
                  value={newAPIForm.name}
                  onChange={(e) => setNewAPIForm({...newAPIForm, name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Enter API name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
                <select
                  value={newAPIForm.provider}
                  onChange={(e) => setNewAPIForm({...newAPIForm, provider: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="">Select provider</option>
                  <option value="alice_blue">Alice Blue</option>
                  <option value="yahoo_finance">Yahoo Finance</option>
                  <option value="alpha_vantage">Alpha Vantage</option>
                  <option value="newsapi">NewsAPI</option>
                  <option value="perplexity">Perplexity AI</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={newAPIForm.category}
                  onChange={(e) => setNewAPIForm({...newAPIForm, category: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="">Select category</option>
                  {apiCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={newAPIForm.apiKey}
                  onChange={(e) => setNewAPIForm({...newAPIForm, apiKey: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="Enter API key (optional)"
                />
              </div>

              {/* Alice Blue Specific Fields */}
              {newAPIForm.provider === 'alice_blue' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">App ID *</label>
                    <input
                      type="text"
                      value={newAPIForm.appId}
                      onChange={(e) => setNewAPIForm({...newAPIForm, appId: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="Enter Alice Blue App ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Secret *</label>
                    <input
                      type="password"
                      value={newAPIForm.apiSecret}
                      onChange={(e) => setNewAPIForm({...newAPIForm, apiSecret: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="Enter Alice Blue API Secret"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <input
                      type="text"
                      value={newAPIForm.username}
                      onChange={(e) => setNewAPIForm({...newAPIForm, username: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="Enter Alice Blue Username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input
                      type="password"
                      value={newAPIForm.password}
                      onChange={(e) => setNewAPIForm({...newAPIForm, password: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="Enter Alice Blue Password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">2FA Code *</label>
                    <input
                      type="text"
                      value={newAPIForm.twoFA}
                      onChange={(e) => setNewAPIForm({...newAPIForm, twoFA: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                      placeholder="Enter 2FA Code"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL *</label>
                <input
                  type="url"
                  value={newAPIForm.endpoint}
                  onChange={(e) => setNewAPIForm({...newAPIForm, endpoint: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newAPIForm.description}
                  onChange={(e) => setNewAPIForm({...newAPIForm, description: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Describe what this API provides"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => setShowAddAPIModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddAPI}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isLoading ? 'Adding...' : 'Add API'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit API Modal */}
      {showEditAPIModal && editingAPI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-effect rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit API Configuration</h3>
              <button onClick={() => setShowEditAPIModal(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Name</label>
                <input
                  type="text"
                  value={editingAPI.name}
                  onChange={(e) => setEditingAPI({...editingAPI, name: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <input
                  type="text"
                  value={editingAPI.provider}
                  onChange={(e) => setEditingAPI({...editingAPI, provider: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={editingAPI.apiKey}
                  onChange={(e) => setEditingAPI({...editingAPI, apiKey: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
                <input
                  type="url"
                  value={editingAPI.endpoint}
                  onChange={(e) => setEditingAPI({...editingAPI, endpoint: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingAPI.description}
                  onChange={(e) => setEditingAPI({...editingAPI, description: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button 
                onClick={() => setShowEditAPIModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleEditAPI}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Data Modal */}
      {showDataModal && viewingAPIData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-effect rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">API Data Preview</h3>
              <button onClick={() => setShowDataModal(false)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                {JSON.stringify(getCachedData(viewingAPIData), null, 2) || 'No data available'}
              </pre>
            </div>
            <div className="mt-4 text-center">
              <button 
                onClick={() => setShowDataModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIIntegrationTab;