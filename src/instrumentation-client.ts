// Sentry Client Config - runs in browser (user interactions, client-side errors)
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import {
  sharedSentryOptions,
  consoleLevels,
  beforeSend,
} from '@/lib/sentry-config'

// Fetch Sentry DSN from runtime config and initialize
async function initSentry() {
  try {
    const res = await fetch('/api/config')
    const config = await res.json()

    // Only initialize in production or when explicitly enabled for testing
    const shouldInit =
      config.nodeEnv === 'production' || config.sentryEnabled === 'true'

    if (shouldInit && config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: config.nodeEnv || 'development',
        release: config.sentryRelease || undefined,

        ...sharedSentryOptions,

        // Browser-specific integrations
        integrations: [
          Sentry.linkedErrorsIntegration(),
          Sentry.browserApiErrorsIntegration(),
          Sentry.globalHandlersIntegration(),
          Sentry.consoleLoggingIntegration({ levels: [...consoleLevels] }),
          // Breadcrumbs for debugging context (no PII)
          Sentry.breadcrumbsIntegration({
            console: false, // Don't capture console logs as breadcrumbs (we use consoleLoggingIntegration)
            dom: true, // Capture click events for debugging
            fetch: false, // Don't capture fetch requests (may contain PII)
            history: true, // Capture navigation for debugging
            xhr: false, // Don't capture XHR (may contain PII)
          }),
        ],

        beforeSend,
      })
    }
  } catch {
    // Silent fail - don't log errors about Sentry init failure
  }
}

initSentry()

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
