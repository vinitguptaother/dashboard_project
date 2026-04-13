const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cron = require('node-cron');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ─── Auto-load Upstox token from saved file ─────────────────────────────────
// On startup, if process.env doesn't have a token (or it's expired),
// try loading the last-saved token from upstox-token.json.
// This means you don't need to re-authenticate after every server restart.
(function autoLoadUpstoxToken() {
  const fs = require('fs');
  const tokenFile = require('path').join(__dirname, 'upstox-token.json');

  // Helper: decode JWT and check expiry (5-min buffer)
  function isTokenValid(token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      return payload.exp > (Date.now() / 1000 + 300);
    } catch { return false; }
  }

  const envToken = process.env.UPSTOX_ACCESS_TOKEN;
  const envValid = envToken && envToken !== 'your_access_token_here' && isTokenValid(envToken);

  if (envValid) {
    console.log('✅ UPSTOX_ACCESS_TOKEN loaded from .env (length:', envToken.length, 'chars)');
    return;
  }

  // Try loading from saved token file
  try {
    if (fs.existsSync(tokenFile)) {
      const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      if (data.access_token && isTokenValid(data.access_token)) {
        process.env.UPSTOX_ACCESS_TOKEN = data.access_token;
        console.log('✅ UPSTOX_ACCESS_TOKEN auto-loaded from token file (saved:', data.saved_at, ')');
        return;
      } else if (data.access_token) {
        console.log('⚠️  Upstox token file exists but token is expired — reconnect needed');
      }
    }
  } catch (err) {
    console.warn('⚠️  Could not read upstox-token.json:', err.message);
  }

  console.log('❌ No valid Upstox token — live prices unavailable until you reconnect');
})();

// Initialize Upstox service (if it exists)
try {
  const { initializeUpstoxClient } = require('../services/upstoxService');
  initializeUpstoxClient();
} catch (e) {
  console.warn('⚠️  Upstox service not available:', e.message);
}

const { connectDB, connectRedis } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const marketRoutes = require('./routes/market');
const portfolioRoutes = require('./routes/portfolio');
const newsRoutes = require('./routes/news');
const alertRoutes = require('./routes/alerts');
const apiConfigRoutes = require('./routes/apiConfig');
const envConfigRoutes = require('./routes/envConfig');
const userRoutes = require('./routes/user');
const aiAnalysisRoutes = require('./routes/aiAnalysis');
const aiChatbotRoutes = require('./routes/aiChatbot');
const screenerRoutes = require('./routes/screener');
const tradingSignalsRoutes = require('./routes/tradingSignals');
const perplexityProxyRoutes = require('./routes/perplexity');
const aliceBlueRoutes = require('./routes/aliceBlue');
const upstoxRoutes = require('./routes/upstox');
const upstoxAuthRoutes = require('./routes/upstoxAuth');
const healthCheckRoutes = require('./routes/healthCheck');
const screensRoutes = require('./routes/screens');
const instrumentsRoutes = require('./routes/instruments');
const tradeSetupRoutes = require('./routes/tradeSetup');
const riskManagementRoutes = require('./routes/riskManagement');
const watchlistRoutes = require('./routes/watchlist');

