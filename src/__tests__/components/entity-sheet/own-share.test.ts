import { describe, it, expect } from 'vitest'
import type { RollupBucket } from 'io2p-client'

import {
  ownFactor,
  ownShare,
} from '@/components/entity-sheet/fields/rollup-line'

/**
 * The own/below split, and the multiplier resolution it has to mirror.
 *
 * The node scales each contributor by another property on its own object before summing.
 * Subtracting an UNSCALED own value from a SCALED total is the arithmetic bug these cover: it
 * reports a difference that is not there, on an object that may have nothing below it at all.
 *
 * `ownFactor` deliberately mirrors the node's four outcomes rather than simplifying them. Only an
 * ABSENT multiplier may default to one; the rest are present-but-unreadable, and defaulting those
 * would sum a contributor unscaled — the exact wrongness the feature exists to prevent.
 */

const bucket = (num: number, contributorCount: number): RollupBucket =>
  ({
    dimension: 'mass',
    unit: 'kg',
    num,
    unitCount: contributorCount,
    contributorCount,
  }) as RollupBucket

const kg = (num: number) => ({ num, unit: 'kg' })

describe('ownFactor', () => {
  it('is one when the rule names no multiplier at all', () => {
    expect(ownFactor(undefined)).toBe(1)
  })

  // "No quantity" and "quantity 1" say the same thing, so this is the one case that defaults.
  it('is one when the key is named but this object has no value for it', () => {
    expect(ownFactor([])).toBe(1)
  })

  it('is the number when exactly one value parsed', () => {
    expect(ownFactor([{ num: 5 }])).toBe(5)
    expect(ownFactor([{ num: 0 }])).toBe(0)
  })

  // Present but unreadable. Defaulting these to one is what summed a contributor unscaled.
  it('refuses a multiplier it cannot read', () => {
    expect(ownFactor([{ num: undefined }])).toBeNull() // "about ten"
    expect(ownFactor([{ num: 2 }, { num: 7 }])).toBeNull() // which one is the quantity?
    expect(ownFactor([{ num: -3 }])).toBeNull()
  })

  // The unit is IGNORED: the rolled-up key already carries the result unit, so a multiplier
  // scales magnitude only. "5" and "5 pcs" are the same quantity.
  it('ignores the multiplier’s own unit', () => {
    expect(ownFactor([{ num: 5 }])).toBe(ownFactor([{ num: 5, unit: 'pcs' }]))
  })
})

describe('ownShare', () => {
  it('splits an unmultiplied total exactly as before', () => {
    const share = ownShare(bucket(160, 2), [kg(100)])
    expect(share).toEqual({ own: 100, below: 60, onlyContributor: false })
  })

  it('says nothing when no own value matches the bucket’s unit', () => {
    expect(ownShare(bucket(160, 2), [{ num: 3, unit: 'm3' }])).toBeNull()
    expect(ownShare(bucket(160, 2), [])).toBeNull()
  })

  // The bug: own 100 at a quantity of 3 contributes 300, and calling it 100 put the other 200
  // "below" — a number the reader cannot find anywhere in the tree.
  it('scales the own value before subtracting', () => {
    const share = ownShare(bucket(360, 2), [kg(100)], [{ num: 3 }])
    expect(share).toEqual({ own: 300, below: 60, onlyContributor: false })
  })

  // The surprising half: a leaf IS the only contributor, so the total used to be suppressed as
  // "This object only" — hiding the 60 kg the rule was created to produce, next to a property
  // row reading 12 kg.
  it('keeps a multiplied leaf’s total instead of calling it the object itself', () => {
    const share = ownShare(bucket(60, 1), [kg(12)], [{ num: 5 }])
    expect(share).toEqual({ own: 60, below: 0, onlyContributor: false })
  })

  it('still suppresses an UNMULTIPLIED sole contributor', () => {
    const share = ownShare(bucket(12, 1), [kg(12)], [])
    expect(share?.onlyContributor).toBe(true)
  })

  // The node dropped this object's values entirely, so they are in neither the sum nor the
  // count — everything showing belongs to the subtree below.
  it('gives the whole total to the subtree when the node skipped this object', () => {
    const share = ownShare(bucket(48, 1), [kg(12)], [{ num: undefined }])
    expect(share).toEqual({ own: 0, below: 48, onlyContributor: false })
  })

  it('treats a zero multiplier as a real factor, not a missing one', () => {
    const share = ownShare(bucket(48, 2), [kg(12)], [{ num: 0 }])
    expect(share).toEqual({ own: 0, below: 48, onlyContributor: false })
  })

  // The own values are LIVE and the total is DERIVED, so between a write and its recompute the
  // object can hold more than the whole subtree reportedly contains. The subtraction stayed
  // silent about it and printed "500 kg here, -380 kg below" for up to a minute.
  it('claims no split while the total is behind the value', () => {
    expect(ownShare(bucket(120, 2), [kg(500)])).toBeNull()
    expect(ownShare(bucket(120, 2), [kg(100)], [{ num: 3 }])).toBeNull()
  })

  // The guard must not fire on an object that IS its own total. `0.1 + 0.2` is
  // 0.30000000000000004 in the browser and 0.3 on the node, so an unrounded comparison lands a
  // few ulps under zero and would suppress the split on exactly the rows where it is correct.
  it('survives float noise when the object is the whole total', () => {
    const share = ownShare(bucket(0.3, 2), [kg(0.1), kg(0.2)])
    expect(share).toEqual({ own: 0.3, below: 0, onlyContributor: true })
  })
})
