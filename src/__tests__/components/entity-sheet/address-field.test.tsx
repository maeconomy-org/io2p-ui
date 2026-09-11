import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useForm, type UseFormReturn } from 'react-hook-form'

import { AddressField } from '@/components/entity-sheet/fields'
import type { AddressComponents } from '@/components/ui/here-address-autocomplete'
import type { EntityDraft } from '@/lib/entity'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

const PICKED: AddressComponents = {
  street: 'Stadhuisplein',
  houseNumber: '1',
  postalCode: '3811 LM',
  city: 'Amersfoort',
  country: 'Nederland',
  state: 'Utrecht',
  district: '',
  fullAddress: 'Stadhuisplein 1, 3811 LM Amersfoort, Nederland',
  lat: 52.15672,
  lng: 5.38416,
}

// Stands in for the autocomplete: one button that reports a picked suggestion, so this test is about
// what the FIELD does with the components rather than about HERE.
vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    HereAddressAutocomplete: ({
      onAddressSelect,
    }: {
      onAddressSelect: (full: string, c: AddressComponents) => void
    }) => (
      <button
        type="button"
        onClick={() => onAddressSelect(PICKED.fullAddress, PICKED)}
      >
        pick
      </button>
    ),
  }
})

/**
 * The form lives INSIDE the rendered tree, and the dirty flag is read through a rendered probe.
 *
 * Both details matter: RHF's `formState` is a Proxy that only tracks what a RENDER subscribed to, so
 * reading it off a bare hook result always reports false; and a form created in a separate
 * `renderHook` root cannot re-render this tree when `setValue` fires.
 */
function Harness({
  address,
  editing,
  capture,
}: {
  address?: EntityDraft['address']
  editing: boolean
  capture: (form: UseFormReturn<EntityDraft>) => void
}) {
  const form = useForm<EntityDraft>({
    defaultValues: { name: '', properties: [], files: [], address },
  } as never) as UseFormReturn<EntityDraft>
  capture(form)
  return (
    <>
      <AddressField form={form} editing={editing} />
      <span>{form.formState.isDirty ? 'dirty' : 'clean'}</span>
    </>
  )
}

function harness(address?: EntityDraft['address'], editing = true) {
  let form!: UseFormReturn<EntityDraft>
  render(
    <Harness
      address={address}
      editing={editing}
      capture={(f) => {
        form = f
      }}
    />
  )
  return form
}

describe('AddressField', () => {
  it('carries lat/lng from the picked suggestion into the draft', () => {
    // THE REGRESSION. `applySuggestion` enumerates fields explicitly and the type does NOT complain
    // about one left out — which is how `lat`/`lng` came to be wired end-to-end and never written.
    const form = harness()

    fireEvent.click(screen.getByText('pick'))

    expect(form.getValues('address')).toMatchObject({
      lat: 52.15672,
      lng: 5.38416,
      city: 'Amersfoort',
      fullAddress: PICKED.fullAddress,
    })
  })

  it('marks the form dirty, so Save is reachable after picking', () => {
    harness()
    expect(screen.getByText('clean')).toBeTruthy()

    fireEvent.click(screen.getByText('pick'))

    // Without `shouldDirty` the sheet's footer stays disabled and the address can never be saved.
    expect(screen.getByText('dirty')).toBeTruthy()
  })

  it('shows the coordinates in read mode, so a geocoded address is distinguishable', () => {
    harness(
      {
        fullAddress: 'Somewhere',
        city: 'Amersfoort',
        lat: 52.15672,
        lng: 5.38416,
      },
      false
    )

    expect(screen.getByText('52.15672, 5.38416')).toBeTruthy()
  })

  it('names the stored country code in read mode', () => {
    harness({ fullAddress: 'Somewhere', country: 'NL' }, false)

    expect(screen.getByText('Netherlands')).toBeTruthy()
  })

  it('shows a legacy display name unchanged rather than blank', () => {
    // Rows written before codes were stored hold "Nederland" here.
    harness({ fullAddress: 'Somewhere', country: 'Nederland' }, false)

    expect(screen.getByText('Nederland')).toBeTruthy()
  })

  it('shows no coordinate row when the lookup never resolved one', () => {
    harness({ fullAddress: 'Somewhere', city: 'Amersfoort' }, false)

    expect(screen.queryByText('objects.address.coordinates')).toBeNull()
  })

  it('does not render half a coordinate', () => {
    // Half a pair locates nothing, so it must read as absent rather than as a partial position.
    harness({ fullAddress: 'Somewhere', lat: 52.15672 }, false)

    expect(screen.queryByText('objects.address.coordinates')).toBeNull()
  })
})
