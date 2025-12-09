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

import { useAuth } from '@/contexts'
import { APP_ACRONYM, APP_DESCRIPTION, APP_NAME } from '@/constants'
import { Button, Card, Alert, AlertDescription } from '@/components/ui'

export default function AuthPage() {
  const router = useRouter()
  const { isAuthenticated, handleCertificateAuth } = useAuth()
  const [status, setStatus] = useState<
    'idle' | 'authorizing' | 'success' | 'error'
  >('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      setStatus('success')
      router.push('/objects')
    }
  }, [isAuthenticated, router])

  const handleAuthorize = async () => {
    setStatus('authorizing')
    setError(null)

    try {
      const { success, error } = await handleCertificateAuth()
      if (!success) {
        throw new Error(error)
      }

      // Redirect to main app
      router.push('/objects')
    } catch (err) {
      console.error('Authentication Error:', err)
      setStatus('error')

      // Provide specific error messages
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown authentication error'
      setError(
        `Authentication failed: ${errorMessage}. Please ensure you have a valid, non-expired certificate.`
      )
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

                <div className="space-y-2">
                  <Button
                    onClick={handleAuthorize}
                    className="w-full"
                    variant="outline"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>

                  <div className="text-xs text-center text-muted-foreground space-y-2">
                    <p>Common issues:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-left">
                      <li>Certificate is expired or invalid</li>
                      <li>No certificate was selected</li>
                      <li>Certificate is not authorized for this system</li>
                      <li>Browser blocked the certificate prompt</li>
                    </ul>

                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                      <p className="font-medium">
                        Need to use a different certificate?
                      </p>
                      <p>
                        Close your browser completely and reopen it. Browsers
                        cache mTLS certificates and cannot be cleared
                        programmatically.
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
