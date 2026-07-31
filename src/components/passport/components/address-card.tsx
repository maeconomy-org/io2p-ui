import { useTranslations } from 'next-intl'
import { MapPin } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

export interface PassportAddressInfo {
  fullAddress?: string
  street?: string
  houseNumber?: string
  city?: string
  postalCode?: string
  country?: string
}

interface AddressCardProps {
  addressInfo: PassportAddressInfo | null
}

export function AddressCard({ addressInfo }: AddressCardProps) {
  const t = useTranslations()
  if (!addressInfo) return null

  const lines = [
    [addressInfo.street, addressInfo.houseNumber].filter(Boolean).join(' '),
    [addressInfo.postalCode, addressInfo.city].filter(Boolean).join(' '),
    addressInfo.country,
  ].filter((s) => s && s.trim().length > 0)

  if (lines.length === 0 && !addressInfo.fullAddress) return null

  return (
    <Card data-testid="passport-card-address">
      <CardHeader className="pt-2.5 pb-2.5 px-3">
        <CardTitle className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {t('objects.passport.categories.location')}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs px-3 pb-2.5">
        {addressInfo.fullAddress ? (
          <p>{addressInfo.fullAddress}</p>
        ) : (
          <address className="not-italic leading-snug">
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </address>
        )}
      </CardContent>
    </Card>
  )
}
