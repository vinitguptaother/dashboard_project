# Upstox Market Data Layer

Comprehensive TypeScript market data service layer for the Indian stock market dashboard. Provides access to live quotes, historical data, instruments, and options analysis.

## 🚀 Features

- **Live Market Data**: Real-time quotes via REST and WebSocket
- **Historical Candles**: OHLCV data across all timeframes (1m to monthly)
- **Instruments Master**: Search and filter stocks, futures, and options
- **Options Analysis**: Complete option chains, Greeks, PCR, max pain, IV surface
- **Type-Safe**: Full TypeScript support with strict typing
- **Caching**: Intelligent caching to minimize API calls
- **Error Handling**: Comprehensive error handling with retry logic

## 📦 Installation

The market data layer is already included in your project. No additional installation needed.

## 🔑 Setup

Set your Upstox access token in environment variables:

```bash
# .env or .env.local
UPSTOX_ACCESS_TOKEN=your_access_token_here
```

## 📖 Usage

### Basic Usage

```typescript
import UpstoxMarketDataClient from '@/upstox/services';

// Initialize client with access token
const client = new UpstoxMarketDataClient(process.env.UPSTOX_ACCESS_TOKEN!);

// Get live quote
const quote = await client.getQuote('NSE_EQ|RELIANCE');
console.log(`RELIANCE LTP: ₹${quote.ltp}`);

// Get historical candles
const candles = await client.getCandles({
  instrumentKey: 'NSE_EQ|RELIANCE',
  interval: 'day',
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
});

// Search instruments
const results = await client.searchInstruments('RELIANCE');

// Get option chain
const chain = await client.getOptionChain({
  underlyingSymbol: 'NIFTY',
  expiryDate: '2024-12-28',
});
```

### Live Quotes

```typescript
// Single quote
const quote = await client.liveQuotes.getLiveQuote('NSE_EQ|RELIANCE', 'ltpc');

// Multiple quotes
const quotes = await client.liveQuotes.getLiveQuotes(
  ['NSE_EQ|RELIANCE', 'NSE_EQ|TCS', 'NSE_EQ|INFY'],
  'full'
);

// With market depth
const deepQuote = await client.liveQuotes.getLiveQuote('NSE_EQ|RELIANCE', 'full_d30');
console.log(`Best Bid: ₹${deepQuote.depth?.bestBidPrice}`);
console.log(`Best Ask: ₹${deepQuote.depth?.bestAskPrice}`);

// WebSocket streaming (advanced)
const stream = client.liveQuotes.streamLiveQuotes({
  instrumentKeys: ['NSE_EQ|RELIANCE'],
  mode: 'ltpc',
  onData: (quotes) => {
    console.log('Received quotes:', quotes);
  },
  onError: (error) => {
    console.error('Stream error:', error);
  },
});
stream.subscribe();
```

### Historical Data

```typescript
// Daily candles (last 2 years)
const dailyCandles = await client.historical.getDailyCandles('NSE_EQ|RELIANCE', 2);

// Intraday candles (last 30 days, 5-minute)
const intradayCandles = await client.historical.getIntradayCandles(
  'NSE_EQ|RELIANCE',
  30,
  '5minute'
);

// Weekly candles
const weeklyCandles = await client.historical.getWeeklyCandles('NSE_EQ|RELIANCE', 5);

// Custom date range
const candles = await client.historical.getCandlesForDateRange(
  'NSE_EQ|RELIANCE',
  'day',
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

// Latest N candles
const latestCandles = await client.historical.getLatestCandles(
  'NSE_EQ|RELIANCE',
  'day',
  50
);
```

### Instruments

```typescript
// Search instruments
const results = await client.instruments.searchInstrument({
  query: 'RELIANCE',
  exchange: 'NSE_EQ',
  limit: 10,
});

// Get instruments master
const nseStocks = await client.instruments.getInstrumentsMaster('NSE_EQ');

// Get by exact key
const instrument = await client.instruments.getInstrumentByKey('NSE_EQ|RELIANCE');

// Get option contracts
const optionContracts = await client.instruments.getOptionContracts('NIFTY', 'NSE_EQ');

// Get futures contracts
const futuresContracts = await client.instruments.getFuturesContracts('NIFTY', 'NSE_EQ');

// Get expiry dates
const expiryDates = await client.instruments.getExpiryDates('NIFTY', 'NSE_EQ');

// Get strike prices for expiry
const strikes = await client.instruments.getStrikePrices('NIFTY', '2024-12-28', 'NSE_EQ');
```

### Options Analysis

```typescript
// Build complete option chain
const chain = await client.options.buildOptionChain({
  underlyingSymbol: 'NIFTY',
  expiryDate: '2024-12-28',
});

// Get ATM option chain
const atmChain = await client.options.getATMOptionChain('NIFTY', '2024-12-28', 10);

// Calculate Put-Call Ratio
const pcr = await client.options.calculatePCR('NIFTY', '2024-12-28');
console.log(`PCR (OI): ${pcr.oiPCR.toFixed(2)}`);
console.log(`PCR (Volume): ${pcr.volumePCR.toFixed(2)}`);

// Find max pain strike
const maxPain = await client.options.getMaxPainStrike('NIFTY', '2024-12-28');
console.log(`Max Pain Strike: ${maxPain.maxPainStrike}`);

// Get implied volatility surface
const ivSurface = await client.options.getIVSurface('NIFTY', '2024-12-28');

// Get Greeks for specific strikes
const greeks = await client.options.getOptionGreeksForStrikes([
  'NSE_FO|NIFTY24DEC24000CE',
  'NSE_FO|NIFTY24DEC24000PE',
]);

// Get option chain summary
const summary = await client.options.getChainSummary('NIFTY', '2024-12-28');
console.log('Summary:', summary);
```

