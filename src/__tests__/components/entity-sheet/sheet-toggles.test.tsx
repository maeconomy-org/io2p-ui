import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const view = vi.hoisted(() => ({ current: 'detailed' as 'detailed' | 'grid' }))

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => [view.current, vi.fn()],
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

import { PropertyReadView } from '@/components/entity-sheet/fields/property-read-view'
import type { DraftFile, DraftProperty } from '@/lib/entity'

const file = (name: string): DraftFile => ({
  _localId: name,
  id: name,
  kind: 'upload',
  fileName: name,
  status: 'ready',
})

function renderView(properties: DraftProperty[], rollups?: never) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <PropertyReadView
        properties={properties}
        derivedValues={new Map()}
        rollups={rollups}
      />
    </QueryClientProvider>
  )
}

const withFiles: DraftProperty = {
  id: 'p',
  key: 'manual',
  label: 'Manual',
  files: [file('b-guide.pdf'), file('a-guide.pdf')],
  values: [{ id: 'v1', data: 'chapter one', files: [file('scan.png')] }],
}

describe('files on a property and on a value', () => {
  it('opens the property’s own files from its header, sorted by name', () => {
    view.current = 'detailed'
    renderView([withFiles])

    const toggle = screen.getByRole('button', {
      name: 'objects.files.onProperty (2)',
    })
    fireEvent.click(toggle)

    // The property opens with it: its files are listed at the top of the body.
    expect(screen.getByText('chapter one')).toBeInTheDocument()
    const rows = within(screen.getByTestId('file-list')).getAllByTestId(
      'file-row'
    )
    expect(rows.map((r) => r.getAttribute('data-name'))).toEqual([
      'a-guide.pdf',
      'b-guide.pdf',
    ])
  })

  it('opens a value’s files from the end of its own line', () => {
    view.current = 'detailed'
    renderView([withFiles])
    fireEvent.click(screen.getByText('Manual'))

    fireEvent.click(
      screen.getByRole('button', { name: 'objects.files.onValue (1)' })
    )
    expect(
      within(screen.getByTestId('file-list')).getByTestId('file-row')
    ).toHaveAttribute('data-name', 'scan.png')
  })
})

describe('collapse all', () => {
  it('closes every open section at once', () => {
    view.current = 'detailed'
    renderView([withFiles])
    fireEvent.click(screen.getByText('Manual'))
    fireEvent.click(
      screen.getByRole('button', { name: 'objects.files.onValue (1)' })
    )
    expect(screen.getByTestId('file-list')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('collapse-all'))

    expect(screen.queryByTestId('file-list')).toBeNull()
    expect(screen.getByText('Manual').closest('button')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })
})

describe('the grid', () => {
  // A tile is for scanning: the name and the total. Opening a breakdown belongs to the list.
  it('shows a total as a name and a number, with nothing to open', () => {
    view.current = 'grid'
    renderView(
      [],
      new Map([
        [
          'r1',
          {
            ruleId: 'r1',
            propertyKey: 'weight',
            buckets: [
              {
                dimension: 'mass',
                unit: 'kg',
                num: 150,
                contributorCount: 9,
              },
            ],
            skippedCount: 2,
            computedAt: '2026-09-25T10:00:00Z',
            stale: false,
          },
        ],
      ]) as never
    )

    const card = screen.getByTestId('rollup-card')
    expect(card).toHaveTextContent('150 kg')
    expect(within(card).queryByTestId('rollup-toggle')).toBeNull()
    expect(within(card).queryByTestId('rollup-issue')).toBeNull()
    expect(screen.queryByTestId('collapse-all')).toBeNull()
  })
})
