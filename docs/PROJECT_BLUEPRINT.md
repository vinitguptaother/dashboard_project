# PROJECT BLUEPRINT — Vinit's AI Stock Suggesting Dashboard
**Last updated:** 2026-04-10
**Purpose:** Self-contained handoff document for a new Claude Code session.

---

## 1. PROJECT VISION & GOAL

**What:** An AI-powered Indian stock market dashboard for swing trading and long-term investing on NSE/BSE.

**Who:** Vinit Gupta — non-technical Indian retail trader. Uses Screener.in screens, wants AI to help rank ideas and generate trade setups, then paper-trades them before real money.

**Core value:**
1. Run screens on Screener.in → upload CSV (or auto-fetch) → AI ranks the top stocks
2. Generate AI trade setups (entry/exit/SL/target) for top 5 stocks
3. Paper-trade those setups → track hit rates → score screens over time
4. Search any Indian stock → get full fundamentals + AI analysis
5. Options paper trading (Sensibull-style) with live Upstox data
6. News, alerts, journal, activity log all in one place

**Currency:** INR (₹), Indian numbering (lakhs, crores). Market hours 9:15 AM–3:30 PM IST, Mon–Fri.

---

## 2. TECH STACK

### Frontend
- **Framework:** Next.js 14 App Router + React 18 + TypeScript
- **Styling:** Tailwind CSS (dark mode via globals.css overrides — `darkMode: 'class'` is MISSING from tailwind.config, so `dark:` prefixed classes are non-functional)
- **Charts:** Recharts
- **Excel/CSV:** xlsx package
- **Icons:** lucide-react
- **Real-time:** socket.io-client
- **Fonts:** Inter (body), JetBrains_Mono (numbers)
- **Port:** 3000

### Backend
- **Runtime:** Node.js (Express.js 5)
- **DB:** MongoDB local (`localhost:27017/stock_dashboard`) via Mongoose
- **Cache:** Redis (optional — falls back to in-memory)
- **Real-time:** Socket.IO
- **Auth:** JWT + bcrypt
- **HTTP:** axios
- **Scraping:** cheerio
- **Cron:** node-cron
- **Logging:** winston
- **Rate limiting:** express-rate-limit
- **Port:** 5002

### AI / Data
- **Perplexity API** (`sonar-pro` model) — primary AI for stock ranking, trade setups, analysis. Has live internet access.
- **Upstox API V2** — live market data (LTP, option chains, instruments), real broker integration
- **Screener.in** — fundamentals (HTML scraping `#top-ratios li` → `.name` + `.number` selectors) + screen results (auto-fetch via login session)
- **NewsAPI + RSS feeds** (ET, BS, MC, LM) — financial news
- **Yahoo Finance v8 chart API** — fallback price data

### Dev / Infra
- Git + GitHub (repo: `vinitguptaother/dashboard_project`, branch: `feature/options-tab-sensibull`)
- Local-only — no deployment yet
- Lovable (referenced for UI reskin — not yet integrated)

---

## 3. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js, port 3000)                              │
│  app/page.tsx → tab switch → 15 tab components              │
│  fetch() + WebSocket → backend                              │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTP / WS
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Express, port 5002)                               │
│  server.js → 27 route mounts → services → models            │
│  Cron jobs (10+) → market refresh, scoring, expiry          │
│  Socket.IO server for live updates                          │
└─────────────────────────────────────────────────────────────┘
        ↓                  ↓                    ↓
   ┌────────┐        ┌──────────┐         ┌────────────┐
   │MongoDB │        │ Upstox V2│         │Perplexity  │
   │(local) │        │ (live)   │         │(sonar-pro) │
   └────────┘        └──────────┘         └────────────┘
        ↓                  ↓                    ↓
                    ┌──────────────┐      ┌────────────┐
                    │ Screener.in  │      │ NewsAPI/RSS│
                    │ (scrape+API) │      │            │
                    └──────────────┘      └────────────┘
