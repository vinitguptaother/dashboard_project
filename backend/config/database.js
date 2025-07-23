const mongoose = require('mongoose');
const redis = require('redis');

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/stock_dashboard';
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('⚠️  MongoDB connection error:', error.message);
    console.log('📝 To fix this:');
    console.log('   1. Install MongoDB locally, or');
    console.log('   2. Use MongoDB Atlas (free): https://www.mongodb.com/atlas');
    console.log('   3. Update MONGODB_URI in your .env file');
    console.log('🚀 Server will continue without database (limited functionality)');
    // Don't exit, continue without database for now
  }
};

// Redis connection (optional)
const connectRedis = async () => {
  // Skip Redis if URL is not provided or commented out
  if (!process.env.REDIS_URL) {
    console.log('⚠️  Redis URL not provided, using in-memory caching');
    return null;
  }
  
  try {
    const client = redis.createClient({
      url: process.env.REDIS_URL
    });
    
    client.on('error', (err) => {
      console.log('Redis Client Error', err);
      return null;
    });
    client.on('connect', () => console.log('✅ Redis Connected'));
    
    await client.connect();
    return client;
  } catch (error) {
    console.error('⚠️  Redis connection error, using in-memory caching:', error.message);
    return null;
  }
};

module.exports = { connectDB, connectRedis };