'use client';

/**
 * useDailyLossBreaker — polls /api/risk/daily-pnl every 30s, exposes the
 * Daily Loss Circuit Breaker state + override action.
 *
 * BOT_BLUEPRINT item #15. Phase 1:
 *   - Backend auto-activates killSwitch when usedPct >= 100 (returns in same response)
 *   - This hook surfaces that state to the UI overlay
 *   - Override requires typed "UNLOCK" in the body of POST /kill-switch/override
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
const POLL_INTERVAL_MS = 30_000;

export interface DailyLossBreakerState {
  isLocked: boolean;
  totalPnL: number;           // today's realized P&L (₹)
  usedPct: number;            // % of daily limit consumed (0..100+)
  limit: number;              // daily loss limit (₹)
  capital: number;
  dailyLossLimitPct: number;  // the % rule (e.g. 5)
  msUntilReset: number;       // ms until midnight IST
  resetAtIST: string;         // ISO string
  autoTriggeredThisCall: boolean;
  loading: boolean;
  error: string | null;
}

export interface DailyLossBreakerActions {
  refresh: () => Promise<void>;
  override: (reason?: string) => Promise<{ success: boolean; message: string }>;
}

const INITIAL_STATE: DailyLossBreakerState = {
  isLocked: false,
  totalPnL: 0,
  usedPct: 0,
  limit: 0,
  capital: 0,
  dailyLossLimitPct: 0,
  msUntilReset: 0,
  resetAtIST: '',
  autoTriggeredThisCall: false,
  loading: true,
  error: null,
};

export function useDailyLossBreaker(): DailyLossBreakerState & DailyLossBreakerActions {
  const [state, setState] = useState<DailyLossBreakerState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  const fetchPnl = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/risk/daily-pnl`);
      const json = await res.json();
      if (!mountedRef.current) return;

      if (json.status === 'success' && json.data) {
        const d = json.data;
        setState(prev => ({
          ...prev,
          isLocked: !!d.killSwitchActive,
          totalPnL: d.totalPnL ?? 0,
          usedPct: d.usedPct ?? 0,
          limit: d.dailyLossLimit ?? 0,
          capital: d.capital ?? 0,
          dailyLossLimitPct: d.dailyLossLimitPct ?? 0,
          msUntilReset: d.msUntilReset ?? 0,
          resetAtIST: d.resetAtIST ?? '',
          autoTriggeredThisCall: !!d.autoTriggeredThisCall,
          loading: false,
          error: null,
        }));
      } else {
        setState(prev => ({ ...prev, loading: false, error: json.message || 'Unknown error' }));
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, loading: false, error: e.message || 'Network error' }));
    }
  }, []);

  const override = useCallback(async (reason?: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/risk/kill-switch/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'UNLOCK', reason: reason || '' }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchPnl(); // refresh state
        return { success: true, message: json.message || 'Override successful' };
      }
      return { success: false, message: json.message || 'Override failed' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error' };
    }
  }, [fetchPnl]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPnl();
    const iv = setInterval(fetchPnl, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(iv);
    };
  }, [fetchPnl]);

  return { ...state, refresh: fetchPnl, override };
}
