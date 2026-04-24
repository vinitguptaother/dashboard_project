'use client';

import { useEffect, useState } from 'react';
import {
  Eye, Plus, Trash2, TrendingUp, TrendingDown, RefreshCw,
  Sparkles, MessageSquare, X, Search, ArrowUpRight, ArrowDownRight,
  Clock, ShieldCheck, BarChart3, ChevronDown, ChevronUp
} from 'lucide-react';
import PortfolioAnalyzerSection from './PortfolioAnalyzerSection';
import BacktestPanel from './BacktestPanel';

const BACKEND_URL = 'http://localhost:5002';
const ANALYZER_VISIBLE_KEY = 'portfolio-analyzer-visible';

interface WatchlistAnalysis {
  score: number | null;
  health: number | null;
  growth: number | null;
  valuation: number | null;
  technical: number | null;
  orderFlow: number | null;
  institutional: number | null;
  summary: string;
  signal: 'BUY' | 'SELL' | 'HOLD' | 'WATCH' | null;
  analyzedAt: string | null;
}

interface WatchlistItem {
  _id: string;
  symbol: string;
  name: string;
  addedAt: string;
  notes: string;
  lastAnalysis: WatchlistAnalysis | null;
  priceWhenAdded: number | null;
  currentPrice: number | null;
}

