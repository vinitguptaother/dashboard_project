'use client';

/**
 * PostLossCooldownBanner — lighter-weight lock than DailyLossLockOverlay.
 *
 * BOT_BLUEPRINT item #16. Triggered when 2 consecutive losses occur.
 * Unlike DailyLossLock (full-page overlay), this is a top-of-screen banner
 * that lets the dashboard remain usable but visibly signals tilt state.
 *
 * The backend enforces the lock (auto-triggered inside /api/trade-journal/entry);
 * this banner surfaces it to the user + provides a clear-cooldown button
 * (no typed confirmation — cooldown is the lighter friction tier).
 */

import { useEffect, useState } from 'react';
import { Clock, Pause, X } from 'lucide-react';
import { useDailyLossBreaker } from '../hooks/useDailyLossBreaker';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PostLossCooldownBanner() {
  const { cooldownActive, cooldownMsRemaining, cooldownReason, clearCooldown, isLocked } = useDailyLossBreaker();
  const [remaining, setRemaining] = useState(cooldownMsRemaining);
  const [clearing, setClearing] = useState(false);

  // Tick every second while cooldown is active
  useEffect(() => {
    if (!cooldownActive) return;
    setRemaining(cooldownMsRemaining);
    const iv = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [cooldownActive, cooldownMsRemaining]);

  // Don't show if full daily-loss lock is active (that overlay takes precedence)
  if (!cooldownActive || isLocked) return null;

  const handleClear = async () => {
    setClearing(true);
    await clearCooldown('Manual clear from banner');
    setClearing(false);
  };

  return (
    <div className="fixed top-[48px] left-0 right-0 z-[5000] bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
        <Pause className="w-4 h-4 shrink-0" />
        <div className="flex-1 text-sm font-medium">
          <strong>Post-Loss Cooldown</strong>
          <span className="ml-2 font-normal text-amber-100">
            {cooldownReason || 'New trade entries paused to break tilt patterns.'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-600/50 rounded-md px-2 py-1">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono-nums font-bold text-sm">{formatCountdown(remaining)}</span>
        </div>
        <button
          onClick={handleClear}
          disabled={clearing}
          className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
          title="Clear cooldown (logged)"
        >
          <X className="w-3 h-3" />
          {clearing ? 'Clearing…' : 'Clear'}
        </button>
      </div>
    </div>
  );
}
