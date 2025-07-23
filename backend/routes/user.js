const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Alert = require('../models/Alert');
const APIConfig = require('../models/APIConfig');

const router = express.Router();

// @route   GET /api/user/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's portfolio summary
    const portfolios = await Portfolio.find({ userId, isActive: true });
    const portfolioSummary = {
      totalPortfolios: portfolios.length,
      totalInvested: portfolios.reduce((sum, p) => sum + p.totalInvested, 0),
      currentValue: portfolios.reduce((sum, p) => sum + p.currentValue, 0),
      totalPnL: portfolios.reduce((sum, p) => sum + p.totalPnL, 0),
      totalPositions: portfolios.reduce((sum, p) => sum + p.positions.length, 0)
    };
    portfolioSummary.totalPnLPercent = portfolioSummary.totalInvested > 0 ? 
      (portfolioSummary.totalPnL / portfolioSummary.totalInvested) * 100 : 0;

    // Get alert summary
    const alertStats = await Alert.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const alertSummary = {
      total: 0,
      active: 0,
      triggered: 0,
      acknowledged: 0
    };

    alertStats.forEach(stat => {
      alertSummary[stat._id] = stat.count;
      alertSummary.total += stat.count;
    });

    // Get API configuration summary
    const apiStats = await APIConfig.aggregate([
      { $match: { userId: req.user._id, isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const apiSummary = {
      total: 0,
      connected: 0,
      disconnected: 0,
      error: 0
    };

    apiStats.forEach(stat => {
      apiSummary[stat._id] = stat.count;
      apiSummary.total += stat.count;
    });

    // Get recent activity (last 10 portfolio updates)
    const recentActivity = await Portfolio.find({ userId, isActive: true })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('name updatedAt totalPnL totalPnLPercent');

    res.json({
      status: 'success',
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          lastLogin: req.user.lastLogin
        },
        portfolio: portfolioSummary,
        alerts: alertSummary,
        apis: apiSummary,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data'
    });
  }
});

// @route   PUT /api/user/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', [
  body('theme').optional().isIn(['light', 'dark']),
  body('notifications.email').optional().isBoolean(),
  body('notifications.push').optional().isBoolean(),
  body('notifications.sms').optional().isBoolean(),
  body('defaultCurrency').optional().isLength({ min: 3, max: 3 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const updates = {};
    if (req.body.theme) updates['preferences.theme'] = req.body.theme;
    if (req.body.notifications) {
      if (req.body.notifications.email !== undefined) {
        updates['preferences.notifications.email'] = req.body.notifications.email;
      }
      if (req.body.notifications.push !== undefined) {
        updates['preferences.notifications.push'] = req.body.notifications.push;
      }
      if (req.body.notifications.sms !== undefined) {
        updates['preferences.notifications.sms'] = req.body.notifications.sms;
      }
    }
    if (req.body.defaultCurrency) {
      updates['preferences.defaultCurrency'] = req.body.defaultCurrency;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      status: 'success',
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update preferences'
    });
  }
});

// @route   GET /api/user/activity
// @desc    Get user activity log
// @access  Private
router.get('/activity', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get recent portfolio activities
    const portfolioActivities = await Portfolio.find({ 
      userId: req.user.id, 
      isActive: true 
    })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('name updatedAt totalPnL totalPnLPercent positions');

    // Get recent alert activities
    const alertActivities = await Alert.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('symbol condition targetValue status triggeredAt');

    // Combine and format activities
    const activities = [];

    portfolioActivities.forEach(portfolio => {
      activities.push({
        type: 'portfolio_update',
        title: `Portfolio "${portfolio.name}" updated`,
        description: `P&L: ₹${portfolio.totalPnL.toFixed(2)} (${portfolio.totalPnLPercent.toFixed(2)}%)`,
        timestamp: portfolio.updatedAt,
        data: {
          portfolioId: portfolio._id,
          portfolioName: portfolio.name,
          positionsCount: portfolio.positions.length
        }
      });
    });

    alertActivities.forEach(alert => {
      if (alert.status === 'triggered') {
        activities.push({
          type: 'alert_triggered',
          title: `Alert triggered for ${alert.symbol}`,
          description: `${alert.symbol} ${alert.condition} ${alert.targetValue}`,
          timestamp: alert.triggeredAt || alert.updatedAt,
          data: {
            alertId: alert._id,
            symbol: alert.symbol,
            condition: alert.condition,
            targetValue: alert.targetValue
          }
        });
      }
    });

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      status: 'success',
      data: {
        activities: activities.slice(0, parseInt(limit)),
        pagination: {
          current: parseInt(page),
          count: activities.length
        }
      }
    });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user activity'
    });
  }
});

// @route   GET /api/user/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Portfolio stats
    const portfolioStats = await Portfolio.aggregate([
      { $match: { userId: req.user._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalPortfolios: { $sum: 1 },
          totalInvested: { $sum: '$totalInvested' },
          currentValue: { $sum: '$currentValue' },
          totalPnL: { $sum: '$totalPnL' },
          avgPnLPercent: { $avg: '$totalPnLPercent' }
        }
      }
    ]);

    // Alert stats
    const alertStats = await Alert.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent alerts (last 30 days)
    const recentAlerts = await Alert.countDocuments({
      userId: req.user.id,
      createdAt: { $gte: thirtyDaysAgo }
    });

    // API usage stats
    const apiUsageStats = await APIConfig.aggregate([
      { $match: { userId: req.user._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalAPIs: { $sum: 1 },
          totalRequests: { $sum: '$usage.totalRequests' },
          requestsToday: { $sum: '$usage.requestsToday' },
          avgLatency: { $avg: '$latency' }
        }
      }
    ]);

    const stats = {
      portfolio: portfolioStats[0] || {
        totalPortfolios: 0,
        totalInvested: 0,
        currentValue: 0,
        totalPnL: 0,
        avgPnLPercent: 0
      },
      alerts: {
        total: alertStats.reduce((sum, stat) => sum + stat.count, 0),
        byStatus: alertStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        recentAlerts
      },
      apiUsage: apiUsageStats[0] || {
        totalAPIs: 0,
        totalRequests: 0,
        requestsToday: 0,
        avgLatency: 0
      },
      accountAge: Math.floor((new Date() - req.user.createdAt) / (1000 * 60 * 60 * 24)), // days
      lastLogin: req.user.lastLogin
    };

    res.json({
      status: 'success',
      data: { stats }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user statistics'
    });
  }
});

// @route   DELETE /api/user/account
// @desc    Delete user account
// @access  Private
router.delete('/account', [
  body('password').exists().withMessage('Password is required for account deletion')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { password } = req.body;
    const user = await User.findById(req.user.id);

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid password'
      });
    }

    // Soft delete user and related data
    await Promise.all([
      User.findByIdAndUpdate(req.user.id, { isActive: false }),
      Portfolio.updateMany({ userId: req.user.id }, { isActive: false }),
      Alert.updateMany({ userId: req.user.id }, { isActive: false }),
      APIConfig.updateMany({ userId: req.user.id }, { isActive: false })
    ]);

    res.json({
      status: 'success',
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete account'
    });
  }
});

module.exports = router;