```

### Screener Fetch Pipeline (the core flow)
1. User saves Screener.in credentials once → `backend/data/screener-creds.json`
2. User opens Screens tab → clicks "Fetch Screen X"
3. Backend `screenerFetchService.runQueryAndScrape()` → logs in → posts query to `/screen/raw/` → scrapes paginated results
4. Returns ~40–200 companies with fundamentals
5. User clicks "Rank with AI" → backend calls Perplexity in batches of 25, returns top picks
6. User clicks "Generate Trade Setups" → backend pre-filters active trades → calls Perplexity for top N candidates → returns entry/SL/target/holding period
7. User one-clicks "Paper Trade" → trade saved to MongoDB → cron monitors price every 2 min during market hours
8. Auto-expiry cron at 10:30 PM marks stale setups
9. Screen scoring cron at 11 PM updates hit rates per screen

---

## 4. FEATURES LIST

### (a) COMPLETED ✅
1. **Dashboard tab** — Live indices (NIFTY/SENSEX/BANKNIFTY), Today's Top Ideas, Active Idea Batches counter, Stats, Daily P&L widget, Position Sizer
2. **Historical tab** — historical chart per stock via Upstox
3. **Portfolio (Watchlist) tab** — add/remove stocks, AI analysis, notes per stock
4. **Alerts tab** — CRUD alerts, WebSocket notifications
5. **AI Analysis tab** — view past screens, batches, AI rankings
6. **Search tab** — search any NSE/BSE stock → fundamentals (Screener.in), price (Upstox/Yahoo), AI analysis
7. **News tab** — RSS aggregated news + NewsAPI
8. **Screens tab** — upload CSV / auto-fetch from Screener.in, view companies, rank with AI, generate setups
9. **Trade Journal tab** — view all trade setups, status (active/closed), edit
10. **Paper Trading tab** — paper trades with live monitoring, edit SL/target on revisit
11. **Options tab** — Sensibull-style paper trading, full strategy builder, live option chain (Upstox), 28 endpoints, live P&L polling every 10s, payoff chart, Greeks, charges modal, AI insights
12. **Activity tab** — chronological event log per date (screen fetched, ranked, trade created/closed, etc.)
13. **Settings tab** — env config, API keys
14. **Hidden tabs:** Upstox (raw broker data), API Integration (debug)
15. **Sticky Notes** — global overlay
16. **AI Chatbot** — global overlay
17. **MongoDB** persistence for all entities (188+ instruments loaded)
18. **Upstox token auto-load** from `backend/upstox-token.json` (token valid till ~2027)
19. **Cron jobs:** market refresh (2min), news (30min), cache clear (hourly), API usage reset (midnight), kill switch reset, weekly instruments download, RSS news, token expiry warning, trade setup monitor, auto-expire setups, screen scoring, holiday refresh
20. **Holiday-aware** market state — fetched daily, cached
21. **Screener.in fundamentals via HTML scraping** — exact P/E, Market Cap, ROE, ROCE, Book Value, Dividend Yield, Face Value (verified P/E for SHAILY = 64.9 matches Screener.in exactly)
22. **AI ranking batched** in chunks of 25 with `max_tokens=5000` (fixed truncation gaps)
23. **Trade setup pre-filter** — skips already-active trades before calling Perplexity
24. **BSE-code stock handling** — converts numeric codes to company names for matching
25. **Search exchange filter fix** — `{$in: ['NSE_EQ','BSE_EQ','NSE','BSE']}`
26. **Screener pagination fix** — uses `consecutiveEmptyPages` counter to avoid stopping early on duplicate pages

### (b) IN PROGRESS / PARTIAL ⚠️
1. **Phase 3 Documentation** — this blueprint is part of it; CLEANUP_REPORT.md and other docs not yet generated
2. **Lovable UI reskin** — referenced in CLAUDE.md but not started (waiting for Lovable credits refresh)
3. **Dark mode Tailwind** — `darkMode: 'class'` missing from tailwind.config, ~440 `dark:` classes are non-functional; only globals.css overrides work

### (c) PLANNED / NOT BUILT ❌
1. Real money trading (currently paper only)
2. Deployment (currently local)
3. Mobile responsive polish
4. Backtest engine for screens
5. Portfolio simulation across multiple paper accounts
6. Telegram/email alerts integration

---

## 5. AI / ML APPROACH

### Stock Ranking (Screens → Top Picks)
- **Model:** Perplexity `sonar-pro` (live internet access)
- **Input:** Array of company symbols + names from a screen
- **Method:** `backend/routes/screens.js` → `rankBatch()`
  - Batches symbols in chunks of 25 (BATCH_SIZE)
  - `max_tokens=5000` per call to prevent JSON truncation
  - Yahoo Finance fallback for symbol→name resolution if BSE code
  - Returns ranked list with reasoning, score, key factors
- **Storage:** `ScreenBatch` model in MongoDB

### Trade Setup Generation
- **Model:** Perplexity `sonar-pro`
- **Input:** Top-ranked symbols + risk preferences + setupCount
- **Method:** `backend/routes/tradeSetup.js`
  - **Pre-filters active trades server-side** before API call
  - Picks `setupCount * 2` candidates to fill the requested slots
  - Asks Perplexity for: entry, stop loss, target1/target2, holding duration, conviction, technical reasoning, fundamental reasoning
  - Returns merged `preSkipped + postSkipped + setups`
- **Storage:** `TradeSetup` model with status enum (active/closed/expired)

### Stock Search Analysis
- **Primary fundamentals:** Screener.in HTML scrape (`#top-ratios li`) → P/E, Mkt Cap, ROE, ROCE, Book Value, Div Yield, Face Value
- **Fallback fundamentals:** Perplexity if Screener.in credentials not saved or symbol 404
- **Price data:** Upstox LTP first, Yahoo v8 chart fallback
- **AI analysis:** Perplexity with full fundamental context → bullish/bearish/neutral + reasoning
- **Cache:** 10-min Redis TTL on `stock-analysis:${symbol}`

