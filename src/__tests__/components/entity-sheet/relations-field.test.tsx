import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { RelationsField } from '@/components/entity-sheet/fields'

const list = vi.fn()

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ processes: { list } }),
}))

vi.mock('@/lib/observability/logger', () => ({ logger: { warn: vi.fn() } }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useFormatter: () => ({ dateTime: () => '24 Jun 2026' }),
}))

const OBJECT_ID = 'obj-1'

function process(id: string, bag: 'inputs' | 'outputs', quantity?: string) {
  const flow = {
    id: `flow-${id}`,
    ref: OBJECT_ID,
    properties: quantity
      ? [
          {
            id: `p-${id}`,
            key: 'quantity',
            values: [{ id: `v-${id}`, data: quantity, source: 'authored' }],
          },
        ]
      : undefined,
  }
  return {
    id,
    name: `Process ${id}`,
    currentVersion: 1,
    createdAt: 1719230000000,
    updatedAt: 1719230000000,
    createdBy: 'u1',
    deleted: false,
    inputs: bag === 'inputs' ? [flow] : [],
    outputs: bag === 'outputs' ? [flow] : [],
  }
}

const page = (data: unknown[], totalElements = data.length) => ({
  data,
  page: { number: 1, size: 25, totalElements, totalPages: 1 },
})

function respond(byDirection: Record<string, ReturnType<typeof page>>) {
  list.mockImplementation((query: { direction: string }) =>
    Promise.resolve(byDirection[query.direction] ?? page([]))
  )
}

// No default parameter: a default fires on an explicitly-passed `undefined` too, so the
// unsaved-object case would silently render a saved one.
function renderField(entityId: string | undefined, onViewAll?: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(RelationsField, { entityId, onViewAll })
    )
  )
}

describe('RelationsField', () => {
  beforeEach(() => vi.clearAllMocks())

  it('groups each side under its own heading', async () => {
    respond({
      input: page([process('p1', 'inputs', '0.1 t')]),
      output: page([process('p2', 'outputs', '250 kg')]),
    })
    renderField(OBJECT_ID)

    await screen.findByText('objects.relations.consumedBy')
    expect(screen.getByText('objects.relations.producedBy')).toBeTruthy()
    expect(screen.getByText('Process p1')).toBeTruthy()
    expect(screen.getByText('Process p2')).toBeTruthy()
    expect(screen.getByText('0.1 t')).toBeTruthy()
    expect(screen.getByText('250 kg')).toBeTruthy()
  })

  it('omits a side that has no relations rather than showing an empty heading', async () => {
    respond({ input: page([process('p1', 'inputs')]) })
    renderField(OBJECT_ID)

    await screen.findByText('objects.relations.consumedBy')
    expect(screen.queryByText('objects.relations.producedBy')).toBeNull()
  })

  it('shows the empty state when neither side has relations', async () => {
    respond({})
    renderField(OBJECT_ID)

    await screen.findByText('objects.relations.empty')
  })

  it('says how many rows are not shown when the total exceeds the page', async () => {
    respond({ input: page([process('p1', 'inputs')], 30) })
    renderField(OBJECT_ID)

    // 30 matched, 1 fetched — a count that silently stopped at the page size would read as the whole
    // answer.
    await screen.findByText('objects.relations.more:{"count":29}')
  })

  it('renders a dash for a flow with no quantity', async () => {
    respond({ input: page([process('p1', 'inputs')]) })
    renderField(OBJECT_ID)

    await screen.findByText('—')
  })

  it('surfaces a load failure instead of an empty state', async () => {
    list.mockRejectedValue(new Error('boom'))
    renderField(OBJECT_ID)

    await screen.findByText('objects.relations.loadFailed')
    expect(screen.queryByText('objects.relations.empty')).toBeNull()
  })

  it('does not fetch for an unsaved object', async () => {
    respond({})
    renderField(undefined)

    await waitFor(() => expect(list).not.toHaveBeenCalled())
  })

  describe('the way out to /processes', () => {
    it('offers it when a handler is given, and reports the click', async () => {
      const onViewAll = vi.fn()
      respond({ input: page([process('p1', 'inputs')]) })
      renderField(OBJECT_ID, onViewAll)

      fireEvent.click(await screen.findByText('objects.relations.viewAll'))
      expect(onViewAll).toHaveBeenCalledTimes(1)
    })

    it('renders no button without a handler, rather than a dead one', async () => {
      respond({ input: page([process('p1', 'inputs')]) })
      renderField(OBJECT_ID)

      await screen.findByText('Process p1')
      expect(screen.queryByText('objects.relations.viewAll')).toBeNull()
    })

    it('hides it when there is nothing to view', async () => {
      respond({})
      renderField(OBJECT_ID, vi.fn())

      await screen.findByText('objects.relations.empty')
      expect(screen.queryByText('objects.relations.viewAll')).toBeNull()
    })
  })
})
