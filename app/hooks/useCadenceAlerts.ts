'use client';

/**
 * useCadenceAlerts — polls /api/cadence/summary + /missed for bell badge + toast.
 *
 * Per CLAUDE.md §Work Style rule #5: dashboard must be self-aware of its duties.
 * This hook powers the bell icon + missed-task toast.
 */

import { useCallback, useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 60_000; // 1 min — missed tasks don't change minute-by-minute

export interface CadenceMissedTask {
  _id: string;
  taskKey: string;
  name: string;
  description: string;
  type: 'system' | 'user';
  cadence: string;
  category: string;
  lastRunAt: string | null;
  expectedNextRun: string | null;
  missedCount: number;
  status: string;
}

export interface CadenceAlertsState {
  missedCount: number;        // total missed
  needsAttentionCount: number; // missed + stale
  missedTasks: CadenceMissedTask[];
  totalTasks: number;
  byStatus: Record<string, number>;
  loading: boolean;
  error: string | null;
}

export interface CadenceAlertsActions {
  refresh: () => Promise<void>;
  acknowledge: (taskKey: string) => Promise<boolean>;
}

const INITIAL: CadenceAlertsState = {
  missedCount: 0,
  needsAttentionCount: 0,
  missedTasks: [],
  totalTasks: 0,
  byStatus: {},
  loading: true,
  error: null,
};

export function useCadenceAlerts(): CadenceAlertsState & CadenceAlertsActions {
  const [state, setState] = useState<CadenceAlertsState>(INITIAL);

  const fetchAll = useCallback(async () => {
    try {
      const [summaryRes, missedRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/cadence/summary`),
        fetch(`${BACKEND_URL}/api/cadence/missed`),
      ]);
      const summary = await summaryRes.json();
      const missed = await missedRes.json();

      if (summary.status === 'success' && missed.status === 'success') {
        const s = summary.data;
        setState({
          missedCount: s.missedCount || 0,
          needsAttentionCount: s.needsAttentionCount || 0,
          missedTasks: missed.data || [],
          totalTasks: s.total || 0,
          byStatus: s.byStatus || {},
          loading: false,
          error: null,
        });
      } else {
        setState(prev => ({ ...prev, loading: false, error: 'Failed to load cadence' }));
      }
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e.message || 'Network error' }));
    }
  }, []);

  const acknowledge = useCallback(async (taskKey: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/cadence/acknowledge/${taskKey}`, { method: 'POST' });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchAll();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [fetchAll]);

  return { ...state, refresh: fetchAll, acknowledge };
}
