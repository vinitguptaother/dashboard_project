# ROADMAP — Planned Features & Ideas

*Updated: 2026-04-17 (late night — FULL BLUEPRINT locked with Vinit: 49 features + 4-bot architecture)*

> **📌 MASTER REFERENCE: [`BOT_BLUEPRINT.md`](BOT_BLUEPRINT.md)** — canonical document with all 49 features, architectural decisions, sprint order, and locked choices. Read this first if context was lost.

## 🎯 The 49-feature blueprint (summary)

- **A. 4 Bots (4 features)** — Swing, Long-term, Options Sell, Options Buy — each with own capital, kill switch, P&L, strategy list
- **B. Bot Core Infra (8 features)** — Scanner, Validator, Executor, Strategy Library, Realistic Paper, Risk Engine, Kill Switches, Learning
- **C. Discipline (4 features)** — Execution Checklist, Position Sizing Gate, Daily Loss Breaker, Post-Loss Cooldown
- **D. Journal (5 features)** — Auto Journal, Mistake Tagging, Trade Replay, Strategy Performance Lab, Screen Outcome Tracker
- **E. AI (4 features)** — Better Prompts, Reasoning Transparency, Confidence Scores, Consistency Checker
- **F. Indian Feeds (5 features)** — FII/DII, Corp Actions, Sector Rotation, Bulk/Block, Market Regime Engine
- **G. Alerts (4 features)** — Price/Sound, Event Triggers, Telegram, Daily Brief
- **H. Workflow (6 features)** — Idea Queue, Saved Layouts, Portfolio Risk, Data Health, Broker Readiness, Control Center
- **I. Options Depth (3 features)** — Portfolio Greeks+Correlation, IV Rank/Term/Skew, Simulator Enhancements
- **J. Compliance+Tax (3 features)** — Tax P&L Tagger, Quicko Export, SEBI Compliance Log
- **K. Existing Keep+Enhance (3 features)** — Options Tab (Sensibull), Screen Scoring, Paper Trading Tab

## 🔒 Architectural decisions (locked, do not re-debate)

| Decision | Locked choice |
|---|---|
| Bot architecture | 4 fully separate bots with shared infrastructure |
| Strategy library | Hybrid: 14 curated + quarterly Perplexity additions |
| Paper trading realism | Full realism (slippage + costs + latency + tax) |
| Capital allocation | Manual per-bot in Settings UI |
| Graduation criteria | TBD — user decides when approaching live |
| SEBI compliance | Build from Day 1 |



> **Purpose:** Captures every feature, enhancement, or idea that Vinit and Claude discuss but haven't yet built. Organized by when it's likely to ship. **Maintained by Claude** — when we agree on something new during a session, it lands here before the session ends.
>
> **Sources of truth for other info:**
> - `STATE.md` — what's working today
> - `CHANGELOG.md` — what shipped when
> - **This file** — what's planned and why

---

## 📋 Build Order (6 sprints to paper-ready, then TBD weeks to live)

**Sprint 1 (Weeks 1–3): Discipline loop + Data health**
Items: 13 Execution Checklist, 14 Position Sizing Gate, 15 Daily Loss Breaker, 16 Post-Loss Cooldown, 17 Auto Journal, 18 Mistake Tagging, 38 Data Health Panel, 39 Broker Readiness

**Sprint 2 (Weeks 4–6): Indian market feeds**
Items: 26 FII/DII, 27 Corp Actions Calendar, 28 Sector Rotation, 29 Bulk/Block Deals, 30 Market Regime Engine

**Sprint 3 (Weeks 7–10): Bot infrastructure + SEBI compliance**
Items: 5 Scanner, 6 Validator, 7 Executor, 9 Realistic Paper Engine, 10 Risk Engine, 11 Kill Switches, 46 SEBI Compliance Log

**Sprint 4 (Weeks 11–14): 4 Bots + first 6 strategies + Learning Engine**
Items: 1 Swing Bot, 2 Long-term Bot, 3 Options Sell Bot, 4 Options Buy Bot, 8 Strategy Library (partial — 6 strategies), 12 Learning Engine

**Sprint 5 (Weeks 15–16): Complete Strategy Library + Start Paper Trading**
Items: 8 Strategy Library (remaining 8 strategies) + begin paper trading

**Sprint 6 (Weeks 17+): Enhancements + monitoring**
Items: 19 Trade Replay, 20 Strategy Perf Lab, 21 Screen Outcome Tracker, 22–25 AI enhancements, 31–34 alerts/brief/telegram, 35 Idea Queue, 36 Saved Layouts, 37 Portfolio Risk, 40 Control Center, 41–43 Options depth, 44–45 Tax

**Live graduation:** only after 50+ trades per segment + user decides validation bar.

---

