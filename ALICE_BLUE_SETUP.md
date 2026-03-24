# Alice Blue API Setup Guide

## Overview
This implementation provides real-time stock prices using Alice Blue's HTTP/JSON API with TOTP authentication, without requiring Python dependencies.

## Files Created
- `/pages/api/alice-blue-ltp.js` - Next.js API route for fetching LTP data
- `/app/alice-blue/page.tsx` - Frontend page for displaying live prices
- `otplib` and `node-fetch` packages installed

## Environment Variables Required

Create a `.env.local` file in your project root with these variables:

```bash
# Alice Blue API Configuration
AB_USER_ID=your_username_here
AB_PASSWORD=your_password_here  
AB_API_SECRET=your_api_secret_here
AB_TOTP_SECRET=your_totp_secret_here

# Existing keys (if you have them)
PERPLEXITY_API_KEY=your_perplexity_key_here
NEWSAPI_KEY=your_news_api_key_here
```

## Getting Alice Blue Credentials

1. **Account Setup**: Ensure you have an active Alice Blue trading account
2. **API Access**: Contact Alice Blue support or email api@aliceblueindia.com to request API access
3. **Developer Console**: 
   - Log in to https://develop-api.aliceblueonline.com/
   - Click "Create App"
   - Set Redirect URI to: `https://ant.aliceblueonline.com/plugin/callback`
   - Get your App ID and API Secret
4. **TOTP Secret**: During 2FA setup with Google Authenticator, save the secret key

## API Endpoints

### Single Quote
```
GET /api/alice-blue-ltp?exchange=NSE&symbol=TATAMOTORS-EQ
```

### Batch Quotes
```
POST /api/alice-blue-ltp?batch=true
Body: { "symbols": [{"exchange": "NSE", "symbol": "RELIANCE-EQ"}, ...] }
```

## Frontend Usage

Visit `/alice-blue` in your dashboard to:
- View real-time prices for a customizable watchlist
- Add/remove symbols dynamically
- Enable auto-refresh (1-60 second intervals)
- Test individual symbol quotes

## Symbol Format

Alice Blue uses specific symbol formats:
- NSE: `RELIANCE-EQ`, `TCS-EQ`, `HDFCBANK-EQ`
- BSE: Check Alice Blue documentation for BSE formats

## Security Notes

- All credentials are stored in environment variables (server-side only)
- TOTP codes are generated fresh for each request
- Access tokens are not cached (expires end of trading day)
- API route runs on server, keeping secrets safe from client-side

## Troubleshooting

1. **Login Failed**: Check username, password, and API secret
2. **TOTP Issues**: Verify TOTP secret is correct and time-synced
3. **Symbol Not Found**: Ensure symbol format matches Alice Blue requirements
4. **Rate Limits**: Alice Blue may have rate limits; adjust refresh intervals accordingly

## Production Considerations

- Cache access tokens and refresh only when expired
- Implement WebSocket connections for true real-time streaming
- Add error handling and retry logic
- Monitor API usage and costs
- Consider using Alice Blue's WebSocket API for high-frequency updates

## Next Steps

1. Fill in your Alice Blue credentials in `.env.local`
2. Start the development server: `npm run dev`
3. Visit `http://localhost:3000/alice-blue`
4. Test with a single symbol first
5. Add your preferred watchlist symbols
6. Enable auto-refresh for live monitoring
