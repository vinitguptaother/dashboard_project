# Angel One Smart API Integration

This document provides a complete guide to the Angel One Smart API integration for your stock dashboard application.

## 🚀 Features

- ✅ Complete login/logout functionality with TOTP support
- ✅ Automatic token management (JWT, refresh, feed tokens)
- ✅ Auto-refresh tokens before expiration (28-hour token lifecycle)
- ✅ Comprehensive error handling and retry logic
- ✅ Real-time WebSocket market data streaming
- ✅ All required headers (X-UserType, X-SourceID, IP addresses, MAC, API key)
- ✅ Network configuration auto-detection
- ✅ Batch market data requests
- ✅ Portfolio and holdings management
- ✅ Historical data support

## 📁 File Structure

```
├── services/
│   ├── angelOneAuth.js          # Authentication service
│   └── angelOneWebSocket.js     # WebSocket service
├── utils/
│   └── angelOneHelper.js        # API helper functions
├── pages/api/
│   └── angelone-ltp.js         # Updated API endpoint
├── examples/
│   └── angelOneUsage.js        # Usage examples
├── .env.example                # Environment variables template
└── ANGEL_ONE_INTEGRATION.md    # This documentation
```

## 🔧 Setup

### 1. Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required Angel One credentials
ANGELONE_API_KEY=your_angel_one_api_key_here
ANGELONE_CLIENT_CODE=your_client_code_here
ANGELONE_PASSWORD=your_trading_pin_here
ANGELONE_TOTP_SECRET=your_totp_secret_here

# Optional network configuration (auto-detected if not provided)
ANGELONE_LOCAL_IP=192.168.1.100
ANGELONE_PUBLIC_IP=203.0.113.1
ANGELONE_MAC_ADDRESS=AA:BB:CC:DD:EE:FF
```

### 2. Install Dependencies

The required dependencies are already included in your `package.json`:
- `axios` - HTTP client
- `ws` - WebSocket client
- `crypto` - TOTP generation

## 🔐 Authentication Flow

### Login Process

The authentication service handles the complete login flow:

1. **Credential Validation**: Checks for required environment variables
2. **Network Detection**: Auto-detects local IP and MAC address
3. **TOTP Generation**: Generates TOTP code from secret (or accepts manual code)
4. **Login Request**: Sends POST request with all required headers
5. **Token Storage**: Stores JWT, refresh, and feed tokens with expiration
6. **Error Handling**: Provides detailed error messages for different failure scenarios

### Required Headers

All requests include the mandatory headers:

```javascript
{
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-UserType': 'USER',
  'X-SourceID': 'WEB',
  'X-ClientLocalIP': '192.168.1.100',    // Auto-detected or from env
  'X-ClientPublicIP': '203.0.113.1',     // From environment
  'X-MACAddress': 'AA:BB:CC:DD:EE:FF',    // Auto-detected or from env
  'X-PrivateKey': 'your_api_key',         // From environment
  'Authorization': 'Bearer jwt_token'      // Added for authenticated requests
}
```

### Token Management

- **JWT Token**: Used for API authentication (expires in ~28 hours)
- **Refresh Token**: Used to refresh JWT without re-login
- **Feed Token**: Used for WebSocket market data streaming
- **Auto-refresh**: Tokens are automatically refreshed 5 minutes before expiration

## 📊 API Usage

### Basic Usage

```javascript
const { angelOneHelper } = require('./utils/angelOneHelper');

// Get LTP for a single symbol
const ltpData = await angelOneHelper.getLTP('NSE', 'TATAMOTORS-EQ');
console.log('LTP:', ltpData.ltp);

// Get batch LTP data
const symbols = [
  { exchange: 'NSE', symbol: 'TATAMOTORS-EQ' },
  { exchange: 'NSE', symbol: 'RELIANCE-EQ' }
];
const batchData = await angelOneHelper.getBatchLTP(symbols);
```

### Authentication Management

```javascript
const { angelOneAuth } = require('./services/angelOneAuth');

// Check authentication status
const status = angelOneAuth.getTokenStatus();
console.log('Is authenticated:', status.hasTokens);
console.log('Token expires at:', status.expiresAt);

// Force re-authentication with TOTP
await angelOneAuth.login('123456');

// Manual token refresh
await angelOneAuth.refreshToken();

// Logout
await angelOneAuth.logout();
```

### WebSocket Integration

```javascript
const { angelOneWebSocket } = require('./services/angelOneWebSocket');

// Connect to WebSocket
await angelOneWebSocket.connect();

// Subscribe to market data
const symbolTokens = ['3045']; // Symbol tokens
await angelOneWebSocket.subscribe(1, 1, symbolTokens); // LTP mode, NSE_CM

// Handle messages
angelOneWebSocket.onMessage('feed', (message) => {
  console.log('Market data:', message.data);
});

