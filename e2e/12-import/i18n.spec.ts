import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { AUTH_STATE } from '../setup/credentials'
import { loadAndMap, openWizard } from '../utils/import'
import { job, serveJobs } from '../utils/import-jobs'

/**
 * A `write` spec: the locale is an ACCOUNT preference, so switching it outlives the run and every
 * other spec would then read Dutch. It is put back in `afterAll`.
 *
 * The assertion is mostly the `consoleGuard`, which fails on `MISSING_MESSAGE` — `import.steps.<id>`
 * is built from the step id, so a prune that searches for literal keys cannot see it.
 */

async function setLanguage(page: Page, code: 'en' | 'nl'): Promise<void> {
  await page.goto('/settings')
  await page.getByTestId('settings-tab-appearance').click()
  await expect(async () => {
    await page.getByTestId(`appearance-language-${code}`).click()
    await expect(
      page.getByTestId(`appearance-language-${code}`)
    ).toHaveAttribute('aria-pressed', 'true', { timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
  await page.reload()
}

test.describe('12 - import / i18n', () => {
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE })
    await setLanguage(await context.newPage(), 'en')
    await context.close()
  })

  test('I61: every step renders in Dutch with no missing message', async ({
    page,
  }) => {
    await setLanguage(page, 'nl')
    await openWizard(page)

    await expect(page.getByTestId('wizard-stepper')).toContainText('Uploaden')
    await loadAndMap(page, 'levels.csv')
    await page.getByTestId('map-suggest').click()
    await page.getByTestId('map-suggest-accept').click()
    await page.getByTestId('wizard-next').click()
    await expect(page.getByTestId('check-stat-objects')).toBeVisible()
    await page.getByTestId('wizard-next').click()
    await expect(page.getByTestId('run-start')).toBeVisible()
  })

  test('I62: the four counts in one sentence share a locale', async ({
    page,
  }) => {
    await setLanguage(page, 'nl')
    await serveJobs(page, [
      job({
        id: '00000000-0000-7000-8000-000000000009',
        status: 'completed_with_errors',
        total: 1847,
        staged: 1847,
        processed: 1847,
        ok: 1500,
        failed: 300,
        skipped: 47,
      }),
    ])
    await page.goto('/import')

    // `n()` is browser-locale and next-intl's ICU is app-locale. Mixed, this line prints
    // "1,500 aangemaakt" beside "van 1.847".
    const separators = await Promise.all(
      ['outcome-created', 'outcome-failed', 'outcome-total'].map((id) =>
        page
          .getByTestId(id)
          .first()
          .textContent()
          .then((text) => text?.match(/1[.,]\d{3}/)?.[0]?.[1])
      )
    )
    const seen = separators.filter(Boolean)
    expect(seen.length).toBeGreaterThan(1)
    expect(new Set(seen).size).toBe(1)
  })
})
