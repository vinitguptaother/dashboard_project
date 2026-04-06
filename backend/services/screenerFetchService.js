// backend/services/screenerFetchService.js
// Fetches screen results from screener.in by running the dashboard's saved queries.
// Resilient design: failure here NEVER breaks the dashboard — manual CSV upload always works.
//
// NEW Flow (v2):
//   1. Save credentials once → backend/data/screener-creds.json (persists across restarts)
//   2. Login + cache session (reuse until it expires)
//   3. Run the dashboard screen's query on screener.in's /screen/raw/ endpoint
//   4. Scrape all paginated results → return company list
//
// No longer lists screener.in's saved screens — uses the dashboard's own queries instead.

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.screener.in';
const TIMEOUT_MS = 20000;
const CREDS_FILE = path.join(__dirname, '..', 'data', 'screener-creds.json');

// ─── Credential persistence ────────────────────────────────────────────────

function loadCredentials() {
  try {
    if (!fs.existsSync(CREDS_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    if (data.email && data.password) return data;
    return null;
  } catch { return null; }
}

function saveCredentials(email, password) {
  const dir = path.dirname(CREDS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify({ email, password, savedAt: new Date().toISOString() }, null, 2), 'utf8');
}

function clearCredentials() {
  try { if (fs.existsSync(CREDS_FILE)) fs.unlinkSync(CREDS_FILE); } catch {}
}

function hasCredentials() {
  return !!loadCredentials();
}

// ─── Session caching (reuse login across fetches) ──────────────────────────

let cachedSession = null;    // { get, cookies }
let sessionCreatedAt = null;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min — screener.in sessions last longer but be safe

function isSessionAlive() {
  return cachedSession && sessionCreatedAt && (Date.now() - sessionCreatedAt < SESSION_TTL_MS);
}

/**
 * Get or create an authenticated session. Uses cached session if still alive.
 */
async function getSession(email, password) {
  if (isSessionAlive()) return cachedSession;
  cachedSession = await createSession(email, password);
  sessionCreatedAt = Date.now();
  return cachedSession;
}

/**
 * Create a fresh authenticated session with screener.in
 */
async function createSession(email, password) {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT_MS,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `${BASE_URL}/login/`,
    },
    maxRedirects: 5,
    withCredentials: true,
  });

  // Step 1: GET /login/ to obtain csrftoken cookie
  const loginPage = await client.get('/login/', { headers: { Cookie: '' } });
  const setCookies = loginPage.headers['set-cookie'] || [];
  const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ');

  const csrfMatch = cookieStr.match(/csrftoken=([^;,\s]+)/);
  if (!csrfMatch) throw new Error('Could not find CSRF token on screener.in login page');

  // Step 2: POST /login/
  const loginData = new URLSearchParams({
    csrfmiddlewaretoken: csrfMatch[1],
    username: email,
    password: password,
  }).toString();

  const loginResp = await client.post('/login/', loginData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr,
      'Referer': `${BASE_URL}/login/`,
    },
    maxRedirects: 0,
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const loginCookies = loginResp.headers['set-cookie'] || [];
  const allCookies = [...setCookies, ...loginCookies].map(c => c.split(';')[0]).join('; ');

  if (!allCookies.includes('sessionid')) {
    throw new Error('Login failed — check email and password.');
  }

  return {
    get: (url) => client.get(url, { headers: { Cookie: allCookies } }),
    cookies: allCookies,
  };
}

// ─── Query-based screen fetching ───────────────────────────────────────────

/**
 * Run a screener.in query and scrape all paginated results.
 * Uses the /screen/raw/ URL pattern which screener.in uses for custom queries.
 *
 * @param {string} query - e.g. "YoY profit growth > 25% AND QoQ profit growth > 10%"
 * @returns {Array<{name: string, symbol: string}>}
 */
