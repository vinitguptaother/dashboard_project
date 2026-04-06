// backend/utils/marketHours.js
// Single source of truth for NSE/BSE market state.
// Used by: backend crons, AI analysis, /api/market-status endpoint.
//
// States:
//   OPEN            — Mon-Fri 9:15-15:30 IST, not a holiday
//   PRE_OPEN        — Mon-Fri 9:00-9:15 IST (pre-open session)
//   POST_CLOSE      — Mon-Fri after 15:30 IST, before midnight
//   CLOSED_WEEKEND  — Sat/Sun
//   CLOSED_HOLIDAY  — NSE trading holiday (weekday)
//   CLOSED_EARLY    — Before 9:00 IST on a trading weekday
//
// All time math is done in IST (Asia/Kolkata, UTC+5:30) regardless of server TZ.

const IST_OFFSET_MINUTES = 5 * 60 + 30; // +330

/**
 * Convert any Date to an object with IST calendar fields (year, month, day, hour, min, dayOfWeek).
 * This avoids relying on server timezone or Intl (which is slow and has edge cases).
 */
function toIST(date) {
  // date.getTime() is already UTC-based ms since epoch (timezone-independent).
  // Add IST offset → read .getUTC*() to pull wall-clock IST fields.
  const istMs = date.getTime() + IST_OFFSET_MINUTES * 60000;
  const d = new Date(istMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1, // 1-12
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    dayOfWeek: d.getUTCDay(), // 0 = Sun, 6 = Sat
    ymd: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    minutesOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/**
 * Build a Date representing a specific IST wall-clock moment (YYYY-MM-DD at HH:MM IST).
 */
function istDate(year, month, day, hour, minute) {
  // Construct as UTC then subtract IST offset → gives the correct absolute instant.
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MINUTES * 60000);
}

/**
 * Is `ymd` (YYYY-MM-DD) in the holiday list? Returns the holiday name or null.
 * holidayList: array of { date: 'YYYY-MM-DD', name: string }
 */
function findHoliday(ymd, holidayList) {
  if (!Array.isArray(holidayList)) return null;
  const h = holidayList.find(x => x && x.date === ymd);
  return h ? h.name : null;
}

/**
 * Get the next trading day (skipping weekends + holidays), starting from `fromYMD`.
 * Returns { year, month, day, ymd }.
 */
function nextTradingDay(fromDate, holidayList) {
  let d = new Date(fromDate.getTime());
  for (let i = 0; i < 30; i++) {
    const ist = toIST(d);
    const isWeekend = ist.dayOfWeek === 0 || ist.dayOfWeek === 6;
    const holiday = findHoliday(ist.ymd, holidayList);
    if (!isWeekend && !holiday) {
      return { year: ist.year, month: ist.month, day: ist.day, ymd: ist.ymd };
    }
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  // Safety fallback
  const ist = toIST(d);
  return { year: ist.year, month: ist.month, day: ist.day, ymd: ist.ymd };
}

/**
 * Core function — returns everything callers need about current market state.
 *
 * @param {Date} [now=new Date()]  Current time (injected for tests)
 * @param {Array} [holidayList=[]] [{ date: 'YYYY-MM-DD', name: string }]
 * @returns {Object} state info
 */
function getMarketState(now = new Date(), holidayList = []) {
  const ist = toIST(now);
  const { dayOfWeek, minutesOfDay, ymd } = ist;

  const OPEN_MIN = 9 * 60 + 15;   // 9:15
  const CLOSE_MIN = 15 * 60 + 30; // 15:30
  const PRE_OPEN_MIN = 9 * 60;    // 9:00

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const holidayName = findHoliday(ymd, holidayList);

  let state;
  let isOpen = false;

  if (isWeekend) {
    state = 'CLOSED_WEEKEND';
  } else if (holidayName) {
    state = 'CLOSED_HOLIDAY';
  } else if (minutesOfDay >= OPEN_MIN && minutesOfDay < CLOSE_MIN) {
    state = 'OPEN';
    isOpen = true;
  } else if (minutesOfDay >= PRE_OPEN_MIN && minutesOfDay < OPEN_MIN) {
    state = 'PRE_OPEN';
  } else if (minutesOfDay >= CLOSE_MIN) {
    state = 'POST_CLOSE';
  } else {
    state = 'CLOSED_EARLY';
  }

  // Compute next open (absolute Date)
  let nextOpen;
  if (state === 'OPEN' || state === 'PRE_OPEN') {
    nextOpen = istDate(ist.year, ist.month, ist.day, 9, 15); // today 9:15 (OPEN → already open; PRE_OPEN → same day)
  } else if (state === 'CLOSED_EARLY') {
    // Today before 9:00 on a trading weekday
    nextOpen = istDate(ist.year, ist.month, ist.day, 9, 15);
  } else {
    // POST_CLOSE, WEEKEND, HOLIDAY → next trading day 9:15
    // Start search from tomorrow IST
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nt = nextTradingDay(tomorrow, holidayList);
    nextOpen = istDate(nt.year, nt.month, nt.day, 9, 15);
  }

  // Compute last close (absolute Date) — most recent 15:30 on a trading day
  let lastClose;
  if (state === 'OPEN' || state === 'PRE_OPEN' || state === 'CLOSED_EARLY') {
    // Markets haven't closed yet today → last close was previous trading day 15:30
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Walk backwards to find a trading day
    let d = yesterday;
    for (let i = 0; i < 15; i++) {
      const di = toIST(d);
      const isWk = di.dayOfWeek === 0 || di.dayOfWeek === 6;
      const hol = findHoliday(di.ymd, holidayList);
      if (!isWk && !hol) {
        lastClose = istDate(di.year, di.month, di.day, 15, 30);
        break;
      }
      d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    }
  } else if (state === 'POST_CLOSE') {
    lastClose = istDate(ist.year, ist.month, ist.day, 15, 30);
  } else {
    // Weekend / Holiday → walk backwards
    let d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (let i = 0; i < 15; i++) {
      const di = toIST(d);
      const isWk = di.dayOfWeek === 0 || di.dayOfWeek === 6;
      const hol = findHoliday(di.ymd, holidayList);
      if (!isWk && !hol) {
        lastClose = istDate(di.year, di.month, di.day, 15, 30);
        break;
      }
      d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  const minutesSinceClose = lastClose ? Math.max(0, Math.floor((now.getTime() - lastClose.getTime()) / 60000)) : null;
  const minutesUntilOpen = isOpen ? 0 : Math.max(0, Math.floor((nextOpen.getTime() - now.getTime()) / 60000));
  const minutesUntilClose = isOpen ? Math.max(0, (15 * 60 + 30) - minutesOfDay) : null;

  // Upcoming holiday (next 7 days) — useful for "Holiday tomorrow" hints
  let upcomingHoliday = null;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const di = toIST(d);
    const hol = findHoliday(di.ymd, holidayList);
    if (hol && i > 0) { // skip today
      upcomingHoliday = { date: di.ymd, name: hol, daysAway: i };
      break;
    }
  }

  return {
    state,
    isOpen,
    holidayName: holidayName || null,
    upcomingHoliday,
    istTime: `${String(ist.hour).padStart(2, '0')}:${String(ist.minute).padStart(2, '0')}`,
    istDate: ymd,
    nextOpen: nextOpen ? nextOpen.toISOString() : null,
    lastClose: lastClose ? lastClose.toISOString() : null,
    minutesSinceClose,
    minutesUntilOpen,
    minutesUntilClose,
  };
}

/**
 * Convenience — plain boolean. Good for cron guards.
 */
function isMarketOpen(now = new Date(), holidayList = []) {
  return getMarketState(now, holidayList).isOpen;
}

/**
 * Build a short human-readable summary for injection into AI prompts.
 * Example:
 *   "MARKET STATE: CLOSED (Weekend). Last close: 2026-04-03 15:30 IST (2 days ago). Next open: 2026-04-06 09:15 IST. Live prices shown are end-of-day, not real-time."
 */
function marketStateForPrompt(state) {
  const labelMap = {
    OPEN: 'OPEN',
    PRE_OPEN: 'PRE-OPEN SESSION (9:00–9:15 IST, limited orders)',
    POST_CLOSE: 'CLOSED (after market hours)',
    CLOSED_WEEKEND: 'CLOSED (Weekend)',
    CLOSED_HOLIDAY: `CLOSED (NSE Holiday${state.holidayName ? ': ' + state.holidayName : ''})`,
    CLOSED_EARLY: 'CLOSED (before market open)',
  };
  const label = labelMap[state.state] || state.state;
  const parts = [`MARKET STATE: ${label}`];
  if (state.isOpen && state.minutesUntilClose != null) {
    const h = Math.floor(state.minutesUntilClose / 60);
    const m = state.minutesUntilClose % 60;
    parts.push(`Closes in ${h}h ${m}m.`);
  } else {
    if (state.lastClose) {
      const hoursAgo = state.minutesSinceClose != null ? Math.floor(state.minutesSinceClose / 60) : null;
      parts.push(`Last close: ${new Date(state.lastClose).toISOString().slice(0, 16).replace('T', ' ')} UTC${hoursAgo != null ? ` (~${hoursAgo}h ago)` : ''}.`);
    }
    if (state.nextOpen) {
      parts.push(`Next open: ${new Date(state.nextOpen).toISOString().slice(0, 16).replace('T', ' ')} UTC.`);
    }
    parts.push('Prices shown are end-of-day or stale; do not describe them as "currently trading".');
  }
  if (state.upcomingHoliday) {
    parts.push(`Upcoming holiday: ${state.upcomingHoliday.name} in ${state.upcomingHoliday.daysAway} day(s).`);
  }
  return parts.join(' ');
}

module.exports = {
  getMarketState,
  isMarketOpen,
  marketStateForPrompt,
  toIST,
  istDate,
};
