import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import type { EntityRollupEntry } from 'io2p-client'

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

let view: 'detailed' | 'grid' = 'detailed'
vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => [view, vi.fn()],
}))

vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

const NO_DERIVED = new Map<string, never>()

function entry(over: Partial<EntityRollupEntry> = {}): EntityRollupEntry {
  return {
    ruleId: 'rule-mass',
    propertyKey: 'mass',
    buckets: [
      { dimension: 'mass', unit: 'kg', num: 4120, contributorCount: 312 },
    ],
    skippedCount: 0,
    stale: false,
    computedAt: 1_754_898_000_000,
    ...over,
  } as EntityRollupEntry
}

function massProperty(unit = 'kg') {
  return {
    id: 'p1',
    key: 'mass',
    label: 'Mass',
    values: [{ id: 'v1', data: `2400 ${unit}`, num: 2400, unit }],
  }
}

function renderRollups(
  properties: EntityDraft['properties'],
  rollups: Map<string, EntityRollupEntry>
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const { result } = renderHook(() =>
    useForm<EntityDraft>({
      defaultValues: {
        name: 'Building',
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
        editing: false,
        derivedValues: NO_DERIVED,
        rollups,
      })
    )
  )
}

describe('rollup rows in the property read view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    view = 'detailed'
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  it('shows the total beside the property that carries the key', () => {
    renderRollups([massProperty()], new Map([['mass', entry()]]))

    expect(screen.getByTestId('rollup-line')).toBeInTheDocument()
    expect(screen.getByText('4120 kg')).toBeInTheDocument()
    expect(
      screen.getByText('objects.properties.rollupContributors:{"count":312}')
    ).toBeInTheDocument()
  })

  // The card is collapsed by default, so a total rendered inside the disclosure would be invisible
  // until clicked — which is the same as not shipping it.
  it('shows the total without expanding the card', () => {
    renderRollups([massProperty()], new Map([['mass', entry()]]))
    expect(screen.getByText('4120 kg')).toBeVisible()
  })

  // The collapsed trigger summarises many values as "3 values" rather than a number; the total is
  // its own line and must be unaffected by that.
  it('shows the total on a multi-valued property', () => {
    const property = {
      ...massProperty(),
      values: [
        { id: 'v1', data: '2400 kg', num: 2400, unit: 'kg' },
        { id: 'v2', data: '900 kg', num: 900, unit: 'kg' },
      ],
    }
    renderRollups([property], new Map([['mass', entry()]]))
    expect(screen.getByText('4120 kg')).toBeInTheDocument()
  })

  it('renders a rule covering a key the object never authored', () => {
    renderRollups(
      [massProperty()],
      new Map([
        ['mass', entry()],
        [
          'volume',
          entry({
            ruleId: 'rule-volume',
            propertyKey: 'volume',
            buckets: [
              {
                dimension: 'volume',
                unit: 'm3',
                num: 1650,
                contributorCount: 44,
              },
            ],
          }),
        ],
      ])
    )

    expect(screen.getByTestId('orphan-rollup')).toBeInTheDocument()
    expect(screen.getByText('1650 m3')).toBeInTheDocument()
  })

  // An object may hold ONLY orphan rollups — every rule covers a key its descendants carry and it
  // does not. Testing `properties.length` alone would drop exactly those.
  it('renders orphans when the object has no properties at all', () => {
    renderRollups([], new Map([['mass', entry()]]))
    expect(screen.getByTestId('orphan-rollup')).toBeInTheDocument()
  })

  it('never adds buckets together, and counts the ones it hides', () => {
    const mixed = entry({
      buckets: [
        { dimension: 'mass', unit: 'kg', num: 4120, contributorCount: 312 },
        { dimension: 'volume', unit: 'm3', num: 1650, contributorCount: 44 },
      ],
    })
    renderRollups([massProperty()], new Map([['mass', mixed]]))

    expect(screen.getByText('4120 kg')).toBeInTheDocument()
    expect(
      screen.getByText('objects.properties.rollupMoreDimensions:{"count":1}')
    ).toBeInTheDocument()
    // 5770 is 4120 + 1650 — the number that must never appear.
    expect(screen.queryByText(/5770/)).not.toBeInTheDocument()
  })

  // A bucket in a different unit under the same key usually means a mis-keyed value, so it opens
  // by itself rather than hiding behind a click nobody makes.
  it('opens a foreign-unit bucket without being asked', () => {
    const mixed = entry({
      buckets: [
        { dimension: 'mass', unit: 'kg', num: 4120, contributorCount: 312 },
        { dimension: 'volume', unit: 'm3', num: 1650, contributorCount: 44 },
      ],
    })
    renderRollups([massProperty()], new Map([['mass', mixed]]))
    expect(screen.getByText('1650 m3')).toBeInTheDocument()
  })

  it('keeps a same-unit bucket behind the expander', () => {
    const twoMass = entry({
      buckets: [
        { dimension: 'mass', unit: 'kg', num: 4120, contributorCount: 312 },
        { dimension: 'mass', unit: 'kg', num: 90, contributorCount: 3 },
      ],
    })
    renderRollups([massProperty()], new Map([['mass', twoMass]]))

    expect(screen.queryByText('90 kg')).not.toBeInTheDocument()
    // By text, not by role: the property card's own collapsible trigger is a collapsed button too.
    fireEvent.click(
      screen.getByText('objects.properties.rollupMoreDimensions:{"count":1}')
    )
    expect(screen.getByText('90 kg')).toBeInTheDocument()
  })

  it('keeps the last number visible while a recompute is queued', () => {
    renderRollups([massProperty()], new Map([['mass', entry({ stale: true })]]))
    expect(screen.getByText('4120 kg')).toBeInTheDocument()
    expect(screen.getByTestId('rollup-stale')).toBeInTheDocument()
  })

  it('says so when nothing has been computed yet', () => {
    renderRollups(
      [massProperty()],
      new Map([['mass', entry({ buckets: [], computedAt: null, stale: true })]])
    )
    expect(
      screen.getByText('objects.properties.rollupNotCalculated')
    ).toBeInTheDocument()
  })

  it('surfaces values the node could not read as numbers', () => {
    renderRollups(
      [massProperty()],
      new Map([['mass', entry({ skippedCount: 7 })]])
    )
    expect(
      screen.getByText('objects.properties.rollupSkipped:{"count":7}')
    ).toBeInTheDocument()
  })

  // `error` arrives INSIDE a 200 response, so it is a state of the row and not a failed request.
  it('renders a too-large subtree as a row state', () => {
    renderRollups(
      [massProperty()],
      new Map([
        [
          'mass',
          entry({
            buckets: [],
            error: {
              code: 'subtree-too-large',
              detail: 'subtree exceeds 50000',
            },
          }),
        ],
      ])
    )
    expect(
      screen.getByText('objects.properties.rollupSubtreeTooLarge')
    ).toBeInTheDocument()
  })

  it('renders nothing when no rule covers the key', () => {
    renderRollups([massProperty()], new Map())
    expect(screen.queryByTestId('rollup-line')).not.toBeInTheDocument()
    expect(screen.queryByTestId('orphan-rollup')).not.toBeInTheDocument()
  })

  it('formats a unitless bucket without a trailing space', () => {
    const unitless = entry({
      buckets: [{ dimension: 'unitless', num: 820, contributorCount: 12 }],
    })
    renderRollups([massProperty()], new Map([['mass', unitless]]))
    expect(screen.getByText('820')).toBeInTheDocument()
  })

  it('shows totals and orphans in the grid view too', () => {
    view = 'grid'
    renderRollups(
      [massProperty()],
      new Map([
        ['mass', entry()],
        [
          'volume',
          entry({
            ruleId: 'rule-volume',
            propertyKey: 'volume',
            buckets: [
              {
                dimension: 'volume',
                unit: 'm3',
                num: 1650,
                contributorCount: 44,
              },
            ],
          }),
        ],
      ])
    )

    expect(screen.getByText('4120 kg')).toBeInTheDocument()
    expect(screen.getByText('1650 m3')).toBeInTheDocument()
  })
})
