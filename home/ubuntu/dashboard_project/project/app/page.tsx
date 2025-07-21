'use client';

import { useState } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import IntradayTab from './components/IntradayTab';
import SwingTradingTab from './components/SwingTradingTab';
import LongTermTab from './components/LongTermTab';
import PortfolioTab from './components/PortfolioTab';
import AIAnalysisTab from './components/AIAnalysisTab';
import StockSearchTab from './components/StockSearchTab';
import NewsTab from './components/NewsTab';
import ScreenerTab from './components/ScreenerTab';
import APIIntegrationTab from './components/APIIntegrationTab';
import SettingsTab from './components/SettingsTab';
import AIChatbot from './components/AIChatbot';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'intraday':
        return <IntradayTab />;
      case 'swing':
        return <SwingTradingTab />;
      case 'longterm':
        return <LongTermTab />;
      case 'portfolio':
        return <PortfolioTab />;
      case 'ai-analysis':
        return <AIAnalysisTab />;
      case 'stock-search':
        return <StockSearchTab />;
      case 'news':
        return <NewsTab />;
      case 'screener':
        return <ScreenerTab />;
      case 'api':
        return <APIIntegrationTab />;
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