'use client';

import { useRef, useState, type ReactNode, type MouseEvent } from 'react';

/**
 * AnimatedBorderCard — Aceternity-style card with:
 *   1. Soft conic-gradient border that slowly rotates
 *   2. Cursor-follow radial spotlight on hover
 *   3. Stacked-surface interior (Koyfin density)
 *
 * Used for hero KPI cards, feature highlights, etc.
 */
type GlowColor = 'blue' | 'violet' | 'green' | 'red' | 'amber' | 'neutral';

interface AnimatedBorderCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: GlowColor;
  spotlightColor?: string;
  padding?: string;
}

const GLOW_MAP: Record<GlowColor, string> = {
  blue:    'rgba(62, 130, 247, 0.5)',
  violet:  'rgba(155, 76, 255, 0.5)',
  green:   'rgba(38, 208, 124, 0.5)',
  red:     'rgba(240, 74, 74, 0.5)',
  amber:   'rgba(245, 166, 35, 0.5)',
  neutral: 'rgba(138, 148, 166, 0.3)',
};

export default function AnimatedBorderCard({
  children,
  className = '',
  glowColor = 'blue',
  spotlightColor,
  padding,
}: AnimatedBorderCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const glow = GLOW_MAP[glowColor];
  const spotlight = spotlightColor ?? glow;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative rounded-lg overflow-hidden group transition-all duration-300 ${className}`}
      style={{
        background: `linear-gradient(var(--bg-1, #12151D), var(--bg-1, #12151D)) padding-box, conic-gradient(from 0deg, transparent, ${glow}, transparent 40%) border-box`,
        border: '1px solid transparent',
      }}
    >
      {/* Cursor-follow spotlight */}
      {hover && (
        <div
          className="pointer-events-none absolute inset-0 opacity-60 transition-opacity"
          style={{
            background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, ${spotlight}, transparent 55%)`,
          }}
        />
      )}
      {/* Content */}
      <div className="relative z-10" style={padding ? { padding } : undefined}>{children}</div>

      {/* Slowly rotating conic gradient via CSS animation */}
      <style jsx>{`
        div {
          animation: border-spin 8s linear infinite;
        }
        @keyframes border-spin {
          from { background-position: 0% 0%; }
          to { background-position: 100% 100%; }
        }
      `}</style>
    </div>
  );
}
