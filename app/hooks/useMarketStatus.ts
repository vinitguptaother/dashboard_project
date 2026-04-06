'use client';
import { useEffect, useState } from 'react';
import type { MarketState, Holiday } from '../lib/marketHours';
import { getMarketState } from '../lib/marketHours';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

// Module-level holiday cache — fetched once per page load, shared across hook callers.
let _holidays: Holiday[] | null = null;
let _fetchPromise: Promise<Holiday[]> | null = null;

async function fetchHolidaysOnce(): Promise<Holiday[]> {
  if (_holidays) return _holidays;
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/market-status/holidays`);
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data?.holidays)) {
        _holidays = json.data.holidays;
        return _holidays!;
      }
    } catch {
      // Backend unreachable — fall through to empty list
    }
    _holidays = [];
    return _holidays;
  })();
  return _fetchPromise;
}

/**
 * React hook returning the current market state. Recomputes every 30s locally
 * (no backend round-trip) once the holiday list is loaded.
 */
export function useMarketStatus(): MarketState | null {
  const [state, setState] = useState<MarketState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const holidays = await fetchHolidaysOnce();
      if (cancelled) return;
      const tick = () => setState(getMarketState(new Date(), holidays));
      tick();
      interval = setInterval(tick, 30000);
    })();

    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, []);

  return state;
}
