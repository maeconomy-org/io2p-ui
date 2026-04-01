import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: '.env.local' })

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
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 1000,
    },
    // Certificate for API servers (mTLS)
    clientCertificates: [
      {
        origin: getCertAuthOrigin(),
        certPath: path.join(certsDir, 'client1.crt'),
        keyPath: path.join(certsDir, 'client1.key'),
        passphrase: process.env.CLIENT_CERT_PASSPHRASE || '',
      },
    ],
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
        viewport: { width: 1800, height: 1169 },
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // Always reuse - start dev server manually before tests
    timeout: 120 * 1000,
  },
})
