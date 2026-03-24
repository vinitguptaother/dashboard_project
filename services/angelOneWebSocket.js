// services/angelOneWebSocket.js
const WebSocket = require('ws');
const { angelOneAuth } = require('./angelOneAuth');

/**
 * Angel One WebSocket Service for Real-time Market Data
 * Handles WebSocket connection with proper authentication using feed token
 */
class AngelOneWebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.subscriptions = new Set();
    this.messageHandlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
    this.heartbeatInterval = null;
    
    // WebSocket endpoint
    this.wsUrl = 'wss://smartapisocket.angelone.in/smart-stream';
  }

  /**
   * Connect to Angel One WebSocket
   */
  async connect() {
    try {
      // Ensure we have valid authentication
      const tokens = await angelOneAuth.getTokens();
      
      if (!tokens.feedToken) {
        throw new Error('Feed token not available. Please login first.');
      }

      console.log('Connecting to Angel One WebSocket...');

      this.ws = new WebSocket(this.wsUrl, {
        headers: {
          'Authorization': `Bearer ${tokens.jwtToken}`,
          'x-api-key': tokens.feedToken,
          'x-client-code': process.env.ANGELONE_CLIENT_CODE,
          'x-feed-token': tokens.feedToken
        }
      });

      this.setupEventHandlers();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.ws.once('open', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('Angel One WebSocket connected successfully');
          this.startHeartbeat();
          resolve();
        });

        this.ws.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      console.error('WebSocket connection error:', error.message);
      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.ws.on('open', () => {
      console.log('WebSocket connection opened');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed: ${code} - ${reason}`);
      this.isConnected = false;
      this.stopHeartbeat();
      
      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
      this.isConnected = false;
    });

    this.ws.on('pong', () => {
      console.log('Received pong from server');
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    console.log('Received WebSocket message:', message);

    // Handle different message types
    switch (message.type) {
      case 'connection':
        this.handleConnectionMessage(message);
        break;
      case 'feed':
        this.handleFeedMessage(message);
        break;
      case 'error':
        this.handleErrorMessage(message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }

    // Notify registered handlers
    for (const [type, handler] of this.messageHandlers) {
      if (type === 'all' || type === message.type) {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in message handler for type ${type}:`, error.message);
        }
      }
    }
  }

  /**
   * Handle connection status messages
   */
  handleConnectionMessage(message) {
    console.log('Connection status:', message.data);
  }

  /**
   * Handle market data feed messages
   */
  handleFeedMessage(message) {
    console.log('Market data feed:', message.data);
  }

  /**
   * Handle error messages
   */
  handleErrorMessage(message) {
    console.error('WebSocket error message:', message.data);
  }

  /**
   * Subscribe to market data for symbols
   */
  async subscribe(mode, exchangeType, tokens) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected. Call connect() first.');
    }

    const subscribeMessage = {
      action: 1, // Subscribe action
      mode: mode, // 1=LTP, 2=Quote, 3=SnapQuote
      exchangeType: exchangeType, // 1=NSE_CM, 2=NSE_FO, etc.
      tokens: Array.isArray(tokens) ? tokens : [tokens]
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    
    // Track subscriptions
    tokens.forEach(token => {
      this.subscriptions.add(`${exchangeType}:${token}`);
    });

    console.log(`Subscribed to ${tokens.length} symbols on exchange ${exchangeType}`);
  }

  /**
   * Unsubscribe from market data
   */
  async unsubscribe(exchangeType, tokens) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const unsubscribeMessage = {
      action: 0, // Unsubscribe action
      mode: 1,
      exchangeType: exchangeType,
      tokens: Array.isArray(tokens) ? tokens : [tokens]
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    
    // Remove from subscriptions
    tokens.forEach(token => {
      this.subscriptions.delete(`${exchangeType}:${token}`);
    });

    console.log(`Unsubscribed from ${tokens.length} symbols on exchange ${exchangeType}`);
  }

  /**
   * Register a message handler
   */
  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Remove a message handler
   */
  offMessage(type) {
    this.messageHandlers.delete(type);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connect();
        
        // Re-subscribe to previous subscriptions
        if (this.subscriptions.size > 0) {
          console.log('Re-subscribing to previous subscriptions');
          // Group subscriptions by exchange type and re-subscribe
          const subscriptionsByExchange = {};
          for (const subscription of this.subscriptions) {
            const [exchangeType, token] = subscription.split(':');
            if (!subscriptionsByExchange[exchangeType]) {
              subscriptionsByExchange[exchangeType] = [];
            }
            subscriptionsByExchange[exchangeType].push(token);
          }
          
          for (const [exchangeType, tokens] of Object.entries(subscriptionsByExchange)) {
            await this.subscribe(1, parseInt(exchangeType), tokens);
          }
        }
        
      } catch (error) {
        console.error('Reconnection failed:', error.message);
      }
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.stopHeartbeat();
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.subscriptions.clear();
      console.log('WebSocket disconnected');
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      subscriptions: Array.from(this.subscriptions),
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Send custom message
   */
  sendMessage(message) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    
    this.ws.send(JSON.stringify(message));
  }
}

// Export singleton instance
const angelOneWebSocket = new AngelOneWebSocketService();

module.exports = {
  AngelOneWebSocketService,
  angelOneWebSocket
};

