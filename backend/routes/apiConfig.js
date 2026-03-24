const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const APIConfig = require('../models/APIConfig');

const router = express.Router();

// @route   GET /api/config/apis
// @desc    Get all API configurations for user
// @access  Private
router.get('/apis', async (req, res) => {
  try {
    const { category, status } = req.query;
    
    const query = { userId: req.user.id, isActive: true };
    if (category) query.category = category;
    if (status) query.status = status;

    const apis = await APIConfig.find(query)
      .sort({ createdAt: -1 })
      .select('-apiKey'); // Don't send API keys in list view

    res.json({
      status: 'success',
      data: { apis },
      count: apis.length
    });
  } catch (error) {
    console.error('Get API configs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch API configurations'
    });
  }
});

// @route   GET /api/config/apis/:id
// @desc    Get specific API configuration
// @access  Private
router.get('/apis/:id', async (req, res) => {
  try {
    const api = await APIConfig.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!api) {
      return res.status(404).json({
        status: 'error',
        message: 'API configuration not found'
      });
    }

    // Mask API key for security
    const apiData = api.toObject();
    if (apiData.apiKey) {
      apiData.apiKey = apiData.apiKey.replace(/.(?=.{4})/g, '*');
    }

    res.json({
      status: 'success',
      data: { api: apiData }
    });
  } catch (error) {
    console.error('Get API config error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch API configuration'
    });
  }
});

// @route   POST /api/config/apis
// @desc    Create new API configuration
// @access  Private
router.post('/apis', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('provider').isIn(['yahoo_finance', 'alpha_vantage', 'newsapi', 'fmp', 'coingecko', 'perplexity', 'alice_blue', 'custom']),
  body('category').isIn(['market-data', 'news', 'technical-analysis', 'fundamental-analysis', 'ai-ml', 'crypto', 'broker']),
  body('endpoint').isURL(),
  body('apiKey').optional().trim(),
  body('description').optional().trim().isLength({ max: 500 })
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

    const { name, provider, category, endpoint, apiKey, headers, parameters, description, appId, apiSecret, username, password, twoFA } = req.body;

    // Check if API with same name already exists for user
    const existingAPI = await APIConfig.findOne({
      userId: req.user.id,
      name,
      isActive: true
    });

    if (existingAPI) {
      return res.status(400).json({
        status: 'error',
        message: 'API configuration with this name already exists'
      });
    }

    const apiConfig = new APIConfig({
      userId: req.user.id,
      name,
      provider,
      category,
      endpoint,
      apiKey,
      headers: headers || {},
      parameters: parameters || {},
      description,
      // Alice Blue specific fields
      appId,
      apiSecret,
      username,
      password,
      twoFA
    });

    await apiConfig.save();

    // Don't return API key in response
    const responseData = apiConfig.toObject();
    delete responseData.apiKey;

    res.status(201).json({
      status: 'success',
      message: 'API configuration created successfully',
      data: { api: responseData }
    });
  } catch (error) {
    console.error('Create API config error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create API configuration'
    });
  }
});

// @route   PUT /api/config/apis/:id
// @desc    Update API configuration
// @access  Private
router.put('/apis/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('endpoint').optional().isURL(),
  body('apiKey').optional().trim(),
  body('description').optional().trim().isLength({ max: 500 })
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

    const api = await APIConfig.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, isActive: true },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!api) {
      return res.status(404).json({
        status: 'error',
        message: 'API configuration not found'
      });
    }

    // Don't return API key in response
    const responseData = api.toObject();
    delete responseData.apiKey;

    res.json({
      status: 'success',
      message: 'API configuration updated successfully',
      data: { api: responseData }
    });
  } catch (error) {
    console.error('Update API config error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update API configuration'
    });
  }
});

// @route   DELETE /api/config/apis/:id
// @desc    Delete API configuration
// @access  Private
router.delete('/apis/:id', async (req, res) => {
  try {
    const api = await APIConfig.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!api) {
      return res.status(404).json({
        status: 'error',
        message: 'API configuration not found'
      });
    }

    res.json({
      status: 'success',
      message: 'API configuration deleted successfully'
    });
  } catch (error) {
    console.error('Delete API config error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete API configuration'
    });
  }
});

