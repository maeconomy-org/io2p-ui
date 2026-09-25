import { describe, it, expect } from 'vitest'

import { round } from '@/lib/round'

/**
 * The node's frozen policy, mirrored because two processes have to agree on the twelfth digit.
 *
 * These moved twice: they began beside a local formula evaluator that the node now replaces, and
 * passed through the rollup card before landing here. The rule belongs to neither — it is numeric,
 * not presentational, and both callers only borrow it.
 */
describe('the node’s rounding policy', () => {
  it('applies 12 significant figures', () => {
    expect(round(0.1 + 0.2)).toBe(0.3)
  })

  it('counts significant figures, not decimal places', () => {
    expect(round(123456.789012345)).toBe(123456.789012)
  })

  it('leaves an exact value alone', () => {
    expect(round(42)).toBe(42)
  })
})
