import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import type { EntityRollupEntry } from 'io2p-client'
import type { EntityDraft } from '@/lib/entity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
  useFormatter: () => ({
    number: (n: number) => String(n),
    list: (items: string[]) => items.join(', '),
  }),
}))

vi.mock('@/hooks/ui/use-preference', () => ({
  useFlagPreference: () => [true, () => {}, true],
  usePreference: () => ['detailed', vi.fn()],
}))

vi.mock('@/hooks/api/leaves', () => ({
  useFormulas: () => ({
    useList: () => ({ data: { data: [] } }),
    useGet: () => ({
      data: {
        id: 'f-1',
        name: 'mass',
        expression: 'u * q',
        variables: ['u', 'q'],
      },
    }),
    usePreview: () => ({ data: undefined, isPending: false }),
  }),
  useConstants: () => ({
    useList: () => ({ data: { data: [] } }),
    useByIds: () => new Map(),
  }),
}))

vi.mock('@/lib/io2p', () => ({ useIomClient: () => ({}) }))

vi.mock('@/contexts/query-context', () => ({
  useAppConfig: () => ({ maxAttachmentSizeMB: 1024 }),
}))

import { PropertyFields } from '@/components/entity-sheet/fields'

// The property form hands each formula the key its property's rule multiplies by; without that
// hop the editor's warning never fires, whatever the rules say.
describe('a quantity counted twice, through the property form', () => {
  it('warns on a formula under a multiplied property that reads the quantity', () => {
    const { result } = renderHook(() =>
      useForm<EntityDraft>({
        defaultValues: {
          name: 'Shelf',
          description: null,
          address: null,
          parentIds: [],
          properties: [
            {
              key: 'unit-mass',
              label: 'Unit mass',
              values: [{ ref: 'r-u', data: '2' }],
            },
            {
              key: 'quantity',
              label: 'Quantity',
              values: [{ ref: 'r-q', data: '4' }],
            },
            {
              key: 'mass',
              label: 'Mass',
              values: [
                {
                  ref: 'r-m',
                  calc: {
                    formulaId: 'f-1',
                    args: [
                      { var: 'u', ref: 'r-u' },
                      { var: 'q', ref: 'r-q' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      })
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PropertyFields
          form={result.current}
          editing
          derivedValues={new Map()}
          ruleMultipliers={new Map([['mass', 'quantity']])}
        />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByTestId('property-toggle-2'))
    expect(screen.getByTestId('formula-counted-twice')).toBeInTheDocument()
  })

  // The read view marks a quantity the rule refuses; the edit form showed only the grey badge, so
  // an author editing the object lost the one mark saying it drops out of the total.
  it('marks a refused quantity in edit mode too', () => {
    const { result } = renderHook(() =>
      useForm<EntityDraft>({
        defaultValues: {
          name: 'Shelf',
          description: null,
          address: null,
          parentIds: [],
          properties: [
            {
              id: 'p-c',
              key: 'count',
              label: 'Count',
              values: [
                {
                  id: 'v-c',
                  data: '1200',
                  num: 1200,
                  parse: { ok: true, normVersion: 1 },
                },
              ],
            },
          ],
        },
      })
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PropertyFields
          form={result.current}
          editing
          derivedValues={
            new Map([
              [
                'v-c',
                {
                  expression: 'v * q',
                  evalVersion: 1,
                  args: [],
                  unitVerified: false,
                },
              ],
            ])
          }
          rollups={
            new Map([
              [
                'rule-mass',
                {
                  ruleId: 'rule-mass',
                  propertyKey: 'mass',
                  multiplyBy: { propertyKey: 'count', whenMissing: 'one' },
                  buckets: [],
                  skippedCount: 0,
                  stale: false,
                  computedAt: 0,
                } as unknown as EntityRollupEntry,
              ],
            ])
          }
        />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByTestId('property-toggle-0'))

    expect(
      screen.getByRole('button', { name: 'objects.properties.unitNotChecked' })
    ).toBeInTheDocument()
  })
})
