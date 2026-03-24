// pages/api/alice-blue-ltp.js
import fetch from 'node-fetch';

const USER_ID = process.env.AB_USER_ID;       // your Alice Blue user ID
const PASSWORD = process.env.AB_PASSWORD;     // your Alice Blue login password
const API_SECRET = process.env.AB_API_SECRET; // your API secret from developer console


/**
 * Obtain a one‑time access token from Alice Blue.
 * In Python this is done via AliceBlue.login_and_get_access_token().
 */
async function getAccessToken(twoFACode) {
  if (!USER_ID || !PASSWORD || !API_SECRET) {
    throw new Error('Alice Blue credentials not configured. Please set AB_USER_ID, AB_PASSWORD, AB_API_SECRET in environment variables.');
  }

  if (!twoFACode || twoFACode.length !== 6) {
    throw new Error('Valid 6-digit TOTP code is required');
  }

  const resp = await fetch('https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api/customer/getUserSID', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: USER_ID,
      password: PASSWORD,
      twoFA: twoFACode,
      apiSecret: API_SECRET
    })
  });

  const responseText = await resp.text();
  console.log('Alice Blue login response:', responseText);
  console.log('Response length:', responseText.length);
  console.log('Response status:', resp.status);
  
  // Check if response is empty or just whitespace
  if (!responseText || responseText.trim().length === 0) {
    throw new Error('Alice Blue API returned empty response');
  }
  
  let json;
  try {
    json = JSON.parse(responseText);
  } catch (parseError) {
    console.error('JSON Parse Error:', parseError.message);
    throw new Error(`Alice Blue API returned invalid JSON: "${responseText}" (Length: ${responseText.length})`);
  }
  
  // Check if JSON is empty object
  if (Object.keys(json).length === 0) {
    throw new Error('Alice Blue API returned empty JSON object - likely authentication failed');
  }
  
  if (json.stat !== 'Ok') {
    throw new Error(`Login failed: ${json.emsg || 'Unknown error'}`);
  }
  // Alice Blue API returns sessionID which acts as access token
  return json.sessionID;
}

/**
 * Fetch quote data for a single symbol and return its LTP (last traded price).
 */
async function getLTP(sessionID, exchange, symbol) {
  const resp = await fetch('https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api/marketData/getScripInfo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Alice Blue uses sessionID in Authorization header
      Authorization: `Bearer ${sessionID}`,
    },
    body: JSON.stringify({
      exch: exchange,       // e.g. "NSE"
      symbol: symbol        // e.g. "TCS-EQ"
    })
  });

  const responseText = await resp.text();
  console.log('Alice Blue quote response:', responseText);
  
  let json;
  try {
    json = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Alice Blue quote API returned non-JSON response: ${responseText.substring(0, 200)}...`);
  }
  
  if (json.stat !== 'Ok') {
    throw new Error(`Quote call failed: ${json.emsg || 'Unknown error'}`);
  }
  
  // Alice Blue's quote API returns various fields
  return {
    ltp: parseFloat(json.lp || json.ltp || 0),
    open: parseFloat(json.o || json.open || 0),
    high: parseFloat(json.h || json.high || 0),
    low: parseFloat(json.l || json.low || 0),
    volume: parseInt(json.v || json.volume || 0),
    change: parseFloat(json.c || json.change || 0),
    changePercent: parseFloat(json.chp || json.changePercent || 0)
  };
}

/**
 * Fetch multiple symbols in batch
 */
async function getBatchLTP(sessionID, symbols) {
  const results = {};
  
  for (const symbolData of symbols) {
    try {
      const quote = await getLTP(sessionID, symbolData.exchange, symbolData.symbol);
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
  const { exchange = 'NSE', symbol = 'TATAMOTORS', batch, totp } = req.query;
  const { totp: bodyTotp } = req.body || {};

  // Get TOTP from query or body
  const twoFACode = totp || bodyTotp;

  try {
    const sessionID = await getAccessToken(twoFACode);
    
    if (batch && req.body?.symbols) {
      // Batch request
      const results = await getBatchLTP(sessionID, req.body.symbols);
      res.status(200).json({ 
        status: 'success',
        data: results,
        timestamp: new Date().toISOString()
      });
    } else {
      // Single symbol request
      const quote = await getLTP(sessionID, exchange, symbol);
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
    console.error('Alice Blue LTP Error:', err);
    res.status(500).json({ 
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}
