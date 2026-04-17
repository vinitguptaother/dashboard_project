'use client';

/**
 * CadenceAlertsBell — floating bell icon (fixed bottom-left) showing missed-task count.
 *
 * Click → opens a dropdown panel listing missed tasks with Acknowledge buttons.
 * Also shows a one-shot toast on initial load if misses > 0.
 *
 * Kept separate from the main top navigation so it doesn't clutter nav real estate.
 * Same "always visible" pattern as StickyNotes / AIChatbot.
 */

import { useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCircle2, ChevronRight } from 'lucide-react';
import { useCadenceAlerts } from '../hooks/useCadenceAlerts';

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffHrs = Math.round((now - then) / 3600000);
  if (diffHrs < 1) return 'just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const d = Math.round(diffHrs / 24);
  return `${d}d ago`;
}

export default function CadenceAlertsBell() {
  const { missedCount, missedTasks, acknowledge, loading } = useCadenceAlerts();
  const [open, setOpen] = useState(false);
  const [toastShown, setToastShown] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One-shot toast on first load if there are missed tasks
  useEffect(() => {
    if (loading) return;
    if (!toastShown && missedCount > 0) {
      setShowToast(true);
      setToastShown(true);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 8000);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [loading, missedCount, toastShown]);

  if (loading) return null;

  const severity = missedCount === 0 ? 'quiet' : missedCount < 3 ? 'amber' : 'red';
  const bellColor = severity === 'red'
    ? 'bg-red-600 hover:bg-red-700'
    : severity === 'amber'
      ? 'bg-amber-500 hover:bg-amber-600'
      : 'bg-gray-400 dark:bg-gray-700 hover:bg-gray-500 dark:hover:bg-gray-600';

  return (
    <>
      {/* Toast (one-shot on load) */}
      {showToast && missedCount > 0 && (
        <div className="fixed top-[60px] right-4 z-[7000] bg-white dark:bg-gray-900 border-l-4 border-red-500 rounded-lg shadow-xl p-3 max-w-sm animate-in slide-in-from-top">
          <div className="flex items-start gap-2">
            <Bell className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {missedCount} scheduled task{missedCount === 1 ? '' : 's'} missed
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Click the bell to review.
              </div>
            </div>
            <button onClick={() => setShowToast(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="fixed bottom-24 left-4 z-[7000] w-96 max-h-[70vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                Missed tasks
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {missedCount === 0 ? 'All tasks on track ✓' : `${missedCount} task${missedCount === 1 ? '' : 's'} need${missedCount === 1 ? 's' : ''} attention`}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {missedCount === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-70" />
                Every scheduled duty is on track.
              </div>
            ) : (
              missedTasks.map(t => (
                <div
                  key={t._id}
                  className="rounded-md border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/20 p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {t.name}
                        <span className="ml-2 text-[9px] uppercase tracking-wider text-gray-400">
                          {t.type} · {t.cadence}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                        {t.description}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        Last ran: {relativeTime(t.lastRunAt)}
                        {t.missedCount > 1 && <span className="ml-2 text-red-500 font-semibold">· missed {t.missedCount}×</span>}
                      </div>
                    </div>
                    {t.type === 'user' && (
                      <button
                        onClick={() => acknowledge(t.taskKey)}
                        className="text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded px-2 py-1 shrink-0"
                        title="Mark as done (user-type task)"
                      >
                        Done
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              Cadence Registry — auto-monitored
            </span>
            <a
              href="#system-health"
              onClick={() => { setOpen(false); if (typeof window !== 'undefined') window.location.hash = 'system-health'; }}
              className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
            >
              Help <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Floating bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-4 left-4 z-[7000] w-12 h-12 rounded-full shadow-lg text-white flex items-center justify-center transition-colors ${bellColor}`}
        title={missedCount > 0 ? `${missedCount} missed task(s)` : 'Cadence: all on track'}
        aria-label="Cadence alerts"
      >
        <Bell className="w-5 h-5" />
        {missedCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 px-1">
            {missedCount > 99 ? '99+' : missedCount}
          </span>
        )}
      </button>
    </>
  );
}
