import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { ResourcePicker } from '@/app/shares/components/resource-picker'
import { ParentsField } from '@/components/entity-sheet/fields/parents-field'
import {
  FormulaBindings,
  FormulaSelect,
} from '@/components/entity-sheet/fields/formula-value-editor'
import { TemplateSelector } from '@/components/entity-sheet/fields/template-selector'
import type { EntityDraft } from '@/lib/entity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    number: (n: number) => String(n),
    list: (items: string[]) => items.join(', '),
  }),
}))

vi.mock('@/hooks/ui/use-preference', () => ({
  useFlagPreference: () => [false, () => {}, true],
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

vi.mock('@/components/entity-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/entity-list')>()),
  OwnerHint: () => null,
}))

const FORMULA = {
  id: 'f-1',
  name: 'CO2',
  expression: 'volume * co2_factor',
  variables: ['volume', 'co2_factor'],
}

vi.mock('@/hooks/api/leaves', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/api/leaves')>()
  return {
    ...real,
    useFormulas: () => ({
      ...real.useFormulas(),
      useGet: () => ({ data: FORMULA }),
      usePreview: () => ({ data: undefined, isPending: false }),
    }),
  }
})

type Call = { resource: string; q?: string; signal?: AbortSignal }
const calls: Call[] = []

const pending =
  (resource: string) =>
  (query: { q?: string } | undefined, options?: { signal?: AbortSignal }) =>
    new Promise(() =>
      calls.push({ resource, q: query?.q, signal: options?.signal })
    )

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({
    objects: { list: pending('objects') },
    processes: { list: pending('processes') },
    templates: { list: pending('templates') },
    formulas: { list: pending('formulas'), get: pending('formula') },
    constants: { list: pending('constants'), get: pending('constant') },
  }),
}))

function Parents() {
  const form = useForm<EntityDraft>({
    defaultValues: { parentIds: [] } as unknown as EntityDraft,
  })
  return <ParentsField form={form} editing parentNames={new Map()} />
}

const PICKERS: [string, React.ReactNode, () => HTMLElement, string[]][] = [
  [
    'parents field',
    <Parents />,
    () => screen.getByTestId('parent-picker'),
    ['objects'],
  ],
  [
    'template selector',
    <TemplateSelector onSelect={vi.fn()} selected={null} />,
    () => screen.getByTestId('template-selector'),
    ['templates'],
  ],
  [
    'formula select',
    <FormulaSelect onSelect={vi.fn()} />,
    () => screen.getByTestId('formula-select'),
    ['formulas'],
  ],
  [
    'binding picker',
    <FormulaBindings
      calc={{ formulaId: 'f-1', args: [] }}
      siblings={[]}
      onChange={vi.fn()}
    />,
    () => screen.getByTestId('formula-bind-co2_factor'),
    ['constants'],
  ],
  [
    'resource picker',
    <ResourcePicker selectedIds={new Set()} family={null} onAdd={vi.fn()} />,
    () => screen.getByTestId('resource-picker'),
    ['objects', 'processes'],
  ],
]

const flush = () => act(() => vi.advanceTimersByTime(300))

describe('a closed picker stops its list request', () => {
  beforeEach(() => {
    calls.length = 0
    vi.useFakeTimers()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    window.HTMLElement.prototype.hasPointerCapture = vi.fn()
    window.HTMLElement.prototype.releasePointerCapture = vi.fn()
  })
  afterEach(() => vi.useRealTimers())

  it.each(PICKERS)('%s', (_, picker, trigger, resources) => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        {picker}
      </QueryClientProvider>
    )
    fireEvent.click(trigger())
    flush()
    const open = calls.filter((call) => resources.includes(call.resource))
    expect(open.map((call) => call.resource).sort()).toEqual(
      [...resources].sort()
    )
    expect(open.every((call) => call.signal?.aborted === false)).toBe(true)

    fireEvent.click(trigger())
    flush()
    expect(open.every((call) => call.signal?.aborted === true)).toBe(true)
  })

  it('resource picker aborts one family when the user switches to the other', () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ResourcePicker selectedIds={new Set()} family={null} onAdd={vi.fn()} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByTestId('resource-picker'))
    flush()
    const data = calls.filter((call) =>
      ['objects', 'processes'].includes(call.resource)
    )
    expect(data).toHaveLength(2)

    fireEvent.click(
      screen.getByRole('button', { name: 'shares.family.library' })
    )
    flush()
    expect(data.every((call) => call.signal?.aborted === true)).toBe(true)
    expect(
      calls
        .filter((call) => !['objects', 'processes'].includes(call.resource))
        .map((call) => call.resource)
        .sort()
    ).toEqual(['constants', 'formulas', 'templates'])
  })

  it.each(PICKERS)(
    '%s keeps its last search through a close with too many words',
    (_, picker, trigger, resources) => {
      render(
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          {picker}
        </QueryClientProvider>
      )
      const input = () =>
        document.querySelector<HTMLInputElement>('[cmdk-input]')!
      fireEvent.click(trigger())
      flush()
      fireEvent.change(input(), { target: { value: 'beton' } })
      flush()
      fireEvent.change(input(), {
        target: { value: 'beton a1 b2 c3 d4 e5 f6 g7 h8' },
      })
      flush()
      const before = calls.length
      fireEvent.click(trigger())
      flush()
      fireEvent.click(trigger())
      flush()

      const reopened = calls
        .slice(before)
        .filter((call) => resources.includes(call.resource))
      expect(reopened.length).toBeGreaterThan(0)
      expect(reopened.every((call) => call.q === 'beton')).toBe(true)
    }
  )

  it('binding picker says why its constants search does not run', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FormulaBindings
          calc={{ formulaId: 'f-1', args: [] }}
          siblings={[]}
          onChange={vi.fn()}
        />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByTestId('formula-bind-co2_factor'))
    const input = document.querySelector<HTMLInputElement>('[cmdk-input]')!
    fireEvent.change(input, { target: { value: 'a' } })

    const hint = document.getElementById(
      input.getAttribute('aria-describedby')!
    )!
    expect(hint).toHaveTextContent('minWordChars')
    expect(hint).toHaveAttribute('role', 'status')
  })
})
