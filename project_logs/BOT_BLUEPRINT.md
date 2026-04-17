# BOT & FEATURE BLUEPRINT — Final, Locked

*Created: 2026-04-17*
*Based on: multi-agent research + user's feature lists + Claude-chat bot blueprint v1.0 + user clarifications*

> This is the canonical source of truth for what the Vinit dashboard should become. When a new session starts, read this + STATE.md + ROADMAP.md.

---

## Architectural decisions (locked, do not re-debate)

| Decision | Choice |
|---|---|
| Bot architecture | **4 fully separate bots** with shared libraries |
| Strategy library | **Hybrid** — 14 curated + quarterly Perplexity additions |
| Paper trading realism | **Full realism** — slippage + STT + brokerage + GST + latency + circuits + tax tagging |
| Capital allocation | **Manual per-bot** in Settings UI |
| Live graduation criteria | **TBD** — user will decide when bots approach live |
| SEBI compliance | **Build from Day 1** — structured log every intent, prep for Algo-ID |
| UI structure | **Parallel section** (Bot Command Center) alongside existing Screens + AI |

## Guiding principles

1. **Bots don't predict prices.** They find high-probability setups using proven rules.
2. **Paper trading must be realistic.** Paper P&L should be within 5% of what live would be — or graduation data is fraud.
3. **Risk limits are hard-coded.** No bot, no LLM, no runtime switch can override them.
4. **Kill switch is sacred.** Must work even if rest of system crashes.
5. **Scanner layer is free (local math).** Validator + Executor use API sparingly.
6. **Learning is statistical tracking.** Don't oversell it as ML.
7. **Compliance log from Day 1.** April 2026 SEBI algo rules apply when live.

---

## The 4 Bots

### 1. Swing Stocks Bot
- Segment: NSE/BSE stocks, 2 days to 6 months holding
- Strategies: Stage 2 Breakout, EMA Pullback, Oversold Bounce, Post-Earnings Momentum
- Scoring: Win rate + R-multiple per regime

### 2. Long-term Stocks Bot
- Segment: NSE/BSE stocks, 6+ months holding
- Strategies: Quality+Value+Momentum (QVM), Dividend Growth Compounder
- Scoring: Multi-quarter return + drawdown + thesis adherence

### 3. Options Selling Bot
- Segment: NIFTY/BANKNIFTY/stock options, weekly + monthly expiry
- Strategies: IV-Rank Iron Condor, Credit Spread on Trend, Theta Farming, Short Strangle on High IV
- Scoring: Win rate + premium captured vs max loss
- Capital: Typically 40% allocation (needs margin)

### 4. Options Buying Bot
- Segment: NIFTY/BANKNIFTY options, intraday + up to 5 days
- Strategies: Directional Breakout Long Call/Put, Pre-Earnings Vega, Momentum Long, Long Straddle on Expected Vol
- Scoring: Win rate + avg return % on premium (expect 35–45%)
- Capital: Smaller allocation (defined risk per trade)

---

## Bot Core Infrastructure (shared)

### Scanner Layer
- Runs every 1–2 min during market hours
- Local math on cached Upstox data (zero API cost)
- Outputs candidates per strategy rules

### Validator Layer
- Regime compatibility check
- Risk + capital + correlation checks
- If all pass → ONE Perplexity call for context
- Kills 70–80% of candidates free

### Executor Layer
- Paper mode: realistic fill simulation
- Live mode: Upstox order API + SEBI compliance logs

### Strategy Library
- 14 curated strategies coded with explicit entry/exit/SL/sizing rules
- Quarterly Perplexity call suggests new strategies for user approval
- Every strategy backtestable and debuggable

### Realistic Paper Trading Engine
**Every paper trade adds:**
- Slippage: large-cap 0.1% / mid-cap 0.3% / small-cap 0.5% / options at bid-ask
- STT: options 0.15%, futures 0.05% (FY26-27)
- Brokerage + GST + stamp duty + exchange + SEBI fees
- 2–5 sec fill latency
- Circuit limit respect
- Market hours respect
- Post-tax P&L (STCG/LTCG/F&O business)

### Risk Engine (HARD CODED)
- Per-trade: max 1% of bot capital
- Daily: max -2% of bot capital → auto kill switch
- Max concurrent positions: 5 per bot
- Max segment exposure: 40%
- Max same-sector correlation: warn >50%

### Kill Switches
- **Master:** flatten all 4 bots' positions + disable new orders
- **Per-bot:** stop that bot only
- **Auto-trigger:** if bot hits -2% day, its kill switch fires automatically

