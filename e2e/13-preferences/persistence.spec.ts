import { expect, test } from '../fixtures/app'

/**
 * Preferences are a property of the ACCOUNT, not of this browser.
 *
 * Deliberately not a `.read.` spec: every case here writes to the node, and the
 * suite shares one login. Each test restores what it changed, in the same way
 * `auth.setup.ts` normalises the view.
 */

test.describe.configure({ mode: 'serial' })

test.describe('13 - preferences / persistence', () => {
  test.afterEach(async ({ page }) => {
    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()
    await page.getByTestId('pref-page-size-20').click()
    await expect(page.getByTestId('pref-page-size-20')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('one page size serves every table', async ({ page }) => {
    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()
    await page.getByTestId('pref-page-size-50').click()

    // The regression this pins: page size used to be three independent
    // `useState`s, so a size chosen on /objects was already forgotten on
    // /shares and forgotten again on reload.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('page-size')).toContainText('50')

    await page.goto('/shares')
    await expect(page.getByTestId('page-size')).toContainText('50')
  })

  test('the page size survives a reload', async ({ page }) => {
    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()
    await page.getByTestId('pref-page-size-50').click()

    await page.reload()
    await page.getByTestId('settings-tab-preferences').click()

    await expect(page.getByTestId('pref-page-size-50')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})

test.describe('13 - preferences / language', () => {
  test('switching language does not reload the document', async ({ page }) => {
    await page.goto('/settings')
    await page.getByTestId('settings-tab-appearance').click()

    // A sentinel on `window` survives a React transition and dies with a full
    // document load. That is the difference between `router.refresh()` and the
    // `location.reload()` this replaced.
    await page.evaluate(() => {
      ;(window as unknown as { __probe?: string }).__probe = 'alive'
    })

    await page.getByTestId('appearance-language-nl').click()
    await expect(page.getByTestId('appearance-language-nl')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    expect(
      await page.evaluate(
        () => (window as unknown as { __probe?: string }).__probe
      )
    ).toBe('alive')

    await page.getByTestId('appearance-language-en').click()
    await expect(page.getByTestId('appearance-language-en')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
