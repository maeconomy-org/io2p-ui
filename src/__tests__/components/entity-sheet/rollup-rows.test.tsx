import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  renderHook,
  cleanup,
} from '@testing-library/react'
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
    // The own value is 2400 kg of the 4120 kg total, so what the DESCENDANTS
    // add is 1720 kg — the number a reader would otherwise work out by hand.
    expect(
      screen.getByText(
        'objects.properties.rollupBelowShare:{"below":"1720 kg"}'
      )
    ).toBeInTheDocument()
    expect(screen.getByTestId('rollup-split-bar')).toBeInTheDocument()
  })

  // The card is collapsed by default, so a total rendered inside the disclosure would be invisible
  // until clicked — which is the same as not shipping it.
  it('renders a rollup as its own card, never inside the property', () => {
    // Derived data is not a property. Nesting it made one concept look like two
    // — attached to a value here, standalone there.
    const { container } = renderRollups(
      [massProperty()],
      new Map([['mass', entry()]])
    )
    const card = screen.getByTestId('rollup-card')
    expect(card).toBeInTheDocument()
    expect(card.querySelector('[data-testid="rollup-line"]')).toBeTruthy()

    // The property's own label lives outside the rollup card — if the rollup
    // were still nested, the card would contain both.
    expect(card).not.toContainElement(screen.getByText('2400 kg'))
    expect(container).toBeTruthy()
  })

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

  it('renders a rule covering a key the object never authored as its own card', () => {
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

    expect(screen.getAllByTestId('rollup-card')[0]).toBeInTheDocument()
    expect(screen.getByText('1650 m3')).toBeInTheDocument()
  })

  // An object may hold ONLY orphan rollups — every rule covers a key its descendants carry and it
  // does not. Testing `properties.length` alone would drop exactly those.
  it('renders rollup cards when the object has no properties at all', () => {
    renderRollups([], new Map([['mass', entry()]]))
    expect(screen.getAllByTestId('rollup-card')[0]).toBeInTheDocument()
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

  it('drops the card entirely when nothing below contributes', () => {
    // The leaf case from the field: own value 2400 kg, total 2400 kg, one
    // contributor. Printing the same quantity twice — once authored, once
    // canonical — reads as two facts about two different things.
    renderRollups(
      [massProperty()],
      new Map([
        [
          'mass',
          entry({
            buckets: [
              {
                dimension: 'mass',
                unit: 'kg',
                num: 2400,
                contributorCount: 1,
              },
            ],
          }),
        ],
      ])
    )
    // No card at all: a whole block to say "this object only" is more noise
    // than the number it replaced. It returns the moment a child contributes.
    expect(screen.queryByTestId('rollup-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rollup-line')).not.toBeInTheDocument()
  })

  it('falls back to a contributor count when the units do not match', () => {
    // A property authored in m3 cannot be subtracted from a mass total, so no
    // split is claimed rather than a wrong one computed.
    renderRollups([massProperty('m3')], new Map([['mass', entry()]]))
    expect(
      screen.getByText('objects.properties.rollupContributors:{"count":312}')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('rollup-split-bar')).not.toBeInTheDocument()
  })

  it('hides an entry the worker has never computed', () => {
    // The worker recomputes on a WRITE to the subtree, so a rule added after
    // the object was last touched stays synthesized indefinitely. "Updating…"
    // forever promises a number that is not coming.
    renderRollups(
      [massProperty()],
      new Map([['mass', entry({ buckets: [], computedAt: null, stale: true })]])
    )
    expect(screen.queryByTestId('rollup-line')).not.toBeInTheDocument()
  })

  it('keeps the previous total visible while a RE-compute is queued', () => {
    // The distinction that makes hiding the never-computed case safe: a
    // recompute still carries the last buckets, so the number stays on screen
    // with the processing note beside it.
    renderRollups(
      [massProperty()],
      new Map([['mass', entry({ computedAt: 1_700_000, stale: true })]])
    )
    expect(screen.getByText('4120 kg')).toBeInTheDocument()
    expect(screen.getByTestId('rollup-stale')).toBeInTheDocument()
  })

  it('drops the line entirely once the worker has run and found no numbers', () => {
    // The node answers with one entry per rule on every object, so a rule that
    // matched nothing here is noise, not information.
    renderRollups(
      [massProperty()],
      new Map([
        ['mass', entry({ buckets: [], computedAt: 1_700_000, stale: false })],
      ])
    )
    expect(screen.queryByTestId('rollup-line')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rollup-stale')).not.toBeInTheDocument()
  })

  it('keeps a computed-empty entry that counted values it could not read', () => {
    // `skippedCount` is the signal that a unit is wrong somewhere below, so it
    // survives the filter even with no total to show.
    renderRollups(
      [massProperty()],
      new Map([
        [
          'mass',
          entry({
            buckets: [],
            computedAt: 1_700_000,
            stale: false,
            skippedCount: 7,
          }),
        ],
      ])
    )
    expect(screen.getByTestId('rollup-skipped')).toBeInTheDocument()
  })

  // A leaf holding `5 bar` under a `pressure` rule: `bar` is in no dimension, so
  // the entry has NO bucket — and the sole-contributor test used to read the lead
  // bucket, leaving every such leaf with a card claiming something is below it.
  it('drops the card on a leaf whose own values are all unreadable', () => {
    renderRollups(
      [
        {
          id: 'p1',
          key: 'pressure',
          label: 'Pressure',
          values: [
            {
              id: 'v1',
              data: '5 bar',
              parse: { ok: false, normVersion: 1, reason: 'unknown-unit' },
            },
          ],
        },
      ],
      new Map([
        [
          'pressure',
          entry({
            ruleId: 'rule-pressure',
            propertyKey: 'pressure',
            buckets: [],
            skippedCount: 1,
          }),
        ],
      ])
    )
    expect(screen.queryByTestId('rollup-card')).not.toBeInTheDocument()
  })

  it('keeps the card when a descendant adds an unreadable value of its own', () => {
    renderRollups(
      [
        {
          id: 'p1',
          key: 'pressure',
          label: 'Pressure',
          values: [
            {
              id: 'v1',
              data: '5 bar',
              parse: { ok: false, normVersion: 1, reason: 'unknown-unit' },
            },
          ],
        },
      ],
      new Map([
        [
          'pressure',
          entry({
            ruleId: 'rule-pressure',
            propertyKey: 'pressure',
            buckets: [],
            skippedCount: 2,
          }),
        ],
      ])
    )
    expect(screen.getByTestId('rollup-skipped')).toBeInTheDocument()
  })

  it('holds the card back while a freshly authored value is unnormalized', () => {
    // `num`/`parse` arrive with the read, so between authoring and the answer
    // there is nothing to subtract from the total. The card used to appear for
    // that one render and disappear on the next fetch.
    renderRollups(
      [
        {
          id: 'p1',
          key: 'mass',
          label: 'Mass',
          values: [{ id: 'v1', data: '2400 kg' }],
        },
      ],
      new Map([
        [
          'mass',
          entry({
            buckets: [
              { dimension: 'mass', unit: 'kg', num: 2400, contributorCount: 1 },
            ],
          }),
        ],
      ])
    )
    expect(screen.queryByTestId('rollup-card')).not.toBeInTheDocument()
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

  it('drops the card when the node says nothing is below', () => {
    // `descendantCount: 0` is the node answering outright what the filter used to reconstruct by
    // subtracting the object's own values from the lead bucket.
    renderRollups(
      [massProperty()],
      new Map([['mass', entry({ descendantCount: 0 })]])
    )
    expect(screen.queryByTestId('rollup-line')).not.toBeInTheDocument()
  })

  it('keeps the card when the count is ABSENT, not zero', () => {
    // Absent means the subtree exceeded the size bound, so the number would be a floor. A
    // falsiness test would read it as "leaf" and hide the total on the largest trees — the
    // opposite of the bug the field exists to fix.
    const overBound = entry({
      buckets: [
        { dimension: 'mass', unit: 'kg', num: 9000, contributorCount: 40 },
      ],
    })
    delete (overBound as { descendantCount?: number }).descendantCount
    renderRollups([massProperty()], new Map([['mass', overBound]]))
    expect(screen.getByTestId('rollup-line')).toBeInTheDocument()
  })

  it('tells a leaf holding an unreadable value from a parent whose child holds one', () => {
    // Byte-identical entries apart from the count: `{ buckets: [], skippedCount: 1 }` is served
    // for BOTH a leaf whose own value is unreadable and a parent whose descendant's is. This is
    // the ambiguity core added the field to close.
    renderRollups(
      [massProperty()],
      new Map([
        ['mass', entry({ buckets: [], skippedCount: 1, descendantCount: 0 })],
      ])
    )
    expect(screen.queryByTestId('rollup-line')).not.toBeInTheDocument()

    cleanup()
    renderRollups(
      [massProperty()],
      new Map([
        ['mass', entry({ buckets: [], skippedCount: 1, descendantCount: 3 })],
      ])
    )
    expect(screen.getByTestId('rollup-line')).toBeInTheDocument()
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