async function runQueryAndScrape(query, options = {}) {
  const creds = loadCredentials();
  if (!creds) throw new Error('No screener.in credentials saved. Please save them first.');

  const session = await getSession(creds.email, creds.password);
  const allCompanies = [];
  const seen = new Set();
  let page = 1;
  let hasMore = true;
  let totalResults = null;
  const latestParam = options.onlyLatestResults ? '&latest=on' : '';

  while (hasMore) {
    const queryUrl = `/screen/raw/?sort=&order=&query=${encodeURIComponent(query)}&limit=&page=${page}${latestParam}`;
    let resp;
    try {
      resp = await session.get(queryUrl);
    } catch (e) {
      if (e.response?.status === 404) break;
      // Session might have expired — try once with fresh session
      if (page === 1 && e.response?.status === 403) {
        cachedSession = null;
        const freshSession = await getSession(creds.email, creds.password);
        resp = await freshSession.get(queryUrl);
      } else {
        throw e;
      }
    }

    const $ = cheerio.load(resp.data);

    // Try to get total result count from page text (e.g. "275 results found")
    if (page === 1) {
      const countMatch = $.text().match(/(\d+)\s*results?\s*found/i);
      if (countMatch) totalResults = parseInt(countMatch[1]);
    }

    // Find the results table — screener.in wraps it in .data-table or a table
    // with a thead containing "S.No." and "Name" columns. We must avoid other
    // tables on the page (related companies, ads, etc.)
    let table = null;
    $('table').each((_, tbl) => {
      const headerText = $(tbl).find('thead').text().toLowerCase();
      if (headerText.includes('s.no') && headerText.includes('name')) {
        table = $(tbl);
        return false; // break
      }
    });
    // Fallback: try .data-table class, then first table
    if (!table) table = $('table.data-table').first();
    if (!table || !table.length) table = $('table').first();
    if (!table || !table.length) {
      const errorText = $('.alert, .error, .message').text().trim() || '';
      if (errorText) throw new Error(`screener.in: ${errorText}`);
      if (page === 1) throw new Error('No results table found — the query may be invalid.');
      break;
    }

    // Find the "Name" column index from thead only
    let nameColIdx = -1;
    table.find('thead th').each((i, el) => {
      if ($(el).text().trim().toLowerCase() === 'name') nameColIdx = i;
    });
    if (nameColIdx === -1) nameColIdx = 1; // fallback: column after S.No.

    // Parse ONLY tbody > tr (direct children) to avoid picking up nested tables
    let rowsOnPage = 0;
    table.find('tbody > tr').each((_, tr) => {
      const cells = $(tr).find('> td');  // direct child td only
      if (cells.length < 2) return;

      const nameCell = cells.eq(nameColIdx);
      const link = nameCell.find('a[href*="/company/"]');

      let companyName = '';
      let symbol = '';

      if (link.length) {
        companyName = link.text().trim();
        const hrefMatch = (link.attr('href') || '').match(/\/company\/([^/]+)/);
        if (hrefMatch) symbol = hrefMatch[1].toUpperCase();
      } else {
        companyName = nameCell.text().trim();
      }

      // Skip header rows that got into tbody (e.g. "S.No." text in first cell)
      if (!companyName || companyName.toLowerCase() === 'name' || companyName.toLowerCase() === 's.no.') return;

      if (!seen.has(companyName.toUpperCase())) {
        seen.add(companyName.toUpperCase());
        allCompanies.push({
          name: companyName,
          symbol: symbol || companyName.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        });
        rowsOnPage++;
      }
    });

    // Pagination check
    const pageLinks = $('a[href*="page="]');
    let maxPage = page;
    pageLinks.each((_, el) => {
      const href = $(el).attr('href') || '';
      const pm = href.match(/[?&]page=(\d+)/);
      if (pm) maxPage = Math.max(maxPage, parseInt(pm[1]));
    });

    hasMore = maxPage > page && rowsOnPage > 0;
    page++;

    if (page > 20) break; // safety cap: 1000 companies
    if (hasMore) await new Promise(r => setTimeout(r, 500)); // polite delay
  }

  return { companies: allCompanies, totalResults, pages: page - 1 };
}

/**
 * Test login with given credentials. If successful, save them.
 */
async function testAndSaveCredentials(email, password) {
  const session = await createSession(email, password);
  // If we get here without throwing, login worked
  saveCredentials(email, password);
  cachedSession = session;
  sessionCreatedAt = Date.now();
  return { success: true, message: 'Login successful. Credentials saved.' };
}

module.exports = {
  runQueryAndScrape,
  testAndSaveCredentials,
  loadCredentials,
  hasCredentials,
  clearCredentials,
};
