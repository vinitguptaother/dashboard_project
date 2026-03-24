const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const News = require('../models/News');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Cache duration in seconds
const CACHE_DURATION = 300; // 5 minutes

// Helper function to get cached data
const getCachedData = async (redis, key) => {
  if (!redis) return null;
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

// Helper function to set cached data
const setCachedData = async (redis, key, data, ttl = CACHE_DURATION) => {
  if (!redis) return;
  try {
    await redis.setEx(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Redis set error:', error);
  }
};

// @route   GET /api/news
// @desc    Get latest financial news
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category = 'all', limit = 20, page = 1 } = req.query;
    const redis = req.app.locals.redis;
    const cacheKey = `news:${category}:${page}:${limit}`;
    
    // Try cache first
    let cachedData = await getCachedData(redis, cacheKey);
    if (cachedData) {
      return res.json({
        status: 'success',
        data: cachedData,
        cached: true
      });
    }

    // Build query
    const query = { isActive: true };
    if (category !== 'all') {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const news = await News.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-content'); // Exclude full content for list view

    const total = await News.countDocuments(query);

    const result = {
      news,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: news.length,
        totalItems: total
      }
    };

    // Cache the result
    await setCachedData(redis, cacheKey, result);

    res.json({
      status: 'success',
      data: result,
      cached: false
    });

  } catch (error) {
    console.error('Get news error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch news'
    });
  }
});

// @route   GET /api/news/live
// @desc    Real-time news from RSS feeds (ET, Business Standard, Moneycontrol, LiveMint)
//          This is the PRIMARY news source — no API key needed, no 24h delay.
//          Cached for 10 minutes in Redis to avoid hammering RSS feeds.
// @access  Public
router.get('/live', optionalAuth, async (req, res) => {
  try {
    const { fetchRSSNews } = require('../services/rssNewsService');
    const redis = req.app.locals.redis;
    const cacheKey = 'news:rss:live';

    // Try cache first (10 min TTL — short enough for freshness, long enough to not hammer feeds)
    const cached = await getCachedData(redis, cacheKey);
    if (cached) {
      return res.json({
        status: 'success',
        data: { news: cached },
        count: cached.length,
        source: 'cache',
        cached: true,
      });
    }

    const articles = await fetchRSSNews();

    // Cache results for 10 minutes
    await setCachedData(redis, cacheKey, articles, 600);

    res.json({
      status: 'success',
      data: { news: articles },
      count: articles.length,
      source: 'rss',
      cached: false,
    });

  } catch (error) {
    console.error('Live RSS news error:', error);

    // Fallback: try MongoDB cache if RSS fails
    try {
      const dbNews = await News.find({})
        .sort({ publishedAt: -1 })
        .limit(20)
        .lean();

      if (dbNews.length > 0) {
        return res.json({
          status: 'success',
          data: { news: dbNews },
          count: dbNews.length,
          source: 'db_fallback',
        });
      }
    } catch (dbErr) {
      console.error('DB fallback also failed:', dbErr.message);
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch live news',
    });
  }
});

// @route   GET /api/news/:id
// @desc    Get specific news article
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    
    if (!news || !news.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'News article not found'
      });
    }

    // Increment view count
    news.views = (news.views || 0) + 1;
    await news.save();

    res.json({
      status: 'success',
      data: { news }
    });

  } catch (error) {
    console.error('Get news article error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch news article'
    });
  }
});

// @route   GET /api/news/category/:category
// @desc    Get news by category
// @access  Public
router.get('/category/:category', optionalAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20, page = 1 } = req.query;
    const redis = req.app.locals.redis;
    const cacheKey = `news:category:${category}:${page}:${limit}`;
    
    // Try cache first
    let cachedData = await getCachedData(redis, cacheKey);
    if (cachedData) {
      return res.json({
        status: 'success',
        data: cachedData,
        cached: true
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const news = await News.find({ 
      category: category.toLowerCase(), 
      isActive: true 
    })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-content');

    const total = await News.countDocuments({ 
      category: category.toLowerCase(), 
      isActive: true 
    });

    const result = {
      news,
      category,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: news.length,
        totalItems: total
      }
    };

    // Cache the result
    await setCachedData(redis, cacheKey, result);

    res.json({
      status: 'success',
      data: result,
      cached: false
    });

  } catch (error) {
    console.error('Get news by category error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch news by category'
    });
  }
});

