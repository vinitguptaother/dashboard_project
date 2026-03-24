# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a comprehensive **Indian Stock Market Dashboard** - a full-stack application that provides real-time market data, AI-powered analysis, portfolio management, and trading signals. The application combines a Next.js frontend with an Express.js backend, featuring WebSocket connections for real-time updates and AI integration through Perplexity API.

## Development Commands

### Frontend (Next.js)
```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Backend (Express.js)
```bash
# Start backend development server
npm run backend:dev

# Start backend production server
npm run backend

# Seed database
npm run db:seed
```

### Combined Development
For full-stack development, run both servers:
```bash
# Terminal 1: Frontend (runs on port 3000)
npm run dev

# Terminal 2: Backend (runs on port 5001)
npm run backend:dev
```

## Architecture Overview

### Frontend Architecture
- **Framework**: Next.js 15.4.1 with App Router
- **Styling**: Tailwind CSS with custom glass effects
- **Charts**: Recharts for financial visualizations
- **State Management**: React hooks with custom services
- **Real-time**: WebSocket connections for live market data
- **UI Components**: Custom components in `app/components/`

### Backend Architecture
- **Server**: Express.js with MongoDB and Redis
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis for high-performance data caching
- **WebSockets**: Socket.IO for real-time data streaming
- **AI Integration**: Perplexity API for market analysis
- **Security**: JWT authentication, helmet, CORS, rate limiting

### Key Directories
```
├── app/                    # Next.js app directory
│   ├── components/         # React components for each tab/feature
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Client-side services and utilities
│   └── page.tsx           # Main dashboard entry point
├── backend/               # Express.js backend
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   ├── models/           # MongoDB schemas
│   ├── middleware/       # Express middleware
│   └── server.js         # Backend entry point
├── pages/api/            # Next.js API routes (legacy)
├── services/             # Shared services (Angel One integration)
└── utils/                # Utility functions
```

## Key Features & Components

### 1. Real-Time Market Data
- **WebSocket Service** (`app/lib/websocketService.ts`): Manages real-time data streams
- **Market Data Hook** (`app/hooks/useRealTimeData.ts`): React hook for consuming market data
- **Dashboard Component** (`app/components/Dashboard.tsx`): Main dashboard with live charts

### 2. Trading Broker Integration
- **Angel One API** (`services/angelOneAuth.js`, `services/angelOneWebSocket.js`): Complete Smart API integration
- **Alice Blue Integration** (`backend/services/aliceBlueService.js`): Alternative broker support
- **TOTP Authentication**: Automatic token management and refresh

### 3. AI-Powered Analysis
- **AI Service** (`backend/services/aiService.js`): Perplexity AI integration for market analysis
- **AI Chatbot** (`app/components/AIChatbot.tsx`): Interactive AI assistant
- **Stock Analysis**: Real-time AI-powered stock recommendations

### 4. Portfolio Management
- **Portfolio Service** (`app/lib/portfolioService.ts`): Portfolio CRUD operations
- **Real-time Tracking**: Live P&L calculations and updates
- **Performance Analytics**: Historical performance tracking

### 5. Alert System
- **Alert Service** (`app/lib/alertService.ts`): Price alerts and notifications
- **WebSocket Notifications**: Real-time alert delivery
- **Multiple Alert Types**: Price, volume, technical indicator alerts

## Database Architecture

### MongoDB Models
- **User** (`backend/models/User.js`): User authentication and preferences
- **Portfolio** (`backend/models/Portfolio.js`): Portfolio holdings and positions
- **Alert** (`backend/models/Alert.js`): User-defined alerts and notifications
- **MarketData** (`backend/models/MarketData.js`): Cached market data
- **News** (`backend/models/News.js`): Financial news and sentiment
- **APIConfig** (`backend/models/APIConfig.js`): External API configurations

### Redis Caching Strategy
- **Market Data**: 30-second cache for live prices
- **News Data**: 5-minute cache for news articles
- **AI Analysis**: 5-minute cache for AI responses
- **User Sessions**: JWT token caching

## Real-Time Data Flow

1. **Backend Schedulers** (`backend/server.js`):
   - Market data updates every 2 minutes
   - News fetching every 30 minutes
   - Cache cleanup hourly
   - API usage reset daily

2. **WebSocket Events**:
   - `market_data_update`: Live price updates
   - `portfolio_update`: Portfolio value changes
   - `alert_triggered`: Price alert notifications
   - `news_update`: Breaking news alerts
   - `ai_analysis_update`: AI recommendation updates

3. **Client-Side Hooks**:
   - `useMarketDataWebSocket`: Subscribe to specific symbols
   - `usePortfolioWebSocket`: Portfolio real-time updates
   - `useAlertsWebSocket`: Alert notifications
   - `useNotificationsWebSocket`: System notifications

## API Integration

### External APIs
- **Angel One Smart API**: Real-time Indian market data
- **Alice Blue API**: Alternative market data source
- **Perplexity AI**: Market analysis and chatbot responses
- **News APIs**: Financial news aggregation

### Rate Limiting
- **General API**: 100 requests per hour
- **Authentication**: 10 requests per hour
- **Market Data**: 200 requests per hour
- **AI Analysis**: 50 requests per hour

## Environment Configuration

### Required Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/stock_dashboard
REDIS_URL=redis://localhost:6379

# APIs
ANGELONE_API_KEY=your_angel_one_api_key
ANGELONE_CLIENT_CODE=your_client_code
ANGELONE_PASSWORD=your_trading_pin
ANGELONE_TOTP_SECRET=your_totp_secret
PERPLEXITY_API_KEY=your_perplexity_api_key

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=24h

# Application
FRONTEND_URL=http://localhost:3000
PORT=5001
```

