# Dashboard Debugging Prompt Template

**Copy and paste this to AI assistant when you encounter an error:**

---

## Problem Description

My AI Stock Dashboard is showing [DEMO/LIVE] badges, but [describe the issue].

## Health Check Results

```json
[Paste the result from: http://localhost:5002/api/health-check/upstox]
```

## Backend Logs (Last 50 Lines)

```
[Paste from backend terminal - scroll up and copy last ~50 lines]
```

## Frontend Browser Console (If Relevant)

```
[Press F12 → Console tab → copy any red errors]
```

## Dashboard Screenshot

[Describe what you see on the dashboard, or attach screenshot]
- Badge color: [RED DEMO / GREEN LIVE]
- NIFTY price shown: ₹ _______
- SENSEX price shown: ₹ _______
- BANKNIFTY price shown: ₹ _______

## What I Already Tried

- [ ] Checked health endpoint: http://localhost:5002/api/health-check/upstox
- [ ] Restarted backend server
- [ ] Refreshed browser (Ctrl+Shift+R)
- [ ] Checked Upstox token in backend/.env
- [ ] Other: _______

## Environment Info

**Project Directory:**
```
E:\Dashboard_project Latest\dashboard_project
```

**Servers Running:**
- Backend: [YES/NO] on port _____
- Frontend: [YES/NO] on port _____

**Last Token Update:**
- Updated [today / X days ago / don't remember]

---

## Context

This is a Next.js frontend (port 3000) with Express backend (port 5002) connecting to Upstox API for live Indian stock market data. 

**Key files:**
- Backend Upstox service: `services/upstoxService.js`
- Backend routes: `backend/routes/upstox.js`
- Frontend API route: `app/api/ltp/route.ts`
- Frontend hook: `app/hooks/useLTP.ts`
- Config: `app/lib/config.ts`

**Recent fixes applied:**
- Port mismatch fix (5001→5002)
- Symbol mapping (NIFTY → NSE_INDEX|Nifty 50)
- Data transformation fix (colon vs pipe separator)
- Rate limiter bypass for real-time data
- Health check endpoints added

**Environment:**
- Windows 10/11
- PowerShell
- Node.js with npm

Please help me debug this issue!
