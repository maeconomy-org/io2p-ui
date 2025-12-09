// Sentry Server Config - runs on Node.js server (API routes, SSR, server components)
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import {
  sharedSentryOptions,
  consoleLevels,
  beforeSend,
} from './src/lib/sentry-config'

// Only initialize in production or when explicitly enabled for testing
const shouldInit =
  process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true'

if (shouldInit && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,

    ...sharedSentryOptions,

    // Server-specific integrations
    integrations: [
      Sentry.linkedErrorsIntegration(),
      Sentry.contextLinesIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.consoleLoggingIntegration({ levels: [...consoleLevels] }),
    ],

    beforeSend,
  })
}
