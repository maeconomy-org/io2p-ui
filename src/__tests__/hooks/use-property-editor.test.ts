import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

import type { Property } from '@/components/properties/types'

// ── Mocks ──────────────────────────────────────────────────────────

const {
  mockUpdatePropertyWithValues,
  mockCreatePropertyForObject,
  mockRemovePropertyFromObject,
  mockSoftDeleteValue,
  mockCreateFormulaCalcForValue,
  mockDeleteFormulaCalcForValue,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockUpdatePropertyWithValues: vi.fn().mockResolvedValue({}),
  mockCreatePropertyForObject: vi.fn().mockResolvedValue({}),
  mockRemovePropertyFromObject: vi.fn().mockResolvedValue({}),
  mockSoftDeleteValue: vi.fn().mockResolvedValue({ success: true }),
  mockCreateFormulaCalcForValue: vi.fn().mockResolvedValue({}),
  mockDeleteFormulaCalcForValue: vi.fn().mockResolvedValue({}),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@/lib', () => ({
  logger: { error: vi.fn(), warn: mockLoggerWarn, info: vi.fn() },
  isForbiddenError: () => false,
}))

vi.mock('@/components/properties/hooks/use-property-management', () => ({
  usePropertyManagement: () => ({
    updatePropertyWithValues: mockUpdatePropertyWithValues,
    createPropertyForObject: mockCreatePropertyForObject,
    removePropertyFromObject: mockRemovePropertyFromObject,
    softDeleteValue: mockSoftDeleteValue,
    createFormulaCalcForValue: mockCreateFormulaCalcForValue,
    deleteFormulaCalcForValue: mockDeleteFormulaCalcForValue,
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

      act(() => result.current.updatePropertyName('prop-1', 'Height', 'Height'))
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

      act(() =>
        result.current.updatePropertyName('prop-1', 'Changed', 'Changed')
      )
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

      act(() => result.current.updatePropertyName('prop-1', 'Height', 'Height'))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockUpdatePropertyWithValues).toHaveBeenCalledWith(
        { uuid: 'prop-1', key: 'Height', label: 'Height' },
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
      act(() => result.current.updatePropertyName(tempId, 'NewProp', 'NewProp'))
      act(() => result.current.updatePropertyValue(tempId, 0, '10'))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockCreatePropertyForObject).toHaveBeenCalledWith(
        'obj-1',
        expect.objectContaining({ key: 'NewProp', label: 'NewProp' })
      )
    })

    it('sends localized label from dictionary when creating a property', async () => {
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [],
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addProperty())
      const tempId = result.current.properties[0]._tempId!
      // Simulate dictionary pick: key is the stable kebab id, label is localized.
      act(() => result.current.updatePropertyName(tempId, 'address', 'Address'))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockCreatePropertyForObject).toHaveBeenCalledWith(
        'obj-1',
        expect.objectContaining({ key: 'address', label: 'Address' })
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
        'prop-1',
        ['val-1']
      )
    })

    it('soft-deletes server-side values that were removed from the editor', async () => {
      const initial = [
        makeProperty({
          values: [
            { uuid: 'val-1', value: '42' },
            { uuid: 'val-2', value: '99' },
          ],
        }),
      ]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.removeValue('prop-1', 1))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockSoftDeleteValue).toHaveBeenCalledWith('val-2')
      expect(mockSoftDeleteValue).toHaveBeenCalledTimes(1)
    })

    it('tears down formula calcs for removed values', async () => {
      const initial = [
        makeProperty({
          values: [
            { uuid: 'val-1', value: '42' },
            {
              uuid: 'val-2',
              value: '99',
              formulaData: {
                formula: 'a + b',
                formulaUuid: 'formula-1',
                calcUuid: 'calc-1',
                result: 99,
              },
            },
          ],
        }),
      ]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.removeValue('prop-1', 1))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockDeleteFormulaCalcForValue).toHaveBeenCalledWith(
        'obj-1',
        'calc-1',
        'formula-1'
      )
      expect(mockSoftDeleteValue).toHaveBeenCalledWith('val-2')
    })

    it('does not soft-delete a new unsaved value that is removed before save', async () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addValue('prop-1'))
      act(() => result.current.removeValue('prop-1', 1))

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockSoftDeleteValue).not.toHaveBeenCalled()
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

    it('resolves formula args pointing to another new property created in the same save', async () => {
      // Simulate: A is new with value "10"; B is new with a formula that
      // references A::0. Neither has a real UUID at save time.
      mockCreatePropertyForObject
        .mockResolvedValueOnce({
          uuid: 'uuid-A',
          _createdValues: [{ uuid: 'uuid-A-v0', index: 0 }],
        })
        .mockResolvedValueOnce({
          uuid: 'uuid-B',
          _createdValues: [{ uuid: 'uuid-B-v0', index: 0 }],
        })

      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [],
          objectUuid: 'obj-1',
        })
      )

      // Create A
      act(() => result.current.addProperty())
      const tempA = result.current.properties[0]._tempId!
      act(() => result.current.updatePropertyName(tempA, 'A', 'A'))
      act(() => result.current.updatePropertyValue(tempA, 0, '10'))

      // Create B with a formula referencing A::0 via composite ID
      act(() => result.current.addProperty())
      const tempB = result.current.properties[1]._tempId!
      act(() => result.current.updatePropertyName(tempB, 'B', 'B'))
      act(() => result.current.updatePropertyValue(tempB, 0, '0'))
      act(() =>
        result.current.updatePropertyValueFormula(tempB, 0, {
          formula: 'x',
          formulaUuid: 'formula-uuid',
          variableMapping: {
            x: { propertyKey: 'A', propertyUuid: `${tempA}::0` },
          },
          result: 10,
        })
      )

      await act(async () => {
        await result.current.saveProperties()
      })

      // Formula calc should be created for B's value with A's value UUID.
      expect(mockCreateFormulaCalcForValue).toHaveBeenCalledTimes(1)
      const [, formulaData, args, resultUuid] =
        mockCreateFormulaCalcForValue.mock.calls[0]
      expect(formulaData.formulaUuid).toBe('formula-uuid')
      expect(args).toEqual([{ name: 'x', propertyValueUUID: 'uuid-A-v0' }])
      expect(resultUuid).toBe('uuid-B-v0')
    })

    it('resolves formula-to-formula references across two new formula values', async () => {
      // A is a new formula value (referencing an existing property Src);
      // B is a new formula value whose mapping points to A's value. Both
      // should get formula calcs created; B's arg must resolve to A's
      // freshly-created value UUID.
      mockCreatePropertyForObject
        .mockResolvedValueOnce({
          uuid: 'uuid-A',
          _createdValues: [{ uuid: 'uuid-A-v0', index: 0 }],
        })
        .mockResolvedValueOnce({
          uuid: 'uuid-B',
          _createdValues: [{ uuid: 'uuid-B-v0', index: 0 }],
        })

      const srcProp: Property = {
        uuid: 'prop-src',
        key: 'Src',
        values: [{ uuid: 'val-src', value: '4' }],
      }

      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [srcProp],
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addProperty())
      const tempA = result.current.properties[1]._tempId!
      act(() => result.current.updatePropertyName(tempA, 'A', 'A'))
      act(() => result.current.updatePropertyValue(tempA, 0, '0'))
      act(() =>
        result.current.updatePropertyValueFormula(tempA, 0, {
          formula: 's + 3',
          formulaUuid: 'formula-A',
          variableMapping: {
            s: { propertyKey: 'Src', propertyUuid: 'prop-src::0' },
          },
          result: 7,
        })
      )

      act(() => result.current.addProperty())
      const tempB = result.current.properties[2]._tempId!
      act(() => result.current.updatePropertyName(tempB, 'B', 'B'))
      act(() => result.current.updatePropertyValue(tempB, 0, '0'))
      act(() =>
        result.current.updatePropertyValueFormula(tempB, 0, {
          formula: 'x * 2',
          formulaUuid: 'formula-B',
          variableMapping: {
            x: { propertyKey: 'A', propertyUuid: `${tempA}::0` },
          },
          result: 16,
        })
      )

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockCreateFormulaCalcForValue).toHaveBeenCalledTimes(2)
      const callByFormulaUuid: Record<
        string,
        {
          args: Array<{ name: string; propertyValueUUID: string }>
          resultUuid: string
        }
      > = {}
      for (const [, fd, args, resultUuid] of mockCreateFormulaCalcForValue.mock
        .calls) {
        callByFormulaUuid[fd.formulaUuid] = { args, resultUuid }
      }
      expect(callByFormulaUuid['formula-A'].resultUuid).toBe('uuid-A-v0')
      expect(callByFormulaUuid['formula-B'].resultUuid).toBe('uuid-B-v0')
      expect(callByFormulaUuid['formula-B'].args).toEqual([
        { name: 'x', propertyValueUUID: 'uuid-A-v0' },
      ])
    })

    it('resolves formulas on a new property that reference an existing property', async () => {
      // Existing property with a known UUID; a new formula-bearing property
      // references it via its real-UUID composite ID.
      mockCreatePropertyForObject.mockResolvedValueOnce({
        uuid: 'uuid-B',
        _createdValues: [{ uuid: 'uuid-B-v0', index: 0 }],
      })

      const existing: Property = {
        uuid: 'prop-existing',
        key: 'A',
        values: [{ uuid: 'val-existing', value: '7' }],
      }

      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [existing],
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addProperty())
      const tempB = result.current.properties[1]._tempId!
      act(() => result.current.updatePropertyName(tempB, 'B', 'B'))
      act(() => result.current.updatePropertyValue(tempB, 0, '0'))
      act(() =>
        result.current.updatePropertyValueFormula(tempB, 0, {
          formula: 'x',
          formulaUuid: 'formula-mix',
          variableMapping: {
            x: { propertyKey: 'A', propertyUuid: 'prop-existing::0' },
          },
          result: 7,
        })
      )

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(mockCreateFormulaCalcForValue).toHaveBeenCalledTimes(1)
      const [, , args, resultUuid] = mockCreateFormulaCalcForValue.mock.calls[0]
      expect(args).toEqual([{ name: 'x', propertyValueUUID: 'val-existing' }])
      expect(resultUuid).toBe('uuid-B-v0')
    })

    it('orders formula calc creation so upstream formulas are created before their dependents', async () => {
      // A and B are both new formula values. B's formula references A's
      // value. Both formulas have at least one arg so both calcs get
      // scheduled. The backend must see A's calc created BEFORE B's calc
      // so B can compute against A's result.
      mockCreatePropertyForObject
        .mockResolvedValueOnce({
          uuid: 'uuid-A',
          _createdValues: [{ uuid: 'uuid-A-v0', index: 0 }],
        })
        .mockResolvedValueOnce({
          uuid: 'uuid-B',
          _createdValues: [{ uuid: 'uuid-B-v0', index: 0 }],
        })

      // Track the order calls resolve in. Even if both calls start
      // concurrently, we only record completion order.
      const completionOrder: string[] = []
      mockCreateFormulaCalcForValue.mockImplementation(
        async (_objUuid: string, formulaData: { formulaUuid: string }) => {
          await new Promise((r) => setTimeout(r, 0))
          completionOrder.push(formulaData.formulaUuid)
          return {}
        }
      )

      const srcProp: Property = {
        uuid: 'prop-src',
        key: 'Src',
        values: [{ uuid: 'val-src', value: '1' }],
      }

      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [srcProp],
          objectUuid: 'obj-1',
        })
      )

      // A references an existing property (so its calc has args).
      act(() => result.current.addProperty())
      const tempA = result.current.properties[1]._tempId!
      act(() => result.current.updatePropertyName(tempA, 'A', 'A'))
      act(() => result.current.updatePropertyValue(tempA, 0, '0'))
      act(() =>
        result.current.updatePropertyValueFormula(tempA, 0, {
          formula: 's + 1',
          formulaUuid: 'formula-A',
          variableMapping: {
            s: { propertyKey: 'Src', propertyUuid: 'prop-src::0' },
          },
          result: 2,
        })
      )

      // B references A.
      act(() => result.current.addProperty())
      const tempB = result.current.properties[2]._tempId!
      act(() => result.current.updatePropertyName(tempB, 'B', 'B'))
      act(() => result.current.updatePropertyValue(tempB, 0, '0'))
      act(() =>
        result.current.updatePropertyValueFormula(tempB, 0, {
          formula: 'x * 2',
          formulaUuid: 'formula-B',
          variableMapping: {
            x: { propertyKey: 'A', propertyUuid: `${tempA}::0` },
          },
          result: 4,
        })
      )

      await act(async () => {
        await result.current.saveProperties()
      })

      expect(completionOrder).toEqual(['formula-A', 'formula-B'])
    })

    it('warns and skips unresolved formula arguments instead of failing silently', async () => {
      mockCreatePropertyForObject.mockResolvedValueOnce({
        uuid: 'uuid-B',
        _createdValues: [{ uuid: 'uuid-B-v0', index: 0 }],
      })

      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [],
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addProperty())
      const tempB = result.current.properties[0]._tempId!
      act(() => result.current.updatePropertyName(tempB, 'B', 'B'))
      act(() => result.current.updatePropertyValue(tempB, 0, '0'))
      act(() =>
        result.current.updatePropertyValueFormula(tempB, 0, {
          formula: 'x',
          formulaUuid: 'formula-dangling',
          variableMapping: {
            x: {
              propertyKey: 'Missing',
              propertyUuid: 'nonexistent-prop::0',
            },
          },
          result: null,
        })
      )

      await act(async () => {
        await result.current.saveProperties()
      })

      // No formula calc should be created (all args unresolved -> args empty).
      expect(mockCreateFormulaCalcForValue).not.toHaveBeenCalled()
      // A warning should have been logged for the unresolved variable.
      expect(mockLoggerWarn).toHaveBeenCalled()
      const warnArgs = mockLoggerWarn.mock.calls[0]
      expect(warnArgs[0]).toMatch(/could not be resolved/i)
      expect(warnArgs[1]).toMatchObject({
        varName: 'x',
        compositeId: 'nonexistent-prop::0',
      })
    })

    it('warns and toasts when formula dependencies form a cycle', async () => {
      // A and B are both new formula values that reference each other:
      // A := b + 1 (depends on B), B := a * 2 (depends on A). The topo sort
      // in executePhase2 must detect the cycle, log a warning, surface a
      // toast.warning to the user, and still attempt both creates so the
      // backend isn't left with a half-applied save.
      mockCreatePropertyForObject
        .mockResolvedValueOnce({
          uuid: 'uuid-A',
          _createdValues: [{ uuid: 'uuid-A-v0', index: 0 }],
        })
        .mockResolvedValueOnce({
          uuid: 'uuid-B',
          _createdValues: [{ uuid: 'uuid-B-v0', index: 0 }],
        })

      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: [],
          objectUuid: 'obj-1',
        })
      )

      act(() => result.current.addProperty())
      const tempA = result.current.properties[0]._tempId!
      act(() => result.current.updatePropertyName(tempA, 'A', 'A'))
      act(() => result.current.updatePropertyValue(tempA, 0, '0'))

      act(() => result.current.addProperty())
      const tempB = result.current.properties[1]._tempId!
      act(() => result.current.updatePropertyName(tempB, 'B', 'B'))
      act(() => result.current.updatePropertyValue(tempB, 0, '0'))

      act(() =>
        result.current.updatePropertyValueFormula(tempA, 0, {
          formula: 'b + 1',
          formulaUuid: 'formula-A',
          variableMapping: {
            b: { propertyKey: 'B', propertyUuid: `${tempB}::0` },
          },
          result: 0,
        })
      )
      act(() =>
        result.current.updatePropertyValueFormula(tempB, 0, {
          formula: 'a * 2',
          formulaUuid: 'formula-B',
          variableMapping: {
            a: { propertyKey: 'A', propertyUuid: `${tempA}::0` },
          },
          result: 0,
        })
      )

      await act(async () => {
        await result.current.saveProperties()
      })

      const cycleWarnings = mockLoggerWarn.mock.calls.filter((c) =>
        /cycle/i.test(String(c[0] ?? ''))
      )
      expect(cycleWarnings.length).toBeGreaterThan(0)
      expect(mockCreateFormulaCalcForValue).toHaveBeenCalledTimes(2)

      const { toast } = await import('sonner')
      expect(toast.warning).toHaveBeenCalledWith('objects.formulaCycleDetected')
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

      act(() => result.current.updatePropertyName('prop-1', 'Height', 'Height'))

      await act(async () => {
        await result.current.saveProperty('prop-1')
      })

      expect(mockUpdatePropertyWithValues).toHaveBeenCalledWith(
        { uuid: 'prop-1', key: 'Height', label: 'Height' },
        expect.any(Array)
      )
    })
  })

  describe('validateProperties', () => {
    it('returns true and produces no errors when all names are non-empty', () => {
      const initial = [makeProperty()]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      let valid = false
      act(() => {
        valid = result.current.validateProperties()
      })

      expect(valid).toBe(true)
      expect(result.current.nameErrors).toEqual({})
    })

    it('returns false and flags properties with empty names', () => {
      const initial = [makeProperty({ key: '' })]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      let valid = true
      act(() => {
        valid = result.current.validateProperties()
      })

      expect(valid).toBe(false)
      expect(result.current.nameErrors['prop-1']).toBe(
        'objects.propertyNameRequired'
      )
    })

    it('flags whitespace-only names as invalid', () => {
      const initial = [makeProperty({ key: '   ' })]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      let valid = true
      act(() => {
        valid = result.current.validateProperties()
      })

      expect(valid).toBe(false)
      expect(result.current.nameErrors['prop-1']).toBe(
        'objects.propertyNameRequired'
      )
    })

    it('expands invalid properties so the error becomes visible', () => {
      const initial = [makeProperty({ key: '' })]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      expect(result.current.expandedIds.has('prop-1')).toBe(false)

      act(() => {
        result.current.validateProperties()
      })

      expect(result.current.expandedIds.has('prop-1')).toBe(true)
    })

    it('clears the error for a property once the user types a valid name', () => {
      const initial = [makeProperty({ key: '' })]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => {
        result.current.validateProperties()
      })
      expect(result.current.nameErrors['prop-1']).toBeDefined()

      act(() => {
        result.current.updatePropertyName('prop-1', 'Width', 'Width')
      })

      expect(result.current.nameErrors['prop-1']).toBeUndefined()
    })

    it('does not flag a property that has been removed', () => {
      const initial = [makeProperty({ key: '' })]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => {
        result.current.removeProperty('prop-1')
      })

      let valid = false
      act(() => {
        valid = result.current.validateProperties()
      })

      expect(valid).toBe(true)
      expect(result.current.nameErrors).toEqual({})
    })

    it('clears all errors when resetProperties is called', () => {
      const initial = [makeProperty({ key: '' })]
      const { result } = renderHook(() =>
        usePropertyEditor({
          initialProperties: initial,
          objectUuid: 'obj-1',
        })
      )

      act(() => {
        result.current.validateProperties()
      })
      expect(result.current.nameErrors['prop-1']).toBeDefined()

      act(() => {
        result.current.resetProperties()
      })

      expect(result.current.nameErrors).toEqual({})
    })
  })
})
