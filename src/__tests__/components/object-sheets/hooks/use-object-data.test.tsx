import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useObjectData } from '@/components/object-sheets/hooks/use-object-data'

// ─── Mocks ───────────────────────────────────────────

const useAggregateByUUID = vi.fn()
const useAggregateByUUIDWithHistory = vi.fn()

vi.mock('@/hooks', () => ({
  useAggregate: () => ({
    useAggregateByUUID,
    useAggregateByUUIDWithHistory,
  }),
}))

vi.mock('@/components/properties/utils/formula-mapping', () => ({
  mapAggregateResponseToFormulaData: (mf: any) => ({
    expression: mf.expression ?? 'a + b',
    variables: mf.variables ?? [],
  }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper }
}

function defaultQueryReturn(data: any = undefined) {
  return { data, isLoading: false, refetch: vi.fn() }
}

describe('useObjectData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAggregateByUUID.mockReturnValue(defaultQueryReturn())
    useAggregateByUUIDWithHistory.mockReturnValue(defaultQueryReturn())
  })

  it('returns null/empty fields when neither aggregate nor initialObject is available', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjectData({ uuid: undefined, isOpen: false }),
      { wrapper }
    )
    expect(result.current.object).toBeNull()
    expect(result.current.aggregate).toBeNull()
    expect(result.current.properties).toEqual([])
    expect(result.current.files).toEqual([])
    expect(result.current.addressInfo).toBeNull()
  })

  it('falls back to initialObject when the aggregate query has no data yet', () => {
    const { wrapper } = makeWrapper()
    const initialObject = {
      uuid: 'o1',
      name: 'Pre-loaded',
      properties: [],
      files: [],
    }
    const { result } = renderHook(
      () => useObjectData({ uuid: 'o1', isOpen: true, initialObject }),
      { wrapper }
    )
    expect(result.current.object?.uuid).toBe('o1')
    expect(result.current.object?.name).toBe('Pre-loaded')
  })

  it('lazy-history: with hasHistory=false, base query is enabled and history query is NOT', () => {
    const { wrapper } = makeWrapper()
    renderHook(
      () => useObjectData({ uuid: 'o1', isOpen: true, hasHistory: false }),
      { wrapper }
    )

    // Last call's options object holds the `enabled` flag.
    const baseOpts = useAggregateByUUID.mock.calls.at(-1)?.[1]
    const historyOpts = useAggregateByUUIDWithHistory.mock.calls.at(-1)?.[1]
    expect(baseOpts?.enabled).toBe(true)
    expect(historyOpts?.enabled).toBe(false)
  })

  it('lazy-history: with hasHistory=true, history query is enabled and base query is NOT', () => {
    const { wrapper } = makeWrapper()
    renderHook(
      () => useObjectData({ uuid: 'o1', isOpen: true, hasHistory: true }),
      { wrapper }
    )

    const baseOpts = useAggregateByUUID.mock.calls.at(-1)?.[1]
    const historyOpts = useAggregateByUUIDWithHistory.mock.calls.at(-1)?.[1]
    expect(baseOpts?.enabled).toBe(false)
    expect(historyOpts?.enabled).toBe(true)
  })

  it('filters out softDeleted properties and softDeleted values', () => {
    const aggregate = {
      uuid: 'o1',
      name: 'O',
      properties: [
        {
          uuid: 'p1',
          softDeleted: false,
          values: [
            { uuid: 'v1', softDeleted: false, value: 'keep' },
            { uuid: 'v2', softDeleted: true, value: 'gone' },
          ],
        },
        {
          uuid: 'p2',
          softDeleted: true,
          values: [{ uuid: 'v3', softDeleted: false, value: 'gone' }],
        },
      ],
      files: [],
    }
    useAggregateByUUID.mockReturnValue(defaultQueryReturn(aggregate))

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjectData({ uuid: 'o1', isOpen: true }),
      { wrapper }
    )

    expect(result.current.properties).toHaveLength(1)
    expect(result.current.properties[0].uuid).toBe('p1')
    expect(result.current.properties[0].values).toHaveLength(1)
    expect(result.current.properties[0].values[0].uuid).toBe('v1')
  })

  it('attaches formulaData to property values whose uuid matches a mathFormulaCalc result', () => {
    const aggregate = {
      uuid: 'o1',
      properties: [
        {
          uuid: 'p1',
          softDeleted: false,
          values: [
            { uuid: 'v-result', softDeleted: false, value: '42' },
            { uuid: 'v-plain', softDeleted: false, value: '7' },
          ],
        },
      ],
      mathFormulas: [
        {
          mathFormulaCalc: {
            uuid: 'calc-1',
            result: { propertyValueUUID: 'v-result' },
          },
          expression: 'a + b',
        },
      ],
      files: [],
    }
    useAggregateByUUID.mockReturnValue(defaultQueryReturn(aggregate))

    const { wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useObjectData({ uuid: 'o1', isOpen: true }),
      { wrapper }
    )

    const values = result.current.properties[0].values
    const enriched = values.find((v: any) => v.uuid === 'v-result')
    const plain = values.find((v: any) => v.uuid === 'v-plain')

    expect(enriched.formulaData).toMatchObject({
      expression: 'a + b',
      calcUuid: 'calc-1',
    })
    expect(plain.formulaData).toBeUndefined()
  })
})
