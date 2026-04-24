'use client';

/**
 * TodayTab — the "what should I do right now" action center.
 *
 * Phase 1 Track C: refactored to use the reusable <SuggestionCard> so every
 * suggestion the dashboard surfaces looks and feels identical across Today,
 * Dashboard top-3 preview, Paper Trading, Search, and bell notifications.
 *
 * Wires action items from /api/sentinel/action-items. The accept / dismiss /
 * resolve buttons call Sentinel routes; cards are optimistically removed on
 * click and restored if the API call fails.
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Target,
  BookOpen,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import SuggestionCard, {
  type SuggestionPriority,
  type SuggestionSource,
} from './SuggestionCard';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

interface ActionItem {
  _id?: string;
  title: string;
  description?: string;
  impact?: string;
  action?: string;
  priority: SuggestionPriority;
  source: SuggestionSource;
  deadline?: string;
  createdAt: string;

  // Optional trade-shaped fields (Sentinel may populate later)
  symbol?: string;
  tradeAction?: 'BUY' | 'SELL' | 'ACCUMULATE';
  entryPrice?: number;
  stopLoss?: number;
  target?: number;
  confidence?: number;
  riskReward?: string;
  why?: string;
  risks?: string[];
}

export default function TodayTab(): ReactElement {
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

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/sentinel/action-items`);
      if (res.ok) {
        const json = (await res.json()) as {
          status?: string;
          data?: ActionItem[];
        };
        if (json.status === 'success') setItems(json.data || []);
      }
    } catch (_) {
      // API may not exist yet in this environment — fail open
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
    const iv = setInterval(() => {
      void fetchItems();
    }, 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchItems]);

  const manualRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  /**
   * Optimistic remove + POST to the given Sentinel endpoint.
   * Restores the item if the backend rejects.
   */
  const callSentinelAction = useCallback(
    async (id: string | undefined, endpoint: 'acknowledge' | 'dismiss' | 'resolve') => {
      if (!id) return;
      const prev = items;
      setItems((s) => s.filter((it) => it._id !== id));
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/sentinel/action-items/${id}/${endpoint}`,
          { method: 'POST' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        // Roll back on failure
        setItems(prev);
        // eslint-disable-next-line no-console
        console.warn(`Sentinel ${endpoint} failed:`, err);
      }
    },
    [items],
  );

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4 px-4">
      {/* Greeting header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {greeting}, Vinit
            </h1>
            <p className="text-sm text-gray-500 mt-1">{today}</p>
          </div>
          <button
            type="button"
            onClick={() => void manualRefresh()}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Chief Analyst briefing placeholder — populates in Phase 4 */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                Chief Analyst
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <em className="text-gray-500">
                  Chief Analyst briefings debut in Phase 4. For now: check the
                  Dashboard tab for current market state.
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
              All clear — nothing urgent right now
            </h3>
            <p className="text-sm text-gray-500">
              Sentinel will surface action items here as bots propose trades,
              duties come due, or risk states change.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              <em>Full Sentinel feed activates in Phase 1.</em>
            </p>
          </div>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <SuggestionCard
              key={item._id || item.title}
              id={item._id}
              title={item.title}
              description={item.description}
              symbol={item.symbol}
              action={item.tradeAction}
              entryPrice={item.entryPrice}
              stopLoss={item.stopLoss}
              target={item.target}
              confidence={item.confidence}
              riskReward={item.riskReward}
              why={item.why}
              risks={item.risks}
              impact={item.impact}
              priority={item.priority}
              source={item.source}
              createdAt={item.createdAt}
              deadline={item.deadline}
              onAccept={
                item._id
                  ? () => callSentinelAction(item._id, 'acknowledge')
                  : undefined
              }
              onReject={
                item._id
                  ? () => callSentinelAction(item._id, 'dismiss')
                  : undefined
              }
              onDismiss={
                item._id
                  ? () => callSentinelAction(item._id, 'resolve')
                  : undefined
              }
            />
          ))}
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
              Daily learning tips will appear here once Chief Analyst is live
              (Phase 4). For now, browse the Help tab to explore features.
            </p>
            <a
              href="#help"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Open Help tab <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
