// examples/angelOneUsage.js
/**
 * Example usage of Angel One authentication and API services
 * This file demonstrates how to use the complete Angel One integration
 */

const { angelOneAuth } = require('../services/angelOneAuth');
const { angelOneHelper } = require('../utils/angelOneHelper');
const { angelOneWebSocket } = require('../services/angelOneWebSocket');

async function demonstrateAngelOneIntegration() {
  try {
    console.log('=== Angel One Smart API Integration Demo ===\n');

    // 1. Authentication
    console.log('1. Testing Authentication...');
    const authStatus = angelOneAuth.getTokenStatus();
    console.log('Current auth status:', authStatus);

    if (!authStatus.hasTokens) {
      console.log('No tokens found, logging in...');
      const loginResult = await angelOneAuth.login();
      console.log('Login successful:', loginResult.success);
      console.log('Tokens expire at:', loginResult.expiresAt);
    } else {
      console.log('Using existing tokens');
    }

    // 2. Get user profile
    console.log('\n2. Fetching User Profile...');
    const profile = await angelOneHelper.getUserProfile();
    console.log('User profile:', profile);

    // 3. Get market data for a single symbol
    console.log('\n3. Getting LTP for TATAMOTORS...');
    const ltpData = await angelOneHelper.getLTP('NSE', 'TATAMOTORS-EQ');
    console.log('TATAMOTORS LTP:', ltpData);

    // 4. Get batch market data
    console.log('\n4. Getting batch LTP data...');
    const symbols = [
      { exchange: 'NSE', symbol: 'TATAMOTORS-EQ' },
      { exchange: 'NSE', symbol: 'RELIANCE-EQ' },
      { exchange: 'NSE', symbol: 'TCS-EQ' }
    ];
    const batchData = await angelOneHelper.getBatchLTP(symbols);
    console.log('Batch LTP data:', batchData);

    // 5. Get holdings and positions
    console.log('\n5. Getting Holdings and Positions...');
    try {
      const holdings = await angelOneHelper.getHoldings();
      console.log('Holdings:', holdings);
      
      const positions = await angelOneHelper.getPositions();
      console.log('Positions:', positions);
    } catch (error) {
      console.log('Holdings/Positions error (may be empty):', error.message);
    }

    // 6. WebSocket demonstration
    console.log('\n6. WebSocket Integration...');
    
    // Setup message handler
    angelOneWebSocket.onMessage('all', (message) => {
      console.log('WebSocket message received:', message);
    });

    // Connect to WebSocket
    await angelOneWebSocket.connect();
    console.log('WebSocket connected successfully');

    // Subscribe to market data
    const symbolTokens = ['3045']; // TATAMOTORS token (example)
    await angelOneWebSocket.subscribe(1, 1, symbolTokens); // LTP mode, NSE_CM exchange
    
    console.log('Subscribed to WebSocket feed. Listening for 10 seconds...');
    
    // Listen for 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Disconnect WebSocket
    angelOneWebSocket.disconnect();
    console.log('WebSocket disconnected');

    // 7. Token refresh demonstration
    console.log('\n7. Token Management...');
    const tokenStatus = angelOneAuth.getTokenStatus();
    console.log('Token status:', tokenStatus);
    
    if (tokenStatus.timeToExpiry < (24 * 60 * 60 * 1000)) { // Less than 24 hours
      console.log('Token will expire soon, demonstrating refresh...');
      const refreshResult = await angelOneAuth.refreshToken();
      console.log('Token refreshed:', refreshResult.success);
    }

    // 8. Logout
    console.log('\n8. Logging out...');
    await angelOneAuth.logout();
    console.log('Logged out successfully');

    console.log('\n=== Demo completed successfully ===');

  } catch (error) {
    console.error('Demo error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateAngelOneIntegration()
    .then(() => {
      console.log('Demo finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}

module.exports = { demonstrateAngelOneIntegration };

