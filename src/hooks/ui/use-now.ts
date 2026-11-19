'use client'

import { useState } from 'react'

/**
 * A timestamp captured once, when the component mounts, and stable for its
 * lifetime.
 *
 * Calling `Date.now()` during render makes the output depend on when React
 * happened to render — the same component can produce different markup on two
 * consecutive passes with identical props, which is what `react-hooks/purity`
 * flags. It also breaks hydration, since the server and client read the clock
 * at different instants.
 *
 * This is for values derived from "roughly now" (an age, an overdue flag, a
 * countdown). It deliberately does NOT tick: nothing here updated on a timer
 * before either — it recomputed on whatever renders happened to occur, which is
 * unpredictable rather than live. If a display genuinely needs to advance, add
 * an interval that sets state rather than reading the clock in render.
 */
export function useNow(): number {
  const [now] = useState(() => Date.now())
  return now
}
