import { expect, test } from '../fixtures/app'

/**
 * A real round trip needs credentials on the issuer AND a consent screen nobody can automate, so
 * the PROVIDER is faked at the network boundary: the request the app sends is the thing worth
 * asserting, and it is fully observable without leaving localhost.
 */

// NOT `storageState: undefined` — Playwright reads that as "do not override" and the project's
// signed-in state applies, so a spec that means "start signed out" silently runs signed IN.
test.use({ storageState: { cookies: [], origins: [] } })

const PROVIDERS = ['google', 'microsoft'] as const

test.describe('14 - auth / social', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  for (const provider of PROVIDERS) {
    test(`the ${provider} button renders and is labelled`, async ({ page }) => {
      const button = page.getByTestId(`auth-social-${provider}`)

      await expect(button).toBeEnabled()
      await expect(button).not.toBeEmpty()
      await expect(button.locator('svg')).toBeVisible()
    })

    test(`clicking ${provider} asks the issuer for that provider`, async ({
      page,
    }) => {
      const request = page.waitForRequest(
        (r) => r.url().includes('/sign-in/social') && r.method() === 'POST'
      )
      // Answered here rather than let through: an unconfigured issuer 400s, and the assertion is
      // about what the app SENT, not what came back.
      await page.route('**/sign-in/social', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: null, redirect: false }),
        })
      )

      await page.getByTestId(`auth-social-${provider}`).click()

      expect((await request).postDataJSON()).toMatchObject({ provider })
    })
  }

  test('the social buttons sit beside the other sign-in methods', async ({
    page,
  }) => {
    await expect(page.getByTestId('auth-social-google')).toBeVisible()
    await expect(page.getByTestId('auth-certificate')).toBeVisible()
    await expect(page.getByTestId('auth-email-submit')).toBeVisible()
  })

  test('a refused sign-in is translated and does not redirect', async ({
    page,
    consoleGuard,
  }) => {
    // This test MANUFACTURES the 400 below, so the browser logging it is the fixture working, not
    // a defect — without this the guard fails the test for the refusal it was asked to stage.
    consoleGuard.expectError(/status of 400/)

    await page.route('**/sign-in/social', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'unauthorized' }),
      })
    )

    await page.getByTestId('auth-social-google').click()

    await expect(page.getByTestId('auth-error')).toBeVisible()
    await expect(page.getByTestId('auth-error')).not.toContainText(/400|401/)
    await expect(page).toHaveURL(/localhost:\d+\/$/)
    // A failed attempt must not claim the "last used" badge it never earned.
    expect(
      await page.evaluate(() => localStorage.getItem('iom-last-auth-method'))
    ).toBeNull()
  })
})
