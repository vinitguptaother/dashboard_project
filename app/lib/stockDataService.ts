import { buildApiUrl } from './config';

// Note: This service fetches live data from the backend API

// Stock Data Service - Simulates real-time data and backend operations
export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
}

export interface MarketData {
  nifty: StockPrice;
  sensex: StockPrice;
  bankNifty: StockPrice;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  impact: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
  source: string;
  relevantStocks: string[];
  url?: string;
}

class StockDataService {
  private subscribers: ((data: MarketData) => void)[] = [];
  private newsSubscribers: ((news: NewsItem[]) => void)[] = [];
  private currentData: MarketData = {
    nifty: { symbol: 'NIFTY', price: 0, change: 0, changePercent: 0, volume: 0, timestamp: new Date() },
    sensex: { symbol: 'SENSEX', price: 0, change: 0, changePercent: 0, volume: 0, timestamp: new Date() },
    bankNifty: { symbol: 'BANKNIFTY', price: 0, change: 0, changePercent: 0, volume: 0, timestamp: new Date() }
  };
  private newsData: NewsItem[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  private newsInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Add small delay to allow backend to be ready
    setTimeout(() => {
      this.initializeData();
    }, 1000);
  }

  private async initializeData() {
    console.log('🚀 Initializing stock data service...');
    
    // Try to fetch market data with retries
    await this.fetchMarketDataWithRetry();
    this.notifySubscribers();

    // Try to fetch news data with retries
    await this.fetchNewsDataWithRetry();
    this.notifyNewsSubscribers();
  }

  private async fetchMarketDataWithRetry(retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.fetchMarketData();
        return; // Success, exit retry loop
      } catch (error: any) {
        if (i === retries - 1) {
          console.warn(`❌ Failed to fetch market data after ${retries} attempts`);
          this.generateFallbackMarketData();
          return;
        }
        console.log(`🔄 Retry ${i + 1}/${retries} for market data in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async fetchNewsDataWithRetry(retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.fetchNewsData();
        return; // Success, exit retry loop
      } catch (error: any) {
        if (i === retries - 1) {
          console.warn(`❌ Failed to fetch news data after ${retries} attempts`);
          this.initializeFallbackNews();
          return;
        }
        console.log(`🔄 Retry ${i + 1}/${retries} for news data in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Subscribe to real-time market data updates
  subscribe(callback: (data: MarketData) => void) {
    this.subscribers.push(callback);
    callback(this.currentData); // Send initial data
  }

  // Subscribe to news updates
  subscribeToNews(callback: (news: NewsItem[]) => void) {
    this.newsSubscribers.push(callback);
    callback(this.newsData); // Send initial news
  }

  // Unsubscribe from updates
  unsubscribe(callback: (data: MarketData) => void) {
    this.subscribers = this.subscribers.filter(sub => sub !== callback);
  }

  unsubscribeFromNews(callback: (news: NewsItem[]) => void) {
    this.newsSubscribers = this.newsSubscribers.filter(sub => sub !== callback);
  }

  // Start real-time data updates
  startRealTimeUpdates() {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(async () => {
      try {
        await this.fetchMarketData();
        this.notifySubscribers();
      } catch (error: any) {
        console.warn('⚠️  Real-time market data update failed, using existing data');
      }
    }, 5000); // Update every 5 seconds

    this.newsInterval = setInterval(async () => {
      try {
        await this.fetchNewsData();
        this.notifyNewsSubscribers();
      } catch (error: any) {
        console.warn('⚠️  Real-time news update failed, using existing data');
      }
    }, 30000); // New news every 30 seconds
  }

  // Stop real-time updates
  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.newsInterval) {
      clearInterval(this.newsInterval);
      this.newsInterval = null;
    }
  }

