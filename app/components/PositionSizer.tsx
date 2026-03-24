'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calculator, Settings, AlertTriangle, TrendingUp, TrendingDown, Shield, IndianRupee, Save, RefreshCw } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5002';

interface RiskSettings {
  capital: number;
  riskPerTrade: number;
  maxPositionPct: number;
  dailyLossLimitPct: number;
  dailyLossLimitAmount: number | null;
  killSwitchActive: boolean;
}

interface PositionResult {
  quantity: number;
  investment: number;
  riskAmount: number;
  riskPerShare: number;
  rewardPerShare: number;
  potentialProfit: number;
  riskRewardRatio: string;
  positionPctOfCapital: number;
  maxRiskAmount: number;
  warnings: string[];
  settings: {
    capital: number;
    riskPerTrade: number;
    maxPositionPct: number;
  };
}

interface PositionSizerProps {
  // Pre-fill from a trade setup (optional)
  prefillEntry?: number;
  prefillSL?: number;
  prefillTarget?: number;
  prefillAction?: 'BUY' | 'SELL';
  // Compact mode for embedding in trade journal rows
  compact?: boolean;
}

const PositionSizer = ({ prefillEntry, prefillSL, prefillTarget, prefillAction, compact = false }: PositionSizerProps) => {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // Calculator inputs
  const [entryPrice, setEntryPrice] = useState<string>(prefillEntry?.toString() || '');
  const [stopLoss, setStopLoss] = useState<string>(prefillSL?.toString() || '');
  const [target, setTarget] = useState<string>(prefillTarget?.toString() || '');
  const [action, setAction] = useState<'BUY' | 'SELL'>(prefillAction || 'BUY');

  // Editable settings fields
  const [editCapital, setEditCapital] = useState<string>('');
  const [editRiskPct, setEditRiskPct] = useState<string>('');
  const [editMaxPosPct, setEditMaxPosPct] = useState<string>('');
  const [editDailyLossPct, setEditDailyLossPct] = useState<string>('');

  // Result
  const [result, setResult] = useState<PositionResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  // Auto-calculate when prefill values change
  useEffect(() => {
    if (prefillEntry) setEntryPrice(prefillEntry.toString());
    if (prefillSL) setStopLoss(prefillSL.toString());
    if (prefillTarget) setTarget(prefillTarget.toString());
    if (prefillAction) setAction(prefillAction);
  }, [prefillEntry, prefillSL, prefillTarget, prefillAction]);

  // Auto-calculate when all 3 prices are filled
  useEffect(() => {
    if (entryPrice && stopLoss && target && settings) {
      const timer = setTimeout(() => calculatePosition(), 500);
      return () => clearTimeout(timer);
    }
  }, [entryPrice, stopLoss, target, action, settings]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/risk/settings`);
      const json = await res.json();
      if (json.status === 'success') {
        setSettings(json.data);
        setEditCapital(json.data.capital.toString());
        setEditRiskPct(json.data.riskPerTrade.toString());
        setEditMaxPosPct(json.data.maxPositionPct.toString());
        setEditDailyLossPct(json.data.dailyLossLimitPct.toString());
      }
    } catch (err) {
      console.warn('PositionSizer: Failed to load risk settings');
    }
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/risk/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capital: Number(editCapital),
          riskPerTrade: Number(editRiskPct),
          maxPositionPct: Number(editMaxPosPct),
          dailyLossLimitPct: Number(editDailyLossPct),
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSettings(json.data);
        setSettingsMessage('Saved!');
        setShowSettings(false);
        setTimeout(() => setSettingsMessage(null), 2000);
      } else {
        setSettingsMessage(json.message || 'Save failed');
      }
    } catch {
      setSettingsMessage('Failed to save');
    } finally {
      setSettingsSaving(false);
    }
  };

  const calculatePosition = useCallback(async () => {
    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tgt = Number(target);

    if (!entry || !sl || !tgt) return;

    setCalculating(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/risk/position-size`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryPrice: entry, stopLoss: sl, target: tgt, action }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setResult(json.data);
        setError(null);
      } else {
        setError(json.message || 'Calculation failed');
        setResult(null);
      }
    } catch {
      setError('Could not connect to server');
      setResult(null);
    } finally {
      setCalculating(false);
    }
  }, [entryPrice, stopLoss, target, action]);

  const formatINR = (n: number) =>
    n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  // ─── Compact mode: single-line display for trade journal rows ───
  if (compact && result) {
    return (
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
          Qty: {result.quantity} shares
        </span>
        <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded">
          Investment: {formatINR(result.investment)}
        </span>
        <span className="bg-red-50 text-red-700 px-2 py-1 rounded">
          Risk: {formatINR(result.riskAmount)}
        </span>
        <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
          Profit: {formatINR(result.potentialProfit)}
        </span>
        <span className={`px-2 py-1 rounded font-medium ${
          parseFloat(result.riskRewardRatio.split(':')[1]) >= 2
            ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
        }`}>
          R:R {result.riskRewardRatio}
        </span>
        {result.warnings.length > 0 && (
          <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {result.warnings[0]}
          </span>
        )}
      </div>
    );
  }

  if (compact && !result) {
    return null; // Don't render compact mode without data
  }

  // ─── Full mode: interactive calculator widget ───
  return (
    <div className="glass-effect rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Calculator className="h-5 w-5 mr-2 text-blue-600" />
          Position Sizer
          {settingsMessage && (
            <span className="ml-2 text-xs font-normal text-green-600">{settingsMessage}</span>
          )}
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          title="Edit risk settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Settings panel (expandable) */}
      {showSettings && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
            <Shield className="h-4 w-4 mr-1" /> Risk Settings
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-blue-700 font-medium">Capital (₹)</label>
              <input
                type="number"
                value={editCapital}
                onChange={(e) => setEditCapital(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                min={10000}
                step={10000}
              />
            </div>
            <div>
              <label className="text-xs text-blue-700 font-medium">Risk / Trade (%)</label>
              <input
                type="number"
                value={editRiskPct}
                onChange={(e) => setEditRiskPct(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                min={0.5}
                max={10}
                step={0.5}
              />
            </div>
            <div>
              <label className="text-xs text-blue-700 font-medium">Max Position (%)</label>
              <input
                type="number"
                value={editMaxPosPct}
                onChange={(e) => setEditMaxPosPct(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                min={5}
                max={100}
                step={5}
              />
            </div>
            <div>
              <label className="text-xs text-blue-700 font-medium">Daily Loss Limit (%)</label>
              <input
                type="number"
                value={editDailyLossPct}
                onChange={(e) => setEditDailyLossPct(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                min={1}
                max={25}
                step={1}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={saveSettings}
              disabled={settingsSaving}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <Save className="h-3.5 w-3.5" /> {settingsSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Capital + Risk display bar */}
      {settings && !showSettings && (
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600">
            <IndianRupee className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Capital:</span>
            <span className="text-gray-900 font-semibold">{formatINR(settings.capital)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <Shield className="h-4 w-4 text-orange-500" />
            <span className="font-medium">Risk/Trade:</span>
            <span className="text-gray-900 font-semibold">{settings.riskPerTrade}%</span>
            <span className="text-gray-400">
              ({formatINR((settings.capital * settings.riskPerTrade) / 100)} max)
            </span>
          </div>
        </div>
      )}

      {/* Input fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 font-medium">Action</label>
          <div className="mt-1 flex rounded-lg overflow-hidden border border-gray-300">
            <button
              onClick={() => setAction('BUY')}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                action === 'BUY' ? 'bg-green-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => setAction('SELL')}
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                action === 'SELL' ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              SELL
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Entry Price (₹)</label>
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            placeholder="e.g. 1400"
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            min={0}
            step={0.05}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Stop Loss (₹)</label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="e.g. 1350"
            className="w-full mt-1 px-3 py-2 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:outline-none bg-red-50"
            min={0}
            step={0.05}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Target (₹)</label>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. 1550"
            className="w-full mt-1 px-3 py-2 border border-green-200 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:outline-none bg-green-50"
            min={0}
            step={0.05}
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Main results row */}
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-gray-200">
            <div className="p-4 text-center bg-blue-50">
              <p className="text-xs text-blue-600 font-medium mb-1">Quantity</p>
              <p className="text-2xl font-bold text-blue-800">{result.quantity}</p>
              <p className="text-xs text-blue-500">shares</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">Investment</p>
              <p className="text-lg font-bold text-gray-900">{formatINR(result.investment)}</p>
              <p className="text-xs text-gray-400">{result.positionPctOfCapital}% of capital</p>
            </div>
            <div className="p-4 text-center bg-red-50">
              <p className="text-xs text-red-600 font-medium mb-1">Max Loss</p>
              <p className="text-lg font-bold text-red-700">{formatINR(result.riskAmount)}</p>
              <p className="text-xs text-red-400">₹{result.riskPerShare.toFixed(2)}/share</p>
            </div>
            <div className="p-4 text-center bg-green-50">
              <p className="text-xs text-green-600 font-medium mb-1">Potential Profit</p>
              <p className="text-lg font-bold text-green-700">{formatINR(result.potentialProfit)}</p>
              <p className="text-xs text-green-400">₹{result.rewardPerShare.toFixed(2)}/share</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 font-medium mb-1">Risk : Reward</p>
              <p className={`text-2xl font-bold ${
                parseFloat(result.riskRewardRatio.split(':')[1]) >= 2
                  ? 'text-green-600'
                  : parseFloat(result.riskRewardRatio.split(':')[1]) >= 1.5
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}>
                {result.riskRewardRatio}
              </p>
              <p className="text-xs text-gray-400">
                {parseFloat(result.riskRewardRatio.split(':')[1]) >= 2
                  ? 'Good'
                  : parseFloat(result.riskRewardRatio.split(':')[1]) >= 1.5
                    ? 'Okay'
                    : 'Poor'}
              </p>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="border-t border-gray-200 p-3 bg-orange-50">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-orange-700 flex items-center gap-1.5 mb-1 last:mb-0">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !error && (
        <div className="text-center py-6 text-gray-400 text-sm">
          Enter Entry, Stop Loss, and Target prices to calculate position size
        </div>
      )}
    </div>
  );
};

export default PositionSizer;