// Import middleware
const { auth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/logger');
const { 
  generalLimiter, 
  authLimiter, 
  marketDataLimiter, 
  apiConfigLimiter 
} = require('./middleware/rateLimiter');

// Import services
const marketDataService = require('./services/marketDataService');
const newsService = require('./services/newsService');

const app = express();

// Connect to databases
connectDB();
let redisClient;
connectRedis().then(client => {
  redisClient = client;
  app.locals.redis = client;
}).catch(err => {
  console.log('⚠️  Starting without Redis - using in-memory caching');
  redisClient = null;
  app.locals.redis = null;
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));

// Request logging
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Market data endpoint (demo fallback)
app.get('/api/market-data', (req, res) => {
  res.json({
    success: true,
    data: {
      NIFTY: { price: 19850.25, change: 127.30, changePercent: 0.65, isLive: false },
      SENSEX: { price: 66590.85, change: -234.15, changePercent: -0.35, isLive: false },
      BANKNIFTY: { price: 44890.10, change: 89.45, changePercent: 0.20, isLive: false }
    },
    timestamp: new Date().toISOString()
  });
});

// API Routes that need NO rate limiting (real-time data + auth)
app.use('/api/upstox', upstoxAuthRoutes); // Token auth routes (auth-url, exchange-token, token-status)
app.use('/api/upstox', upstoxRoutes);     // Data routes (ltp, portfolio, etc.)
app.use('/api/health-check', healthCheckRoutes); // Health checks should not be rate limited

// Apply rate limiters
app.use('/api/auth', authLimiter);
app.use('/api/market', marketDataLimiter);
app.use('/api/config', apiConfigLimiter);
app.use('/api/', generalLimiter);

// Other API Routes
app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/portfolio', auth, portfolioRoutes);
app.use('/api/news', newsRoutes);
// Alerts uses req.user.id — inject default user for this single-user dashboard
const mongoose = require('mongoose');
const DEFAULT_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001');
app.use('/api/alerts', (req, res, next) => {
  if (!req.user) req.user = { id: DEFAULT_USER_ID, email: 'vinit@dashboard.local' };
  next();
}, alertRoutes);
app.use('/api/settings', envConfigRoutes); // Auth enforced inside routes (GET/PUT/reveal all require auth; schema is public)
app.use('/api/config', auth, apiConfigRoutes);
app.use('/api/user', auth, userRoutes);
app.use('/api/ai', aiAnalysisRoutes);
app.use('/api/ai', aiChatbotRoutes);
app.use('/api/screener', auth, screenerRoutes);
app.use('/api/screens', screensRoutes);
app.use('/api/instruments', instrumentsRoutes);
app.use('/api/trading', auth, tradingSignalsRoutes);
app.use('/api/perplexity', perplexityProxyRoutes);
app.use('/api/alice-blue', auth, aliceBlueRoutes);
app.use('/api/trade-setup', tradeSetupRoutes);
app.use('/api/risk', riskManagementRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/api-usage', require('./routes/apiUsage'));
app.use('/api/options', require('./routes/options'));
app.use('/api/market-status', require('./routes/marketStatus'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/activity', require('./routes/activitySummary'));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5001;

// Import WebSocket service
const websocketService = require('./services/websocketService');

const server = http.createServer(app);

// Initialize WebSocket service
websocketService.initialize(server);

const startServer = (port) => {
  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Dashboard API ready at http://localhost:${port}`);
    console.log(`🔌 WebSocket server ready for real-time updates`);

    // Start scheduled tasks
    startScheduledTasks();

    // Check if instruments DB is populated — if not, auto-import on first boot
    checkAndImportInstruments();
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${port} is already in use, trying port ${port + 1}...`);
      startServer(port + 1); // Try the next port
    } else {
      console.error('❌ Server startup error:', err);
      process.exit(1);
    }
  });
};

startServer(PORT);

// Market hours + holiday awareness
const { isMarketOpen, getMarketState } = require('./utils/marketHours');
const holidayService = require('./services/holidayService');

// Scheduled tasks
function startScheduledTasks() {
  console.log('📅 Starting scheduled tasks...');

  // ── Holiday list refresh on startup + daily at 6 AM IST (00:30 UTC) ────────
  holidayService.refreshHolidays().then(r => {
    const state = getMarketState(new Date(), r.holidays);
    console.log(`📅 Market state: ${state.state} (${state.istTime} IST, ${r.holidays.length} holidays, source: ${r.source})`);
  });
  cron.schedule('30 0 * * *', async () => {
    try { await holidayService.refreshHolidays(); }
    catch (e) { console.error('❌ Holiday refresh error:', e.message); }
  });

  // Update market data every 2 minutes during market hours (guarded)
  cron.schedule('*/2 * * * *', async () => {
    try {
      const { holidays } = holidayService.getHolidays();
      if (!isMarketOpen(new Date(), holidays)) return; // skip off-hours & holidays
      console.log('🔄 Updating market data...');
      const symbols = ['NIFTY', 'SENSEX', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFC', 'INFY'];
      await marketDataService.getBatchMarketData(symbols);
    } catch (error) {
      console.error('❌ Market data update error:', error.message);
    }
  });

  // Fetch news every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      console.log('📰 Fetching latest news...');
      await newsService.fetchExternalNews();
    } catch (error) {
      console.error('❌ News fetch error:', error.message);
    }
  });

  // Clear cache every hour
  cron.schedule('0 * * * *', () => {
    console.log('🧹 Clearing service caches...');
    marketDataService.clearCache();
    newsService.clearCache();
  });

  // Reset daily API usage counters at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('🔄 Resetting daily API usage counters...');
      const APIConfig = require('./models/APIConfig');
      await APIConfig.updateMany(
        { isActive: true },
        { $set: { 'usage.requestsToday': 0 } }
      );
    } catch (error) {
      console.error('❌ Reset usage counters error:', error.message);
    }
  });

  // ── Kill Switch midnight reset (IST = UTC+5:30, so midnight IST = 18:30 UTC prev day)
  // Runs at 00:00 IST (18:30 UTC) to reset kill switch for new trading day
  cron.schedule('30 18 * * *', async () => {
    try {
      const RiskSettings = require('./models/RiskSettings');
      const settings = await RiskSettings.findOne({ userId: 'default' });
      if (settings && settings.killSwitchActive) {
        settings.killSwitchActive = false;
        settings.killSwitchDate = null;
        await settings.save();
        console.log('🔄 Kill switch reset for new trading day');
        websocketService.broadcastSystemNotification({
          id: 'kill-switch-reset-' + Date.now(),
          type: 'info',
          title: '✅ Kill Switch Reset',
          message: 'New trading day — kill switch has been deactivated. Trade carefully.',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('❌ Kill switch reset error:', error.message);
    }
  });

  // ── Instruments weekly full download ──────────────────────────────────────
  // Downloads ALL NSE+BSE equity instruments from Upstox every Sunday at 6 AM
  cron.schedule('0 6 * * 0', async () => {
    try {
      console.log('📥 Weekly full instruments download starting...');
      const { importInstruments } = require('./scripts/downloadInstruments');
      await importInstruments(false);
    } catch (error) {
      console.error('❌ Weekly instruments download error:', error.message);
    }
  });

  // ── Refresh RSS news cache every 15 minutes ───────────────────────────────
  cron.schedule('*/15 * * * *', async () => {
    try {
      const { fetchRSSNews } = require('./services/rssNewsService');
      const articles = await fetchRSSNews();
      // Invalidate the Redis cache so next request gets fresh data
      if (app.locals.redis) {
        await app.locals.redis.del('news:rss:live');
      }
      console.log(`📰 RSS cache refreshed: ${articles.length} articles`);
    } catch (error) {
      console.error('❌ RSS news refresh error:', error.message);
    }
  });

  // ── Upstox token expiry warning (Mon-Fri at 8:45 AM IST = 3:15 AM UTC) ──
  // Warns you before market opens if the token is expired or expiring soon.
  cron.schedule('15 3 * * 1-5', async () => {
    try {
      const fs = require('fs');
      const tokenFile = require('path').join(__dirname, 'upstox-token.json');
      if (!fs.existsSync(tokenFile)) {
        websocketService.broadcastSystemNotification({
          id: 'token-warning-' + Date.now(),
          type: 'error',
          title: '🔑 Upstox Token Missing',
          message: 'No Upstox token found. Market opens in 30 minutes — reconnect now to get live prices.',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
      const token = tokenData.access_token;
      if (!token) return;

      // Decode JWT to check expiry
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        const expiresAt = payload.exp * 1000;
        const now = Date.now();
        const hoursLeft = Math.floor((expiresAt - now) / 3600000);

        if (hoursLeft < 0) {
          websocketService.broadcastSystemNotification({
            id: 'token-expired-' + Date.now(),
            type: 'error',
            title: '🔑 Upstox Token Expired',
            message: 'Your Upstox session expired. Market opens in 30 minutes — click DEMO badge to reconnect.',
            timestamp: new Date().toISOString(),
          });
        } else if (hoursLeft < 2) {
          websocketService.broadcastSystemNotification({
            id: 'token-expiring-' + Date.now(),
            type: 'warning',
            title: `🔑 Upstox Token Expiring Soon`,
            message: `Your Upstox token expires in ~${hoursLeft}h. Reconnect before market opens at 9:15 AM.`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('❌ Token expiry check error:', error.message);
    }
  });

  // Monitor active trade setups every 2 minutes during market hours (Mon-Fri 9:15-15:30 IST)
  // Uses shared isMarketOpen() util → also skips NSE holidays, not just weekday/hour.
  // CRITICAL: Uses Instrument DB for proper key mapping + direct Upstox REST API (no demo fallback)
  cron.schedule('*/2 9-15 * * 1-5', async () => {
    try {
      // Holiday-aware guard (cron cant express holidays natively)
      const { holidays } = holidayService.getHolidays();
      if (!isMarketOpen(new Date(), holidays)) {
        app.locals.monitorHealth = { lastRun: new Date(), status: 'skipped', reason: 'market closed (holiday or outside hours)', activeSetups: 0 };
        return;
      }

      const TradeSetup = require('./models/TradeSetup');
      const Instrument = require('./models/Instrument');
      const axios = require('axios');

      const activeSetups = await TradeSetup.find({ status: 'ACTIVE', action: { $in: ['BUY', 'SELL', 'ACCUMULATE'] } });
      if (activeSetups.length === 0) {
        app.locals.monitorHealth = { lastRun: new Date(), status: 'idle', activeSetups: 0 };
        return;
      }

      const symbols = [...new Set(activeSetups.map(s => s.symbol))];

      // SAFETY CHECK: Only use real Upstox token — NEVER demo/fake data for SL/Target monitoring
      const token = process.env.UPSTOX_ACCESS_TOKEN;
      if (!token || token === 'your_access_token_here') {
        console.warn('⚠️ Trade monitor: No valid Upstox token — skipping (NOT using fake prices)');
        app.locals.monitorHealth = {
          lastRun: new Date(), status: 'skipped', reason: 'No valid Upstox token',
          activeSetups: activeSetups.length, symbolsChecked: 0, pricesFound: 0,
        };
        return;
      }

      // Build instrument key map from Instruments DB — use the token field directly
      // (token stores the full instrument_key like "NSE_EQ|INE002A01018")
      const upperSymbols = symbols.map(s => s.toUpperCase());
      const dbInstruments = await Instrument.find({
        symbol: { $in: upperSymbols },
        token: { $ne: '' },
      }).lean();

      // Prefer NSE over BSE when both exist for same symbol
      const symbolToKey = {};
      const keyToSymbol = {};
      for (const inst of dbInstruments) {
        const sym = inst.symbol.toUpperCase();
        const key = inst.token; // Already full key like "NSE_EQ|INE002A01018"
        // Only overwrite if this is NSE (preferred) or no entry yet
        if (!symbolToKey[sym] || inst.exchange === 'NSE') {
          symbolToKey[sym] = key;
        }
        keyToSymbol[key] = sym;
      }

      // Log which symbols have no instrument key (can't be monitored)
      const unmapped = symbols.filter(s => !symbolToKey[s.toUpperCase()]);
      if (unmapped.length > 0) {
        console.warn(`⚠️ Trade monitor: No instrument key for: ${unmapped.join(', ')} — these setups won't be monitored`);
      }

      const mappedSymbols = symbols.filter(s => symbolToKey[s.toUpperCase()]);
      if (mappedSymbols.length === 0) {
        app.locals.monitorHealth = {
          lastRun: new Date(), status: 'no_keys', reason: 'No instrument keys found in DB',
          activeSetups: activeSetups.length, symbolsChecked: 0, pricesFound: 0, unmapped,
        };
        return;
      }

      // Fetch LTP via direct Upstox REST API (bypasses SDK demo fallback)
      const priceMap = new Map();
      const errors = [];
      for (let i = 0; i < mappedSymbols.length; i += 50) {
        try {
          const chunk = mappedSymbols.slice(i, i + 50);
          const instrumentKeys = chunk.map(s => symbolToKey[s.toUpperCase()]);
          const instrumentString = instrumentKeys.join(',');

          const response = await axios.get('https://api.upstox.com/v2/market-quote/ltp', {
            params: { instrument_key: instrumentString },
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
            timeout: 10000,
          });

          if (response.data && response.data.data) {
            for (const [rawKey, value] of Object.entries(response.data.data)) {
              // Upstox returns keys with : (e.g. "NSE_EQ:INE002A01018")
              const keyWithPipe = rawKey.replace(':', '|');
              const sym = keyToSymbol[keyWithPipe] || keyToSymbol[rawKey];
              const price = value?.last_price ?? value?.lastPrice;
              if (sym && price && price > 0) {
                priceMap.set(sym, price);
              }
            }
          }
        } catch (e) {
          const errMsg = e.response?.data?.message || e.message;
          errors.push(errMsg);
          console.error('Trade monitor LTP error:', errMsg);
          // If 401/403, token is expired — don't retry with fake data
          if (e.response?.status === 401 || e.response?.status === 403) {
            console.error('🔑 Trade monitor: Upstox token expired — monitor halted');
            websocketService.broadcastSystemNotification({
              id: 'token-expired-' + Date.now(),
              type: 'error',
              title: '🔑 Upstox Token Expired',
              message: `Trade monitoring stopped — ${activeSetups.length} active setups are NOT being watched. Reconnect Upstox from Settings.`,
              timestamp: new Date().toISOString(),
            });
            break;
          }
        }
      }

      // Store health info for the health endpoint
      app.locals.monitorHealth = {
        lastRun: new Date(),
        status: priceMap.size > 0 ? 'ok' : 'no_prices',
        activeSetups: activeSetups.length,
        symbolsChecked: mappedSymbols.length,
        pricesFound: priceMap.size,
        unmapped: unmapped.length > 0 ? unmapped : undefined,
        errors: errors.length > 0 ? errors : undefined,
        priceSnapshot: Object.fromEntries(priceMap),
      };

      if (priceMap.size === 0) {
        console.warn('⚠️ Trade monitor: No real prices fetched — skipping SL/Target checks');
        return;
      }

      let updated = 0;
      for (const setup of activeSetups) {
        const price = priceMap.get(setup.symbol);
        if (!price) continue;

        let newStatus = null;
        if (setup.action === 'BUY' || setup.action === 'ACCUMULATE') {
          if (price >= setup.target) newStatus = 'TARGET_HIT';
          else if (price <= setup.stopLoss) newStatus = 'SL_HIT';
        } else if (setup.action === 'SELL') {
          if (price <= setup.target) newStatus = 'TARGET_HIT';
          else if (price >= setup.stopLoss) newStatus = 'SL_HIT';
        }

        // Update currentPrice always, status + closedAt + exitPrice only if hit
        const updateFields = { currentPrice: price, updatedAt: new Date() };
        if (newStatus) {
          updateFields.status = newStatus;
          updateFields.closedAt = new Date();
          updateFields.exitPrice = price;
        }
        await TradeSetup.findByIdAndUpdate(setup._id, updateFields);
        if (newStatus) {
          updated++;
          console.log(`🎯 Trade setup ${setup.symbol}: ${newStatus} (price: ₹${price})`);
          // Update screen performance feedback loop
          try {
            const { updateScreenPerformance } = require('./services/feedbackService');
            await updateScreenPerformance({ ...setup.toObject(), status: newStatus, exitPrice: price });
          } catch (fbErr) {
            console.warn(`⚠️ Feedback update failed for ${setup.symbol}:`, fbErr.message);
          }
          // Push real-time notification to all connected clients
          websocketService.broadcastSystemNotification({
            id: setup._id.toString(),
            type: newStatus === 'TARGET_HIT' ? 'success' : 'error',
            title: `${newStatus === 'TARGET_HIT' ? '🎯 Target Hit' : '🛑 Stop Loss Hit'}: ${setup.symbol}`,
            message: `${setup.action} ${setup.symbol} — ${newStatus === 'TARGET_HIT' ? 'Target' : 'SL'} at ₹${price.toLocaleString('en-IN')}. Entry: ₹${setup.entryPrice.toLocaleString('en-IN')}, Target: ₹${setup.target.toLocaleString('en-IN')}, SL: ₹${setup.stopLoss.toLocaleString('en-IN')}`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (updated > 0) {
        console.log(`📊 Trade monitor: ${updated} setups resolved out of ${activeSetups.length} active`);
        // Check daily P&L and trigger kill switch if needed
        try {
          const RiskSettings = require('./models/RiskSettings');
          const riskSettings = await RiskSettings.findOne({ userId: 'default' });
          if (riskSettings && !riskSettings.killSwitchActive) {
            const { calculateDailyPnL } = require('./routes/riskManagement');
            const pnlData = await calculateDailyPnL(riskSettings);
            const limitAmount = (riskSettings.capital * riskSettings.dailyLossLimitPct) / 100;

            // Check thresholds and send WebSocket alerts
            if (pnlData.totalPnL < 0) {
              const lossPct = (Math.abs(pnlData.totalPnL) / limitAmount) * 100;
              if (lossPct >= 100) {
                // KILL SWITCH — daily loss limit reached
                riskSettings.killSwitchActive = true;
                riskSettings.killSwitchDate = new Date();
                await riskSettings.save();
                websocketService.broadcastSystemNotification({
                  id: 'kill-switch-' + Date.now(),
                  type: 'error',
                  title: '🛑 KILL SWITCH ACTIVATED',
                  message: `Daily loss limit reached (₹${Math.abs(pnlData.totalPnL).toLocaleString('en-IN')} lost today). No new trades until tomorrow.`,
                  timestamp: new Date().toISOString(),
                });
                console.log('🛑 KILL SWITCH ACTIVATED — daily loss limit reached');
              } else if (lossPct >= 80) {
                websocketService.broadcastSystemNotification({
                  id: 'pnl-warning-80-' + Date.now(),
                  type: 'warning',
                  title: '⚠️ 80% of Daily Loss Limit',
                  message: `You've lost ₹${Math.abs(pnlData.totalPnL).toLocaleString('en-IN')} today (${lossPct.toFixed(0)}% of limit). Consider stopping.`,
                  timestamp: new Date().toISOString(),
                });
              } else if (lossPct >= 50) {
                websocketService.broadcastSystemNotification({
                  id: 'pnl-warning-50-' + Date.now(),
                  type: 'warning',
                  title: '⚠️ 50% of Daily Loss Limit',
                  message: `You've lost ₹${Math.abs(pnlData.totalPnL).toLocaleString('en-IN')} today (${lossPct.toFixed(0)}% of limit).`,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
        } catch (pnlErr) {
          console.error('Daily P&L check error:', pnlErr.message);
        }
      }
    } catch (error) {
      console.error('❌ Trade setup monitor error:', error.message);
    }
  });

  // Auto-expire stale ACTIVE setups nightly at 10:30 PM IST (Mon-Fri)
  // Parses holdingDuration ("2-4 weeks", "1-2 months", etc.) and expires setups past their max duration
  cron.schedule('30 22 * * 1-5', async () => {
    try {
      const TradeSetup = require('./models/TradeSetup');
      const activeSetups = await TradeSetup.find({ status: 'ACTIVE' });
      if (activeSetups.length === 0) return;

      const now = Date.now();
      let expired = 0;

      for (const setup of activeSetups) {
        const dur = (setup.holdingDuration || '').toLowerCase();
        let maxDays = null;

        // Parse holding duration to max days
        // "2-4 weeks" → 28, "1-2 months" → 60, "3-6 months" → 180, "1 week" → 7
        const weekMatch = dur.match(/(\d+)\s*(?:-\s*(\d+))?\s*week/);
        const monthMatch = dur.match(/(\d+)\s*(?:-\s*(\d+))?\s*month/);
        const dayMatch = dur.match(/(\d+)\s*(?:-\s*(\d+))?\s*day/);

        if (weekMatch) {
          maxDays = (Number(weekMatch[2] || weekMatch[1])) * 7;
        } else if (monthMatch) {
          maxDays = (Number(monthMatch[2] || monthMatch[1])) * 30;
        } else if (dayMatch) {
          maxDays = Number(dayMatch[2] || dayMatch[1]);
        }

        // Default: expire after 45 days if duration is unparseable
        if (!maxDays) maxDays = 45;

        // Add 20% buffer beyond max holding duration
        const expiryMs = maxDays * 1.2 * 24 * 60 * 60 * 1000;
        const age = now - new Date(setup.createdAt).getTime();

        if (age > expiryMs) {
          await TradeSetup.findByIdAndUpdate(setup._id, {
            status: 'EXPIRED',
            closedAt: new Date(),
            updatedAt: new Date(),
          });
          expired++;
          console.log(`⏰ Auto-expired: ${setup.symbol} (held ${Math.round(age / (24*60*60*1000))}d, max was ${maxDays}d)`);
        }
      }

      if (expired > 0) {
        console.log(`⏰ Auto-expiry: ${expired} setups expired out of ${activeSetups.length} active`);
      }
    } catch (error) {
      console.error('❌ Auto-expiry cron error:', error.message);
    }
  });

  // Score all screens nightly at 11 PM IST (Mon-Fri)
  // Updates performanceScore, status, and recommendations for each screen
  cron.schedule('0 23 * * 1-5', async () => {
    try {
      console.log('📊 Nightly screen scoring started...');
      const { scoreAllScreens } = require('./services/screenScoringService');
      const results = await scoreAllScreens();
      console.log(`📊 Nightly scoring complete: ${results.length} screens scored`);
    } catch (error) {
      console.error('❌ Nightly screen scoring error:', error.message);
    }
  });
}

// ─── Startup: Instruments Check ──────────────────────────────────────────────
// Runs once when server starts. If the Instruments collection has fewer than
// 50 records, seeds with NIFTY 200 + popular midcaps (instant, no download).
// Search for any other stock is handled live via Yahoo Finance autocomplete.
async function checkAndImportInstruments() {
  try {
    const Instrument = require('./models/Instrument');
    const count = await Instrument.countDocuments();
    if (count < 500) {
      // Less than 500 instruments = only seed data loaded, need full Upstox download
      console.log(`📥 Instruments DB has only ${count} records — downloading full Upstox instrument list...`);
      const { importInstruments } = require('./scripts/downloadInstruments');
      await importInstruments(false);
    } else {
      console.log(`✅ Instruments DB ready: ${count} instruments loaded`);
    }
  } catch (error) {
    console.error('❌ Instruments startup check failed:', error.message);
    // Fallback to seed if full download fails
    try {
      const { seedNSEInstruments } = require('./scripts/seedNSEInstruments');
      await seedNSEInstruments(false);
    } catch (seedErr) {
      console.error('❌ Seed fallback also failed:', seedErr.message);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    if (redisClient) {
      redisClient.quit();
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    if (redisClient) {
      redisClient.quit();
    }
    process.exit(0);
  });
});

module.exports = app;