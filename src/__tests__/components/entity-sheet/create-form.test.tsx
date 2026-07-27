import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { CreateForm } from '@/components/entity-sheet/create-form'
import type { EntityDraft } from '@/lib/entity-body'

const templates = { list: vi.fn(), get: vi.fn() }
const objects = { list: vi.fn(), get: vi.fn() }
const files = { preview: vi.fn(), download: vi.fn(), get: vi.fn() }

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ templates, objects, files }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['list', vi.fn()],
}))

// The attachment modal reads runtime config for the upload size cap.
vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

// The address field talks to the HERE autocomplete API.
vi.mock('@/components/objects/here-address-autocomplete', () => ({
  HereAddressAutocomplete: () => null,
}))

const EMPTY: EntityDraft = {
  name: '',
  description: null,
  address: null,
  parentIds: [],
  properties: [],
}

function useDraft() {
  return useForm<EntityDraft>({ defaultValues: EMPTY })
}

function renderCreateForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const { result } = renderHook(() => useDraft())
  const view = render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(CreateForm, {
        form: result.current,
        parentNames: new Map(),
      })
    )
  )
  return { ...view, form: result.current }
}

describe('CreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    templates.list.mockResolvedValue({ data: [], page: {} })
    objects.list.mockResolvedValue({ data: [], page: {} })
    // cmdk instantiates ResizeObserver; the shared setup stubs it as a plain function.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  // The tabbed shell hid the required Name behind an inactive (unmounted) tab, so Save silently
  // failed with nothing to discover. Every section must be present at once.
  it('shows every section at once, with no tabs to hide a required field', () => {
    renderCreateForm()

    expect(screen.getByLabelText(/objects.fields.name/)).toBeInTheDocument()
    expect(
      screen.getByText('objects.templateSelector.label')
    ).toBeInTheDocument()
    expect(
      screen.getByText('objects.detailsSheet.tabParents')
    ).toBeInTheDocument()
    expect(screen.getByText('objects.fields.properties')).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('prefills name, description and property shape from a chosen template', async () => {
    templates.list.mockResolvedValue({
      data: [
        {
          id: 'tpl-1',
          name: 'Wall',
          description: 'A wall template',
          properties: [
            { key: 'height', label: 'Height', values: [{ data: '3' }] },
          ],
        },
      ],
      page: {},
    })

    const { form } = renderCreateForm()
    fireEvent.click(screen.getAllByRole('combobox')[0])
    await waitFor(() => expect(templates.list).toHaveBeenCalled())
    fireEvent.click(await screen.findByText('Wall'))

    await waitFor(() => expect(form.getValues('name')).toBe('Wall'))
    expect(form.getValues('description')).toBe('A wall template')
    const properties = form.getValues('properties')
    expect(properties).toHaveLength(1)
    expect(properties[0].key).toBe('height')
    // The template gives the shape; the value belongs to this object.
    expect(properties[0].values[0].data).toBe('')
  })

  it('does not overwrite a name the user already typed', async () => {
    templates.list.mockResolvedValue({
      data: [{ id: 'tpl-1', name: 'Wall', properties: [] }],
      page: {},
    })

    const { form } = renderCreateForm()
    form.setValue('name', 'My wall')

    fireEvent.click(screen.getAllByRole('combobox')[0])
    await waitFor(() => expect(templates.list).toHaveBeenCalled())
    fireEvent.click(await screen.findByText('Wall'))

    await waitFor(() => expect(form.getValues('properties')).toEqual([]))
    expect(form.getValues('name')).toBe('My wall')
  })
})

describe('CreateForm parent picker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    templates.list.mockResolvedValue({ data: [], page: {} })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  it('adds a picked object to parentIds', async () => {
    objects.list.mockResolvedValue({
      data: [{ id: 'obj-9', name: 'Building A' }],
      page: {},
    })

    const { form } = renderCreateForm()
    fireEvent.click(screen.getAllByRole('combobox')[1])
    await waitFor(() => expect(objects.list).toHaveBeenCalled())
    fireEvent.click(await screen.findByText('Building A'))

    await waitFor(() => expect(form.getValues('parentIds')).toEqual(['obj-9']))
    // Shared objects must be reachable — the node scopes lists to 'mine' by default.
    expect(objects.list.mock.calls[0][0]).toMatchObject({ scope: 'all' })
  })
})
