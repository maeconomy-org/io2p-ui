import { describe, it, expect } from 'vitest'

import en from '@/messages/en.json'
import nl from '@/messages/nl.json'

import {
  canCascade,
  familyOf,
  familyOfBundle,
  itemCapRefusal,
  pairCapRefusal,
  pinPermissions,
  shareCapRefusal,
} from '@/app/shares/utils/share-rules'

const res = (
  type: 'object' | 'process' | 'formula' | 'constant' | 'template'
) => ({ type }) as const

describe('familyOf', () => {
  it('puts objects and processes in the data family', () => {
    expect(familyOf('object')).toBe('data')
    expect(familyOf('process')).toBe('data')
  })

  it('puts the three read-share-only types in the library family', () => {
    expect(familyOf('formula')).toBe('library')
    expect(familyOf('constant')).toBe('library')
    expect(familyOf('template')).toBe('library')
  })
})

describe('familyOfBundle', () => {
  it('is null while the bundle is empty, so neither side is locked yet', () => {
    expect(familyOfBundle([])).toBeNull()
  })

  it('locks to whatever the FIRST pick was', () => {
    expect(familyOfBundle([res('template')])).toBe('library')
    expect(familyOfBundle([res('process')])).toBe('data')
  })
})

describe('canCascade', () => {
  it('allows an all-objects bundle', () => {
    expect(canCascade([res('object'), res('object')])).toBe(true)
  })

  it('refuses as soon as one process is in — a process has no descendants', () => {
    expect(canCascade([res('object'), res('process')])).toBe(false)
  })

  // The bug the old `!hasProcess` check had: a library bundle contains no process, so it read as
  // cascadeable and offered a checkbox the node would reject.
  it('refuses a library bundle even though it contains no process', () => {
    expect(canCascade([res('formula')])).toBe(false)
    expect(canCascade([res('constant'), res('template')])).toBe(false)
  })

  it('refuses an empty bundle — there is nothing to cascade over', () => {
    expect(canCascade([])).toBe(false)
  })
})

describe('pinPermissions', () => {
  const members = [
    { userId: 'anna', permission: 'write' },
    { userId: 'bob', permission: 'read' },
  ]

  it('leaves a data bundle exactly as authored', () => {
    expect(pinPermissions(members, 'data')).toBe(members)
  })

  it('leaves an empty bundle alone — no family, no rule to apply yet', () => {
    expect(pinPermissions(members, null)).toBe(members)
  })

  /**
   * The order that breaks a control-only guard: add someone at `write`, THEN drop a formula in.
   * The select is disabled from that point on, but the staged `write` is already there — and it is
   * what Save would have sent.
   */
  it('pins every member to read once the bundle is library', () => {
    expect(pinPermissions(members, 'library')).toEqual([
      { userId: 'anna', permission: 'read' },
      { userId: 'bob', permission: 'read' },
    ])
  })

  it('does not clone a member that is already read', () => {
    const pinned = pinPermissions(members, 'library')
    expect(pinned[1]).toBe(members[1])
  })
})

/**
 * The node's bundle caps, mirrored here so the form can name what is wrong before the request
 * does. Until this landed, an over-cap save produced the schema's own prose — `body/resources
 * must NOT have more than 200 items` — and nothing else on screen named a limit.
 *
 * The messages exist because a DIFFERENT number is already visible: the unsaved-changes bar counts
 * `resources + members`, so 200 items and 3 people reads "203" while the rule refusing the save is
 * 600 pairs. Every string names its units for that reason.
 */
