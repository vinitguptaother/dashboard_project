'use client';

import React, { useState } from 'react';
import { Zap, BarChart3, BookOpen, Layers } from 'lucide-react';
import { StrategyPreset, OptionsMockTrade, TradeStats } from './types';
import { STRATEGY_PRESETS } from './constants';
import { formatINRCompact } from './utils';

type TabId = 'ready-made' | 'positions' | 'saved' | 'drafts';

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
}

const TAB_CONFIG: { id: TabId; label: string; icon: any }[] = [
  { id: 'ready-made', label: 'Ready-made', icon: Zap },
  { id: 'positions', label: 'Positions', icon: BarChart3 },
  { id: 'saved', label: 'Saved', icon: BookOpen },
  { id: 'drafts', label: 'Drafts', icon: Layers },
];

const CATEGORY_LABELS: Record<string, string> = {
  neutral: 'Neutral',
  bullish: 'Bullish',
  bearish: 'Bearish',
  volatile: 'Volatile',
};

export default function BottomTabs({
  activeTab, onTabChange, onApplyPreset,
  trades, tradeStats, livePnL, onCloseTrade, onDeleteTrade, chainLoaded,
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
          />
        )}
        {activeTab === 'saved' && (
          <SavedContent trades={closedTrades} />
        )}
        {activeTab === 'drafts' && (
          <DraftsContent />
        )}
      </div>
    </div>
  );
}

// ─── Ready-made strategies ────────────────────────────────────────────────────

function ReadyMadeContent({ onApplyPreset, chainLoaded }: { onApplyPreset: (name: string) => void; chainLoaded: boolean }) {
  const grouped = STRATEGY_PRESETS.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {} as Record<string, StrategyPreset[]>);

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([category, presets]) => (
        <div key={category}>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1 px-1">
            {CATEGORY_LABELS[category] || category}
          </div>
          <div className="space-y-0.5">
            {presets.map(p => (
              <button
                key={p.name}
                onClick={() => onApplyPreset(p.name)}
                disabled={!chainLoaded}
                className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-40"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Open Positions ───────────────────────────────────────────────────────────

function PositionsContent({
  trades, livePnL, closingId, closePnl, setClosingId, setClosePnl, onCloseTrade, onDeleteTrade,
}: {
  trades: OptionsMockTrade[];
  livePnL: Record<string, { totalPnl: number }>;
  closingId: string | null;
  closePnl: string;
  setClosingId: (id: string | null) => void;
  setClosePnl: (v: string) => void;
  onCloseTrade: (id: string, exitPnl: number) => void;
  onDeleteTrade: (id: string) => void;
}) {
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
        return (
          <div key={t._id} className="p-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50">
            <div className="flex items-center justify-between mb-1">
              <div>
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{t.strategyName}</span>
                <span className="text-[10px] text-gray-400 ml-1.5">{t.underlying} · {t.expiry?.slice(5)}</span>
              </div>
              <span className={`font-mono-nums text-sm font-bold ${
                (pnl?.totalPnl || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {pnl ? formatINRCompact(pnl.totalPnl) : '₹0'}
              </span>
            </div>

            {/* Legs summary */}
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
              {t.legs.map((l, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  <span className={l.side === 'SELL' ? 'text-red-500' : 'text-green-500'}>{l.side[0]}</span>
                  {' '}{l.strike} {l.type} @{l.premium.toFixed(1)}
                </span>
              ))}
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
                <button
                  onClick={() => { onCloseTrade(t._id, parseFloat(closePnl) || 0); setClosingId(null); }}
                  className="text-xs px-2 py-1 bg-green-500 text-white rounded"
                >
                  Close
                </button>
                <button
                  onClick={() => setClosingId(null)}
                  className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setClosingId(t._id); setClosePnl(''); }}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                >
                  Exit
                </button>
                <button
                  onClick={() => onDeleteTrade(t._id)}
                  className="text-[10px] px-2 py-0.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
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

// ─── Drafts (placeholder for Phase 4) ─────────────────────────────────────────

function DraftsContent() {
  return (
    <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">
      <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
      Draft Portfolios coming soon
    </div>
  );
}
