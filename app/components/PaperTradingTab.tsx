'use client';

import React, { useState, useEffect } from 'react';
import {
  Target, CheckCircle, XCircle, Clock, RefreshCw, TrendingUp, TrendingDown,
  Activity, BarChart3, Brain, AlertCircle, Zap, ChevronDown, ChevronUp,
  Pencil, Check, X, Ban, Timer,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PaperTrade {
  _id: string;
  symbol: string;
  action: string;
  entryPrice: number;
  stopLoss: number;
  target: number;
  currentPrice: number | null;
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  riskRewardRatio: string;
  holdingDuration: string;
  status: string;
  exitPrice: number | null;
  closedAt: string | null;
  createdAt: string;
}

interface BestWorstTrade {
  symbol: string;
  pnlPct: number;
  id: string;
  date: string;
}

interface ConfidenceBracket {
  bracket: string;
  total: number;
  wins: number;
  winRate: number | null;
}

interface WeeklyData {
  weekStart: string;
  trades: number;
  wins: number;
  winRate: number;
}

interface PaperStats {
  total: number;
  active: number;
  wins: number;
  losses: number;
  expired: number;
  cancelled: number;
  winRate: number | null;
  avgReturnPct: number | null;
  bestTrade: BestWorstTrade | null;
  worstTrade: BestWorstTrade | null;
  confidenceCalibration: ConfidenceBracket[];
  weeklyPerformance: WeeklyData[];
  recentTrades: PaperTrade[];
}

// ─── Component ─────────────────────────────────────────────────────────────────

const PaperTradingTab = () => {
  const [stats, setStats] = useState<PaperStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'TARGET_HIT' | 'SL_HIT'>('ALL');
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ tradeId: string; field: 'entryPrice' | 'stopLoss' | 'target' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Update trade status (Target Hit, SL Hit, Cancel, Expired) ──
  const handleStatusChange = async (tradeId: string, newStatus: string, symbol: string) => {
    const labels: Record<string, string> = {
      TARGET_HIT: 'Target Hit', SL_HIT: 'SL Hit', CANCELLED: 'Cancelled', EXPIRED: 'Expired',
    };
    if (!window.confirm(`Mark ${symbol} as "${labels[newStatus] || newStatus}"?`)) return;

    setActionLoading(tradeId);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/trade-setup/${tradeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!resp.ok) throw new Error('Failed to update status');
      await fetchStats();
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Edit SL / Target / Entry inline ──
  const startEdit = (tradeId: string, field: 'entryPrice' | 'stopLoss' | 'target', currentValue: number) => {
    setEditingField({ tradeId, field });
    setEditValue(String(currentValue));
  };

  const cancelEdit = () => { setEditingField(null); setEditValue(''); };

  const saveEdit = async () => {
    if (!editingField) return;
    const num = Number(editValue);
    if (!num || num <= 0) { alert('Enter a valid price'); return; }

    setActionLoading(editingField.tradeId);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/trade-setup/${editingField.tradeId}/edit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingField.field]: num }),
      });
      if (!resp.ok) throw new Error('Failed to update');
      cancelEdit();
      await fetchStats();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/trade-setup/paper-stats`);
      if (!resp.ok) throw new Error('Failed to fetch');
      const json = await resp.json();
      if (json.status === 'success') {
        setStats(json.data);
      } else {
        throw new Error(json.message || 'Failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchStats, 120000);
    return () => clearInterval(interval);
  }, []);

  const getPnlPct = (trade: PaperTrade): number | null => {
    const price = trade.status === 'TARGET_HIT' ? (trade.exitPrice || trade.target)
      : trade.status === 'SL_HIT' ? (trade.exitPrice || trade.stopLoss)
      : trade.currentPrice;
    if (!price) return null;
    return (trade.action === 'BUY' || trade.action === 'ACCUMULATE')
      ? ((price - trade.entryPrice) / trade.entryPrice) * 100
      : ((trade.entryPrice - price) / trade.entryPrice) * 100;
  };

  const getDaysActive = (trade: PaperTrade): number => {
    const end = trade.closedAt ? new Date(trade.closedAt) : new Date();
    return Math.max(1, Math.round((end.getTime() - new Date(trade.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
  };

  const filteredTrades = stats?.recentTrades?.filter(t => filter === 'ALL' || t.status === filter) || [];

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
        <span className="ml-3 text-gray-600 text-lg">Loading paper trading data...</span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="glass-effect rounded-xl p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={fetchStats} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Retry
        </button>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="glass-effect rounded-xl p-12 text-center">
        <Brain className="h-16 w-16 text-indigo-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Paper Trades Yet</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Go to <span className="font-semibold text-indigo-600">Stock Search</span>, analyze any stock, and click
          &quot;Paper Trade This&quot; on the AI recommendation to start tracking.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Activity className="h-4 w-4" />
          <span>Paper trades are monitored automatically — SL/target hits tracked in real-time</span>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-600" />
            Paper Trading
          </h2>
          <p className="text-sm text-gray-500 mt-1">Track AI recommendations without risking real money</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Section A: Score Card ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Active', value: stats.active, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Wins', value: stats.wins, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Losses', value: stats.losses, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Win Rate', value: stats.winRate !== null ? `${stats.winRate}%` : '—', color: stats.winRate && stats.winRate >= 50 ? 'text-green-700' : 'text-red-700', bg: 'bg-purple-50' },
          { label: 'Avg Return', value: stats.avgReturnPct !== null ? `${stats.avgReturnPct > 0 ? '+' : ''}${stats.avgReturnPct}%` : '—', color: stats.avgReturnPct && stats.avgReturnPct >= 0 ? 'text-green-700' : 'text-red-700', bg: 'bg-indigo-50' },
          { label: 'Resolved', value: stats.wins + stats.losses, color: 'text-gray-700', bg: 'bg-gray-50' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Best / Worst trade */}
      {(stats.bestTrade || stats.worstTrade) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.bestTrade && (
            <div className="glass-effect rounded-xl p-4 border-l-4 border-green-500">
              <p className="text-xs text-gray-500 mb-1">Best Trade</p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{stats.bestTrade.symbol}</span>
                <span className="text-green-600 font-bold text-lg">+{stats.bestTrade.pnlPct}%</span>
              </div>
            </div>
          )}
          {stats.worstTrade && (
            <div className="glass-effect rounded-xl p-4 border-l-4 border-red-500">
              <p className="text-xs text-gray-500 mb-1">Worst Trade</p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{stats.worstTrade.symbol}</span>
                <span className="text-red-600 font-bold text-lg">{stats.worstTrade.pnlPct}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section B: Confidence Calibration ─────────────────────────────────── */}
      {stats.confidenceCalibration.some(b => b.total > 0) && (
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Confidence Calibration
          </h3>
          <p className="text-xs text-gray-500 mb-4">Does higher AI confidence actually predict better outcomes?</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.confidenceCalibration.map((b, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-gray-700 mb-2">{b.bracket}%</p>
                <div className="relative h-24 flex items-end justify-center mb-2">
                  <div
                    className={`w-12 rounded-t-lg transition-all ${
                      b.winRate === null ? 'bg-gray-200' : b.winRate >= 60 ? 'bg-green-500' : b.winRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ height: `${b.winRate ?? 10}%` }}
                  />
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {b.winRate !== null ? `${b.winRate}%` : '—'}
                </p>
                <p className="text-xs text-gray-500">{b.total} trades ({b.wins} wins)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section C: Weekly Performance ─────────────────────────────────────── */}
      {stats.weeklyPerformance.length > 0 && (
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Weekly Performance
          </h3>
          <div className="overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {stats.weeklyPerformance.map((w, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 min-w-[120px] text-center">
                  <p className="text-xs text-gray-500 mb-1">{w.weekStart}</p>
                  <p className={`text-lg font-bold ${w.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {w.winRate}%
                  </p>
                  <p className="text-xs text-gray-500">{w.wins}/{w.trades} wins</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Section D: Trades Table ───────────────────────────────────────────── */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Paper Trades</h3>
          <div className="flex gap-2">
            {(['ALL', 'ACTIVE', 'TARGET_HIT', 'SL_HIT'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'Active' : f === 'TARGET_HIT' ? 'Wins' : 'Losses'}
              </button>
            ))}
          </div>
        </div>

        {filteredTrades.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No trades match this filter</p>
        ) : (
          <div className="space-y-2">
            {filteredTrades.map(trade => {
              const pnl = getPnlPct(trade);
              const days = getDaysActive(trade);
              const isExpanded = expandedTrade === trade._id;

              return (
                <div key={trade._id} className="bg-gray-50 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setExpandedTrade(isExpanded ? null : trade._id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        (trade.action === 'BUY' || trade.action === 'ACCUMULATE') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {trade.action}
                      </span>
                      <span className="font-bold text-gray-900">{trade.symbol}</span>
                      <span className="text-sm text-gray-500">@ ₹{trade.entryPrice.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Status badge */}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        trade.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700'
                        : trade.status === 'TARGET_HIT' ? 'bg-green-100 text-green-700'
                        : trade.status === 'SL_HIT' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {trade.status === 'ACTIVE' && <Clock className="h-3 w-3 inline mr-1" />}
                        {trade.status === 'TARGET_HIT' && <CheckCircle className="h-3 w-3 inline mr-1" />}
                        {trade.status === 'SL_HIT' && <XCircle className="h-3 w-3 inline mr-1" />}
                        {trade.status.replace('_', ' ')}
                      </span>

                      {/* P&L */}
                      {pnl !== null && (
                        <span className={`font-bold text-sm ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                        </span>
                      )}

                      {/* Days */}
                      <span className="text-xs text-gray-500">{days}d</span>

                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200 pt-3">
                      {/* Price grid with inline editing */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                        {/* Entry Price — editable for ACTIVE */}
                        <div>
                          <p className="text-xs text-gray-500">Entry</p>
                          {editingField?.tradeId === trade._id && editingField.field === 'entryPrice' ? (
                            <div className="flex items-center gap-1">
                              <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()}
                                className="w-24 px-2 py-0.5 border rounded text-sm" autoFocus />
                              <button onClick={saveEdit} className="text-green-600 hover:text-green-800"><Check className="h-4 w-4" /></button>
                              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <p className="font-medium flex items-center gap-1">
                              ₹{trade.entryPrice.toLocaleString('en-IN')}
                              {trade.status === 'ACTIVE' && (
                                <button onClick={() => startEdit(trade._id, 'entryPrice', trade.entryPrice)}
                                  className="text-gray-300 hover:text-indigo-500"><Pencil className="h-3 w-3" /></button>
                              )}
                            </p>
                          )}
                        </div>
                        {/* Current Price — read only */}
                        <div>
                          <p className="text-xs text-gray-500">Current</p>
                          <p className="font-medium">{trade.currentPrice ? `₹${trade.currentPrice.toLocaleString('en-IN')}` : '—'}</p>
                        </div>
                        {/* Stop Loss — editable for ACTIVE */}
                        <div>
                          <p className="text-xs text-red-500">Stop Loss</p>
                          {editingField?.tradeId === trade._id && editingField.field === 'stopLoss' ? (
                            <div className="flex items-center gap-1">
                              <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()}
                                className="w-24 px-2 py-0.5 border border-red-200 rounded text-sm" autoFocus />
                              <button onClick={saveEdit} className="text-green-600 hover:text-green-800"><Check className="h-4 w-4" /></button>
                              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <p className="font-medium text-red-600 flex items-center gap-1">
                              ₹{trade.stopLoss.toLocaleString('en-IN')}
                              {trade.status === 'ACTIVE' && (
                                <button onClick={() => startEdit(trade._id, 'stopLoss', trade.stopLoss)}
                                  className="text-red-200 hover:text-red-500"><Pencil className="h-3 w-3" /></button>
                              )}
                            </p>
                          )}
                        </div>
                        {/* Target — editable for ACTIVE */}
                        <div>
                          <p className="text-xs text-green-500">Target</p>
                          {editingField?.tradeId === trade._id && editingField.field === 'target' ? (
                            <div className="flex items-center gap-1">
                              <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' ? saveEdit() : e.key === 'Escape' && cancelEdit()}
                                className="w-24 px-2 py-0.5 border border-green-200 rounded text-sm" autoFocus />
                              <button onClick={saveEdit} className="text-green-600 hover:text-green-800"><Check className="h-4 w-4" /></button>
                              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <p className="font-medium text-green-600 flex items-center gap-1">
                              ₹{trade.target.toLocaleString('en-IN')}
                              {trade.status === 'ACTIVE' && (
                                <button onClick={() => startEdit(trade._id, 'target', trade.target)}
                                  className="text-green-200 hover:text-green-500"><Pencil className="h-3 w-3" /></button>
                              )}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Confidence</p>
                          <p className="font-medium">{trade.confidence}%</p>
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="flex gap-3 text-xs text-gray-500 mb-2">
                        <span>R:R {trade.riskRewardRatio}</span>
                        <span>Duration: {trade.holdingDuration}</span>
                        <span>Created: {new Date(trade.createdAt).toLocaleDateString('en-IN')}</span>
                        {trade.closedAt && <span>Closed: {new Date(trade.closedAt).toLocaleDateString('en-IN')}</span>}
                      </div>

                      {/* Action buttons — only for ACTIVE trades */}
                      {trade.status === 'ACTIVE' && (
                        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-white rounded-lg border border-gray-100">
                          <span className="text-xs text-gray-500 self-center mr-1">Actions:</span>
                          <button
                            onClick={() => handleStatusChange(trade._id, 'TARGET_HIT', trade.symbol)}
                            disabled={actionLoading === trade._id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50"
                          >
                            <Target className="h-3 w-3" /> Target Hit
                          </button>
                          <button
                            onClick={() => handleStatusChange(trade._id, 'SL_HIT', trade.symbol)}
                            disabled={actionLoading === trade._id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" /> SL Hit
                          </button>
                          <button
                            onClick={() => handleStatusChange(trade._id, 'CANCELLED', trade.symbol)}
                            disabled={actionLoading === trade._id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-50"
                          >
                            <Ban className="h-3 w-3" /> Cancel
                          </button>
                          <button
                            onClick={() => handleStatusChange(trade._id, 'EXPIRED', trade.symbol)}
                            disabled={actionLoading === trade._id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-100 border border-yellow-200 transition-colors disabled:opacity-50"
                          >
                            <Timer className="h-3 w-3" /> Expired
                          </button>
                        </div>
                      )}

                      {trade.reasoning && (
                        <p className="text-sm text-gray-700 bg-white rounded-lg p-3">{trade.reasoning}</p>
                      )}
                      {trade.riskFactors.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {trade.riskFactors.map((r, i) => (
                            <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperTradingTab;
