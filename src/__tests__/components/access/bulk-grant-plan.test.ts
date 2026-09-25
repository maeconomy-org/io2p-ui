import { describe, it, expect } from 'vitest'

import { bulkGrantPlan } from '@/components/access/library-bulk-share-sheet'
import type { ShareTarget } from '@/components/access/share-sheet'

const target = (type: ShareTarget['type'], id: string): ShareTarget => ({
  type,
  id,
  name: id,
})

const anna = { subject: { kind: 'user' as const, userId: 'anna' }, label: 'A' }
const bo = { subject: { kind: 'user' as const, userId: 'bo' }, label: 'B' }
const everyone = { subject: { kind: 'public' as const }, label: 'Public' }

describe('bulkGrantPlan', () => {
  it('writes one grant per resource per recipient', () => {
    // A grant is keyed on (resource, subject) and has no multi-resource form, so 3 x 2 is 6 calls.
    const plan = bulkGrantPlan(
      [
        target('formula', 'f1'),
        target('formula', 'f2'),
        target('formula', 'f3'),
      ],
      [anna, bo],
      'read'
    )

    expect(plan).toHaveLength(6)
    expect(plan.filter((g) => g.resource.id === 'f1')).toHaveLength(2)
    expect(plan.map((g) => g.subject)).toContainEqual({
      kind: 'user',
      userId: 'bo',
    })
  })

  it('carries a public subject through unchanged', () => {
    const plan = bulkGrantPlan([target('template', 't1')], [everyone], 'read')
    expect(plan).toEqual([
      {
        resource: { type: 'template', id: 't1' },
        subject: { kind: 'public' },
        permission: 'read',
      },
    ])
  })

  describe('the read-only pin', () => {
    // READ_SHARE_ONLY lives in the node's rules layer, so anything else on an F/C/T resource 400s.
    it.each(['formula', 'constant', 'template'] as const)(
      'forces read for a %s even when a higher rung was picked',
      (type) => {
        const plan = bulkGrantPlan([target(type, 'x')], [anna], 'admin')
        expect(plan[0].permission).toBe('read')
      }
    )

    // The whole run goes out with ONE permission, so a mixed selection has to take the one every
    // member accepts — otherwise the formula in the batch fails and the objects silently succeed.
    it('pins the WHOLE selection when only one member is read-only', () => {
      const plan = bulkGrantPlan(
        [target('object', 'o1'), target('formula', 'f1')],
        [anna],
        'write'
      )
      expect(plan.every((g) => g.permission === 'read')).toBe(true)
    })

    it('leaves the chosen permission alone when nothing is read-only', () => {
      const plan = bulkGrantPlan(
        [target('object', 'o1'), target('process', 'p1')],
        [anna],
        'write'
      )
      expect(plan.every((g) => g.permission === 'write')).toBe(true)
    })
  })

  it('plans nothing when there is no one to share with', () => {
    expect(bulkGrantPlan([target('formula', 'f1')], [], 'read')).toEqual([])
  })

  describe('template dependencies', () => {
    const dep = (id: string, type: 'formula' | 'constant') => ({
      id,
      type,
      name: id,
      deleted: false,
      system: false,
      owned: true,
    })

    it('grants each dependency to each recipient, after the selection', () => {
      const plan = bulkGrantPlan(
        [target('template', 't1')],
        [anna, bo],
        'read',
        [dep('f1', 'formula'), dep('c1', 'constant')]
      )

      // The selection first: a dependency failure must not cost the share it came with.
      expect(plan.slice(0, 2).every((g) => g.resource.id === 't1')).toBe(true)
      expect(plan).toHaveLength(6)
    })

    it('pins a dependency to read even when the selection is writable', () => {
      // The node accepts no other permission on a library item, so a `write` selection cannot drag
      // its formulas up with it.
      const plan = bulkGrantPlan([target('object', 'o1')], [anna], 'write', [
        dep('f1', 'formula'),
      ])

      expect(plan.find((g) => g.resource.id === 'o1')?.permission).toBe('write')
      expect(plan.find((g) => g.resource.id === 'f1')?.permission).toBe('read')
    })

    it('carries each dependency type onto its own grant', () => {
      const plan = bulkGrantPlan([target('template', 't1')], [anna], 'read', [
        dep('f1', 'formula'),
        dep('c1', 'constant'),
      ])

      expect(plan.find((g) => g.resource.id === 'f1')?.resource.type).toBe(
        'formula'
      )
      expect(plan.find((g) => g.resource.id === 'c1')?.resource.type).toBe(
        'constant'
      )
    })

    it('adds nothing when the user left the box unticked', () => {
      expect(
        bulkGrantPlan([target('template', 't1')], [anna], 'read')
      ).toHaveLength(1)
    })

    // Sharing a template with everyone is not a decision to publish the library behind it. The
    // template itself still goes public — only the dependencies stop at named users.
    it('never grants a dependency to the public subject', () => {
      const plan = bulkGrantPlan(
        [target('template', 't1')],
        [everyone, anna],
        'read',
        [dep('f1', 'formula')]
      )

      const deps = plan.filter((g) => g.resource.id === 'f1')
      expect(deps).toHaveLength(1)
      expect(deps[0].subject).toEqual({ kind: 'user', userId: 'anna' })
      // The template itself is still shared publicly.
      expect(
        plan.some((g) => g.resource.id === 't1' && g.subject.kind === 'public')
      ).toBe(true)
    })

    it('plans no dependency grants when only the public subject is picked', () => {
      const plan = bulkGrantPlan(
        [target('template', 't1')],
        [everyone],
        'read',
        [dep('f1', 'formula')]
      )

      expect(plan.filter((g) => g.resource.id === 'f1')).toEqual([])
    })
  })
})
