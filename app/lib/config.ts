// Configuration file for backend URLs and settings
export const config = {
  // Backend API base URL
  backendURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002',
  
  // WebSocket URL
  websocketURL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5002',
  
  // API endpoints
  endpoints: {
    market: {
      indices: '/api/market/indices',
      stock: '/api/market/stock',
      historical: '/api/market/historical',
      search: '/api/market/search'
    },
    news: '/api/news',
    auth: '/api/auth',
    portfolio: '/api/portfolio',
    alerts: '/api/alerts',
    ai: '/api/ai',
    screener: '/api/screener',
    trading: '/api/trading'
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string) => `${config.backendURL}${endpoint}`;

