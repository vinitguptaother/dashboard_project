# Upstox CLI Dashboard

A TypeScript-based command-line dashboard for Upstox portfolio management. Fetches holdings, positions, quotes, and historical data with beautiful JSON output.

## Features

- ✅ **Full Type Safety** - Complete TypeScript types for all Upstox API endpoints
- 📊 **Portfolio Overview** - Holdings, positions, P&L, and account summary
- 💹 **Live Quotes** - Real-time market data for your holdings
- 📈 **Historical Trends** - Weekly candle data for trend analysis
- 🚀 **Top Gainers/Losers** - Automatically identifies best and worst performers
- 💾 **JSON Export** - Saves complete dashboard data to timestamped JSON files
- ⚡ **Fast Execution** - Runs directly via tsx (no build step needed)

## Prerequisites

- Node.js 18+ (check with `node --version`)
- Upstox account with API access
- Active Upstox access token

## Installation

```bash
# Install dependencies
npm install

# Create .env file from template
copy .env.example .env

# Edit .env and add your Upstox access token
notepad .env
```

## Configuration

Edit `.env` file and add your Upstox access token:

```env
UPSTOX_ACCESS_TOKEN=your_actual_token_here
```

Get your token from: https://api.upstox.com/login

## Usage

### Run Once

```bash
npm start
```

Or directly with tsx:

```bash
npx tsx upstox_dashboard.ts
```

### Watch Mode (Auto-reload on changes)

```bash
npm run dev
```

### Windows - Run Every 60 Seconds

```powershell
# PowerShell
while ($true) { npx tsx upstox_dashboard.ts; Start-Sleep -Seconds 60 }
```

### Linux/Mac - Run Every 60 Seconds

```bash
watch -n 60 npx tsx upstox_dashboard.ts
```

## Output

The script generates:

1. **Console Output** - Formatted summary with emojis and colors
2. **JSON File** - Complete data saved as `dashboard_YYYY-MM-DD.json`

### Sample Console Output

```
🔄 Fetching user profile...
✅ Logged in as: John Doe (UP12345)
💰 Available Margin: ₹1,50,000.00
📊 Holdings: 15 stocks
📈 Positions: 3 active trades
💼 Total Portfolio Value: ₹5,75,000.00
📊 Total P&L: ₹45,250.00

============================================================
📊 PORTFOLIO SUMMARY
============================================================
Total Portfolio Value: ₹5,75,000.00
Total P&L: ₹45,250.00 (+8.54%)
Holdings: 15 | Positions: 3

🚀 Top Gainers:
  1. RELIANCE: ₹15,250.00 (+12.50%)
  2. INFY: ₹8,500.00 (+10.25%)
  3. TCS: ₹6,750.00 (+8.75%)

📉 Top Losers:
  1. HDFCBANK: -₹2,250.00 (-3.50%)
  2. ITC: -₹1,500.00 (-2.25%)
============================================================
```

### JSON Structure

```json
{
  "timestamp": "2025-12-30T13:26:33.000Z",
  "profile": { "user_name": "...", "user_id": "..." },
  "funds": { "equity": { "available_margin": 150000, ... } },
  "holdings": [ { "tradingsymbol": "RELIANCE", "quantity": 10, ... } ],
  "positions": [ { "tradingsymbol": "NIFTY", "quantity": 50, ... } ],
  "quotes": { "RELIANCE": { "ltp": 2850.50, ... } },
  "weekly_trends": { "RELIANCE": [ { "timestamp": "...", "open": 2800, ... } ] },
  "summary": {
    "total_portfolio_value": 575000,
    "total_pnl": 45250,
    "top_gainers": [...],
    "top_losers": [...]
  }
}
```

## API Endpoints Used

- `GET /user/profile` - User profile information
- `GET /user/get-funds-and-margin` - Account funds and margins
- `GET /portfolio/long-term-holdings` - Long-term holdings
- `GET /portfolio/short-term-positions` - Active trading positions
- `GET /market-quote/quotes` - Live market quotes
- `GET /historical-candle/{instrument}/{interval}/{to}/{from}` - Historical candles

## Rate Limits

The script respects Upstox API rate limits:
- **Quotes**: 600ms delay between requests (~100/minute)
- **Historical Data**: 1000ms delay between requests (~60/minute)

## Troubleshooting

### "UPSTOX_ACCESS_TOKEN not found"
- Make sure `.env` file exists in the `upstox-cli` directory
- Check that the token is set correctly without quotes

### "401 Unauthorized"
- Your access token has expired
- Get a new token from https://api.upstox.com/login

### "Module not found"
```bash
npm install
```

## Project Structure

```
upstox-cli/
├── upstox_dashboard.ts  # Main TypeScript script
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── .env                 # Your tokens (not committed)
├── .env.example         # Template
└── README.md           # This file
```

## Development

### Build (optional)

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### Type Checking

TypeScript provides full type safety for all API calls and responses.

## License

MIT

## Support

For Upstox API documentation: https://upstox.com/developer/api-documentation/
