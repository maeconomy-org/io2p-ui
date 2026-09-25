// One value appears in THREE places in this sheet: the collapsed property header, the expanded
// value row, and the grid tile. They took their text from different expressions until now, and a
// derived value is where that showed — the node writes its `data` without a unit unless the recipe
// declared one, so the row said "20,000 kg" while the header above it said "20000".

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const view = vi.hoisted(() => ({ current: 'detailed' as 'detailed' | 'grid' }))

vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => [view.current, vi.fn()],
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

/** A derived value as the node writes it with NO declared unit: `data` is the bare number. */
const DERIVED: DraftProperty[] = [
  {
    id: 'p-1',
    key: 'calculate',
    label: 'calculate',
    values: [{ id: 'v-1', data: '20000', num: 20000, unit: 'kg' }],
  },
]

const derivedValues = new Map([
  ['v-1', { expression: 'a + b', args: [], unitSource: 'inherited' }],
]) as never

function renderAs(mode: 'detailed' | 'grid') {
  view.current = mode
  const { container, unmount } = render(
    <PropertyReadView
      properties={DERIVED}
      derivedValues={derivedValues}
      allowViewToggle={false}
    />
  )
  return { container, unmount }
}

describe('one value, three places', () => {
  it('reads the same in the collapsed header and the expanded row', () => {
    renderAs('detailed')

    // The header is the collapsed trigger; expanding reveals the row underneath it.
    expect(screen.getByText('20,000 kg')).toBeInTheDocument()
    fireEvent.click(screen.getByText('calculate'))

    const shown = screen.getAllByText('20,000 kg')
    expect(shown.length).toBe(2)
  })

  it('reads the same in the grid tile', () => {
    const { container } = renderAs('grid')

    expect(container.textContent).toContain('20,000 kg')
    // The bare figure the node wrote must not survive anywhere on its own.
    expect(container.textContent).not.toMatch(/(^|[^,\d])20000([^,\d]|$)/)
  })

  it('never shows the node’s bare `data` for a derived value', () => {
    const { container } = renderAs('detailed')

    expect(container.textContent).not.toMatch(/(^|[^,\d])20000([^,\d]|$)/)
  })
})

// The node keeps 12 significant digits. A reader gets a few, a small number keeps its meaning,
// and the stored text stays on hover.
describe('a formula result reads rounded', () => {
  function renderDeclared(data: string, num: number, unit: string) {
    view.current = 'detailed'
    render(
      <PropertyReadView
        properties={[
          {
            id: 'p-2',
            key: 'log',
            label: 'log',
            values: [{ id: 'v-2', data, num, unit }],
          },
        ]}
        derivedValues={
          new Map([
            [
              'v-2',
              {
                expression: 'log(a)',
                args: [],
                unitSource: 'declared',
                declaredUnit: unit,
              },
            ],
          ]) as never
        }
        allowViewToggle={false}
      />
    )
    fireEvent.click(screen.getByText('log'))
  }

  it('to three decimals, with the stored text on hover', () => {
    renderDeclared('2.30258509299 kg', 2.30258509299, 'kg')

    expect(screen.getAllByText('2.303 kg')).toHaveLength(2)
    expect(screen.getAllByText('2.303 kg')[1]).toHaveAttribute(
      'title',
      '2.30258509299 kg'
    )
  })

  it('keeps a number below one readable, not rounded to zero', () => {
    renderDeclared('0.0015 t', 1.5, 'kg')

    expect(screen.getAllByText('0.0015 t')).toHaveLength(2)
  })
})
