import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/app'
import { resetPreferences } from '../utils/preferences'
import { tour } from '../utils/selectors'

/**
 * `/settings` is where the preferences in this folder are set, so the two live together.
 *
 * Everything here writes ACCOUNT state, which outlives the run — each test puts back what it
 * changed. Nothing may assume a default: a page can open in any theme, view or locale.
 */

/**
 * SE5 sets the objects view and puts it back as its LAST step, which only runs when it passes. When
 * it fails first the account is left on `columns`, and every table spec that follows — in other
 * files, in later runs — reads it and reddens. Restoring here runs either way.
 */
test.afterAll(async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  // `resetPreferences` runs IN the page for the session cookie and `__IOM_CONFIG__`, neither of
  // which exists on about:blank.
  await page.goto('/objects')
  await resetPreferences(page)
  await context.close()
})

async function openTab(page: Page, tab: string): Promise<void> {
  await page.goto('/settings')
  // `toPass`: a click landing before hydration does nothing at all, silently.
  await expect(async () => {
    await page.getByTestId(`settings-tab-${tab}`).click()
    await expect(page.getByTestId(`settings-tab-${tab}`)).toHaveAttribute(
      'data-state',
      'active',
      { timeout: 3_000 }
    )
  }).toPass({ timeout: 30_000 })
}

test.describe('13 - settings', () => {
  test('SE1/SE2: four tabs, and the security tab renders', async ({ page }) => {
    await page.goto('/settings')

    for (const tab of ['account', 'security', 'appearance', 'preferences']) {
      await expect(page.getByTestId(`settings-tab-${tab}`)).toBeVisible()
    }

    await openTab(page, 'security')
    await expect(page.getByTestId('security-settings')).toBeVisible()
  })

  test('SE3: the theme applies at once and survives a reload', async ({
    page,
  }) => {
    await openTab(page, 'appearance')
    const root = page.locator('html')
    const started = (await root.getAttribute('class'))?.includes('dark')
      ? 'dark'
      : 'light'
    const other = started === 'dark' ? 'light' : 'dark'

    await expect(async () => {
      await page.getByTestId(`appearance-theme-${other}`).click()
      await expect(root).toHaveClass(
        other === 'dark' ? /dark/ : /^(?!.*dark).*$/,
        { timeout: 3_000 }
      )
    }).toPass({ timeout: 30_000 })

    // The tab is local state, so a reload returns to Account — the stored THEME is what persists.
    await openTab(page, 'appearance')
    await expect(page.getByTestId(`appearance-theme-${other}`)).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await page.getByTestId(`appearance-theme-${started}`).click()
    await expect(
      page.getByTestId(`appearance-theme-${started}`)
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('SE5: a view set here drives the list page and survives a reload', async ({
    page,
  }) => {
    await openTab(page, 'preferences')

    await expect(async () => {
      await page.getByTestId('pref-objects-trigger').click()
      await page.getByTestId('pref-objects-columns').click()
      await expect(page.getByTestId('pref-objects-trigger')).toContainText(
        'Columns',
        { timeout: 3_000 }
      )
    }).toPass({ timeout: 30_000 })

    await tour(page, 'navObjects').click()
    await expect(page.getByTestId('view-option-columns')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.reload()
    await expect(page.getByTestId('view-option-columns')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    // Put it back: every table spec in the next run reads this.
    await expect(async () => {
      await page.getByTestId('view-option-table').click()
      await expect(page.getByTestId('data-table')).toBeVisible({
        timeout: 5_000,
      })
    }).toPass({ timeout: 30_000 })
    await page.reload()
    await expect(page.getByTestId('data-table')).toBeVisible()
  })

  test('SE6: every preference label is translated, never a raw key path', async ({
    page,
  }) => {
    await openTab(page, 'preferences')

    const text = await page.getByTestId('settings-page').innerText()
    // A missed lookup renders the key itself — `objects.viewTypes.grid` reads as a label until
    // you notice the dots. next-intl only WARNS, so nothing else catches it.
    const keyPaths = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[a-z][\w-]*(\.[A-Za-z][\w-]*){1,}$/.test(line))

    expect(keyPaths).toEqual([])
  })

  test('SE7: the user menu links to /settings', async ({ page }) => {
    await page.goto('/objects')
    await tour(page, 'userMenuTrigger').click()

    await page.getByTestId('nav-settings').click()
    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByTestId('settings-page')).toBeVisible()
  })
})
