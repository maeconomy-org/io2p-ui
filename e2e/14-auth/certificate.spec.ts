import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { expect, test } from '../fixtures/app'

/**
 * mTLS terminates at nginx on the deployed node and there is no local equivalent, so the HANDSHAKE
 * is skipped on a condition — set `E2E_MTLS_ORIGIN` and these switch themselves on.
 *
 * The SURFACE is asserted locally and unskipped: the button's existence, label and coexistence with
 * the email form all render without a certificate anywhere. Split this way, a rename is caught today
 * by a test that runs rather than in three months by one that was skipped.
 */
/**
 * The origin AND the key pair. `playwright.config.ts` now returns no `clientCertificates` when the
 * files are absent — which is what stops one missing file cancelling a whole run — so gating on the
 * origin alone would let the handshake cases run with NO client cert and fail on the handshake.
 * That trades a loud config crash for a quiet red test, which is the worse of the two.
 */
const CERTS = resolve(process.cwd(), 'certs')
const MTLS =
  Boolean(process.env.E2E_MTLS_ORIGIN) &&
  existsSync(resolve(CERTS, process.env.E2E_CLIENT_CERT || 'client1.crt')) &&
  existsSync(resolve(CERTS, process.env.E2E_CLIENT_KEY || 'client1.key'))

// NOT `storageState: undefined` — Playwright reads that as "do not override" and the project's
// signed-in state applies, so a spec that means "start signed out" silently runs signed IN.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('14 - auth / certificate @mtls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('AU13/AU14: the certificate button renders, is labelled, and sits beside the email form', async ({
    page,
  }) => {
    const button = page.getByTestId('auth-certificate')

    await expect(button).toBeEnabled()
    await expect(button).not.toBeEmpty()
    await expect(page.getByTestId('auth-email-submit')).toBeVisible()
  })

  test('AU15/AU16: a handshake lands on /objects and records the method', async ({
    page,
  }) => {
    test.skip(
      !MTLS,
      'mTLS terminates at nginx on the deployed node; set E2E_MTLS_ORIGIN to run this'
    )

    await page.getByTestId('auth-certificate').click()
    await expect(page).toHaveURL(/\/objects$/)
    expect(
      await page.evaluate(() => localStorage.getItem('iom-last-auth-method'))
    ).toBe('certificate')
  })

  test('AU17/AU18: a refused certificate is translated, and there is no redirect', async ({
    page,
  }) => {
    test.skip(
      !MTLS,
      'needs a deployed origin that can refuse a certificate; set E2E_MTLS_ORIGIN'
    )

    await page.getByTestId('auth-certificate').click()

    await expect(page.getByTestId('auth-error')).toBeVisible()
    await expect(page.getByTestId('auth-error')).not.toContainText(/403|401/)
    await expect(page).toHaveURL(/localhost:\d+\/$/)
  })
})
