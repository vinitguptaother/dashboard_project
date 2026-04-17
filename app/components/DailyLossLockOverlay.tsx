'use client';

/**
 * DailyLossLockOverlay — full-page lock that appears when the Daily Loss
 * Circuit Breaker has auto-activated (usedPct >= 100%).
 *
 * BOT_BLUEPRINT item #15. Blocks new trades until midnight IST OR override.
 * Override requires typed "UNLOCK" (friction = compliance).
 *
 * Mount once at app root. Renders null when not locked.
 */

import { useEffect, useState } from 'react';
import { AlertOctagon, Clock, TrendingDown, Shield } from 'lucide-react';
import { useDailyLossBreaker } from '../hooks/useDailyLossBreaker';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatINR(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export default function DailyLossLockOverlay() {
  const { isLocked, totalPnL, usedPct, limit, capital, msUntilReset, override } = useDailyLossBreaker();
  const [countdown, setCountdown] = useState(msUntilReset);
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Tick the countdown every second while locked
  useEffect(() => {
    if (!isLocked) return;
    setCountdown(msUntilReset);
    const iv = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [isLocked, msUntilReset]);

  if (!isLocked) return null;

  const canOverride = confirmation === 'UNLOCK' && !submitting;

  const handleOverride = async () => {
    if (!canOverride) return;
    setSubmitting(true);
    setResult(null);
    const r = await override(reason);
    setResult(r);
    setSubmitting(false);
    if (r.success) {
      setConfirmation('');
      setReason('');
      // Overlay will auto-hide next poll (isLocked flips to false)
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-loss-title"
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border-2 border-red-500 overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center gap-3">
          <AlertOctagon className="w-8 h-8" />
          <div>
            <h2 id="daily-loss-title" className="text-xl font-bold">
              Daily Loss Limit Hit — Trading Locked
            </h2>
            <p className="text-red-100 text-sm mt-0.5">
              Your daily loss has breached the configured limit. Trading is blocked until midnight IST.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-3">
            <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
              <TrendingDown className="w-3.5 h-3.5" />
              Today&apos;s Loss
            </div>
            <div className="font-mono-nums text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {formatINR(totalPnL)}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {usedPct.toFixed(1)}% of daily limit ({formatINR(limit)} of {formatINR(capital)} capital)
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-3">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              Auto-unlock in
            </div>
            <div className="font-mono-nums text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {formatCountdown(countdown)}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Resets at midnight IST
            </div>
          </div>
        </div>

        {/* Override section */}
        <div className="px-6 pb-5 border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-start gap-2 mb-3">
            <Shield className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Override (not recommended)
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                Revenge trading after a loss is the #1 profit-killer. The lock exists for your protection.
                If you must override, every unlock is logged with a reason.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Type <span className="font-mono font-bold text-red-600">UNLOCK</span> to enable override
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                placeholder="UNLOCK"
                className="w-full text-sm font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-red-500"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Reason for override (optional, logged)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. need to close existing hedge position"
                className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>

            {result && (
              <div
                className={`text-xs font-medium px-3 py-2 rounded-md ${
                  result.success
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}
              >
                {result.message}
              </div>
            )}

            <button
              onClick={handleOverride}
              disabled={!canOverride}
              className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                canOverride
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Unlocking…' : 'Override and Resume Trading'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
