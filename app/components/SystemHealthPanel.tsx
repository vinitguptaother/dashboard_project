'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw,
  Play, Zap, Activity as ActivityIcon, Archive, FileText, Shield
} from 'lucide-react';
import { AuthClient } from '../lib/apiService';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

type CheckStatus = 'passed' | 'failed' | 'skipped';
interface CheckResult {
  status: CheckStatus;
  reason?: string | null;
  details?: any;
}
interface LastRun {
  overall: 'green' | 'amber' | 'red';
  mode: 'full' | 'quick' | 'smoke';
  startedAt: string;
  finishedAt: string;
  elapsedSeconds: number;
  checks: Record<string, CheckResult>;
  gitCommit?: string;
  gitBranch?: string;
}
interface LastBackup {
  mode: string;
  status: 'ok' | 'failed' | 'aborted';
  trusted: boolean;
  reason?: string;
  backupPath?: string;
  blueprintPath?: string;
  snapshotOk?: boolean;
  blueprintOk?: boolean;
  finishedAt: string;
  gitCommit?: string;
  gitBranch?: string;
}
interface HistoryEntry {
  overall: 'green' | 'amber' | 'red';
  mode: string;
  finishedAt: string;
  elapsedSeconds: number;
  checks: Record<string, { status: CheckStatus; reason?: string | null }>;
  gitCommit?: string;
}
interface StatusResponse {
  running: { kind: string; mode: string; startedAt: string; elapsedSeconds: number } | null;
  lastRun: LastRun | null;
  lastBackup: LastBackup | null;
  history: HistoryEntry[];
  blueprint: { path: string; lastModified: string; sizeBytes: number } | null;
  pipelineFiles: { lastRun: boolean; lastBackup: boolean; history: boolean };
  serverTime: string;
}

const CHECK_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  lint: 'ESLint',
  build: 'Next.js Build',
  backendSyntax: 'Backend Syntax',
  smokeTests: 'Smoke Tests',
};

function timeAgo(iso: string | undefined): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

