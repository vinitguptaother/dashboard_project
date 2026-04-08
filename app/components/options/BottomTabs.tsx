'use client';

import React, { useState, useEffect } from 'react';
import { Zap, BarChart3, BookOpen, FolderOpen, Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { StrategyPreset, OptionsMockTrade, TradeStats, OptionsPortfolio, PortfolioPnL } from './types';
import { STRATEGY_PRESETS, STRATEGY_CATEGORIES } from './constants';
import { formatINRCompact } from './utils';

type TabId = 'ready-made' | 'positions' | 'saved' | 'portfolios';

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onApplyPreset: (name: string) => void;
  trades: OptionsMockTrade[];
  tradeStats: TradeStats | null;
  livePnL: Record<string, { totalPnl: number }>;
  onCloseTrade: (id: string, exitPnl: number) => void;
  onDeleteTrade: (id: string) => void;
  chainLoaded: boolean;
  onLoadTrade?: (trade: OptionsMockTrade) => void;
  // Portfolio props
  portfolios: OptionsPortfolio[];
  onCreatePortfolio: (name: string, description?: string, color?: string) => Promise<any>;
  onDeletePortfolio: (id: string) => void;
  onFetchPortfolioPnL: (id: string, period: string) => Promise<PortfolioPnL | null>;
  onRemoveTradeFromPortfolio: (portfolioId: string, tradeId: string) => void;
}

const TAB_CONFIG: { id: TabId; label: string; icon: any }[] = [
  { id: 'ready-made', label: 'Ready-made', icon: Zap },
  { id: 'positions', label: 'Positions', icon: BarChart3 },
  { id: 'saved', label: 'Saved', icon: BookOpen },
  { id: 'portfolios', label: 'Portfolios', icon: FolderOpen },
];

const CATEGORY_LABELS: Record<string, string> = {
  neutral: 'Neutral',
  bullish: 'Bullish',
  bearish: 'Bearish',
  volatile: 'Volatile',
};

export default function BottomTabs({
  activeTab, onTabChange, onApplyPreset,
  trades, tradeStats, livePnL, onCloseTrade, onDeleteTrade, chainLoaded, onLoadTrade,
  portfolios, onCreatePortfolio, onDeletePortfolio, onFetchPortfolioPnL, onRemoveTradeFromPortfolio,
}: Props) {
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closePnl, setClosePnl] = useState('');

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');

  return (
    <div className="flex-1 flex flex-col border-t border-gray-200 dark:border-gray-700 min-h-0">
      {/* Tab strip */}
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'ready-made' && (
          <ReadyMadeContent onApplyPreset={onApplyPreset} chainLoaded={chainLoaded} />
        )}
        {activeTab === 'positions' && (
          <PositionsContent
            trades={openTrades}
            livePnL={livePnL}
            closingId={closingId}
            closePnl={closePnl}
            setClosingId={setClosingId}
            setClosePnl={setClosePnl}
            onCloseTrade={onCloseTrade}
            onDeleteTrade={onDeleteTrade}
            onLoadTrade={onLoadTrade}
          />
        )}
        {activeTab === 'saved' && (
          <SavedContent trades={closedTrades} />
        )}
        {activeTab === 'portfolios' && (
          <PortfoliosContent
            portfolios={portfolios}
            onCreatePortfolio={onCreatePortfolio}
            onDeletePortfolio={onDeletePortfolio}
            onFetchPnL={onFetchPortfolioPnL}
            onRemoveTrade={onRemoveTradeFromPortfolio}
          />
        )}
      </div>
    </div>
  );
}

// ─── Ready-made strategies ────────────────────────────────────────────────────

