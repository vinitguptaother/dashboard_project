'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Briefcase, TrendingUp, TrendingDown, IndianRupee, AlertTriangle } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5002';

interface Holding {
  symbol: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  pnlPercentage: number;
  currentValue: number;
}

interface Position {
  symbol: string;
  product: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  realised: number;
  unrealised: number;
}

interface Funds {
  availableMargin: number;
  usedMargin: number;
  totalBalance: number;
}

const UpstoxTab = () => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [funds, setFunds] = useState<Funds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'positions'>('holdings');

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [portfolioRes, positionsRes, fundsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/upstox/portfolio`),
        fetch(`${BACKEND_URL}/api/upstox/positions`),
        fetch(`${BACKEND_URL}/api/upstox/funds`),
      ]);

      const portfolioJson = await portfolioRes.json();
      const positionsJson = await positionsRes.json();
      const fundsJson = await fundsRes.json();

      if (portfolioJson.status === 'success' && Array.isArray(portfolioJson.data)) {
        setHoldings(portfolioJson.data.map((h: any) => ({
          symbol: h.tradingsymbol || h.trading_symbol || h.symbol || '–',
          quantity: h.quantity ?? 0,
          averagePrice: h.average_price ?? h.averagePrice ?? 0,
          lastPrice: h.last_price ?? h.lastPrice ?? h.ltp ?? 0,
          pnl: h.pnl ?? ((h.last_price || 0) - (h.average_price || 0)) * (h.quantity || 0),
          pnlPercentage: h.pnl_percentage ?? (h.average_price > 0 ? (((h.last_price || h.ltp || 0) - h.average_price) / h.average_price) * 100 : 0),
          currentValue: h.current_value ?? ((h.last_price || h.ltp || 0) * (h.quantity || 0)),
        })));
      }

      if (positionsJson.status === 'success' && Array.isArray(positionsJson.data)) {
        setPositions(positionsJson.data.map((p: any) => ({
          symbol: p.tradingsymbol || p.trading_symbol || p.symbol || '–',
          product: p.product || '–',
          quantity: p.quantity ?? 0,
          averagePrice: p.average_price ?? p.averagePrice ?? 0,
          lastPrice: p.last_price ?? p.lastPrice ?? p.ltp ?? 0,
          pnl: p.pnl ?? 0,
          realised: p.realised ?? p.realised_pnl ?? 0,
          unrealised: p.unrealised ?? p.unrealised_pnl ?? 0,
        })));
      }

      if (fundsJson.status === 'success' && fundsJson.data) {
        const f = fundsJson.data;
        setFunds({
          availableMargin: f.available_margin ?? f.equity?.available_margin ?? 0,
          usedMargin: f.used_margin ?? f.equity?.used_margin ?? 0,
          totalBalance: f.total_balance ?? (f.available_margin || 0) + (f.used_margin || 0),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Upstox data. Make sure backend is running and Upstox token is active.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const formatCurrency = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalHoldingsValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalHoldingsPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalPositionsPnl = positions.reduce((sum, p) => sum + p.pnl, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500">Loading Upstox portfolio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 slide-in">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Upstox Portfolio</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-red-800 font-semibold mb-1">Connection Error</h3>
              <p className="text-red-600 text-sm mb-3">{error}</p>
              <p className="text-red-500 text-xs mb-4">Make sure: (1) Backend is running on port 5002, (2) Upstox token is active (check LIVE badge in nav).</p>
              <button onClick={fetchAll} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 slide-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Briefcase className="h-7 w-7 mr-2 text-purple-600" />
          Upstox Portfolio
        </h2>
        <button onClick={fetchAll} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-xl p-4 text-center">
          <IndianRupee className="h-6 w-6 text-blue-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalHoldingsValue)}</p>
          <p className="text-xs text-gray-500">Holdings Value</p>
        </div>
        <div className="glass-effect rounded-xl p-4 text-center">
          {totalHoldingsPnl >= 0 ? <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-1" /> : <TrendingDown className="h-6 w-6 text-red-600 mx-auto mb-1" />}
          <p className={`text-xl font-bold ${totalHoldingsPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalHoldingsPnl)}
          </p>
          <p className="text-xs text-gray-500">Holdings P&L</p>
        </div>
        <div className="glass-effect rounded-xl p-4 text-center">
          <p className={`text-xl font-bold ${totalPositionsPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalPositionsPnl)}
          </p>
          <p className="text-xs text-gray-500">Positions P&L</p>
        </div>
        <div className="glass-effect rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-purple-600">{funds ? formatCurrency(funds.availableMargin) : '–'}</p>
          <p className="text-xs text-gray-500">Available Margin</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="glass-effect rounded-xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab('holdings')}
            className={`flex-1 py-3 text-sm font-medium text-center transition ${activeTab === 'holdings' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Holdings ({holdings.length})
          </button>
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex-1 py-3 text-sm font-medium text-center transition ${activeTab === 'positions' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Positions ({positions.length})
          </button>
        </div>

        {activeTab === 'holdings' && (
          <div className="overflow-x-auto">
            {holdings.length === 0 ? (
              <p className="text-center py-12 text-gray-500">No holdings found. Connect your Upstox account to see your portfolio.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">LTP</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L %</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {holdings.map((h, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{h.symbol}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{h.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(h.averagePrice)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{formatCurrency(h.lastPrice)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(h.currentValue)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${h.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(h.pnl)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${h.pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {h.pnlPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="overflow-x-auto">
            {positions.length === 0 ? (
              <p className="text-center py-12 text-gray-500">No open positions.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">LTP</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Realised</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unrealised</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {positions.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.symbol}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{p.product}</td>
                      <td className={`px-4 py-3 text-sm text-right ${p.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{p.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(p.averagePrice)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{formatCurrency(p.lastPrice)}</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${p.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(p.pnl)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(p.realised)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(p.unrealised)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpstoxTab;
