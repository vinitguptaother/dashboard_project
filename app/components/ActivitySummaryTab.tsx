'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Brain, Target, FlaskConical, TrendingUp, AlertTriangle, Settings, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

const TYPE_CONFIG: Record<string, { label: string; color: string; dotColor: string; icon: any }> = {
  screen_import:  { label: 'Screen Import',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',     dotColor: 'bg-blue-500',   icon: Download },
  ai_ranking:     { label: 'AI Ranking',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', dotColor: 'bg-purple-500', icon: Brain },
  trade_setup:    { label: 'Trade Setup',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',   dotColor: 'bg-green-500',  icon: Target },
  paper_trade:    { label: 'Paper Trade',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',   dotColor: 'bg-amber-500',  icon: FlaskConical },
  options_trade:  { label: 'Options',         color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',       dotColor: 'bg-cyan-500',   icon: TrendingUp },
  error:          { label: 'Error',           color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',           dotColor: 'bg-red-500',    icon: AlertTriangle },
  system:         { label: 'System',          color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',          dotColor: 'bg-gray-400',   icon: Settings },
};

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

function formatDetails(action: string, details: any): string {
  if (!details) return action;
  const parts: string[] = [];

  if (details.screenName) parts.push(`"${details.screenName}"`);
  if (details.count != null) parts.push(`${details.count} stocks`);
  if (details.symbol) parts.push(details.symbol);
  if (details.symbols && Array.isArray(details.symbols)) parts.push(details.symbols.slice(0, 4).join(', '));
  if (details.newCount != null) parts.push(`${details.newCount} new`);
  if (details.matched != null) parts.push(`${details.matched} matched`);
  if (details.underlying) parts.push(details.underlying);
  if (details.strategy) parts.push(details.strategy);
  if (details.action && details.action !== action) parts.push(details.action);
  if (details.entry != null) parts.push(`₹${Number(details.entry).toLocaleString('en-IN')}`);
  if (details.pnl != null) parts.push(`P&L: ₹${Number(details.pnl).toLocaleString('en-IN')}`);
  if (details.error) parts.push(details.error);

  return parts.length > 0 ? `${action} — ${parts.join(' · ')}` : action;
}

export default function ActivitySummaryTab() {
  const [date, setDate] = useState(todayIST());
  const [events, setEvents] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeDates, setActiveDates] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    fetchSummary();
  }, [date]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/activity/dates`)
      .then(r => r.json())
      .then(j => { if (j.status === 'success') setActiveDates(j.data); })
      .catch(() => {});
  }, []);

  async function fetchSummary() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/activity/summary?date=${date}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setEvents(json.data.events || []);
        setCounts(json.data.counts || {});
        setTotal(json.data.total || 0);
      }
    } catch (e) { console.error('Activity fetch error:', e); }
    finally { setLoading(false); }
  }

  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  }

  const isToday = date === todayIST();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Activity Summary</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">{total} events</span>
      </div>

      {/* Date picker row */}
      <div className="flex items-center gap-2">
        <button onClick={() => shiftDate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={date}
            max={todayIST()}
            onChange={e => setDate(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button onClick={() => shiftDate(1)} disabled={isToday} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-30">
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        {!isToday && (
          <button onClick={() => setDate(todayIST())} className="text-xs text-blue-600 hover:underline ml-1">Today</button>
        )}
      </div>

      {/* Count badges */}
      {total > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).map(([type, count]) => {
            const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.system;
            return (
              <span key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                {cfg.label}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No activity recorded for this date</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {events.map((event, i) => {
              const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.system;
              const Icon = cfg.icon;
              return (
                <div key={event._id || i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                  {/* Time */}
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono w-[70px] shrink-0 pt-0.5">
                    {formatTime(event.timestamp)}
                  </span>
                  {/* Dot + line */}
                  <div className="flex flex-col items-center shrink-0 pt-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`} />
                    {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className="w-3.5 h-3.5 text-gray-400" />
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {formatDetails(event.action, event.details)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active dates hint */}
      {activeDates.length > 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Recent activity: {activeDates.slice(0, 7).map(d => (
            <button key={d.date} onClick={() => setDate(d.date)} className={`mx-0.5 px-1.5 py-0.5 rounded ${d.date === date ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              {d.date.slice(5)} ({d.count})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
