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

  test('one page size serves every table', async ({ page, context }) => {
    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()
    await page.getByTestId('pref-page-size-50').click()

    // Wait for the MIRROR, not for the request. `page.goto` starts a new
    // document whose seed comes from the cookie, and the cookie is only written
    // once the account write has come back — the api recorder fires when a
    // request is SENT, so waiting on it proves nothing about the response.
    await expect
      .poll(async () => {
        const jar = await context.cookies()
        return jar.find((c) => c.name === 'iom_prefs')?.value ?? ''
      })
      .toContain('.50.')

    // The regression this pins: page size used to be three independent
    // `useState`s, so a size chosen in settings was already forgotten on the
    // list pages and forgotten again on reload.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('page-size')).toContainText('50')
  })

  /**
   * UNRESOLVED — do not delete, and do not weaken the assertion.
   *
   * `/objects` honours the stored size (above), `/shares` read back 20. The page
   * is wired the same way (`usePageSize` -> `size:` on the query -> `pageSize`
   * on the table), and core's `ShareListQuery` does accept `size`, so the wiring
   * alone does not explain it.
   *
   * It could not be settled here: repeated runs got the shared node to answer
   * 429, which makes every later observation untrustworthy. Re-run this against
   * a calm node and either fix the page or delete this note.
   */
  test.fixme('the same page size serves /shares', async ({ page }) => {
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
