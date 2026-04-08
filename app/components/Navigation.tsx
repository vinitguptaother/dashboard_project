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
  Eye,
  Brain,
  SearchCheck,
  Bell,
  Activity,
  LineChart,
  Wifi,
  WifiOff,
  Target,
  FlaskConical,
  Sun,
  Moon,
  User,
  Menu,
  X,
  ClipboardList
} from 'lucide-react';
import RealTimeNotification from './RealTimeNotification';
import MarketStatusBadge from './MarketStatusBadge';

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
        window.open(data.authUrl, 'upstox-login', 'width=600,height=700,scrollbars=yes');
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
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'checking') {
    return (
      <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border border-gray-300 bg-gray-100 text-gray-400">
        <span className="animate-pulse">●</span>
        Checking...
      </span>
    );
  }

  if (status === 'active') {
    return (
      <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border border-green-500/50 bg-green-500/10 text-green-500">
        <Wifi className="w-3 h-3" />
        LIVE
      </span>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      title="Upstox token expired. Click to reconnect and get live data."
      className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
    >
      <WifiOff className="w-3 h-3" />
      {loading ? 'Opening...' : 'DEMO — Reconnect'}
    </button>
  );
}

// Token status badge (shows Token: VALID or Token: EXPIRED)
function TokenStatusBadge() {
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/upstox/token-status`);
        const data = await res.json();
        setTokenValid(data.status === 'active' || data.connected === true);
      } catch {
        setTokenValid(false);
      }
    }
    check();
  }, []);

  if (tokenValid === null) return null;

  return (
    <span className={`hidden sm:flex items-center px-2 py-1 rounded-full text-[9px] font-semibold border ${
      tokenValid
        ? 'border-green-500/30 bg-green-500/5 text-green-400'
        : 'border-red-500/30 bg-red-500/5 text-red-400'
    }`}>
      Token: {tokenValid ? 'VALID' : 'EXPIRED'}
    </span>
  );
}

const Navigation = ({ activeTab, setActiveTab }: NavigationProps) => {
  const [isDark, setIsDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Initialize theme from localStorage or default to dark
  useEffect(() => {
    const saved = localStorage.getItem('dashboard-theme');
    const prefersDark = saved ? saved === 'dark' : true;
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('dashboard-theme', newDark ? 'dark' : 'light');
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, visible: true },
    { id: 'historical', label: 'History', icon: LineChart, visible: true },
    { id: 'portfolio', label: 'Watchlist', icon: Eye, visible: true },
    { id: 'alerts', label: 'Alerts', icon: Bell, visible: true },
    { id: 'ai-analysis', label: 'AI Analysis', icon: Brain, visible: true },
    { id: 'stock-search', label: 'Search', icon: SearchCheck, visible: true },
    { id: 'news', label: 'News', icon: Newspaper, visible: true },
    { id: 'screener', label: 'Screens', icon: Search, visible: true },
    { id: 'trade-journal', label: 'Journal', icon: Target, visible: true },
    { id: 'paper-trading', label: 'Paper', icon: FlaskConical, visible: true },
    { id: 'options', label: 'Options', icon: TrendingUp, visible: true },
    { id: 'upstox', label: 'Upstox', icon: Activity, visible: false },
    { id: 'api', label: 'API Integration', icon: Zap, visible: false },
    { id: 'activity', label: 'Activity', icon: ClipboardList, visible: true },
    { id: 'settings', label: 'Settings', icon: Settings, visible: true },
  ];

  const visibleTabs = tabs.filter(tab => tab.visible);

  return (
    <>
      {/* Main Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-12 glass-effect shadow-lg flex items-center px-3 gap-2">
        {/* Logo */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-blue-600/20 flex items-center justify-center">
            <IndianRupee className="w-4 h-4 text-blue-500" />
          </div>
          <span className="font-bold text-sm hidden sm:inline gradient-text">AI Stock Dashboard</span>
        </div>

        {/* Tab Navigation */}
        <div className="hidden md:flex items-center gap-0.5 overflow-x-auto mx-4 flex-1 scrollbar-hide">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-glow'
                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Theme Toggle */}
          <button onClick={toggleTheme} className="theme-toggle" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* NSE Market Status (open/closed/holiday) */}
          <MarketStatusBadge />

          {/* LIVE / DEMO Badge */}
          <UpstoxStatusBadge />

          {/* Token Status */}
          <TokenStatusBadge />

          {/* Notification Bell */}
          <RealTimeNotification />

          {/* User Avatar */}
          <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-blue-500" />
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden w-7 h-7 rounded-md flex items-center justify-center bg-gray-100 text-gray-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* System Bar (below navbar) */}
      <div className="fixed top-12 left-0 right-0 z-40 system-bar">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
          <span className="font-mono-nums text-gray-500">NSE/BSE Live Data via Upstox V3</span>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-12 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-3 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all w-full text-left ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-glow'
                      : 'text-gray-600 hover:bg-blue-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
