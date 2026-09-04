import { expect, test } from '../fixtures/app'

/** Password recovery and two-factor: three routes with no coverage at all before this. */
// NOT `storageState: undefined` — Playwright reads that as "do not override" and the project's
// signed-in state applies, so a spec that means "start signed out" silently runs signed IN.
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('14 - auth / recovery', () => {
  test('AU10: forgot password confirms without revealing whether the address exists', async ({
    page,
  }) => {
    await page.goto('/forgot-password')

    await page.getByLabel('Email').fill('not-an-email')
    await page.getByTestId('forgot-password-submit').click()
    await expect(page.getByTestId('forgot-password-email-error')).toBeVisible()
    await expect(page.getByTestId('forgot-password-sent')).toHaveCount(0)

    await page.getByLabel('Email').fill('nobody@example.invalid')
    await page.getByTestId('forgot-password-submit').click()

    // The same confirmation either way — the screen must not answer "is this a user?".
    await expect(page.getByTestId('forgot-password-sent')).toBeVisible()
  })

  test('AU11: reset password refuses a missing token and a mismatched pair', async ({
    page,
  }) => {
    await page.goto('/reset-password')
    await expect(page.getByTestId('reset-password-invalid-token')).toBeVisible()
    await expect(page.getByTestId('reset-password-submit')).toHaveCount(0)

    await page.goto('/reset-password?token=e2e-not-a-real-token')
    const fields = page
      .getByRole('textbox')
      .or(page.locator('input[type=password]'))
    await fields.nth(0).fill('secretPass1!')
    await fields.nth(1).fill('secretPass2!')
    await page.getByTestId('reset-password-submit').click()

    await expect(page.getByTestId('reset-password-confirm-error')).toBeVisible()
    await expect(page).toHaveURL(/reset-password/)
  })

  test('AU12: two-factor holds Verify until the code is the right shape', async ({
    page,
  }) => {
    await page.goto('/two-factor')

    const verify = page.getByTestId('two-factor-verify')
    await expect(verify).toBeDisabled()

    await page.getByRole('textbox').first().fill('123')
    await expect(verify).toBeDisabled()
    await page.getByRole('textbox').first().fill('123456')
    await expect(verify).toBeEnabled()

    // A backup code has no six-digit shape, so the same field changes what counts as valid.
    await page.getByTestId('two-factor-toggle-backup').click()
    await expect(verify).toBeDisabled()
    await page.getByRole('textbox').first().fill('BACKUP-CODE')
    await expect(verify).toBeEnabled()
  })
})