const signalColors: Record<string, string> = {
  BUY: 'bg-green-100 text-green-700 border-green-300',
  SELL: 'bg-red-100 text-red-700 border-red-300',
  HOLD: 'bg-blue-100 text-blue-700 border-blue-300',
  WATCH: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

const PortfolioTab = () => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSymbol, setAddSymbol] = useState('');
  const [addName, setAddName] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addError, setAddError] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [filterSignal, setFilterSignal] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnalyzer, setShowAnalyzer] = useState<boolean>(true);

  // Persist analyzer show/hide across reloads
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ANALYZER_VISIBLE_KEY);
      if (stored === 'false') setShowAnalyzer(false);
    } catch { /* no-op */ }
  }, []);
  const toggleAnalyzer = (next: boolean): void => {
    setShowAnalyzer(next);
    try { localStorage.setItem(ANALYZER_VISIBLE_KEY, next ? 'true' : 'false'); } catch { /* no-op */ }
  };

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/watchlist`);
      const json = await res.json();
      if (json.status === 'success') setItems(json.data || []);
    } catch (e) {
      console.error('Failed to fetch watchlist:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWatchlist(); }, []);

  const handleAdd = async () => {
    if (!addSymbol.trim()) { setAddError('Enter a stock symbol'); return; }
    setAddError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: addSymbol.trim(), name: addName.trim() || addSymbol.trim(), notes: addNotes.trim() }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setItems(json.data);
        setShowAddModal(false);
        setAddSymbol(''); setAddName(''); setAddNotes('');
      } else {
        setAddError(json.message || 'Failed to add');
      }
    } catch (e) {
      setAddError('Network error');
    }
  };

  const handleRemove = async (symbol: string) => {
    if (!confirm(`Remove ${symbol} from watchlist?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/watchlist/${symbol}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.status === 'success') setItems(json.data);
    } catch (e) {
      console.error('Failed to remove:', e);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/watchlist/analyze`, { method: 'POST' });
      const json = await res.json();
      if (json.status === 'success') setItems(json.data);
      else alert(json.message || 'Analysis failed');
    } catch (e) {
      alert('Analysis failed — check if backend is running');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveNotes = async (symbol: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/watchlist/${symbol}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue }),
      });
      setItems(prev => prev.map(i => i.symbol === symbol ? { ...i, notes: notesValue } : i));
      setEditingNotes(null);
    } catch (e) {
      console.error('Failed to save notes:', e);
    }
  };

  // Filtering
  const filtered = items.filter(item => {
    if (filterSignal !== 'ALL' && item.lastAnalysis?.signal !== filterSignal) return false;
    if (searchTerm && !item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Sort by AI score descending
  const sorted = [...filtered].sort((a, b) => (b.lastAnalysis?.score || 0) - (a.lastAnalysis?.score || 0));

  const totalStocks = items.length;
  const analyzed = items.filter(i => i.lastAnalysis?.analyzedAt).length;
  const buySignals = items.filter(i => i.lastAnalysis?.signal === 'BUY').length;
  const avgScore = analyzed > 0
    ? (items.filter(i => i.lastAnalysis?.score != null).reduce((s, i) => s + (i.lastAnalysis?.score || 0), 0) / analyzed).toFixed(1)
    : '—';

  const scoreColor = (s: number) => s >= 18 ? 'text-green-600' : s >= 12 ? 'text-blue-600' : s >= 6 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg = (s: number) => s >= 18 ? 'bg-green-100' : s >= 12 ? 'bg-blue-100' : s >= 6 ? 'bg-yellow-100' : 'bg-red-100';

  return (
    <div className="space-y-6 slide-in">
      {/* Portfolio Analyzer — Phase 2 Track C */}
      <div className="glass-effect rounded-xl p-5 shadow-lg">
        {showAnalyzer ? (
          <PortfolioAnalyzerSection onHide={() => toggleAnalyzer(false)} />
        ) : (
          <button
            type="button"
            onClick={() => toggleAnalyzer(true)}
            className="w-full flex items-center justify-between text-left group"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <div>
                <h2 className="text-sm font-bold text-gray-900">Portfolio Analyzer</h2>
                <p className="text-xs text-gray-500">Upload broker CSV → get AI verdicts (GOOD/AVERAGE/BAD · BUY/HOLD/SELL)</p>
              </div>
            </div>
            <span className="text-xs text-purple-600 group-hover:underline flex items-center gap-0.5">
              Show <ChevronDown className="w-3.5 h-3.5" />
            </span>
          </button>
        )}
      </div>

      {/* Backtester — Phase 5 */}
      <BacktestPanel />

      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Watchlist + AI Monitor</h1>
        <p className="text-gray-600">Add stocks you want to track. AI analyzes them on demand.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-effect rounded-xl p-4 shadow-lg text-center">
          <p className="text-xs text-gray-500 uppercase">Watching</p>
          <p className="text-2xl font-bold text-gray-900 font-mono-nums">{totalStocks}</p>
        </div>
        <div className="glass-effect rounded-xl p-4 shadow-lg text-center">
          <p className="text-xs text-gray-500 uppercase">Analyzed</p>
          <p className="text-2xl font-bold text-gray-900 font-mono-nums">{analyzed}</p>
        </div>
        <div className="glass-effect rounded-xl p-4 shadow-lg text-center">
          <p className="text-xs text-gray-500 uppercase">BUY Signals</p>
          <p className="text-2xl font-bold text-green-600 font-mono-nums">{buySignals}</p>
        </div>
        <div className="glass-effect rounded-xl p-4 shadow-lg text-center">
          <p className="text-xs text-gray-500 uppercase">Avg Score</p>
          <p className="text-2xl font-bold text-blue-600 font-mono-nums">{avgScore}<span className="text-sm text-gray-400">/24</span></p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Stock
        </button>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || items.length === 0}
          className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Sparkles className={`h-4 w-4 mr-1 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
        </button>
        <div className="flex items-center gap-1 ml-auto">
          {['ALL', 'BUY', 'SELL', 'HOLD', 'WATCH'].map(sig => (
            <button
              key={sig}
              onClick={() => setFilterSignal(sig)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterSignal === sig ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {sig}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search watchlist..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
        />
      </div>

      {/* Watchlist Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading watchlist...</div>
      ) : sorted.length === 0 ? (
        <div className="glass-effect rounded-xl p-12 shadow-lg text-center">
          <Eye className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">
            {items.length === 0 ? 'Your watchlist is empty' : 'No stocks match your filter'}
          </p>
          {items.length === 0 && (
            <p className="text-gray-400 text-sm">Click &quot;Add Stock&quot; to start tracking stocks you&apos;re interested in.</p>
          )}
        </div>
      ) : (
        <div className="glass-effect rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Signal</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Health">🏦</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Growth">📈</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Valuation">💰</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Technical">📊</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Order Flow">📦</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase" title="Institutional">🏛️</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Summary</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sorted.map((item) => {
                  const a = item.lastAnalysis;
                  const hasAnalysis = a && a.analyzedAt;
                  const expanded = expandedSymbol === item.symbol;
                  return (
                    <tr key={item.symbol} className={`cursor-pointer hover:bg-gray-50 ${expanded ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3" onClick={() => setExpandedSymbol(expanded ? null : item.symbol)}>
                        <div className="font-semibold text-blue-600 text-sm">{item.symbol}</div>
                        <div className="text-xs text-gray-400">{item.name !== item.symbol ? item.name : ''}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {hasAnalysis && a.signal ? (
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${signalColors[a.signal] || 'bg-gray-100 text-gray-500'}`}>
                            {a.signal}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {hasAnalysis && a.score != null ? (
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${scoreBg(a.score)} ${scoreColor(a.score)}`}>
                            {a.score}/24
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center text-xs font-mono-nums">{hasAnalysis ? (a.health ?? '—') : '—'}</td>
                      <td className="px-2 py-3 text-center text-xs font-mono-nums">{hasAnalysis ? (a.growth ?? '—') : '—'}</td>
                      <td className="px-2 py-3 text-center text-xs font-mono-nums">{hasAnalysis ? (a.valuation ?? '—') : '—'}</td>
                      <td className="px-2 py-3 text-center text-xs font-mono-nums">{hasAnalysis ? (a.technical ?? '—') : '—'}</td>
                      <td className="px-2 py-3 text-center text-xs font-mono-nums">{hasAnalysis ? (a.orderFlow ?? '—') : '—'}</td>
                      <td className="px-2 py-3 text-center text-xs font-mono-nums">{hasAnalysis ? (a.institutional ?? '—') : '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-600 max-w-xs truncate" title={hasAnalysis ? a.summary : ''}>
                        {hasAnalysis ? a.summary : <span className="text-gray-300 italic">Not analyzed yet</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={(e) => { e.stopPropagation(); handleRemove(item.symbol); }} className="text-red-400 hover:text-red-600 transition-colors" title="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded Details */}
          {expandedSymbol && (() => {
            const item = items.find(i => i.symbol === expandedSymbol);
            if (!item) return null;
            const a = item.lastAnalysis;
            return (
              <div className="border-t border-gray-200 p-5 bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{item.symbol} — Details</h4>
                  <button onClick={() => setExpandedSymbol(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Added: {new Date(item.addedAt).toLocaleDateString('en-IN')}</p>
                    {a?.analyzedAt && (
                      <p className="text-xs text-gray-500 mb-1">Last analyzed: {new Date(a.analyzedAt).toLocaleString('en-IN')}</p>
                    )}
                    {a?.summary && (
                      <div className="mt-2 p-3 rounded-lg bg-white border border-gray-200">
                        <p className="text-sm text-gray-700">{a.summary}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500 font-medium">Notes</p>
                      {editingNotes !== item.symbol ? (
                        <button onClick={() => { setEditingNotes(item.symbol); setNotesValue(item.notes); }} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => handleSaveNotes(item.symbol)} className="text-xs text-green-600 hover:text-green-800">Save</button>
                          <button onClick={() => setEditingNotes(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      )}
                    </div>
                    {editingNotes === item.symbol ? (
                      <textarea
                        value={notesValue}
                        onChange={e => setNotesValue(e.target.value)}
                        className="w-full p-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-blue-300 outline-none"
                        rows={3}
                        placeholder="Add your notes about this stock..."
                      />
                    ) : (
                      <p className="text-sm text-gray-600 bg-white p-2 rounded-lg border min-h-[60px]">
                        {item.notes || <span className="text-gray-300 italic">No notes</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add to Watchlist</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Stock Symbol *</label>
                <input
                  type="text"
                  value={addSymbol}
                  onChange={e => setAddSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. RELIANCE, TCS, INFY"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Company Name (optional)</label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="e.g. Reliance Industries"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Notes (optional)</label>
                <textarea
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  placeholder="Why are you watching this stock?"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                  rows={2}
                />
              </div>
              {addError && <p className="text-xs text-red-500">{addError}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                  Add to Watchlist
                </button>
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioTab;
