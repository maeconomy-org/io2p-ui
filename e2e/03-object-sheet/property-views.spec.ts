import { expect, test } from '../fixtures/app'
import {
  addProperty,
  enterEditMode,
  fillProperty,
  gotoList,
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
  // `openCreateSheet` clicks the header button on whatever page is loaded — it does NOT navigate,
  // so the first test in a file has to get to /objects itself or it clicks into about:blank.
  await page.goto('/objects')
  await expect(page.getByTestId('data-table')).toBeVisible()
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
    //
    // The object is created FIRST, deliberately. Doing it after the Settings write mounts the
    // create sheet's own `PropertyReadView`, whose `usePreference` seeds from whatever the cache
    // holds — so the setup would write the previous test's layout back over the value this case
    // just set, and the assertion would fail against a preference the test itself undid.
    const name = await createWithProperties(page)

    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()
    await expect(page.getByTestId('pref-properties')).toBeVisible()

    // A Select, not a segmented control (`1ef3215`): the item exists only once the trigger opens,
    // and the chosen value shows on the TRIGGER rather than as `aria-pressed` on the option.
    // `toPass` because a click landing before hydration does nothing at all, silently.
    await expect(async () => {
      await page.getByTestId('pref-properties-trigger').click()
      await page.getByTestId('pref-properties-detailed').click()
      await expect(page.getByTestId('pref-properties-trigger')).toContainText(
        /list/i,
        { timeout: 3_000 }
      )
    }).toPass({ timeout: 30_000 })

    await gotoList(page, '/objects')
    await openObjectSheet(page, rowFor(page, name))
    await expect(toggle(page, detailed)).toHaveAttribute('aria-pressed', 'true')
  })

  test('PV5: the toggle is absent where there is nothing to lay out', async ({
    page,
  }) => {
    // An object with no properties renders the empty line, not a control over nothing.
    const name = `${stamp()}-bare`
    await page.goto('/objects')
    await expect(page.getByTestId('data-table')).toBeVisible()
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

    // An EXISTING property opens collapsed (`useState(isNew)`), so the row is the editor's proof
    // here — the name field lives in the CollapsibleContent and is not in the DOM until expanded.
    await expect(page.getByTestId('property-row-0')).toBeVisible()
    await page.getByTestId('property-toggle-0').click()
    await expect(page.getByTestId('property-name-0')).toBeVisible()
  })

  test('PV7: back to detailed, so the next run starts where this one did', async ({
    page,
  }) => {
    // Not a case so much as the cleanup PV3/PV4 owe the account they share.
    await page.goto('/settings')
    await page.getByTestId('settings-tab-preferences').click()
    // A Select, not a segmented control (`1ef3215`): the item only exists once the trigger opens,
    // and the chosen value shows on the TRIGGER rather than as `aria-pressed` on the option.
    // `toPass`: a click landing before hydration does nothing at all, silently — the same guard
    // `13-preferences` uses on the identical control.
    await expect(async () => {
      await page.getByTestId('pref-properties-trigger').click()
      await page.getByTestId('pref-properties-detailed').click()
      await expect(page.getByTestId('pref-properties-trigger')).toContainText(
        /list/i,
        { timeout: 3_000 }
      )
    }).toPass({ timeout: 30_000 })
  })
})
