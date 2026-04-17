# STATE — Where the Project Stands Today

*Updated: 2026-04-17 (late night — FULL BLUEPRINT locked: 49 features, 4-bot architecture, 6-sprint plan)*
*Next update: end of next session*

> **📌 MUST READ FIRST in new session:**
> 1. [`BOT_BLUEPRINT.md`](BOT_BLUEPRINT.md) — canonical feature blueprint (49 features, architectural decisions)
> 2. This file — current state
> 3. [`ROADMAP.md`](ROADMAP.md) — sprint order
> 4. [`CHANGELOG.md`](CHANGELOG.md) — recent history (only if needed)

## 🎯 Vision (locked 2026-04-17 with user)

Build a personal AI-powered trading dashboard for Vinit (Indian retail, real-money real-capital trader) with:
- **4 fully separate bots** (swing stocks, long-term stocks, options selling, options buying), each with own capital, P&L, kill switch, validation path
- **Shared infrastructure** (scanner, validator, executor, risk engine, paper engine, strategy library, compliance log)
- **Hybrid strategy library** — 14 curated strategies + quarterly Perplexity additions
- **Realistic paper trading** — paper P&L within 5% of what live would be (slippage, STT, brokerage, GST, latency, circuits, tax tagging)
- **Hard-coded risk limits** — per-trade, daily, concurrent positions, sector exposure, kill switches
- **SEBI compliance from Day 1** — Algo-ID-ready logs, static IP, OAuth 2FA
- **Discipline enforcement** — execution checklist, position sizing gate, daily loss breaker, post-loss cooldown (applied to bot + manual trades)
- **Indian market data** — FII/DII, corp actions, sector rotation, bulk/block, regime engine
- **Parallel UI section** — "Bot Command Center" alongside existing Screens + AI workflow

## 📊 Capital progression plan (from user)

- Phase 1: Paper only, simulated capital (₹1L to ₹10L test portfolios)
- Phase 2: Real money starting ₹2.5L (1 lot equivalent)
- Phase 3: Scale to ₹20L, then ₹2cr, then beyond
- Each bot graduates independently based on its own validation data

---

## 🟢 What's Working Right Now

### Backend (port 5002)
- ✅ MongoDB connected (localhost:27017/stock_dashboard, 188 instruments)
- ✅ All 20+ route files registered in `server.js`
- ✅ **4 crons running**: paper-trade monitor (2min), auto-expiry (10:30 PM), screen scoring (11 PM), **daily IV snapshot (3:25 PM IST Mon-Fri, timezone-pinned)**
- ✅ WebSocket server live
- ✅ Upstox token valid until ~2027
- ✅ Redis optional — using in-memory cache (fine)
- ✅ `/api/options/*` — **12 endpoints** (chain, expiries, payoff, margin, AI analysis, trades, **iv-metrics, iv-snapshot**)

### Frontend (port 3000)
- ✅ Next.js 14 App Router
- ✅ 12 visible tabs wired up
- ✅ Paper trading with mock trades, auto-monitor, stats
- ✅ Options tab: Phases 1–4 complete + **Sensibull parity features #1, #2, #5 shipped** (2026-04-17)

### Options Tab — Current State
- ✅ Phase 1: Live option chain (Upstox v2), ATM highlight, PCR, Greeks toggle
- ✅ Phase 2: Strategy Builder with 6 presets, payoff chart, SD bands, breakevens, POP
- ✅ Phase 3: Margin calculator (Upstox), AI analysis (Perplexity)
- ✅ Phase 4: Mock options paper trading (open/close/delete, win-rate stats)
- ✅ **Sensibull #1**: OI Distribution chart (mirror horizontal bars, CE right/PE left, call/put walls)
- ✅ **Sensibull #2**: IV Rank / IV Percentile bar (live IV shown; IVR/IVP pending 30 days of daily snapshots — currently 2/30)
- ✅ **Sensibull #3**: Max Pain (chip + purple Y-axis marker + tooltip + InsightsPanel strategy-aware insight)
- ✅ **Sensibull #4**: PnL Table SD ↔ % toggle (± 5% / 2% / 1% / 0 rows via `customSpots` param)
- ✅ **Sensibull #5**: Target date P&L slider on payoff chart (pre-existing)

🎯 **Sensibull parity sprint is COMPLETE.** All 5 feature gaps identified via Comet browser analysis are now shipped.

---

## 🚀 Sprint 1 progress (started 2026-04-17 late night)

