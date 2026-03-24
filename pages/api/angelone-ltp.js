// pages/api/angelone-ltp.js
const { angelOneHelper } = require('../../utils/angelOneHelper');

// Angel One SmartAPI integration with proper authentication flow and LTP fetching

export default async function handler(req, res) {
  const { exchange = 'NSE', symbol = 'TATAMOTORS-EQ', batch, totp } = req.query;
  const { totp: bodyTotp } = req.body || {};

  try {
    // Check if we need to force re-authentication with provided TOTP
    const totpCode = totp || bodyTotp;
    if (totpCode) {
      console.log('Using provided TOTP for authentication');
      await angelOneHelper.refreshAuthentication(totpCode);
    }

    // Get authentication status
    const authStatus = angelOneHelper.getAuthStatus();
    console.log('Authentication status:', authStatus);

    if (batch && req.body?.symbols) {
      // Batch request
      const results = await angelOneHelper.getBatchLTP(req.body.symbols);
      res.status(200).json({ 
        status: 'success',
        data: results,
        authStatus: authStatus,
        timestamp: new Date().toISOString()
      });
    } else {
      // Single symbol request
      const quote = await angelOneHelper.getLTP(exchange, symbol);
      res.status(200).json({ 
        status: 'success',
        data: {
          exchange, 
          symbol, 
          ...quote
        },
        authStatus: authStatus,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Angel One API Error:', err);
    
    // Provide more context in error response
    const authStatus = angelOneHelper.getAuthStatus();
    res.status(500).json({ 
      status: 'error',
      error: err.message,
      authStatus: authStatus,
      suggestion: !authStatus.hasTokens ? 
        'Try providing a TOTP code in the request to authenticate' : 
        'Check if your credentials are correct and try again',
      timestamp: new Date().toISOString()
    });
  }
}
