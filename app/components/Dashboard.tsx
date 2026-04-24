'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Layers, LineChart as LineChartIcon, Target, CheckCircle, XCircle, Clock, ArrowUpRight, ArrowDownRight, Activity, BarChart3, Minus } from 'lucide-react';
import LiveIndexBar from './LiveIndexBar';
import TodayTopActionsPreview from './TodayTopActionsPreview';
import TradeIdeaDiff from './TradeIdeaDiff';
import AnimatedBorderCard from './ui/AnimatedBorderCard';
import NumberCountUp from './ui/NumberCountUp';
import PositionSizer from './PositionSizer';
import DailyPnLWidget from './DailyPnLWidget';
import FiiDiiWidget from './FiiDiiWidget';
import MarketRegimeWidget from './MarketRegimeWidget';
import SectorRotationHeatmap from './SectorRotationHeatmap';
import CorporateEventsWidget from './CorporateEventsWidget';
import LargeDealsWidget from './LargeDealsWidget';
import RiskEnginePanel from './RiskEnginePanel';
import KillSwitchBoard from './KillSwitchBoard';
import ValidatorPanel from './ValidatorPanel';
import ScannerPanel from './ScannerPanel';
import BotOpsPanel from './BotOpsPanel';

const BACKEND_URL = 'http://localhost:5002';

interface TopIdea {
  symbol: string;
  score: number;
  aiScore: number | null;
  aiReason: string | null;
  lastPrice: number;
  percentChange: number | null;
}

interface TopIdeasData {
  batchDate: string;
  screenName: string;
  topIdeas: TopIdea[];
}

interface TradeSetupStats {
  total: number;
  active: number;
  targetHit: number;
  slHit: number;
  expired: number;
  cancelled: number;
  winRate: number | null;
}

interface ActiveSetup {
  _id: string;
  symbol: string;
  action: string;
  tradeType: string;
  entryPrice: number;
  stopLoss: number;
  target: number;
  currentPrice: number | null;
  confidence: number;
  screenName: string | null;
  createdAt: string;
  status: string;
}

