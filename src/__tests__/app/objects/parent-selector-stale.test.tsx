import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ParentSelector } from '@/app/objects/components/duplicate-objects/components/parent-selector'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

type Pending = {
  query: { q?: string }
  signal?: AbortSignal
  resolve: (rows: { id: string; name: string; permission: string }[]) => void
}
const calls: Pending[] = []

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    objects: {
      list: (query: { q?: string }, options?: { signal?: AbortSignal }) =>
        new Promise((done) =>
          calls.push({
            query,
            signal: options?.signal,
            resolve: (rows) => done({ data: rows }),
          })
        ),
    },
  }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

vi.mock('@/components/entity-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/entity-list')>()),
  OwnerHint: () => null,
}))

vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))

const row = (name: string) => ({ id: name, name, permission: 'write' })

describe('ParentSelector search answers', () => {
  it('ignores an older answer that arrives after a newer one', async () => {
    render(
      <ParentSelector
        allowInlineCreate={false}
        maxSelections={1}
        onParentsChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(calls).toHaveLength(1))
    await act(async () => calls[0].resolve([]))

    const input = screen.getByRole('combobox', { expanded: true })
    fireEvent.change(input, { target: { value: 'st' } })
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    fireEvent.change(input, { target: { value: 'steel' } })
    await waitFor(() => expect(calls).toHaveLength(3), { timeout: 2000 })

    expect(calls[1].query.q).toBe('st')
    expect(calls[1].signal?.aborted).toBe(true)

    await act(async () => calls[2].resolve([row('Steel Box')]))
    await act(async () => calls[1].resolve([row('Stone Box')]))

    expect(await screen.findAllByText('Steel Box')).not.toHaveLength(0)
    expect(screen.queryAllByText('Stone Box')).toHaveLength(0)
  })
})
