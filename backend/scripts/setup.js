#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 Setting up Stock Dashboard Backend...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '../.env');
const envExamplePath = path.join(__dirname, '../.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  try {
    let envContent = fs.readFileSync(envExamplePath, 'utf8');
    
    // Generate a secure JWT secret
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    envContent = envContent.replace('your-super-secret-jwt-key-change-this-in-production', jwtSecret);
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully');
    console.log('✅ JWT secret automatically generated');
    console.log('⚠️  Please update the .env file with your actual API keys and database URLs\n');
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }
} else {
  console.log('✅ .env file already exists\n');
}

// Create logs directory
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  console.log('📁 Creating logs directory...');
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Logs directory created\n');
}

// Create uploads directory for future use
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  console.log('📁 Creating uploads directory...');
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Uploads directory created\n');
}

// Check dependencies
console.log('📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});
  
  console.log(`✅ Found ${dependencies.length} dependencies and ${devDependencies.length} dev dependencies\n`);
} catch (error) {
  console.error('❌ Error reading package.json:', error.message);
}

// Database setup instructions
console.log('🗄️  Database Setup Instructions:');
console.log('1. Install MongoDB:');
console.log('   - Download from: https://www.mongodb.com/try/download/community');
console.log('   - Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest');
console.log('   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
console.log('');
console.log('2. Install Redis:');
console.log('   - Download from: https://redis.io/download');
console.log('   - Or use Docker: docker run -d -p 6379:6379 --name redis redis:latest');
console.log('   - Or use Redis Cloud: https://redis.com/redis-enterprise-cloud/');
console.log('');

// API Keys setup
console.log('🔑 API Keys Setup (All have free tiers):');
console.log('1. Alpha Vantage: https://www.alphavantage.co/support/#api-key');
console.log('   - Free: 5 requests/minute, 500/day');
console.log('2. NewsAPI: https://newsapi.org/register');
console.log('   - Free: 1000 requests/month');
console.log('3. Financial Modeling Prep: https://financialmodelingprep.com/developer/docs');
console.log('   - Free: 250 requests/day');
console.log('4. Perplexity AI: https://www.perplexity.ai/');
console.log('   - Free tier available');
console.log('');

// Environment variables
console.log('⚙️  Required Environment Variables:');
console.log('Update your .env file with:');
console.log('- MONGODB_URI (your MongoDB connection string)');
console.log('- REDIS_URL (your Redis connection string)');
console.log('- JWT_SECRET (already generated)');
console.log('- API keys for external services');
console.log('- EMAIL credentials for notifications');
console.log('');

// Docker setup option
console.log('🐳 Quick Docker Setup (Optional):');
console.log('Run these commands to start MongoDB and Redis with Docker:');
console.log('');
console.log('docker run -d --name mongodb -p 27017:27017 \\');
console.log('  -e MONGO_INITDB_ROOT_USERNAME=admin \\');
console.log('  -e MONGO_INITDB_ROOT_PASSWORD=password \\');
console.log('  mongo:latest');
console.log('');
console.log('docker run -d --name redis -p 6379:6379 redis:latest');
console.log('');
console.log('Then update MONGODB_URI in .env to:');
console.log('mongodb://admin:password@localhost:27017/stock_dashboard?authSource=admin');
console.log('');

// Next steps
console.log('🎯 Next Steps:');
console.log('1. Update .env file with your configuration');
console.log('2. Start MongoDB and Redis services');
console.log('3. Install dependencies: npm install');
console.log('4. Run: npm run seed (to populate sample data)');
console.log('5. Run: npm run dev (to start development server)');
console.log('6. Test API: http://localhost:5001/health');
console.log('');

// Health check script
console.log('🔍 Health Check Commands:');
console.log('- Check server: curl http://localhost:5001/health');
console.log('- Check market data: curl http://localhost:5001/api/market/indices');
console.log('- Check news: curl http://localhost:5001/api/news');
console.log('');

console.log('✨ Setup completed! Your backend is ready to configure.');
console.log('📚 Check the README.md for detailed API documentation.');