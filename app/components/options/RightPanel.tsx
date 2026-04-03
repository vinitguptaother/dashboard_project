'use client';

import React, { useState } from 'react';
import SummaryBar from './SummaryBar';
import GreeksPanel from './GreeksPanel';
import PayoffChart from '../PayoffChart';
import { PayoffResult, MarginData, OptionChainData, StrategyLeg } from './types';

type RightTab = 'payoff' | 'greeks';

interface Props {
  payoff: PayoffResult | null;
  payoffLoading: boolean;
  margin: MarginData | null;
  chain: OptionChainData | null;
  legs: StrategyLeg[];
  spotPrice: number;
  aiAnalysis: string;
}

export default function RightPanel({ payoff, payoffLoading, margin, chain, legs, spotPrice, aiAnalysis }: Props) {
  const [activeTab, setActiveTab] = useState<RightTab>('payoff');

  const tabs: { id: RightTab; label: string }[] = [
    { id: 'payoff', label: 'Payoff Graph' },
    { id: 'greeks', label: 'Greeks' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Summary */}
      <SummaryBar payoff={payoff} margin={margin} />

      {/* Tab strip */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'payoff' && (
          <div className="p-4">
            {payoffLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : payoff ? (
              <div className="space-y-4">
                <PayoffChart
                  data={payoff.payoffData}
                  spotPrice={spotPrice}
                  breakevens={payoff.breakevens}
                  sdMoves={payoff.sdMoves}
                  netDelta={payoff.greeks.netDelta}
                  netTheta={payoff.greeks.netTheta}
                  netGamma={payoff.greeks.netGamma}
                  netVega={payoff.greeks.netVega}
                />

                {/* AI Analysis */}
                {aiAnalysis && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">AI Analysis</h4>
                    <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{aiAnalysis}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                <svg className="w-16 h-16 mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 16l4-8 4 4 5-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm">Select a strategy to see the payoff chart</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'greeks' && (
          <GreeksPanel payoff={payoff} chain={chain} legs={legs} spotPrice={spotPrice} />
        )}
      </div>
    </div>
  );
}
