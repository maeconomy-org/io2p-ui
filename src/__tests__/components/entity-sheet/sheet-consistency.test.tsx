import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['detailed', vi.fn()],
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ files: { get: vi.fn(), preview: vi.fn() } }),
}))

vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: () => ({
    useGet: () => ({
      data: { name: 'double', expression: 'x * 2', variables: ['x'] },
    }),
  }),
  useConstants: () => ({ useByIds: () => new Map() }),
}))

import { PropertyReadView } from '@/components/entity-sheet/fields/property-read-view'
import type { DraftProperty } from '@/lib/entity'

function renderView(
  properties: DraftProperty[],
  props: { heading?: string } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <PropertyReadView
        properties={properties}
        derivedValues={new Map()}
        allowFiles={false}
        {...props}
      />
    </QueryClientProvider>
  )
}

const width: DraftProperty = {
  id: 'p-w',
  key: 'width',
  label: 'Width',
  values: [{ id: 'v-w', data: '10' }],
}

describe('a template formula, closed', () => {
  it('reads as its equation, not as a dash', () => {
    renderView([
      width,
      {
        id: 'p-d',
        key: 'doubled',
        label: 'Doubled',
        values: [
          {
            id: 'v-d',
            calc: { formulaId: 'f-1', args: [{ var: 'x', ref: 'v-w' }] },
          },
        ],
      },
    ])

    const header = screen.getByText('Doubled').closest('button')!
    expect(header).toHaveTextContent('= Width × 2')
  })
})

describe('properties that share a tab with other fields', () => {
  it('carry a heading on the toolbar line', () => {
    renderView([width], { heading: 'Properties' })
    expect(
      screen.getByRole('heading', { name: 'Properties' })
    ).toBeInTheDocument()
  })

  it('keep the heading above "no properties" too', () => {
    renderView([], { heading: 'Properties' })
    expect(
      screen.getByRole('heading', { name: 'Properties' })
    ).toBeInTheDocument()
    expect(
      screen.getByText('objects.detailsSheet.noProperties')
    ).toBeInTheDocument()
  })

  it('carry no heading where the tab is the properties', () => {
    renderView([width])
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
