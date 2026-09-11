import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useObjectRelations } from '@/components/entity-sheet/hooks/use-object-relations'

const list = vi.fn()
const loggerWarn = vi.fn()

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ processes: { list } }),
}))

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: (...args: unknown[]) => loggerWarn(...args) },
}))

const OBJECT_ID = 'obj-1'

function flow(ref: string, quantity?: string, id = `flow-${ref}`) {
  return {
    id,
    ref,
    properties: quantity
      ? [
          {
            id: `prop-${id}`,
            key: 'quantity',
            values: [{ id: `val-${id}`, data: quantity, source: 'authored' }],
          },
        ]
      : undefined,
  }
}

function process(
  id: string,
  { inputs = [], outputs = [] }: { inputs?: unknown[]; outputs?: unknown[] }
) {
  return {
    id,
    name: `Process ${id}`,
    currentVersion: 1,
    createdAt: 1719230000000,
    updatedAt: 1719230000000,
    createdBy: 'u1',
    deleted: false,
    inputs,
    outputs,
  }
}

const page = (data: unknown[], totalElements = data.length) => ({
  data,
  page: { number: 1, size: 25, totalElements, totalPages: 1 },
})

/** Answers per `direction`, so the two parallel queries can be driven independently. */
function respond(byDirection: Record<string, ReturnType<typeof page>>) {
  list.mockImplementation((query: { direction: string }) =>
    Promise.resolve(byDirection[query.direction] ?? page([]))
  )
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

async function render() {
  const { result } = renderHook(() => useObjectRelations(OBJECT_ID), {
    wrapper: makeWrapper(),
  })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  return result
}

describe('useObjectRelations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks each side separately, full but without file enrichment', async () => {
    respond({})
    await render()

    expect(list).toHaveBeenCalledTimes(2)
    const directions = list.mock.calls.map((c) => c[0].direction)
    expect(directions.sort()).toEqual(['input', 'output'])

    for (const [query] of list.mock.calls) {
      expect(query.ref).toBe(OBJECT_ID)
      // Quantities live in the flow's own properties, which a lean row drops.
      expect(query.full).toBe(true)
      // Nothing here renders a file, and enrichment is the heaviest part of a row.
      expect(query.enrichFiles).toBe(false)
      // The default `mine` would hide a shared process and understate the count.
      expect(query.scope).toBe('all')
    }
  })

  it('splits by the side the server matched, and reads each flow quantity', async () => {
    respond({
      input: page([process('p1', { inputs: [flow(OBJECT_ID, '0.1 t')] })]),
      output: page([process('p2', { outputs: [flow(OBJECT_ID, '250 kg')] })]),
    })
    const result = await render()

    expect(result.current.consumedBy?.relations).toHaveLength(1)
    expect(result.current.consumedBy?.relations[0].process.id).toBe('p1')
    expect(result.current.consumedBy?.relations[0].flows[0].quantity).toBe(
      '0.1 t'
    )

    expect(result.current.producedBy?.relations[0].process.id).toBe('p2')
    expect(result.current.producedBy?.relations[0].flows[0].quantity).toBe(
      '250 kg'
    )
  })

  it('keeps only the flows pointing at this object', async () => {
    respond({
      input: page([
        process('p1', {
          inputs: [flow('other-object', '9 kg'), flow(OBJECT_ID, '1 kg')],
        }),
      ]),
    })
    const result = await render()

    const flows = result.current.consumedBy?.relations[0].flows
    expect(flows).toHaveLength(1)
    expect(flows?.[0].quantity).toBe('1 kg')
  })

  it('collects every flow when one process references the object twice', async () => {
    respond({
      input: page([
        process('p1', {
          inputs: [
            flow(OBJECT_ID, '1 kg', 'flow-a'),
            flow(OBJECT_ID, '2 kg', 'flow-b'),
          ],
        }),
      ]),
    })
    const result = await render()

    expect(
      result.current.consumedBy?.relations[0].flows.map((f) => f.id)
    ).toEqual(['flow-a', 'flow-b'])
  })

  it('leaves quantity undefined when the flow carries none', async () => {
    respond({ input: page([process('p1', { inputs: [flow(OBJECT_ID)] })]) })
    const result = await render()

    expect(result.current.consumedBy?.relations[0].flows[0].quantity).toBe(
      undefined
    )
  })

  it('keeps a matched row that carries no locatable flow, and warns', async () => {
    // Contradicts the server filter — the row matched BECAUSE a live flow points here. Dropping it
    // would under-report a real relation, so it is kept and the disagreement is logged.
    respond({
      input: page([process('p1', { inputs: [flow('someone-else')] })]),
    })
    const result = await render()

    expect(result.current.consumedBy?.relations).toHaveLength(1)
    expect(result.current.consumedBy?.relations[0].flows).toEqual([])
    expect(loggerWarn).toHaveBeenCalledTimes(1)
  })

  it('reports the server total, not the fetched count', async () => {
    respond({
      input: page([process('p1', { inputs: [flow(OBJECT_ID)] })], 42),
    })
    const result = await render()

    expect(result.current.consumedBy?.relations).toHaveLength(1)
    expect(result.current.consumedBy?.total).toBe(42)
  })

  it('does not fetch without an object id', async () => {
    respond({})
    renderHook(() => useObjectRelations(undefined), { wrapper: makeWrapper() })

    await waitFor(() => expect(list).not.toHaveBeenCalled())
  })

  it('surfaces a failing side as an error', async () => {
    list.mockImplementation((query: { direction: string }) =>
      query.direction === 'input'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(page([]))
    )
    const result = await render()

    expect(result.current.error).toBeInstanceOf(Error)
  })
})
