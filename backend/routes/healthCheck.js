const express = require('express');
const router = express.Router();
const { upstoxService } = require('../../services/upstoxService');

// @route   GET /api/health-check/upstox
// @desc    Check if Upstox API is working with real data
// @access  Public
router.get('/upstox', async (req, res) => {
  try {
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
    
    // Check 1: Access token exists
    if (!accessToken || accessToken === 'your_access_token_here') {
      return res.json({
        status: 'error',
        issue: 'NO_TOKEN',
        message: 'Upstox access token not configured',
        solution: 'Update UPSTOX_ACCESS_TOKEN in backend/.env file',
        usingDemoData: true
      });
    }

    // Check 2: Token format is valid (JWT structure)
    const tokenParts = accessToken.split('.');
    if (tokenParts.length !== 3) {
      return res.json({
        status: 'error',
        issue: 'INVALID_TOKEN_FORMAT',
        message: 'Access token format is invalid',
        solution: 'Get a new access token from Upstox',
        usingDemoData: true
      });
    }

    // Check 3: Token expiry
    try {
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeLeft = expiryTime - now;
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));

      if (timeLeft < 0) {
        return res.json({
          status: 'error',
          issue: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
          expiredAt: new Date(expiryTime).toISOString(),
          solution: 'Generate a new access token from Upstox and update backend/.env',
          usingDemoData: true
        });
      }

      if (hoursLeft < 2) {
        console.warn(`⚠️  Upstox token expiring soon! ${hoursLeft} hours left`);
      }
    } catch (err) {
      console.error('Error parsing token:', err);
    }

    // Check 4: Test actual API call
    console.log('Testing Upstox API with live call...');
    const testResult = await upstoxService.getLTP(['NIFTY']);
    
    if (testResult.status === 'success' && testResult.data && testResult.data.NIFTY) {
      const niftyPrice = testResult.data.NIFTY.lastPrice;
      
      // Sanity check: NIFTY should be between 10,000 and 50,000
      if (niftyPrice < 10000 || niftyPrice > 50000) {
        return res.json({
          status: 'warning',
          issue: 'SUSPICIOUS_DATA',
          message: 'Upstox is returning data, but values seem incorrect',
          niftyPrice: niftyPrice,
          usingDemoData: false
        });
      }

      return res.json({
        status: 'success',
        message: 'Upstox API is working correctly',
        testData: {
          symbol: 'NIFTY',
          price: niftyPrice
        },
        usingDemoData: false,
        tokenExpiresIn: payload ? Math.floor((payload.exp * 1000 - Date.now()) / (1000 * 60 * 60)) + ' hours' : 'unknown'
      });
    } else {
      return res.json({
        status: 'error',
        issue: 'API_CALL_FAILED',
        message: 'Upstox API call failed or returned invalid data',
        response: testResult,
        solution: 'Check if token is valid or if Upstox API is down',
        usingDemoData: true
      });
    }

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      issue: 'HEALTH_CHECK_ERROR',
      message: error.message,
      usingDemoData: true
    });
  }
});

// @route   GET /api/health-check/backend
// @desc    Check backend configuration
// @access  Public
router.get('/backend', (req, res) => {
  const port = process.env.PORT || 5001;
  const actualPort = req.socket.localPort;
  
  res.json({
    status: 'success',
    backend: {
      configuredPort: port,
      actualPort: actualPort,
      portMismatch: port != actualPort,
      upstoxTokenConfigured: !!process.env.UPSTOX_ACCESS_TOKEN && process.env.UPSTOX_ACCESS_TOKEN !== 'your_access_token_here',
      nodeEnv: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()) + ' seconds'
    }
  });
});

module.exports = router;
