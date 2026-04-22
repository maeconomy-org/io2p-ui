import { describe, it, expect, vi } from 'vitest'
import { Predicate } from 'iom-sdk'

import {
  createParentRelationships,
  getCreatedObjectUuid,
  getPropertyByIndex,
  mapFileContexts,
} from '@/components/object-sheets/utils/object-operations-utils'

describe('getCreatedObjectUuid', () => {
  it('reads uuid directly off the result', () => {
    expect(getCreatedObjectUuid({ uuid: 'u1' })).toBe('u1')
  })

  it('falls back through objectUuid → data.uuid → array[0].uuid', () => {
    expect(getCreatedObjectUuid({ objectUuid: 'u2' })).toBe('u2')
    expect(getCreatedObjectUuid({ data: { uuid: 'u3' } })).toBe('u3')
    expect(getCreatedObjectUuid([{ uuid: 'u4' }])).toBe('u4')
  })

  it('returns null when no uuid is present', () => {
    expect(getCreatedObjectUuid({})).toBeNull()
    expect(getCreatedObjectUuid(null)).toBeNull()
  })
})

describe('getPropertyByIndex', () => {
  it('reads properties directly off the result', () => {
    const props = [{ uuid: 'p0' }, { uuid: 'p1' }]
    expect(getPropertyByIndex({ properties: props }, 1)).toEqual({ uuid: 'p1' })
  })

  it('falls back through data.properties → array[0].properties → object.properties', () => {
    expect(
      getPropertyByIndex({ data: { properties: [{ uuid: 'x' }] } }, 0)
    ).toEqual({ uuid: 'x' })
    expect(getPropertyByIndex([{ properties: [{ uuid: 'y' }] }], 0)).toEqual({
      uuid: 'y',
    })
    expect(
      getPropertyByIndex({ object: { properties: [{ uuid: 'z' }] } }, 0)
    ).toEqual({ uuid: 'z' })
  })

  it('returns null when no properties or index out of range', () => {
    expect(getPropertyByIndex({}, 0)).toBeNull()
    expect(getPropertyByIndex({ properties: [] }, 5)).toBeNull()
  })
})

describe('mapFileContexts', () => {
  it('assigns objectUuid for object-context uploads', () => {
    const result = mapFileContexts(
      [{ context: 'object', fileName: 'a' } as any],
      { uuid: 'obj-1', properties: [] }
    )
    expect(result).toEqual([
      {
        attachment: { context: 'object', fileName: 'a' },
        objectUuid: 'obj-1',
      },
    ])
  })

  it('resolves propertyUuid from propertyIndex for property-context uploads', () => {
    const result = mapFileContexts(
      [{ context: 'property', propertyIndex: 1, fileName: 'p' } as any],
      {
        uuid: 'obj-1',
        properties: [{ uuid: 'p0' }, { uuid: 'p1' }],
      }
    )
    expect(result[0]).toMatchObject({
      objectUuid: 'obj-1',
      propertyUuid: 'p1',
    })
  })

  it('resolves propertyUuid + valueUuid for value-context uploads', () => {
    const result = mapFileContexts(
      [
        {
          context: 'value',
          propertyIndex: 0,
          valueIndex: 2,
          fileName: 'v',
        } as any,
      ],
      {
        uuid: 'obj-1',
        properties: [
          {
            uuid: 'p0',
            values: [{ uuid: 'v0' }, { uuid: 'v1' }, { uuid: 'v2' }],
          },
        ],
      }
    )
    expect(result[0]).toMatchObject({
      objectUuid: 'obj-1',
      propertyUuid: 'p0',
      valueUuid: 'v2',
    })
  })

  it('skips uploads that could not be matched to an objectUuid', () => {
    const result = mapFileContexts(
      [{ context: 'object', fileName: 'a' } as any],
      {} // no uuid anywhere
    )
    expect(result).toEqual([])
  })
})

describe('createParentRelationships', () => {
  it('creates IS_PARENT_OF and IS_CHILD_OF for every parent', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined)
    await createParentRelationships(['p1', 'p2'], 'c1', { mutateAsync })

    expect(mutateAsync).toHaveBeenCalledTimes(4)
    expect(mutateAsync).toHaveBeenCalledWith({
      subject: 'p1',
      predicate: Predicate.IS_PARENT_OF,
      object: 'c1',
    })
    expect(mutateAsync).toHaveBeenCalledWith({
      subject: 'c1',
      predicate: Predicate.IS_CHILD_OF,
      object: 'p1',
    })
  })

  it('does nothing when parent list is empty', async () => {
    const mutateAsync = vi.fn()
    await createParentRelationships([], 'c1', { mutateAsync })
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
