'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useTickFlash — returns a CSS className ('tick-up' | 'tick-down' | '')
 * that flashes for 400ms when `value` changes. Used to visually highlight
 * price changes on live data (TradingView-style).
 *
 * First mount is flash-free — only subsequent changes trigger the flash.
 */
export function useTickFlash(value: number | null | undefined): string {
  const [cls, setCls] = useState<string>('');
  const prevRef = useRef<number | null | undefined>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev != null && value != null && value !== prev) {
      const direction = value > prev ? 'tick-up' : 'tick-down';
      setCls(direction);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCls(''), 400);
    }
    prevRef.current = value;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  return cls;
}
