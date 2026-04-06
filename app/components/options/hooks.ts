'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BACKEND_URL, STRATEGY_PRESETS, STRIKES_AROUND_ATM } from './constants';
import { OptionChainData, StrategyLeg, PayoffResult, MarginData, OptionsMockTrade, TradeStats, RealTrade, RealTradeStats, Strike } from './types';
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
      }, 30000);
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

// ─── useLivePnL: live P&L for open trades ─────────────────────────────────────

export function useLivePnL(openTrades: OptionsMockTrade[], chain: OptionChainData | null) {
  const livePnL = useMemo(() => {
    if (!chain || !openTrades.length) return {};
    const result: Record<string, { totalPnl: number; legs: { instrument: string; entryPremium: number; currentLtp: number; pnl: number }[] }> = {};

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
        legPnLs.push({
          instrument: `${leg.side[0]} ${trade.expiry?.slice(5)} ${leg.strike} ${leg.type}`,
          entryPremium: leg.premium,
          currentLtp,
          pnl,
        });
      }

      result[trade._id] = { totalPnl, legs: legPnLs };
    }

    return result;
  }, [openTrades, chain]);

  return livePnL;
}
