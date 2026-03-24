// backend/routes/upstoxAuth.js
// What this does: Handles Upstox OAuth2 flow — generates login URL, exchanges code for token,
// saves token to file, and checks token validity status.

const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Where we store the token on disk (next to server.js in the backend folder)
const TOKEN_FILE = path.join(__dirname, '../upstox-token.json');

// ─────────────────────────────────────────────
// Helper: Save token data to JSON file
// ─────────────────────────────────────────────
function saveTokenToFile(tokenData) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), 'utf8');
    console.log('✅ Upstox token saved to', TOKEN_FILE);
  } catch (err) {
    console.error('❌ Failed to save token file:', err.message);
  }
}

// ─────────────────────────────────────────────
// Helper: Load token from file
// ─────────────────────────────────────────────
function loadTokenFromFile() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('⚠️  Could not read token file:', err.message);
  }
  return null;
}

// ─────────────────────────────────────────────
// Helper: Decode JWT payload (no verification needed — Upstox signed it)
// ─────────────────────────────────────────────
function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Helper: Check if a token string is still valid (not expired)
// Adds a 5-minute buffer so we flag it before it actually dies
// ─────────────────────────────────────────────
function checkTokenValid(token) {
  if (!token) return false;
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return false;
  const bufferSeconds = 5 * 60; // 5 minutes
  return decoded.exp > (Date.now() / 1000 + bufferSeconds);
}

// ─────────────────────────────────────────────
// GET /api/upstox/auth-url
// Returns the Upstox OAuth login URL to redirect the user to
// ─────────────────────────────────────────────
router.get('/auth-url', (req, res) => {
  const { UPSTOX_API_KEY, UPSTOX_REDIRECT_URI } = process.env;

  if (!UPSTOX_API_KEY) {
    return res.status(500).json({ error: 'UPSTOX_API_KEY is not set in your .env file' });
  }
  if (!UPSTOX_REDIRECT_URI) {
    return res.status(500).json({ error: 'UPSTOX_REDIRECT_URI is not set in your .env file' });
  }

  const authUrl =
    `https://api.upstox.com/v2/login/authorization/dialog` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(UPSTOX_API_KEY)}` +
    `&redirect_uri=${encodeURIComponent(UPSTOX_REDIRECT_URI)}`;

  console.log('🔗 Generated Upstox auth URL');
  res.json({ authUrl });
});

// ─────────────────────────────────────────────
// POST /api/upstox/exchange-token
// Called after OAuth callback — exchanges the one-time code for an access token
// Saves the token to file and updates the running service in memory
// ─────────────────────────────────────────────
router.post('/exchange-token', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const { UPSTOX_API_KEY, UPSTOX_API_SECRET, UPSTOX_REDIRECT_URI } = process.env;

  if (!UPSTOX_API_KEY || !UPSTOX_API_SECRET) {
    return res.status(500).json({ error: 'Upstox API credentials not configured in .env' });
  }

  try {
    // Exchange code for token via Upstox API
    const params = new URLSearchParams({
      code,
      client_id: UPSTOX_API_KEY,
      client_secret: UPSTOX_API_SECRET,
      redirect_uri: UPSTOX_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const response = await axios.post(
      'https://api.upstox.com/v2/login/authorization/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
    );

    const { access_token, token_type } = response.data;

    if (!access_token) {
      return res.status(500).json({ error: 'Upstox did not return an access token' });
    }

    // Decode JWT to get actual expiry time
    const decoded = decodeJWT(access_token);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

    // Build the token record to save
    const tokenData = {
      access_token,
      token_type: token_type || 'Bearer',
      expires_at_unix: decoded?.exp || null,
      expires_at_iso: expiresAt,
      saved_at: new Date().toISOString(),
    };

    // Save to file
    saveTokenToFile(tokenData);

    // Update process.env so current requests use the new token immediately
    process.env.UPSTOX_ACCESS_TOKEN = access_token;

    // Re-initialize the Upstox SDK service with the new token
    try {
      const { upstoxService } = require('../../services/upstoxService');
      upstoxService.updateToken(access_token);
      console.log('✅ Upstox service re-initialized with new token');
    } catch (e) {
      console.warn('⚠️  Could not reinitialize upstox service in memory:', e.message);
    }

    console.log(`✅ Upstox token exchanged successfully. Expires: ${expiresAt}`);

    res.json({
      success: true,
      message: 'Upstox connected successfully! You are now live.',
      expiresAt,
    });
  } catch (error) {
    const upstoxError = error.response?.data;
    console.error('❌ Token exchange failed:', upstoxError || error.message);
    res.status(500).json({
      error: 'Failed to exchange authorization code for token',
      details: upstoxError?.message || upstoxError?.error_description || error.message,
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/upstox/token-status
// Returns whether the current token is valid or expired
// Used by the frontend to show the LIVE / EXPIRED badge
// ─────────────────────────────────────────────
router.get('/token-status', (req, res) => {
  // Priority: file token > env token
  const stored = loadTokenFromFile();
  const token = stored?.access_token || process.env.UPSTOX_ACCESS_TOKEN || null;

  if (!token) {
    return res.json({
      connected: false,
      status: 'not_configured',
      message: 'No Upstox token found. Click "Connect Upstox" to get started.',
      expiresAt: null,
      savedAt: null,
    });
  }

  const isValid = checkTokenValid(token);
  const decoded = decodeJWT(token);
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;

  res.json({
    connected: isValid,
    status: isValid ? 'active' : 'expired',
    message: isValid
      ? 'Upstox connected — live data active'
      : 'Token expired. Click "Reconnect Upstox" to get live data.',
    expiresAt,
    savedAt: stored?.saved_at || null,
  });
});

// ─────────────────────────────────────────────
// Helper export so upstoxService can call loadTokenFromFile on startup
// ─────────────────────────────────────────────
module.exports = router;
module.exports.loadTokenFromFile = loadTokenFromFile;
module.exports.checkTokenValid = checkTokenValid;
