/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'
import withBundleAnalyzer from '@next/bundle-analyzer'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const analyzeBundles = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  compiler: {
    reactRemoveProperties:
      process.env.NODE_ENV === 'production'
        ? { properties: ['^data-testid$'] }
        : false,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },

  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }

    // Suppress specific warnings during development
    if (dev) {
      config.ignoreWarnings = [
        { message: /the request of a dependency is an expression/ },
        {
          message:
            /Critical dependency: the request of a dependency is an expression/,
        },
        {
          message:
            /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
        },
      ]

      // Suppress cache-layer warnings (e.g. next-intl's dynamic import parsing)
      config.infrastructureLogging = {
        ...config.infrastructureLogging,
        level: 'error',
      }
    }

    return config
  },
}

// Only configure Sentry in production or when explicitly enabled
const shouldUseSentry =
  process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true'

const configuredNextConfig =
  shouldUseSentry && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? withSentryConfig(nextConfig, {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,

        // Silent mode - no verbose logging during build
        silent: true,

        // Upload source maps for better stack traces
        widenClientFileUpload: true,

        // Route browser requests through tunnel to bypass ad-blockers
        tunnelRoute: '/monitoring',

        // Use new webpack options instead of deprecated top-level options
        webpack: {
          treeshake: {
            removeDebugLogging: true, // Replaces deprecated disableLogger
          },
          automaticVercelMonitors: false, // Replaces deprecated automaticVercelMonitors
        },

        // Disable source map upload during build - we do runtime-only config
        hideSourceMaps: true,

        // Disable release creation during build - we handle this at runtime
        disableClientWebpackPlugin: false,
        disableServerWebpackPlugin: false,
      })
    : nextConfig

export default analyzeBundles(withNextIntl(configuredNextConfig))
