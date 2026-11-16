import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ShareEditorSheet } from '@/app/shares/components/share-editor-sheet'
import { LibraryBulkShareSheet, ShareSheet } from '@/components/access'

const signals: AbortSignal[] = []

const emptyPage = () =>
  Promise.resolve({
    data: [],
    page: { number: 1, size: 20, totalElements: 0, totalPages: 1 },
  })

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    access: {
      grants: { list: emptyPage },
      shares: { list: emptyPage },
    },
    templates: {
      shareDependencies: () => Promise.resolve({ formulas: [], constants: [] }),
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

const SHEETS: [string, ReactNode, () => Promise<HTMLElement>][] = [
  [
    'ShareSheet',
    <ShareSheet
      open
      onOpenChange={vi.fn()}
      target={{ type: 'object', id: 'obj-1', name: 'Wall A' }}
      canViewGrants
    />,
    () => screen.findByTestId('share-add-people'),
  ],
  [
    'ShareEditorSheet',
    <ShareEditorSheet open onOpenChange={vi.fn()} mode="create" />,
    () => screen.findByTestId('member-picker'),
  ],
  [
    'LibraryBulkShareSheet',
    <LibraryBulkShareSheet
      open
      onOpenChange={vi.fn()}
      resources={[{ type: 'formula', id: 'f-1', name: 'CO2' }]}
    />,
    () => screen.findByRole('button', { name: 'access.addPeople' }),
  ],
]

describe('people pickers', () => {
  beforeEach(() => {
    signals.length = 0
  })

  it.each(SHEETS)(
    '%s searches only while open, and a close aborts the search',
    async (_, sheet, trigger) => {
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          {sheet}
        </QueryClientProvider>
      )
      const add = await trigger()
      expect(signals).toHaveLength(0)

      fireEvent.click(add)
      await waitFor(() => expect(signals).toHaveLength(1))
      expect(signals[0].aborted).toBe(false)

      fireEvent.keyDown(screen.getByPlaceholderText('access.searchPeople'), {
        key: 'Escape',
      })
      await waitFor(() => expect(signals[0].aborted).toBe(true))
    }
  )

  it.each(SHEETS)('%s opens on an empty search', async (_, sheet, trigger) => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        {sheet}
      </QueryClientProvider>
    )
    const add = await trigger()
    fireEvent.click(add)
    const input = () => screen.getByPlaceholderText('access.searchPeople')
    fireEvent.change(input(), { target: { value: 'anna' } })
    fireEvent.keyDown(input(), { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('access.searchPeople')).toBeNull()
    )

    fireEvent.click(add)
    expect(input()).toHaveValue('')
  })
})
