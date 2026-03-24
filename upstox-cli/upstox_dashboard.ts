#!/usr/bin/env -S npx tsx
import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import { writeFileSync } from 'fs';

// Load environment variables
dotenv.config();

const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_TOKEN;
const BASE_URL = 'https://api.upstox.com/v2';

if (!ACCESS_TOKEN) {
  console.error('❌ Error: UPSTOX_ACCESS_TOKEN not found in .env file');
  process.exit(1);
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Holding {
  isin: string;
  cnc_used_quantity: number;
  collateral_type?: string;
  company_name: string;
  haircut: number;
  product: string;
  quantity: number;
  tradingsymbol: string;
  last_price: number;
  close_price: number;
  average_price: number;
  collateral_quantity?: number;
  collateral_update_quantity?: number;
  t1_quantity: number;
  exchange: string;
  instrument_token: string;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
}

interface Position {
  exchange: string;
  multiplier: number;
  value: number;
  pnl: number;
  product: string;
  instrument_token: string;
  average_price: number;
  buy_value: number;
  overnight_quantity: number;
  day_buy_value: number;
  day_buy_price: number;
  overnight_buy_amount: number;
  overnight_buy_quantity: number;
  day_buy_quantity: number;
  sell_value: number;
  day_sell_value: number;
  day_sell_price: number;
  overnight_sell_amount: number;
  overnight_sell_quantity: number;
  day_sell_quantity: number;
  quantity: number;
  last_price: number;
  unrealised: number;
  realised: number;
  close_price: number;
  buy_price: number;
  sell_price: number;
  tradingsymbol: string;
}

interface UserProfile {
  user_name: string;
  user_id: string;
  email: string;
  user_type: string;
  broker: string;
  exchanges: string[];
  products: string[];
  order_types: string[];
}

interface QuoteData {
  instrument_key: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  last_trade_time?: string;
}

interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi?: number;
}

interface Funds {
  equity: {
    enabled: boolean;
    net: number;
    available_margin: number;
    used_margin: number;
    payin_amount: number;
    span_margin: number;
    adhoc_margin: number;
    notional_cash: number;
    exposure_margin: number;
  };
  commodity: {
    enabled: boolean;
    net: number;
    available_margin: number;
    used_margin: number;
  };
}

interface DashboardData {
  timestamp: string;
  profile?: UserProfile;
  funds?: Funds;
  holdings?: Holding[];
  positions?: Position[];
  quotes?: Record<string, QuoteData | { error: string }>;
  weekly_trends?: Record<string, Candle[]>;
  summary: {
    total_portfolio_value: number;
    total_pnl: number;
    holdings_count: number;
    positions_count: number;
    top_gainers: Array<{ symbol: string; pnl: number; pnl_percentage: number }>;
    top_losers: Array<{ symbol: string; pnl: number; pnl_percentage: number }>;
  };
}

// ============================================
// API CLIENT
// ============================================

class UpstoxClient {
  private api: AxiosInstance;

