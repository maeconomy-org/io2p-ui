import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Predicate } from 'iom-sdk'

import { usePropertyManagement } from '@/components/properties/hooks/use-property-management'

// ─── Mutation mocks ─────────────────────────────────────────

const updatePropertyWithValues = vi.fn()
const updateProperty = vi.fn()
const addPropertyToObject = vi.fn()
const setPropertyValue = vi.fn()
const deleteProperty = vi.fn()
const softDeletePropertyValue = vi.fn()
const createFormulaCalc = vi.fn()
const deleteFormulaCalc = vi.fn()
const createStatement = vi.fn()
const generateUuid = vi.fn()

const mutation = (fn: any) => ({ mutateAsync: fn })

vi.mock('@/hooks/api/use-properties', () => ({
  useProperties: () => ({
    useUpdatePropertyWithValues: () => mutation(updatePropertyWithValues),
    useUpdateProperty: () => mutation(updateProperty),
    useAddPropertyToObject: () => mutation(addPropertyToObject),
    useSetPropertyValue: () => mutation(setPropertyValue),
    useDeleteProperty: () => mutation(deleteProperty),
    useSoftDeletePropertyValue: () => mutation(softDeletePropertyValue),
  }),
}))

vi.mock('@/hooks/api/use-math-formulas', () => ({
  useMathFormulas: () => ({
    useCreateFormulaCalc: () => mutation(createFormulaCalc),
    useDeleteFormulaCalc: () => mutation(deleteFormulaCalc),
  }),
}))

vi.mock('@/hooks/api/use-statements', () => ({
  useStatements: () => ({
    useCreateStatement: () => mutation(createStatement),
  }),
}))

vi.mock('@/hooks/api/use-uuid', () => ({
  useUuid: () => ({
    useGenerateUuid: () => mutation(generateUuid),
  }),
}))

