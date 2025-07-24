import { apiService, APIConfiguration } from './apiService';

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
    this.initializeData();
  }

  private async initializeData() {
    // Initial fetch for market data
    await this.fetchMarketData();
    this.notifySubscribers();

    // Initial fetch for news data
    await this.fetchNewsData();
    this.notifyNewsSubscribers();
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
      await this.fetchMarketData();
      this.notifySubscribers();
    }, 5000); // Update every 5 seconds

    this.newsInterval = setInterval(async () => {
      await this.fetchNewsData();
      this.notifyNewsSubscribers();
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
    try {
      const indicesAPI = apiService.getAllAPIs().find(api => api.name === 'Indian Market Indices');
      if (indicesAPI) {
        const response = await apiService.testAPIConnection(indicesAPI.id);
        if (response.success && response.data && response.data.indices) {
          const indices = response.data.indices;
          this.currentData = {
            nifty: this.mapToStockPrice(indices['^NSEI']),
            sensex: this.mapToStockPrice(indices['^BSESN']),
            bankNifty: this.mapToStockPrice(indices['^NSEBANK'])
          };
        }
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  }

  private async fetchNewsData() {
    // Placeholder for news fetching. This will be implemented in Phase 2.
    // For now, keep the simulated news or fetch from a simple placeholder API if available.
    // For demonstration, we'll keep the simulated news generation for now.
    this.generateRandomNews();
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

  // Simulate API calls for stock search
  async searchStocks(query: string): Promise<any[]> {
    try {
      const response = await fetch(`http://localhost:5001/api/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: [query.toUpperCase()] })
      });
      const data = await response.json();
      if (data.results && data.results[query.toUpperCase()] && data.results[query.toUpperCase()].status === 'success') {
        const stock = data.results[query.toUpperCase()];
        return [{
          symbol: stock.symbol,
          name: stock.symbol, // Assuming name is same as symbol for now
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent,
          volume: stock.volume
        }];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error searching stocks:', error);
      return [];
    }
  }

  // Get detailed stock information
  async getStockDetails(symbol: string): Promise<any> {
    try {
      const response = await fetch(`http://localhost:5001/api/stock/${symbol}`);
      const data = await response.json();
      if (data.status === 'success') {
        return {
          symbol: data.symbol,
          lastUpdated: new Date(data.timestamp).toISOString(),
          fundamentals: {
            'PE ratio': (data.regularMarketPrice / (data.chartPreviousClose || 1)).toFixed(2), // Simple PE ratio for now
            'Market Cap': data.marketCap || 'N/A'
          },
          technical: {
            'Day High': data.regularMarketDayHigh,
            'Day Low': data.regularMarketDayLow
          }
        };
      } else {
        return {};
      }
    } catch (error) {
      console.error('Error getting stock details:', error);
      return {};
    }
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

