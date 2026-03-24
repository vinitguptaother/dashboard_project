import { useEffect, useCallback, useRef } from 'react';
import { websocketService, MarketDataUpdate, PortfolioUpdate, AlertUpdate, NotificationUpdate, TradingSignalsUpdate, ScreenerUpdate, AIAnalysisUpdate } from '../lib/websocketService';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  autoReconnect?: boolean;
  pingInterval?: number;
}

export interface WebSocketStatus {
  connected: boolean;
  subscriptions: string[];
  lastPing?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    autoConnect = false, // Disabled until auth token is available
    autoReconnect = true,
    pingInterval = 30000
  } = options;

  const statusRef = useRef<WebSocketStatus>({
    connected: false,
    subscriptions: []
  });

  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      await websocketService.connect();
      statusRef.current.connected = true;
      
      if (pingInterval > 0) {
        pingIntervalRef.current = setInterval(() => {
          websocketService.ping();
          statusRef.current.lastPing = Date.now();
        }, pingInterval);
      }
    } catch (error: any) {
      console.warn('WebSocket connection failed:', error instanceof Error ? error.message : 'Unknown error');
      statusRef.current.connected = false;
      // Don't throw the error - let the component handle the disconnected state gracefully
    }
  }, [pingInterval]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    websocketService.disconnect();
    statusRef.current.connected = false;
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Subscribe to market data
  const subscribeMarketData = useCallback((symbols: string[]) => {
    websocketService.subscribeMarketData(symbols);
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Unsubscribe from market data
  const unsubscribeMarketData = useCallback((symbols: string[]) => {
    websocketService.unsubscribeMarketData(symbols);
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Subscribe to portfolio updates
  const subscribePortfolio = useCallback(() => {
    websocketService.subscribePortfolio();
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Subscribe to alerts
  const subscribeAlerts = useCallback(() => {
    websocketService.subscribeAlerts();
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Subscribe to news
  const subscribeNews = useCallback((categories: string[]) => {
    websocketService.subscribeNews(categories);
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Subscribe to trading signals
  const subscribeTradingSignals = useCallback((symbols: string[]) => {
    websocketService.subscribeTradingSignals(symbols);
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Subscribe to screener updates
  const subscribeScreener = useCallback((filters: any) => {
    websocketService.subscribeScreener(filters);
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Subscribe to AI analysis
  const subscribeAIAnalysis = useCallback(() => {
    websocketService.subscribeAIAnalysis();
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Subscribe to notifications
  const subscribeNotifications = useCallback(() => {
    websocketService.subscribeNotifications();
    statusRef.current.subscriptions = websocketService.getConnectionStatus().subscriptions;
  }, []);

  // Listen to market data updates
  const onMarketDataUpdate = useCallback((callback: (data: MarketDataUpdate) => void) => {
    websocketService.on('market_data_update', callback);
    return () => websocketService.off('market_data_update', callback);
  }, []);

  // Listen to portfolio updates
  const onPortfolioUpdate = useCallback((callback: (data: PortfolioUpdate) => void) => {
    websocketService.on('portfolio_update', callback);
    return () => websocketService.off('portfolio_update', callback);
  }, []);

  // Listen to alert updates
  const onAlertUpdate = useCallback((callback: (data: AlertUpdate) => void) => {
    websocketService.on('alert_triggered', callback);
    return () => websocketService.off('alert_triggered', callback);
  }, []);

  // Listen to news updates
  const onNewsUpdate = useCallback((callback: (data: any) => void) => {
    websocketService.on('news_update', callback);
    return () => websocketService.off('news_update', callback);
  }, []);

  // Listen to trading signals updates
  const onTradingSignalsUpdate = useCallback((callback: (data: TradingSignalsUpdate) => void) => {
    websocketService.on('trading_signals_update', callback);
    return () => websocketService.off('trading_signals_update', callback);
  }, []);

  // Listen to screener updates
  const onScreenerUpdate = useCallback((callback: (data: ScreenerUpdate) => void) => {
    websocketService.on('screener_update', callback);
    return () => websocketService.off('screener_update', callback);
  }, []);

  // Listen to AI analysis updates
  const onAIAnalysisUpdate = useCallback((callback: (data: AIAnalysisUpdate) => void) => {
    websocketService.on('ai_analysis_update', callback);
    return () => websocketService.off('ai_analysis_update', callback);
  }, []);

  // Listen to notifications
  const onNotification = useCallback((callback: (data: NotificationUpdate) => void) => {
    websocketService.on('notification', callback);
    return () => websocketService.off('notification', callback);
  }, []);

  // Listen to system notifications
  const onSystemNotification = useCallback((callback: (data: NotificationUpdate) => void) => {
    websocketService.on('system_notification', callback);
    return () => websocketService.off('system_notification', callback);
  }, []);

  // Get connection status
  const getStatus = useCallback((): WebSocketStatus => {
    const status = websocketService.getConnectionStatus();
    statusRef.current = status;
    return status;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      // Delay connection to allow for proper initialization
      const timeoutId = setTimeout(() => {
        connect().catch(() => {
          // Connection failed, but we'll continue with disconnected state
          console.info('WebSocket auto-connection failed, continuing without real-time updates');
        });
      }, 500);
      
      return () => {
        clearTimeout(timeoutId);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
      };
    }

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [autoConnect, connect]);

  // Auto-reconnect on disconnect
  useEffect(() => {
    if (!autoReconnect) return;

    const handleDisconnect = () => {
      statusRef.current.connected = false;
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (!statusRef.current.connected) {
          connect();
        }
      }, 1000);
    };

    websocketService.on('disconnect', handleDisconnect);
    return () => websocketService.off('disconnect', handleDisconnect);
  }, [autoReconnect, connect]);

  return {
    // Connection management
    connect,
    disconnect,
    getStatus,
    
    // Subscription methods
    subscribeMarketData,
    unsubscribeMarketData,
    subscribePortfolio,
    subscribeAlerts,
    subscribeNews,
    subscribeTradingSignals,
    subscribeScreener,
    subscribeAIAnalysis,
    subscribeNotifications,
    
    // Event listeners
    onMarketDataUpdate,
    onPortfolioUpdate,
    onAlertUpdate,
    onNewsUpdate,
    onTradingSignalsUpdate,
    onScreenerUpdate,
    onAIAnalysisUpdate,
    onNotification,
    onSystemNotification,
    
    // Status
    status: statusRef.current
  };
};

// Specialized hooks for specific features
export const useMarketDataWebSocket = (symbols: string[]) => {
  const { subscribeMarketData, unsubscribeMarketData, onMarketDataUpdate } = useWebSocket();

  useEffect(() => {
    if (symbols.length > 0) {
      subscribeMarketData(symbols);
      return () => unsubscribeMarketData(symbols);
    }
  }, [symbols, subscribeMarketData, unsubscribeMarketData]);

  return { onMarketDataUpdate };
};

export const usePortfolioWebSocket = () => {
  const { subscribePortfolio, onPortfolioUpdate } = useWebSocket();

  useEffect(() => {
    subscribePortfolio();
  }, [subscribePortfolio]);

  return { onPortfolioUpdate };
};

export const useAlertsWebSocket = () => {
  const { subscribeAlerts, onAlertUpdate } = useWebSocket();

  useEffect(() => {
    subscribeAlerts();
  }, [subscribeAlerts]);

  return { onAlertUpdate };
};

export const useTradingSignalsWebSocket = (symbols: string[]) => {
  const { subscribeTradingSignals, onTradingSignalsUpdate } = useWebSocket();

  useEffect(() => {
    if (symbols.length > 0) {
      subscribeTradingSignals(symbols);
    }
  }, [symbols, subscribeTradingSignals]);

  return { onTradingSignalsUpdate };
};

export const useScreenerWebSocket = (filters: any) => {
  const { subscribeScreener, onScreenerUpdate } = useWebSocket();

  useEffect(() => {
    if (filters) {
      subscribeScreener(filters);
    }
  }, [filters, subscribeScreener]);

  return { onScreenerUpdate };
};

export const useAIAnalysisWebSocket = () => {
  const { subscribeAIAnalysis, onAIAnalysisUpdate } = useWebSocket();

  useEffect(() => {
    subscribeAIAnalysis();
  }, [subscribeAIAnalysis]);

  return { onAIAnalysisUpdate };
};

export const useNotificationsWebSocket = () => {
  const { subscribeNotifications, onNotification, onSystemNotification } = useWebSocket();

  useEffect(() => {
    subscribeNotifications();
  }, [subscribeNotifications]);

  return { onNotification, onSystemNotification };
};
