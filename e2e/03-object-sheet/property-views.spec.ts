import { expect, test } from '../fixtures/app'
import {
  addProperty,
  enterEditMode,
  fillProperty,
  openCreateSheet,
  openObjectSheet,
  saveSheet,
} from '../utils/sheet'

/**
 * §6.7 — the property READ view's two layouts, and the preference behind them.
 *
 * Driven through ARIA rather than new testids: `ViewToggle` already carries `aria-label` +
 * `aria-pressed`, and a parallel testid would be a second source of truth to keep in step
 * (`11-e2e-test-plan.md`, Appendix A).
 *
 * `propertiesView` is ACCOUNT state — it outlives the run and every other spec in the file. So
 * these are serial, they never assert a starting layout, and the last one puts it back.
 */

test.describe.configure({ mode: 'serial' })

const stamp = () => `e2e-${Date.now()}`

const toggle = (page: import('@playwright/test').Page, name: RegExp) =>
  page.getByRole('button', { name })

const detailed = /detailed view/i
const grid = /grid overview/i

async function createWithProperties(page: import('@playwright/test').Page) {
  const name = `${stamp()}-views`
  const panel = await openCreateSheet(page)
  await panel.getByLabel(/name/i).first().fill(name)
  await addProperty(page, 0)
  await fillProperty(page, 0, 'width', '10')
  await addProperty(page, 1)
  await fillProperty(page, 1, 'height', '20')
  await saveSheet(page)
  return name
}

const rowFor = (page: import('@playwright/test').Page, name: string) =>
  page.getByTestId('data-table-row').filter({ hasText: name }).first()

test.describe('03 - object sheet / property views', () => {
  test('PV1: the read view offers both layouts, with one of them current', async ({
    page,
  }) => {
    const name = await createWithProperties(page)
    await openObjectSheet(page, rowFor(page, name))

    await expect(toggle(page, detailed)).toBeVisible()
    await expect(toggle(page, grid)).toBeVisible()

    // Exactly one is pressed — a toggle with neither or both set is a control that cannot say
    // which layout you are looking at.
    const pressed = await page
      .getByRole('button', { name: /detailed view|grid overview/i })
      .evaluateAll(
        (els) =>
          els.filter((el) => el.getAttribute('aria-pressed') === 'true').length
      )
    expect(pressed).toBe(1)
  })

  test('PV2: switching layout keeps every property on screen', async ({
    page,
  }) => {
    const name = await createWithProperties(page)
    await openObjectSheet(page, rowFor(page, name))

    await toggle(page, grid).click()
    await expect(toggle(page, grid)).toHaveAttribute('aria-pressed', 'true')
    // The layout changes; the DATA must not. A view that drops a property is worse than no view.
    await expect(page.getByText('width')).toBeVisible()
    await expect(page.getByText('height')).toBeVisible()

    await toggle(page, detailed).click()
    await expect(toggle(page, detailed)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('width')).toBeVisible()
    await expect(page.getByText('height')).toBeVisible()
  })

  test('PV3: the choice is an account preference, so it survives a reload', async ({
    page,
  }) => {
    const name = await createWithProperties(page)
    await openObjectSheet(page, rowFor(page, name))

    await toggle(page, grid).click()
    await expect(toggle(page, grid)).toHaveAttribute('aria-pressed', 'true')

    // Held only in component state it would revert here.
    await page.reload()
    await expect(page.getByTestId('data-table-row').first()).toBeVisible()
    await openObjectSheet(page, rowFor(page, name))
    await expect(toggle(page, grid)).toHaveAttribute('aria-pressed', 'true')
  })

  test('PV4: the same preference drives Settings and the sheet', async ({
    page,
  }) => {
    // One preference, two surfaces. They used to be able to disagree, which reads as the setting
    // not working rather than as two controls over one value.
    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()
    await expect(page.getByTestId('pref-properties')).toBeVisible()

    await page.getByTestId('pref-properties-detailed').click()
    await expect(page.getByTestId('pref-properties-detailed')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    const name = await createWithProperties(page)
    await openObjectSheet(page, rowFor(page, name))
    await expect(toggle(page, detailed)).toHaveAttribute('aria-pressed', 'true')
  })

  test('PV5: the toggle is absent where there is nothing to lay out', async ({
    page,
  }) => {
    // An object with no properties renders the empty line, not a control over nothing.
    const name = `${stamp()}-bare`
    const panel = await openCreateSheet(page)
    await panel.getByLabel(/name/i).first().fill(name)
    await saveSheet(page)

    await openObjectSheet(page, rowFor(page, name))
    await expect(toggle(page, grid)).toHaveCount(0)
  })

  test('PV6: edit mode replaces the read layouts with the editor', async ({
    page,
  }) => {
    // The toggle belongs to the READ view; editing is one list of rows whatever the preference
    // says, so leaving it on screen would offer a choice that changes nothing.
    const name = await createWithProperties(page)
    await openObjectSheet(page, rowFor(page, name))
    await expect(toggle(page, grid)).toBeVisible()

    await enterEditMode(page)
    await expect(toggle(page, grid)).toHaveCount(0)
    await expect(page.getByTestId('property-name-0')).toBeVisible()
  })

  test('PV7: back to detailed, so the next run starts where this one did', async ({
    page,
  }) => {
    // Not a case so much as the cleanup PV3/PV4 owe the account they share.
    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()
    await page.getByTestId('pref-properties-detailed').click()
    await expect(page.getByTestId('pref-properties-detailed')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
