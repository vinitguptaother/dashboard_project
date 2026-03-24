'use client';

import { useEffect, useState } from 'react';
import type { PortfolioSnapshot, Holding, Position } from '@/src/upstox/types';

export default function UpstoxPortfolioPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'positions'>('overview');

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/upstox-data?type=portfolioSnapshot');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch portfolio data');
      }

      setSnapshot(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold text-xl mb-2">Error Loading Portfolio</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchPortfolioData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upstox Portfolio</h1>
          <button
            onClick={fetchPortfolioData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <SummaryCard
            title="Total Portfolio Value"
            value={formatCurrency(snapshot.totalPortfolioValue)}
            bgColor="bg-blue-50"
            textColor="text-blue-900"
          />
          <SummaryCard
            title="Total P&L"
            value={formatCurrency(snapshot.totalPnL)}
            bgColor={snapshot.totalPnL >= 0 ? 'bg-green-50' : 'bg-red-50'}
            textColor={snapshot.totalPnL >= 0 ? 'text-green-900' : 'text-red-900'}
          />
          <SummaryCard
            title="Available Margin"
            value={formatCurrency(snapshot.funds?.equityAvailableMargin || 0)}
            bgColor="bg-purple-50"
            textColor="text-purple-900"
          />
          <SummaryCard
            title="Used Margin"
            value={formatCurrency(snapshot.funds?.equityUsedMargin || 0)}
            bgColor="bg-orange-50"
            textColor="text-orange-900"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <TabButton
                active={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                label="Overview"
              />
              <TabButton
                active={activeTab === 'holdings'}
                onClick={() => setActiveTab('holdings')}
                label={`Holdings (${snapshot.holdings.holdings.length})`}
              />
              <TabButton
                active={activeTab === 'positions'}
                onClick={() => setActiveTab('positions')}
                label={`Positions (${snapshot.positions.positions.length})`}
              />
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && <OverviewTab snapshot={snapshot} />}
            {activeTab === 'holdings' && <HoldingsTab holdings={snapshot.holdings.holdings} />}
            {activeTab === 'positions' && <PositionsTab positions={snapshot.positions.positions} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// Components
function SummaryCard({ title, value, bgColor, textColor }: any) {
  return (
    <div className={`${bgColor} rounded-lg p-6`}>
      <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

function OverviewTab({ snapshot }: { snapshot: PortfolioSnapshot }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Holdings Summary */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Holdings Summary</h3>
        <div className="space-y-3">
          <SummaryRow label="Total Investment" value={formatCurrency(snapshot.holdings.summary.totalInvestmentValue)} />
          <SummaryRow label="Current Value" value={formatCurrency(snapshot.holdings.summary.totalCurrentValue)} />
          <SummaryRow
            label="Total P&L"
            value={`${formatCurrency(snapshot.holdings.summary.totalPnL)} (${snapshot.holdings.summary.totalPnLPercentage.toFixed(2)}%)`}
            valueColor={snapshot.holdings.summary.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}
          />
          <SummaryRow
            label="Day Change"
            value={`${formatCurrency(snapshot.holdings.summary.totalDayChange)} (${snapshot.holdings.summary.totalDayChangePercentage.toFixed(2)}%)`}
            valueColor={snapshot.holdings.summary.totalDayChange >= 0 ? 'text-green-600' : 'text-red-600'}
          />
          <SummaryRow label="Holdings Count" value={snapshot.holdings.summary.holdingsCount.toString()} />
        </div>
      </div>

      {/* Positions Summary */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Positions Summary</h3>
        <div className="space-y-3">
          <SummaryRow
            label="Total P&L"
            value={formatCurrency(snapshot.positions.summary.totalPnL)}
            valueColor={snapshot.positions.summary.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}
          />
          <SummaryRow label="Realised P&L" value={formatCurrency(snapshot.positions.summary.totalRealisedPnL)} />
          <SummaryRow label="Unrealised P&L" value={formatCurrency(snapshot.positions.summary.totalUnrealisedPnL)} />
          <SummaryRow label="Total Value" value={formatCurrency(snapshot.positions.summary.totalValue)} />
          <SummaryRow label="Long Positions" value={snapshot.positions.summary.longPositions.toString()} />
          <SummaryRow label="Short Positions" value={snapshot.positions.summary.shortPositions.toString()} />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, valueColor = 'text-gray-900' }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
    </div>
  );
}

function HoldingsTab({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No holdings found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">LTP</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Value</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {holdings.map((holding, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-4 text-sm font-medium text-gray-900">{holding.symbol}</td>
              <td className="px-4 py-4 text-sm text-right text-gray-900">{holding.quantity}</td>
              <td className="px-4 py-4 text-sm text-right text-gray-900">₹{holding.averagePrice.toFixed(2)}</td>
              <td className="px-4 py-4 text-sm text-right text-gray-900">₹{holding.lastPrice.toFixed(2)}</td>
              <td className="px-4 py-4 text-sm text-right text-gray-900">₹{holding.currentValue.toFixed(2)}</td>
              <td className={`px-4 py-4 text-sm text-right font-semibold ${holding.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{holding.pnl.toFixed(2)}
              </td>
              <td className={`px-4 py-4 text-sm text-right font-semibold ${holding.pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {holding.pnlPercentage.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionsTab({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No positions found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Product</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">LTP</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">P&L</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Realised</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unrealised</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {positions.map((position, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-4 text-sm font-medium text-gray-900">{position.symbol}</td>
              <td className="px-4 py-4 text-sm text-center text-gray-600">{position.product}</td>
              <td className={`px-4 py-4 text-sm text-right ${position.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {position.quantity}
              </td>
              <td className="px-4 py-4 text-sm text-right text-gray-900">₹{position.averagePrice.toFixed(2)}</td>
              <td className="px-4 py-4 text-sm text-right text-gray-900">₹{position.lastPrice.toFixed(2)}</td>
              <td className={`px-4 py-4 text-sm text-right font-semibold ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{position.pnl.toFixed(2)}
              </td>
              <td className="px-4 py-4 text-sm text-right text-gray-600">₹{position.realised.toFixed(2)}</td>
              <td className="px-4 py-4 text-sm text-right text-gray-600">₹{position.unrealised.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}
