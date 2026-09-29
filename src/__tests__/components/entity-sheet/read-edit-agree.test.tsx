// Read and edit mode read a value through the same helpers, so a number, an equation's inputs and
// the paperclip count cannot differ when the user presses Edit.
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  renderHook,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

const objects = { list: vi.fn(), get: vi.fn() }
const files = { preview: vi.fn(), download: vi.fn(), get: vi.fn() }
const formulas = { list: vi.fn() }

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ objects, files, formulas }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
  useFormatter: () => ({
    number: (n: number, options?: Intl.NumberFormatOptions) =>
      n.toLocaleString('en-US', options),
  }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['detailed', vi.fn()],
}))

vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

import { PropertyFields } from '@/components/entity-sheet/fields'
import {
  fileCount,
  findValue,
  liveValues,
} from '@/components/entity-sheet/fields/property-values'
import type { DraftProperty, EntityDraft } from '@/lib/entity'

// `rate` is itself calculated; `doubled` reads it. Both are small numbers, where rounding to three
// decimals would print 0.
const PROPERTIES: DraftProperty[] = [
  {
    id: 'p-rate',
    key: 'rate',
    label: 'Rate',
    // The node keeps 12 significant digits; a reader sees four.
    values: [{ id: 'v-rate', data: '0.000420000001', num: 0.000420000001 }],
  },
  {
    id: 'p-doubled',
    key: 'doubled',
    label: 'Doubled',
    values: [{ id: 'v-doubled', data: '0.00084', num: 0.00084 }],
  },
]

const DERIVED = new Map([
  ['v-rate', { expression: 'a / 1000', args: [], unitSource: 'inherited' }],
  [
    'v-doubled',
    {
      expression: 'x * 2',
      args: [
        {
          var: 'x',
          source: { kind: 'property', valueId: 'v-rate' },
          value: 0.00042,
        },
      ],
      unitSource: 'inherited',
    },
  ],
]) as never

function renderSheet(
  editing: boolean,
  properties: DraftProperty[] = PROPERTIES,
  derived = DERIVED
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const { result } = renderHook(() =>
    useForm<EntityDraft>({
      defaultValues: {
        name: 'Wall',
        description: null,
        address: null,
        parentIds: [],
        properties,
      },
    })
  )
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(PropertyFields, {
        form: result.current,
        editing,
        derivedValues: derived,
        allowViewToggle: false,
      })
    )
  )
}

function doubledRow(
  editing: boolean,
  properties: DraftProperty[] = PROPERTIES
) {
  const { unmount } = renderSheet(editing, properties)
  fireEvent.click(screen.getByText('Doubled'))
  const equation = screen.getAllByTestId('provenance-equation').at(-1)!
  const shown = {
    equation: equation.textContent,
    row: equation.parentElement!.textContent ?? '',
  }
  unmount()
  return shown
}

describe('a calculated value, read and edit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    objects.list.mockResolvedValue({ data: [], page: {} })
    formulas.list.mockResolvedValue({ data: [], page: {} })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  it('reads the same number and the same inputs in both modes', () => {
    const read = doubledRow(false)
    const edit = doubledRow(true)

    expect(read.equation).toBe('= 0.00042 × 2')
    expect(edit.equation).toBe(read.equation)
    expect(read.row).toMatch(/^0\.00084\b/)
    expect(edit.row).toMatch(/^0\.00084\b/)
  })

  it('name an input with no text by its variable, in both modes', () => {
    const blank = [
      { ...PROPERTIES[0], values: [{ id: 'v-rate', data: '' }] },
      PROPERTIES[1],
    ]

    expect(doubledRow(false, blank).equation).toBe('= x × 2')
    expect(doubledRow(true, blank).equation).toBe('= x × 2')
  })

  it('read an input switched from a formula to typed text as typed, not as its old result', () => {
    // What the text/formula switch leaves on the draft: `calc: null`, the typed text, and the
    // server's old number still on the value until Save.
    const retyped = [
      {
        ...PROPERTIES[0],
        values: [{ id: 'v-rate', data: '2', num: 0.000420000001, calc: null }],
      },
      PROPERTIES[1],
    ]

    expect(doubledRow(true, retyped).equation).toBe('= 2 × 2')
  })

  it('count a property’s files in the edit header without a deleted value’s', () => {
    renderSheet(
      true,
      [
        {
          id: 'p-docs',
          key: 'docs',
          label: 'Docs',
          files: [
            { _localId: 'pf', kind: 'reference', reference: { url: 'a' } },
          ],
          values: [
            {
              id: 'v-live',
              files: [
                { _localId: 'f1', kind: 'reference', reference: { url: 'b' } },
              ],
            },
            {
              id: 'v-gone',
              deleted: true,
              files: [
                { _localId: 'f2', kind: 'reference', reference: { url: 'c' } },
              ],
            },
          ],
        },
      ],
      new Map() as never
    )

    const header = within(screen.getByTestId('property-row-0')).getByText(
      'Docs'
    ).parentElement!
    expect(header).toHaveTextContent(/2$/)
  })
})

describe('the value helpers', () => {
  const property: DraftProperty = {
    id: 'p',
    key: 'k',
    files: [{ _localId: 'pf', kind: 'reference', reference: { url: 'x' } }],
    values: [
      {
        id: 'v-live',
        files: [{ _localId: 'f1', kind: 'reference', reference: { url: 'a' } }],
      },
      {
        ref: 'r-new',
        deleted: true,
        files: [{ _localId: 'f2', kind: 'reference', reference: { url: 'b' } }],
      },
    ],
  }

  it('find a value by its id or, when unsaved, by its ref', () => {
    expect(findValue([property], 'v-live')?.value.id).toBe('v-live')
    expect(findValue([property], 'r-new')?.property.id).toBe('p')
    expect(findValue([property], 'missing')).toBeUndefined()
  })

  it('leave a deleted value out of the live ones', () => {
    expect(liveValues(property).map((v) => v.id)).toEqual(['v-live'])
  })

  it('count the property’s files and its live values’ files, not a deleted value’s', () => {
    expect(fileCount(property)).toBe(2)
  })
})
