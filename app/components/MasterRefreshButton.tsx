'use client';

/**
 * MasterRefreshButton — floating action button that runs EVERY data refresh
 * (and optionally every AI agent) in one click.
 *
 * Modes:
 *   quick — data-only, ~20-40s, ~₹0
 *   full  — quick + AI agents, ~90-180s, ~₹30-80
 *
 * Interactions:
 *   - Left click       → quick refresh
 *   - Right click      → opens mode menu (Quick / Full)
 *   - Long-press       → opens mode menu
 *   - Keyboard 'R'     → quick refresh (when not in input)
 *   - Keyboard Shift+R → full refresh
 *
 * Progress modal: live step-by-step status with icons, cost, and finish time.
 * Placement: fixed bottom-right, above existing FABs (AI Chatbot, StickyNotes).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Zap, Sparkles, X, AlertCircle, ChevronRight, Clock } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

type Mode = 'quick' | 'full';
type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
type RunStatus = 'running' | 'success' | 'partial' | 'failure';

interface Step {
  key: string;
  label: string;
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  details: string;
  error: string | null;
  costUSD: number;
}

interface RunSnapshot {
  jobId: string;
  mode: Mode;
  status: RunStatus;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number;
  steps: Step[];
  summary?: string;
  costUSD?: number;
  results?: Record<string, unknown>;
}

interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  code?: string;
  remainingMs?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function stepIcon(status: StepStatus) {
  switch (status) {
    case 'done':    return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    case 'failed':  return <XCircle className="h-4 w-4 text-rose-500 shrink-0" />;
    case 'running': return <Loader2 className="h-4 w-4 text-sky-500 animate-spin shrink-0" />;
    case 'skipped': return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
    default:        return <Clock className="h-4 w-4 text-slate-400 shrink-0" />;
  }
}

function fmtDuration(ms?: number): string {
  if (!ms || ms < 0) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  if (diff < 0) return 'just now';
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function costInr(usd: number): string {
  // Rough INR conversion (~83 INR/USD) — display only
  const inr = usd * 83;
  if (inr < 1) return '~₹0';
  return `~₹${inr.toFixed(0)}`;
}

export default function MasterRefreshButton() {
  const [hover, setHover] = useState(false);
  const [running, setRunning] = useState(false);
  const [showJustDone, setShowJustDone] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastRunStatus, setLastRunStatus] = useState<RunStatus | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Poll "latest" on mount + every 30s for status indicator ──────────────
  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/master-refresh/latest`);
      const json: ApiResponse<RunSnapshot> = await res.json();
      if (json.status === 'success' && json.data) {
        setLastRunAt(json.data.startedAt);
        setLastRunStatus(json.data.status);
      }
    } catch {
      /* quiet */
    }
  }, []);

  useEffect(() => {
    fetchLatest();
    const id = setInterval(fetchLatest, 30_000);
    return () => clearInterval(id);
  }, [fetchLatest]);

  // ── Poll status while a job is running ───────────────────────────────────
  const startPolling = useCallback((jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/master-refresh/status/${jobId}`);
        const json: ApiResponse<RunSnapshot> = await res.json();
        if (json.status === 'success' && json.data) {
          setSnapshot(json.data);
          if (json.data.status !== 'running') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setRunning(false);
            setShowJustDone(true);
            setLastRunAt(json.data.startedAt);
            setLastRunStatus(json.data.status);
            setTimeout(() => setShowJustDone(false), 2500);
            if (json.data.status === 'success' || json.data.status === 'partial') {
              const changes = countChanges(json.data);
              setSuccessToast(`All refreshed · ${changes} action${changes === 1 ? '' : 's'} available`);
              setTimeout(() => setSuccessToast(null), 5000);
            }
          }
        }
      } catch {
        /* transient — keep polling */
      }
    }, 1200);
  }, []);

  useEffect(() => () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
  }, []);

  // ── Trigger a run ────────────────────────────────────────────────────────
  const triggerRun = useCallback(async (mode: Mode) => {
    if (running) return;
    setErrorMessage(null);
    setRunning(true);
    setSnapshot(null);
    setModalOpen(true);
    setMenuOpen(false);

    try {
      const res = await fetch(`${BACKEND_URL}/api/master-refresh/run?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json: ApiResponse<RunSnapshot> = await res.json();

      if (res.status === 429 && json.code === 'COOLDOWN') {
        const secs = Math.ceil((json.remainingMs || 0) / 1000);
        setErrorMessage(`Cooldown — try again in ${secs}s`);
        setRunning(false);
        return;
      }
      if (res.status === 402 && json.code === 'COST_CAP') {
        setErrorMessage(json.message || 'Cost cap exceeded');
        setRunning(false);
        return;
      }
      if (json.status !== 'success' || !json.data) {
        setErrorMessage(json.message || 'Failed to start refresh');
        setRunning(false);
        return;
      }

      if (mode === 'quick') {
        // Sync response — full result in json.data
        setSnapshot(json.data);
        setLastRunAt(json.data.startedAt);
        setLastRunStatus(json.data.status);
        setRunning(false);
        setShowJustDone(true);
        setTimeout(() => setShowJustDone(false), 2500);
        const changes = countChanges(json.data);
        setSuccessToast(`All refreshed · ${changes} action${changes === 1 ? '' : 's'} available`);
        setTimeout(() => setSuccessToast(null), 5000);
      } else {
        // Full mode — async; data.jobId provided, poll for progress
        const jobId = (json.data as { jobId?: string }).jobId;
        if (!jobId) {
          setErrorMessage('No jobId returned — refresh may not have started');
          setRunning(false);
          return;
        }
        setSnapshot({
          jobId,
          mode: 'full',
          status: 'running',
          startedAt: new Date().toISOString(),
          steps: [],
        });
        startPolling(jobId);
      }
    } catch (err) {
      setErrorMessage((err as Error).message || 'Network error');
      setRunning(false);
    }
  }, [running, startPolling]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        triggerRun(e.shiftKey ? 'full' : 'quick');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerRun]);

  // ── Click / long-press / right-click handlers ────────────────────────────
  const handleClick = () => {
    if (running) { setModalOpen(true); return; }
    triggerRun('quick');
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (running) return;
    setMenuOpen(v => !v);
  };

  const handlePressStart = () => {
    if (running) return;
    longPressRef.current = setTimeout(() => setMenuOpen(true), 500);
  };
  const handlePressEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  // ── Button state classes ─────────────────────────────────────────────────
  const baseClass = 'fixed bottom-6 right-[7.5rem] z-[6000] h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-300/40';
  const gradientIdle = 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400';
  const gradientRunning = 'bg-gradient-to-br from-sky-500 to-indigo-600';
  const gradientDone = 'bg-gradient-to-br from-emerald-500 to-teal-500';

  let buttonClass = `${baseClass} ${gradientIdle}`;
  if (running) buttonClass = `${baseClass} ${gradientRunning}`;
  else if (showJustDone) buttonClass = `${baseClass} ${gradientDone}`;
  if (hover && !running && !showJustDone) buttonClass += ' scale-110 shadow-[0_0_30px_rgba(99,102,241,0.6)]';

  const tooltipText = running
    ? (snapshot?.steps?.find(s => s.status === 'running')?.label || 'Refreshing…')
    : 'Refresh everything (R)  ·  right-click for mode';

  const statusDotColor =
    lastRunStatus === 'success' ? 'bg-emerald-500'
    : lastRunStatus === 'partial' ? 'bg-amber-500'
    : lastRunStatus === 'failure' ? 'bg-rose-500'
    : lastRunStatus === 'running' ? 'bg-sky-500'
    : 'bg-slate-400';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating button */}
      <div className="group">
        <button
          type="button"
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => { setHover(false); handlePressEnd(); }}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          className={buttonClass}
          aria-label="Master Refresh"
          title={tooltipText}
        >
          {running ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : showJustDone ? (
            <CheckCircle2 className="h-7 w-7" />
          ) : (
            <RefreshCw className="h-6 w-6" />
          )}
          {/* Status dot — last-run health */}
          <span
            className={`absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${statusDotColor}`}
            aria-hidden="true"
          />
        </button>

        {/* Hover tooltip (non-native, doesn't block right-click) */}
        {hover && !menuOpen && !running && (
          <div className="fixed bottom-[5.5rem] right-[6.5rem] z-[6001] pointer-events-none bg-slate-900/95 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
            <div className="font-semibold">Refresh everything</div>
            <div className="text-[10px] text-slate-300">
              Last: {fmtRelative(lastRunAt)} · <kbd className="px-1 bg-slate-700 rounded">R</kbd> quick · <kbd className="px-1 bg-slate-700 rounded">Shift+R</kbd> full
            </div>
          </div>
        )}

        {/* Mode menu */}
        {menuOpen && !running && (
          <div className="fixed bottom-[5.5rem] right-[7rem] z-[6001] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-56 overflow-hidden">
            <button
              onClick={() => triggerRun('quick')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
            >
              <Zap className="h-5 w-5 text-indigo-500" />
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Quick refresh</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">20-40s · ~₹0</div>
              </div>
            </button>
            <button
              onClick={() => triggerRun('full')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-t border-slate-100 dark:border-slate-800"
            >
              <Sparkles className="h-5 w-5 text-amber-500" />
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Full refresh (with AI)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">90-180s · ~₹30-80</div>
              </div>
            </button>
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Progress modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[6500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { if (!running) setModalOpen(false); }}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {running ? <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" /> : (snapshot?.status === 'failure' ? <XCircle className="h-5 w-5 text-rose-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />)}
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Master Refresh {snapshot?.mode ? `(${snapshot.mode})` : ''}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {running
                      ? `Running… ${snapshot?.steps?.filter(s => s.status === 'done' || s.status === 'failed' || s.status === 'skipped').length || 0} of ${snapshot?.steps?.length || '…'}`
                      : snapshot?.completedAt
                        ? `Done in ${fmtDuration(snapshot.durationMs)} · ${snapshot.status.toUpperCase()}`
                        : 'Waiting for status…'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                disabled={running}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Body: steps list */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {errorMessage && (
                <div className="mb-3 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMessage}
                </div>
              )}
              {snapshot?.steps && snapshot.steps.length > 0 ? (
                <ul className="space-y-1.5">
                  {snapshot.steps.map(step => (
                    <li
                      key={step.key}
                      className={`flex items-start gap-3 px-3 py-2 rounded-lg text-sm ${
                        step.status === 'running' ? 'bg-sky-50 dark:bg-sky-900/20'
                        : step.status === 'failed' ? 'bg-rose-50 dark:bg-rose-900/20'
                        : 'bg-slate-50 dark:bg-slate-800/50'
                      }`}
                    >
                      <div className="mt-0.5">{stepIcon(step.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{step.label}</div>
                        {step.details && step.status !== 'pending' && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{step.details}</div>
                        )}
                        {step.error && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 truncate">{step.error}</div>
                        )}
                      </div>
                      {step.durationMs > 0 && step.status !== 'pending' && step.status !== 'running' && (
                        <div className="text-[10px] text-slate-400 tabular-nums shrink-0 mt-1">{fmtDuration(step.durationMs)}</div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-sm text-slate-500 py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Initialising…
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                <span>Cost: <span className="font-semibold">{costInr(snapshot?.costUSD || 0)}</span></span>
                {snapshot?.summary && (
                  <span className="truncate max-w-[16rem] hidden sm:inline">{snapshot.summary}</span>
                )}
              </div>
              {!running && (
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {successToast && !modalOpen && (
        <div className="fixed bottom-24 right-6 z-[6200] bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-2 max-w-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium flex-1">{successToast}</div>
          <button onClick={() => setModalOpen(true)} className="text-xs font-semibold underline whitespace-nowrap flex items-center gap-1">
            View <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Helpers (counting action items to surface) ────────────────────────────
function countChanges(snap: RunSnapshot): number {
  if (!snap?.steps) return 0;
  return snap.steps.filter(s => s.status === 'done' || s.status === 'running').length;
}
