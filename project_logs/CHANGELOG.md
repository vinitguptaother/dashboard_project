# CHANGELOG — Date-wise Session Log

*Append only. Never delete old entries. Newest at top.*

Format:
```
## YYYY-MM-DD — Session title
### Added
### Changed
### Fixed
### Broken / Known Issues
### Lessons learned
```

---

## 2026-04-17 (late night) — Full blueprint session: 49 features + 4-bot architecture locked

**No code changes this entry — pure planning session.** Output: `project_logs/BOT_BLUEPRINT.md` (new canonical document).

### Context
User asked to pause feature-building and design the complete dashboard vision. Session included: 3 parallel web research agents (Indian platforms, global pro platforms, retail trader voices + bots), analysis of user's 25-feature list, analysis of user's Claude-chat bot blueprint v1.0, back-and-forth clarification, final synthesis.

### Decisions locked
- 4 fully separate bots (swing / long-term / options-sell / options-buy) with shared libraries
- Hybrid strategy library (14 curated + quarterly Perplexity additions)
- Full realism paper trading (paper P&L within 5% of live — slippage, STT, brokerage, GST, latency, circuits, tax tagging)
- Manual per-bot capital allocation in Settings UI
- Graduation criteria for live: TBD (user decides when approaching live)
- SEBI compliance built from Day 1 (structured logs, prep for Algo-ID)
- UI: parallel "Bot Command Center" section alongside existing Screens + AI

### 49 features finalized across 11 categories
A: 4 Bots | B: 8 Bot Infra | C: 4 Discipline | D: 5 Journal | E: 4 AI | F: 5 Indian Feeds | G: 4 Alerts | H: 6 Workflow | I: 3 Options Depth | J: 3 Compliance+Tax | K: 3 Existing Keep+Enhance

### 6-sprint build order
- Sprint 1 (Weeks 1–3): Discipline loop + Data health
- Sprint 2 (Weeks 4–6): Indian market feeds
- Sprint 3 (Weeks 7–10): Bot infrastructure + SEBI
- Sprint 4 (Weeks 11–14): 4 Bots + first 6 strategies
- Sprint 5 (Weeks 15–16): Complete strategy library + start paper
- Sprint 6 (Weeks 17+): Enhancements + monitoring

### Key pushbacks on user's original blueprint (honest mentor mode)
- **Perplexity-as-strategy-discovery rejected** — LLMs output generic strategies with no edge. Replaced with curated library + Perplexity-as-context.
- **55% win rate threshold rejected** — not enough. Must include Sharpe, Sortino, profit factor, max DD, post-tax costs, walk-forward validation.
- **Upstox-LTP-as-paper-fill rejected** — creates 10–20% paper-vs-live gap. Full cost model required before real money.
- **"Learning engine" label softened** — it's statistical tracking, not ML. Don't oversell.
- **SEBI compliance added** — April 2026 rules require Algo-ID, static IP, OAuth 2FA, compliance logs. Must be Day-1.
- **Sample sizes increased** — 10 trades is noise. Minimum 30 trades for statistical significance, ideally 50+ per segment.

### Files created / updated
- `project_logs/BOT_BLUEPRINT.md` (NEW) — canonical source of truth
- `project_logs/ROADMAP.md` — added 49-feature summary, 6-sprint plan, architectural decisions
- `project_logs/STATE.md` — added vision section, master-reference pointers
- `project_logs/CHANGELOG.md` — this entry

### Lessons learned
- **User overwhelm is real.** First presentation of analysis was too dense ("this was too much for me to comprehend"). Second pass was visual + categorized + shorter — much better received.
- **Agent parallelism saved context.** 3 research agents in background kept main conversation lean while deep research happened.
- **Honest mentor > cheerleader.** User explicitly asked for honest analysis. Pushback on their blueprint was welcomed when accompanied by reasoning and alternatives.
- **"Keep a tab" is literal.** User said they won't remember decisions; depends on project_logs. Every decision must land in a persistent file.

