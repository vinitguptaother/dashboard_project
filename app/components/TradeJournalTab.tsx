'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Ban,
  AlertTriangle,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react';
import PositionSizer from './PositionSizer';
import TradeReplayModal from './TradeReplayModal';
import VoiceJournal from './VoiceJournal';

const BACKEND_URL = 'http://localhost:5002';

interface TradeSetup {
  _id: string;
  symbol: string;
  tradeType: string;
  action: string;
  entryPrice: number;
  stopLoss: number;
  target: number;
  currentPrice: number | null;
  holdingDuration: string;
  riskRewardRatio: string;
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  screenBatchId: string | null;
  screenName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  active: number;
  targetHit: number;
  slHit: number;
  expired: number;
  cancelled: number;
  winRate: number | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Target }> = {
  ACTIVE: { label: 'Active', color: 'text-blue-700', bg: 'bg-blue-100', icon: Target },
  TARGET_HIT: { label: 'Target Hit', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  SL_HIT: { label: 'SL Hit', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
  EXPIRED: { label: 'Expired', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
  CANCELLED: { label: 'Cancelled', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Ban },
};

interface MonitorHealth {
  lastRun: string | null;
  lastRunAgo: string | null;
  status: string;
  activeSetups: number;
  symbolsChecked: number;
  pricesFound: number;
  unmapped?: string[];
  errors?: string[];
  isHealthy: boolean;
  priceSnapshot?: Record<string, number>;
  reason?: string;
}

const TradeJournalTab = () => {
  const [setups, setSetups] = useState<TradeSetup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [monitorHealth, setMonitorHealth] = useState<MonitorHealth | null>(null);
  const [showMonitorDetails, setShowMonitorDetails] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [screenFilter, setScreenFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'createdAt' | 'symbol' | 'confidence'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [historyRes, statsRes, healthRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/trade-setup/history?limit=200`),
        fetch(`${BACKEND_URL}/api/trade-setup/stats`),
        fetch(`${BACKEND_URL}/api/risk/monitor-health`),
      ]);
      const historyJson = await historyRes.json();
      const statsJson = await statsRes.json();
      if (historyJson.status === 'success') setSetups(historyJson.data);
      if (statsJson.status === 'success') setStats(statsJson.data);
      try {
        const healthJson = await healthRes.json();
        if (healthJson.status === 'success') setMonitorHealth(healthJson.data);
      } catch {}
    } catch (err) {
      console.error('Failed to fetch trade journal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh monitor health every 2 minutes
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/risk/monitor-health`);
        const json = await res.json();
        if (json.status === 'success') setMonitorHealth(json.data);
      } catch {}
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  // Unique screen names for filter dropdown
  const screenNames = useMemo(() => {
    const names = new Set(setups.map((s) => s.screenName).filter(Boolean));
    return Array.from(names).sort();
  }, [setups]);

  // Filtered & sorted setups
  const filtered = useMemo(() => {
    let list = [...setups];
    if (statusFilter !== 'ALL') list = list.filter((s) => s.status === statusFilter);
    if (screenFilter !== 'ALL') list = list.filter((s) => s.screenName === screenFilter);
    if (actionFilter !== 'ALL') list = list.filter((s) => s.action === actionFilter);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
      else if (sortField === 'confidence') cmp = a.confidence - b.confidence;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [setups, statusFilter, screenFilter, actionFilter, sortField, sortDir]);

  // Per-screen stats
  const screenStats = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; total: number }>();
    for (const s of setups) {
      const name = s.screenName || 'Unknown';
      if (!map.has(name)) map.set(name, { wins: 0, losses: 0, total: 0 });
      const entry = map.get(name)!;
      entry.total++;
      if (s.status === 'TARGET_HIT') entry.wins++;
      if (s.status === 'SL_HIT') entry.losses++;
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        winRate: data.wins + data.losses > 0 ? ((data.wins / (data.wins + data.losses)) * 100).toFixed(1) : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [setups]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/trade-setup/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSetups((prev) => prev.map((s) => (s._id === id ? { ...s, status: newStatus } : s)));
        // Refresh stats
        const statsRes = await fetch(`${BACKEND_URL}/api/trade-setup/stats`);
        const statsJson = await statsRes.json();
        if (statsJson.status === 'success') setStats(statsJson.data);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? <ChevronDown className="h-3 w-3 inline ml-1" /> : <ChevronUp className="h-3 w-3 inline ml-1" />;
  };

  const computePnl = (setup: TradeSetup) => {
    if (!setup.currentPrice || setup.entryPrice <= 0) return null;
    const pnl = ((setup.currentPrice - setup.entryPrice) / setup.entryPrice) * 100 * (setup.action === 'SELL' ? -1 : 1);
    return pnl;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500">Loading trade journal...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 slide-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
          <Target className="h-6 w-6 sm:h-7 sm:w-7 mr-2 text-orange-600" />
          Trade Journal
        </h2>
        <button
          onClick={fetchData}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm min-h-[44px]"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Phase 6: Voice Journal — quick standalone entry */}
      <VoiceJournal />

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="glass-effect rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Setups</p>
          </div>
          <div className="glass-effect rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
            <p className="text-xs text-gray-500">Active</p>
          </div>
          <div className="glass-effect rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.targetHit}</p>
            <p className="text-xs text-gray-500">Targets Hit</p>
          </div>
          <div className="glass-effect rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.slHit}</p>
            <p className="text-xs text-gray-500">SL Hit</p>
          </div>
          <div className="glass-effect rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-500">{stats.expired + stats.cancelled}</p>
            <p className="text-xs text-gray-500">Expired / Cancelled</p>
          </div>
          <div className="glass-effect rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stats.winRate != null && stats.winRate >= 50 ? 'text-green-600' : stats.winRate != null ? 'text-red-600' : 'text-gray-400'}`}>
              {stats.winRate != null ? `${stats.winRate}%` : '–'}
            </p>
            <p className="text-xs text-gray-500">Win Rate</p>
          </div>
        </div>
      )}

      {/* Per-Screen Accuracy */}
      {screenStats.length > 0 && (
        <div className="glass-effect rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-1 text-purple-600" />
            AI Accuracy by Screen
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {screenStats.map((ss) => (
              <div key={ss.name} className="border border-gray-100 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-800 truncate" title={ss.name}>{ss.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{ss.total} setups</span>
                  <span className="text-xs">
                    <span className="text-green-600 font-medium">{ss.wins}W</span>
                    {' / '}
                    <span className="text-red-600 font-medium">{ss.losses}L</span>
                  </span>
                  <span className={`text-xs font-bold ${ss.winRate && parseFloat(ss.winRate) >= 50 ? 'text-green-600' : ss.winRate ? 'text-red-600' : 'text-gray-400'}`}>
                    {ss.winRate ? `${ss.winRate}%` : '–'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Monitor Health */}
      <div className={`rounded-xl p-4 shadow-lg border-2 ${
        monitorHealth?.isHealthy ? 'glass-effect border-green-200' :
        monitorHealth?.status === 'never_run' || !monitorHealth ? 'glass-effect border-gray-200' :
        'glass-effect border-red-200'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center">
            {monitorHealth?.isHealthy ? (
              <Wifi className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 mr-2 text-red-500" />
            )}
            Trade Monitor
            <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
              monitorHealth?.isHealthy ? 'bg-green-100 text-green-700' :
              monitorHealth?.status === 'never_run' || !monitorHealth ? 'bg-gray-100 text-gray-600' :
              'bg-red-100 text-red-700'
            }`}>
              {monitorHealth?.status === 'ok' ? 'Healthy' :
               monitorHealth?.status === 'idle' ? 'Idle (no active setups)' :
               monitorHealth?.status === 'skipped' ? 'Skipped — ' + (monitorHealth?.reason || 'unknown') :
               monitorHealth?.status === 'no_keys' ? 'No Instrument Keys' :
               monitorHealth?.status === 'no_prices' ? 'No Prices Fetched' :
               monitorHealth?.status === 'never_run' ? 'Never Run' :
               !monitorHealth ? 'Loading...' : monitorHealth.status}
            </span>
          </h3>
          <button
            onClick={() => setShowMonitorDetails(!showMonitorDetails)}
            className="text-xs text-blue-600 hover:underline flex items-center"
          >
            {showMonitorDetails ? 'Hide' : 'Details'}
            {showMonitorDetails ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </button>
        </div>

        {/* Summary row — always visible */}
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
          <span>Last run: <strong className="text-gray-700">{monitorHealth?.lastRunAgo || 'never'}</strong></span>
          <span>Active setups: <strong className="text-gray-700">{monitorHealth?.activeSetups ?? 0}</strong></span>
          <span>Symbols checked: <strong className="text-gray-700">{monitorHealth?.symbolsChecked ?? 0}</strong></span>
          <span>Prices found: <strong className={`${
            monitorHealth?.pricesFound && monitorHealth.pricesFound > 0 ? 'text-green-600' : 'text-red-600'
          }`}>{monitorHealth?.pricesFound ?? 0}</strong></span>
        </div>

        {/* Expandable details */}
        {showMonitorDetails && monitorHealth && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            {/* Unmapped symbols warning */}
            {monitorHealth.unmapped && monitorHealth.unmapped.length > 0 && (
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-yellow-800">Unmonitored Stocks</p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    These stocks have no instrument key in the DB — their SL/Target will NOT be checked:
                    <strong> {monitorHealth.unmapped.join(', ')}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Errors */}
            {monitorHealth.errors && monitorHealth.errors.length > 0 && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-800">Errors</p>
                  {monitorHealth.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700 mt-0.5">{err}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Price snapshot */}
            {monitorHealth.priceSnapshot && Object.keys(monitorHealth.priceSnapshot).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Last Price Snapshot</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(monitorHealth.priceSnapshot).map(([sym, price]) => (
                    <span key={sym} className="text-xs bg-gray-100 rounded px-2 py-1">
                      {sym}: <strong>₹{Number(price).toLocaleString('en-IN')}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass-effect rounded-xl p-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TARGET_HIT">Target Hit</option>
            <option value="SL_HIT">SL Hit</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">All Actions</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="HOLD">HOLD</option>
            <option value="AVOID">AVOID</option>
          </select>
          {screenNames.length > 0 && (
            <select
              value={screenFilter}
              onChange={(e) => setScreenFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Screens</option>
              {screenNames.map((name) => (
                <option key={name} value={name!}>{name}</option>
              ))}
            </select>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} setups shown</span>
        </div>
      </div>

      {/* Trade Table */}
      {filtered.length === 0 ? (
        <div className="glass-effect rounded-xl p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {setups.length === 0
              ? 'No trade setups yet. Go to Screens → rank a batch → click "Get AI Trade Setups".'
              : 'No setups match your filters.'}
          </p>
        </div>
      ) : (
        <div className="glass-effect rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                    onClick={() => toggleSort('symbol')}
                  >
                    Symbol <SortIcon field="symbol" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entry</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">SL</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L %</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">R:R</th>
                  <th
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                    onClick={() => toggleSort('confidence')}
                  >
                    Conf <SortIcon field="confidence" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
                    onClick={() => toggleSort('createdAt')}
                  >
                    Date <SortIcon field="createdAt" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((setup) => {
                  const pnl = computePnl(setup);
                  const sc = STATUS_CONFIG[setup.status] || STATUS_CONFIG.ACTIVE;
                  const StatusIcon = sc.icon;
                  const isExpanded = expandedId === setup._id;

                  return (
                    <React.Fragment key={setup._id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : setup._id)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-gray-900">{setup.symbol}</span>
                          {setup.screenName && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {setup.screenName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              setup.action === 'BUY'
                                ? 'bg-green-100 text-green-800'
                                : setup.action === 'SELL'
                                ? 'bg-red-100 text-red-800'
                                : setup.action === 'AVOID'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {setup.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{setup.tradeType}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {setup.entryPrice > 0 ? `₹${setup.entryPrice.toLocaleString('en-IN')}` : '–'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          {setup.stopLoss > 0 ? `₹${setup.stopLoss.toLocaleString('en-IN')}` : '–'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">
                          {setup.target > 0 ? `₹${setup.target.toLocaleString('en-IN')}` : '–'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {setup.currentPrice ? `₹${setup.currentPrice.toLocaleString('en-IN')}` : '–'}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm text-right font-semibold ${
                            pnl != null ? (pnl > 0 ? 'text-green-600' : pnl < 0 ? 'text-red-600' : 'text-gray-500') : 'text-gray-400'
                          }`}
                        >
                          {pnl != null ? `${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%` : '–'}
                        </td>
                        <td className="px-4 py-3 text-xs text-center text-gray-600">{setup.riskRewardRatio}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block w-8 h-8 leading-8 text-xs font-bold rounded-full ${
                              setup.confidence >= 70
                                ? 'bg-green-100 text-green-700'
                                : setup.confidence >= 40
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {setup.confidence}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${sc.bg} ${sc.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(setup.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                      </tr>
                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={12} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">AI Reasoning</p>
                                <p className="text-gray-600">{setup.reasoning || 'No reasoning provided.'}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">Risk Factors</p>
                                {setup.riskFactors.length > 0 ? (
                                  <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                                    {setup.riskFactors.map((rf, i) => (
                                      <li key={i}>{rf}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-gray-400">None listed</p>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">Details</p>
                                <p className="text-gray-600">
                                  Duration: {setup.holdingDuration}
                                  <br />
                                  Screen: {setup.screenName || '–'}
                                  <br />
                                  Created: {new Date(setup.createdAt).toLocaleString('en-IN')}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {setup.status === 'ACTIVE' && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(setup._id, 'TARGET_HIT');
                                        }}
                                        className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                                      >
                                        Mark Target Hit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(setup._id, 'SL_HIT');
                                        }}
                                        className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                                      >
                                        Mark SL Hit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(setup._id, 'CANCELLED');
                                        }}
                                        className="px-3 py-1 text-xs bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReplayId(setup._id);
                                    }}
                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-1"
                                    title="Replay this trade — see price path, market conditions, and what better action would have been"
                                  >
                                    <Activity className="w-3 h-3" /> Replay
                                  </button>
                                </div>
                              </div>
                            </div>
                            {/* Position sizing for this trade */}
                            {(setup.action === 'BUY' || setup.action === 'SELL') && setup.entryPrice > 0 && setup.stopLoss > 0 && setup.target > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs font-semibold text-gray-500 mb-2">RECOMMENDED POSITION SIZE</p>
                                <PositionSizer
                                  compact
                                  prefillEntry={setup.entryPrice}
                                  prefillSL={setup.stopLoss}
                                  prefillTarget={setup.target}
                                  prefillAction={setup.action as 'BUY' | 'SELL'}
                                />
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {replayId && (
        <TradeReplayModal tradeId={replayId} onClose={() => setReplayId(null)} />
      )}
    </div>
  );
};

export default TradeJournalTab;
