'use client'

import { useTranslations } from 'next-intl'
import type { UseFormReturn } from 'react-hook-form'

import { HereAddressAutocomplete, Input, Label } from '@/components/ui'
import type { AddressComponents } from '@/components/ui/here-address-autocomplete'
import type { EntityDraft } from '@/lib/entity-body'

import { ReadOnlyField } from './read-only-field'

// Address sub-fields shown for manual correction (lat/lng come from geocoding, not edited here).
const PARTS = [
  { key: 'street', i18n: 'objects.address.street' },
  { key: 'houseNumber', i18n: 'objects.address.number' },
  { key: 'postalCode', i18n: 'objects.address.postalCode' },
  { key: 'city', i18n: 'objects.address.city' },
  { key: 'state', i18n: 'objects.address.state' },
  { key: 'district', i18n: 'objects.address.district' },
  { key: 'country', i18n: 'objects.address.country' },
] as const

export function AddressField({
  form,
  editing,
}: {
  form: UseFormReturn<EntityDraft>
  editing: boolean
}) {
  const t = useTranslations()
  const address = form.watch('address')

  if (!editing) {
    if (address?.fullAddress) {
      return (
        <ReadOnlyField label={t('objects.fields.address')}>
          {address.fullAddress}
        </ReadOnlyField>
      )
    }
    const filled = PARTS.filter((p) => address?.[p.key])
    if (filled.length === 0) {
      return <p className="text-sm text-muted-foreground">—</p>
    }
    return (
      <dl className="grid grid-cols-2 gap-4">
        {filled.map((p) => (
          <ReadOnlyField key={p.key} label={t(p.i18n)}>
            {address?.[p.key]}
          </ReadOnlyField>
        ))}
      </dl>
    )
  }

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
        fullAddress,
      },
      { shouldDirty: true }
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t('objects.fields.address')}</Label>
        <HereAddressAutocomplete
          value={address?.fullAddress ?? ''}
          onAddressSelect={applySuggestion}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {PARTS.map((p) => (
          <div key={p.key} className="space-y-1.5">
            <Label htmlFor={`address-${p.key}`}>{t(p.i18n)}</Label>
            <Input
              id={`address-${p.key}`}
              {...form.register(`address.${p.key}`)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
