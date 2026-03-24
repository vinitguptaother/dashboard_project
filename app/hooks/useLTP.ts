'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type UseLTPOptions = { symbols: string[]; pollMs?: number };

type LTPData = {
  lastPrice: number;
  instrumentToken?: string;
  volume?: number;
  ltq?: number;
  cp?: number;
};

type PricesBySymbol = Record<string, number>;
type LTPDataBySymbol = Record<string, LTPData>;

// Hook sends simple symbols directly to API
// The API handles the mapping to instrument keys internally


export function useLTP(opts: UseLTPOptions) {
  const { symbols, pollMs = 5000 } = opts || { symbols: [] }; // Changed from 1500ms to 5000ms (5 seconds)

  const [prices, setPrices] = useState<PricesBySymbol>({});
  const [ltpData, setLtpData] = useState<LTPDataBySymbol>({});
  const [previousPrices, setPreviousPrices] = useState<PricesBySymbol>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);

  // Debounce symbols by 250ms to avoid rapid fetch churn
  const debouncedSymbols = useDebouncedArray(symbols, 250);
  

  // Track last instrument key string to avoid redundant requests
  const lastKeyStringRef = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send the simple symbols directly to API
  // The API will handle the mapping internally
  const symbolParam = useMemo(() => {
    return debouncedSymbols.join(',');
  }, [debouncedSymbols]);

  useEffect(() => {
    // If symbol set hasn't changed, keep current polling
    if (symbolParam === lastKeyStringRef.current) {
      return;
    }

    // Stop previous polling
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    lastKeyStringRef.current = symbolParam;
    if (!symbolParam) {
      return;
    }

    // Define fetcher
    const fetchOnce = async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        setLoading((prev) => Object.keys(prices).length === 0 || prev);
        setError(undefined);
        const url = `/api/ltp?instruments=${encodeURIComponent(symbolParam)}`;
        console.log('useLTP: Calling URL:', url);
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        console.log('useLTP full response:', json);
        
        // Handle nested response structure from backend
        // Response format: { status, data: { status, data: { NIFTY: {...} } } }
        let data = json?.data || {};
        
        // If data has nested status/data (from backend proxy), unwrap it
        if (data.status === 'success' && data.data) {
          console.log('Unwrapping nested backend response');
          data = data.data;
        }
        
        console.log('Final unwrapped data:', data);

        // Build new prices and LTP data mapped to original symbols
        const nextPrices: PricesBySymbol = { ...prices };
        const nextLtpData: LTPDataBySymbol = { ...ltpData };
        const nextPreviousPrices: PricesBySymbol = { ...previousPrices };
        
        // Debug: Check what data keys we received
        console.log('useLTP received data keys:', Object.keys(data));
        console.log('useLTP received data sample:', data);
        
        // Process data directly since API returns data keyed by original symbols
        for (const symbol of Object.keys(data)) {
          const instrumentData = data[symbol];
          
          console.log('Processing data for symbol:', { symbol, instrumentData });
          
          if (instrumentData && typeof instrumentData.lastPrice === 'number') {
            // Store previous price before updating
            if (nextPrices[symbol]) {
              nextPreviousPrices[symbol] = nextPrices[symbol];
            }
            
            // Update current price and full data
            nextPrices[symbol] = instrumentData.lastPrice;
            nextLtpData[symbol] = {
              lastPrice: instrumentData.lastPrice,
              instrumentToken: instrumentData.instrumentToken,
              volume: instrumentData.volume,
              ltq: instrumentData.ltq,
              cp: instrumentData.cp
            };
          }
        }
        
        setPreviousPrices(nextPreviousPrices);
        setPrices(nextPrices);
        setLtpData(nextLtpData);
        setLastUpdated(new Date());
        setLoading(false);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err?.message || 'Failed to fetch LTP');
        setLoading(false);
      } finally {
        // Do not keep stale controller
        abortRef.current = null;
      }
    };

    // Initial fetch
    fetchOnce();
    // Polling
    timerRef.current = setInterval(fetchOnce, Math.max(500, pollMs));

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolParam, pollMs]);

  return { prices, ltpData, previousPrices, loading, error, lastUpdated } as const;
}

function useDebouncedArray<T>(arr: T[], delayMs: number): T[] {
  const [state, setState] = useState<T[]>(arr);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setState(arr), Math.max(0, delayMs));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [arr, delayMs]);

  return state;
}

/*
Example usage:

const { prices, loading, lastUpdated } = useLTP({ symbols: ['NIFTY','SENSEX','BANKNIFTY','RELIANCE','INFOSYS'] });
*/


