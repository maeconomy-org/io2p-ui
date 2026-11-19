import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { tables, sharedByMe } = vi.hoisted(() => ({
  tables: [] as Record<string, unknown>[],
  sharedByMe: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/hooks/api/access', () => ({
  useGrants: () => ({
    useSharedByMe: sharedByMe,
    useRevoke: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }),
}))
vi.mock('@/components/entity-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/entity-list')>()),
  EntityTable: (props: Record<string, unknown>) => {
    tables.push(props)
    return null
  },
}))

import { SharedByMeTable } from '@/app/shares/components/shared-by-me-table'

describe('SharedByMeTable', () => {
  it('hands the list error and a retry to the table', () => {
    const error = { status: 503 }
    const refetch = vi.fn()
    sharedByMe.mockReturnValue({
      data: undefined,
      isFetching: false,
      error,
      refetch,
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SharedByMeTable />
      </QueryClientProvider>
    )

    const table = tables.at(-1)!
    expect(table.error).toBe(error)
    act(() => (table.onRetry as () => void)())
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
