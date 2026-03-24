// pages/api/angelone-ltp.js
import fetch from 'node-fetch';
import crypto from 'crypto';

const API_KEY = process.env.ANGELONE_API_KEY;
const CLIENT_CODE = process.env.ANGELONE_CLIENT_CODE;
const PASSWORD = process.env.ANGELONE_PASSWORD;
const TOTP_SECRET = process.env.ANGELONE_TOTP_SECRET;

/**
 * Generate TOTP code for Angel One authentication
 */
function generateTOTP(secret) {
  if (!secret) {
    throw new Error('TOTP secret not configured');
  }
  
  const time = Math.floor(Date.now() / 1000 / 30);
  const key = Buffer.from(secret.replace(/\s/g, ''), 'base32');
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(Buffer.from(time.toString(16).padStart(16, '0'), 'hex'));
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code = ((hash[offset] & 0x7f) << 24) |
               ((hash[offset + 1] & 0xff) << 16) |
               ((hash[offset + 2] & 0xff) << 8) |
               (hash[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

/**
 * Authenticate with Angel One Smart API
 */
async function authenticateAngelOne(totpCode) {
  if (!API_KEY || !CLIENT_CODE || !PASSWORD) {
    throw new Error('Angel One credentials not configured. Please set ANGELONE_API_KEY, ANGELONE_CLIENT_CODE, ANGELONE_PASSWORD in environment variables.');
  }

  const loginData = {
    clientcode: CLIENT_CODE,
    password: PASSWORD,
    totp: totpCode
  };

  console.log('Angel One login request:', { ...loginData, password: '***', totp: '***' });

  const resp = await fetch('https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': '00:00:00:00:00:00',
      'X-PrivateKey': API_KEY
    },
    body: JSON.stringify(loginData)
  });

  const responseText = await resp.text();
  console.log('Angel One login response:', responseText);
  console.log('Response status:', resp.status);

  if (!responseText || responseText.trim().length === 0) {
    throw new Error('Angel One API returned empty response');
  }

  let json;
  try {
    json = JSON.parse(responseText);
  } catch (parseError) {
    console.error('JSON Parse Error:', parseError.message);
    throw new Error(`Angel One API returned invalid JSON: "${responseText}" (Length: ${responseText.length})`);
  }

  if (!json.status) {
    throw new Error(`Angel One login failed: ${json.message || json.errorMessage || 'Unknown error'}`);
  }

  return {
    jwtToken: json.data.jwtToken,
    refreshToken: json.data.refreshToken,
    feedToken: json.data.feedToken
  };
}


/**
 * Get LTP (Last Traded Price) for a symbol using marketData API
 */
async function getLTP(jwtToken, exchange, symbol) {
  // For Angel One, we need to use the marketData API
  // First, let's try to get symbol token by searching
  const searchResp = await fetch('https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/searchScrip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': '00:00:00:00:00:00',
      'X-PrivateKey': API_KEY,
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      exchange: exchange,
      searchscrip: symbol.replace('-EQ', '')
    })
  });

  const searchResult = await searchResp.json();
  let symbolToken = '';
  
  if (searchResult.status && searchResult.data && searchResult.data.length > 0) {
    symbolToken = searchResult.data[0].symboltoken;
  }

  // Now get market data
  const resp = await fetch('https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/marketData', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': '00:00:00:00:00:00',
      'X-PrivateKey': API_KEY,
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify({
      mode: "FULL",
      exchangeTokens: {
        [exchange]: [symbolToken]
      }
    })
  });

  const responseText = await resp.text();
  console.log('Angel One LTP response:', responseText);

  let json;
  try {
    json = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Angel One LTP API returned invalid JSON: ${responseText}`);
  }

  if (!json.status) {
    throw new Error(`Angel One LTP failed: ${json.message || json.errorMessage || 'Unknown error'}`);
  }

  const data = json.data;
  if (!data || !data.fetched || data.fetched.length === 0) {
    throw new Error('No market data found for symbol');
  }

  const marketData = data.fetched[0];
  return {
    ltp: parseFloat(marketData.ltp || 0),
    open: parseFloat(marketData.open || 0),
    high: parseFloat(marketData.high || 0),
    low: parseFloat(marketData.low || 0),
    close: parseFloat(marketData.close || 0),
    volume: parseInt(marketData.volume || 0),
    symbolToken: symbolToken
  };
}

/**
 * Get multiple LTPs in batch
 */
async function getBatchLTP(jwtToken, symbols) {
  const results = {};
  
  for (const symbolData of symbols) {
    try {
      const quote = await getLTP(jwtToken, symbolData.exchange, symbolData.symbol);
      results[`${symbolData.exchange}:${symbolData.symbol}`] = {
        ...quote,
        exchange: symbolData.exchange,
        symbol: symbolData.symbol,
        status: 'success'
      };
    } catch (error) {
      results[`${symbolData.exchange}:${symbolData.symbol}`] = {
        exchange: symbolData.exchange,
        symbol: symbolData.symbol,
        status: 'error',
        error: error.message
      };
    }
  }
  
  return results;
}

export default async function handler(req, res) {
  const { exchange = 'NSE', symbol = 'TATAMOTORS-EQ', batch, totp } = req.query;
  const { totp: bodyTotp } = req.body || {};

  // Get TOTP from query, body, or generate from secret
  let totpCode = totp || bodyTotp;
  
  if (!totpCode && TOTP_SECRET) {
    try {
      totpCode = generateTOTP(TOTP_SECRET);
      console.log('Generated TOTP code from secret');
    } catch (error) {
      console.error('TOTP generation failed:', error.message);
    }
  }

  if (!totpCode || totpCode.length !== 6) {
    return res.status(400).json({
      status: 'error',
      error: 'Valid 6-digit TOTP code is required',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const auth = await authenticateAngelOne(totpCode);
    
    if (batch && req.body?.symbols) {
      // Batch request
      const results = await getBatchLTP(auth.jwtToken, req.body.symbols);
      res.status(200).json({ 
        status: 'success',
        data: results,
        timestamp: new Date().toISOString()
      });
    } else {
      // Single symbol request
      const quote = await getLTP(auth.jwtToken, exchange, symbol);
      res.status(200).json({ 
        status: 'success',
        data: {
          exchange, 
          symbol, 
          ...quote
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Angel One API Error:', err);
    res.status(500).json({ 
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}
