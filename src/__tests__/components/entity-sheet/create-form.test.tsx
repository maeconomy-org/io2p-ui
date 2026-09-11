import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { CreateForm } from '@/components/entity-sheet/create-form'
import type { EntityDraft } from '@/lib/entity'

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

function useDraft(defaults: EntityDraft) {
  return useForm<EntityDraft>({ defaultValues: defaults })
}

function renderCreateForm(
  options: {
    draft?: Partial<EntityDraft>
    parentNames?: Map<string, string>
  } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const { result } = renderHook(() => useDraft({ ...EMPTY, ...options.draft }))
  const view = render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(CreateForm, {
        form: result.current,
        parentNames: options.parentNames ?? new Map(),
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

  it('prefills name, description and the full property preset from a chosen template', async () => {
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
    // A template is a PRESET, so its values arrive as defaults the user can overwrite. Blanking them
    // also threw away formula recipes, which is what made a templated formula show as a text box.
    expect(properties[0].values[0].data).toBe('3')
  })

  it('carries a template formula, with its binding intact, onto the new object', async () => {
    const calc = { formulaId: 'f-area', args: [{ var: 'h', ref: 'tmp-h' }] }
    templates.list.mockResolvedValue({
      data: [
        {
          id: 'tpl-1',
          name: 'Wall',
          properties: [
            { key: 'height', values: [{ data: '', ref: 'tmp-h' }] },
            { key: 'area', values: [{ data: '', ref: 'tmp-a', calc }] },
          ],
        },
      ],
      page: {},
    })

    const { form } = renderCreateForm()
    fireEvent.click(screen.getAllByRole('combobox')[0])
    await waitFor(() => expect(templates.list).toHaveBeenCalled())
    fireEvent.click(await screen.findByText('Wall'))

    await waitFor(() => expect(form.getValues('properties')).toHaveLength(2))
    const properties = form.getValues('properties')
    expect(properties[1].values[0].calc).toEqual(calc)

    // The node resolves calc args by ref within one request, so the arg must name a ref this draft
    // actually declares — otherwise the create 422s, or binds to nothing.
    const declared = properties.flatMap((p) => p.values.map((v) => v.ref))
    expect(declared).toContain(calc.args[0].ref)
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

  // The "add child" flow presets a parent the draft never fetched, so the only source for its name
  // is the caller. Without it the badge falls back to the raw UUID.
  it('renders a preset parent by name when the caller supplies one', () => {
    renderCreateForm({
      draft: { parentIds: ['obj-9'] },
      parentNames: new Map([['obj-9', 'Building A']]),
    })

    expect(screen.getByText('Building A')).toBeInTheDocument()
    expect(screen.queryByText('obj-9')).not.toBeInTheDocument()
  })

  it('falls back to the id when no name is known', () => {
    renderCreateForm({ draft: { parentIds: ['obj-9'] } })

    expect(screen.getByText('obj-9')).toBeInTheDocument()
  })
})
