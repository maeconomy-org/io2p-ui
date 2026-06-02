/** @type {import('next').NextConfig} */
import { withSentryConfig } from '@sentry/nextjs'
import createNextIntlPlugin from 'next-intl/plugin'
import withBundleAnalyzer from '@next/bundle-analyzer'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const analyzeBundles = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// Read version from package.json at build time — baked into the bundle
// so every Docker image knows its own version regardless of tag (latest, dev, etc.)
import { readFileSync } from 'fs'
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@react-pdf/renderer'],
  // Source maps are emitted by the Sentry plugin (hidden-source-map, client +
  // server) for upload, then deleted from the production image in the
  // Dockerfile. We intentionally do NOT enable productionBrowserSourceMaps:
  // it would duplicate the client maps the Sentry plugin already produces and
  // serve them publicly.
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    APP_VERSION: pkg.version,
  },
  images: {
    unoptimized: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  compiler: {
    reactRemoveProperties:
      process.env.NODE_ENV === 'production'
        ? { properties: ['^data-testid$'] }
        : false,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'echarts-for-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
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

        // No authToken on purpose: the build injects debug IDs and emits hidden
        // source maps but must NOT upload them. Uploading is owned solely by
        // scripts/upload-sourcemaps.sh, which pushes a single debug-ID bundle to
        // every Sentry project (iob-ui-*, iom-ui-*). Passing a token here would
        // cause a duplicate upload to SENTRY_PROJECT on every local build.

        // Silent mode - no verbose logging during build
        silent: true,

        // Upload source maps for better stack traces
        widenClientFileUpload: true,

        // Route browser requests through tunnel to bypass ad-blockers
        tunnelRoute: '/monitoring',

        sourcemaps: {
          // Keep source maps in build output for extraction/upload
          // They are deleted in the Dockerfile runner stage
          deleteSourcemapsAfterUpload: false,
        },

        release: {
          name: process.env.SENTRY_RELEASE || pkg.version,
          create: true,
          finalize: true,
          setCommits: { auto: true },
        },

        bundleSizeOptimizations: {
          excludeDebugStatements: true,
          excludeReplayIframe: true,
          excludeReplayShadowDom: true,
          excludeReplayWorker: true,
        },
      })
    : nextConfig

export default analyzeBundles(withNextIntl(configuredNextConfig))