  private async fetchMarketData() {
    const resp = await fetch(buildApiUrl('/api/market/indices'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!resp.ok) {
      throw new Error(`Indices fetch failed: ${resp.status} ${resp.statusText}`);
    }
    
    const json = await resp.json();
    const data = json?.data;
    
    if (data && data.NIFTY && data.SENSEX && data.BANKNIFTY) {
      this.currentData = {
        nifty: this.mapToStockPrice(data.NIFTY),
        sensex: this.mapToStockPrice(data.SENSEX),
        bankNifty: this.mapToStockPrice(data.BANKNIFTY)
      };
      console.log('✅ Successfully fetched live market data from backend');
    } else {
      throw new Error('Invalid data format received from backend');
    }
  }

  private async fetchNewsData() {
    // Use /api/news/live (real-time RSS feeds from ET, MC, BS) as primary source.
    // Falls back to /api/news (MongoDB cache) if RSS fetch fails.
    const resp = await fetch(buildApiUrl('/api/news/live'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout (RSS needs a bit more time)
    });
    
    if (!resp.ok) {
      throw new Error(`News fetch failed: ${resp.status} ${resp.statusText}`);
    }
    
    const json = await resp.json();
    const payload = json?.data;
    const items = Array.isArray(payload?.news) ? payload.news : [];

    const mapped: NewsItem[] = items.map((n: any, idx: number) => {
      const text = `${n.title || ''} ${n.summary || ''}`.toLowerCase();
      // Auto-categorize based on keywords if category is generic
      let category = n.category || 'market-news';
      if (category === 'market-news') {
        if (/\b(earnings|quarterly|q[1-4]|results|profit|revenue|net income|eps|dividend|bonus)\b/.test(text)) {
          category = 'earnings';
        } else if (/\b(rbi|fed|rate cut|rate hike|policy|inflation|gdp|fiscal|budget|sebi|regulation|compliance)\b/.test(text)) {
          category = 'monetary-policy';
        } else if (/\b(fii|dii|fpi|flows|buying|selling|institutional|foreign|domestic|mutual fund|etf)\b/.test(text)) {
          category = 'market-flows';
        } else if (/\b(sector|pharma|banking|auto|it sector|fmcg|metal|energy|realty|infra|telecom|cement)\b/.test(text)) {
          category = 'sector-news';
        }
      }
      return {
        id: n._id || n.id || `rss-${idx}-${n.title?.slice(0, 20) || idx}`,
        title: n.title,
        summary: n.summary,
        category,
        impact: (n.sentiment === 'positive'
          ? 'positive'
          : n.sentiment === 'negative'
          ? 'negative'
          : 'neutral') as 'positive' | 'negative' | 'neutral',
        timestamp: new Date(n.publishedAt || n.createdAt || Date.now()),
        source: n.source || 'Unknown',
        relevantStocks: Array.isArray(n.relevantStocks) ? n.relevantStocks : [],
        url: n.url || '',
      };
    });

    this.newsData = mapped;
    console.log('📰 Successfully fetched news data from backend');
  }

  private mapToStockPrice(data: any): StockPrice {
    return {
      symbol: data.symbol || '',
      price: data.price || 0,
      change: data.change || 0,
      changePercent: data.changePercent || 0,
      volume: data.volume || 0,
      timestamp: new Date(data.timestamp) || new Date(),
      dayHigh: data.dayHigh || 0,
      dayLow: data.dayLow || 0,
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.currentData));
  }

  private notifyNewsSubscribers() {
    this.newsSubscribers.forEach(callback => callback(this.newsData));
  }

  // Get current market data
  getCurrentData(): MarketData {
    return this.currentData;
  }

  // Get current news
  getCurrentNews(): NewsItem[] {
    return this.newsData;
  }

  // Test backend connection health
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(buildApiUrl('/health'), {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error: any) {
      console.warn('🚑 Backend health check failed:', error.message);
      return false;
    }
  }

  // Simulate API calls for stock search
  async searchStocks(query: string): Promise<any[]> {
    try {
      const response = await fetch(buildApiUrl(`/api/market/search/${encodeURIComponent(query)}`));
      if (!response.ok) return [];
      const json = await response.json();
      const results = json?.data?.results || [];
      return results.map((r: any) => ({
        symbol:        r.symbol,
        name:          r.name || r.symbol,   // fix: was incorrectly using symbol as name
        exchange:      r.exchange || 'NSE',
        instrumentKey: r.instrumentKey || '', // for Upstox LTP lookup
        isin:          r.isin || '',
        price:         r.price,
        change:        r.change,
        changePercent: r.changePercent,
        volume:        r.volume,
        lastUpdated:   r.lastUpdated
      }));
    } catch (error: any) {
      console.error('Error searching stocks:', error);
      return [];
    }
  }

  // Get detailed stock information
  async getStockDetails(symbol: string): Promise<any> {
    try {
      const response = await fetch(buildApiUrl(`/api/market/stock/${encodeURIComponent(symbol)}`));
      if (!response.ok) return {};
      const json = await response.json();
      const data = json?.data;
      if (json.status === 'success' && data) {
        return {
          symbol: data.symbol,
          lastUpdated: new Date(data.timestamp).toISOString(),
          fundamentals: {
            'Market Cap': data.marketCap ?? 'N/A'
          },
          technical: {
            'Day High': data.dayHigh,
            'Day Low': data.dayLow,
            'Previous Close': data.previousClose
          }
        };
      }
      return {};
    } catch (error: any) {
      console.error('Error getting stock details:', error);
      return {};
    }
  }

