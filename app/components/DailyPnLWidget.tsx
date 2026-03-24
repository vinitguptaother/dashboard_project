'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ShieldAlert, ShieldCheck, Activity, RefreshCw } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5002';

interface DailyTrade {
  symbol: string;
  action: string;
  status: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  closedAt: string;
}

interface DailyPnLData {
  totalPnL: number;
  wins: number;
  losses: number;
  trades: DailyTrade[];
  dailyLossLimit: number;
  usedPct: number;
  killSwitchActive: boolean;
  capital: number;
  riskPerTrade: number;
  dailyLossLimitPct: number;
}

const DailyPnLWidget = () => {
  const [data, setData] = useState<DailyPnLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrades, setShowTrades] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchPnL = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/risk/daily-pnl`);
      const json = await res.json();
      if (json.status === 'success') setData(json.data);
    } catch {
      console.warn('DailyPnLWidget: Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnL();
    // Refresh every 2 minutes during market hours
    const interval = setInterval(fetchPnL, 120000);
    return () => clearInterval(interval);
  }, []);

  const toggleKillSwitch = async () => {
    setToggling(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/risk/kill-switch/toggle`, { method: 'POST' });
      const json = await res.json();
      if (json.status === 'success') {
        fetchPnL(); // Refresh data
      }
    } catch {
      console.error('Failed to toggle kill switch');
    } finally {
      setToggling(false);
    }
  };

  const formatINR = (n: number) =>
    n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  if (loading) {
    return (
      <div className="glass-effect rounded-xl p-6 shadow-lg animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  if (!data) return null;

  // Calculate progress bar color and width
  const getBarColor = () => {
    if (data.totalPnL >= 0) return 'bg-green-500';
    if (data.usedPct >= 100) return 'bg-red-600';
    if (data.usedPct >= 80) return 'bg-red-500';
    if (data.usedPct >= 50) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getBorderColor = () => {
    if (data.killSwitchActive) return 'border-red-400';
    if (data.totalPnL >= 0) return 'border-green-200';
    if (data.usedPct >= 80) return 'border-red-200';
    if (data.usedPct >= 50) return 'border-orange-200';
    return 'border-gray-200';
  };

  const barWidth = data.totalPnL >= 0
    ? Math.min((data.totalPnL / data.dailyLossLimit) * 100, 100)
    : Math.min(data.usedPct, 100);

  return (
    <div className={`glass-effect rounded-xl p-6 shadow-lg border-2 ${getBorderColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-blue-600" />
          Today&apos;s P&amp;L
          <span className="ml-2 text-xs font-normal text-gray-400">
            {data.wins + data.losses} trades closed
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPnL}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {/* Kill switch toggle */}
          <button
            onClick={toggleKillSwitch}
            disabled={toggling}
            className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
              data.killSwitchActive
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            } disabled:opacity-50`}
            title={data.killSwitchActive ? 'Click to deactivate kill switch' : 'Click to manually activate kill switch'}
          >
            {data.killSwitchActive ? (
              <><ShieldAlert className="h-3.5 w-3.5" /> KILL SWITCH ON</>
            ) : (
              <><ShieldCheck className="h-3.5 w-3.5" /> Trading Active</>
            )}
          </button>
        </div>
      </div>

      {/* Kill switch banner */}
      {data.killSwitchActive && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          Daily loss limit reached — no new trade setups will be generated until tomorrow.
        </div>
      )}

      {/* Main P&L display */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className={`text-3xl font-bold ${
          data.totalPnL > 0 ? 'text-green-600' : data.totalPnL < 0 ? 'text-red-600' : 'text-gray-600'
        }`}>
          {data.totalPnL >= 0 ? '+' : ''}{formatINR(data.totalPnL)}
        </span>
        {data.totalPnL !== 0 && (
          <span className="flex items-center gap-0.5 text-sm text-gray-500">
            {data.totalPnL > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            {data.totalPnL < 0 ? `${data.usedPct}% of limit used` : 'Profitable day'}
          </span>
        )}
      </div>

      {/* Progress bar toward daily loss limit */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Daily Loss Used</span>
          <span>Limit: {formatINR(data.dailyLossLimit)}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          {data.totalPnL >= 0 ? (
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(barWidth, 100)}%` }}
            ></div>
          ) : (
            <div
              className={`${getBarColor()} h-3 rounded-full transition-all duration-500`}
              style={{ width: `${barWidth}%` }}
            ></div>
          )}
        </div>
        {data.totalPnL < 0 && (
          <div className="flex justify-between text-xs mt-1">
            <span className="text-red-500">Lost: {formatINR(Math.abs(data.totalPnL))}</span>
            <span className="text-gray-400">Remaining: {formatINR(Math.max(0, data.dailyLossLimit - Math.abs(data.totalPnL)))}</span>
          </div>
        )}
      </div>

      {/* Win/Loss summary */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <p className="text-lg font-bold text-green-600">{data.wins}</p>
          <p className="text-xs text-green-500">Wins</p>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <p className="text-lg font-bold text-red-600">{data.losses}</p>
          <p className="text-xs text-red-500">Losses</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="text-lg font-bold text-gray-700">
            {data.wins + data.losses > 0
              ? `${((data.wins / (data.wins + data.losses)) * 100).toFixed(0)}%`
              : '–'}
          </p>
          <p className="text-xs text-gray-500">Win Rate</p>
        </div>
      </div>

      {/* Individual trades (expandable) */}
      {data.trades.length > 0 && (
        <div>
          <button
            onClick={() => setShowTrades(!showTrades)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showTrades ? 'Hide' : 'Show'} {data.trades.length} closed trade{data.trades.length > 1 ? 's' : ''}
          </button>
          {showTrades && (
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Symbol</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Action</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Entry</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Exit</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">P&L</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.trades.map((trade, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-semibold text-gray-900">{trade.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                          trade.action === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>{trade.action}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-gray-600">₹{trade.entryPrice.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-xs text-right text-gray-600">₹{trade.exitPrice.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-xs text-right text-gray-600">{trade.quantity}</td>
                      <td className={`px-3 py-2 text-xs text-right font-semibold ${
                        trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {trade.pnl >= 0 ? '+' : ''}{formatINR(trade.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {data.trades.length === 0 && data.totalPnL === 0 && (
        <p className="text-xs text-gray-400 text-center">No trades closed today yet</p>
      )}
    </div>
  );
};

export default DailyPnLWidget;