function StatusBadge({ level }: { level: 'green' | 'amber' | 'red' | 'unknown' }) {
  const style =
    level === 'green' ? 'bg-green-100 text-green-800 border-green-300' :
    level === 'amber' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
    level === 'red' ? 'bg-red-100 text-red-800 border-red-300' :
    'bg-gray-100 text-gray-700 border-gray-300';
  const Icon =
    level === 'green' ? CheckCircle :
    level === 'amber' ? AlertTriangle :
    level === 'red' ? XCircle :
    Clock;
  const label =
    level === 'green' ? 'GREEN' :
    level === 'amber' ? 'AMBER' :
    level === 'red' ? 'RED' :
    'UNKNOWN';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-semibold ${style}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function CheckRow({ name, result }: { name: string; result?: CheckResult }) {
  const status = result?.status ?? 'skipped';
  const style =
    status === 'passed' ? 'text-green-700' :
    status === 'failed' ? 'text-red-700' :
    'text-gray-500';
  const Icon =
    status === 'passed' ? CheckCircle :
    status === 'failed' ? XCircle :
    Clock;
  return (
    <div className="flex items-start justify-between py-2 px-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 ${style}`} />
        <div>
          <div className="text-sm font-medium text-gray-900">{CHECK_LABELS[name] || name}</div>
          {result?.reason && (
            <div className="text-xs text-gray-500 mt-0.5">{result.reason}</div>
          )}
        </div>
      </div>
      <span className={`text-xs font-semibold uppercase ${style}`}>{status}</span>
    </div>
  );
}

export default function SystemHealthPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/system-health/status`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setStatus(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Adaptive polling: 3s when running, 30s when idle
  useEffect(() => {
    const running = !!status?.running;
    const interval = running ? 3000 : 30000;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchStatus, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status?.running, fetchStatus]);

  const trigger = async (endpoint: string, body: any) => {
    setTriggerError(null);
    setTriggerMessage(null);
    try {
      if (!AuthClient.token) {
        setTriggerError('You must be logged in to trigger runs. Use the Profile tab to log in.');
        return;
      }
      const resp = await fetch(`${BACKEND_URL}/api/system-health/${endpoint}`, {
        method: 'POST',
        headers: AuthClient.authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await resp.json();
      if (!resp.ok) {
        setTriggerError(json.reason || json.error || json.message || `HTTP ${resp.status}`);
        return;
      }
      setTriggerMessage(`Started: ${json.kind}${json.mode ? ' (' + json.mode + ')' : ''}`);
      setTimeout(() => setTriggerMessage(null), 5000);
      // Immediately refresh; polling will pick up progress
      fetchStatus();
    } catch (err: any) {
      setTriggerError(err.message || 'Request failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
        <div className="text-gray-500 text-sm">Loading status…</div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">
          Could not load pipeline status: {error}. Is the backend running?
        </div>
      </div>
    );
  }

  const lastRun = status?.lastRun;
  const lastBackup = status?.lastBackup;
  const blueprint = status?.blueprint;
  const running = status?.running;

  const overall: 'green' | 'amber' | 'red' | 'unknown' = lastRun?.overall ?? 'unknown';
  const backupTrusted = lastBackup?.trusted === true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
        <button
          onClick={fetchStatus}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Running banner */}
      {running && (
        <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg flex items-center gap-2 text-sm text-blue-800">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>
            <strong>{running.kind}</strong> ({running.mode}) is running… elapsed {running.elapsedSeconds}s
          </span>
        </div>
      )}

      {/* Trigger messages */}
      {triggerError && (
        <div className="p-3 border border-red-200 bg-red-50 rounded-lg text-sm text-red-700">{triggerError}</div>
      )}
      {triggerMessage && (
        <div className="p-3 border border-green-200 bg-green-50 rounded-lg text-sm text-green-700">{triggerMessage}</div>
      )}

      {/* Overall status card */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500 mb-1">Overall pipeline</div>
            <StatusBadge level={overall} />
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Last run</div>
            <div className="text-sm font-medium text-gray-900">{timeAgo(lastRun?.finishedAt)}</div>
            {lastRun && (
              <div className="text-xs text-gray-400 mt-0.5">
                {lastRun.mode} · {lastRun.elapsedSeconds}s · {lastRun.gitCommit || '—'}
              </div>
            )}
          </div>
        </div>

        {/* Per-check table */}
        <div className="mt-4 border border-gray-200 rounded-md bg-gray-50">
          {['typescript', 'lint', 'build', 'backendSyntax', 'smokeTests'].map(name => (
            <CheckRow key={name} name={name} result={lastRun?.checks?.[name]} />
          ))}
        </div>
      </div>

      {/* Backup card */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-gray-600" />
            <h4 className="font-semibold text-gray-900">Last-known-good backup</h4>
          </div>
          {lastBackup ? (
            backupTrusted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-green-100 text-green-800 border border-green-300">
                <Shield className="h-3 w-3" /> TRUSTED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300">
                <AlertTriangle className="h-3 w-3" /> NOT TRUSTED
              </span>
            )
          ) : (
            <span className="text-xs text-gray-400">no backup yet</span>
          )}
        </div>
        {lastBackup && (
          <div className="mt-3 text-sm text-gray-700 space-y-1">
            <div><span className="text-gray-500">Location:</span> <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{lastBackup.backupPath || '—'}</code></div>
            <div><span className="text-gray-500">Taken:</span> {timeAgo(lastBackup.finishedAt)} · commit {lastBackup.gitCommit || '—'} ({lastBackup.gitBranch || '—'})</div>
            <div><span className="text-gray-500">Mode:</span> {lastBackup.mode} · snapshot {lastBackup.snapshotOk ? 'ok' : 'failed'} · blueprint {lastBackup.blueprintOk ? 'ok' : 'failed'}</div>
            {!backupTrusted && lastBackup.reason && (
              <div className="text-yellow-700 mt-1">{lastBackup.reason}</div>
            )}
          </div>
        )}
      </div>

      {/* Blueprint card */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-600" />
            <h4 className="font-semibold text-gray-900">Living blueprint</h4>
          </div>
          <span className="text-xs text-gray-500">
            {blueprint ? `updated ${timeAgo(blueprint.lastModified)}` : 'not generated yet'}
          </span>
        </div>
        {blueprint && (
          <div className="mt-2 text-xs text-gray-500">
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">{blueprint.path}</code>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-4 border border-gray-200 rounded-lg bg-white">
        <h4 className="font-semibold text-gray-900 mb-3">Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => trigger('run', { mode: 'full' })}
            disabled={!!running}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Play className="h-3.5 w-3.5" /> Run Full Validation
          </button>
          <button
            onClick={() => trigger('run', { mode: 'quick' })}
            disabled={!!running}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Zap className="h-3.5 w-3.5" /> Quick (skip build)
          </button>
          <button
            onClick={() => trigger('run', { mode: 'smoke' })}
            disabled={!!running}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <ActivityIcon className="h-3.5 w-3.5" /> Smoke Only
          </button>
          <button
            onClick={() => trigger('backup', null)}
            disabled={!!running}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Archive className="h-3.5 w-3.5" /> Run Backup
          </button>
          <button
            onClick={() => trigger('blueprint', null)}
            disabled={!!running}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <FileText className="h-3.5 w-3.5" /> Regenerate Blueprint
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-3">
          Backup is automatically gated by full validation — it runs all 5 checks and aborts unless every check passes with no skips.
          To bypass (not recommended), use <code className="bg-gray-100 px-1 rounded">npm run backup -- --force</code> in the terminal.
        </div>
      </div>

      {/* History */}
      {status?.history && status.history.length > 0 && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          <button
            onClick={() => setShowHistory(s => !s)}
            className="w-full flex items-center justify-between text-left"
          >
            <h4 className="font-semibold text-gray-900">Recent runs ({status.history.length})</h4>
            <span className="text-xs text-gray-500">{showHistory ? 'hide' : 'show'}</span>
          </button>
          {showHistory && (
            <table className="w-full mt-3 text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2">Status</th>
                  <th className="py-2">Mode</th>
                  <th className="py-2">Time</th>
                  <th className="py-2">Elapsed</th>
                  <th className="py-2">Commit</th>
                </tr>
              </thead>
              <tbody>
                {status.history.map((h, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2"><StatusBadge level={h.overall} /></td>
                    <td className="py-2 text-gray-700">{h.mode}</td>
                    <td className="py-2 text-gray-600">{timeAgo(h.finishedAt)}</td>
                    <td className="py-2 text-gray-600">{h.elapsedSeconds}s</td>
                    <td className="py-2 text-gray-500 font-mono text-xs">{h.gitCommit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* How to read this */}
      <details className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <summary className="text-sm font-medium text-gray-800 cursor-pointer">How to read this panel</summary>
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <p>
            <strong>GREEN</strong> — every check passed with no skips. A &quot;trusted&quot; backup can be taken from this state.
          </p>
          <p>
            <strong>AMBER</strong> — some checks were skipped (e.g. <code>--skip-build</code>). The code isn&apos;t broken, but coverage is partial — backup is <em>not</em> blessed as trusted from here.
          </p>
          <p>
            <strong>RED</strong> — a check failed. Fix the underlying issue before trusting anything from this state.
          </p>
          <p className="text-gray-500">
            Data is read from <code className="bg-gray-100 px-1 rounded">.pipeline/last-run.json</code>, <code className="bg-gray-100 px-1 rounded">.pipeline/last-backup.json</code>, and <code className="bg-gray-100 px-1 rounded">.pipeline/history.json</code>. These files are written by <code className="bg-gray-100 px-1 rounded">scripts/validate.js</code> and <code className="bg-gray-100 px-1 rounded">scripts/backup.js</code> — running them from the CLI updates this panel too.
          </p>
        </div>
      </details>
    </div>
  );
}
