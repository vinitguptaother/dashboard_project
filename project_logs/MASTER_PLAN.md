# MASTER PLAN — Vinit's AI Trading Dashboard

*Locked: 2026-04-24. This is the permanent contract. Amend only with explicit user decision.*

---

## 1. Vision (one paragraph)

A personal Indian-market trading dashboard that learns on its own over time. Four autonomous trading bots (Swing / Long-term / Options Sell / Options Buy) execute paper trades through a risk-gated pipeline. Five AI research agents + one Chief Analyst super-bot analyze markets, track top investors, mine trade lessons, and surface actionable suggestions. The user (Vinit) approves every suggestion; no agent trades real money autonomously. After paper trades prove themselves (50+ per segment with healthy Sharpe/DD), broker integration enables live trading under SEBI compliance.

---

## 2. Locked architectural decisions

| Decision | Choice |
|---|---|
| **Trading bot architecture** | 4 fully separate bots with shared libraries (already built) |
| **Paper trading realism** | Full realism — slippage + STT + brokerage + GST + latency + circuits + tax |
| **Research agent stack** | 5 specialist agents + 1 Chief Analyst (super-bot) + 1 Meta-Critic (experimental) |
| **Nervous system** | Sentinel service (pure Node.js, not AI) — watches duties, data quality, pending approvals, risk state |
| **AI provider mix** | Claude (reasoning) + OpenAI (embeddings) + Perplexity (web search) + Upstox (market data) |
| **Hosting** | Localhost only. Remote phone access via Tailscale (free). |
| **Build team** | 11 specialized Claude agents with clear roles |
| **Parallelism** | Aggressive — multi-agent parallel work wherever independent |
| **Safety** | Agents propose, user approves. No agent auto-trades. Validator + Risk Engine hard-gated. |
| **SEBI compliance** | Built from Day 1. Algo Registry seeded. Audit trail for every decision. |
| **Backup policy** | Every commit triggers full project + MongoDB dump (API keys stripped). |
| **Budget cap** | ₹2-4k/month for data + AI APIs. Expected monthly: ~₹2,600-3,300. |

---

## 3. The three systems

```
┌──────────────────────────────────────────────────────────────┐
│   SYSTEM A — 4 TRADING BOTS (already built, rule-based)      │
│   Swing · Long-term · Options Sell · Options Buy             │
│   Execute paper trades autonomously per cron schedule.       │
│   Paper now → broker later per graduation criteria.          │
├──────────────────────────────────────────────────────────────┤
│   SYSTEM B — 6 AI RESEARCH AGENTS (Claude API powered)       │
│                                                              │
│   TIER 1 (super-bot):                                        │
│   • Chief Analyst — synthesizes, learns, briefs, chats       │
│                                                              │
│   TIER 2 (specialists):                                      │
│   • Market Scout — daily pre-market briefing                 │
│   • Smart Money Tracker — weekly HNI + FII deep-dive         │
│   • Pattern Miner — post-trade lesson extractor              │
│   • Sentiment Watcher — hourly market chatter monitor        │
│   • Meta-Critic (experimental) — audits other agents         │
├──────────────────────────────────────────────────────────────┤
│   SYSTEM C — SENTINEL (not AI, pure Node.js)                 │
│   Monitors duties, data, user actions, risk state.           │
│   Writes action items. Chief Analyst reads before briefings. │
└──────────────────────────────────────────────────────────────┘
```

All three share a single MongoDB as source of truth.

---

## 4. Build team — 11 roles

| # | Role | Underlying agent type |
|---|---|---|
| 1 | 🏗️ Architect | Plan |
| 2 | 🔨 Builder | general-purpose |
| 3 | 🔍 Reviewer | general-purpose |
| 4 | 🧪 Tester | Explore |
| 5 | 🌐 Researcher | general-purpose (web) |
| 6 | 📊 Auditor | Explore |
| 7 | 📝 Scribe | general-purpose |
| 8 | 🎨 UI Designer | general-purpose (w/ Claude Design) |
| 9 | 💾 Backup Guardian | general-purpose |
| 10 | 🔐 Security Reviewer | general-purpose |
| 11 | 👁️ Data Quality Watcher | Explore |

---

## 5. Tab structure (locked)

### Primary nav — 9 tabs (daily use)
```
1. Dashboard — market state + overview
2. Today ⭐ NEW — action center (what to do now, in order)
3. Bots & Agents ⭐ NEW — all trading bots + all 6 research agents + CA chat
4. Portfolio — holdings, watchlist, portfolio analyzer
5. Search — stock research + AI analysis
6. Screens — screener management
7. Paper — paper trades list + edit
8. Options — options analytics
9. Journal — trade reflection
```

### Admin dropdown (click to expand)
```
Admin ▾
  • Activity
  • Health (Data Health)
  • Compliance
  • Control Center
  • History
  • News
  • Alerts
  • API Integration (hidden by default)
```

