const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const marketDataService = require('./marketDataService');
const alertService = require('./alertService');
const { apiLogger } = require('../middleware/logger');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.marketDataInterval = null;
    this.alertCheckInterval = null;
  }

  // Initialize WebSocket server
  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startPeriodicUpdates();

    apiLogger.info('WebSocketService', 'initialized', {
      cors: process.env.FRONTEND_URL || 'http://localhost:3000'
    });
  }

  // Setup authentication middleware
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
          const user = await User.findById(decoded.userId).select('-password');
          
          if (user && user.isActive) {
            socket.userId = user._id.toString();
            socket.user = user;
          }
        }
        
        next();
      } catch (error) {
        // Allow connection even without valid token for public data
        next();
      }
    });
  }

  // Setup event handlers
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      apiLogger.info('WebSocketService', 'userConnected', {
        socketId: socket.id,
        userId: socket.userId || 'anonymous'
      });

      // Store connected user
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, {
          socketId: socket.id,
          socket: socket,
          connectedAt: new Date(),
          subscriptions: new Set()
        });
      }

      // Handle market data subscription
      socket.on('subscribe_market_data', (symbols) => {
        this.handleMarketDataSubscription(socket, symbols);
      });

      // Handle unsubscribe from market data
      socket.on('unsubscribe_market_data', (symbols) => {
        this.handleMarketDataUnsubscription(socket, symbols);
      });

      // Handle portfolio updates subscription
      socket.on('subscribe_portfolio', () => {
        if (socket.userId) {
          socket.join(`portfolio_${socket.userId}`);
          apiLogger.info('WebSocketService', 'portfolioSubscribed', {
            userId: socket.userId
          });
        }
      });

      // Handle news subscription
      socket.on('subscribe_news', (categories) => {
        this.handleNewsSubscription(socket, categories);
      });

      // Handle alerts subscription
      socket.on('subscribe_alerts', () => {
        if (socket.userId) {
          socket.join(`alerts_${socket.userId}`);
          apiLogger.info('WebSocketService', 'alertsSubscribed', {
            userId: socket.userId
          });
        }
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  // Handle market data subscription
  handleMarketDataSubscription(socket, symbols) {
    if (!Array.isArray(symbols)) return;

    symbols.forEach(symbol => {
      const roomName = `market_${symbol.toUpperCase()}`;
      socket.join(roomName);
      
      if (socket.userId) {
        const user = this.connectedUsers.get(socket.userId);
        if (user) {
          user.subscriptions.add(symbol.toUpperCase());
        }
      }
    });

    apiLogger.info('WebSocketService', 'marketDataSubscribed', {
      socketId: socket.id,
      symbols: symbols
    });

    // Send current data immediately
    this.sendCurrentMarketData(socket, symbols);
  }

  // Handle market data unsubscription
  handleMarketDataUnsubscription(socket, symbols) {
    if (!Array.isArray(symbols)) return;

    symbols.forEach(symbol => {
      const roomName = `market_${symbol.toUpperCase()}`;
      socket.leave(roomName);
      
      if (socket.userId) {
        const user = this.connectedUsers.get(socket.userId);
        if (user) {
          user.subscriptions.delete(symbol.toUpperCase());
        }
      }
    });

    apiLogger.info('WebSocketService', 'marketDataUnsubscribed', {
      socketId: socket.id,
      symbols: symbols
    });
  }

  // Handle news subscription
  handleNewsSubscription(socket, categories) {
    if (!Array.isArray(categories)) return;

    categories.forEach(category => {
      socket.join(`news_${category}`);
    });

    apiLogger.info('WebSocketService', 'newsSubscribed', {
      socketId: socket.id,
      categories: categories
    });
  }

  // Send current market data to socket
  async sendCurrentMarketData(socket, symbols) {
    try {
      const marketData = await marketDataService.getBatchMarketData(symbols);
      socket.emit('market_data_update', marketData);
    } catch (error) {
      apiLogger.error('WebSocketService', 'sendCurrentMarketData', error, {
        socketId: socket.id,
        symbols
      });
    }
  }

  // Handle disconnection
  handleDisconnection(socket) {
    apiLogger.info('WebSocketService', 'userDisconnected', {
      socketId: socket.id,
      userId: socket.userId || 'anonymous'
    });

    if (socket.userId) {
      this.connectedUsers.delete(socket.userId);
    }
  }

  // Broadcast market data updates
  async broadcastMarketDataUpdate(symbols) {
    try {
      const marketData = await marketDataService.getBatchMarketData(symbols);
      
      symbols.forEach(symbol => {
        const roomName = `market_${symbol.toUpperCase()}`;
        this.io.to(roomName).emit('market_data_update', {
          [symbol.toUpperCase()]: marketData[symbol.toUpperCase()]
        });
      });

      apiLogger.info('WebSocketService', 'marketDataBroadcast', {
        symbols: symbols,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      apiLogger.error('WebSocketService', 'broadcastMarketDataUpdate', error, {
        symbols
      });
    }
  }

  // Broadcast news update
  broadcastNewsUpdate(newsItem) {
    try {
      const roomName = `news_${newsItem.category}`;
      this.io.to(roomName).emit('news_update', newsItem);
      
      // Also broadcast to general news room
      this.io.to('news_all').emit('news_update', newsItem);

      apiLogger.info('WebSocketService', 'newsBroadcast', {
        category: newsItem.category,
        title: newsItem.title.substring(0, 50)
      });

    } catch (error) {
      apiLogger.error('WebSocketService', 'broadcastNewsUpdate', error);
    }
  }

  // Broadcast alert to specific user
  broadcastAlertToUser(userId, alert) {
    try {
      const roomName = `alerts_${userId}`;
      this.io.to(roomName).emit('alert_triggered', alert);

      apiLogger.info('WebSocketService', 'alertBroadcast', {
        userId: userId,
        alertId: alert._id,
        symbol: alert.symbol
      });

    } catch (error) {
      apiLogger.error('WebSocketService', 'broadcastAlertToUser', error, {
        userId,
        alertId: alert._id
      });
    }
  }

  // Broadcast portfolio update to user
  broadcastPortfolioUpdate(userId, portfolioData) {
    try {
      const roomName = `portfolio_${userId}`;
      this.io.to(roomName).emit('portfolio_update', portfolioData);

      apiLogger.info('WebSocketService', 'portfolioBroadcast', {
        userId: userId
      });

    } catch (error) {
      apiLogger.error('WebSocketService', 'broadcastPortfolioUpdate', error, {
        userId
      });
    }
  }

  // Start periodic updates
  startPeriodicUpdates() {
    // Market data updates every 30 seconds
    this.marketDataInterval = setInterval(async () => {
      try {
        // Get all subscribed symbols
        const subscribedSymbols = new Set();
        
        this.connectedUsers.forEach(user => {
          user.subscriptions.forEach(symbol => {
            subscribedSymbols.add(symbol);
          });
        });

        if (subscribedSymbols.size > 0) {
          await this.broadcastMarketDataUpdate(Array.from(subscribedSymbols));
        }

      } catch (error) {
        apiLogger.error('WebSocketService', 'periodicMarketDataUpdate', error);
      }
    }, 30000);

    // Alert checks every 60 seconds
    this.alertCheckInterval = setInterval(async () => {
      try {
        const result = await alertService.checkAlerts();
        
        if (result.triggered > 0) {
          apiLogger.info('WebSocketService', 'periodicAlertCheck', {
            checked: result.checked,
            triggered: result.triggered
          });
        }

      } catch (error) {
        apiLogger.error('WebSocketService', 'periodicAlertCheck', error);
      }
    }, 60000);

    apiLogger.info('WebSocketService', 'periodicUpdatesStarted', {
      marketDataInterval: 30000,
      alertCheckInterval: 60000
    });
  }

  // Stop periodic updates
  stopPeriodicUpdates() {
    if (this.marketDataInterval) {
      clearInterval(this.marketDataInterval);
      this.marketDataInterval = null;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    apiLogger.info('WebSocketService', 'periodicUpdatesStopped');
  }

  // Get connection statistics
  getConnectionStats() {
    const stats = {
      totalConnections: this.io.engine.clientsCount,
      authenticatedUsers: this.connectedUsers.size,
      rooms: Object.keys(this.io.sockets.adapter.rooms).length,
      connectedUsers: Array.from(this.connectedUsers.entries()).map(([userId, data]) => ({
        userId,
        socketId: data.socketId,
        connectedAt: data.connectedAt,
        subscriptions: Array.from(data.subscriptions)
      }))
    };

    return stats;
  }

  // Shutdown WebSocket service
  shutdown() {
    this.stopPeriodicUpdates();
    
    if (this.io) {
      this.io.close();
    }

    this.connectedUsers.clear();
    
    apiLogger.info('WebSocketService', 'shutdown');
  }
}

module.exports = new WebSocketService();