import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { PropertyFields } from '@/components/entity-sheet/fields'
import type { EntityDraft } from '@/lib/entity'

const objects = { list: vi.fn(), get: vi.fn() }
const files = { preview: vi.fn(), download: vi.fn(), get: vi.fn() }
const formulas = { list: vi.fn() }

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ objects, files, formulas }),
}))

const locale = vi.hoisted(() => ({ current: 'en' }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => locale.current,
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['detailed', vi.fn()],
}))

vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

const NO_DERIVED = new Map<string, never>()

// Authoring order, which is the order the node returns. The three are chosen so
// that BOTH locales sort them differently from this order and from each other.
const PROPERTIES: EntityDraft['properties'] = [
  { id: 'p1', key: 'weight', label: 'Weight', values: [{ data: '42 kg' }] },
  { id: 'p2', key: 'height', label: 'Height', values: [{ data: '3 m' }] },
  { id: 'p3', key: 'width', label: 'Width', values: [{ data: '2 m' }] },
]

function renderProperties({ editing }: { editing: boolean }) {
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
        properties: PROPERTIES,
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
        derivedValues: NO_DERIVED,
      })
    )
  )
}

function orderOf(container: HTMLElement, ...labels: string[]) {
  const text = container.textContent ?? ''
  return [...labels].sort((a, b) => text.indexOf(a) - text.indexOf(b))
}

describe('read-only properties are listed by name', () => {
  it('sorts alphabetically rather than keeping authoring order', () => {
    locale.current = 'en'
    const { container } = renderProperties({ editing: false })

    expect(orderOf(container, 'Weight', 'Height', 'Width')).toEqual([
      'Height',
      'Weight',
      'Width',
    ])
  })

  it('sorts by the READER label, so each locale reads alphabetical', () => {
    // Dutch reorders the same three — Breedte, Gewicht, Hoogte — which sorting
    // on the stored English label or on the key would get wrong.
    locale.current = 'nl'
    const { container } = renderProperties({ editing: false })

    expect(orderOf(container, 'Gewicht', 'Hoogte', 'Breedte')).toEqual([
      'Breedte',
      'Gewicht',
      'Hoogte',
    ])
  })

  it('leaves EDIT mode in authoring order, so a row does not move as it is renamed', () => {
    locale.current = 'en'
    const { container } = renderProperties({ editing: true })

    expect(orderOf(container, 'Weight', 'Height', 'Width')).toEqual([
      'Weight',
      'Height',
      'Width',
    ])
  })
})