  constructor(accessToken: string) {
    this.api = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 10000,
    });
  }

  async getProfile(): Promise<UserProfile> {
    const response = await this.api.get('/user/profile');
    return response.data.data;
  }

  async getFunds(): Promise<Funds> {
    const response = await this.api.get('/user/get-funds-and-margin');
    return response.data.data;
  }

  async getHoldings(): Promise<Holding[]> {
    const response = await this.api.get('/portfolio/long-term-holdings');
    return response.data.data;
  }

  async getPositions(): Promise<Position[]> {
    const response = await this.api.get('/portfolio/short-term-positions');
    return response.data.data;
  }

  async getQuote(instrumentKey: string): Promise<QuoteData> {
    const response = await this.api.get('/market-quote/quotes', {
      params: { instrument_key: instrumentKey },
    });
    const data = response.data.data[instrumentKey];
    return {
      instrument_key: instrumentKey,
      ltp: data.ltpc?.ltp || 0,
      open: data.ohlc?.open || 0,
      high: data.ohlc?.high || 0,
      low: data.ohlc?.low || 0,
      close: data.ohlc?.close || 0,
      volume: data.ltpc?.volume || 0,
      last_trade_time: data.ltpc?.ltt,
    };
  }

  async getHistoricalCandles(
    instrumentKey: string,
    interval: 'day' | 'week' | 'month' | '1minute' | '30minute',
    toDate: string,
    fromDate: string
  ): Promise<Candle[]> {
    const encodedKey = encodeURIComponent(instrumentKey);
    const url = `/historical-candle/${encodedKey}/${interval}/${toDate}/${fromDate}`;
    const response = await this.api.get(url);
    
    if (response.data.status === 'success' && response.data.data?.candles) {
      return response.data.data.candles.map((c: any[]) => ({
        timestamp: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
        oi: c[6],
      }));
    }
    return [];
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function getDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90); // 90 days back
  
  return {
    to: to.toISOString().split('T')[0],
    from: from.toISOString().split('T')[0],
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// MAIN DASHBOARD FUNCTION
// ============================================

async function fetchDashboard(): Promise<DashboardData> {
  const client = new UpstoxClient(ACCESS_TOKEN!);
  const data: DashboardData = {
    timestamp: new Date().toISOString(),
    summary: {
      total_portfolio_value: 0,
      total_pnl: 0,
      holdings_count: 0,
      positions_count: 0,
      top_gainers: [],
      top_losers: [],
    },
  };

  try {
    // Fetch Profile
    console.log('🔄 Fetching user profile...');
    data.profile = await client.getProfile();
    console.log(`✅ Logged in as: ${data.profile.user_name} (${data.profile.user_id})`);

    // Fetch Funds
    console.log('🔄 Fetching funds and margins...');
    data.funds = await client.getFunds();
    console.log(`💰 Available Margin: ${formatCurrency(data.funds.equity.available_margin)}`);

    // Fetch Holdings
    console.log('🔄 Fetching holdings...');
    data.holdings = await client.getHoldings();
    data.summary.holdings_count = data.holdings.length;
    console.log(`📊 Holdings: ${data.holdings.length} stocks`);

    // Fetch Positions
    console.log('🔄 Fetching positions...');
    data.positions = await client.getPositions();
    data.summary.positions_count = data.positions.length;
    console.log(`📈 Positions: ${data.positions.length} active trades`);

    // Calculate portfolio value and P&L
    data.summary.total_portfolio_value = data.holdings.reduce(
      (sum, h) => sum + h.quantity * h.last_price,
      0
    );
    data.summary.total_pnl =
      data.holdings.reduce((sum, h) => sum + h.pnl, 0) +
      data.positions.reduce((sum, p) => sum + p.pnl, 0);

    console.log(`💼 Total Portfolio Value: ${formatCurrency(data.summary.total_portfolio_value)}`);
    console.log(`📊 Total P&L: ${formatCurrency(data.summary.total_pnl)}`);

    // Fetch Quotes for top holdings
    console.log('🔄 Fetching live quotes...');
    const topHoldings = data.holdings.slice(0, 10);
    data.quotes = {};

    for (const holding of topHoldings) {
      try {
        await sleep(600); // Rate limit: ~100 requests/minute
        const quote = await client.getQuote(holding.instrument_token);
        data.quotes[holding.tradingsymbol] = quote;
        console.log(`  ✓ ${holding.tradingsymbol}: ${formatCurrency(quote.ltp)}`);
      } catch (error: any) {
        data.quotes[holding.tradingsymbol] = { error: error.message };
        console.log(`  ✗ ${holding.tradingsymbol}: Quote unavailable`);
      }
    }

    // Fetch Weekly Trends for top 5 holdings
    console.log('🔄 Fetching weekly trends...');
    const dateRange = getDateRange();
    data.weekly_trends = {};

    for (const holding of data.holdings.slice(0, 5)) {
      try {
        await sleep(1000); // Rate limit
        const candles = await client.getHistoricalCandles(
          holding.instrument_token,
          'week',
          dateRange.to,
          dateRange.from
        );
        data.weekly_trends[holding.tradingsymbol] = candles;
        console.log(`  ✓ ${holding.tradingsymbol}: ${candles.length} weeks`);
      } catch (error: any) {
        console.log(`  ✗ ${holding.tradingsymbol}: Historical data unavailable`);
        data.weekly_trends[holding.tradingsymbol] = [];
      }
    }

    // Calculate top gainers and losers
    const allSecurities = [
      ...data.holdings.map((h) => ({
        symbol: h.tradingsymbol,
        pnl: h.pnl,
        pnl_percentage: ((h.last_price - h.average_price) / h.average_price) * 100,
      })),
      ...data.positions.map((p) => ({
        symbol: p.tradingsymbol,
        pnl: p.pnl,
        pnl_percentage: ((p.last_price - p.average_price) / p.average_price) * 100,
      })),
    ];

    data.summary.top_gainers = allSecurities
      .filter((s) => s.pnl > 0)
      .sort((a, b) => b.pnl_percentage - a.pnl_percentage)
      .slice(0, 5);

    data.summary.top_losers = allSecurities
      .filter((s) => s.pnl < 0)
      .sort((a, b) => a.pnl_percentage - b.pnl_percentage)
      .slice(0, 5);

    // Save to JSON file
    const filename = `dashboard_${new Date().toISOString().split('T')[0]}.json`;
    writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`\n✅ Dashboard data saved to ${filename}`);

    // Print Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PORTFOLIO SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Portfolio Value: ${formatCurrency(data.summary.total_portfolio_value)}`);
    console.log(`Total P&L: ${formatCurrency(data.summary.total_pnl)} (${formatPercentage(
      (data.summary.total_pnl / (data.summary.total_portfolio_value - data.summary.total_pnl)) * 100
    )})`);
    console.log(`Holdings: ${data.summary.holdings_count} | Positions: ${data.summary.positions_count}`);
    
    if (data.summary.top_gainers.length > 0) {
      console.log('\n🚀 Top Gainers:');
      data.summary.top_gainers.forEach((g, i) => {
        console.log(`  ${i + 1}. ${g.symbol}: ${formatCurrency(g.pnl)} (${formatPercentage(g.pnl_percentage)})`);
      });
    }

    if (data.summary.top_losers.length > 0) {
      console.log('\n📉 Top Losers:');
      data.summary.top_losers.forEach((l, i) => {
        console.log(`  ${i + 1}. ${l.symbol}: ${formatCurrency(l.pnl)} (${formatPercentage(l.pnl_percentage)})`);
      });
    }

    console.log('='.repeat(60) + '\n');

    return data;
  } catch (error: any) {
    console.error('❌ Error fetching dashboard data:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    throw error;
  }
}

// ============================================
// ENTRY POINT
// ============================================

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchDashboard().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { fetchDashboard, UpstoxClient };
