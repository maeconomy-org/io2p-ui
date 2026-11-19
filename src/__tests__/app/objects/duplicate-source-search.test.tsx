import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { DuplicateObjectsSheet } from '@/app/objects/components/duplicate-objects/duplicate-objects-sheet'

vi.mock('next-intl', () => ({
  useFormatter: () => ({ number: String }),
  useTranslations: () => (key: string) => key,
}))

type Call = { query: { q?: string }; signal?: AbortSignal }
const calls: Call[] = []

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    objects: {
      list: (query: { q?: string }, options?: { signal?: AbortSignal }) =>
        new Promise(() => calls.push({ query, signal: options?.signal })),
    },
  }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))
vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))

describe('DuplicateObjectsSheet source search', () => {
  it('aborts its open search when it closes, and asks again on reopen', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DuplicateObjectsSheet open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByTestId('duplicate-source-trigger'))
    await waitFor(() => expect(calls).toHaveLength(1), { timeout: 2000 })
    expect(calls[0].signal?.aborted).toBe(false)

    fireEvent.keyDown(
      screen.getByPlaceholderText('objects.duplicate.sourceObjectsHint'),
      { key: 'Escape' }
    )
    await waitFor(() => expect(calls[0].signal?.aborted).toBe(true))

    fireEvent.click(screen.getByTestId('duplicate-source-trigger'))
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    expect(calls[1].signal?.aborted).toBe(false)
  })
})