### Options Analysis
- **Live data:** Upstox V2 option chain (cached 8s)
- **Greeks:** Black-Scholes computed in `utils/optionsMath.js` (delta, theta, gamma, vega, IV)
- **Strategy presets:** STRATEGY_PRESETS in `app/components/options/constants.ts` (long call, iron condor, butterfly, etc.)
- **Live P&L polling:** Independent endpoint `/api/options/positions-ltp` polls every 10s for ALL open trades regardless of currently-viewed underlying/expiry
- **AI review:** Perplexity-powered "review my strategy" — checks Greeks, risk/reward, payoff

### Screen Scoring (Hit Rate Tracking)
- **Cron:** 11 PM IST daily
- **Service:** `backend/services/screenScoringService.js`
- **Logic:** For each `ScreenPerformance` record, recalculate hit rate from associated `TradeSetup` outcomes
- **Storage:** `ScreenPerformance` model (unique per screenName)

---

## 6. DATA SOURCES

| Source | Type | Auth | Used For |
|---|---|---|---|
| **Upstox API V2** | REST + WebSocket | OAuth2 access token (in `upstox-token.json`) | LTP, option chains, expiries, instruments, real portfolio (hidden tab), historical |
| **Perplexity API** | REST | API key (`PERPLEXITY_API_KEY`) | All AI: ranking, setups, analysis, chatbot, options review |
| **Screener.in** | HTML scrape + login session | Email/password (in `backend/data/screener-creds.json`) | Screen results, exact fundamentals |
| **NewsAPI** | REST | API key (`NEWS_API_KEY`) | News tab |
| **RSS feeds** | XML parse | None | ET, BS, Moneycontrol, Livemint news |
| **Yahoo Finance v8 chart** | REST | None | Fallback price/historical |
| **NSE Holidays** | Manual list + service | None | Market state calculation |

