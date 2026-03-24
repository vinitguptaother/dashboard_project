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
import AIChatbot from './components/AIChatbot';

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
      case 'settings':
        return <SettingsTab />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="pt-20 px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          {renderActiveTab()}
        </div>
      </main>
      <AIChatbot />
    </div>
  );
}