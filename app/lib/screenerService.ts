import { AuthClient } from './apiService';

export interface ScreenedStock {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
  peRatio: number;
  sector: string;
  volume: string;
  technicalScore: number;
  fundamentalScore: number;
  pattern: string;
}

export interface PresetScreen {
  name: string;
  description: string;
  criteria: string;
  count: number;
  filters?: {
    marketCap?: string;
    sector?: string;
    peRatioMin?: string;
    peRatioMax?: string;
    priceChange?: string;
    volume?: string;
    technicalPattern?: string;
  };
}

export interface ScreeningStatistics {
  totalStocks: number;
  filteredResults: number;
  bullishSignals: number;
  highConfidence: number;
  sectorBreakdown: Record<string, number>;
  marketCapBreakdown: Record<string, number>;
}

export interface ScreeningFilters {
  marketCap?: string;
  sector?: string;
  peRatioMin?: string;
  peRatioMax?: string;
  priceChange?: string;
  volume?: string;
  technicalPattern?: string;
  limit?: number;
  page?: number;
}

class ScreenerService {
  private baseURL = 'http://localhost:5002/api/screener';

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...AuthClient.authHeaders(),
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Screener service error:', error);
      throw error;
    }
  }

  async getScreenedStocks(filters: ScreeningFilters = {}): Promise<{
    stocks: ScreenedStock[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const data = await this.makeRequest(`/stocks?${params.toString()}`);
      
      if (data.status === 'success') {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to fetch screened stocks');
      }
    } catch (error: any) {
      console.error('Error fetching screened stocks:', error);
      // Return fallback data
      return {
        stocks: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0
        }
      };
    }
  }

  async getPresetScreens(): Promise<PresetScreen[]> {
    try {
      const data = await this.makeRequest('/presets');
      
      if (data.status === 'success') {
        return data.data.presets;
      } else {
        throw new Error(data.message || 'Failed to fetch preset screens');
      }
    } catch (error: any) {
      console.error('Error fetching preset screens:', error);
      // Return fallback data
      return [
        {
          name: 'Momentum Stocks',
          description: 'Stocks with strong price momentum and volume',
          criteria: 'Price change > 5%, Volume > 2x avg',
          count: 23
        },
        {
          name: 'Value Picks',
          description: 'Undervalued stocks with strong fundamentals',
          criteria: 'P/E < 15, ROE > 15%, Debt/Equity < 0.5',
          count: 18
        },
        {
          name: 'Breakout Candidates',
          description: 'Stocks near technical breakout levels',
          criteria: 'Near 52-week high, Volume surge',
          count: 31
        },
        {
          name: 'Dividend Aristocrats',
          description: 'Consistent dividend paying companies',
          criteria: 'Dividend yield > 2%, 5yr consistency',
          count: 15
        }
      ];
    }
  }

  async getStatistics(): Promise<ScreeningStatistics> {
    try {
      const data = await this.makeRequest('/statistics');
      
      if (data.status === 'success') {
        return data.data.statistics;
      } else {
        throw new Error(data.message || 'Failed to fetch screening statistics');
      }
    } catch (error: any) {
      console.error('Error fetching screening statistics:', error);
      // Return fallback data
      return {
        totalStocks: 2847,
        filteredResults: 156,
        bullishSignals: 89,
        highConfidence: 23,
        sectorBreakdown: {
          'Banking': 45,
          'IT Services': 38,
          'Automobile': 25,
          'Pharmaceuticals': 20,
          'Oil & Gas': 15,
          'Others': 13
        },
        marketCapBreakdown: {
          'Large Cap': 120,
          'Mid Cap': 25,
          'Small Cap': 11
        }
      };
    }
  }

  async applyPresetScreen(preset: PresetScreen): Promise<ScreenedStock[]> {
    if (!preset.filters) {
      return [];
    }

    try {
      const result = await this.getScreenedStocks(preset.filters);
      return result.stocks;
    } catch (error: any) {
      console.error('Error applying preset screen:', error);
      return [];
    }
  }
}

export const screenerService = new ScreenerService();