---

## 7. DASHBOARD UI STRUCTURE

### Top Bar (always visible)
- System bar (28px) — date, time, market status
- Nav bar (48px) — 13 visible tabs + 2 hidden (upstox, api)
- Live Index Bar — NIFTY/SENSEX/BANKNIFTY with live LTP
- Market Status Badge — Open/Closed/Pre-open/Holiday
- Token Status Badge — Upstox token validity countdown

### Visible Tabs (in order)
1. **Dashboard** — Top Ideas grid, Active Batches counter, Stats cards, Daily P&L, Position Sizer
2. **History** — Historical chart per symbol
3. **Portfolio** — Watchlist with AI analysis, notes, heatmap (component exists but uses orphan HeatMap)
4. **Alerts** — Alert CRUD + live notifications
5. **AI Analysis** — Past screens, batches, AI ranking results
6. **Search** — Stock search → Screener.in fundamentals + Upstox price + AI analysis
7. **News** — RSS aggregated + NewsAPI
8. **Screens** — Screen list, fetch button, CSV upload, AI rank, generate setups
9. **Journal** — All trade setups (active + history), edit
10. **Paper Trading** — Paper trades dashboard, live P&L, edit SL/target
11. **Options** — Sensibull-style: LeftPanel (chain + legs + builder), RightPanel (summary + Greeks + insights + payoff + P&L table), ChainModal, ChargesModal, BottomTabs (positions/orders/portfolios/AI review)
12. **Activity** — Chronological log per date
13. **Settings** — Env config, API keys

### Hidden Tabs
- **Upstox** — Raw broker view: portfolio, positions, funds
- **API Integration** — Debug panel for API health

### Global Overlays
- **AI Chatbot** — Floating button → drawer → Perplexity chat
- **Sticky Notes** — Floating notes anywhere on screen

---

## 8. FILE & FOLDER STRUCTURE