// Disconnect
angelOneWebSocket.disconnect();
```

## 🌐 API Endpoints

### Updated LTP Endpoint

**GET/POST** `/api/angelone-ltp`

**Query Parameters:**
- `exchange` (optional): Exchange name (default: 'NSE')
- `symbol` (optional): Symbol name (default: 'TATAMOTORS-EQ')
- `batch` (optional): Set to 'true' for batch requests
- `totp` (optional): Manual TOTP code for re-authentication

**Batch Request Body:**
```json
{
  "symbols": [
    { "exchange": "NSE", "symbol": "TATAMOTORS-EQ" },
    { "exchange": "NSE", "symbol": "RELIANCE-EQ" }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ltp": 850.50,
    "open": 845.00,
    "high": 855.00,
    "low": 840.00,
    "close": 848.00,
    "volume": 1234567,
    "exchange": "NSE",
    "symbol": "TATAMOTORS-EQ"
  },
  "authStatus": {
    "hasTokens": true,
    "isValid": true,
    "expiresAt": "2024-01-02T10:30:00.000Z"
  },
  "timestamp": "2024-01-01T10:30:00.000Z"
}
```

## 🛡️ Error Handling

### Authentication Errors

- **Invalid Credentials**: Check API key, client code, and password
- **Invalid TOTP**: Verify TOTP secret and time synchronization
- **Rate Limiting**: Automatic retry with exponential backoff
- **Network Issues**: Connection timeout and retry logic

### API Errors

- **Unauthorized (401)**: Automatic token refresh and retry
- **Symbol Not Found**: Clear error message with suggestions
- **Market Closed**: Appropriate error handling
- **Server Errors (5xx)**: Retry logic with circuit breaker

### WebSocket Errors

- **Connection Failures**: Automatic reconnection with exponential backoff
- **Authentication Issues**: Re-authentication and reconnection
- **Message Parsing**: Graceful error handling for malformed data

## 🔍 Verification Checklist

### ✅ Login Implementation
- [x] POST request to `loginByPassword` endpoint
- [x] JSON payload with `clientcode`, `password`, `totp`
- [x] All mandatory headers included
- [x] Proper error handling for invalid credentials
- [x] TOTP generation from secret

### ✅ Headers Implementation
- [x] `X-UserType: USER`
- [x] `X-SourceID: WEB`
- [x] `X-ClientLocalIP` (auto-detected)
- [x] `X-ClientPublicIP` (from environment)
- [x] `X-MACAddress` (auto-detected)
- [x] `X-PrivateKey` (API key from environment)
- [x] Standard `Content-Type`/`Accept` headers

### ✅ Token Management
- [x] Extract `jwtToken`, `refreshToken`, `feedToken`
- [x] Store tokens securely in memory
- [x] Token expiration tracking
- [x] Automatic refresh before expiration
- [x] Clear tokens on logout

### ✅ Authentication Helper
- [x] `Authorization: Bearer <jwtToken>` header
- [x] All X-* headers included in subsequent requests
- [x] Automatic retry on authentication failure
- [x] Token validation before requests

### ✅ Token Refresh
- [x] `generateTokens` endpoint implementation
- [x] Use `refreshToken` for refresh requests
- [x] Update stored JWT token
- [x] Handle refresh failures gracefully

### ✅ WebSocket Integration
- [x] Feed token passed to WebSocket client
- [x] Proper authentication headers
- [x] Real-time market data streaming
- [x] Reconnection logic

### ✅ Error Handling
- [x] Missing credentials detection
- [x] Invalid API key handling
- [x] Expired token detection
- [x] Incorrect TOTP handling
- [x] Network error handling
- [x] Meaningful error messages

## 🚀 Testing

### Run the Example

```bash
# Set up your environment variables first
node examples/angelOneUsage.js
```

### Test the API Endpoint

```bash
# Test single symbol
curl "http://localhost:3000/api/angelone-ltp?symbol=TATAMOTORS-EQ&exchange=NSE"

# Test with manual TOTP
curl "http://localhost:3000/api/angelone-ltp?totp=123456"

# Test batch request
curl -X POST "http://localhost:3000/api/angelone-ltp?batch=true" \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": [
      {"exchange": "NSE", "symbol": "TATAMOTORS-EQ"},
      {"exchange": "NSE", "symbol": "RELIANCE-EQ"}
    ]
  }'
```

## 📝 Notes

1. **Token Lifecycle**: Angel One tokens last approximately 28 hours
2. **TOTP Timing**: Ensure system clock is synchronized for TOTP generation
3. **Rate Limits**: Be mindful of API rate limits and implement appropriate delays
4. **WebSocket Limits**: Monitor WebSocket connection limits and subscriptions
5. **Error Recovery**: The system automatically handles most error scenarios
6. **Security**: Never log sensitive credentials or tokens in production

## 🔧 Troubleshooting

### Common Issues

1. **TOTP Errors**: Check system time synchronization and TOTP secret
2. **Network Detection**: Manually set IP/MAC in environment if auto-detection fails
3. **Token Expiry**: System handles this automatically, but check logs for issues
4. **WebSocket Disconnections**: Automatic reconnection is implemented
5. **Symbol Not Found**: Verify symbol format (e.g., 'TATAMOTORS-EQ' not 'TATAMOTORS')

### Debug Mode

Enable detailed logging by setting:
```bash
NODE_ENV=development
```

This will provide extensive console output for debugging authentication and API calls.

## 🎯 Next Steps

1. **Production Deployment**: Ensure all environment variables are properly configured
2. **Monitoring**: Add monitoring for authentication failures and API errors
3. **Caching**: Consider implementing Redis for token storage in multi-instance deployments
4. **Rate Limiting**: Implement client-side rate limiting to prevent API abuse
5. **Analytics**: Add tracking for API usage and performance metrics

---

**Ready to use!** Your Angel One Smart API integration is now complete with all required features including login, token management, error handling, and WebSocket support.

