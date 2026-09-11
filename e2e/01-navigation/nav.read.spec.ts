import { expect, test } from '../fixtures/app'
import { tour } from '../utils/selectors'

const ROUTES = [
  { path: '/objects', heading: /objects/i },
  { path: '/processes', heading: /processes/i },
  { path: '/shares', heading: /shares/i },
  { path: '/templates', heading: /templates/i },
  { path: '/formulas', heading: /formulas/i },
  { path: '/constants', heading: /constants/i },
  { path: '/import', heading: /import/i },
  { path: '/settings', heading: /settings/i },
  { path: '/help', heading: /help/i },
] as const

test.describe('01 - navigation', () => {
  for (const route of ROUTES) {
    test(`N1: ${route.path} renders its own page`, async ({ page }) => {
      await page.goto(route.path)

      await expect(
        page.getByRole('heading', { name: route.heading }).first()
      ).toBeVisible()
    })
  }

  test('N4: /groups is not-found — the route was deleted, not renamed', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.expectError(/404 \(Not Found\)/)
    await page.goto('/groups')

    await expect(
      page.getByRole('heading', { name: /page not found/i })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /go home/i })).toBeVisible()
  })

  test('N10: an unknown route is not-found, and Go Home returns', async ({
    page,
    consoleGuard,
  }) => {
    consoleGuard.expectError(/404 \(Not Found\)/)
    await page.goto('/this-route-does-not-exist')

    const goHome = page.getByRole('link', { name: /go home/i })
    await expect(goHome).toBeVisible()
    await goHome.click()

    await expect(page).not.toHaveURL(/this-route-does-not-exist/)
  })

  test('N2/N3: the Library dropdown exposes its children and stays active on them', async ({
    page,
  }) => {
    await page.goto('/objects')

    // Open the menu and PROVE it, before asking about its contents. Radix mounts the items and then
    await tour(page, 'navLibrary').click()
    await expect(tour(page, 'navLibrary')).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    // Each child by NAME rather than an exact count: dropping one still fails, and the menu is
    // where new Library pages land while they are being built.
    const menu = page.getByRole('menu')
    await expect(
      menu.getByRole('menuitem', { name: /template/i })
    ).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /formula/i })).toBeVisible()
    await expect(
      menu.getByRole('menuitem', { name: /constant/i })
    ).toBeVisible()

    await menu.getByRole('menuitem', { name: /formula/i }).click()
    await expect(page).toHaveURL(/\/formulas/)

    await expect(tour(page, 'navLibrary')).toHaveClass(/text-primary/)
  })

  test('N5: the footer reaches /help', async ({ page }) => {
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()

    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: /help/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/help/)
  })

  test('N6: the advertised mod+K opens the command centre, and Esc closes it', async ({
    page,
  }) => {
    await page.goto('/objects')
    await expect(tour(page, 'searchButton')).toBeVisible()

    const isApple = await page.evaluate(() =>
      /mac|iphone|ipad/i.test(navigator.userAgent)
    )
    await page.keyboard.press(isApple ? 'Meta+k' : 'Control+k')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('N1b: each nav item routes and marks itself active', async ({
    page,
  }) => {
    await page.goto('/objects')

    await tour(page, 'navProcesses').click()
    await expect(page).toHaveURL(/\/processes/)
    await expect(tour(page, 'navProcesses')).toHaveClass(/text-primary/)

    await tour(page, 'navShares').click()
    await expect(page).toHaveURL(/\/shares/)
    await expect(tour(page, 'navShares')).toHaveClass(/text-primary/)
  })
})