### Learning Engine
- Rolling 30-trade win rate, Sharpe, profit factor per strategy per regime
- Auto-pause strategies below thresholds (min 30-trade sample)
- Weekly human-review prompt for borderline
- Monthly Claude sanity check on aggregated data (advisory only)

---

## The 49 features (categorized)

See PART 2 of the 2026-04-17 CHANGELOG entry for full detail of each.

**A. Bots (4):** Swing, Long-term, Options Sell, Options Buy
**B. Bot Infra (8):** Scanner, Validator, Executor, Strategy Library, Realistic Paper, Risk Engine, Kill Switches, Learning Engine
**C. Discipline (4):** Execution Checklist, Position Sizing Gate, Daily Loss Breaker, Post-Loss Cooldown
**D. Journal (5):** Auto Journal, Mistake Tagging, Trade Replay, Strategy Performance Lab, Historical Screen Outcome Tracker
**E. AI (4):** Better Prompts, Reasoning Transparency, Confidence Scores, Consistency Checker
**F. Indian Feeds (5):** FII/DII, Corp Actions Calendar, Sector Rotation, Bulk/Block Deals, Market Regime Engine
**G. Alerts (4):** Price Alerts w/ Sound, Watchlist Event Triggers, Telegram Notifications, Daily Trading Brief
**H. Workflow (6):** Idea Queue, Saved Layouts, Portfolio Risk Exposure, Data Health Panel, Broker Readiness, Feature/Test Control Center
**I. Options Depth (3):** Portfolio Greeks + Correlation, IV Rank/Term/Skew, Strategy Simulator Enhancements
**J. Compliance+Tax (3):** Tax P&L Tagger, Quicko Export, SEBI Algo Compliance Log
**K. Existing Keep+Enhance (3):** Options Tab (Sensibull parity), Screen Scoring, Paper Trading Tab evolution

**Total: 49 features.**

---

## Recommended Build Order (Sprints)

**Sprint 1 (Weeks 1–3):** Discipline loop + Data health
- Items 13, 14, 15, 16, 17, 18, 38, 39

**Sprint 2 (Weeks 4–6):** Indian market feeds
- Items 26, 27, 28, 29, 30

**Sprint 3 (Weeks 7–10):** Bot infrastructure (Scanner/Validator/Executor + SEBI)
- Items 5, 6, 7, 9, 10, 11, 46

**Sprint 4 (Weeks 11–14):** 4 bots + Strategy library (first 6 strategies)
- Items 1, 2, 3, 4, 8 (partial), 12

**Sprint 5 (Weeks 15–16):** Complete Strategy Library + Start Paper Trading
- Item 8 (full)

**Sprint 6 (Weeks 17+):** Enhancements + monitoring
- All remaining features in priority order

**Live graduation:** only after 50+ trades per segment in paper + user decides on graduation criteria.

---

## Validation criteria (TBD — user decides before live)

Options discussed (user to pick when approaching live):
- **Strict:** Sharpe >1.0, Sortino >1.5, Max DD <20%, Profit Factor >1.5, 50+ trades, post-tax, spans trending + choppy regimes
- **Medium:** Win rate >55%, R:R >1.5, Sharpe >0.8, Max DD <25%, 40+ trades, post-tax
- **Lenient (NOT recommended for real money):** Win rate >55%, R:R >1.5, 60 days

---

## API cost budget

- Daily: ₹7–12 (1 regime + 2–4 signal confirmations)
- Weekly: ₹15 (performance review)
- Monthly: ₹50 (Claude sanity check)
- **Total: ~₹300–400/month**

---

## Anti-patterns (what NOT to build)

- ❌ AI price predictions ("stock will rise 8%" with confidence %)
- ❌ Copy trading / guru leaderboards
- ❌ Gamification (streaks, badges, XP)
- ❌ 100-indicator chart overlays
- ❌ One-click "AI trade" buttons
- ❌ Real-time social feed of trades
- ❌ Unregistered signal-selling bots (SEBI RA registration required from Apr 2026)
- ❌ Push notification per price tick

---

## Open items for future sessions

1. **User's bot list:** the user said they'd share bot ideas separately — as of 2026-04-17 session, they referenced the Claude-chat blueprint. When user shares more bot ideas, merge into this document.
2. **Strategy library specifics:** the 14 strategies need full entry/exit/SL/sizing rules coded. Starting point: 6 strategies in Sprint 4, remaining 8 in Sprint 5.
3. **Validation criteria:** user to decide when approaching live.
4. **Capital allocation:** user to set per bot in Settings UI once bots exist.
