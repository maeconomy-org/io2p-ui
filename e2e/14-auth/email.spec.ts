import { expect, test } from '../fixtures/app'
import { requireCredentials } from '../setup/credentials'
import { tour } from '../utils/selectors'

/**
 * The one flow every other spec depends on, given its own file so a failure names itself instead of
 * taking the whole run down through `auth.setup.ts`.
 *
 * These start signed OUT, unlike everything else in the suite.
 */
// NOT `storageState: undefined` — Playwright reads that as "do not override" and the project's
// signed-in state applies, so a spec that means "start signed out" silently runs signed IN.
test.use({ storageState: { cookies: [], origins: [] } })

const { email, password } = requireCredentials()

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  // `getByLabel`, not a testid: the association IS the assertion. `FormControl` is a Radix Slot,
  // and a wrapper div inside it once stole the id, leaving the input with no label at all.
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByTestId('auth-email-submit').click()
}

test.describe('14 - auth / email', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('AU1: the carousel, the email form and the certificate button coexist', async ({
    page,
  }) => {
    await expect(page.getByTestId('auth-carousel')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByTestId('auth-email-submit')).toBeVisible()
    await expect(page.getByTestId('auth-certificate')).toBeEnabled()
  })

  test('AU2/AU6/AU7: a correct sign-in lands on /objects, records the method and survives a reload', async ({
    page,
  }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/objects$/)

    expect(
      await page.evaluate(() => localStorage.getItem('iom-last-auth-method'))
    ).toBe('email')

    await page.reload()
    await expect(page).toHaveURL(/\/objects$/)
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('AU3: a wrong password is translated and stays on the login page', async ({
    page,
    consoleGuard,
  }) => {
    // A rejected sign-in SHOULD log a 401 — declared so the guard still fails on anything else.
    consoleGuard.expectError(/401|Unauthorized/)
    consoleGuard.expectError(/Email Login Error/)

    await page.getByLabel('Email').fill(email)
    // Schema-VALID but wrong, so the request actually reaches the issuer. A password failing the
    // local complexity rules never leaves the browser — that is AU3b.
    await page.getByLabel('Password').fill('WrongPass1!')
    await page.getByTestId('auth-email-submit').click()

    // `mapError` maps five cases; the raw issuer message must never reach the screen.
    await expect(page.getByTestId('auth-error')).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByTestId('auth-error')).not.toContainText(
      /INVALID_|401|Error:/
    )
    await expect(page).toHaveURL(/localhost:\d+\/$/)
  })

  test('AU3b: a password failing the local rules never reaches the issuer', async ({
    page,
    api,
  }) => {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('nocapitalsordigits')
    api.clear()
    await page.getByTestId('auth-email-submit').click()

    await expect(page.getByTestId('auth-password-error')).not.toBeEmpty()
    await expect.poll(() => api.count(/sign-in/)).toBe(0)
  })

  test('AU4: a malformed email is blocked before any request leaves', async ({
    page,
    api,
  }) => {
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password').fill(password)
    api.clear()
    await page.getByTestId('auth-email-submit').click()

    await expect(page.getByTestId('auth-email-error')).not.toBeEmpty()
    // zod runs first, so nothing is asked of the issuer at all.
    await expect.poll(() => api.count(/sign-in|\/token/)).toBe(0)
  })

  test('AU5: an empty submit names both fields', async ({ page }) => {
    await page.getByTestId('auth-email-submit').click()

    await expect(page.getByTestId('auth-email-error')).not.toBeEmpty()
    await expect(page.getByTestId('auth-password-error')).not.toBeEmpty()
  })

  test('AU8: signing out clears the token and returns to /', async ({
    page,
  }) => {
    await signIn(page)
    await expect(page).toHaveURL(/\/objects$/)

    await tour(page, 'userMenuTrigger').click()
    await page.getByTestId('nav-sign-out').click()

    await expect(page).toHaveURL(/localhost:\d+\/$/)
    await expect(page.getByTestId('auth-email-submit')).toBeVisible()
  })

  test('AU9: a protected route redirects an unauthenticated visitor to /', async ({
    page,
  }) => {
    await page.goto('/objects')

    await expect(page).toHaveURL(/localhost:\d+\/$/)
    await expect(page.getByTestId('auth-email-submit')).toBeVisible()
  })
})