```
dashboard_project/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (fonts, globals.css)
│   ├── page.tsx                      # Main page — tab switch
│   ├── globals.css                   # Tailwind + dark mode CSS overrides
│   ├── components/
│   │   ├── Navigation.tsx            # Top nav with 15 tabs
│   │   ├── Dashboard.tsx             # Dashboard tab
│   │   ├── HistoricalTab.tsx
│   │   ├── PortfolioTab.tsx
│   │   ├── UpstoxTab.tsx             # Hidden
│   │   ├── AlertsTab.tsx
│   │   ├── AIAnalysisTab.tsx
│   │   ├── StockSearchTab.tsx
│   │   ├── NewsTab.tsx
│   │   ├── ScreensTab.tsx            # Active screens UI
│   │   ├── APIIntegrationTab.tsx     # Hidden
│   │   ├── SettingsTab.tsx
│   │   ├── TradeJournalTab.tsx
│   │   ├── PaperTradingTab.tsx
│   │   ├── ActivitySummaryTab.tsx    # NEW
│   │   ├── LiveIndexBar.tsx
│   │   ├── PositionSizer.tsx
│   │   ├── DailyPnLWidget.tsx
│   │   ├── RealTimeNotification.tsx
│   │   ├── MarketStatusBadge.tsx     # NEW
│   │   ├── PayoffChart.tsx
│   │   ├── AIChatbot.tsx
│   │   ├── StickyNotes.tsx           # NEW
│   │   ├── APIKeysTab.tsx
│   │   ├── options/                  # Modular Options tab
│   │   │   ├── OptionsTab.tsx        # Entry
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   ├── utils.ts
│   │   │   ├── hooks.ts              # useOptionsData, useStrategyBuilder, useTrades, useLivePnL, usePortfolios
│   │   │   ├── LeftPanel.tsx
│   │   │   ├── RightPanel.tsx
│   │   │   ├── ChainModal.tsx
│   │   │   ├── ChargesModal.tsx      # NEW
│   │   │   ├── LegsTable.tsx
│   │   │   ├── StrategyHeader.tsx
│   │   │   ├── StrategyControls.tsx
│   │   │   ├── ActionBar.tsx
│   │   │   ├── BottomTabs.tsx
│   │   │   ├── SummaryBar.tsx
│   │   │   ├── GreeksPanel.tsx
│   │   │   ├── InsightsPanel.tsx     # NEW
│   │   │   └── PnLTable.tsx          # NEW
│   │   └── [ORPHANS — see CLEANUP_REPORT]
│   ├── hooks/
│   │   ├── useMarketStatus.ts        # NEW
│   │   ├── useLTP.ts
│   │   ├── useHistoricalData.ts
│   │   ├── useRealTimeData.ts
│   │   ├── useWebSocket.ts
│   │   └── useAPIIntegration.ts
│   ├── lib/
│   │   ├── marketHours.ts            # NEW
│   │   ├── config.ts
│   │   ├── aiService.ts
│   │   ├── apiService.ts
│   │   ├── websocketService.ts
│   │   ├── stockDataService.ts
│   │   ├── portfolioService.ts
│   │   ├── alertService.ts
│   │   ├── screenerService.ts        # ORPHAN
│   │   ├── tradingSignalsService.ts  # ORPHAN
│   │   └── watchlist.ts              # ORPHAN
│   └── api/                          # Next.js API routes (proxies)
│
├── backend/
│   ├── server.js                     # Express entry, port 5002
│   ├── package.json
│   ├── .env                          # PORT, MONGODB_URI, PERPLEXITY_API_KEY, NEWS_API_KEY, JWT_SECRET
│   ├── upstox-token.json             # Upstox OAuth token (auto-loaded)
│   ├── config/
│   │   └── database.js               # Mongoose + Redis setup
│   ├── middleware/
│   │   ├── auth.js                   # auth, optionalAuth, adminAuth
│   │   ├── errorHandler.js
│   │   ├── logger.js                 # Winston
│   │   └── rateLimiter.js
│   ├── models/                       # 17 Mongoose schemas
│   │   ├── User.js
│   │   ├── Alert.js
│   │   ├── APIConfig.js
│   │   ├── Instrument.js
│   │   ├── MarketData.js
│   │   ├── News.js
│   │   ├── Note.js                   # NEW
│   │   ├── OptionsPortfolio.js       # NEW
│   │   ├── OptionsTrade.js
│   │   ├── Portfolio.js
│   │   ├── RealTrade.js
│   │   ├── RiskSettings.js
│   │   ├── Screen.js
│   │   ├── ScreenBatch.js
│   │   ├── ScreenPerformance.js
│   │   ├── TradeSetup.js
│   │   └── Watchlist.js
│   ├── routes/                       # 27 route files
│   │   ├── activitySummary.js        # NEW
│   │   ├── aiAnalysis.js
│   │   ├── aiChatbot.js
│   │   ├── alerts.js
│   │   ├── aliceBlue.js
│   │   ├── apiConfig.js
│   │   ├── apiUsage.js
│   │   ├── auth.js
│   │   ├── envConfig.js
│   │   ├── healthCheck.js            # ❌ BROKEN — bad require path
│   │   ├── instruments.js
│   │   ├── market.js                 # Stock search, analysis
│   │   ├── marketStatus.js
│   │   ├── news.js
│   │   ├── notes.js                  # NEW
│   │   ├── options.js                # 28 endpoints, includes positions-ltp
│   │   ├── perplexity.js
│   │   ├── portfolio.js
│   │   ├── riskManagement.js
│   │   ├── screener.js
│   │   ├── screens.js                # ❌ BROKEN in main project — bad upstoxService require + missing express.Router
│   │   ├── tradeSetup.js
│   │   ├── tradingSignals.js
│   │   ├── upstox.js                 # ❌ BROKEN — bad require path
│   │   ├── upstoxAuth.js
│   │   ├── user.js
│   │   └── watchlist.js
│   ├── services/
│   │   ├── aiService.js              # Perplexity wrapper
│   │   ├── alertService.js
│   │   ├── aliceBlueService.js
│   │   ├── brokerService.js
│   │   ├── claudeService.js          # ORPHAN
│   │   ├── feedbackService.js
│   │   ├── holidayService.js
│   │   ├── marketDataService.js
│   │   ├── newsService.js
│   │   ├── optionsService.js         # Upstox V2 chain (8s cache)
│   │   ├── rssNewsService.js
│   │   ├── screenScoringService.js
│   │   ├── screenerFetchService.js   # Screener.in scraper + fetchCompanyFundamentals
│   │   ├── upstoxService.js          # Default export — singleton
│   │   └── websocketService.js
│   ├── utils/
│   │   ├── logActivity.js            # NEW — fire-and-forget activity logger
│   │   ├── marketHours.js
│   │   ├── optionsMath.js            # Black-Scholes, Greeks, payoff
│   │   └── trackAPI.js
│   ├── data/
│   │   └── screener-creds.json       # Saved Screener.in login
│   └── logs/
│       ├── combined.log
│       └── error1.log
│
├── docs/                             # Documentation (this folder)
│   ├── PROJECT_BLUEPRINT.md          # ← THIS FILE
│   └── [README, ARCHITECTURE, etc. — TO BE GENERATED]
│
├── public/
├── .claude/                          # Claude Code config (worktrees, settings)
├── package.json                      # Frontend deps
├── next.config.js
├── tailwind.config.ts                # ⚠️ Missing darkMode: 'class'
├── tsconfig.json
├── postcss.config.js
└── CLAUDE.md                         # Project memory (critical facts)
```

