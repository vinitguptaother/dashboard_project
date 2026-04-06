'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import ChainModal from './ChainModal';
import ChargesModal from './ChargesModal';
import { useOptionsData, useStrategyBuilder, useTrades, useLivePnL } from './hooks';
import { BACKEND_URL } from './constants';
import { MarginData, PayoffPoint } from './types';
import { useMarketStatus } from '../../hooks/useMarketStatus';

export default function OptionsTab() {
  const [underlying, setUnderlying] = useState('NIFTY');
  const [showChainModal, setShowChainModal] = useState(false);
  const [showChargesModal, setShowChargesModal] = useState(false);
  const marketStatus = useMarketStatus();

  // Data hook
  const {
    expiries, selectedExpiry, setSelectedExpiry,
    lotSize, chain, spotPrice, loading, error,
    lastRefresh, fetchChain, visibleStrikes, strikeStep,
  } = useOptionsData(underlying);

  // Strategy builder hook
  const {
    legs, addLeg, removeLeg, toggleLegSide,
    updateLegQty, updateLegStrike, applyPreset,
    shiftStrikes, resetPrices, clearAll,
    payoff, payoffLoading, strategyName,
    multiplier, setMultiplier, netPremiumInfo,
  } = useStrategyBuilder(chain, spotPrice, lotSize, selectedExpiry);

  // Trades hook
  const {
    trades, tradeStats, closeTrade, deleteTrade,
    paperTrade, reviewTrade, tradeReviews, reviewLoading,
  } = useTrades();

  // Live P&L
  const livePnL = useLivePnL(trades, chain);

  // Margin + AI state
  const [margin, setMargin] = useState<MarginData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Target date state
  const [targetDays, setTargetDays] = useState<number | null>(null);
  const [targetPrice, setTargetPrice] = useState<number | null>(null);
  const [targetDatePayoff, setTargetDatePayoff] = useState<PayoffPoint[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute DTE from selected expiry
  const daysToExpiry = useMemo(() => {
    if (!selectedExpiry) return 0;
    const diff = new Date(selectedExpiry).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [selectedExpiry]);

  // Fetch target date payoff
  const fetchTargetDatePayoff = useCallback(async (days: number) => {
    if (!legs.length || !spotPrice) return;
    try {
      const avgIV = legs.reduce((s, l) => s + (l.iv || 0.15), 0) / legs.length;
      const res = await fetch(`${BACKEND_URL}/api/options/payoff-at-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legs: legs.map(l => ({ type: l.type, strike: l.strike, premium: l.premium, qty: l.qty, side: l.side, lotSize: l.lotSize, iv: l.iv || avgIV })),
          spotPrice, iv: avgIV, daysToExpiry, targetDaysRemaining: days,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') setTargetDatePayoff(json.data.targetDatePayoffData);
    } catch (e) { console.error('Target date payoff error:', e); }
  }, [legs, spotPrice, daysToExpiry]);

  // Auto-fetch target date payoff when legs change or on initial load
  useEffect(() => {
    if (legs.length > 0 && daysToExpiry > 0) {
      const days = targetDays ?? Math.floor(daysToExpiry / 2);
      setTargetDays(days);
      fetchTargetDatePayoff(days);
    } else {
      setTargetDatePayoff([]);
    }
  }, [legs.length, daysToExpiry]); // intentionally sparse deps — only re-fetch on leg count or expiry change

  // Debounced slider handler
  const handleTargetDaysChange = useCallback((days: number) => {
    setTargetDays(days);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchTargetDatePayoff(days), 300);
  }, [fetchTargetDatePayoff]);

  // Fetch margin
  const fetchMargin = useCallback(async () => {
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
  }, [legs]);

  // AI Analysis
  const analyzeStrategy = useCallback(async () => {
    if (!legs.length || !payoff) return;
    try {
      setAiLoading(true);
      setAiAnalysis('');
      const res = await fetch(`${BACKEND_URL}/api/options/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          underlying, strategyName,
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
  }, [legs, payoff, underlying, strategyName, spotPrice]);

  // Trade All action
  const handleTradeAll = useCallback(async () => {
    if (!payoff || !legs.length) return;

    // Off-hours warning — option premiums in the chain are last-close, IV is stale
    if (marketStatus && !marketStatus.isOpen) {
      const reason = marketStatus.holidayName
        ? `NSE Holiday (${marketStatus.holidayName})`
        : marketStatus.state === 'CLOSED_WEEKEND' ? 'weekend' : 'after market hours';
      const ok = window.confirm(
        `Market is currently closed (${reason}).\n\n` +
        `Option premiums shown are from the last session's close and IVs are stale. ` +
        `Actual fills when markets reopen can differ materially — especially for OTM strikes.\n\n` +
        `Save this multi-leg paper trade anyway?`
      );
      if (!ok) return;
    }

    const result = await paperTrade({
      underlying,
      expiry: selectedExpiry,
      strategyName,
      legs: legs.map(l => ({ type: l.type, strike: l.strike, premium: l.premium, qty: l.qty * multiplier, side: l.side, lotSize: l.lotSize })),
      entrySpot: spotPrice,
      netPremium: payoff.netPremium,
      premiumType: payoff.premiumType,
      maxProfit: payoff.maxProfit,
      maxLoss: payoff.maxLoss,
      breakevens: payoff.breakevens,
      pop: payoff.pop,
    });
    if (result) {
      // Trade saved — could show a toast or switch to positions
    }
  }, [payoff, legs, underlying, selectedExpiry, strategyName, spotPrice, multiplier, paperTrade, marketStatus]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-white dark:bg-gray-900">
      {/* Error banner */}
      {error && (
        <div className="absolute top-0 left-0 right-0 z-40 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Market-closed stale-data banner */}
      {marketStatus && !marketStatus.isOpen && !error && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50 px-4 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 flex items-center justify-center gap-2">
          <span className="font-semibold">●</span>
          <span>
            Market closed
            {marketStatus.holidayName ? ` — ${marketStatus.holidayName}` : marketStatus.state === 'CLOSED_WEEKEND' ? ' — weekend' : ' — after hours'}.
            Option chain shows the last session&apos;s close. Greeks and IV are stale until the next open.
          </span>
        </div>
      )}

      {/* Left Panel — Strategy Builder (40%) */}
      <div className="w-[420px] min-w-[360px] border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <LeftPanel
          underlying={underlying}
          setUnderlying={u => { setUnderlying(u); clearAll(); }}
          spotPrice={spotPrice}
          loading={loading}
          onRefresh={fetchChain}
          lastRefresh={lastRefresh}
          legs={legs}
          strategyName={strategyName}
          onToggleSide={toggleLegSide}
          onUpdateQty={updateLegQty}
          onUpdateStrike={updateLegStrike}
          onRemoveLeg={removeLeg}
          onResetPrices={resetPrices}
          onClearAll={clearAll}
          selectedExpiry={selectedExpiry}
          onShift={shiftStrikes}
          multiplier={multiplier}
          onSetMultiplier={setMultiplier}
          netPremium={netPremiumInfo.netPremium}
          premiumType={netPremiumInfo.premiumType}
          totalPremiumValue={netPremiumInfo.totalPremiumValue}
          hasPayoff={!!payoff}
          onAddEdit={() => setShowChainModal(true)}
          onTradeAll={handleTradeAll}
          onAIAnalysis={analyzeStrategy}
          onCharges={() => setShowChargesModal(true)}
          aiLoading={aiLoading}
          onApplyPreset={applyPreset}
          trades={trades}
          tradeStats={tradeStats}
          livePnL={livePnL}
          onCloseTrade={closeTrade}
          onDeleteTrade={deleteTrade}
          chainLoaded={!!chain}
        />
      </div>

      {/* Right Panel — Analytics (60%) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <RightPanel
          payoff={payoff}
          payoffLoading={payoffLoading}
          margin={margin}
          chain={chain}
          legs={legs}
          spotPrice={spotPrice}
          aiAnalysis={aiAnalysis}
          targetDateData={targetDatePayoff}
          daysToExpiry={daysToExpiry}
          targetDays={targetDays ?? undefined}
          onTargetDaysChange={handleTargetDaysChange}
          targetPrice={targetPrice ?? undefined}
          onTargetPriceChange={setTargetPrice}
        />
      </div>

      {/* Chain Modal */}
      <ChainModal
        isOpen={showChainModal}
        onClose={() => setShowChainModal(false)}
        chain={chain}
        visibleStrikes={visibleStrikes}
        spotPrice={spotPrice}
        strikeStep={strikeStep}
        legs={legs}
        onAddLeg={addLeg}
        onRemoveLeg={removeLeg}
        expiries={expiries}
        selectedExpiry={selectedExpiry}
        onSelectExpiry={setSelectedExpiry}
        lotSize={lotSize}
      />

      {/* Charges Modal */}
      <ChargesModal
        isOpen={showChargesModal}
        onClose={() => setShowChargesModal(false)}
        legs={legs}
      />
    </div>
  );
}