### Open items for future sessions
1. User's additional bot ideas — user said they'd share more; treat this session's blueprint as v1 and merge in when user provides.
2. Strategy library details — 14 strategies need full rule coding (Sprint 4 starts this).
3. Graduation criteria — user to decide before bot goes live.
4. Capital allocation — user to set per bot in Settings UI once bots exist.

---

## 2026-04-17 — Options Tab Sensibull parity: #1–#4 complete + logs system + security cleanup (multi-part session)

**Branch:** `feature/options-tab-sensibull`

### Part 7: Auth localhost bypass — Settings → API Keys UI unlocked

User reported: "whenever I click on settings api I get an error 'Authentication required. Please log in first.'" — and earlier said they don't want to manually edit backend files.

#### Root cause
`backend/routes/envConfig.js` protects `GET /env`, `PUT /env`, and `/env/:key/reveal` with the `auth` middleware. Single-user dashboard on localhost has no login flow wired up for day-to-day use, so the UI showed an auth error every time. Same philosophical issue as the rate limiter earlier this session: requiring JWTs on a personal localhost dashboard is friction, not protection.

#### Changed
- `backend/middleware/auth.js` — added `isLoopback` check (mirrors the rate-limiter pattern):
  - On loopback requests (`::1`, `127.0.0.1`, `::ffff:127.0.0.1`), the middleware loads the first `isActive: true` user from MongoDB (cached in-module after first hit) and assigns it to `req.user`, then calls `next()`.
  - Non-loopback callers still go through the full JWT verification path — zero regression for any future remote access.
  - If no users exist yet (fresh install), the loopback path falls through to the JWT flow which cleanly 401s — letting signup/login endpoints bootstrap the first user.
- Comment explicitly notes the design intent so future-Claude / future-Vinit don't think this is a mistake.

#### Verified
- `curl http://localhost:5002/api/settings/env` → **200 OK** with masked key values (was 401).
- Browser: Settings → API Keys loads cleanly. Angel One, Upstox sections visible with masked values + "Click to edit" hints.
- User can now paste/update Perplexity, Upstox, Angel One keys directly from the UI — no more `.env` editing needed.

#### Why this is safe
- Loopback = "you're physically on this machine". If someone has that, they already have full access to `backend/.env`, MongoDB, everything.
- The auth middleware still enforces JWT on LAN/remote access, so any future port-forward or deployment stays protected.
- This is the standard pattern for dev-mode / single-user apps (Kibana, Grafana, etc. do similar).

### Part 6: Security cleanup + rate-limiter fix (post-audit)

Triggered by a deep dashboard audit (via Explore agent) that found two critical issues. Addressed both.

#### Removed
- **Root `/server.js`** (deleted, not committed yet) — dead file that had a hardcoded Perplexity API key on lines 40, 41, 87. Nothing referenced it; real backend is `backend/server.js`. The key was in public GitHub history (commit `4df7c40 Initial upload`) on the public repo `vinitguptaother/vinit-s-ai-stock-suggesting-dashboard`. Vinit rotated the key on Perplexity side.

#### Changed
- `backend/middleware/rateLimiter.js` — general limiter was **100 req / 15 min** (single-page-load-with-widgets = 20–30 requests; 3–4 page loads exhausted the limit; user got "Too many requests from this IP" errors in Settings → API Keys UI, which blocked key rotation via the intended flow).
  - **Added `isLoopback` skip rule** — bypass rate-limiter entirely for localhost (`::1`, `127.0.0.1`, `::ffff:127.0.0.1`). This is a personal dashboard, not exposed publicly.
  - **Raised max from 100 to 500** as a safety net for any non-loopback access.
  - Verified: burst-test of 10 rapid curl calls all return HTTP 200.
- `backend/.env` — `PERPLEXITY_API_KEY` updated to new rotated key (user edited directly; not exposed in code).

