/**
 * sw.js — Minimal MVP service worker.
 *
 * Phase 6 scope: online/offline detection only. NO caching of sensitive data
 * (stock prices, holdings, API tokens) — everything stays live-fetched.
 *
 * Messages received from the page:
 *   { type: 'PING' }    -> responds with { type: 'PONG', installed: true }
 *   { type: 'VERSION' } -> responds with { type: 'VERSION', v: <sw-version> }
 */

const SW_VERSION = 'phase6-mvp-1';

self.addEventListener('install', (event) => {
  // Activate immediately so the first load is controlled.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch — no caching for MVP (market data must always be fresh).
self.addEventListener('fetch', (event) => {
  // Let the browser handle it directly.
  return;
});

// Simple message channel so the page can confirm registration.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'PING') {
    event.source?.postMessage({ type: 'PONG', installed: true, version: SW_VERSION });
  } else if (event.data.type === 'VERSION') {
    event.source?.postMessage({ type: 'VERSION', v: SW_VERSION });
  }
});
