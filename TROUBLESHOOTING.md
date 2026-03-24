# Dashboard Troubleshooting Guide

## Quick Health Check

**Before troubleshooting, always run the health check:**

```bash
# In browser or via curl:
http://localhost:5002/api/health-check/upstox
http://localhost:5002/api/health-check/backend
```

This will tell you exactly what's wrong!

---

## Common Issues & Solutions

### Issue 1: Dashboard Shows "DEMO" Instead of "LIVE"

**Symptoms:**
- Red "DEMO" badges visible
- Prices are random/unrealistic numbers
- Prices change dramatically on every refresh

**Causes & Solutions:**

#### A) Upstox Access Token Expired
```bash
# Check token expiry:
curl http://localhost:5002/api/health-check/upstox
```

If you see `"issue": "TOKEN_EXPIRED"`:

1. Go to https://account.upstox.com/developer/apps
2. Generate a new access token
3. Copy the token
4. Update `backend/.env`:
   ```
   UPSTOX_ACCESS_TOKEN=your_new_token_here
   ```
5. Restart backend:
   ```bash
   cd backend
   npm run dev
   ```

#### B) Backend Not Running
```bash
# Check if backend is running:
curl http://localhost:5002/health
```

If it fails, start the backend:
```bash
cd "E:\Dashboard_project Latest\dashboard_project\backend"
npm run dev
```

#### C) Port Mismatch
```bash
# Check backend port:
curl http://localhost:5002/api/health-check/backend
```

If `portMismatch: true`:
- Backend is running on different port than configured
- Update `dashboard_project/.env.local`:
  ```
  NEXT_PUBLIC_BACKEND_URL=http://localhost:ACTUAL_PORT
  ```
- Restart frontend: `npm run dev`

---

### Issue 2: Rate Limit Errors (429)

**Symptoms:**
- Dashboard works for a few seconds, then stops updating
- Backend logs show `error: HTTP Request Error ... status:429`

**Solution:**

Restart the backend to reset rate limits:
```bash
cd backend
# Press Ctrl+C to stop
npm run dev
```

**Prevention:**
- Don't open multiple dashboard tabs
- Increase polling interval in `app/hooks/useLTP.ts` (currently 5000ms)

---

### Issue 3: Backend Returns Empty Data

**Symptoms:**
- Backend logs show `✅ Real LTP data fetched` 
- But `Transformed data: { "NIFTY": { "volume": 0 } }`
- No `lastPrice` in the data

**Cause:** Data transformation bug

**Solution:**
Check `services/upstoxService.js` lines 192-197:
```javascript
transformedData[simpleSymbol] = {
    lastPrice: value.lastPrice || value.last_price,  // Both formats
    instrumentToken: value.instrumentToken || value.instrument_token,
    volume: value.volume || 0,
    ltq: value.ltq || value.last_traded_quantity || 0,
    cp: value.cp || value.net_change || 0
};
```

---

### Issue 4: "ECONNREFUSED" Errors

**Symptoms:**
- Frontend logs: `ECONNREFUSED localhost:5001`
- Dashboard doesn't load

**Cause:** Frontend trying to connect to wrong port

**Solution:**

1. Check what port backend is actually running on:
   ```bash
   # Look at backend terminal for:
   # "🚀 Server running on port 5002"
   ```

2. Update frontend config:
   - Edit `dashboard_project/app/lib/config.ts`
   - Change `backendURL` to match actual port
   
3. Also check `dashboard_project/app/api/ltp/route.ts` line 85:
   ```typescript
   const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
   ```

4. Restart frontend: `npm run dev`

---

## Prevention Checklist

### Daily Checks:
- [ ] Check token expiry: `curl http://localhost:5002/api/health-check/upstox`
- [ ] Verify both servers are running (frontend on 3000, backend on 5002)
- [ ] Dashboard shows "LIVE" badges with realistic prices

### Weekly Maintenance:
- [ ] Renew Upstox access token if needed (tokens typically expire after 24 hours)
- [ ] Check backend logs for warnings or errors
- [ ] Clear browser cache if dashboard behaves oddly

### When Token Expires:
1. Generate new token from Upstox developer console
2. Update `backend/.env` file
3. Restart backend server
4. No need to restart frontend!

---

## Monitoring Dashboard Health

### Add to Your Startup Script:

Create `start-dashboard.bat` (Windows):
```batch
@echo off
echo Starting Backend...
start cmd /k "cd /d E:\Dashboard_project Latest\dashboard_project\backend && npm run dev"
timeout /t 5
echo Starting Frontend...
start cmd /k "cd /d E:\Dashboard_project Latest\dashboard_project && npm run dev"
echo.
echo Dashboard starting...
echo Backend: http://localhost:5002
echo Frontend: http://localhost:3000
echo Health Check: http://localhost:5002/api/health-check/upstox
pause
```

### Browser Bookmarks:
- Dashboard: http://localhost:3000
- Backend Health: http://localhost:5002/api/health-check/upstox
- Backend Status: http://localhost:5002/api/health-check/backend

---

## Emergency Reset

If nothing works, do a full reset:

```bash
# 1. Stop all servers (Ctrl+C in both terminals)

# 2. Clear node_modules and reinstall
cd "E:\Dashboard_project Latest\dashboard_project"
rm -rf node_modules
rm -rf backend/node_modules
npm install
cd backend
npm install

# 3. Verify .env files exist:
# - backend/.env should have UPSTOX_ACCESS_TOKEN
# - .env.local should have NEXT_PUBLIC_BACKEND_URL

# 4. Restart backend
cd backend
npm run dev

# 5. Restart frontend (in new terminal)
cd ..
npm run dev
```

---

## Getting Help

If you still have issues, collect this info:

1. **Health check results:**
   ```
   curl http://localhost:5002/api/health-check/upstox
   curl http://localhost:5002/api/health-check/backend
   ```

2. **Backend logs** (last 50 lines)

3. **Frontend browser console** (F12 → Console tab)

4. **Screenshot** of the dashboard showing the issue