---

## 9. KEY DECISIONS & APPROACHES

1. **Local-only MongoDB, no Atlas** — free forever, fast, no usage limits. Connection string `mongodb://localhost:27017/stock_dashboard` with fallback in `config/database.js`.

2. **Redis is optional** — graceful fallback to in-memory caching to avoid forcing user to install Redis.

3. **Upstox token persisted to disk** — `backend/upstox-token.json` auto-loaded at startup; survives server restarts; valid till ~2027.

4. **Screener.in HTML scraping over JSON API** — Tested `/api/company/SYMBOL/` returns 404. Switched to scraping `#top-ratios li` → `.name` + `.number`. Verified P/E for SHAILY = 64.9 (exact match). Selectors are stable; function gracefully returns null if Screener.in changes UI.

5. **Perplexity over Claude/OpenAI** — has live internet access, perfect for fresh fundamentals, news, and market context.

6. **Batched AI ranking** — chunks of 25 with `max_tokens=5000` to avoid JSON truncation that was causing gaps in rankings (sr 31+, 40+).

7. **Pre-filter active trades server-side** — before calling Perplexity for trade setups, skip stocks already in active trades (saves tokens, prevents duplicates).

8. **BSE-code handling** — numeric symbols (e.g. `514330`) detected with `/^\d+$/` and converted to company names for matching against instruments DB and Yahoo fallback.

9. **Search exchange filter** — `{$in: ['NSE_EQ','BSE_EQ','NSE','BSE']}` because instruments are stored as `NSE_EQ`/`BSE_EQ` but old code queried `'NSE'`.

10. **Independent options live P&L polling** — `/api/options/positions-ltp` endpoint fetches all open trades' chains every 10s regardless of which underlying/expiry is currently viewed. Solves the "P&L is static" bug.

11. **Activity logging is fire-and-forget** — `utils/logActivity.js` writes to `activity_logs` collection with 90-day TTL; never blocks the request.

12. **Modular Options tab** — split from monolith into `app/components/options/` with hooks, types, constants, utils for maintainability.

13. **Sensibull-style options UI** — strategy presets, live chain modal, payoff chart, Greeks panel, charges modal, AI insights, P&L grid, BottomTabs for positions/orders/portfolios/review.

