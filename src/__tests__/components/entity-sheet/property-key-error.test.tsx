import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  renderHook,
  act,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm, type UseFormReturn } from 'react-hook-form'

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

// A property that already exists on the node: it loads COLLAPSED, which is what hides the field the
// refusal is about.
const STORED = [
  {
    id: 'p1',
    key: 'weight',
    label: 'Weight',
    values: [{ id: 'v1', data: '12' }],
  },
] as unknown as EntityDraft['properties']

function renderProperties() {
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
        properties: STORED,
      },
    })
  )
  const form = result.current
  render(
    <QueryClientProvider client={queryClient}>
      <PropertyFields form={form} editing derivedValues={NO_DERIVED} />
    </QueryClientProvider>
  )
  return { form }
}

const refuse = (form: UseFormReturn<EntityDraft>, message?: string) =>
  act(() => form.setError('properties.0.key', { type: 'required', message }))

/**
 * The submit refuses a property with content but no name. It used to say so only in a toast, and
 * the field it named sits inside a COLLAPSED row — so there was nothing to see and nothing to fix.
 */
describe('property key error', () => {
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

  it('says nothing while the row is untouched', () => {
    renderProperties()
    expect(screen.queryByTestId('property-key-error-0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('property-name-0')).not.toBeInTheDocument()
  })

  it('opens the refused row and shows the message inside it', () => {
    const { form } = renderProperties()

    refuse(form, 'objects.saveError.propertyKeyRequired')

    const message = screen.getByTestId('property-key-error-0')
    expect(message).toHaveTextContent('objects.saveError.propertyKeyRequired')
    const input = screen.getByTestId('property-name-0')
    expect(input).toBeVisible()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', message.id)
  })

  it('falls back to a generic message when the sheet named none', () => {
    const { form } = renderProperties()

    refuse(form)

    expect(screen.getByTestId('property-key-error-0')).toHaveTextContent(
      'common.nameRequired'
    )
  })

  // `setValue` does not clear a manually set error, so the combobox clears it by hand — without
  // that the row stays red and forced open after the user has already fixed it.
  it('clears once the property is named', () => {
    const { form } = renderProperties()

    refuse(form, 'objects.saveError.propertyKeyRequired')
    fireEvent.change(screen.getByTestId('property-name-0'), {
      target: { value: 'Height' },
    })

    expect(screen.queryByTestId('property-key-error-0')).not.toBeInTheDocument()
  })
})
