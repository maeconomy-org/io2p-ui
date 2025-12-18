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
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }
    
    // Suppress specific warnings
    config.ignoreWarnings = [
      /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
    ]
    
    return config
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
