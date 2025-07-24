// API Service - Handles all API configurations and connections
export interface APIConfiguration {
  id: string;
  name: string;
  provider: string;
  category: string;
  apiKey?: string;
  endpoint: string;
  description: string;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  lastUpdate: string;
  latency: string;
  requestsToday: number;
  rateLimit: string;
  createdAt: string;
  lastTested?: string;
  headers?: { [key: string]: string };
  parameters?: { [key: string]: string };
}

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  latency?: string;
  connected?: boolean;
}

class APIService {
  private subscribers: ((apis: APIConfiguration[]) => void)[] = [];
  private apis: APIConfiguration[] = [];
  private baseURL = 'http://localhost:5001/api';

  constructor() {
    this.loadAPIs();
  }

  // Load APIs from backend
  private async loadAPIs() {
    try {
      const response = await fetch(`${this.baseURL}/config/apis`);
      const data = await response.json();
      
      if (data.status === 'success') {
        this.apis = data.apis;
        this.notifySubscribers();
      }
    } catch (error) {
      console.error('Failed to load APIs:', error);
      // Initialize with default configurations if backend is not available
      this.initializeDefaultAPIs();
    }
  }

  // Subscribe to API updates
  subscribe(callback: (apis: APIConfiguration[]) => void) {
    this.subscribers.push(callback);
    callback(this.apis);
  }

  // Unsubscribe from updates
  unsubscribe(callback: (apis: APIConfiguration[]) => void) {
    this.subscribers = this.subscribers.filter(sub => sub !== callback);
  }

  // Notify all subscribers
  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.apis));
  }

  // Add new API configuration
  async addAPI(config: Omit<APIConfiguration, 'id' | 'status' | 'lastUpdate' | 'latency' | 'requestsToday' | 'createdAt' | 'lastTested'>): Promise<APIConfiguration> {
    try {
      const response = await fetch(`${this.baseURL}/config/apis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        this.apis.push(data.api);
        this.notifySubscribers();
        return data.api;
      } else {
        throw new Error(data.message || 'Failed to add API');
      }
    } catch (error) {
      console.error('Error adding API:', error);
      throw error;
    }
  }

  // Update API configuration
  async updateAPI(id: string, updates: Partial<APIConfiguration>): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/config/apis/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        const index = this.apis.findIndex(api => api.id === id);
        if (index !== -1) {
          this.apis[index] = data.api;
          this.notifySubscribers();
        }
        return true;
      } else {
        throw new Error(data.message || 'Failed to update API');
      }
    } catch (error) {
      console.error('Error updating API:', error);
      throw error;
    }
  }

  // Delete API configuration
  deleteAPI(id: string): boolean {
    try {
      fetch(`${this.baseURL}/config/apis/${id}`, {
        method: 'DELETE'
      }).then(response => response.json()).then(data => {
        if (data.status === 'success') {
          this.apis = this.apis.filter(api => api.id !== id);
          this.notifySubscribers();
        }
      });
      return true;
    } catch (error) {
      console.error('Error deleting API:', error);
      return false;
    }
  }

  // Test API connection
  async testAPIConnection(id: string): Promise<APIResponse> {
    try {
      const response = await fetch(`${this.baseURL}/config/apis/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      // Update local API status
      const apiIndex = this.apis.findIndex(api => api.id === id);
      if (apiIndex !== -1) {
        this.apis[apiIndex].status = data.connected ? 'connected' : 'error';
        this.apis[apiIndex].latency = data.latency || '0ms';
        this.apis[apiIndex].lastTested = new Date().toISOString();
        this.notifySubscribers();
      }
      
      return {
        success: data.status === 'success',
        data: data.data,
        error: data.error,
        latency: data.latency,
        connected: data.connected
      };
    } catch (error) {
      console.error('Error testing API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Test all APIs
  async testAllAPIs(): Promise<void> {
    const promises = this.apis.map(api => this.testAPIConnection(api.id));
    await Promise.all(promises);
  }

  // Get cached data for an API
  async getCachedData(apiId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/config/apis/${apiId}/data`);
      const data = await response.json();
      
      if (data.status === 'success') {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  // Get API statistics
  async getAPIStats() {
    try {
      const response = await fetch(`${this.baseURL}/config/stats`);
      const data = await response.json();
      
      if (data.status === 'success') {
        return data.stats;
      }
    } catch (error) {
      console.error('Error getting API stats:', error);
    }
    
    // Fallback stats
    return {
      connected: this.apis.filter(api => api.status === 'connected').length,
      totalRequests: this.apis.reduce((sum, api) => sum + api.requestsToday, 0),
      uptime: 99.9,
      avgLatency: 150
    };
  }

  // Get APIs by category
  getAPIsByCategory(category: string): APIConfiguration[] {
    return this.apis.filter(api => api.category === category);
  }

  // Get connected APIs
  getConnectedAPIs(): APIConfiguration[] {
    return this.apis.filter(api => api.status === 'connected');
  }

  // Get all APIs
  getAllAPIs(): APIConfiguration[] {
    return this.apis;
  }

  // Initialize default APIs for demo purposes
  private initializeDefaultAPIs() {
    this.apis = [
      {
        id: 'yahoo_finance_demo',
        name: 'Yahoo Finance',
        provider: 'Yahoo',
        category: 'market-data',
        endpoint: 'https://query1.finance.yahoo.com/v8/finance/chart',
        description: 'Real-time market data from Yahoo Finance',
        status: 'disconnected',
        lastUpdate: new Date().toISOString(),
        latency: '0ms',
        requestsToday: 0,
        rateLimit: '2000/day',
        createdAt: new Date().toISOString()
      },
      {
        id: 'alpha_vantage_demo',
        name: 'Alpha Vantage',
        provider: 'Alpha Vantage',
        category: 'market-data',
        endpoint: 'https://www.alphavantage.co/query',
        description: 'Premium financial data and technical indicators',
        status: 'disconnected',
        lastUpdate: new Date().toISOString(),
        latency: '0ms',
        requestsToday: 0,
        rateLimit: '500/day',
        createdAt: new Date().toISOString()
      }
    ];
    this.notifySubscribers();
  }
}

export const apiService = new APIService();