const Dashboard = () => {
  const [totalScreens, setTotalScreens] = useState<number>(0);
  const [activeBatches, setActiveBatches] = useState<number>(0);
  const [hitRate, setHitRate] = useState<number | null>(null);
  const [topIdeasData, setTopIdeasData] = useState<TopIdeasData | null>(null);
  const [topIdeasLoading, setTopIdeasLoading] = useState(true);
  const [tradeStats, setTradeStats] = useState<TradeSetupStats | null>(null);
  const [activeSetups, setActiveSetups] = useState<ActiveSetup[]>([]);
  const [paperStats, setPaperStats] = useState<{ total: number; active: number; wins: number; losses: number; winRate: number | null; avgReturnPct: number | null } | null>(null);
  const [screenLeaderboard, setScreenLeaderboard] = useState<{ name: string; performanceScore: number; avgHitRate: number | null; avgAIWinRate: number | null; totalBatches: number; status: string }[]>([]);
  const [marketRegime, setMarketRegime] = useState<{ label: string; color: string; icon: 'up' | 'down' | 'flat'; niftyChange: number | null }>({ label: 'Loading…', color: 'text-gray-500', icon: 'flat', niftyChange: null });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/screens/stats`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setTotalScreens(json.data.totalScreens);
          setActiveBatches(json.data.activeBatches);
          setHitRate(json.data.hitRate);
          if (json.data.screenLeaderboard?.length) setScreenLeaderboard(json.data.screenLeaderboard);
        }
      } catch (err: any) {
        // Warn only — backend may not be running
        console.warn('Dashboard: screens/stats unavailable', err?.message || '');
      }
    };

    const fetchTopIdeas = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/screens/top-ideas`);
        const json = await res.json();
        if (json.status === 'success') {
          setTopIdeasData(json.data);
        }
      } catch (err: any) {
        console.warn('Dashboard: top-ideas unavailable', err?.message || '');
      } finally {
        setTopIdeasLoading(false);
      }
    };

    const fetchTradeStats = async () => {
      try {
        const [statsRes, activeRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/trade-setup/stats`),
          fetch(`${BACKEND_URL}/api/trade-setup/active`),
        ]);
        const statsJson = await statsRes.json();
        const activeJson = await activeRes.json();
        if (statsJson.status === 'success') setTradeStats(statsJson.data);
        if (activeJson.status === 'success') setActiveSetups(activeJson.data);
      } catch (err: any) {
        console.warn('Dashboard: trade-setup unavailable', err?.message || '');
      }
    };

    const fetchPaperStats = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/trade-setup/paper-stats`);
        const json = await res.json();
        if (json.status === 'success') setPaperStats(json.data);
      } catch (err: any) {
        console.warn('Dashboard: paper-stats unavailable', err?.message || '');
      }
    };

    const fetchMarketRegime = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/upstox/ltp?instruments=NIFTY`);
        const json = await res.json();
        if (json.status === 'success' && json.data?.NIFTY) {
          const nifty = json.data.NIFTY;
          // Calculate % change from lastPrice and cp (closing price / previous close)
          const pct = nifty.changePercent ?? nifty.change_percent ?? (nifty.cp && nifty.lastPrice ? ((nifty.lastPrice - nifty.cp) / nifty.cp * 100) : 0);
          if (pct > 0.5) {
            setMarketRegime({ label: 'Bullish', color: 'text-green-500', icon: 'up', niftyChange: pct });
          } else if (pct < -0.5) {
            setMarketRegime({ label: 'Bearish', color: 'text-red-500', icon: 'down', niftyChange: pct });
          } else {
            setMarketRegime({ label: 'Sideways', color: 'text-amber-500', icon: 'flat', niftyChange: pct });
          }
        } else {
          setMarketRegime({ label: 'No Data', color: 'text-gray-400', icon: 'flat', niftyChange: null });
        }
      } catch {
        setMarketRegime({ label: 'Offline', color: 'text-gray-400', icon: 'flat', niftyChange: null });
      }
    };

    fetchStats();
    fetchTopIdeas();
    fetchTradeStats();
    fetchPaperStats();
    fetchMarketRegime();
  }, []);

  return (
    <div className="space-y-6 slide-in">
      {/* Live Index Bar - Keep exactly as is */}
      <LiveIndexBar pollMs={5000} />

      {/* Phase 6: "What changed since last login" banner (dismissible) */}
      <TradeIdeaDiff />

      {/* Section A0.5 (Phase 1 Track C): Today's top-3 actions preview — links to Today tab */}
      <TodayTopActionsPreview />

      {/* Section A: Today's Top Ideas */}
      <div className="glass-effect rounded-xl p-4 sm:p-6 shadow-lg accent-left">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center flex-wrap">
          <LineChartIcon className="h-4 w-4 mr-2 text-blue-500" />
          Today&apos;s Top Ideas
          {topIdeasData && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {topIdeasData.screenName} &middot; {new Date(topIdeasData.batchDate).toLocaleDateString()}
            </span>
          )}
        </h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symbol
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Change
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  AI Insight
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topIdeasLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : !topIdeasData || topIdeasData.topIdeas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    Run your first screen to see today&apos;s top ideas.
                  </td>
                </tr>
              ) : (
                topIdeasData.topIdeas.map((idea, idx) => (
                  <tr key={idea.symbol} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 text-sm font-mono-nums text-gray-500">{idx + 1}</td>
                    <td className="px-3 sm:px-6 py-3 text-sm font-semibold text-blue-500">{idea.symbol}</td>
                    <td className="px-3 sm:px-6 py-3">
                      <span className={`${idea.aiScore != null ? 'badge-success' : 'badge-primary'}`}>
                        {idea.aiScore != null ? `${idea.aiScore}/20` : idea.score.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-sm font-mono-nums text-gray-700">₹{idea.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`px-3 sm:px-6 py-3 text-sm font-medium ${
                      idea.percentChange != null && idea.percentChange > 0
                        ? 'text-green-600'
                        : idea.percentChange != null && idea.percentChange < 0
                          ? 'text-red-600'
                          : 'text-gray-500'
                    }`}>
                      {idea.percentChange != null ? `${idea.percentChange > 0 ? '+' : ''}${idea.percentChange.toFixed(2)}%` : '–'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-xs text-gray-500 max-w-[200px] truncate hidden sm:table-cell" title={idea.aiReason || ''}>
                      {idea.aiReason || '–'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section B: Stat Tiles — Koyfin-dense × Aceternity border */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AnimatedBorderCard glowColor="blue" padding="normal">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(62,130,247,0.1)] flex items-center justify-center shrink-0 shadow-glow">
              <Layers className="w-4.5 h-4.5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <p className="label-micro mb-0.5">Total Screens</p>
              <NumberCountUp
                value={totalScreens}
                duration={600}
                className="text-2xl font-semibold text-[var(--text-1)]"
              />
            </div>
          </div>
        </AnimatedBorderCard>

        <AnimatedBorderCard glowColor="green" padding="normal">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(38,208,124,0.1)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-4.5 h-4.5 text-[var(--up)]" />
            </div>
            <div className="min-w-0">
              <p className="label-micro mb-0.5">Active Idea Batches</p>
              <NumberCountUp
                value={activeBatches}
                duration={600}
                delayMs={80}
                className="text-2xl font-semibold text-[var(--text-1)]"
              />
            </div>
          </div>
        </AnimatedBorderCard>

        <AnimatedBorderCard glowColor="violet" padding="normal">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(155,76,255,0.1)] flex items-center justify-center shrink-0">
              <Target className="w-4.5 h-4.5" style={{ color: 'var(--glow-violet)' }} />
            </div>
            <div className="min-w-0">
              <p className="label-micro mb-0.5">Last 3-Month Hit Rate</p>
              {hitRate != null ? (
                <NumberCountUp
                  value={hitRate}
                  duration={700}
                  decimals={0}
                  suffix="%"
                  delayMs={160}
                  className="text-2xl font-semibold text-[var(--text-1)]"
                />
              ) : (
                <p className="text-2xl font-semibold font-mono-nums text-[var(--text-3)]">–</p>
              )}
            </div>
          </div>
        </AnimatedBorderCard>
      </div>

      {/* Section B2: Secondary stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AnimatedBorderCard glowColor="amber" padding="normal">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(245,166,35,0.1)] flex items-center justify-center shrink-0">
              <Target className="w-4.5 h-4.5 text-[var(--warn)]" />
            </div>
            <div className="min-w-0">
              <p className="label-micro mb-0.5">AI Setup Win Rate</p>
              {tradeStats?.winRate != null ? (
                <NumberCountUp
                  value={tradeStats.winRate}
                  duration={600}
                  suffix="%"
                  className="text-2xl font-semibold text-[var(--text-1)]"
                />
              ) : (
                <p className="text-2xl font-semibold font-mono-nums text-[var(--text-3)]">–</p>
              )}
            </div>
          </div>
        </AnimatedBorderCard>

        <AnimatedBorderCard glowColor="blue" padding="normal">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[rgba(62,130,247,0.1)] flex items-center justify-center shrink-0">
              <Target className="w-4.5 h-4.5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <p className="label-micro mb-0.5">Paper Trades Active</p>
              <NumberCountUp
                value={paperStats?.active ?? 0}
                duration={500}
                delayMs={80}
                className="text-2xl font-semibold text-[var(--text-1)]"
              />
              {paperStats && (paperStats.wins > 0 || paperStats.losses > 0) && (
                <p className="text-[10px] text-[var(--text-3)] font-mono-nums mt-0.5">
                  {paperStats.wins}W / {paperStats.losses}L
                </p>
              )}
            </div>
          </div>
        </AnimatedBorderCard>

        <AnimatedBorderCard
          glowColor={
            paperStats?.winRate != null && paperStats.winRate >= 50 ? 'green' : 'red'
          }
          padding="normal"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                paperStats?.winRate != null && paperStats.winRate >= 50
                  ? 'bg-[rgba(38,208,124,0.1)]'
                  : 'bg-[rgba(240,74,74,0.1)]'
              }`}
            >
              <CheckCircle
                className={`w-4.5 h-4.5 ${
                  paperStats?.winRate != null && paperStats.winRate >= 50
                    ? 'text-[var(--up)]'
                    : 'text-[var(--down)]'
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="label-micro mb-0.5">Paper Win Rate</p>
              {paperStats?.winRate != null ? (
                <NumberCountUp
                  value={paperStats.winRate}
                  duration={650}
                  delayMs={160}
                  suffix="%"
                  className={`text-2xl font-semibold ${
                    paperStats.winRate >= 50 ? 'text-[var(--up)]' : 'text-[var(--down)]'
                  }`}
                />
              ) : (
                <p className="text-2xl font-semibold font-mono-nums text-[var(--text-3)]">–</p>
              )}
              {paperStats?.avgReturnPct != null && (
                <p
                  className={`text-[10px] font-mono-nums mt-0.5 ${
                    paperStats.avgReturnPct >= 0 ? 'price-up' : 'price-down'
                  }`}
                >
                  Avg {paperStats.avgReturnPct > 0 ? '+' : ''}
                  {paperStats.avgReturnPct}%
                </p>
              )}
            </div>
          </div>
        </AnimatedBorderCard>
      </div>

      {/* Section: Market Regime + Top Gainer/Loser */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Market Regime */}
        <div className="glass-effect rounded-lg p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            marketRegime.icon === 'up' ? 'bg-green-600/10' : marketRegime.icon === 'down' ? 'bg-red-600/10' : 'bg-amber-600/10'
          }`}>
            {marketRegime.icon === 'up' ? <TrendingUp className="w-5 h-5 text-green-500" /> :
             marketRegime.icon === 'down' ? <TrendingDown className="w-5 h-5 text-red-500" /> :
             <Minus className="w-5 h-5 text-amber-500" />}
          </div>
          <div>
            <p className="text-[11px] text-gray-500">Market Regime (NIFTY)</p>
            <p className={`text-xl font-bold ${marketRegime.color}`}>{marketRegime.label}</p>
            {marketRegime.niftyChange != null && (
              <p className={`text-[10px] ${marketRegime.niftyChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {marketRegime.niftyChange > 0 ? '+' : ''}{marketRegime.niftyChange.toFixed(2)}% today
              </p>
            )}
          </div>
        </div>

        {/* Top Gainer / Loser from Active Trades */}
        <div className="glass-effect rounded-lg p-4">
          <p className="text-[11px] text-gray-500 mb-2 flex items-center"><BarChart3 className="w-3 h-3 mr-1" />Top Gainer / Loser (Active Trades)</p>
          {activeSetups.length === 0 ? (
            <p className="text-xs text-gray-400">No active trades</p>
          ) : (() => {
            const withPnl = activeSetups
              .map(s => ({
                symbol: s.symbol,
                pnl: s.currentPrice && s.entryPrice > 0
                  ? ((s.currentPrice - s.entryPrice) / s.entryPrice) * 100 * (s.action === 'SELL' ? -1 : 1)
                  : null
              }))
              .filter(s => s.pnl != null) as { symbol: string; pnl: number }[];
            if (withPnl.length === 0) return <p className="text-xs text-gray-400">Awaiting price data</p>;
            const sorted = [...withPnl].sort((a, b) => b.pnl - a.pnl);
            const gainer = sorted[0];
            const loser = sorted[sorted.length - 1];
            return (
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Gainer</p>
                  <p className="text-sm font-semibold text-green-600">{gainer.symbol}</p>
                  <p className="text-xs font-mono-nums text-green-500">+{gainer.pnl.toFixed(2)}%</p>
                </div>
                {loser.symbol !== gainer.symbol && (
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Loser</p>
                    <p className="text-sm font-semibold text-red-600">{loser.symbol}</p>
                    <p className="text-xs font-mono-nums text-red-500">{loser.pnl.toFixed(2)}%</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Section B2: Daily P&L + Position Sizer side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyPnLWidget />
        <PositionSizer />
      </div>

      {/* Section B2b: Risk Engine (Sprint 3 #10) — portfolio drawdown + sector + bot caps */}
      <RiskEnginePanel />

      {/* Section B2c: Kill Switch Board (Sprint 3 #11) — unified kill status + panic button */}
      <KillSwitchBoard />

      {/* Section B2d: Validator (Sprint 3 #6) — pre-flight gate for bot + manual candidates */}
      <ValidatorPanel />

      {/* Section B2e: Scanner (Sprint 3 #5) — bot entry-point; pulls top-N from screen batches + validates */}
      <ScannerPanel />

      {/* Section B2f: Bot Ops (Sprint 4 #1-#4) — 4 paper bots: enable, schedule, run */}
      <BotOpsPanel />

      {/* Section B3: Market Regime (Sprint 2 #30) — top of Indian-signals row */}
      <MarketRegimeWidget />

      {/* Section B4: Sector Rotation Heatmap (Sprint 2 #28) — who's leading / lagging */}
      <SectorRotationHeatmap />

      {/* Section B5: FII / DII flows (Sprint 2 #26 — Indian directional signal) */}
      <FiiDiiWidget />

      {/* Section B6: Corporate Events Calendar (Sprint 2 #27) — dividends, splits, earnings */}
      <CorporateEventsWidget />

      {/* Section B7: Large Deals / Smart Money (Sprint 2 #29) — bulk, block, short */}
      <LargeDealsWidget />

      {/* Section C: Active Trade Setups Tracker */}
      {activeSetups.length > 0 && (
        <div className="glass-effect rounded-xl p-6 shadow-lg border-2 border-orange-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Target className="h-5 w-5 mr-2 text-orange-600" />
              Active Trade Setups
              <span className="ml-2 text-xs font-normal text-gray-400">
                {activeSetups.length} active &middot; {tradeStats?.targetHit || 0} wins &middot; {tradeStats?.slHit || 0} losses
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entry</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">SL</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L %</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Screen</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeSetups.map((setup) => {
                  const pnl = setup.currentPrice && setup.entryPrice > 0
                    ? ((setup.currentPrice - setup.entryPrice) / setup.entryPrice) * 100 * (setup.action === 'SELL' ? -1 : 1)
                    : null;
                  return (
                    <tr key={setup._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{setup.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          setup.action === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>{setup.action}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">₹{setup.entryPrice.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {setup.currentPrice ? `₹${setup.currentPrice.toLocaleString('en-IN')}` : '–'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">₹{setup.stopLoss.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">₹{setup.target.toLocaleString('en-IN')}</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${
                        pnl != null ? (pnl > 0 ? 'text-green-600' : pnl < 0 ? 'text-red-600' : 'text-gray-500') : 'text-gray-400'
                      }`}>
                        {pnl != null ? `${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%` : '–'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[120px]" title={setup.screenName || ''}>
                        {setup.screenName || '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Screen Leaderboard */}
      {screenLeaderboard.length > 0 && (
        <div className="glass-effect rounded-xl p-6 shadow-lg accent-left">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="h-4 w-4 mr-2 text-purple-500" />
            Top Performing Screens
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {screenLeaderboard.map((screen, idx) => (
              <div key={screen.name} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-700 truncate">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {screen.name}</p>
                  <span className={`badge-${screen.status === 'active' ? 'success' : screen.status === 'underperforming' ? 'warning' : 'primary'}`}>
                    {screen.status}
                  </span>
                </div>
                <p className="text-xl font-bold font-mono-nums text-gray-900">{screen.performanceScore.toFixed(0)}<span className="text-xs font-normal text-gray-500">/100</span></p>
                <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                  {screen.avgHitRate != null && <span>Hit: {screen.avgHitRate.toFixed(0)}%</span>}
                  {screen.avgAIWinRate != null && <span>AI Win: {screen.avgAIWinRate.toFixed(0)}%</span>}
                  <span>{screen.totalBatches} batches</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Setup Summary (when no active but has history) */}
      {activeSetups.length === 0 && tradeStats && tradeStats.total > 0 && (
        <div className="glass-effect rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2 text-orange-600" />
            Trade Setup Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-green-600">{tradeStats.targetHit}</p>
              <p className="text-xs text-gray-500">Targets Hit</p>
            </div>
            <div>
              <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-600">{tradeStats.slHit}</p>
              <p className="text-xs text-gray-500">Stop Losses Hit</p>
            </div>
            <div>
              <Clock className="h-6 w-6 text-gray-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-600">{tradeStats.expired}</p>
              <p className="text-xs text-gray-500">Expired</p>
            </div>
            <div>
              <Target className="h-6 w-6 text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-orange-600">{tradeStats.winRate != null ? `${tradeStats.winRate}%` : '–'}</p>
              <p className="text-xs text-gray-500">Win Rate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
