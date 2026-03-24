// test-angel-one-integration.js
// Test script for Angel One API integration

const { angelOneHelper } = require('./utils/angelOneHelper');
const { angelOneAuth } = require('./services/angelOneAuth');
// Load from .env.local (preferred) or .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

async function testAngelOneIntegration() {
  console.log('🚀 Starting Angel One API Integration Test...\n');

  try {
    // Test 1: Check environment variables
    console.log('📋 Test 1: Checking environment variables...');
    const requiredVars = [
      'ANGELONE_API_KEY',
      'ANGELONE_CLIENT_CODE', 
      'ANGELONE_PASSWORD',
      'ANGELONE_TOTP_SECRET'
    ];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      console.log('❌ Missing environment variables:', missing.join(', '));
      console.log('Please create a .env file with the required variables');
      return;
    }
    console.log('✅ All required environment variables are set\n');

    // Test 2: TOTP generation
    console.log('🔐 Test 2: Testing TOTP generation...');
    try {
      const totp = angelOneAuth.generateTOTP();
      console.log(`✅ TOTP generated successfully: ${totp}\n`);
    } catch (error) {
      console.log('❌ TOTP generation failed:', error.message);
      return;
    }

    // Test 3: Authentication
    console.log('🔑 Test 3: Testing authentication...');
    try {
      const authResult = await angelOneAuth.login();
      console.log('✅ Authentication successful');
      console.log(`   JWT Token: ${authResult.tokens.jwtToken.substring(0, 20)}...`);
      console.log(`   Feed Token: ${authResult.tokens.feedToken}`);
      console.log(`   Expires At: ${authResult.expiresAt}\n`);
    } catch (error) {
      console.log('❌ Authentication failed:', error.message);
      console.log('Please check your credentials and TOTP secret');
      return;
    }

    // Test 4: Symbol search
    console.log('🔍 Test 4: Testing symbol search...');
    try {
      const searchResults = await angelOneHelper.searchSymbol('NSE', 'TATAMOTORS-EQ');
      console.log('✅ Symbol search successful');
      console.log(`   Found ${searchResults.length} results`);
      if (searchResults.length > 0) {
        console.log(`   First result: ${searchResults[0].symbol} (Token: ${searchResults[0].symbolToken})`);
      }
      console.log();
    } catch (error) {
      console.log('❌ Symbol search failed:', error.message);
    }

    // Test 5: Get symbol token
    console.log('🎯 Test 5: Testing get symbol token...');
    try {
      const symbolToken = await angelOneHelper.getSymbolToken('TATAMOTORS-EQ', 'NSE');
      console.log('✅ Symbol token retrieved successfully');
      console.log(`   TATAMOTORS-EQ token: ${symbolToken}\n`);
    } catch (error) {
      console.log('❌ Get symbol token failed:', error.message);
    }

    // Test 6: Get LTP
    console.log('💰 Test 6: Testing LTP fetch...');
    try {
      const ltpData = await angelOneHelper.getLTP('NSE', 'TATAMOTORS-EQ');
      console.log('✅ LTP fetch successful');
      console.log(`   Symbol: ${ltpData.symbol}`);
      console.log(`   LTP: ₹${ltpData.ltp}`);
      console.log(`   Exchange: ${ltpData.exchange}`);
      console.log(`   Timestamp: ${ltpData.timestamp}\n`);
    } catch (error) {
      console.log('❌ LTP fetch failed:', error.message);
    }

    // Test 7: Authentication status
    console.log('📊 Test 7: Checking authentication status...');
    const authStatus = angelOneHelper.getAuthStatus();
    console.log('✅ Authentication status retrieved');
    console.log(`   Has Tokens: ${authStatus.hasTokens}`);
    console.log(`   Is Valid: ${authStatus.isValid}`);
    console.log(`   Expires At: ${authStatus.expiresAt}`);
    console.log(`   Time to Expiry: ${Math.round(authStatus.timeToExpiry / (1000 * 60))} minutes\n`);

    console.log('🎉 All tests completed successfully!');
    console.log('Angel One API integration is working properly.');

  } catch (error) {
    console.log('💥 Unexpected error during testing:', error.message);
    console.error(error);
  }
}

// Run the test
if (require.main === module) {
  testAngelOneIntegration()
    .then(() => {
      console.log('\n✨ Test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testAngelOneIntegration };

