'use client';

// app/components/ControlCenterTab.tsx
// Feature / Test Control Center — internal admin page showing build status,
// backups, recent commits, failing features, dead-code markers, and system info.

import { useEffect, useState, useCallback } from 'react';
import {
  Wrench,
  Package,
  GitCommit,
  Archive,
  AlertTriangle,
  RefreshCw,
  Cpu,
  FileWarning,
  CheckCircle2,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

interface BuildInfo {
  exists: boolean;
  buildId?: string;
  builtAt?: string;
  ageHours?: number;
  error?: string;
}

interface Backup {
  name: string;
  size: string;
  sizeBytes: number;
  createdAt: string | null;
  ageHours: number | null;
}

interface Commit {
  hash: string;
  date: string;
  subject: string;
  author: string;
}

interface Failure {
  module: string;
  action: string;
  count: number;
  lastMessage: string;
  lastAt: string | null;
}

interface System {
  node: string;
  platform: string;
  uptimeSec: number;
  memoryMB: number;
  cwd: string;
}

interface Summary {
  build: BuildInfo;
  backups: Backup[];
  commits: Commit[];
  uncommitted: { count: number; files: { status: string; path: string }[] };
  failures: Failure[];
  system: System;
  generatedAt: string;
}

interface DeadCode {
  total: number;
  byMarker: Record<string, number>;
  items: { file: string; line: number; marker: string; excerpt: string }[];
  scannedDirs: string[];
}

function fmtUptime(sec: number) {
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

function fmtAge(hours: number | null | undefined) {
  if (hours == null) return '—';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const d = Math.floor(hours / 24);
  return `${d}d ago`;
}

export default function ControlCenterTab() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [deadCode, setDeadCode] = useState<DeadCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDead, setLoadingDead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/control-center/summary`);
      const json = await res.json();
      if (json.status === 'success') setSummary(json.data);
      else setError(json.message || 'Failed to load control center');
    } catch (e: any) {
      setError(e?.message || 'Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeadCode = useCallback(async () => {
    setLoadingDead(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/control-center/dead-code`);
      const json = await res.json();
      if (json.status === 'success') setDeadCode(json.data);
    } catch {
      /* ignore */
    } finally {
      setLoadingDead(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Control Center</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Build status, backups, failing modules, recent commits, and dead-code audit.
            </p>
          </div>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* Top row: Build + System + Uncommitted */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Build */}
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Package className="w-3.5 h-3.5" /> Last Successful Build
              </div>
              {summary.build.exists ? (
                <div className="space-y-1 text-xs">
                  <div className="font-mono text-[11px] text-gray-600 dark:text-gray-300 truncate">
                    {summary.build.buildId}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Built</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {summary.build.builtAt ? new Date(summary.build.builtAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Age</span>
                    <span className={`${(summary.build.ageHours ?? 0) > 48 ? 'text-amber-400' : 'text-green-400'}`}>
                      {fmtAge(summary.build.ageHours)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-400">No build found — run <code className="text-[10px] bg-gray-100 dark:bg-gray-900 px-1 rounded">npm run build</code></div>
              )}
            </div>

            {/* System */}
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <Cpu className="w-3.5 h-3.5" /> System
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Node</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{summary.system.node}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform</span>
                  <span className="text-gray-700 dark:text-gray-300">{summary.system.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Uptime</span>
                  <span className="text-gray-700 dark:text-gray-300">{fmtUptime(summary.system.uptimeSec)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Memory</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{summary.system.memoryMB} MB</span>
                </div>
              </div>
            </div>

            {/* Uncommitted */}
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                <GitCommit className="w-3.5 h-3.5" /> Working Tree
              </div>
              {summary.uncommitted.count === 0 ? (
                <div className="inline-flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Clean — no uncommitted changes
                </div>
              ) : (
                <div>
                  <div className="text-xs text-amber-400 mb-1">
                    {summary.uncommitted.count} file{summary.uncommitted.count === 1 ? '' : 's'} uncommitted
                  </div>
                  <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                    {summary.uncommitted.files.slice(0, 8).map((f, i) => (
                      <li key={i} className="text-[11px] font-mono text-gray-500 truncate">
                        <span className="text-amber-500 mr-1">{f.status}</span>
                        {f.path}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Backups */}
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
              <Archive className="w-3.5 h-3.5" /> Last-Known-Good Backups
              <span className="ml-auto text-[10px] font-normal text-gray-400">
                {summary.backups.length} total
              </span>
            </div>
            {summary.backups.length === 0 ? (
              <div className="text-xs text-gray-400 italic">
                No backups yet. Create one with: <code className="text-[10px] bg-gray-100 dark:bg-gray-900 px-1 rounded">tar -czf .backups/src_$(date +%F).tar.gz app backend</code>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] text-gray-400 uppercase tracking-wide">
                      <th className="pb-1">File</th>
                      <th className="pb-1">Size</th>
                      <th className="pb-1">Created</th>
                      <th className="pb-1">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.backups.map((b) => (
                      <tr key={b.name} className="border-t border-gray-200/40 dark:border-gray-700/40">
                        <td className="py-1 font-mono text-[11px] text-gray-600 dark:text-gray-300">{b.name}</td>
                        <td className="py-1 text-gray-500">{b.size}</td>
                        <td className="py-1 text-gray-500 text-[11px]">
                          {b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="py-1 text-gray-500">{fmtAge(b.ageHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Failing modules */}
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Failing Features (last 6h)
              <span className="ml-auto text-[10px] font-normal text-gray-400">
                grouped by module
              </span>
            </div>
            {summary.failures.length === 0 ? (
              <div className="text-xs text-green-400">✓ No grouped failures in the last 6 hours.</div>
            ) : (
              <ul className="space-y-1.5">
                {summary.failures.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 p-2 rounded border border-red-500/20 bg-red-500/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        <span className="text-red-400">{f.module}</span>
                        <span className="text-gray-400"> :: {f.action}</span>
                      </div>
                      {f.lastMessage && (
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">{f.lastMessage}</div>
                      )}
                      {f.lastAt && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Last: {new Date(f.lastAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">
                      ×{f.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent commits */}
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
              <GitCommit className="w-3.5 h-3.5" /> Recent Changes
              <span className="ml-auto text-[10px] font-normal text-gray-400">
                last {summary.commits.length} commits
              </span>
            </div>
            {summary.commits.length === 0 ? (
              <div className="text-xs text-gray-400 italic">No commit history available.</div>
            ) : (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {summary.commits.map((c) => (
                  <li key={c.hash} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-[10px] text-blue-400 shrink-0 mt-0.5">{c.hash}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-gray-700 dark:text-gray-200 truncate">{c.subject}</div>
                      <div className="text-[10px] text-gray-400">
                        {c.author} • {new Date(c.date).toLocaleDateString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Dead-code audit */}
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                <FileWarning className="w-3.5 h-3.5" /> Dead-Code / TODO Audit
              </div>
              <button
                onClick={fetchDeadCode}
                disabled={loadingDead}
                className="text-[11px] px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {loadingDead ? 'Scanning…' : deadCode ? 'Rescan' : 'Run scan'}
              </button>
            </div>

            {!deadCode ? (
              <div className="text-xs text-gray-400 italic">
                Click &quot;Run scan&quot; to find TODO / FIXME / HACK / @deprecated markers across the codebase.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-2 text-[11px]">
                  <span className="text-gray-500">{deadCode.total} markers found:</span>
                  {Object.entries(deadCode.byMarker).map(([m, n]) => (
                    <span key={m} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">
                      {m}: {n}
                    </span>
                  ))}
                </div>
                <ul className="space-y-0.5 max-h-64 overflow-y-auto font-mono text-[11px]">
                  {deadCode.items.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-500">
                      <span className="text-amber-500 shrink-0 w-14 truncate">{h.marker}</span>
                      <span className="text-blue-400 shrink-0">
                        {h.file}:{h.line}
                      </span>
                      <span className="text-gray-500 truncate">{h.excerpt}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
