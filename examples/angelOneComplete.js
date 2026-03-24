// examples/angelOneComplete.js
// Complete Angel One SmartAPI integration example following documentation

const axios = require('axios');
const { authenticator } = require('otplib');
// Load from .env.local (preferred) or .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

/**
 * Generate TOTP using secret
 */
function getCurrentTOTP(secret) {
  return authenticator.generate(secret);
}

/**
 * Get common headers for Angel One API requests
 * Note: In production, use the angelOneAuth service which auto-detects network info
 */
function commonHeaders(jwtToken, networkInfo = {}) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': networkInfo.localIP || process.env.ANGELONE_LOCAL_IP || '127.0.0.1',
    'X-ClientPublicIP': networkInfo.publicIP || process.env.ANGELONE_PUBLIC_IP || '127.0.0.1',
    'X-MACAddress': networkInfo.macAddress || process.env.ANGELONE_MAC_ADDRESS || '00:00:00:00:00:00',
    'X-PrivateKey': process.env.ANGELONE_API_KEY,
    ...(jwtToken && { 'Authorization': `Bearer ${jwtToken}` })
  };
}

/**
 * Login and Get Tokens
 */
async function angelOneLogin() {
  const loginData = {
    clientcode: process.env.ANGELONE_CLIENT_CODE,
    password: process.env.ANGELONE_PASSWORD,
    totp: getCurrentTOTP(process.env.ANGELONE_TOTP_SECRET)
  };

  const headers = commonHeaders();

  try {
    const response = await axios.post(
      'https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword',
      loginData,
      { headers }
    );
    
    // Store tokens for further use (jwtToken, refreshToken, feedToken)
    if(response.data.status) {
      return response.data.data;
    } else {
      throw new Error(response.data.message);
    }
  } catch(err) {
    console.error("Login error:", err.message);
    throw err;
  }
}

/**
 * Search for Symbol Token
 */
async function getSymbolToken(symbol, jwtToken) {
  const headers = commonHeaders(jwtToken);
  const body = {
    exchange: "NSE",
    searchscrip: symbol.replace('-EQ','')
  };
  
  const response = await axios.post(
    'https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/searchScrip',
    body,
    { headers }
  );
  
  if(response.data.status && response.data.data.length > 0) {
    // Pick the matching tradingsymbol, e.g., TATAMOTORS-EQ
    const match = response.data.data.find(s => s.tradingsymbol === symbol);
    return match ? match.symboltoken : null;
  }
  return null;
}

/**
 * Fetch LTP for the Symbol
 */
async function fetchLTP(symbol, symboltoken, jwtToken) {
  const headers = commonHeaders(jwtToken);
  const body = {
    exchange: "NSE",
    tradingsymbol: symbol,
    symboltoken: symboltoken
  };
  
  const response = await axios.post(
    'https://apiconnect.angelone.in/order-service/rest/secure/angelbroking/order/v1/getLtpData',
    body,
    { headers }
  );
  
  if(response.data.status) {
    return response.data.data.ltp;
  } else {
    throw new Error(response.data.message);
  }
}

/**
 * Token Renewal (if expired)
 */
async function refreshToken(refreshToken, jwtToken) {
  const headers = commonHeaders(jwtToken);
  const body = { refreshToken };

  const response = await axios.post(
    'https://apiconnect.angelone.in/rest/auth/angelbroking/jwt/v1/generateTokens',
    body,
    { headers }
  );
  
  if(response.data.status) {
    return response.data.data;
  } else {
    throw new Error(response.data.message);
  }
}

/**
 * Main function that puts it all together
 */
async function main() {
  try {
    console.log('Starting Angel One API integration...');
    
    // Step 1: Authenticate
    console.log('Step 1: Authenticating...');
    const tokens = await angelOneLogin();
    console.log('✓ Authentication successful');

    // Step 2: Get symbol token for e.g., TATAMOTORS-EQ
    console.log('Step 2: Getting symbol token...');
    const symbol = "TATAMOTORS-EQ";
    const jwtToken = tokens.jwtToken;
    const token = await getSymbolToken(symbol, jwtToken);
    
    if (!token) {
      throw new Error("Symbol token not found.");
    }
    console.log(`✓ Symbol token found: ${token}`);

    // Step 3: Get LTP (Last Traded Price)
    console.log('Step 3: Fetching LTP...');
    const ltp = await fetchLTP(symbol, token, jwtToken);
    console.log(`✓ LTP for ${symbol}: ₹${ltp}`);
    
    return {
      symbol,
      token,
      ltp,
      timestamp: new Date().toISOString()
    };
    
  } catch (err) {
    console.error("Error:", err.message);
    throw err;
  }
}

// Export functions for use in other modules
module.exports = {
  getCurrentTOTP,
  commonHeaders,
  angelOneLogin,
  getSymbolToken,
  fetchLTP,
  refreshToken,
  main
};

// Run main function if this file is executed directly
if (require.main === module) {
  main()
    .then(result => {
      console.log('\n=== Final Result ===');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('\n=== Error ===');
      console.error(error.message);
      process.exit(1);
    });
}

