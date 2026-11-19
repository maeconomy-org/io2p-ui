'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import {
  describeCredential,
  enabledSocialProviders,
  type SocialProviderId,
} from '@/constants'
import { useLinkedAccounts } from '@/hooks/api/use-linked-accounts'
import { useSignInOptions } from '@/hooks/api/use-sign-in-options'
import {
  createLandingErrorStore,
  useLandingError,
} from '@/hooks/use-landing-error'
import { authClient } from '@/lib/auth/client'
import { logger } from '@/lib/observability/logger'
import { Button, Card, CardContent, Skeleton } from '@/components/ui'

// `?error=` codes a failed linkSocial round trip comes back with.
const LINK_ERROR_KEYS: Record<string, string> = {
  email_does_not_match: 'linkErrors.emailDoesNotMatch',
  account_already_linked_to_different_user: 'linkErrors.linkedElsewhere',
}

const landingLinkError = createLandingErrorStore()

export function ConnectedAccountsCard() {
  const t = useTranslations('settings.security.connectedAccounts')
  const locale = useLocale()

  const { data: accounts, isPending } = useLinkedAccounts()
  const { providers } = useSignInOptions()
  const [connecting, setConnecting] = useState<SocialProviderId | null>(null)
  const [failed, setFailed] = useState(false)
  const linkErrorCode = useLandingError(landingLinkError)

  const linked = new Set((accounts ?? []).map((a) => a.providerId))
  const connectable = isPending
    ? []
    : enabledSocialProviders(providers).filter((p) => !linked.has(p.id))

  const connect = async (provider: SocialProviderId) => {
    setConnecting(provider)
    setFailed(false)
    // ABSOLUTE: better-auth redirects to these verbatim from the issuer origin.
    const back = `${window.location.origin}/settings?tab=security`
    const { error } = await authClient.linkSocial({
      provider,
      callbackURL: back,
      errorCallbackURL: back,
    })
    if (error) {
      logger.warn('link_social_failed', { provider, status: error.status })
      setFailed(true)
      setConnecting(null)
    }
    // On success the provider redirect is underway; keep the button busy.
  }

  const linkError = failed
    ? t('linkErrors.failed')
    : linkErrorCode
      ? t(LINK_ERROR_KEYS[linkErrorCode] ?? 'linkErrors.failed')
      : null

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
          {linkError && (
            <div
              role="alert"
              data-testid="connect-account-error"
              className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{linkError}</span>
            </div>
          )}
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
          {connectable.map(({ id, Icon }) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              className="w-full justify-start"
              disabled={connecting !== null}
              onClick={() => void connect(id)}
              data-testid={`connect-account-${id}`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {t('connect', { provider: t(`providers.${id}`) })}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
