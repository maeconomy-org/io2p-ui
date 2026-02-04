'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  HelpCircle,
  ArrowRight,
  Check,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { logger } from '@/lib'
import { APP_NAME, APP_DESCRIPTION, APP_ACRONYM } from '@/constants'
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
    // Only redirect after auth check is complete
    if (!authLoading && isAuthenticated) {
      setStatus('success')
      router.push('/objects')
    }
  }, [isAuthenticated, authLoading, router])

  // Show loading while checking auth status
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
      // Small delay to show success state before redirect
      setTimeout(() => {
        router.push('/objects')
      }, 1500)
    } catch (err) {
      logger.error('Authentication Error:', err)
      setStatus('error')

      // Provide more specific and helpful error messages
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
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-md w-full space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            {t('auth.welcome', { acronym: APP_ACRONYM })}
          </h1>
          <p className="mt-2 text-gray-600">
            {t('auth.subtitle', {
              name: APP_NAME,
              description: APP_DESCRIPTION,
            })}
          </p>
        </div>

        <Card className="p-6 bg-white shadow-lg rounded-lg">
          <div className="space-y-6">
            {status === 'idle' && (
              <>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">{t('auth.intro')}</p>
                  <Button
                    onClick={handleAuthorize}
                    className="w-full py-6 text-lg"
                    variant="default"
                  >
                    <Shield className="mr-2 h-5 w-5" />
                    {t('auth.authorize')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
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
                <div className="bg-green-50 p-4 rounded-md text-green-600 flex items-center justify-center">
                  <Check className="h-5 w-5 mr-2" />
                  {t('auth.success')}
                </div>
                <p className="text-sm text-gray-600">{t('auth.redirecting')}</p>
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
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-blue-800">
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

                    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-800">
                      <p className="font-medium mb-2">
                        {t('auth.errors.differentCertTitle')}
                      </p>
                      <p className="text-left">
                        {t('auth.errors.differentCert')}
                      </p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded p-3 text-gray-700">
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

        <div className="flex items-center justify-center text-sm">
          <Link
            href="/help"
            className="text-primary hover:text-primary/80 flex items-center transition-colors"
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            {t('auth.needHelp')}
          </Link>
        </div>

        {/* Certificate requirements info */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('auth.requiresCertificate')}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {t('auth.mtls')}
            </span>
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t('auth.secureAccess')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
