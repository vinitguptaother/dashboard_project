const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Test server is running',
    timestamp: new Date().toISOString()
  });
});

// Test API endpoints
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend API is working!',
    endpoints: [
      'GET /health',
      'GET /api/test',
      'POST /api/auth/register',
      'POST /api/auth/login'
    ]
  });
});

// Mock auth endpoints for testing
app.post('/api/auth/register', (req, res) => {
  res.json({
    status: 'success',
    message: 'Registration endpoint working (mock)',
    data: { id: 1, email: req.body.email }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({
    status: 'success',
    message: 'Login endpoint working (mock)',
    token: 'mock-jwt-token'
  });
});

const PORT = process.env.PORT || 5003;

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📊 Test API at http://localhost:${PORT}/api/test`);
  console.log(`❤️  Health check at http://localhost:${PORT}/health`);
});