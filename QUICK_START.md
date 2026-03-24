# Quick Start Guide

## Starting the Dashboard (Easy Way)

**Double-click:** `start-dashboard.bat`

This will:
1. Start backend server (port 5002)
2. Start frontend server (port 3000)
3. Open health check in browser
4. Open dashboard

---

## Manual Start

### Terminal 1 (Backend):
```bash
cd "E:\Dashboard_project Latest\dashboard_project\backend"
npm run dev
```

Wait for: `🚀 Server running on port 5002`

### Terminal 2 (Frontend):
```bash
cd "E:\Dashboard_project Latest\dashboard_project"
npm run dev
```

Wait for: `✓ Ready in XXXms`

### Open Dashboard:
```
http://localhost:3000
```

---

## Health Check (Do This First!)

Before using the dashboard, check if everything is working:

**Open in browser:**
```
http://localhost:5002/api/health-check/upstox
```

### ✅ Good Response:
```json
{
  "status": "success",
  "message": "Upstox API is working correctly",
  "testData": {
    "symbol": "NIFTY",
    "price": 25876.85
  },
  "usingDemoData": false,
  "tokenExpiresIn": "12 hours"
}
```

### ❌ Bad Response (Token Expired):
```json
{
  "status": "error",
  "issue": "TOKEN_EXPIRED",
  "message": "Access token has expired",
  "solution": "Generate a new access token from Upstox..."
}
```

**Fix:** See "Renewing Upstox Token" below

---

## Renewing Upstox Token

**You need to do this every 24 hours!**

### Step 1: Generate New Token
1. Go to: https://account.upstox.com/developer/apps
2. Click on your app
3. Click "Generate Token"
4. Copy the new access token

### Step 2: Update Backend
1. Open: `backend\.env`
2. Find line: `UPSTOX_ACCESS_TOKEN=...`
3. Replace with new token
4. Save file

### Step 3: Restart Backend
```bash
# In backend terminal, press Ctrl+C, then:
npm run dev
```

**Done!** No need to restart frontend.

---

## Checking if Dashboard is Working

### Look for Green "LIVE" Badges:
- ✅ Green badge = Real data from Upstox
- ❌ Red "DEMO" badge = Using fake data (something is wrong)

### Check Prices are Realistic:
- NIFTY: ~24,000-26,000
- SENSEX: ~80,000-85,000
- BANKNIFTY: ~52,000-60,000

If prices look random (like ₹1,234 or ₹987), you're seeing demo data!

---

## Common Problems & Quick Fixes

### Problem: Dashboard shows "DEMO" badges

**Quick Fix:**
```
1. Check: http://localhost:5002/api/health-check/upstox
2. Read the "issue" field
3. Follow the "solution" field
```

### Problem: Backend won't start (port in use)

**Quick Fix:**
```powershell
# Find what's using port 5002:
netstat -ano | findstr :5002

# Kill that process:
taskkill /PID <PID_NUMBER> /F

# Restart backend:
npm run dev
```

### Problem: Frontend shows errors

**Quick Fix:**
```
1. Press Ctrl+Shift+R to hard refresh
2. Clear browser cache
3. Restart frontend: Ctrl+C, then npm run dev
```

---

## Daily Checklist

**Every day before using the dashboard:**

1. [ ] Start both servers (or run `start-dashboard.bat`)
2. [ ] Check health: http://localhost:5002/api/health-check/upstox
3. [ ] Verify "LIVE" badges on dashboard
4. [ ] Check token expiry (should have hours left)

**If token expires today:**
- Renew it in the morning (takes 2 minutes)
- Update `backend/.env`
- Restart backend

---

## URLs to Bookmark

- **Dashboard:** http://localhost:3000
- **Health Check:** http://localhost:5002/api/health-check/upstox
- **Upstox Developer:** https://account.upstox.com/developer/apps

---

## Getting Help

**If something breaks:**

1. **Check health:** http://localhost:5002/api/health-check/upstox
2. **Read guide:** Open `TROUBLESHOOTING.md`
3. **Check logs:** Look at both terminal windows for red error messages
4. **Collect info:**
   - Health check response
   - Backend terminal logs (last 50 lines)
   - Browser console (press F12)
   - Screenshot of the issue

---

## File Locations

```
E:\Dashboard_project Latest\dashboard_project\
├── start-dashboard.bat        ← Double-click to start
├── QUICK_START.md            ← This file
├── TROUBLESHOOTING.md        ← Detailed troubleshooting
├── FIXES_APPLIED.md          ← What was fixed
├── .env.local                ← Frontend config
├── backend\
│   └── .env                  ← Backend config (Upstox token here!)
└── ...
```

---

**That's it! You're ready to use the dashboard.** 🚀

**Remember:** Renew the Upstox token every 24 hours!
