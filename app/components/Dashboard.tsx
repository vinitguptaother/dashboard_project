'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Layers, LineChart as LineChartIcon, Target, CheckCircle, XCircle, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import LiveIndexBar from './LiveIndexBar';
import PositionSizer from './PositionSizer';
import DailyPnLWidget from './DailyPnLWidget';

const BACKEND_URL = 'http://localhost:5002';

interface TopIdea {
  symbol: string;
  score: number;
  lastPrice: number;
  percentChange: number | null;
}

interface TopIdeasData {
  batchDate: string;
  screenName: string;
  topIdeas: TopIdea[];
}

interface TradeSetupStats {
  total: number;
  active: number;
  targetHit: number;
  slHit: number;
  expired: number;
  cancelled: number;
  winRate: number | null;
}

interface ActiveSetup {
  _id: string;
  symbol: string;
  action: string;
  tradeType: string;
  entryPrice: number;
  stopLoss: number;
  target: number;
  currentPrice: number | null;
  confidence: number;
  screenName: string | null;
  createdAt: string;
  status: string;
}

const Dashboard = () => {
  const [totalScreens, setTotalScreens] = useState<number>(0);
  const [activeBatches, setActiveBatches] = useState<number>(0);
  const [hitRate, setHitRate] = useState<number | null>(null);
  const [topIdeasData, setTopIdeasData] = useState<TopIdeasData | null>(null);
  const [topIdeasLoading, setTopIdeasLoading] = useState(true);
  const [tradeStats, setTradeStats] = useState<TradeSetupStats | null>(null);
  const [activeSetups, setActiveSetups] = useState<ActiveSetup[]>([]);
  const [paperStats, setPaperStats] = useState<{ total: number; active: number; wins: number; losses: number; winRate: number | null; avgReturnPct: number | null } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/screens/stats`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setTotalScreens(json.data.totalScreens);
          setActiveBatches(json.data.activeBatches);
          setHitRate(json.data.hitRate);
        }
      } catch (err: any) {
        // Warn only — backend may not be running
        console.warn('Dashboard: screens/stats unavailable', err?.message || '');
      }
    };

    const fetchTopIdeas = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/screens/top-ideas`);
        const json = await res.json();
        if (json.status === 'success') {
          setTopIdeasData(json.data);
        }
      } catch (err: any) {
        console.warn('Dashboard: top-ideas unavailable', err?.message || '');
      } finally {
        setTopIdeasLoading(false);
      }
    };

    const fetchTradeStats = async () => {
      try {
        const [statsRes, activeRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/trade-setup/stats`),
          fetch(`${BACKEND_URL}/api/trade-setup/active`),
        ]);
        const statsJson = await statsRes.json();
        const activeJson = await activeRes.json();
        if (statsJson.status === 'success') setTradeStats(statsJson.data);
        if (activeJson.status === 'success') setActiveSetups(activeJson.data);
      } catch (err: any) {
        console.warn('Dashboard: trade-setup unavailable', err?.message || '');
      }
    };

    const fetchPaperStats = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/trade-setup/paper-stats`);
        const json = await res.json();
        if (json.status === 'success') setPaperStats(json.data);
      } catch (err: any) {
        console.warn('Dashboard: paper-stats unavailable', err?.message || '');
      }
    };

    fetchStats();
    fetchTopIdeas();
    fetchTradeStats();
    fetchPaperStats();
  }, []);

  return (
    <div className="space-y-6 slide-in">
      {/* Live Index Bar - Keep exactly as is */}
      <LiveIndexBar pollMs={5000} />

      {/* Section A: Today's Top Ideas */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <LineChartIcon className="h-5 w-5 mr-2 text-blue-600" />
          Today&apos;s Top Ideas
          {topIdeasData && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {topIdeasData.screenName} &middot; {new Date(topIdeasData.batchDate).toLocaleDateString()}
            </span>
          )}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Change
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topIdeasLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : !topIdeasData || topIdeasData.topIdeas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    Run your first screen to see today&apos;s top ideas.
                  </td>
                </tr>
              ) : (
                topIdeasData.topIdeas.map((idea, idx) => (
                  <tr key={idea.symbol} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-700">{idx + 1}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900">{idea.symbol}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{idea.score.toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">₹{idea.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`px-6 py-3 text-sm font-medium ${
                      idea.percentChange != null && idea.percentChange > 0
                        ? 'text-green-600'
                        : idea.percentChange != null && idea.percentChange < 0
                          ? 'text-red-600'
                          : 'text-gray-500'
                    }`}>
                      {idea.percentChange != null ? `${idea.percentChange > 0 ? '+' : ''}${idea.percentChange.toFixed(2)}%` : '–'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section B: Stat Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="glass-effect rounded-xl p-5 shadow-lg text-center">
          <Layers className="h-7 w-7 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{totalScreens}</p>
          <p className="text-xs text-gray-600 mt-1">Total Screens</p>
        </div>
        <div className="glass-effect rounded-xl p-5 shadow-lg text-center">
          <TrendingUp className="h-7 w-7 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{activeBatches}</p>
          <p className="text-xs text-gray-600 mt-1">Active Batches</p>
        </div>
        <div className="glass-effect rounded-xl p-5 shadow-lg text-center">
          <TrendingDown className="h-7 w-7 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{hitRate != null ? `${hitRate}%` : '–'}</p>
          <p className="text-xs text-gray-600 mt-1">3-Month Hit Rate</p>
        </div>
        <div className="glass-effect rounded-xl p-5 shadow-lg text-center">
          <Target className="h-7 w-7 text-orange-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {tradeStats?.winRate != null ? `${tradeStats.winRate}%` : '–'}
          </p>
          <p className="text-xs text-gray-600 mt-1">AI Setup Win Rate</p>
        </div>
        <div className="glass-effect rounded-xl p-5 shadow-lg text-center">
          <Target className="h-7 w-7 text-indigo-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{paperStats?.active ?? 0}</p>
          <p className="text-xs text-gray-600 mt-1">Paper Trades Active</p>
          {paperStats && (paperStats.wins > 0 || paperStats.losses > 0) && (
            <p className="text-xs text-gray-400 mt-0.5">{paperStats.wins}W / {paperStats.losses}L</p>
          )}
        </div>
        <div className="glass-effect rounded-xl p-5 shadow-lg text-center">
          <CheckCircle className={`h-7 w-7 mx-auto mb-2 ${paperStats?.winRate != null && paperStats.winRate >= 50 ? 'text-green-600' : 'text-red-500'}`} />
          <p className={`text-2xl font-bold ${paperStats?.winRate != null && paperStats.winRate >= 50 ? 'text-green-600' : paperStats?.winRate != null ? 'text-red-600' : 'text-gray-900'}`}>
            {paperStats?.winRate != null ? `${paperStats.winRate}%` : '–'}
          </p>
          <p className="text-xs text-gray-600 mt-1">Paper Win Rate</p>
          {paperStats?.avgReturnPct != null && (
            <p className={`text-xs mt-0.5 ${paperStats.avgReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              Avg {paperStats.avgReturnPct > 0 ? '+' : ''}{paperStats.avgReturnPct}%
            </p>
          )}
        </div>
      </div>

      {/* Section B2: Daily P&L + Position Sizer side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyPnLWidget />
        <PositionSizer />
      </div>

      {/* Section C: Active Trade Setups Tracker */}
      {activeSetups.length > 0 && (
        <div className="glass-effect rounded-xl p-6 shadow-lg border-2 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Target className="h-5 w-5 mr-2 text-orange-600" />
              Active Trade Setups
              <span className="ml-2 text-xs font-normal text-gray-400">
                {activeSetups.length} active &middot; {tradeStats?.targetHit || 0} wins &middot; {tradeStats?.slHit || 0} losses
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entry</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">SL</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Screen</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeSetups.map((setup) => {
                  const pnl = setup.currentPrice && setup.entryPrice > 0
                    ? ((setup.currentPrice - setup.entryPrice) / setup.entryPrice) * 100 * (setup.action === 'SELL' ? -1 : 1)
                    : null;
                  return (
                    <tr key={setup._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{setup.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          setup.action === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>{setup.action}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">₹{setup.entryPrice.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {setup.currentPrice ? `₹${setup.currentPrice.toLocaleString('en-IN')}` : '–'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">₹{setup.stopLoss.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">₹{setup.target.toLocaleString('en-IN')}</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${
                        pnl != null ? (pnl > 0 ? 'text-green-600' : pnl < 0 ? 'text-red-600' : 'text-gray-500') : 'text-gray-400'
                      }`}>
                        {pnl != null ? `${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%` : '–'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[120px]" title={setup.screenName || ''}>
                        {setup.screenName || '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade Setup Summary (when no active but has history) */}
      {activeSetups.length === 0 && tradeStats && tradeStats.total > 0 && (
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2 text-orange-600" />
            Trade Setup Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-green-600">{tradeStats.targetHit}</p>
              <p className="text-xs text-gray-500">Targets Hit</p>
            </div>
            <div>
              <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-600">{tradeStats.slHit}</p>
              <p className="text-xs text-gray-500">Stop Losses Hit</p>
            </div>
            <div>
              <Clock className="h-6 w-6 text-gray-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-600">{tradeStats.expired}</p>
              <p className="text-xs text-gray-500">Expired</p>
            </div>
            <div>
              <Target className="h-6 w-6 text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-orange-600">{tradeStats.winRate != null ? `${tradeStats.winRate}%` : '–'}</p>
              <p className="text-xs text-gray-500">Win Rate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
