'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

import { cn } from '@/lib/utils'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card'

interface ConceptHintProps {
  /**
   * Announced to screen readers and used as the accessible name — the icon has
   * no text, so without this the control reads as an unlabelled button.
   * Phrase it as the thing being explained, e.g. "What is a share?".
   */
  label: string
  /** The explanation. One or two sentences; this is a definition, not a manual. */
  children: ReactNode
  className?: string
}

/**
 * An ⓘ that defines a word this app uses in its own way.
 *
 * The tours are events — whatever they teach is gone the moment they end, and
 * they only ever run for people who happened to be new on the day the concept
 * shipped. The vocabulary here (share, formula, constant, draft, parent,
 * deleted) is where the misunderstandings actually live, and it needs something
 * that is still on the screen on day 30.
 *
 * Radix's HoverCard opens on focus as well as hover, so this stays reachable by
 * keyboard rather than being a mouse-only affordance.
 */
export function ConceptHint({ label, children, className }: ConceptHintProps) {
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full',
            'text-muted-foreground/70 transition-colors hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
        >
          <Info className="h-4 w-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-sm leading-relaxed font-normal">
        {children}
      </HoverCardContent>
    </HoverCard>
  )
}
