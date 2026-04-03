'use client';

import React, { useState, useCallback } from 'react';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import ChainModal from './ChainModal';
import { useOptionsData, useStrategyBuilder, useTrades, useLivePnL } from './hooks';
import { BACKEND_URL } from './constants';
import { MarginData } from './types';

export default function OptionsTab() {
  const [underlying, setUnderlying] = useState('NIFTY');
  const [showChainModal, setShowChainModal] = useState(false);

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
  }, [payoff, legs, underlying, selectedExpiry, strategyName, spotPrice, multiplier, paperTrade]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-white dark:bg-gray-900">
      {/* Error banner */}
      {error && (
        <div className="absolute top-0 left-0 right-0 z-40 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
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
    </div>
  );
}
