'use client';

/**
 * Pre-Trade Gate — Execution Checklist modal
 *
 * BOT_BLUEPRINT item #13. Phase 1 of 2:
 *   Phase 1 (this): records checklist completion before trade submission.
 *     Trade is NOT blocked — this captures adherence data.
 *   Phase 2 (next): backend trade POSTs require a valid recent checklistId
 *     with allPassed=true, else 403.
 *
 * Six checks (per blueprint):
 *   1. Trend aligned with bias
 *   2. Risk acceptable (≤1% of capital)
 *   3. Stop loss defined
 *   4. No major news risk (48h window)
 *   5. Capital available
 *   6. Not overexposed (sector/correlation)
 */

import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

type CheckState = 'pass' | 'fail' | 'na';

interface Checks {
  trendAligned: CheckState;
  riskAcceptable: CheckState;
  stopLossDefined: CheckState;
  noMajorNewsRisk: CheckState;
  capitalAvailable: CheckState;
  notOverexposed: CheckState;
}

interface TradeContext {
  source?: 'manual' | 'bot';
  botName?: string | null;
  underlying?: string;
  symbol?: string;
  strategyName?: string;
  intendedSide?: 'BUY' | 'SELL' | '';
  intendedQty?: number;
  intendedEntry?: number;
  intendedSL?: number;
  intendedTarget?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: (checklistId: string) => void; // caller fires the actual trade after this
  tradeContext: TradeContext;
  /** If provided, modal overrides its default "hard gate" warning with custom copy. */
  title?: string;
}

const CHECK_DEFS: { key: keyof Checks; label: string; help: string }[] = [
  { key: 'trendAligned',     label: 'Trend aligned with bias',          help: 'Higher-timeframe trend agrees with trade direction.' },
  { key: 'riskAcceptable',   label: 'Risk acceptable (≤1% of capital)', help: 'If SL hits, max loss is within per-trade risk rule.' },
  { key: 'stopLossDefined',  label: 'Stop-loss defined',                help: 'Explicit SL price — not "I\'ll exit if it feels wrong".' },
  { key: 'noMajorNewsRisk',  label: 'No major news risk (48h)',         help: 'No earnings / RBI / Fed / results in next 2 days.' },
  { key: 'capitalAvailable', label: 'Capital available',                help: 'Free capital covers this position + margins.' },
  { key: 'notOverexposed',   label: 'Not overexposed',                  help: 'Sector/correlation within rule (<40% / <25%).' },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

export default function PreTradeGate({ isOpen, onClose, onConfirmed, tradeContext, title }: Props) {
  const [checks, setChecks] = useState<Checks>({
    trendAligned: 'na',
    riskAcceptable: 'na',
    stopLossDefined: 'na',
    noMajorNewsRisk: 'na',
    capitalAvailable: 'na',
    notOverexposed: 'na',
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const setCheck = (key: keyof Checks, state: CheckState) => {
    setChecks(prev => ({ ...prev, [key]: state }));
  };

  const passCount = Object.values(checks).filter(v => v === 'pass').length;
  const failCount = Object.values(checks).filter(v => v === 'fail').length;
  const naCount   = Object.values(checks).filter(v => v === 'na').length;
  const allPassed = passCount === 6;
  const anyFailed = failCount > 0;

  const canSubmit = naCount === 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/trade-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: tradeContext.source || 'manual',
          botName: tradeContext.botName || null,
          underlying: tradeContext.underlying || '',
          symbol: tradeContext.symbol || '',
          strategyName: tradeContext.strategyName || '',
          intendedSide: tradeContext.intendedSide || '',
          intendedQty: tradeContext.intendedQty || 0,
          intendedEntry: tradeContext.intendedEntry || 0,
          intendedSL: tradeContext.intendedSL || 0,
          intendedTarget: tradeContext.intendedTarget || 0,
          checks,
          notes,
        }),
      });
      const json = await res.json();
      if (json.status !== 'success') {
        setError(json.message || 'Failed to record checklist');
        return;
      }
      onConfirmed(json.data._id);
      // Reset for next use
      setChecks({
        trendAligned: 'na', riskAcceptable: 'na', stopLossDefined: 'na',
        noMajorNewsRisk: 'na', capitalAvailable: 'na', notOverexposed: 'na',
      });
      setNotes('');
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">
              {title || 'Pre-Trade Checklist'}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Tick each item before entering. Tracked for adherence — Phase 2 will hard-block failed checklists.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Trade context summary */}
        {(tradeContext.underlying || tradeContext.symbol || tradeContext.strategyName) && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400">Trade:</span>{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {tradeContext.strategyName || 'Custom'}
              {tradeContext.underlying && ` · ${tradeContext.underlying}`}
              {tradeContext.symbol && ` · ${tradeContext.symbol}`}
              {tradeContext.intendedSide && ` · ${tradeContext.intendedSide}`}
              {tradeContext.intendedQty ? ` · qty ${tradeContext.intendedQty}` : ''}
            </span>
          </div>
        )}

        {/* Checklist */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {CHECK_DEFS.map(def => {
            const current = checks[def.key];
            return (
              <div key={def.key} className="flex items-start gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{def.label}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{def.help}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setCheck(def.key, 'pass')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      current === 'pass'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => setCheck(def.key, 'fail')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      current === 'fail'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    Fail
                  </button>
                  <button
                    onClick={() => setCheck(def.key, 'na')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      current === 'na'
                        ? 'bg-gray-400 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    N/A
                  </button>
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Notes (optional — thesis, catalyst, invalidation)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Why this trade? What invalidates it?"
            />
          </div>
        </div>

        {/* Status footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="font-mono-nums font-semibold text-green-600 dark:text-green-400">{passCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="font-mono-nums font-semibold text-red-600 dark:text-red-400">{failCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-mono-nums font-semibold text-gray-500 dark:text-gray-400">{naCount} unset</span>
            </span>
            {allPassed && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                All passed — good to go
              </span>
            )}
            {anyFailed && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                Proceed with caution ({failCount} failed)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-500">{error}</span>}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                canSubmit
                  ? allPassed
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              title={naCount > 0 ? 'Set every check before proceeding' : allPassed ? 'Record + proceed' : 'Record anyway (some failed)'}
            >
              {submitting ? 'Recording…' : naCount > 0 ? `${naCount} unset` : allPassed ? 'Record + Proceed' : 'Record + Proceed Anyway'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
