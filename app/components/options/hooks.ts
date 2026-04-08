'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BACKEND_URL, STRATEGY_PRESETS, STRIKES_AROUND_ATM } from './constants';
import { OptionChainData, StrategyLeg, PayoffResult, MarginData, OptionsMockTrade, TradeStats, RealTrade, RealTradeStats, Strike, OptionsPortfolio, PortfolioPnL } from './types';
import { nextLegId, estimateSpotFromChain, getDTE, getStrikeStep, guessStrategyName } from './utils';

// ─── useOptionsData: chain, expiries, spot price ──────────────────────────────

export function useOptionsData(underlying: string) {
  const [expiries, setExpiries] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [lotSize, setLotSize] = useState(0);
  const [chain, setChain] = useState<OptionChainData | null>(null);
  const [spotPrice, setSpotPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Fetch expiries when underlying changes
  useEffect(() => {
    (async () => {
      try {
        setError('');
        const res = await fetch(`${BACKEND_URL}/api/options/expiries/${underlying}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setExpiries(json.data.expiries);
          setLotSize(json.data.lotSize);
          if (json.data.expiries.length > 0) setSelectedExpiry(json.data.expiries[0]);
        } else {
          setError(json.message || 'Failed to fetch expiries');
        }
      } catch (e: any) { setError(e.message || 'Network error'); }
    })();
  }, [underlying]);

  // Fetch chain
  const fetchChain = useCallback(async () => {
    if (!selectedExpiry) return;
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${BACKEND_URL}/api/options/chain/${underlying}?expiry=${selectedExpiry}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const data = json.data as OptionChainData;
        setChain(data);
        setLastRefresh(new Date());
        setSpotPrice(estimateSpotFromChain(data.strikes));
      } else {
        setError(json.message || 'Failed to fetch chain');
      }
    } catch (e: any) { setError(e.message || 'Network error'); }
    finally { setLoading(false); }
  }, [underlying, selectedExpiry]);

  // Fetch chain when expiry changes
  useEffect(() => { fetchChain(); }, [fetchChain]);

  // Auto-refresh every 30s during market hours (IST-aware, holiday-aware via shared util)
  useEffect(() => {
    if (!selectedExpiry) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const [{ getMarketState }, holidaysRes] = await Promise.all([
        import('../../lib/marketHours'),
        fetch(`${BACKEND_URL}/api/market-status/holidays`).then(r => r.json()).catch(() => null),
      ]);
      const holidays = holidaysRes?.data?.holidays || [];
      if (cancelled) return;
      interval = setInterval(() => {
        if (getMarketState(new Date(), holidays).isOpen) fetchChain();
      }, 10000);
    })();
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [fetchChain, selectedExpiry]);

  // Visible strikes around ATM
  const visibleStrikes = useMemo(() => {
    if (!chain?.strikes.length || !spotPrice) return [];
    const sorted = [...chain.strikes].sort((a, b) => a.strike - b.strike);
    const atmIdx = sorted.findIndex(s => s.strike >= spotPrice);
    const start = Math.max(0, atmIdx - STRIKES_AROUND_ATM);
    const end = Math.min(sorted.length, atmIdx + STRIKES_AROUND_ATM + 1);
    return sorted.slice(start, end);
  }, [chain, spotPrice]);

  const strikeStep = useMemo(() => getStrikeStep(chain?.strikes || []), [chain]);

  return {
    expiries, selectedExpiry, setSelectedExpiry,
    lotSize, chain, spotPrice, loading, error,
    lastRefresh, fetchChain, visibleStrikes, strikeStep,
  };
}

// ─── useStrategyBuilder: legs, payoff, presets ────────────────────────────────

export function useStrategyBuilder(
  chain: OptionChainData | null,
  spotPrice: number,
  lotSize: number,
  selectedExpiry: string,
) {
  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [payoff, setPayoff] = useState<PayoffResult | null>(null);
  const [payoffLoading, setPayoffLoading] = useState(false);
  const [multiplier, setMultiplier] = useState(1);

  const strategyName = useMemo(() => guessStrategyName(legs), [legs]);

  // Recalculate payoff when legs change
  useEffect(() => {
    if (legs.length > 0 && spotPrice > 0) {
      calculatePayoff();
    } else {
      setPayoff(null);
    }
  }, [legs, spotPrice]);

  async function calculatePayoff() {
    if (!legs.length || !spotPrice) return;
    try {
      setPayoffLoading(true);
      const avgIV = legs.reduce((sum, l) => sum + l.iv, 0) / legs.length || 0.15;
      const res = await fetch(`${BACKEND_URL}/api/options/payoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legs: legs.map(l => ({
            type: l.type, strike: l.strike, premium: l.premium,
            qty: l.qty * multiplier, side: l.side, lotSize: l.lotSize,
            delta: l.delta, theta: l.theta, gamma: l.gamma, vega: l.vega,
          })),
          spotPrice,
          iv: avgIV,
          daysToExpiry: getDTE(selectedExpiry) || 1,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') setPayoff(json.data);
    } catch (e) { console.error('Payoff calc error:', e); }
    finally { setPayoffLoading(false); }
  }

  // Add a leg from chain strike
  function addLeg(strike: Strike, type: 'CE' | 'PE', side: 'BUY' | 'SELL') {
    const opt = type === 'CE' ? strike.ce : strike.pe;
    const newLeg: StrategyLeg = {
      id: nextLegId(),
      type, strike: strike.strike, premium: opt.ltp,
      qty: 1, side, lotSize,
      iv: opt.iv, delta: opt.delta, theta: opt.theta, gamma: opt.gamma, vega: opt.vega,
      instrumentKey: opt.instrumentKey || '',
    };
    setLegs(prev => [...prev, newLeg]);
  }

  // Remove a leg
  function removeLeg(id: string) {
    setLegs(prev => prev.filter(l => l.id !== id));
  }

  // Toggle BUY/SELL
  function toggleLegSide(id: string) {
    setLegs(prev => prev.map(l => l.id === id ? { ...l, side: l.side === 'BUY' ? 'SELL' : 'BUY' } : l));
  }

  // Update leg quantity
  function updateLegQty(id: string, qty: number) {
    if (qty < 1) return;
    setLegs(prev => prev.map(l => l.id === id ? { ...l, qty } : l));
  }

  // Update leg strike (move to adjacent strike)
  function updateLegStrike(id: string, direction: -1 | 1) {
    if (!chain) return;
    const step = getStrikeStep(chain.strikes);
    setLegs(prev => prev.map(l => {
      if (l.id !== id) return l;
      const newStrike = l.strike + step * direction;
      const strikeData = chain.strikes.find(s => s.strike === newStrike);
      if (!strikeData) return l;
      const opt = l.type === 'CE' ? strikeData.ce : strikeData.pe;
      return { ...l, strike: newStrike, premium: opt.ltp, iv: opt.iv, delta: opt.delta, theta: opt.theta, gamma: opt.gamma, vega: opt.vega };
    }));
  }

  // Apply a preset strategy
  function applyPreset(presetName: string) {
    if (!chain || !spotPrice) return;
    const preset = STRATEGY_PRESETS.find(p => p.name === presetName);
    if (!preset) return;
    const step = getStrikeStep(chain.strikes);
    const atmStrike = chain.strikes.reduce((best, s) =>
      Math.abs(s.strike - spotPrice) < Math.abs(best.strike - spotPrice) ? s : best
    ).strike;

    const presetLegs = preset.legs(atmStrike, step);
    const newLegs: StrategyLeg[] = presetLegs.map(pl => {
      const strikeData = chain.strikes.find(s => s.strike === pl.strike);
      const opt = strikeData ? (pl.type === 'CE' ? strikeData.ce : strikeData.pe) : null;
      return {
        id: nextLegId(),
        type: pl.type,
        strike: pl.strike,
        premium: opt?.ltp || 0,
        qty: pl.qty,
        side: pl.side,
        lotSize,
        iv: opt?.iv || 0,
        delta: opt?.delta || 0,
        theta: opt?.theta || 0,
        gamma: opt?.gamma || 0,
        vega: opt?.vega || 0,
      };
    });
    setLegs(newLegs);
  }

  // Shift all strikes up or down by one step
  function shiftStrikes(direction: -1 | 1) {
    if (!chain) return;
    const step = getStrikeStep(chain.strikes);
    setLegs(prev => prev.map(l => {
      const newStrike = l.strike + step * direction;
      const strikeData = chain.strikes.find(s => s.strike === newStrike);
      if (!strikeData) return l;
      const opt = l.type === 'CE' ? strikeData.ce : strikeData.pe;
      return { ...l, strike: newStrike, premium: opt.ltp, iv: opt.iv, delta: opt.delta, theta: opt.theta, gamma: opt.gamma, vega: opt.vega };
    }));
  }

  // Reset prices from current chain data
  function resetPrices() {
    if (!chain) return;
    setLegs(prev => prev.map(l => {
      const strikeData = chain.strikes.find(s => s.strike === l.strike);
      if (!strikeData) return l;
      const opt = l.type === 'CE' ? strikeData.ce : strikeData.pe;
      return { ...l, premium: opt.ltp, iv: opt.iv, delta: opt.delta, theta: opt.theta, gamma: opt.gamma, vega: opt.vega };
    }));
  }

  // Clear all legs
  function clearAll() {
    setLegs([]);
    setPayoff(null);
  }

  // Computed: net premium and type
  const netPremiumInfo = useMemo(() => {
    if (!legs.length) return { netPremium: 0, premiumType: 'CREDIT' as const, totalPremiumValue: 0 };
    let net = 0;
    legs.forEach(l => {
      const val = l.premium * l.qty * multiplier;
      net += l.side === 'SELL' ? val : -val;
    });
    const totalPremiumValue = Math.abs(net) * lotSize;
    return {
      netPremium: Math.abs(net),
      premiumType: net >= 0 ? 'CREDIT' as const : 'DEBIT' as const,
      totalPremiumValue,
    };
  }, [legs, multiplier, lotSize]);

  return {
    legs, setLegs, addLeg, removeLeg, toggleLegSide,
    updateLegQty, updateLegStrike, applyPreset,
    shiftStrikes, resetPrices, clearAll,
    payoff, payoffLoading, strategyName,
    multiplier, setMultiplier, netPremiumInfo,
  };
}

// ─── useTrades: paper trades + real trades CRUD ───────────────────────────────

export function useTrades() {
  const [trades, setTrades] = useState<OptionsMockTrade[]>([]);
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null);
  const [realTrades, setRealTrades] = useState<RealTrade[]>([]);
  const [realTradeStats, setRealTradeStats] = useState<RealTradeStats | null>(null);
  const [tradeReviews, setTradeReviews] = useState<Record<string, string>>({});
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchTrades();
    fetchTradeStats();
    fetchRealTrades();
    fetchRealTradeStats();
  }, []);

  async function fetchTrades() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/trades`);
      const json = await res.json();
      if (json.status === 'success') setTrades(json.data);
    } catch (e) { console.error('Fetch trades error:', e); }
  }

  async function fetchTradeStats() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/trades/stats`);
      const json = await res.json();
      if (json.status === 'success') setTradeStats(json.data);
    } catch (e) { console.error('Fetch trade stats error:', e); }
  }

  async function paperTrade(data: {
    underlying: string; expiry: string; strategyName: string;
    legs: any[]; entrySpot: number; netPremium: number; premiumType: string;
    maxProfit: number | string; maxLoss: number | string; breakevens: number[]; pop: number;
  }) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.status === 'success') {
        fetchTrades();
        fetchTradeStats();
        return json.data;
      }
    } catch (e) { console.error('Paper trade error:', e); }
    return null;
  }

  async function closeTrade(id: string, exitPnl: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/trades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', exitPnl }),
      });
      const json = await res.json();
      if (json.status === 'success') { fetchTrades(); fetchTradeStats(); }
    } catch (e) { console.error('Close trade error:', e); }
  }

  async function deleteTrade(id: string) {
    try {
      await fetch(`${BACKEND_URL}/api/options/trades/${id}`, { method: 'DELETE' });
      fetchTrades(); fetchTradeStats();
    } catch (e) { console.error('Delete trade error:', e); }
  }

  async function reviewTrade(id: string) {
    try {
      setReviewLoading(id);
      const res = await fetch(`${BACKEND_URL}/api/options/trades/${id}/ai-review`, { method: 'POST' });
      const json = await res.json();
      if (json.status === 'success') {
        setTradeReviews(prev => ({ ...prev, [id]: json.data.review }));
      }
    } catch (e) { console.error('Review error:', e); }
    finally { setReviewLoading(null); }
  }

  // Real trades
  async function fetchRealTrades() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/realTrades`);
      const json = await res.json();
      if (json.status === 'success') setRealTrades(json.data);
    } catch (e) { console.error('Fetch real trades error:', e); }
  }

  async function fetchRealTradeStats() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/realTrades/stats`);
      const json = await res.json();
      if (json.status === 'success') setRealTradeStats(json.data);
    } catch (e) { console.error('Fetch real trade stats error:', e); }
  }

  return {
    trades, tradeStats, realTrades, realTradeStats,
    paperTrade, closeTrade, deleteTrade,
    reviewTrade, tradeReviews, reviewLoading,
    fetchTrades, fetchTradeStats,
    fetchRealTrades, fetchRealTradeStats,
  };
}

