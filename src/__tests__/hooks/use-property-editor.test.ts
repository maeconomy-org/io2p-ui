import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

import type { Property } from '@/components/properties/types'

// ── Mocks ──────────────────────────────────────────────────────────

const mockUpdatePropertyWithValues = vi.fn().mockResolvedValue({})
const mockCreatePropertyForObject = vi.fn().mockResolvedValue({})
const mockRemovePropertyFromObject = vi.fn().mockResolvedValue({})

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib', () => ({
  logger: { error: vi.fn() },
  isForbiddenError: () => false,
}))

vi.mock('@/components/properties/hooks/use-property-management', () => ({
  usePropertyManagement: () => ({
    updatePropertyWithValues: mockUpdatePropertyWithValues,
    createPropertyForObject: mockCreatePropertyForObject,
    removePropertyFromObject: mockRemovePropertyFromObject,
    createFormulaCalcForValue: vi.fn().mockResolvedValue({}),
    deleteFormulaCalcForValue: vi.fn().mockResolvedValue({}),
  }),
}))

import { usePropertyEditor } from '@/components/properties/hooks/use-property-editor'

// ── Helpers ────────────────────────────────────────────────────────

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    uuid: 'prop-1',
    key: 'Width',
    values: [{ uuid: 'val-1', value: '42' }],
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('usePropertyEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  describe('initial state', () => {
    it('initializes properties from initialProperties', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      expect(result.current.properties).toHaveLength(1)
      expect(result.current.properties[0].key).toBe('Width')
    })

    it('starts with no changes and no expanded IDs', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      expect(result.current.hasChanges).toBe(false)
      expect(result.current.expandedIds.size).toBe(0)
      expect(result.current.isSavingProperty).toBeNull()
    })

    it('handles empty initial properties', () => {
      const { result } = renderHook(() =>
        usePropertyEditor({ objectUuid: 'obj-1' })
      )

      expect(result.current.properties).toHaveLength(0)
    })

    it('handles unstable initialProperties references', () => {
      // Pass a new array reference each render — should NOT infinite loop
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [makeProperty()],
          objectUuid: 'obj-1',
        })
      )

      expect(result.current.properties).toHaveLength(1)
    })
  })

  describe('toggleExpand', () => {
    it('toggles property expansion', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.toggleExpand('prop-1'))
      expect(result.current.expandedIds.has('prop-1')).toBe(true)

      act(() => result.current.toggleExpand('prop-1'))
      expect(result.current.expandedIds.has('prop-1')).toBe(false)
    })
  })

  describe('addProperty', () => {
    it('appends a new property and expands it', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addProperty())

      expect(result.current.properties).toHaveLength(2)
      const newProp = result.current.properties[1]
      expect(newProp._isNew).toBe(true)
      expect(newProp._tempId).toBeDefined()
      expect(result.current.expandedIds.has(newProp._tempId!)).toBe(true)
      expect(result.current.hasChanges).toBe(true)
    })
  })

  describe('mutations', () => {
    it('updates property name', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.updatePropertyName('prop-1', 'Height'))
      expect(result.current.properties[0].key).toBe('Height')
      expect(result.current.hasChanges).toBe(true)
    })

    it('updates property value', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.updatePropertyValue('prop-1', 0, '99'))
      expect(result.current.properties[0].values[0].value).toBe('99')
    })

    it('clears _needsInput on non-empty value', () => {
      const initial = [
        makeProperty({
          values: [{ value: '', _needsInput: true }],
        }),
      ]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.updatePropertyValue('prop-1', 0, 'hello'))
      expect(result.current.properties[0].values[0]._needsInput).toBe(false)
    })

    it('attaches and clears formula data', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      const fd = {
        formula: 'a + b',
        result: 100,
        isValid: true,
      }
      act(() => result.current.updatePropertyValueFormula('prop-1', 0, fd))
      expect(result.current.properties[0].values[0].formulaData).toEqual(fd)

      act(() =>
        result.current.updatePropertyValueFormula('prop-1', 0, undefined)
      )
      expect(result.current.properties[0].values[0].formulaData).toBeUndefined()
    })

    it('adds and removes values', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addValue('prop-1'))
      expect(result.current.properties[0].values).toHaveLength(2)

      act(() => result.current.removeValue('prop-1', 0))
      expect(result.current.properties[0].values).toHaveLength(1)
    })
  })

  describe('removeProperty', () => {
    it('hides existing property', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.removeProperty('prop-1'))
      expect(result.current.properties).toHaveLength(0)
      expect(result.current.hasChanges).toBe(true)
    })

    it('removes new property entirely', () => {
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [],
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addProperty())
      const tempId = result.current.properties[0]._tempId!
      act(() => result.current.removeProperty(tempId))
      expect(result.current.properties).toHaveLength(0)
    })
  })

  describe('resetProperties', () => {
    it('reverts all edits', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.updatePropertyName('prop-1', 'Changed'))
      act(() => result.current.addProperty())
      expect(result.current.properties).toHaveLength(2)

      act(() => result.current.resetProperties())
      expect(result.current.properties).toHaveLength(1)
      expect(result.current.properties[0].key).toBe('Width')
      expect(result.current.hasChanges).toBe(false)
    })
  })

  describe('availablePropertiesFor', () => {
    it('returns sibling numeric values only', () => {
      const initial = [
        makeProperty({
          uuid: 'p1',
          key: 'Width',
          values: [{ uuid: 'v1', value: '42' }],
        }),
        makeProperty({
          uuid: 'p2',
          key: 'Height',
          values: [{ uuid: 'v2', value: '100' }],
        }),
        makeProperty({
          uuid: 'p3',
          key: 'Name',
          values: [{ uuid: 'v3', value: 'hello' }],
        }),
      ]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      const forP1 = result.current.availablePropertiesFor('p1')
      expect(forP1).toHaveLength(1)
      expect(forP1[0].key).toBe('Height')
    })
  })

  describe('saveProperties', () => {
    it('calls update API for changed properties', async () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.updatePropertyName('prop-1', 'Height'))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockUpdatePropertyWithValues).toHaveBeenCalledWith(
        { uuid: 'prop-1', key: 'Height' },
        expect.any(Array)
      )
    })

    it('calls create API for new properties', async () => {
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [],
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addProperty())
      const tempId = result.current.properties[0]._tempId!
      act(() => result.current.updatePropertyName(tempId, 'NewProp'))
      act(() => result.current.updatePropertyValue(tempId, 0, '10'))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockCreatePropertyForObject).toHaveBeenCalledWith(
        'obj-1',
        expect.objectContaining({ key: 'NewProp' })
      )
    })

    it('calls delete API for removed properties', async () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.removeProperty('prop-1'))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockRemovePropertyFromObject).toHaveBeenCalledWith(
        'obj-1',
        'prop-1'
      )
    })

    it('does nothing when no changes', async () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockUpdatePropertyWithValues).not.toHaveBeenCalled()
    })
  })

  describe('saveProperty', () => {
    it('saves a single property by ID', async () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.updatePropertyName('prop-1', 'Height'))

      await act(async () => {
        await result.current.saveProperty('prop-1')
      })

      expect(mockUpdatePropertyWithValues).toHaveBeenCalledWith(
        { uuid: 'prop-1', key: 'Height' },
        expect.any(Array)
      )
    })
  })
})
