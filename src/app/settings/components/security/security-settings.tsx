'use client'

import { useTranslations } from 'next-intl'

import { Card, CardContent, Badge } from '@/components/ui'

import { ChangePasswordCard } from './change-password-card'
import { TwoFactorCard } from './two-factor-card'
import { ActiveSessionsCard } from './active-sessions-card'

/** A section that isn't wired to a backend yet — shown so the surface is
 * complete and discoverable. Two-column to match the other sections. */
function NotAvailableCard({
  title,
  description,
  soon,
}: {
  title: string
  description: string
  soon: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:gap-8">
        <div className="md:w-1/3">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-1 items-start">
          <Badge variant="outline" className="text-muted-foreground">
            {soon}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export function SecuritySettings() {
  const t = useTranslations('settings.security')

  return (
    <div className="space-y-6" data-testid="security-settings">
      <ChangePasswordCard />
      <TwoFactorCard />
      <NotAvailableCard
        title={t('connectedAccounts.title')}
        description={t('connectedAccounts.description')}
        soon={t('notAvailable')}
      />
      <ActiveSessionsCard />
    </div>
  )
}
