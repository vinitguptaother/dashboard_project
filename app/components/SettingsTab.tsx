'use client';

import { useState, useEffect } from 'react';
import { Settings, User, Bell, Shield, Palette, Database, Download, Key, CheckCircle, Save, Activity, HeartPulse } from 'lucide-react';
import { AuthClient } from '../lib/apiService';
import APIKeysTab from './APIKeysTab';
import SystemHealthPanel from './SystemHealthPanel';

const BACKEND_URL = 'http://localhost:5002';
const SETTINGS_KEY = 'dashboard_settings';

const defaultSettings = {
  profile: {
    name: '',
    email: '',
    phone: '',
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
};

const SettingsTab = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const [settings, setSettings] = useState(defaultSettings);
  const [loginEmail, setLoginEmail] = useState('demo@stockdashboard.com');
  const [loginPassword, setLoginPassword] = useState('demo123');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [changePwForm, setChangePwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [apiUsage, setApiUsage] = useState<any>(null);
  const [apiUsageLoading, setApiUsageLoading] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  const handleSaveAll = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage('Failed to save settings.');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'trading', label: 'Trading', icon: Settings },
    { id: 'display', label: 'Display', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'data', label: 'Data & Export', icon: Database },
    { id: 'api-usage', label: 'API Usage', icon: Activity },
    { id: 'system-health', label: 'System Health', icon: HeartPulse }
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
      {/* Simple Auth Controls */}
      <div className="p-4 border border-gray-200 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Login</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input value={loginEmail} onChange={(e)=>setLoginEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input type="password" value={loginPassword} onChange={(e)=>setLoginPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <button onClick={async()=>{ try{ await AuthClient.login(loginEmail, loginPassword); setAuthMessage('Logged in'); }catch(e:any){ setAuthMessage(e.message||'Login failed'); } }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Login</button>
            <button onClick={()=>{ AuthClient.logout(); setAuthMessage('Logged out'); }} className="px-4 py-2 border border-gray-300 rounded-lg">Logout</button>
          </div>
        </div>
        {authMessage && <div className="text-sm text-gray-700 mt-2">{authMessage}</div>}
      </div>
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

  // ─── Risk Management Settings (saved to MongoDB) ───
  const [riskSettings, setRiskSettings] = useState({
    capital: 500000, riskPerTrade: 2, maxPositionPct: 20, dailyLossLimitPct: 5
  });
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskMessage, setRiskMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load risk settings from backend
    fetch(`${BACKEND_URL}/api/risk/settings`)
      .then(r => r.json())
      .then(json => {
        if (json.status === 'success' && json.data) {
          setRiskSettings({
            capital: json.data.capital,
            riskPerTrade: json.data.riskPerTrade,
            maxPositionPct: json.data.maxPositionPct,
            dailyLossLimitPct: json.data.dailyLossLimitPct,
          });
        }
      })
      .catch(() => {});
  }, []);

  const saveRiskSettings = async () => {
    setRiskLoading(true);
    setRiskMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/risk/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riskSettings),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setRiskMessage('Risk settings saved!');
      } else {
        setRiskMessage(json.message || 'Failed to save');
      }
    } catch {
      setRiskMessage('Could not connect to server');
    } finally {
      setRiskLoading(false);
      setTimeout(() => setRiskMessage(null), 3000);
    }
  };

  const formatINR = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  const renderTradingSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Risk Management</h3>
      <p className="text-sm text-gray-500">These settings control how the Position Sizer calculates trade quantities. They are saved to the database and apply across all tabs.</p>

      {/* Capital */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <label className="block text-sm font-semibold text-blue-800 mb-1">Trading Capital (₹)</label>
        <p className="text-xs text-blue-600 mb-2">Your total capital available for trading. Update this whenever you add or withdraw money.</p>
        <input
          type="number"
          value={riskSettings.capital}
          onChange={(e) => setRiskSettings(p => ({ ...p, capital: Number(e.target.value) }))}
          className="w-full p-3 border border-blue-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-400 focus:outline-none"
          min={10000}
          step={10000}
        />
        <p className="text-xs text-blue-500 mt-1">Current: {formatINR(riskSettings.capital)}</p>
      </div>

      {/* Risk Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Risk Per Trade (%)</label>
          <p className="text-xs text-gray-500 mb-2">Max % of capital you can lose on one trade. Industry standard: 1-2%.</p>
          <input
            type="number"
            value={riskSettings.riskPerTrade}
            onChange={(e) => setRiskSettings(p => ({ ...p, riskPerTrade: Number(e.target.value) }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
            min={0.5}
            max={10}
            step={0.5}
          />
          <p className="text-xs text-gray-400 mt-1">
            Max loss per trade: {formatINR((riskSettings.capital * riskSettings.riskPerTrade) / 100)}
          </p>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Max Position Size (%)</label>
          <p className="text-xs text-gray-500 mb-2">Max % of capital in a single stock. Prevents over-concentration.</p>
          <input
            type="number"
            value={riskSettings.maxPositionPct}
            onChange={(e) => setRiskSettings(p => ({ ...p, maxPositionPct: Number(e.target.value) }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
            min={5}
            max={100}
            step={5}
          />
          <p className="text-xs text-gray-400 mt-1">
            Max per stock: {formatINR((riskSettings.capital * riskSettings.maxPositionPct) / 100)}
          </p>
        </div>
        <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
          <label className="block text-sm font-semibold text-orange-700 mb-1">Daily Loss Limit (%)</label>
          <p className="text-xs text-orange-600 mb-2">If your total losses today hit this %, the kill switch activates and blocks new trades.</p>
          <input
            type="number"
            value={riskSettings.dailyLossLimitPct}
            onChange={(e) => setRiskSettings(p => ({ ...p, dailyLossLimitPct: Number(e.target.value) }))}
            className="w-full p-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none"
            min={1}
            max={25}
            step={1}
          />
          <p className="text-xs text-orange-500 mt-1">
            Kill switch at: {formatINR((riskSettings.capital * riskSettings.dailyLossLimitPct) / 100)} daily loss
          </p>
        </div>
      </div>

      {/* Quick reference */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Quick Reference</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-gray-900">{formatINR(riskSettings.capital)}</p>
            <p className="text-xs text-gray-500">Total Capital</p>
          </div>
          <div>
            <p className="text-lg font-bold text-orange-600">{formatINR((riskSettings.capital * riskSettings.riskPerTrade) / 100)}</p>
            <p className="text-xs text-gray-500">Max Risk / Trade</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-600">{formatINR((riskSettings.capital * riskSettings.maxPositionPct) / 100)}</p>
            <p className="text-xs text-gray-500">Max Position</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{formatINR((riskSettings.capital * riskSettings.dailyLossLimitPct) / 100)}</p>
            <p className="text-xs text-gray-500">Daily Loss Limit</p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveRiskSettings}
          disabled={riskLoading}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="h-4 w-4" /> {riskLoading ? 'Saving...' : 'Save Risk Settings'}
        </button>
        {riskMessage && (
          <span className={`text-sm font-medium ${riskMessage.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
            {riskMessage}
          </span>
        )}
      </div>

      {/* Paper Trading toggle */}
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
          <h4 className="font-medium text-gray-900 mb-2">Change Password</h4>
          <p className="text-sm text-gray-600 mb-3">Update your account password</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Current Password</label>
              <input type="password" value={changePwForm.current} onChange={(e) => setChangePwForm(p => ({ ...p, current: e.target.value }))} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="Current password" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">New Password</label>
              <input type="password" value={changePwForm.newPw} onChange={(e) => setChangePwForm(p => ({ ...p, newPw: e.target.value }))} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="New password" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" value={changePwForm.confirm} onChange={(e) => setChangePwForm(p => ({ ...p, confirm: e.target.value }))} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="Confirm password" />
            </div>
          </div>
          <button
            onClick={async () => {
              if (!changePwForm.current || !changePwForm.newPw) { setPwMessage('Please fill all fields.'); return; }
              if (changePwForm.newPw !== changePwForm.confirm) { setPwMessage('New passwords do not match.'); return; }
              if (changePwForm.newPw.length < 6) { setPwMessage('Password must be at least 6 characters.'); return; }
              try {
                const token = localStorage.getItem('auth_token');
                const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify({ currentPassword: changePwForm.current, newPassword: changePwForm.newPw }),
                });
                const data = await res.json();
                setPwMessage(data.message || (res.ok ? 'Password changed!' : 'Failed to change password.'));
                if (res.ok) setChangePwForm({ current: '', newPw: '', confirm: '' });
              } catch { setPwMessage('Could not reach server. Make sure backend is running.'); }
              setTimeout(() => setPwMessage(null), 4000);
            }}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Update Password
          </button>
          {pwMessage && <p className="mt-2 text-sm text-gray-700">{pwMessage}</p>}
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Two-Factor Authentication</h4>
          <p className="text-sm text-gray-600 mb-3">Add an extra layer of security to your account</p>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors opacity-50 cursor-not-allowed" disabled>
            Enable 2FA (Coming Soon)
          </button>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Login Sessions</h4>
          <p className="text-sm text-gray-600 mb-3">You are currently logged in from this device.</p>
          <button
            onClick={() => { AuthClient.logout(); setAuthMessage('Logged out from all sessions.'); }}
            className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
          >
            Logout All Sessions
          </button>
        </div>
      </div>
    </div>
  );

  const exportTradeJournalCSV = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/trade-setup/history?limit=500`);
      const json = await res.json();
      if (json.status !== 'success' || !json.data?.length) {
        alert('No trade setups to export.');
        return;
      }
      const rows = json.data as any[];
      const headers = ['Symbol', 'Action', 'Type', 'Entry Price', 'Stop Loss', 'Target', 'Current Price', 'R:R', 'Confidence', 'Status', 'Screen', 'Reasoning', 'Created At'];
      const csvLines = [
        headers.join(','),
        ...rows.map((r: any) => [
          r.symbol, r.action, r.tradeType, r.entryPrice, r.stopLoss, r.target,
          r.currentPrice || '', r.riskRewardRatio, r.confidence, r.status,
          `"${(r.screenName || '').replace(/"/g, '""')}"`,
          `"${(r.reasoning || '').replace(/"/g, '""')}"`,
          new Date(r.createdAt).toLocaleString('en-IN'),
        ].join(','))
      ];
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trade-journal-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export. Make sure the backend is running.');
    }
  };

  const exportSettingsBackup = () => {
    const backup = {
      settings,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettingsBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.settings) {
            setSettings(data.settings);
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
            setSaveMessage('Settings restored from backup!');
            setTimeout(() => setSaveMessage(null), 3000);
          }
        } catch {
          alert('Invalid backup file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const renderDataSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
      <div className="space-y-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Export Trade Journal</h4>
          <p className="text-sm text-gray-600 mb-3">Download all your AI trade setups as a CSV spreadsheet</p>
          <button onClick={exportTradeJournalCSV} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export Trade Journal CSV
          </button>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Settings Backup</h4>
          <p className="text-sm text-gray-600 mb-3">Backup or restore your dashboard settings and preferences</p>
          <div className="flex space-x-2">
            <button onClick={exportSettingsBackup} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center">
              <Download className="h-4 w-4 mr-2" />
              Export Settings
            </button>
            <button onClick={importSettingsBackup} className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors">
              Import Settings
            </button>
          </div>
        </div>
        <div className="p-4 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-900 mb-2">Reset Settings</h4>
          <p className="text-sm text-red-600 mb-3">Reset all dashboard settings to defaults</p>
          <button
            onClick={() => {
              if (confirm('Reset all settings to defaults? This cannot be undone.')) {
                setSettings(defaultSettings);
                localStorage.removeItem(SETTINGS_KEY);
                setSaveMessage('Settings reset to defaults.');
                setTimeout(() => setSaveMessage(null), 3000);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );

  const fetchApiUsage = async () => {
    setApiUsageLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/api-usage/summary`);
      const json = await res.json();
      if (json.status === 'success') setApiUsage(json.data);
    } catch (err) {
      console.error('Failed to fetch API usage:', err);
    } finally {
      setApiUsageLoading(false);
    }
  };

  const renderAPIUsage = () => {
    if (!apiUsage && !apiUsageLoading) fetchApiUsage();

    const fmtCost = (v: number) => v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
    const fmtINR = (v: number) => `₹${(v * 85).toFixed(2)}`; // approx USD→INR

    const cards = apiUsage ? [
      { label: "Today's Calls", value: apiUsage.today?.calls || 0, sub: fmtCost(apiUsage.today?.cost || 0) },
      { label: "This Week", value: apiUsage.week?.calls || 0, sub: fmtCost(apiUsage.week?.cost || 0) },
      { label: "All Time", value: apiUsage.allTime?.calls || 0, sub: fmtCost(apiUsage.allTime?.cost || 0) },
      { label: "Weekly Cost (INR)", value: fmtINR(apiUsage.week?.cost || 0), sub: `${((apiUsage.week?.inputTokens || 0) + (apiUsage.week?.outputTokens || 0)).toLocaleString()} tokens` },
    ] : [];

    const endpointNames: Record<string, string> = {
      'stock-fundamentals': 'Stock Fundamentals',
      'stock-news': 'Stock News',
      'stock-recommendation': 'AI Recommendation',
      'screen-ranking': 'Screen Ranking',
      'trade-setup': 'Trade Setup',
      'ai-analysis': 'AI Analysis Tab',
      'ai-service': 'AI Chatbot',
      'perplexity-proxy': 'Perplexity Proxy',
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">API Usage Tracker</h3>
          <button onClick={fetchApiUsage} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Refresh
          </button>
        </div>
        <p className="text-sm text-gray-500">Tracks Perplexity AI calls only (Upstox & Yahoo Finance are free)</p>

        {apiUsageLoading && <p className="text-gray-500">Loading...</p>}

        {apiUsage && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {cards.map((card, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                  <div className="text-2xl font-bold text-gray-900 font-mono">{card.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                  <div className="text-xs text-green-600 font-medium mt-0.5">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Top Endpoints */}
            {apiUsage.topEndpoints?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Usage by Feature</h4>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-gray-600 font-medium">Feature</th>
                        <th className="text-right px-4 py-2 text-gray-600 font-medium">Calls</th>
                        <th className="text-right px-4 py-2 text-gray-600 font-medium">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiUsage.topEndpoints.map((ep: any, i: number) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-900">{endpointNames[ep.endpoint] || ep.endpoint}</td>
                          <td className="px-4 py-2 text-right font-mono text-gray-700">{ep.calls}</td>
                          <td className="px-4 py-2 text-right font-mono text-green-700">{fmtCost(ep.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Token breakdown */}
            <div className="text-xs text-gray-400 mt-4 space-y-1">
              <p>All-time tokens: {(apiUsage.allTime?.inputTokens || 0).toLocaleString()} input + {(apiUsage.allTime?.outputTokens || 0).toLocaleString()} output</p>
              <p>Pricing: sonar-pro $0.003/1K input, $0.015/1K output | Logs auto-delete after 90 days</p>
            </div>
          </>
        )}

        {!apiUsage && !apiUsageLoading && (
          <div className="text-center py-8 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No API usage data yet. Search a stock to start tracking!</p>
          </div>
        )}
      </div>
    );
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'profile': return renderProfileSettings();
      case 'api-keys': return <APIKeysTab />;
      case 'notifications': return renderNotificationSettings();
      case 'trading': return renderTradingSettings();
      case 'display': return renderDisplaySettings();
      case 'security': return renderSecuritySettings();
      case 'data': return renderDataSettings();
      case 'api-usage': return renderAPIUsage();
      case 'system-health': return <SystemHealthPanel />;
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
          
          
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center space-x-3">
            <button onClick={handleSaveAll} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </button>
            <button
              onClick={() => {
                try {
                  const saved = localStorage.getItem(SETTINGS_KEY);
                  if (saved) setSettings(JSON.parse(saved));
                  else setSettings(defaultSettings);
                } catch { setSettings(defaultSettings); }
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {saveMessage && (
              <span className="flex items-center text-sm text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                {saveMessage}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;