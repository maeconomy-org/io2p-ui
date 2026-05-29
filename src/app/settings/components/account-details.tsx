'use client'

import { type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, Mail, Shield, ShieldCheck } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CopyButton,
} from '@/components/ui'
import { useAuth } from '@/contexts'
import { cn } from '@/lib'

/** Locale-aware date format; returns null for missing/invalid input. */
function formatDate(value: string | undefined, locale: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

type ExpirySeverity = 'ok' | 'warning' | 'critical' | 'expired'

/**
 * Human, localized time-to-expiry for a certificate (e.g. "in 1 year",
 * "in 12 days", "5 days ago") plus a severity used to color the value.
 * Critical < 30 days, warning < 90 days.
 */
function certExpiry(
  validTo: string | undefined,
  locale: string
): { text: string; severity: ExpirySeverity } | null {
  if (!validTo) return null
  const end = new Date(validTo)
  if (Number.isNaN(end.getTime())) return null

  const days = Math.round((end.getTime() - Date.now()) / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (days <= 0) return { text: rtf.format(days, 'day'), severity: 'expired' }

  const text =
    days >= 365
      ? rtf.format(Math.round(days / 365), 'year')
      : days >= 60
        ? rtf.format(Math.round(days / 30), 'month')
        : rtf.format(days, 'day')

  const severity: ExpirySeverity =
    days <= 30 ? 'critical' : days <= 90 ? 'warning' : 'ok'
  return { text, severity }
}

const EXPIRY_CLASS: Record<ExpirySeverity, string> = {
  ok: 'text-green-600 dark:text-green-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
  expired: 'text-red-600 dark:text-red-400',
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  )
}

export function AccountDetails() {
  const t = useTranslations('settings.account')
  const locale = useLocale()
  const { userInfo } = useAuth()

  const isEmailAuth = userInfo?.identifierType === 'UserAuthUP'
  const cert = userInfo?.certificateInfo
  const certName = cert?.subjectFields?.CN || cert?.issuerFields?.CN
  const issuer = cert?.issuerFields?.CN
  const createdAt = formatDate(userInfo?.createdAt, locale)
  const validFrom = formatDate(cert?.validFrom, locale)
  const validTo = formatDate(cert?.validTo, locale)
  const expiry = certExpiry(cert?.validTo, locale)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {userInfo?.userUUID && (
          <Row label={t('userId')}>
            <span className="flex items-center gap-2">
              <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
                {userInfo.userUUID}
              </code>
              <CopyButton text={userInfo.userUUID} className="h-6 w-6 p-0" />
            </span>
          </Row>
        )}

        <Row label={t('authType')}>
          <span className="inline-flex items-center gap-1.5">
            {isEmailAuth ? (
              <>
                <Mail className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                {t('email')}
              </>
            ) : (
              <>
                <Shield className="h-3.5 w-3.5 text-green-600" aria-hidden />
                {t('certificate')}
              </>
            )}
          </span>
        </Row>

        {isEmailAuth && userInfo?.username && (
          <Row label={t('username')}>{userInfo.username}</Row>
        )}
        {!isEmailAuth && certName && (
          <Row label={t('certificateName')}>{certName}</Row>
        )}
        {!isEmailAuth && issuer && <Row label={t('issuer')}>{issuer}</Row>}
        {!isEmailAuth && validFrom && (
          <Row label={t('validFrom')}>{validFrom}</Row>
        )}
        {!isEmailAuth && validTo && <Row label={t('validTo')}>{validTo}</Row>}
        {!isEmailAuth && expiry && (
          <Row label={t('expiresIn')}>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 font-semibold',
                EXPIRY_CLASS[expiry.severity]
              )}
            >
              {expiry.severity === 'ok' ? (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              )}
              {expiry.text}
            </span>
          </Row>
        )}

        <Row label={t('createdAt')}>{createdAt ?? t('notAvailable')}</Row>
      </CardContent>
    </Card>
  )
}
