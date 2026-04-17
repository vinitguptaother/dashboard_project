const rateLimit = require('express-rate-limit');

// Bypass rate-limiting entirely for loopback (single-user dashboard on localhost).
// Real abuse vector is remote access, which this app doesn't accept today — if we
// ever expose it publicly, this still protects non-loopback clients at 500/15m.
const isLoopback = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
};

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // bumped from 100 — dashboard UIs poll frequently; 100 exhausted in ~4 page loads
  skip: isLoopback, // no limit for localhost — this is a personal dashboard
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Market data rate limiter (more lenient)
const marketDataLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for market data
  message: {
    status: 'error',
    message: 'Too many market data requests, please slow down.',
    retryAfter: '1 minute'
  },
});

// API configuration rate limiter (very strict)
const apiConfigLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour for API config changes
  message: {
    status: 'error',
    message: 'Too many API configuration requests, please try again later.',
    retryAfter: '1 hour'
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  marketDataLimiter,
  apiConfigLimiter
};