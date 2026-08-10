import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import path from 'path'

import { AUTH_STATE } from './e2e/setup/credentials'

dotenv.config({ path: '.env.local' })

const viewport = { width: 1800, height: 1169 }

// Resolve certificate paths to absolute paths
const certsDir = './certs'

// Build the cert auth origin from BASE_URL + CERT_PORT (default 553)
function getCertAuthOrigin(): string {
  const baseUrl = process.env.BASE_URL || ''
  if (!baseUrl) return ''
  const url = new URL(baseUrl)
  url.port = process.env.CERT_PORT || '553'
  return url.origin
}

export default defineConfig({
  testDir: './e2e',

  fullyParallel: false, // Run tests serially for stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for E2E tests
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000, // 60 second timeout per test
  expect: {
    timeout: 10000, // 10 second timeout for assertions
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    launchOptions: {
      // Slow down actions for better visibility (set to 0 for fast execution)
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    },
    // Certificate for API servers (mTLS)
    clientCertificates: [
      {
        origin: getCertAuthOrigin(),
        certPath: path.join(certsDir, 'client_1_2.crt'),
        keyPath: path.join(certsDir, 'client_1_2.key'),
        passphrase: process.env.CLIENT_CERT_PASSPHRASE || '',
      },
    ],
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      // Retried even locally, where everything else is not. Setup is one cheap idempotent step
      // that every other project declares a dependency on, so a single transient network blip
      // here does not fail one test — it cancels the entire run.
      retries: 2,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Naming a spec `*.read.spec.ts` is an ASSERTION that it creates nothing on the node, which
      // is what makes running four at once safe. Smoke, i18n, a11y, navigation and empty-state
      // specs all qualify — roughly a third of the suite.
      name: 'read',
      testMatch: /.*\.read\.spec\.ts/,
      fullyParallel: true,
      workers: 4,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE, viewport },
    },
    {
      // Everything else mutates shared server state, so it stays serial. Runs after `read` so a
      // failure in the cheap parallel third reports before the slow half starts.
      name: 'write',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*\.read\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      dependencies: ['setup', 'read'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE, viewport },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    // Reuses whatever is already on :3000. If that is a PRODUCTION build, it must have been made
    // with `E2E_KEEP_TEST_IDS=true` — `next.config.mjs` strips `data-testid` in production, so
    // every locator silently resolves to nothing. `00-harness/build.read.spec.ts` fails loudly on
    // that rather than letting 200 specs time out one by one.
    reuseExistingServer: true,
    timeout: 180 * 1000,
  },
})
