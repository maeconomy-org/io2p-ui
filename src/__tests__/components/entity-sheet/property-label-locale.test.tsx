import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, renderHook, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { PropertyFields } from '@/components/entity-sheet/fields'
import type { EntityDraft } from '@/lib/entity'

/**
 * A property authored in one language has to READ in the reader's own.
 *
 * `resolvePropertyLabel` has always done this and has always been unit-tested; what was missing is
 * any test that the property rows CALL it. The localized rendering shipped in the old
 * `components/properties` cluster, went out with it in the retirement refactor, and nothing failed —
 * the pre-refactor e2e spec that covered it was deleted in the same sweep. Hence a component test:
 * the seam that broke is the call site, not the function.
 */

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

function renderProperties(
  properties: EntityDraft['properties'],
  { editing }: { editing: boolean }
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
        derivedValues: NO_DERIVED,
      })
    )
  )
}

/** Authored by an English speaker: the stored label is English, the key is the shared one. */
const ENGLISH_AUTHORED: EntityDraft['properties'] = [
  { id: 'p1', key: 'weight', label: 'Weight', values: [{ data: '42 kg' }] },
]

/** No dictionary entry, so nothing to translate to. */
const FREE_TEXT: EntityDraft['properties'] = [
  {
    id: 'p2',
    key: 'vloerafwerking',
    label: 'Vloerafwerking',
    values: [{ data: 'Eiken' }],
  },
]

describe('property label follows the reader locale', () => {
  it('renders the stored label to a reader of the authoring language', () => {
    locale.current = 'en'
    renderProperties(ENGLISH_AUTHORED, { editing: false })

    expect(screen.getByText('Weight')).toBeInTheDocument()
  })

  it('renders a dictionary term in the reader OWN language', () => {
    locale.current = 'nl'
    renderProperties(ENGLISH_AUTHORED, { editing: false })

    // The payoff the dictionary exists for: an English colleague's property is readable in Dutch.
    expect(screen.getByText('Gewicht')).toBeInTheDocument()
    expect(screen.queryByText('Weight')).not.toBeInTheDocument()
  })

  it('leaves an off-dictionary label exactly as authored', () => {
    locale.current = 'nl'
    renderProperties(FREE_TEXT, { editing: false })

    expect(screen.getByText('Vloerafwerking')).toBeInTheDocument()
  })

  it('shows the same name in EDIT mode, so opening a row does not rename it', () => {
    locale.current = 'nl'
    renderProperties(ENGLISH_AUTHORED, { editing: true })

    // A stored property starts collapsed; the header is what the reader sees first.
    expect(screen.getByTestId('property-toggle-0')).toHaveTextContent('Gewicht')

    fireEvent.click(screen.getByTestId('property-toggle-0'))
    expect(screen.getByDisplayValue('Gewicht')).toBeInTheDocument()
  })

  it('never shows the raw key in place of a name', () => {
    locale.current = 'en'
    renderProperties(ENGLISH_AUTHORED, { editing: true })
    fireEvent.click(screen.getByTestId('property-toggle-0'))

    // `weight` under a field labelled "Name" is the bug an imported `gross-floor-area` exposed.
    expect(screen.queryByDisplayValue('weight')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Weight')).toBeInTheDocument()
  })
})
