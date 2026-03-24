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
  // Broker-specific optional fields
  appId?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  twoFA?: string;
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
  private baseURL = 'http://localhost:5002/api';
  private initialized = false;

  constructor() {
    // Don't automatically load APIs on construction to avoid auth issues
    // Initialize with default APIs instead
    this.initializeDefaultAPIs();
  }

  // Load APIs from backend (requires authentication)
  async loadAPIs() {
    try {
      // Only try to load if we have authentication
      const token = AuthClient.token;
      if (!token) {
        console.warn('No authentication token available, using default APIs');
        this.initializeDefaultAPIs();
        return;
      }

      const response = await fetch(`${this.baseURL}/config/apis`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        this.apis = data.apis;
        this.initialized = true;
        this.notifySubscribers();
      } else {
        throw new Error(data.message || 'Failed to load APIs');
      }
    } catch (error: any) {
      console.error('Failed to load APIs:', error);
      // Initialize with default configurations if backend is not available or auth fails
      if (!this.initialized) {
        this.initializeDefaultAPIs();
      }
    }
  }

  // Subscribe to API updates
  subscribe(callback: (apis: APIConfiguration[]) => void) {
    this.subscribers.push(callback);
    callback(this.apis);
    
    // If we haven't loaded APIs from backend yet and we have auth, try to load them
    if (!this.initialized && AuthClient.token) {
      this.loadAPIs().catch(console.error);
    }
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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

  // Refresh APIs after authentication becomes available
  async refreshAPIs(): Promise<void> {
    if (AuthClient.token && !this.initialized) {
      await this.loadAPIs();
    }
  }

  // Check if APIs are loaded from backend
  isInitialized(): boolean {
    return this.initialized;
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
    this.initialized = true; // Mark as initialized with defaults
    this.notifySubscribers();
  }
}

export const apiService = new APIService();

// Auth and Portfolio clients for backend
export class AuthClient {
  static get baseUrl() {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
  }

  static get token(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  static set token(value: string | null) {
    if (typeof window === 'undefined') return;
    if (value) localStorage.setItem('auth_token', value);
    else localStorage.removeItem('auth_token');
  }

  static async login(email: string, password: string) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(10000)
      });
      
      const json = await resp.json();
      
      if (!resp.ok || json.status !== 'success') {
        throw new Error(json.message || 'Login failed');
      }
      
      const token = json?.data?.token as string;
      this.token = token;
      console.log('✅ Successfully logged in');
      return json?.data;
    } catch (error: any) {
      console.error('❌ Login failed:', error.message);
      throw error; // Re-throw for the calling component to handle
    }
  }

  static logout() {
    this.token = null;
  }

  static authHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const t = this.token;
    if (t) headers['Authorization'] = `Bearer ${t}`;
    return headers;
  }
}

export class PortfolioClient {
  static get baseUrl() {
    return AuthClient.baseUrl;
  }

