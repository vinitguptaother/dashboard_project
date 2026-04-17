'use client';

import React, { useState } from 'react';
import StrategyHeader from './StrategyHeader';
import IVMetricsBar from './IVMetricsBar';
import LegsTable from './LegsTable';
import StrategyControls from './StrategyControls';
import ActionBar from './ActionBar';
import BottomTabs from './BottomTabs';
import { StrategyLeg, OptionsMockTrade, TradeStats, OptionsPortfolio, PortfolioPnL } from './types';

interface Props {
  // Header
  underlying: string;
  setUnderlying: (u: string) => void;
  spotPrice: number;
  loading: boolean;
  onRefresh: () => void;
  lastRefresh: Date | null;

  // Legs
  legs: StrategyLeg[];
  strategyName: string;
  onToggleSide: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdateStrike: (id: string, direction: -1 | 1) => void;
  onRemoveLeg: (id: string) => void;
  onResetPrices: () => void;
  onClearAll: () => void;
  selectedExpiry: string;

  // Controls
  onShift: (direction: -1 | 1) => void;
  multiplier: number;
  onSetMultiplier: (m: number) => void;
  netPremium: number;
  premiumType: 'CREDIT' | 'DEBIT';
  totalPremiumValue: number;

  // Actions
  hasPayoff: boolean;
  onAddEdit: () => void;
  onTradeAll: () => void;
  onAIAnalysis: () => void;
  onCharges: () => void;
  aiLoading: boolean;

  // Bottom tabs
  onApplyPreset: (name: string) => void;
  trades: OptionsMockTrade[];
  tradeStats: TradeStats | null;
  livePnL: Record<string, { totalPnl: number }>;
  onCloseTrade: (id: string, exitPnl: number) => void;
  onDeleteTrade: (id: string) => void;
  chainLoaded: boolean;
  onLoadTrade?: (trade: OptionsMockTrade) => void;
  // Portfolio
  portfolios: OptionsPortfolio[];
  onCreatePortfolio: (name: string, description?: string, color?: string) => Promise<any>;
  onDeletePortfolio: (id: string) => void;
  onFetchPortfolioPnL: (id: string, period: string) => Promise<PortfolioPnL | null>;
  onRemoveTradeFromPortfolio: (portfolioId: string, tradeId: string) => void;
}

export default function LeftPanel(props: Props) {
  const [bottomTab, setBottomTab] = useState<'ready-made' | 'positions' | 'saved' | 'portfolios'>('ready-made');

  return (
    <div className="flex flex-col h-full">
      <StrategyHeader
        underlying={props.underlying}
        setUnderlying={props.setUnderlying}
        spotPrice={props.spotPrice}
        loading={props.loading}
        onRefresh={props.onRefresh}
        lastRefresh={props.lastRefresh}
      />

      <IVMetricsBar underlying={props.underlying} spotPrice={props.spotPrice} />

      <div className="flex-shrink-0">
        <LegsTable
          legs={props.legs}
          strategyName={props.strategyName}
          onToggleSide={props.onToggleSide}
          onUpdateQty={props.onUpdateQty}
          onUpdateStrike={props.onUpdateStrike}
          onRemove={props.onRemoveLeg}
          onResetPrices={props.onResetPrices}
          onClearAll={props.onClearAll}
          selectedExpiry={props.selectedExpiry}
        />

        <StrategyControls
          onShift={props.onShift}
          multiplier={props.multiplier}
          onSetMultiplier={props.onSetMultiplier}
          netPremium={props.netPremium}
          premiumType={props.premiumType}
          totalPremiumValue={props.totalPremiumValue}
          hasLegs={props.legs.length > 0}
        />

        <ActionBar
          hasLegs={props.legs.length > 0}
          hasPayoff={props.hasPayoff}
          onAddEdit={props.onAddEdit}
          onTradeAll={props.onTradeAll}
          onAIAnalysis={props.onAIAnalysis}
          onCharges={props.onCharges}
          aiLoading={props.aiLoading}
        />
      </div>

      <BottomTabs
        activeTab={bottomTab}
        onTabChange={setBottomTab}
        onApplyPreset={props.onApplyPreset}
        trades={props.trades}
        tradeStats={props.tradeStats}
        livePnL={props.livePnL}
        onCloseTrade={props.onCloseTrade}
        onDeleteTrade={props.onDeleteTrade}
        chainLoaded={props.chainLoaded}
        onLoadTrade={props.onLoadTrade}
        portfolios={props.portfolios}
        onCreatePortfolio={props.onCreatePortfolio}
        onDeletePortfolio={props.onDeletePortfolio}
        onFetchPortfolioPnL={props.onFetchPortfolioPnL}
        onRemoveTradeFromPortfolio={props.onRemoveTradeFromPortfolio}
      />
    </div>
  );
}
