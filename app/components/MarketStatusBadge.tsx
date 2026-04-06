'use client';
import { Circle, Calendar, Clock } from 'lucide-react';
import { useMarketStatus } from '../hooks/useMarketStatus';
import { marketStateLabel } from '../lib/marketHours';

/**
 * Global header pill showing NSE/BSE market state.
 * - Green pulsing dot when OPEN (with "closes in Xh Ym")
 * - Amber for PRE_OPEN
 * - Gray for POST_CLOSE / WEEKEND / holidays
 * - Extra hint line when a holiday is in the next 7 days
 */
export default function MarketStatusBadge() {
  const state = useMarketStatus();
  if (!state) {
    return (
      <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border border-gray-300 bg-gray-100 text-gray-400">
        <Circle className="w-2 h-2 animate-pulse" /> Checking…
      </span>
    );
  }

  const open = state.isOpen;
  const isPreOpen = state.state === 'PRE_OPEN';
  const isHoliday = state.state === 'CLOSED_HOLIDAY';

  // Color scheme per state
  let colorCls = '';
  if (open) colorCls = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500';
  else if (isPreOpen) colorCls = 'border-amber-500/50 bg-amber-500/10 text-amber-600';
  else if (isHoliday) colorCls = 'border-violet-500/50 bg-violet-500/10 text-violet-500';
  else colorCls = 'border-gray-400/50 bg-gray-500/10 text-gray-500';

  const tooltipLines = [
    marketStateLabel(state),
    `IST: ${state.istTime} (${state.istDate})`,
    state.lastClose ? `Last close: ${new Date(state.lastClose).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}` : '',
    !open && state.nextOpen ? `Next open: ${new Date(state.nextOpen).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}` : '',
    state.upcomingHoliday ? `Upcoming: ${state.upcomingHoliday.name} (${state.upcomingHoliday.daysAway}d)` : '',
  ].filter(Boolean).join('\n');

  // Compact label — prioritise the useful bit per state
  let label: string;
  if (open) {
    const m = state.minutesUntilClose ?? 0;
    label = `MARKET OPEN · ${Math.floor(m / 60)}h ${m % 60}m`;
  } else if (isPreOpen) {
    label = `PRE-OPEN · ${state.minutesUntilOpen}m`;
  } else if (isHoliday) {
    label = `HOLIDAY · ${state.holidayName}`;
  } else if (state.state === 'CLOSED_WEEKEND') {
    label = 'CLOSED · WEEKEND';
  } else {
    label = 'CLOSED · AFTER HOURS';
  }

  return (
    <span
      title={tooltipLines}
      className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${colorCls} max-w-[180px] truncate`}
    >
      {open ? <Circle className="w-2 h-2 fill-current animate-pulse" />
        : isHoliday ? <Calendar className="w-3 h-3" />
        : <Clock className="w-3 h-3" />}
      <span className="truncate">{label}</span>
    </span>
  );
}