14. **Auto-expiry cron at 10:30 PM IST** — uses `holdingDuration` parsed from setup with 20% buffer to mark stale setups closed.

15. **Holiday-aware crons** — `holidayService.js` fetches NSE holidays daily, all market crons skip on holidays/weekends.

16. **Token conservation rules (R1–R10)** — minimal narration, batch tool calls, prefer dedicated tools, no unnecessary file reads.

17. **Backups before risky changes** — `.bak` files created before every major refactor (some still in repo, see cleanup).

---

## 10. CURRENT STATE (where we left off)

**Date:** 2026-04-10
**Branch:** `feature/options-tab-sensibull`
**Last commit:** `8d6332f` — feat: Screener.in fundamentals, Activity tab, Options live P&L, AI ranking fixes (pushed to GitHub)

### What just got fixed in the latest session:
1. ✅ Screener.in `fetchCompanyFundamentals()` rewritten — uses HTML `#top-ratios` scraping, verified working for RELIANCE/TCS/SHAILY (P/E 64.9 exact match)
2. ✅ AI ranking batched in chunks of 25, `max_tokens=5000`
3. ✅ Trade setup pre-filters active trades before Perplexity call
4. ✅ Options live P&L via independent polling endpoint `/api/options/positions-ltp`
5. ✅ Activity Summary tab + `logActivity` util + `activitySummary.js` route
6. ✅ Search exchange filter fixed
7. ✅ BSE-code stock handling
8. ✅ Screener pagination fix (`consecutiveEmptyPages`)
9. ✅ GitHub backup pushed

### Phase 1 QA Audit — COMPLETE (results below in Known Issues)
### Phase 2 Dead Code Audit — INCOMPLETE (agent hit rate limit)
### Phase 3 Documentation — IN PROGRESS (this blueprint is the first doc)

### Immediate next steps:
1. **Re-run Phase 2 dead code audit** in a new session (agent hit rate limit)
2. **Generate remaining /docs files:**
   - README.md
   - ARCHITECTURE.md
   - API_INTEGRATIONS.md
   - DATA_SCHEMA.md
   - AI_MODELS.md
   - USAGE_GUIDE.md
   - CHANGELOG.md (append session entry)
   - TESTING.md (sync with Phase 1 results)
   - REPRODUCIBILITY_GUIDE.md
   - PROMPT_BACKUP.md (master recreation doc)
   - CLEANUP_REPORT.md (from Phase 2 output)
