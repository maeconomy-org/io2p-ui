'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { HereAddressAutocomplete, Label } from '@/components/ui'
import type { AddressComponents } from '@/components/ui/here-address-autocomplete'
import { countryLabel } from '@/constants/country-codes'
import type { EntityDraft } from '@/lib/entity'

import { ReadOnlyField } from './read-only-field'

/** Street and house number read as one line, the way an address is actually written. */
function joinStreet(address: EntityDraft['address']): string | undefined {
  return [address?.street, address?.houseNumber].filter(Boolean).join(' ')
}

/** Both or neither: half a coordinate locates nothing. Five decimals is ~1 m. */
function formatCoordinates(
  address: EntityDraft['address']
): string | undefined {
  const { lat, lng } = address ?? {}
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// EDITING is one field (the full address) — the autocomplete resolves the granular components, and
// asking the user to fill them by hand would be worse. READING shows them, since by then they exist.
export function AddressField({
  form,
  editing,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
}) {
  const t = useTranslations()
  const locale = useLocale()
  // `useWatch`, NOT `form.watch` — `form` arrives as a prop, so a `watch` here subscribes the OWNER
  // and this field would keep showing the address it first rendered.
  const address = useWatch({ control: form.control, name: 'address' })

  if (!editing) {
    // Reading is where the parts earn their keep: the autocomplete resolved them, so show what was
    // actually stored rather than only the single line the user typed into.
    const parts: [string, string, string | undefined][] = [
      ['street', t('objects.address.street'), joinStreet(address)],
      ['postalCode', t('objects.address.postalCode'), address?.postalCode],
      ['city', t('objects.address.city'), address?.city],
      ['state', t('objects.address.state'), address?.state],
      // Stored as an ISO code, read back in the CURRENT UI language — so the reader's locale
      // decides the wording, not whatever language the row happened to be created in.
      [
        'country',
        t('objects.address.country'),
        countryLabel(address?.country, locale),
      ],
      // Shown, labelled, only when present. A coordinate pair means little to an asset manager, but
      // its ABSENCE means nothing either — and without this there is no way to tell a geocoded
      // address from one the lookup silently failed on.
      [
        'coordinates',
        t('objects.address.coordinates'),
        formatCoordinates(address),
      ],
    ]
    const present = parts.filter(([, , value]) => !!value?.trim())

    return (
      <ReadOnlyField label={t('objects.fields.address')}>
        <span data-testid="address-full">{address?.fullAddress || '—'}</span>
        {present.length > 0 && (
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 border-l pl-3 text-xs">
            {present.map(([key, label, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate" data-testid={`address-part-${key}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </ReadOnlyField>
    )
  }

  // Fields are enumerated, so anything new on `AddressComponents` must be added HERE too — the type
  // does not complain about a key left out, which is exactly how `lat`/`lng` came to be wired
  // end-to-end and permanently empty.
  //
  // Called TWICE per pick: once immediately without coordinates, again when the lookup resolves.
  const applySuggestion = (fullAddress: string, c: AddressComponents) => {
    form.setValue(
      'address',
      {
        street: c.street,
        houseNumber: c.houseNumber,
        postalCode: c.postalCode,
        city: c.city,
        state: c.state,
        district: c.district,
        country: c.country,
        lat: c.lat,
        lng: c.lng,
        fullAddress,
      },
      { shouldDirty: true }
    )
  }

  return (
    <div className="space-y-1.5">
      <Label>{t('objects.fields.address')}</Label>
      <HereAddressAutocomplete
        value={address?.fullAddress ?? ''}
        onAddressSelect={applySuggestion}
      />
    </div>
  )
}
