import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ObjectPicker } from '@/components/entity-sheet/fields/object-picker'
import { SEARCH_SIZE } from '@/constants'
import { useObjects } from '@/hooks/api/entities'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

vi.mock('@/components/entity-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/entity-list')>()),
  OwnerHint: () => null,
}))

type Call = {
  query: { q?: string }
  signal?: AbortSignal
  resolve: (names?: string[]) => void
  reject: (error: unknown) => void
}
const calls: Call[] = []

const list = (query: { q?: string }, options?: { signal?: AbortSignal }) =>
  new Promise((done, fail) =>
    calls.push({
      reject: fail,
      query,
      signal: options?.signal,
      resolve: (names: string[] = []) =>
        done({
          data: names.map((name, i) => ({ id: `o-${i}`, name })),
          page: { totalElements: 0, totalPages: 0, number: 1, size: 20 },
        }),
    })
  )

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ objects: { list } }),
}))

function Watcher() {
  useObjects().useList({ size: SEARCH_SIZE, page: 1, scope: 'all' })
  return null
}

const flush = () => act(() => vi.advanceTimersByTime(300))

function renderPicker(extra?: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      {extra}
      <ObjectPicker value="" onSelect={vi.fn()} />
    </QueryClientProvider>
  )
}

const toggle = () => {
  fireEvent.click(screen.getByTestId('object-picker'))
  flush()
}

const type = (value: string) => {
  fireEvent.change(screen.getByTestId('object-picker-search'), {
    target: { value },
  })
  flush()
}

describe('ObjectPicker list requests', () => {
  beforeEach(() => {
    calls.length = 0
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('aborts the requests a faster search replaced', () => {
    renderPicker()
    toggle()
    type('be')
    type('bet')
    type('beto')

    expect(calls.map((call) => call.query.q)).toEqual([
      undefined,
      'be',
      'bet',
      'beto',
    ])
    expect(calls.map((call) => call.signal?.aborted)).toEqual([
      true,
      true,
      true,
      false,
    ])
  })

  it('aborts its open request when the picker closes', () => {
    renderPicker()
    toggle()
    type('beton')
    toggle()

    expect(calls.at(-1)?.query.q).toBe('beton')
    expect(calls.at(-1)?.signal?.aborted).toBe(true)
  })

  it('keeps a request another component watches: this is why not cancelQueries', () => {
    renderPicker(<Watcher />)
    expect(calls).toHaveLength(1)
    toggle()
    toggle()

    expect(calls).toHaveLength(1)
    expect(calls[0].signal?.aborted).toBe(false)
  })

  it('reopens on the answer it already has, with no new request', async () => {
    renderPicker()
    toggle()
    await act(async () => calls[0].resolve())
    toggle()
    toggle()

    expect(calls).toHaveLength(1)
  })

  it('asks again on reopen when the close aborted the request', () => {
    renderPicker()
    toggle()
    toggle()
    toggle()

    expect(calls).toHaveLength(2)
    expect(calls[0].signal?.aborted).toBe(true)
    expect(calls[1].signal?.aborted).toBe(false)
  })

  it('keeps its last search through a close when the box holds too many words', () => {
    renderPicker()
    toggle()
    type('beton')
    type('beton a1 b2 c3 d4 e5 f6 g7 h8')
    toggle()
    toggle()

    expect(calls.slice(1).map((call) => call.query.q)).toEqual(
      calls.slice(1).map(() => 'beton')
    )
  })

  it('marks the search words in the names it found', async () => {
    renderPicker()
    toggle()
    type('beton')
    await act(async () => calls.at(-1)!.resolve(['Vloer van beton']))
    act(() => vi.advanceTimersByTime(10))

    expect(
      [...document.querySelectorAll('[cmdk-item] mark')].map(
        (mark) => mark.textContent
      )
    ).toEqual(['beton'])
  })

  it('says why its list could not load, not that nothing matched', async () => {
    renderPicker()
    toggle()
    type('beton')
    await act(async () =>
      calls.at(-1)!.reject({ status: 422, detail: 'the list took too long' })
    )
    act(() => vi.advanceTimersByTime(10))

    expect(screen.getByTestId('picker-list-error')).toHaveTextContent(
      'the list took too long'
    )
    expect(document.querySelector('[cmdk-empty]')).toBeNull()
  })
})
