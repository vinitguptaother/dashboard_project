'use client';

import { useState, useEffect } from 'react';
import {
  Search, TrendingUp, TrendingDown, BarChart3, Calendar, Target,
  AlertCircle, Star, Activity, Shield, Zap, ArrowUpRight, ArrowDownRight,
  Clock, ChevronDown, ChevronUp, RefreshCw, Brain, Newspaper, LineChart
} from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useMarketStatus } from '../hooks/useMarketStatus';
import TradePreviewCard from './TradePreviewCard';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PriceData {
  currentPrice: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  open: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  marketCapFormatted: string;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  companyName: string;
  sector: string;
  industry: string;
  exchange: string;
}

interface NewsItem {
  headline: string;
  summary: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  date: string;
  source: string;
}

interface Recommendation {
  action: 'BUY' | 'SELL' | 'HOLD' | 'ACCUMULATE';
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  timeframe: string;
  riskReward: string;
  reasoning: string;
  risks: string[];
  catalysts: string[];
}

interface StockAnalysis {
  symbol: string;
  price: PriceData;
  fundamentals: Record<string, string>;
  technicals: Record<string, string>;
  news: NewsItem[];
  recommendation: Recommendation | null;
  analyzedAt: string;
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

// ─── Helper ────────────────────────────────────────────────────────────────────

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

function formatINR(n: number): string {
  if (!n || n === 0) return '₹0';
  if (n >= 1e12) return `₹${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const StockSearchTab = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [stockTimeframe, setStockTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '6M' | '1Y'>('1M');
  const [chartData, setChartData] = useState<{ time: string; price: number; volume: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paperTradeLoading, setPaperTradeLoading] = useState(false);
  const [paperTradeSaved, setPaperTradeSaved] = useState(false);
  // Phase 2 realism UI — quantity + segment + liquidity band for preview card
  const [paperQty, setPaperQty] = useState<number>(0);
  const [paperSegment, setPaperSegment] = useState<'equity-delivery' | 'equity-intraday' | 'options' | 'futures'>('equity-delivery');
  const [paperBand, setPaperBand] = useState<'LARGE' | 'MID' | 'SMALL' | 'ILLIQUID' | 'OPTIONS'>('MID');
  const marketStatus = useMarketStatus();

  // ── Search stocks ──────────────────────────────────────────────────────────
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const resp = await fetch(`${BACKEND}/api/market/search/${encodeURIComponent(query.trim())}`);
      if (!resp.ok) { setSearchResults([]); return; }
      const json = await resp.json();
      const results = (json?.data?.results || []).map((r: any) => ({
        symbol: r.symbol,
        name: r.name || r.symbol,
        exchange: r.exchange || 'NSE',
        price: r.price ?? null,
        change: r.change ?? null,
        changePercent: r.changePercent ?? null,
      }));
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Select stock → full analysis ──────────────────────────────────────────
  const handleStockSelect = async (symbol: string) => {
    setSearchResults([]);
    setSearchQuery(symbol);
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setPaperTradeSaved(false);
    setActiveTab('overview');

    try {
      const resp = await fetch(`${BACKEND}/api/market/stock-analysis/${encodeURIComponent(symbol)}`);
      if (!resp.ok) throw new Error('Analysis failed');
      const json = await resp.json();
      if (json.status === 'success') {
        setAnalysis(json.data);
      } else {
        throw new Error(json.message || 'Analysis failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze stock');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Load historical chart ─────────────────────────────────────────────────
  useEffect(() => {
    if (!analysis?.symbol) return;
    const tfMap: Record<string, { period: string; interval: string }> = {
      '1D': { period: '1d', interval: '5m' },
      '1W': { period: '5d', interval: '15m' },
      '1M': { period: '1mo', interval: '1d' },
      '3M': { period: '3mo', interval: '1d' },
      '6M': { period: '6mo', interval: '1d' },
      '1Y': { period: '1y', interval: '1d' },
    };
    const { period, interval } = tfMap[stockTimeframe] || tfMap['1M'];

    (async () => {
      try {
        const resp = await fetch(`${BACKEND}/api/market/historical/${encodeURIComponent(analysis.symbol)}?period=${period}&interval=${interval}`);
        if (!resp.ok) return;
        const json = await resp.json();
        const rows = json?.data?.data || [];
        setChartData(rows.map((r: any) => {
          const d = new Date(r.date);
          const label = stockTimeframe === '1D'
            ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            : `${d.getDate()}/${d.getMonth() + 1}`;
          return { time: label, price: Math.round(r.close ?? 0), volume: Math.round((r.volume ?? 0) / 1000) };
        }));
      } catch {
        setChartData([]);
      }
    })();
  }, [analysis?.symbol, stockTimeframe]);

  // ── Render: Overview Tab ──────────────────────────────────────────────────
  const renderOverview = () => {
    if (!analysis) return null;
    const p = analysis.price;
    const isUp = p.change >= 0;

    return (
      <div className="space-y-6">
        {/* Stock Header */}
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{analysis.symbol}</h2>
              <p className="text-gray-600">{p.companyName}</p>
              <p className="text-sm text-gray-500">{p.sector} &bull; {p.industry}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">₹{p.currentPrice?.toLocaleString('en-IN')}</p>
              <div className={`flex items-center justify-end ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                {isUp ? <TrendingUp className="h-5 w-5 mr-1" /> : <TrendingDown className="h-5 w-5 mr-1" />}
                <span className="font-semibold">
                  {isUp ? '+' : ''}{p.change?.toFixed(2)} ({isUp ? '+' : ''}{p.changePercent?.toFixed(2)}%)
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Analyzed: {new Date(analysis.analyzedAt).toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Timeframe selector + Chart */}
          <div className="flex items-center gap-2 mb-4">
            {(['1D', '1W', '1M', '3M', '6M', '1Y'] as const).map(tf => (
              <button key={tf} onClick={() => setStockTimeframe(tf)}
                className={`px-2 py-1 text-xs rounded ${stockTimeframe === tf ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {tf}
              </button>
            ))}
          </div>

          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any, name: string) =>
                  name === 'price' ? [`₹${value}`, 'Price'] : [`${value}k`, 'Volume']
                } />
                <Bar yAxisId="right" dataKey="volume" fill="#94a3b8" opacity={0.5} />
                <Line yAxisId="left" type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Open', value: `₹${p.open?.toLocaleString('en-IN')}` },
              { label: 'Day High', value: `₹${p.dayHigh?.toLocaleString('en-IN')}` },
              { label: 'Day Low', value: `₹${p.dayLow?.toLocaleString('en-IN')}` },
              { label: 'Prev Close', value: `₹${p.previousClose?.toLocaleString('en-IN')}` },
              { label: 'Volume', value: p.volume?.toLocaleString('en-IN') },
              { label: 'Market Cap', value: formatINR(p.marketCap) },
              { label: '52W High', value: `₹${p.fiftyTwoWeekHigh?.toLocaleString('en-IN')}` },
              { label: '52W Low', value: `₹${p.fiftyTwoWeekLow?.toLocaleString('en-IN')}` },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-sm font-bold text-gray-900">{item.value || 'N/A'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendation Card (if available) */}
        {analysis.recommendation && renderRecommendationCard()}

        {/* News Section (compact) */}
        {analysis.news.length > 0 && (
          <div className="glass-effect rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Newspaper className="h-5 w-5 mr-2 text-blue-600" />
              Latest News
            </h3>
            <div className="space-y-3">
              {analysis.news.slice(0, 3).map((n, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium mt-0.5 ${
                    n.sentiment === 'Positive' ? 'bg-green-100 text-green-700' :
                    n.sentiment === 'Negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{n.sentiment}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{n.headline}</p>
                    <p className="text-xs text-gray-500">{n.summary}</p>
                    <p className="text-xs text-gray-400 mt-1">{n.source} &bull; {n.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Paper Trade: manual save handler ──────────────────────────────────────
  const handlePaperTrade = async () => {
    if (!analysis?.recommendation || !analysis.price) return;

    // Off-hours warning: entry price will be EOD/last-close, not live
    if (marketStatus && !marketStatus.isOpen) {
      const reason = marketStatus.holidayName
        ? `NSE Holiday (${marketStatus.holidayName})`
        : marketStatus.state === 'CLOSED_WEEKEND' ? 'weekend' : 'after market hours';
      const ok = window.confirm(
        `Market is currently closed (${reason}).\n\n` +
        `The entry price will be the last session's close, NOT a live price. ` +
        `When markets reopen the actual entry can be significantly different due to gap-up/down.\n\n` +
        `Save this paper trade anyway?`
      );
      if (!ok) return;
    }

    const r = analysis.recommendation;
    setPaperTradeLoading(true);
    try {
      const resp = await fetch(`${BACKEND}/api/trade-setup/paper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: analysis.symbol,
          action: r.action,
          entryPrice: r.entryPrice || analysis.price.currentPrice,
          stopLoss: r.stopLoss,
          target: r.targetPrice,
          confidence: r.confidence,
          reasoning: r.reasoning,
          riskFactors: r.risks || [],
          holdingDuration: r.timeframe,
          tradeType: 'SWING',
          // Phase 2 realism fields — only sent when user enters quantity
          quantity: paperQty > 0 ? paperQty : undefined,
          segment: paperSegment,
          liquidityBand: paperBand,
          botId: 'manual',
        }),
      });
      if (resp.ok) {
        setPaperTradeSaved(true);
      } else {
        alert('Failed to save paper trade');
      }
    } catch (e) {
      console.error('Paper trade save failed:', e);
      alert('Failed to save paper trade');
    }
    setPaperTradeLoading(false);
  };

  // ── Render: AI Recommendation Card ────────────────────────────────────────
  const renderRecommendationCard = () => {
    if (!analysis?.recommendation) return null;
    const r = analysis.recommendation;
    const actionColors: Record<string, string> = {
      BUY: 'bg-green-600', SELL: 'bg-red-600', HOLD: 'bg-yellow-500', ACCUMULATE: 'bg-blue-600',
    };

    return (
      <div className="glass-effect rounded-xl p-6 shadow-lg border-2 border-blue-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Brain className="h-5 w-5 mr-2 text-purple-600" />
            AI Recommendation
          </h3>
          <span className={`${actionColors[r.action] || 'bg-gray-500'} text-white px-4 py-1.5 rounded-full text-sm font-bold`}>
            {r.action}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-gray-500">Entry Price</p>
            <p className="text-lg font-bold text-green-700">₹{r.entryPrice?.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-500">Target</p>
            <p className="text-lg font-bold text-blue-700">₹{r.targetPrice?.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-gray-500">Stop Loss</p>
            <p className="text-lg font-bold text-red-700">₹{r.stopLoss?.toLocaleString('en-IN')}</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-gray-500">Confidence</p>
            <p className="text-lg font-bold text-purple-700">{r.confidence}%</p>
          </div>
        </div>

        <div className="flex gap-4 text-sm text-gray-600 mb-3">
          <span className="flex items-center"><Clock className="h-4 w-4 mr-1" /> {r.timeframe}</span>
          <span className="flex items-center"><Target className="h-4 w-4 mr-1" /> R:R {r.riskReward}</span>
        </div>

        <p className="text-sm text-gray-700 mb-3">{r.reasoning}</p>

        {r.catalysts && r.catalysts.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-green-700 mb-1">Catalysts:</p>
            <div className="flex flex-wrap gap-1">
              {r.catalysts.map((c, i) => (
                <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          </div>
        )}
        {r.risks && r.risks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-700 mb-1">Risks:</p>
            <div className="flex flex-wrap gap-1">
              {r.risks.map((risk, i) => (
                <span key={i} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{risk}</span>
              ))}
            </div>
          </div>
        )}

        {/* Paper Trade: quantity + segment + realism preview */}
        {['BUY', 'SELL', 'ACCUMULATE'].includes(r.action) && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            {/* Mini-form: qty + segment + liquidity band */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-500 tracking-wider mb-0.5">Quantity</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={paperQty || ''}
                  onChange={(e) => setPaperQty(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="e.g. 10"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-500 tracking-wider mb-0.5">Segment</label>
                <select
                  value={paperSegment}
                  onChange={(e) => setPaperSegment(e.target.value as any)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="equity-delivery">Delivery</option>
                  <option value="equity-intraday">Intraday</option>
                  <option value="options">Options</option>
                  <option value="futures">Futures</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-500 tracking-wider mb-0.5">Liquidity</label>
                <select
                  value={paperBand}
                  onChange={(e) => setPaperBand(e.target.value as any)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="LARGE">Large-cap (2 bps)</option>
                  <option value="MID">Mid-cap (5 bps)</option>
                  <option value="SMALL">Small-cap (15 bps)</option>
                  <option value="ILLIQUID">Illiquid (40 bps)</option>
                  <option value="OPTIONS">Options (10 bps)</option>
                </select>
              </div>
            </div>

            {/* Realism preview card (Sprint 3 #9 Phase 2) */}
            <TradePreviewCard
              segment={paperSegment}
              entrySide={r.action === 'SELL' ? 'SELL' : 'BUY'}
              qty={paperQty}
              entryPrice={r.entryPrice || analysis.price.currentPrice}
              stopLoss={r.stopLoss}
              target={r.targetPrice}
              liquidityBand={paperBand}
            />

            {paperTradeSaved ? (
              <>
                <div className="w-full py-2.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium text-center flex items-center justify-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Saved as Paper Trade
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">Track performance in the Paper Trading tab</p>
              </>
            ) : (
              <button
                onClick={handlePaperTrade}
                disabled={paperTradeLoading}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium text-center flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {paperTradeLoading ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Target className="h-4 w-4" /> Paper Trade This</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render: Fundamentals Tab ──────────────────────────────────────────────
  const renderFundamentals = () => {
    if (!analysis) return null;
    const f = analysis.fundamentals;
    if (!f || Object.keys(f).length === 0) {
      return (
        <div className="glass-effect rounded-xl p-8 shadow-lg text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No fundamental data available for {analysis.symbol}</p>
        </div>
      );
    }

    // Group fundamentals (matching Screener.in layout)
    const valuation = ['P/E Ratio (TTM)', 'Forward P/E', 'P/B Ratio', 'EPS (TTM)', 'Book Value', 'Face Value', 'Market Cap', 'Beta'];
    const profitability = ['ROE', 'ROA', 'ROCE', 'Profit Margin', 'Operating Margin'];
    const growth = ['Revenue Growth (YoY)', 'Earnings Growth (YoY)', 'Sales Growth (3yr CAGR)', 'Sales Growth (5yr CAGR)', 'Profit Growth (3yr CAGR)', 'Profit Growth (5yr CAGR)', 'Stock Price CAGR (3yr)', 'Stock Price CAGR (5yr)', 'Quarterly Sales Growth', 'Quarterly Profit Growth'];
    const health = ['Debt/Equity', 'Current Ratio', 'Interest Coverage'];
    const cashflow = ['Cash from Operations', 'Free Cash Flow'];
    const efficiency = ['Debtor Days', 'Working Capital Days'];
    const dividends = ['Dividend Yield', 'Dividend Rate'];
    const ownership = ['Promoter Holding', 'FII Holding', 'DII Holding', 'No. of Shareholders'];
    const priceRange = ['52-Week High', '52-Week Low', 'Avg Volume (10d)'];

    const renderGroup = (title: string, icon: any, keys: string[]) => {
      const Icon = icon;
      const entries = keys.filter(k => f[k] && f[k] !== 'N/A');
      if (entries.length === 0) return null;
      return (
        <div className="glass-effect rounded-xl p-5 shadow-lg">
          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
            <Icon className="h-4 w-4 mr-2 text-blue-600" /> {title}
          </h4>
          <div className="space-y-2">
            {entries.map(key => (
              <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{key}</span>
                <span className="text-sm font-semibold text-gray-900">{f[key]}</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderGroup('Valuation', BarChart3, valuation)}
        {renderGroup('Profitability', TrendingUp, profitability)}
        {renderGroup('Growth', Zap, growth)}
        {renderGroup('Financial Health', Shield, health)}
        {renderGroup('Cash Flow', Activity, cashflow)}
        {renderGroup('Efficiency', Clock, efficiency)}
        {renderGroup('Dividends', Star, dividends)}
        {renderGroup('Ownership', Shield, ownership)}
        {renderGroup('Price Range', Activity, priceRange)}
      </div>
    );
  };

  // ── Render: Technicals Tab ────────────────────────────────────────────────
  const renderTechnicals = () => {
    if (!analysis) return null;
    const t = analysis.technicals;
    if (!t || Object.keys(t).length === 0) {
      return (
        <div className="glass-effect rounded-xl p-8 shadow-lg text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No technical data available for {analysis.symbol}</p>
        </div>
      );
    }

    const trendColor = t['Trend'] === 'Bullish' ? 'text-green-600' : t['Trend'] === 'Bearish' ? 'text-red-600' : 'text-yellow-600';
    const signalColor = t['Signal']?.includes('Buy') ? 'bg-green-100 text-green-700' :
      t['Signal']?.includes('Sell') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700';

    return (
      <div className="space-y-4">
        {/* Trend + Signal Banner */}
        <div className="glass-effect rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Overall Trend</p>
            <p className={`text-2xl font-bold ${trendColor}`}>{t['Trend'] || 'N/A'}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-bold ${signalColor}`}>
            {t['Signal'] || 'Neutral'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Momentum */}
          <div className="glass-effect rounded-xl p-5 shadow-lg">
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <Activity className="h-4 w-4 mr-2 text-purple-600" /> Momentum
            </h4>
            <div className="space-y-3">
              {/* RSI with visual bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">RSI (14)</span>
                  <span className="font-semibold">{t['RSI (14)']}</span>
                </div>
                {t['RSI (14)'] && t['RSI (14)'] !== 'N/A' && (
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, parseFloat(t['RSI (14)']))}%`,
                        backgroundColor: parseFloat(t['RSI (14)']) > 70 ? '#ef4444' : parseFloat(t['RSI (14)']) < 30 ? '#22c55e' : '#3b82f6',
                      }}
                    />
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>Oversold (&lt;30)</span>
                  <span>Overbought (&gt;70)</span>
                </div>
              </div>
              {['ADX (14)', 'VWAP (approx)', 'Avg Volume (20d)'].map(key => t[key] && t[key] !== 'N/A' && (
                <div key={key} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-sm text-gray-600">{key}</span>
                  <span className="text-sm font-semibold">{t[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MACD */}
          <div className="glass-effect rounded-xl p-5 shadow-lg">
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <LineChart className="h-4 w-4 mr-2 text-blue-600" /> MACD
            </h4>
            <div className="space-y-2">
              {['MACD Line', 'MACD Signal', 'MACD Histogram'].map(key => (
                <div key={key} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{key}</span>
                  <span className={`text-sm font-semibold ${
                    key === 'MACD Histogram' && t[key] && t[key] !== 'N/A'
                      ? parseFloat(t[key]) > 0 ? 'text-green-600' : 'text-red-600'
                      : 'text-gray-900'
                  }`}>{t[key] || 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Moving Averages */}
          <div className="glass-effect rounded-xl p-5 shadow-lg">
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-green-600" /> Moving Averages
            </h4>
            <div className="space-y-2">
              {['EMA 20', 'EMA 50', 'EMA 200', 'SMA 20'].map(key => (
                <div key={key} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{key}</span>
                  <span className="text-sm font-semibold text-gray-900">{t[key] || 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bollinger Bands */}
          <div className="glass-effect rounded-xl p-5 shadow-lg">
            <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2 text-orange-600" /> Bollinger Bands (20, 2)
            </h4>
            <div className="space-y-2">
              {['Bollinger Upper', 'Bollinger Lower'].map(key => (
                <div key={key} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{key}</span>
                  <span className="text-sm font-semibold text-gray-900">{t[key] || 'N/A'}</span>
                </div>
              ))}
              {analysis.price.currentPrice > 0 && t['Bollinger Upper'] && t['Bollinger Lower'] &&
                t['Bollinger Upper'] !== 'N/A' && t['Bollinger Lower'] !== 'N/A' && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-center">
                  Price is at{' '}
                  {(() => {
                    const upper = parseFloat(t['Bollinger Upper']);
                    const lower = parseFloat(t['Bollinger Lower']);
                    const pos = ((analysis.price.currentPrice - lower) / (upper - lower)) * 100;
                    return `${pos.toFixed(0)}% of band width`;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render: AI & News Tab ─────────────────────────────────────────────────
  const renderAINews = () => {
    if (!analysis) return null;

    return (
      <div className="space-y-4">
        {/* Full AI Recommendation */}
        {analysis.recommendation ? renderRecommendationCard() : (
          <div className="glass-effect rounded-xl p-8 shadow-lg text-center">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">AI recommendation unavailable. Check your Perplexity API key in Settings.</p>
          </div>
        )}

        {/* Full News List */}
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Newspaper className="h-5 w-5 mr-2 text-blue-600" />
            Recent News & Updates
          </h3>
          {analysis.news.length > 0 ? (
            <div className="space-y-3">
              {analysis.news.map((n, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900 flex-1">{n.headline}</p>
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                      n.sentiment === 'Positive' ? 'bg-green-100 text-green-700' :
                      n.sentiment === 'Negative' ? 'bg-red-100 text-red-700' :
                      'bg-gray-200 text-gray-600'
                    }`}>{n.sentiment}</span>
                  </div>
                  <p className="text-sm text-gray-600">{n.summary}</p>
                  <p className="text-xs text-gray-400 mt-2">{n.source} &bull; {n.date}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent news found. Perplexity API key may not be configured.</p>
          )}
        </div>
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Analysis Engine</h1>
        <p className="text-gray-600">Search any stock for complete fundamentals, technicals, news & AI recommendation</p>
      </div>

      {/* Search Bar */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search stocks by symbol or company name (e.g., RELIANCE, TCS, INFY)"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="mt-3 border border-gray-200 rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((stock, index) => (
              <div key={index} onClick={() => handleStockSelect(stock.symbol)}
                className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">{stock.symbol}</span>
                  <span className="text-sm text-gray-500 ml-2">{stock.name}</span>
                </div>
                {stock.price != null && (
                  <div className="text-right">
                    <span className="font-medium text-gray-900">₹{stock.price}</span>
                    {stock.changePercent != null && (
                      <span className={`text-xs ml-2 ${(stock.changePercent ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(stock.changePercent ?? 0) >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isSearching && (
          <div className="mt-3 text-center py-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-1">Searching...</p>
          </div>
        )}
      </div>

      {/* Analyzing Loader */}
      {isAnalyzing && (
        <div className="glass-effect rounded-xl p-12 shadow-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-900">Analyzing {searchQuery}...</p>
          <p className="text-sm text-gray-500 mt-1">Fetching fundamentals, computing technicals, searching news, generating AI recommendation</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-effect rounded-xl p-6 shadow-lg border-l-4 border-red-500">
          <div className="flex items-center">
            <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
            <div>
              <p className="font-semibold text-gray-900">Analysis Failed</p>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Content */}
      {analysis && !isAnalyzing && (
        <>
          {/* Tab Navigation */}
          <div className="flex justify-center mb-2">
            <div className="glass-effect rounded-lg p-1 flex space-x-1">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'fundamentals', label: 'Fundamentals', icon: Target },
                { id: 'technical', label: 'Technical', icon: Activity },
                { id: 'ai', label: 'AI & News', icon: Brain },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 text-sm ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    }`}>
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'fundamentals' && renderFundamentals()}
          {activeTab === 'technical' && renderTechnicals()}
          {activeTab === 'ai' && renderAINews()}
        </>
      )}

      {/* Empty State */}
      {!analysis && !isAnalyzing && !error && searchQuery === '' && (
        <div className="glass-effect rounded-xl p-12 shadow-lg text-center">
          <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Search for any Stock</h3>
          <p className="text-gray-600 mb-4">Get complete analysis: fundamentals, technicals, latest news & AI recommendation</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'TATAMOTORS', 'BAJFINANCE'].map((symbol) => (
              <button key={symbol} onClick={() => handleStockSelect(symbol)}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200 transition-colors">
                {symbol}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StockSearchTab;
