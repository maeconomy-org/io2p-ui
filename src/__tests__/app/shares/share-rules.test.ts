import { describe, it, expect } from 'vitest'

import {
  canCascade,
  familyOf,
  familyOfBundle,
  pinPermissions,
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
