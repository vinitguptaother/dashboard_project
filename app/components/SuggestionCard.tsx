'use client';

/**
 * SuggestionCard — Koyfin × Aceternity reskin
 * ──────────────────────────────────────────────────────────────────
 * The single, reusable suggestion card standard.
 *
 * MASTER_PLAN §6 defines the template used across:
 *   • Today tab (full cards)
 *   • Dashboard top-3 preview (compact mode)
 *   • Paper Trading (full cards)
 *   • Search AI recommendations (full cards)
 *   • Bell notifications (compact mode)
 *
 * Reskin goals:
 *   - Stacked surface (var(--bg-1)) instead of flat tint
 *   - Priority colors via top-edge gradient accent
 *   - Spotlight hover (Aceternity-style cursor follower)
 *   - Smooth enter/exit via motion
 */

import { useRef, useState, type ReactElement, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  symbol?: string;
  action?: 'BUY' | 'SELL' | 'ACCUMULATE';
  entryPrice?: number;
  stopLoss?: number;
  target?: number;
  confidence?: number;
  riskReward?: string;

  why?: string;
  risks?: string[];

  impact?: string;

  priority: SuggestionPriority;
  source: SuggestionSource;
  createdAt?: string;
  deadline?: string;

  onAccept?: () => Promise<void> | void;
  onReject?: () => Promise<void> | void;
  onDetails?: () => void;
  onAcknowledge?: () => Promise<void> | void;
  onDismiss?: () => Promise<void> | void;

  compact?: boolean;
}

interface PriorityStyle {
  color: string;
  bgTint: string;
  gradient: string;
  dot: string;
  label: string;
  glow: string;
}

