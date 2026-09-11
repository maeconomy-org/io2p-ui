'use client'

import type { ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'

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
  /**
   * Rendered under the explanation, separated by a rule. Exists so a page can
   * offer "start the walkthrough" from inside the same ⓘ rather than parking a
   * second icon next to it — two adjacent mystery glyphs in a heading is worse
   * than one, and the walkthrough is the natural follow-on from the definition.
   */
  footer?: ReactNode
  /** Draws the dot. The caller owns what "unread" means and where it is stored. */
  unread?: boolean
  /**
   * Appended to the accessible name while `unread`, e.g. "Not read yet".
   *
   * A prop rather than an `sr-only` child, because `aria-label` on the button
   * OVERRIDES its inner content — an sr-only span inside would be silent, and
   * the dot would then convey its state by colour alone.
   */
  unreadLabel?: string
  onOpenChange?: (open: boolean) => void
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
export function ConceptHint({
  label,
  children,
  footer,
  unread = false,
  unreadLabel,
  onOpenChange,
  className,
}: ConceptHintProps) {
  return (
    <HoverCard openDelay={150} closeDelay={200} onOpenChange={onOpenChange}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={
            unread && unreadLabel ? `${label} — ${unreadLabel}` : label
          }
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center rounded-full',
            'text-muted-foreground/70 transition-colors hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
        >
          <HelpCircle className="h-4 w-4" />
          {/* Absolute, so appearing and clearing never move the heading. */}
          {unread && (
            <span
              aria-hidden="true"
              data-testid="concept-hint-unread"
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"
            />
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-sm leading-relaxed font-normal">
        {children}
        {footer && <div className="mt-3 border-t pt-3">{footer}</div>}
      </HoverCardContent>
    </HoverCard>
  )
}