- ✅ #38 Data Health Panel — wired (top-level tab `data-health`)
- ✅ #40 Feature/Test Control Center — wired (top-level tab `control-center`)
- ✅ #39 Broker Readiness — covered by SystemHealthPanel (inside SettingsTab)
- ✅ **#13 Pre-Trade Gate — Phase 1 shipped.** Modal fires on Options "Trade All", records checklist via `/api/trade-checklist`. Not yet enforcing (Phase 2).
- ✅ **#15 Daily Loss Circuit Breaker — shipped.** `/api/risk/daily-pnl` auto-locks at 100% usedPct, full-page overlay blocks UI until midnight IST OR typed "UNLOCK" override (logged).
- ✅ **#17 Auto Journal (Phase 1) — shipped.** Every Options close creates enriched TradeJournalEntry via `/api/trade-journal/entry` with context snapshot (NIFTY level, more cheap context).
- ✅ **#18 Mistake Tagging — shipped.** MistakeTagModal forces tag selection before trade closes. `/api/trade-journal/mistake-stats` returns rupee attribution per category.
- ✅ **#14 Position Sizing Hard Gate — shipped.** PreTradeGate computes max-loss vs capital×riskPerTradePct, auto-syncs the "Risk acceptable" check, hard-blocks submit when violated (red "🚫 Blocked — Reduce Size" button).
- ✅ **#16 Post-Loss Cooldown — shipped.** 2 consecutive losses auto-trigger 30-min cooldown via `/api/trade-journal/entry`. Amber top banner with MM:SS countdown + one-click clear (lighter friction tier than full lock).

🎯 **Sprint 1 COMPLETE — 9 of 9 items done.**

### Post-Sprint 1 additions (per user's 5 new rules):
- ✅ **Help / Instructions Tab** — data-driven docs with 10 sections; per rule #4, every new feature must update `helpContent.ts`.
- ✅ **Cadence Registry** — 18 scheduled tasks (13 system crons + 5 user activities) with heartbeat + watchdog. Per rule #5, every new cron must register here.
- ✅ **Cadence Alerts Bell** — floating bell bottom-left, color-coded severity, one-shot toast on load, acknowledge button for user tasks.

Sprint 2 in progress (Indian feeds):
- ✅ **#26 FII/DII Dashboard** — NSE cookie-flow scraper + widget + 6:30 PM IST cron + Cadence Registry seeded.
- 🟡 #27 Corporate Actions + Earnings Calendar
- 🟡 #28 Sector Rotation Heatmap
- 🟡 #29 Bulk/Block Deals + Insider Trades
- 🟡 #30 Market Regime Engine
- 🟡 #16 Post-Loss Cooldown — next up
- 🟡 #17 Auto Journal — next up
- 🟡 #18 Mistake Tagging — next up

## 🟢 Pipeline State (2026-04-17 late night)

