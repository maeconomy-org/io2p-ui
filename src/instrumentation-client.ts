// Sentry Client Config - runs in browser (user interactions, client-side errors)
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import {
  sharedSentryOptions,
  beforeSend,
  shouldInitSentry,
} from '@/lib/observability/sentry-config'
import { getCachedConfig } from '@/constants/client'
import { initWebVitals } from '@/lib/observability/web-vitals'

// Read the DSN from the inline __IOM_CONFIG__ script rather than fetching
// /api/config. The script runs in <head> before this module, so the config is
// already present — the fetch was a round trip for data sitting in the page,
// and it delayed Sentry init past the errors most worth catching (those thrown
// during hydration).
function initSentry() {
  try {
    const config = getCachedConfig()
    if (!config) return

    const shouldInit = shouldInitSentry(config.nodeEnv, config.sentryEnabled)

    if (shouldInit && config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: config.nodeEnv || 'development',
        release: config.sentryRelease || undefined,

        ...sharedSentryOptions,
        // Errors only, by design (observability plan §1.3): no tracesSampler
        // and no tracesSampleRate AT ALL — even a constant 0 still enables
        // the tracing machinery. Performance lives in OTel.

        // Browser-specific integrations
        integrations: [
          Sentry.linkedErrorsIntegration(),
          Sentry.browserApiErrorsIntegration(),
          Sentry.globalHandlersIntegration(),
          Sentry.dedupeIntegration(), // Remove duplicate errors
          // Session health (crash rates): the v8 autoSessionTracking option
          // is gone in v9+, and with defaultIntegrations: false this
          // integration is the ONLY thing that produces sessions.
          Sentry.browserSessionIntegration(),
          // URL + headers context on events (no PII beyond the URL).
          Sentry.httpContextIntegration(),
          // Breadcrumbs for debugging context (no PII)
          Sentry.breadcrumbsIntegration({
            console: false, // Console logs flow through the logger's ship sink
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

// Web vitals ride the ship pipeline (→ /api/telemetry), not Sentry. No-ops
// when the ship sink is dark (dev default).
initWebVitals()

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
