/**
 * Help / Instructions content — the single source of truth for in-app docs.
 *
 * Per user's rule (CLAUDE.md): every new feature MUST be added here in the same
 * commit that ships it. Content is data-driven so adding a tab/feature is a
 * one-object edit.
 *
 * Structure: sections grouped by area, each section has lessons (one per feature).
 * Rendered by HelpTab.tsx. Anchors = kebab-case(title).
 */

export interface Lesson {
  title: string;
  summary: string;     // 1-sentence hook
  steps?: string[];    // optional step-by-step
  tips?: string[];     // optional tips
  warnings?: string[]; // optional caveats
}

export interface HelpSection {
  id: string;          // kebab-case anchor
  title: string;
  intro?: string;      // short section intro
  lessons: Lesson[];
}

export const HELP_CONTENT: HelpSection[] = [
  // ─── Getting started ─────────────────────────────────────────────────────
  {
    id: 'getting-started',
    title: 'Getting Started',
    intro: 'New to the dashboard? Read this first.',
    lessons: [
      {
        title: 'What this dashboard does',
        summary: 'A personal AI-powered trading dashboard for Indian NSE/BSE markets covering swing stocks, long-term stocks, options selling, and options buying.',
        tips: [
          'Live market data comes from Upstox (index prices + option chains).',
          'AI analysis uses Perplexity (live internet access).',
          'All trading is PAPER by default. Real broker integration is added only when paper results validate.',
        ],
      },
      {
        title: 'The discipline loop',
        summary: 'Every trade passes through a mandatory discipline gate — checklist, position sizing, risk check. This is how you avoid the 93% retail loss rate.',
        steps: [
          'Before entering: Pre-Trade Gate modal forces 6-check execution checklist.',
          'Position sizing is auto-computed against your capital + risk rule — hard-blocks oversized trades.',
          'If daily P&L hits the limit → full-page lock until midnight IST or typed UNLOCK override.',
          'After 2 consecutive losses → 30-minute cooldown banner.',
          'On trade close → mandatory Mistake Tag captures what went right/wrong.',
          'Quarterly review shows rupee cost per mistake category.',
        ],
      },
    ],
  },

  // ─── Main tabs ────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    title: 'Dashboard tab',
    intro: 'Your market overview and day-one view.',
    lessons: [
      {
        title: 'Live indices (NIFTY / SENSEX / BANK NIFTY)',
        summary: 'Top of page shows real-time index prices from Upstox.',
        tips: ['Green/red pill = change from previous close.', 'Auto-refreshes every 30 seconds during market hours.'],
      },
      {
        title: "Today's Top Ideas",
        summary: 'AI-ranked stocks from your active screens.',
        steps: [
          'Click any stock symbol to see AI analysis.',
          'Scores (X/20) come from AI ranking against your screen rules.',
          'Updated when you refresh screens (Screens tab).',
        ],
      },
      {
        title: 'Daily P&L widget',
        summary: "Today's realized P&L with daily loss limit progress.",
        tips: [
          'If usedPct crosses 100% → Daily Loss Circuit Breaker activates automatically.',
          'Capital and risk limits set in Settings tab.',
        ],
      },
    ],
  },

  {
    id: 'options',
    title: 'Options tab',
    intro: 'Sensibull-parity options analytics — chain, strategies, payoff, paper trading.',
    lessons: [
      {
        title: 'Option chain viewer',
        summary: 'Live chain for NIFTY / BANKNIFTY / FINNIFTY / SENSEX / MIDCPNIFTY.',
        tips: ['ATM strike highlighted yellow.', 'Click + on any strike to add leg to strategy.', 'Click "Chain" button to open full modal.'],
      },
      {
        title: 'Strategy builder',
        summary: '6 presets + custom multi-leg construction with live payoff.',
        steps: [
          'Pick preset from left-panel (Short Straddle, Iron Condor, etc.) OR add legs manually.',
          'Adjust lots via +/- or type qty.',
          'Click "Trade All" to paper-trade — Pre-Trade Gate fires.',
        ],
      },
      {
        title: 'OI Chart tab',
        summary: 'Horizontal mirror bar chart of open interest by strike.',
        tips: [
          'Red bars = Put OI (left), Green bars = Call OI (right).',
          'Purple strike label = Max Pain. Blue = ATM. Amber = Call/Put walls.',
          'Summary chips: Call Wall, Put Wall, Max Pain (+ % from spot), PCR.',
        ],
      },
      {
        title: 'P&L Table',
        summary: '2D grid of P&L across spot prices × days remaining.',
        tips: ['Toggle SD mode (±2SD from current) vs % mode (±5/2/1/0/-1/-2/-5%).'],
      },
      {
        title: 'IV Metrics Bar',
        summary: 'ATM IV + IV Rank + IV Percentile at top of left panel.',
        tips: [
          'IV shown as %. IVR/IVP show "—" until 30 days of history accrue.',
          'Daily snapshot at 3:25 PM IST captures ATM IV for all 5 underlyings.',
          'Color code (after 30 days): IVR < 30 = green "IV Cheap" (favor buying). IVR > 70 = red "IV Rich" (favor selling).',
        ],
      },
    ],
  },

  {
    id: 'screens',
    title: 'Screens tab',
    intro: 'Upload Screener.in CSVs → AI ranks stocks → paper-trade the top picks.',
    lessons: [
      {
        title: 'Creating screens',
        summary: 'Add a screen with a Screener.in query, then upload its CSV export.',
        steps: [
          'Click "Your Screens" → "+" to add a new screen.',
          'Enter name, description, and the Screener.in query string.',
          'Either upload CSV manually OR click "Fetch from Screener.in" to auto-fetch.',
          'Click "Rank this batch" to run AI ranking on the stocks.',
        ],
      },
      {
        title: 'Active idea batches',
        summary: 'Each CSV upload creates a batch. Screen Health panel shows batch status.',
        tips: [
          'Screens with 3+ batches and resolved trades get performance scores.',
          'Hit rate is tracked automatically as trades close.',
          'Nightly 11 PM cron re-scores all screens.',
        ],
      },
    ],
  },

  {
    id: 'paper-trading',
    title: 'Paper Trading tab',
    intro: 'Simulated trades with auto-monitoring of SL/target.',
    lessons: [
      {
        title: 'Creating a paper trade',
        summary: 'Generate a setup via AI OR add manually with symbol, entry, SL, target.',
        steps: [
          'AI-generated: use "Generate setups" in Trade Journal / Dashboard.',
          'Manual: fill the form on Paper Trading tab.',
          'Pre-Trade Gate fires before save.',
        ],
      },
      {
        title: 'Auto-monitor',
        summary: 'Every 2 minutes during market hours, backend checks live prices.',
        tips: [
          'If price crosses SL → trade marked SL_HIT.',
          'If price crosses target → trade marked TARGET_HIT.',
          'P&L is computed and fed into Daily P&L widget.',
        ],
      },
      {
        title: 'Realistic Paper Engine (Sprint 3 #9)',
        summary: 'Paper trades book with real-world slippage + broker costs so paper P&L matches what live trading would actually produce.',
        steps: [
          'On entry: LTP is adjusted by liquidity-band slippage (LARGE 2bps / MID 5bps / SMALL 15bps / ILLIQUID 40bps / OPTIONS 10bps). BUY fills higher, SELL fills lower.',
          'Entry costs computed per segment (equity-delivery / equity-intraday / options / futures): brokerage + STT + exchange txn + SEBI + stamp duty + GST + DP charges.',
          'On SL/target hit by the 2-min monitor cron: exit leg gets same slippage + cost treatment. Net P&L = gross − (entry charges + exit charges).',
          'Break-even price (how far price must move before the trade is profitable AFTER costs) is shown in preview.',
          'Latency simulated at 400-1600ms to model broker round-trip.',
        ],
        tips: [
          'Check the "Pre-trade preview" before placing — if break-even is far from entry on a tight target, the reward isn\'t worth the risk.',
          'Options and intraday segments have higher STT + GST impact vs delivery — watch the netPnL carefully.',
          'Set `segment`, `botId` (when a bot is posting), and `liquidityBand` when creating a paper trade; defaults are equity-delivery / manual / MID.',
          'FY26 STT rates used; edit CONSTANTS at top of backend/services/paperRealismService.js to tune for your specific broker.',
          'POST /api/paper-realism/preview with body { segment, entrySide, qty, entryPrice, stopLoss, target, liquidityBand? } to fetch a full preview card.',
        ],
      },
    ],
  },

  {
    id: 'trade-journal',
    title: 'Trade Journal',
    intro: 'Post-trade reflection with mistake tagging for quarterly review.',
    lessons: [
      {
        title: 'Mistake tag modal',
        summary: 'When you close an options trade, this modal forces you to tag execution quality.',
        steps: [
          'Pick ONE tag: clean / revenge / fomo / moved_sl / oversized / early_exit / late_exit / no_thesis / ignored_plan / other.',
          'Optional: add notes + lesson learned.',
          'Click "Save & Close Trade" — trade finalizes and journal entry created.',
        ],
      },
      {
        title: 'Trade Replay',
        summary: 'Pick any closed trade and replay with entry context.',
        tips: ['Shows chart, VIX, regime, MFE/MAE, "best exit" analysis.'],
      },
      {
        title: 'Mistake stats (quarterly)',
        summary: 'GET /api/trade-journal/mistake-stats returns rupee cost per mistake category.',
        tips: ['Example: "revenge trades cost ₹47,000 this quarter". The highest-ROI journaling feature.'],
      },
    ],
  },

  // ─── Discipline layer ─────────────────────────────────────────────────────
  {
    id: 'discipline',
    title: 'Discipline Layer',
    intro: 'Six features that enforce execution discipline. Sprint 1 of the build plan — now complete.',
    lessons: [
      {
        title: 'Execution Checklist (Pre-Trade Gate)',
        summary: 'Modal before any paper trade — 6-item checklist that records your thesis.',
        steps: [
          'Trend aligned / Risk acceptable (auto) / SL defined / No major news / Capital available / Not overexposed.',
          'Click Pass / Fail / N/A for each.',
          'Optional notes field.',
          'Click "Record + Proceed" to save checklist and fire actual trade.',
        ],
      },
      {
        title: 'Position Sizing Hard Gate',
        summary: 'Auto-computes max loss at this size vs your risk rule. Hard-blocks if violated.',
        tips: [
          'For options: uses payoff.maxLoss (handles "Unlimited" for naked shorts — auto-fail).',
          'For stocks: computes (entry − SL) × qty.',
          'Cannot be overridden from the modal. Reduce size or widen SL.',
        ],
      },
      {
        title: 'Daily Loss Circuit Breaker',
        summary: 'When daily P&L hits the limit → full-page lock overlay appears.',
        steps: [
          'Configure limit in Settings → Risk Management (default 5% of capital, blueprint recommends 2%).',
          'When triggered: live countdown to midnight IST, override requires typing UNLOCK exactly.',
          'Every override is logged to activity.',
        ],
        warnings: ['Revenge trading after a loss is the #1 retail profit-killer. Override only if you genuinely have a good reason.'],
      },
      {
        title: 'Post-Loss Cooldown',
        summary: 'After 2 consecutive losses → 30-minute amber banner at top of screen.',
        tips: [
          'Lighter friction than daily-loss lock — dashboard remains usable.',
          'One-click Clear button (no typed confirm), but still logged.',
          'Auto-triggered inside /api/trade-journal/entry when 2nd consecutive loss is journaled.',
        ],
      },
      {
        title: 'Auto Journal + Mistake Tagging',
        summary: 'Every trade close forces a mistake tag and auto-creates a rich journal entry.',
        tips: [
          'Entry captures market context (NIFTY level, soon: VIX, FII/DII, regime).',
          'Every closed trade = one journal entry. Quarterly review = brutally honest self-assessment.',
        ],
      },
    ],
  },

  // ─── Indian market signals (Sprint 2) ─────────────────────────────────────
  {
    id: 'indian-signals',
    title: 'Indian Market Signals',
    intro: 'Data feeds specific to Indian retail trading — FII/DII, corp actions, sector rotation, etc.',
    lessons: [
      {
        title: 'FII / DII Flows (widget on Dashboard)',
        summary: 'Daily Foreign + Domestic Institutional Investor cash activity. The single biggest Indian-market directional signal.',
        tips: [
          'Updated 6:30 PM IST Mon-Fri (NSE publishes ~6 PM).',
          'Green net = buying, red net = selling.',
          'Persistent FII selling for 3+ days often precedes correction.',
          'DII buys usually cushion FII sells — watch when DII stops buying.',
        ],
        steps: [
          'Default refresh via cron. Manual refresh button on the widget.',
          'GET /api/fii-dii/latest for single day, /history?days=N for rolling.',
          'If scrape fails, widget shows last cached data (no gap in display).',
        ],
      },
      {
        title: 'Market Regime Engine (Dashboard widget)',
        summary: 'Classifies current market into trending-bull / trending-bear / choppy / breakout / risk-off with reasoning + confidence.',
        steps: [
          'Inputs: NIFTY 20/50/200 EMA + VIX + VIX day-change + FII/DII latest EOD.',
          'Rule set: risk-off (VIX >22 or +25%) → trending-bull (above EMAs + FII buying) → trending-bear (below EMAs + FII selling) → breakout (fresh 50 EMA cross + low VIX) → choppy (default).',
          'Recomputes every 30 min during market hours (Mon-Fri 9:15–15:30).',
          'Manual refresh via widget button OR POST /api/regime/refresh.',
        ],
        tips: [
          '"Why" line shows the exact inputs that tipped the classification.',
          'Confidence %: higher means stronger signal alignment across inputs.',
          'Bot Validator layer (Sprint 3+) will use regime to gate strategies — a trending-bull-only strategy won\'t fire in choppy regime.',
          'History is kept — useful for attribution ("this screen worked well when regime=trending-bull").',
        ],
      },
      {
        title: 'Large Deals / Smart Money (Dashboard widget)',
        summary: 'Shows NSE bulk deals (single-client ≥0.5% of equity capital), block deals (single trade ≥₹10cr), and short-deal aggregates.',
        steps: [
          'Source: NSE /api/snapshot-capital-market-largedeal (EOD snapshot, published ~6 PM IST after market close).',
          'Three views: All / Bulk / Block / Short. Three date windows: 1d / 3d / 7d. Four min-value filters: all / ≥₹1cr / ≥₹5cr / ≥₹10cr.',
          'Top symbols by NET flow: aggregates BUY − SELL value per symbol. Green = net buying · Red = net selling.',
          'Deal table: date · kind · symbol · client · BUY/SELL · qty · WATP (weighted avg traded price) · total value.',
          'Refresh: daily 6 PM IST (Mon-Fri only). Manual refresh pulls live.',
        ],
        tips: [
          'Bulk deals reveal institutional conviction — same client buying a stock across many days is a strong signal.',
          'Block deals are fast-executed at VWAP in window slots (8:45-9:00 + 2:05-2:20). Often FII/DII unwinds.',
          'A stock appearing in BOTH bulk AND block on the same day with BUY = very strong institutional accumulation.',
          'SHORT deal spikes in a stock = potential upcoming volatility; short-squeeze candidates live here.',
          'Cross-reference: if FII net is POSITIVE on the day AND a stock shows large BUY deals = aligned macro + micro signal.',
        ],
      },
      {
        title: 'Corporate Events Calendar (Dashboard widget)',
        summary: 'Shows next-30-day calendar of NSE corporate actions (dividends, splits, bonuses, buybacks) + upcoming board meetings (quarterly earnings).',
        steps: [
          'Sources: NSE /api/corporates-corporateActions + /api/corporate-board-meetings (both require cookie flow).',
          'Deduplicated via (symbol, eventDate, kind, subject) — re-runs are safe.',
          'Widget shows events grouped by date, color-coded by type, with "in Nd" countdown.',
          'Toggle next 7d / 14d / 30d window; filter All / Actions / Earnings.',
          'Refresh cadence: daily at 7 AM IST (before market open). Manual refresh button pulls live.',
        ],
        tips: [
          'BEFORE opening a new position, hover the widget to spot earnings inside your holding period — earnings can gap 5-15%.',
          'Dividend ex-dates move the stock down by ~dividend amount on ex-day (not a loss, just mechanical).',
          'Stock splits / bonuses adjust charts — historical SL/target levels may need recalculation.',
          'Buyback ex-dates often see unusual volume and short-term price strength.',
          'Use symbol tooltips to see the full NSE description for board meetings (specifies exactly what\'ll be discussed).',
        ],
      },
      {
        title: 'Sector Rotation Heatmap (Dashboard widget)',
        summary: 'Shows 12 NSE sector indices color-coded by relative strength vs NIFTY across 1D / 1W / 1M horizons.',
        steps: [
          'Sectors tracked: Bank, IT, Auto, Pharma, FMCG, Metal, Realty, Media, PSU Bank, Private Bank, Energy, Fin Services.',
          'Each tile shows absolute % change + RS (relative strength = sector% − NIFTY%).',
          'Green = outperforming NIFTY · Red = underperforming. Sorted best-to-worst for the chosen horizon.',
          'Toggle 1D / 1W / 1M at top-right; leaders + laggards bar is always 1W (the most stable swing-trade window).',
          'Recomputes every 30 min during market hours (offset 15,45 from regime cron to spread load).',
          'Manual refresh via widget button OR POST /api/sector-rotation/refresh.',
        ],
        tips: [
          'Enter longs in sectors in the TOP ROW of the heatmap (tailwind).',
          'Avoid/exit longs in sectors in the BOTTOM ROW (headwind).',
          'Rotation reversal = sector jumps from laggard to leader over a few sessions — early momentum entry.',
          'Combine with Regime: trending-bull + leading sector = strongest setup.',
          'History is kept; future feature: sparkline per sector to see rotation over 30 days.',
        ],
      },
    ],
  },

  // ─── Risk Engine (Sprint 3 #10) ───────────────────────────────────────────
  {
    id: 'risk-engine',
    title: 'Risk Engine',
    intro: 'Unified portfolio risk: drawdown tracker, sector concentration, per-bot capital caps, and a single evaluate() gate that every trade passes through.',
    lessons: [
      {
        title: 'Drawdown tracker',
        summary: 'Tracks equity (realized + unrealized P&L) vs peak. Lockout trips when drawdown crosses maxDrawdownPct.',
        steps: [
          'EOD snapshot at 3:35 PM IST (after close) persists equity + peak + DD%.',
          'Unrealized = MTM on ACTIVE paper trades; Realized = sum of closed paper trades\' netPnL (realism engine).',
          'Peak equity ratchets up — never decreases. DD % = (peak − current) / peak × 100.',
          'When DD ≥ maxDrawdownPct, `drawdownLockoutActive` flips true → evaluateTrade blocks new entries.',
          'Clear lockout: click "Clear lockout" on the panel (requires confirmation).',
        ],
        tips: [
          'Default maxDrawdownPct is 15%. Tune in Settings for your risk appetite (5-20% range).',
          'Lockout is slower-reacting than the daily-loss kill switch — it catches slow bleeds.',
          'Lockout persists across days until manually cleared. Restart your trading mental state before clearing.',
        ],
      },
      {
        title: 'Sector concentration cap',
        summary: 'Prevents over-concentration: no single NSE sector can exceed maxSectorConcentrationPct of capital.',
        steps: [
          'When a trade is evaluated: new exposure + existing sector exposure must stay below cap.',
          'Sector resolution comes from the trade\'s `sector` field (or `screenName` as fallback).',
          'Bars on the panel color: green (fine) · amber (>80% of cap) · red (exceeded).',
        ],
        tips: [
          'Default 30% cap balances diversification vs conviction. Lower it (20-25%) if you want broader spread.',
          'Ignore for a few trades by raising cap in Settings; re-lower later.',
        ],
      },
      {
        title: 'Per-bot capital + concurrent position caps',
        summary: 'Each bot (Swing / Long-term / Options Sell / Options Buy) has its own ₹ allocation + max open positions. Sprint 4 prep.',
        tips: [
          'Defaults: Swing ₹2L / Long-term ₹2L / Options Sell ₹50k / Options Buy ₹50k.',
          'Manual trades are exempt from per-bot caps — they use the shared capital.',
          'Bar colors: green (<70%) · amber (70-90%) · red (>90% utilized).',
        ],
      },
      {
        title: 'Unified evaluate() gate',
        summary: 'POST /api/risk-engine/evaluate runs ALL checks in one call — kill switch, cooldown, drawdown, per-trade risk, position size, sector concentration, per-bot caps.',
        steps: [
          'Body: { botId?, symbol, action, qty, entryPrice, stopLoss, sector? }',
          'Response: { allowed: boolean, reasons: string[], checks: {...} }',
          'When any bot posts a trade (Sprint 4+), its Validator calls this. If allowed=false, trade is rejected with full reason list.',
        ],
      },
    ],
  },

  // ─── Kill Switch Board (Sprint 3 #11) ─────────────────────────────────────
  {
    id: 'kill-switches',
    title: 'Kill Switch Board',
    intro: 'One surface for every trading halt — daily-loss, post-loss cooldown, drawdown lockout, per-bot kills, and a panic button.',
    lessons: [
      {
        title: 'Global blockers (auto-tripped)',
        summary: 'The 3 auto-triggered kill states. Any one active = no new trades.',
        steps: [
          '**Daily Loss Breaker (#15)** — trips when today\'s net P&L hits the limit (default 5%). Auto-resets midnight IST. Clear via "Clear" button or /api/risk/kill-switch/override with confirmation "UNLOCK".',
          '**Post-Loss Cooldown (#16)** — 30-minute auto-lock after 2 consecutive losses. Shows countdown. Clear requires no typed confirmation (lighter friction).',
          '**Drawdown Lockout (#10)** — trips when equity drops ≥ maxDrawdownPct from peak (default 15%). Computed at 3:35 PM EOD cron. Clear requires "UNLOCK".',
        ],
        tips: [
          'Don\'t reflexively clear a blocker — read WHY it tripped first. Often the market is telling you something.',
          'If multiple blockers fire on the same day, that\'s a strong signal to stop trading for the day regardless.',
        ],
      },
      {
        title: 'Per-bot kill switches (manual)',
        summary: 'Kill a single bot (swing / long-term / options-sell / options-buy) without halting the other three.',
        steps: [
          'Click a bot card → prompts for reason → bot is killed.',
          'Killed bots are blocked inside evaluateTrade() — trades they submit get rejected.',
          'Other bots + manual trades continue normally.',
          'Click "KILLED" card again to re-enable.',
        ],
        tips: [
          'Useful mid-session: if your Options Sell strategy isn\'t working today, kill just that bot.',
          'Each kill is logged in the audit trail (for SEBI compliance #46).',
        ],
      },
      {
        title: 'Panic button',
        summary: 'Nuclear option: trips daily-loss kill + drawdown lockout + all 4 bot kills with one click.',
        steps: [
          'Requires a typed reason (prompt).',
          'Backend confirmation "PANIC" prevents accidental triggering.',
          'Everything has to be manually cleared afterward — by design.',
        ],
        tips: [
          'Use when you\'re tilting, a black-swan event hits, or you\'re suspicious of a bot bug.',
          'Prefer "Clear all" (not automatic) on resume — gives you a moment to review before going back live.',
        ],
      },
      {
        title: 'Event history + compliance',
        summary: 'Every activation + clearance logged with timestamp, trigger (auto/manual), bot, reason.',
        tips: [
          'Click the history icon to expand the event log.',
          'This feed is the source for the future SEBI Compliance Log (#46) required for live algo trading.',
        ],
      },
    ],
  },

  // ─── Bots (Sprint 4 #1-#4) ────────────────────────────────────────────────
  {
    id: 'bots',
    title: 'Bot Ops (4 Paper Bots)',
    intro: 'The 4 paper bots — Swing, Long-term, Options Sell, Options Buy — each a scheduled wrapper around Scanner + Validator + Realism. Default: disabled. Pick a screen, enable, and wait for the cron (or click "Run now").',
    lessons: [
      {
        title: 'What each bot does',
        summary: 'Same code path for all 4 — difference is the screen, cron schedule, risk defaults (SL% and R:R), and liquidity band.',
        steps: [
          '**Swing Bot** (SWING-V1) · Tue-Fri 09:00 IST · 5% SL / 1:2 R:R · Mid liquidity · swing holding 2-4 wks',
          '**Long-term Bot** (LONGTERM-V1) · Mon 09:00 IST · 12% SL / 1:3 R:R · Large liquidity · 3-6 month holding',
          '**Options Sell Bot** (OPTSELL-V1) · Mon-Thu 11:30 IST · 50% SL / 0.5 R:R · premium selling',
          '**Options Buy Bot** (OPTBUY-V1) · Mon-Thu 10:00 IST · 30% SL / 1:2 R:R · directional premium',
        ],
        tips: [
          'Each run: checks kill switch → checks if disabled → checks screen configured → calls Scanner → logs BotRun audit.',
          'Auto runs skip gracefully on holidays and when market is closed.',
          'Manual "Run now" bypasses the enabled flag but still honors kill switches.',
        ],
      },
      {
        title: 'Setting up a bot',
        summary: 'Pick a screen, verify SL%/R:R/topN, enable, then either click "Run now" or wait for the cron.',
        steps: [
          '1) Pick a screen from the dropdown (only screens with batches show up).',
          '2) Tweak Top-N (how many top candidates to take), SL %, R:R.',
          '3) Toggle **ENABLED**. Auto runs now happen on the cron. Click "Run now" to trigger immediately.',
          '4) Watch "Show runs" for recent results — acceptance rate tells you if your caps are aligned with the screen output.',
        ],
        tips: [
          'If acceptance rate is 0%, the screen is producing stocks whose position notional exceeds your caps. Try a screen of mid/small-caps or raise `maxPositionPct` in Risk Settings.',
          'Every bot run produces a BotRun row + compliance events. You can trace a specific trade back to its run.',
        ],
      },
      {
        title: 'Kill switches + risk gates',
        summary: 'A bot that trips any kill switch skips its run. A candidate that fails any of the 9 Validator gates is rejected with reasons logged.',
        tips: [
          'Killing a specific bot (Kill Switch Board) halts only that bot.',
          'Drawdown lockout (Risk Engine) halts ALL bots until manually cleared.',
          'Disabling a bot stops auto runs but "Run now" still works — useful for debugging.',
        ],
      },
    ],
  },

  // ─── Scanner (Sprint 3 #5) ────────────────────────────────────────────────
  {
    id: 'scanner',
    title: 'Scanner',
    intro: 'Bot entry-point. Pulls top-N candidates from the latest batch of a selected screen, builds rule-based entry/SL/target levels, and submits them all through the Validator in one batch.',
    lessons: [
      {
        title: 'What it does',
        summary: 'POST /api/scanner/scan-screen reads ScreenBatch.rankedResults, builds mechanical candidates, runs them through Validator.validateBatch().',
        steps: [
          '1) Fetches the latest ScreenBatch for the selected screenId.',
          '2) Picks top-N symbols by score (default 5, max 20).',
          '3) Builds mechanical candidates with SL/target defaults per bot type: swing 5%SL / 1:2 R:R · longterm 12%SL / 1:3 R:R · options 30% / 1:2.',
          '4) Records a `generated` compliance event per candidate (full audit trail).',
          '5) Submits the batch to Validator — each candidate runs through all 9 gates.',
          '6) Returns per-candidate result + aggregated summary (accepted/rejected counts + top rejection reason).',
        ],
        tips: [
          'Two buttons: **Scan + Validate (dry run)** and **Scan + Save Accepted**. Always dry-run first to see which gates trip.',
          'When rejections cluster around one gate (e.g. "Sector … would reach 40%"), your portfolio is already over-concentrated — scanning more won\'t help.',
          'Scanner is rule-based for speed. For AI-computed levels (entry/SL/target reasoned from technicals), use the existing Trade Setup Generate flow (Perplexity).',
        ],
      },
      {
        title: 'Scanner Panel (Dashboard widget)',
        summary: 'Pick screen + bot + top-N + liquidity band → click Scan. See accept/reject count + per-candidate mini-cards.',
        steps: [
          'The screen dropdown shows totalBatches + historical avgHitRate so you can pick the highest-performing screen.',
          'Per-candidate cards are color-coded: green = accepted (saved as paper trade if you chose that button), red = rejected with reason preview.',
          'Click the "+N" on a rejected card to see all rejection reasons.',
          'Rejection breakdown at the bottom counts the top 5 reasons across the scan — invaluable for tuning.',
        ],
      },
      {
        title: 'Ad-hoc symbol scan',
        summary: 'POST /api/scanner/scan-symbol with { symbol, lastPrice, botId } — builds one candidate + runs through validator. Faster than the full screen path when you just want to test a single idea.',
      },
    ],
  },

  // ─── Validator (Sprint 3 #6) ──────────────────────────────────────────────
  {
    id: 'validator',
    title: 'Validator',
    intro: 'The single gate between "bot has an idea" and "paper trade gets saved". Wraps Risk Engine + Kill Switches + 2 extra bot-specific gates + SEBI compliance recording, all in one call.',
    lessons: [
      {
        title: 'What the Validator does',
        summary: 'POST /api/validator/validate runs every candidate through 9 gates before accept/reject. Every call is audit-logged.',
        steps: [
          'Gate 1 — Kill switch active? (Sprint 1 #15 Daily Loss Breaker)',
          'Gate 2 — Post-loss cooldown? (Sprint 1 #16)',
          'Gate 3 — Drawdown lockout? (Sprint 3 #10)',
          'Gate 4 — Per-trade risk ≤ riskPerTrade% of capital',
          'Gate 5 — Position notional ≤ maxPositionPct% of capital',
          'Gate 6 — Sector concentration stays below cap after this trade',
          'Gate 7 — Per-bot kill switch? (Sprint 3 #11)',
          'Gate 8 — Per-bot capital + concurrent positions',
          'Gate 9 — Duplicate-open check (don\'t re-enter a symbol the same bot already holds)',
          'Gate 10 — Market-hours check (unless `allowOffHours: true`)',
        ],
        tips: [
          'Every candidate produces an `evaluated` compliance event; rejected ones also get a `rejected` event with the full reasons[].',
          'Accepted candidates can be optionally persisted by passing `persist=true` — they become real TradeSetup rows with Realism Engine entry costs applied (Sprint 3 #9).',
        ],
      },
      {
        title: 'Validator Panel (Dashboard widget)',
        summary: 'Interactive "will this pass?" form — useful before placing a manual trade OR to test why a bot candidate is being rejected.',
        steps: [
          'Fill botId + symbol + side + qty + entry/SL/target + sector + segment + liquidity band.',
          'Click "Validate (dry run)" — runs all gates, shows accept/reject with reason list + expandable gate snapshot.',
          'If accepted, click "Save as Paper Trade" to persist (same as paper-trade POST but with full validator contract).',
          'Recent validations list at the bottom — spot patterns like "every swing Energy trade is rejected" instantly.',
        ],
        tips: [
          '`allow off-hours` — on by default so you can plan trades evenings; uncheck to enforce market-hours gate.',
          'Gate snapshot JSON reveals exact check values (risk limits, sector %, etc.) — invaluable when debugging.',
          'This widget is the single source of truth; when Sprint 4 bots ship, they\'ll call the same endpoint.',
        ],
      },
      {
        title: 'Batch validation (for Scanner)',
        summary: 'POST /api/validator/validate-batch accepts `candidates: [...]` and runs them all. Used by the upcoming Scanner (#5) to evaluate 20-50 candidates in one pass.',
      },
    ],
  },

  // ─── SEBI Compliance Log (Sprint 3 #46) ───────────────────────────────────
  {
    id: 'compliance',
    title: 'SEBI Compliance Log',
    intro: 'Immutable audit trail of every algo decision (accepted, rejected, canceled, filled, target hit, stop hit). Required from Day 1 for live algorithmic trading in India.',
    lessons: [
      {
        title: 'Algo Registry',
        summary: '5 algos pre-registered: MANUAL-V1, SWING-V1, LONGTERM-V1, OPTSELL-V1, OPTBUY-V1. SEBI requires a unique algoId per strategy + declared static IP when live.',
        tips: [
          'Seeded automatically on server boot — idempotent (safe to restart).',
          'Every compliance event carries an algoId. When live, each algoId must map to a declared static IP address.',
          'Bump version (v1 → v2) when you materially change a strategy\'s logic. Past events keep the old algoId.',
        ],
      },
      {
        title: 'Event types',
        summary: 'Every stage of a trade life-cycle is recorded:',
        steps: [
          '`generated`  — Scanner produced a candidate (Sprint 4+)',
          '`evaluated`  — Risk Engine ran all gates (Sprint 3 #10)',
          '`accepted`   — Trade passed all gates; TradeSetup persisted',
          '`rejected`   — Trade blocked; reasons[] captured in detail',
          '`executed`   — Order sent to broker (live only)',
          '`filled`     — Broker confirmed fill (live only)',
          '`canceled`   — Manual cancellation or kill-switch-triggered abort',
          '`target_hit` / `sl_hit` / `expired` — outcome',
        ],
        tips: [
          'Paper trades produce accepted → target_hit/sl_hit (no executed/filled since there\'s no broker).',
          'Kill-switch activations mirror here as `canceled` events — one unified audit feed.',
        ],
      },
      {
        title: 'Filters + CSV export',
        summary: 'Filter by bot, decision, symbol, date range. Export CSV for SEBI submission if audited.',
        steps: [
          'Click "Export CSV" — downloads the filtered set with full schema (timestamp, algoId, decision, reasoning, reasons, latency, IP, etc).',
          'Header fields: at, algoId, botId, decision, symbol, action, quantity, entryPrice, stopLoss, target, price, reasoning, reasons, clientIp, staticIp, latencyMs, orderRef, tradeSetupId.',
          'Retention: 7 years (no auto-delete). When you purge, do it manually and keep the exported CSV.',
        ],
        tips: [
          'Export weekly for off-site backup — compliance data shouldn\'t depend on a single MongoDB instance.',
          'When SEBI audits, they may ask for a specific date range + algoId. Filter, then export.',
        ],
      },
    ],
  },

  // ─── System self-awareness ────────────────────────────────────────────────
  {
    id: 'system-health',
    title: 'System Health & Duties',
    intro: 'The dashboard knows its own scheduled duties and alerts if anything is missed.',
    lessons: [
      {
        title: 'Data Health Panel',
        summary: 'Top-level tab showing which APIs are live, which values are demo, last refresh times.',
        tips: ['Open when a value looks off — this tells you which data source is healthy.'],
      },
      {
        title: 'Cadence Registry',
        summary: 'Tracks every scheduled task (cron + user activity) with expected cadence. Notifies if missed.',
        tips: [
          'Bell icon in top nav shows missed-task count.',
          'Open Help tab → "Duty Status" to see full registry.',
          'When you add a new cron, register it via TaskRegistry.reportRun() so heartbeat works.',
        ],
      },
      {
        title: 'Control Center',
        summary: 'Admin panel showing last build status, dead-code audit, snapshot state.',
        tips: ['Use this when something feels broken — it surfaces recent changes.'],
      },
    ],
  },

  {
    id: 'settings',
    title: 'Settings tab',
    intro: 'Configuration for capital, risk, API keys, notifications.',
    lessons: [
      {
        title: 'API Keys',
        summary: 'Set Perplexity / Upstox / Angel One keys via UI (no file editing).',
        tips: ['Changes apply immediately — no server restart needed. Values are masked by default.'],
      },
      {
        title: 'Risk settings',
        summary: 'Configure capital, risk-per-trade %, daily loss limit %.',
        tips: [
          'Default capital: ₹5,00,000. Adjust to your real capital.',
          'Default risk-per-trade: 1–2% (blueprint recommends 1%).',
          'Default daily loss limit: 5% (blueprint recommends 2%).',
        ],
      },
    ],
  },

  // ─── The 4 Bots (coming soon) ─────────────────────────────────────────────
  {
    id: 'bots-coming',
    title: 'Bot Command Center (Sprint 3+)',
    intro: 'Four fully-separate bots for Swing Stocks, Long-term, Options Selling, Options Buying. Planned for Sprint 3.',
    lessons: [
      {
        title: 'Bot architecture',
        summary: 'Scanner (zero API) → Validator (minimal API) → Executor (paper or live). 14 curated strategies.',
        tips: ['Each bot has own capital, own kill switch, own P&L, own validation path to live.'],
      },
      {
        title: 'Paper-to-live progression',
        summary: 'Minimum 60 days paper + Sharpe > 1.0 + 50 trades per segment before graduating to real money.',
        tips: ['Validation criteria strict by design — prevents shipping bots with no real edge.'],
      },
    ],
  },

  // ─── Remote access (Phase 6) ──────────────────────────────────────────────
  {
    id: 'remote-access',
    title: 'Remote Access (Phone)',
    intro: 'Use the dashboard from your phone when you\'re away from home — safely, with Tailscale.',
    lessons: [
      {
        title: 'Install Tailscale (free)',
        summary: 'Tailscale is a free personal mesh VPN. Installs in 5 minutes on desktop + phone; no router config, no public URL.',
        steps: [
          'Sign up at tailscale.com with Google / Microsoft / Apple.',
          'Install the Tailscale app on your Windows desktop (system tray icon).',
          'Install the Tailscale app on your phone (App Store / Play Store). Log in with the same account.',
          'Both devices auto-join your private "tailnet".',
        ],
        tips: [
          'Full step-by-step in docs/TAILSCALE_SETUP.md in the project root.',
          'Only YOUR devices can reach the dashboard — no public exposure.',
          'Works on cellular data — no need to be on the same Wi-Fi.',
        ],
      },
      {
        title: 'Open the dashboard from your phone',
        summary: 'Once Tailscale is installed on both devices, open http://<desktop-name>:3000 on your phone. Use the desktop name Tailscale shows in its admin console (MagicDNS).',
        tips: [
          'Leave the backend + frontend running on desktop (npm run dev + npm run backend:dev).',
          'Keep Windows awake — Tailscale can\'t wake a sleeping machine.',
          'Windows Firewall may need to allow Node.js on "Private networks".',
        ],
      },
      {
        title: 'Install as a PWA (Add to Home Screen)',
        summary: 'Once loaded on your phone, tap Share → Add to Home Screen (iOS) or Menu → Install App (Android). The dashboard becomes a full-screen app icon.',
        tips: [
          'No App Store review — installs instantly from the browser.',
          'Offline-aware: shows a banner when your phone loses connection.',
          'Works like a native app: swipes, touch targets, portrait mode.',
        ],
      },
      {
        title: 'Why not a public URL (ngrok, Cloudflare)?',
        summary: 'Tailscale is private by default. Public tunnels expose your dashboard + Upstox token to the internet — strangers can probe it.',
        warnings: [
          'Do NOT expose localhost:3000 to the public internet without knowing the security implications.',
          'For a single-user personal dashboard, Tailscale is strictly safer.',
        ],
      },
    ],
  },

  // ─── Phase 6 features ─────────────────────────────────────────────────────
  {
    id: 'phase6-features',
    title: 'Phase 6 — Mobile & UX polish',
    intro: 'Mobile-first polish: PWA install, voice journal, tax-lot optimizer, and a "what changed since last login" banner.',
    lessons: [
      {
        title: 'PWA install',
        summary: 'The dashboard is now installable as a phone app. On Dashboard home, your phone browser will offer "Add to Home Screen" / "Install App".',
        tips: [
          'After install, launch from the home screen icon — full-screen, no browser chrome.',
          'Offline banner appears at top when you lose connection (live prices pause automatically).',
          'Service worker is minimal — no caching of sensitive data; everything stays live-fetched.',
        ],
      },
      {
        title: 'Voice Journal',
        summary: 'Record up to 60 seconds of voice notes per trade. Transcription runs on OpenAI Whisper and attaches to the trade as text.',
        steps: [
          'Go to the Journal tab.',
          'Tap Record → speak your reflection → tap Stop (or wait 60s auto-stop).',
          'The clip is transcribed and saved. Raw audio is NEVER stored.',
        ],
        tips: [
          'Set OPENAI_API_KEY in backend/.env to enable transcription (~₹4 / 100 min).',
          'Without the key, a placeholder note is saved so the pipeline still works.',
        ],
        warnings: ['Do not include account numbers or sensitive info in voice notes.'],
      },
      {
        title: 'Tax-Lot Optimizer',
        summary: 'When you\'re about to sell, the optimizer suggests WHICH buy-lots to exit first to minimize STCG / LTCG tax.',
        steps: [
          'Portfolio Analyzer → click the Tax-Lot button on any holding.',
          'Enter quantity to sell → view the suggested lot order.',
          'Compare "Tax (FIFO)" vs "Tax (Optimal)" — the difference is your savings.',
        ],
        tips: [
          'Profit exit → LTCG lots picked first (10% vs 15% STCG).',
          'Loss exit → STCG lots first (can offset other STCG gains).',
          'Advisory only — no orders are placed.',
        ],
        warnings: [
          'LTCG ₹1L/year exemption is NOT applied per-trade; confirm with CA at ITR time.',
          'F&O is NOT covered (taxed as business income at slab rate).',
        ],
      },
      {
        title: '"What changed since last login" banner',
        summary: 'A dismissible banner on Dashboard shows new suggestions, closed trades, regime changes, and agent activity since your last visit.',
        tips: [
          'Click Details to expand closed-trade list + regime transitions.',
          'Dismiss resets the timestamp so next visit\'s banner is fresh.',
        ],
      },
    ],
  },
];