const PRIORITY_STYLES: Record<SuggestionPriority, PriorityStyle> = {
  URGENT: {
    color: 'var(--down)',
    bgTint: 'rgba(240, 74, 74, 0.05)',
    gradient: 'linear-gradient(90deg, var(--down) 0%, #FF7A1A 100%)',
    dot: '●',
    label: 'URGENT',
    glow: 'var(--down-glow)',
  },
  HIGH: {
    color: 'var(--warn)',
    bgTint: 'rgba(245, 166, 35, 0.04)',
    gradient: 'linear-gradient(90deg, var(--warn) 0%, #FFCA4C 100%)',
    dot: '●',
    label: 'HIGH',
    glow: 'var(--warn-glow)',
  },
  MEDIUM: {
    color: 'var(--up)',
    bgTint: 'rgba(38, 208, 124, 0.04)',
    gradient: 'linear-gradient(90deg, var(--up) 0%, var(--accent) 100%)',
    dot: '●',
    label: 'MEDIUM',
    glow: 'var(--up-glow)',
  },
  LOW: {
    color: 'var(--text-3)',
    bgTint: 'transparent',
    gradient: 'linear-gradient(90deg, var(--border-emphasis) 0%, var(--border-default) 100%)',
    dot: '○',
    label: 'LOW',
    glow: 'transparent',
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
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--spot-x', `${x}%`);
    el.style.setProperty('--spot-y', `${y}%`);
  };

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

  const actionBadgeCls =
    action === 'BUY'
      ? 'bg-[rgba(38,208,124,0.12)] text-[var(--up)] border border-[rgba(38,208,124,0.35)]'
      : action === 'SELL'
        ? 'bg-[rgba(240,74,74,0.12)] text-[var(--down)] border border-[rgba(240,74,74,0.35)]'
        : 'bg-[rgba(62,130,247,0.12)] text-[var(--accent)] border border-[rgba(62,130,247,0.35)]';

  const padCls = compact ? 'p-3' : 'p-4';
  const titleCls = compact
    ? 'text-sm font-semibold text-[var(--text-1)]'
    : 'text-base font-semibold text-[var(--text-1)]';
  const descCls = compact
    ? 'text-xs text-[var(--text-2)] line-clamp-2'
    : 'text-sm text-[var(--text-2)]';

  const hasAnyAction = Boolean(
    onAccept || onReject || onDetails || onAcknowledge || onDismiss,
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        ref={cardRef as any}
        data-suggestion-id={id}
        onMouseMove={handleMove}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`suggest-card relative overflow-hidden rounded-lg ${padCls}`}
        style={{
          background: `${pStyle.bgTint}, var(--bg-1)` as any,
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--border-subtle)',
          ['--suggest-glow' as string]: pStyle.glow,
          ['--suggest-gradient' as string]: pStyle.gradient,
        }}
      >
        {/* Priority gradient top edge (2px) */}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: pStyle.gradient }}
        />

        {/* Spotlight hover overlay (Aceternity-style) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 suggest-spot"
          style={{
            background: `radial-gradient(circle 240px at var(--spot-x, 50%) var(--spot-y, 0%), var(--suggest-glow), transparent 70%)`,
          }}
        />

        {/* Content layer sits above overlays */}
        <div className="relative z-10">
          {/* Header: priority + source + age + deadline */}
          <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
            <span
              className="font-semibold uppercase tracking-wider flex items-center gap-1"
              style={{ color: pStyle.color }}
            >
              <span aria-hidden>{pStyle.dot}</span>
              {pStyle.label}
            </span>
            <span className="text-[var(--text-3)]">·</span>
            <span className="flex items-center gap-1 text-[var(--text-2)]">
              <SourceIcon className="w-3 h-3" />
              {sStyle.label}
            </span>
            {createdAt && (
              <>
                <span className="text-[var(--text-3)]">·</span>
                <span className="text-[var(--text-3)] font-mono-nums">{fmtAgo(createdAt)}</span>
              </>
            )}
            {deadline && (
              <>
                <span className="text-[var(--text-3)]">·</span>
                <span className="text-[var(--text-2)] flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {deadline}
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={titleCls}>
              {symbol && (
                <span className="font-mono mr-2 text-[var(--text-1)]">{symbol}</span>
              )}
              {title}
            </h3>
            {action && (
              <span
                className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${actionBadgeCls}`}
              >
                {action}
              </span>
            )}
          </div>

          {/* Description */}
          {description && <p className={`${descCls} mb-2`}>{description}</p>}

          {/* Trade numbers line */}
          {hasTradeFields && tradeLineParts.length > 0 && (
            <div className="text-xs font-mono-nums text-[var(--text-1)] bg-[var(--bg-2)] rounded px-2 py-1.5 mb-2 border border-[var(--border-subtle)]">
              {tradeLineParts.join(' · ')}
            </div>
          )}

          {/* Why / Risks / Impact */}
          {!compact && why && (
            <div className="text-xs text-[var(--text-2)] bg-[var(--bg-2)] rounded px-2 py-1.5 mb-2 border border-[var(--border-subtle)]">
              <strong className="text-[var(--text-1)]">Why: </strong>
              {why}
            </div>
          )}

          {!compact && risks && risks.length > 0 && (
            <div className="text-xs text-[var(--text-2)] bg-[var(--bg-2)] rounded px-2 py-1.5 mb-2 border border-[var(--border-subtle)]">
              <strong className="text-[var(--text-1)]">Risks:</strong>
              <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                {risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {!compact && impact && (
            <div className="text-xs text-[var(--text-3)] bg-[var(--bg-2)] rounded px-2 py-1.5 mb-2 border border-[var(--border-subtle)]">
              <strong className="text-[var(--text-1)]">Impact: </strong>
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--up)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-inverse)] transition-all"
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--down)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--bg-2)] hover:bg-[var(--bg-3)] border border-[var(--border-default)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-2)] transition-all"
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--bg-2)] hover:bg-[var(--bg-3)] border border-[var(--border-default)] text-[var(--text-1)] transition-all ml-auto"
                >
                  <Eye className="w-3 h-3" />
                  Details
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .suggest-card:hover .suggest-spot {
            opacity: 1;
          }
          .suggest-card:hover {
            border-color: var(--border-default);
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
