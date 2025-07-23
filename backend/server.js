const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cron = require('node-cron');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const { connectDB, connectRedis } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const marketRoutes = require('./routes/market');
const portfolioRoutes = require('./routes/portfolio');
const newsRoutes = require('./routes/news');
const alertRoutes = require('./routes/alerts');
const apiConfigRoutes = require('./routes/apiConfig');
const userRoutes = require('./routes/user');

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
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

// Apply rate limiters
app.use('/api/auth', authLimiter);
app.use('/api/market', marketDataLimiter);
app.use('/api/config', apiConfigLimiter);
app.use('/api/', generalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/portfolio', auth, portfolioRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/alerts', auth, alertRoutes);
app.use('/api/config', auth, apiConfigRoutes);
app.use('/api/user', auth, userRoutes);

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

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Dashboard API ready at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
  
  // Start scheduled tasks
  startScheduledTasks();
});

// Scheduled tasks
function startScheduledTasks() {
  console.log('📅 Starting scheduled tasks...');
  
  // Update market data every 2 minutes during market hours
  cron.schedule('*/2 * * * *', async () => {
    try {
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