// @route   POST /api/news/search
// @desc    Search news articles
// @access  Public
router.post('/search', [
  optionalAuth,
  body('query').trim().isLength({ min: 2, max: 100 })
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

    const { query, category, limit = 20, page = 1 } = req.body;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build search query
    const searchQuery = {
      $and: [
        { isActive: true },
        {
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { summary: { $regex: query, $options: 'i' } },
            { tags: { $in: [new RegExp(query, 'i')] } }
          ]
        }
      ]
    };

    if (category) {
      searchQuery.$and.push({ category: category.toLowerCase() });
    }

    const news = await News.find(searchQuery)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-content');

    const total = await News.countDocuments(searchQuery);

    res.json({
      status: 'success',
      data: {
        news,
        query,
        category,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: news.length,
          totalItems: total
        }
      }
    });

  } catch (error) {
    console.error('Search news error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search news'
    });
  }
});

// @route   GET /api/news/trending/topics
// @desc    Get trending topics
// @access  Public
router.get('/trending/topics', optionalAuth, async (req, res) => {
  try {
    const redis = req.app.locals.redis;
    const cacheKey = 'news:trending:topics';
    
    // Try cache first
    let cachedData = await getCachedData(redis, cacheKey);
    if (cachedData) {
      return res.json({
        status: 'success',
        data: cachedData,
        cached: true
      });
    }

    // Get trending topics from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingTopics = await News.aggregate([
      {
        $match: {
          publishedAt: { $gte: sevenDaysAgo },
          isActive: true
        }
      },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
          latestNews: { $first: '$$ROOT' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          topic: '$_id',
          count: 1,
          latestTitle: '$latestNews.title',
          latestDate: '$latestNews.publishedAt'
        }
      }
    ]);

    // Cache for 1 hour
    await setCachedData(redis, cacheKey, trendingTopics, 3600);

    res.json({
      status: 'success',
      data: { topics: trendingTopics },
      cached: false
    });

  } catch (error) {
    console.error('Get trending topics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch trending topics'
    });
  }
});

// @route   GET /api/news/fetch-external
// @desc    Fetch news from external APIs (internal use)
// @access  Public (should be protected in production)
router.get('/fetch-external', async (req, res) => {
  try {
    const newsApiKey = process.env.NEWSAPI_KEY;
    
    if (!newsApiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'NewsAPI key not configured'
      });
    }

    // Fetch from NewsAPI
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'stock market OR NSE OR BSE OR NIFTY OR SENSEX OR Indian economy',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 50,
        apiKey: newsApiKey
      }
    });

    const articles = response.data.articles;
    let savedCount = 0;

    for (const article of articles) {
      try {
        // Check if article already exists
        const existingNews = await News.findOne({ 
          url: article.url 
        });

        if (!existingNews) {
          const newsItem = new News({
            title: article.title,
            summary: article.description || '',
            content: article.content || '',
            url: article.url,
            imageUrl: article.urlToImage,
            source: article.source.name,
            author: article.author,
            publishedAt: new Date(article.publishedAt),
            category: 'market-news',
            tags: ['market', 'news'],
            sentiment: 'neutral' // Default sentiment
          });

          await newsItem.save();
          savedCount++;
        }
      } catch (saveError) {
        console.error('Error saving news item:', saveError);
      }
    }

    res.json({
      status: 'success',
      message: `Fetched ${articles.length} articles, saved ${savedCount} new articles`,
      data: { 
        fetched: articles.length, 
        saved: savedCount 
      }
    });

  } catch (error) {
    console.error('Fetch external news error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch external news'
    });
  }
});

module.exports = router;