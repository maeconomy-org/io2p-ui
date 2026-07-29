'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface FloatingActionBarProps {
  open: boolean
  /** Announced when the bar appears; it arrives without the user navigating to it. */
  label: string
  children: ReactNode
  className?: string
}

/**
 * A contextual action bar that floats over the content instead of sitting in the flow.
 *
 * The point is that appearing and disappearing costs NO layout shift — an inline bar pushes the
 * table or chart below it down the moment a selection or focus happens, which moves the very rows
 * the user was aiming at. Pinned to the VIEWPORT, so it stays reachable however far the content
 * below it scrolls.
 *
 * `z-40` deliberately sits below the `z-50` sheets and dialogs: opening a detail sheet from the bar
 * must cover it, not leave it floating over the overlay.
 *
 * `pointer-events-none` on the wrapper keeps the empty gutter click-through; the pill itself takes
 * pointer events back.
 *
 * Entrance only, no exit animation. An exit needs the bar to outlive the state that removed it, and
 * that extra mounted lifetime produced a flicker on the processes flow view that was never traced to
 * a cause. Leaving instantly is not as nice, but it is right every time.
 */
export function FloatingActionBar({
  open,
  label,
  children,
  className,
}: FloatingActionBarProps) {
  if (!open) return null

  return (
    <div
      role="region"
      aria-label={label}
      className="pointer-events-none fixed inset-x-0 bottom-12 z-40 flex justify-center px-4"
    >
      <div
        className={cn(
          'pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-border',
          'bg-card px-2 py-2 shadow-lg sm:gap-2 sm:px-3',
          'animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** Vertical rule between action groups inside the bar. */
export function FloatingActionBarSeparator() {
  return (
    <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
  )
}
