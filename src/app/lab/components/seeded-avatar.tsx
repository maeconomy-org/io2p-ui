'use client'

import { cn } from '@/lib/utils'

/**
 * A deterministic "glass" avatar, generated locally.
 *
 * The look is DiceBear's `glass` style, reproduced rather than fetched: a flat seeded background
 * with two heavily blurred shapes over it in `screen` blend mode. That recipe is the whole trick —
 * the blur turns two hard shapes into a soft mesh gradient, and `screen` keeps it bright.
 *
 * Not the hosted URL, because that makes a third-party request part of a render path: every
 * avatar becomes something that can be slow, blocked or offline, and the seed — a user id —
 * leaves the network on every page view. For an app with mTLS auth advertising EU data residency
 * in its own feedback copy, that is a poor trade for a decorative shape.
 */
function hash(seed: string): number {
  let value = 2166136261
  for (let i = 0; i < seed.length; i++) {
    value ^= seed.charCodeAt(i)
    value = Math.imul(value, 16777619)
  }
  return Math.abs(value)
}

export function SeededAvatar({
  seed,
  label,
  square,
  className,
}: {
  seed: string
  /** Initials over the pattern. Omit for a pure shape. */
  label?: string
  /** Rounded square instead of a circle — for objects rather than people. */
  square?: boolean
  className?: string
}) {
  const h = hash(seed)
  const id = `glass-${h.toString(36)}`

  // One base hue, two accents pulled a seeded distance away. Kept in the same lightness band so
  // no seed can produce a muddy avatar or one that vanishes against the page.
  const base = h % 360
  const accentA = (base + 60 + (h % 60)) % 360
  const accentB = (base + 200 + ((h >> 4) % 80)) % 360

  // Blob placement, also seeded — this is what makes two people with similar hues still differ.
  const ax = 20 + ((h >> 2) % 60)
  const ay = 15 + ((h >> 5) % 55)
  const bx = 25 + ((h >> 8) % 55)
  const by = 30 + ((h >> 11) % 55)

  return (
    <span
      className={cn(
        'relative flex size-7 shrink-0 items-center justify-center overflow-hidden',
        square ? 'rounded-lg' : 'rounded-full',
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <defs>
          <filter
            id={`${id}-blur`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <rect width="100" height="100" fill={`hsl(${base} 72% 58%)`} />
        <g style={{ mixBlendMode: 'screen' }} opacity="0.75">
          <ellipse
            cx={ax}
            cy={ay}
            rx="42"
            ry="34"
            fill={`hsl(${accentA} 85% 62%)`}
            filter={`url(#${id}-blur)`}
          />
          <ellipse
            cx={bx + 30}
            cy={by + 20}
            rx="38"
            ry="44"
            fill={`hsl(${accentB} 85% 55%)`}
            filter={`url(#${id}-blur)`}
          />
        </g>
      </svg>
      {label && (
        <span className="relative text-[0.62em] font-semibold text-white drop-shadow">
          {label}
        </span>
      )}
    </span>
  )
}
