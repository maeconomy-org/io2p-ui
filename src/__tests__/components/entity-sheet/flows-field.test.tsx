import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { FlowsField } from '@/components/entity-sheet/fields'
import type { EntityDraft } from '@/lib/entity-body'
import { QUANTITY_KEY } from '@/lib/process-body'

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

const FLOW = {
  id: 'flow-1',
  ref: 'obj-1',
  refName: 'Reclaimed steel',
  properties: [
    {
      id: 'p1',
      key: QUANTITY_KEY,
      values: [{ id: 'v1', data: '800 kg' }],
    },
    {
      id: 'p2',
      key: 'grade',
      values: [{ id: 'v2', data: 'S235' }],
    },
  ],
}

function renderFlows(editing: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const { result } = renderHook(() =>
    useForm<EntityDraft>({
      defaultValues: {
        name: 'Smelt',
        description: null,
        address: null,
        parentIds: [],
        properties: [],
        inputs: [FLOW],
        outputs: [],
      },
    })
  )
  const view = render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FlowsField, {
        form: result.current,
        bag: 'inputs' as const,
        editing,
        derivedValues: NO_DERIVED,
      })
    )
  )
  return { ...view, form: result.current }
}

describe('FlowsField row', () => {
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

  it('expands when the row itself is clicked, not only the chevron', () => {
    // Reading a process, the collapsed row IS the affordance — the same as a property row. Requiring
    // a hit on the 14px chevron made the row look inert.
    renderFlows(false)

    const trigger = screen.getByRole('button', {
      name: 'processes.flows.toggleDetails',
    })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByText('Reclaimed steel'))
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('puts the object name inside the trigger so the whole row is one hit target', () => {
    renderFlows(false)

    const trigger = screen.getByRole('button', {
      name: 'processes.flows.toggleDetails',
    })
    expect(trigger).toContainElement(screen.getByText('Reclaimed steel'))
    expect(trigger).toContainElement(screen.getByText('800 kg'))
  })

  it('weights the object name above the property rows it sits beside', () => {
    // A flow names an OBJECT; without this it reads as just another property.
    renderFlows(false)

    expect(screen.getByText('Reclaimed steel')).toHaveClass('font-semibold')
  })

  it('shows the quantity on the collapsed row and counts the rest', () => {
    renderFlows(false)

    expect(screen.getByText('800 kg')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument() // `grade`, not shown on the row
  })

  it('keeps the picker and quantity input out of the trigger while editing', () => {
    // A control cannot be nested inside a button; the chevron keeps the toggle job in edit mode.
    renderFlows(true)

    const trigger = screen.getByRole('button', {
      name: 'processes.flows.toggleDetails',
    })
    const quantity = screen.getByLabelText('processes.flows.quantity')

    expect(trigger).not.toContainElement(quantity)
    expect(quantity).toBeInTheDocument()
  })

  it('still toggles from the chevron while editing', () => {
    renderFlows(true)

    const trigger = screen.getByRole('button', {
      name: 'processes.flows.toggleDetails',
    })
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})
