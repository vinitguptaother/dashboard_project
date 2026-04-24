'use client';

/**
 * TodayTopActionsPreview — top-3 suggestion cards on the Dashboard.
 *
 * MASTER_PLAN §6: the same suggestion card standard appears on the Dashboard
 * as a compact preview. Click "View all →" to jump to the full Today tab.
 *
 * Fetches /api/sentinel/action-items?limit=3. If there are zero items, shows
 * a small "All clear" banner — this both confirms the feed is healthy and
 * gives Vinit feedback that Sentinel is watching.
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ArrowRight, CheckCircle2, Bell } from 'lucide-react';
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
  priority: SuggestionPriority;
  source: SuggestionSource;
  createdAt: string;
  deadline?: string;

  symbol?: string;
  tradeAction?: 'BUY' | 'SELL' | 'ACCUMULATE';
  entryPrice?: number;
  stopLoss?: number;
  target?: number;
  confidence?: number;
  riskReward?: string;
}

interface TodayTopActionsPreviewProps {
  /** If provided, clicking "View all" switches to the Today tab in-place. */
  setActiveTab?: (tab: string) => void;
}

export default function TodayTopActionsPreview(
  props: TodayTopActionsPreviewProps,
): ReactElement | null {
  const { setActiveTab } = props;
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reachable, setReachable] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/sentinel/action-items?limit=3`,
      );
      if (res.ok) {
        const json = (await res.json()) as {
          status?: string;
          data?: ActionItem[];
        };
        if (json.status === 'success') {
          setItems((json.data || []).slice(0, 3));
          setReachable(true);
        }
      } else {
        setReachable(false);
      }
    } catch (_) {
      // API not yet available — hide the section entirely
      setReachable(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
    const iv = setInterval(() => {
      void fetchItems();
    }, 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchItems]);

  const goToToday = (): void => {
    if (setActiveTab) {
      setActiveTab('today');
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#today';
    }
  };

  // Don't render at all until we've heard back at least once, to avoid flash.
  if (!loaded) return null;

  // If the Sentinel API isn't reachable yet, stay quiet — the Dashboard has
  // plenty of other widgets and we don't want to show a permanent error.
  if (!reachable) return null;

  return (
    <div className="glass-effect rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Bell className="h-5 w-5 mr-2 text-indigo-600" />
          Today&apos;s top actions
          <span className="ml-2 text-xs font-normal text-gray-400">
            {items.length > 0
              ? `top ${items.length} of what needs doing`
              : 'all clear'}
          </span>
        </h3>
        <button
          type="button"
          onClick={goToToday}
          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          View all
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span>
            <strong className="text-green-700">All clear.</strong> No pending
            action items. Sentinel is watching.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <SuggestionCard
              key={item._id || item.title}
              id={item._id}
              compact
              title={item.title}
              description={item.description}
              symbol={item.symbol}
              action={item.tradeAction}
              entryPrice={item.entryPrice}
              stopLoss={item.stopLoss}
              target={item.target}
              confidence={item.confidence}
              riskReward={item.riskReward}
              priority={item.priority}
              source={item.source}
              createdAt={item.createdAt}
              deadline={item.deadline}
              onDetails={goToToday}
            />
          ))}
        </div>
      )}
    </div>
  );
}
