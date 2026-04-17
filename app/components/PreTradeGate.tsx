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

import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Calculator } from 'lucide-react';

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
  /** Pre-computed max loss at this size. For options strategies, pass from payoff.maxLoss.
   *  For stock trades, caller can omit and component will compute (entry - SL) * qty. */
  maxLossAtSize?: number | string; // can be 'Unlimited'
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: (checklistId: string) => void; // caller fires the actual trade after this
  tradeContext: TradeContext;
  /** If provided, modal overrides its default "hard gate" warning with custom copy. */
  title?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

// Fetch capital + risk-per-trade from server so the calc uses the user's real rule.
function useRiskRule() {
  const [rule, setRule] = useState<{ capital: number; riskPerTradePct: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND_URL}/api/risk/settings`)
      .then(r => r.json())
      .then(j => { if (!cancelled && j.status === 'success' && j.data) {
        setRule({ capital: j.data.capital || 500000, riskPerTradePct: j.data.riskPerTrade || 1 });
      }})
      .catch(() => { /* keep null */ });
    return () => { cancelled = true; };
  }, []);
  return rule;
}

const CHECK_DEFS: { key: keyof Checks; label: string; help: string }[] = [
  { key: 'trendAligned',     label: 'Trend aligned with bias',          help: 'Higher-timeframe trend agrees with trade direction.' },
  { key: 'riskAcceptable',   label: 'Risk acceptable (within rule)',    help: 'Max loss at this size must be within per-trade risk rule. Auto-computed below.' },
  { key: 'stopLossDefined',  label: 'Stop-loss defined',                help: 'Explicit SL price — not "I\'ll exit if it feels wrong".' },
  { key: 'noMajorNewsRisk',  label: 'No major news risk (48h)',         help: 'No earnings / RBI / Fed / results in next 2 days.' },
  { key: 'capitalAvailable', label: 'Capital available',                help: 'Free capital covers this position + margins.' },
  { key: 'notOverexposed',   label: 'Not overexposed',                  help: 'Sector/correlation within rule (<40% / <25%).' },
];

function formatINR(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export default function PreTradeGate({ isOpen, onClose, onConfirmed, tradeContext, title }: Props) {
  const riskRule = useRiskRule();
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

  // ── Position sizing risk calc (BOT_BLUEPRINT item #14) ──────────────────
  // Computes the actual max loss at the requested size and compares to the rule.
  // If maxLossAtSize wasn't provided, derive from (entry-SL) × qty for stock-style trades.
  const riskCalc = useMemo(() => {
    if (!riskRule) return null;
    const { capital, riskPerTradePct } = riskRule;
    const ruleAmount = (capital * riskPerTradePct) / 100;

    let computedMaxLoss: number | 'Unlimited' | null = null;
    if (tradeContext.maxLossAtSize !== undefined) {
      if (typeof tradeContext.maxLossAtSize === 'string') {
        computedMaxLoss = tradeContext.maxLossAtSize === 'Unlimited' ? 'Unlimited' : null;
      } else {
        computedMaxLoss = Math.abs(tradeContext.maxLossAtSize);
      }
    } else if (
      tradeContext.intendedEntry &&
      tradeContext.intendedSL &&
      tradeContext.intendedQty
    ) {
      computedMaxLoss = Math.abs(tradeContext.intendedEntry - tradeContext.intendedSL) * tradeContext.intendedQty;
    }

    if (computedMaxLoss === null) return { capital, ruleAmount, riskPerTradePct, computable: false as const };

    const isUnlimited = computedMaxLoss === 'Unlimited';
    const amt = isUnlimited ? Infinity : (computedMaxLoss as number);
    const pctOfCapital = isUnlimited ? Infinity : (amt / capital) * 100;
    const violates = isUnlimited ? true : amt > ruleAmount;

    return { capital, ruleAmount, riskPerTradePct, computable: true as const, maxLoss: amt, isUnlimited, pctOfCapital, violates };
  }, [riskRule, tradeContext.maxLossAtSize, tradeContext.intendedEntry, tradeContext.intendedSL, tradeContext.intendedQty]);

  // Auto-sync the "riskAcceptable" check with the computed calc so user can't
  // manually tick "pass" when math says fail.
  useEffect(() => {
    if (!riskCalc || !riskCalc.computable) return;
    setChecks(prev => ({
      ...prev,
      riskAcceptable: riskCalc.violates ? 'fail' : 'pass',
    }));
  }, [riskCalc]);

  if (!isOpen) return null;

  const setCheck = (key: keyof Checks, state: CheckState) => {
    // Don't let the user manually override the auto-computed riskAcceptable
    if (key === 'riskAcceptable' && riskCalc?.computable) return;
    setChecks(prev => ({ ...prev, [key]: state }));
  };

  const passCount = Object.values(checks).filter(v => v === 'pass').length;
  const failCount = Object.values(checks).filter(v => v === 'fail').length;
  const naCount   = Object.values(checks).filter(v => v === 'na').length;
  const allPassed = passCount === 6;
  const anyFailed = failCount > 0;

  // HARD GATE: if position sizing rule is violated, block submit entirely.
  const riskHardBlocked = !!(riskCalc?.computable && riskCalc.violates);
  const canSubmit = naCount === 0 && !submitting && !riskHardBlocked;

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
          {/* Position Sizing auto-calc panel (BOT_BLUEPRINT #14) */}
          {riskCalc && (
            <div className={`p-3 rounded-lg border ${
              riskCalc.computable && riskCalc.violates
                ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                : riskCalc.computable
                  ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 bg-gray-50 dark:bg-gray-800'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Calculator className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Position Sizing — Risk Check
                </span>
              </div>
              {riskCalc.computable ? (
                <div className="text-[11px] text-gray-700 dark:text-gray-300 space-y-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Max loss at this size:</span>
                    <span className="font-mono-nums font-bold">
                      {riskCalc.isUnlimited ? 'Unlimited' : formatINR(riskCalc.maxLoss)}
                    </span>
                    {!riskCalc.isUnlimited && (
                      <span className="text-gray-500 dark:text-gray-400">
                        ({riskCalc.pctOfCapital.toFixed(2)}% of capital)
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Rule:</span>
                    <span className="font-mono-nums">
                      {riskCalc.riskPerTradePct}% of {formatINR(riskCalc.capital)} = <strong>{formatINR(riskCalc.ruleAmount)}</strong> max
                    </span>
                  </div>
                  <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                    {riskCalc.violates ? (
                      <span className="text-red-700 dark:text-red-400 font-semibold">
                        🚫 BLOCKED — {riskCalc.isUnlimited ? 'unlimited loss not allowed' : 'exceeds risk rule by ' + formatINR(riskCalc.maxLoss - riskCalc.ruleAmount)}. Reduce size or widen SL.
                      </span>
                    ) : (
                      <span className="text-green-700 dark:text-green-400 font-semibold">
                        ✓ Within risk rule
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                  Risk calc not available — provide entry + SL + qty OR maxLossAtSize to the modal.
                </div>
              )}
            </div>
          )}

          {CHECK_DEFS.map(def => {
            const current = checks[def.key];
            // Auto-computed risk check is read-only — reflect the computed state visually
            const isAutoComputed = def.key === 'riskAcceptable' && riskCalc?.computable;
            return (
              <div key={def.key} className="flex items-start gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {def.label}
                    {isAutoComputed && (
                      <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-gray-400">
                        auto
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{def.help}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setCheck(def.key, 'pass')}
                    disabled={isAutoComputed}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      current === 'pass'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                    } ${isAutoComputed ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => setCheck(def.key, 'fail')}
                    disabled={isAutoComputed}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      current === 'fail'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                    } ${isAutoComputed ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    Fail
                  </button>
                  <button
                    onClick={() => setCheck(def.key, 'na')}
                    disabled={isAutoComputed}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      current === 'na'
                        ? 'bg-gray-400 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    } ${isAutoComputed ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                  : riskHardBlocked
                    ? 'bg-red-600/40 text-white cursor-not-allowed'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              title={
                riskHardBlocked ? 'Blocked — position sizing exceeds risk rule' :
                naCount > 0 ? 'Set every check before proceeding' :
                allPassed ? 'Record + proceed' : 'Record anyway (some failed)'
              }
            >
              {submitting ? 'Recording…' :
               riskHardBlocked ? '🚫 Blocked — Reduce Size' :
               naCount > 0 ? `${naCount} unset` :
               allPassed ? 'Record + Proceed' : 'Record + Proceed Anyway'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