// ─── useLivePnL: live P&L via independent polling (not chain-dependent) ──────

export function useLivePnL(openTrades: OptionsMockTrade[], chain: OptionChainData | null) {
  const [livePnL, setLivePnL] = useState<Record<string, { totalPnl: number; spotPrice?: number; legs: { instrument: string; entryPremium: number; currentLtp: number; pnl: number }[] }>>({});
  const [lastPnLUpdate, setLastPnLUpdate] = useState<Date | null>(null);

  const hasOpenTrades = openTrades.some(t => t.status === 'open');

  // Poll backend every 10s for live position LTPs
  useEffect(() => {
    if (!hasOpenTrades) { setLivePnL({}); return; }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchPositionLTP() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/options/positions-ltp`);
        const json = await res.json();
        if (!cancelled && json.status === 'success' && json.data) {
          // Transform backend response to match UI format
          const result: typeof livePnL = {};
          for (const [tradeId, data] of Object.entries(json.data as Record<string, any>)) {
            result[tradeId] = {
              totalPnl: data.totalPnl,
              spotPrice: data.spotPrice,
              legs: data.legs.map((l: any) => ({
                instrument: `${l.side[0]} ${l.strike} ${l.type}`,
                entryPremium: l.entryPremium,
                currentLtp: l.currentLtp,
                pnl: l.pnl,
              })),
            };
          }
          setLivePnL(result);
          setLastPnLUpdate(new Date());
        }
      } catch (e) { /* silent — will retry next interval */ }
    }

    // Fetch immediately, then every 10s during market hours
    fetchPositionLTP();

    (async () => {
      let getMarketState: any;
      let holidays: string[] = [];
      try {
        const mod = await import('../../lib/marketHours');
        getMarketState = mod.getMarketState;
        const hRes = await fetch(`${BACKEND_URL}/api/market-status/holidays`).then(r => r.json()).catch(() => null);
        holidays = hRes?.data?.holidays || [];
      } catch { }

      if (cancelled) return;

      interval = setInterval(() => {
        // Always fetch if market open; also fetch once after close for final prices
        if (getMarketState) {
          const state = getMarketState(new Date(), holidays);
          if (state.isOpen) fetchPositionLTP();
        } else {
          fetchPositionLTP(); // no market hours util → always fetch
        }
      }, 10000); // 10-second refresh
    })();

    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [hasOpenTrades]);

  // Fallback: also compute from chain data when available (for immediate updates)
  const mergedPnL = useMemo(() => {
    if (Object.keys(livePnL).length > 0) return livePnL;
    // Fallback to chain-based calculation if polling hasn't returned yet
    if (!chain || !openTrades.length) return {};
    const result: typeof livePnL = {};
    for (const trade of openTrades) {
      if (trade.status !== 'open') continue;
      let totalPnl = 0;
      const legPnLs: { instrument: string; entryPremium: number; currentLtp: number; pnl: number }[] = [];
      for (const leg of trade.legs) {
        const strikeData = chain.strikes.find(s => s.strike === leg.strike);
        if (!strikeData) continue;
        const currentLtp = leg.type === 'CE' ? strikeData.ce.ltp : strikeData.pe.ltp;
        const direction = leg.side === 'SELL' ? -1 : 1;
        const pnl = direction * (currentLtp - leg.premium) * leg.qty * (leg.lotSize || 1);
        totalPnl += pnl;
        legPnLs.push({ instrument: `${leg.side[0]} ${leg.strike} ${leg.type}`, entryPremium: leg.premium, currentLtp, pnl });
      }
      result[trade._id] = { totalPnl, legs: legPnLs };
    }
    return result;
  }, [livePnL, openTrades, chain]);

  return mergedPnL;
}

// ─── usePortfolios: CRUD for options portfolios ──────────────────────────────

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<OptionsPortfolio[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPortfolios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/options/portfolios`);
      const json = await res.json();
      if (json.status === 'success') setPortfolios(json.data);
    } catch (e) { console.error('Fetch portfolios error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPortfolios(); }, [fetchPortfolios]);

  const createPortfolio = useCallback(async (name: string, description?: string, color?: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/portfolios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });
      const json = await res.json();
      if (json.status === 'success') { fetchPortfolios(); return json.data; }
    } catch (e) { console.error('Create portfolio error:', e); }
    return null;
  }, [fetchPortfolios]);

  const deletePortfolio = useCallback(async (id: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/options/portfolios/${id}`, { method: 'DELETE' });
      fetchPortfolios();
    } catch (e) { console.error('Delete portfolio error:', e); }
  }, [fetchPortfolios]);

  const updatePortfolio = useCallback(async (id: string, data: { name?: string; description?: string; color?: string }) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/portfolios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.status === 'success') fetchPortfolios();
    } catch (e) { console.error('Update portfolio error:', e); }
  }, [fetchPortfolios]);

  const addTradeToPortfolio = useCallback(async (portfolioId: string, tradeId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/portfolios/${portfolioId}/add-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });
      const json = await res.json();
      if (json.status === 'success') fetchPortfolios();
    } catch (e) { console.error('Add trade to portfolio error:', e); }
  }, [fetchPortfolios]);

  const removeTradeFromPortfolio = useCallback(async (portfolioId: string, tradeId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/portfolios/${portfolioId}/remove-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });
      const json = await res.json();
      if (json.status === 'success') fetchPortfolios();
    } catch (e) { console.error('Remove trade from portfolio error:', e); }
  }, [fetchPortfolios]);

  const fetchPortfolioPnL = useCallback(async (id: string, period: string): Promise<PortfolioPnL | null> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/portfolios/${id}/pnl?period=${period}`);
      const json = await res.json();
      if (json.status === 'success') return json.data;
    } catch (e) { console.error('Fetch portfolio PnL error:', e); }
    return null;
  }, []);

  return {
    portfolios, loading, fetchPortfolios,
    createPortfolio, deletePortfolio, updatePortfolio,
    addTradeToPortfolio, removeTradeFromPortfolio, fetchPortfolioPnL,
  };
}
