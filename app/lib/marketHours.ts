// app/lib/marketHours.ts
// Frontend mirror of backend/utils/marketHours.js — same logic, IST-based,
// used for UI labels and local throttling. Authoritative data comes from
// the backend /api/market-status endpoint (which also provides holidays).

export type MarketStateKind =
  | 'OPEN'
  | 'PRE_OPEN'
  | 'POST_CLOSE'
  | 'CLOSED_WEEKEND'
  | 'CLOSED_HOLIDAY'
  | 'CLOSED_EARLY';

export interface MarketState {
  state: MarketStateKind;
  isOpen: boolean;
  holidayName: string | null;
  upcomingHoliday: { date: string; name: string; daysAway: number } | null;
  istTime: string;   // "HH:MM"
  istDate: string;   // "YYYY-MM-DD"
  nextOpen: string | null;   // ISO
  lastClose: string | null;  // ISO
  minutesSinceClose: number | null;
  minutesUntilOpen: number;
  minutesUntilClose: number | null;
}

export interface Holiday { date: string; name: string; }

const IST_OFFSET_MINUTES = 5 * 60 + 30;

function toIST(date: Date) {
  const istMs = date.getTime() + IST_OFFSET_MINUTES * 60000;
  const d = new Date(istMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    dayOfWeek: d.getUTCDay(),
    ymd: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

function istDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MINUTES * 60000);
}

function findHoliday(ymd: string, list: Holiday[]): string | null {
  const h = list.find(x => x && x.date === ymd);
  return h ? h.name : null;
}

function nextTradingDay(fromDate: Date, list: Holiday[]) {
  let d = new Date(fromDate.getTime());
  for (let i = 0; i < 30; i++) {
    const ist = toIST(d);
    const isWk = ist.dayOfWeek === 0 || ist.dayOfWeek === 6;
    const hol = findHoliday(ist.ymd, list);
    if (!isWk && !hol) return { year: ist.year, month: ist.month, day: ist.day };
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  const ist = toIST(d);
  return { year: ist.year, month: ist.month, day: ist.day };
}

export function getMarketState(now: Date = new Date(), holidays: Holiday[] = []): MarketState {
  const ist = toIST(now);
  const { dayOfWeek, minutesOfDay, ymd } = ist;
  const OPEN_MIN = 9 * 60 + 15;
  const CLOSE_MIN = 15 * 60 + 30;
  const PRE_OPEN_MIN = 9 * 60;

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const holidayName = findHoliday(ymd, holidays);

  let state: MarketStateKind;
  let isOpen = false;
  if (isWeekend) state = 'CLOSED_WEEKEND';
  else if (holidayName) state = 'CLOSED_HOLIDAY';
  else if (minutesOfDay >= OPEN_MIN && minutesOfDay < CLOSE_MIN) { state = 'OPEN'; isOpen = true; }
  else if (minutesOfDay >= PRE_OPEN_MIN && minutesOfDay < OPEN_MIN) state = 'PRE_OPEN';
  else if (minutesOfDay >= CLOSE_MIN) state = 'POST_CLOSE';
  else state = 'CLOSED_EARLY';

  let nextOpen: Date;
  if (state === 'OPEN' || state === 'PRE_OPEN' || state === 'CLOSED_EARLY') {
    nextOpen = istDate(ist.year, ist.month, ist.day, 9, 15);
  } else {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nt = nextTradingDay(tomorrow, holidays);
    nextOpen = istDate(nt.year, nt.month, nt.day, 9, 15);
  }

  let lastClose: Date | null = null;
  if (state === 'POST_CLOSE') {
    lastClose = istDate(ist.year, ist.month, ist.day, 15, 30);
  } else {
    let d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (let i = 0; i < 15; i++) {
      const di = toIST(d);
      const isWk = di.dayOfWeek === 0 || di.dayOfWeek === 6;
      const hol = findHoliday(di.ymd, holidays);
      if (!isWk && !hol) { lastClose = istDate(di.year, di.month, di.day, 15, 30); break; }
      d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  const minutesSinceClose = lastClose ? Math.max(0, Math.floor((now.getTime() - lastClose.getTime()) / 60000)) : null;
  const minutesUntilOpen = isOpen ? 0 : Math.max(0, Math.floor((nextOpen.getTime() - now.getTime()) / 60000));
  const minutesUntilClose = isOpen ? Math.max(0, (15 * 60 + 30) - minutesOfDay) : null;

  let upcomingHoliday: MarketState['upcomingHoliday'] = null;
  for (let i = 1; i < 7; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const di = toIST(d);
    const hol = findHoliday(di.ymd, holidays);
    if (hol) { upcomingHoliday = { date: di.ymd, name: hol, daysAway: i }; break; }
  }

  return {
    state, isOpen, holidayName: holidayName || null, upcomingHoliday,
    istTime: `${String(ist.hour).padStart(2, '0')}:${String(ist.minute).padStart(2, '0')}`,
    istDate: ymd,
    nextOpen: nextOpen ? nextOpen.toISOString() : null,
    lastClose: lastClose ? lastClose.toISOString() : null,
    minutesSinceClose, minutesUntilOpen, minutesUntilClose,
  };
}

/** Human-friendly label for UI badges. */
export function marketStateLabel(s: MarketState): string {
  switch (s.state) {
    case 'OPEN': {
      const m = s.minutesUntilClose ?? 0;
      return `MARKET OPEN · closes in ${Math.floor(m / 60)}h ${m % 60}m`;
    }
    case 'PRE_OPEN': return 'PRE-OPEN · opens in ' + s.minutesUntilOpen + 'm';
    case 'POST_CLOSE': return 'CLOSED · after hours';
    case 'CLOSED_WEEKEND': return 'CLOSED · weekend';
    case 'CLOSED_HOLIDAY': return `CLOSED · ${s.holidayName || 'Holiday'}`;
    case 'CLOSED_EARLY': return 'CLOSED · before open';
  }
}

/** Short chip-style label (max 14 chars). */
export function marketStateShort(s: MarketState): string {
  if (s.isOpen) return 'LIVE';
  if (s.state === 'PRE_OPEN') return 'PRE-OPEN';
  if (s.state === 'CLOSED_HOLIDAY') return 'HOLIDAY';
  if (s.state === 'CLOSED_WEEKEND') return 'WEEKEND';
  return 'CLOSED';
}