### Always visible
```
🔔 Bell · 📖 Help · ⚙️ Settings
```

---

## 6. Suggestion card standard (used everywhere)

Every suggestion the dashboard surfaces uses this consistent template:

```
┌───────────────────────────────────────────────────┐
│ [Priority🔴🟡🟢] [Source🧠🤖📊🛰️] · [age] ago     │
│                                                   │
│ Large clear title                                 │
│ ──────────────────────────────                    │
│ Entry ₹X · SL ₹Y · Target ₹Z                      │
│ N% confidence · R:R 1:M                           │
│                                                   │
│ 💡 Why: [reasoning]                                │
│ ⚠️  Risks: [risks if any]                          │
│                                                   │
│ [✓ Accept] [✗ Reject] [📊 Details]                │
└───────────────────────────────────────────────────┘
```

Priority colors: 🔴 URGENT · 🟡 HIGH · 🟢 MEDIUM
Source icons: 🧠 Chief Analyst · 🤖 Trading Bot · 📊 Pattern Miner · 🛰️ Sentinel

Appears on: Today tab (all), Dashboard (top 3), Paper Trading, Search AI recommendations, Scanner results, bell notifications.

---

## 7. The 7 Build Phases (locked)

### **Phase 0 — Foundation fixes + tab restructure** (2-3 days)
- ✅ Upstox token re-auth (user done)
- Fix History tab API
- Fix Large Deals scraper (likely NSE cookie expiry)
- **Wire regime gate into Validator** (biggest 1-day win)
- Tab restructure: Today + Admin dropdown + Bots & Agents promotion
- New "Today" tab skeleton
- Sentinel service skeleton (critical alerts only)

### **Phase 1 — Patterns + Agent Foundation + UX redesign** (3 weeks, 3 parallel tracks)
**Track A — Pattern recognition:**
- Support/Resistance Detector
- ATR Volatility Zones
- Candlestick Pattern Matcher
- Breakout + Retest Detector

**Track B — Agent infrastructure:**
- `agentService.js` base (node-cron + Anthropic SDK + tool loop + memory)
- Memory collections + Suggestion + ActionItem schemas
- LLM service abstraction (Claude + OpenAI + Perplexity swappable)
- **Market Scout agent debuts** (simplest first)

**Track C — UX redesign:**
- Suggestion Card component (reused everywhere)
- Today tab wired to real data
- Dashboard top-3 preview + "View all →" flow

### **Phase 2 — Indian edge + 2 agents + Portfolio Analyzer** (2-3 weeks)
**Track A — Edge signals:**
- Participant-wise OI (FII/DII derivatives, highest-leverage signal)
- Sectoral Breadth Gauge
- GIFT Nifty Pre-Market Gap Predictor
- Bulk Deal Smart-Money Score (extends existing)
- Superstar Holdings Tracker

**Track B — Agents 2+3:**
- Smart Money Tracker agent
- Sentiment Watcher agent
- Full Sentinel (all alert categories)

**Track C — Portfolio Analyzer** (new user-requested feature):
- CSV import of live portfolio from any broker
- Per-stock AI verdict: Good / Average / Bad · Buy more / Hold / Sell
- Detailed reasoning per stock (fundamentals + technicals + news + sector context)
- Stored history for trend over time

### **Phase 3 — Strategy Library + Pattern Miner** (1-2 weeks)
- Code 6 priority strategies:
  - Swing: Stage 2 Breakout · EMA Pullback · Oversold Bounce · Post-Earnings Momentum
  - Long-term: Quality+Value+Momentum composite
  - Options Sell: IV-Rank Iron Condor
- Pattern Miner agent debuts (runs after every closed trade)
- "Backtest this" button hooks (stub, works in Phase 5)

### **Phase 4 — Learning Engine + CA debuts + Meta-Critic** (2 weeks)
- BotPerformance model (per bot × strategy × regime)
- Bayesian win-rate (credible intervals)
- Auto-pause logic (disable bot if 10-trade win rate <35%)
- News embedding clusters (OpenAI embeddings → topic detection)
- **Chief Analyst debuts** — 5 memory stores + chat UI + daily briefings
- **Meta-Critic agent** (experimental — audits all agents weekly)

### **Phase 5 — Full Backtester + ML upgrades** (3 weeks)
- Regime-conditioned backtester (full version, "Backtest this" works everywhere)
- HMM regime detection upgrade (statistical model)
- Strategy parameter auto-adjust (R:R drift detection)
- Backtest UI in both Strategies tab AND Portfolio tab

### **Phase 6 — Mobile + UX polish** (2 weeks)
- Mobile PWA pass
- Tailscale setup (free remote phone access)
- Trade Idea Diff (what changed since last login)
- Voice journal (Whisper API, +₹50/mo)
- Tax-lot optimizer (Indian STCG/LTCG aware)
- CA chat UI polish

