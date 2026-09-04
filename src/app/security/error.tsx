'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

import { Button } from '@/components/ui'
import { logger } from '@/lib/observability/logger'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorBoundaryProps) {
  const t = useTranslations()

  useEffect(() => {
    // The real Error travels under `err` — the logger's Sentry sink captures
    // it (with its stack) and the ship/console sinks serialize it. `digest`
    // only exists for errors that crossed the server boundary, so it is
    // included only when present.
    logger.error('Unhandled error in route segment', {
      err: error,
      ...(error.digest ? { digest: error.digest } : {}),
    })
  }, [error])

  return (
    <div
      data-testid="error-boundary"
      className="flex items-center justify-center min-h-[60vh] p-4"
    >
      <div className="max-w-md w-full text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t('errors.boundary.title')}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t('errors.boundary.description')}
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-destructive/10 rounded-lg text-left">
            <h3 className="font-semibold text-destructive text-sm mb-1">
              {t('errors.boundary.devDetails')}
            </h3>
            <p className="text-sm text-destructive/80 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
          >
            <Home className="h-4 w-4 mr-2" />
            {t('errors.boundary.goHome')}
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('errors.boundary.tryAgain')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          {t('errors.boundary.persistMessage')}
        </p>
      </div>
    </div>
  )
}
