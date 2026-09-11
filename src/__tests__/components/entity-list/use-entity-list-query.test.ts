import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useEntityListQuery } from '@/components/entity-list/use-entity-list-query'

describe('useEntityListQuery', () => {
  it('starts from defaults', () => {
    const { result } = renderHook(() =>
      useEntityListQuery({ size: 20, scope: 'all' })
    )
    expect(result.current.query).toEqual({
      page: 1,
      size: 20,
      sort: undefined,
      scope: 'all',
    })
  })

  it('setPage changes only the page', () => {
    const { result } = renderHook(() => useEntityListQuery())
    act(() => result.current.setPage(3))
    expect(result.current.query.page).toBe(3)
  })

  it('setSort resets to page 1', () => {
    const { result } = renderHook(() => useEntityListQuery())
    act(() => result.current.setPage(4))
    act(() => result.current.setSort('-createdAt'))
    expect(result.current.query.sort).toBe('-createdAt')
    expect(result.current.query.page).toBe(1)
  })

  it('setSearch clears an empty string to undefined', () => {
    const { result } = renderHook(() => useEntityListQuery())
    act(() => result.current.setSearch(''))
    expect(result.current.query.q).toBeUndefined()
  })
})
