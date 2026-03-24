# Project Memory — Vinit's AI Stock Trading Dashboard

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
- 11 visible tabs: Dashboard, History, Portfolio, Alerts, AI Analysis, Search, News, Screens, Journal, Paper Trading, Settings
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
