import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ShareSheet } from '@/components/access'

const signals: AbortSignal[] = []

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    access: {
      grants: {
        list: () =>
          Promise.resolve({
            data: [],
            page: { number: 1, size: 20, totalElements: 0, totalPages: 1 },
          }),
      },
      shares: {
        list: () =>
          Promise.resolve({
            data: [],
            page: { number: 1, size: 20, totalElements: 0, totalPages: 1 },
          }),
      },
    },
    users: {
      list: (_query: unknown, options?: { signal?: AbortSignal }) =>
        new Promise(() => {
          if (options?.signal) signals.push(options.signal)
        }),
    },
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '' }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

describe('ShareSheet people picker', () => {
  beforeEach(() => {
    signals.length = 0
  })

  it('searches only while open, and a close aborts the search', async () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ShareSheet
          open
          onOpenChange={vi.fn()}
          target={{ type: 'object', id: 'obj-1', name: 'Wall A' }}
          canViewGrants
        />
      </QueryClientProvider>
    )
    const add = await screen.findByTestId('share-add-people')
    expect(signals).toHaveLength(0)

    fireEvent.click(add)
    await waitFor(() => expect(signals).toHaveLength(1))
    expect(signals[0].aborted).toBe(false)

    fireEvent.keyDown(screen.getByTestId('people-search'), { key: 'Escape' })
    await waitFor(() => expect(signals[0].aborted).toBe(true))
  })
})
