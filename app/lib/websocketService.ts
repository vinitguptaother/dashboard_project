import { io, Socket } from 'socket.io-client';
import { AuthClient } from './apiService';

export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface MarketDataUpdate {
  [symbol: string]: {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: string;
  };
}

export interface PortfolioUpdate {
  totalValue: number;
  totalChange: number;
  totalChangePercent: number;
  positions: any[];
  timestamp: string;
}

export interface AlertUpdate {
  _id: string;
  symbol: string;
  condition: string;
  targetValue: number;
  currentValue: number;
  status: string;
  timestamp: string;
}

export interface NotificationUpdate {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
}

export interface TradingSignalsUpdate {
  symbol: string;
  data: {
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reason: string;
    technicalIndicators: any;
  };
  timestamp: string;
}

export interface ScreenerUpdate {
  data: {
    stocks: any[];
    statistics: any;
  };
  timestamp: string;
}

export interface AIAnalysisUpdate {
  data: {
    marketSentiment: any;
    predictions: any[];
    recommendations: any[];
    patterns: any[];
  };
  timestamp: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private subscriptions: Set<string> = new Set();

  constructor() {
    this.setupEventListeners();
  }

  // Connect to WebSocket server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        resolve();
        return;
      }

      const token = AuthClient.token;
      if (!token) {
        reject(new Error('No authentication token available'));
        return;
      }

      const serverUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5002';

      this.socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.resubscribeAll();
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        this.isConnected = false;
        
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          this.socket?.connect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Setup event handlers
      this.setupSocketEventHandlers();
    });
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.subscriptions.clear();
    }
  }

  // Subscribe to market data updates
  subscribeMarketData(symbols: string[]): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('subscribe_market_data', symbols);
    symbols.forEach(symbol => {
      this.subscriptions.add(`market_${symbol.toUpperCase()}`);
    });
  }

  // Unsubscribe from market data updates
  unsubscribeMarketData(symbols: string[]): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('unsubscribe_market_data', symbols);
    symbols.forEach(symbol => {
      this.subscriptions.delete(`market_${symbol.toUpperCase()}`);
    });
  }

  // Subscribe to portfolio updates
  subscribePortfolio(): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('subscribe_portfolio');
    this.subscriptions.add('portfolio');
  }

  // Subscribe to alerts
  subscribeAlerts(): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('subscribe_alerts');
    this.subscriptions.add('alerts');
  }

  // Subscribe to news updates
  subscribeNews(categories: string[]): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('subscribe_news', categories);
    categories.forEach(category => {
      this.subscriptions.add(`news_${category}`);
    });
  }

  // Subscribe to trading signals
  subscribeTradingSignals(symbols: string[]): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('subscribe_trading_signals', symbols);
    symbols.forEach(symbol => {
      this.subscriptions.add(`trading_signals_${symbol.toUpperCase()}`);
    });
  }

  // Subscribe to screener updates
  subscribeScreener(filters: any): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('subscribe_screener', filters);
    this.subscriptions.add('screener');
  }

  // Subscribe to AI analysis updates
  subscribeAIAnalysis(): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('subscribe_ai_analysis');
    this.subscriptions.add('ai_analysis');
  }

  // Subscribe to notifications
  subscribeNotifications(): void {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('subscribe_notifications');
    this.subscriptions.add('notifications');
  }

  // Add event listener
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  // Remove event listener
  off(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  // Emit event to server
  emit(event: string, data?: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }

  // Get connection status
  getConnectionStatus(): { connected: boolean; subscriptions: string[] } {
    return {
      connected: this.isConnected,
      subscriptions: Array.from(this.subscriptions)
    };
  }

  // Setup socket event handlers
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Market data updates
    this.socket.on('market_data_update', (data: MarketDataUpdate) => {
      this.triggerEvent('market_data_update', data);
    });

    // Portfolio updates
    this.socket.on('portfolio_update', (data: PortfolioUpdate) => {
      this.triggerEvent('portfolio_update', data);
    });

    // Alert updates
    this.socket.on('alert_triggered', (data: AlertUpdate) => {
      this.triggerEvent('alert_triggered', data);
    });

    // News updates
    this.socket.on('news_update', (data: any) => {
      this.triggerEvent('news_update', data);
    });

    // Trading signals updates
    this.socket.on('trading_signals_update', (data: TradingSignalsUpdate) => {
      this.triggerEvent('trading_signals_update', data);
    });

    // Screener updates
    this.socket.on('screener_update', (data: ScreenerUpdate) => {
      this.triggerEvent('screener_update', data);
    });

    // AI analysis updates
    this.socket.on('ai_analysis_update', (data: AIAnalysisUpdate) => {
      this.triggerEvent('ai_analysis_update', data);
    });

    // Notifications
    this.socket.on('notification', (data: NotificationUpdate) => {
      this.triggerEvent('notification', data);
    });

    // System notifications
    this.socket.on('system_notification', (data: NotificationUpdate) => {
      this.triggerEvent('system_notification', data);
    });

    // Connection health
    this.socket.on('pong', (data: { timestamp: number }) => {
      this.triggerEvent('pong', data);
    });
  }

  // Setup event listeners
  private setupEventListeners(): void {
    // Auto-reconnect when token changes
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'authToken' && e.newValue) {
          // Token updated, reconnect with new token
          this.reconnectWithNewToken();
        }
      });
    }
  }

  // Reconnect with new token
  private async reconnectWithNewToken(): Promise<void> {
    if (this.socket) {
      this.disconnect();
      await this.connect();
    }
  }

  // Resubscribe to all previous subscriptions
  private resubscribeAll(): void {
    // This would need to be implemented based on stored subscription state
    // For now, we'll just log that reconnection happened
    console.log('WebSocket reconnected, resubscribing to:', Array.from(this.subscriptions));
  }

  // Trigger event to all listeners
  private triggerEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error: any) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  // Send ping to check connection health
  ping(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('ping');
    }
  }

  // Start periodic ping
  startPing(interval: number = 30000): void {
    setInterval(() => {
      this.ping();
    }, interval);
  }
}

// Create singleton instance
export const websocketService = new WebSocketService();

// Auto-connect when service is imported (if in browser)
if (typeof window !== 'undefined') {
  // Connect when user is authenticated
  const checkAndConnect = () => {
    try {
      if (AuthClient.token && !websocketService.getConnectionStatus().connected) {
        websocketService.connect().catch(error => {
          console.warn('WebSocket connection failed:', error.message);
          // Don't throw the error, just log it
        });
      }
    } catch (error: any) {
      console.warn('Failed to check WebSocket connection status:', error.message);
    }
  };

  // Delay initial connection check to allow for proper initialization
  setTimeout(() => {
    checkAndConnect();
  }, 1000);

  // Check when token changes
  window.addEventListener('storage', (e) => {
    if (e.key === 'authToken' || e.key === 'auth_token') {
      checkAndConnect();
    }
  });
}