#### Fixed / Gotchas
- **Data loss scare (false alarm)** — user reported "all my screens are deleted" when Settings → API Keys showed auth/rate-limit errors. Direct MongoDB query confirmed all data intact: 8 screens, 29 screenbatches, 136 tradesetups, 7,758 instruments, 2 optionstrades, 3 optionsivhistories, etc. The "deleted" appearance was UI failing silently when API returned rate-limit errors.
- **Rate-limit symptom diagnosis** — earlier Options-tab verification used ~50 curl calls + many browser navigations which burned through the 100-req window. Fix prevents recurrence.
- **Settings → API Keys page requires login** — after rate-limit fix, page loaded but showed "Authentication required. Please log in first." Separate auth flow issue; user opted to edit `.env` directly this time rather than log in. **Future work:** make key management login-optional or seamless for single-user mode.
- **User typo in key paste** — initial `.env` entry had `pplx-pplx-` (double prefix). Caught on visual inspection before testing; user fixed.

#### Verified
- Backend restart clean (port 5002 listening, MongoDB connected, 7758 instruments, 4 crons scheduled).
- `POST /api/options/ai-analysis` with live strategy data returned a full Perplexity sonar-pro analysis with current VIX reading (17.70) and NIFTY movement (+2.98%). New key working end-to-end.
- Burst test on general limiter: 10/10 HTTP 200.

