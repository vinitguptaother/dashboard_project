// Alert Service - Manages price alerts and notifications
export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
  message: string;
}

export interface Notification {
  id: string;
  type: 'price_alert' | 'news' | 'portfolio' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  data?: any;
}

class AlertService {
  private alerts: PriceAlert[] = [];
  private notifications: Notification[] = [];
  private subscribers: ((notifications: Notification[]) => void)[] = [];
  private currentPrices: { [symbol: string]: number } = {};

  constructor() {
    this.loadFromStorage();
  }

  // Subscribe to notifications
  subscribe(callback: (notifications: Notification[]) => void) {
    this.subscribers.push(callback);
    callback(this.notifications);
  }

  unsubscribe(callback: (notifications: Notification[]) => void) {
    this.subscribers = this.subscribers.filter(sub => sub !== callback);
  }

  // Create price alert
  createPriceAlert(symbol: string, targetPrice: number, condition: 'above' | 'below'): PriceAlert {
    const alert: PriceAlert = {
      id: Date.now().toString(),
      symbol,
      targetPrice,
      condition,
      isActive: true,
      createdAt: new Date(),
      message: `Alert when ${symbol} goes ${condition} ₹${targetPrice}`
    };

    this.alerts.push(alert);
    this.saveToStorage();
    
    // Create notification for alert creation
    this.addNotification({
      type: 'price_alert',
      title: 'Price Alert Created',
      message: `Alert set for ${symbol} ${condition} ₹${targetPrice}`,
      data: { alertId: alert.id }
    });

    return alert;
  }

  // Update current prices and check alerts
  updatePrices(prices: { [symbol: string]: number }) {
    this.currentPrices = { ...this.currentPrices, ...prices };
    this.checkAlerts();
  }

  private checkAlerts() {
    this.alerts.forEach(alert => {
      if (!alert.isActive || alert.triggeredAt) return;

      const currentPrice = this.currentPrices[alert.symbol];
      if (!currentPrice) return;

      let shouldTrigger = false;
      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        shouldTrigger = true;
      } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        alert.triggeredAt = new Date();
        alert.isActive = false;

        this.addNotification({
          type: 'price_alert',
          title: 'Price Alert Triggered!',
          message: `${alert.symbol} is now ₹${currentPrice} (${alert.condition} ₹${alert.targetPrice})`,
          data: { 
            alertId: alert.id, 
            symbol: alert.symbol, 
            currentPrice, 
            targetPrice: alert.targetPrice 
          }
        });

        this.saveToStorage();
      }
    });
  }

  // Add notification
  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) {
    const newNotification: Notification = {
      id: Date.now().toString(),
      timestamp: new Date(),
      isRead: false,
      ...notification
    };

    this.notifications.unshift(newNotification);
    
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }

    this.saveToStorage();
    this.notifySubscribers();
  }

  // Mark notification as read
  markAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      this.saveToStorage();
      this.notifySubscribers();
    }
  }

  // Mark all notifications as read
  markAllAsRead() {
    this.notifications.forEach(n => n.isRead = true);
    this.saveToStorage();
    this.notifySubscribers();
  }

  // Delete notification
  deleteNotification(notificationId: string) {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.saveToStorage();
    this.notifySubscribers();
  }

  // Delete alert
  deleteAlert(alertId: string) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.saveToStorage();
  }

  // Get active alerts
  getActiveAlerts(): PriceAlert[] {
    return this.alerts.filter(a => a.isActive);
  }

  // Get all alerts
  getAllAlerts(): PriceAlert[] {
    return this.alerts;
  }

  // Get unread notifications count
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alerts', JSON.stringify(this.alerts));
      localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      try {
        const storedAlerts = localStorage.getItem('alerts');
        if (storedAlerts) {
          this.alerts = JSON.parse(storedAlerts);
        }

        const storedNotifications = localStorage.getItem('notifications');
        if (storedNotifications) {
          this.notifications = JSON.parse(storedNotifications);
        }
      } catch (error) {
        console.error('Error loading alerts/notifications from storage:', error);
      }
    }
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.notifications));
  }
}

export const alertService = new AlertService();