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

import { logger } from '@/lib'
import { useAuth } from '@/contexts'
import { APP_ACRONYM, APP_DESCRIPTION, APP_NAME } from '@/constants'
import { Button, Card, Alert, AlertDescription } from '@/components/ui'

export default function AuthPage() {
  const router = useRouter()
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

      let userFriendlyMessage = 'Authentication failed'

      if (errorMessage.includes('certificate')) {
        userFriendlyMessage =
          'Certificate authentication failed. Please ensure you have selected a valid certificate.'
      } else if (
        errorMessage.includes('network') ||
        errorMessage.includes('connection')
      ) {
        userFriendlyMessage =
          'Network connection failed. Please check your internet connection and try again.'
      } else if (errorMessage.includes('timeout')) {
        userFriendlyMessage =
          'Authentication timed out. This may indicate a network issue or certificate problem.'
      } else if (
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden')
      ) {
        userFriendlyMessage =
          'Your certificate is not authorized to access this system. Please contact your administrator.'
      } else if (errorMessage.includes('expired')) {
        userFriendlyMessage =
          'Your certificate has expired. Please obtain a new certificate from your administrator.'
      }

      setError(userFriendlyMessage)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-md w-full space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome to {APP_ACRONYM}</h1>
          <p className="mt-2 text-gray-600">
            {APP_NAME} - {APP_DESCRIPTION}
          </p>
        </div>

        <Card className="p-6 bg-white shadow-lg rounded-lg">
          <div className="space-y-6">
            {status === 'idle' && (
              <>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    To access the system, you need a valid certificate. Click
                    the button below to start the authorization process.
                  </p>
                  <Button
                    onClick={handleAuthorize}
                    className="w-full py-6 text-lg"
                    variant="default"
                  >
                    <Shield className="mr-2 h-5 w-5" />
                    Authorize with Certificate
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {status === 'authorizing' && (
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                <div className="space-y-2">
                  <p className="font-medium">
                    Authenticating with certificate...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please select your certificate when prompted by your browser
                  </p>
                </div>
                <Alert className="text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Browser Prompt:</strong> You may see a certificate
                    selection dialog. Choose your organization's client
                    certificate to continue.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-6 text-center">
                <div className="bg-green-50 p-4 rounded-md text-green-600 flex items-center justify-center">
                  <Check className="h-5 w-5 mr-2" />
                  Successfully authenticated with certificate
                </div>
                <p className="text-sm text-gray-600">
                  You are being redirected to the application...
                </p>
                <Button
                  onClick={() => router.push('/objects')}
                  className="w-full py-6 text-lg"
                  variant="default"
                >
                  Open Application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {error || 'Authentication failed'}
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <Button
                    onClick={handleAuthorize}
                    className="w-full"
                    variant="outline"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>

                  <div className="text-xs space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-blue-800">
                      <p className="font-medium mb-2">Troubleshooting Steps:</p>
                      <ol className="list-decimal list-inside space-y-1 text-left">
                        <li>
                          Ensure your certificate is installed in your browser
                        </li>
                        <li>Check that your certificate has not expired</li>
                        <li>
                          Verify you selected the correct certificate when
                          prompted
                        </li>
                        <li>Try refreshing the page and attempting again</li>
                      </ol>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-800">
                      <p className="font-medium mb-2">
                        Need to use a different certificate?
                      </p>
                      <p className="text-left">
                        Close your browser completely and reopen it. Browsers
                        cache mTLS certificates and the selection cannot be
                        changed without a full browser restart.
                      </p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded p-3 text-gray-700">
                      <p className="font-medium mb-2">Still having issues?</p>
                      <p className="text-left">
                        Contact your system administrator or IT support team.
                        They can verify your certificate permissions and help
                        with installation if needed.
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
            Need help with certificates?
          </Link>
        </div>

        {/* Certificate requirements info */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            This application requires a valid client certificate for secure
            access
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              mTLS Authentication
            </span>
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3" />
              Secure Access
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
