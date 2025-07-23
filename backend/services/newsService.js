const axios = require('axios');
const News = require('../models/News');
const { apiLogger } = require('../middleware/logger');

class NewsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 300000; // 5 minutes cache
  }

  // Fetch news from external APIs
  async fetchExternalNews() {
    try {
      const newsApiKey = process.env.NEWSAPI_KEY;
      if (!newsApiKey) {
        throw new Error('NewsAPI key not configured');
      }

      // Fetch from NewsAPI
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: 'stock market OR NSE OR BSE OR NIFTY OR SENSEX OR Indian economy OR RBI OR inflation',
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: 50,
          apiKey: newsApiKey
        },
        timeout: 15000
      });

      const articles = response.data.articles;
      let savedCount = 0;

      for (const article of articles) {
        try {
          // Skip articles without proper content
          if (!article.title || !article.description || !article.url) {
            continue;
          }

          // Check if article already exists
          const existingNews = await News.findOne({ url: article.url });
          if (existingNews) continue;

          // Analyze and categorize the news
          const category = this.categorizeNews(article.title, article.description);
          const sentiment = this.analyzeSentiment(article.title, article.description);
          const relevantStocks = this.extractRelevantStocks(article.title, article.description);
          const tags = this.extractTags(article.title, article.description);

          const newsItem = new News({
            title: article.title.substring(0, 200),
            summary: article.description.substring(0, 500),
            content: article.content || article.description,
            url: article.url,
            imageUrl: article.urlToImage,
            source: article.source.name,
            author: article.author,
            publishedAt: new Date(article.publishedAt),
            category,
            tags,
            sentiment,
            relevantStocks,
            impact: this.assessImpact(article.title, article.description)
          });

          await newsItem.save();
          savedCount++;

          apiLogger.info('NewsAPI', 'saveArticle', { 
            title: article.title.substring(0, 50),
            source: article.source.name 
          });

        } catch (saveError) {
          apiLogger.error('NewsService', 'saveArticle', saveError, { 
            url: article.url 
          });
        }
      }

      apiLogger.info('NewsAPI', 'fetchBatch', { 
        fetched: articles.length, 
        saved: savedCount 
      });

      return { fetched: articles.length, saved: savedCount };

    } catch (error) {
      apiLogger.error('NewsAPI', 'fetchExternalNews', error);
      throw error;
    }
  }

  // Categorize news based on content
  categorizeNews(title, description) {
    const content = `${title} ${description}`.toLowerCase();

    if (content.includes('ipo') || content.includes('listing')) {
      return 'ipos';
    }
    if (content.includes('earnings') || content.includes('results') || content.includes('profit')) {
      return 'earnings';
    }
    if (content.includes('rbi') || content.includes('policy') || content.includes('rate')) {
      return 'economic-policy';
    }
    if (content.includes('sector') || content.includes('industry')) {
      return 'sector-news';
    }
    if (content.includes('global') || content.includes('international')) {
      return 'global-markets';
    }
    if (content.includes('commodity') || content.includes('gold') || content.includes('oil')) {
      return 'commodities';
    }
    if (content.includes('rupee') || content.includes('dollar') || content.includes('currency')) {
      return 'currency';
    }
    if (content.includes('analysis') || content.includes('outlook') || content.includes('forecast')) {
      return 'analysis';
    }

    return 'market-news';
  }

  // Analyze sentiment
  analyzeSentiment(title, description) {
    const content = `${title} ${description}`.toLowerCase();
    
    const positiveWords = ['gain', 'rise', 'up', 'high', 'surge', 'rally', 'boost', 'positive', 'growth', 'strong'];
    const negativeWords = ['fall', 'drop', 'down', 'low', 'crash', 'decline', 'negative', 'weak', 'loss', 'concern'];

    let positiveScore = 0;
    let negativeScore = 0;

    positiveWords.forEach(word => {
      if (content.includes(word)) positiveScore++;
    });

    negativeWords.forEach(word => {
      if (content.includes(word)) negativeScore++;
    });

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  // Extract relevant stocks
  extractRelevantStocks(title, description) {
    const content = `${title} ${description}`.toUpperCase();
    const stocks = [];

    // Common Indian stocks
    const stockSymbols = [
      'RELIANCE', 'TCS', 'HDFC', 'INFY', 'ICICIBANK', 'HDFCBANK', 'ITC', 'SBIN',
      'BHARTIARTL', 'KOTAKBANK', 'LT', 'ASIANPAINT', 'MARUTI', 'AXISBANK',
      'NIFTY', 'SENSEX', 'BANKNIFTY'
    ];

    stockSymbols.forEach(symbol => {
      if (content.includes(symbol)) {
        stocks.push(symbol);
      }
    });

    return stocks;
  }

  // Extract tags
  extractTags(title, description) {
    const content = `${title} ${description}`.toLowerCase();
    const tags = [];

    const tagKeywords = {
      'market': ['market', 'stock', 'share'],
      'nifty': ['nifty'],
      'sensex': ['sensex'],
      'banking': ['bank', 'banking'],
      'it': ['it', 'tech', 'software'],
      'auto': ['auto', 'car', 'vehicle'],
      'pharma': ['pharma', 'drug', 'medicine'],
      'fmcg': ['fmcg', 'consumer'],
      'energy': ['oil', 'gas', 'energy'],
      'metals': ['steel', 'metal', 'iron'],
      'realty': ['real estate', 'property', 'realty']
    };

    Object.keys(tagKeywords).forEach(tag => {
      if (tagKeywords[tag].some(keyword => content.includes(keyword))) {
        tags.push(tag);
      }
    });

    return tags.length > 0 ? tags : ['market'];
  }

  // Assess impact level
  assessImpact(title, description) {
    const content = `${title} ${description}`.toLowerCase();
    
    const highImpactWords = ['crash', 'surge', 'record', 'historic', 'major', 'significant'];
    const mediumImpactWords = ['rise', 'fall', 'gain', 'loss', 'change'];

    if (highImpactWords.some(word => content.includes(word))) {
      return 'high';
    }
    if (mediumImpactWords.some(word => content.includes(word))) {
      return 'medium';
    }
    return 'low';
  }

  // Get trending topics
  async getTrendingTopics(days = 7) {
    const cacheKey = `trending_topics_${days}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const topics = await News.aggregate([
        {
          $match: {
            publishedAt: { $gte: startDate },
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

      this.cache.set(cacheKey, { data: topics, timestamp: Date.now() });
      return topics;

    } catch (error) {
      apiLogger.error('NewsService', 'getTrendingTopics', error);
      throw error;
    }
  }

  // Get news by sentiment
  async getNewsBySentiment(sentiment, limit = 20) {
    try {
      const news = await News.find({
        sentiment,
        isActive: true
      })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .select('-content');

      return news;
    } catch (error) {
      apiLogger.error('NewsService', 'getNewsBySentiment', error, { sentiment });
      throw error;
    }
  }

  // Search news
  async searchNews(query, options = {}) {
    try {
      const {
        category,
        sentiment,
        limit = 20,
        page = 1,
        sortBy = 'publishedAt'
      } = options;

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
        searchQuery.$and.push({ category });
      }

      if (sentiment) {
        searchQuery.$and.push({ sentiment });
      }

      const skip = (page - 1) * limit;
      const sortOrder = sortBy === 'publishedAt' ? { publishedAt: -1 } : { [sortBy]: -1 };

      const news = await News.find(searchQuery)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .select('-content');

      const total = await News.countDocuments(searchQuery);

      return {
        news,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          count: news.length,
          totalItems: total
        }
      };

    } catch (error) {
      apiLogger.error('NewsService', 'searchNews', error, { query, options });
      throw error;
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new NewsService();