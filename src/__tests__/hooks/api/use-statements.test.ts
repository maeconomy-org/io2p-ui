import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useStatements } from '@/hooks/api/use-statements'
import { queryKeys } from '@/lib/query-keys'

const searchStatements = vi.fn()
const createStatement = vi.fn()
const createStatements = vi.fn()
const softDeleteStatement = vi.fn()

vi.mock('@/contexts', () => ({
  useIomSdkClient: () => ({
    node: {
      searchStatements,
      createStatement,
      createStatements,
      softDeleteStatement,
    },
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper, queryClient, invalidateSpy }
}

describe('useStatements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useAllStatements', () => {
    it('fetches with the given body and returns data', async () => {
      const data = [{ subject: 'a', predicate: 'p', object: 'b' }]
      searchStatements.mockResolvedValue(data)

      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () =>
          useStatements().useAllStatements({
            uuStatementFind: { predicate: 'IS_INPUT_OF' as any },
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(data)
      expect(searchStatements).toHaveBeenCalledWith({
        uuStatementFind: { predicate: 'IS_INPUT_OF' },
      })
    })

    it('respects enabled=false', async () => {
      const { wrapper } = makeWrapper()
      renderHook(() => useStatements().useAllStatements({ enabled: false }), {
        wrapper,
      })
      await new Promise((r) => setTimeout(r, 10))
      expect(searchStatements).not.toHaveBeenCalled()
    })
  })

  describe('useStatementsByPredicate', () => {
    it('builds body with predicate + readDefaultGroup access', async () => {
      searchStatements.mockResolvedValue([])
      const { wrapper } = makeWrapper()

      const { result } = renderHook(
        () => useStatements().useStatementsByPredicate('IS_INPUT_OF'),
        { wrapper }
      )
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(searchStatements).toHaveBeenCalledWith({
        uuStatementFind: { predicate: 'IS_INPUT_OF', softDeleted: false },
        accessFind: { readDefaultGroup: true },
      })
    })

    it('does not fire when predicate is empty', async () => {
      const { wrapper } = makeWrapper()
      renderHook(() => useStatements().useStatementsByPredicate(''), {
        wrapper,
      })
      await new Promise((r) => setTimeout(r, 10))
      expect(searchStatements).not.toHaveBeenCalled()
    })
  })

  describe('useCreateStatement', () => {
    it('creates and invalidates statement lists + aggregates', async () => {
      createStatement.mockResolvedValue({ ok: true })
      const { wrapper, invalidateSpy } = makeWrapper()

      const { result } = renderHook(
        () => useStatements().useCreateStatement(),
        {
          wrapper,
        }
      )

      await act(async () => {
        await result.current.mutateAsync({
          subject: 'a',
          predicate: 'HAS_MATH_FORMULA_CALC' as any,
          object: 'b',
        })
      })

      expect(createStatement).toHaveBeenCalled()
      const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
      expect(invalidated).toContainEqual(queryKeys.statements.lists())
      expect(invalidated).toContainEqual(queryKeys.aggregates.all)
    })
  })

  describe('useCreateStatements (batch)', () => {
    it('sends the whole array and invalidates list scopes', async () => {
      createStatements.mockResolvedValue({ ok: true })
      const { wrapper, invalidateSpy } = makeWrapper()

      const { result } = renderHook(
        () => useStatements().useCreateStatements(),
        { wrapper }
      )

      const batch = [
        { subject: 'a', predicate: 'P' as any, object: 'b' },
        { subject: 'c', predicate: 'P' as any, object: 'd' },
      ]
      await act(async () => {
        await result.current.mutateAsync(batch as any)
      })

      expect(createStatements).toHaveBeenCalledWith(batch)
      const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
      expect(invalidated).toContainEqual(queryKeys.statements.lists())
      expect(invalidated).toContainEqual(queryKeys.aggregates.lists())
    })
  })

  describe('useObjectRelationships', () => {
    it('fires two searches (subject + object) and combines results', async () => {
      searchStatements
        .mockResolvedValueOnce([{ id: 'sub' }])
        .mockResolvedValueOnce([{ id: 'obj' }])

      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useStatements().useObjectRelationships('uuid-x'),
        { wrapper }
      )
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(searchStatements).toHaveBeenCalledTimes(2)
      expect(result.current.data).toEqual({
        asSubject: [{ id: 'sub' }],
        asObject: [{ id: 'obj' }],
        combined: [{ id: 'sub' }, { id: 'obj' }],
        total: 2,
      })
    })

    it('is disabled when uuid is empty', async () => {
      const { wrapper } = makeWrapper()
      renderHook(() => useStatements().useObjectRelationships(''), { wrapper })
      await new Promise((r) => setTimeout(r, 10))
      expect(searchStatements).not.toHaveBeenCalled()
    })
  })

  describe('useFormulaCalcStatements', () => {
    it('queries HAS_MATH_FORMULA_CALC statements for a subject', async () => {
      searchStatements.mockResolvedValue([{ subject: 'x' }])
      const { wrapper } = makeWrapper()

      const { result } = renderHook(
        () => useStatements().useFormulaCalcStatements('x'),
        { wrapper }
      )
      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(searchStatements).toHaveBeenCalledWith({
        uuStatementFind: {
          subject: 'x',
          predicate: 'HAS_MATH_FORMULA_CALC',
          softDeleted: false,
        },
      })
    })

    it('returns [] when backend returns null/undefined', async () => {
      searchStatements.mockResolvedValue(null)
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useStatements().useFormulaCalcStatements('x'),
        { wrapper }
      )
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })
  })

  describe('useDeleteStatement', () => {
    it('calls softDeleteStatement with subject/predicate/object and invalidates lists', async () => {
      softDeleteStatement.mockResolvedValue({ ok: true })
      const { wrapper, invalidateSpy } = makeWrapper()

      const { result } = renderHook(
        () => useStatements().useDeleteStatement(),
        {
          wrapper,
        }
      )

      await act(async () => {
        await result.current.mutateAsync({
          subject: 'a',
          predicate: 'P' as any,
          object: 'b',
        })
      })

      expect(softDeleteStatement).toHaveBeenCalledWith('a', 'P', 'b')
      const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
      expect(invalidated).toContainEqual(queryKeys.statements.lists())
    })

    it('toasts translated error message when mutation fails', async () => {
      softDeleteStatement.mockRejectedValue(new Error('boom'))
      const { wrapper } = makeWrapper()
      const { result } = renderHook(
        () => useStatements().useDeleteStatement(),
        {
          wrapper,
        }
      )

      await act(async () => {
        await result.current
          .mutateAsync({
            subject: 'a',
            predicate: 'P' as any,
            object: 'b',
          })
          .catch(() => {})
      })

      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('import.statementDeleteFailed')
      )
    })
  })
})
