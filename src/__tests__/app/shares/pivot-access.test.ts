import { describe, it, expect } from 'vitest'
import type { SharedByMeItem } from 'io2p-client'

import { pivotByPerson, strongest } from '@/app/shares/utils/pivot-access'

const user = (id: string) => ({ kind: 'user' as const, userId: id })

function item(
  name: string,
  grants: {
    subject: unknown
    permission: string
    includeDescendants?: boolean
  }[],
  over: Record<string, unknown> = {}
): SharedByMeItem {
  return {
    resource: { type: 'object', id: `id-${name}`, name, ...over },
    grants: grants.map((g) => ({
      subject: g.subject,
      permission: g.permission,
      includeDescendants: !!g.includeDescendants,
    })),
  } as unknown as SharedByMeItem
}

describe('strongest', () => {
  it('picks the most permissive, however they are ordered', () => {
    expect(strongest(['read', 'admin', 'write'])).toBe('admin')
    expect(strongest(['share', 'read'])).toBe('share')
    expect(strongest(['read'])).toBe('read')
  })
})

describe('pivotByPerson', () => {
  it('turns resource→grants into person→resources', () => {
    const people = pivotByPerson([
      item('Wall A', [{ subject: user('anna'), permission: 'read' }]),
      item('Wall B', [{ subject: user('anna'), permission: 'read' }]),
      item('Wall C', [{ subject: user('bob'), permission: 'write' }]),
    ])

    expect(people.map((p) => p.key).sort()).toEqual(['anna', 'bob'])
    expect(people.find((p) => p.key === 'anna')?.entries).toHaveLength(2)
  })

  it('collapses two SOURCES on one resource to the strongest', () => {
    // io2p keys a grant by (resource, subject, source), so the same person can appear twice on one
    // resource — an ad-hoc grant and a Share. Effective access is the union, most-permissive wins;
    // showing either number alone would misreport what they can do.
    const people = pivotByPerson([
      item('Wall A', [
        { subject: user('anna'), permission: 'read' },
        { subject: user('anna'), permission: 'write' },
      ]),
    ])

    expect(people[0].entries).toHaveLength(1)
    expect(people[0].entries[0].permission).toBe('write')
  })

  it('carries cascade if ANY source grants it', () => {
    const people = pivotByPerson([
      item('Wall A', [
        { subject: user('anna'), permission: 'read' },
        { subject: user('anna'), permission: 'read', includeDescendants: true },
      ]),
    ])

    expect(people[0].entries[0].includeDescendants).toBe(true)
  })

  it('headlines the strongest permission held ANYWHERE', () => {
    const people = pivotByPerson([
      item('Wall A', [{ subject: user('anna'), permission: 'read' }]),
      item('Wall B', [{ subject: user('anna'), permission: 'admin' }]),
    ])

    expect(people[0].highest).toBe('admin')
  })

  it('sorts by reach — the widest access first', () => {
    const people = pivotByPerson([
      item('Wall A', [
        { subject: user('quiet'), permission: 'read' },
        { subject: user('powerful'), permission: 'admin' },
      ]),
    ])

    expect(people[0].key).toBe('powerful')
  })

  it('keeps a DELETED resource, so reach is not under-reported', () => {
    // A share outlives the thing it points at: the projection never joins the grant to the
    // resource, so dropping these rows would show someone reaching less than they do.
    const people = pivotByPerson([
      item('Gone', [{ subject: user('anna'), permission: 'read' }], {
        deleted: true,
      }),
    ])

    expect(people[0].entries).toHaveLength(1)
    expect(people[0].entries[0].resource.deleted).toBe(true)
  })

  it('treats public as its own row', () => {
    const people = pivotByPerson([
      item('Wall A', [
        { subject: { kind: 'public' }, permission: 'read' },
        { subject: user('anna'), permission: 'read' },
      ]),
    ])

    expect(people.map((p) => p.key).sort()).toEqual(['anna', 'public'])
  })

  it('is empty for nothing shared', () => {
    expect(pivotByPerson([])).toEqual([])
  })
})
