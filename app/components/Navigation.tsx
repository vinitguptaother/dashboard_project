'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Newspaper,
  Search,
  Settings,
  Zap,
  IndianRupee,
  Briefcase,
  Brain,
  SearchCheck,
  Bell,
  Activity,
  LineChart,
  Wifi,
  WifiOff,
  Target,
  FlaskConical
} from 'lucide-react';
import RealTimeNotification from './RealTimeNotification';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Small badge that shows LIVE (green) or DEMO (red) and lets you reconnect Upstox
function UpstoxStatusBadge() {
  const [status, setStatus] = useState<'checking' | 'active' | 'expired' | 'not_configured'>('checking');
  const [loading, setLoading] = useState(false);

  async function checkStatus() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/upstox/token-status`);
      const data = await res.json();
      setStatus(data.status || (data.connected ? 'active' : 'expired'));
    } catch {
      setStatus('expired');
    }
  }

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/upstox/auth-url`);
      const data = await res.json();
      if (data.authUrl) {
        // Open Upstox login in a popup window
        window.open(data.authUrl, 'upstox-login', 'width=600,height=700,scrollbars=yes');
        // Re-check status after 30 seconds (user should have logged in by then)
        setTimeout(checkStatus, 30000);
      }
    } catch (e) {
      alert('Could not reach backend. Make sure the backend is running on port 5002.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();
    // Re-check every 5 minutes
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-gray-100 text-gray-400 text-xs">
        <span className="animate-pulse">●</span>
        <span>Checking...</span>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
        <Wifi className="h-3 w-3" />
        <span>LIVE</span>
      </div>
    );
  }

  // expired or not_configured — show reconnect button
  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      title="Upstox token expired. Click to reconnect and get live data."
      className="flex items-center space-x-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
    >
      <WifiOff className="h-3 w-3" />
      <span>{loading ? 'Opening...' : 'DEMO — Reconnect'}</span>
    </button>
  );
}

const Navigation = ({ activeTab, setActiveTab }: NavigationProps) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, visible: true },
    { id: 'historical', label: 'History', icon: LineChart, visible: true },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase, visible: true },
    { id: 'alerts', label: 'Alerts', icon: Bell, visible: true },
    { id: 'ai-analysis', label: 'AI Analysis', icon: Brain, visible: true },
    { id: 'stock-search', label: 'Search', icon: SearchCheck, visible: true },
    { id: 'news', label: 'News', icon: Newspaper, visible: true },
    { id: 'screener', label: 'Screens', icon: Search, visible: true },
    { id: 'trade-journal', label: 'Journal', icon: Target, visible: true },
    { id: 'paper-trading', label: 'Paper', icon: FlaskConical, visible: true },
    { id: 'upstox', label: 'Upstox', icon: Activity, visible: false },
    { id: 'api', label: 'API Integration', icon: Zap, visible: false },
    { id: 'settings', label: 'Settings', icon: Settings, visible: true },
  ];

  // Filter to show only visible tabs in navbar
  const visibleTabs = tabs.filter(tab => tab.visible);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-effect shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <IndianRupee className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold gradient-text">AI Stock Dashboard</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium hidden md:block">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Upstox connection status badge */}
            <UpstoxStatusBadge />

            {/* Real-time Notification Component */}
            <RealTimeNotification />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;