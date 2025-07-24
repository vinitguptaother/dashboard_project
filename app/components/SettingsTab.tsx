'use client';

import { useState } from 'react';
import { Settings, User, Bell, Shield, Palette, Database, Download } from 'lucide-react';

const SettingsTab = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const [settings, setSettings] = useState({
    profile: {
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@email.com',
      phone: '+91 98765 43210',
      experience: 'intermediate',
      riskTolerance: 'moderate'
    },
    notifications: {
      priceAlerts: true,
      newsUpdates: true,
      aiRecommendations: true,
      portfolioUpdates: false,
      emailNotifications: true,
      smsAlerts: false
    },
    trading: {
      defaultInvestment: 10000,
      maxPositionSize: 5,
      stopLossDefault: 5,
      takeProfitDefault: 10,
      autoExecute: false,
      paperTrading: true
    },
    display: {
      theme: 'light',
      currency: 'INR',
      language: 'english',
      chartType: 'candlestick',
      refreshRate: 30
    }
  });

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'trading', label: 'Trading', icon: Settings },
    { id: 'display', label: 'Display', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'data', label: 'Data & Export', icon: Database }
  ];

  const handleSettingChange = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={settings.profile.name}
            onChange={(e) => handleSettingChange('profile', 'name', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={settings.profile.email}
            onChange={(e) => handleSettingChange('profile', 'email', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={settings.profile.phone}
            onChange={(e) => handleSettingChange('profile', 'phone', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trading Experience</label>
          <select
            value={settings.profile.experience}
            onChange={(e) => handleSettingChange('profile', 'experience', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="beginner">Beginner (0-1 years)</option>
            <option value="intermediate">Intermediate (1-5 years)</option>
            <option value="advanced">Advanced (5+ years)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Risk Tolerance</label>
          <select
            value={settings.profile.riskTolerance}
            onChange={(e) => handleSettingChange('profile', 'riskTolerance', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="conservative">Conservative</option>
            <option value="moderate">Moderate</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
      <div className="space-y-4">
        {Object.entries(settings.notifications).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </h4>
              <p className="text-sm text-gray-600">
                {key === 'priceAlerts' && 'Get notified when stock prices hit your targets'}
                {key === 'newsUpdates' && 'Receive latest market news and updates'}
                {key === 'aiRecommendations' && 'Get AI-powered trading recommendations'}
                {key === 'portfolioUpdates' && 'Updates on your portfolio performance'}
                {key === 'emailNotifications' && 'Receive notifications via email'}
                {key === 'smsAlerts' && 'Receive critical alerts via SMS'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={value as boolean}
                onChange={(e) => handleSettingChange('notifications', key, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTradingSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Trading Preferences</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Investment Amount (₹)</label>
          <input
            type="number"
            value={settings.trading.defaultInvestment}
            onChange={(e) => handleSettingChange('trading', 'defaultInvestment', parseInt(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Position Size (%)</label>
          <input
            type="number"
            value={settings.trading.maxPositionSize}
            onChange={(e) => handleSettingChange('trading', 'maxPositionSize', parseInt(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Stop Loss (%)</label>
          <input
            type="number"
            value={settings.trading.stopLossDefault}
            onChange={(e) => handleSettingChange('trading', 'stopLossDefault', parseInt(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Take Profit (%)</label>
          <input
            type="number"
            value={settings.trading.takeProfitDefault}
            onChange={(e) => handleSettingChange('trading', 'takeProfitDefault', parseInt(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900">Auto Execute Trades</h4>
            <p className="text-sm text-gray-600">Automatically execute AI recommendations</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.trading.autoExecute}
              onChange={(e) => handleSettingChange('trading', 'autoExecute', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900">Paper Trading Mode</h4>
            <p className="text-sm text-gray-600">Practice trading without real money</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.trading.paperTrading}
              onChange={(e) => handleSettingChange('trading', 'paperTrading', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderDisplaySettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Display Preferences</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
          <select
            value={settings.display.theme}
            onChange={(e) => handleSettingChange('display', 'theme', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={settings.display.currency}
            onChange={(e) => handleSettingChange('display', 'currency', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="INR">Indian Rupee (₹)</option>
            <option value="USD">US Dollar ($)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
          <select
            value={settings.display.language}
            onChange={(e) => handleSettingChange('display', 'language', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="english">English</option>
            <option value="hindi">हिंदी</option>
            <option value="gujarati">ગુજરાતી</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chart Type</label>
          <select
            value={settings.display.chartType}
            onChange={(e) => handleSettingChange('display', 'chartType', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="candlestick">Candlestick</option>
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Refresh Rate (seconds)</label>
          <select
            value={settings.display.refreshRate}
            onChange={(e) => handleSettingChange('display', 'refreshRate', parseInt(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
      <div className="space-y-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Two-Factor Authentication</h4>
          <p className="text-sm text-gray-600 mb-3">Add an extra layer of security to your account</p>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Enable 2FA
          </button>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Change Password</h4>
          <p className="text-sm text-gray-600 mb-3">Update your account password</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Change Password
          </button>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Login Sessions</h4>
          <p className="text-sm text-gray-600 mb-3">Manage your active login sessions</p>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            View Sessions
          </button>
        </div>
      </div>
    </div>
  );

  const renderDataSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
      <div className="space-y-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Export Portfolio Data</h4>
          <p className="text-sm text-gray-600 mb-3">Download your portfolio and trading history</p>
          <div className="flex space-x-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </button>
          </div>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Data Backup</h4>
          <p className="text-sm text-gray-600 mb-3">Backup your settings and preferences</p>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            Create Backup
          </button>
        </div>
        <div className="p-4 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-900 mb-2">Delete Account</h4>
          <p className="text-sm text-red-600 mb-3">Permanently delete your account and all data</p>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'profile': return renderProfileSettings();
      case 'notifications': return renderNotificationSettings();
      case 'trading': return renderTradingSettings();
      case 'display': return renderDisplaySettings();
      case 'security': return renderSecuritySettings();
      case 'data': return renderDataSettings();
      default: return renderProfileSettings();
    }
  };

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings & Preferences</h1>
        <p className="text-gray-600">Customize your trading dashboard experience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="glass-effect rounded-xl p-4 shadow-lg h-fit">
          <h3 className="font-semibold text-gray-900 mb-4">Settings</h3>
          <nav className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 glass-effect rounded-xl p-6 shadow-lg">
          {renderActiveSection()}
          
          
          <div className="mt-8 pt-6 border-t border-gray-200 flex space-x-3">
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Save Changes
            </button>
            <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;