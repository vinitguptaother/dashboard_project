# Real API Integration Guide

This guide explains how to integrate your dashboard with real external APIs for live market data, news, and analysis.

## Quick Start

1. **Copy the environment file:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Add your API keys to `.env.local`**

3. **Update API configurations in the dashboard**

## Supported APIs

### 1. Alpha Vantage (Market Data & Technical Analysis)
- **Free Tier:** 5 requests/minute, 500/day
- **Sign up:** https://www.alphavantage.co/support/#api-key
- **Features:** Real-time quotes, technical indicators, fundamental data
- **Usage:** Add your API key to `NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY`

### 2. NewsAPI (Financial News)
- **Free Tier:** 1000 requests/month
- **Sign up:** https://newsapi.org/register
- **Features:** Latest financial news, market sentiment
- **Usage:** Add your API key to `NEXT_PUBLIC_NEWSAPI_KEY`

### 3. Financial Modeling Prep (Fundamental Data)
- **Free Tier:** 250 requests/day
- **Sign up:** https://financialmodelingprep.com/developer/docs
- **Features:** Financial statements, ratios, company profiles
- **Usage:** Add your API key to `NEXT_PUBLIC_FMP_API_KEY`

### 4. CoinGecko (Cryptocurrency Data)
- **Free Tier:** 10-50 calls/minute
- **Sign up:** https://www.coingecko.com/en/api/pricing
- **Features:** Crypto prices, market data
- **Usage:** Add your API key to `NEXT_PUBLIC_COINGECKO_API_KEY`

### 5. Yahoo Finance (via RapidAPI)
- **Freemium Model:** Various pricing tiers
- **Sign up:** https://rapidapi.com/apidojo/api/yahoo-finance1/
- **Features:** Stock quotes, historical data
- **Usage:** Add your API key to `NEXT_PUBLIC_YAHOO_FINANCE_API_KEY`

## How to Add APIs

1. **Go to API Integration tab** in your dashboard
2. **Click "Add New API"**
3. **Fill in the details:**
   - Name: Descriptive name for your API
   - Provider: Select from supported providers
   - Category: Choose the data type
   - API Key: Your actual API key
   - Endpoint: Base URL (auto-filled for known providers)

## API Categories

- **Market Data:** Real-time stock prices, indices
- **News:** Financial news and market updates
- **Technical Analysis:** RSI, MACD, moving averages
- **Fundamental Analysis:** P/E ratios, financial statements
- **Economic Data:** GDP, inflation, interest rates
- **Cryptocurrency:** Digital asset prices and data

## Rate Limiting

The system automatically handles rate limiting:
- Updates every 60 seconds (respects free tier limits)
- Automatic retry with exponential backoff
- Error handling for quota exceeded

## Error Handling

Common issues and solutions:

1. **"API key invalid"**
   - Verify your API key is correct
   - Check if the key has proper permissions

2. **"Rate limit exceeded"**
   - Wait for the rate limit to reset
   - Consider upgrading to a paid plan

3. **"Network timeout"**
   - Check your internet connection
   - API provider might be experiencing issues

## Security Notes

- API keys are stored locally in your browser
- Never commit `.env.local` to version control
- Use environment variables for production deployments
- Consider using a backend proxy for sensitive API keys

## Cost Optimization

- Start with free tiers to test functionality
- Monitor your API usage in the dashboard
- Upgrade to paid plans only when needed
- Use caching to reduce API calls

## Troubleshooting

1. **Check API status** in the API Integration tab
2. **Test individual APIs** using the test button
3. **View cached data** to see last successful response
4. **Check browser console** for detailed error messages

## Next Steps

1. Set up your API keys
2. Test each API connection
3. Monitor data updates in real-time
4. Customize update intervals as needed
5. Add more APIs as your needs grow

For support, check the API provider's documentation or contact their support teams.