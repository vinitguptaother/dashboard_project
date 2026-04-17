# BLUEPRINT — Vinit's AI Stock Trading Dashboard

*Evergreen document. Update only on major pivots.*

---

## 1. The Vision

A single-pane dashboard for an Indian retail trader (Vinit) who does:
- **Swing trading** (2 days – 6 months)
- **Long-term investing** (6 months+)

in **NSE and BSE stocks**, plus **index options** on NIFTY / BANKNIFTY.

### Core Workflow
```
Run screens on Screener.in
    ↓
Upload CSV to dashboard
    ↓
AI ranks stocks (Perplexity sonar-pro, live internet)
    ↓
Dashboard generates trade setups (entry, SL, target)
    ↓
User paper-trades the setups
    ↓
System tracks hit rates per screen
    ↓
Screens get scored → best screens surface on top
```

The dashboard is NOT a broker. It's a decision-support and tracking system.

---

## 2. The User — Vinit

- **Non-technical** — no CS background, learns by doing
- Trades from Mumbai, uses the dashboard daily during market hours
- Has limited AI credits — **efficiency matters**
- Prefers plain English over jargon
- Copies code from Claude into VS Code, runs in terminal
- Currency: always **INR (₹)**, Indian number system (lakhs, crores)

### When Claude talks to Vinit
1. Plain English first (1–2 sentences of what we're building)
2. Step-by-step numbered instructions
3. Always give the exact file path to save
4. Comment every code block with `// What this does:`
5. Full copy-paste code — no pseudocode, no TODOs
6. End every step with a "to verify: go to X" line
7. Flag anything risky with ⚠️

---

## 3. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 14 App Router + TypeScript + Tailwind | Fast, type-safe, modern |
| Backend | Express.js + Mongoose | Simple, battle-tested |
| Database | MongoDB (localhost:27017/stock_dashboard) | Flexible schema for evolving requirements |
| Market data | Upstox API v2/v3 | Real LTP, options chain, historical candles |
| AI | Perplexity sonar-pro | Live internet access, cheaper than Claude for ranking |
| Real-time | Socket.IO + WebSocket | Live prices & paper-trade updates |
| Charts | Recharts 2.8.0 | Good enough for payoff + sparklines |
| Fonts | JetBrains Mono (numbers), Inter (body) | Readability |
| Cache | In-memory (Redis optional, not required) | Keeps deploy simple |

**Ports:** Frontend 3000 | Backend 5002 | Mongo 27017

---

## 4. The 12 Tabs (+2 hidden)

| # | Tab | Purpose |
|---|-----|---------|
| 1 | Dashboard | Market overview, indices, today's top ideas, active idea batches |
| 2 | History | Past trades, hit rates, screen scoring stats |
| 3 | Portfolio | Real holdings from Upstox |
| 4 | Alerts | Price alerts (email/WhatsApp) |
| 5 | AI Analysis | Perplexity-powered stock deep-dive |
| 6 | Search | Instrument search + quote |
| 7 | News | Market + stock news with sentiment |
| 8 | Screens | Upload Screener.in CSV, AI ranks + generates setups |
| 9 | Journal | Trade journal with notes |
| 10 | Paper Trading | Mock trades, auto-monitor every 2 min in market hours |
| 11 | **Options** | Option chain, strategy builder, payoff chart, mock options trades |
| 12 | Settings | Config, API keys, preferences |
| — | API Integration (hidden) | Debugging tool |
| — | Upstox (hidden) | Token management |

---

## 5. Core Principles (NEVER VIOLATE)

1. **Never break working features** when making changes
2. **Always verify after edits** — TypeScript check, build check
3. **Be efficient with credits** — user is on limited plan
4. **Read actual files/logs** before making claims — never guess
5. **Never claim something is broken without checking** (e.g., MongoDB IS connected)
6. **No fake data** — always real Upstox LTP, never placeholder numbers
7. **Update `project_logs/STATE.md` and `CHANGELOG.md` at end of every session**

---

## 6. Architecture Rules

### Backend
- Routes live in `backend/routes/*.js`
- Business logic in `backend/services/*.js`
- Math/utils in `backend/utils/*.js`
- Schemas in `backend/models/*.js`
- All routes registered in `backend/server.js`
- Critical crons: paper-trade monitor (every 2min), auto-expiry (10:30 PM), screen scoring (11 PM)

### Frontend
- Tabs registered in `app/components/Navigation.tsx` + switch in `app/page.tsx`
- Shared components in `app/components/`
- Lucide React for icons
- Tailwind only (no shadcn currently, plan is to restyle with Lovable skin later)

### Database
- MongoDB on localhost:27017/stock_dashboard
- Connection config: `backend/config/database.js`
- **188 instruments pre-loaded** (don't re-seed)

---

## 7. API Keys & Secrets

Stored in `backend/.env` (gitignored):
- `UPSTOX_ACCESS_TOKEN` — 335 chars, expires ~2027
- `PERPLEXITY_API_KEY` — for sonar-pro AI
- `MONGODB_URI` — falls back to localhost (that's fine, leave it)

---

## 8. External References

- **Lovable UI project** (for future restyling): `C:\Users\Vinit Gupta\Downloads\vinit-s-ai-stock-suggesting-dashboard-main.zip`
- **GitHub**: `https://github.com/vinitguptaother/vinit-s-ai-stock-suggesting-dashboard.git`
- **Sensibull** (reference for Options tab gap analysis)
- **Screener.in** (source of stock screens via CSV upload)

---

*Last updated: 2026-04-16*
