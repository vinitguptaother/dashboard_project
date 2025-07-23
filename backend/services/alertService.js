const Alert = require('../models/Alert');
const MarketData = require('../models/MarketData');
const User = require('../models/User');
const { apiLogger } = require('../middleware/logger');
const nodemailer = require('nodemailer');

class AlertService {
  constructor() {
    this.emailTransporter = null;
    this.initializeEmailTransporter();
  }

  // Initialize email transporter
  initializeEmailTransporter() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }
  }

  // Create price alert
  async createPriceAlert(userId, symbol, condition, targetValue, message) {
    try {
      const alert = new Alert({
        userId,
        symbol: symbol.toUpperCase(),
        alertType: 'price',
        condition,
        targetValue,
        message,
        priority: this.calculatePriority(condition, targetValue)
      });

      await alert.save();
      
      apiLogger.info('AlertService', 'createPriceAlert', {
        userId,
        symbol,
        condition,
        targetValue
      });

      return alert;
    } catch (error) {
      apiLogger.error('AlertService', 'createPriceAlert', error, {
        userId,
        symbol,
        condition,
        targetValue
      });
      throw error;
    }
  }

  // Create volume alert
  async createVolumeAlert(userId, symbol, condition, targetValue, message) {
    try {
      const alert = new Alert({
        userId,
        symbol: symbol.toUpperCase(),
        alertType: 'volume',
        condition,
        targetValue,
        message
      });

      await alert.save();
      return alert;
    } catch (error) {
      apiLogger.error('AlertService', 'createVolumeAlert', error);
      throw error;
    }
  }

  // Create percentage change alert
  async createChangePercentAlert(userId, symbol, condition, targetValue, message) {
    try {
      const alert = new Alert({
        userId,
        symbol: symbol.toUpperCase(),
        alertType: 'change_percent',
        condition,
        targetValue,
        message
      });

      await alert.save();
      return alert;
    } catch (error) {
      apiLogger.error('AlertService', 'createChangePercentAlert', error);
      throw error;
    }
  }

  // Get user alerts
  async getUserAlerts(userId, options = {}) {
    try {
      const { isActive = true, limit = 50, page = 1 } = options;
      const skip = (page - 1) * limit;

      const query = { userId };
      if (isActive !== null) {
        query.isActive = isActive;
      }

      const alerts = await Alert.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Alert.countDocuments(query);

      return {
        alerts,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          count: alerts.length,
          totalItems: total
        }
      };
    } catch (error) {
      apiLogger.error('AlertService', 'getUserAlerts', error, { userId });
      throw error;
    }
  }

  // Update alert
  async updateAlert(alertId, userId, updates) {
    try {
      const alert = await Alert.findOneAndUpdate(
        { _id: alertId, userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!alert) {
        throw new Error('Alert not found');
      }

      return alert;
    } catch (error) {
      apiLogger.error('AlertService', 'updateAlert', error, { alertId, userId });
      throw error;
    }
  }

  // Delete alert
  async deleteAlert(alertId, userId) {
    try {
      const alert = await Alert.findOneAndUpdate(
        { _id: alertId, userId },
        { isActive: false },
        { new: true }
      );

      if (!alert) {
        throw new Error('Alert not found');
      }

      return alert;
    } catch (error) {
      apiLogger.error('AlertService', 'deleteAlert', error, { alertId, userId });
      throw error;
    }
  }

  // Check alerts against current market data
  async checkAlerts() {
    try {
      const activeAlerts = await Alert.find({
        isActive: true,
        isTriggered: false,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      if (activeAlerts.length === 0) {
        return { checked: 0, triggered: 0 };
      }

      // Get unique symbols
      const symbols = [...new Set(activeAlerts.map(alert => alert.symbol))];
      
      // Get current market data for all symbols
      const marketDataList = await MarketData.getMultiple(symbols);
      const marketDataMap = {};
      
      marketDataList.forEach(data => {
        marketDataMap[data.symbol] = data;
      });

      let triggeredCount = 0;

      // Check each alert
      for (const alert of activeAlerts) {
        const marketData = marketDataMap[alert.symbol];
        if (!marketData) continue;

        let currentValue;
        let shouldTrigger = false;

        // Get current value based on alert type
        switch (alert.alertType) {
          case 'price':
            currentValue = marketData.price;
            break;
          case 'volume':
            currentValue = marketData.volume;
            break;
          case 'change_percent':
            currentValue = marketData.changePercent;
            break;
          default:
            continue;
        }

        // Check if alert condition is met
        switch (alert.condition) {
          case 'above':
            shouldTrigger = currentValue > alert.targetValue;
            break;
          case 'below':
            shouldTrigger = currentValue < alert.targetValue;
            break;
          case 'equals':
            shouldTrigger = Math.abs(currentValue - alert.targetValue) < 0.01;
            break;
        }

        if (shouldTrigger) {
          // Update alert as triggered
          alert.isTriggered = true;
          alert.triggeredAt = new Date();
          alert.currentValue = currentValue;
          await alert.save();

          // Send notification
          await this.sendAlertNotification(alert);
          triggeredCount++;

          apiLogger.info('AlertService', 'alertTriggered', {
            alertId: alert._id,
            symbol: alert.symbol,
            alertType: alert.alertType,
            condition: alert.condition,
            targetValue: alert.targetValue,
            currentValue
          });
        } else {
          // Update current value for tracking
          alert.currentValue = currentValue;
          await alert.save();
        }
      }

      return { checked: activeAlerts.length, triggered: triggeredCount };

    } catch (error) {
      apiLogger.error('AlertService', 'checkAlerts', error);
      throw error;
    }
  }

  // Send alert notification
  async sendAlertNotification(alert) {
    try {
      const user = await User.findById(alert.userId);
      if (!user) return;

      // Send email notification if configured
      if (this.emailTransporter && user.preferences.notifications.email) {
        await this.sendEmailNotification(user, alert);
      }

      // Here you could add other notification methods like:
      // - Push notifications
      // - SMS notifications
      // - Webhook notifications

    } catch (error) {
      apiLogger.error('AlertService', 'sendAlertNotification', error, {
        alertId: alert._id
      });
    }
  }

  // Send email notification
  async sendEmailNotification(user, alert) {
    try {
      const subject = `Stock Alert: ${alert.symbol} - ${alert.message}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Stock Alert Triggered</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1e293b;">${alert.symbol}</h3>
            <p style="margin: 5px 0;"><strong>Alert Type:</strong> ${alert.alertType.replace('_', ' ').toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Condition:</strong> ${alert.condition.toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Target Value:</strong> ${alert.targetValue}</p>
            <p style="margin: 5px 0;"><strong>Current Value:</strong> ${alert.currentValue}</p>
            <p style="margin: 5px 0;"><strong>Message:</strong> ${alert.message}</p>
            <p style="margin: 5px 0;"><strong>Triggered At:</strong> ${alert.triggeredAt.toLocaleString()}</p>
          </div>
          <p style="color: #64748b; font-size: 14px;">
            This alert was automatically generated by your Stock Dashboard.
          </p>
        </div>
      `;

      await this.emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject,
        html
      });

      // Mark notification as sent
      alert.notificationSent = true;
      await alert.save();

      apiLogger.info('AlertService', 'emailSent', {
        userId: user._id,
        email: user.email,
        alertId: alert._id
      });

    } catch (error) {
      apiLogger.error('AlertService', 'sendEmailNotification', error, {
        userId: user._id,
        alertId: alert._id
      });
    }
  }

  // Calculate alert priority
  calculatePriority(condition, targetValue) {
    // Simple priority calculation based on target value
    if (targetValue > 1000) return 'high';
    if (targetValue > 100) return 'medium';
    return 'low';
  }

  // Get alert statistics
  async getAlertStats(userId) {
    try {
      const stats = await Alert.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$isActive', 1, 0] } },
            triggered: { $sum: { $cond: ['$isTriggered', 1, 0] } },
            pending: { 
              $sum: { 
                $cond: [
                  { $and: ['$isActive', { $not: '$isTriggered' }] }, 
                  1, 
                  0
                ] 
              } 
            }
          }
        }
      ]);

      return stats[0] || { total: 0, active: 0, triggered: 0, pending: 0 };
    } catch (error) {
      apiLogger.error('AlertService', 'getAlertStats', error, { userId });
      throw error;
    }
  }

  // Clean up expired alerts
  async cleanupExpiredAlerts() {
    try {
      const result = await Alert.updateMany(
        {
          expiresAt: { $lt: new Date() },
          isActive: true
        },
        {
          isActive: false
        }
      );

      apiLogger.info('AlertService', 'cleanupExpiredAlerts', {
        deactivated: result.modifiedCount
      });

      return result.modifiedCount;
    } catch (error) {
      apiLogger.error('AlertService', 'cleanupExpiredAlerts', error);
      throw error;
    }
  }
}

module.exports = new AlertService();