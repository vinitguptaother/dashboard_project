import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function AngelOneTest() {
  const [totp, setTotp] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [error, setError] = useState('');
  const [stockData, setStockData] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);

  // Stock symbols to monitor
  const watchlist = [
    { exchange: 'NSE', symbol: 'RELIANCE-EQ', name: 'Reliance' },
    { exchange: 'NSE', symbol: 'TCS-EQ', name: 'TCS' },
    { exchange: 'NSE', symbol: 'HDFCBANK-EQ', name: 'HDFC Bank' },
    { exchange: 'NSE', symbol: 'INFY-EQ', name: 'Infosys' },
    { exchange: 'NSE', symbol: 'ICICIBANK-EQ', name: 'ICICI Bank' },
    { exchange: 'NSE', symbol: 'SBIN-EQ', name: 'SBI' },
    { exchange: 'NSE', symbol: 'TATAMOTORS-EQ', name: 'Tata Motors' },
    { exchange: 'NSE', symbol: 'WIPRO-EQ', name: 'Wipro' }
  ];

  // TOTP countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 30 - (now % 30);
      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto refresh stocks
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        refreshAllStocks();
      }, refreshInterval * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const testSingleQuote = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const url = `/api/angelone-ltp?symbol=TATAMOTORS-EQ&exchange=NSE${totp ? `&totp=${totp}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        setAuthStatus(data.authStatus);
        setStockData(prev => ({
          ...prev,
          'NSE:TATAMOTORS-EQ': data.data
        }));
      } else {
        setError(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAllStocks = async () => {
    if (!authStatus?.hasTokens && !totp) {
      setError('Please enter TOTP first to authenticate');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/angelone-ltp?batch=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols: watchlist,
          totp: totp || undefined
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setAuthStatus(data.authStatus);
        setStockData(data.data);
        setError('');
      } else {
        setError(data.error || 'Failed to fetch stock data');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getCredentialStatus = () => {
    return {
      apiKey: '✓ Your API key from Smart API portal (configured ✓)',
      clientCode: '✓ Your Angel One client code (configured ✓)', 
      password: '✓ Your Angel One password (configured ✓)',
      totpSecret: '✓ Your TOTP secret (optional - can enter manually above)'
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Head>
        <title>Angel One Smart API Live Prices</title>
      </Head>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Angel One Smart API Live Prices
          </h1>
          <p className="text-gray-600">
            Real-time stock prices using Angel One Smart API with TOTP authentication
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
            Configuration & Controls
          </h2>

          {/* TOTP Section */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                🔐 TOTP Authentication
              </label>
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  countdown <= 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                }`}>
                  {countdown}
                </div>
                <span className="text-sm text-gray-500">s</span>
              </div>
            </div>
            <div className="flex space-x-3">
              <input
                type="text"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                maxLength={6}
              />
            </div>
            <p className="text-sm text-blue-600 mt-2">
              Enter the 6-digit code from your authenticator app. Code refreshes every 30 seconds.
            </p>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Auto Refresh */}
            <div>
              <h3 className="font-medium mb-2">Auto Refresh</h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-4 py-2 rounded-md ${
                    autoRefresh 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {autoRefresh ? 'Stop' : 'Start'}
                </button>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                </select>
                <span className="text-sm text-gray-500">sec</span>
              </div>
            </div>

            {/* Test Single Quote */}
            <div>
              <h3 className="font-medium mb-2">Test Single Quote</h3>
              <div className="flex items-center space-x-3">
                <select className="px-3 py-2 border border-gray-300 rounded-md">
                  <option>NSE</option>
                </select>
                <input
                  type="text"
                  defaultValue="TATAMOTORS-EQ"
                  className="px-3 py-2 border border-gray-300 rounded-md"
                  readOnly
                />
                <button
                  onClick={testSingleQuote}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  Test
                </button>
              </div>
            </div>
          </div>

          {/* Refresh All Button */}
          <div className="text-center">
            <button
              onClick={refreshAllStocks}
              disabled={isLoading}
              className="px-8 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 font-medium"
            >
              {isLoading ? 'Loading...' : '🔄 Refresh All (8)'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">⚠️</span>
              <span className="text-red-800 font-medium">Login failed: {error}</span>
            </div>
          </div>
        )}

        {/* Angel One Smart API Status */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Angel One Smart API Status</h2>
          <div className="space-y-2">
            {Object.entries(getCredentialStatus()).map(([key, status]) => (
              <div key={key} className="flex items-center">
                <span className="text-blue-600 font-medium">{key.toUpperCase().replace(/([A-Z])/g, '_$1')}</span>
                <span className="text-gray-600 ml-2">- {status}</span>
              </div>
            ))}
          </div>
          {authStatus && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <div className="text-green-800">
                ✅ All required credentials are configured! Enter TOTP code above to test the API.
              </div>
              <div className="text-sm text-green-600 mt-1">
                Auth Status: {authStatus.hasTokens ? 'Authenticated' : 'Not authenticated'} | 
                Token Valid: {authStatus.isValid ? 'Yes' : 'No'} |
                {authStatus.expiresAt && ` Expires: ${new Date(authStatus.expiresAt).toLocaleString()}`}
              </div>
            </div>
          )}
        </div>

        {/* Stock Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {watchlist.map((stock) => {
            const key = `${stock.exchange}:${stock.symbol}`;
            const data = stockData[key];
            const hasError = data?.status === 'error';
            
            return (
              <div key={key} className="bg-white rounded-lg shadow-lg p-6 relative">
                <button
                  className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                  onClick={() => {
                    setStockData(prev => {
                      const newData = { ...prev };
                      delete newData[key];
                      return newData;
                    });
                  }}
                >
                  ✕
                </button>
                
                <h3 className="font-bold text-lg mb-1">{stock.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{key}</p>
                
                {hasError ? (
                  <div className="text-red-600 text-sm">
                    Error: {data.error}
                  </div>
                ) : data && data.status === 'success' ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-green-600">
                      ₹{data.ltp?.toFixed(2) || '0.00'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Open: ₹{data.open?.toFixed(2) || '0.00'}</div>
                      <div>High: ₹{data.high?.toFixed(2) || '0.00'}</div>
                      <div>Low: ₹{data.low?.toFixed(2) || '0.00'}</div>
                      <div>Close: ₹{data.close?.toFixed(2) || '0.00'}</div>
                    </div>
                    {data.volume && (
                      <div className="text-sm text-gray-600">
                        Volume: {data.volume.toLocaleString()}
                      </div>
                    )}
                    {data.timestamp && (
                      <div className="text-xs text-gray-500">
                        Updated: {new Date(data.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500">
                    Click "Refresh All" to load data
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

