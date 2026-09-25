import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => ['detailed', vi.fn()],
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
  useFormatter: () => ({
    number: (n: number, options?: Intl.NumberFormatOptions) =>
      n.toLocaleString('en-US', options),
  }),
}))

vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

import { PropertyReadView } from '@/components/entity-sheet/fields/property-read-view'
import type { DraftProperty } from '@/lib/entity'

const words = (key: string, data: string[]): DraftProperty => ({
  id: key,
  key,
  label: key,
  values: data.map((d, i) => ({ id: `${key}-${i}`, data: d })),
})

// A rule over the key, with nothing computed yet: it names the key and renders no card.
const ruleFor = (propertyKey: string) =>
  new Map([
    [
      'rule-1',
      {
        ruleId: 'rule-1',
        propertyKey,
        buckets: [],
        skippedCount: 0,
        computedAt: null,
        stale: true,
      },
    ],
  ]) as never

function renderProperties(properties: DraftProperty[], rollups?: never) {
  return render(
    <PropertyReadView
      properties={properties}
      derivedValues={new Map()}
      rollups={rollups}
      allowViewToggle={false}
    />
  )
}

describe('several values under one property', () => {
  it('names the first two in the header, then how many more', () => {
    renderProperties([words('color', ['red', 'blue', 'oak', 'teal'])])

    expect(screen.getByText('red · blue · +2')).toBeInTheDocument()
  })

  it('repeats nothing in the header once the values are open below it', () => {
    renderProperties([words('color', ['red', 'blue', 'oak'])])
    fireEvent.click(screen.getByText('Color'))

    expect(screen.queryByText('red · blue · +1')).toBeNull()
    expect(screen.getByTestId('value-chips')).toHaveTextContent('red')
  })

  it('shows short words as chips, five at first, and the rest on request', () => {
    renderProperties([
      words(
        'serial',
        Array.from({ length: 8 }, (_, i) => `A-${101 + i}`)
      ),
    ])
    fireEvent.click(screen.getByText('serial'))

    const chips = screen.getByTestId('value-chips')
    expect(within(chips).getByText('A-105')).toBeInTheDocument()
    expect(within(chips).queryByText('A-106')).toBeNull()

    fireEvent.click(
      within(chips).getByText('objects.properties.moreValues:{"count":3}')
    )
    expect(within(chips).getByText('A-108')).toBeInTheDocument()
  })

  // A number can carry a mark (a conversion, an unreadable unit): chips have no room for one.
  it('keeps a row per value when any of them is a number', () => {
    renderProperties([
      {
        id: 'w',
        key: 'weight',
        label: 'weight',
        values: [
          { id: 'w1', data: '12 kg', num: 12, unit: 'kg' },
          { id: 'w2', data: 'heavy' },
        ],
      },
    ])
    fireEvent.click(screen.getByText('Weight'))

    expect(screen.queryByTestId('value-chips')).toBeNull()
    expect(screen.getByText('12 kg')).toBeInTheDocument()
  })

  it('says a total adds every number when a rule totals the key', () => {
    const weight: DraftProperty = {
      id: 'w',
      key: 'weight',
      label: 'weight',
      values: [
        { id: 'w1', data: '12 kg', num: 12, unit: 'kg' },
        { id: 'w2', data: '30 kg', num: 30, unit: 'kg' },
      ],
    }
    const { unmount } = renderProperties([weight], ruleFor('weight'))
    fireEvent.click(screen.getByText('Weight'))
    expect(screen.getByTestId('values-totalled')).toHaveTextContent(
      'objects.properties.valuesTotalled:{"count":2}'
    )
    unmount()

    renderProperties([weight])
    fireEvent.click(screen.getByText('Weight'))
    expect(screen.queryByTestId('values-totalled')).toBeNull()
  })
})
