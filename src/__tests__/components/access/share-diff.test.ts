import { describe, it, expect } from 'vitest'

/**
 * The share sheet stages edits and writes on Save, so what it sends is a DIFF. A one-sided diff is
 * the recurring failure in this codebase — a removal that never sends looks like a successful save
 * and leaves someone's access intact.
 *
 * These mirror the component's own comparison so the rules are pinned somewhere a refactor has to
 * notice.
 */

const PUBLIC_KEY = 'public'

interface DraftMember {
  permission: string
  includeDescendants: boolean
}
type Draft = Record<string, DraftMember>

const sameMember = (a: DraftMember, b: DraftMember) =>
  a.permission === b.permission && a.includeDescendants === b.includeDescendants

const diff = (initial: Draft, draft: Draft) => ({
  changed: Object.keys(draft).filter(
    (k) => !initial[k] || !sameMember(initial[k], draft[k])
  ),
  removed: Object.keys(initial).filter((k) => !draft[k]),
})

const member = (
  permission = 'read',
  includeDescendants = false
): DraftMember => ({ permission, includeDescendants })

describe('share sheet diff', () => {
  it('sends nothing when nothing moved', () => {
    const state: Draft = { anna: member('write', true) }
    expect(diff(state, { ...state })).toEqual({ changed: [], removed: [] })
  })

  it('treats an added member as a change', () => {
    expect(diff({}, { anna: member() }).changed).toEqual(['anna'])
  })

  it('treats a raised permission as a change', () => {
    const before = { anna: member('read') }
    expect(diff(before, { anna: member('admin') }).changed).toEqual(['anna'])
  })

  it('treats a cascade toggle alone as a change', () => {
    // The permission is identical — only `includeDescendants` moved. Comparing permission alone
    // would silently drop a subtree grant.
    const before = { anna: member('write', false) }
    expect(diff(before, { anna: member('write', true) }).changed).toEqual([
      'anna',
    ])
  })

  it('reports a removal, and does NOT also report it as changed', () => {
    const before = { anna: member(), ben: member() }
    const after = { anna: member() }
    expect(diff(before, after)).toEqual({ changed: [], removed: ['ben'] })
  })

  it('handles add and remove in one save', () => {
    const result = diff({ ben: member() }, { anna: member() })
    expect(result.changed).toEqual(['anna'])
    expect(result.removed).toEqual(['ben'])
  })

  it('treats public like any other subject', () => {
    expect(diff({}, { [PUBLIC_KEY]: member() }).changed).toEqual([PUBLIC_KEY])
    expect(diff({ [PUBLIC_KEY]: member() }, {}).removed).toEqual([PUBLIC_KEY])
  })
})
