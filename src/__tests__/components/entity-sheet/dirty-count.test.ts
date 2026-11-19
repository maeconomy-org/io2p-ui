import { describe, it, expect } from 'vitest'

import { countDirtyLeaves } from '@/components/entity-sheet/entity-sheet'

// RHF's dirtyFields mirrors the value shape, so counting its top-level keys reported a dozen edited
// properties as "1 unsaved change".
describe('countDirtyLeaves', () => {
  it('counts nothing for a clean form', () => {
    expect(countDirtyLeaves({})).toBe(0)
    expect(countDirtyLeaves(undefined)).toBe(0)
  })

  it('counts each changed scalar field', () => {
    expect(countDirtyLeaves({ name: true, description: true })).toBe(2)
  })

  it('ignores fields left untouched', () => {
    expect(countDirtyLeaves({ name: true, description: false })).toBe(1)
  })

  it('descends into arrays instead of counting them as one change', () => {
    const dirtyFields = {
      properties: [
        { key: true, values: [{ data: true }] },
        { key: true, values: [{ data: true }] },
      ],
    }
    expect(countDirtyLeaves(dirtyFields)).toBe(4)
  })

  it('descends into nested objects', () => {
    expect(countDirtyLeaves({ address: { street: true, city: true } })).toBe(2)
  })
})
