'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, BarChart3, Plus, X, Zap, Target, Brain, DollarSign,
  BookOpen, Trash2, CheckCircle, Clock, XCircle, Activity, Award, FileText,
} from 'lucide-react';
import PayoffChart from './PayoffChart';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OptionSide {
  ltp: number;
  oi: number;
  volume: number;
  iv: number;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  bidPrice: number;
  askPrice: number;
  instrumentKey: string;
}

interface Strike {
  strike: number;
  ce: OptionSide;
  pe: OptionSide;
}

interface OptionChainData {
  underlying: string;
  expiry: string;
  strikes: Strike[];
  totalCallOI: number;
  totalPutOI: number;
  pcr: string;
}

interface ExpiryData {
  expiries: string[];
  lotSize: number;
  underlying: string;
}

interface StrategyLeg {
  id: string;
  type: 'CE' | 'PE';
  strike: number;
  premium: number;
  qty: number;
  side: 'BUY' | 'SELL';
  lotSize: number;
  iv: number;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
}

interface PayoffResult {
  payoffData: { spot: number; pnl: number }[];
  breakevens: number[];
  maxProfit: number | string;
  maxLoss: number | string;
  riskReward: number | string;
  sdMoves: { sd1Upper: number; sd1Lower: number; sd2Upper: number; sd2Lower: number; sdValue: number };
  greeks: { netDelta: number; netTheta: number; netGamma: number; netVega: number };
  netPremium: number;
  premiumType: string;
  pop: number;
}

interface MarginData {
  totalMargin: number;
  spanMargin: number;
  exposureMargin: number;
  marginBenefit: number;
  error?: string;
}

interface OptionsMockTrade {
  _id: string;
  underlying: string;
  expiry: string;
  strategyName: string;
  legs: { type: string; strike: number; premium: number; qty: number; side: string; lotSize: number }[];
  entrySpot: number;
  exitSpot: number | null;
  netPremium: number;
  premiumType: string;
  maxProfit: number | string;
  maxLoss: number | string;
  breakevens: number[];
  pop: number;
  status: string;
  exitPnl: number | null;
  notes: string;
  closedAt: string | null;
  createdAt: string;
}

interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  openTrades: number;
}

interface RealTrade {
  _id: string;
  underlying: string;
  expiry: string;
  strategyName: string;
  legsText: string;
  entrySpot: number;
  exitSpot: number | null;
  netPremium: number;
  premiumType: string;
  exitPnl: number | null;
  brokerage: number;
  broker: string;
  notes: string;
  status: string;
  closedAt: string | null;
  createdAt: string;
}

interface RealTradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  totalBrokerage: number;
  openTrades: number;
}

