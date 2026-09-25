'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { logger } from '@/lib/observability/logger'
import { authClient } from '@/lib/auth/client'
import {
  Button,
  Card,
  Input,
  Label,
  Checkbox,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui'

const OTP_SLOT = 'h-12 w-11 text-lg font-semibold'

/**
 * Login-time two-factor verification. better-auth redirects a 2FA-enabled user
 * here after sign-in (onTwoFactorRedirect); verifying the code completes the
 * session. Supports an authenticator code or a one-time backup code.
 */
export default function TwoFactorPage() {
  const t = useTranslations()
  const router = useRouter()

  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = useBackup
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice })
      if (res.error) {
        throw new Error(res.error.message)
      }
      router.replace('/objects')
    } catch (err) {
      logger.error('2FA verify error:', { err })
      setError(t('auth.twoFactor.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const valid = useBackup ? code.trim().length > 0 : /^\d{6}$/.test(code)

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">
        {t('auth.twoFactor.title')}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {useBackup
          ? t('auth.twoFactor.backupSubtitle')
          : t('auth.twoFactor.subtitle')}
      </p>

      <Card className="p-6 shadow-lg mt-8">
        <form onSubmit={onSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tfa-code" className="block text-left">
              {useBackup
                ? t('auth.twoFactor.backupLabel')
                : t('auth.twoFactor.codeLabel')}
            </Label>
            {useBackup ? (
              <Input
                id="tfa-code"
                autoFocus
                maxLength={20}
                placeholder="XXXX-XXXX"
                className="text-center"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={submitting}
              />
            ) : (
              <div className="flex justify-center">
                <InputOTP
                  id="tfa-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  disabled={submitting}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className={OTP_SLOT} />
                    <InputOTPSlot index={1} className={OTP_SLOT} />
                    <InputOTPSlot index={2} className={OTP_SLOT} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className={OTP_SLOT} />
                    <InputOTPSlot index={4} className={OTP_SLOT} />
                    <InputOTPSlot index={5} className={OTP_SLOT} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            )}
          </div>

          {!useBackup && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="trust-device"
                checked={trustDevice}
                onCheckedChange={(v) => setTrustDevice(v === true)}
                disabled={submitting}
              />
              <Label
                htmlFor="trust-device"
                className="text-sm font-normal text-muted-foreground"
              >
                {t('auth.twoFactor.trustDevice')}
              </Label>
            </div>
          )}

          <Button
            type="submit"
            data-testid="two-factor-verify"
            className="w-full"
            disabled={submitting || !valid}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {t('auth.twoFactor.verify')}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              data-testid="two-factor-toggle-backup"
              className="text-primary transition-colors hover:text-primary/80"
              onClick={() => {
                setUseBackup((v) => !v)
                setCode('')
                setError(null)
              }}
            >
              {useBackup
                ? t('auth.twoFactor.useAuthenticator')
                : t('auth.twoFactor.useBackupCode')}
            </button>
            <Link
              href="/"
              className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('auth.backToLogin')}
            </Link>
          </div>
        </form>
      </Card>
    </>
  )
}
