const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Paths to .env files
const ROOT_ENV_PATH = path.join(__dirname, '../../.env');
const BACKEND_ENV_PATH = path.join(__dirname, '../.env');
const ENV_LOCAL_PATH = path.join(__dirname, '../../.env.local');

/**
 * Parse .env file content into key-value object
 */
function parseEnvFile(content) {
  const envVars = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }
    
    // Parse key=value
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex).trim();
      const value = trimmedLine.substring(equalIndex + 1).trim();
      envVars[key] = value;
    }
  }
  
  return envVars;
}

/**
 * Convert env object back to .env file format
 */
function stringifyEnvFile(envVars, originalContent = '') {
  const lines = originalContent.split('\n');
  const result = [];
  const processedKeys = new Set();
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Keep comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      result.push(line);
      continue;
    }
    
    // Update existing key
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex).trim();
      if (envVars.hasOwnProperty(key)) {
        result.push(`${key}=${envVars[key]}`);
        processedKeys.add(key);
      } else {
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }
  
  // Add new keys that weren't in original file
  for (const [key, value] of Object.entries(envVars)) {
    if (!processedKeys.has(key)) {
      result.push(`${key}=${value}`);
    }
  }
  
  return result.join('\n');
}

// @route   GET /api/config/env
// @desc    Get environment variables (masked for security)
// @access  Public (for initial setup)
router.get('/env', async (req, res) => {
  try {
    const envVars = {};
    
    // Read root .env file
    if (fs.existsSync(ROOT_ENV_PATH)) {
      const rootContent = fs.readFileSync(ROOT_ENV_PATH, 'utf8');
      const rootVars = parseEnvFile(rootContent);
      Object.assign(envVars, rootVars);
    }
    
    // Read backend .env file
    if (fs.existsSync(BACKEND_ENV_PATH)) {
      const backendContent = fs.readFileSync(BACKEND_ENV_PATH, 'utf8');
      const backendVars = parseEnvFile(backendContent);
      Object.assign(envVars, backendVars);
    }
    
    // Return unmasked values directly
    res.json({
      status: 'success',
      data: { env: envVars }
    });
  } catch (error) {
    console.error('Get env config error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch environment variables'
    });
  }
});

// @route   PUT /api/config/env
// @desc    Update environment variables
// @access  Public (for initial setup)
router.put('/env', [
  body('envVars').isObject().withMessage('envVars must be an object'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { envVars } = req.body;
    
    // Define which keys belong to which file
    const rootKeys = [
      'ANGELONE_API_KEY',
      'ANGELONE_CLIENT_CODE',
      'ANGELONE_PASSWORD',
      'UPSTOX_API_KEY',
      'UPSTOX_API_SECRET',
      'UPSTOX_REDIRECT_URI',
      'UPSTOX_ACCESS_TOKEN',
      'UPSTOX_DEFAULT_INSTRUMENTS'
    ];
    
    const backendKeys = [
      'PERPLEXITY_API_KEY',
      'NEWSAPI_KEY',
      'FRONTEND_URL',
      'PORT',
      'UPSTOX_API_KEY',
      'UPSTOX_API_SECRET',
      'UPSTOX_REDIRECT_URI',
      'UPSTOX_ACCESS_TOKEN',
      'UPSTOX_DEFAULT_INSTRUMENTS'
    ];
    
    // Update root .env file
    if (fs.existsSync(ROOT_ENV_PATH)) {
      const originalContent = fs.readFileSync(ROOT_ENV_PATH, 'utf8');
      const currentVars = parseEnvFile(originalContent);
      
      // Update only root keys
      for (const key of rootKeys) {
        if (envVars.hasOwnProperty(key)) {
          currentVars[key] = envVars[key];
        }
      }
      
      const newContent = stringifyEnvFile(currentVars, originalContent);
      fs.writeFileSync(ROOT_ENV_PATH, newContent, 'utf8');
    }
    
    // Update backend .env file
    if (fs.existsSync(BACKEND_ENV_PATH)) {
      const originalContent = fs.readFileSync(BACKEND_ENV_PATH, 'utf8');
      const currentVars = parseEnvFile(originalContent);
      
      // Update only backend keys
      for (const key of backendKeys) {
        if (envVars.hasOwnProperty(key)) {
          currentVars[key] = envVars[key];
        }
      }
      
      const newContent = stringifyEnvFile(currentVars, originalContent);
      fs.writeFileSync(BACKEND_ENV_PATH, newContent, 'utf8');
    }
    
    // Also update .env.local for Next.js frontend
    if (fs.existsSync(ENV_LOCAL_PATH)) {
      const originalContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf8');
      const currentVars = parseEnvFile(originalContent);
      
      // Update all keys in .env.local
      for (const [key, value] of Object.entries(envVars)) {
        currentVars[key] = value;
      }
      
      const newContent = stringifyEnvFile(currentVars, originalContent);
      fs.writeFileSync(ENV_LOCAL_PATH, newContent, 'utf8');
    } else {
      // Create .env.local if it doesn't exist
      const lines = [];
      lines.push('# Upstox API Configuration');
      for (const [key, value] of Object.entries(envVars)) {
        lines.push(`${key}=${value}`);
      }
      fs.writeFileSync(ENV_LOCAL_PATH, lines.join('\n'), 'utf8');
    }
    
    // Update process.env for immediate effect (requires server restart for full effect)
    for (const [key, value] of Object.entries(envVars)) {
      process.env[key] = value;
    }
    
    res.json({
      status: 'success',
      message: 'Environment variables updated successfully. Server restart recommended for all changes to take effect.'
    });
  } catch (error) {
    console.error('Update env config error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update environment variables'
    });
  }
});

