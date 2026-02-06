'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  HelpCircle,
  ArrowRight,
  Check,
  Shield,
  AlertTriangle,
  Building2,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { logger } from '@/lib'
import {
  APP_NAME,
  APP_DESCRIPTION,
  APP_ACRONYM,
  AUTH_FEATURES,
  AUTH_STEPS,
} from '@/constants'
import { useAuth } from '@/contexts'
import { Button, Card, Alert, AlertDescription } from '@/components/ui'

export default function AuthPage() {
  const router = useRouter()
  const t = useTranslations()
  const { isAuthenticated, authLoading, handleAuth } = useAuth()
  const [status, setStatus] = useState<
    'idle' | 'authorizing' | 'success' | 'error'
  >('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setStatus('success')
      router.push('/objects')
    }
  }, [isAuthenticated, authLoading, router])

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      </div>
    )
  }

  const handleAuthorize = async () => {
    setStatus('authorizing')
    setError(null)

    try {
      const { success, error } = await handleAuth()
      if (!success) {
        throw new Error(error)
      }

      setStatus('success')
      setTimeout(() => {
        router.push('/objects')
      }, 1500)
    } catch (err) {
      logger.error('Authentication Error:', err)
      setStatus('error')

      const errorMessage =
        err instanceof Error ? err.message : 'Unknown authentication error'

      let userFriendlyMessage = t('auth.errors.authFailed')

      if (errorMessage.includes('certificate')) {
        userFriendlyMessage = t('auth.errors.certificateFailed')
      } else if (
        errorMessage.includes('network') ||
        errorMessage.includes('connection')
      ) {
        userFriendlyMessage = t('auth.errors.networkFailed')
      } else if (errorMessage.includes('timeout')) {
        userFriendlyMessage = t('auth.errors.timeout')
      } else if (
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden')
      ) {
        userFriendlyMessage = t('auth.errors.unauthorized')
      } else if (errorMessage.includes('expired')) {
        userFriendlyMessage = t('auth.errors.expired')
      }

      setError(userFriendlyMessage)
    }
  }

  return (
    <div className="flex flex-1">
      {/* Left Column - Info Panel */}
      <div className="hidden lg:flex lg:w-1/2 p-6">
        <div className="relative w-full rounded-3xl overflow-hidden">
          {/* Gradient background - dark to warm like the reference image */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-slate-800 to-slate-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_center,_var(--tw-gradient-stops))] from-rose-500/30 via-blue-500/20 to-transparent" />

          {/* Content - centered x/y */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-12 xl:px-16 py-12 text-white">
            <div className="max-w-md w-full space-y-10 text-center">
              {/* Tagline */}
              <div>
                <div className="flex items-center justify-center gap-2.5 mb-6">
                  <Building2 className="h-8 w-8 text-white/90" />
                  <span className="font-bold text-2xl text-white/90">
                    {APP_ACRONYM}
                  </span>
                </div>
                <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-3">
                  {APP_NAME}
                </h2>
                <p className="text-base text-white/70 leading-relaxed">
                  {t('auth.tagline')}
                </p>
              </div>

              {/* How it works */}
              <div className="space-y-3 text-left">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 text-center">
                  {t('auth.infoTitle')}
                </h3>
                <div className="space-y-3">
                  {AUTH_STEPS.map((step) => (
                    <div
                      key={step.num}
                      className="flex items-start gap-3 bg-white/5 backdrop-blur-sm rounded-xl p-3.5 border border-white/10"
                    >
                      <div className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <step.icon className="h-4 w-4 text-white/80" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white/90">
                          {t(`auth.${step.titleKey}`)}
                        </p>
                        <p className="text-sm text-white/50 mt-0.5">
                          {t(`auth.${step.descKey}`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {AUTH_FEATURES.map((feat) => (
                  <div
                    key={feat.key}
                    className="flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/10"
                  >
                    <feat.icon className="h-4 w-4 shrink-0 text-white/70" />
                    <span className="text-sm font-medium text-white/80">
                      {t(`auth.${feat.key}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Login */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 px-6 sm:px-12 lg:px-16 xl:px-24 py-12">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Logo & Title (visible on mobile, hidden on desktop since it's on the left) */}
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2.5 mb-6 lg:hidden">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="font-bold text-2xl">{APP_ACRONYM}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('auth.welcome', { acronym: APP_ACRONYM })}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t('auth.subtitle', {
                name: APP_NAME,
                description: APP_DESCRIPTION,
              })}
            </p>
          </div>

          {/* Auth Card */}
          <Card className="p-6 shadow-lg">
            <div className="space-y-6">
              {status === 'idle' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('auth.intro')}
                  </p>
                  <Button
                    onClick={handleAuthorize}
                    className="w-full py-6 text-base sm:text-lg"
                    variant="default"
                  >
                    <Shield className="mr-2 h-5 w-5" />
                    <span className="hidden sm:inline">
                      {t('auth.authorize')}
                    </span>
                    <span className="sm:hidden">
                      {t('auth.authorizeShort')}
                    </span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {status === 'authorizing' && (
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                  <div className="space-y-2">
                    <p className="font-medium">{t('auth.authorizing')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('auth.selectCertificate')}
                    </p>
                  </div>
                  <Alert className="text-left">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>{t('auth.browserPromptTitle')}</strong>{' '}
                      {t('auth.browserPrompt')}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {status === 'success' && (
                <div className="space-y-6 text-center">
                  <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-md text-green-600 dark:text-green-400 flex items-center justify-center">
                    <Check className="h-5 w-5 mr-2" />
                    {t('auth.success')}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('auth.redirecting')}
                  </p>
                  <Button
                    onClick={() => router.push('/objects')}
                    className="w-full py-6 text-lg"
                    variant="default"
                  >
                    {t('auth.openApp')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {status === 'error' && (
                <div className="space-y-4">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {error || t('auth.errors.authFailed')}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <Button
                      onClick={handleAuthorize}
                      className="w-full"
                      variant="outline"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      {t('auth.tryAgain')}
                    </Button>

                    <div className="text-xs space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-3 text-blue-800 dark:text-blue-300">
                        <p className="font-medium mb-2">
                          {t('auth.errors.troubleshootingTitle')}
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-left">
                          {t
                            .raw('auth.errors.troubleshooting')
                            .map((step: string, index: number) => (
                              <li key={index}>{step}</li>
                            ))}
                        </ol>
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3 text-amber-800 dark:text-amber-300">
                        <p className="font-medium mb-2">
                          {t('auth.errors.differentCertTitle')}
                        </p>
                        <p className="text-left">
                          {t('auth.errors.differentCert')}
                        </p>
                      </div>

                      <div className="bg-muted border rounded p-3 text-muted-foreground">
                        <p className="font-medium mb-2">
                          {t('auth.errors.stillIssuesTitle')}
                        </p>
                        <p className="text-left">
                          {t('auth.errors.stillIssues')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Footer links */}
          <div className="flex items-center justify-between text-sm">
            <Link
              href="/help"
              className="text-primary hover:text-primary/80 flex items-center transition-colors"
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              {t('auth.needHelp')}
            </Link>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              {t('auth.mtls')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