## 🟢 Completed Sprint — Options Tab Sensibull Parity (ALL SHIPPED 2026-04-17)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | OI bar charts by strike | ✅ Done | Mirror horizontal bars in OI Chart tab |
| 2 | IV Rank / IV Percentile | ✅ Done | IV Metrics Bar below StrategyHeader; history building (2/30 days) |
| 3 | Max Pain calculation | ✅ Done | Purple chip + Y-axis marker + strategy-aware InsightsPanel insight |
| 4 | P&L table SD ↔ % toggle | ✅ Done | `[SD] [%]` toggle in PnLTable header; backend `customSpots` param |
| 5 | Target date P&L slider | ✅ Done (pre-existing) | Blue dashed curve on payoff chart |

🎯 **Sprint retrospective:** Five items planned, five items shipped in a single day. Verified in browser against live NIFTY market-open data. All changes on `feature/options-tab-sensibull`.

---

## 🟡 Next Sprint — Post-Parity Enhancements

| Feature | Why | Rough scope |
|---------|-----|-------------|
| **Historical IV chart** | Once 60+ days of `OptionsIVHistory` accumulate, Vinit can see IV trends for each underlying — essential for timing long-vol vs short-vol trades | New tab or collapsible panel under Options. Line chart of daily ATM IV. Shade current IV's position in the range. |
| **Volatility skew visualization** | Shows IV smile/smirk across strikes → identifies rich/cheap options for spreads | Mini chart inside OI panel or new tab. Scatter/line of IV vs strike with ATM marker. |
| **OI change (Δ OI) bars** | Today's OI build-up vs yesterday's — the strongest sentiment signal for option sellers | Requires new daily snapshot cron at 3:30 PM for per-strike OI. New model `OptionsOIHistory`. Render delta bars beside existing OI bars. |
| **Strategy comparison** | Side-by-side comparison of 2 strategies (e.g. Iron Condor vs Iron Butterfly at same expiry) | Add "Compare" button in ActionBar → opens split view with 2 payoff curves + matrix of max P/L / margin / POP for each |
| **Calendar / diagonal spread support** | Enables selling near-term + buying far-term on same underlying | `StrategyLeg.expiry` field already exists. UI needs per-leg expiry picker. Payoff math needs time-decay-per-leg (already handled by `calculatePayoffAtDate`). |
| **UI reskin via Lovable project** | Polished visual design | Waiting on Lovable credits refresh. Will migrate styling tab-by-tab from `vinit-s-ai-stock-suggesting-dashboard-main.zip` |

---

## 🟢 Broader Dashboard — Short-term

- **Sector heatmap on Dashboard** — visual representation of NSE sector performance
- **AI ranking system upgrade** — better scoring for screened stocks (factor in FII activity, insider trades)
- **News sentiment per stock** — pull ticker-specific sentiment from news feed, surface on Watchlist
- **Live Upstox order placement** — currently paper trading only; add real-money pipeline with confirmation guards
- **WhatsApp alerts via Twilio** — SL/target hit notifications to phone

---

## 🔵 Broader Dashboard — Long-term

- **Mobile PWA** — install-to-homescreen support; responsive layout audit
- **AI Chatbot in-app** — ask questions about the portfolio / current setups / market state
- **Backtesting engine** — replay screens on historical data to validate before trading
- **Multi-broker support** — Alice Blue / Angel One (partially explored, see README) alongside Upstox
- **Live options auto-hedging** — when a position's delta drifts, suggest hedge legs

---

## 💭 Ideas captured but not yet scoped

*(When Vinit and Claude discuss an idea during a session without committing to build it, it lands here. Add date + 1-line context.)*

- **2026-04-17** — User mentioned wanting a "log file that records everything". Resolved by populating this file + STATE.md + CHANGELOG.md (not by creating a 4th file). Kept as pattern: add first to ROADMAP, build when prioritized.
- **2026-04-17** — **Multi-LLM provider support** (Anthropic Claude + OpenAI alongside Perplexity). User's idea; high value. `backend/services/claudeService.js` already stubbed, `backend/routes/envConfig.js` schema already handles arbitrary env vars, minimal refactor needed. Rough scope: add provider dispatcher in `aiService.js`, add Claude + OpenAI service wrappers, add "Preferred AI Provider" dropdown to Settings. ~3–4 hours. Worth doing after cleanup sprint.
- ~~**2026-04-17** — **Settings → API Keys login friction**~~ — **DONE 2026-04-17** via localhost bypass in `backend/middleware/auth.js`. UI-driven key management works.
- **2026-04-17** — **Git history rewrite** to fully purge old leaked Perplexity key from `4df7c40 Initial upload`. Key already rotated so low urgency, but would close the loop. Requires `git filter-repo` or BFG, force-push, team notification. ~30 min technical + care needed.

---

## 📜 Retired / Rejected ideas

*(Ideas we considered and decided against, with the reason. Keeps history honest.)*

- *(none yet)*

---

*When adding a new item, name it precisely, say why it's useful to Vinit, and give rough scope so future-you (or future-Claude) can estimate the work without re-discussing.*
