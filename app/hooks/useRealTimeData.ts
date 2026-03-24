'use client';

import { useState, useEffect } from 'react';
import { stockDataService, MarketData, NewsItem } from '../lib/stockDataService';
import { portfolioService, Portfolio } from '../lib/portfolioService';
import { alertService, Notification } from '../lib/alertService';
import { AlertClient, AuthClient } from '../lib/apiService';

// Hook for real-time market data
export const useMarketData = () => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleDataUpdate = (data: MarketData) => {
      setMarketData(data);
      setIsLoading(false);
      
      // Update alert service with new prices
      const prices = {
        'NIFTY': data.nifty.price,
        'SENSEX': data.sensex.price,
        'BANKNIFTY': data.bankNifty.price
      };
      alertService.updatePrices(prices);
    };

    stockDataService.subscribe(handleDataUpdate);
    stockDataService.startRealTimeUpdates();

    return () => {
      stockDataService.unsubscribe(handleDataUpdate);
      stockDataService.stopRealTimeUpdates();
    };
  }, []);

  return { marketData, isLoading };
};

// Hook for real-time news
export const useNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleNewsUpdate = (newsData: NewsItem[]) => {
      setNews(newsData);
      setIsLoading(false);
    };

    stockDataService.subscribeToNews(handleNewsUpdate);

    return () => {
      stockDataService.unsubscribeFromNews(handleNewsUpdate);
    };
  }, []);

  return { news, isLoading };
};

// Hook for portfolio management
export const usePortfolios = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handlePortfolioUpdate = (portfolioData: Portfolio[]) => {
      setPortfolios(portfolioData);
      setIsLoading(false);
    };

    portfolioService.subscribe(handlePortfolioUpdate);

    return () => {
      portfolioService.unsubscribe(handlePortfolioUpdate);
    };
  }, []);

  const createPortfolio = (name: string, description: string) => {
    return portfolioService.createPortfolio(name, description);
  };

  const addPosition = (portfolioId: string, symbol: string, quantity: number, price: number) => {
    return portfolioService.addPosition(portfolioId, symbol, quantity, price);
  };

  const removePosition = (portfolioId: string, positionId: string) => {
    return portfolioService.removePosition(portfolioId, positionId);
  };

  const updatePosition = (portfolioId: string, positionId: string, quantity: number, price?: number) => {
    return portfolioService.updatePosition(portfolioId, positionId, quantity, price);
  };

  const deletePortfolio = (portfolioId: string) => {
    return portfolioService.deletePortfolio(portfolioId);
  };

  return {
    portfolios,
    isLoading,
    createPortfolio,
    addPosition,
    removePosition,
    updatePosition,
    deletePortfolio
  };
};

// Hook for notifications and alerts
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleNotificationUpdate = (notificationData: Notification[]) => {
      setNotifications(notificationData);
      setUnreadCount(alertService.getUnreadCount());
    };

    alertService.subscribe(handleNotificationUpdate);

    return () => {
      alertService.unsubscribe(handleNotificationUpdate);
    };
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const json = await AlertClient.list();
      if (json.status === 'success') {
        setAlerts(json.data.alerts || []);
        console.log('✅ Successfully loaded alerts from backend');
      } else {
        console.warn('⚠️  Alert loading returned error status:', json.message);
        setAlerts([]);
      }
    } catch (error: any) {
      console.warn('⚠️  Failed to load alerts, using empty list:', error instanceof Error ? error.message : error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Add small delay to allow backend to be ready
    const timeoutId = setTimeout(() => {
      loadAlerts();
    }, 1500); // Wait 1.5 seconds for backend initialization
    
    return () => clearTimeout(timeoutId);
  }, []);

  const createPriceAlert = async (symbol: string, targetPrice: number, condition: 'above' | 'below') => {
    
    try {
      const json = await AlertClient.create({
        symbol: symbol.toUpperCase(),
        condition,
        targetValue: targetPrice,
        alertType: 'price',
        message: `${symbol} ${condition} ${targetPrice}`
      });
      
      if (json.status === 'success') {
        await loadAlerts();
        return true;
      }
    } catch (error: any) {
      console.error('Failed to create alert:', error);
    }
    return false;
  };

  const updateAlert = async (id: string, updates: any) => {
    try {
      const json = await AlertClient.update(id, updates);
      if (json.status === 'success') {
        await loadAlerts();
        return true;
      }
    } catch (error: any) {
      console.error('Failed to update alert:', error);
    }
    return false;
  };

  const deleteAlert = async (id: string) => {
    try {
      const json = await AlertClient.delete(id);
      if (json.status === 'success') {
        await loadAlerts();
        return true;
      }
    } catch (error: any) {
      console.error('Failed to delete alert:', error);
    }
    return false;
  };

  const acknowledgeAlert = async (id: string) => {
    try {
      const json = await AlertClient.acknowledge(id);
      if (json.status === 'success') {
        await loadAlerts();
        return true;
      }
    } catch (error: any) {
      console.error('Failed to acknowledge alert:', error);
    }
    return false;
  };

  const markAsRead = (notificationId: string) => {
    alertService.markAsRead(notificationId);
  };

  const markAllAsRead = () => {
    alertService.markAllAsRead();
  };

  const deleteNotification = (notificationId: string) => {
    alertService.deleteNotification(notificationId);
  };

  return {
    notifications,
    unreadCount,
    alerts,
    loading,
    createPriceAlert,
    updateAlert,
    deleteAlert,
    acknowledgeAlert,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadAlerts
  };
};

// Hook for stock search
export const useStockSearch = () => {
  const [isLoading, setIsLoading] = useState(false);

  const searchStocks = async (query: string) => {
    setIsLoading(true);
    try {
      const results = await stockDataService.searchStocks(query);
      return results;
    } finally {
      setIsLoading(false);
    }
  };

  const getStockDetails = async (symbol: string) => {
    setIsLoading(true);
    try {
      const details = await stockDataService.getStockDetails(symbol);
      return details;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    searchStocks,
    getStockDetails,
    isLoading
  };
};