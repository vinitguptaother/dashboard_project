# ROADMAP — Planned Features & Ideas

*Updated: 2026-04-17 (evening — Sensibull parity sprint COMPLETE, #1–#5 all shipped)*

> **Purpose:** Captures every feature, enhancement, or idea that Vinit and Claude discuss but haven't yet built. Organized by when it's likely to ship. **Maintained by Claude** — when we agree on something new during a session, it lands here before the session ends.
>
> **Sources of truth for other info:**
> - `STATE.md` — what's working today
> - `CHANGELOG.md` — what shipped when
> - **This file** — what's planned and why

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
