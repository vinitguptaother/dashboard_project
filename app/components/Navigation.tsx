'use client';

import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Calendar, 
  Newspaper, 
  Search, 
  Settings, 
  Zap,
  IndianRupee,
  Briefcase,
  Brain,
  SearchCheck
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navigation = ({ activeTab, setActiveTab }: NavigationProps) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'intraday', label: 'Intraday', icon: Clock },
    { id: 'swing', label: 'Swing Trading', icon: TrendingUp },
    { id: 'longterm', label: 'Long Term', icon: Calendar },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'ai-analysis', label: 'AI Analysis', icon: Brain },
    { id: 'stock-search', label: 'Stock Search', icon: SearchCheck },
    { id: 'news', label: 'News', icon: Newspaper },
    { id: 'screener', label: 'Screener', icon: Search },
    { id: 'api', label: 'API Integration', icon: Zap },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-effect shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <IndianRupee className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold gradient-text">AI Stock Dashboard</h1>
          </div>
          
          <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
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
        </div>
      </div>
    </nav>
  );
};

export default Navigation;