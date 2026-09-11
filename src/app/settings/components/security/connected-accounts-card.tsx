'use client'

import { useLocale, useTranslations } from 'next-intl'

import { describeCredential } from '@/constants'
import { useLinkedAccounts } from '@/hooks/api/use-linked-accounts'
import { Card, CardContent, Skeleton } from '@/components/ui'

export function ConnectedAccountsCard() {
  const t = useTranslations('settings.security.connectedAccounts')
  const locale = useLocale()

  const { data: accounts, isPending } = useLinkedAccounts()

  const rows = [...(accounts ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:gap-8">
        <div className="md:w-1/3">
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex-1 space-y-3">
          {isPending ? (
            <>
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            rows.map((account) => {
              const credential = describeCredential(account.providerId)
              const connected = new Date(account.createdAt)
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                  data-testid={`connected-account-${account.providerId}`}
                >
                  {credential.branded ? (
                    <credential.Icon className="h-5 w-5 shrink-0" />
                  ) : (
                    <credential.Icon
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t(`providers.${credential.labelKey}`)}
                    </p>
                    {!Number.isNaN(connected.getTime()) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('connectedOn', {
                          date: connected.toLocaleDateString(locale, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
