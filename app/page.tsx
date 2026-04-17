'use client';

import { useState } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import HistoricalTab from './components/HistoricalTab';
import PortfolioTab from './components/PortfolioTab';
import UpstoxTab from './components/UpstoxTab';
import AlertsTab from './components/AlertsTab';
import AIAnalysisTab from './components/AIAnalysisTab';
import StockSearchTab from './components/StockSearchTab';
import NewsTab from './components/NewsTab';
import ScreensTab from './components/ScreensTab';
import APIIntegrationTab from './components/APIIntegrationTab';
import SettingsTab from './components/SettingsTab';
import TradeJournalTab from './components/TradeJournalTab';
import PaperTradingTab from './components/PaperTradingTab';
import OptionsTab from './components/options/OptionsTab';
import ActivitySummaryTab from './components/ActivitySummaryTab';
import DataHealthPanel from './components/DataHealthPanel';
import ControlCenterTab from './components/ControlCenterTab';
import HelpTab from './components/HelpTab';
import AIChatbot from './components/AIChatbot';
import StickyNotes from './components/StickyNotes';
import DailyLossLockOverlay from './components/DailyLossLockOverlay';
import PostLossCooldownBanner from './components/PostLossCooldownBanner';
import CadenceAlertsBell from './components/CadenceAlertsBell';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'historical':
        return <HistoricalTab />;
      case 'portfolio':
        return <PortfolioTab />;
      case 'upstox':
        return <UpstoxTab />;
      case 'alerts':
        return <AlertsTab />;
      case 'ai-analysis':
        return <AIAnalysisTab />;
      case 'stock-search':
        return <StockSearchTab />;
      case 'news':
        return <NewsTab />;
      case 'screener':
        return <ScreensTab />;
      case 'api':
        return <APIIntegrationTab />;
      case 'trade-journal':
        return <TradeJournalTab />;
      case 'paper-trading':
        return <PaperTradingTab />;
      case 'options':
        return <OptionsTab />;
      case 'activity':
        return <ActivitySummaryTab />;
      case 'data-health':
        return <DataHealthPanel />;
      case 'control-center':
        return <ControlCenterTab />;
      case 'help':
        return <HelpTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className={`pt-[68px] ${activeTab === 'options' ? '' : 'px-4 pb-8'}`}>
        <div className={activeTab === 'options' ? '' : 'max-w-7xl mx-auto'}>
          {renderActiveTab()}
        </div>
      </main>
      <StickyNotes />
      <AIChatbot />
      {/* Post-Loss Cooldown Banner (lighter friction — 2 consecutive losses) */}
      <PostLossCooldownBanner />
      {/* Daily Loss Circuit Breaker — blocks UI when daily P&L breaches limit */}
      <DailyLossLockOverlay />
      {/* Cadence Registry alerts — floating bell for missed scheduled duties */}
      <CadenceAlertsBell />
    </div>
  );
}