import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
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

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['detailed', vi.fn()],
}))

vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

function renderList(properties: EntityDraft['properties'], label?: string) {
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
  render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(PropertyFields, {
        form: result.current,
        editing: true,
        derivedValues: new Map(),
        label,
      })
    )
  )
  return result.current
}

const height = { id: 'p1', key: 'height', label: 'Height', values: [] }

describe('adding a property from the end of the list', () => {
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

  it('offers a second Add under the list when the heading has one', () => {
    const form = renderList([height], 'Properties')

    expect(screen.getByTestId('add-property')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('add-property-end'))

    expect(form.getValues('properties')).toHaveLength(2)
    expect(screen.getByTestId('property-name-1')).toHaveFocus()
  })

  it('offers only the heading one while the list is empty', () => {
    renderList([], 'Properties')

    expect(screen.getByTestId('add-property')).toBeInTheDocument()
    expect(screen.queryByTestId('add-property-end')).not.toBeInTheDocument()
  })

  it('keeps one Add, at the end, where there is no heading', () => {
    renderList([height])

    expect(screen.getAllByTestId(/^add-property/)).toHaveLength(1)
    expect(screen.getByTestId('add-property')).toBeInTheDocument()
  })
})
