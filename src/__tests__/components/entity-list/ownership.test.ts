import { describe, it, expect } from 'vitest'

import { canWriteLibraryItem } from '@/components/entity-list/ownership'

describe('canWriteLibraryItem', () => {
  it('lets the owner write', () => {
    expect(canWriteLibraryItem({ ownerUserId: 'u-1' }, 'u-1')).toBe(true)
  })

  it('refuses a row owned by someone else — library items are shared read-only', () => {
    expect(canWriteLibraryItem({ ownerUserId: 'u-2' }, 'u-1')).toBe(false)
  })

  it('refuses a built-in, whoever is asking', () => {
    expect(canWriteLibraryItem({ system: true }, 'u-1')).toBe(false)
    expect(
      canWriteLibraryItem({ system: true, ownerUserId: 'u-1' }, 'u-1')
    ).toBe(false)
  })

  it('allows a row with no resolved owner, which is the node failing to name one', () => {
    expect(canWriteLibraryItem({}, 'u-1')).toBe(true)
  })

  it('refuses while the viewer is unknown, rather than offering a write that 403s', () => {
    expect(canWriteLibraryItem({ ownerUserId: 'u-1' }, undefined)).toBe(false)
  })
})
