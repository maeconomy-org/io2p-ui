import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { PropertyFields } from '@/components/entity-sheet/fields'
import { AttachmentModal } from '@/components/entity-sheet/files/attachment-modal'
import type { DraftFile, EntityDraft } from '@/lib/entity'

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

vi.mock('@/contexts', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

const NO_DERIVED = new Map<string, never>()

const ref = (id: string, label: string): DraftFile => ({
  _localId: id,
  id,
  kind: 'reference',
  reference: { url: `https://example.org/${id}` },
  label,
})

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
  render(
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
  // A stored property opens collapsed; its fields are inside.
  fireEvent.click(screen.getByText('Height'))
  return result.current
}

const fileRows = () => screen.queryAllByTestId('file-row')

describe('files in edit mode', () => {
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

  it('opens the attach dialog from a field that has no files', () => {
    renderProperties([
      { id: 'p1', key: 'height', label: 'Height', values: [{ id: 'v1' }] },
    ])

    fireEvent.click(screen.getByTestId('value-attach-0-0'))
    expect(screen.getByTestId('attachment-modal')).toBeInTheDocument()
  })

  it('lists a value’s files from its own paperclip, ending with attach', () => {
    renderProperties([
      {
        id: 'p1',
        key: 'height',
        label: 'Height',
        values: [{ id: 'v1', files: [ref('b', 'Tariff'), ref('a', 'Meter')] }],
      },
    ])

    expect(screen.queryByTestId('value-attach-0-0')).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', {
      name: 'objects.files.onValue (2)',
    })
    expect(fileRows()).toHaveLength(0)

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(fileRows().map((r) => r.dataset.name)).toEqual(['Meter', 'Tariff'])

    fireEvent.click(screen.getByTestId('files-attach-more'))
    expect(screen.getByTestId('attachment-modal')).toBeInTheDocument()
  })

  it('lists the property’s own files from the name field', () => {
    renderProperties([
      {
        id: 'p1',
        key: 'height',
        label: 'Height',
        files: [ref('a', 'Spec')],
        values: [{ id: 'v1' }],
      },
    ])

    expect(screen.queryByTestId('property-attach-0')).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'objects.files.onProperty (1)' })
    )
    expect(fileRows().map((r) => r.dataset.name)).toEqual(['Spec'])
  })

  it('opens the list it attached into, so the new file is in view', () => {
    const form = renderProperties([
      { id: 'p1', key: 'height', label: 'Height', values: [{ id: 'v1' }] },
    ])

    fireEvent.click(screen.getByTestId('value-attach-0-0'))
    fireEvent.change(screen.getByTestId('attachment-modal-url'), {
      target: { value: 'https://example.org/plan.pdf' },
    })
    fireEvent.change(screen.getByTestId('attachment-modal-label'), {
      target: { value: 'Plan' },
    })
    fireEvent.click(screen.getByTestId('attachment-modal-done'))

    expect(form.getValues('properties.0.values.0.files')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'objects.files.onValue (1)' })
    ).toHaveAttribute('aria-expanded', 'true')
    expect(fileRows().map((r) => r.dataset.name)).toEqual(['Plan'])
  })
})

describe('AttachmentModal — Done with a typed url', () => {
  function renderModal() {
    const onAdd = vi.fn()
    const onOpenChange = vi.fn()
    render(
      React.createElement(AttachmentModal, { open: true, onOpenChange, onAdd })
    )
    return { onAdd, onOpenChange }
  }

  const typeUrl = (url: string) =>
    fireEvent.change(screen.getByTestId('attachment-modal-url'), {
      target: { value: url },
    })

  beforeEach(() => vi.clearAllMocks())

  it('adds a url that was typed but never added', () => {
    const { onAdd, onOpenChange } = renderModal()
    expect(screen.getByTestId('attachment-modal-done')).toBeDisabled()

    typeUrl('https://example.org/plan.pdf')
    fireEvent.change(screen.getByTestId('attachment-modal-label'), {
      target: { value: 'Plan' },
    })
    fireEvent.click(screen.getByTestId('attachment-modal-done'))

    expect(onAdd).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'reference',
        reference: { url: 'https://example.org/plan.pdf' },
        label: 'Plan',
      }),
    ])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps an unsafe url in the box with the error, adding nothing', () => {
    const { onAdd, onOpenChange } = renderModal()

    typeUrl('http://example.org/plan.pdf')
    fireEvent.click(screen.getByTestId('attachment-modal-done'))

    expect(screen.getByText('objects.files.invalidUrl')).toBeInTheDocument()
    expect(screen.getByTestId('attachment-modal-url')).toHaveValue(
      'http://example.org/plan.pdf'
    )
    expect(onAdd).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('adds the typed url after the ones already added', () => {
    const { onAdd } = renderModal()

    typeUrl('https://example.org/first')
    fireEvent.click(screen.getByTestId('attachment-modal-add-reference'))
    typeUrl('https://example.org/second')
    fireEvent.click(screen.getByTestId('attachment-modal-done'))

    expect(
      onAdd.mock.calls[0][0].map((f: DraftFile) => f.reference?.url)
    ).toEqual(['https://example.org/first', 'https://example.org/second'])
  })
})
