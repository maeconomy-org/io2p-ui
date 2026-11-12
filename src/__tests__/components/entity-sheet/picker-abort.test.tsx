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
  resolve: () => void
}
const calls: Call[] = []

const list = (query: { q?: string }, options?: { signal?: AbortSignal }) =>
  new Promise((done) =>
    calls.push({
      query,
      signal: options?.signal,
      resolve: () =>
        done({
          data: [],
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

  it('does not abort a request another component still watches', () => {
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
})
