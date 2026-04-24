#!/usr/bin/env node
/**
 * backup-guardian.js — Phase 6 deliverable "Backup Guardian".
 *
 * Per MASTER_PLAN role #9: every commit should trigger a backup of the
 * project + MongoDB dump (stripped of API keys). For MVP, the user runs
 * this manually before committing.
 *
 * Behavior:
 *  1. Zip the project directory (excluding node_modules, .git, .env,
 *     backend/upstox-token.json, backend/logs/, .next/).
 *  2. Dump every MongoDB collection in stock_dashboard to JSON (one
 *     file per collection), inside the same zip under backups/mongo/.
 *  3. Writes to backups/backup-YYYY-MM-DD-HHmm.zip (project-relative).
 *  4. Keeps last 20 backups; deletes older ones.
 *
 * Usage:
 *   node scripts/backup-guardian.js
 *
 * Dependencies: none (Node standard lib + mongoose which backend uses).
 * Uses the minimal zip writer below — avoids adding `archiver`.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'backups');
const MAX_BACKUPS = 20;

// ─── Exclusion list ──────────────────────────────────────────────────────────
// Directories (match as path prefix under ROOT)
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'backend/node_modules',
  'backend/logs',
  'backups',
  '.claude',
  '.pipeline',
  'out',
  '.vercel',
];
// Files (match as full basename OR relative path)
const EXCLUDE_FILES_EXACT = [
  '.env',
  '.env.local',
  '.env.production',
  'backend/.env',
  'backend/upstox-token.json',
  'tsconfig.tsbuildinfo',
];
// File extension filters
const EXCLUDE_EXT = ['.log', '.tmp'];
// Max single-file size to include (skip big binaries)
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function isExcluded(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  for (const d of EXCLUDE_DIRS) {
    if (norm === d || norm.startsWith(d + '/')) return true;
  }
  for (const f of EXCLUDE_FILES_EXACT) {
    if (norm === f) return true;
    if (norm.endsWith('/' + f)) return true;
  }
  const ext = path.extname(norm).toLowerCase();
  if (EXCLUDE_EXT.includes(ext)) return true;
  return false;
}

function walk(dir, base = '') {
  const files = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = base ? `${base}/${ent.name}` : ent.name;
    if (isExcluded(rel)) continue;
    if (ent.isDirectory()) {
      files.push(...walk(full, rel));
    } else if (ent.isFile()) {
      try {
        const st = fs.statSync(full);
        if (st.size > MAX_FILE_SIZE) continue;
        files.push({ full, rel, size: st.size, mtime: st.mtime });
      } catch {}
    }
  }
  return files;
}

// ─── Minimal ZIP writer (DEFLATE + store) ───────────────────────────────────
// Supports store (0) + deflate (8). Good enough for MVP backup.
function zipCreate(outPath, entries) {
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosDate(d) {
    const yr = d.getFullYear() - 1980;
    return (yr << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  }
  function dosTime(d) {
    return (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  }

  const out = fs.openSync(outPath, 'w');
  let offset = 0;
  const centralDir = [];

  try {
    for (const entry of entries) {
      const nameBuf = Buffer.from(entry.name, 'utf8');
      const raw = entry.data;
      const crc = crc32(raw);
      const compressed = zlib.deflateRawSync(raw);
      const useCompressed = compressed.length < raw.length;
      const body = useCompressed ? compressed : raw;
      const method = useCompressed ? 8 : 0;
      const mtime = entry.mtime || new Date();
      const dTime = dosTime(mtime);
      const dDate = dosDate(mtime);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0, 6);
      local.writeUInt16LE(method, 8);
      local.writeUInt16LE(dTime, 10);
      local.writeUInt16LE(dDate, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(body.length, 18);
      local.writeUInt32LE(raw.length, 22);
      local.writeUInt16LE(nameBuf.length, 26);
      local.writeUInt16LE(0, 28);

      fs.writeSync(out, local);
      fs.writeSync(out, nameBuf);
      fs.writeSync(out, body);

      centralDir.push({ nameBuf, crc, comp: body.length, raw: raw.length, offset, method, dTime, dDate });
      offset += local.length + nameBuf.length + body.length;
    }

    const centralStart = offset;
    let centralSize = 0;
    for (const c of centralDir) {
      const hdr = Buffer.alloc(46);
      hdr.writeUInt32LE(0x02014b50, 0);
      hdr.writeUInt16LE(0x031e, 4);
      hdr.writeUInt16LE(20, 6);
      hdr.writeUInt16LE(0, 8);
      hdr.writeUInt16LE(c.method, 10);
      hdr.writeUInt16LE(c.dTime, 12);
      hdr.writeUInt16LE(c.dDate, 14);
      hdr.writeUInt32LE(c.crc, 16);
      hdr.writeUInt32LE(c.comp, 20);
      hdr.writeUInt32LE(c.raw, 24);
      hdr.writeUInt16LE(c.nameBuf.length, 28);
      hdr.writeUInt16LE(0, 30);
      hdr.writeUInt16LE(0, 32);
      hdr.writeUInt16LE(0, 34);
      hdr.writeUInt16LE(0, 36);
      hdr.writeUInt32LE(0, 38);
      hdr.writeUInt32LE(c.offset, 42);
      fs.writeSync(out, hdr);
      fs.writeSync(out, c.nameBuf);
      centralSize += hdr.length + c.nameBuf.length;
    }

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(centralDir.length, 8);
    eocd.writeUInt16LE(centralDir.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(centralStart, 16);
    eocd.writeUInt16LE(0, 20);
    fs.writeSync(out, eocd);
  } finally {
    fs.closeSync(out);
  }
}

// ─── Mongo dump (JSON per collection) ───────────────────────────────────────
// Strip any keys that look like credentials as a safety net.
const SENSITIVE_KEY_RE = /(token|secret|apiKey|password|accessToken|refreshToken|apiSecret)/i;

function scrub(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(scrub);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEY_RE.test(k)) { out[k] = '[REDACTED]'; continue; }
      out[k] = scrub(v);
    }
    return out;
  }
  return obj;
}

async function dumpMongo() {
  try {
    const mongoose = require(path.join(ROOT, 'backend', 'node_modules', 'mongoose'));
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/stock_dashboard';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;
    const cols = await db.listCollections().toArray();
    const dumps = [];
    for (const c of cols) {
      try {
        const docs = await db.collection(c.name).find({}).limit(10000).toArray();
        const scrubbed = docs.map(scrub);
        dumps.push({
          name: `backups/mongo/${c.name}.json`,
          data: Buffer.from(JSON.stringify(scrubbed, null, 2), 'utf8'),
          mtime: new Date(),
        });
      } catch (err) {
        dumps.push({
          name: `backups/mongo/${c.name}.ERROR.txt`,
          data: Buffer.from(String(err.message), 'utf8'),
          mtime: new Date(),
        });
      }
    }
    await mongoose.disconnect();
    return dumps;
  } catch (err) {
    console.warn('[backup-guardian] MongoDB dump skipped:', err.message);
    return [{
      name: 'backups/mongo/_SKIPPED.txt',
      data: Buffer.from(`Mongo dump failed: ${err.message}\n`, 'utf8'),
      mtime: new Date(),
    }];
  }
}

// ─── Rotation ────────────────────────────────────────────────────────────────
function rotate() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const entries = fs.readdirSync(BACKUP_DIR)
    .filter((f) => /^backup-.*\.zip$/.test(f))
    .map((f) => ({ f, m: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  const toDelete = entries.slice(MAX_BACKUPS);
  for (const e of toDelete) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, e.f)); console.log(`  rotated: removed ${e.f}`); }
    catch (err) { console.warn(`  rotate fail ${e.f}:`, err.message); }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Backup Guardian — starting...');
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // Compose output filename
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const outPath = path.join(BACKUP_DIR, `backup-${stamp}.zip`);
  console.log('  output:', path.relative(ROOT, outPath));

  console.log('  walking project tree...');
  const files = walk(ROOT);
  console.log(`  found ${files.length} files`);

  // Read each file into memory — for our project ≈ small. Big files already skipped.
  const entries = [];
  let totalBytes = 0;
  for (const f of files) {
    try {
      const buf = fs.readFileSync(f.full);
      entries.push({ name: f.rel, data: buf, mtime: f.mtime });
      totalBytes += buf.length;
    } catch (err) {
      console.warn(`    skip ${f.rel}:`, err.message);
    }
  }

  // Add metadata manifest
  const manifest = {
    createdAt: d.toISOString(),
    fileCount: entries.length,
    totalBytes,
    stamp,
    version: 'phase6-mvp-1',
    host: require('os').hostname(),
    note: 'Generated by scripts/backup-guardian.js. Secrets (.env, tokens) excluded. Mongo dumps redacted.',
  };
  entries.push({
    name: 'backup-manifest.json',
    data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
    mtime: d,
  });

  // Dump Mongo collections
  console.log('  dumping MongoDB...');
  const dumps = await dumpMongo();
  for (const dnt of dumps) entries.push(dnt);
  console.log(`  +${dumps.length} mongo files`);

  console.log('  writing zip...');
  zipCreate(outPath, entries);

  const outStat = fs.statSync(outPath);
  console.log(`  zip size: ${(outStat.size / 1024 / 1024).toFixed(2)} MB`);

  console.log('  rotating old backups (keep last ' + MAX_BACKUPS + ')...');
  rotate();

  console.log('Backup Guardian — done.');
})();