#### Lessons learned
- **Rate limiter defaults matter** — 100 req / 15 min is a reasonable default for multi-user APIs, but for a single-user dashboard with polling widgets, it produces self-DoS. Loopback bypass is the right fix; tuning up-only hides the real issue.
- **Audit depth pays off** — the leaked API key had survived multiple prior "security cleanup" commits. A thorough agent-driven audit with verification (don't trust, grep) found it in minutes.
- **"Data is gone" almost always means "UI couldn't load data" on a healthy MongoDB** — always query the DB directly before assuming loss.

### Part 5: Dashboard audit (post-sprint)

Used Explore agent to do a health audit of the entire dashboard. Score: 6.5/10.

#### Findings (all verified before acting)
- **CRITICAL:** Hardcoded Perplexity API key in root `/server.js` (verified: key present 3 times on lines 40/41/87; file is dead, nothing requires it; key IS in public GitHub history via `4df7c40 Initial upload`).
- **CRITICAL:** `/api/options`, `/api/trade-setup`, `/api/risk` mounted without `auth` middleware (verified: server.js lines 193, 194, 197 show bare mounts vs lines 173, 183, 184 which use `auth,` properly). Low risk today (localhost only), catastrophic if ever deployed.
- **Tech debt:** 5 ESLint errors + 8 React Hook exhaustive-deps warnings, all pre-existing.
- **Dead code candidates:** `app/components/ScreenerTab.tsx`, `HeatMapTest.tsx`, `WatchlistHeatMapExample.tsx`, legacy `app/components/OptionsTab.tsx`, `app/alice-blue/`, `app/angelone/`, `app/upstox-portfolio/`, 15+ stale MD files at root.
- **Inconsistencies:** auth middleware pattern (mount vs inline) varies across routes; error response shapes inconsistent; `.lean()` usage inconsistent.
- **Backed up** via `npm run backup:force` (UNTRUSTED because ESLint failed, not me). Snapshot at `F:\Dashboard backup\last-known-good` (commit 67884c1). Living blueprint regenerated: **31 routes, 18 models, 17 tabs**.

#### What's surprisingly good
- Options tab is genuinely Sensibull-parity, verified end-to-end.
- Crons are timezone-aware AND holiday-aware.
- Perplexity fallback sonar-pro → sonar-small is elegant.
- JWT_SECRET has no hardcoded fallback.
- Rate limiting in place (if overtuned).

#### Decisions
- Delete root `/server.js` (done this session, not committed yet — user will commit later).
- Fix rate limiter (done this session).
- Perplexity key rotation (user did; new key installed; AI verified).
- Multi-LLM support (Anthropic + OpenAI alongside Perplexity) deferred to later session per user's idea — `backend/services/claudeService.js` already stubbed, `envConfig.js` schema already handles arbitrary env vars, minimal refactor needed.

### Part 4: PnL Table SD ↔ % toggle (#4 in the Sensibull parity sprint)

#### Added
- `backend/utils/optionsMath.js` — extended `calculatePayoffGrid()` signature with new optional `customSpots` parameter. When provided, overrides the default ±2SD computation with caller-supplied spot prices. Otherwise behaves exactly as before (backward-compatible).
- `backend/routes/options.js` — `POST /api/options/payoff-grid` now accepts `customSpots` in request body and forwards it to the math util.
- `app/components/options/PnLTable.tsx` — full rewrite:
  - `mode: 'sd' | 'percent'` state with toggle pill (`[SD] [%]`) in the panel header (top-right).
  - % mode sends `customSpots: [spot × 1.05, 1.02, 1.01, 1.00, 0.99, 0.98, 0.95]` to backend.
  - Row labels in % mode show "+5%", "+2%", "+1%", "Spot", "-1%", "-2%", "-5%" with absolute spot as a small gray subtitle next to each.
  - Highlighted row in % mode is always the "Spot" (0%) row; in SD mode, finds the row closest to current spot (unchanged behavior).
  - Header subtitle explains current mode ("Spot rows span ±2 SD from current (IV-based)" vs "Spot rows are fixed percentages: ±5%, ±2%, ±1%, 0").
  - Column header label toggles between "Spot ↓ / Days →" (SD) and "Spot move ↓ / Days →" (%).
  - Grid rendering extracted into an inner `<PnLGrid>` subcomponent for readability.
- `role="tablist"` + `role="tab"` + `aria-selected` for keyboard/screenreader accessibility on the toggle.

#### Verified (live NIFTY, market open, Short Straddle 24200 CE/PE)
- Backend: sent `customSpots: [25462.5, 24735, 24492.5, 24250, 24007.5, 23765, 23037.5]` (spot 24,250, 4 DTE) → endpoint returned exactly 7 spots in the grid (matched the input). P&L values form a classic U: spot row has **+8,625** at expiry, ±5% rows have large negatives (-82.3K / -74.8K). Math correct for short-vol payoff.
- Frontend browser: clicked `%` toggle → grid re-fetched, rows now labeled "+5% 25,463", "+2% 24,735", "+1% 24,493", "Spot 24,250", "-1% 24,008", "-2% 23,765", "-5% 23,038". Spot row highlighted yellow with blue dot. Expiry column shows +22.4K at Spot, -56.5K at ±5% — aligns with the left-panel "PROFIT LEFT +₹22.4K" summary. Toggling back to SD mode restores the ±2SD spot range.

#### Fixed / Gotchas
- **Backend started with plain `node` not nodemon** — after edit, the process didn't pick up the `customSpots` param. Had to `Stop-Process` and restart. For future sessions: prefer `nodemon server.js` or use the existing `npm run backend:dev` script.
- **Backward compatibility** — kept `spotSteps` param working for legacy callers (SD mode still uses it). Only new `customSpots` path is new. No other callers of `calculatePayoffGrid` needed updating.

#### Design decisions
- **Toggle, not replace** — preserves existing SD view for users who want IV-implied ranges. % mode is Sensibull-style fixed moves. Both modes share the same endpoint, grid component, and colorization.
- **Row labels keep absolute spot visible** in % mode as a small subtitle. Some users think in points/levels; others in %. Showing both is better than forcing one.
- **The "Spot" row** in % mode is labeled "Spot" (not "0%") for human readability. It's still the 0%-offset mathematically.

### Part 3: Max Pain (#3 in the Sensibull parity sprint)

#### Added
- `app/components/options/utils.ts` — `calculateMaxPain(strikes)` pure function with JSDoc rationale (market-maker pin thesis). Returns `{ maxPainStrike, totalPain, painByStrike }`.
- `backend/utils/optionsMath.js` — parity implementation of `calculateMaxPain` for server-side use (future endpoints or insights).
- `app/components/options/OIDistributionChart.tsx`:
  - Max Pain computed from the **full chain** (not just 21 visible strikes — far-OTM OI materially shifts max pain).
  - New summary chip **MAX PAIN** (purple color variant, replaces "Total CE OI" which was less actionable). Sublabel shows `±X.XX% from spot`.
  - Y-axis label for max-pain strike rendered in **purple** (`#a855f7`), bold, larger font. Color priority: ATM (blue) → Max Pain (purple) → Wall (amber).
  - Tooltip adds `◆ Max Pain (Expected pin)` line when hovering the max-pain strike.
  - Footer legend updated with colorized inline spans.
- `app/components/options/InsightsPanel.tsx` — strategy-contextual Max Pain insight. Three tiers:
  - Within 0.5% → "Spot near Max Pain" (green success if short-vol strategy, blue info otherwise)
  - Beyond 2% → "Spot well above/below Max Pain" (amber warning with drift direction + DTE-sensitive pin-effect note)
  - In between → neutral info
- `app/components/options/RightPanel.tsx` — threads `chain` + `spotPrice` props to InsightsPanel so the new insight can compute.

#### Verified (live NIFTY, market-open)
- Backend unit test: synthetic chain with peak CE OI at 25000 + peak PE OI at 24000 → max pain correctly at 24500 (midpoint).
- Live: NIFTY Max Pain = 24,200, spot = 24,250 (market just opened 5h 21m). Distance: -0.21%. Top-5 strikes by lowest pain form a clean U-curve: 24200 (6.66B), 24150 (7.15B), 24250 (7.30B), 24100 (8.02B), 24300 (8.39B).
- Browser: all 4 chips render (MAX PAIN 24,200 purple, CALL WALL 24,200 green, PUT WALL 24,200 red, PCR 0.85 gray). Interesting market state — call wall + put wall + max pain all at same strike = classic pinning scenario.
- InsightsPanel for Short Straddle: fires "Spot near Max Pain (24,200) · Favorable for this short-vol strategy" as success-type (green). Strategy-aware logic works.

#### Fixed / Gotchas
- **Dev servers were killed** mid-session (user's doing or system restart — all node processes were gone). Had to restart `node backend/server.js` (background) + `npm run dev`. Backend reconnected to MongoDB cleanly, instruments DB had grown to 7758 loaded. Frontend started in 2.5s.
- **Max Pain must use FULL chain** — first iteration I was going to compute from `chartData` (21 visible strikes) but that would miss far-OTM OI. Switched to `chain.strikes` in a separate useMemo so `chartData` depends on `maxPain`.
- **Color priority matters** — when ATM strike equals Max Pain strike equals Call Wall (unusual but possible), only one color shows. Rule: ATM > Max Pain > Wall. Today's live data had CW=PW=MP=24,200 but ATM=24,250 so both purple and blue visible cleanly.

### Part 2: Dashboard log system (meta-work for persistent memory)

#### Added
- `project_logs/ROADMAP.md` (new) — active sprint, next sprint, short/long-term backlog, captured ideas, retired ideas. Per-feature: why + rough scope. Claude maintains this when plans are made.
- `.claude/settings.json` (new) — Stop hook that runs `git status --porcelain`; if modifications exist, outputs JSON with `systemMessage` (brief UI nudge) + `hookSpecificOutput.additionalContext` (detailed reminder injected into Claude's next-turn context). Silent on clean tree (no Q&A spam).

#### Changed
- `CLAUDE.md` — replaced brief end-of-session line with a detailed non-negotiable rule covering CHANGELOG, STATE, ROADMAP update requirements. Added a pointer section explaining the `project_logs/` vs `docs/LIVING_BLUEPRINT.md` split so future Claude sessions don't duplicate.
- `project_logs/STATE.md` — bumped cron count 3 → 4, endpoint count 10 → 12, added OI Chart + IV Bar + Max Pain to "Working" section; updated file inventory with new models (OptionsIVHistory), components (OIDistributionChart, IVMetricsBar), and the 4th cron (Daily IV snapshot); updated "Next 3 Actions" to focus on remaining #4 (PnL table SD/% toggle) and health-checks.
- `project_logs/CHANGELOG.md` — this entry.

#### Fixed / Gotchas
- **Almost created a duplicate** `docs/DASHBOARD_LOG.md` before realizing `project_logs/` already existed from a 2026-04-16 setup. Deleted the duplicate before proceeding. Lesson: `ls project_logs/` should be a first-session check.
- **Stop hook watcher caveat** — Claude Code's file watcher only monitors directories that had a settings file when the session started. The hook is written correctly, but may need the user to open `/hooks` once or restart Claude Code to activate the new hook.

### Part 1: OI Distribution + IV Rank/Percentile (#1, #2)

**Branch:** `feature/options-tab-sensibull`

### Added — Backend
- `backend/models/OptionsIVHistory.js` — Mongoose schema for daily ATM IV snapshots. Unique on `(underlying, date)` so snapshot capture is idempotent.
- `backend/services/optionsService.js`:
  - `_extractATMIV(chain, spot)` — finds ATM strike, reads CE IV and PE IV, averages them. **Normalizes to decimal form** (Upstox's option-chain endpoint returns IV as percentage e.g. 16.54, not 0.1654 — we divide by 100 when > 1 so downstream Black-Scholes math stays correct).
  - `captureIVSnapshot(underlying, spotPrice=null)` — fetches nearest expiry + chain, resolves spot via `marketDataService.getMarketData(underlying)` (falls back to put-call parity on liquid strikes only, then median strike as last resort), upserts into OptionsIVHistory.
- `backend/utils/optionsMath.js` — added `calculateIVMetrics(currentIV, history)`:
  - IV Rank = (current - 52w low) / (52w high - 52w low) × 100
  - IV Percentile = % of past days where IV < current
  - Returns `isSufficient: history.length >= 30`
- `backend/routes/options.js`:
  - `GET /api/options/iv-metrics/:underlying?spotPrice=N` — auto-captures today's snapshot if missing, returns `{ currentIV, ivRank, ivPercentile, high52w, low52w, avgIV, historyDays, isSufficient }`
  - `POST /api/options/iv-snapshot/:underlying` — manual trigger (testing/backfill)
- `backend/server.js` — **4th critical cron**: daily IV snapshot at `25 15 * * 1-5` pinned to `Asia/Kolkata` timezone. Captures NIFTY/BANKNIFTY/FINNIFTY/SENSEX/MIDCPNIFTY. Holiday-aware (skips via `isMarketOpen` check).

### Added — Frontend
- `app/components/options/OIDistributionChart.tsx` — horizontal mirror bar chart:
  - Recharts BarChart with `layout="vertical"`, PE OI as negative (extends left, red), CE OI positive (extends right, green)
  - 21 strikes centered on ATM
  - Summary chips: Call Wall, Put Wall, Total CE OI, PCR with bullish/bearish/neutral interpretation
  - ATM strike in blue; Call/Put walls in amber with darker bar fill + tooltip markers
- `app/components/options/IVMetricsBar.tsx` — compact inline bar below StrategyHeader:
  - Shows `IV 16.8% | IVR — | IVP — | [amber: Building history 1/30]` until ≥30 days
  - After threshold: color-coded stance pills (IVR < 30 = green "IV Cheap — favor buying", > 70 = red "IV Rich — favor selling")
  - Info tooltip explains metrics + 52w range + avg
  - Auto-refetches on `(underlying, spotPrice)` change

### Changed
- `app/components/options/RightPanel.tsx` — added "OI Chart" tab between "P&L Table" and "Greeks"; `RightTab` type now `'payoff' | 'pnl' | 'oi' | 'greeks'`
- `app/components/options/LeftPanel.tsx` — imports + renders `<IVMetricsBar underlying={...} spotPrice={...}/>` directly below `<StrategyHeader>`

### Fixed / Gotchas
- **Upstox IV format varies** — option-chain endpoint returns percentage (16.54) while contract-detail returns decimal. Solution: normalize with `v > 1 ? v/100 : v` in `_extractATMIV`.
- **Illiquid strikes as ATM candidates** — initial fallback (min |CE LTP - PE LTP|) picked strikes where both LTPs were 0 (illiquid far-OTM). Fixed by filtering to `ltp > 0` on both sides before put-call parity scan, and preferring `marketDataService.getMarketData()` result first.
- **Stale display on underlying switch** — when changing dropdown from NIFTY → BANKNIFTY, the IVMetricsBar briefly shows the previous underlying's IV. Self-corrects after the effect's refetch completes. Not a bug, just a latency between state and fetch.
- **Recharts negative-width rects** — horizontal bars with negative values render as `<path>` elements (not `<rect>`), so DOM-level `width="-N"` is OK; bars are visible via path `d` attribute. Verified via in-page JS inspection.

### Verified in browser (Chrome MCP)
- OI Chart tab renders with 21 strikes, ATM highlighted, call/put walls visible
- NIFTY IV metrics: 16.8% live (spot 24,150, ATM strike 24,200, atmIV 0.16775)
- BANKNIFTY IV metrics: 21.4% live (spot 56,100, ATM strike 56,100, atmIV 0.21435)
- "Building history 1/30" pill shows correctly; IVR/IVP show `—`
- Backend auto-captured today's NIFTY + BANKNIFTY snapshots on first endpoint hit

### Key design decisions
- **IV stored as decimal**, not percentage — keeps BS pricing, SD moves, target-date payoff math consistent with existing code
- **Spot resolution priority:** caller-provided → `marketDataService` → liquid put-call parity → median strike
- **30-day minimum** for IVR/IVP meaningfulness — below threshold, show honest `—` + amber pill, never fake numbers
- **3:25 PM IST snapshot** — just before market close so IVs reflect full day's trading
- **ATM IV = average of CE IV and PE IV** at the strike closest to spot (nearest expiry) — simple and robust to single-sided illiquidity (averages over whichever is nonzero)

### Plans made
- Next: **#3 Max Pain calculation** — sum of option-writer losses at each strike, min = max pain strike. Display as summary chip + vertical line on OI chart.
- After #3: **#4 P&L table SD/% toggle** — add fixed-% rows (±5/2/1/0/-1/-2/-5) alongside existing SD-based rows.
- **Logging system refresh** (this session's meta-work) — user asked for a log file; discovered `project_logs/` already exists from 2026-04-16 setup but hasn't been maintained post-setup. Consolidated by updating STATE.md + CHANGELOG.md + adding new ROADMAP.md, rather than duplicating with a new file.

### Lessons learned
- **Check for existing systems before building parallel ones** — I nearly created `docs/DASHBOARD_LOG.md` before finding `project_logs/`. Grep/ls first.
- **Worktree branches can predate the actual work** — this session's worktree (`claude/heuristic-archimedes`) was branched from a pre-Options commit. The real Options code lives on `feature/options-tab-sensibull` checked out in the main repo dir. Verified via `git worktree list` and `git ls-tree`.
- **HMR picks up changes across worktrees if the dev server runs from the target branch's directory** — my edits landed in the main repo dir where `next dev` was already running; no restart needed.

---

## 2026-04-16 — Project logs system + thread handoff

### Added
- `project_logs/` folder with 4 files: README, BLUEPRINT, STATE, CHANGELOG
- System for Claude Code to maintain cross-session memory

### Changed
- `CLAUDE.md`: updated "11 visible tabs" → "12 visible tabs" (Options was added in previous session)

### Lessons learned
- **Memory files auto-load** in same project folder across Claude Code sessions — but only for Claude Code, not for other AI platforms
- **Single monolithic CLAUDE.md gets stale fast** — splitting into evergreen (BLUEPRINT) + current state (STATE) + append-only history (CHANGELOG) is cleaner
- **Token efficiency**: reading 5KB of structured logs at session start >> rebuilding 50KB of context through questions

---

## 2026-03-31 — Options Tab Phases 1–4 (Sensibull-style)

### Added — Backend
- `backend/services/optionsService.js` — Upstox v2 option chain fetcher with 30s in-memory cache
  - Methods: `getOptionChain`, `getExpiries`, `getContractDetails`, `buildInstrumentKey`
  - Underlying map: NIFTY → `NSE_INDEX|Nifty 50`, BANKNIFTY → `NSE_INDEX|Nifty Bank`
  - Computes PCR (put/call OI ratio)
- `backend/utils/optionsMath.js` — Payoff math
  - `calculatePayoff(legs, spotMin, spotMax, steps=200)`
  - `calculateBreakevens(payoffData)` — linear interpolation zero-crossings
  - `calculateMaxProfitLoss` — detects unlimited at edges
  - `calculateSDMoves(spot, iv, daysToExpiry)` — 1SD/2SD bands
  - `aggregateGreeks(legs)` — net delta/theta/gamma/vega
  - `calculatePOP` — normal CDF via Abramowitz & Stegun
- `backend/models/OptionsTrade.js` — Mongoose schema with nested `legs[]` subdocument
- `backend/routes/options.js` — 10 endpoints:
  - `GET /expiries/:underlying`
  - `GET /chain/:underlying?expiry=`
  - `GET /contract/:instrumentKey`
  - `POST /payoff`
  - `POST /margin` (Upstox `/v2/charges/margin`)
  - `POST /ai-analysis` (Perplexity sonar-pro with market context)
  - `GET /trades`, `POST /trades`, `PUT /trades/:id`, `DELETE /trades/:id`
  - `GET /trades/stats` (win rate, total P&L)

### Added — Frontend
- `app/components/OptionsTab.tsx` (~700+ lines)
  - State: underlying, expiries, chain, spot, legs, payoff, margin, aiAnalysis, trades, stats
  - 6 STRATEGY_PRESETS (Short Straddle, Strangle, Iron Condor, etc.)
  - Synthetic spot estimation: `min |CE LTP - PE LTP|` (put-call parity)
  - Paper-trade-this-strategy button
- `app/components/PayoffChart.tsx`
  - Recharts AreaChart with green/red split at zero P&L (`gradientOffset = max/(max-min)`)
  - ReferenceLines for spot, breakevens, 1SD/2SD
  - Greek cards (Delta/Theta/Gamma/Vega)

### Changed
- `backend/server.js` — registered `app.use('/api/options', require('./routes/options'))`
- `app/components/Navigation.tsx` — added Options tab with TrendingUp icon (visible)
- `app/page.tsx` — added `case 'options': return <OptionsTab />`
- `.claude/launch.json` — added backend launch config on port 5002

### Fixed / Gotchas
- **Route ordering bug**: `GET /trades/stats` must be registered BEFORE `GET /trades/:id` — Express matches in order, or `:id` captures "stats"
- **Synthetic spot from chain**: no direct spot in option chain response — solved via put-call parity (strike where |CE-PE| is minimized)
- **Unlimited P/L detection**: flag when max/min occurs at first/last data point

### Lessons learned
- **preview_click doesn't work with React 18's delegated event system** — use coordinates at 1400px viewport with `data-testid`, or verify via API curl
- **Server IDs expire** after stop — don't reuse old IDs, always `preview_start` fresh
- **30s cache on option chain** is enough — Upstox rate limits will hit otherwise
- **Mock trades need `closedAt` timestamp** set when `status = 'closed'`

### Pending (moved to STATE.md roadmap)
- OI bar charts by strike
- IV Rank / IV Percentile
- Max Pain (exists in CLI, not wired)
- P&L scenarios fixed % mode toggle
- Strategy comparison, calendar/diagonal spreads, historical IV chart

---

## Older history

### Backup 9 milestone (before 2026-03-31)
- Hit Rate Tracking
- Today's Top Ideas panel
- Active Idea Batches counter
- Stats dashboard
- *(This is the baseline the current project is forked from — folder name reflects this)*

---

*When adding a new session entry, put it at the TOP (newest first).*