describe('the bundle caps', () => {
  describe('itemCapRefusal', () => {
    it('allows a bundle exactly at the cap', () => {
      expect(itemCapRefusal(200, 200)).toBeNull()
    })

    it('names the resources when there are too many of them', () => {
      expect(itemCapRefusal(201, 1)).toEqual({
        key: 'shares.caps.tooManyResources',
        values: { max: 200, count: 201 },
      })
    })

    it('names the people when there are too many of them', () => {
      expect(itemCapRefusal(1, 201)).toEqual({
        key: 'shares.caps.tooManyMembers',
        values: { max: 200, count: 201 },
      })
    })

    // Both over: one message at a time, or the block under Save turns into a list.
    it('reports the resources first when both are over', () => {
      expect(itemCapRefusal(201, 201)?.key).toBe('shares.caps.tooManyResources')
    })
  })

  describe('pairCapRefusal', () => {
    it('allows a bundle exactly at the cap', () => {
      expect(pairCapRefusal(100, 5)).toBeNull()
    })

    // The PRODUCT, never the sum. 200 + 3 is 203 and is what the unsaved bar shows; 200 x 3 is
    // 600 and is what the node refuses. Confusing the two is the whole reason the copy names units.
    it('refuses on the product, which the visible change count is not', () => {
      expect(pairCapRefusal(200, 3)).toEqual({
        key: 'shares.caps.tooManyPairs',
        values: { max: 500, resources: 200, members: 3, pairs: 600 },
      })
    })

    // Neither count is over 200, so the item cap says nothing and only this catches it.
    it('catches a bundle no item cap would', () => {
      expect(itemCapRefusal(30, 30)).toBeNull()
      expect(pairCapRefusal(30, 30)?.values.pairs).toBe(900)
    })
  })
})

/**
 * Which rule applies to which write — and an earlier version of this file had BOTH of them
 * backwards, locking in a rule the node does not have.
 *
 * The pair cap applies to both: the node checks the resulting bundle on an edit exactly as on a
 * create, before it computes any delta. The item cap applies to a whole bundle only: an edit's
 * request carries a delta, and each of its arrays is capped separately, so a share already at the
 * limit can still be edited.
 */
describe('shareCapRefusal', () => {
  it('applies the pair cap to a whole-bundle write', () => {
    expect(shareCapRefusal('bundle', 200, 3)?.key).toBe(
      'shares.caps.tooManyPairs'
    )
  })

  // The case this got wrong: a 100-resource share given a sixth member is 600 pairs, and the node
  // refuses it on the resulting bundle. Save used to stay enabled and the user met the raw 422
  // that this whole feature exists to pre-empt.
  it('applies the pair cap to a delta write too', () => {
    expect(shareCapRefusal('delta', 100, 6)?.key).toBe(
      'shares.caps.tooManyPairs'
    )
  })

  // The other direction: 201 items is legal on an edit, because the request adds ONE. Refusing it
  // also refused the edit that would have removed resources to get back under the cap.
  it('applies no item cap to a delta write', () => {
    expect(shareCapRefusal('delta', 201, 1)).toBeNull()
  })

  // A duplicate posts a whole bundle exactly as a create does. Keying this on the sheet's mode
  // rather than on what the node writes is how that comes to be missed.
  it('applies the item cap to a whole-bundle write', () => {
    expect(shareCapRefusal('bundle', 201, 1)?.key).toBe(
      'shares.caps.tooManyResources'
    )
  })

  it('reports an item cap before a pair cap', () => {
    expect(shareCapRefusal('bundle', 201, 201)?.key).toBe(
      'shares.caps.tooManyResources'
    )
  })
})

// The keys are strings in the helper, so nothing but this checks they resolve. A missing one
// renders the raw key path under the Save button, which is where the user is already stuck.
describe('the cap message catalogue', () => {
  // Literal, not derived from the helper. Deriving them ran the helper while the describe body
  // was evaluating, so a helper that stopped refusing took the WHOLE FILE down at collection —
  // every unrelated test in it reported as "no tests" rather than one test failing.
  const keys = [
    'shares.caps.tooManyResources',
    'shares.caps.tooManyMembers',
    'shares.caps.tooManyPairs',
  ]

  it.each(keys)('resolves %s in both locales', (key) => {
    for (const locale of [en, nl]) {
      const value = key
        .split('.')
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)?.[part],
          locale
        )
      expect(value).toBeTypeOf('string')
    }
  })
})
