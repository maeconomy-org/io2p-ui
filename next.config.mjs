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
  typedRoutes: true,
  experimental: {
    // lucide-react is optimized by default in Next 16 — listing it is a no-op.
    // The Radix entries are near-noise (each package is one small module, not a
    // barrel) but kept until someone measures them.
    optimizePackageImports: [
      'echarts-for-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
    serverActions: {
      bodySizeLimit: '100mb',
    },
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