### Market Status

```typescript
const status = await client.getMarketStatus();
status.forEach((segment) => {
  console.log(`${segment.exchange}: ${segment.status}`);
});
```

## 🌐 API Routes

Use the Next.js API routes for frontend integration:

### Live Quotes
```
GET /api/market-data?type=live&instrumentKeys=NSE_EQ|RELIANCE,NSE_EQ|TCS&mode=ltpc
```

### Historical Data
```
GET /api/market-data?type=historical&instrumentKey=NSE_EQ|RELIANCE&interval=day&fromDate=2024-01-01&toDate=2024-12-31
```

### Search Instruments
```
GET /api/market-data?type=instruments&query=RELIANCE&limit=50
```

### Option Chain
```
GET /api/market-data?type=optionChain&underlyingSymbol=NIFTY&expiryDate=2024-12-28
```

### Option Greeks
```
GET /api/market-data?type=greeks&instrumentKeys=NSE_FO|NIFTY24DEC24000CE
```

### Market Status
```
GET /api/market-data?type=marketStatus
```

### Response Format

All API responses follow this structure:

```typescript
{
  "success": true,
  "data": { /* response data */ },
  "timestamp": "2024-12-30T15:00:00.000Z"
}
```

Error responses:

```typescript
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-12-30T15:00:00.000Z"
}
```

## 📁 Project Structure

```
src/upstox/
├── types/
│   └── marketData.ts          # All TypeScript type definitions
├── config/
│   └── marketDataConfig.ts    # Configuration, URLs, helpers
├── services/
│   ├── liveQuoteService.ts    # Live quotes & WebSocket
│   ├── historicalDataService.ts # Historical candles
│   ├── instrumentService.ts   # Instruments & contracts
│   ├── optionsService.ts      # Options analysis
│   └── index.ts               # Unified client export
└── README.md                  # This file

src/pages/api/
└── market-data.ts             # Next.js API route
```

## 🔄 Caching

The services implement intelligent caching:

- **Instruments Master**: 24 hours
- **Historical Candles**: 5 minutes
- **Option Contracts**: 24 hours
- **Live Quotes**: 1 second (for repeated calls)

Clear caches manually:

```typescript
// Clear all caches
client.clearAllCaches();

// Clear specific service caches
client.historical.clearCache();
client.instruments.clearCache();
```

## ⚡ Rate Limits

Upstox API rate limits (per minute):

- Market Quotes: 100 requests
- Historical Candles: 100 requests
- Option Greeks: 50 requests
- WebSocket: 5000 instruments per connection

The services automatically implement retry logic with exponential backoff for rate-limited requests.

## 🛠️ Advanced Configuration

All configuration is in `config/marketDataConfig.ts`:

- Base URLs
- WebSocket endpoints
- Rate limits
- Cache TTLs
- Retry configuration
- Date range validation

## 🔒 Security

- Never commit your access token
- Use environment variables for tokens
- The API route accepts tokens from headers or env vars
- Tokens are validated before use

## 📝 Type Definitions

All types are exported from `src/upstox/services`:

```typescript
import type {
  LiveQuote,
  Candle,
  Instrument,
  OptionChainRow,
  OptionGreeks,
  MarketSegment,
  QuoteMode,
  CandleInterval,
  Exchange,
} from '@/upstox/services';
```

## 🚨 Error Handling

```typescript
import { UpstoxMarketDataError } from '@/upstox/services';

try {
  const quote = await client.getQuote('INVALID_KEY');
} catch (error) {
  if (error instanceof UpstoxMarketDataError) {
    console.error(`Error ${error.statusCode}: ${error.message}`);
    console.error('Response data:', error.responseData);
  }
}
```

## 🧪 Testing

```typescript
// Validate connection
const isConnected = await client.validateConnection();
console.log('Connection valid:', isConnected);

// Get cache stats
const stats = client.getCacheStats();
console.log('Cache stats:', stats);
```

## 📚 Upstox API Documentation

This layer implements the following Upstox APIs:

- [Market Data Feed V3](https://upstox.com/developer/api-documentation/market-data-feed)
- [Historical Candle Data V2/V3](https://upstox.com/developer/api-documentation/historical-candle-data)
- [Instruments Master](https://upstox.com/developer/api-documentation/instruments)
- [Option Contracts](https://upstox.com/developer/api-documentation/option-contracts)
- [Option Greeks](https://upstox.com/developer/api-documentation/option-greeks)

## 🤝 Contributing

This is a standalone module that does not modify any existing dashboard code. You can extend it by:

1. Adding new services in `src/upstox/services/`
2. Adding new types in `src/upstox/types/marketData.ts`
3. Adding new API endpoints in `src/pages/api/market-data.ts`

## 📄 License

Part of your Upstox dashboard project.
