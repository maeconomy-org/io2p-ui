/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
}

// Only configure Sentry in production or when explicitly enabled
const shouldUseSentry = process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true'

export default shouldUseSentry && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT 
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Silent mode - no verbose logging during build
      silent: true,

      // Upload source maps for better stack traces
      widenClientFileUpload: true,

      // Route browser requests through tunnel to bypass ad-blockers
      tunnelRoute: '/monitoring',

      // Tree-shake Sentry logger statements in production
      disableLogger: true,

      // Disable OpenTelemetry - not needed for basic error monitoring
      // We're running on Google Cloud VM, not Vercel
      automaticVercelMonitors: false,
    })
  : nextConfig
