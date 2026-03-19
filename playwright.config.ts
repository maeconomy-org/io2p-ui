import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: '.env.local' })

// Resolve certificate paths to absolute paths
const certsDir = './certs'

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
        origin: process.env.AUTH_API_URL || '',
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
