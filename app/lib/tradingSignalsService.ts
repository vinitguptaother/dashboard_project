import { AuthClient } from './apiService';

export interface TradingSignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  price: number;
  technicalIndicators: {
    rsi: number;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    bbUpper: number;
    bbMiddle: number;
    bbLower: number;
  };
  timestamp: string;
}

export interface TradingOpportunity {
  symbol: string;
  price: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  timeframe: string;
  entry: number;
  target: number;
  stopLoss: number;
  confidence: number;
  technicalPattern: string;
  fundamentalScore: number;
  reason: string;
  riskReward: number;
  potentialReturn: number;
}

export interface SectorAnalysis {
  sector: string;
  trend: 'Bullish' | 'Bearish' | 'Neutral';
  strength: number;
  opportunities: number;
  topStocks: string[];
  reason: string;
}

export interface TradingPerformance {
  successRate: number;
  avgRiskReward: number;
  avgHoldDays: number;
  monthlyReturn: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winLossRatio: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
}

export interface TechnicalIndicators {
  symbol: string;
  timeframe: string;
  price: number;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  volume: {
    current: number;
    average: number;
    ratio: number;
  };
  support: number;
  resistance: number;
  timestamp: string;
}

class TradingSignalsService {
  private baseURL = 'http://localhost:5002/api/trading';

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
      console.error('Trading signals service error:', error);
      throw error;
    }
  }

  async getTradingSignals(symbol: string = 'NIFTY 50', timeframe: string = 'daily', limit: number = 20): Promise<TradingSignal[]> {
    try {
      const params = new URLSearchParams({
        symbol,
        timeframe,
        limit: limit.toString()
      });

      const data = await this.makeRequest(`/signals?${params.toString()}`);
      
      if (data.status === 'success') {
        return data.data.signals;
      } else {
        throw new Error(data.message || 'Failed to fetch trading signals');
      }
    } catch (error: any) {
      console.error('Error fetching trading signals:', error);
      return [];
    }
  }

  async getTradingOpportunities(): Promise<TradingOpportunity[]> {
    try {
      const data = await this.makeRequest('/trading-opportunities');
      
      if (data.status === 'success') {
        return data.data.opportunities;
      } else {
        throw new Error(data.message || 'Failed to fetch trading opportunities');
      }
    } catch (error: any) {
      console.error('Error fetching trading opportunities:', error);
      return [];
    }
  }

  async getSectorAnalysis(): Promise<SectorAnalysis[]> {
    try {
      const data = await this.makeRequest('/sector-analysis');
      
      if (data.status === 'success') {
        return data.data.sectorAnalysis;
      } else {
        throw new Error(data.message || 'Failed to fetch sector analysis');
      }
    } catch (error: any) {
      console.error('Error fetching sector analysis:', error);
      return [];
    }
  }

  async getPerformanceMetrics(): Promise<TradingPerformance | null> {
    try {
      const data = await this.makeRequest('/performance');
      
      if (data.status === 'success') {
        return data.data.performance;
      } else {
        throw new Error(data.message || 'Failed to fetch performance metrics');
      }
    } catch (error: any) {
      console.error('Error fetching performance metrics:', error);
      return null;
    }
  }

  async getTechnicalIndicators(symbol: string, timeframe: string = 'daily'): Promise<TechnicalIndicators | null> {
    try {
      const params = new URLSearchParams({ timeframe });
      const data = await this.makeRequest(`/technical-indicators/${symbol}?${params.toString()}`);
      
      if (data.status === 'success') {
        return data.data.indicators;
      } else {
        throw new Error(data.message || 'Failed to fetch technical indicators');
      }
    } catch (error: any) {
      console.error('Error fetching technical indicators:', error);
      return null;
    }
  }

  getSignalColor(signal: string): string {
    switch (signal) {
      case 'BUY': return 'text-green-600 bg-green-50';
      case 'SELL': return 'text-red-600 bg-red-50';
      case 'HOLD': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  }

  getTrendColor(trend: string): string {
    switch (trend) {
      case 'Bullish': return 'text-green-600';
      case 'Bearish': return 'text-red-600';
      case 'Neutral': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  }

  calculateRiskReward(entry: number, target: number, stopLoss: number): number {
    const potentialProfit = Math.abs(target - entry);
    const potentialLoss = Math.abs(entry - stopLoss);
    return potentialLoss > 0 ? potentialProfit / potentialLoss : 0;
  }

  calculatePotentialReturn(entry: number, target: number): number {
    return ((target - entry) / entry) * 100;
  }
}

export const tradingSignalsService = new TradingSignalsService();