interface NewRealTradeForm {
  underlying: string;
  expiry: string;
  strategyName: string;
  entrySpot: string;
  netPremium: string;
  premiumType: 'CREDIT' | 'DEBIT';
  broker: string;
  brokerage: string;
  legsText: string;
  notes: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const UNDERLYINGS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX', 'MIDCPNIFTY'];
const STRIKES_AROUND_ATM = 15;

const STRATEGY_PRESETS: { name: string; legs: (atm: number, step: number) => Omit<StrategyLeg, 'id' | 'premium' | 'lotSize' | 'iv' | 'delta' | 'theta' | 'gamma' | 'vega'>[] }[] = [
  {
    name: 'Short Straddle',
    legs: (atm) => [
      { type: 'CE', strike: atm, qty: 1, side: 'SELL' },
      { type: 'PE', strike: atm, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Short Strangle',
    legs: (atm, step) => [
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'SELL' },
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Iron Condor',
    legs: (atm, step) => [
      { type: 'PE', strike: atm - step * 4, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 4, qty: 1, side: 'BUY' },
    ],
  },
  {
    name: 'Bull Call Spread',
    legs: (atm, step) => [
      { type: 'CE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'CE', strike: atm + step * 3, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Bear Put Spread',
    legs: (atm, step) => [
      { type: 'PE', strike: atm, qty: 1, side: 'BUY' },
      { type: 'PE', strike: atm - step * 3, qty: 1, side: 'SELL' },
    ],
  },
  {
    name: 'Jade Lizard',
    legs: (atm, step) => [
      { type: 'PE', strike: atm - step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 2, qty: 1, side: 'SELL' },
      { type: 'CE', strike: atm + step * 4, qty: 1, side: 'BUY' },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatNum(n: number, decimals = 2): string {
  if (n === 0) return '-';
  if (Math.abs(n) >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 100000) return (n / 100000).toFixed(2) + ' L';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

function formatINR(n: number): string {
  return '\u20B9' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

let legCounter = 0;
function nextLegId() { return 'leg-' + (++legCounter); }

// ─── Component ─────────────────────────────────────────────────────────────────

export default function OptionsTab() {
  // Chain state
  const [underlying, setUnderlying] = useState('NIFTY');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [lotSize, setLotSize] = useState(0);
  const [chain, setChain] = useState<OptionChainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showGreeks, setShowGreeks] = useState(false);
  const [spotPrice, setSpotPrice] = useState(0);

  // Strategy builder state
  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [payoff, setPayoff] = useState<PayoffResult | null>(null);
  const [payoffLoading, setPayoffLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // Phase 3: Margin + AI
  const [margin, setMargin] = useState<MarginData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Phase 4: Mock trades
  const [trades, setTrades] = useState<OptionsMockTrade[]>([]);
  const [tradeStats, setTradeStats] = useState<TradeStats | null>(null);
  const [showTrades, setShowTrades] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [closeExitPnl, setCloseExitPnl] = useState('');

  // AI trade reviews (keyed by trade _id)
  const [tradeReviews, setTradeReviews] = useState<Record<string, string>>({});
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  // Real Trades Journal
  const [realTrades, setRealTrades] = useState<RealTrade[]>([]);
  const [realTradeStats, setRealTradeStats] = useState<RealTradeStats | null>(null);
  const [showRealTrades, setShowRealTrades] = useState(false);
  const [showAddRealTrade, setShowAddRealTrade] = useState(false);
  const [closingRealTradeId, setClosingRealTradeId] = useState<string | null>(null);
  const [closeRealExitPnl, setCloseRealExitPnl] = useState('');
  const [newRealTrade, setNewRealTrade] = useState<NewRealTradeForm>({
    underlying: 'NIFTY', expiry: '', strategyName: '', entrySpot: '',
    netPremium: '', premiumType: 'CREDIT', broker: 'Zerodha',
    brokerage: '', legsText: '', notes: '',
  });

  // Fetch expiries when underlying changes
  useEffect(() => {
    fetchExpiries(underlying);
    setLegs([]);
    setPayoff(null);
  }, [underlying]);

  // Fetch chain when expiry is selected
  useEffect(() => {
    if (selectedExpiry) {
      fetchChain(underlying, selectedExpiry);
    }
  }, [selectedExpiry]);

  // Auto-refresh every 30 seconds during market hours
  useEffect(() => {
    if (!selectedExpiry) return;
    const interval = setInterval(() => {
      const now = new Date();
      const day = now.getDay();
      const t = now.getHours() * 60 + now.getMinutes();
      if (day >= 1 && day <= 5 && t >= 555 && t <= 930) {
        fetchChain(underlying, selectedExpiry);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [underlying, selectedExpiry]);

  // Recalculate payoff when legs change
  useEffect(() => {
    if (legs.length > 0 && spotPrice > 0) {
      calculatePayoff();
    } else {
      setPayoff(null);
    }
  }, [legs, spotPrice]);

  async function fetchExpiries(sym: string) {
    try {
      setError('');
      const res = await fetch(`${BACKEND_URL}/api/options/expiries/${sym}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const data = json.data as ExpiryData;
        setExpiries(data.expiries);
        setLotSize(data.lotSize);
        if (data.expiries.length > 0) setSelectedExpiry(data.expiries[0]);
      } else {
        setError(json.message || 'Failed to fetch expiries');
      }
    } catch (e: any) { setError(e.message || 'Network error'); }
  }

  async function fetchChain(sym: string, expiry: string) {
    try {
      setLoading(true); setError('');
      const res = await fetch(`${BACKEND_URL}/api/options/chain/${sym}?expiry=${expiry}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setChain(json.data as OptionChainData);
        setLastRefresh(new Date());
        estimateSpot(json.data as OptionChainData);
      } else { setError(json.message || 'Failed to fetch chain'); }
    } catch (e: any) { setError(e.message || 'Network error'); }
    finally { setLoading(false); }
  }

  function estimateSpot(data: OptionChainData) {
    if (!data.strikes.length) return;
    let minDiff = Infinity, atmStrike = data.strikes[0].strike;
    for (const s of data.strikes) {
      if (s.ce.ltp > 0 && s.pe.ltp > 0) {
        const diff = Math.abs(s.ce.ltp - s.pe.ltp);
        if (diff < minDiff) { minDiff = diff; atmStrike = s.strike; }
      }
    }
    setSpotPrice(atmStrike);
  }

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
            qty: l.qty, side: l.side, lotSize: l.lotSize,
            delta: l.delta, theta: l.theta, gamma: l.gamma, vega: l.vega,
          })),
          spotPrice,
          iv: avgIV,
          daysToExpiry: getDTE() || 1,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') setPayoff(json.data);
    } catch (e) { console.error('Payoff calc error:', e); }
    finally { setPayoffLoading(false); }
  }

  // ─── Phase 3: Margin + AI ───────────────────────────────────────────────────

  async function fetchMargin() {
    if (!legs.length) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/margin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legs: legs.map(l => ({ instrumentKey: l.id, qty: l.qty, lotSize: l.lotSize, side: l.side })) }),
      });
      const json = await res.json();
      if (json.status === 'success') setMargin(json.data);
    } catch (e) { console.error('Margin fetch error:', e); }
  }

  async function analyzeStrategy() {
    if (!legs.length || !payoff) return;
    try {
      setAiLoading(true);
      setAiAnalysis('');
      const res = await fetch(`${BACKEND_URL}/api/options/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          underlying, strategyName: guessStrategyName(),
          legs: legs.map(l => ({ type: l.type, strike: l.strike, premium: l.premium, qty: l.qty, side: l.side, lotSize: l.lotSize })),
          spotPrice, netPremium: payoff.netPremium, maxProfit: payoff.maxProfit,
          maxLoss: payoff.maxLoss, breakevens: payoff.breakevens, pop: payoff.pop,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') setAiAnalysis(json.data.analysis);
      else setAiAnalysis('Analysis failed: ' + (json.message || 'Unknown error'));
    } catch (e: any) { setAiAnalysis('Error: ' + e.message); }
    finally { setAiLoading(false); }
  }

  function guessStrategyName(): string {
    if (legs.length === 2 && legs.every(l => l.side === 'SELL') && legs.some(l => l.type === 'CE') && legs.some(l => l.type === 'PE')) {
      return legs[0].strike === legs[1].strike ? 'Short Straddle' : 'Short Strangle';
    }
    if (legs.length === 4 && legs.filter(l => l.side === 'BUY').length === 2 && legs.filter(l => l.side === 'SELL').length === 2) return 'Iron Condor';
    if (legs.length === 2 && legs.every(l => l.type === 'CE')) return legs.some(l => l.side === 'BUY') ? 'Bull Call Spread' : 'Bear Call Spread';
    if (legs.length === 2 && legs.every(l => l.type === 'PE')) return legs.some(l => l.side === 'BUY') ? 'Bear Put Spread' : 'Bull Put Spread';
    return 'Custom';
  }

  // ─── Phase 4: Mock Trades ──────────────────────────────────────────────────

  // Fetch trades on mount
  useEffect(() => { fetchTrades(); fetchTradeStats(); fetchRealTrades(); fetchRealTradeStats(); }, []);

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

  async function paperTradeStrategy() {
    if (!legs.length || !payoff) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          underlying, expiry: selectedExpiry, strategyName: guessStrategyName(),
          legs: legs.map(l => ({ type: l.type, strike: l.strike, premium: l.premium, qty: l.qty, side: l.side, lotSize: l.lotSize })),
          entrySpot: spotPrice, netPremium: payoff.netPremium, premiumType: payoff.premiumType,
          maxProfit: payoff.maxProfit, maxLoss: payoff.maxLoss, breakevens: payoff.breakevens, pop: payoff.pop,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        fetchTrades();
        fetchTradeStats();
        setShowTrades(true);
      }
    } catch (e) { console.error('Paper trade error:', e); }
  }

  async function closeTrade(id: string, exitPnl: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/trades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', exitPnl }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        fetchTrades();
        fetchTradeStats();
        setClosingTradeId(null);
        setCloseExitPnl('');
      }
    } catch (e) { console.error('Close trade error:', e); }
  }

  async function deleteTrade(id: string) {
    try {
      await fetch(`${BACKEND_URL}/api/options/trades/${id}`, { method: 'DELETE' });
      fetchTrades();
      fetchTradeStats();
    } catch (e) { console.error('Delete trade error:', e); }
  }

  // ─── AI Trade Review ──────────────────────────────────────────────────────────

  async function reviewTrade(tradeId: string) {
    try {
      setReviewLoading(tradeId);
      const res = await fetch(`${BACKEND_URL}/api/options/trades/${tradeId}/ai-review`, { method: 'POST' });
      const json = await res.json();
      if (json.status === 'success') {
        setTradeReviews(prev => ({ ...prev, [tradeId]: json.data.review }));
      }
    } catch (e) { console.error('Review error:', e); }
    finally { setReviewLoading(null); }
  }

  // ─── Real Trades Journal ───────────────────────────────────────────────────────

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

  async function addRealTrade() {
    if (!newRealTrade.underlying || !newRealTrade.expiry || !newRealTrade.entrySpot) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/realTrades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          underlying: newRealTrade.underlying,
          expiry: newRealTrade.expiry,
          strategyName: newRealTrade.strategyName || 'Custom',
          legsText: newRealTrade.legsText,
          entrySpot: parseFloat(newRealTrade.entrySpot) || 0,
          netPremium: parseFloat(newRealTrade.netPremium) || 0,
          premiumType: newRealTrade.premiumType,
          broker: newRealTrade.broker,
          brokerage: parseFloat(newRealTrade.brokerage) || 0,
          notes: newRealTrade.notes,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        fetchRealTrades();
        fetchRealTradeStats();
        setShowAddRealTrade(false);
        setNewRealTrade({
          underlying: 'NIFTY', expiry: '', strategyName: '', entrySpot: '',
          netPremium: '', premiumType: 'CREDIT', broker: 'Zerodha',
          brokerage: '', legsText: '', notes: '',
        });
      }
    } catch (e) { console.error('Add real trade error:', e); }
  }

  async function closeRealTrade(id: string, exitPnl: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/options/realTrades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', exitPnl }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        fetchRealTrades(); fetchRealTradeStats();
        setClosingRealTradeId(null); setCloseRealExitPnl('');
      }
    } catch (e) { console.error('Close real trade error:', e); }
  }

  async function deleteRealTrade(id: string) {
    try {
      await fetch(`${BACKEND_URL}/api/options/realTrades/${id}`, { method: 'DELETE' });
      fetchRealTrades(); fetchRealTradeStats();
    } catch (e) { console.error('Delete real trade error:', e); }
  }

  // ─── Leg Management ────────────────────────────────────────────────────────────

  function addLeg(strike: number, type: 'CE' | 'PE', side: 'BUY' | 'SELL') {
    if (!chain) return;
    const s = chain.strikes.find(st => st.strike === strike);
    if (!s) return;
    const opt = type === 'CE' ? s.ce : s.pe;

    const leg: StrategyLeg = {
      id: nextLegId(),
      type, strike, side,
      premium: opt.ltp,
      qty: 1,
      lotSize: lotSize || 1,
      iv: opt.iv / 100 || 0.15, // convert from % to decimal
      delta: opt.delta,
      theta: opt.theta,
      gamma: opt.gamma,
      vega: opt.vega,
    };
    setLegs(prev => [...prev, leg]);
    setShowBuilder(true);
  }

  function removeLeg(id: string) {
    setLegs(prev => prev.filter(l => l.id !== id));
  }

  function toggleLegSide(id: string) {
    setLegs(prev => prev.map(l => l.id === id ? { ...l, side: l.side === 'BUY' ? 'SELL' : 'BUY' } : l));
  }

  function updateLegQty(id: string, qty: number) {
    if (qty < 1) return;
    setLegs(prev => prev.map(l => l.id === id ? { ...l, qty } : l));
  }

  function applyPreset(presetIndex: number) {
    if (!chain || !chain.strikes.length) return;
    const preset = STRATEGY_PRESETS[presetIndex];
    // Find ATM and step
    const atmStrike = spotPrice;
    const sortedStrikes = chain.strikes.map(s => s.strike).sort((a, b) => a - b);
    const step = sortedStrikes.length > 1 ? sortedStrikes[1] - sortedStrikes[0] : 50;

    // Snap ATM to nearest actual strike
    let nearestATM = sortedStrikes[0];
    let minD = Infinity;
    for (const st of sortedStrikes) {
      const d = Math.abs(st - atmStrike);
      if (d < minD) { minD = d; nearestATM = st; }
    }

    const presetLegs = preset.legs(nearestATM, step);
    const newLegs: StrategyLeg[] = presetLegs.map(pl => {
      const s = chain!.strikes.find(st => st.strike === pl.strike);
      const opt = s ? (pl.type === 'CE' ? s.ce : s.pe) : null;
      return {
        id: nextLegId(),
        type: pl.type,
        strike: pl.strike,
        side: pl.side,
        premium: opt?.ltp || 0,
        qty: pl.qty,
        lotSize: lotSize || 1,
        iv: opt ? (opt.iv / 100 || 0.15) : 0.15,
        delta: opt?.delta || 0,
        theta: opt?.theta || 0,
        gamma: opt?.gamma || 0,
        vega: opt?.vega || 0,
      };
    });

    setLegs(newLegs);
    setShowBuilder(true);
  }

  // ─── Derived ───────────────────────────────────────────────────────────────────

  const visibleStrikes = chain ? getVisibleStrikes(chain.strikes, spotPrice) : [];

  // Max OI values across visible strikes — used for proportional OI bar rendering
  const maxCEOI = useMemo(() => Math.max(...(visibleStrikes.length ? visibleStrikes.map(s => s.ce.oi) : [1]), 1), [visibleStrikes]);
  const maxPEOI = useMemo(() => Math.max(...(visibleStrikes.length ? visibleStrikes.map(s => s.pe.oi) : [1]), 1), [visibleStrikes]);

  function getVisibleStrikes(strikes: Strike[], atm: number): Strike[] {
    if (!strikes.length) return strikes;
    let atmIdx = 0, minDist = Infinity;
    for (let i = 0; i < strikes.length; i++) {
      const dist = Math.abs(strikes[i].strike - atm);
      if (dist < minDist) { minDist = dist; atmIdx = i; }
    }
    return strikes.slice(Math.max(0, atmIdx - STRIKES_AROUND_ATM), Math.min(strikes.length, atmIdx + STRIKES_AROUND_ATM + 1));
  }

  function isITM(strike: number, type: 'CE' | 'PE') { return type === 'CE' ? strike < spotPrice : strike > spotPrice; }
  function isATM(strike: number) {
    if (!chain?.strikes.length) return false;
    let minDist = Infinity, nearest = 0;
    for (const s of chain.strikes) { const d = Math.abs(s.strike - spotPrice); if (d < minDist) { minDist = d; nearest = s.strike; } }
    return strike === nearest;
  }
  function getDTE() {
    if (!selectedExpiry) return 0;
    return Math.max(0, Math.ceil((new Date(selectedExpiry).getTime() - Date.now()) / 86400000));
  }

  // Check if a strike+type is already in legs
  function legExists(strike: number, type: 'CE' | 'PE') {
    return legs.some(l => l.strike === strike && l.type === type);
  }

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-500" />
            Options Chain
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Live option chain with OI, IV, Greeks & Strategy Builder
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select value={underlying} onChange={(e) => setUnderlying(e.target.value)}
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none">
              {UNDERLYINGS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedExpiry} onChange={(e) => setSelectedExpiry(e.target.value)}
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none">
              {expiries.map(exp => (
                <option key={exp} value={exp}>{new Date(exp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={() => setShowGreeks(!showGreeks)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${showGreeks ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
            Greeks
          </button>
          <button onClick={() => selectedExpiry && fetchChain(underlying, selectedExpiry)} disabled={loading}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      {chain && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <SummaryCard label="Spot (est.)" value={formatINR(spotPrice)} />
          <SummaryCard label="PCR" value={chain.pcr} color={parseFloat(chain.pcr) > 1 ? 'green' : parseFloat(chain.pcr) < 0.7 ? 'red' : 'yellow'} />
          <SummaryCard label="Total Call OI" value={formatNum(chain.totalCallOI, 0)} />
          <SummaryCard label="Total Put OI" value={formatNum(chain.totalPutOI, 0)} />
          <SummaryCard label="Lot Size" value={lotSize.toString()} />
          <SummaryCard label="DTE" value={getDTE() + ' days'} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Strategy Presets Bar */}
      {chain && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quick Strategy:</span>
          {STRATEGY_PRESETS.map((preset, i) => (
            <button key={preset.name} onClick={() => applyPreset(i)}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
              {preset.name}
            </button>
          ))}
          {legs.length > 0 && (
            <button onClick={() => { setLegs([]); setPayoff(null); }}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Option Chain Table */}
      {chain && visibleStrikes.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th colSpan={showGreeks ? 9 : 5} className="py-2 px-3 text-center bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-semibold text-xs uppercase tracking-wider">Calls (CE)</th>
                  <th className="py-2 px-3 text-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs uppercase tracking-wider">Strike</th>
                  <th colSpan={showGreeks ? 9 : 5} className="py-2 px-3 text-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-semibold text-xs uppercase tracking-wider">Puts (PE)</th>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <th className="py-1.5 px-1 text-center w-8"></th>
                  {showGreeks && <th className="py-1.5 px-2 text-right">Delta</th>}
                  {showGreeks && <th className="py-1.5 px-2 text-right">Theta</th>}
                  {showGreeks && <th className="py-1.5 px-2 text-right">Gamma</th>}
                  {showGreeks && <th className="py-1.5 px-2 text-right">Vega</th>}
                  <th className="py-1.5 px-2 text-right">OI</th>
                  <th className="py-1.5 px-2 text-right">Volume</th>
                  <th className="py-1.5 px-2 text-right">IV%</th>
                  <th className="py-1.5 px-2 text-right font-semibold">LTP</th>
                  <th className="py-1.5 px-2 text-center bg-gray-50 dark:bg-gray-800"></th>
                  <th className="py-1.5 px-2 text-left font-semibold">LTP</th>
                  <th className="py-1.5 px-2 text-left">IV%</th>
                  <th className="py-1.5 px-2 text-left">Volume</th>
                  <th className="py-1.5 px-2 text-left">OI</th>
                  {showGreeks && <th className="py-1.5 px-2 text-left">Delta</th>}
                  {showGreeks && <th className="py-1.5 px-2 text-left">Theta</th>}
                  {showGreeks && <th className="py-1.5 px-2 text-left">Gamma</th>}
                  {showGreeks && <th className="py-1.5 px-2 text-left">Vega</th>}
                  <th className="py-1.5 px-1 text-center w-8"></th>
                </tr>
              </thead>
              <tbody>
                {visibleStrikes.map((s) => {
                  const atm = isATM(s.strike);
                  const ceITM = isITM(s.strike, 'CE');
                  const peITM = isITM(s.strike, 'PE');
                  const ceInLegs = legExists(s.strike, 'CE');
                  const peInLegs = legExists(s.strike, 'PE');

                  return (
                    <tr key={s.strike}
                      className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${atm ? 'bg-yellow-50 dark:bg-yellow-900/20 font-semibold' : ''}`}>
                      {/* CE add button */}
                      <td className="py-1 px-1 text-center">
                        {s.ce.ltp > 0 && (
                          <button onClick={() => addLeg(s.strike, 'CE', 'SELL')} title={ceInLegs ? 'Already added' : 'Add CE leg'}
                            className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${ceInLegs ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600'}`}>
                            {ceInLegs ? '\u2713' : '+'}
                          </button>
                        )}
                      </td>
                      {showGreeks && <td className={`py-1.5 px-2 text-right font-mono-nums text-xs ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{s.ce.delta ? s.ce.delta.toFixed(3) : '-'}</td>}
                      {showGreeks && <td className={`py-1.5 px-2 text-right font-mono-nums text-xs ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{s.ce.theta ? s.ce.theta.toFixed(2) : '-'}</td>}
                      {showGreeks && <td className={`py-1.5 px-2 text-right font-mono-nums text-xs ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{s.ce.gamma ? s.ce.gamma.toFixed(4) : '-'}</td>}
                      {showGreeks && <td className={`py-1.5 px-2 text-right font-mono-nums text-xs ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{s.ce.vega ? s.ce.vega.toFixed(2) : '-'}</td>}
                      <td className={`py-1.5 px-2 text-right font-mono-nums ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                        <div>{formatNum(s.ce.oi, 0)}</div>
                        {s.ce.oi > 0 && <div className="h-0.5 rounded-full bg-green-400/70 dark:bg-green-500/70 ml-auto mt-0.5" style={{ width: `${Math.min(100, Math.round((s.ce.oi / maxCEOI) * 100))}%` }} />}
                      </td>
                      <td className={`py-1.5 px-2 text-right font-mono-nums ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{formatNum(s.ce.volume, 0)}</td>
                      <td className={`py-1.5 px-2 text-right font-mono-nums ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>{s.ce.iv > 0 ? s.ce.iv.toFixed(1) : '-'}</td>
                      <td className={`py-1.5 px-2 text-right font-mono-nums font-semibold ${ceITM ? 'bg-green-50/50 dark:bg-green-900/10' : ''} ${s.ce.ltp > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{s.ce.ltp > 0 ? s.ce.ltp.toFixed(2) : '-'}</td>

                      {/* Strike + distance from ATM */}
                      <td className={`py-1.5 px-3 text-center font-mono-nums font-bold bg-gray-50 dark:bg-gray-800 ${atm ? 'text-yellow-600 dark:text-yellow-400 text-base' : 'text-gray-700 dark:text-gray-300'}`}>
                        {s.strike.toLocaleString('en-IN')}
                        {atm
                          ? <div className="text-[9px] font-normal text-yellow-500 leading-none mt-0.5">ATM</div>
                          : <div className="text-[9px] font-normal text-gray-400 leading-none mt-0.5">{s.strike > spotPrice ? '+' : ''}{(s.strike - spotPrice).toLocaleString('en-IN')}</div>
                        }
                      </td>

                      {/* PE side */}
                      <td className={`py-1.5 px-2 text-left font-mono-nums font-semibold ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''} ${s.pe.ltp > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{s.pe.ltp > 0 ? s.pe.ltp.toFixed(2) : '-'}</td>
                      <td className={`py-1.5 px-2 text-left font-mono-nums ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{s.pe.iv > 0 ? s.pe.iv.toFixed(1) : '-'}</td>
                      <td className={`py-1.5 px-2 text-left font-mono-nums ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{formatNum(s.pe.volume, 0)}</td>
                      <td className={`py-1.5 px-2 text-left font-mono-nums ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                        <div>{formatNum(s.pe.oi, 0)}</div>
                        {s.pe.oi > 0 && <div className="h-0.5 rounded-full bg-red-400/70 dark:bg-red-500/70 mt-0.5" style={{ width: `${Math.min(100, Math.round((s.pe.oi / maxPEOI) * 100))}%` }} />}
                      </td>
                      {showGreeks && <td className={`py-1.5 px-2 text-left font-mono-nums text-xs ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{s.pe.delta ? s.pe.delta.toFixed(3) : '-'}</td>}
                      {showGreeks && <td className={`py-1.5 px-2 text-left font-mono-nums text-xs ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{s.pe.theta ? s.pe.theta.toFixed(2) : '-'}</td>}
                      {showGreeks && <td className={`py-1.5 px-2 text-left font-mono-nums text-xs ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{s.pe.gamma ? s.pe.gamma.toFixed(4) : '-'}</td>}
                      {showGreeks && <td className={`py-1.5 px-2 text-left font-mono-nums text-xs ${peITM ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>{s.pe.vega ? s.pe.vega.toFixed(2) : '-'}</td>}
                      {/* PE add button */}
                      <td className="py-1 px-1 text-center">
                        {s.pe.ltp > 0 && (
                          <button onClick={() => addLeg(s.strike, 'PE', 'SELL')} title={peInLegs ? 'Already added' : 'Add PE leg'}
                            className={`w-5 h-5 rounded text-[10px] font-bold transition-colors ${peInLegs ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600'}`}>
                            {peInLegs ? '\u2713' : '+'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Showing {visibleStrikes.length} of {chain.strikes.length} strikes | Click + to add legs</span>
            {lastRefresh && <span>Updated: {lastRefresh.toLocaleTimeString('en-IN')}</span>}
          </div>
        </div>
      )}

      {/* Strategy Builder Panel */}
      {legs.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Strategy Builder ({legs.length} leg{legs.length > 1 ? 's' : ''})
            </h3>
            <button onClick={() => setShowBuilder(!showBuilder)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              {showBuilder ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {showBuilder && (
            <div className="p-4 space-y-4">
              {/* Legs table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 px-2 text-left">Type</th>
                      <th className="py-2 px-2 text-right">Strike</th>
                      <th className="py-2 px-2 text-center">B/S</th>
                      <th className="py-2 px-2 text-right">Premium</th>
                      <th className="py-2 px-2 text-center">Lots</th>
                      <th className="py-2 px-2 text-right">Value</th>
                      <th className="py-2 px-1 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {legs.map(leg => (
                      <tr key={leg.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${leg.type === 'CE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                            {leg.type}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono-nums font-semibold text-gray-900 dark:text-white">
                          {leg.strike.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button onClick={() => toggleLegSide(leg.id)}
                            className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${leg.side === 'SELL' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                            {leg.side}
                          </button>
                        </td>
                        <td className="py-2 px-2 text-right font-mono-nums text-gray-700 dark:text-gray-300">
                          {'\u20B9'}{leg.premium.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateLegQty(leg.id, leg.qty - 1)}
                              className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs hover:bg-gray-300 dark:hover:bg-gray-600">-</button>
                            <span className="font-mono-nums font-bold text-gray-900 dark:text-white w-6 text-center">{leg.qty}</span>
                            <button onClick={() => updateLegQty(leg.id, leg.qty + 1)}
                              className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs hover:bg-gray-300 dark:hover:bg-gray-600">+</button>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono-nums text-gray-700 dark:text-gray-300">
                          {'\u20B9'}{(leg.premium * leg.qty * leg.lotSize).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 px-1 text-center">
                          <button onClick={() => removeLeg(leg.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Strategy Summary — Sensibull style */}
              {payoff && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Strategy name + type badge */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-blue-500" />
                      {guessStrategyName()}
                    </span>
                    <div className="flex items-center gap-2">
                      {payoffLoading && <RefreshCw className="h-3.5 w-3.5 text-gray-400 animate-spin" />}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${payoff.premiumType === 'CREDIT' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'}`}>
                        {payoff.premiumType}
                      </span>
                    </div>
                  </div>
                  {/* Big 3 numbers */}
                  <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    <div className="p-4 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Max Profit</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400 font-mono-nums leading-tight">
                        {typeof payoff.maxProfit === 'string' ? payoff.maxProfit : `\u20B9${payoff.maxProfit.toLocaleString('en-IN')}`}
                      </div>
                    </div>
                    <div className="p-4 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Max Loss</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono-nums leading-tight">
                        {typeof payoff.maxLoss === 'string' ? payoff.maxLoss : `\u20B9${Math.abs(typeof payoff.maxLoss === 'number' ? payoff.maxLoss : 0).toLocaleString('en-IN')}`}
                      </div>
                    </div>
                    <div className="p-4 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">P.O.P</div>
                      <div className={`text-2xl font-bold font-mono-nums leading-tight ${payoff.pop > 60 ? 'text-green-600 dark:text-green-400' : payoff.pop < 40 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {payoff.pop}%
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">Prob. of Profit</div>
                    </div>
                  </div>
                  {/* Bottom detail row */}
                  <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="px-4 py-2">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">Net Premium</div>
                      <div className={`text-sm font-bold font-mono-nums ${payoff.premiumType === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {payoff.premiumType === 'CREDIT' ? '+' : '-'}₹{Math.abs(payoff.netPremium).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="px-4 py-2">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">Reward : Risk</div>
                      <div className="text-sm font-bold font-mono-nums text-gray-900 dark:text-white">{String(payoff.riskReward)}</div>
                    </div>
                    <div className="px-4 py-2">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">Breakevens</div>
                      <div className="text-sm font-bold font-mono-nums text-gray-900 dark:text-white truncate">
                        {payoff.breakevens.length > 0 ? payoff.breakevens.map(b => b.toLocaleString('en-IN')).join(' / ') : 'None'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Payoff Chart */}
      {payoff && payoff.payoffData.length > 0 && (
        <PayoffChart
          data={payoff.payoffData}
          spotPrice={spotPrice}
          breakevens={payoff.breakevens}
          sdMoves={payoff.sdMoves}
          netDelta={payoff.greeks.netDelta}
          netTheta={payoff.greeks.netTheta}
          netGamma={payoff.greeks.netGamma}
          netVega={payoff.greeks.netVega}
        />
      )}

      {/* Phase 3: Action Buttons (Margin, AI, Paper Trade) */}
      {legs.length > 0 && payoff && (
        <div className="flex flex-wrap gap-2">
          <button onClick={fetchMargin}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
            <DollarSign className="h-4 w-4" /> Check Margin
          </button>
          <button onClick={analyzeStrategy} disabled={aiLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50">
            <Brain className={`h-4 w-4 ${aiLoading ? 'animate-pulse' : ''}`} /> {aiLoading ? 'Analyzing...' : 'AI Analysis'}
          </button>
          <button onClick={paperTradeStrategy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
            <BookOpen className="h-4 w-4" /> Paper Trade This
          </button>
        </div>
      )}

      {/* Phase 3: Margin Display */}
      {margin && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-purple-500" /> Margin Requirement
          </h3>
          {margin.error ? (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">{margin.error}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniCard label="Total Margin" value={`\u20B9${margin.totalMargin.toLocaleString('en-IN')}`} />
              <MiniCard label="SPAN Margin" value={`\u20B9${margin.spanMargin.toLocaleString('en-IN')}`} />
              <MiniCard label="Exposure" value={`\u20B9${margin.exposureMargin.toLocaleString('en-IN')}`} />
              <MiniCard label="Hedge Benefit" value={`\u20B9${margin.marginBenefit.toLocaleString('en-IN')}`} color="green" />
            </div>
          )}
        </div>
      )}

      {/* Phase 3: AI Analysis Display */}
      {aiAnalysis && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-500" /> AI Strategy Analysis
            </h3>
            <button onClick={() => setAiAnalysis('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* Phase 4: Mock Trades Panel */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
          onClick={() => setShowTrades(!showTrades)}>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-green-500" />
            Options Paper Trades
            {tradeStats && tradeStats.openTrades > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                {tradeStats.openTrades} open
              </span>
            )}
          </h3>
          <div className="flex items-center gap-3">
            {tradeStats && tradeStats.totalTrades > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 dark:text-gray-400">Win Rate: <strong className={tradeStats.winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{tradeStats.winRate}%</strong></span>
                <span className="text-gray-500 dark:text-gray-400">Total P&L: <strong className={`font-mono-nums ${tradeStats.totalPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{tradeStats.totalPnl >= 0 ? '+' : ''}{'\u20B9'}{tradeStats.totalPnl.toLocaleString('en-IN')}</strong></span>
              </div>
            )}
            {showTrades ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {showTrades && (
          <div className="p-4">
            {trades.length === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-6">No options paper trades yet. Build a strategy and click &quot;Paper Trade This&quot;.</p>
            ) : (
              <div className="space-y-3">
                {trades.map(trade => (
                  <div key={trade._id} className={`rounded-lg border p-3 ${trade.status === 'open' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {trade.status === 'open' ? <Clock className="h-4 w-4 text-blue-500" /> : trade.exitPnl && trade.exitPnl > 0 ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                        <span className="font-bold text-sm text-gray-900 dark:text-white">{trade.strategyName}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{trade.underlying}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {new Date(trade.expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {trade.status === 'open' && closingTradeId !== trade._id && (
                          <button onClick={() => setClosingTradeId(trade._id)}
                            className="px-2 py-1 rounded text-xs font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/40">
                            Close
                          </button>
                        )}
                        <button onClick={() => deleteTrade(trade._id)}
                          className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Close trade form */}
                    {closingTradeId === trade._id && (
                      <div className="flex items-center gap-2 mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Exit P&L ({'\u20B9'}):</span>
                        <input type="number" value={closeExitPnl} onChange={(e) => setCloseExitPnl(e.target.value)}
                          placeholder="e.g. 5000 or -3000"
                          className="w-32 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono-nums text-gray-900 dark:text-white" />
                        <button onClick={() => closeTrade(trade._id, parseFloat(closeExitPnl) || 0)}
                          className="px-2 py-1 rounded text-xs font-medium bg-green-500 text-white hover:bg-green-600">
                          Confirm
                        </button>
                        <button onClick={() => { setClosingTradeId(null); setCloseExitPnl(''); }}
                          className="px-2 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Trade details */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <span>Legs: {trade.legs.map(l => `${l.side} ${l.type} ${l.strike}`).join(', ')}</span>
                      <span>Entry: {'\u20B9'}{trade.entrySpot?.toLocaleString('en-IN')}</span>
                      <span>Premium: <span className={trade.premiumType === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{'\u20B9'}{trade.netPremium?.toLocaleString('en-IN')}</span></span>
                      <span>POP: {trade.pop}%</span>
                      {trade.status === 'closed' && trade.exitPnl !== null && (
                        <span className={`font-bold ${trade.exitPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          P&L: {trade.exitPnl >= 0 ? '+' : ''}{'\u20B9'}{trade.exitPnl.toLocaleString('en-IN')}
                        </span>
                      )}
                      <span className="text-gray-400">{new Date(trade.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {/* AI Review for closed trades */}
                    {trade.status === 'closed' && (
                      <div className="mt-2">
                        {!tradeReviews[trade._id] && (
                          <button onClick={() => reviewTrade(trade._id)} disabled={reviewLoading === trade._id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 disabled:opacity-50 transition-colors">
                            <Brain className={`h-3 w-3 ${reviewLoading === trade._id ? 'animate-pulse' : ''}`} />
                            {reviewLoading === trade._id ? 'Reviewing...' : 'AI Review this trade'}
                          </button>
                        )}
                        {tradeReviews[trade._id] && (
                          <div className="mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Brain className="h-3 w-3" /> AI Review
                              </span>
                              <button onClick={() => setTradeReviews(p => { const n = {...p}; delete n[trade._id]; return n; })}
                                className="text-gray-400 hover:text-gray-600">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{tradeReviews[trade._id]}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real Trades Journal */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
          onClick={() => setShowRealTrades(!showRealTrades)}>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            Real Trades Journal
            {realTradeStats && realTradeStats.openTrades > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                {realTradeStats.openTrades} open
              </span>
            )}
            <span className="text-[10px] font-normal text-gray-400 ml-1">Log your actual broker trades here</span>
          </h3>
          <div className="flex items-center gap-3">
            {realTradeStats && realTradeStats.totalTrades > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 dark:text-gray-400">Win Rate: <strong className={realTradeStats.winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{realTradeStats.winRate}%</strong></span>
                <span className="text-gray-500 dark:text-gray-400">Net P&L: <strong className={`font-mono-nums ${realTradeStats.totalPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{realTradeStats.totalPnl >= 0 ? '+' : ''}{'\u20B9'}{realTradeStats.totalPnl.toLocaleString('en-IN')}</strong></span>
              </div>
            )}
            {showRealTrades ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {showRealTrades && (
          <div className="p-4 space-y-4">

            {/* Paper vs Real comparison */}
            {tradeStats && tradeStats.totalTrades > 0 && realTradeStats && realTradeStats.totalTrades > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 mb-3">
                  <Award className="h-3.5 w-3.5" /> Paper vs Real — How well are you executing?
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Paper Win Rate</div>
                    <div className={`text-xl font-bold font-mono-nums ${tradeStats.winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{tradeStats.winRate}%</div>
                    <div className="text-[10px] text-gray-400">{tradeStats.totalTrades} trades</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Real Win Rate</div>
                    <div className={`text-xl font-bold font-mono-nums ${realTradeStats.winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{realTradeStats.winRate}%</div>
                    <div className="text-[10px] text-gray-400">{realTradeStats.totalTrades} trades</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Execution Gap</div>
                    <div className={`text-xl font-bold font-mono-nums ${realTradeStats.winRate >= tradeStats.winRate ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
                      {realTradeStats.winRate >= tradeStats.winRate ? '+' : ''}{(realTradeStats.winRate - tradeStats.winRate).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-gray-400">Brokerage: {'\u20B9'}{realTradeStats.totalBrokerage.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Log Real Trade Button */}
            <button onClick={() => setShowAddRealTrade(!showAddRealTrade)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">
              <Plus className="h-4 w-4" /> Log a Real Trade
            </button>

            {/* Add Real Trade Form */}
            {showAddRealTrade && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" /> Log Real Trade
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Underlying</label>
                    <select value={newRealTrade.underlying} onChange={e => setNewRealTrade(p => ({...p, underlying: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                      {UNDERLYINGS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Expiry</label>
                    <input type="date" value={newRealTrade.expiry} onChange={e => setNewRealTrade(p => ({...p, expiry: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Strategy Name</label>
                    <input type="text" value={newRealTrade.strategyName} placeholder="Short Straddle..."
                      onChange={e => setNewRealTrade(p => ({...p, strategyName: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Entry Spot (\u20B9)</label>
                    <input type="number" value={newRealTrade.entrySpot} placeholder="e.g. 24500"
                      onChange={e => setNewRealTrade(p => ({...p, entrySpot: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Net Premium (\u20B9)</label>
                    <input type="number" value={newRealTrade.netPremium} placeholder="e.g. 200"
                      onChange={e => setNewRealTrade(p => ({...p, netPremium: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Type</label>
                    <div className="flex gap-2">
                      {(['CREDIT', 'DEBIT'] as const).map(t => (
                        <button key={t} onClick={() => setNewRealTrade(p => ({...p, premiumType: t}))}
                          className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${newRealTrade.premiumType === t ? (t === 'CREDIT' ? 'bg-green-500 text-white border-green-500' : 'bg-blue-500 text-white border-blue-500') : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Broker</label>
                    <input type="text" value={newRealTrade.broker} placeholder="Zerodha"
                      onChange={e => setNewRealTrade(p => ({...p, broker: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Brokerage + Charges (\u20B9)</label>
                    <input type="number" value={newRealTrade.brokerage} placeholder="e.g. 80"
                      onChange={e => setNewRealTrade(p => ({...p, brokerage: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Legs (describe simply)</label>
                    <input type="text" value={newRealTrade.legsText}
                      placeholder="e.g. SELL CE 24500 @ 120, SELL PE 24000 @ 80"
                      onChange={e => setNewRealTrade(p => ({...p, legsText: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Notes (why you took this)</label>
                    <input type="text" value={newRealTrade.notes} placeholder="e.g. IV high, market sideways, taking theta..."
                      onChange={e => setNewRealTrade(p => ({...p, notes: e.target.value}))}
                      className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addRealTrade}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                    Save Real Trade
                  </button>
                  <button onClick={() => setShowAddRealTrade(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Real Trades List */}
            {realTrades.length === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">
                No real trades logged yet. Click &quot;Log a Real Trade&quot; after you place a trade on your broker.
              </p>
            ) : (
              <div className="space-y-3">
                {realTrades.map(trade => (
                  <div key={trade._id} className={`rounded-lg border p-3 ${trade.status === 'open' ? 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Activity className={`h-4 w-4 flex-shrink-0 ${trade.status === 'open' ? 'text-orange-500' : (trade.exitPnl !== null && (trade.exitPnl - trade.brokerage) > 0) ? 'text-green-500' : 'text-red-500'}`} />
                        <span className="font-bold text-sm text-gray-900 dark:text-white">{trade.strategyName}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{trade.underlying}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">REAL</span>
                        {trade.broker && <span className="text-xs text-gray-400 dark:text-gray-500">{trade.broker}</span>}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          {new Date(trade.expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {trade.status === 'open' && closingRealTradeId !== trade._id && (
                          <button onClick={() => setClosingRealTradeId(trade._id)}
                            className="px-2 py-1 rounded text-xs font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/40">
                            Close
                          </button>
                        )}
                        <button onClick={() => deleteRealTrade(trade._id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Close form */}
                    {closingRealTradeId === trade._id && (
                      <div className="flex items-center gap-2 mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Gross Exit P&L ({'\u20B9'}):</span>
                        <input type="number" value={closeRealExitPnl} onChange={e => setCloseRealExitPnl(e.target.value)}
                          placeholder="e.g. 8000 or -4000"
                          className="w-32 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono-nums text-gray-900 dark:text-white" />
                        <button onClick={() => closeRealTrade(trade._id, parseFloat(closeRealExitPnl) || 0)}
                          className="px-2 py-1 rounded text-xs font-medium bg-green-500 text-white hover:bg-green-600">Confirm</button>
                        <button onClick={() => { setClosingRealTradeId(null); setCloseRealExitPnl(''); }}
                          className="px-2 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Cancel</button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                      {trade.legsText && <span className="text-gray-500 dark:text-gray-400">{trade.legsText}</span>}
                      <span>Entry: {'\u20B9'}{trade.entrySpot?.toLocaleString('en-IN')}</span>
                      <span>Premium: <span className={trade.premiumType === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>{'\u20B9'}{trade.netPremium?.toLocaleString('en-IN')}</span></span>
                      {trade.brokerage > 0 && <span className="text-gray-400">Brokerage: {'\u20B9'}{trade.brokerage.toLocaleString('en-IN')}</span>}
                      {trade.status === 'closed' && trade.exitPnl !== null && (
                        <span className={`font-bold ${(trade.exitPnl - trade.brokerage) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          Net P&L: {(trade.exitPnl - trade.brokerage) >= 0 ? '+' : ''}{'\u20B9'}{(trade.exitPnl - trade.brokerage).toLocaleString('en-IN')}
                        </span>
                      )}
                      {trade.notes && <span className="text-gray-400 italic">&quot;{trade.notes}&quot;</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && !chain && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading option chain...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !chain && !error && (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Select an underlying and expiry to view the option chain</p>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono-nums ${color ? colorClasses[color] || '' : 'text-gray-900 dark:text-white'}`}>{value}</div>
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>
      <div className={`text-xs font-bold font-mono-nums truncate ${color ? colorClasses[color] || '' : 'text-gray-900 dark:text-white'}`}>{value}</div>
    </div>
  );
}