// @route   GET /api/config/env/:key/reveal
// @desc    Get unmasked value for a specific environment variable
// @access  Public (for initial setup)
router.get('/env/:key/reveal', (req, res) => {
  try {
    const { key } = req.params;
    const envVars = {};
    
    // Read root .env file
    if (fs.existsSync(ROOT_ENV_PATH)) {
      const rootContent = fs.readFileSync(ROOT_ENV_PATH, 'utf8');
      const rootVars = parseEnvFile(rootContent);
      Object.assign(envVars, rootVars);
    }
    
    // Read backend .env file (overwrites root if same key)
    if (fs.existsSync(BACKEND_ENV_PATH)) {
      const backendContent = fs.readFileSync(BACKEND_ENV_PATH, 'utf8');
      const backendVars = parseEnvFile(backendContent);
      Object.assign(envVars, backendVars);
    }
    
    if (!envVars.hasOwnProperty(key)) {
      return res.status(404).json({
        status: 'error',
        message: 'Environment variable not found'
      });
    }
    
    res.json({
      status: 'success',
      data: { key, value: envVars[key] }
    });
  } catch (error) {
    console.error('Get env variable error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch environment variable'
    });
  }
});

// @route   GET /api/config/env/schema
// @desc    Get environment variable schema/structure
// @access  Public (for initial setup)
router.get('/env/schema', (req, res) => {
  try {
    const schema = {
      'Angel One': [
        { key: 'ANGELONE_API_KEY', label: 'API Key', type: 'password', required: true },
        { key: 'ANGELONE_CLIENT_CODE', label: 'Client Code', type: 'text', required: true },
        { key: 'ANGELONE_PASSWORD', label: 'Password', type: 'password', required: true }
      ],
      'Upstox': [
        { key: 'UPSTOX_API_KEY', label: 'API Key', type: 'password', required: true },
        { key: 'UPSTOX_API_SECRET', label: 'API Secret', type: 'password', required: true },
        { key: 'UPSTOX_REDIRECT_URI', label: 'Redirect URI', type: 'text', required: true },
        { key: 'UPSTOX_ACCESS_TOKEN', label: 'Access Token', type: 'password', required: false },
        { key: 'UPSTOX_DEFAULT_INSTRUMENTS', label: 'Default Instruments', type: 'text', required: false }
      ],
      'News & AI': [
        { key: 'PERPLEXITY_API_KEY', label: 'Perplexity API Key', type: 'password', required: false },
        { key: 'NEWSAPI_KEY', label: 'NewsAPI Key', type: 'password', required: false }
      ],
      'Server': [
        { key: 'FRONTEND_URL', label: 'Frontend URL', type: 'text', required: true },
        { key: 'PORT', label: 'Backend Port', type: 'number', required: true }
      ]
    };
    
    res.json({
      status: 'success',
      data: { schema }
    });
  } catch (error) {
    console.error('Get env schema error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch environment schema'
    });
  }
});

module.exports = router;
