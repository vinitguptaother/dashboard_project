# Project Memory — Vinit's AI Stock Trading Dashboard

## 📂 FIRST STEP EVERY SESSION
Before writing any code, read:
1. `project_logs/BOT_BLUEPRINT.md` — **canonical source of truth** (49 features, 4-bot architecture, locked decisions)
2. `project_logs/STATE.md` — where we are + next 3 steps + file inventory
3. `project_logs/ROADMAP.md` — 6-sprint build order + priorities
4. `project_logs/BLUEPRINT.md` — original vision, stack, principles (if unfamiliar)
5. `project_logs/CHANGELOG.md` — only if you need recent history or lessons

## 💾 ALWAYS TAKE A BACKUP BEFORE MAKING CHANGES
User's explicit rule: before starting any code work in a session, run `npm run backup` (or `npm run backup:force` if validation is RED). Backup goes to `F:\Dashboard backup\last-known-good\`. Living Blueprint auto-regenerates as part of this. Never skip this step, even if the task feels small — you cannot know how it will expand.

## 🏃 WORK STYLE — User's explicit rules (locked 2026-04-17)
1. **Speed + completion focus.** User wants to ship features fast, not pause for test cycles. Testing happens in parallel but is not a gate. Many projects queued after this one.
2. **Do NOT suggest rest / breaks / "stopping points".** Keep building unless there's a genuine technical blocker (pipeline RED, data loss, missing requirement). Do not offer "we've done a lot, shall we stop?" — user explicitly forbids it.
3. **Build-then-verify, not plan-forever-then-build.** Keep planning bursts short; spend time executing.
4. **Every feature must be added to the instructions/Help tab.** When a new feature ships, update `app/components/HelpTab.tsx` with usage docs in the same commit.
5. **Every scheduled activity must be registered in the Cadence Registry.** When a new cron or daily/weekly/monthly duty ships, seed it in `CadenceTask` so missed-task detection works. User's dashboard should be self-aware of its duties.

## 📝 END OF SESSION — Log maintenance (NON-NEGOTIABLE)
If this session produced **meaningful changes** (feature shipped, bug fixed, plan discussed/agreed, architecture decision made), before ending the turn:

1. **`project_logs/CHANGELOG.md`** — append a dated entry at the top. Format: `## YYYY-MM-DD — Session title` then sub-sections `### Added / Changed / Fixed / Verified / Plans made / Lessons learned`. Match today's date. One session = one entry, even if it spanned multiple tasks. Be specific: list files, endpoints, design decisions.

2. **`project_logs/STATE.md`** — update any sections that changed:
   - "What's Working" — tick off completed items, update cron count / endpoint count / tab count
   - "Currently Building" — update the gap/status table
   - "Next 3 Immediate Actions" — reorder to reflect the new front of the queue
   - "File Inventory" — add new models / components / services / routes
   - Bump the "Updated:" date at the top

3. **`project_logs/ROADMAP.md`** — if Vinit and Claude discussed a new feature, enhancement, or shift in priorities, land it here **before** ending the session. Never rely on chat memory for plans. Use the existing sections (Active Sprint / Next Sprint / Short-term / Long-term / Ideas captured / Retired).

Skip the log update only for trivial sessions (pure Q&A, read-only exploration, no code touched). When in doubt, log it. A 2-line entry beats amnesia next session.

**Location reminder:** these files are at `project_logs/` (project root), NOT `docs/`. The `docs/LIVING_BLUEPRINT.md` is auto-generated from code scans and is separate — do not edit it.

## CRITICAL FACTS — DO NOT GET THESE WRONG

### Database
- MongoDB IS connected and working on `localhost:27017/stock_dashboard`
- Connection config: `backend/config/database.js` (uses `process.env.MONGODB_URI` with fallback to `mongodb://localhost:27017/stock_dashboard`)
- The `.env` file does NOT contain MONGODB_URI — it uses the localhost fallback and THAT IS FINE
- 188 instruments loaded in DB
- **NEVER tell the user MongoDB is missing or not connected. It works.**

### Live Market Data
- Upstox API token is valid (335 chars, expires ~2027)
- Live prices working: NIFTY, SENSEX, BANKNIFTY via `/ltp` endpoint
- Index prices (NIFTY, SENSEX, BANKNIFTY) fetch correctly
- Individual stock quotes (RELIANCE, TCS, INFY, HDFC) sometimes return null from Upstox — known minor issue
- The error `Cannot read properties of null (reading 'error')` is a null-check bug in market data refresh for individual stocks — does NOT affect core functionality

### Backend
- Server runs on port 5002
- Redis is optional — uses in-memory caching (this is fine)
- All 20 route files registered and working
- 3 critical crons: paper trade monitor (every 2min market hours), auto-expiry (10:30 PM), screen scoring (11 PM)
- WebSocket server ready for real-time updates

### Frontend
- Next.js on port 3000
- 12 visible tabs: Dashboard, History, Portfolio, Alerts, AI Analysis, Search, News, Screens, Journal, Paper Trading, Options, Settings
- 2 hidden tabs: API Integration, Upstox

### Tech Stack
- Frontend: Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Express.js + MongoDB (Mongoose) + Socket.IO
- AI: Perplexity API (sonar-pro model) — has live internet access
- Market Data: Upstox API (real LTP, no demo/fake data)
- Fonts: JetBrains Mono (numbers), Inter (body)

### User Context
- Vinit is NOT from a technical background — explain things simply
- Dashboard purpose: Swing trading + long-term investing in Indian stocks (NSE/BSE)
- Core workflow: Run screens on Screener.in → Upload CSV → AI ranks stocks → Generate trade setups → Paper trade → Track hit rates → Score screens
- Currency: INR (₹), Indian number system (lakhs, crores)
- Market hours: 9:15 AM - 3:30 PM IST, Mon-Fri

### UI/UX
- Lovable project downloaded as ZIP at: `C:\Users\Vinit Gupta\Downloads\vinit-s-ai-stock-suggesting-dashboard-main.zip`
- GitHub: `https://github.com/vinitguptaother/vinit-s-ai-stock-suggesting-dashboard.git`
- Plan: Use Lovable project as skin/reference to restyle the dashboard (waiting for credits refresh)
- All 11 pages + Deep Research (7 Goldman Sachs sections) implemented in Lovable

### Rules
- NEVER break working functionality when making changes
- ALWAYS verify after edits (TypeScript check, build check)
- Be efficient with credits — user is on limited plan
- When analyzing, READ actual files/logs before making claims
- Do not give wrong information about what's connected/working — CHECK FIRST
