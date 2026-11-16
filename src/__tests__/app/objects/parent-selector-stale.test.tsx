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
  reject: (error: Error) => void
}
const calls: Pending[] = []

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    objects: {
      list: (query: { q?: string }, options?: { signal?: AbortSignal }) =>
        new Promise((done, fail) =>
          calls.push({
            query,
            signal: options?.signal,
            resolve: (rows) => done({ data: rows }),
            reject: fail,
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

  it('keeps the last search when the text grows past 8 words', async () => {
    calls.length = 0
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
    fireEvent.change(input, { target: { value: 'beton' } })
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    await act(async () => calls[1].resolve([row('Beton Slab')]))

    fireEvent.change(input, {
      target: { value: 'a1 b2 c3 d4 e5 f6 g7 h8 i9' },
    })
    await act(() => new Promise((done) => setTimeout(done, 400)))

    expect(calls).toHaveLength(2)
    expect(screen.getAllByText('Beton Slab')).not.toHaveLength(0)
    expect(screen.getByTestId('search-min-hint')).toHaveTextContent('maxWords')

    fireEvent.change(input, { target: { value: 'vloer' } })
    await waitFor(() => expect(calls).toHaveLength(3), { timeout: 2000 })
    expect(calls[2].query.q).toBe('vloer')
  })

  it('runs a failed search again when the picker opens again', async () => {
    calls.length = 0
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
    fireEvent.change(input, { target: { value: 'beton' } })
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    await act(async () => calls[1].reject(new Error('503')))

    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(calls).toHaveLength(3), { timeout: 2000 })
    expect(calls[2].query.q).toBe('beton')
  })

  it('aborts its open search when it closes, and asks again on reopen', async () => {
    calls.length = 0
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
    fireEvent.change(input, { target: { value: 'beton' } })
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })

    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(calls[1].signal?.aborted).toBe(true))

    fireEvent.click(screen.getByRole('combobox'))
    expect(
      screen.queryByText('objects.parentSelector.searching')
    ).not.toBeInTheDocument()
    await waitFor(() => expect(calls).toHaveLength(3), { timeout: 2000 })
    expect(calls[2].query.q).toBe('beton')
  })

  it('loads the full list again when a failed search is cleared', async () => {
    calls.length = 0
    render(
      <ParentSelector
        allowInlineCreate={false}
        maxSelections={1}
        onParentsChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('combobox'))
    await waitFor(() => expect(calls).toHaveLength(1))
    await act(async () => calls[0].resolve([row('Some Box')]))

    const input = screen.getByRole('combobox', { expanded: true })
    fireEvent.change(input, { target: { value: 'beton' } })
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    await act(async () => calls[1].reject(new Error('503')))

    fireEvent.change(input, { target: { value: '' } })
    await waitFor(() => expect(calls).toHaveLength(3), { timeout: 2000 })
    expect(calls[2].query.q).toBeUndefined()
  })

  it('says no results, not start typing, when nine words keep an empty search', async () => {
    calls.length = 0
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
    fireEvent.change(input, { target: { value: 'beton' } })
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    await act(async () => calls[1].resolve([]))
    fireEvent.change(input, {
      target: { value: 'beton a1 b2 c3 d4 e5 f6 g7 h8' },
    })
    await act(() => new Promise((done) => setTimeout(done, 400)))

    expect(
      screen.getByText('objects.parentSelector.noResults')
    ).toBeInTheDocument()
  })

  it('marks the search words in the names it found', async () => {
    calls.length = 0
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
    fireEvent.change(input, { target: { value: 'slab' } })
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    await act(async () => calls[1].resolve([row('Beton Slab')]))

    await waitFor(() =>
      expect(
        [...document.querySelectorAll('mark')].map((mark) => mark.textContent)
      ).toEqual(['Slab'])
    )
  })

  it('says why its search failed, not that nothing matched', async () => {
    calls.length = 0
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
    fireEvent.change(input, { target: { value: 'beton' } })
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    await act(async () =>
      calls[1].reject({
        status: 422,
        detail: 'the list took too long',
      } as unknown as Error)
    )

    expect(screen.getByTestId('picker-list-error')).toHaveTextContent(
      'the list took too long'
    )
    expect(screen.queryByText('objects.parentSelector.noResults')).toBeNull()
  })
})
