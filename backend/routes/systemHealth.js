/**
 * systemHealth.js — Dashboard-visible validation & health status
 *
 * Exposes:
 *   GET  /api/system-health/status    — read .pipeline JSON state (no auth, read-only)
 *   POST /api/system-health/run       — spawn validate.js { mode: "full"|"quick"|"smoke" }
 *   POST /api/system-health/backup    — spawn backup.js (full validation, never --force)
 *   POST /api/system-health/blueprint — spawn backup.js --blueprint-only
 *
 * Write routes are protected by the auth middleware. An in-memory lock prevents
 * two runs from stomping on each other.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const router = express.Router();
const { auth } = require('../middleware/auth');

// Project root (one level up from backend/)
const ROOT = path.resolve(__dirname, '..', '..');
const PIPELINE_DIR = path.join(ROOT, '.pipeline');
const LAST_RUN_PATH = path.join(PIPELINE_DIR, 'last-run.json');
const LAST_BACKUP_PATH = path.join(PIPELINE_DIR, 'last-backup.json');
const HISTORY_PATH = path.join(PIPELINE_DIR, 'history.json');
const BLUEPRINT_PATH = path.join(ROOT, 'docs', 'LIVING_BLUEPRINT.md');

// ─── Run lock (in-memory, single-process — fine for single-user dashboard) ───
let currentRun = null; // { kind: 'validate'|'backup'|'blueprint', mode, startedAt, pid }

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { _error: err.message };
  }
}

function statFile(filePath) {
  try {
    const s = fs.statSync(filePath);
    return { mtime: s.mtime.toISOString(), size: s.size };
  } catch {
    return null;
  }
}

// ─── GET /status — read-only, polled by the UI ──────────────────────────────
router.get('/status', (req, res) => {
  const lastRun = readJson(LAST_RUN_PATH);
  const lastBackup = readJson(LAST_BACKUP_PATH);
  const history = readJson(HISTORY_PATH) || [];
  const blueprintStat = statFile(BLUEPRINT_PATH);

  res.json({
    running: currentRun ? {
      kind: currentRun.kind,
      mode: currentRun.mode,
      startedAt: currentRun.startedAt,
      elapsedSeconds: Math.round((Date.now() - new Date(currentRun.startedAt).getTime()) / 1000),
    } : null,
    lastRun,
    lastBackup,
    history,
    blueprint: blueprintStat ? {
      path: 'docs/LIVING_BLUEPRINT.md',
      lastModified: blueprintStat.mtime,
      sizeBytes: blueprintStat.size,
    } : null,
    pipelineFiles: {
      lastRun: fs.existsSync(LAST_RUN_PATH),
      lastBackup: fs.existsSync(LAST_BACKUP_PATH),
      history: fs.existsSync(HISTORY_PATH),
    },
    serverTime: new Date().toISOString(),
  });
});

// ─── Helper: spawn a script and track it via currentRun ─────────────────────
function launchScript(kind, mode, scriptArgs) {
  if (currentRun) {
    return { started: false, reason: `A ${currentRun.kind} run is already in progress` };
  }

  const scriptPath = path.join(ROOT, 'scripts', kind === 'validate' ? 'validate.js' : 'backup.js');
  if (!fs.existsSync(scriptPath)) {
    return { started: false, reason: `Script not found: ${scriptPath}` };
  }

  const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
    detached: false,
  });

  currentRun = {
    kind,
    mode,
    startedAt: new Date().toISOString(),
    pid: child.pid,
    stdoutTail: [],
    stderrTail: [],
  };

  const keepTail = (buf, line) => {
    buf.push(line);
    if (buf.length > 100) buf.shift();
  };
  child.stdout.on('data', (d) => {
    d.toString().split('\n').forEach(l => { if (l.trim()) keepTail(currentRun.stdoutTail, l); });
  });
  child.stderr.on('data', (d) => {
    d.toString().split('\n').forEach(l => { if (l.trim()) keepTail(currentRun.stderrTail, l); });
  });
  child.on('exit', (code) => {
    currentRun = null;
  });
  child.on('error', (err) => {
    console.error(`[systemHealth] ${kind} spawn error:`, err.message);
    currentRun = null;
  });

  return { started: true, pid: child.pid };
}

// ─── POST /run — trigger validation ─────────────────────────────────────────
router.post('/run', auth, (req, res) => {
  const mode = (req.body && req.body.mode) || 'full';
  if (!['full', 'quick', 'smoke'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be one of: full, quick, smoke' });
  }
  const args =
    mode === 'full' ? [] :
    mode === 'quick' ? ['--skip-build'] :
    ['--smoke-only'];

  const result = launchScript('validate', mode, args);
  if (!result.started) return res.status(409).json(result);
  res.json({ started: true, kind: 'validate', mode, pid: result.pid });
});

// ─── POST /backup — trigger full-gated backup ───────────────────────────────
router.post('/backup', auth, (req, res) => {
  // UI can never pass --force. CLI-only safeguard.
  const result = launchScript('backup', 'full', []);
  if (!result.started) return res.status(409).json(result);
  res.json({ started: true, kind: 'backup', pid: result.pid });
});

// ─── POST /blueprint — regenerate living blueprint only ─────────────────────
router.post('/blueprint', auth, (req, res) => {
  const result = launchScript('blueprint', 'blueprint-only', ['--blueprint-only']);
  if (!result.started) return res.status(409).json(result);
  res.json({ started: true, kind: 'blueprint', pid: result.pid });
});

module.exports = router;
