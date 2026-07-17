'use client'

import { useTranslations } from 'next-intl'
import type { UseFormReturn } from 'react-hook-form'

import { HereAddressAutocomplete, Label } from '@/components/ui'
import type { AddressComponents } from '@/components/ui/here-address-autocomplete'
import type { EntityDraft } from '@/lib/entity-body'

import { ReadOnlyField } from './read-only-field'

// The user sees ONE field (the full address). The autocomplete resolves granular components
// (street/city/…) which are stored on the draft and sent to the backend, but never shown as fields.
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
    return (
      <ReadOnlyField label={t('objects.fields.address')}>
        {address?.fullAddress || '—'}
      </ReadOnlyField>
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
    <div className="space-y-1.5">
      <Label>{t('objects.fields.address')}</Label>
      <HereAddressAutocomplete
        value={address?.fullAddress ?? ''}
        onAddressSelect={applySuggestion}
      />
    </div>
  )
}
