'use client';

/**
 * SuggestionCard — the single, reusable suggestion card standard.
 *
 * MASTER_PLAN §6 defines the template used across:
 *   • Today tab (full cards)
 *   • Dashboard top-3 preview (compact mode)
 *   • Paper Trading (full cards)
 *   • Search AI recommendations (full cards)
 *   • Bell notifications (compact mode)
 *
 * Props are intentionally thin: show whatever is passed, hide what isn't.
 * Action buttons render only when their callback is supplied, so the same
 * card works for sentinel duties, bot trade proposals, and CA briefings.
 */

import { useState, type ReactElement } from 'react';
import {
  AlertTriangle,
  Sparkles,
  Bot,
  TrendingUp,
  Clock,
  Check,
  X,
  ChevronRight,
  Eye,
  Loader2,
} from 'lucide-react';

export type SuggestionPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SuggestionSource =
  | 'sentinel'
  | 'chief-analyst'
  | 'trading-bot'
  | 'pattern-miner'
  | 'user-duty';

export interface SuggestionCardProps {
  id?: string;
  title: string;
  description?: string;

  // Optional structured trade fields (rendered if present)
  symbol?: string;
  action?: 'BUY' | 'SELL' | 'ACCUMULATE';
  entryPrice?: number;
  stopLoss?: number;
  target?: number;
  confidence?: number; // 0-100
  riskReward?: string; // "1:2" etc.

  // Reasoning blocks
  why?: string;
  risks?: string[];

  // Impact if not acted on
  impact?: string;

  // Metadata
  priority: SuggestionPriority;
  source: SuggestionSource;
  createdAt?: string;
  deadline?: string;

  // Callbacks — each button renders only if its handler is provided
  onAccept?: () => Promise<void> | void;
  onReject?: () => Promise<void> | void;
  onDetails?: () => void;
  onAcknowledge?: () => Promise<void> | void;
  onDismiss?: () => Promise<void> | void;

  // Layout hint
  compact?: boolean;
}

interface PriorityStyle {
  color: string;
  bg: string;
  border: string;
  dot: string; // the small emoji/badge
  label: string;
}

const PRIORITY_STYLES: Record<SuggestionPriority, PriorityStyle> = {
  URGENT: {
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-300 dark:border-red-700',
    dot: '🔴',
    label: 'URGENT',
  },
  HIGH: {
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    dot: '🟡',
    label: 'HIGH',
  },
  MEDIUM: {
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
    dot: '🟢',
    label: 'MEDIUM',
  },
  LOW: {
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    dot: '⚪',
    label: 'LOW',
  },
};

type LucideIcon = (props: { className?: string }) => ReactElement;

interface SourceStyle {
  label: string;
  Icon: LucideIcon;
}

const SOURCE_STYLES: Record<SuggestionSource, SourceStyle> = {
  sentinel: { label: 'Sentinel', Icon: AlertTriangle as unknown as LucideIcon },
  'chief-analyst': { label: 'Chief Analyst', Icon: Sparkles as unknown as LucideIcon },
  'trading-bot': { label: 'Trading Bot', Icon: Bot as unknown as LucideIcon },
  'pattern-miner': { label: 'Pattern Miner', Icon: TrendingUp as unknown as LucideIcon },
  'user-duty': { label: 'Scheduled Task', Icon: Clock as unknown as LucideIcon },
};

