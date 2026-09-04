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
 * Two silent failures here: a click landing before hydration does nothing, and the write is
 * optimistic — two writes in flight can land out of order and the later response wins. Waiting for
 * the cookie mirror makes each call a completed step.
 */
async function setPageSize(
  page: import('@playwright/test').Page,
  size: string
) {
  await page.goto('/settings')
  await page.getByTestId('settings-tab-preferences').click()
  await expect(async () => {
    await page.getByTestId('pref-page-size-trigger').click()
    await page.getByTestId(`pref-page-size-${size}`).click()
    await expect(page.getByTestId('pref-page-size-trigger')).toContainText(
      size,
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
  // Restores after EVERY case, so no test relies on what a previous one set.
  test.afterEach(async ({ page }) => {
    await setPageSize(page, '20')
  })

  test('one page size serves every table', async ({ page }) => {
    await setPageSize(page, '50')

    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('page-size')).toContainText('50')
  })

  // `TablePagination` returns null when `totalPages <= 1`, so an account with no shares renders no
  // page-size control at all — the query string is the only thing true whatever the row count.
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

    await expect(page.getByTestId('pref-page-size-trigger')).toContainText('50')
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
