const express = require('express');
const AliceBlueService = require('../services/aliceBlueService');
const APIConfig = require('../models/APIConfig');

const router = express.Router();

// Helper function to get Alice Blue service instance
const getAliceBlueService = async (userId) => {
  try {
    const apiConfig = await APIConfig.findOne({
      userId: userId,
      provider: 'alice_blue',
      isActive: true
    });

    if (!apiConfig) {
      throw new Error('Alice Blue API configuration not found');
    }

    return new AliceBlueService({
      appId: apiConfig.appId,           // Changed from appCode to appId
      apiSecret: apiConfig.apiSecret,   // Changed from appSecret to apiSecret
      apiKey: apiConfig.apiKey,
      username: apiConfig.username,
      password: apiConfig.password,
      twoFA: apiConfig.twoFA
    });
  } catch (error) {
    throw new Error(`Failed to initialize Alice Blue service: ${error.message}`);
  }
};

// @route   POST /api/alice-blue/test-connection
// @desc    Test Alice Blue connection
// @access  Private
router.post('/test-connection', async (req, res) => {
  try {
    const aliceBlueService = await getAliceBlueService(req.user.id);
    const result = await aliceBlueService.testConnection();
    
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Alice Blue test connection error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/alice-blue/market-data/:symbol
// @desc    Get market data for a symbol
// @access  Private
router.get('/market-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'NSE' } = req.query;
    
    const aliceBlueService = await getAliceBlueService(req.user.id);
    const marketData = await aliceBlueService.getMarketData(symbol, exchange);
    
    res.json({
      status: 'success',
      data: marketData
    });
  } catch (error) {
    console.error('Alice Blue market data error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/alice-blue/portfolio
// @desc    Get user portfolio
// @access  Private
router.get('/portfolio', async (req, res) => {
  try {
    const aliceBlueService = await getAliceBlueService(req.user.id);
    const portfolio = await aliceBlueService.getPortfolio();
    
    res.json({
      status: 'success',
      data: portfolio
    });
  } catch (error) {
    console.error('Alice Blue portfolio error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/alice-blue/place-order
// @desc    Place a new order
// @access  Private
router.post('/place-order', async (req, res) => {
  try {
    const orderData = req.body;
    
    // Validate required order fields
    const requiredFields = ['symbol', 'exchange', 'transactionType', 'quantity', 'product'];
    for (const field of requiredFields) {
      if (!orderData[field]) {
        return res.status(400).json({
          status: 'error',
          message: `Missing required field: ${field}`
        });
      }
    }
    
    const aliceBlueService = await getAliceBlueService(req.user.id);
    const orderResult = await aliceBlueService.placeOrder(orderData);
    
    res.json({
      status: 'success',
      data: orderResult
    });
  } catch (error) {
    console.error('Alice Blue place order error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/alice-blue/orders
// @desc    Get order book
// @access  Private
router.get('/orders', async (req, res) => {
  try {
    const aliceBlueService = await getAliceBlueService(req.user.id);
    const orders = await aliceBlueService.getOrderBook();
    
    res.json({
      status: 'success',
      data: orders
    });
  } catch (error) {
    console.error('Alice Blue orders error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/alice-blue/account
// @desc    Get account details
// @access  Private
router.get('/account', async (req, res) => {
  try {
    const aliceBlueService = await getAliceBlueService(req.user.id);
    const accountDetails = await aliceBlueService.getAccountDetails();
    
    res.json({
      status: 'success',
      data: accountDetails
    });
  } catch (error) {
    console.error('Alice Blue account details error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/alice-blue/balance
// @desc    Get account balance (equivalent to Python's alice.get_balance())
// @access  Private
router.get('/balance', async (req, res) => {
  try {
    const aliceBlueService = await getAliceBlueService(req.user.id);
    const balance = await aliceBlueService.getBalance();
    
    res.json({
      status: 'success',
      data: balance
    });
  } catch (error) {
    console.error('Alice Blue balance error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/alice-blue/square-off
// @desc    Square off a position
// @access  Private
router.post('/square-off', async (req, res) => {
  try {
    const { symbol, exchange = 'NSE', quantity, product = 'INTRADAY' } = req.body;
    
    if (!symbol || !quantity) {
      return res.status(400).json({
        status: 'error',
        message: 'Symbol and quantity are required'
      });
    }
    
    const aliceBlueService = await getAliceBlueService(req.user.id);
    
    // Create square off order data
    const orderData = {
      exchange: exchange,
      symbol: symbol,
      quantity: quantity.toString(),
      price: '', // Market order
      product: product,
      transactionType: 'SELL', // Square off is always sell
      orderType: 'MKT',
      triggerPrice: '',
      ret: 'DAY',
      disclosedQuantity: '',
      mktProtection: '',
      target: '',
      stopLoss: '',
      trailingStopLoss: '',
      orderComplexity: 'REGULAR',
      source: 'WEB'
    };
    
    const result = await aliceBlueService.placeOrder(orderData);
    
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Alice Blue square off error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
