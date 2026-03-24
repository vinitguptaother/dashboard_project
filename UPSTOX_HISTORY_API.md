# Upstox Historical Data API

## Endpoint: `/api/upstox/history`

This API endpoint provides historical OHLC (Open, High, Low, Close) candle data for Indian stock symbols. It supports both real Upstox API integration and demo data fallback.

### Features

✅ **Real-time Integration**: Uses Upstox API when `UPSTOX_ACCESS_TOKEN` is configured  
✅ **Demo Mode**: Generates realistic fallback data when token is missing  
✅ **Multiple Timeframes**: Supports 1D, 5D, 1M, 3M, 6M, 1Y  
✅ **Error Handling**: Graceful fallback to demo data on API failures  
✅ **Validation**: Comprehensive input validation  

## Usage

### Request Format
```
GET /api/upstox/history?symbol=RELIANCE&timeframe=1D
```

### Parameters

| Parameter | Type | Required | Description | Valid Values |
|-----------|------|----------|-------------|--------------|
| `symbol` | string | Yes | Stock symbol or instrument key | `RELIANCE`, `INFY`, `NSE_EQ\|INE002A01018` |
| `timeframe` | string | Yes | Data timeframe | `1D`, `5D`, `1M`, `3M`, `6M`, `1Y` |

### Response Format

```json
{
  "success": true,
  "data": {
    "candles": [
      {
        "time": 1758677951819,
        "open": 2400.00,
        "high": 2430.63,
        "low": 2390.15,
        "close": 2421.07,
        "volume": 9995
      }
    ]
  },
  "symbol": "RELIANCE",
  "timeframe": "1D",
  "timestamp": "2025-09-24T08:08:30.841Z",
  "demo": true
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the request was successful |
| `data.candles` | Array | Array of OHLC candle data |
| `data.candles[].time` | number | Unix timestamp in milliseconds |
| `data.candles[].open` | number | Opening price |
| `data.candles[].high` | number | Highest price |
| `data.candles[].low` | number | Lowest price |
| `data.candles[].close` | number | Closing price |
| `data.candles[].volume` | number | Trading volume |
| `symbol` | string | Requested symbol |
| `timeframe` | string | Requested timeframe |
| `timestamp` | string | Response timestamp |
| `demo` | boolean | Whether demo data was used |
| `source` | string | Data source (`"upstox"` when using real API) |

## Examples

### 1. Get 1-day minute data for Reliance
```bash
curl "http://localhost:3000/api/upstox/history?symbol=RELIANCE&timeframe=1D"
```

### 2. Get 1-month daily data for Infosys
```bash
curl "http://localhost:3000/api/upstox/history?symbol=INFY&timeframe=1M"
```

### 3. Using instrument key directly
```bash
curl "http://localhost:3000/api/upstox/history?symbol=NSE_EQ|INE002A01018&timeframe=5D"
```

### 4. JavaScript Frontend Usage
```javascript
async function fetchHistoricalData(symbol, timeframe) {
  try {
    const response = await fetch(`/api/upstox/history?symbol=${symbol}&timeframe=${timeframe}`);
    const data = await response.json();
    
    if (data.success) {
      console.log(`Fetched ${data.data.candles.length} candles for ${symbol}`);
      return data.data.candles;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Failed to fetch historical data:', error);
    return [];
  }
}

// Usage
const candles = await fetchHistoricalData('RELIANCE', '1D');
```

## Configuration

### Environment Variables

For real Upstox integration, set these environment variables:

```bash
# In backend/.env
UPSTOX_ACCESS_TOKEN=your_upstox_access_token_here

# Optional: Default instruments for demo data
UPSTOX_DEFAULT_INSTRUMENTS=NSE_EQ|INE002A01018,NSE_EQ|INE009A01021
```

### Demo Mode

When `UPSTOX_ACCESS_TOKEN` is not set or equals `"your_access_token_here"`, the API automatically switches to demo mode and generates realistic candle data with:

- **Realistic base prices** for popular stocks
- **Proper OHLC relationships** (high >= max(open,close), low <= min(open,close))
- **Appropriate volume ranges** based on timeframe
- **Market-like volatility** (~2% per period)

## Timeframe Details

| Timeframe | Candle Interval | Number of Candles | Demo Data Period |
|-----------|-----------------|-------------------|------------------|
| `1D` | 1 minute | 390 | 6.5 hour trading day |
| `5D` | 30 minutes | 65 | 5 trading days |
| `1M` | 1 day | 30 | 30 days |
| `3M` | 1 day | 90 | 90 days |
| `6M` | 1 day | 180 | 180 days |
| `1Y` | 1 day | 365 | 365 days |

## Error Handling

The API includes comprehensive error handling:

### Missing Parameters (400)
```json
{
  "success": false,
  "error": "symbol parameter is required",
  "timestamp": "2025-09-24T08:08:30.841Z"
}
```

### Invalid Timeframe (400)
```json
{
  "success": false,
  "error": "Invalid timeframe. Must be one of: 1D, 5D, 1M, 3M, 6M, 1Y",
  "timestamp": "2025-09-24T08:08:30.841Z"
}
```

### Upstox API Failure (Fallback to Demo)
```json
{
  "success": true,
  "data": { "candles": [...] },
  "demo": true,
  "fallbackReason": "Upstox API error: Rate limit exceeded"
}
```

## Symbol Mapping

The API includes built-in mappings for popular Indian stocks:

| Symbol | Instrument Key | Company |
|--------|----------------|---------|
| `RELIANCE` | `NSE_EQ\|INE002A01018` | Reliance Industries |
| `INFY` | `NSE_EQ\|INE009A01021` | Infosys |
| `TCS` | `NSE_EQ\|INE467B01029` | Tata Consultancy Services |
| `HDFCBANK` | `NSE_EQ\|INE040A01034` | HDFC Bank |
| `ICICIBANK` | `NSE_EQ\|INE090A01021` | ICICI Bank |

## Integration Notes

1. **Rate Limits**: Real Upstox API has rate limits - the system gracefully falls back to demo data
2. **Market Hours**: Real data is only available during market hours
3. **Weekends**: Demo data is always available; real API might have limitations
4. **Caching**: Consider implementing client-side caching for frequently requested data
5. **Real-time**: This is historical data - for real-time quotes use the LTP endpoints

## Testing

The API is fully testable in demo mode without any setup:

```bash
# Test basic functionality
curl "http://localhost:3000/api/upstox/history?symbol=RELIANCE&timeframe=1D"

# Test validation
curl "http://localhost:3000/api/upstox/history?symbol=TCS&timeframe=INVALID"

# Test missing parameters
curl "http://localhost:3000/api/upstox/history?timeframe=1M"
```