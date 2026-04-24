'use client';

/**
 * BotsAgentsTab — single home for all AI activity in Vinit's dashboard.
 *
 * Sub-sections (scroll, no sub-tabs to avoid confusion):
 *   1. Trading Bots (the 4 rule-based bots — reuses BotOpsPanel)
 *   2. Research Agents (6 AI agents — coming in Phase 1+)
 *   3. Chief Analyst (briefing + chat — coming in Phase 4)
 *   4. Sentinel (action items — coming in Phase 1)
 *
 * Phase 0: shows BotOpsPanel + placeholders for upcoming sections.
 */

import BotOpsPanel from './BotOpsPanel';
import ChiefAnalystChat from './ChiefAnalystChat';
import BacktestPanel from './BacktestPanel';
import { Bot, Sparkles, AlertTriangle, Clock, Zap, TrendingUp, BarChart3 } from 'lucide-react';

export default function BotsAgentsTab() {
  return (
    <div className="max-w-7xl mx-auto space-y-5 px-4">
      {/* Page header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-5 border border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
            <Bot className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Bots &amp; Agents</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              4 trading bots + 6 AI research agents (coming). All autonomous. You approve every suggestion.
            </p>
          </div>
        </div>
      </div>

      {/* Section 1 — Trading Bots */}
      <section>
        <div className="flex items-center gap-2 mb-3 px-2">
          <Zap className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Trading Bots</h2>
          <span className="text-xs text-gray-500">rule-based · paper mode · auto-run</span>
        </div>
        <BotOpsPanel />
      </section>

      {/* Section 1b — Backtester (Phase 5) */}
      <section>
        <div className="flex items-center gap-2 mb-3 px-2">
          <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Strategy Backtester</h2>
          <span className="text-xs text-gray-500">Phase 5 · regime-aware · realism-on · free</span>
        </div>
        <BacktestPanel />
      </section>

      {/* Chief Analyst Chat — always accessible */}
      <section>
        <details open className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Ask Chief Analyst</h2>
              <span className="text-xs text-gray-500">chat · context-aware · no memory write</span>
            </div>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">click to expand / collapse</span>
          </summary>
          <div className="px-3 pb-3">
            <ChiefAnalystChat />
          </div>
        </details>
      </section>

      {/* Section 2 — Research Agents (placeholder) */}
      <section>
        <div className="flex items-center gap-2 mb-3 px-2">
          <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI Research Agents</h2>
          <span className="text-xs text-gray-500">launching Phase 1-4</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AgentCard
            name="Chief Analyst"
            icon={Sparkles}
            mission="Synthesize everything, learn Vinit's style, brief daily, chat anytime."
            schedule="3×/day + weekly Opus deep dive"
            phase="Phase 4"
          />
          <AgentCard
            name="Market Scout"
            icon={TrendingUp}
            mission="Pre-market news digest + macro context. Morning briefing in plain English."
            schedule="Daily 6:30 AM IST"
            phase="Phase 1 (next!)"
          />
          <AgentCard
            name="Smart Money Tracker"
            icon={Bot}
            mission="Track Vijay Kedia, Damani, Jhunjhunwala estate, Pabrai, Singhania moves weekly."
            schedule="Weekly Sunday"
            phase="Phase 2"
          />
          <AgentCard
            name="Pattern Miner"
            icon={TrendingUp}
            mission="Post-trade lessons. 'Why did this win/lose? What would have predicted it?'"
            schedule="After every closed trade"
            phase="Phase 3"
          />
          <AgentCard
            name="Sentiment Watcher"
            icon={AlertTriangle}
            mission="Scan public Twitter/StockTwits for unusual chatter on your watchlist."
            schedule="Hourly, market hours"
            phase="Phase 2"
          />
          <AgentCard
            name="Meta-Critic ⭐"
            icon={Clock}
            mission="Audits all 5 agents' past predictions vs outcomes. Calibrates their confidence. Experimental."
            schedule="Weekly"
            phase="Phase 4"
            experimental
          />
        </div>
      </section>

      {/* Section 3 — Sentinel status placeholder */}
      <section>
        <div className="flex items-center gap-2 mb-3 px-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sentinel</h2>
          <span className="text-xs text-gray-500">dashboard self-awareness · no AI, pure monitoring</span>
        </div>
        <div className="rounded-xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-900/10 p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Sentinel watches your duties, data freshness, pending approvals, and risk state.
            When something needs your attention, it appears in the <strong>Today</strong> tab with a clear &quot;what · why · impact · action&quot; card.
          </p>
          <p className="text-xs text-gray-500 mt-2 italic">
            Basic version active now. Full version with all alert categories launches in Phase 1.
          </p>
        </div>
      </section>
    </div>
  );
}

function AgentCard({
  name, icon: Icon, mission, schedule, phase, experimental,
}: {
  name: string;
  icon: any;
  mission: string;
  schedule: string;
  phase: string;
  experimental?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      experimental
        ? 'bg-purple-50/60 dark:bg-purple-900/10 border-purple-300 dark:border-purple-700'
        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${experimental ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{name}</h3>
      </div>
      <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 leading-relaxed">{mission}</p>
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {schedule}
        </span>
        <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
          experimental
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {phase}
        </span>
      </div>
    </div>
  );
}