function ReadyMadeContent({ onApplyPreset, chainLoaded }: { onApplyPreset: (name: string) => void; chainLoaded: boolean }) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? STRATEGY_PRESETS
    : STRATEGY_PRESETS.filter(p => p.category === filter);

  return (
    <div className="space-y-2">
      {/* Category filter pills */}
      <div className="flex items-center gap-1 px-1 pb-1">
        {STRATEGY_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              filter === cat
                ? cat === 'bullish' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : cat === 'bearish' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : cat === 'volatile' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : cat === 'neutral' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {filtered.map(p => (
          <button
            key={p.name}
            onClick={() => onApplyPreset(p.name)}
            disabled={!chainLoaded}
            className="text-left p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-40 group"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {p.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                p.category === 'bullish' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : p.category === 'bearish' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : p.category === 'volatile' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {CATEGORY_LABELS[p.category] || p.category}
              </span>
              <span className="text-[9px] text-gray-400">{p.legs(0, 0).length} legs</span>
            </div>
            {p.description && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight line-clamp-2">
                {p.description}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Open Positions ───────────────────────────────────────────────────────────

function PositionsContent({
  trades, livePnL, closingId, closePnl, setClosingId, setClosePnl, onCloseTrade, onDeleteTrade, onLoadTrade,
}: {
  trades: OptionsMockTrade[];
  livePnL: Record<string, { totalPnl: number }>;
  closingId: string | null;
  closePnl: string;
  setClosingId: (id: string | null) => void;
  setClosePnl: (v: string) => void;
  onCloseTrade: (id: string, exitPnl: number) => void;
  onDeleteTrade: (id: string) => void;
  onLoadTrade?: (trade: OptionsMockTrade) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (trades.length === 0) {
    return <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">No open positions</div>;
  }

  return (
    <div className="space-y-2">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded text-xs">
        <span className="text-gray-500">Total Unbooked:</span>
        <span className={`font-mono-nums font-semibold ${
          Object.values(livePnL).reduce((s, v) => s + v.totalPnl, 0) >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatINRCompact(Object.values(livePnL).reduce((s, v) => s + v.totalPnl, 0))}
        </span>
      </div>

      {trades.map(t => {
        const pnl = livePnL[t._id];
        const isExpanded = expandedId === t._id;
        return (
          <div key={t._id} className={`rounded-lg border bg-white dark:bg-gray-900/50 transition-all ${
            isExpanded ? 'border-blue-300 dark:border-blue-700 shadow-sm' : 'border-gray-100 dark:border-gray-800'
          }`}>
            {/* Clickable header */}
            <div
              className="p-2 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 rounded-t-lg"
              onClick={() => {
                const newId = isExpanded ? null : t._id;
                setExpandedId(newId);
                if (newId && onLoadTrade) onLoadTrade(t);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{t.strategyName}</span>
                  <span className="text-[10px] text-gray-400">{t.underlying} · {t.expiry?.slice(5)}</span>
                </div>
                <span className={`font-mono-nums text-sm font-bold ${
                  (pnl?.totalPnl || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {pnl ? formatINRCompact(pnl.totalPnl) : '₹0'}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {t.legs.map((l, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    <span className={l.side === 'SELL' ? 'text-red-500' : 'text-green-500'}>{l.side[0]}</span>
                    {' '}{l.strike} {l.type} @{(l.premium ?? 0).toFixed(1)}
                  </span>
                ))}
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-2 pb-2 pt-1.5 space-y-1.5">
                {/* Key metrics grid */}
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className="bg-green-50 dark:bg-green-900/10 rounded p-1.5 text-center">
                    <div className="text-gray-400">Max Profit</div>
                    <div className="font-mono-nums font-semibold text-green-600">
                      {typeof t.maxProfit === 'number' ? formatINRCompact(t.maxProfit) : 'Unlimited'}
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded p-1.5 text-center">
                    <div className="text-gray-400">Max Loss</div>
                    <div className="font-mono-nums font-semibold text-red-600">
                      {typeof t.maxLoss === 'number' ? formatINRCompact(Math.abs(t.maxLoss)) : 'Unlimited'}
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded p-1.5 text-center">
                    <div className="text-gray-400">POP</div>
                    <div className="font-mono-nums font-semibold text-blue-600">{(t.pop ?? 0).toFixed(0)}%</div>
                  </div>
                </div>

                {/* Extra detail row */}
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5">
                    <span className="text-gray-400">Premium: </span>
                    <span className={`font-mono-nums font-semibold ${t.premiumType === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.premiumType === 'CREDIT' ? 'Get' : 'Pay'} ₹{Math.abs(t.netPremium ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5">
                    <span className="text-gray-400">Breakeven: </span>
                    <span className="font-mono-nums font-semibold text-gray-700 dark:text-gray-300">
                      {(t.breakevens ?? []).length > 0 ? t.breakevens.map(b => (b ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })).join(', ') : '—'}
                    </span>
                  </div>
                </div>

                {/* Legs table */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded overflow-hidden">
                  <div className="grid grid-cols-5 gap-px text-[9px] uppercase text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-700 font-medium">
                    <span>Side</span><span>Strike</span><span>Type</span><span>Qty</span><span>Premium</span>
                  </div>
                  {t.legs.map((l, i) => (
                    <div key={i} className="grid grid-cols-5 gap-px px-2 py-1 text-xs border-t border-gray-100 dark:border-gray-700">
                      <span className={l.side === 'SELL' ? 'text-red-500 font-semibold' : 'text-green-500 font-semibold'}>{l.side}</span>
                      <span className="font-mono-nums">{l.strike}</span>
                      <span>{l.type}</span>
                      <span className="font-mono-nums">{l.qty}</span>
                      <span className="font-mono-nums">₹{(l.premium ?? 0).toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                {/* Entry info */}
                <div className="text-[10px] text-gray-400 flex justify-between">
                  <span>Entry Spot: <span className="font-mono-nums text-gray-600 dark:text-gray-300">{(t.entrySpot ?? 0).toLocaleString('en-IN')}</span></span>
                  <span>Live P&L: <span className={`font-mono-nums font-semibold ${(pnl?.totalPnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pnl ? formatINRCompact(pnl.totalPnl) : '₹0'}</span></span>
                </div>

                {/* Actions */}
                {closingId === t._id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={closePnl}
                      onChange={e => setClosePnl(e.target.value)}
                      placeholder="Exit P&L"
                      className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none"
                    />
                    <button onClick={() => { onCloseTrade(t._id, parseFloat(closePnl) || 0); setClosingId(null); }} className="text-xs px-2 py-1 bg-green-500 text-white rounded">Close</button>
                    <button onClick={() => setClosingId(null)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button onClick={() => { setClosingId(t._id); setClosePnl(''); }} className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200">Exit</button>
                    <button onClick={() => onDeleteTrade(t._id)} className="text-[10px] px-2 py-0.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Saved (closed trades) ────────────────────────────────────────────────────

function SavedContent({ trades }: { trades: OptionsMockTrade[] }) {
  if (trades.length === 0) {
    return <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">No closed trades yet</div>;
  }

  return (
    <div className="space-y-1.5">
      {trades.map(t => (
        <div key={t._id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t.strategyName}</span>
            <span className="text-[10px] text-gray-400 ml-1">{t.underlying}</span>
          </div>
          <span className={`font-mono-nums text-xs font-semibold ${
            (t.exitPnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatINRCompact(t.exitPnl || 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Portfolios ──────────────────────────────────────────────────────────────

const PORTFOLIO_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const PNL_PERIODS = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'quarterly', label: '3M' },
  { value: 'half-yearly', label: '6M' },
  { value: 'yearly', label: 'Year' },
  { value: 'all', label: 'All' },
];

function PortfoliosContent({
  portfolios, onCreatePortfolio, onDeletePortfolio, onFetchPnL, onRemoveTrade,
}: {
  portfolios: OptionsPortfolio[];
  onCreatePortfolio: (name: string, description?: string, color?: string) => Promise<any>;
  onDeletePortfolio: (id: string) => void;
  onFetchPnL: (id: string, period: string) => Promise<PortfolioPnL | null>;
  onRemoveTrade: (portfolioId: string, tradeId: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(PORTFOLIO_COLORS[0]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pnlData, setPnlData] = useState<PortfolioPnL | null>(null);
  const [pnlPeriod, setPnlPeriod] = useState('all');
  const [pnlLoading, setPnlLoading] = useState(false);

  // Fetch P&L when expanding a portfolio or changing period
  useEffect(() => {
    if (!expandedId) { setPnlData(null); return; }
    let cancelled = false;
    (async () => {
      setPnlLoading(true);
      const data = await onFetchPnL(expandedId, pnlPeriod);
      if (!cancelled) { setPnlData(data); setPnlLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [expandedId, pnlPeriod, onFetchPnL]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreatePortfolio(newName.trim(), newDesc.trim() || undefined, newColor);
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  return (
    <div className="space-y-2">
      {/* Header + Create */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
          {portfolios.length} Portfolio{portfolios.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
        >
          <Plus className="w-3 h-3" /> New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 space-y-1.5">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Portfolio name (e.g. Iron Condors)"
            className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:border-blue-400"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <input
            type="text"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 outline-none focus:border-blue-400"
          />
          <div className="flex items-center gap-1.5">
            {PORTFOLIO_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${newColor === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-1.5 pt-0.5">
            <button onClick={handleCreate} className="text-[10px] px-3 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">Create</button>
            <button onClick={() => setShowCreate(false)} className="text-[10px] px-3 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Portfolio list */}
      {portfolios.length === 0 && !showCreate && (
        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No portfolios yet. Create one to organize your trades.
        </div>
      )}

      {portfolios.map(p => {
        const isExpanded = expandedId === p._id;
        return (
          <div key={p._id} className={`rounded-lg border transition-all ${
            isExpanded ? 'border-blue-300 dark:border-blue-700 shadow-sm' : 'border-gray-100 dark:border-gray-800'
          } bg-white dark:bg-gray-900/50`}>
            {/* Card header */}
            <div
              className="p-2 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 rounded-t-lg"
              onClick={() => { setExpandedId(isExpanded ? null : p._id); setPnlPeriod('all'); }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{p.name}</span>
                  <span className="text-[10px] text-gray-400">{p.tradeCount} trade{p.tradeCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono-nums text-xs font-semibold ${p.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatINRCompact(p.totalPnl)}
                  </span>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                </div>
              </div>
              {p.description && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}
              <div className="flex items-center gap-2 mt-1 text-[10px]">
                <span className="text-green-600">{p.openCount} open</span>
                <span className="text-gray-400">{p.closedCount} closed</span>
                {p.closedCount > 0 && <span className="text-gray-400">WR: {p.winRate}%</span>}
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-2 pb-2 pt-1.5 space-y-1.5">
                {/* Period selector */}
                <div className="flex items-center gap-0.5 flex-wrap">
                  {PNL_PERIODS.map(per => (
                    <button
                      key={per.value}
                      onClick={() => setPnlPeriod(per.value)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        pnlPeriod === per.value
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {per.label}
                    </button>
                  ))}
                </div>

                {/* P&L summary */}
                {pnlLoading ? (
                  <div className="text-center text-[10px] text-gray-400 py-2">Loading...</div>
                ) : pnlData ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5 text-center">
                        <div className="text-gray-400">P&L</div>
                        <div className={`font-mono-nums font-semibold ${pnlData.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatINRCompact(pnlData.totalPnl)}
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5 text-center">
                        <div className="text-gray-400">Trades</div>
                        <div className="font-mono-nums font-semibold text-gray-700 dark:text-gray-300">{pnlData.tradeCount}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5 text-center">
                        <div className="text-gray-400">W/L</div>
                        <div className="font-mono-nums font-semibold text-gray-700 dark:text-gray-300">{pnlData.wins}/{pnlData.losses}</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5 text-center">
                        <div className="text-gray-400">Win Rate</div>
                        <div className={`font-mono-nums font-semibold ${pnlData.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                          {pnlData.winRate}%
                        </div>
                      </div>
                    </div>

                    {/* Trade list */}
                    {pnlData.trades.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800 rounded overflow-hidden max-h-32 overflow-y-auto">
                        {pnlData.trades.map(t => (
                          <div key={t._id} className="flex items-center justify-between px-2 py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="text-[10px]">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{t.strategyName}</span>
                              <span className="text-gray-400 ml-1">{t.underlying}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono-nums text-[10px] font-semibold ${(t.exitPnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatINRCompact(t.exitPnl ?? 0)}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); onRemoveTrade(p._id, t._id); }}
                                className="text-gray-300 hover:text-red-400 transition-colors"
                                title="Remove from portfolio"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Delete portfolio */}
                <div className="flex justify-end pt-0.5">
                  <button
                    onClick={() => { if (window.confirm(`Delete portfolio "${p.name}"? Trades will remain.`)) onDeletePortfolio(p._id); }}
                    className="text-[10px] px-2 py-0.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete Portfolio
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
