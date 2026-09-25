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
  logging: {
    // Do not forward browser console output to the dev terminal: forwarded
    // lines are annotated with the console CALL SITE, which for a wrapped
    // logger is permanently the logger's own frame — actively misleading.
    // Devtools and the dev overlay show the true, source-mapped origin.
    browserToTerminal: false,
  },
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
    // Test hooks are stripped from the shipped bundle, EXCEPT when a build is made to be tested.
    //
    // `pnpm test:e2e` against `next start` is otherwise impossible: every locator resolves to
    // nothing, which is indistinguishable from a broken page. Worth being able to do, because a
    // production build is not the dev build with different minification — the React Compiler runs
    // only here, and the note below is explicit that it can change behaviour.
    //
    // Opt-in, so the default and every real release still strip. Only `E2E_KEEP_TEST_IDS=true`
    // keeps them, which is a thing a Dockerfile never sets.
    reactRemoveProperties:
      process.env.NODE_ENV === 'production' &&
      process.env.E2E_KEEP_TEST_IDS !== 'true'
        ? { properties: ['^data-testid$'] }
        : false,
  },
  typedRoutes: true,
  // Auto-memoizes components and hooks at build time — the work you would
  // otherwise do by hand with useMemo/useCallback/memo(). Only 3 of ~450 files
  // used memo() before this, so there was a lot of headroom.
  //
  // PRODUCTION ONLY, on purpose. The compiler is a Babel pass, and everything
  // else here is Rust (SWC/Turbopack), so it is the most expensive thing in the
  // pipeline: ~8s per route on first compile in dev. Dev gets none of the
  // benefit in return, because reactStrictMode defaults to true and
  // deliberately double-invokes renders — the very thing the compiler reduces.
  // So dev would pay the whole cost for none of the win.
  //
  // The trade: compiler-specific behaviour differences (a component that was
  // relying on an accidental re-render) will NOT show up in `next dev`. Verify
  // against `pnpm build && pnpm start` before a release, not just dev.
  //
  // The compiler SKIPS any component that breaks the Rules of React rather than
  // risk miscompiling it, which is why the react-hooks rules were enabled first
  // (see eslint.config.js). Anything still warning there is simply not
  // optimised — no worse than before, but the warning list doubles as the
  // to-do list for widening coverage.
  reactCompiler: process.env.NODE_ENV === 'production',
  experimental: {
    // Turbopack's build cache became a DEFAULT in 16.3, and it only pays off
    // when `.next/cache` survives between builds. The Docker builder stage
    // starts from a clean layer (`FROM node:alpine` then `COPY . .`), so there
    // it writes a cache nothing will ever read — the doc's own advice is to
    // switch it off in that case. Local `pnpm build` keeps it and stays warm.
    //
    // The dev cache is deliberately untouched: it is what lets 16.3's memory
    // eviction reload from disk instead of holding everything in RAM, which is
    // the whole reason `next dev` stopped eating memory.
    turbopackFileSystemCacheForBuild: process.env.DOCKER_BUILD !== 'true',
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
