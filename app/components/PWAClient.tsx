'use client';

/**
 * PWAClient — Phase 6 MVP
 *
 * Two tiny responsibilities:
 *  1. Register /sw.js once on mount (non-blocking).
 *  2. Render a floating "You are offline" banner when navigator.onLine flips false.
 *
 * No caching, no offline mutations. This is a VERY minimal PWA shim so
 * the dashboard is "installable" from a phone browser.
 */

import { useEffect, useState } from 'react';

export default function PWAClient() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Initial state — defer to navigator because SSR has no window.
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker — fail quietly (HTTP localhost still works)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Optional: ping the SW to confirm it's alive.
          if (reg.active) {
            try { reg.active.postMessage({ type: 'PING' }); } catch {}
          }
        })
        .catch((err) => {
          // Service worker registration is best-effort — don't crash the app.
          // eslint-disable-next-line no-console
          console.warn('[PWAClient] SW registration failed:', err?.message || err);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[100] bg-red-600 text-white text-center py-2 px-3 text-sm font-medium shadow-lg"
    >
      <span aria-hidden="true">● </span>You are offline. Live market data is paused until connection returns.
    </div>
  );
}