## Development Guidelines

### Component Architecture
- Each major feature has its own component in `app/components/`
- Components use custom hooks from `app/hooks/` for data management
- Services in `app/lib/` handle API calls and business logic
- Real-time updates flow through WebSocket hooks

### Backend Services Pattern
- **Service Layer**: Business logic in `backend/services/`
- **Route Handlers**: Thin controllers in `backend/routes/`
- **Middleware**: Authentication, logging, rate limiting in `backend/middleware/`
- **Models**: MongoDB schemas with validation in `backend/models/`

### Trading Integration Best Practices
- Always handle TOTP authentication for broker APIs
- Implement automatic token refresh before expiration
- Use batch requests for multiple symbol data
- Implement proper error handling for network failures
- Cache frequently accessed data with appropriate TTL

### AI Integration Guidelines
- Context-aware prompts with real-time market data
- Structured JSON responses for consistent parsing
- Fallback logic when AI service is unavailable
- Cache AI responses to minimize API costs

## Testing

### Backend Testing
```bash
# Run backend tests (when implemented)
cd backend && npm test

# Test specific broker integration
node test-angel-one-integration.js
```

### Frontend Testing
```bash
# Test frontend build
npm run build

# Validate TypeScript
npx tsc --noEmit
```

## Deployment Notes

### Production Checklist
1. Configure all environment variables
2. Set up MongoDB and Redis instances
3. Configure rate limiting for production loads
4. Set up SSL certificates for HTTPS
5. Configure WebSocket proxying (nginx/Apache)
6. Set up monitoring for API rate limits
7. Configure log aggregation and monitoring

### Performance Considerations
- WebSocket connections scale with concurrent users
- Redis caching reduces database load significantly
- AI API costs scale with usage - implement usage tracking
- Market data APIs have rate limits - respect them
- Consider CDN for static assets in production

## Security Notes

- JWT tokens expire in 24 hours by default
- All API keys should be in environment variables only
- Rate limiting prevents API abuse
- CORS configured for frontend domain only
- MongoDB connection should use authentication in production
- Redis should be password-protected in production

## Troubleshooting

### Common Issues
1. **WebSocket Connection Fails**: Check if backend server is running on port 5001
2. **Market Data Not Updating**: Verify broker API credentials and network connectivity  
3. **AI Analysis Not Working**: Check Perplexity API key and rate limits
4. **Database Connection Issues**: Ensure MongoDB is running and accessible
5. **Redis Connection Issues**: Verify Redis is running (application will fallback to memory cache)

### Debug Mode
Set `NODE_ENV=development` for detailed logging and error traces.