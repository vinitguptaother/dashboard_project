const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const MarketData = require('../models/MarketData');
const News = require('../models/News');
const Alert = require('../models/Alert');
const APIConfig = require('../models/APIConfig');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock_dashboard');
    console.log('MongoDB Connected for seeding');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Sample data
const sampleUsers = [
  {
    email: 'admin@stockdashboard.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  },
  {
    email: 'demo@stockdashboard.com',
    password: 'demo123',
    firstName: 'Demo',
    lastName: 'User',
    role: 'user'
  }
];

const sampleMarketData = [
  {
    symbol: 'NIFTY',
    exchange: 'INDEX',
    price: 19800.50,
    change: 125.30,
    changePercent: 0.64,
    volume: 0,
    dayHigh: 19850.75,
    dayLow: 19720.25,
    previousClose: 19675.20,
    source: 'manual'
  },
  {
    symbol: 'SENSEX',
    exchange: 'INDEX',
    price: 66500.25,
    change: 420.15,
    changePercent: 0.63,
    volume: 0,
    dayHigh: 66650.80,
    dayLow: 66200.50,
    previousClose: 66080.10,
    source: 'manual'
  },
  {
    symbol: 'BANKNIFTY',
    exchange: 'INDEX',
    price: 44250.75,
    change: -85.25,
    changePercent: -0.19,
    volume: 0,
    dayHigh: 44400.50,
    dayLow: 44150.25,
    previousClose: 44336.00,
    source: 'manual'
  },
  {
    symbol: 'RELIANCE',
    exchange: 'NSE',
    price: 2485.75,
    change: 12.50,
    changePercent: 0.51,
    volume: 2500000,
    dayHigh: 2495.80,
    dayLow: 2470.25,
    previousClose: 2473.25,
    marketCap: 1680000000000,
    pe: 28.5,
    sector: 'Oil & Gas',
    industry: 'Refineries',
    source: 'manual'
  },
  {
    symbol: 'TCS',
    exchange: 'NSE',
    price: 3720.45,
    change: -25.80,
    changePercent: -0.69,
    volume: 1800000,
    dayHigh: 3750.20,
    dayLow: 3710.15,
    previousClose: 3746.25,
    marketCap: 1350000000000,
    pe: 32.1,
    sector: 'Information Technology',
    industry: 'IT Services',
    source: 'manual'
  }
];

const sampleNews = [
  {
    title: 'Nifty Hits New All-Time High Amid Strong FII Inflows',
    summary: 'The benchmark Nifty index reached a new record high today, driven by strong foreign institutional investor inflows and positive global cues.',
    content: 'The Indian stock market witnessed a remarkable rally today as the Nifty 50 index touched a new all-time high of 19,850 points...',
    url: 'https://example.com/news/nifty-ath-1',
    source: 'Market News',
    category: 'market-news',
    tags: ['nifty', 'ath', 'fii', 'rally'],
    sentiment: 'positive',
    impact: 'high',
    relevantStocks: ['NIFTY'],
    publishedAt: new Date()
  },
  {
    title: 'Banking Sector Shows Mixed Performance Despite Rate Hike Concerns',
    summary: 'Banking stocks displayed varied performance as investors weigh the impact of potential interest rate changes on sector profitability.',
    content: 'The banking sector presented a mixed bag of results today with some major banks gaining while others faced selling pressure...',
    url: 'https://example.com/news/banking-mixed-1',
    source: 'Financial Express',
    category: 'sector-news',
    tags: ['banking', 'rates', 'mixed'],
    sentiment: 'neutral',
    impact: 'medium',
    relevantStocks: ['BANKNIFTY', 'HDFC', 'ICICIBANK'],
    publishedAt: new Date(Date.now() - 3600000) // 1 hour ago
  }
];

// Seed function
const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Portfolio.deleteMany({});
    await MarketData.deleteMany({});
    await News.deleteMany({});
    await Alert.deleteMany({});
    await APIConfig.deleteMany({});

    console.log('✅ Cleared existing data');

    // Create users
    const users = [];
    for (const userData of sampleUsers) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const user = new User({
        ...userData,
        password: hashedPassword
      });
      
      await user.save();
      users.push(user);
      console.log(`✅ Created user: ${user.email}`);
    }

    // Create market data
    for (const marketItem of sampleMarketData) {
      const market = new MarketData(marketItem);
      await market.save();
      console.log(`✅ Created market data: ${market.symbol}`);
    }

    // Create news
    for (const newsItem of sampleNews) {
      const news = new News(newsItem);
      await news.save();
      console.log(`✅ Created news: ${news.title.substring(0, 50)}...`);
    }

    // Create sample portfolio for demo user
    const demoUser = users.find(u => u.email === 'demo@stockdashboard.com');
    if (demoUser) {
      const portfolio = new Portfolio({
        userId: demoUser._id,
        name: 'My First Portfolio',
        description: 'Demo portfolio with sample stocks',
        type: 'equity',
        positions: [
          {
            symbol: 'RELIANCE',
            quantity: 10,
            averagePrice: 2400.00,
            currentPrice: 2485.75,
            investedAmount: 24000.00,
            currentValue: 24857.50,
            pnl: 857.50,
            pnlPercent: 3.57,
            sector: 'Oil & Gas',
            exchange: 'NSE'
          },
          {
            symbol: 'TCS',
            quantity: 5,
            averagePrice: 3800.00,
            currentPrice: 3720.45,
            investedAmount: 19000.00,
            currentValue: 18602.25,
            pnl: -397.75,
            pnlPercent: -2.09,
            sector: 'Information Technology',
            exchange: 'NSE'
          }
        ]
      });

      await portfolio.save();
      console.log(`✅ Created sample portfolio for ${demoUser.email}`);

      // Create sample alert
      const alert = new Alert({
        userId: demoUser._id,
        symbol: 'NIFTY',
        alertType: 'price',
        condition: 'above',
        targetValue: 20000,
        message: 'NIFTY crossed 20,000 level!',
        priority: 'high'
      });

      await alert.save();
      console.log(`✅ Created sample alert for ${demoUser.email}`);

      // Create sample API config
      const apiConfig = new APIConfig({
        userId: demoUser._id,
        name: 'Yahoo Finance',
        provider: 'yahoo_finance',
        category: 'market-data',
        endpoint: 'https://query1.finance.yahoo.com/v8/finance/chart',
        description: 'Free market data from Yahoo Finance',
        status: 'connected'
      });

      await apiConfig.save();
      console.log(`✅ Created sample API config for ${demoUser.email}`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Sample Credentials:');
    console.log('Admin: admin@stockdashboard.com / admin123');
    console.log('Demo User: demo@stockdashboard.com / demo123');

  } catch (error) {
    console.error('❌ Seeding error:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run seeding
connectDB().then(() => {
  seedData();
});