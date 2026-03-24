'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown, Minus, RefreshCw, Play, Pause } from 'lucide-react';

interface QuoteData {
  exchange: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  status: 'success' | 'error';
  error?: string;
}

interface WatchlistItem {
  exchange: string;
  symbol: string;
  displayName: string;
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { exchange: 'NSE', symbol: 'RELIANCE-EQ', displayName: 'Reliance' },
  { exchange: 'NSE', symbol: 'TCS-EQ', displayName: 'TCS' },
  { exchange: 'NSE', symbol: 'HDFCBANK-EQ', displayName: 'HDFC Bank' },
  { exchange: 'NSE', symbol: 'INFY-EQ', displayName: 'Infosys' },
  { exchange: 'NSE', symbol: 'ICICIBANK-EQ', displayName: 'ICICI Bank' },
  { exchange: 'NSE', symbol: 'SBIN-EQ', displayName: 'SBI' },
  { exchange: 'NSE', symbol: 'TATAMOTORS-EQ', displayName: 'Tata Motors' },
  { exchange: 'NSE', symbol: 'WIPRO-EQ', displayName: 'Wipro' }
];

export default function AngelOnePage() {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST);
  const [newSymbol, setNewSymbol] = useState({ exchange: 'NSE', symbol: '', displayName: '' });
  const [testSymbol, setTestSymbol] = useState({ exchange: 'NSE', symbol: 'TATAMOTORS-EQ' });
  const [totpCode, setTotpCode] = useState('');
  const [totpTimer, setTotpTimer] = useState(30);
  const [isConnected, setIsConnected] = useState(false);

  // TOTP timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTotpTimer(prev => {
        if (prev <= 1) {
          return 30; // Reset to 30 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && watchlist.length > 0 && isConnected) {
      interval = setInterval(() => {
        fetchBatchQuotes();
      }, refreshInterval * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, watchlist, isConnected]);

  const fetchSingleQuote = async (exchange: string, symbol: string) => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit TOTP code');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/angelone-ltp?exchange=${exchange}&symbol=${symbol}&totp=${totpCode}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        const key = `${exchange}:${symbol}`;
        setQuotes(prev => ({
          ...prev,
          [key]: result.data
        }));
        setIsConnected(true);
      } else {
        setError(result.error || 'Failed to fetch quote');
        setIsConnected(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchQuotes = async () => {
    if (watchlist.length === 0) return;
    
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit TOTP code');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const symbols = watchlist.map(item => ({
        exchange: item.exchange,
        symbol: item.symbol
      }));

      const response = await fetch('/api/angelone-ltp?batch=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbols, totp: totpCode })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setQuotes(result.data);
        setIsConnected(true);
      } else {
        setError(result.error || 'Failed to fetch quotes');
        setIsConnected(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = () => {
    if (newSymbol.symbol && newSymbol.displayName) {
      const exists = watchlist.some(item => 
        item.exchange === newSymbol.exchange && item.symbol === newSymbol.symbol
      );
      
      if (!exists) {
        setWatchlist(prev => [...prev, { ...newSymbol }]);
        setNewSymbol({ exchange: 'NSE', symbol: '', displayName: '' });
      }
    }
  };

  const removeFromWatchlist = (exchange: string, symbol: string) => {
    setWatchlist(prev => prev.filter(item => 
      !(item.exchange === exchange && item.symbol === symbol)
    ));
    
    const key = `${exchange}:${symbol}`;
    setQuotes(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatChange = (current: number, previous: number) => {
    if (!current || !previous) return null;
    
    const change = current - previous;
    const changePercent = (change / previous) * 100;
    const isPositive = change > 0;
    const isNegative = change < 0;
    
    return (
      <div className={`flex items-center space-x-1 ${
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
      }`}>
        {isPositive ? <TrendingUp className="h-4 w-4" /> : 
         isNegative ? <TrendingDown className="h-4 w-4" /> : 
         <Minus className="h-4 w-4" />}
        <span>{formatPrice(Math.abs(change))} ({Math.abs(changePercent).toFixed(2)}%)</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Angel One Smart API Live Prices</h1>
          <p className="text-gray-600">Real-time stock prices using Angel One Smart API with TOTP authentication</p>
        </div>

        {/* Configuration Panel */}
        <div className="mb-6 bg-white rounded-lg border shadow-sm">
          <div className="p-6 pb-2">
            <h3 className="text-lg font-semibold">Configuration & Controls</h3>
          </div>
          <div className="px-6 pb-6">
            {/* TOTP Section */}
            <div className="mb-6 p-4 border rounded-lg bg-blue-50">
              <h3 className="text-sm font-medium mb-3 flex items-center">
                <span className="mr-2">🔐</span>
                TOTP Authentication
                {isConnected && <span className="ml-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">Connected</span>}
              </h3>
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Enter 6-digit TOTP code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="w-full p-3 border border-gray-300 rounded-lg text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                    totpTimer <= 10 ? 'bg-red-100 text-red-700' : 
                    totpTimer <= 20 ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-green-100 text-green-700'
                  }`}>
                    {totpTimer}s
                  </div>
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Enter the 6-digit code from your authenticator app. Code refreshes every 30 seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Auto Refresh</label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`px-3 py-1 rounded text-sm font-medium flex items-center ${
                      autoRefresh 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 border'
                    }`}
                  >
                    {autoRefresh ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                    {autoRefresh ? 'Stop' : 'Start'}
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="w-20 p-1 border border-gray-300 rounded text-center"
                  />
                  <span className="text-sm text-gray-500">sec</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Test Single Quote</label>
                <div className="flex space-x-2">
                  <select
                    value={testSymbol.exchange}
                    onChange={(e) => setTestSymbol(prev => ({ ...prev, exchange: e.target.value }))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                  <input
                    placeholder="Symbol (e.g., TATAMOTORS-EQ)"
                    value={testSymbol.symbol}
                    onChange={(e) => setTestSymbol(prev => ({ ...prev, symbol: e.target.value }))}
                    className="flex-1 p-2 border border-gray-300 rounded"
                  />
                  <button
                    onClick={() => fetchSingleQuote(testSymbol.exchange, testSymbol.symbol)}
                    disabled={loading || !testSymbol.symbol || totpCode.length !== 6}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Test
                  </button>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={fetchBatchQuotes}
                  disabled={loading || watchlist.length === 0 || totpCode.length !== 6}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh All ({watchlist.length})
                </button>
              </div>
            </div>

            {/* Add Symbol */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-2">Add to Watchlist</h3>
              <div className="flex space-x-2">
                <select
                  value={newSymbol.exchange}
                  onChange={(e) => setNewSymbol(prev => ({ ...prev, exchange: e.target.value }))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="NSE">NSE</option>
                  <option value="BSE">BSE</option>
                </select>
                <input
                  placeholder="Symbol (e.g., RELIANCE-EQ)"
                  value={newSymbol.symbol}
                  onChange={(e) => setNewSymbol(prev => ({ ...prev, symbol: e.target.value }))}
                  className="flex-1 p-2 border border-gray-300 rounded"
                />
                <input
                  placeholder="Display Name"
                  value={newSymbol.displayName}
                  onChange={(e) => setNewSymbol(prev => ({ ...prev, displayName: e.target.value }))}
                  className="flex-1 p-2 border border-gray-300 rounded"
                />
                <button 
                  onClick={addToWatchlist} 
                  disabled={!newSymbol.symbol || !newSymbol.displayName}
                  className="px-4 py-2 bg-blue-600 text-white rounded font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg">
            <div className="p-6">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Environment Variables Info */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="p-6">
            <h3 className="font-medium text-blue-900 mb-2">Angel One Smart API Status</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <div><code>ANGELONE_API_KEY</code> - Your API key from Smart API portal</div>
              <div><code>ANGELONE_CLIENT_CODE</code> - Your Angel One client code</div>
              <div><code>ANGELONE_PASSWORD</code> - Your Angel One password</div>
              <div><code>ANGELONE_TOTP_SECRET</code> - Your TOTP secret (optional - can enter manually above)</div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              💡 <strong>Configuration:</strong> Add credentials to <code>.env.local</code> file in project root.
              <br />
              🌐 <strong>Network Info:</strong> Public IP and MAC address are auto-detected!
            </p>
          </div>
        </div>

        {/* Quotes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {watchlist.map((item) => {
            const key = `${item.exchange}:${item.symbol}`;
            const quote = quotes[key];
            
            return (
              <div key={key} className="relative bg-white rounded-lg border shadow-sm">
                <div className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{item.displayName}</h3>
                      <p className="text-sm text-gray-500">{item.exchange}:{item.symbol}</p>
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(item.exchange, item.symbol)}
                      className="text-red-500 hover:text-red-700 text-xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  {quote ? (
                    quote.status === 'success' ? (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold">
                          {formatPrice(quote.ltp)}
                        </div>
                        {formatChange(quote.ltp, quote.close)}
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-3">
                          <div>Open: {formatPrice(quote.open)}</div>
                          <div>High: {formatPrice(quote.high)}</div>
                          <div>Low: {formatPrice(quote.low)}</div>
                          <div>Vol: {quote.volume?.toLocaleString() || 'N/A'}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        {quote.error}
                      </div>
                    )
                  ) : (
                    <div className="text-gray-500 text-sm">
                      Click "Refresh All" to load data
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {watchlist.length === 0 && (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6 text-center text-gray-500">
              <p>No symbols in watchlist. Add some symbols above to get started.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