describe('usePropertyManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPropertyForObject', () => {
    it('creates the property and then sets each value in order', async () => {
      addPropertyToObject.mockResolvedValue({
        property: { data: { uuid: 'p1' } },
      })
      setPropertyValue.mockImplementation(async ({ value }) => ({
        value: { data: { uuid: `v-${value.value ?? 'formula'}` } },
      }))

      const { result } = renderHook(() => usePropertyManagement())

      let created: any
      await act(async () => {
        created = await result.current.createPropertyForObject('obj-1', {
          key: 'height',
          values: [{ value: '10' }, { value: '20' }],
        })
      })

      expect(addPropertyToObject).toHaveBeenCalledWith({
        objectUuid: 'obj-1',
        property: { key: 'height' },
      })
      expect(setPropertyValue).toHaveBeenCalledTimes(2)
      expect(setPropertyValue).toHaveBeenNthCalledWith(1, {
        propertyUuid: 'p1',
        value: { value: '10' },
      })
      expect(created.uuid).toBe('p1')
      expect(created._createdValues).toEqual([
        { uuid: 'v-10', index: 0 },
        { uuid: 'v-20', index: 1 },
      ])
    })

    it('omits value for formula-backed values so the backend computes them', async () => {
      addPropertyToObject.mockResolvedValue({
        property: { data: { uuid: 'p1' } },
      })
      setPropertyValue.mockResolvedValue({
        value: { data: { uuid: 'vf' } },
      })

      const { result } = renderHook(() => usePropertyManagement())
      await act(async () => {
        await result.current.createPropertyForObject('obj-1', {
          values: [{ formulaData: { formulaUuid: 'f1' }, value: 'ignored' }],
        })
      })

      expect(setPropertyValue).toHaveBeenCalledWith({
        propertyUuid: 'p1',
        value: {},
      })
    })

    it('surfaces and records errors from the API', async () => {
      addPropertyToObject.mockRejectedValue(new Error('boom'))

      const { result } = renderHook(() => usePropertyManagement())
      await act(async () => {
        await expect(
          result.current.createPropertyForObject('obj-1', { values: [] })
        ).rejects.toThrow('boom')
      })

      expect(result.current.error?.message).toBe('boom')
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('updatePropertyWithValues', () => {
    it('updates metadata when key is provided, then updates values', async () => {
      updateProperty.mockResolvedValue({})
      updatePropertyWithValues.mockResolvedValue({ ok: true })

      const { result } = renderHook(() => usePropertyManagement())
      await act(async () => {
        await result.current.updatePropertyWithValues(
          { uuid: 'p1', key: 'depth' } as any,
          [{ uuid: 'v1', value: '5' }]
        )
      })

      expect(updateProperty).toHaveBeenCalledWith({
        uuid: 'p1',
        key: 'depth',
      })
      expect(updatePropertyWithValues).toHaveBeenCalledWith({
        propertyUuid: 'p1',
        values: [{ uuid: 'v1', value: '5' }],
      })
    })

    it('skips metadata update when key is undefined', async () => {
      updatePropertyWithValues.mockResolvedValue({ ok: true })

      const { result } = renderHook(() => usePropertyManagement())
      await act(async () => {
        await result.current.updatePropertyWithValues({ uuid: 'p1' } as any, [])
      })

      expect(updateProperty).not.toHaveBeenCalled()
      expect(updatePropertyWithValues).toHaveBeenCalled()
    })
  })

  describe('addValueToProperty', () => {
    it('delegates to setPropertyValue', async () => {
      setPropertyValue.mockResolvedValue({ value: { data: { uuid: 'v' } } })

      const { result } = renderHook(() => usePropertyManagement())
      await act(async () => {
        await result.current.addValueToProperty('p1', { value: '42' })
      })

      expect(setPropertyValue).toHaveBeenCalledWith({
        propertyUuid: 'p1',
        value: { value: '42' },
      })
    })
  })

  describe('removePropertyFromObject', () => {
    it('soft-deletes the property', async () => {
      deleteProperty.mockResolvedValue(undefined)

      const { result } = renderHook(() => usePropertyManagement())
      let res: any
      await act(async () => {
        res = await result.current.removePropertyFromObject('obj-1', 'p1')
      })

      expect(deleteProperty).toHaveBeenCalledWith('p1')
      expect(softDeletePropertyValue).not.toHaveBeenCalled()
      expect(res).toEqual({ success: true })
    })

    it('cascades soft-delete to value uuids before deleting the property', async () => {
      deleteProperty.mockResolvedValue(undefined)
      softDeletePropertyValue.mockResolvedValue(undefined)

      const { result } = renderHook(() => usePropertyManagement())
      await act(async () => {
        await result.current.removePropertyFromObject('obj-1', 'p1', [
          'v1',
          'v2',
        ])
      })

      expect(softDeletePropertyValue).toHaveBeenCalledWith('v1')
      expect(softDeletePropertyValue).toHaveBeenCalledWith('v2')
      expect(deleteProperty).toHaveBeenCalledWith('p1')
    })

    it('does not delete the property if cascading value-delete fails', async () => {
      softDeletePropertyValue.mockRejectedValue(new Error('boom'))

      const { result } = renderHook(() => usePropertyManagement())
      await expect(
        act(async () => {
          await result.current.removePropertyFromObject('obj-1', 'p1', ['v1'])
        })
      ).rejects.toThrow('boom')

      expect(deleteProperty).not.toHaveBeenCalled()
    })
  })

  describe('createFormulaCalcForValue', () => {
    it('registers a UUID, creates the calc, and wires up two statements', async () => {
      generateUuid.mockResolvedValue('calc-uuid')
      createFormulaCalc.mockResolvedValue({ uuid: 'calc-uuid' })
      createStatement.mockResolvedValue(undefined)

      const { result } = renderHook(() => usePropertyManagement())
      let calc: any
      await act(async () => {
        calc = await result.current.createFormulaCalcForValue(
          'obj-1',
          { formulaUuid: 'formula-1' },
          [{ name: 'a', propertyValueUUID: 'v1' }],
          'v-result'
        )
      })

      expect(createFormulaCalc).toHaveBeenCalledWith({
        uuid: 'calc-uuid',
        args: [{ name: 'a', propertyValueUUID: 'v1' }],
        result: { propertyValueUUID: 'v-result' },
      })
      expect(createStatement).toHaveBeenNthCalledWith(1, {
        subject: 'formula-1',
        predicate: Predicate.HAS_MATH_FORMULA_CALC,
        object: 'calc-uuid',
      })
      expect(createStatement).toHaveBeenNthCalledWith(2, {
        subject: 'obj-1',
        predicate: Predicate.HAS_MATH_FORMULA_CALC,
        object: 'calc-uuid',
      })
      expect(calc?.uuid).toBe('calc-uuid')
    })

    it('returns null when no formula or no args are supplied', async () => {
      const { result } = renderHook(() => usePropertyManagement())
      expect(
        await result.current.createFormulaCalcForValue('obj-1', null, [], 'v')
      ).toBeNull()
      expect(generateUuid).not.toHaveBeenCalled()
    })

    it('throws when backend omits the calc UUID', async () => {
      generateUuid.mockResolvedValue('calc-uuid')
      createFormulaCalc.mockResolvedValue({}) // no uuid

      const { result } = renderHook(() => usePropertyManagement())
      await expect(
        result.current.createFormulaCalcForValue(
          'obj-1',
          { formulaUuid: 'f1' },
          [{ name: 'a', propertyValueUUID: 'v' }],
          'v-result'
        )
      ).rejects.toThrow(/calc UUID/)
      expect(createStatement).not.toHaveBeenCalled()
    })
  })

  describe('deleteFormulaCalcForValue', () => {
    it('soft-deletes via the calc mutation', async () => {
      deleteFormulaCalc.mockResolvedValue(undefined)

      const { result } = renderHook(() => usePropertyManagement())
      await act(async () => {
        await result.current.deleteFormulaCalcForValue('obj-1', 'calc-1')
      })

      expect(deleteFormulaCalc).toHaveBeenCalledWith('calc-1')
    })

    it('propagates errors from the delete mutation', async () => {
      deleteFormulaCalc.mockRejectedValue(new Error('nope'))

      const { result } = renderHook(() => usePropertyManagement())
      await expect(
        result.current.deleteFormulaCalcForValue('obj-1', 'calc-1')
      ).rejects.toThrow('nope')
    })
  })

  describe('softDeleteValue', () => {
    it('calls the soft-delete mutation with the value uuid', async () => {
      softDeletePropertyValue.mockResolvedValue('val-1')

      const { result } = renderHook(() => usePropertyManagement())
      await act(async () => {
        await result.current.softDeleteValue('val-1')
      })

      expect(softDeletePropertyValue).toHaveBeenCalledWith('val-1')
    })

    it('propagates errors from the mutation', async () => {
      softDeletePropertyValue.mockRejectedValue(new Error('boom'))

      const { result } = renderHook(() => usePropertyManagement())
      await expect(result.current.softDeleteValue('val-1')).rejects.toThrow(
        'boom'
      )
    })
  })
})
