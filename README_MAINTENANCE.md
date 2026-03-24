# Dashboard Maintenance Guide

**Your AI Stock Dashboard is now fixed and has self-diagnostic tools!**

---

## 📖 Documentation Files

| File | When to Use |
|------|-------------|
| **`QUICK_START.md`** | Daily startup & basic operations |
| **`TROUBLESHOOTING.md`** | When something breaks - step-by-step fixes |
| **`FIXES_APPLIED.md`** | Technical details of what was fixed |
| **`COPY_THIS_WHEN_BROKEN.txt`** | Template to send to AI assistant |
| **`start-dashboard.bat`** | One-click startup script |

---

## 🚀 Quick Actions

### Starting Dashboard
```
Double-click: start-dashboard.bat
```

### Check Health (Do this first if something is wrong!)
```
Open in browser: http://localhost:5002/api/health-check/upstox
```

### Renew Upstox Token (Every 24 hours)
1. https://account.upstox.com/developer/apps
2. Generate new token
3. Update `backend\.env`
4. Restart backend

---

## ⚠️ When Dashboard Shows "DEMO" or Breaks

### Step 1: Check Health
```
http://localhost:5002/api/health-check/upstox
```

### Step 2: Follow Instructions
The health check will tell you EXACTLY what's wrong and how to fix it.

### Step 3: If Still Broken
1. Open `COPY_THIS_WHEN_BROKEN.txt`
2. Fill in all the sections
3. Copy everything
4. Paste to AI assistant (ChatGPT, Claude, etc.)
5. Get instant diagnosis!

---

## 📅 Daily Maintenance

**Before using dashboard each day:**

1. ✅ Start servers: `start-dashboard.bat`
2. ✅ Check health: http://localhost:5002/api/health-check/upstox
3. ✅ Verify "LIVE" badges (green, not red)
4. ✅ Check token expiry (should have hours left)

**If token expires today:**
- Renew it first thing in the morning (takes 2 min)

---

## 🔧 Common Issues & Quick Fixes

| Problem | Solution |
|---------|----------|
| Shows "DEMO" badges | Check health endpoint → follow its instructions |
| Port already in use | Kill process: `netstat -ano \| findstr :5002` then `taskkill /PID XXX /F` |
| ECONNREFUSED errors | Check `backend\.env` and `.env.local` have correct ports |
| Wrong prices | Likely using demo data - check health endpoint |
| 429 Rate limit errors | Restart backend server |

---

## 🎯 Key URLs (Bookmark These!)

- **Dashboard:** http://localhost:3000
- **Health Check:** http://localhost:5002/api/health-check/upstox
- **Backend Status:** http://localhost:5002/api/health-check/backend
- **Upstox Dev Portal:** https://account.upstox.com/developer/apps

---

## 📁 Important File Locations

```
E:\Dashboard_project Latest\dashboard_project\
│
├── start-dashboard.bat              ← Double-click to start
├── QUICK_START.md                  ← Daily operations guide
├── TROUBLESHOOTING.md              ← Fix any issue
├── COPY_THIS_WHEN_BROKEN.txt       ← AI debugging template
├── FIXES_APPLIED.md                ← What was fixed
├── README_MAINTENANCE.md           ← This file
│
├── .env.local                      ← Frontend config
│   └── NEXT_PUBLIC_BACKEND_URL=http://localhost:5002
│
├── backend\
│   ├── .env                        ← ⚠️ Upstox token here!
│   │   └── UPSTOX_ACCESS_TOKEN=...
│   ├── server.js                   ← Backend entry point
│   └── routes\
│       ├── upstox.js               ← Upstox API routes
│       └── healthCheck.js          ← Health check endpoints
│
├── services\
│   └── upstoxService.js            ← Symbol mapping & API calls
│
└── app\
    ├── api\ltp\route.ts            ← Frontend API proxy
    ├── hooks\useLTP.ts             ← Real-time data hook
    └── lib\config.ts               ← Configuration
```

---

## 🛡️ Health Check System

**This is your dashboard's self-diagnostic tool!**

### Upstox Health Check
```
GET http://localhost:5002/api/health-check/upstox
```

**Checks:**
- ✅ Token exists
- ✅ Token format valid
- ✅ Token not expired
- ✅ API connection working
- ✅ Data looks realistic

**Returns:**
- `status`: success/error
- `issue`: What's wrong (if error)
- `solution`: How to fix it
- `usingDemoData`: true/false
- `tokenExpiresIn`: Hours remaining

