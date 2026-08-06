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

const NO_DERIVED = new Map<string, never>()

function renderProperties(properties: EntityDraft['properties']) {
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
  const view = render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(PropertyFields, {
        form: result.current,
        editing: true,
        derivedValues: NO_DERIVED,
      })
    )
  )
  return { ...view, form: result.current }
}

// Two clicks: the trash icon asks, the Confirm button commits. Mirrors the file rows.
function confirmRemoveProperty() {
  fireEvent.click(screen.getAllByRole('button', { name: 'common.remove' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }))
}

describe('property soft delete', () => {
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

  // The platform never destroys data: a stored property is MARKED so the save is a reversible soft
  // delete. Dropping it from the draft would emit the same `remove` but lose the way back.
  it('marks a stored property instead of dropping it', () => {
    const { form } = renderProperties([
      { id: 'p1', key: 'height', label: 'Height', values: [{ id: 'v1' }] },
    ])

    confirmRemoveProperty()

    expect(form.getValues('properties')).toHaveLength(1)
    expect(form.getValues('properties.0.deleted')).toBe(true)
  })

  it('shows a deleted property struck through, with a way back', () => {
    const { form } = renderProperties([
      { id: 'p1', key: 'height', label: 'Height', values: [{ id: 'v1' }] },
    ])

    confirmRemoveProperty()

    expect(screen.getByText('Height')).toBeInTheDocument()
    expect(screen.getByText('common.deleted')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'common.restore Height' })
    )
    expect(form.getValues('properties.0.deleted')).toBe(false)
  })

  // A property that was never saved has nothing to preserve — marking it would leave an
  // unrestorable ghost in the draft that the builder skips anyway.
  it('drops a property that was never stored', () => {
    const { form } = renderProperties([
      { key: 'draft-only', label: 'Draft only', values: [{ ref: 'r1' }] },
    ])

    confirmRemoveProperty()

    expect(form.getValues('properties')).toHaveLength(0)
  })

  it('marks a stored value and leaves its property alone', () => {
    const { form } = renderProperties([
      {
        id: 'p1',
        key: 'height',
        label: 'Height',
        values: [
          { id: 'v1', data: '3' },
          { id: 'v2', data: '4' },
        ],
      },
    ])

    // The property card starts collapsed for a stored property; open it to reach the values.
    fireEvent.click(screen.getByText('Height'))
    const removeButtons = screen.getAllByRole('button', {
      name: 'common.remove',
    })
    // [0] is the property's own delete; the value rows follow.
    fireEvent.click(removeButtons[1])

    expect(form.getValues('properties.0.values')).toHaveLength(2)
    expect(form.getValues('properties.0.values.0.deleted')).toBe(true)
    expect(form.getValues('properties.0.deleted')).toBeFalsy()
  })
})
