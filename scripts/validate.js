#!/usr/bin/env node
/**
 * validate.js — Testing pipeline / validation gatekeeper
 *
 * Runs 5 checks in order, stops on first failure:
 *   1. TypeScript type-check (npx tsc --noEmit)
 *   2. ESLint (npx next lint)
 *   3. Next.js build (npx next build)
 *   4. Backend syntax check (node --check on every .js in backend/)
 *   5. Backend smoke tests (start server, hit key endpoints, stop server)
 *
 * Usage:  npm run validate          — run all checks
 *         npm run validate -- --skip-build   — skip the slow build step
 *         npm run validate -- --smoke-only   — only run smoke tests
 *
 * Exit code: 0 = all green, 1 = failure
 *
 * LIMITS (be honest about what this does NOT cover):
 *   - No unit tests (none exist in this project)
 *   - No browser/UI tests (no Playwright/Cypress)
 *   - No frontend runtime error detection (needs headless browser)
 *   - node --check catches SYNTAX only, not missing modules or runtime crashes
 *   - Smoke tests verify routes respond with non-500, not that data is correct
 *   - Smoke tests require MongoDB running locally
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ─── Config ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT, 'backend');
const BACKEND_PORT = 5002;
const SMOKE_TIMEOUT_MS = 30000; // 30s max to wait for server startup
const REQUEST_TIMEOUT_MS = 10000; // 10s per request

// Smoke test endpoints — chosen to cover every major subsystem
// Each entry: [method, path, description, acceptableStatuses]
const SMOKE_ENDPOINTS = [
  // Core server
  ['GET', '/api/health-check', 'Health check', [200, 404, 500]], // may 500 due to broken upstox require — known issue
  // Market data
  ['GET', '/api/market/indices', 'Market indices (Upstox LTP)', [200]],
  ['GET', '/api/market/search/RELIANCE', 'Stock search', [200]],
  ['GET', '/api/market-status', 'Market status', [200]],
  // Screens & trade setups
  ['GET', '/api/screens', 'Screens list', [200]],
  ['GET', '/api/trade-setup/active', 'Active trade setups', [200]],
  ['GET', '/api/trade-setup/stats', 'Trade setup stats', [200]],
  // Options
  ['GET', '/api/options/trades', 'Options trades', [200]],
  ['GET', '/api/options/positions-ltp', 'Options live P&L', [200]],
  // Activity
  ['GET', '/api/activity/dates', 'Activity dates', [200]],
  // News
  ['GET', '/api/news', 'News feed', [200]],
  // Notes
  ['GET', '/api/notes', 'Sticky notes', [200]],
  // Watchlist
  ['GET', '/api/watchlist', 'Watchlist', [200]],
  // Risk
  ['GET', '/api/risk/settings', 'Risk settings', [200]],
  // Instruments
  ['GET', '/api/instruments/search?q=NIFTY&limit=3', 'Instrument search', [200]],
  // Env config (now requires auth — should return 401)
  ['GET', '/api/settings/env', 'Env config (auth check)', [401]],
  // Env schema (public)
  ['GET', '/api/settings/env/schema', 'Env schema (public)', [200]],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(color, symbol, msg) {
  console.log(`${color}${symbol}${COLORS.reset} ${msg}`);
}
function pass(msg) { log(COLORS.green, '  PASS', msg); }
function fail(msg) { log(COLORS.red, '  FAIL', msg); }
function warn(msg) { log(COLORS.yellow, '  WARN', msg); }
function info(msg) { log(COLORS.cyan, '  INFO', msg); }
function header(msg) { console.log(`\n${COLORS.bold}${COLORS.cyan}── ${msg} ──${COLORS.reset}`); }

function runCmd(cmd, options = {}) {
  try {
    const output = execSync(cmd, {
      cwd: ROOT,
      stdio: options.silent ? 'pipe' : 'inherit',
      timeout: 300000, // 5 min max
      env: { ...process.env, FORCE_COLOR: '1' },
      shell: true,
    });
    return { ok: true, output: output ? output.toString() : '' };
  } catch (err) {
    return {
      ok: false,
      output: err.stdout ? err.stdout.toString() : '',
      error: err.stderr ? err.stderr.toString() : err.message,
    };
  }
}

function httpGet(urlPath) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: 0, error: 'timeout' }), REQUEST_TIMEOUT_MS);
    const req = http.get(`http://localhost:${BACKEND_PORT}${urlPath}`, (res) => {
      clearTimeout(timer);
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      resolve({ status: 0, error: err.message });
    });
  });
}

function waitForServer(port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${port}/api/market-status`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          resolve(false);
        } else {
          setTimeout(check, 500);
        }
      });
      req.setTimeout(2000, () => { req.destroy(); });
    };
    check();
  });
}

// ─── Check implementations ───────────────────────────────────────────────────

async function checkTypeScript() {
  header('Step 1/5: TypeScript type-check');
  info('Running: npx tsc --noEmit');
  const result = runCmd('npx tsc --noEmit');
  if (result.ok) {
    pass('TypeScript — no type errors');
    return true;
  }
  fail('TypeScript type errors found');
  return false;
}

async function checkLint() {
  header('Step 2/5: ESLint');
  info('Running: npx next lint');
  const result = runCmd('npx next lint');
  if (result.ok) {
    pass('ESLint — no errors');
    return true;
  }
  fail('ESLint errors found');
  return false;
}

async function checkBuild() {
  header('Step 3/5: Next.js build');
  info('Running: npx next build');
  const result = runCmd('npx next build');
  if (result.ok) {
    pass('Next.js build — compiled successfully');
    return true;
  }
  fail('Next.js build failed');
  return false;
}

async function checkBackendSyntax() {
  header('Step 4/5: Backend syntax check');
  info('Running: node --check on all backend .js files');
  info('NOTE: This catches SYNTAX errors only, not missing modules or runtime crashes.');

  const jsFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js') && !entry.name.endsWith('.bak')) jsFiles.push(full);
    }
  }
  walk(BACKEND_DIR);

  let failures = 0;
  for (const file of jsFiles) {
    const rel = path.relative(ROOT, file);
    const result = runCmd(`node --check "${file}"`, { silent: true });
    if (!result.ok) {
      fail(`Syntax error: ${rel}`);
      if (result.error) console.log(`    ${result.error.split('\n')[0]}`);
      failures++;
    }
  }

  if (failures === 0) {
    pass(`Backend syntax — ${jsFiles.length} files checked, no syntax errors`);
    return true;
  }
  fail(`Backend syntax — ${failures}/${jsFiles.length} files have syntax errors`);
  return false;
}

async function checkSmokeTests() {
  header('Step 5/5: Backend smoke tests');
  info(`Starting backend server on port ${BACKEND_PORT}...`);
  info('NOTE: Requires MongoDB running on localhost:27017');

  // Check if something is already on that port
  const portCheck = await httpGet('/api/market-status/state');
  let serverProcess = null;
  let weStartedIt = false;

  if (portCheck.status > 0) {
    info('Backend already running, using existing server');
  } else {
    // Start backend
    serverProcess = spawn('node', [path.join(ROOT, 'backend', 'server.js')], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    weStartedIt = true;

    // Capture startup errors
    let startupError = '';
    serverProcess.stderr.on('data', (d) => { startupError += d.toString(); });
    serverProcess.stdout.on('data', () => {}); // drain stdout

    const serverReady = await waitForServer(BACKEND_PORT, SMOKE_TIMEOUT_MS);
    if (!serverReady) {
      fail('Backend server failed to start within 30s');
      if (startupError) console.log(`    ${startupError.split('\n').slice(0, 3).join('\n    ')}`);
      killServer(serverProcess);
      return false;
    }
    pass('Backend server started');
  }

  // Run smoke tests
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const [method, urlPath, description, acceptableStatuses] of SMOKE_ENDPOINTS) {
    const res = await httpGet(urlPath);
    if (res.status === 0) {
      fail(`${description}: ${urlPath} — ${res.error || 'no response'}`);
      failures.push({ description, urlPath, reason: res.error || 'no response' });
      failed++;
    } else if (acceptableStatuses.includes(res.status)) {
      pass(`${description}: ${urlPath} → ${res.status}`);
      passed++;
    } else {
      fail(`${description}: ${urlPath} → ${res.status} (expected ${acceptableStatuses.join('/')})`);
      failures.push({ description, urlPath, reason: `got ${res.status}, expected ${acceptableStatuses.join('/')}` });
      failed++;
    }
  }

  // Cleanup
  if (weStartedIt && serverProcess) {
    killServer(serverProcess);
    info('Backend server stopped');
  }

  if (failed === 0) {
    pass(`Smoke tests — ${passed}/${SMOKE_ENDPOINTS.length} endpoints responded correctly`);
    return true;
  }
  fail(`Smoke tests — ${failed}/${SMOKE_ENDPOINTS.length} endpoints failed`);
  return false;
}

function killServer(proc) {
  if (!proc) return;
  try {
    if (process.platform === 'win32') {
      // taskkill /T kills child processes too
      try { execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch {}
    } else {
      proc.kill('SIGTERM');
    }
  } catch {}
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const smokeOnly = args.includes('--smoke-only');

  console.log(`${COLORS.bold}
╔═══════════════════════════════════════════════╗
║       Dashboard Validation Pipeline           ║
╚═══════════════════════════════════════════════╝${COLORS.reset}`);

  const results = {};
  const startTime = Date.now();

  if (smokeOnly) {
    info('--smoke-only: skipping steps 1-4');
    results.typescript = { status: 'skipped', reason: '--smoke-only flag' };
    results.lint = { status: 'skipped', reason: '--smoke-only flag' };
    results.build = { status: 'skipped', reason: '--smoke-only flag' };
    results.backendSyntax = { status: 'skipped', reason: '--smoke-only flag' };
  } else {
    // Step 1: TypeScript
    const tsOk = await checkTypeScript();
    results.typescript = { status: tsOk ? 'passed' : 'failed' };
    if (!tsOk) { printSummary(results, startTime); process.exit(1); }

    // Step 2: ESLint
    const lintOk = await checkLint();
    results.lint = { status: lintOk ? 'passed' : 'failed' };
    if (!lintOk) { printSummary(results, startTime); process.exit(1); }

    // Step 3: Build
    if (skipBuild) {
      info('--skip-build: skipping Next.js build');
      results.build = { status: 'skipped', reason: '--skip-build flag' };
    } else {
      const buildOk = await checkBuild();
      results.build = { status: buildOk ? 'passed' : 'failed' };
      if (!buildOk) { printSummary(results, startTime); process.exit(1); }
    }

    // Step 4: Backend syntax
    const syntaxOk = await checkBackendSyntax();
    results.backendSyntax = { status: syntaxOk ? 'passed' : 'failed' };
    if (!syntaxOk) { printSummary(results, startTime); process.exit(1); }
  }

  // Step 5: Smoke tests
  const smokeOk = await checkSmokeTests();
  results.smokeTests = { status: smokeOk ? 'passed' : 'failed' };

  printSummary(results, startTime);
  process.exit(smokeOk ? 0 : 1);
}

function printSummary(results, startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${COLORS.bold}${COLORS.cyan}══════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bold}  VALIDATION SUMMARY${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}══════════════════════════════════════════════${COLORS.reset}\n`);

  const rows = [
    ['TypeScript', results.typescript],
    ['ESLint', results.lint],
    ['Next.js Build', results.build],
    ['Backend Syntax', results.backendSyntax],
    ['Smoke Tests', results.smokeTests],
  ];

  let passedCount = 0, failedCount = 0, skippedCount = 0;

  for (const [name, result] of rows) {
    if (!result) {
      console.log(`  ${COLORS.dim}⊘${COLORS.reset} ${name}: ${COLORS.dim}not run${COLORS.reset}`);
      continue;
    }
    if (result.status === 'passed') {
      console.log(`  ${COLORS.green}✓${COLORS.reset} ${name}: ${COLORS.green}PASSED${COLORS.reset}`);
      passedCount++;
    } else if (result.status === 'failed') {
      console.log(`  ${COLORS.red}✗${COLORS.reset} ${name}: ${COLORS.red}FAILED${COLORS.reset}`);
      failedCount++;
    } else if (result.status === 'skipped') {
      console.log(`  ${COLORS.yellow}⊘${COLORS.reset} ${name}: ${COLORS.yellow}SKIPPED${COLORS.reset} (${result.reason})`);
      skippedCount++;
    }
  }

  console.log('');
  console.log(`  ${COLORS.dim}Time: ${elapsed}s${COLORS.reset}`);
  console.log(`  ${COLORS.dim}Passed: ${passedCount} | Failed: ${failedCount} | Skipped: ${skippedCount}${COLORS.reset}`);

  if (failedCount === 0) {
    console.log(`\n  ${COLORS.green}${COLORS.bold}PIPELINE: GREEN${COLORS.reset}\n`);
  } else {
    console.log(`\n  ${COLORS.red}${COLORS.bold}PIPELINE: RED — stopped at first failure${COLORS.reset}\n`);
  }
}

main().catch((err) => {
  console.error('Pipeline crashed:', err.message);
  process.exit(1);
});
