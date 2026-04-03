'use client';

import React from 'react';
import { Plus, Brain, MoreHorizontal } from 'lucide-react';

interface Props {
  hasLegs: boolean;
  hasPayoff: boolean;
  onAddEdit: () => void;
  onTradeAll: () => void;
  onAIAnalysis: () => void;
  aiLoading: boolean;
}

export default function ActionBar({ hasLegs, hasPayoff, onAddEdit, onTradeAll, onAIAnalysis, aiLoading }: Props) {
  return (
    <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2">
        {/* Add/Edit — opens chain modal */}
        <button
          onClick={onAddEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add/Edit
        </button>

        {/* Trade All — saves as paper trade */}
        <button
          onClick={onTradeAll}
          disabled={!hasPayoff}
          className={`flex-[2] px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors ${
            hasPayoff
              ? 'bg-orange-500 hover:bg-orange-600 shadow-sm'
              : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
          }`}
        >
          Trade All
        </button>

        {/* More menu */}
        <button
          onClick={onAIAnalysis}
          disabled={!hasLegs || aiLoading}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
          title="AI Analysis"
        >
          {aiLoading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          ) : (
            <Brain className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