3. **Decide whether to fix the broken backend routes** in main project (this worktree is fine — broken routes are in `E:\Dashboard_project Latest\dashboard_project\` not the worktree)
4. **Lovable UI reskin** — pending Lovable credits

---

## 11. KNOWN ISSUES / TODOs

### CRITICAL (from Phase 1 audit — affects MAIN project at `E:\Dashboard_project Latest\dashboard_project\`, NOT the worktree)
1. ❌ `routes/screens.js` — broken `require('../../services/upstoxService')` (should be `../services/upstoxService`) + destructured `{ upstoxService }` import but module exports default. **Top-level require, kills entire route file load.** *(Note: in user's actual main project this was fixed by adding `express.Router()` but the upstoxService require may still be wrong.)*
2. ❌ `routes/upstox.js` — same broken require pattern. Kills `/api/upstox/*` endpoints.
3. ❌ `routes/healthCheck.js` — same broken require pattern. Kills `/api/health-check/upstox`.
4. ⚠️ `server.js` line 55 — `require('../services/upstoxService')` wrong path + `initializeUpstoxClient` does not exist. Fails silently in try/catch. Upstox client never initialized at startup.

### MODERATE
5. ⚠️ `services/claudeService.js` — orphan, not imported by any route
6. ⚠️ PORT default in `server.js` is 5001 but `.env` says 5002 — works only if `.env` loads
7. ⚠️ `tailwind.config.ts` missing `darkMode: 'class'` — ~440 `dark:` Tailwind classes are non-functional; only globals.css overrides work
8. ⚠️ Layout padding mismatch — system bar (28px) + nav (48px) = 76px total but `pt-[68px]` only offsets 68px, ~8px overlap

### Frontend Orphans (from Phase 1 audit)
9. ❌ `app/components/HeatMap.tsx` — only imported by orphan HeatMapTest/WatchlistHeatMapExample
10. ❌ `app/components/HeatMapTest.tsx` — orphan
11. ❌ `app/components/WatchlistHeatMapExample.tsx` — orphan
12. ❌ `app/components/ScreenerTab.tsx` (old, in root components/) — superseded by ScreensTab
13. ❌ `app/components/IntradayTab.tsx` — orphan
14. ❌ `app/components/LongTermTab.tsx` — orphan
15. ❌ `app/components/ClientOnly.tsx` — orphan
16. ❌ `app/components/HydrationErrorBoundary.tsx` — orphan
17. ❌ `app/components/PriceChart.tsx` — orphan
18. ❌ `app/components/HistoricalChartWidget.tsx` — orphan
19. ❌ `app/components/OptionsTab.tsx` (old monolith in root components/) — orphan, page.tsx uses `./components/options/OptionsTab` instead
20. ❌ `app/lib/tradingSignalsService.ts` — orphan
21. ⚠️ `app/lib/screenerService.ts` — only imported by orphan ScreenerTab
22. ⚠️ `app/lib/watchlist.ts` — only imported by orphan HeatMap files

### Backup Files to Clean
23. `backend/routes/screens.js.bak`
24. `backend/routes/tradeSetup.js.bak`
25. `backend/services/screenerFetchService.js.bak`
26. `app/components/ScreensTab.tsx.bak`

### Other TODOs
27. **Phase 2 dead code audit** — re-run in new session (rate-limited)
28. **Document remaining /docs files** — see Section 10 step 2
29. **Fix broken main-project backend routes** (separate from worktree)
30. **Resolve dark mode inconsistency** — either add `darkMode: 'class'` and remove globals.css overrides, OR remove all `dark:` Tailwind classes
31. **Lovable UI reskin** — pending credits
32. **MongoDB free forever** — confirmed no need to migrate to Atlas
33. **Token conservation** — user is on 2% credits, all future work must batch tool calls and minimize narration

---

## APPENDIX — ENV VARIABLES (`backend/.env`)

```
PORT=5002
MONGODB_URI=mongodb://localhost:27017/stock_dashboard
JWT_SECRET=<secret>
PERPLEXITY_API_KEY=<key>
NEWS_API_KEY=<key>
UPSTOX_CLIENT_ID=<id>           # for OAuth flow
UPSTOX_CLIENT_SECRET=<secret>
UPSTOX_REDIRECT_URI=http://localhost:5002/api/upstox/callback
```

Plus persistent files:
- `backend/upstox-token.json` — `{ access_token, expires_at }`
- `backend/data/screener-creds.json` — `{ email, password, savedAt }`

---

## APPENDIX — CRITICAL FACTS (from CLAUDE.md)

- **MongoDB IS connected** on `localhost:27017/stock_dashboard` — NEVER tell user it's missing
- **Upstox token IS valid** (335 chars, expires ~2027)
- **188 instruments loaded in DB**
- **Backend port 5002**, frontend port 3000
- **All 20+ routes registered** in server.js (with the 3 broken ones noted above)
- **3 critical crons:** paper trade monitor (2min), auto-expiry (10:30 PM), screen scoring (11 PM)
- **Vinit is non-technical** — explain simply
- **Currency: INR**, Indian numbering
- **Market hours:** 9:15 AM – 3:30 PM IST, Mon–Fri
- **NEVER break working functionality**, ALWAYS verify after edits, conserve credits

---

**END OF BLUEPRINT** — This document + the CLAUDE.md file + the latest GitHub commit (`8d6332f` on `feature/options-tab-sensibull`) are sufficient to onboard a new Claude Code session.
