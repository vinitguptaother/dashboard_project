const express = require('express');
const router = express.Router();

// Import the upstoxService
const { upstoxService } = require('../../services/upstoxService');

// @route   GET /api/upstox/ltp
// @desc    Get Last Traded Price for instruments
// @access  Public
router.get('/ltp', async (req, res) => {
  try {
    const { instruments } = req.query;
    
    if (!instruments) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing instruments parameter'
      });
    }

    // Just pass the instruments directly - use simple symbol names
    const instrumentsArray = instruments.split(',').map(s => s.trim().toUpperCase());
    
    console.log('📥 Received request for instruments:', instrumentsArray);
    
    // Get LTP data from Upstox - pass the simple symbols
    const ltpResponse = await upstoxService.getLTP(instrumentsArray);
    
    console.log('📤 Upstox service returned:', JSON.stringify(ltpResponse, null, 2));
    
    // Return the response as-is if it's demo data format
    // Demo data format: { status: 'success', data: { SYMBOL: {...} } }
    res.json(ltpResponse);
    
  } catch (error) {
    console.error('❌ Error fetching LTP:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch LTP data'
    });
  }
});

// @route   GET /api/upstox/portfolio
// @desc    Get portfolio holdings
// @access  Public
router.get('/portfolio', async (req, res) => {
  try {
    // upstoxService is already imported
    const portfolio = await upstoxService.getPortfolio();
    
    res.json({
      status: 'success',
      data: portfolio
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch portfolio'
    });
  }
});

// @route   GET /api/upstox/positions
// @desc    Get current positions
// @access  Public
router.get('/positions', async (req, res) => {
  try {
    // upstoxService is already imported
    const positions = await upstoxService.getPositions();
    
    res.json({
      status: 'success',
      data: positions
    });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch positions'
    });
  }
});

// @route   GET /api/upstox/funds
// @desc    Get account funds
// @access  Public
router.get('/funds', async (req, res) => {
  try {
    // upstoxService is already imported
    const funds = await upstoxService.getFunds();
    
    res.json({
      status: 'success',
      data: funds
    });
  } catch (error) {
    console.error('Error fetching funds:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch funds'
    });
  }
});

// @route   GET /api/upstox/history
// @desc    Get historical candle data
// @access  Public
router.get('/history', async (req, res) => {
  try {
    const { symbol, timeframe } = req.query;
    
    if (!symbol || !timeframe) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: symbol and timeframe'
      });
    }

    console.log(`📊 Fetching historical data for ${symbol} (${timeframe})`);
    
    // Get historical data from Upstox service
    const data = await upstoxService.getHistoricalData(symbol, timeframe);
    
    res.json({
      success: true,
      data: data,
      symbol: symbol,
      timeframe: timeframe,
      timestamp: new Date().toISOString(),
      demo: data.demo || false,
      source: data.source || 'upstox'
    });
    
  } catch (error) {
    console.error('❌ Error fetching historical data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch historical data'
    });
  }
});

// @route   GET /api/upstox/test-demo
// @desc    Test endpoint to verify demo data generation
// @access  Public
router.get('/test-demo', async (req, res) => {
  try {
    const testSymbols = ['NIFTY', 'SENSEX', 'BANKNIFTY'];
    console.log('🧪 TEST: Calling getDemoLTPData directly');
    const demoData = upstoxService.getDemoLTPData(testSymbols);
    console.log('🧪 TEST: Got demo data:', JSON.stringify(demoData, null, 2));
    res.json(demoData);
  } catch (error) {
    console.error('🧪 TEST ERROR:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
