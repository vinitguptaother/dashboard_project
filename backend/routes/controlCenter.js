// backend/routes/controlCenter.js
// Feature / Test Control Center — internal admin view that exposes:
//   • last successful build (Next.js BUILD_ID + mtime)
//   • last-known-good snapshots (src_*.tar.gz in .backups/)
//   • dead-code audit (TODO / FIXME / XXX / @deprecated hits)
//   • failing features (grouped errors from recent logs)
//   • recent changes (last N git commits)
//   • recent API errors count
// Read-only and side-effect free.

const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const { apiLogger } = require('../middleware/logger');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function promiseExec(cmd, opts = {}) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: PROJECT_ROOT, timeout: 10000, maxBuffer: 2 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

function safeStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── GET /api/control-center/summary ────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    // 1. Last successful build — .next/BUILD_ID mtime
    let build = { exists: false };
    const buildIdPath = path.join(PROJECT_ROOT, '.next', 'BUILD_ID');
    const buildStat = safeStat(buildIdPath);
    if (buildStat) {
      try {
        const id = fs.readFileSync(buildIdPath, 'utf8').trim();
        build = {
          exists: true,
          buildId: id,
          builtAt: buildStat.mtime.toISOString(),
          ageHours: Math.floor((Date.now() - buildStat.mtimeMs) / (1000 * 60 * 60)),
        };
      } catch {
        build = { exists: false, error: 'Could not read BUILD_ID' };
      }
    }

    // 2. Backups in .backups/
    let backups = [];
    const backupsDir = path.join(PROJECT_ROOT, '.backups');
    if (fs.existsSync(backupsDir)) {
      try {
        const files = fs.readdirSync(backupsDir)
          .filter((f) => f.endsWith('.tar.gz') || f.endsWith('.zip'))
          .map((f) => {
            const st = safeStat(path.join(backupsDir, f));
            return {
              name: f,
              size: st ? fmtBytes(st.size) : '—',
              sizeBytes: st ? st.size : 0,
              createdAt: st ? st.mtime.toISOString() : null,
              ageHours: st ? Math.floor((Date.now() - st.mtimeMs) / (1000 * 60 * 60)) : null,
            };
          })
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
          .slice(0, 10);
        backups = files;
      } catch { /* ignore */ }
    }

    // 3. Recent git commits (last 10)
    let commits = [];
    try {
      const r = await promiseExec('git log -n 10 --pretty=format:"%h|%ci|%s|%an"');
      if (r.ok) {
        commits = r.stdout.split('\n').filter(Boolean).map((line) => {
          const [hash, date, ...rest] = line.split('|');
          const subject = rest.slice(0, -1).join('|') || rest[0];
          const author = rest[rest.length - 1];
          return { hash, date, subject, author };
        });
      }
    } catch { /* ignore */ }

    // 4. Uncommitted changes (short status)
    let uncommitted = { count: 0, files: [] };
    try {
      const r = await promiseExec('git status --porcelain');
      if (r.ok && r.stdout) {
        const lines = r.stdout.split('\n').filter(Boolean);
        uncommitted = {
          count: lines.length,
          files: lines.slice(0, 20).map((l) => {
            const [status, ...rest] = l.trim().split(/\s+/);
            return { status, path: rest.join(' ') };
          }),
        };
      }
    } catch { /* ignore */ }

    // 5. Failing features — scan last 10 mins of error logs, group by module+action
    let failures = [];
    try {
      const logDir = path.join(__dirname, '..', 'logs');
      if (fs.existsSync(logDir)) {
        const files = fs.readdirSync(logDir)
          .filter((f) => /^error\d*\.log$/.test(f))
          .map((f) => ({ name: f, mtime: safeStat(path.join(logDir, f))?.mtimeMs || 0 }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 3);

        const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
        const groups = {};
        for (const f of files) {
          const p = path.join(logDir, f.name);
          const st = safeStat(p);
          if (!st) continue;
          const size = st.size;
          const readFrom = Math.max(0, size - 120 * 1024); // last ~120KB per file
          const fd = fs.openSync(p, 'r');
          const buf = Buffer.alloc(size - readFrom);
          fs.readSync(fd, buf, 0, size - readFrom, readFrom);
          fs.closeSync(fd);
          const text = buf.toString('utf8');
          const lines = text.split('\n');
          for (const line of lines) {
            if (!line || (!line.includes('error') && !line.includes('Error'))) continue;
            const tsMatch = line.match(/"timestamp":"([^"]+)"/);
            if (tsMatch && new Date(tsMatch[1]).getTime() < sixHoursAgo) continue;
            const modMatch = line.match(/"module":"([^"]+)"/);
            const actMatch = line.match(/"action":"([^"]+)"/);
            const msgMatch = line.match(/"message":"([^"]{0,120})"/);
            if (!modMatch) continue;
            const key = `${modMatch[1]}::${actMatch ? actMatch[1] : 'unknown'}`;
            if (!groups[key]) {
              groups[key] = {
                module: modMatch[1],
                action: actMatch ? actMatch[1] : 'unknown',
                count: 0,
                lastMessage: msgMatch ? msgMatch[1] : '',
                lastAt: tsMatch ? tsMatch[1] : null,
              };
            }
            groups[key].count += 1;
            if (tsMatch && (!groups[key].lastAt || tsMatch[1] > groups[key].lastAt)) {
              groups[key].lastAt = tsMatch[1];
              if (msgMatch) groups[key].lastMessage = msgMatch[1];
            }
          }
        }
        failures = Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 8);
      }
    } catch { /* non-critical */ }

    // 6. System-level indicators
    const system = {
      node: process.version,
      platform: process.platform,
      uptimeSec: Math.floor(process.uptime()),
      memoryMB: Math.floor(process.memoryUsage().rss / (1024 * 1024)),
      cwd: PROJECT_ROOT,
    };

    apiLogger.info('ControlCenter', 'summary', {
      builds: build.exists ? 1 : 0,
      backups: backups.length,
      commits: commits.length,
      failures: failures.length,
    });

    res.json({
      status: 'success',
      data: {
        build,
        backups,
        commits,
        uncommitted,
        failures,
        system,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    apiLogger.error('ControlCenter', 'summary', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/control-center/dead-code ──────────────────────────────────────
// Scans source for TODO, FIXME, XXX, HACK, @deprecated — cached 5 min.
let _deadCodeCache = null;
let _deadCodeCacheAt = 0;

router.get('/dead-code', async (req, res) => {
  try {
    if (_deadCodeCache && Date.now() - _deadCodeCacheAt < 5 * 60 * 1000) {
      return res.json({ status: 'success', data: _deadCodeCache, cached: true });
    }

    const markers = ['TODO', 'FIXME', 'XXX', 'HACK', '@deprecated'];
    const scanDirs = ['app/components', 'backend/routes', 'backend/services', 'backend/models'];
    const hits = [];

    function walk(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
          walk(full);
        } else if (/\.(js|ts|tsx|jsx)$/.test(e.name)) {
          try {
            const txt = fs.readFileSync(full, 'utf8');
            const lines = txt.split('\n');
            for (let i = 0; i < lines.length; i++) {
              for (const m of markers) {
                if (lines[i].includes(m)) {
                  hits.push({
                    file: path.relative(PROJECT_ROOT, full).replace(/\\/g, '/'),
                    line: i + 1,
                    marker: m,
                    excerpt: lines[i].trim().slice(0, 140),
                  });
                  break;
                }
              }
            }
          } catch { /* ignore */ }
        }
      }
    }

    for (const d of scanDirs) {
      walk(path.join(PROJECT_ROOT, d));
    }

    const byMarker = {};
    for (const h of hits) {
      byMarker[h.marker] = (byMarker[h.marker] || 0) + 1;
    }

    const result = {
      total: hits.length,
      byMarker,
      items: hits.slice(0, 50),
      scannedDirs: scanDirs,
    };

    _deadCodeCache = result;
    _deadCodeCacheAt = Date.now();

    res.json({ status: 'success', data: result, cached: false });
  } catch (err) {
    apiLogger.error('ControlCenter', 'dead-code', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
