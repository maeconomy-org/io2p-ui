import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Semantic tones. **Colour encodes a DIMENSION, not decoration** — the moment every badge gets its
 * own colour for variety, colour stops carrying information and becomes noise the eye must filter.
 *
 * Two dimensions live here, and they are deliberately shaped differently so they stay tellable apart
 * when both appear on one row (which they do, on `/shares`):
 *
 * - **PERMISSIONS are ORDINAL** — `read → write → share → admin` is a ladder, so they walk COOL to
 *   WARM: neutral → cool → warm → hot. Temperature is the encoding, which is why a rung's hue is
 *   never chosen for its own sake. (One hue deepening was tried first; at badge size the three
 *   tinted rungs were nearly indistinguishable.)
 * - **ENTITY TYPES are CATEGORICAL** — object/process/template/formula/constant are unrelated kinds,
 *   so they get distinct hues at equal weight, none of them a hue the ramp uses.
 *
 * Every pair is measured against WCAG AA (4.5:1) in BOTH modes by `badge.test.tsx`, not chosen by
 * eye — dark mode is where tinted palettes die, and the project's own `--chart-1` already fails
 * there at 2.98:1. An early solid `admin` measured **3.68:1 in dark**; the test is what caught it.
 *
 * Colour is never alone: every tone keeps its text label, so removing the colour loses nothing.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',

        // ── permissions: COOL → WARM (ordinal) ──
        // Temperature is the ladder: neutral → cool → warm → hot. A single hue deepening was tried
        // first and the three tinted rungs were nearly indistinguishable at badge size.
        // A VISIBLE border, unlike every neutral variant above (all `border-transparent`). The
        // bottom rung is neutral by design, and `--secondary` is the same lightness as slate-50 —
        // measured at 1.04:1, indistinguishable — so the ramp's first step is told apart by having
        // an edge at all, not by fill.
        read: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300',
        write:
          'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
        share:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
        // The top of the ladder is solid rather than tinted — the step in WEIGHT says "this is the
        // most" before the hue registers, and it is the one rung worth noticing across a table.
        admin:
          'border-transparent bg-rose-600 text-white dark:bg-rose-700 dark:text-white',

        // ── entity types: distinct hues, equal weight (categorical) ──
        // None of these is slate/sky/amber/rose: the ramp owns those, so a type can never be
        // mistaken for a permission level on a row that shows both.
        object:
          'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300',
        process:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
        template:
          'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300',
        formula:
          'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-300',
        constant:
          'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

/** io2p's five shareable resource types, in the order the nav presents them. */
export const ENTITY_TONES = [
  'object',
  'process',
  'template',
  'formula',
  'constant',
] as const

/** The permission ladder, weakest first. Order matters — it IS the ramp. */
export const PERMISSION_TONES = ['read', 'write', 'share', 'admin'] as const

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
