import { describe, it, expect } from 'vitest'

import {
  diffTemplateProperties,
  hasPropertyChanged,
} from '@/components/object-sheets/utils/template-property-diff'
import type { Property } from '@/lib'

const val = (uuid: string, value: string) =>
  ({ uuid, value, files: [] }) as Property['values'][number]

const prop = (overrides: Partial<Property>): Property =>
  ({
    uuid: undefined,
    key: 'k',
    label: 'L',
    type: 'string',
    values: [],
    ...overrides,
  }) as Property

describe('hasPropertyChanged', () => {
  it('returns true when no initial exists (new)', () => {
    expect(hasPropertyChanged(undefined, prop({ key: 'x' }))).toBe(true)
  })

  it('returns true on key change', () => {
    const a = prop({ uuid: 'p', key: 'old', values: [] })
    const b = prop({ uuid: 'p', key: 'new', values: [] })
    expect(hasPropertyChanged(a, b)).toBe(true)
  })

  it('returns false when key and values match', () => {
    const a = prop({ uuid: 'p', key: 'k', values: [val('v', '1')] })
    const b = prop({ uuid: 'p', key: 'k', values: [val('v', '1')] })
    expect(hasPropertyChanged(a, b)).toBe(false)
  })

  it('returns true when a value changes', () => {
    const a = prop({ uuid: 'p', values: [val('v', '1')] })
    const b = prop({ uuid: 'p', values: [val('v', '2')] })
    expect(hasPropertyChanged(a, b)).toBe(true)
  })

  it('returns true on label-only change', () => {
    const a = prop({ uuid: 'p', key: 'k', label: 'Address', values: [] })
    const b = prop({ uuid: 'p', key: 'k', label: 'Adres', values: [] })
    expect(hasPropertyChanged(a, b)).toBe(true)
  })
})

describe('diffTemplateProperties', () => {
  it('buckets creates, updates, and deletes', () => {
    const initial: Property[] = [
      prop({ uuid: 'p1', key: 'keep', values: [val('v1', '1')] }),
      prop({ uuid: 'p2', key: 'drop', values: [] }),
    ]
    const next: Property[] = [
      prop({ uuid: 'p1', key: 'keep', values: [val('v1', '2')] }),
      prop({ key: 'new', values: [] }),
    ]

    const diff = diffTemplateProperties(initial, next)

    expect(diff.creates).toHaveLength(1)
    expect(diff.creates[0].key).toBe('new')
    expect(diff.updates).toHaveLength(1)
    expect(diff.updates[0].uuid).toBe('p1')
    expect(diff.deletes).toHaveLength(1)
    expect(diff.deletes[0].uuid).toBe('p2')
  })

  it('collects uuids of values removed from an updated property', () => {
    const initial: Property[] = [
      prop({
        uuid: 'p1',
        values: [val('v1', '1'), val('v2', '2')],
      }),
    ]
    const next: Property[] = [prop({ uuid: 'p1', values: [val('v1', '1')] })]

    const diff = diffTemplateProperties(initial, next)

    expect(diff.removedValueUuids).toEqual(['v2'])
    expect(diff.updates).toHaveLength(1)
  })

  it('returns all empty buckets when nothing changed', () => {
    const initial: Property[] = [prop({ uuid: 'p1', values: [val('v1', '1')] })]
    const next: Property[] = [prop({ uuid: 'p1', values: [val('v1', '1')] })]

    const diff = diffTemplateProperties(initial, next)

    expect(diff.creates).toEqual([])
    expect(diff.updates).toEqual([])
    expect(diff.deletes).toEqual([])
    expect(diff.removedValueUuids).toEqual([])
  })

  it('does not collect removed-value uuids from unchanged properties', () => {
    // If property is unchanged, it's not in `updates`, so value diff skipped.
    const initial: Property[] = [prop({ uuid: 'p1', values: [val('v1', '1')] })]
    const next: Property[] = [prop({ uuid: 'p1', values: [val('v1', '1')] })]

    expect(diffTemplateProperties(initial, next).removedValueUuids).toEqual([])
  })
})
