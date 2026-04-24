'use client';

/**
 * TodayTab — the "what should I do right now" action center.
 *
 * Sprint 5 Phase 0 skeleton. Will be wired to:
 *   • Sentinel service (ActionItems) — in Phase 1
 *   • Chief Analyst briefing — in Phase 4
 *   • Bot suggestions awaiting approval — in Phase 1
 *   • Pattern Miner lessons — in Phase 4
 *
 * Design principle: big clear cards, priority colored, action buttons
 * right there. See MASTER_PLAN.md §6 for the suggestion-card standard.
 */

import { useEffect, useState } from 'react';
import {
  Sparkles, AlertTriangle, Clock, CheckCircle2, Bot, Target,
  TrendingUp, BookOpen, ArrowRight, RefreshCw,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

interface ActionItem {
  _id?: string;
  title: string;
  description: string;
  impact?: string;
  action?: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  source: 'sentinel' | 'chief-analyst' | 'trading-bot' | 'pattern-miner' | 'user-duty';
  deadline?: string;
  createdAt: string;
}

const PRIORITY_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  URGENT: { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-300 dark:border-red-700', icon: '🔴' },
  HIGH:   { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', icon: '🟡' },
  MEDIUM: { color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300 dark:border-green-700', icon: '🟢' },
  LOW:    { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', icon: '⚪' },
};

const SOURCE_META: Record<string, { label: string; icon: any }> = {
  'sentinel': { label: 'Sentinel', icon: AlertTriangle },
  'chief-analyst': { label: 'Chief Analyst', icon: Sparkles },
  'trading-bot': { label: 'Trading Bot', icon: Bot },
  'pattern-miner': { label: 'Pattern Miner', icon: TrendingUp },
  'user-duty': { label: 'Scheduled Task', icon: Clock },
};

function fmtAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const secs = Math.round((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return iso; }
}

export default function TodayTab() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const fetchItems = async () => {
    try {
      // Phase 0: endpoint doesn't exist yet — gracefully handle
      const res = await fetch(`${BACKEND_URL}/api/sentinel/action-items`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') setItems(json.data || []);
      }
    } catch (_) {
      // API doesn't exist yet (will be built in Phase 1)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    const iv = setInterval(fetchItems, 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const manualRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto space-y-4 px-4">
      {/* Greeting header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {greeting}, Vinit 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">{today}</p>
          </div>
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Chief Analyst briefing placeholder — will populate in Phase 4 */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                Chief Analyst
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <em className="text-gray-500">
                  Chief Analyst briefings debut in Phase 4. For now: check the Dashboard tab for current market state.
                </em>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action items */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-2">
          <Target className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Do these things now
          </h2>
          <span className="text-xs text-gray-500">ranked by priority</span>
        </div>

        {loading && items.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 text-center text-sm text-gray-500 border border-gray-200 dark:border-gray-800">
            Loading action items…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-800">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Nothing urgent right now
            </h3>
            <p className="text-sm text-gray-500">
              Sentinel will surface action items here as bots propose trades, duties come due, or risk states change.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              <em>Full Sentinel feed activates in Phase 1 (next week).</em>
            </p>
          </div>
        )}

        <div className="space-y-2">
          {items.map((item) => {
            const pMeta = PRIORITY_META[item.priority] || PRIORITY_META.LOW;
            const sMeta = SOURCE_META[item.source] || SOURCE_META.sentinel;
            const SourceIcon = sMeta.icon;
            return (
              <div
                key={item._id || item.title}
                className={`rounded-xl border-2 p-4 ${pMeta.bg} ${pMeta.border}`}
              >
                {/* Header line */}
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className={`font-bold uppercase tracking-wider ${pMeta.color}`}>
                    {pMeta.icon} {item.priority}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <SourceIcon className="w-3 h-3" />
                    {sMeta.label}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{fmtAgo(item.createdAt)}</span>
                  {item.deadline && (
                    <>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {item.deadline}
                      </span>
                    </>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {item.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {item.description}
                </p>

                {/* Impact */}
                {item.impact && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-black/20 rounded px-2 py-1.5 mb-2 border border-gray-200 dark:border-gray-700">
                    <strong>Impact:</strong> {item.impact}
                  </div>
                )}

                {/* Action */}
                {item.action && (
                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    <strong>Action:</strong> {item.action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Learn section placeholder */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-1">
              Learn something new today
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              Daily learning tips will appear here once Chief Analyst is live (Phase 4). For now, browse the Help tab to explore features.
            </p>
            <a href="#help" className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
              Open Help tab <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
