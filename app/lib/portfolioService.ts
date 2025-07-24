// Portfolio Service - Manages portfolio operations and calculations
export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  investedAmount: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  lastUpdated: Date;
}

export interface Portfolio {
  id: string;
  name: string;
  description: string;
  totalInvested: number;
  currentValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Position[];
  createdAt: Date;
  lastUpdated: Date;
}

class PortfolioService {
  private portfolios: Portfolio[] = [];
  private subscribers: ((portfolios: Portfolio[]) => void)[] = [];

  constructor() {
    this.loadFromStorage();
    this.startPriceUpdates();
  }

  // Subscribe to portfolio updates
  subscribe(callback: (portfolios: Portfolio[]) => void) {
    this.subscribers.push(callback);
    callback(this.portfolios);
  }

  unsubscribe(callback: (portfolios: Portfolio[]) => void) {
    this.subscribers = this.subscribers.filter(sub => sub !== callback);
  }

  // Create new portfolio
  createPortfolio(name: string, description: string): Portfolio {
    const portfolio: Portfolio = {
      id: Date.now().toString(),
      name,
      description,
      totalInvested: 0,
      currentValue: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      positions: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    this.portfolios.push(portfolio);
    this.saveToStorage();
    this.notifySubscribers();
    return portfolio;
  }

  // Add position to portfolio
  addPosition(portfolioId: string, symbol: string, quantity: number, price: number): boolean {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return false;

    const existingPosition = portfolio.positions.find(p => p.symbol === symbol);
    
    if (existingPosition) {
      // Update existing position
      const totalQuantity = existingPosition.quantity + quantity;
      const totalInvested = existingPosition.investedAmount + (quantity * price);
      existingPosition.quantity = totalQuantity;
      existingPosition.averagePrice = totalInvested / totalQuantity;
      existingPosition.investedAmount = totalInvested;
    } else {
      // Create new position
      const position: Position = {
        id: Date.now().toString(),
        symbol,
        quantity,
        averagePrice: price,
        currentPrice: price, // Will be updated by price service
        investedAmount: quantity * price,
        currentValue: quantity * price,
        pnl: 0,
        pnlPercent: 0,
        lastUpdated: new Date()
      };
      portfolio.positions.push(position);
    }

    this.updatePortfolioTotals(portfolio);
    this.saveToStorage();
    this.notifySubscribers();
    return true;
  }

  // Remove position from portfolio
  removePosition(portfolioId: string, positionId: string): boolean {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return false;

    portfolio.positions = portfolio.positions.filter(p => p.id !== positionId);
    this.updatePortfolioTotals(portfolio);
    this.saveToStorage();
    this.notifySubscribers();
    return true;
  }

  // Update position quantity
  updatePosition(portfolioId: string, positionId: string, quantity: number, price?: number): boolean {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return false;

    const position = portfolio.positions.find(p => p.id === positionId);
    if (!position) return false;

    if (price !== undefined) {
      // Recalculate average price
      const totalInvested = position.investedAmount + ((quantity - position.quantity) * price);
      position.averagePrice = totalInvested / quantity;
      position.investedAmount = totalInvested;
    } else {
      // Just update quantity, keep average price
      position.investedAmount = quantity * position.averagePrice;
    }

    position.quantity = quantity;
    position.currentValue = quantity * position.currentPrice;
    position.pnl = position.currentValue - position.investedAmount;
    position.pnlPercent = (position.pnl / position.investedAmount) * 100;
    position.lastUpdated = new Date();

    this.updatePortfolioTotals(portfolio);
    this.saveToStorage();
    this.notifySubscribers();
    return true;
  }

  // Update current prices for all positions
  updatePrices(priceUpdates: { [symbol: string]: number }) {
    let hasUpdates = false;

    this.portfolios.forEach(portfolio => {
      portfolio.positions.forEach(position => {
        if (priceUpdates[position.symbol]) {
          position.currentPrice = priceUpdates[position.symbol];
          position.currentValue = position.quantity * position.currentPrice;
          position.pnl = position.currentValue - position.investedAmount;
          position.pnlPercent = (position.pnl / position.investedAmount) * 100;
          position.lastUpdated = new Date();
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        this.updatePortfolioTotals(portfolio);
      }
    });

    if (hasUpdates) {
      this.saveToStorage();
      this.notifySubscribers();
    }
  }

  private updatePortfolioTotals(portfolio: Portfolio) {
    portfolio.totalInvested = portfolio.positions.reduce((sum, pos) => sum + pos.investedAmount, 0);
    portfolio.currentValue = portfolio.positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    portfolio.totalPnL = portfolio.currentValue - portfolio.totalInvested;
    portfolio.totalPnLPercent = portfolio.totalInvested > 0 ? (portfolio.totalPnL / portfolio.totalInvested) * 100 : 0;
    portfolio.lastUpdated = new Date();
  }

  private startPriceUpdates() {
    // Simulate price updates every 10 seconds
    setInterval(() => {
      const mockPrices = {
        'RELIANCE': 2485.75 + (Math.random() - 0.5) * 20,
        'TCS': 3720.45 + (Math.random() - 0.5) * 30,
        'HDFC': 1545.30 + (Math.random() - 0.5) * 15,
        'INFY': 1420.75 + (Math.random() - 0.5) * 25,
        'ICICIBANK': 985.20 + (Math.random() - 0.5) * 10
      };

      this.updatePrices(mockPrices);
    }, 10000);
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('portfolios', JSON.stringify(this.portfolios));
    }
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('portfolios');
      if (stored) {
        try {
          this.portfolios = JSON.parse(stored);
        } catch (error) {
          console.error('Error loading portfolios from storage:', error);
        }
      }
    }
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.portfolios));
  }

  // Get all portfolios
  getPortfolios(): Portfolio[] {
    return this.portfolios;
  }

  // Get specific portfolio
  getPortfolio(id: string): Portfolio | undefined {
    return this.portfolios.find(p => p.id === id);
  }

  // Delete portfolio
  deletePortfolio(id: string): boolean {
    const index = this.portfolios.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.portfolios.splice(index, 1);
    this.saveToStorage();
    this.notifySubscribers();
    return true;
  }
}

export const portfolioService = new PortfolioService();