// @route   POST /api/config/apis/:id/test
// @desc    Test API connection
// @access  Private
router.post('/apis/:id/test', async (req, res) => {
  try {
    const api = await APIConfig.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isActive: true
    });

    if (!api) {
      return res.status(404).json({
        status: 'error',
        message: 'API configuration not found'
      });
    }

    const startTime = Date.now();
    let testResult = {
      connected: false,
      latency: 0,
      error: null,
      data: null
    };

    try {
      // Build request headers
      const headers = {
        'User-Agent': 'Stock-Dashboard/1.0',
        ...Object.fromEntries(api.headers)
      };

      if (api.apiKey) {
        // Add API key based on provider
        switch (api.provider) {
          case 'alpha_vantage':
            headers['X-RapidAPI-Key'] = api.apiKey;
            break;
          case 'newsapi':
            headers['X-API-Key'] = api.apiKey;
            break;
          case 'perplexity':
            headers['Authorization'] = `Bearer ${api.apiKey}`;
            break;
          default:
            headers['Authorization'] = `Bearer ${api.apiKey}`;
        }
      }

      // Test different endpoints based on provider
      let testEndpoint = api.endpoint;
      let testParams = {};

      switch (api.provider) {
        case 'yahoo_finance':
          testEndpoint = `${api.endpoint}/AAPL`;
          break;
        case 'alpha_vantage':
          testParams = {
            function: 'GLOBAL_QUOTE',
            symbol: 'AAPL',
            apikey: api.apiKey
          };
          break;
        case 'newsapi':
          testParams = {
            q: 'stock market',
            pageSize: 1,
            apiKey: api.apiKey
          };
          break;
      }

      const response = await axios.get(testEndpoint, {
        headers,
        params: testParams,
        timeout: 10000 // 10 second timeout
      });

      testResult.connected = response.status === 200;
      testResult.latency = Date.now() - startTime;
      testResult.data = response.data;

      // Update API status
      api.status = 'connected';
      api.lastTestAt = new Date();
      api.latency = testResult.latency;
      api.lastError = null;

    } catch (error) {
      testResult.connected = false;
      testResult.latency = Date.now() - startTime;
      testResult.error = error.message;

      // Update API status
      api.status = 'error';
      api.lastTestAt = new Date();
      api.lastError = error.message;
    }

    await api.save();

    res.json({
      status: 'success',
      message: testResult.connected ? 'API connection successful' : 'API connection failed',
      data: testResult
    });

  } catch (error) {
    console.error('Test API connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to test API connection'
    });
  }
});

// @route   GET /api/config/stats
// @desc    Get API usage statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const stats = await APIConfig.aggregate([
      { $match: { userId: req.user.id, isActive: true } },
      {
        $group: {
          _id: null,
          totalAPIs: { $sum: 1 },
          connectedAPIs: {
            $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] }
          },
          totalRequests: { $sum: '$usage.totalRequests' },
          requestsToday: { $sum: '$usage.requestsToday' },
          avgLatency: { $avg: '$latency' }
        }
      }
    ]);

    const result = stats[0] || {
      totalAPIs: 0,
      connectedAPIs: 0,
      totalRequests: 0,
      requestsToday: 0,
      avgLatency: 0
    };

    // Calculate uptime percentage
    result.uptime = result.totalAPIs > 0 ? 
      (result.connectedAPIs / result.totalAPIs) * 100 : 0;

    res.json({
      status: 'success',
      data: { stats: result }
    });
  } catch (error) {
    console.error('Get API stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch API statistics'
    });
  }
});

// @route   POST /api/config/apis/reset-usage
// @desc    Reset daily usage counters
// @access  Private
router.post('/apis/reset-usage', async (req, res) => {
  try {
    const result = await APIConfig.updateMany(
      { userId: req.user.id, isActive: true },
      { 
        $set: { 
          'usage.requestsToday': 0,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      status: 'success',
      message: 'Usage counters reset successfully',
      data: { updated: result.modifiedCount }
    });
  } catch (error) {
    console.error('Reset usage error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset usage counters'
    });
  }
});

module.exports = router;