### Backend Health Check
```
GET http://localhost:5002/api/health-check/backend
```

**Checks:**
- ✅ Server running
- ✅ Port configuration
- ✅ Token configured
- ✅ Uptime

---

## 🔄 Typical Workflow

### Morning Routine (2 minutes):
```
1. Double-click start-dashboard.bat
2. Wait for browser to open health check
3. Verify: "status": "success"
4. Click dashboard tab
5. Verify: Green "LIVE" badges
6. Done! Use dashboard normally
```

### If Health Check Shows Error:
```
1. Read "issue" and "solution" fields
2. Follow the solution (usually: renew token)
3. Restart backend
4. Refresh dashboard
5. Done!
```

### End of Day:
```
1. Close both terminal windows (Ctrl+C)
2. Close browser tabs
3. That's it!
```

---

## 🚨 Emergency Reset (Last Resort)

If NOTHING works:

```powershell
# 1. Stop everything
# Press Ctrl+C in both terminals

# 2. Full restart
cd "E:\Dashboard_project Latest\dashboard_project"
cd backend
npm run dev
# Wait for: "Server running on port 5002"

# 3. In new terminal:
cd "E:\Dashboard_project Latest\dashboard_project"
npm run dev
# Wait for: "Ready in XXXms"

# 4. Check health:
# Open: http://localhost:5002/api/health-check/upstox

# 5. If still broken:
# Open COPY_THIS_WHEN_BROKEN.txt and contact AI
```

---

## 📞 Getting Help

**If you need to contact AI assistant:**

1. Open `COPY_THIS_WHEN_BROKEN.txt`
2. Fill in all sections with:
   - Health check result (JSON)
   - Backend logs (last 50 lines)
   - Browser console errors
   - What you tried
3. Copy the entire file
4. Paste to AI assistant
5. Get instant help!

**The AI will understand your setup because it has:**
- Complete context about the fixes applied
- Knowledge of your file structure
- Understanding of common issues
- Quick solutions ready

---

## 🎓 Understanding the System

### Data Flow:
```
1. Frontend (Next.js) polls every 5 seconds
2. Calls: /api/ltp?instruments=NIFTY,SENSEX,BANKNIFTY
3. Frontend API route proxies to backend
4. Backend maps: NIFTY → NSE_INDEX|Nifty 50
5. Backend calls Upstox API
6. Response transformed back: NSE_INDEX:Nifty 50 → NIFTY
7. Frontend receives: {NIFTY: {lastPrice: 25876.85}}
8. Dashboard displays with green "LIVE" badge
```

### Why It Breaks:
1. **Token expires** (every 24 hours) → Use demo data
2. **Port mismatch** → ECONNREFUSED
3. **Rate limiting** → 429 errors
4. **Backend not running** → Connection failed

### How It's Fixed:
1. **Health checks** detect issues early
2. **Symbol mapping** handles Upstox format
3. **Rate limiter bypass** for real-time routes
4. **Clear error messages** guide you to fix

---

## ✅ Success Indicators

**Your dashboard is working correctly when:**

- ✅ Green "LIVE" badges visible
- ✅ NIFTY price: 24,000-26,000
- ✅ SENSEX price: 80,000-85,000
- ✅ BANKNIFTY price: 52,000-60,000
- ✅ Prices update every 5 seconds
- ✅ Health check shows "success"
- ✅ No red errors in browser console
- ✅ Backend logs show "✅ Real LTP data fetched"

**Your dashboard is broken when:**

- ❌ Red "DEMO" badges visible
- ❌ Random unrealistic prices (₹500-₹2000)
- ❌ Prices change wildly on each refresh
- ❌ Health check shows "error"
- ❌ ECONNREFUSED errors
- ❌ Backend logs show "Using demo mode"

---

## 🎉 That's It!

**You now have:**
- ✅ Working dashboard with live data
- ✅ Self-diagnostic health checks
- ✅ One-click startup script
- ✅ Complete troubleshooting guides
- ✅ AI debugging template
- ✅ Prevention strategies

**Remember:** Check the health endpoint first when something seems wrong!

**Most issues are fixed by:** Renewing the Upstox token and restarting the backend.

**Questions?** Open `TROUBLESHOOTING.md` or use `COPY_THIS_WHEN_BROKEN.txt` with AI assistant.

---

*Last updated: 2026-01-08*
*Version: 1.0*