  static async list() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/portfolio`, {
        method: 'GET',
        headers: AuthClient.authHeaders(),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!resp.ok) {
        throw new Error(`Portfolio list fetch failed: ${resp.status} ${resp.statusText}`);
      }
      
      return await resp.json();
    } catch (error: any) {
      console.warn('⚠️  Failed to fetch portfolios:', error.message);
      return {
        status: 'success',
        data: {
          portfolios: [],
          total: 0
        }
      };
    }
  }

  static async create(payload: { name: string; description?: string; type?: 'equity' | 'mutual_fund' | 'mixed' }) {
    const resp = await fetch(`${this.baseUrl}/api/portfolio`, {
      method: 'POST',
      headers: AuthClient.authHeaders(),
      body: JSON.stringify(payload)
    });
    return await resp.json();
  }

  static async remove(id: string) {
    const resp = await fetch(`${this.baseUrl}/api/portfolio/${id}`, {
      method: 'DELETE',
      headers: AuthClient.authHeaders()
    });
    return await resp.json();
  }

  static async addPosition(id: string, payload: { symbol: string; quantity: number; averagePrice: number; exchange?: 'NSE' | 'BSE' }) {
    const resp = await fetch(`${this.baseUrl}/api/portfolio/${id}/position`, {
      method: 'POST',
      headers: AuthClient.authHeaders(),
      body: JSON.stringify(payload)
    });
    return await resp.json();
  }

  static async updatePosition(id: string, positionId: string, payload: { quantity?: number; averagePrice?: number }) {
    const resp = await fetch(`${this.baseUrl}/api/portfolio/${id}/position/${positionId}`, {
      method: 'PUT',
      headers: AuthClient.authHeaders(),
      body: JSON.stringify(payload)
    });
    return await resp.json();
  }

  static async removePosition(id: string, positionId: string) {
    const resp = await fetch(`${this.baseUrl}/api/portfolio/${id}/position/${positionId}`, {
      method: 'DELETE',
      headers: AuthClient.authHeaders()
    });
    return await resp.json();
  }
}

export class AlertClient {
  static get baseUrl() {
    return AuthClient.baseUrl;
  }

  static async list(options: { status?: string; limit?: number; page?: number } = {}) {
    try {
      const params = new URLSearchParams();
      if (options.status) params.append('status', options.status);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.page) params.append('page', options.page.toString());

      const resp = await fetch(`${this.baseUrl}/api/alerts?${params}`, {
        method: 'GET',
        headers: AuthClient.authHeaders(),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!resp.ok) {
        throw new Error(`Alert list fetch failed: ${resp.status} ${resp.statusText}`);
      }
      
      return await resp.json();
    } catch (error: any) {
      console.warn('⚠️  Failed to fetch alerts from backend:', error.message);
      // Return fallback structure when backend is unavailable
      return {
        status: 'success',
        data: {
          alerts: [],
          total: 0,
          page: 1,
          totalPages: 0
        }
      };
    }
  }

  static async create(payload: { 
    symbol: string; 
    condition: 'above' | 'below' | 'change_percent'; 
    targetValue: number; 
    alertType?: 'price' | 'volume' | 'change'; 
    message?: string; 
    isActive?: boolean 
  }) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/alerts`, {
        method: 'POST',
        headers: AuthClient.authHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!resp.ok) {
        throw new Error(`Alert create failed: ${resp.status} ${resp.statusText}`);
      }
      
      return await resp.json();
    } catch (error: any) {
      console.warn('⚠️  Failed to create alert:', error.message);
      return {
        status: 'error',
        message: 'Failed to create alert - backend unavailable'
      };
    }
  }

  static async update(id: string, payload: { 
    condition?: 'above' | 'below' | 'change_percent'; 
    targetValue?: number; 
    message?: string; 
    isActive?: boolean 
  }) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/alerts/${id}`, {
        method: 'PUT',
        headers: AuthClient.authHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!resp.ok) {
        throw new Error(`Alert update failed: ${resp.status} ${resp.statusText}`);
      }
      
      return await resp.json();
    } catch (error: any) {
      console.warn('⚠️  Failed to update alert:', error.message);
      return {
        status: 'error',
        message: 'Failed to update alert - backend unavailable'
      };
    }
  }

  static async delete(id: string) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/alerts/${id}`, {
        method: 'DELETE',
        headers: AuthClient.authHeaders(),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!resp.ok) {
        throw new Error(`Alert delete failed: ${resp.status} ${resp.statusText}`);
      }
      
      return await resp.json();
    } catch (error: any) {
      console.warn('⚠️  Failed to delete alert:', error.message);
      return {
        status: 'error',
        message: 'Failed to delete alert - backend unavailable'
      };
    }
  }

  static async acknowledge(id: string) {
    try {
      const resp = await fetch(`${this.baseUrl}/api/alerts/${id}/acknowledge`, {
        method: 'PUT',
        headers: AuthClient.authHeaders(),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!resp.ok) {
        throw new Error(`Alert acknowledge failed: ${resp.status} ${resp.statusText}`);
      }
      
      return await resp.json();
    } catch (error: any) {
      console.warn('⚠️  Failed to acknowledge alert:', error.message);
      return {
        status: 'error',
        message: 'Failed to acknowledge alert - backend unavailable'
      };
    }
  }

  static async getStats() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/alerts/stats`, {
        method: 'GET',
        headers: AuthClient.authHeaders(),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!resp.ok) {
        throw new Error(`Alert stats fetch failed: ${resp.status} ${resp.statusText}`);
      }
      
      return await resp.json();
    } catch (error: any) {
      console.warn('⚠️  Failed to fetch alert stats:', error.message);
      return {
        status: 'success',
        data: {
          total: 0,
          active: 0,
          triggered: 0,
          acknowledged: 0
        }
      };
    }
  }
}

