# Quick Start Guide - Upstox CLI Dashboard

## 🚀 Ready to Use!

Your Upstox CLI dashboard is fully configured and ready to run!

## Run Now

```powershell
cd "E:\Dashboard_project Latest\dashboard_project\upstox-cli"
npm start
```

## What It Does

1. ✅ Fetches your Upstox profile
2. ✅ Gets your holdings and positions
3. ✅ Fetches live quotes for your top 10 holdings
4. ✅ Gets weekly trends for your top 5 holdings
5. ✅ Calculates total P&L and portfolio value
6. ✅ Identifies top gainers and losers
7. ✅ Saves everything to a JSON file

## Output Files

- **Console**: Beautiful formatted output with emojis
- **JSON**: `dashboard_2025-12-30.json` (timestamped file)

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run once |
| `npm run dev` | Watch mode (auto-reload) |
| `npx tsx upstox_dashboard.ts` | Direct run |

## Schedule Automatic Updates

### Every 60 seconds (PowerShell)

```powershell
while ($true) { npm start; Start-Sleep -Seconds 60 }
```

### Every 5 minutes (PowerShell)

```powershell
while ($true) { npm start; Start-Sleep -Seconds 300 }
```

### Background Task (Windows Task Scheduler)

1. Open Task Scheduler
2. Create New Task
3. Trigger: Every 5 minutes
4. Action: Start a program
   - Program: `npx`
   - Arguments: `tsx upstox_dashboard.ts`
   - Start in: `E:\Dashboard_project Latest\dashboard_project\upstox-cli`

## Access Token Info

Your token expires on: **December 31, 2025**

To get a new token:
1. Visit https://api.upstox.com/login
2. Copy the new token
3. Update `.env` file

## Example Output

```
🔄 Fetching user profile...
✅ Logged in as: Your Name (UP12345)
💰 Available Margin: ₹1,50,000.00
📊 Holdings: 0 stocks
📈 Positions: 0 active trades
💼 Total Portfolio Value: ₹0.00
📊 Total P&L: ₹0.00

✅ Dashboard data saved to dashboard_2025-12-30.json

============================================================
📊 PORTFOLIO SUMMARY
============================================================
Total Portfolio Value: ₹0.00
Total P&L: ₹0.00 (+0.00%)
Holdings: 0 | Positions: 0
============================================================
```

## Troubleshooting

### Token Expired?
Update `UPSTOX_ACCESS_TOKEN` in `.env` file

### Dependencies Missing?
```powershell
npm install
```

### Need Help?
Check `README.md` for full documentation

## Next Steps

1. Run the dashboard: `npm start`
2. Check the generated JSON file
3. Set up automatic scheduling (optional)
4. Integrate with your workflow

Enjoy your TypeScript-powered Upstox dashboard! 🎉
