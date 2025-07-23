const express = require('express');
const { body, validationResult } = require('express-validator');
const Alert = require('../models/Alert');
const MarketData = require('../models/MarketData');

const router = express.Router();

// @route   GET /api/alerts
// @desc    Get all alerts for user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status = 'all', limit = 50, page = 1 } = req.query;
    
    const query = { userId: req.user.id };
    if (status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Alert.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        alerts,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: alerts.length,
          totalItems: total
        }
      }
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch alerts'
    });
  }
});

// @route   POST /api/alerts
// @desc    Create new alert
// @access  Private
router.post('/', [
  body('symbol').trim().isLength({ min: 1 }).toUpperCase(),
  body('condition').isIn(['above', 'below', 'change_percent']),
  body('targetValue').isFloat({ min: 0 }),
  body('alertType').optional().isIn(['price', 'volume', 'change']),
  body('message').optional().trim().isLength({ max: 500 })
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

    const { symbol, condition, targetValue, alertType, message, isActive } = req.body;

    // Check if similar alert already exists
    const existingAlert = await Alert.findOne({
      userId: req.user.id,
      symbol,
      condition,
      targetValue,
      status: 'active'
    });

    if (existingAlert) {
      return res.status(400).json({
        status: 'error',
        message: 'Similar alert already exists'
      });
    }

    const alert = new Alert({
      userId: req.user.id,
      symbol,
      condition,
      targetValue,
      alertType: alertType || 'price',
      message: message || `${symbol} ${condition} ${targetValue}`,
      isActive: isActive !== false
    });

    await alert.save();

    res.status(201).json({
      status: 'success',
      message: 'Alert created successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create alert'
    });
  }
});

// @route   PUT /api/alerts/:id
// @desc    Update alert
// @access  Private
router.put('/:id', [
  body('condition').optional().isIn(['above', 'below', 'change_percent']),
  body('targetValue').optional().isFloat({ min: 0 }),
  body('message').optional().trim().isLength({ max: 500 }),
  body('isActive').optional().isBoolean()
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

    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!alert) {
      return res.status(404).json({
        status: 'error',
        message: 'Alert not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Alert updated successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update alert'
    });
  }
});

// @route   DELETE /api/alerts/:id
// @desc    Delete alert
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const alert = await Alert.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!alert) {
      return res.status(404).json({
        status: 'error',
        message: 'Alert not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete alert'
    });
  }
});

// @route   POST /api/alerts/check
// @desc    Check and trigger alerts (internal use)
// @access  Private
router.post('/check', async (req, res) => {
  try {
    const activeAlerts = await Alert.find({ 
      status: 'active',
      isActive: true 
    }).populate('userId', 'email firstName lastName preferences');

    if (activeAlerts.length === 0) {
      return res.json({
        status: 'success',
        message: 'No active alerts to check',
        data: { checked: 0, triggered: 0 }
      });
    }

    // Get unique symbols
    const symbols = [...new Set(activeAlerts.map(alert => alert.symbol))];
    
    // Get current market data
    const marketData = await MarketData.getMultiple(symbols);
    const priceMap = {};
    
    marketData.forEach(data => {
      priceMap[data.symbol] = {
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        volume: data.volume
      };
    });

    let triggeredCount = 0;
    const triggeredAlerts = [];

    // Check each alert
    for (const alert of activeAlerts) {
      const currentData = priceMap[alert.symbol];
      if (!currentData) continue;

      let shouldTrigger = false;
      let currentValue = currentData.price;

      // Determine current value based on alert type
      switch (alert.alertType) {
        case 'volume':
          currentValue = currentData.volume;
          break;
        case 'change':
          currentValue = Math.abs(currentData.changePercent);
          break;
        default: // price
          currentValue = currentData.price;
      }

      // Check condition
      switch (alert.condition) {
        case 'above':
          shouldTrigger = currentValue >= alert.targetValue;
          break;
        case 'below':
          shouldTrigger = currentValue <= alert.targetValue;
          break;
        case 'change_percent':
          shouldTrigger = Math.abs(currentData.changePercent) >= alert.targetValue;
          break;
      }

      if (shouldTrigger) {
        // Update alert status
        alert.status = 'triggered';
        alert.triggeredAt = new Date();
        alert.triggeredValue = currentValue;
        await alert.save();

        triggeredAlerts.push({
          alert,
          currentValue,
          user: alert.userId
        });
        triggeredCount++;
      }
    }

    // Here you would typically send notifications (email, push, etc.)
    // For now, we'll just log the triggered alerts
    if (triggeredAlerts.length > 0) {
      console.log(`Triggered ${triggeredAlerts.length} alerts:`, 
        triggeredAlerts.map(t => `${t.alert.symbol} ${t.alert.condition} ${t.alert.targetValue}`));
    }

    res.json({
      status: 'success',
      message: `Checked ${activeAlerts.length} alerts, triggered ${triggeredCount}`,
      data: { 
        checked: activeAlerts.length, 
        triggered: triggeredCount,
        triggeredAlerts: triggeredAlerts.map(t => ({
          id: t.alert._id,
          symbol: t.alert.symbol,
          condition: t.alert.condition,
          targetValue: t.alert.targetValue,
          currentValue: t.currentValue,
          user: t.user.email
        }))
      }
    });
  } catch (error) {
    console.error('Check alerts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check alerts'
    });
  }
});

// @route   PUT /api/alerts/:id/acknowledge
// @desc    Acknowledge triggered alert
// @access  Private
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.user.id,
        status: 'triggered'
      },
      { 
        status: 'acknowledged',
        acknowledgedAt: new Date()
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        status: 'error',
        message: 'Alert not found or not triggered'
      });
    }

    res.json({
      status: 'success',
      message: 'Alert acknowledged',
      data: { alert }
    });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to acknowledge alert'
    });
  }
});

// @route   GET /api/alerts/stats
// @desc    Get alert statistics for user
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const stats = await Alert.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      active: 0,
      triggered: 0,
      acknowledged: 0,
      inactive: 0
    };

    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });

    res.json({
      status: 'success',
      data: { stats: result }
    });
  } catch (error) {
    console.error('Get alert stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch alert statistics'
    });
  }
});

module.exports = router;