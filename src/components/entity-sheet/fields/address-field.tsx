'use client'

import { useTranslations } from 'next-intl'
import type { UseFormReturn } from 'react-hook-form'

import { HereAddressAutocomplete, Label } from '@/components/ui'
import type { AddressComponents } from '@/components/ui/here-address-autocomplete'
import type { EntityDraft } from '@/lib/entity-body'

import { ReadOnlyField } from './read-only-field'

/** Street and house number read as one line, the way an address is actually written. */
function joinStreet(address: EntityDraft['address']): string | undefined {
  return [address?.street, address?.houseNumber].filter(Boolean).join(' ')
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
  const address = form.watch('address')

  if (!editing) {
    // Reading is where the parts earn their keep: the autocomplete resolved them, so show what was
    // actually stored rather than only the single line the user typed into.
    const parts: [string, string | undefined][] = [
      [t('objects.address.street'), joinStreet(address)],
      [t('objects.address.postalCode'), address?.postalCode],
      [t('objects.address.city'), address?.city],
      [t('objects.address.state'), address?.state],
      [t('objects.address.country'), address?.country],
    ]
    const present = parts.filter(([, value]) => !!value?.trim())

    return (
      <ReadOnlyField label={t('objects.fields.address')}>
        {address?.fullAddress || '—'}
        {present.length > 0 && (
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 border-l pl-3 text-xs">
            {present.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
          </dl>
        )}
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