### **Phase 7 — Long-term (deferred)**
- Trigger: 50+ paper trades per segment + graduation criteria met
- Executor (live broker Upstox orders)
- SEBI live compliance (static IP, algo ID registration)
- Multi-tenant auth (if going public, 6-12 months out)

---

## 8. Cost budget (monthly, INR)

Using 2026 pricing: Opus 4.7 ($15/$75 per 1M tokens), Sonnet 4.5 ($3/$15), Haiku 4.5 ($0.25/$1.25). Conversion $1 ≈ ₹83. Claude prompt caching enabled (90% discount on cached memory reads).

| Component | Runs/mo | Monthly ₹ |
|---|---|---|
| Chief Analyst — Sonnet daily (3×/day) | 90 | 1,465 |
| Chief Analyst — Opus weekly deep | 4 | 871 |
| Market Scout — Sonnet | 30 | 150 |
| Smart Money Tracker — Sonnet | 4 | 65 |
| Pattern Miner — Sonnet (batched daily) | 20 | 175 |
| Sentiment Watcher — Haiku | 80 | 17 |
| Meta-Critic — Sonnet | 4 | 55 |
| Perplexity sonar-pro (web search) | ~1,500 queries | 625 |
| OpenAI embeddings (news clustering) | 150K tokens | 25 |
| **Sub-total** | | **~₹3,448** |
| Safety buffer (10%) | | 345 |
| **Expected steady-state** | | **~₹2,800-3,300** |

Trading bots = rule-based, zero per-trade API cost.
Sentinel = pure Node.js, zero API cost.

---

## 9. Localhost hosting playbook

| Concern | Solution |
|---|---|
| Always-on | Run on always-on machine OR upgrade to Raspberry Pi 5 (~₹5,000 one-time) |
| Laptop sleep | Keep-awake guard while backend running |
| Phone access from outside home | **Tailscale** (free personal plan, HTTPS tunneled) |
| No custom domain | `http://localhost:3000` at home, Tailscale magic URL remotely |
| SEBI static IP (future live) | Deferred until Phase 7 (not needed for paper) |
| No Telegram bot | Skip (needs public webhook). Use browser notifications + email. |
| Data privacy | All data stays on Vinit's machine. Only outbound: API calls with prompts. |

---

## 10. Safety guarantees

| Guarantee | How enforced |
|---|---|
| No auto-trading of real money | Only rule-based trading bots trade. They're paper now. Live Executor deferred to Phase 7. |
| AI agents cannot trade | Agents can only call `create_suggestion()`. Cannot hit broker API. |
| User approves every suggestion | Dashboard UI gates — no action without click |
| Kill switch reachable in one click | Already built (KillSwitchBoard) |
| SEBI audit trail | ComplianceEvent for every decision |
| Backups before every commit | Backup Guardian role |
| No secrets in git | `.env` excluded, rotation protocol defined |

---

## 11. Decision log (who decided what)

| Date | Decision | Decided by |
|---|---|---|
| 2026-04-17 | 49-feature blueprint locked | Vinit |
| 2026-04-17 | 4-bot architecture with shared libs | Vinit |
| 2026-04-24 | Add 5 research agents + Chief Analyst super-bot | Vinit |
| 2026-04-24 | Add Meta-Critic as experimental agent | Claude (user's call) |
| 2026-04-24 | Sentinel as pure Node.js service (not AI) | Claude (for reliability) |
| 2026-04-24 | 11-role build team | Vinit |
| 2026-04-24 | Aggressive parallelism | Vinit |
| 2026-04-24 | Budget: ₹2-4k/mo cap | Vinit |
| 2026-04-24 | Localhost hosting | Vinit |
| 2026-04-24 | Tabs: Today + Admin + Bots & Agents | Vinit |
| 2026-04-24 | Portfolio Analyzer added to Phase 2 | Vinit |
| 2026-04-24 | Suggestion card redesign in Phase 1 | Claude (biggest UX win) |
| 2026-04-24 | Backtester full build in Phase 5 | Vinit |

---

## 12. Anti-patterns (what we NEVER build)

- ❌ AI price predictions ("stock will rise 8% with 92% confidence")
- ❌ Copy trading / guru leaderboards
- ❌ Gamification (streaks, badges, XP)
- ❌ 100-indicator chart overlays
- ❌ One-click "AI trade" buttons
- ❌ Real-time social feed of trades
- ❌ Unregistered signal-selling (SEBI RA registration required)
- ❌ Push notification per price tick
- ❌ Any feature where agents trade without user approval

---

## 13. Progress tracking

- **Daily digest**: end-of-day summary message
- **Phase boundary**: Auditor runs full health scan + Loom-style demo description
- **Weekly**: Auditor compares new vs last-week health (regression detection)
- **Continuous**: Backup Guardian on every commit

---

*This plan is the contract. Any deviation requires explicit user decision recorded in Section 11.*
