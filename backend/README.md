# Stock Dashboard Backend API

A comprehensive backend API for the Indian Stock Market Dashboard built with Node.js, Express, MongoDB, and Redis.

## 🚀 Features

- **Real-time Market Data**: Live stock prices, indices, and market updates
- **User Authentication**: JWT-based secure authentication system
- **Portfolio Management**: Create and manage investment portfolios
- **Smart Alerts**: Price, volume, and percentage change alerts
- **Financial News**: Aggregated news from multiple sources
- **API Integration**: Support for multiple external financial APIs
- **WebSocket Support**: Real-time data streaming
- **Caching**: Redis-based caching for optimal performance
- **Rate Limiting**: API rate limiting and usage tracking

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Redis (v6 or higher)
- npm or yarn package manager

## 🛠️ Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd backend

# Install dependencies
npm install

# Run setup script
npm run setup
```

### 2. Environment Configuration

Update the `.env` file with your configuration:

```env
# Server Configuration
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/stock_dashboard
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-generated-jwt-secret
JWT_EXPIRE=7d

# API Keys (Optional - for external data)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
NEWSAPI_KEY=your_newsapi_key
FMP_API_KEY=your_fmp_key
PERPLEXITY_API_KEY=your_perplexity_key

# Email Configuration (Optional - for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 3. Database Setup

#### Option A: Local Installation
```bash
# Install MongoDB
# Visit: https://www.mongodb.com/try/download/community

# Install Redis
# Visit: https://redis.io/download
```

#### Option B: Docker Setup
```bash
# Start MongoDB
docker run -d --name mongodb -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest

# Start Redis
docker run -d --name redis -p 6379:6379 redis:latest

# Update MONGODB_URI in .env:
# mongodb://admin:password@localhost:27017/stock_dashboard?authSource=admin
```

### 4. Seed Database

```bash
# Populate with sample data
npm run seed
```

### 5. Start Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🔐 Authentication

### Sample Credentials

After running the seed script, you can use these credentials:

```
Demo User:
Email: demo@stockdashboard.com
Password: demo123

Admin User:
Email: admin@stockdashboard.com
Password: admin123
```

## 📚 API Documentation

### Base URL
```
http://localhost:5001/api
```

### Authentication Headers
```javascript
{
  "Authorization": "Bearer <jwt_token>"
}
```

## 🔗 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/register` | Register new user | Public |
| POST | `/login` | User login | Public |
| GET | `/profile` | Get user profile | Private |
| PUT | `/profile` | Update user profile | Private |
| POST | `/change-password` | Change password | Private |
| POST | `/logout` | User logout | Private |

#### Register User
```javascript
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login User
```javascript
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Market Data Routes (`/api/market`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/indices` | Get major indices (NIFTY, SENSEX, BANKNIFTY) | Public |
| GET | `/stock/:sy