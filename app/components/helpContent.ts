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