  private initializeFallbackNews() {
    const fallbackNews: NewsItem[] = [
      {
        id: '1',
        title: 'Market Opens Higher on Positive Global Cues',
        summary: 'Indian markets opened on a positive note following strong overnight gains in global markets.',
        category: 'market-news',
        impact: 'positive',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        source: 'Market Demo',
        relevantStocks: ['NIFTY', 'SENSEX'],
        url: '',
      },
      {
        id: '2',
        title: 'Banking Sector Shows Strong Performance',
        summary: 'Private sector banks lead the rally with HDFC Bank and ICICI Bank gaining momentum.',
        category: 'sector-news',
        impact: 'positive',
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        source: 'Sector Watch',
        relevantStocks: ['HDFC BANK', 'ICICI BANK'],
        url: '',
      },
      {
        id: '3',
        title: 'IT Stocks Under Pressure Due to US Fed Concerns',
        summary: 'Information Technology sector faces headwinds as investors worry about Federal Reserve policy.',
        category: 'sector-news',
        impact: 'negative',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        source: 'Tech Analysis',
        relevantStocks: ['TCS', 'INFOSYS', 'WIPRO'],
        url: '',
      }
    ];
    
    this.newsData = fallbackNews;
    console.log('Using fallback news data for demo purposes');
  }

  private generateFallbackMarketData() {
    // Generate realistic fallback data when backend is not available
    const baseNifty = 19850;
    const baseSensex = 66590;
    const baseBankNifty = 44890;
    
    const niftyChange = (Math.random() - 0.5) * 200; // ±100 points
    const sensexChange = (Math.random() - 0.5) * 700; // ±350 points
    const bankNiftyChange = (Math.random() - 0.5) * 300; // ±150 points
    
    this.currentData = {
      nifty: {
        symbol: 'NIFTY',
        price: baseNifty + niftyChange,
        change: niftyChange,
        changePercent: (niftyChange / baseNifty) * 100,
        volume: Math.floor(Math.random() * 1000000) + 500000,
        timestamp: new Date(),
        dayHigh: baseNifty + Math.abs(niftyChange) + 50,
        dayLow: baseNifty - Math.abs(niftyChange) - 50
      },
      sensex: {
        symbol: 'SENSEX',
        price: baseSensex + sensexChange,
        change: sensexChange,
        changePercent: (sensexChange / baseSensex) * 100,
        volume: Math.floor(Math.random() * 800000) + 400000,
        timestamp: new Date(),
        dayHigh: baseSensex + Math.abs(sensexChange) + 150,
        dayLow: baseSensex - Math.abs(sensexChange) - 150
      },
      bankNifty: {
        symbol: 'BANKNIFTY',
        price: baseBankNifty + bankNiftyChange,
        change: bankNiftyChange,
        changePercent: (bankNiftyChange / baseBankNifty) * 100,
        volume: Math.floor(Math.random() * 600000) + 300000,
        timestamp: new Date(),
        dayHigh: baseBankNifty + Math.abs(bankNiftyChange) + 100,
        dayLow: baseBankNifty - Math.abs(bankNiftyChange) - 100
      }
    };
    
    console.log('Using fallback market data for demo purposes');
  }

  private generateRandomNews() {
    const newsTemplates = [
      {
        title: 'FII Activity Shows Strong Buying Interest in Banking Sector',
        summary: 'Foreign institutional investors continue to show confidence in Indian banking stocks.',
        category: 'market-flows',
        impact: 'positive' as const,
        source: 'CNBC TV18',
        relevantStocks: ['HDFC BANK', 'ICICI BANK', 'AXIS BANK']
      },
      {
        title: 'Auto Sales Data Shows Festive Season Boost',
        summary: 'Automobile manufacturers report strong sales figures for the festive period.',
        category: 'sector-news',
        impact: 'positive' as const,
        source: 'Moneycontrol',
        relevantStocks: ['MARUTI SUZUKI', 'TATA MOTORS', 'BAJAJ AUTO']
      },
      {
        title: 'Crude Oil Prices Impact Energy Sector Outlook',
        summary: 'Rising crude oil prices affect margins for oil marketing companies.',
        category: 'sector-news',
        impact: 'negative' as const,
        source: 'Economic Times',
        relevantStocks: ['RELIANCE', 'ONGC', 'IOC']
      }
    ];

    const randomNews = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
    const newNewsItem: NewsItem = {
      id: Date.now().toString(),
      ...randomNews,
      timestamp: new Date()
    };

    this.newsData.unshift(newNewsItem);
    if (this.newsData.length > 10) {
      this.newsData = this.newsData.slice(0, 10);
    }

    this.notifyNewsSubscribers();
  }
}

export const stockDataService = new StockDataService();