- ✅ TypeScript: GREEN
- ✅ ESLint: GREEN (new panels' unescaped-entities errors fixed)
- ✅ Backend Syntax: GREEN
- ✅ Smoke Tests: 17/17 PASSED (including new loopback-bypass check)
- ⏸ Next.js Build: not part of `:quick` (runs on full `npm run validate`)

**Dashboard is now in TRUSTED state.** Next backup taken from here will be marked trusted (no `--force`).

## 🔴 Known Issues (Not Critical)

1. Individual stock quotes from Upstox sometimes return null (RELIANCE, TCS, INFY, HDFC) — index prices unaffected
2. `Cannot read properties of null (reading 'error')` — null-check bug in market data refresh, core features still work
3. React 18 delegated events: `preview_click` tool can't trigger React state — workaround: use `data-testid` + 1400px viewport or test via API directly
4. ~~**Settings → API Keys UI requires login**~~ — **FIXED 2026-04-17** via localhost bypass in `backend/middleware/auth.js`. Loopback requests now get auto-populated `req.user` from first active MongoDB user. UI-driven key management works end-to-end.
5. ~~**Pre-existing ESLint debt (5 errors)**~~ — **FIXED 2026-04-17 late night.** 7 `react/no-unescaped-entities` errors across ControlCenterTab / DataHealthPanel / SystemHealthPanel resolved. ESLint is now GREEN. 8 React Hook `exhaustive-deps` warnings remain (warnings only, not errors — see CHANGELOG for full list).
6. **Auth token key mismatch** ~~(silent auth failure)~~ — **FIXED 2026-04-17 late night.** `apiService.ts` set `auth_token` but `APIKeysTab` + `SettingsTab` password-change read `token` (always null). Unified all reads to `auth_token`.

## 🔐 Security state (post 2026-04-17 audit)

- ✅ Old Perplexity API key (hardcoded in dead `/server.js`, line 40/41/87, in public GitHub history) has been **rotated by user**. New key in `backend/.env`. AI Analysis verified working end-to-end.
- ✅ Dead `/server.js` file deleted locally. **Not yet committed.** After commit + push, the file will no longer exist in future git clones BUT the old key will still be in commit history `4df7c40 Initial upload`. Acceptable since the key is already revoked.
- ✅ Rate limiter hardened: localhost bypass + 500/15min ceiling for remote (was 100/15min and was self-DoS-ing the UI).
- ✅ Auth middleware: localhost bypass added. Loopback callers get auto-populated `req.user` from first active MongoDB user. Settings → API Keys UI now works without a login form. Remote callers still go through full JWT verification.
- ⚠️ **Still open:** `/api/options`, `/api/trade-setup`, `/api/risk` mounted without `auth` middleware (server.js lines 193, 194, 197). Low risk on localhost. Fix before any deployment.
- ⚠️ **Still open:** 15+ stale MDs and orphaned components (alice-blue/, angelone/, APIKeysTab gate) identified by audit. Cleanup sprint proposed.

---

## 🚧 Currently Building — Options Tab Enhancements (Sensibull Parity)

**Goal:** Match Sensibull's options feature set so the tab is production-ready.
**Branch:** `feature/options-tab-sensibull` (checked out in main repo dir)

### Sensibull Gap Analysis

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| 1 | OI bar charts by strike (CE vs PE, color coded) | ✅ **Done 2026-04-17** | P0 |
| 2 | IV Rank / IV Percentile (vs 52-week) | ✅ **Done 2026-04-17** (building 30-day history) | P0 |
| 3 | Max Pain calculation + display | ✅ **Done 2026-04-17** (chip + Y-axis + insight) | P0 |
| 4 | P&L scenarios table (±5%, ±2%, ±1%, 0) | ✅ **Done 2026-04-17** (SD ↔ % mode toggle) | P1 |
| 5 | Target date P&L slider | ✅ Done (pre-existing) | — |

🎯 **All 5 Sensibull parity items shipped in one day.**

### Decisions Made
- **Branch:** Work on `feature/options-tab-sensibull` (existing code lives there)
- **PnLTable:** Add a toggle between SD mode and % mode (don't replace)
- **IV is stored as decimal** (0.168) not percentage (16.8); normalized on capture since Upstox option-chain returns percentage form
- **Spot resolution for IV snapshot:** caller → `marketDataService.getMarketData()` → liquid put-call parity → median strike
- **IVR/IVP show `—`** until ≥30 days of history; honest rather than fake

---

## ⏭️ Next 3 Immediate Actions

Sensibull parity sprint is complete. From here, pick from ROADMAP backlog:

1. **OI change (Δ OI) bars** (P1 next-sprint) — strongest sentiment signal for option sellers. Requires a new `OptionsOIHistory` model + a 3:30 PM IST snapshot cron to capture per-strike OI daily. Then render delta bars beside existing OI bars in OIDistributionChart.
2. **Volatility skew visualization** (P1) — plot IV across strikes in a mini chart. Exposes rich/cheap strikes for spread construction. Data already in the option chain — pure frontend work.
3. **Health-check cadence** — first scheduled IV snapshot cron run is 3:25 PM IST next trading day; confirm it fires cleanly and increments `historyDays` from 2 → 3. Establish a pattern for monitoring the 4 crons over time.

Or pivot to broader dashboard items: sector heatmap, AI ranking upgrade, news sentiment per stock. See ROADMAP § "Broader Dashboard — Short-term".

---

## 📋 Roadmap (After Options Tab)

### Short term (weeks)
- Sector heatmap on Dashboard
- AI ranking system for screens (better scoring)
- News sentiment per stock
- Restyle UI using Lovable project as reference

### Medium term (months)
- Strategy comparison (side-by-side payoff)
- Calendar/diagonal spread support in Options tab
- Historical IV chart
- Volatility skew visualization
- OI change visualization (vs yesterday)

### Long term
- Live Upstox order placement (currently paper trading only)
- WhatsApp alerts via Twilio
- Mobile PWA

---

## 📁 File Inventory

### Backend Routes (`backend/routes/`)
| Route file | Purpose |
|------------|---------|
| `options.js` | Option chain, expiries, payoff, margin, AI analysis, mock trades |
| `paperTrades.js` | Stock paper trading CRUD + monitor |
| `screens.js` | Upload Screener CSV, rank stocks |
| `alerts.js` | Price alerts CRUD |
| `news.js` | News fetch + sentiment |
| `ai.js` | Perplexity AI analysis |
| `upstox.js` | Upstox token + instruments |
| `portfolio.js` | Real holdings |
| `journal.js` | Trade journal |
| `market.js` | Indices, market status |
| `historical.js` | OHLCV candles |
| `search.js` | Instrument search |
| *(~8 more)* | Utility routes |

### Backend Services (`backend/services/`)
| File | Purpose |
|------|---------|
| `optionsService.js` | Upstox v2 option chain fetcher, 30s cache |
| `perplexityService.js` | AI wrapper |
| `upstoxService.js` | Upstox REST client |
| `newsService.js` | News fetcher |
| `screenScoringService.js` | Computes hit rates, scores screens |
| `paperTradeMonitorService.js` | Auto-monitor paper trades |

### Backend Utils (`backend/utils/`)
| File | Purpose |
|------|---------|
| `optionsMath.js` | Payoff, breakevens, max P/L, SD moves, Greeks aggregation, POP, **IV metrics (IVR/IVP)**, **Max Pain** |
| `trackAPI.js` | Tracks API usage for credit management |
| `marketHours.js` | IST market-open detection for cron guards |

### Backend Models (`backend/models/`)
| Model | Purpose |
|-------|---------|
| `OptionsTrade.js` | Options mock trade with legs subdocument |
| `OptionsPortfolio.js` | Group of option trades with aggregate P&L |
| `OptionsIVHistory.js` | **NEW 2026-04-17** — daily ATM IV snapshots (unique on underlying+date) |
| `PaperTrade.js` | Stock paper trade |
| `Screen.js` | Uploaded screen with stocks |
| `Alert.js` | Price alert |
| `Journal.js` | Trade journal entry |
| `Instrument.js` | Cached instrument list (188 loaded) |

### Frontend Components (`app/components/`)
| Component | Purpose |
|-----------|---------|
| `Navigation.tsx` | Tab registration |
| `OptionsTab.tsx` (legacy root) | Superseded by `options/OptionsTab.tsx` after refactor |
| `options/OptionsTab.tsx` | Top-level modular Options tab (LeftPanel + RightPanel + modals) |
| `options/LeftPanel.tsx` | Strategy builder column (header, IV bar, legs, actions, bottom tabs) |
| `options/RightPanel.tsx` | Analytics column with tabs: Payoff Graph, P&L Table, **OI Chart**, Greeks |
| `options/IVMetricsBar.tsx` | **NEW 2026-04-17** — live ATM IV + IVR + IVP with "Building history N/30" pill |
| `options/OIDistributionChart.tsx` | **NEW 2026-04-17** — horizontal mirror OI bar chart with call/put walls |
| `options/PnLTable.tsx` | 2D P&L grid (spot × days remaining) |
| `options/ChainModal.tsx` | Option chain picker with strike add/remove |
| `options/ChargesModal.tsx` | Brokerage + STT + charges breakdown |
| `options/GreeksPanel.tsx`, `InsightsPanel.tsx`, `StrategyHeader.tsx`, `StrategyControls.tsx`, `SummaryBar.tsx`, `LegsTable.tsx`, `ActionBar.tsx`, `BottomTabs.tsx` | Sub-components of the modular Options layout |
| `PayoffChart.tsx` | Recharts payoff curve + target-date slider (CE/PE split at zero, SD bands, breakevens, Greek cards) |
| `PaperTradingTab.tsx` | Stock paper trades UI |
| `DashboardTab.tsx` | Overview + top ideas |
| `ScreensTab.tsx` | CSV upload + ranked stocks |
| *(10 more tabs)* | One per visible tab |

### Critical Crons (4 total)
| Cron | Schedule | What it does |
|------|----------|--------------|
| Paper trade monitor | Every 2 min (market hours) | Checks SL/target hits |
| Auto-expiry | 10:30 PM daily | Expires stale trades |
| Screen scoring | 11 PM daily | Computes hit rates, scores screens |
| **Daily IV snapshot** (NEW 2026-04-17) | **3:25 PM IST Mon-Fri** (timezone-pinned `Asia/Kolkata`, holiday-aware) | Captures ATM IV for NIFTY/BANKNIFTY/FINNIFTY/SENSEX/MIDCPNIFTY → `OptionsIVHistory`; powers IV Rank/Percentile once 30+ days accumulate |

---

## 🔑 Environment Variables (in `backend/.env`)
- `UPSTOX_ACCESS_TOKEN` — 335 chars, valid ~2027
- `PERPLEXITY_API_KEY` — sonar-pro model
- `MONGODB_URI` — missing, uses localhost fallback (intentional, fine)

---

*When updating this file, preserve this structure. Move stale info to CHANGELOG.md.*
