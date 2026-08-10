import { expect, test } from '../fixtures/app'

/**
 * Preferences are a property of the ACCOUNT, not of this browser.
 *
 * Deliberately not a `.read.` spec: every case here writes to the node, and the
 * suite shares one login. Each test restores what it changed, in the same way
 * `auth.setup.ts` normalises the view.
 */

test.describe.configure({ mode: 'serial' })

/**
 * Sets the page size and does not return until the node has confirmed it.
 *
 * Two failures hide here, and both are silent.
 *
 * A click can land before hydration attaches the handler, in which case nothing happens at all —
 * hence `toPass` around a click that verifies itself.
 *
 * And the write is optimistic: `onSuccess` overwrites the cache with the node's merged bag, so two
 * writes in quick succession can land out of order and the LATER response wins. A restore-to-20
 * still in flight will therefore undo the 50 the next test just set, and the button flips back to
 * `aria-pressed="false"` on its own. Waiting for the cookie mirror — which is only written once the
 * response is in — is what makes each write a completed step rather than one in a race.
 */
async function setPageSize(
  page: import('@playwright/test').Page,
  size: string
) {
  await page.goto('/settings')
  await page.getByTestId('settings-tab-preferences').click()
  await expect(async () => {
    await page.getByTestId(`pref-page-size-${size}`).click()
    await expect(page.getByTestId(`pref-page-size-${size}`)).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 3_000 }
    )
  }).toPass({ timeout: 30_000 })

  await expect
    .poll(async () => {
      const jar = await page.context().cookies()
      return jar.find((c) => c.name === 'iom_prefs')?.value ?? ''
    })
    .toContain(`.${size}.`)
}

test.describe('13 - preferences / persistence', () => {
  // Restores the default after EVERY case, so no test may rely on what a previous one set. The
  // version of this file that did rely on it left a case asserting a size it had already reset.
  test.afterEach(async ({ page }) => {
    await setPageSize(page, '20')
  })

  test('one page size serves every table', async ({ page }) => {
    // `setPageSize` returns only once the cookie mirror holds the new value, so the write has
    // definitely come back. Waiting on the REQUEST instead would prove nothing: `api` records a
    // request when it is SENT.
    await setPageSize(page, '50')

    // The regression this pins: page size used to be three independent
    // `useState`s, so a size chosen in settings was already forgotten on the
    // list pages and forgotten again on reload.
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('page-size')).toContainText('50')
  })

  /**
   * Asserts the REQUEST, not the control, and that is the only way this one works.
   *
   * `TablePagination` returns null when `totalPages <= 1`. An account with no shares therefore
   * renders no page-size control at all, so reading one back can never succeed however correct the
   * page is — the earlier version of this test was measuring the seed data.
   *
   * The query string is true whatever the row count, and it is also the stronger claim: it says the
   * page passed the stored preference to the node, which is the thing that was once broken.
   */
  test('the same page size reaches the /shares query', async ({
    page,
    api,
  }) => {
    await setPageSize(page, '50')

    api.clear()
    await page.goto('/shares')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await expect.poll(() => api.count(/\/v1\/shares\?.*size=50/)).toBe(1)
  })

  test('the page size survives a reload', async ({ page }) => {
    await setPageSize(page, '50')

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