function fmtAgo(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const secs = Math.round((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

function fmtINR(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function SuggestionCard(props: SuggestionCardProps): ReactElement {
  const {
    id,
    title,
    description,
    symbol,
    action,
    entryPrice,
    stopLoss,
    target,
    confidence,
    riskReward,
    why,
    risks,
    impact,
    priority,
    source,
    createdAt,
    deadline,
    onAccept,
    onReject,
    onDetails,
    onAcknowledge,
    onDismiss,
    compact = false,
  } = props;

  const pStyle = PRIORITY_STYLES[priority];
  const sStyle = SOURCE_STYLES[source];
  const SourceIcon = sStyle.Icon;

  const [busy, setBusy] = useState<null | 'accept' | 'reject' | 'ack' | 'dismiss'>(null);

  const wrap = async (
    kind: 'accept' | 'reject' | 'ack' | 'dismiss',
    fn?: () => Promise<void> | void,
  ) => {
    if (!fn) return;
    try {
      setBusy(kind);
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const hasTradeFields =
    entryPrice !== undefined || stopLoss !== undefined || target !== undefined;

  const tradeLineParts: string[] = [];
  if (entryPrice !== undefined) tradeLineParts.push(`Entry ${fmtINR(entryPrice)}`);
  if (stopLoss !== undefined) tradeLineParts.push(`SL ${fmtINR(stopLoss)}`);
  if (target !== undefined) tradeLineParts.push(`Target ${fmtINR(target)}`);
  if (confidence !== undefined) tradeLineParts.push(`${Math.round(confidence)}% conf`);
  if (riskReward) tradeLineParts.push(`R:R ${riskReward}`);

  const actionBadgeColor =
    action === 'BUY'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : action === 'SELL'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';

  const padCls = compact ? 'p-3' : 'p-4';
  const titleCls = compact
    ? 'text-sm font-bold text-gray-900 dark:text-gray-100'
    : 'text-base font-bold text-gray-900 dark:text-gray-100';
  const descCls = compact
    ? 'text-xs text-gray-700 dark:text-gray-300 line-clamp-2'
    : 'text-sm text-gray-700 dark:text-gray-300';

  const hasAnyAction = Boolean(
    onAccept || onReject || onDetails || onAcknowledge || onDismiss,
  );

  return (
    <div
      data-suggestion-id={id}
      className={`rounded-xl border-2 ${pStyle.bg} ${pStyle.border} ${padCls} transition-shadow hover:shadow-md`}
    >
      {/* Header: priority + source + age + deadline */}
      <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
        <span className={`font-bold uppercase tracking-wider ${pStyle.color}`}>
          {pStyle.dot} {pStyle.label}
        </span>
        <span className="text-gray-400">·</span>
        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <SourceIcon className="w-3 h-3" />
          {sStyle.label}
        </span>
        {createdAt && (
          <>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500 dark:text-gray-400">{fmtAgo(createdAt)}</span>
          </>
        )}
        {deadline && (
          <>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600 dark:text-gray-400 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {deadline}
            </span>
          </>
        )}
      </div>

      {/* Title + optional symbol/action badge */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className={titleCls}>
          {symbol && (
            <span className="text-gray-900 dark:text-gray-100 font-mono mr-2">
              {symbol}
            </span>
          )}
          {title}
        </h3>
        {action && (
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${actionBadgeColor}`}
          >
            {action}
          </span>
        )}
      </div>

      {/* Description */}
      {description && <p className={`${descCls} mb-2`}>{description}</p>}

      {/* Trade numbers line */}
      {hasTradeFields && tradeLineParts.length > 0 && (
        <div
          className={`${
            compact ? 'text-[11px]' : 'text-xs'
          } font-mono text-gray-800 dark:text-gray-200 bg-white/70 dark:bg-black/30 rounded px-2 py-1.5 mb-2 border border-gray-200 dark:border-gray-700`}
        >
          {tradeLineParts.join(' · ')}
        </div>
      )}

      {/* Why / Risks / Impact — skipped in compact mode to save space */}
      {!compact && why && (
        <div className="text-xs text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-black/20 rounded px-2 py-1.5 mb-2 border border-gray-200 dark:border-gray-700">
          <strong className="text-gray-900 dark:text-gray-100">💡 Why: </strong>
          {why}
        </div>
      )}

      {!compact && risks && risks.length > 0 && (
        <div className="text-xs text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-black/20 rounded px-2 py-1.5 mb-2 border border-gray-200 dark:border-gray-700">
          <strong className="text-gray-900 dark:text-gray-100">⚠️ Risks:</strong>
          <ul className="list-disc list-inside mt-0.5 space-y-0.5">
            {risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {!compact && impact && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-black/20 rounded px-2 py-1.5 mb-2 border border-gray-200 dark:border-gray-700">
          <strong className="text-gray-900 dark:text-gray-100">Impact: </strong>
          {impact}
        </div>
      )}

      {/* Action buttons row */}
      {hasAnyAction && (
        <div className="flex flex-wrap gap-2 mt-2">
          {onAccept && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => wrap('accept', onAccept)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {busy === 'accept' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Accept
            </button>
          )}
          {onReject && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => wrap('reject', onReject)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {busy === 'reject' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
              Reject
            </button>
          )}
          {onAcknowledge && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => wrap('ack', onAcknowledge)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {busy === 'ack' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Acknowledge
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => wrap('dismiss', onDismiss)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 dark:text-gray-200 transition-colors"
            >
              {busy === 'dismiss' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
              Dismiss
            </button>
          )}
          {onDetails && (
            <button
              type="button"
              onClick={onDetails}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 transition-colors ml-auto"
            >
              <Eye className="w-3 h-3" />
              Details
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
