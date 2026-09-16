// The node writes a derived value's `data` WITHOUT a unit unless the recipe declared one, which is
// how a derived row came to read `20000` beside two authored `10 t` values. The canonical figure
// was already on screen — but only inside the ⚖ marker's tooltip.

import { describe, it, expect } from 'vitest'

import {
  canonicalText,
  derivedText,
} from '@/components/entity-sheet/fields/value-normalization'

/** Grouped the way `useFormatter().number` groups, so the assertions read like the screen. */
const grouped = (n: number) => n.toLocaleString('en-US')

describe('derivedText', () => {
  it('rebuilds an undeclared result from the canonical fields', () => {
    const shown = derivedText(
      { data: '20000', num: 20000, unit: 'kg' },
      { unitSource: 'inherited' },
      grouped
    )

    expect(shown).toBe('20,000 kg')
  })

  it('leaves a DECLARED result to the node, which already formatted it', () => {
    // `data` is "20 t" — the node converted out of canonical for display. Rebuilding it here
    // would need the units table and would be a second answer to a question already answered.
    const shown = derivedText(
      { data: '20 t', num: 20000, unit: 'kg' },
      { unitSource: 'declared' },
      grouped
    )

    expect(shown).toBeUndefined()
  })

  it('keeps a unitless result a bare number', () => {
    const shown = derivedText({ data: '7', num: 7 }, undefined, grouped)

    expect(shown).toBe('7')
  })

  it('declines on a value the normalizer never read', () => {
    // An error row: no num, no unit. The caller falls back to `data`, which the node left empty.
    const shown = derivedText({ data: '' }, undefined, grouped)

    expect(shown).toBeUndefined()
  })
})

describe('canonicalText', () => {
  it('is what the ⚖ tooltip and the row both print', () => {
    expect(canonicalText({ num: 20000, unit: 'kg' }, grouped)).toBe('20,000 kg')
  })

  it('omits the unit when there is none', () => {
    expect(canonicalText({ num: 7 }, grouped)).toBe('7')
  })
})
