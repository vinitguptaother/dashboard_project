'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { PayoffResult, MarginData, StrategyLeg } from './types';

interface Insight {
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
}

interface Props {
  payoff: PayoffResult;
  margin: MarginData | null;
  legs: StrategyLeg[];
  daysToExpiry: number;
}

const STYLE_MAP = {
  danger: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    icon: AlertTriangle,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    icon: AlertCircle,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    icon: Info,
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-400',
    icon: CheckCircle,
  },
};

export default function InsightsPanel({ payoff, margin, legs, daysToExpiry }: Props) {
  const [expanded, setExpanded] = useState(false);

  const insights = useMemo(() => {
    const result: Insight[] = [];

    // Unlimited loss
    if (payoff.maxLoss === 'Unlimited') {
      result.push({
        type: 'danger',
        title: 'Unlimited Loss Risk',
        description: 'This strategy has unlimited loss potential. Consider adding protective legs.',
      });
    }

    // Single naked sell
    const sellLegs = legs.filter(l => l.side === 'SELL');
    const buyLegs = legs.filter(l => l.side === 'BUY');
    if (sellLegs.length > 0 && buyLegs.length === 0) {
      result.push({
        type: 'danger',
        title: 'Naked Selling',
        description: 'All legs are sold without any hedge. This carries very high risk.',
      });
    }

    // Low POP
    if ((payoff.pop ?? 0) > 0 && (payoff.pop ?? 0) < 30) {
      result.push({
        type: 'warning',
        title: 'Low Probability of Profit',
        description: `POP is only ${payoff.pop ?? 0}%. The odds are against this strategy being profitable.`,
      });
    }

    // High margin relative to premium
    if (margin && payoff.netPremium) {
      const absMargin = margin.totalMargin || 0;
      const absPremium = Math.abs(payoff.netPremium);
      if (absPremium > 0 && absMargin > 10 * absPremium) {
        result.push({
          type: 'warning',
          title: 'High Margin Requirement',
          description: `Margin (₹${(absMargin / 1000).toFixed(1)}K) is ${(absMargin / absPremium).toFixed(0)}x the premium. Capital efficiency is low.`,
        });
      }
    }

    // Theta decay acceleration
    if (daysToExpiry > 0 && daysToExpiry <= 3) {
      result.push({
        type: 'warning',
        title: 'Theta Decay Accelerating',
        description: `Only ${daysToExpiry} day(s) to expiry. Time decay is at its fastest — be cautious with long positions.`,
      });
    }

    // Good risk-reward
    if (typeof payoff.riskReward === 'number' && payoff.riskReward >= 2) {
      result.push({
        type: 'success',
        title: 'Favorable Risk-Reward',
        description: `Risk-reward ratio is ${payoff.riskReward.toFixed(1)}:1 — potential reward significantly exceeds risk.`,
      });
    }

    // High POP
    if ((payoff.pop ?? 0) >= 70) {
      result.push({
        type: 'success',
        title: 'High Probability of Profit',
        description: `POP is ${payoff.pop ?? 0}%. This strategy has a strong statistical edge.`,
      });
    }

    // Wide breakevens (info)
    if ((payoff.breakevens ?? []).length === 2) {
      const range = payoff.breakevens[1] - payoff.breakevens[0];
      const rangePercent = (range / payoff.breakevens[0]) * 100;
      if (rangePercent > 10) {
        result.push({
          type: 'info',
          title: 'Wide Breakeven Range',
          description: `Breakevens are ${rangePercent.toFixed(1)}% apart — the market has room to move before this position loses money.`,
        });
      }
    }

    return result;
  }, [payoff, margin, legs, daysToExpiry]);

  if (insights.length === 0) return null;

  const dangerCount = insights.filter(i => i.type === 'danger').length;
  const warningCount = insights.filter(i => i.type === 'warning').length;

  return (
    <div className="mx-4 mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Insights
          </span>
          {dangerCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              {dangerCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              {warningCount}
            </span>
          )}
          <span className="text-[10px] text-gray-400">{insights.length} total</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {insights.map((insight, i) => {
            const style = STYLE_MAP[insight.type];
            const Icon = style.icon;
            return (
              <div
                key={i}
                className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${style.text}`} />
                <div>
                  <div className={`text-xs font-semibold ${style.text}`}>{insight.title}</div>
                  <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{insight.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
