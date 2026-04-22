import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useMathFormulas } from '@/hooks/api/use-math-formulas'
import { queryKeys } from '@/lib/query-keys'

// Mock SDK client injected via useIomSdkClient
const searchMathFormulas = vi.fn()
const createOrUpdateMathFormula = vi.fn()
const softDeleteMathFormula = vi.fn()
const createOrUpdateMathFormulaCalc = vi.fn()
const searchMathFormulaCalcs = vi.fn()
const softDeleteMathFormulaCalc = vi.fn()

vi.mock('@/contexts', () => ({
  useIomSdkClient: () => ({
    node: {
      searchMathFormulas,
      createOrUpdateMathFormula,
      softDeleteMathFormula,
      createOrUpdateMathFormulaCalc,
      searchMathFormulaCalcs,
      softDeleteMathFormulaCalc,
    },
  }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const removeSpy = vi.spyOn(queryClient, 'removeQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper, queryClient, invalidateSpy, removeSpy }
}

describe('useMathFormulas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useSearchFormulas', () => {
    it('calls node.searchMathFormulas with given params and returns data', async () => {
      const items = [{ uuid: 'f1', name: 'F1', expression: 'a+b' }]
      searchMathFormulas.mockResolvedValue(items)

      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useMathFormulas().useSearchFormulas({ softDeleted: false }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(items)
      expect(searchMathFormulas).toHaveBeenCalledWith(
        { softDeleted: false },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('skips the query when enabled=false', async () => {
      const { wrapper } = makeWrapper()
      renderHook(
        () =>
          useMathFormulas().useSearchFormulas(undefined, { enabled: false }),
        { wrapper }
      )
      // Give React Query a tick to potentially fire; it should not.
      await new Promise((r) => setTimeout(r, 10))
      expect(searchMathFormulas).not.toHaveBeenCalled()
    })
  })

  describe('useFormulaByUUID', () => {
    it('returns the first match when a formula exists', async () => {
      const formula = { uuid: 'abc', name: 'Area', expression: 'l*w' }
      searchMathFormulas.mockResolvedValue([formula])

      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useMathFormulas().useFormulaByUUID('abc'),
        { wrapper }
      )
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(formula)
    })

    it('returns null when no formula found', async () => {
      searchMathFormulas.mockResolvedValue([])
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useMathFormulas().useFormulaByUUID('missing'),
        { wrapper }
      )
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toBeNull()
    })

    it('is disabled when uuid is empty', async () => {
      const { wrapper } = makeWrapper()
      renderHook(() => useMathFormulas().useFormulaByUUID(''), { wrapper })
      await new Promise((r) => setTimeout(r, 10))
      expect(searchMathFormulas).not.toHaveBeenCalled()
    })
  })

  describe('useCreateFormula', () => {
    it('calls createOrUpdateMathFormula and invalidates formulas + aggregates', async () => {
      createOrUpdateMathFormula.mockResolvedValue({ uuid: 'new' })
      const { wrapper, invalidateSpy } = makeWrapper()

      const { result } = renderHook(
        () => useMathFormulas().useCreateFormula(),
        {
          wrapper,
        }
      )

      await act(async () => {
        await result.current.mutateAsync({
          name: 'Sum',
          expression: 'a+b',
        } as any)
      })

      expect(createOrUpdateMathFormula).toHaveBeenCalledWith({
        name: 'Sum',
        expression: 'a+b',
      })
      const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
      expect(invalidated).toContainEqual(queryKeys.formulas.all)
      expect(invalidated).toContainEqual(queryKeys.aggregates.all)
    })
  })

  describe('useDeleteFormula', () => {
    it('soft-deletes, invalidates, and removes the detail cache', async () => {
      softDeleteMathFormula.mockResolvedValue(undefined)
      const { wrapper, invalidateSpy, removeSpy } = makeWrapper()

      const { result } = renderHook(
        () => useMathFormulas().useDeleteFormula(),
        {
          wrapper,
        }
      )

      await act(async () => {
        await result.current.mutateAsync('uuid-1')
      })

      expect(softDeleteMathFormula).toHaveBeenCalledWith('uuid-1')
      const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
      expect(invalidated).toContainEqual(queryKeys.formulas.all)
      expect(invalidated).toContainEqual(queryKeys.aggregates.all)
      expect(removeSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.formulas.detail('uuid-1'),
      })
    })
  })

  describe('formula calc mutations', () => {
    it('useCreateFormulaCalc invalidates formulas + aggregates', async () => {
      createOrUpdateMathFormulaCalc.mockResolvedValue({ uuid: 'calc-1' })
      const { wrapper, invalidateSpy } = makeWrapper()

      const { result } = renderHook(
        () => useMathFormulas().useCreateFormulaCalc(),
        { wrapper }
      )

      await act(async () => {
        await result.current.mutateAsync({ mathFormulaUuid: 'f1' } as any)
      })

      expect(createOrUpdateMathFormulaCalc).toHaveBeenCalled()
      const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
      expect(invalidated).toContainEqual(queryKeys.formulas.all)
      expect(invalidated).toContainEqual(queryKeys.aggregates.all)
    })

    it('useDeleteFormulaCalc invalidates formulas + aggregates', async () => {
      softDeleteMathFormulaCalc.mockResolvedValue(undefined)
      const { wrapper, invalidateSpy } = makeWrapper()

      const { result } = renderHook(
        () => useMathFormulas().useDeleteFormulaCalc(),
        { wrapper }
      )

      await act(async () => {
        await result.current.mutateAsync('calc-1')
      })

      expect(softDeleteMathFormulaCalc).toHaveBeenCalledWith('calc-1')
      const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
      expect(invalidated).toContainEqual(queryKeys.formulas.all)
      expect(invalidated).toContainEqual(queryKeys.aggregates.all)
    })

    it('useSearchFormulaCalcs passes params through to the SDK', async () => {
      const calcs = [{ uuid: 'c1' }]
      searchMathFormulaCalcs.mockResolvedValue(calcs)

      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () =>
          useMathFormulas().useSearchFormulaCalcs({
            mathFormulaUuid: 'f1',
          } as any),
        { wrapper }
      )
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(searchMathFormulaCalcs).toHaveBeenCalledWith(
        { mathFormulaUuid: 'f1' },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(result.current.data).toEqual(calcs)
    })
  })
})
