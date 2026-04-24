'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * NumberCountUp — smoothly animates a number from 0 (or fromValue) to `value`
 * on mount. Uses requestAnimationFrame with ease-out-quart for a premium feel.
 * Respects `tabular-nums` so digits don't jitter.
 */
interface NumberCountUpProps {
  value: number;
  duration?: number;       // ms
  delayMs?: number;        // start delay — good for staggered reveals
  decimals?: number;
  prefix?: string;
  suffix?: string;
  fromValue?: number;
  instant?: boolean;       // skip animation
  className?: string;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export default function NumberCountUp({
  value,
  duration = 600,
  delayMs = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  fromValue = 0,
  instant = false,
  className = '',
}: NumberCountUpProps) {
  const [display, setDisplay] = useState(instant ? value : fromValue);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (instant) {
      setDisplay(value);
      return;
    }

    const start = () => {
      startTimeRef.current = null;
      const from = display;
      const to = value;
      const delta = to - from;
      if (Math.abs(delta) < 0.001) {
        setDisplay(to);
        return;
      }

      const tick = (ts: number) => {
        if (startTimeRef.current == null) startTimeRef.current = ts;
        const elapsed = ts - startTimeRef.current;
        const t = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(t);
        setDisplay(from + delta * eased);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplay(to);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (delayMs > 0) {
      delayTimerRef.current = setTimeout(start, delayMs);
    } else {
      start();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, delayMs, instant]);

  const formatted = display.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
