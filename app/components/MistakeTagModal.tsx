'use client';

/**
 * MistakeTagModal — mandatory post-trade-close reflection modal.
 *
 * BOT_BLUEPRINT items #17 (Auto Journal) + #18 (Mistake Tagging).
 *
 * When a trade closes, this modal appears forcing user to:
 *   1. Tag the trade's mistake category (or "clean")
 *   2. Optional notes + lesson learned
 * Then POSTs to /api/trade-journal/entry which creates the enriched journal record.
 *
 * The calling flow must NOT finalize the trade close until this modal's
 * onConfirmed callback fires. That way every closed trade is guaranteed to
 * have a journal entry.
 */

import { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Zap, ShieldOff, RotateCw, TrendingDown, Clock, FileQuestion, Target } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

export type MistakeTag =
  | 'clean'
  | 'revenge'
  | 'fomo'
  | 'moved_sl'
  | 'oversized'
  | 'early_exit'
  | 'late_exit'
  | 'no_thesis'
  | 'ignored_plan'
  | 'other';

export interface TradeCloseContext {
  tradeType?: 'options' | 'stock' | 'realStock' | 'realOptions';
  tradeId?: string;
  checklistId?: string;
  underlying?: string;
  symbol?: string;
  strategyName?: string;
  side?: 'BUY' | 'SELL';
  entryPrice?: number;
  exitPrice?: number;
  entryAt?: string | Date;
  exitAt?: string | Date;
  qty?: number;
  pnl?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: (journalEntryId: string) => void;
  tradeContext: TradeCloseContext;
}

const TAG_DEFS: { key: MistakeTag; label: string; icon: any; desc: string; severity: 'good' | 'mild' | 'bad' }[] = [
  { key: 'clean',        label: 'Clean execution',    icon: CheckCircle2,  desc: 'Followed plan, no regrets',            severity: 'good' },
  { key: 'revenge',      label: 'Revenge trade',      icon: Zap,           desc: 'Entered to recoup an earlier loss',    severity: 'bad'  },
  { key: 'fomo',         label: 'FOMO entry',         icon: TrendingDown,  desc: 'Chased a move that was already going', severity: 'bad'  },
  { key: 'moved_sl',     label: 'Moved stop-loss',    icon: ShieldOff,     desc: 'Widened SL during trade',              severity: 'bad'  },
  { key: 'oversized',    label: 'Oversized position', icon: AlertTriangle, desc: 'Took more size than risk rule',         severity: 'bad'  },
  { key: 'early_exit',   label: 'Exited too early',   icon: Clock,         desc: 'Closed before target — cut winner',    severity: 'mild' },
  { key: 'late_exit',    label: 'Exited too late',    icon: Clock,         desc: 'Held past SL / target — let it run',   severity: 'mild' },
  { key: 'no_thesis',    label: 'No written thesis',  icon: FileQuestion,  desc: 'Couldn\'t articulate why at entry',    severity: 'mild' },
  { key: 'ignored_plan', label: 'Ignored plan',       icon: RotateCw,      desc: 'Deviated from setup rules',            severity: 'bad'  },
  { key: 'other',        label: 'Other',              icon: Target,        desc: 'Describe in notes',                    severity: 'mild' },
];

function formatINR(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export default function MistakeTagModal({ isOpen, onClose, onConfirmed, tradeContext }: Props) {
  const [selected, setSelected] = useState<MistakeTag | null>(null);
  const [notes, setNotes] = useState('');
  const [lesson, setLesson] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canSubmit = selected !== null && !submitting;
  const isWin = (tradeContext.pnl ?? 0) > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/trade-journal/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tradeContext,
          mistakeTag: selected,
          notes,
          lessonLearned: lesson,
          source: 'auto-on-close',
        }),
      });
      const json = await res.json();
      if (json.status !== 'success') {
        setError(json.message || 'Failed to save journal entry');
        return;
      }
      onConfirmed(json.data._id);
      // Reset for next use
      setSelected(null);
      setNotes('');
      setLesson('');
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">
              Closing trade — post-trade reflection
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Tag execution quality for quarterly rupee attribution. Honesty here = real improvement.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Trade summary */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {tradeContext.strategyName || 'Trade'}
            {tradeContext.underlying && ` · ${tradeContext.underlying}`}
            {tradeContext.symbol && ` · ${tradeContext.symbol}`}
            {tradeContext.qty ? ` · qty ${tradeContext.qty}` : ''}
          </span>
          <span className={`font-mono-nums font-bold ${isWin ? 'text-green-600 dark:text-green-400' : (tradeContext.pnl ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
            P&L: {formatINR(tradeContext.pnl ?? 0)}
          </span>
        </div>

        {/* Mistake tag grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            How did this trade go? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TAG_DEFS.map(def => {
              const Icon = def.icon;
              const isSelected = selected === def.key;
              const severityColor = def.severity === 'good'
                ? (isSelected ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-green-300')
                : def.severity === 'bad'
                ? (isSelected ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-red-300')
                : (isSelected ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-amber-300');
              const iconColor = def.severity === 'good' ? 'text-green-500' : def.severity === 'bad' ? 'text-red-500' : 'text-amber-500';

              return (
                <button
                  key={def.key}
                  onClick={() => setSelected(def.key)}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border-2 transition-colors text-left ${severityColor}`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{def.label}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{def.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Notes + Lesson */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="What happened during the trade?"
                className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Lesson learned (optional)
              </label>
              <textarea
                value={lesson}
                onChange={e => setLesson(e.target.value)}
                rows={3}
                placeholder="What would you do differently?"
                className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {selected ? (
              <>Tagged: <strong className="text-gray-700 dark:text-gray-300">{TAG_DEFS.find(t => t.key === selected)?.label}</strong></>
            ) : (
              'Select a tag to continue'
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
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Saving…' : 'Save & Close Trade'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
