'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2,
  ShieldCheck,
  ShieldOff,
  ArrowRight,
  Check,
} from 'lucide-react'
import { logger } from '@/lib/observability/logger'
import { authClient, useSession } from '@/lib/auth/client'
import { buildQrCodeConfig } from '@/lib/qr-code'
import {
  Card,
  CardContent,
  Button,
  Label,
  PasswordInput,
  CopyButton,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui'

const OTP_SLOT = 'h-11 w-10 text-lg font-semibold'

/** Renders an otpauth:// URI as a QR code (canvas). */
function TotpQr({ uri }: { uri: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    let cancelled = false
    // Dynamic: qr-code-styling is ~50 KB and only 2FA enrolment needs it, so a
    // static import would put it in the /settings bundle for every visitor.
    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (cancelled) return
      const instance = new QRCodeStyling(
        buildQrCodeConfig({ data: uri, size: 220, withLogo: false })
      )
      node.innerHTML = ''
      instance.append(node)
    })
    return () => {
      cancelled = true
      node.innerHTML = ''
    }
  }, [uri])
  return <div ref={ref} className="flex justify-center" />
}

function extractSecret(uri: string): string | null {
  return uri.match(/[?&]secret=([^&]+)/i)?.[1] ?? null
}

type Mode = 'idle' | 'enable-password' | 'enable-verify' | 'disable'

export function TwoFactorCard() {
  const t = useTranslations('settings.security')
  const { data: session, refetch } = useSession()
  const enabled = !!(
    session?.user as { twoFactorEnabled?: boolean } | undefined
  )?.twoFactorEnabled

  const [mode, setMode] = useState<Mode>('idle')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [totpUri, setTotpUri] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setMode('idle')
    setPassword('')
    setCode('')
    setTotpUri('')
    setBusy(false)
  }

  const startEnable = async () => {
    setBusy(true)
    try {
      const { data, error } = await authClient.twoFactor.enable({ password })
      if (error || !data?.totpURI) {
        throw new Error(error?.message || 'enable failed')
      }
      setTotpUri(data.totpURI)
      setMode('enable-verify')
    } catch (err) {
      logger.error('2FA enable error:', { err })
      toast.error(t('twoFactor.enableError'))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setBusy(true)
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code })
      if (error) {
        throw new Error(error.message)
      }
      toast.success(t('twoFactor.enabled'))
      refetch()
      reset()
    } catch (err) {
      logger.error('2FA verify error:', { err })
      toast.error(t('twoFactor.verifyError'))
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const { error } = await authClient.twoFactor.disable({ password })
      if (error) {
        throw new Error(error.message)
      }
      toast.success(t('twoFactor.disabled'))
      refetch()
      reset()
    } catch (err) {
      logger.error('2FA disable error:', { err })
      toast.error(t('twoFactor.disableError'))
    } finally {
      setBusy(false)
    }
  }

  const secret = totpUri ? extractSecret(totpUri) : null

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:gap-8">
        <div className="md:w-1/3">
          <h3 className="text-sm font-medium">{t('twoFactor.title')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('twoFactor.description')}
          </p>
        </div>
        <div className="flex-1">
          {enabled ? (
            <div className="space-y-3">
              <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                {t('twoFactor.enabledLabel')}
              </span>
              <Button variant="outline" onClick={() => setMode('disable')}>
                <ShieldOff className="mr-2 h-4 w-4" />
                {t('twoFactor.disable')}
              </Button>
            </div>
          ) : (
            <Button onClick={() => setMode('enable-password')}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t('twoFactor.enable')}
            </Button>
          )}
        </div>
      </CardContent>

      {/* Enable — step 1: verify password */}
      <Dialog
        open={mode === 'enable-password'}
        onOpenChange={(o) => !o && reset()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('verifyPassword.title')}</DialogTitle>
            <DialogDescription>
              {t('verifyPassword.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tfa-pw">{t('verifyPassword.label')}</Label>
            <PasswordInput
              id="tfa-pw"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button
              onClick={startEnable}
              disabled={busy || !password}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {t('common.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable — step 2: scan QR + verify code */}
      <Dialog
        open={mode === 'enable-verify'}
        onOpenChange={(o) => !o && reset()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('twoFactor.setupTitle')}</DialogTitle>
            <DialogDescription>
              {t('twoFactor.setupDescription')}
            </DialogDescription>
          </DialogHeader>
          {totpUri && (
            <div className="space-y-3 rounded-lg border p-4">
              <TotpQr uri={totpUri} />
              {secret && (
                <div className="flex items-center justify-center gap-2">
                  <code className="break-all rounded bg-muted/40 px-2 py-1 font-mono text-xs">
                    {secret}
                  </code>
                  <CopyButton text={secret} className="h-6 w-6 p-0" />
                </div>
              )}
            </div>
          )}
          <div className="space-y-3">
            <Label htmlFor="tfa-code" className="block">
              {t('twoFactor.codeLabel')}
            </Label>
            <div className="flex justify-center pb-1">
              <InputOTP
                id="tfa-code"
                maxLength={6}
                value={code}
                onChange={setCode}
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
          </div>
          <DialogFooter className="mt-2">
            <Button
              onClick={verify}
              disabled={busy || code.length !== 6}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {t('twoFactor.verify')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable — verify password */}
      <Dialog open={mode === 'disable'} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('twoFactor.disableTitle')}</DialogTitle>
            <DialogDescription>
              {t('twoFactor.disableDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tfa-pw-disable">{t('verifyPassword.label')}</Label>
            <PasswordInput
              id="tfa-pw-disable"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button
              variant="destructive"
              onClick={disable}
              disabled={busy || !password}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="mr-2 h-4 w-4" />
              )}
              {t('twoFactor.disable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
