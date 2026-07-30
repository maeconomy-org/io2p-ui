import { describe, it, expect } from 'vitest'
import type { ShareDTO } from 'io2p-client'

import { buildDelta } from '@/app/shares/components/share-editor-sheet'

const original = {
  id: 's1',
  name: 'Q3',
  ownerUserId: 'me',
  resources: [
    { type: 'object' as const, id: 'o1' },
    { type: 'object' as const, id: 'o2' },
  ],
  members: [
    { userId: 'anna', permission: 'read' as const },
    { userId: 'ben', permission: 'write' as const },
  ],
  includeDescendants: false,
  createdBy: 'me',
  createdAt: 0,
  updatedAt: 0,
  currentVersion: 1,
  deleted: false,
} as unknown as ShareDTO

const unchanged = {
  name: 'Q3',
  resources: [
    { type: 'object' as const, id: 'o1', name: 'o1' },
    { type: 'object' as const, id: 'o2', name: 'o2' },
  ],
  members: [
    { userId: 'anna', permission: 'read' as const },
    { userId: 'ben', permission: 'write' as const },
  ],
  cascade: false,
}

describe('buildDelta', () => {
  it('sends an empty body when nothing moved', () => {
    // PATCH is a delta, so "no change" must be no keys — not a body that re-sends the whole bundle.
    expect(buildDelta(original, unchanged)).toEqual({})
  })

  it('sends only the name when only the name changed', () => {
    expect(buildDelta(original, { ...unchanged, name: 'Q4' })).toEqual({
      name: 'Q4',
    })
  })

  it('adds and removes resources in one body', () => {
    const body = buildDelta(original, {
      ...unchanged,
      resources: [
        { type: 'object' as const, id: 'o1', name: 'o1' },
        { type: 'process' as const, id: 'p9', name: 'p9' },
      ],
      // o2 dropped, p9 added — and a process forbids cascade, which the form clears.
      cascade: false,
    })
    expect(body.resources).toEqual({
      add: [{ type: 'process', id: 'p9' }],
      remove: [{ type: 'object', id: 'o2' }],
    })
  })

  it('REMOVES a dropped member — the half of the diff that silently goes missing', () => {
    const body = buildDelta(original, {
      ...unchanged,
      members: [{ userId: 'anna', permission: 'read' as const }],
    })
    // `members.remove` is bare userId strings, unlike `resources.remove`.
    expect(body.members).toEqual({ remove: ['ben'] })
  })

  it('distinguishes a permission change from an add', () => {
    const body = buildDelta(original, {
      ...unchanged,
      members: [
        { userId: 'anna', permission: 'admin' as const },
        { userId: 'ben', permission: 'write' as const },
        { userId: 'cara', permission: 'read' as const },
      ],
    })
    expect(body.members).toEqual({
      add: [{ userId: 'cara', permission: 'read' }],
      update: [{ userId: 'anna', permission: 'admin' }],
    })
  })

  it('sends includeDescendants only when it actually flips', () => {
    expect(buildDelta(original, { ...unchanged, cascade: true })).toEqual({
      includeDescendants: true,
    })
    expect(
      buildDelta({ ...original, includeDescendants: true } as ShareDTO, {
        ...unchanged,
        cascade: true,
      })
    ).toEqual({})
  })

  it('omits empty sub-objects rather than sending `{}`', () => {
    // `resources: {}` would be a body that says nothing while looking like an intent.
    const body = buildDelta(original, { ...unchanged, name: 'Q4' })
    expect(body).not.toHaveProperty('resources')
    expect(body).not.toHaveProperty('members')
  })
})
