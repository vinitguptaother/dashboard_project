# Angel One SmartAPI Integration Guide

This guide provides complete instructions for integrating Angel One SmartAPI with proper TOTP authentication, token management, and live stock price (LTP) fetching.

## 🚀 Quick Start

### 1. Dependencies

All required dependencies are already installed:
- `axios` - HTTP client
- `otplib` - TOTP generation
- `dotenv` - Environment variable management

### 2. Environment Configuration

Create a `.env.local` file in the project root with the following variables:

> **💡 Why .env.local?** Next.js automatically loads `.env.local` and it's ignored by git for security.

```env
# Angel One SmartAPI Configuration
# 🎉 Only these 4 fields are required - network info is auto-detected!

ANGELONE_API_KEY=bCurszd3
ANGELONE_CLIENT_CODE=V58786616
ANGELONE_PASSWORD=9664
ANGELONE_TOTP_SECRET=your_actual_totp_secret

# Optional: Override auto-detection (usually not needed)
# ANGELONE_LOCAL_IP=127.0.0.1
# ANGELONE_PUBLIC_IP=your_public_ip
# ANGELONE_MAC_ADDRESS=your_mac_address
```

**Important**: `.env.local` is automatically ignored by git - your credentials stay secure!

### 3. How to Get Your Credentials

1. **API Key**: Available in your Angel One trading account under API settings
2. **Client Code**: Your Angel One client ID  
3. **Password**: Your trading PIN/MPIN
4. **TOTP Secret**: Generated when you enable 2FA in your Angel One account

### 🎯 **NEW: Auto-Detection Features**

✅ **Public IP**: Automatically detected using multiple IP services  
✅ **MAC Address**: Automatically detected from your network interface  
✅ **Local IP**: Automatically detected from your system

No more manual configuration needed! The system will:
- Try multiple IP detection services (ipify.org, httpbin.org, etc.)
- Intelligently select the best network interface
- Provide detailed logging of detected network info
- Fall back gracefully if detection fails

## 📚 API Usage

### Basic Usage

```javascript
const { angelOneHelper } = require('./utils/angelOneHelper');

// Get LTP for a single symbol
const ltpData = await angelOneHelper.getLTP('NSE', 'TATAMOTORS-EQ');
console.log(`LTP: ₹${ltpData.ltp}`);

// Get multiple LTPs
const symbols = [
  { exchange: 'NSE', symbol: 'TATAMOTORS-EQ' },
  { exchange: 'NSE', symbol: 'RELIANCE-EQ' }
];
const batchData = await angelOneHelper.getBatchLTP(symbols);
```

### API Endpoints

#### 1. Get LTP (Last Traded Price)

**GET/POST** `/api/angelone-ltp`

Query Parameters:
- `exchange` (optional): Default 'NSE'
- `symbol` (optional): Default 'TATAMOTORS-EQ'
- `totp` (optional): Manual TOTP code for authentication

Example:
```bash
curl "http://localhost:3000/api/angelone-ltp?symbol=RELIANCE-EQ"
```

#### 2. Batch LTP Request

**POST** `/api/angelone-ltp?batch=true`

Request Body:
```json
{
  "symbols": [
    {"exchange": "NSE", "symbol": "TATAMOTORS-EQ"},
    {"exchange": "NSE", "symbol": "RELIANCE-EQ"}
  ]
}
```

### Response Format

```json
{
  "status": "success",
  "data": {
    "exchange": "NSE",
    "symbol": "TATAMOTORS-EQ",
    "ltp": 850.50,
    "symbolToken": "3456",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "authStatus": {
    "hasTokens": true,
    "isValid": true,
    "expiresAt": "2024-01-16T10:30:00.000Z"
  }
}
```

## 🔐 Authentication Flow

The integration follows Angel One's recommended authentication flow:

1. **TOTP Generation**: Uses `otplib` to generate time-based OTP from your secret
2. **Login**: Authenticates with Angel One using credentials + TOTP
3. **Token Storage**: Stores JWT, refresh, and feed tokens
4. **Auto-Refresh**: Automatically refreshes tokens before expiry
5. **Error Handling**: Handles authentication errors and token expiry

### Manual Authentication

```javascript
// Force re-authentication with manual TOTP
await angelOneHelper.refreshAuthentication('123456');

// Check authentication status
const status = angelOneHelper.getAuthStatus();
console.log('Authenticated:', status.isValid);
```

## 🔧 Advanced Features

### 1. Symbol Search

```javascript
// Search for symbols
const results = await angelOneHelper.searchSymbol('NSE', 'TATA');
console.log('Found symbols:', results.map(r => r.symbol));

// Get specific symbol token
const token = await angelOneHelper.getSymbolToken('TATAMOTORS-EQ');
```

### 2. User Profile & Holdings

```javascript
// Get user profile
const profile = await angelOneHelper.getUserProfile();

// Get holdings
const holdings = await angelOneHelper.getHoldings();

// Get positions
const positions = await angelOneHelper.getPositions();
```

### 3. Historical Data

```javascript
// Get candle data
const candles = await angelOneHelper.getCandleData(
  'NSE',
  symbolToken,
  'ONE_MINUTE',
  '2024-01-15 09:15',
  '2024-01-15 15:30'
);
```

### 4. WebSocket Feed Token

```javascript
// Get feed token for WebSocket connections
const feedToken = await angelOneHelper.getFeedToken();
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
node test-angel-one-integration.js
```

This will test:
- Environment configuration
- TOTP generation
- Authentication
- Symbol search
- LTP fetching
- Token management

## 🚨 Error Handling

The integration includes comprehensive error handling:

### Common Errors

1. **Invalid TOTP**: Check your TOTP secret and system time
2. **Authentication Failed**: Verify credentials in `.env` file
3. **Symbol Not Found**: Ensure correct symbol format (e.g., 'TATAMOTORS-EQ')
4. **Token Expired**: Automatic refresh or manual re-authentication
5. **Rate Limiting**: Built-in retry logic with exponential backoff

### Error Response Format

```json
{
  "status": "error",
  "error": "Authentication failed: Invalid credentials or TOTP",
  "authStatus": {
    "hasTokens": false,
    "isValid": false
  },
  "suggestion": "Try providing a TOTP code in the request to authenticate",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 📝 Code Examples

### Complete Workflow Example

See `examples/angelOneComplete.js` for a complete implementation following the Angel One documentation.

### Integration with Next.js API

The `/pages/api/angelone-ltp.js` endpoint demonstrates how to integrate with a Next.js application.

## 🔒 Security Best Practices

1. **Environment Variables**: Store all credentials in `.env` file
2. **Token Management**: Tokens are stored in memory and auto-refreshed
3. **HTTPS Only**: All API calls use HTTPS
4. **Rate Limiting**: Respect Angel One's rate limits
5. **Error Logging**: Comprehensive error logging without exposing credentials

## 📞 Support

For issues with Angel One API:
1. Check Angel One's official documentation
2. Verify your account has API access enabled
3. Ensure 2FA is properly configured
4. Contact Angel One support for account-specific issues

## 🔄 Token Lifecycle

- **JWT Token**: Valid for ~28 hours, auto-refreshed
- **Refresh Token**: Used to get new JWT tokens
- **Feed Token**: For WebSocket connections
- **Auto-Refresh**: Happens 5 minutes before expiry

## 🎯 Next Steps

1. Set up your `.env` file with valid credentials
2. Run the test script to verify everything works
3. Use the API endpoints in your application
4. Monitor authentication status and handle errors appropriately

