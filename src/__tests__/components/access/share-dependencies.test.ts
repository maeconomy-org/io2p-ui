import { describe, it, expect } from 'vitest'

import { splitDependencies } from '@/components/access/share-dependencies'
import type { TemplateShareDependencies } from '@/types'

function dep(
  over: Partial<TemplateShareDependencies['formulas'][number]> = {}
) {
  return {
    id: 'f-1',
    name: 'area',
    deleted: false,
    system: false,
    owned: true,
    ...over,
  }
}

function deps(
  over: Partial<TemplateShareDependencies> = {}
): TemplateShareDependencies {
  return { formulas: [], constants: [], ...over }
}

describe('splitDependencies', () => {
  it('offers an owned, live, user-tier item', () => {
    const { grantable } = splitDependencies(deps({ formulas: [dep()] }))

    expect(grantable).toHaveLength(1)
    expect(grantable[0]).toMatchObject({ id: 'f-1', type: 'formula' })
  })

  it('tags each item with the resource type its grant needs', () => {
    // The grant body names the resource type, and the two arrive in separate lists — losing which
    // list an item came from would grant against the wrong resource.
    const { grantable } = splitDependencies(
      deps({
        formulas: [dep({ id: 'f-1' })],
        constants: [dep({ id: 'c-1' })],
      })
    )

    expect(grantable.map((d) => [d.id, d.type])).toEqual([
      ['f-1', 'formula'],
      ['c-1', 'constant'],
    ])
  })

  // A built-in is visible to everyone, so a grant would be a request that changes nothing.
  it('drops a system item entirely rather than offering it', () => {
    const result = splitDependencies(
      deps({ formulas: [dep({ system: true })] })
    )

    expect(result.grantable).toEqual([])
    expect(result.broken).toEqual([])
    expect(result.foreign).toEqual([])
  })

  // Reported, never omitted: silence would read as "nothing to worry about" for a template whose
  // calculations resolve for nobody, its owner included.
  it('reports a deleted binding as broken rather than hiding it', () => {
    const { grantable, broken } = splitDependencies(
      deps({ constants: [dep({ deleted: true })] })
    )

    expect(grantable).toEqual([])
    expect(broken).toHaveLength(1)
  })

  // The checkbox cannot fix this one: only the owner of an item may grant it.
  it('separates an item the caller does not own', () => {
    const { grantable, foreign } = splitDependencies(
      deps({ formulas: [dep({ owned: false })] })
    )

    expect(grantable).toEqual([])
    expect(foreign).toHaveLength(1)
  })

  // Deleted wins over unowned: an item that no longer exists cannot be granted by anybody, so
  // telling the user to ask its owner would send them somewhere that cannot help.
  it('counts a deleted, unowned item as broken and not as foreign', () => {
    const { broken, foreign } = splitDependencies(
      deps({ formulas: [dep({ deleted: true, owned: false })] })
    )

    expect(broken).toHaveLength(1)
    expect(foreign).toEqual([])
  })

  it('has nothing to say about a template with no recipes', () => {
    const result = splitDependencies(undefined)

    expect(result.grantable).toEqual([])
    expect(result.broken).toEqual([])
    expect(result.foreign).toEqual([])
  })
})
