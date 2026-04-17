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
];
